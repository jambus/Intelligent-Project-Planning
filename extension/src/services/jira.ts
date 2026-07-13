import { getStorageItem } from '../utils/storage';

interface JiraSettings {
  domain: string; // e.g., "https://your-domain.atlassian.net"
  email: string;
  apiToken: string;
  projects?: string;
  hoursPerDay?: number;
  testIssueTypes?: string;
  epicLinkFieldId?: string; // Jira "Epic Link" custom field numeric id (default 10014)
}

export const getJiraSettings = async (): Promise<JiraSettings | null> => {
  const domain = await getStorageItem<string>('jiraDomain');
  const email = await getStorageItem<string>('jiraEmail');
  const apiToken = await getStorageItem<string>('jiraApiToken');
  const projects = await getStorageItem<string>('jiraProjects');
  const hoursPerDayStr = await getStorageItem<string>('jiraHoursPerDay');
  const hoursPerDay = hoursPerDayStr ? Number(hoursPerDayStr) : 6;
  const testIssueTypes = await getStorageItem<string>('jiraTestIssueTypes') || 'Test,QA,Bug,Defect,测试,缺陷';
  // Epic Link field id varies per Jira instance; allow override, fall back to 10014.
  const epicLinkFieldId = (await getStorageItem<string>('jiraEpicLinkFieldId') || '10014').replace(/\D/g, '') || '10014';

  if (!domain) return null;
  return { domain, email: email || '', apiToken: apiToken || '', projects: projects || '', hoursPerDay, testIssueTypes, epicLinkFieldId };
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

export interface RosterMember {
  name: string;
  role: string;
  aliases?: string[]; // Explicit Jira identities (accountId / email / display name) to reconcile name mismatches
}

export interface EpicHours {
  epicKey: string;
  totalLoggedMd: number;
  devLoggedMd: number;
  testLoggedMd: number;
  status?: string;    // Epic current status name
  storyCount: number; // # of Story children
  taskCount: number;  // # of Task children
  bugCount: number;   // # of Bug children
}

/**
 * A Jira worklog author that could NOT be matched to any roster member.
 * Surfaced to the UI so the user can map them (accountId / email / display name)
 * to a team member instead of silently falling back to the issue-type heuristic.
 */
export interface UnmatchedAuthor {
  accountId?: string;
  email?: string;
  displayName?: string;
  totalSeconds: number; // total logged time (seconds) attributed to this author across synced epics
}

interface EpicMeta {
  status?: string;
  storyCount: number;
  taskCount: number;
  bugCount: number;
}

/**
 * Sync logged hours for given Epic Keys.
 *
 * Dev/Test split is driven by the WORKLOG AUTHOR's role in the personnel roster
 * (测试工程师 -> test MD, everyone else -> dev MD). When an author cannot be
 * matched in the roster, that portion falls back to the issue-type heuristic
 * (testIssueTypes). Also collects the Epic status and Story/Task/Bug child counts.
 */
export const syncEpicLoggedHours = async (epicKeys: string[], roster: RosterMember[] = [], unmatchedCollector?: Record<string, UnmatchedAuthor>, startDate?: string, endDate?: string): Promise<Record<string, EpicHours>> => {
  const settings = await getJiraSettings();
  if (!settings) throw new Error('Jira 设置未配置 (Jira settings not configured).');

  const hoursPerDay = (settings as any).hoursPerDay || 6;
  const secondsPerDay = hoursPerDay * 3600;
  const epicLinkFieldId = settings.epicLinkFieldId || '10014';
  const epicLinkFieldName = `customfield_${epicLinkFieldId}`;

  // --- Roster-based worklog-author classifier ---
  // Matching strategy, in order of reliability:
  //   1. Exact match on Jira accountId / full email (provided via explicit aliases).
  //   2. Fuzzy match on display-name / email-prefix tokens (roster name + alias tokens).
  // Explicit aliases let users reconcile cases where the roster name differs from the
  // Jira display name (English vs Chinese name, nickname, shared account, etc.).
  const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '').trim();
  interface AuthorMatcher { exactIds: string[]; tokens: string[]; }
  const testMatchers: AuthorMatcher[] = [];
  const devMatchers: AuthorMatcher[] = [];
  roster.forEach(m => {
    const exactIds: string[] = [];
    const tokens: string[] = [];
    const nm = norm(m.name);
    if (nm) tokens.push(nm);
    (m.aliases || []).forEach(a => {
      const raw = (a || '').trim();
      if (!raw) return;
      exactIds.push(raw.toLowerCase());                       // matched against accountId / full email
      const t = norm(raw.includes('@') ? raw.split('@')[0] : raw);
      if (t) tokens.push(t);                                  // matched against display name / email-prefix
    });
    if (exactIds.length === 0 && tokens.length === 0) return;
    (['测试工程师', '测试组长'].includes(m.role) ? testMatchers : devMatchers).push({ exactIds, tokens });
  });
  // Only collect unmatched authors when a roster is actually configured; otherwise
  // every author would be "unmatched" and flood the prompt.
  const hasMatchers = testMatchers.length + devMatchers.length > 0;
  const matchAuthor = (matchers: AuthorMatcher[], exactCands: string[], nameCands: string[]) =>
    matchers.some(mm =>
      mm.exactIds.some(id => id.length >= 3 && exactCands.includes(id)) ||
      mm.tokens.some(rn => rn.length >= 2 && nameCands.some(c => c === rn || c.includes(rn) || rn.includes(c)))
    );
  const classifyAuthor = (author: any): 'dev' | 'test' | null => {
    const accId = (author?.accountId || '').toLowerCase();
    const email = (author?.emailAddress || '').toLowerCase();
    const exactCands = [accId, email].filter(Boolean);
    const nameCands = [norm(author?.displayName), norm(email.split('@')[0])].filter(Boolean);
    if (matchAuthor(testMatchers, exactCands, nameCands)) return 'test';
    if (matchAuthor(devMatchers, exactCands, nameCands)) return 'dev';
    return null;
  };

  // Paginate the dedicated worklog endpoint when the inline `worklog` field is truncated.
  const fetchAllWorklogs = async (issueKey: string): Promise<any[]> => {
    const all: any[] = [];
    let startAt = 0;
    for (;;) {
      const data = await fetchFromJira(`issue/${encodeURIComponent(issueKey)}/worklog?startAt=${startAt}&maxResults=100`, settings);
      const batch = data.worklogs || [];
      all.push(...batch);
      const total = data.total ?? all.length;
      startAt += batch.length;
      if (batch.length === 0 || all.length >= total) break;
    }
    return all;
  };

  const result: Record<string, EpicHours> = {};
  epicKeys.forEach(key => {
    if (key) result[key] = { epicKey: key, totalLoggedMd: 0, devLoggedMd: 0, testLoggedMd: 0, storyCount: 0, taskCount: 0, bugCount: 0 };
  });

  // Per physical-Epic metadata (status + child counts), propagated to user keys at the end.
  const epicMeta: Record<string, EpicMeta> = {};
  const ensureMeta = (k: string): EpicMeta => (epicMeta[k] || (epicMeta[k] = { storyCount: 0, taskCount: 0, bugCount: 0 }));

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
          fields: ['key', 'status'],
        };
        if (nextPageToken) body.nextPageToken = nextPageToken;
        
        try {
          const data = await fetchFromJira('search/jql', settings, 'POST', body);
          const epics = data.issues || [];
          epics.forEach((epic: any) => {
            if (epic.key) {
              if (epic.fields?.status?.name) ensureMeta(epic.key).status = epic.fields.status.name;
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
        fields: ['summary', 'status'],
      };
      if (nextPageToken) body.nextPageToken = nextPageToken;
      
      try {
        const data = await fetchFromJira('search/jql', settings, 'POST', body);
        const epics = data.issues || [];
        epics.forEach((epic: any) => {
            const summary = epic.fields.summary || '';
            const cleanSummary = summary.toLowerCase().replace(/^[\[\s]+/, '');
            if (epic.fields?.status?.name) ensureMeta(epic.key).status = epic.fields.status.name;
            
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
    let jql = `(parent in (${chunkStr}) OR cf[${epicLinkFieldId}] in (${chunkStr}) OR issueKey in (${chunkStr}))`;
    if (startDate) {
      jql += ` AND worklogDate >= "${startDate}"`;
    }
    if (endDate) {
      jql += ` AND worklogDate <= "${endDate}"`;
    }

    let nextPageToken: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const body: Record<string, any> = {
        jql,
        maxResults: 100,
        fields: ['parent', epicLinkFieldName, 'issuetype', 'timespent', 'aggregatetimespent', 'timetracking', 'summary', 'status', 'worklog'],
      };
      if (nextPageToken) body.nextPageToken = nextPageToken;
      
      const data = await fetchFromJira('search/jql', settings, 'POST', body);
      const issues = data.issues || [];

      for (const issue of issues) {
        let actualKey = issue.key;
        if (issue.fields.parent && issue.fields.parent.key) {
          actualKey = issue.fields.parent.key;
        } else if (issue.fields[epicLinkFieldName]) {
          actualKey = issue.fields[epicLinkFieldName];
        }

        const isEpicItself = issue.key.toLowerCase() === actualKey.toLowerCase();
        const issueTypeName = issue.fields.issuetype?.name || '';
        const meta = ensureMeta(actualKey);

        if (isEpicItself) {
          // Also capture status for epics reached directly via `issueKey in (...)`.
          if (issue.fields.status?.name) meta.status = issue.fields.status.name;
        } else {
          // Tally child issue types (Story / Task / Bug), excluding sub-tasks. Names
          // may be English or Chinese depending on the Jira instance.
          const tn = issueTypeName.toLowerCase();
          const isSub = tn.includes('sub') || issueTypeName.includes('子');
          if (!isSub) {
            if (tn.includes('story') || issueTypeName.includes('故事')) meta.storyCount += 1;
            else if (tn.includes('bug') || tn.includes('defect') || issueTypeName.includes('缺陷')) meta.bugCount += 1;
            else if (tn.includes('task') || issueTypeName.includes('任务')) meta.taskCount += 1;
          }
        }

        // If the issue is the Epic itself, use timespent (not aggregatetimespent) to
        // avoid double-counting child issues processed separately in this loop.
        const timeSpentSeconds = isEpicItself
          ? (issue.fields.timespent || issue.fields.timetracking?.timeSpentSeconds || 0)
          : (issue.fields.aggregatetimespent || issue.fields.timespent || issue.fields.timetracking?.timeSpentSeconds || 0);

        if (timeSpentSeconds <= 0) continue;

        const matchedUserKeys = epicKeyToUserInputs[actualKey];
        if (!matchedUserKeys) continue;

        // Issue-type heuristic used as the fallback for un-rostered worklog authors.
        const isTestIssue = settings.testIssueTypes!
          .split(',')
          .map(t => t.trim().toLowerCase())
          .some(t => t && issueTypeName.toLowerCase().includes(t));

        // Split this issue's logged time by worklog-author role. Worklogs only cover
        // the issue's OWN time, so we apply the role ratio to the full timeSpentSeconds
        // (which may include sub-task roll-up) and route unmatched authors via the
        // issue-type fallback. Totals stay exact regardless.
        let worklogs: any[] = issue.fields.worklog?.worklogs || [];
        const wlTotal = issue.fields.worklog?.total ?? worklogs.length;
        if (wlTotal > worklogs.length) {
          try {
            worklogs = await fetchAllWorklogs(issue.key);
          } catch (e: any) {
            if (e.message === 'JIRA_AUTH_ERROR') throw e;
            // Keep the truncated inline set on failure.
          }
        }

        let devSec = 0, testSec = 0, unknownSec = 0;
        for (const wl of worklogs) {
          const s = wl.timeSpentSeconds || 0;
          if (s <= 0) continue;
          const role = classifyAuthor(wl.author);
          if (role === 'test') testSec += s;
          else if (role === 'dev') devSec += s;
          else {
            unknownSec += s;
            // Record this author so the user can later map them to a roster member.
            if (unmatchedCollector && hasMatchers && wl.author) {
              const a = wl.author;
              const ukey = (a.accountId || a.emailAddress || a.displayName || '').toLowerCase();
              if (ukey) {
                const existing = unmatchedCollector[ukey] || (unmatchedCollector[ukey] = {
                  accountId: a.accountId,
                  email: a.emailAddress,
                  displayName: a.displayName,
                  totalSeconds: 0,
                });
                existing.totalSeconds += s;
              }
            }
          }
        }
        const wlSum = devSec + testSec + unknownSec;

        const md = timeSpentSeconds / secondsPerDay;
        let devMd: number, testMd: number;
        if (wlSum > 0) {
          devMd = md * (devSec / wlSum);
          testMd = md * (testSec / wlSum);
          const unknownMd = md * (unknownSec / wlSum);
          if (isTestIssue) testMd += unknownMd; else devMd += unknownMd;
        } else {
          // No worklog detail (e.g. time only on sub-tasks): fall back to issue type.
          if (isTestIssue) { testMd = md; devMd = 0; } else { devMd = md; testMd = 0; }
        }

        for (const userInputKey of matchedUserKeys) {
          const r = result[userInputKey];
          if (!r) continue;
          r.totalLoggedMd += md;
          r.devLoggedMd += devMd;
          r.testLoggedMd += testMd;
        }
      }

      nextPageToken = data.nextPageToken;
      hasMore = !!nextPageToken;
    }
  }

  // Propagate Epic status + child counts to every user input key that mapped to it.
  // A single user keyword (especially via fuzzy match) can resolve to MULTIPLE physical
  // Epics, so we aggregate the DISTINCT statuses instead of letting the last one win,
  // while child counts are summed across all matched Epics.
  const statusSets: Record<string, Set<string>> = {};
  Object.entries(epicKeyToUserInputs).forEach(([epicKey, userKeys]) => {
    const meta = epicMeta[epicKey];
    if (!meta) return;
    userKeys.forEach(uk => {
      const r = result[uk];
      if (!r) return;
      if (meta.status) (statusSets[uk] || (statusSets[uk] = new Set<string>())).add(meta.status);
      r.storyCount += meta.storyCount;
      r.taskCount += meta.taskCount;
      r.bugCount += meta.bugCount;
    });
  });
  Object.entries(statusSets).forEach(([uk, set]) => {
    if (result[uk] && set.size > 0) result[uk].status = Array.from(set).join(' / ');
  });

  return result;
};
