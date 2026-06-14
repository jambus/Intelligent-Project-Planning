import * as XLSX from 'xlsx';
import { db, type Project, type Resource, type Allocation, type ProductOperation } from '../db';
import { 
  formatLocalDate, 
  loadHolidaysConfig, 
  calculateWeeklyMD, 
  isWorkingDay
} from '../utils/dateUtils';

const getWeekStart = (wYear: number, wNum: number): string => {
  const jan4 = new Date(wYear, 0, 4);
  const day = jan4.getDay() || 7;
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - day + 1 + (wNum - 1) * 7);
  return formatLocalDate(weekStart);
};

export const exportScheduleCsv = (
  allocations: Allocation[],
  projects: Project[],
  resources: Resource[],
  operations: ProductOperation[],
  displayWeeks: { year: number, week: number, label: string }[],
  workingDaySet: Set<string>
) => {
  const rows: string[] = [];
  rows.push(['人员', '角色', '项目', '类型', '周起始日', '天数'].join(','));

  const map = new Map<string, any[]>();
  allocations.forEach(a => {
    const key = `${a.resourceId}_${a.projectId}_${a.allocationType || 'dev'}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  });

  Array.from(map.values()).forEach(group => {
    const alloc = group[0];
    const resource = resources.find(r => Number(r.id) === Number(alloc.resourceId));
    if (!resource) return;

    const isOp = Number(alloc.projectId) <= -1000000;
    const opId = isOp ? -Number(alloc.projectId) - 1000000 : null;
    const operation = isOp ? operations.find(o => Number(o.id) === opId) : null;
    const project = isOp ? null : projects.find(p => Number(p.id) === Number(alloc.projectId));
    
    const projName = isOp ? `[运维]${operation?.productName || 'Unknown'}` : (project?.name || 'Unknown Project');
    const role = resource.role || '';
    const resName = resource.name || '';
    const allocType = alloc.allocationType || 'dev';

    displayWeeks.forEach(w => {
      const md = group.reduce((sum, a) => sum + calculateWeeklyMD(a.startDate, a.endDate, a.allocationPercentage, w.year, w.week, workingDaySet), 0);
      if (md > 0) {
        const wStart = getWeekStart(w.year, w.week);
        rows.push([resName, role, projName, allocType, wStart, md.toFixed(1)].map(v => `"${v}"`).join(','));
      }
    });
  });

  const csvContent = '\uFEFF' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `schedule_export_${formatLocalDate(new Date())}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const importScheduleCsv = async (files: File | FileList | File[]): Promise<number> => {
  const fileList = 'length' in files ? Array.from(files) : [files];
  let allRows: any[] = [];

  for (const file of fileList) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) continue;

    const worksheet = workbook.Sheets[firstSheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (!rows || rows.length < 2) continue;

    const headers = rows[0].map(h => (h || '').toString().toLowerCase().trim());
    
    const idxName = headers.findIndex(h => h.includes('人员') || h.includes('name'));
    const idxProj = headers.findIndex(h => h.includes('项目') || h.includes('project'));
    const idxType = headers.findIndex(h => h.includes('类型') || h.includes('type'));
    const idxWeek = headers.findIndex(h => h.includes('周起始日') || h.includes('week'));
    const idxDays = headers.findIndex(h => h.includes('天数') || h.includes('days'));

    if (idxName === -1 || idxProj === -1 || idxWeek === -1 || idxDays === -1) {
       throw new Error('CSV format is missing required columns.');
    }

    const sheetRows = rows.slice(1).map(row => {
      if (!row || !Array.isArray(row)) return null;
      return {
        name: row[idxName]?.toString() || '',
        project: row[idxProj]?.toString() || '',
        type: idxType !== -1 ? (row[idxType]?.toString() || 'dev') : 'dev',
        weekStart: row[idxWeek]?.toString() || '',
        days: Number(row[idxDays]) || 0
      };
    }).filter(r => r && r.name && r.project && r.weekStart && r.days > 0);

    allRows = [...allRows, ...sheetRows];
  }

  await loadHolidaysConfig();
  
  const resources = await db.resources.toArray();
  const projects = await db.projects.toArray();
  const operations = await db.productOperations.toArray();

  const newAllocations: Allocation[] = [];

  for (const r of allRows) {
    const resource = resources.find(res => res.name === r.name);
    if (!resource) continue;
    
    let projectId: number | undefined;
    let projName = r.project;
    if (projName.startsWith('[运维]')) {
      projName = projName.replace('[运维]', '').trim();
      const op = operations.find(o => o.productName === projName);
      if (op) {
        projectId = -(Number(op.id) + 1000000);
      }
    } else {
      const proj = projects.find(p => p.name === projName);
      if (proj) {
        projectId = proj.id;
      }
    }

    if (projectId === undefined) continue;

    const weekStart = new Date(r.weekStart);
    if (isNaN(weekStart.getTime())) continue;

    let activeWorkingDays = 0;
    const current = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
       if (isWorkingDay(current)) {
          activeWorkingDays++;
       }
       current.setDate(current.getDate() + 1);
    }
    
    if (activeWorkingDays === 0) continue;

    const allocPercentage = Math.round((r.days / activeWorkingDays) * 100);
    if (allocPercentage <= 0) continue;

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    newAllocations.push({
      resourceId: resource.id!,
      projectId: projectId,
      allocationType: (r.type.toLowerCase() === 'test' || r.type === '测试') ? 'test' : 'dev',
      startDate: formatLocalDate(weekStart),
      endDate: formatLocalDate(weekEnd),
      allocationPercentage: allocPercentage
    });
  }

  await db.allocations.clear();
  if (newAllocations.length > 0) {
    await db.allocations.bulkAdd(newAllocations);
  }

  return newAllocations.length;
};
