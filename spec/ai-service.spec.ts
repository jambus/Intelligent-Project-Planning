import { AIService } from '../src/services/ai-service';
import type { AIProjectPlan } from '../src/types';

const mockPlan: AIProjectPlan = {
  summary: 'A task management application',
  estimatedWeeks: 8,
  techStack: ['TypeScript', 'React', 'Node.js'],
  risks: ['Scope creep', 'API rate limits'],
  milestones: [
    {
      title: 'Project Setup',
      description: 'Initialize repository and tooling',
      targetDate: '2024-02-01',
      tasks: [
        {
          title: 'Setup repo',
          description: 'Create GitHub repo',
          priority: 'high',
          status: 'todo',
          estimatedHours: 2,
        },
      ],
    },
  ],
};

function makeFetchMock(response: unknown, ok = true): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    statusText: ok ? 'OK' : 'Bad Request',
    json: jest.fn().mockResolvedValue(
      ok
        ? { choices: [{ message: { content: JSON.stringify(response) } }] }
        : { error: { message: 'Invalid API key' } }
    ),
  });
}

describe('AIService', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('constructor', () => {
    it('uses default model and maxTokens when no settings provided', () => {
      const service = new AIService('sk-test-key');
      expect(service).toBeDefined();
    });

    it('accepts custom model and maxTokens settings', () => {
      const service = new AIService('sk-test-key', {
        model: 'gpt-4o',
        maxTokens: 3000,
      });
      expect(service).toBeDefined();
    });
  });

  describe('generateProjectPlan', () => {
    it('throws when API key is empty', async () => {
      const service = new AIService('');
      await expect(
        service.generateProjectPlan('My App', 'A cool app')
      ).rejects.toThrow('API key is required');
    });

    it('calls OpenAI API and returns a parsed AIProjectPlan', async () => {
      globalThis.fetch = makeFetchMock(mockPlan);
      const service = new AIService('sk-test-key');
      const plan = await service.generateProjectPlan('My App', 'A cool app');

      expect(plan.summary).toBe(mockPlan.summary);
      expect(plan.estimatedWeeks).toBe(mockPlan.estimatedWeeks);
      expect(plan.techStack).toEqual(mockPlan.techStack);
      expect(plan.risks).toEqual(mockPlan.risks);
      expect(plan.milestones).toHaveLength(1);
    });

    it('sends the correct request to OpenAI with project name and description', async () => {
      const fetchMock = makeFetchMock(mockPlan);
      globalThis.fetch = fetchMock;

      const service = new AIService('sk-test-key');
      await service.generateProjectPlan('My App', 'A cool app');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');

      const body = JSON.parse(options.body as string) as {
        messages: Array<{ role: string; content: string }>;
      };
      expect(body.messages[0]?.role).toBe('user');
      expect(body.messages[0]?.content).toContain('My App');
      expect(body.messages[0]?.content).toContain('A cool app');
    });

    it('includes Authorization header with Bearer token', async () => {
      const fetchMock = makeFetchMock(mockPlan);
      globalThis.fetch = fetchMock;

      const service = new AIService('sk-my-secret-key');
      await service.generateProjectPlan('Test', 'Test desc');

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer sk-my-secret-key');
    });

    it('throws a descriptive error when the OpenAI API returns an error', async () => {
      globalThis.fetch = makeFetchMock({ error: { message: 'Invalid API key' } }, false);
      const service = new AIService('sk-bad-key');
      await expect(
        service.generateProjectPlan('My App', 'A cool app')
      ).rejects.toThrow('OpenAI API error: Invalid API key');
    });

    it('throws when AI returns invalid JSON', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'not valid json {{' } }],
        }),
      });
      const service = new AIService('sk-test-key');
      await expect(
        service.generateProjectPlan('My App', 'A cool app')
      ).rejects.toThrow('Failed to parse AI response');
    });

    it('throws when AI returns no content', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ choices: [] }),
      });
      const service = new AIService('sk-test-key');
      await expect(
        service.generateProjectPlan('My App', 'A cool app')
      ).rejects.toThrow('No response from AI');
    });
  });

  describe('generateTaskBreakdown', () => {
    it('throws when API key is empty', async () => {
      const service = new AIService('');
      await expect(
        service.generateTaskBreakdown('Setup', 'Initialize project')
      ).rejects.toThrow('API key is required');
    });

    it('returns tasks with generated ids and todo status', async () => {
      const rawTasks = [
        { title: 'Task 1', description: 'Do thing 1', priority: 'high', estimatedHours: 3 },
        { title: 'Task 2', description: 'Do thing 2', priority: 'low', estimatedHours: 1 },
      ];
      globalThis.fetch = makeFetchMock(rawTasks);

      const service = new AIService('sk-test-key');
      const tasks = await service.generateTaskBreakdown('Setup', 'Initialize project');

      expect(tasks).toHaveLength(2);
      expect(tasks[0]?.id).toMatch(/^task-/);
      expect(tasks[0]?.status).toBe('todo');
      expect(tasks[0]?.createdAt).toBeDefined();
      expect(tasks[1]?.priority).toBe('low');
    });
  });
});
