import { getStorageItem } from '../utils/storage';

export interface AISettings {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export const DEFAULT_STRATEGY_FOCUSED = 'Assign the project to a single person as much as possible. If a Tech Lead or Quality Lead is specified, they MUST be the sole assignee taking 100% allocation.';
export const DEFAULT_STRATEGY_BALANCED = 'Form a balanced team. Include the specified Tech Lead and Quality Lead along with other available developers/testers, typically at 50% allocation to allow concurrent work on multiple projects.';
export const DEFAULT_STRATEGY_URGENT = 'Max out allocations to finish the project as early as possible within the expected start and end dates. Prioritize 100% or higher allocation.';

export const DEFAULT_SCHEDULING_PROMPT = `YOUR TASK:
Match the best resources to fulfill the {{phase}} gaps for a BATCH of projects.

CRITICAL INSTRUCTIONS:
1. MANDATORY LEADS: If a project has a named "projectTechLead" (for Dev) or "projectQualityLead" (for Test), you MUST assign that specific person to the project if they appear in the Candidate Resources and have "idleMd" > 0.
   - For Leads, prefer a high "allocationPercentage" (e.g., 50% or 100%) to ensure they are properly involved.
   - Note: When schedulingStrategy is "focused", the Lead IS the sole person. Do NOT add additional people even if the project gap is larger than the Lead's idleMd.
2. PER-PROJECT SCHEDULING STRATEGY: Each project in the batch has a "schedulingStrategy" field. You MUST strictly follow it:
   - "focused" (单人模式): {{strategyFocused}}
   - "balanced" (均衡模式): {{strategyBalanced}}
   - "urgent" (进阶模式): {{strategyUrgent}}
3. SKILL-BASED MATCHING & TEAM CONSTRAINTS: Use "techStack", "domain", and "detailsProductDevMd" / "detailsProductTestMd" to match resources with the right "skills".
   - Priority: Match person's skills to the specific products/tasks mentioned in the project details.
   - SCRUM TEAM CONSTRAINTS (CRITICAL): A project may have an "allowedResourceIds" array. If it exists and is not empty, you MUST ONLY assign resources whose ID is in that array. Assignments outside this array will be REJECTED by JS hard logic.
4. MAXIMIZE UTILIZATION: You MUST allocate ALL available "idleMd" across ALL candidate resources. 
5. MINIMAL FRAGMENTATION & SINGLE PROJECT PER WEEK: 
   - A resource can ONLY be assigned to ONE project per week. Do not fragment their time across multiple projects in the same week.
   - MINIMUM ALLOCATION UNIT: Each assignment MUST be at least 3 days (if the project gap and resource idleMd allow).
6. NO WASTE: Leaving a resource with idleMd > 0 when projects still have gaps is a FAILURE. 
7. {{skillRule}}
8. Phase rules:
   - If phase is 'dev', only assign Developers (前端/后端/APP/全栈).
   - If phase is 'test', only assign Testers (测试工程师). Testing can start as early as the same day as development, but MUST NOT start before development.
9. Provide "allocatedMd" (integer >= 1) and "allocationPercentage".

Return ONLY a JSON Array with this exact format (do not wrap in markdown blocks, raw JSON only):
[{"projectId": 1, "resourceId": 1, "targetGap": "{{phase}}", "allocatedMd": 5, "allocationPercentage": 100, "reason": "Reason..."}]`;

export const getAISettings = async (): Promise<AISettings | null> => {
  const apiKey = await getStorageItem<string>('openAiApiKey');
  const model = await getStorageItem<string>('openAiModel') || 'gpt-4o-mini';
  const baseUrl = await getStorageItem<string>('openAiBaseUrl') || 'https://api.openai.com/v1';
  if (!apiKey) return null;
  return { apiKey, model, baseUrl };
};

// Default client-side timeout. DeepSeek and other reasoning-heavy models often
// take well over a minute per batch, so the default is generous. Can be
// overridden via the `aiTimeout` setting (seconds).
const DEFAULT_AI_TIMEOUT_MS = 180000;

const getAiTimeoutMs = async (): Promise<number> => {
  const raw = await getStorageItem<number | string>('aiTimeout');
  const seconds = Number(raw);
  if (!raw || !Number.isFinite(seconds) || seconds <= 0) return DEFAULT_AI_TIMEOUT_MS;
  return seconds * 1000;
};

const extractJsonArray = (text: string): any[] => {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) {
    // The model returned no JSON array — treat as "no suggestions", not an error.
    console.warn('[AI Schema] No JSON array found in response (treated as empty).');
    return [];
  }
  let arr: any;
  try {
    arr = JSON.parse(text.substring(start, end + 1));
  } catch (err) {
    // Genuine parse failure: surface it distinctly so it is not silently swallowed.
    console.error('[AI Schema] Failed to parse JSON array from response:', err);
    return [];
  }
  if (!Array.isArray(arr)) return [];

  return arr.filter(entry => {
    const isValid =
      entry.projectId > 0 &&
      entry.resourceId > 0 &&
      entry.allocatedMd >= 1 &&
      entry.allocationPercentage >= 1 &&
      entry.allocationPercentage <= 100;

    if (!isValid) {
      console.warn('[AI Schema] invalid entry:', entry);
    }
    return isValid;
  });
};

const callAI = async (systemMsg: string, prompt: string, settings: AISettings, signal?: AbortSignal) => {
  const url = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;
  // Guard against a hung request: abort after the configured timeout. Also
  // honour an external abort signal (e.g. the user pressing "stop").
  const timeoutMs = await getAiTimeoutMs();
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const onExternalAbort = () => timeoutController.abort();
  if (signal) {
    if (signal.aborted) timeoutController.abort();
    else signal.addEventListener('abort', onExternalAbort);
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: prompt }],
        temperature: 0.05,
      }),
      signal: timeoutController.signal
    });
    if (!response.ok) throw new Error(`AI API Error: ${response.status}`);
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      console.warn('[AI] Unexpected response shape: missing choices[0].message.content.');
      return [];
    }
    return extractJsonArray(content.trim());
  } catch (err) {
    // Distinguish our own timeout from an external (user-initiated) abort.
    if (timeoutController.signal.aborted && !signal?.aborted) {
      throw new Error(`AI API 超时（${timeoutMs / 1000}s），请检查网络或 API 配置`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
};

export interface AIMicroAllocation {
  projectId?: number;
  resourceId: number;
  targetGap: 'dev' | 'test';
  allocatedMd: number;
  allocationPercentage: number;
  reason: string;
}

export type SchedulingStrategy = 'balanced' | 'focused' | 'urgent';

/**
 * Enhanced Batch Scheduling with Calendar Awareness & Greedy Logic
 */
export const suggestAllocationsForBatch = async (
  projects: { 
    id: number; 
    name: string; 
    gap: number; 
    techStack?: string; 
    domain?: string; 
    startDate?: string; 
    endDate?: string;
    projectTechLead?: string;
    projectQualityLead?: string;
    detailsProductDevMd?: string;
    detailsProductTestMd?: string;
    schedulingStrategy?: 'balanced' | 'focused' | 'urgent';
    allowedResourceIds?: number[];
  }[],
  idleResources: { id: number; name: string; role: string; idleMd: number; skills: string[]; scheduleSummary?: string }[],
  phase: 'dev' | 'test',
  isRelaxed: boolean = false,
  signal?: AbortSignal
): Promise<AIMicroAllocation[]> => {
  const settings = await getAISettings();
  if (!settings) throw new Error('AI API Key is not configured.');

  const skillRule = isRelaxed 
    ? 'RELAXED MATCHING: IGNORE skills. Any resource with matching role can do any task.' 
    : 'STRICT MATCHING: Match skills to project Tech Stack/Domain first.';

  const customPromptTemplate = await getStorageItem<string>('aiPromptTemplate') || DEFAULT_SCHEDULING_PROMPT;
  const promptFocused = await getStorageItem<string>('strategyFocused') || DEFAULT_STRATEGY_FOCUSED;
  const promptBalanced = await getStorageItem<string>('strategyBalanced') || DEFAULT_STRATEGY_BALANCED;
  const promptUrgent = await getStorageItem<string>('strategyUrgent') || DEFAULT_STRATEGY_URGENT;
  
  const resolvedPromptRules = customPromptTemplate
    .replace(/\{\{phase\}\}/g, phase)
    .replace(/\{\{skillRule\}\}/g, skillRule)
    .replace(/\{\{strategyFocused\}\}/g, promptFocused)
    .replace(/\{\{strategyBalanced\}\}/g, promptBalanced)
    .replace(/\{\{strategyUrgent\}\}/g, promptUrgent);

  const systemMsg = `You are an expert resource allocation optimizer.
Mode: ${isRelaxed ? 'MAX UTILIZATION' : 'PRECISION MATCHING'}.
  
Candidate Resources (Aware of their current busy/idle periods):
${JSON.stringify(idleResources)}

${resolvedPromptRules}`;

  const prompt = `Batch of ${projects.length} projects for ${phase.toUpperCase()}.
Projects to fulfill:
${JSON.stringify(projects)}
Return ONLY a JSON Array.`;

  console.log(`[AI Debug] 🚀 Sending Request to LLM (${phase.toUpperCase()}, Relaxed: ${isRelaxed})`);
  console.log(`[AI Debug] Projects:`, projects.map(p => `${p.name} (Gap: ${p.gap}d, Lead: ${phase === 'dev' ? p.projectTechLead : p.projectQualityLead})`));
  console.log(`[AI Debug] Resources:`, idleResources.map(r => `${r.name} (${r.role}, Idle: ${r.idleMd}d)`));

  const result = await callAI(systemMsg, prompt, settings, signal);
  
  console.log(`[AI Debug] 📥 LLM Response:`, result);
  return result;
};
