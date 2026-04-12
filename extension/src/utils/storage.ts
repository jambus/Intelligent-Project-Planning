/**
 * Utility functions for wrapping chrome.storage.local with Promises
 * Includes fallback to localStorage for standard web environment testing
 */

export const getStorageItem = async <T>(key: string): Promise<T | null> => {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.warn('chrome.storage is not available, falling back to localStorage');
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) as T : null;
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] !== undefined ? result[key] : null);
    });
  });
};

export const setStorageItem = async (key: string, value: any): Promise<void> => {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.warn('chrome.storage is not available, falling back to localStorage');
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve();
    });
  });
};

export const removeStorageItem = async (key: string): Promise<void> => {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    localStorage.removeItem(key);
    return;
  }

  return new Promise((resolve) => {
    chrome.storage.local.remove(key, () => {
      resolve();
    });
  });
};

export const clearStorage = async (): Promise<void> => {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    localStorage.clear();
    return;
  }

  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      resolve();
    });
  });
};
