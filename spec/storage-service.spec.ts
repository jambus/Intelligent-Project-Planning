import { StorageService } from '../src/services/storage-service';
import type { Project, AppSettings } from '../src/types';

function makeProject(overrides: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  return {
    id: 'proj-1',
    name: 'Test Project',
    description: 'A test project',
    status: 'planning',
    milestones: [],
    createdAt: now,
    updatedAt: now,
    aiGenerated: false,
    ...overrides,
  };
}

function makeStorageArea(initialData: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initialData };
  return {
    get: jest.fn(async (keys: string[]) => {
      const result: Record<string, unknown> = {};
      for (const k of keys) {
        if (k in store) result[k] = store[k];
      }
      return result;
    }),
    set: jest.fn(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    }),
    _store: store,
  };
}

describe('StorageService', () => {
  describe('getProjects', () => {
    it('returns an empty array when no projects are stored', async () => {
      const area = makeStorageArea();
      const service = new StorageService(area);
      const projects = await service.getProjects();
      expect(projects).toEqual([]);
    });

    it('returns stored projects', async () => {
      const project = makeProject();
      const area = makeStorageArea({ projects: [project] });
      const service = new StorageService(area);
      const projects = await service.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0]?.id).toBe('proj-1');
    });
  });

  describe('saveProjects', () => {
    it('persists the projects array to storage', async () => {
      const area = makeStorageArea();
      const service = new StorageService(area);
      const projects = [makeProject(), makeProject({ id: 'proj-2', name: 'Second' })];
      await service.saveProjects(projects);
      expect(area.set).toHaveBeenCalledWith({ projects });
    });

    it('overwrites existing projects', async () => {
      const area = makeStorageArea({ projects: [makeProject()] });
      const service = new StorageService(area);
      const updated = [makeProject({ name: 'Renamed' })];
      await service.saveProjects(updated);
      expect(area.set).toHaveBeenCalledWith({ projects: updated });
    });
  });

  describe('getApiKey', () => {
    it('returns undefined when no API key is stored', async () => {
      const area = makeStorageArea();
      const service = new StorageService(area);
      const key = await service.getApiKey();
      expect(key).toBeUndefined();
    });

    it('returns the stored API key', async () => {
      const area = makeStorageArea({ apiKey: 'sk-test-123' });
      const service = new StorageService(area);
      const key = await service.getApiKey();
      expect(key).toBe('sk-test-123');
    });
  });

  describe('saveApiKey', () => {
    it('stores the API key', async () => {
      const area = makeStorageArea();
      const service = new StorageService(area);
      await service.saveApiKey('sk-my-key');
      expect(area.set).toHaveBeenCalledWith({ apiKey: 'sk-my-key' });
    });
  });

  describe('getSettings', () => {
    it('returns undefined when no settings are stored', async () => {
      const area = makeStorageArea();
      const service = new StorageService(area);
      const settings = await service.getSettings();
      expect(settings).toBeUndefined();
    });

    it('returns the stored settings', async () => {
      const settings: AppSettings = { model: 'gpt-4o', maxTokens: 3000 };
      const area = makeStorageArea({ settings });
      const service = new StorageService(area);
      const result = await service.getSettings();
      expect(result).toEqual(settings);
    });
  });

  describe('saveSettings', () => {
    it('persists settings to storage', async () => {
      const area = makeStorageArea();
      const service = new StorageService(area);
      const settings: AppSettings = { model: 'gpt-4o-mini', maxTokens: 2000 };
      await service.saveSettings(settings);
      expect(area.set).toHaveBeenCalledWith({ settings });
    });
  });

  describe('getData', () => {
    it('returns all data in a single call', async () => {
      const project = makeProject();
      const settings: AppSettings = { model: 'gpt-4o', maxTokens: 1500 };
      const area = makeStorageArea({
        projects: [project],
        apiKey: 'sk-abc',
        settings,
      });
      const service = new StorageService(area);
      const data = await service.getData();

      expect(data.projects).toHaveLength(1);
      expect(data.apiKey).toBe('sk-abc');
      expect(data.settings).toEqual(settings);
      expect(area.get).toHaveBeenCalledWith(['projects', 'apiKey', 'settings']);
    });

    it('returns defaults when storage is empty', async () => {
      const area = makeStorageArea();
      const service = new StorageService(area);
      const data = await service.getData();
      expect(data.projects).toEqual([]);
      expect(data.apiKey).toBeUndefined();
      expect(data.settings).toBeUndefined();
    });
  });
});
