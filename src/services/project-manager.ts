import type { Project, Milestone, Task, ProjectStatus, AIProjectPlan } from '../types';
import { StorageService } from './storage-service';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class ProjectManager {
  constructor(private storage: StorageService) {}

  async createProject(name: string, description: string): Promise<Project> {
    const projects = await this.storage.getProjects();
    const now = new Date().toISOString();
    const project: Project = {
      id: generateId('proj'),
      name,
      description,
      status: 'planning',
      milestones: [],
      createdAt: now,
      updatedAt: now,
      aiGenerated: false,
    };
    projects.push(project);
    await this.storage.saveProjects(projects);
    return project;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const projects = await this.storage.getProjects();
    return projects.find((p) => p.id === id);
  }

  async getAllProjects(): Promise<Project[]> {
    return this.storage.getProjects();
  }

  async updateProject(
    id: string,
    updates: Partial<
      Pick<Project, 'name' | 'description' | 'status' | 'milestones' | 'aiGenerated'>
    >
  ): Promise<Project> {
    const projects = await this.storage.getProjects();
    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) throw new Error(`Project not found: ${id}`);
    projects[index] = {
      ...projects[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.storage.saveProjects(projects);
    return projects[index];
  }

  async deleteProject(id: string): Promise<void> {
    const projects = await this.storage.getProjects();
    const filtered = projects.filter((p) => p.id !== id);
    if (filtered.length === projects.length)
      throw new Error(`Project not found: ${id}`);
    await this.storage.saveProjects(filtered);
  }

  async addMilestone(
    projectId: string,
    title: string,
    description: string,
    targetDate: string
  ): Promise<Milestone> {
    const milestone: Milestone = {
      id: generateId('ms'),
      title,
      description,
      targetDate,
      tasks: [],
    };
    const project = await this.getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    await this.updateProject(projectId, {
      milestones: [...project.milestones, milestone],
    });
    return milestone;
  }

  async addTaskToMilestone(
    projectId: string,
    milestoneId: string,
    task: Omit<Task, 'id' | 'createdAt'>
  ): Promise<Task> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const milestone = project.milestones.find((m) => m.id === milestoneId);
    if (!milestone) throw new Error(`Milestone not found: ${milestoneId}`);
    const newTask: Task = {
      ...task,
      id: generateId('task'),
      createdAt: new Date().toISOString(),
    };
    milestone.tasks.push(newTask);
    await this.updateProject(projectId, { milestones: project.milestones });
    return newTask;
  }

  async updateProjectStatus(id: string, status: ProjectStatus): Promise<Project> {
    return this.updateProject(id, { status });
  }

  async applyAIPlan(projectId: string, plan: AIProjectPlan): Promise<Project> {
    const milestones: Milestone[] = plan.milestones.map((m, mi) => ({
      id: generateId(`ms-${mi}`),
      title: m.title,
      description: m.description,
      targetDate: m.targetDate,
      tasks: (m.tasks ?? []).map((t, ti) => ({
        ...t,
        id: generateId(`task-${mi}-${ti}`),
        createdAt: new Date().toISOString(),
      })),
    }));
    return this.updateProject(projectId, {
      milestones,
      aiGenerated: true,
      status: 'planning',
    });
  }
}
