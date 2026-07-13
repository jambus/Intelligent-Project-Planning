import { getStorageItem } from '../utils/storage';

export interface AISettings {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export const DEFAULT_SCORING_PROMPT = `YOUR TASK:
Calculate a skill-matching score (1 to 100) for each candidate resource against each project for the {{phase}} phase.

CRITICAL INSTRUCTIONS:
1. Focus ONLY on skill matching. Do NOT consider availability, dates, or constraints.
2. Evaluate the match between the project's "techStack", "domain", and "details" vs the resource's "skills".
3. MANDATORY LEADS: If a project specifies a "projectTechLead" (for Dev) or "projectQualityLead" (for Test), and the candidate resource's name matches EXACTLY, give them a score of 1000.
4. Score criteria:
   - 1000: Exact match for Tech Lead / Quality Lead.
   - 80-100: Perfect skill match (e.g., all tech stack and domain skills align).
   - 50-79: Partial match (e.g., some tech stack matches).
   - 1-49: Poor match, but still capable of doing the role.
   - 0: Completely unable to do the task (e.g., wrong role).
5. Only score developers for 'dev' phase, and testers for 'test' phase.

Return ONLY a JSON Array with this exact format (do not wrap in markdown blocks, raw JSON only):
[{"projectId": 1, "resourceId": 1, "score": 85, "reason": "Matches React and Node.js skills."}]`;

export const getAISettings = async (): Promise<AISettings | null> => {
  const apiKey = await getStorageItem<string>('openAiApiKey');
  const model = await getStorageItem<string>('openAiModel') || 'gpt-4o-mini';
  const baseUrl = await getStorageItem<string>('openAiBaseUrl') || 'https://api.openai.com/v1';
  if (!apiKey) return null;
  return { apiKey, model, baseUrl };
};

const DEFAULT_AI_TIMEOUT_MS = 60000; // Scoring is much faster than allocation

const getAiTimeoutMs = async (): Promise<number> => {
  const raw = await getStorageItem<number | string>('aiTimeout');
  const seconds = Number(raw);
  if (!raw || !Number.isFinite(seconds) || seconds <= 0) return DEFAULT_AI_TIMEOUT_MS;
  return seconds * 1000;
};

export interface AIScore {
  projectId: number;
  resourceId: number;
  score: number;
  reason: string;
}

const extractScoreArray = (text: string): AIScore[] => {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) {
    console.warn('[AI Scoring] No JSON array found in response.');
    return [];
  }
  let arr: any;
  try {
    arr = JSON.parse(text.substring(start, end + 1));
  } catch (err) {
    console.error('[AI Scoring] Failed to parse JSON array:', err);
    return [];
  }
  if (!Array.isArray(arr)) return [];

  return arr.filter(entry => 
    entry.projectId > 0 && 
    entry.resourceId > 0 && 
    typeof entry.score === 'number'
  );
};

export const fetchAIScores = async (
  projects: any[],
  resources: any[],
  phase: 'dev' | 'test',
  signal?: AbortSignal
): Promise<AIScore[]> => {
  const settings = await getAISettings();
  if (!settings) throw new Error('AI API Key is not configured.');

  const customPromptTemplate = await getStorageItem<string>('aiScoringPrompt') || DEFAULT_SCORING_PROMPT;
  const systemMsg = customPromptTemplate.replace(/\{\{phase\}\}/g, phase);

  const prompt = `Phase: ${phase.toUpperCase()}
Projects:
${JSON.stringify(projects.map(p => ({
    id: p.id, name: p.name, techStack: p.techStack, domain: p.domain,
    projectTechLead: p.projectTechLead, projectQualityLead: p.projectQualityLead,
    details: phase === 'dev' ? p.detailsProductDevMd : p.detailsProductTestMd
  })))}

Candidate Resources:
${JSON.stringify(resources.map(r => ({ id: r.id, name: r.name, role: r.role, skills: r.skills })))}

Return ONLY a JSON Array of scores.`;

  console.log(`[AI Scoring] 🚀 Requesting scores for ${projects.length} projects and ${resources.length} resources`);
  
  const timeoutMs = await getAiTimeoutMs();
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const onExternalAbort = () => timeoutController.abort();
  if (signal) {
    if (signal.aborted) timeoutController.abort();
    else signal.addEventListener('abort', onExternalAbort);
  }

  try {
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
        temperature: 0.1,
      }),
      signal: timeoutController.signal
    });
    
    if (!response.ok) throw new Error(`AI API Error: ${response.status}`);
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    
    if (typeof content !== 'string') {
      console.warn('[AI Scoring] Unexpected response shape.');
      return [];
    }
    
    const scores = extractScoreArray(content.trim());
    console.log(`[AI Scoring] 📥 Received ${scores.length} scores`);
    return scores;
    
  } catch (err: any) {
    if (timeoutController.signal.aborted && !signal?.aborted) {
      throw new Error(`AI Scoring 超时（${timeoutMs / 1000}s）`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
};
