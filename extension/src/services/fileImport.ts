import * as XLSX from 'xlsx';
import { db } from '../db';

// Helper to find column index by matching header names (supports English and Chinese)
const findColumnIndex = (headers: string[], matchNames: string[]): number => {
  const lowercaseHeaders = headers.map(h => (h || '').toString().toLowerCase().trim());
  for (const name of matchNames) {
    const idx = lowercaseHeaders.findIndex(h => h.includes(name.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1; // Not found
};

export const importProjectsFromFile = async (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rows.length < 2) {
          throw new Error('文件中没有数据行');
        }

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

        const projectsToInsert = rows.slice(1).map(row => {
          return {
            name: idxName !== -1 ? row[idxName]?.toString() || 'Unknown Project' : 'Unknown Project',
            businessOwner: idxBusinessOwner !== -1 ? row[idxBusinessOwner]?.toString() || '' : '',
            priority: idxPriority !== -1 ? row[idxPriority]?.toString() || 'Medium' : 'Medium',
            status: idxStatus !== -1 ? row[idxStatus]?.toString() || 'To Do' : 'To Do',
            digitalResponsible: idxDigitalResponsible !== -1 ? row[idxDigitalResponsible]?.toString() || '' : '',
            startDate: idxStartDate !== -1 ? row[idxStartDate]?.toString() || '' : '',
            endDate: idxEndDate !== -1 ? row[idxEndDate]?.toString() || '' : '',
            estimatedGoLiveTime: idxGoLive !== -1 ? row[idxGoLive]?.toString() || '' : '',
            comments: idxComments !== -1 ? row[idxComments]?.toString() || '' : '',
            jiraEpicKey: idxJiraKey !== -1 ? row[idxJiraKey]?.toString() || '' : '',
            projectTechLead: idxTechLead !== -1 ? row[idxTechLead]?.toString() || '' : '',
            projectQualityLead: idxQualityLead !== -1 ? row[idxQualityLead]?.toString() || '' : '',
            devTotalMd: idxDevMd !== -1 ? Number(row[idxDevMd]) || 0 : 0,
            testTotalMd: idxTestMd !== -1 ? Number(row[idxTestMd]) || 0 : 0,
            detailsProductDevMd: idxDetailsDevMd !== -1 ? row[idxDetailsDevMd]?.toString() || '' : '',
            detailsProductTestMd: idxDetailsTestMd !== -1 ? row[idxDetailsTestMd]?.toString() || '' : '',
            techStack: idxTechStack !== -1 ? row[idxTechStack]?.toString() || '' : '',
            domain: idxDomain !== -1 ? row[idxDomain]?.toString() || '' : '',
          };
        }).filter(p => p.name !== 'Unknown Project' || p.businessOwner !== '');

        await db.projects.clear();
        if (projectsToInsert.length > 0) {
          await db.projects.bulkAdd(projectsToInsert);
        }
        
        resolve(projectsToInsert.length);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
