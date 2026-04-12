import Dexie, { type Table } from 'dexie';

export interface Resource {
  id?: number;
  name: string;
  role: string; // e.g., "Frontend", "Backend", "Test"
  capacity: number; // e.g., 100 (for 100%)
  skills: string[]; // JSON array of skill tags
}

export interface Project {
  id?: number;
  jiraProjectId: string;
  jiraProjectKey: string;
  name: string;
  priority: 'High' | 'Medium' | 'Low';
  startDate: string; // ISO date
  endDate: string; // ISO date
  status: 'To Do' | 'In Progress' | 'Done';
}

export interface Allocation {
  id?: number;
  resourceId: number;
  projectId: number;
  startDate: string; // ISO date
  endDate: string; // ISO date
  allocationPercentage: number; // e.g., 50 for 50% time
}

export interface JiraWorklog {
  id?: number;
  issueId: string;
  issueKey: string;
  authorAccountId: string;
  timeSpentSeconds: number;
  started: string; // ISO date
}

export interface Setting {
  key: string;
  value: any;
}

export class PlannerDatabase extends Dexie {
  resources!: Table<Resource, number>;
  projects!: Table<Project, number>;
  allocations!: Table<Allocation, number>;
  jiraWorklogs!: Table<JiraWorklog, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('IntelligentResourcePlannerDB');
    this.version(1).stores({
      resources: '++id, name, role',
      projects: '++id, jiraProjectId, jiraProjectKey, status, priority',
      allocations: '++id, resourceId, projectId, startDate, endDate',
      jiraWorklogs: '++id, issueId, issueKey, authorAccountId',
      settings: 'key'
    });
  }
}

export const db = new PlannerDatabase();
