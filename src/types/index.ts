export type ProjectStatus = 'planning' | 'in-progress' | 'completed' | 'on-hold';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  estimatedHours: number;
  createdAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  tasks: Task[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
  aiGenerated: boolean;
}

export type AITask = Omit<Task, 'id' | 'createdAt'>;
export type AIMilestone = Omit<Milestone, 'id' | 'tasks'> & { tasks: AITask[] };

export interface AIProjectPlan {
  summary: string;
  milestones: AIMilestone[];
  estimatedWeeks: number;
  techStack: string[];
  risks: string[];
}

export interface StorageData {
  projects: Project[];
  apiKey?: string;
  settings?: AppSettings;
}

export interface AppSettings {
  model: string;
  maxTokens: number;
}
