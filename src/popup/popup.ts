import './popup.css';
import type { Project, AIProjectPlan } from '../types';
import { StorageService } from '../services/storage-service';
import { ProjectManager } from '../services/project-manager';
import { AIService } from '../services/ai-service';

const storage = new StorageService();
const manager = new ProjectManager(storage);

let currentProjects: Project[] = [];
let apiKey = '';

// ─── DOM helpers ─────────────────────────────────────────────────────────────

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function statusClass(status: string): string {
  return `status-${status}`;
}

function renderProjects(projects: Project[]): void {
  const list = $('projects-list');
  $('project-count').textContent = String(projects.length);

  if (projects.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🚀</span>
        <p>No projects yet. Add one above to get started!</p>
      </div>`;
    return;
  }

  list.innerHTML = projects
    .map(
      (p) => `
    <div class="project-card" data-id="${p.id}">
      <div class="project-card-header">
        <span class="project-name" data-action="view" data-id="${p.id}">${escHtml(p.name)}</span>
      </div>
      ${p.description ? `<p class="project-description">${escHtml(p.description)}</p>` : ''}
      <div class="project-meta">
        <span class="status-badge ${statusClass(p.status)}">${p.status}</span>
        ${p.aiGenerated ? '<span class="ai-badge">✨ AI</span>' : ''}
        ${p.milestones.length > 0 ? `<span class="milestone-count">📋 ${p.milestones.length} milestone${p.milestones.length !== 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="project-actions">
        <button class="btn btn-ai" data-action="ai-plan" data-id="${p.id}">✨ AI Plan</button>
        <button class="btn btn-ghost" data-action="view" data-id="${p.id}">View</button>
        <button class="btn btn-danger" data-action="delete" data-id="${p.id}">Delete</button>
      </div>
    </div>`
    )
    .join('');
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openModal(project: Project): void {
  $('modal-project-name').textContent = project.name;
  const body = $('modal-body');

  const hasPlan = project.milestones.length > 0;

  body.innerHTML = `
    <p style="color: var(--text-secondary); font-size: 12px; margin-bottom: 14px;">${escHtml(project.description)}</p>
    ${
      hasPlan
        ? `<div class="ai-plan-summary">
            <h3>✨ AI-Generated Plan</h3>
            <p><strong>Milestones:</strong> ${project.milestones.length}</p>
            <p><strong>Total tasks:</strong> ${project.milestones.reduce((n, m) => n + m.tasks.length, 0)}</p>
          </div>`
        : ''
    }
    ${
      hasPlan
        ? project.milestones
            .map(
              (m) => `
          <div class="milestone-card">
            <div class="milestone-title">📍 ${escHtml(m.title)}</div>
            <div class="milestone-description">${escHtml(m.description)}</div>
            <div class="milestone-date">🗓 Target: ${m.targetDate}</div>
            ${
              m.tasks.length > 0
                ? `<div class="task-list">
                ${m.tasks
                  .map(
                    (t) => `
                  <div class="task-item">
                    <span class="task-priority priority-${t.priority}">${t.priority}</span>
                    <div class="task-info">
                      <div class="task-title">${escHtml(t.title)}</div>
                      <div class="task-description">${escHtml(t.description)}</div>
                      <div class="task-hours">⏱ ${t.estimatedHours}h estimated</div>
                    </div>
                  </div>`
                  )
                  .join('')}
              </div>`
                : '<p style="color: var(--text-muted); font-size: 11px; margin-top: 6px;">No tasks yet.</p>'
            }
          </div>`
            )
            .join('')
        : '<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">No plan yet. Use "✨ AI Plan" to generate one!</p>'
    }
  `;

  $('project-detail-modal').classList.remove('hidden');
}

function closeModal(): void {
  $('project-detail-modal').classList.add('hidden');
}

// ─── AI Planning ──────────────────────────────────────────────────────────────

async function runAIPlan(projectId: string): Promise<void> {
  const project = currentProjects.find((p) => p.id === projectId);
  if (!project) return;

  if (!apiKey) {
    showToast('⚠️ Set your OpenAI API key in Settings first.', 'error');
    return;
  }

  const btn = document.querySelector<HTMLButtonElement>(
    `[data-action="ai-plan"][data-id="${projectId}"]`
  );
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner">⏳</span> Planning...';
  }

  try {
    const ai = new AIService(apiKey);
    const plan: AIProjectPlan = await ai.generateProjectPlan(
      project.name,
      project.description
    );
    await manager.applyAIPlan(projectId, plan);
    currentProjects = await manager.getAllProjects();
    renderProjects(currentProjects);
    showToast('✨ AI plan generated!', 'success');

    const updated = currentProjects.find((p) => p.id === projectId);
    if (updated) openModal(updated);
  } catch (err) {
    showToast(`Error: ${(err as Error).message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '✨ AI Plan';
    }
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const data = await storage.getData();
  apiKey = data.apiKey ?? '';
  currentProjects = data.projects;

  if (!apiKey) {
    $('api-key-warning').classList.remove('hidden');
  }

  renderProjects(currentProjects);

  // Add project form
  $('add-project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = $('project-name') as HTMLInputElement;
    const descInput = $('project-description') as HTMLTextAreaElement;
    const autoPlanCheck = $('auto-plan') as HTMLInputElement;

    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    if (!name) return;

    const project = await manager.createProject(name, description);
    currentProjects = await manager.getAllProjects();
    renderProjects(currentProjects);

    nameInput.value = '';
    descInput.value = '';
    showToast('Project created!', 'success');

    if (autoPlanCheck.checked) {
      await runAIPlan(project.id);
    }
  });

  // Delegated click handler for project list actions
  $('projects-list').addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest<HTMLElement>('[data-action]');
    if (!btn) return;

    const action = btn.dataset['action'];
    const id = btn.dataset['id'];
    if (!id) return;

    if (action === 'delete') {
      if (!confirm('Delete this project?')) return;
      await manager.deleteProject(id);
      currentProjects = await manager.getAllProjects();
      renderProjects(currentProjects);
      showToast('Project deleted.', 'info');
    } else if (action === 'view') {
      const project = currentProjects.find((p) => p.id === id);
      if (project) openModal(project);
    } else if (action === 'ai-plan') {
      await runAIPlan(id);
    }
  });

  // Modal close
  $('modal-close').addEventListener('click', closeModal);
  $('modal-overlay').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Settings link - in Chrome extension context, open options page
  $('settings-link').addEventListener('click', (e) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch((err: unknown) => {
    console.error('Popup init error:', err);
  });
});
