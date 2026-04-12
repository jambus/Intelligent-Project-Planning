import type { AIProjectPlan, AppSettings, Task } from '../types';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_TOKENS = 2000;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export class AIService {
  private apiKey: string;
  private settings: AppSettings;

  constructor(apiKey: string, settings?: Partial<AppSettings>) {
    this.apiKey = apiKey;
    this.settings = {
      model: settings?.model ?? DEFAULT_MODEL,
      maxTokens: settings?.maxTokens ?? DEFAULT_MAX_TOKENS,
    };
  }

  async generateProjectPlan(
    projectName: string,
    description: string
  ): Promise<AIProjectPlan> {
    if (!this.apiKey) {
      throw new Error(
        'API key is required. Please set your OpenAI API key in the extension options.'
      );
    }

    const prompt = this.buildProjectPlanPrompt(projectName, description);
    const response = await this.callOpenAI(prompt);
    return this.parseProjectPlan(response);
  }

  async generateTaskBreakdown(
    milestoneTitle: string,
    milestoneDescription: string
  ): Promise<Task[]> {
    if (!this.apiKey) {
      throw new Error('API key is required.');
    }

    const prompt = `Break down the following project milestone into specific development tasks.
Milestone: ${milestoneTitle}
Description: ${milestoneDescription}

Return a JSON array of tasks with this structure:
[
  {
    "title": "Task name",
    "description": "Detailed description",
    "priority": "high|medium|low",
    "estimatedHours": number
  }
]
Return only the JSON array, no explanation.`;

    const response = await this.callOpenAI(prompt);
    const rawTasks = JSON.parse(response) as Array<
      Omit<Task, 'id' | 'status' | 'createdAt'>
    >;
    return rawTasks.map((t, i) => ({
      ...t,
      id: `task-${Date.now()}-${i}`,
      status: 'todo' as const,
      createdAt: new Date().toISOString(),
    }));
  }

  private buildProjectPlanPrompt(name: string, description: string): string {
    return `You are an expert software project manager. Create a detailed project plan for the following project.

Project Name: ${name}
Description: ${description}

Return a JSON object with exactly this structure:
{
  "summary": "Brief project overview",
  "estimatedWeeks": number,
  "techStack": ["technology1", "technology2"],
  "risks": ["risk1", "risk2"],
  "milestones": [
    {
      "title": "Milestone name",
      "description": "What this milestone achieves",
      "targetDate": "YYYY-MM-DD",
      "tasks": [
        {
          "title": "Task name",
          "description": "Task details",
          "priority": "high|medium|low",
          "status": "todo",
          "estimatedHours": number,
          "createdAt": "ISO date string"
        }
      ]
    }
  ]
}
Return only valid JSON, no markdown or explanation.`;
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.settings.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.settings.maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: { message: response.statusText } }));
      throw new Error(
        `OpenAI API error: ${
          (error as { error?: { message?: string } }).error?.message ??
          response.statusText
        }`
      );
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }
    return content.trim();
  }

  private parseProjectPlan(jsonString: string): AIProjectPlan {
    try {
      return JSON.parse(jsonString) as AIProjectPlan;
    } catch {
      throw new Error(
        'Failed to parse AI response as project plan. The AI returned invalid JSON.'
      );
    }
  }
}
