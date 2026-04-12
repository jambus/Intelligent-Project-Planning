import type { Project, StorageData, AppSettings } from '../types';

type StorageArea = {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};

function getStorageArea(): StorageArea {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return {
      get: (keys) =>
        new Promise((resolve, reject) =>
          chrome.storage.local.get(keys, (result) => {
            if (chrome.runtime.lastError)
              reject(new Error(chrome.runtime.lastError.message));
            else resolve(result);
          })
        ),
      set: (items) =>
        new Promise((resolve, reject) =>
          chrome.storage.local.set(items, () => {
            if (chrome.runtime.lastError)
              reject(new Error(chrome.runtime.lastError.message));
            else resolve();
          })
        ),
    };
  }

  // Fallback to localStorage for standalone web usage
  return {
    get: async (keys) => {
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        const item = localStorage.getItem(key);
        if (item !== null) {
          try {
            result[key] = JSON.parse(item);
          } catch {
            result[key] = item;
          }
        }
      }
      return result;
    },
    set: async (items) => {
      for (const [key, value] of Object.entries(items)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    },
  };
}

export class StorageService {
  private storage: StorageArea;

  constructor(storageArea?: StorageArea) {
    this.storage = storageArea ?? getStorageArea();
  }

  async getProjects(): Promise<Project[]> {
    const result = await this.storage.get(['projects']);
    return (result['projects'] as Project[] | undefined) ?? [];
  }

  async saveProjects(projects: Project[]): Promise<void> {
    await this.storage.set({ projects });
  }

  async getApiKey(): Promise<string | undefined> {
    const result = await this.storage.get(['apiKey']);
    return result['apiKey'] as string | undefined;
  }

  async saveApiKey(apiKey: string): Promise<void> {
    await this.storage.set({ apiKey });
  }

  async getSettings(): Promise<AppSettings | undefined> {
    const result = await this.storage.get(['settings']);
    return result['settings'] as AppSettings | undefined;
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.storage.set({ settings });
  }

  async getData(): Promise<StorageData> {
    const result = await this.storage.get(['projects', 'apiKey', 'settings']);
    return {
      projects: (result['projects'] as Project[] | undefined) ?? [],
      apiKey: result['apiKey'] as string | undefined,
      settings: result['settings'] as AppSettings | undefined,
    };
  }
}
