import Dexie, { type Table } from 'dexie';

export interface Resource {
  id?: number;
  name: string;
  role: string; // e.g., "Frontend", "Backend", "Test"
  capacity: number; // e.g., 100 (for 100%)
  skills: string[]; // JSON array of skill tags
  unavailableDates?: string[]; // Array of ISO dates when resource is on leave
}

export interface Project {
  id?: number;
  name: string; // Project (项目名称)
  businessOwner: string; // Business Owner
  priority: string; // Priority Proposal
  status: string; // Status (项目状态)
  digitalResponsible: string; // Digital Responsible
  startDate: string; // Start In (期望开始时间)
  endDate: string; // End In (期望结束时间)
  estimatedGoLiveTime: string; // Estimated Go-live time (预计上线时间)
  comments: string; // Comments
  jiraEpicKey: string; // Jira Epic Key
  devTotalMd: number; // Dev Total MD (开发评估总天数)
  testTotalMd: number; // Test Total MD (测试评估总天数)
  projectTechLead?: string; // Project Tech Lead
  projectQualityLead?: string; // Project Quality Lead
  detailsProductDevMd?: string; // Details Product DEV MD
  detailsProductTestMd?: string; // Details Product Test MD
  techStack?: string; // Technical Stack required
  domain?: string; // Product Domain
}

export interface Allocation {
  id?: number;
  resourceId: number;
  projectId: number;
  startDate: string; // ISO date
  endDate: string; // ISO date
  allocationPercentage: number; // e.g., 50 for 50% time
  allocationType?: 'dev' | 'test'; // Whether this allocation is for dev gap or test gap
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

export interface Skill {
  id?: number;
  name: string;
  type: 'business' | 'technical';
}

export class PlannerDatabase extends Dexie {
  resources!: Table<Resource, number>;
  projects!: Table<Project, number>;
  allocations!: Table<Allocation, number>;
  jiraWorklogs!: Table<JiraWorklog, number>;
  settings!: Table<Setting, string>;
  skills!: Table<Skill, number>;

  constructor() {
    super('IntelligentResourcePlannerDB');
    this.version(1).stores({
      resources: '++id, name, role',
      projects: '++id, jiraProjectId, jiraProjectKey, status, priority',
      allocations: '++id, resourceId, projectId, startDate, endDate',
      jiraWorklogs: '++id, issueId, issueKey, authorAccountId',
      settings: 'key'
    });
    
    this.version(2).stores({
      projects: '++id, name, status, priority, digitalResponsible' // Updated for Google Sheets
    }).upgrade(tx => {
      // Clear old jira projects since schema fundamentally changed
      return tx.table('projects').clear();
    });

    this.version(3).stores({
      allocations: '++id, resourceId, projectId, startDate, endDate, allocationType'
    });

    this.version(4).stores({
      skills: '++id, name, type'
    });
  }
}

export const db = new PlannerDatabase();
