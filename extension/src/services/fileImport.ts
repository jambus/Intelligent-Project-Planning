import * as XLSX from 'xlsx';
import { db } from '../db';

const priorityWeight: Record<string, number> = {
  'High': 3, 'Medium': 2, 'Low': 1,
  '高': 3, '中': 2, '低': 1,
  'P0': 4, 'P1': 3, 'P2': 2, 'P3': 1,
  'Must Win': 5, 'Compliance': 4
};

const getPriorityWeight = (p: string) => priorityWeight[p] || 0;

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

      const sheetProjects = rows.slice(1).map(row => {
        if (!row || !Array.isArray(row)) return null;
        
        const priorityStr = idxPriority !== -1 ? row[idxPriority]?.toString() || 'Medium' : 'Medium';
        const devTotalMd = idxDevMd !== -1 ? Number(row[idxDevMd]) || 0 : 0;
        const testTotalMd = idxTestMd !== -1 ? Number(row[idxTestMd]) || 0 : 0;
        const isHighPriority = getPriorityWeight(priorityStr) >= 3;
        // User specified: Dev MD <= 10 means single mode (focused).
        // High priority and Dev MD > 10 means balanced.
        // Others (e.g. low priority and Dev MD > 10) also fallback to focused.
        const isLargeDevProject = devTotalMd > 10; 
        
        let defaultStrategy: 'balanced' | 'focused' | 'urgent' = 'focused';
        if (isHighPriority && isLargeDevProject) {
          defaultStrategy = 'balanced';
        }
        
        return {
          name: idxName !== -1 ? row[idxName]?.toString() || 'Unknown Project' : 'Unknown Project',
          businessOwner: idxBusinessOwner !== -1 ? row[idxBusinessOwner]?.toString() || '' : '',
          priority: priorityStr,
          status: idxStatus !== -1 ? row[idxStatus]?.toString() || 'To Do' : 'To Do',
          digitalResponsible: idxDigitalResponsible !== -1 ? row[idxDigitalResponsible]?.toString() || '' : '',
          startDate: idxStartDate !== -1 ? row[idxStartDate]?.toString() || '' : '',
          endDate: idxEndDate !== -1 ? row[idxEndDate]?.toString() || '' : '',
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
          schedulingStrategy: defaultStrategy,
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

      const sheetResources = rows.slice(1).map(row => {
        if (!row || !Array.isArray(row)) return null;
        const rawSkills = idxSkills !== -1 ? row[idxSkills]?.toString() || '' : '';
        const rawCapacity = idxCapacity !== -1 ? row[idxCapacity]?.toString() || '100' : '100';
        const rawAliases = idxJiraAliases !== -1 ? row[idxJiraAliases]?.toString() || '' : '';
        return {
          name: idxName !== -1 ? row[idxName]?.toString() || 'Unknown' : 'Unknown',
          role: idxRole !== -1 ? row[idxRole]?.toString() || '前端工程师' : '前端工程师',
          capacity: Number(rawCapacity.replace('%', '')) || 100,
          skills: rawSkills.split(/[,,，，]/).map((s: string) => s.trim()).filter(Boolean),
          ...(rawAliases ? { jiraAliases: rawAliases } : {})
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

