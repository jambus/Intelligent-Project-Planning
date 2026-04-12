import { ProjectManager } from '../src/services/project-manager';
import { StorageService } from '../src/services/storage-service';
import type { Project, AIProjectPlan } from '../src/types';

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

function makeStorageWithProjects(projects: Project[] = []) {
  const area = makeStorageArea({ projects });
  const storage = new StorageService(area);
  return { storage, area };
}

describe('ProjectManager', () => {
  describe('createProject', () => {
    it('creates a new project with default planning status', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const project = await manager.createProject('My App', 'A cool app');

      expect(project.name).toBe('My App');
      expect(project.description).toBe('A cool app');
      expect(project.status).toBe('planning');
      expect(project.milestones).toEqual([]);
      expect(project.aiGenerated).toBe(false);
    });

    it('generates a unique id with proj- prefix', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const p1 = await manager.createProject('App 1', '');
      const p2 = await manager.createProject('App 2', '');

      expect(p1.id).toMatch(/^proj-/);
      expect(p2.id).toMatch(/^proj-/);
      expect(p1.id).not.toBe(p2.id);
    });

    it('sets createdAt and updatedAt to the same ISO timestamp', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const project = await manager.createProject('App', '');

      expect(project.createdAt).toBe(project.updatedAt);
      expect(new Date(project.createdAt).toISOString()).toBe(project.createdAt);
    });

    it('persists the project to storage', async () => {
      const { storage, area } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const project = await manager.createProject('Saved App', 'Saved');

      expect(area.set).toHaveBeenCalled();
      const saved = await storage.getProjects();
      expect(saved).toHaveLength(1);
      expect(saved[0]?.id).toBe(project.id);
    });
  });

  describe('getProject', () => {
    it('returns the project by id', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const created = await manager.createProject('Find Me', 'test');
      const found = await manager.getProject(created.id);
      expect(found?.name).toBe('Find Me');
    });

    it('returns undefined for a non-existent id', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const result = await manager.getProject('does-not-exist');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllProjects', () => {
    it('returns all projects', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      await manager.createProject('App 1', '');
      await manager.createProject('App 2', '');
      await manager.createProject('App 3', '');

      const all = await manager.getAllProjects();
      expect(all).toHaveLength(3);
    });

    it('returns an empty array when no projects exist', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const all = await manager.getAllProjects();
      expect(all).toEqual([]);
    });
  });

  describe('updateProject', () => {
    it('updates the project name and description', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const project = await manager.createProject('Old Name', 'Old desc');

      const updated = await manager.updateProject(project.id, {
        name: 'New Name',
        description: 'New desc',
      });

      expect(updated.name).toBe('New Name');
      expect(updated.description).toBe('New desc');
    });

    it('updates the updatedAt timestamp', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const project = await manager.createProject('App', '');
      const original = project.updatedAt;

      await new Promise((r) => setTimeout(r, 5));
      const updated = await manager.updateProject(project.id, { name: 'Updated' });

      expect(updated.updatedAt).not.toBe(original);
    });

    it('throws for a non-existent project id', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      await expect(
        manager.updateProject('ghost-id', { name: 'Ghost' })
      ).rejects.toThrow('Project not found: ghost-id');
    });
  });

  describe('deleteProject', () => {
    it('removes the project from storage', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const p1 = await manager.createProject('Keep', '');
      const p2 = await manager.createProject('Delete Me', '');

      await manager.deleteProject(p2.id);

      const all = await manager.getAllProjects();
      expect(all).toHaveLength(1);
      expect(all[0]?.id).toBe(p1.id);
    });

    it('throws for a non-existent project id', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      await expect(manager.deleteProject('ghost-id')).rejects.toThrow(
        'Project not found: ghost-id'
      );
    });
  });

  describe('addMilestone', () => {
    it('adds a milestone to a project', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const project = await manager.createProject('App', '');

      const milestone = await manager.addMilestone(
        project.id,
        'Phase 1',
        'Initial setup',
        '2024-03-01'
      );

      expect(milestone.title).toBe('Phase 1');
      expect(milestone.id).toMatch(/^ms-/);
      expect(milestone.tasks).toEqual([]);

      const updated = await manager.getProject(project.id);
      expect(updated?.milestones).toHaveLength(1);
    });

    it('throws when adding a milestone to a non-existent project', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      await expect(
        manager.addMilestone('ghost-id', 'M1', 'desc', '2024-01-01')
      ).rejects.toThrow('Project not found: ghost-id');
    });
  });

  describe('addTaskToMilestone', () => {
    it('adds a task to a milestone', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const project = await manager.createProject('App', '');
      const milestone = await manager.addMilestone(project.id, 'Phase 1', '', '2024-03-01');

      const task = await manager.addTaskToMilestone(project.id, milestone.id, {
        title: 'Write tests',
        description: 'Cover all services',
        priority: 'high',
        status: 'todo',
        estimatedHours: 4,
      });

      expect(task.title).toBe('Write tests');
      expect(task.id).toMatch(/^task-/);
      expect(task.createdAt).toBeDefined();

      const updated = await manager.getProject(project.id);
      expect(updated?.milestones[0]?.tasks).toHaveLength(1);
    });

    it('throws for a non-existent milestone', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const project = await manager.createProject('App', '');

      await expect(
        manager.addTaskToMilestone(project.id, 'ghost-ms', {
          title: 'T',
          description: '',
          priority: 'low',
          status: 'todo',
          estimatedHours: 1,
        })
      ).rejects.toThrow('Milestone not found: ghost-ms');
    });
  });

  describe('updateProjectStatus', () => {
    it('updates the project status', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const project = await manager.createProject('App', '');
      expect(project.status).toBe('planning');

      const updated = await manager.updateProjectStatus(project.id, 'in-progress');
      expect(updated.status).toBe('in-progress');
    });

    it('can set status to completed', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const project = await manager.createProject('Done App', '');
      const result = await manager.updateProjectStatus(project.id, 'completed');
      expect(result.status).toBe('completed');
    });
  });

  describe('applyAIPlan', () => {
    it('applies an AI-generated plan to a project', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const project = await manager.createProject('AI App', 'Uses AI');

      const plan: AIProjectPlan = {
        summary: 'An AI-driven app',
        estimatedWeeks: 6,
        techStack: ['TypeScript', 'Node.js'],
        risks: ['Integration complexity'],
        milestones: [
          {
            title: 'Milestone 1',
            description: 'Setup',
            targetDate: '2024-03-01',
            tasks: [
              {
                title: 'Bootstrap project',
                description: 'Init repo',
                priority: 'high',
                status: 'todo',
                estimatedHours: 2,
              },
            ],
          },
          {
            title: 'Milestone 2',
            description: 'Core features',
            targetDate: '2024-04-01',
            tasks: [],
          },
        ],
      };

      const updated = await manager.applyAIPlan(project.id, plan);

      expect(updated.aiGenerated).toBe(true);
      expect(updated.status).toBe('planning');
      expect(updated.milestones).toHaveLength(2);
      expect(updated.milestones[0]?.title).toBe('Milestone 1');
      expect(updated.milestones[0]?.tasks).toHaveLength(1);
      expect(updated.milestones[0]?.tasks[0]?.id).toMatch(/^task-/);
    });

    it('sets aiGenerated to true on the project', async () => {
      const { storage } = makeStorageWithProjects();
      const manager = new ProjectManager(storage);
      const project = await manager.createProject('App', '');
      expect(project.aiGenerated).toBe(false);

      const plan: AIProjectPlan = {
        summary: 'Sum',
        estimatedWeeks: 4,
        techStack: [],
        risks: [],
        milestones: [],
      };

      const updated = await manager.applyAIPlan(project.id, plan);
      expect(updated.aiGenerated).toBe(true);
    });
  });
});
