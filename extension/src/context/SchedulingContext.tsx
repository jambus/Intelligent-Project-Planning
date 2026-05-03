import { createContext, useContext, useState, type ReactNode, useRef } from 'react';
import { db } from '../db';
import { suggestAllocationsForBatch, type AIMicroAllocation, type SchedulingStrategy } from '../services/ai';
import { getWorkingDays, calculateEndDate, isWorkingDay, isValidDateStr } from '../utils/dateUtils';

interface SchedulingContextType {
  isScheduling: boolean;
  scheduleStatus: string;
  currentStep: number;
  error: string | null;
  strategy: SchedulingStrategy;
  setStrategy: (s: SchedulingStrategy) => void;
  handleGenerateSchedule: (selectedYear: number, startMonth: number, endMonth: number) => Promise<void>;
  stopScheduling: () => void;
  clearError: () => void;
}

const SchedulingContext = createContext<SchedulingContextType | undefined>(undefined);

export const useScheduling = () => {
  const context = useContext(SchedulingContext);
  if (!context) throw new Error('useScheduling must be used within a SchedulingProvider');
  return context;
};

interface DailySlot {
  date: string;
  totalCapacity: number;
  usedCapacity: number;
  available: number;
}

export const SchedulingProvider = ({ children }: { children: ReactNode }) => {
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<SchedulingStrategy>('balanced');
  
  const stopRequestedRef = useRef(false);

  const stopScheduling = () => {
    if (isScheduling) {
      stopRequestedRef.current = true;
      setScheduleStatus('🛑 正在停止排期...');
    }
  };

  const generateResourceCalendar = (res: any, currentAllocations: any[], year: number, startM: number, endM: number) => {
    const calendar: DailySlot[] = [];
    const rangeStart = new Date(year, startM - 1, 1);
    const rangeEnd = new Date(year, endM, 0);
    
    let current = new Date(rangeStart);
    while (current <= rangeEnd) {
      if (isWorkingDay(current)) {
        const dateStr = current.toISOString().split('T')[0];
        let used = 0;
        currentAllocations.filter(a => Number(a.resourceId) === Number(res.id)).forEach(a => {
          if (dateStr >= a.startDate && dateStr <= a.endDate) {
            used += (a.allocationPercentage || 0);
          }
        });
        calendar.push({
          date: dateStr,
          totalCapacity: res.capacity,
          usedCapacity: used,
          available: Math.max(0, res.capacity - used)
        });
      }
      current.setDate(current.getDate() + 1);
    }
    return calendar;
  };

  const getAvailableWindows = (calendar: DailySlot[]) => {
    const windows: { from: string, to: string, dailyAvailable: number }[] = [];
    if (calendar.length === 0) return windows;
    let currentWindow: any = null;
    calendar.forEach(slot => {
      if (slot.available >= 1) {
        if (!currentWindow || currentWindow.dailyAvailable !== slot.available) {
          if (currentWindow) windows.push(currentWindow);
          currentWindow = { from: slot.date, to: slot.date, dailyAvailable: slot.available };
        } else {
          currentWindow.to = slot.date;
        }
      } else {
        if (currentWindow) { windows.push(currentWindow); currentWindow = null; }
      }
    });
    if (currentWindow) windows.push(currentWindow);
    return windows;
  };

  const runAudit = (currentProjects: any[], currentResources: any[], currentAllocations: any[], year: number, startM: number, endM: number) => {
    const gaps = currentProjects.map(p => {
      const pAllocations = currentAllocations.filter(a => Number(a.projectId) === Number(p.id));
      let dev = 0, test = 0;
      pAllocations.forEach(a => {
        const res = currentResources.find(r => Number(r.id) === Number(a.resourceId));
        const workingDays = getWorkingDays(new Date(a.startDate), new Date(a.endDate));
        const md = Math.round((workingDays * (a.allocationPercentage || 0)) / 100);
        if (a.allocationType === 'test' || res?.role === '测试工程师') test += md; else dev += md;
      });
      return { ...p, devGap: Math.max(0, p.devTotalMd - dev), testGap: Math.max(0, p.testTotalMd - test) };
    }).filter(p => p.devGap >= 1 || p.testGap >= 1);

    const idle = currentResources.map(r => {
      const calendar = generateResourceCalendar(r, currentAllocations, year, startM, endM);
      const availableWindows = getAvailableWindows(calendar);
      const idleMd = calendar.reduce((sum, slot) => sum + (slot.available / 100), 0);
      const capacityMd = calendar.length * (r.capacity / 100);
      const utilization = capacityMd > 0 ? ((capacityMd - idleMd) / capacityMd) * 100 : 0;
      const summary = availableWindows.map(w => `${w.from}~${w.to} (${w.dailyAvailable}%)`).join(', ');
      return { ...r, idleMd: Math.round(idleMd), utilization, scheduleSummary: summary ? `Free Slots: ${summary}` : 'Full' };
    }).filter(r => r.idleMd >= 1);

    return { gaps, idle };
  };

  const findEarliestFitDate = (resourceId: number, currentAllocations: any[], defaultStartDate: string, percentage: number, resources: any[], year: number, startM: number, endM: number) => {
    const res = resources?.find(r => Number(r.id) === Number(resourceId));
    if (!res) return "9999-12-31";
    const calendar = generateResourceCalendar(res, currentAllocations, year, startM, endM);
    const fit = calendar.find(slot => slot.date >= defaultStartDate && slot.available >= percentage);
    return fit ? fit.date : "9999-12-31";
  };

  const calculateTestStartDate = (projectId: number, currentAllocations: any[], defaultStartDate: string) => {
    const projAllocs = currentAllocations.filter(a => Number(a.projectId) === Number(projectId));
    if (projAllocs.length === 0) return defaultStartDate;
    let earliest = new Date('2099-12-31');
    projAllocs.forEach(a => {
      const s = new Date(a.startDate);
      if (s < earliest) earliest = s;
    });
    if (earliest.getFullYear() === 2099) return defaultStartDate;
    let d = new Date(earliest);
    while(!isWorkingDay(d)) d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const handleGenerateSchedule = async (selectedYear: number, startMonth: number, endMonth: number) => {
    const resources = await db.resources.toArray();
    const projects = await db.projects.toArray();
    if (!resources || !projects.length) return;

    const readyProjects = projects.filter(p => p.devTotalMd > 0 || p.testTotalMd > 0);
    if (!readyProjects.length) return;

    setIsScheduling(true);
    setError(null);
    stopRequestedRef.current = false;

    const lastDay = new Date(selectedYear, endMonth, 0).getDate();
    const scheduleMaxDate = `${selectedYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const defaultStart = `${selectedYear}-${String(startMonth).padStart(2, '0')}-01`;

    try {
      console.group('🚀 [Persistent] 方案 A：时间槽位像素级调度启动');
      setCurrentStep(1);
      setScheduleStatus('🚀 像素建模：构建每日资源容量矩阵...');
      await db.allocations.clear();
      let currentAllocations: any[] = [];
      let totalAllocatedThisSession = 0;

      const applySuggestions = async (suggestions: AIMicroAllocation[], phase: 'dev' | 'test', pool: any[]) => {
        let count = 0;
        console.group(`[Hard Logic] Applying ${suggestions.length} AI suggestions for ${phase.toUpperCase()}`);
        for (const sug of suggestions) {
          if (stopRequestedRef.current) break;
          const project = pool.find(p => Number(p.id) === Number(sug.projectId));
          const resource = resources.find(r => Number(r.id) === Number(sug.resourceId));
          if (!project || !resource) {
            console.warn(`[Logic Error] AI suggested non-existent project/resource: ProjID ${sug.projectId}, ResID ${sug.resourceId}`);
            continue;
          }
          const { gaps: cGaps, idle: cIdle } = runAudit(readyProjects, resources, currentAllocations, selectedYear, startMonth, endMonth);
          const pGap = cGaps.find(g => Number(g.id) === Number(project.id));
          const rIdle = cIdle.find(r => Number(r.id) === Number(resource.id));
          if (!pGap || !rIdle) {
            console.log(`[Skipped] ${resource.name} -> ${project.name}: No remaining gap or idle capacity.`);
            continue;
          }
          const targetGap = phase === 'dev' ? pGap.devGap : pGap.testGap;
          const finalMd = Math.min(Math.max(1, Math.round(sug.allocatedMd)), targetGap, rIdle.idleMd);
          console.log(`[Analyzing] ${resource.name} -> ${project.name} | AI Suggested: ${sug.allocatedMd}d | Hard Cap: ${finalMd}d (Gap: ${targetGap}d, Idle: ${rIdle.idleMd}d)`);

          if (finalMd >= 1) {
            const perc = sug.allocationPercentage || 100;
            let start = isValidDateStr(project.startDate) ? project.startDate! : defaultStart;
            if (phase === 'test') start = calculateTestStartDate(project.id!, currentAllocations, start);
            const startDate = findEarliestFitDate(resource.id!, currentAllocations, start, perc, resources, selectedYear, startMonth, endMonth);
            if (startDate > scheduleMaxDate) {
               console.log(`[Reject] Start date ${startDate} exceeds boundary ${scheduleMaxDate}`);
               continue;
            }
            let endDate = calculateEndDate(startDate, finalMd, perc);
            if (endDate > scheduleMaxDate) {
               console.log(`[Truncate] End date ${endDate} was cut to ${scheduleMaxDate}`);
               endDate = scheduleMaxDate;
            }
            const newAlloc = { resourceId: resource.id!, projectId: project.id!, allocationPercentage: perc, startDate, endDate, allocationType: phase };
            currentAllocations.push(newAlloc);
            await db.allocations.add(newAlloc as any);
            count++;
            totalAllocatedThisSession += finalMd;
            console.log(`[Success] ✅ Assigned ${resource.name} to ${project.name} (${phase}) | ${startDate} to ${endDate} | %: ${perc}`);
          } else { console.log(`[Reject] Final calculated MD was < 1`); }
        }
        console.groupEnd();
        return count;
      };

      // PASS 1: Priority Mini-Batches
      setCurrentStep(2);
      const BATCH_SIZE = 3;
      for (let i = 0; i < readyProjects.length; i += BATCH_SIZE) {
        if (stopRequestedRef.current) break;
        const batch = readyProjects.slice(i, i + BATCH_SIZE);
        setScheduleStatus(`🛠️ 阶段一：像素匹配 [${i+1}~${Math.min(i+BATCH_SIZE, readyProjects.length)}]...`);
        const { gaps: dGaps, idle: dIdle } = runAudit(readyProjects, resources, currentAllocations, selectedYear, startMonth, endMonth);
        const bDev = batch.map(p => ({ ...p, gap: dGaps.find(g => g.id === p.id)?.devGap || 0, projectTechLead: p.projectTechLead, detailsProductDevMd: p.detailsProductDevMd })).filter(p => p.gap > 0);
        if (bDev.length && dIdle.some(r => ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role))) {
          const sug = await suggestAllocationsForBatch(bDev as any, dIdle.filter(r => ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role)), 'dev', strategy, false);
          await applySuggestions(sug, 'dev', batch);
        }
        if (stopRequestedRef.current) break;
        const { gaps: tGaps, idle: tIdle } = runAudit(readyProjects, resources, currentAllocations, selectedYear, startMonth, endMonth);
        const bTest = batch.map(p => ({ ...p, gap: tGaps.find(g => g.id === p.id)?.testGap || 0, projectQualityLead: p.projectQualityLead, detailsProductTestMd: p.detailsProductTestMd })).filter(p => p.gap > 0);
        if (bTest.length && tIdle.some(r => r.role === '测试工程师')) {
          const sug = await suggestAllocationsForBatch(bTest as any, tIdle.filter(r => r.role === '测试工程师'), 'test', strategy, false);
          await applySuggestions(sug, 'test', batch);
        }
      }

      // PASS 2: Integrity Audit
      if (!stopRequestedRef.current) {
        setScheduleStatus(`🛡️ 阶段二：完整性审计回滚...`);
        let retryQueue: any[] = [];
        const { gaps: aGaps } = runAudit(readyProjects, resources, currentAllocations, selectedYear, startMonth, endMonth);
        for (const project of readyProjects) {
          if (stopRequestedRef.current) break;
          const g = aGaps.find(pg => Number(pg.id) === Number(project.id));
          if (g && project.devTotalMd > 0 && project.testTotalMd > 0) {
            if ((g.devGap < project.devTotalMd && g.testGap === project.testTotalMd) || (g.devGap === project.devTotalMd && g.testGap < project.testTotalMd)) {
              currentAllocations = currentAllocations.filter(a => Number(a.projectId) !== Number(project.id));
              await db.allocations.where('projectId').equals(project.id!).delete();
              retryQueue.push(project);
            }
          }
        }

        // PASS 3: Convergence Loops
        setCurrentStep(3);
        let loop = 1;
        let progress = true;
        while (progress && loop <= 3) {
          if (stopRequestedRef.current) break;
          setScheduleStatus(`🌾 阶段三：循环收割 (轮次 ${loop}/3)...`);
          const startMD = totalAllocatedThisSession;
          const { gaps: hGaps, idle: hIdle } = runAudit(readyProjects, resources, currentAllocations, selectedYear, startMonth, endMonth);
          if (hGaps.length === 0 || hIdle.length === 0) break;
          const pool = [...retryQueue, ...readyProjects.filter(p => !retryQueue.includes(p))];
          const devG = hGaps.map(g => {
            const p = readyProjects.find(rp => rp.id === g.id);
            return { ...g, gap: g.devGap, projectTechLead: p?.projectTechLead, detailsProductDevMd: p?.detailsProductDevMd };
          }).filter(g => g.gap > 0);
          const devI = hIdle.filter(r => ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role));
          if (devG.length && devI.length) {
            const sug = await suggestAllocationsForBatch(devG as any, devI, 'dev', strategy, true);
            await applySuggestions(sug, 'dev', pool);
          }
          if (stopRequestedRef.current) break;
          const { gaps: hGaps2, idle: hIdle2 } = runAudit(readyProjects, resources, currentAllocations, selectedYear, startMonth, endMonth);
          const testG = hGaps2.map(g => {
            const p = readyProjects.find(rp => rp.id === g.id);
            return { ...g, gap: g.testGap, projectQualityLead: p?.projectQualityLead, detailsProductTestMd: p?.detailsProductTestMd };
          }).filter(g => g.gap > 0);
          const testI = hIdle2.filter(r => r.role === '测试工程师');
          if (testG.length && testI.length) {
            const sug = await suggestAllocationsForBatch(testG as any, testI, 'test', strategy, true);
            await applySuggestions(sug, 'test', pool);
          }
          progress = totalAllocatedThisSession > startMD;
          loop++;
        }
      }

      if (stopRequestedRef.current) {
        setScheduleStatus('🛑 排期已手动停止');
        setCurrentStep(0);
      } else {
        setCurrentStep(4);
        setScheduleStatus('✨ 方案 A 像素级调度完成！');
      }
      console.groupEnd();
      setTimeout(() => { if (!stopRequestedRef.current) { setScheduleStatus(''); setCurrentStep(0); } }, 5000);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setCurrentStep(0);
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <SchedulingContext.Provider value={{
      isScheduling, scheduleStatus, currentStep, error, strategy, setStrategy, handleGenerateSchedule, stopScheduling, clearError: () => setError(null)
    }}>
      {children}
    </SchedulingContext.Provider>
  );
};
