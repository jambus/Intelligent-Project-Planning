import { getStorageItem } from '../utils/storage';

export interface AISettings {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export const DEFAULT_SCHEDULING_PROMPT = `YOUR TASK:
Match the best resources to fulfill the {{phase}} gaps for a BATCH of projects.
Rules:
1. DO NOT assign more MDs than a project needs.
2. DO NOT assign more MDs than a resource's "idleMd" across all projects they are assigned to.
3. Skill Matching: Prioritize resources whose "skills" match the project's Tech Stack or Domain.
4. Phase rules:
   - If phase is 'dev', only assign Developers (前端/后端/APP/全栈).
   - If phase is 'test', only assign Testers (测试工程师). Ensure testing effort follows development effort.
5. Provide the "allocatedMd" (must be an integer >= 1) and "allocationPercentage".
6. {{strategyInstruction}}

Return ONLY a JSON Array with this exact format (do not wrap in markdown blocks, just raw JSON):
[{"projectId": 1, "resourceId": 1, "targetGap": "{{phase}}", "allocatedMd": 5, "allocationPercentage": 100, "reason": "Skill match explanation..."}]`;

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
      temperature: 0.1, // Keep it low for math/logic
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
 * Batch Scheduling: Suggest allocations for a BATCH of projects in a specific phase.
 */
export const suggestAllocationsForBatch = async (
  projects: { id: number; name: string; gap: number; techStack?: string; domain?: string; startDate?: string; endDate?: string }[],
  idleResources: { id: number; name: string; role: string; idleMd: number; skills: string[] }[],
  phase: 'dev' | 'test',
  strategy: SchedulingStrategy = 'focused'
): Promise<AIMicroAllocation[]> => {
  const settings = await getAISettings();
  if (!settings) throw new Error('AI API Key is not configured.');

  let strategyInstruction = '';
  if (strategy === 'balanced') {
    strategyInstruction = 'BALANCED STRATEGY: Prefer assigning resources at 50% allocationPercentage so they can multitask on 2 projects concurrently, unless the gap is very small.';
  } else if (strategy === 'urgent') {
    strategyInstruction = 'URGENT STRATEGY: Assign resources at 100% or even 120% (if your logic allows over-allocation for overtime) to finish as fast as possible.';
  } else {
    strategyInstruction = 'FOCUSED STRATEGY: Prefer assigning resources at 100% allocationPercentage to finish one project before starting another.';
  }

  // Load custom prompt from storage, or use default
  const customPromptTemplate = await getStorageItem<string>('aiPromptTemplate') || DEFAULT_SCHEDULING_PROMPT;
  
  // Replace placeholders
  const resolvedPromptRules = customPromptTemplate
    .replace(/\{\{phase\}\}/g, phase)
    .replace(/\{\{strategyInstruction\}\}/g, strategyInstruction);

  const systemMsg = `You are a strict resource allocation algorithm. You prioritize skill matching. You only output valid JSON arrays. You never over-allocate.
  
Candidate Resources (with remaining idle capacity & skills):
${JSON.stringify(idleResources)}

${resolvedPromptRules}
`;

  const prompt = `We are scheduling a BATCH of ${projects.length} projects for the ${phase.toUpperCase()} phase.
Projects:
${JSON.stringify(projects)}

Return ONLY a JSON Array containing allocations for ALL these projects.`;

  return await callAI(systemMsg, prompt, settings);
};
