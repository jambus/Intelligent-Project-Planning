import './options.css';
import { StorageService } from '../services/storage-service';

const storage = new StorageService();

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

function showStatus(message: string, type: 'success' | 'error'): void {
  const el = $('status-message');
  el.textContent = message;
  el.className = `status-message ${type}`;
  setTimeout(() => {
    el.className = 'status-message hidden';
  }, 3000);
}

async function loadSettings(): Promise<void> {
  const data = await storage.getData();

  const keyInput = $('api-key-input') as HTMLInputElement;
  const modelSelect = $('model-select') as HTMLSelectElement;
  const maxTokensInput = $('max-tokens-input') as HTMLInputElement;

  if (data.apiKey) {
    keyInput.value = data.apiKey;
  }
  if (data.settings?.model) {
    modelSelect.value = data.settings.model;
  }
  if (data.settings?.maxTokens) {
    maxTokensInput.value = String(data.settings.maxTokens);
  }
}

async function saveSettings(): Promise<void> {
  const keyInput = $('api-key-input') as HTMLInputElement;
  const modelSelect = $('model-select') as HTMLSelectElement;
  const maxTokensInput = $('max-tokens-input') as HTMLInputElement;

  const apiKey = keyInput.value.trim();
  const model = modelSelect.value;
  const maxTokens = parseInt(maxTokensInput.value, 10);

  if (!apiKey) {
    showStatus('Please enter your OpenAI API key.', 'error');
    return;
  }

  if (!apiKey.startsWith('sk-')) {
    showStatus('API key should start with "sk-". Please check your key.', 'error');
    return;
  }

  if (isNaN(maxTokens) || maxTokens < 500 || maxTokens > 4000) {
    showStatus('Max tokens must be between 500 and 4000.', 'error');
    return;
  }

  await storage.saveApiKey(apiKey);
  await storage.saveSettings({ model, maxTokens });
  showStatus('✅ Settings saved!', 'success');
}

async function clearAllData(): Promise<void> {
  if (!confirm('This will delete ALL projects and settings. Are you sure?')) {
    return;
  }
  await storage.saveProjects([]);
  await storage.saveApiKey('');
  const keyInput = $('api-key-input') as HTMLInputElement;
  const modelSelect = $('model-select') as HTMLSelectElement;
  const maxTokensInput = $('max-tokens-input') as HTMLInputElement;
  keyInput.value = '';
  modelSelect.value = 'gpt-4o-mini';
  maxTokensInput.value = '2000';
  showStatus('All data cleared.', 'success');
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings().catch(console.error);

  $('save-btn').addEventListener('click', () => {
    saveSettings().catch(console.error);
  });

  $('clear-btn').addEventListener('click', () => {
    clearAllData().catch(console.error);
  });

  $('toggle-key').addEventListener('click', () => {
    const input = $('api-key-input') as HTMLInputElement;
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});
