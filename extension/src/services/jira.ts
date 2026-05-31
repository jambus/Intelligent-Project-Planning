import { getStorageItem } from '../utils/storage';

interface JiraSettings {
  domain: string; // e.g., "https://your-domain.atlassian.net"
  email: string;
  apiToken: string;
  projects?: string;
  hoursPerDay?: number;
  testIssueTypes?: string;
}

export const getJiraSettings = async (): Promise<JiraSettings | null> => {
  const domain = await getStorageItem<string>('jiraDomain');
  const email = await getStorageItem<string>('jiraEmail');
  const apiToken = await getStorageItem<string>('jiraApiToken');
  const projects = await getStorageItem<string>('jiraProjects');
  const hoursPerDayStr = await getStorageItem<string>('jiraHoursPerDay');
  const hoursPerDay = hoursPerDayStr ? Number(hoursPerDayStr) : 6;
  const testIssueTypes = await getStorageItem<string>('jiraTestIssueTypes') || 'Test,QA,Bug,Defect,测试,缺陷';

  if (!domain) return null;
  return { domain, email: email || '', apiToken: apiToken || '', projects: projects || '', hoursPerDay, testIssueTypes };
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
    if (response.status === 401 || response.status === 403) {
      throw new Error('JIRA_AUTH_ERROR');
    }
    const errText = await response.text();
    throw new Error(`Jira API error: ${response.status} ${response.statusText} - ${errText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('JIRA_AUTH_ERROR');
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

  // We added jiraHoursPerDay to JiraSettings locally in settings.tsx, we need to read it here if added, default to 6.
  // Wait, I need to make sure getJiraSettings reads it. I added it to getJiraSettings in the previous step? Yes.
  const hoursPerDay = (settings as any).hoursPerDay || 6;
  const secondsPerDay = hoursPerDay * 3600;

  const result: Record<string, EpicHours> = {};
  epicKeys.forEach(key => {
    if (key) result[key] = { epicKey: key, totalLoggedMd: 0, devLoggedMd: 0, testLoggedMd: 0 };
  });

  const validUserKeys = epicKeys
    .map(k => k ? k.toString().replace(/['"]/g, '').trim() : '')
    .filter(k => k !== '');
  if (validUserKeys.length === 0) return result;

  const standardKeys: string[] = [];
  const fuzzyNames: string[] = [];

  validUserKeys.forEach(k => {
    if (/^[A-Za-z]+-\d+$/.test(k)) {
      standardKeys.push(k);
    } else {
      fuzzyNames.push(k);
    }
  });

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

  // One physical Epic key can map to MULTIPLE user input keywords (e.g. Epic "[PMDP]..."
  // matches both user inputs "PMD" and "PMDP"). Hours are accumulated to ALL matched user keys.
  const epicKeyToUserInputs: Record<string, string[]> = {};

  // Step 1a: Verify standard Epic keys
  if (standardKeys.length > 0) {
    const verificationChunkSize = 50;
    for (let i = 0; i < standardKeys.length; i += verificationChunkSize) {
      const subChunk = standardKeys.slice(i, i + verificationChunkSize);
      const subChunkStr = subChunk.map(k => `"${k}"`).join(',');
      const verifyJql = `${projectJql ? projectJql + ' AND ' : ''}issueKey in (${subChunkStr}) AND issuetype in (Epic, "长篇故事") AND created >= -365d`;
      
      let nextPageToken: string | undefined;
      let hasMore = true;
      while (hasMore) {
        const body: Record<string, any> = {
          jql: verifyJql,
          maxResults: 100,
          fields: ['key'],
        };
        if (nextPageToken) body.nextPageToken = nextPageToken;
        
        try {
          const data = await fetchFromJira('search/jql', settings, 'POST', body);
          const epics = data.issues || [];
          epics.forEach((epic: any) => {
            if (epic.key) {
              const matchedKey = subChunk.find(k => k.toLowerCase() === epic.key.toLowerCase());
              if (matchedKey) {
                if (!epicKeyToUserInputs[epic.key]) {
                  epicKeyToUserInputs[epic.key] = [];
                }
                if (!epicKeyToUserInputs[epic.key].includes(matchedKey)) {
                  epicKeyToUserInputs[epic.key].push(matchedKey);
                }
              }
            }
          });
          nextPageToken = data.nextPageToken;
          hasMore = !!nextPageToken;
        } catch (e: any) {
          if (e.message === 'JIRA_AUTH_ERROR') throw e;
          console.warn("Standard epic verification failed", e);
          hasMore = false;
        }
      }
    }
  }

  // Step 1b: Fuzzy search for Epics by summary keyword
  if (fuzzyNames.length > 0) {
    const terms = fuzzyNames.map(name => {
        // Clean bracket wrappers and extract the main search keyword safely
        const clean = name.replace(/[\[\]]/g, '').trim();
        const safe = clean.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_]/g, ' ').trim().split(' ')[0];
        return safe ? `summary ~ "${safe}*"` : '';
    }).filter(x => x);
    
    let termsJql = '';
    if (terms.length > 0) {
        termsJql = `(${terms.join(' OR ')})`;
    }

    let epicSearchJql = `issuetype in (Epic, "长篇故事") AND created >= -365d`;
    if (projectJql) {
       epicSearchJql = `${projectJql} AND issuetype in (Epic, "长篇故事") AND created >= -365d`;
       if (termsJql) {
           epicSearchJql += ` AND ${termsJql}`;
       }
    } else {
       if (termsJql) {
           epicSearchJql += ` AND ${termsJql}`;
       }
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
            
            for (const name of fuzzyNames) {
                const cleanName = name.toLowerCase().replace(/^[\[\s]+/, '');
                
                // Matches standard start or bracket-wrapped start (e.g. "[PROJ-123] ...")
                if (cleanSummary.startsWith(cleanName) || summary.toLowerCase().startsWith(name.toLowerCase())) {
                    if (!epicKeyToUserInputs[epic.key]) {
                        epicKeyToUserInputs[epic.key] = [];
                    }
                    if (!epicKeyToUserInputs[epic.key].includes(name)) {
                        epicKeyToUserInputs[epic.key].push(name);
                    }
                }
            }
        });
        nextPageToken = data.nextPageToken;
        hasMore = !!nextPageToken;
      } catch (e: any) {
        if (e.message === 'JIRA_AUTH_ERROR') throw e;
        console.warn("Epic fuzzy search failed", e);
        hasMore = false;
      }
    }
  }


  // Step 2: Fetch logged hours for all mapped Epic keys
  const targetEpicKeys = Object.keys(epicKeyToUserInputs);
  if (targetEpicKeys.length === 0) return result;

  const chunkSize = 30;
  for (let i = 0; i < targetEpicKeys.length; i += chunkSize) {
    const chunk = targetEpicKeys.slice(i, i + chunkSize);
    const validChunk = chunk.filter(k => k && k.trim() !== '');
    if (validChunk.length === 0) continue;
    const chunkStr = validChunk.map(k => `"${k}"`).join(',');
    
    // targetEpicKeys only contains standard Jira keys discovered from Step 1,
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

        // Determine if it's a test issue
        const issueTypeName = issue.fields.issuetype?.name || '';
        const isTestIssue = settings.testIssueTypes!
          .split(',')
          .map(t => t.trim().toLowerCase())
          .some(t => t && issueTypeName.toLowerCase().includes(t));

        // Accumulate hours to ALL user input keys that matched this Epic
        const matchedUserKeys = epicKeyToUserInputs[actualKey];
        if (matchedUserKeys) {
            const md = timeSpentSeconds / secondsPerDay;
            for (const userInputKey of matchedUserKeys) {
                if (result[userInputKey]) {
                    result[userInputKey].totalLoggedMd += md;
                    if (isTestIssue) {
                      result[userInputKey].testLoggedMd += md;
                    } else {
                      result[userInputKey].devLoggedMd += md;
                    }
                }
            }
        }
      });

      nextPageToken = data.nextPageToken;
      hasMore = !!nextPageToken;
    }
  }

  return result;
};
