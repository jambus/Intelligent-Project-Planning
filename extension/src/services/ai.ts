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
  projects: Project[],
  year: number
): Promise<Partial<Allocation>[]> => {
  const settings = await getAISettings();
  if (!settings) {
    throw new Error('AI API Key is not configured. Please set it in Options.');
  }

  const projectsWithPriority = projects.map((p, index) => ({
    ...p,
    priorityOrder: index + 1
  }));

  const prompt = `
You are an expert Project Resource Optimizer. 
Goal: Eliminate project MD gaps using 100% of available resource capacity for the year ${year}.

### DATA
1. **Resources**: ${JSON.stringify(resources)}
2. **Projects**: ${JSON.stringify(projectsWithPriority)}

### CRITICAL RULES (STRICT ADHERENCE REQUIRED)
1. **NO ZERO-DAY ALLOCATIONS**: Every allocation MUST result in at least 1 Man-Day (MD). If an allocation would result in 0 MD, DO NOT INCLUDE IT.
2. **GREEDY GAP FILLING**: If a project has a gap (devTotalMd or testTotalMd) AND a resource with a matching role has idle capacity (>0%), you MUST assign that resource to that project until the gap is 0 or the resource is at 100% load.
3. **MANDATORY UTILIZATION**: Do not leave any relevant resource idle if there are projects with remaining MD requirements. 
4. **INTEGER MATH**: The formula (Working Days * allocationPercentage / 100) MUST result in an INTEGER >= 1.
5. **ROLE MAPPING**:
   - 前端/后端/APP/全栈工程师 -> devTotalMd.
   - 测试工程师 -> testTotalMd.
   - Fullstack (全栈) can help with testTotalMd ONLY if all devTotalMd is 100% satisfied.
6. **STRICT PRIORITY**: Solve priorityOrder 1 completely before moving to 2.

### Output Format
Return ONLY a valid JSON array. No text, no markdown.
JSON Schema:
[
  {
    "resourceId": number,
    "projectId": number,
    "allocationPercentage": number,
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "reason": "Explain why this allocation is >= 1 MD and how it fills the gap."
  }
]
`;

  console.group('🤖 AI Optimization Engine');
  console.log('[AI] Request Year:', year);
  
  const url = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { 
          role: 'system', 
          content: "You are a resource-hungry optimizer. Your absolute priority is to ensure NO project has a gap while resources are idle. Every single allocation you return MUST represent at least 1 full working day. Never return 0-day allocations." 
        }, 
        { role: 'user', content: prompt }
      ],
      temperature: 0.05, // Ultra-low for logic precision
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[AI] API Error:', response.status);
    console.groupEnd();
    throw new Error(`OpenAI API Error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  const rawContent = data.choices[0].message.content.trim();
  
  try {
    const cleanContent = rawContent.replace(/^```json/, '').replace(/```$/, '').trim();
    const allocations = JSON.parse(cleanContent) as Partial<Allocation>[];
    console.log('[AI] Generated Allocations:', allocations);
    console.groupEnd();
    return allocations;
  } catch (err) {
    console.error('[AI] Parse Error. Raw content:', rawContent);
    console.groupEnd();
    throw new Error('AI returned an invalid JSON format.');
  }
};
