import { getStorageItem } from '../utils/storage';

export interface AISettings {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export const DEFAULT_SCHEDULING_PROMPT = `YOUR TASK:
Match the best resources to fulfill the {{phase}} gaps for a BATCH of projects.

CRITICAL INSTRUCTIONS:
1. MANDATORY LEADS: If a project has a named "projectTechLead" (for Dev) or "projectQualityLead" (for Test), you MUST assign that specific person to the project if they appear in the Candidate Resources and have "idleMd" > 0.
   - For Leads, prefer a high "allocationPercentage" (e.g., 50% or 100%) to ensure they are properly involved.
2. SKILL-BASED MATCHING: Use "techStack", "domain", and especially "detailsProductDevMd" / "detailsProductTestMd" to match resources with the right "skills".
   - Priority: Match person's skills to the specific products/tasks mentioned in the project details.
3. MAXIMIZE UTILIZATION: You MUST allocate ALL available "idleMd" across ALL candidate resources. 
4. MINIMAL FRAGMENTATION: DO NOT split a single project into many tiny 1-2 day chunks across different people. 
   - A project should ideally have 1-2 primary owners. 
   - MINIMUM ALLOCATION UNIT: Each assignment MUST be at least 3 days (if the project gap and resource idleMd allow).
5. NO WASTE: Leaving a resource with idleMd > 0 when projects still have gaps is a FAILURE. 
6. {{skillRule}}
7. Phase rules:
   - If phase is 'dev', only assign Developers (前端/后端/APP/全栈).
   - If phase is 'test', only assign Testers (测试工程师). Testing can start as early as the same day as development, but MUST NOT start before development.
8. Provide "allocatedMd" (integer >= 1) and "allocationPercentage".
9. {{strategyInstruction}}

Return ONLY a JSON Array with this exact format (do not wrap in markdown blocks, raw JSON only):
[{"projectId": 1, "resourceId": 1, "targetGap": "{{phase}}", "allocatedMd": 5, "allocationPercentage": 100, "reason": "Reason..."}]`;

export const getAISettings = async (): Promise<AISettings | null> => {
  const apiKey = await getStorageItem<string>('openAiApiKey');
  const model = await getStorageItem<string>('openAiModel') || 'gpt-4o-mini';
  const baseUrl = await getStorageItem<string>('openAiBaseUrl') || 'https://api.openai.com/v1';
  if (!apiKey) return null;
  return { apiKey, model, baseUrl };
};

const extractJsonArray = (text: string): any[] => {
  try {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1) return [];
    return JSON.parse(text.substring(start, end + 1));
  } catch (err) {
    return [];
  }
};

const callAI = async (systemMsg: string, prompt: string, settings: AISettings) => {
  const url = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;
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
    })
  });
  if (!response.ok) throw new Error(`AI API Error: ${response.status}`);
  const data = await response.json();
  return extractJsonArray(data.choices[0].message.content.trim());
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
  }[],
  idleResources: { id: number; name: string; role: string; idleMd: number; skills: string[]; scheduleSummary?: string }[],
  phase: 'dev' | 'test',
  strategy: SchedulingStrategy = 'focused',
  isRelaxed: boolean = false
): Promise<AIMicroAllocation[]> => {
  const settings = await getAISettings();
  if (!settings) throw new Error('AI API Key is not configured.');

  let strategyInstruction = '';
  if (strategy === 'balanced') {
    strategyInstruction = 'BALANCED MODE: You MUST prefer 50% allocation to allow resources to work on multiple projects concurrently.';
  } else if (strategy === 'urgent') {
    strategyInstruction = 'URGENT MODE: Prioritize 100% allocation to finish projects as early as possible.';
  } else {
    strategyInstruction = 'FOCUSED MODE: Prefer 100% allocation for one project at a time.';
  }

  const skillRule = isRelaxed 
    ? 'RELAXED MATCHING: IGNORE skills. Any resource with matching role can do any task.' 
    : 'STRICT MATCHING: Match skills to project Tech Stack/Domain first.';

  const customPromptTemplate = await getStorageItem<string>('aiPromptTemplate') || DEFAULT_SCHEDULING_PROMPT;
  const resolvedPromptRules = customPromptTemplate
    .replace(/\{\{phase\}\}/g, phase)
    .replace(/\{\{strategyInstruction\}\}/g, strategyInstruction)
    .replace(/\{\{skillRule\}\}/g, skillRule);

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

  const result = await callAI(systemMsg, prompt, settings);
  
  console.log(`[AI Debug] 📥 LLM Response:`, result);
  return result;
};
