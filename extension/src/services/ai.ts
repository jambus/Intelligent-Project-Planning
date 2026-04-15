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

/**
 * Generate a schedule using AI (OpenAI compatible)
 */
export const generateSchedule = async (
  resources: Resource[],
  projects: Project[]
): Promise<Partial<Allocation>[]> => {
  const settings = await getAISettings();
  if (!settings) {
    throw new Error('AI API Key is not configured. Please set it in Options.');
  }

  const prompt = `
You are an expert AI Project Resource Scheduler.
Your task is to assign the available resources to the given projects based on priority and skills.

Available Resources:
${JSON.stringify(resources, null, 2)}

Pending Projects (Sort by Priority: High > Medium > Low):
${JSON.stringify(projects, null, 2)}

Rules:
1. Max total capacity for a resource across all projects at any time is 100%.
2. Try to match roles/skills if applicable (e.g., Frontend to UI tasks, though our projects are high-level right now).
3. Return ONLY a valid JSON array of objects representing the allocations. Do NOT wrap it in markdown code blocks.

JSON Schema per allocation object:
{
  "resourceId": number,
  "projectId": number,
  "allocationPercentage": number,
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD"
}
`;

  const url = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API Error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  const rawContent = data.choices[0].message.content.trim();
  
  try {
    // Attempt to parse. Might need cleanup if LLM still adds markdown despite instructions.
    const cleanContent = rawContent.replace(/^```json/, '').replace(/```$/, '').trim();
    const allocations = JSON.parse(cleanContent) as Partial<Allocation>[];
    return allocations;
  } catch (err) {
    console.error('Failed to parse AI response:', rawContent);
    throw new Error('AI returned an invalid JSON format.');
  }
};
