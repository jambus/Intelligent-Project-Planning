import { getStorageItem } from '../utils/storage';

interface JiraSettings {
  domain: string; // e.g., "https://your-domain.atlassian.net"
  email: string;
  apiToken: string;
}

export const getJiraSettings = async (): Promise<JiraSettings | null> => {
  const domain = await getStorageItem<string>('jiraDomain');
  const email = await getStorageItem<string>('jiraEmail');
  const apiToken = await getStorageItem<string>('jiraApiToken');

  if (!domain) return null;
  return { domain, email: email || '', apiToken: apiToken || '' };
};

const fetchFromJira = async (endpoint: string, settings: JiraSettings) => {
  const url = `${settings.domain.replace(/\/$/, '')}/rest/api/3/${endpoint}`;
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };

  // Use Basic Auth if email and token are provided, otherwise rely on browser cookies
  if (settings.email && settings.apiToken) {
    headers['Authorization'] = `Basic ${btoa(`${settings.email}:${settings.apiToken}`)}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
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
