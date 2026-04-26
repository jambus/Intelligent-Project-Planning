import { getStorageItem } from '../utils/storage';
import type { Resource, Project, Allocation } from '../db';

export interface AISettings {
  apiKey: string;
  model: string;
  baseUrl: string;
}

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
      temperature: 0.05, // Accuracy is key
    })
  });
  if (!response.ok) throw new Error(`AI API Error: ${response.status}`);
  const data = await response.json();
  return extractJsonArray(data.choices[0].message.content.trim());
};

/**
 * Phase 1: Draft global schedule
 */
export const draftInitialSchedule = async (resources: Resource[], projects: Project[], year: number): Promise<Partial<Allocation>[]> => {
  const settings = await getAISettings();
  if (!settings) throw new Error('AI API Key is not configured.');
  
  const prompt = `
Generate a BASE resource plan for ${year}. 
- Priority: TOP items first.
- Strict Match: Dev roles to devTotalMd, Test roles to testTotalMd.
- Capacity: Max 100% per person.
- Format: JSON Array.
Resources: ${JSON.stringify(resources)}
Projects: ${JSON.stringify(projects.map((p, i) => ({ ...p, priorityOrder: i + 1 })))}

Output ONLY a JSON array with these exact keys:
[{"resourceId": 1, "projectId": 1, "allocationPercentage": 100, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "reason": "..."}]
`;

  return await callAI("You are a resource planning expert. Create a full initial plan.", prompt, settings);
};

/**
 * Phase 2: Targeted Refinement (The "Closer")
 */
export const refineGaps = async (gaps: any[], idleResources: any[]): Promise<Partial<Allocation>[]> => {
  const settings = await getAISettings();
  if (!settings) throw new Error('AI API Key is not configured.');

  const prompt = `
CRITICAL: ELIMINATE REMAINING GAPS. 
There are leftover MD requirements. You MUST use idle staff to fill them. 
Zero tolerance for idle time if gaps exist.

Remaining Gaps: ${JSON.stringify(gaps.map(g => ({ id: g.id, name: g.name, devGap: g.devGap, testGap: g.testGap })))}
Idle Staff: ${JSON.stringify(idleResources.map(r => ({ id: r.id, name: r.name, role: r.role, idleMd: r.idleMd })))}

Instruction:
1. For every devGap > 0, assign a Dev/Fullstack from Idle Staff.
2. For every testGap > 0, assign a Test/Fullstack from Idle Staff.
3. Every NEW allocation MUST be at least 1 MD.
4. If a dev needs 1 day and Resource A is free, YOU MUST ASSIGN IT.

Output ONLY a JSON array with these exact keys:
[{"resourceId": 1, "projectId": 1, "allocationPercentage": 100, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "reason": "..."}]
`;

  return await callAI("You are a gap-filling specialist. Your only mission is to reduce project gaps to ZERO. Be aggressive and use all idle time.", prompt, settings);
};
