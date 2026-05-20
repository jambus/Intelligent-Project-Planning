import { getStorageItem } from '../utils/storage';

interface JiraSettings {
  domain: string; // e.g., "https://your-domain.atlassian.net"
  email: string;
  apiToken: string;
  projects?: string;
  hoursPerDay?: number;
}

export const getJiraSettings = async (): Promise<JiraSettings | null> => {
  const domain = await getStorageItem<string>('jiraDomain');
  const email = await getStorageItem<string>('jiraEmail');
  const apiToken = await getStorageItem<string>('jiraApiToken');
  const projects = await getStorageItem<string>('jiraProjects');
  const hoursPerDayStr = await getStorageItem<string>('jiraHoursPerDay');
  const hoursPerDay = hoursPerDayStr ? Number(hoursPerDayStr) : 6;

  if (!domain) return null;
  return { domain, email: email || '', apiToken: apiToken || '', projects: projects || '', hoursPerDay };
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
  const body = {
    jql,
    fields: ['summary', 'status', 'assignee', 'timeoriginalestimate', 'timespent', 'aggregatetimespent', 'timetracking']
  };
  const data = await fetchFromJira('search/jql', settings, 'POST', body);
  return data.issues;
};

export interface EpicHours {
  epicKey: string;
  totalLoggedMd: number;
}

/**
 * Sync logged hours for given Epic Keys.
 * Splits total timespent into Dev and Test Man-Days (1 MD = 28800 seconds).
 */
export const syncEpicLoggedHours = async (epicKeys: string[]): Promise<Record<string, EpicHours>> => {
  const settings = await getJiraSettings();
  if (!settings) throw new Error('Jira 设置未配置 (Jira settings not configured).');

  // We added jiraHoursPerDay to JiraSettings locally in settings.tsx, we need to read it here if added, default to 6.
  // Wait, I need to make sure getJiraSettings reads it. I added it to getJiraSettings in the previous step? Yes.
  const hoursPerDay = (settings as any).hoursPerDay || 6;
  const secondsPerDay = hoursPerDay * 3600;

  const result: Record<string, EpicHours> = {};
  epicKeys.forEach(key => {
    if (key) result[key] = { epicKey: key, totalLoggedMd: 0 };
  });

  const validUserKeys = epicKeys
    .map(k => k ? k.toString().replace(/['"]/g, '').trim() : '')
    .filter(k => k !== '');
  if (validUserKeys.length === 0) return result;

  let projectJql = '';
  if (settings.projects) {
    const projArr = settings.projects.split(',').map(p => {
      const cleanProj = p.replace(/['"]/g, '').trim();
      return `"${cleanProj}"`;
    }).filter(p => p !== '""');
    if (projArr.length > 0) {
      projectJql = `project in (${projArr.join(',')})`;
    }
  }

  const epicKeyToUserInputMap: Record<string, string> = {};

  // Step 1: Fuzzy search for Epics by name (only created within the last year, bilingual epic types)
  const terms = validUserKeys.map(name => {
      // Clean bracket wrappers and extract the main search keyword safely
      const clean = name.replace(/[\[\]]/g, '').trim();
      const safe = clean.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_]/g, ' ').trim().split(' ')[0];
      return safe ? `summary ~ "${safe}*"` : '';
  }).filter(x => x);
  
  if (terms.length > 0) {
    const termsJql = `(${terms.join(' OR ')})`;
    let epicSearchJql = `issuetype in (Epic, "长篇故事") AND created >= -365d`;
    if (projectJql) {
       epicSearchJql = `${projectJql} AND issuetype in (Epic, "长篇故事") AND created >= -365d AND ${termsJql}`;
    } else {
       epicSearchJql += ` AND ${termsJql}`;
    }

    let nextPageToken: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const body: Record<string, any> = {
        jql: epicSearchJql,
        maxResults: 100,
        fields: ['summary'],
      };
      if (nextPageToken) body.nextPageToken = nextPageToken;
      
      try {
        const data = await fetchFromJira('search/jql', settings, 'POST', body);
        const epics = data.issues || [];
        epics.forEach((epic: any) => {
            const summary = epic.fields.summary || '';
            const cleanSummary = summary.toLowerCase().replace(/^[\[\s]+/, '');
            
            for (const name of validUserKeys) {
                const cleanName = name.toLowerCase().replace(/^[\[\s]+/, '');
                
                // Matches standard start or bracket-wrapped start (e.g. "[PROJ-123] ...")
                if (cleanSummary.startsWith(cleanName) || summary.toLowerCase().startsWith(name.toLowerCase())) {
                    epicKeyToUserInputMap[epic.key] = name;
                }
            }
        });
        nextPageToken = data.nextPageToken;
        hasMore = !!nextPageToken;
      } catch (e) {
        console.warn("Epic fuzzy search failed", e);
        hasMore = false;
      }
    }
  }


  // Step 2: Fetch logged hours for all mapped Epic keys
  const targetEpicKeys = Object.keys(epicKeyToUserInputMap);
  if (targetEpicKeys.length === 0) return result;

  const chunkSize = 30;
  for (let i = 0; i < targetEpicKeys.length; i += chunkSize) {
    const chunk = targetEpicKeys.slice(i, i + chunkSize);
    const chunkStr = chunk.map(k => `"${k}"`).join(',');
    
    // targetEpicKeys only contains standard Jira keys discovered from Step 1 or provided in standardKeys,
    // so using 'parent in' and 'issueKey in' is 100% safe. We remove projectJql constraint here to avoid
    // skipping child issues that belong to different projects.
    const jql = `(parent in (${chunkStr}) OR cf[10014] in (${chunkStr}) OR issueKey in (${chunkStr}))`;

    let nextPageToken: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const body: Record<string, any> = {
        jql,
        maxResults: 100,
        fields: ['parent', 'customfield_10014', 'issuetype', 'timespent', 'aggregatetimespent', 'timetracking', 'summary'],
      };
      if (nextPageToken) body.nextPageToken = nextPageToken;
      
      const data = await fetchFromJira('search/jql', settings, 'POST', body);
      const issues = data.issues || [];
      
      issues.forEach((issue: any) => {
        let actualKey = issue.key;
        if (issue.fields.parent && issue.fields.parent.key) {
          actualKey = issue.fields.parent.key;
        } else if (issue.fields.customfield_10014) {
          actualKey = issue.fields.customfield_10014;
        }

        // If the issue is the Epic itself (issue.key === actualKey), 
        // we MUST use timespent (not aggregatetimespent) to avoid double counting 
        // the child issues (Stories/Tasks) which are processed separately in this loop.
        const isEpicItself = issue.key.toLowerCase() === actualKey.toLowerCase();
        
        let timeSpentSeconds = 0;
        if (isEpicItself) {
          timeSpentSeconds = 
            issue.fields.timespent || 
            issue.fields.timetracking?.timeSpentSeconds || 
            0;
        } else {
          timeSpentSeconds = 
            issue.fields.aggregatetimespent || 
            issue.fields.timespent || 
            issue.fields.timetracking?.timeSpentSeconds || 
            0;
        }

        if (timeSpentSeconds <= 0) return;

        const userInputKey = epicKeyToUserInputMap[actualKey];
        if (userInputKey && result[userInputKey]) {
            const md = timeSpentSeconds / secondsPerDay;
            result[userInputKey].totalLoggedMd += md;
        }
      });

      nextPageToken = data.nextPageToken;
      hasMore = !!nextPageToken;
    }
  }

  return result;
};
