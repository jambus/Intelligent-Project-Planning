import * as XLSX from 'xlsx';
import { db } from '../db';




// --- Fuzzy date normalizer ---
// Converts informal date strings ("Apr", "Q3", "March", "Jun (UAT done...)")
// into ISO date strings (YYYY-MM-DD). For startDate use last=false (→ 1st of month),
// for endDate use last=true (→ last day of month).
const monthMap: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

export const normalizeDateField = (value: string, last: boolean, year?: number): string => {
  if (!value || typeof value !== 'string') return '';
  let v = value.trim();
  if (!v) return '';
  // Already a valid ISO date?
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // Strip parenthetical notes: "Jun (UAT done...)" → "Jun"
  v = v.replace(/\s*\(.*\)\s*$/, '').trim();
  const y = year ?? new Date().getFullYear();
  // Quarter: Q1/Q2/Q3/Q4
  const qMatch = v.match(/^[Qq](\d)$/);
  if (qMatch) {
    const q = Number(qMatch[1]);
    const m = (q - 1) * 3 + 1;
    if (last) {
      const endM = m + 2;
      const lastDay = new Date(y, endM, 0).getDate();
      return `${y}-${String(endM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    return `${y}-${String(m).padStart(2, '0')}-01`;
  }
  // Month name
  const mNum = monthMap[v.toLowerCase()];
  if (mNum) {
    if (last) {
      const lastDay = new Date(y, mNum, 0).getDate();
      return `${y}-${String(mNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    return `${y}-${String(mNum).padStart(2, '0')}-01`;
  }
  return ''; // unrecognized
};

// Helper to find column index by matching header names (supports English and Chinese)
const findColumnIndex = (headers: string[], matchNames: string[]): number => {
  const lowercaseHeaders = (headers || []).map(h => (h || '').toString().toLowerCase().trim());
  for (const name of matchNames) {
    const searchName = (name || '').toLowerCase();
    const idx = lowercaseHeaders.findIndex(h => h && typeof h === 'string' && h.includes(searchName));
    if (idx !== -1) return idx;
  }
  return -1; // Not found
};

// Helper to read workbook with UTF-8 hint for CSV/Text files
const readWorkbook = (data: ArrayBuffer): XLSX.WorkBook => {
  // Providing codepage: 65001 (UTF-8) helps SheetJS correctly parse CSVs without BOM
  return XLSX.read(data, { type: 'array', codepage: 65001 });
};

export const importProjectsFromFile = async (files: File | FileList | File[]): Promise<number> => {
  const fileList = 'length' in files ? Array.from(files) : [files];
  let allProjects: any[] = [];

  for (const file of fileList) {
    try {
      const data = await file.arrayBuffer();
      const workbook = readWorkbook(data);
      
      // Default to importing the first sheet only, as requested
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) continue;

      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (!rows || rows.length < 2) continue;

      const headers = rows[0].map(h => (h || '').toString());
      
      // Map header names to indices
      const idxName = findColumnIndex(headers, ['project', '项目名称', 'epic']);
      const idxBusinessOwner = findColumnIndex(headers, ['business owner', '业务方', '业务负责']);
      const idxPriority = findColumnIndex(headers, ['priority', '优先级']);
      const idxStatus = findColumnIndex(headers, ['status', '状态']);
      const idxDigitalResponsible = findColumnIndex(headers, ['digital responsible', '研发负责', '负责人']);
      const idxStartDate = findColumnIndex(headers, ['start in', '开始时间', 'start date']);
      const idxEndDate = findColumnIndex(headers, ['end in', '结束时间', 'end date']);
      const idxGoLive = findColumnIndex(headers, ['go-live', 'go live', 'estimated go-live time', '上线时间']);
      const idxComments = findColumnIndex(headers, ['comments', '备注', '说明']);
      const idxJiraKey = findColumnIndex(headers, ['jira epic key', 'jira key', 'jira']);
      const idxTechLead = findColumnIndex(headers, ['project tech lead', 'tech lead', '技术负责']);
      const idxQualityLead = findColumnIndex(headers, ['project quality lead', 'quality lead', '质量负责', '测试负责']);
      const idxDevMd = findColumnIndex(headers, ['total dev md', 'dev total md', '开发人天', '开发预估']);
      const idxTestMd = findColumnIndex(headers, ['total test md', 'test total md', '测试人天', '测试预估']);
      const idxDetailsDevMd = findColumnIndex(headers, ['details product dev md', 'details dev md']);
      const idxDetailsTestMd = findColumnIndex(headers, ['details product test md', 'details test md']);
      const idxTechStack = findColumnIndex(headers, ['tech stack', '技术栈']);
      const idxDomain = findColumnIndex(headers, ['domain', '产品域', '业务域']);
      const idxScrum = findColumnIndex(headers, ['scrum', 'scrum team', '所属 scrum', '团队', 'scrum 组']);
      const idxTeamMode = findColumnIndex(headers, ['team scheduling mode', '排期模式', '团队模式', '约束模式']);

      const existingScrums = await db.scrumTeams.toArray();
      const scrumMap = new Map<string, number>();
      existingScrums.forEach(s => scrumMap.set(s.name.toLowerCase(), s.id!));
      const newScrumsToInsert = new Set<string>();

      // Check for new scrums
      rows.slice(1).forEach(row => {
        if (!row || !Array.isArray(row)) return;
        const rawScrumName = idxScrum !== -1 ? row[idxScrum]?.toString().trim() || '' : '';
        if (rawScrumName && !scrumMap.has(rawScrumName.toLowerCase())) {
          newScrumsToInsert.add(rawScrumName);
        }
      });

      for (const scrumName of Array.from(newScrumsToInsert)) {
        const newId = await db.scrumTeams.add({ name: scrumName });
        scrumMap.set(scrumName.toLowerCase(), newId as number);
      }

      const sheetProjects = rows.slice(1).map(row => {
        if (!row || !Array.isArray(row)) return null;
        
        const priorityStr = idxPriority !== -1 ? row[idxPriority]?.toString() || 'Medium' : 'Medium';
        const devTotalMd = idxDevMd !== -1 ? Number(row[idxDevMd]) || 0 : 0;
        const testTotalMd = idxTestMd !== -1 ? Number(row[idxTestMd]) || 0 : 0;
        
        const rawScrumName = idxScrum !== -1 ? row[idxScrum]?.toString().trim() || '' : '';
        const scrumTeamId = rawScrumName ? scrumMap.get(rawScrumName.toLowerCase()) : undefined;
        
        let teamModeStr = idxTeamMode !== -1 ? row[idxTeamMode]?.toString().trim().toLowerCase() || '' : '';
        let teamSchedulingMode: 'team-first' | 'cross-team' | 'all-in' = scrumTeamId ? 'cross-team' : 'all-in';
        if (teamModeStr.includes('team-first') || teamModeStr.includes('本队') || teamModeStr.includes('专属')) {
           teamSchedulingMode = 'team-first';
        } else if (teamModeStr.includes('cross-team') || teamModeStr.includes('跨队') || teamModeStr.includes('协作')) {
           teamSchedulingMode = 'cross-team';
        } else if (teamModeStr.includes('all-in') || teamModeStr.includes('全局') || teamModeStr.includes('统筹')) {
           teamSchedulingMode = 'all-in';
        }
        
        return {
          name: idxName !== -1 ? row[idxName]?.toString() || 'Unknown Project' : 'Unknown Project',
          businessOwner: idxBusinessOwner !== -1 ? row[idxBusinessOwner]?.toString() || '' : '',
          priority: priorityStr,
          status: idxStatus !== -1 ? row[idxStatus]?.toString() || 'To Do' : 'To Do',
          digitalResponsible: idxDigitalResponsible !== -1 ? row[idxDigitalResponsible]?.toString() || '' : '',
          startDate: idxStartDate !== -1 ? normalizeDateField(row[idxStartDate]?.toString() || '', false) : '',
          endDate: idxEndDate !== -1 ? normalizeDateField(row[idxEndDate]?.toString() || '', true) : '',
          estimatedGoLiveTime: idxGoLive !== -1 ? row[idxGoLive]?.toString() || '' : '',
          comments: idxComments !== -1 ? row[idxComments]?.toString() || '' : '',
          jiraEpicKey: idxJiraKey !== -1 ? row[idxJiraKey]?.toString() || '' : '',
          projectTechLead: idxTechLead !== -1 ? row[idxTechLead]?.toString() || '' : '',
          projectQualityLead: idxQualityLead !== -1 ? row[idxQualityLead]?.toString() || '' : '',
          devTotalMd,
          testTotalMd,
          detailsProductDevMd: idxDetailsDevMd !== -1 ? row[idxDetailsDevMd]?.toString() || '' : '',
          detailsProductTestMd: idxDetailsTestMd !== -1 ? row[idxDetailsTestMd]?.toString() || '' : '',
          techStack: idxTechStack !== -1 ? row[idxTechStack]?.toString() || '' : '',
          domain: idxDomain !== -1 ? row[idxDomain]?.toString() || '' : '',
          ...(scrumTeamId ? { scrumTeamId } : {}),
          teamSchedulingMode,
        };
      }).filter((p): p is any => p !== null && (p.name !== 'Unknown Project' || p.businessOwner !== ''));

      allProjects = [...allProjects, ...sheetProjects];
    } catch (err) {
      console.error(`Error processing file ${file.name}:`, err);
      throw err;
    }
  }

  await db.projects.clear();
  if (allProjects.length > 0) {
    await db.projects.bulkAdd(allProjects);
  }
  return allProjects.length;
};

export const importResourcesFromFile = async (files: File | FileList | File[]): Promise<number> => {
  const fileList = 'length' in files ? Array.from(files) : [files];
  let allResources: any[] = [];

  for (const file of fileList) {
    try {
      const data = await file.arrayBuffer();
      const workbook = readWorkbook(data);
      
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) continue;

      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (!rows || rows.length < 2) continue;

      const headers = rows[0].map(h => (h || '').toString());
      
      const idxName = findColumnIndex(headers, ['name', '姓名', '成员']);
      const idxRole = findColumnIndex(headers, ['role', '角色', '专业角色', '职位']);
      const idxCapacity = findColumnIndex(headers, ['capacity', '负荷', '可用负荷', '投入比']);
      const idxSkills = findColumnIndex(headers, ['skills', '技能', '标签', '核心技能']);
      const idxJiraAliases = findColumnIndex(headers, ['jira aliases', 'jira id', 'jira别名', 'jira账号', 'jira映射']);
      const idxScrum = findColumnIndex(headers, ['scrum', 'scrum team', '所属 scrum', '团队', 'scrum 组']);
      const idxUnavailable = findColumnIndex(headers, ['unavailable dates', 'unavailable', '请假', '休假', '不可用日期']);

      const existingScrums = await db.scrumTeams.toArray();
      const scrumMap = new Map<string, number>();
      existingScrums.forEach(s => scrumMap.set(s.name.toLowerCase(), s.id!));
      const newScrumsToInsert = new Set<string>();

      // Check for new scrums
      rows.slice(1).forEach(row => {
        if (!row || !Array.isArray(row)) return;
        const rawScrumName = idxScrum !== -1 ? row[idxScrum]?.toString().trim() || '' : '';
        if (rawScrumName && !scrumMap.has(rawScrumName.toLowerCase())) {
          newScrumsToInsert.add(rawScrumName);
        }
      });

      for (const scrumName of Array.from(newScrumsToInsert)) {
        const newId = await db.scrumTeams.add({ name: scrumName });
        scrumMap.set(scrumName.toLowerCase(), newId as number);
      }

      const sheetResources = rows.slice(1).map(row => {
        if (!row || !Array.isArray(row)) return null;
        const rawSkills = idxSkills !== -1 ? row[idxSkills]?.toString() || '' : '';
        const rawCapacity = idxCapacity !== -1 ? row[idxCapacity]?.toString() || '100' : '100';
        const rawAliases = idxJiraAliases !== -1 ? row[idxJiraAliases]?.toString() || '' : '';
        const rawScrumName = idxScrum !== -1 ? row[idxScrum]?.toString().trim() || '' : '';
        const scrumTeamId = rawScrumName ? scrumMap.get(rawScrumName.toLowerCase()) : undefined;
        const rawUnavailable = idxUnavailable !== -1 ? row[idxUnavailable]?.toString().trim() || '' : '';
        const unavailableDates = rawUnavailable ? rawUnavailable.split(/[,,，，\n]/).map((d: string) => d.trim()).filter(Boolean) : undefined;
        return {
          name: idxName !== -1 ? row[idxName]?.toString() || 'Unknown' : 'Unknown',
          role: idxRole !== -1 ? row[idxRole]?.toString() || '前端工程师' : '前端工程师',
          capacity: Number(rawCapacity.replace('%', '')) || 100,
          skills: rawSkills.split(/[,,，，]/).map((s: string) => s.trim()).filter(Boolean),
          ...(rawAliases ? { jiraAliases: rawAliases } : {}),
          ...(scrumTeamId ? { scrumTeamId } : {}),
          ...(unavailableDates && unavailableDates.length > 0 ? { unavailableDates } : {})
        };
      }).filter((r): r is any => r !== null && r.name !== 'Unknown');

      allResources = [...allResources, ...sheetResources];
    } catch (err) {
      console.error(`Error processing file ${file.name}:`, err);
      throw err;
    }
  }

  await db.resources.clear();
  if (allResources.length > 0) {
    await db.resources.bulkAdd(allResources);
  }
  return allResources.length;
};

export const importSkillsFromFile = async (files: File | FileList | File[]): Promise<number> => {
  const fileList = 'length' in files ? Array.from(files) : [files];
  let allSkillsToInsert: any[] = [];

  for (const file of fileList) {
    try {
      const data = await file.arrayBuffer();
      const workbook = readWorkbook(data);
      
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) continue;

      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (!rows || rows.length < 2) continue;

      const headers = rows[0].map(h => (h || '').toString());
      
      const idxName = findColumnIndex(headers, ['name', '技能', '标签名称']);
      const idxType = findColumnIndex(headers, ['type', '类别', '类型']);

      const sheetSkills = rows.slice(1).map(row => {
        if (!row || !Array.isArray(row)) return null;
        const type = idxType !== -1 ? row[idxType]?.toString().toLowerCase() || 'business' : 'business';
        return {
          name: idxName !== -1 ? row[idxName]?.toString() || 'Unknown' : 'Unknown',
          type: (type.includes('tech') || type.includes('技术')) ? 'technical' : 'business'
        } as const;
      }).filter((s): s is any => s !== null && s.name !== 'Unknown');

      allSkillsToInsert = [...allSkillsToInsert, ...sheetSkills];
    } catch (err) {
      console.error(`Error processing file ${file.name}:`, err);
      throw err;
    }
  }

  if (allSkillsToInsert.length > 0) {
    // Add only unique new skills by name
    const existing = await db.skills.toArray();
    const existingNames = new Set(existing.map(s => s.name.toLowerCase()));
    const uniqueNew = allSkillsToInsert.filter(s => !existingNames.has(s.name.toLowerCase()));
    
    // Further deduplicate within the current import batch
    const seenInBatch = new Set<string>();
    const finalUniqueNew = uniqueNew.filter(s => {
      const lowerName = s.name.toLowerCase();
      if (seenInBatch.has(lowerName)) return false;
      seenInBatch.add(lowerName);
      return true;
    });

    if (finalUniqueNew.length > 0) {
       await db.skills.bulkAdd(finalUniqueNew as any);
    }
    return finalUniqueNew.length;
  }
  return 0;
};

export const importProductOperationsFromFile = async (files: File | FileList | File[]): Promise<number> => {
  const fileList = 'length' in files ? Array.from(files) : [files];
  let allOperations: any[] = [];

  for (const file of fileList) {
    try {
      const data = await file.arrayBuffer();
      const workbook = readWorkbook(data);
      
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) continue;

      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (!rows || rows.length < 2) continue;

      const headers = rows[0].map(h => (h || '').toString());
      
      const idxProductName = findColumnIndex(headers, ['product name', '产品名称', '产品']);
      const idxDevMd = findColumnIndex(headers, ['monthly dev md', '每月开发人天', '开发运维人天']);
      const idxTestMd = findColumnIndex(headers, ['monthly test md', '每月测试人天', '测试运维人天']);

      const sheetOperations = rows.slice(1).map(row => {
        if (!row || !Array.isArray(row)) return null;
        return {
          productName: idxProductName !== -1 ? row[idxProductName]?.toString() || 'Unknown' : 'Unknown',
          monthlyDevMd: idxDevMd !== -1 ? Number(row[idxDevMd]) || 0 : 0,
          monthlyTestMd: idxTestMd !== -1 ? Number(row[idxTestMd]) || 0 : 0,
        };
      }).filter((o): o is any => o !== null && o.productName !== 'Unknown');

      allOperations = [...allOperations, ...sheetOperations];
    } catch (err) {
      console.error(`Error processing file ${file.name}:`, err);
      throw err;
    }
  }

  await db.productOperations.clear();
  if (allOperations.length > 0) {
    await db.productOperations.bulkAdd(allOperations);

    // Ensure all product names are added as skills if they don't exist
    const existingSkills = await db.skills.toArray();
    const existingSkillNames = new Set(existingSkills.map(s => s.name.toLowerCase()));
    
    const newSkillsToInsert: any[] = [];
    const seenNewSkills = new Set<string>();

    for (const op of allOperations) {
      const lowerName = op.productName.toLowerCase();
      if (!existingSkillNames.has(lowerName) && !seenNewSkills.has(lowerName)) {
        seenNewSkills.add(lowerName);
        newSkillsToInsert.push({
          name: op.productName,
          type: 'business'
        });
      }
    }

    if (newSkillsToInsert.length > 0) {
      await db.skills.bulkAdd(newSkillsToInsert);
    }
  }
  return allOperations.length;
};

