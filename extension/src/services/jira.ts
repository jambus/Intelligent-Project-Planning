import { getStorageItem } from '../utils/storage';

interface JiraSettings {
  domain: string; // e.g., "https://your-domain.atlassian.net"
  email: string;
  apiToken: string;
  projects?: string;
}

export const getJiraSettings = async (): Promise<JiraSettings | null> => {
  const domain = await getStorageItem<string>('jiraDomain');
  const email = await getStorageItem<string>('jiraEmail');
  const apiToken = await getStorageItem<string>('jiraApiToken');
  const projects = await getStorageItem<string>('jiraProjects');

  if (!domain) return null;
  return { domain, email: email || '', apiToken: apiToken || '', projects: projects || '' };
};

const fetchFromJira = async (endpoint: string, settings: JiraSettings, method: string = 'GET', body?: any) => {
  const url = `${settings.domain.replace(/\/$/, '')}/rest/api/3/${endpoint}`;
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  // Use Basic Auth if email and token are provided, otherwise rely on browser cookies
  if (settings.email && settings.apiToken) {
    headers['Authorization'] = `Basic ${btoa(`${settings.email}:${settings.apiToken}`)}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Jira API error: ${response.status} ${response.statusText} - ${errText}`);
  }
  return response.json();
};

/**
 * Fetch active issues/worklogs (simplified for Phase 3)
 */
export const syncJiraIssues = async (projectKey: string): Promise<any> => {
  const settings = await getJiraSettings();
  if (!settings) throw new Error('Jira settings not configured.');

  const jql = `project = "${projectKey}" AND statusCategory != Done`;
  const data = await fetchFromJira(`search?jql=${encodeURIComponent(jql)}&fields=summary,status,assignee,timeoriginalestimate,timespent`, settings);
  return data.issues;
};

export interface EpicHours {
  epicKey: string;
  devLoggedMd: number;
  testLoggedMd: number;
}

/**
 * Sync logged hours for given Epic Keys.
 * Splits total timespent into Dev and Test Man-Days (1 MD = 28800 seconds).
 */
export const syncEpicLoggedHours = async (epicKeys: string[]): Promise<Record<string, EpicHours>> => {
  const settings = await getJiraSettings();
  if (!settings) throw new Error('Jira 设置未配置 (Jira settings not configured).');

  const result: Record<string, EpicHours> = {};
  
  // Initialize result
  epicKeys.forEach(key => {
    if (key) result[key] = { epicKey: key, devLoggedMd: 0, testLoggedMd: 0 };
  });

  const validKeys = epicKeys
    .map(k => k ? k.replace(/['"]/g, '').trim() : '')
    .filter(k => k !== '');
  if (validKeys.length === 0) return result;

  // Chunk keys to avoid URL too long error
  const chunkSize = 30;
  
  let projectJql = '';
  if (settings.projects) {
    const projArr = settings.projects.split(',').map(p => {
      const cleanProj = p.replace(/['"]/g, '').trim();
      return `"${cleanProj}"`;
    }).filter(p => p !== '""');
    if (projArr.length > 0) {
      projectJql = `project in (${projArr.join(',')}) AND `;
    }
  }

  for (let i = 0; i < validKeys.length; i += chunkSize) {
    const chunk = validKeys.slice(i, i + chunkSize);
    
    // "parent in" strictly requires a Jira Key (PROJ-123) or ID (12345). Epic Names will crash the API.
    // Use cf[10014] instead of the deprecated "Epic Link" field name — Jira Cloud no longer accepts
    // the display name in newer search endpoints and strict JQL validation.
    const strictKeys = chunk.filter(k => /^[A-Za-z]+-\d+$/.test(k) || /^\d+$/.test(k));
    
    const allKeysStr = chunk.map(k => `"${k}"`).join(',');
    const conditions = [`cf[10014] in (${allKeysStr})`];
    
    if (strictKeys.length > 0) {
      const strictStr = strictKeys.map(k => `"${k}"`).join(',');
      conditions.push(`parent in (${strictStr})`);
    }

    const jql = `${projectJql}(${conditions.join(' OR ')})`;
    
    let nextPageToken: string | undefined;
    const maxResults = 100;
    let hasMore = true;

    while (hasMore) {
      // POST /search/jql uses cursor-based pagination via nextPageToken.
      // The old startAt/total fields are NOT accepted and cause "Invalid request payload".
      const body: Record<string, any> = {
        jql,
        maxResults,
        fields: ['parent', 'customfield_10014', 'issuetype', 'timespent'],
      };
      if (nextPageToken) {
        body.nextPageToken = nextPageToken;
      }
      const data = await fetchFromJira('search/jql', settings, 'POST', body);
      
      const issues = data.issues || [];
      issues.forEach((issue: any) => {
        const timeSpentSeconds = issue.fields.timespent || 0;
        if (timeSpentSeconds <= 0) return;

        // Identify which epic this belongs to
        let epicKey = '';
        if (issue.fields.parent && issue.fields.parent.key) {
          epicKey = issue.fields.parent.key;
        } else if (issue.fields.customfield_10014) {
          epicKey = issue.fields.customfield_10014;
        }

        if (epicKey && result[epicKey]) {
          const typeName = (issue.fields.issuetype?.name || '').toLowerCase();
          const isTest = /test|QA|bug|测试|缺陷|故障/i.test(typeName);
          
          const md = timeSpentSeconds / 28800; // 8 hours = 1 MD
          if (isTest) {
            result[epicKey].testLoggedMd += md;
          } else {
            result[epicKey].devLoggedMd += md;
          }
        }
      });

      nextPageToken = data.nextPageToken;
      hasMore = !!nextPageToken;
    }
  }

  return result;
};
