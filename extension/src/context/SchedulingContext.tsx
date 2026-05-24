import { createContext, useContext, useState, type ReactNode, useRef } from 'react';
import { db } from '../db';
import { suggestAllocationsForBatch, type AIMicroAllocation, type SchedulingStrategy } from '../services/ai';
import { calculateEndDate, isWorkingDay, isValidDateStr, getWorkingDays, getWeekNumber, getISOWeekYear } from '../utils/dateUtils';
import { getStorageItem } from '../utils/storage';

interface SchedulingContextType {
  isScheduling: boolean;
  scheduleStatus: string;
  currentStep: number;
  error: string | null;
  strategy: SchedulingStrategy;
  setStrategy: (s: SchedulingStrategy) => void;
  handleGenerateSchedule: (selectedYear: number, startMonth: number, endMonth: number, shouldClear?: boolean) => Promise<void>;
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
  weekYear: number;
  weekNumber: number;
  assignedNonOpProjects: Set<number>;
}

export const SchedulingProvider = ({ children }: { children: ReactNode }) => {
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<SchedulingStrategy>('balanced');
  
  const stopRequestedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopScheduling = () => {
    if (isScheduling) {
      stopRequestedRef.current = true;
      abortControllerRef.current?.abort();
      setScheduleStatus('🛑 正在停止排期...');
    }
  };

  const getAvailableWindows = (calendar: DailySlot[]) => {
    const windows: { from: string, to: string, dailyAvailable: number, assigned: number[], assignedStr: string }[] = [];
    if (calendar.length === 0) return windows;
    let currentWindow: any = null;
    calendar.forEach(slot => {
      if (slot.available >= 1) {
        const assignedArray = Array.from(slot.assignedNonOpProjects);
        const assignedStr = assignedArray.join(',');
        
        if (!currentWindow || currentWindow.dailyAvailable !== slot.available || currentWindow.assignedStr !== assignedStr) {
          if (currentWindow) windows.push(currentWindow);
          currentWindow = { from: slot.date, to: slot.date, dailyAvailable: slot.available, assigned: assignedArray, assignedStr };
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

  const handleGenerateSchedule = async (selectedYear: number, startMonth: number, endMonth: number, shouldClear: boolean = true) => {
    const resources = await db.resources.toArray();
    const projects = await db.projects.toArray();
    if (!resources || !projects.length) return;

    const readyProjects = projects.filter(p => p.devTotalMd > 0 || p.testTotalMd > 0);
    if (!readyProjects.length) return;

    setIsScheduling(true);
    setError(null);
    stopRequestedRef.current = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;

    const lastDay = new Date(selectedYear, endMonth, 0).getDate();
    const scheduleMaxDate = `${selectedYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const defaultStart = `${selectedYear}-${String(startMonth).padStart(2, '0')}-01`;

    const rangeStart = new Date(selectedYear, startMonth - 1, 1);
    const rangeEnd = new Date(selectedYear, endMonth, 0);
    const workingDaySet = new Set<string>();
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      if (isWorkingDay(d)) {
        workingDaySet.add(d.toISOString().split('T')[0]);
      }
    }

    const checkStop = () => {
      if (stopRequestedRef.current || signal.aborted) throw new Error('MANUAL_STOP');
    };

    try {
      console.group('🚀 [Persistent] 方案 A：时间槽位像素级调度启动');
      setCurrentStep(1);
      setScheduleStatus('🚀 像素建模：构建每日资源容量矩阵...');
      if (shouldClear) {
        await db.allocations.clear();
      }
      checkStop();

      let currentAllocations: any[] = [];
      if (!shouldClear) {
        currentAllocations = await db.allocations.toArray();
      }
      
      let totalAllocatedThisSession = 0;
      const sharedMatrix = new Map<number, DailySlot[]>();

      const getResourceCalendar = (res: any, currentAllocs: any[]) => {
        if (sharedMatrix.has(res.id)) return sharedMatrix.get(res.id)!;
        const calendar: DailySlot[] = [];
        let current = new Date(rangeStart);
        while (current <= rangeEnd) {
          const dateStr = current.toISOString().split('T')[0];
          const weekYear = getISOWeekYear(current);
          const weekNumber = getWeekNumber(current);
          if (workingDaySet.has(dateStr)) {
            let used = 0;
            currentAllocs.filter(a => Number(a.resourceId) === Number(res.id)).forEach(a => {
              if (dateStr >= a.startDate && dateStr <= a.endDate) {
                used += (a.allocationPercentage || 0);
              }
            });
            calendar.push({
              date: dateStr,
              totalCapacity: res.capacity,
              usedCapacity: used,
              available: Math.max(0, res.capacity - used),
              weekYear,
              weekNumber,
              assignedNonOpProjects: new Set<number>()
            });
          }
          current.setDate(current.getDate() + 1);
        }
        
        // Populate assignedNonOpProjects for the whole week
        currentAllocs.filter(a => Number(a.resourceId) === Number(res.id)).forEach(a => {
          if (a.projectId > 0) {
            calendar.forEach(slot => {
              const aStart = new Date(a.startDate);
              const aEnd = new Date(a.endDate);
              const sDate = new Date(aStart > new Date(rangeStart) ? aStart : rangeStart);
              const eDate = new Date(aEnd < new Date(rangeEnd) ? aEnd : rangeEnd);
              let curr = new Date(sDate);
              while (curr <= eDate) {
                if (getISOWeekYear(curr) === slot.weekYear && getWeekNumber(curr) === slot.weekNumber) {
                  slot.assignedNonOpProjects.add(a.projectId);
                  break;
                }
                curr.setDate(curr.getDate() + 1);
              }
            });
          }
        });
        
        sharedMatrix.set(res.id, calendar);
        return calendar;
      };

      const updateResourceCalendar = (resId: number, newAlloc: any) => {
        const calendar = sharedMatrix.get(resId);
        if (calendar) {
          calendar.forEach(slot => {
            if (slot.date >= newAlloc.startDate && slot.date <= newAlloc.endDate) {
               slot.usedCapacity += newAlloc.allocationPercentage;
               const res = resources.find(r => r.id === resId);
               slot.available = Math.max(0, (res?.capacity || 100) - slot.usedCapacity);
            }
            if (newAlloc.projectId > 0) {
              const aStart = new Date(newAlloc.startDate);
              const aEnd = new Date(newAlloc.endDate);
              let curr = new Date(aStart);
              while (curr <= aEnd) {
                if (getISOWeekYear(curr) === slot.weekYear && getWeekNumber(curr) === slot.weekNumber) {
                  slot.assignedNonOpProjects.add(newAlloc.projectId);
                  break;
                }
                curr.setDate(curr.getDate() + 1);
              }
            }
          });
        }
      };

      const runAudit = (currentProjs: any[], currentRes: any[], currentAllocs: any[]) => {
        const gaps = currentProjs.map(p => {
          const pAllocations = currentAllocs.filter(a => Number(a.projectId) === Number(p.id));
          let dev = 0, test = 0;
          pAllocations.forEach(a => {
            const res = currentRes.find(r => Number(r.id) === Number(a.resourceId));
            const workingDays = getWorkingDays(new Date(a.startDate), new Date(a.endDate), workingDaySet);
            const md = (workingDays * (a.allocationPercentage || 0)) / 100;
            if (a.allocationType === 'test' || res?.role === '测试工程师') test += md; else dev += md;
          });
          const devTotal = p.devTotalMd || 0;
          const testTotal = p.testTotalMd || 0;
          let effectiveDevTotal = devTotal;
          let effectiveTestTotal = testTotal;
          
          if ((p.testLoggedMd || 0) > 0) {
            effectiveDevTotal = Math.max(0, devTotal - (p.devLoggedMd || 0));
            effectiveTestTotal = Math.max(0, testTotal - (p.testLoggedMd || 0));
          } else {
            const logged = p.totalLoggedMd || 0;
            effectiveDevTotal = Math.max(0, devTotal - logged);
            const remainingLogged = Math.max(0, logged - devTotal);
            effectiveTestTotal = Math.max(0, testTotal - remainingLogged);
          }
          return { ...p, devGap: Math.max(0, effectiveDevTotal - dev), testGap: Math.max(0, effectiveTestTotal - test) };
        }).filter(p => Math.ceil(p.devGap) >= 1 || Math.ceil(p.testGap) >= 1);

        const idle = currentRes.map(r => {
          const calendar = getResourceCalendar(r, currentAllocs);
          const availableWindows = getAvailableWindows(calendar);
          const idleMd = calendar.reduce((sum, slot) => sum + (slot.available / 100), 0);
          const capacityMd = calendar.length * (r.capacity / 100);
          const utilization = capacityMd > 0 ? ((capacityMd - idleMd) / capacityMd) * 100 : 0;
          const summary = availableWindows.map(w => {
            const exclusive = w.assigned.length > 0 ? ` [Only Proj ${w.assigned.join(',')}]` : '';
            return `${w.from}~${w.to} (${w.dailyAvailable}%)${exclusive}`;
          }).join(', ');
          
          let finalSummary = summary ? `Free Slots: ${summary}` : 'Full';
          if (finalSummary.length > 200 && availableWindows.length > 3) {
             finalSummary = `Free Slots: ${availableWindows.slice(-3).map(w => {
               const exclusive = w.assigned.length > 0 ? ` [Only Proj ${w.assigned.join(',')}]` : '';
               return `${w.from}~${w.to} (${w.dailyAvailable}%)${exclusive}`;
             }).join(', ')}`;
          }
          
          return { ...r, idleMd, utilization, scheduleSummary: finalSummary };
        }).filter(r => Math.ceil(r.idleMd) >= 1);

        return { gaps, idle };
      };

      const findEarliestFitDate = (resourceId: number, currentAllocs: any[], defaultStartDate: string, percentage: number, resources: any[], projectId: number) => {
        const res = resources?.find(r => Number(r.id) === Number(resourceId));
        if (!res) return "9999-12-31";
        const calendar = getResourceCalendar(res, currentAllocs);
        const fit = calendar.find(slot => {
          if (slot.date < defaultStartDate) return false;
          if (slot.available < percentage) return false;
          if (projectId > 0) {
            if (slot.assignedNonOpProjects.size > 0 && !slot.assignedNonOpProjects.has(projectId)) {
              return false;
            }
          }
          return true;
        });
        return fit ? fit.date : "9999-12-31";
      };

      const calculateTestStartDate = (projectId: number, currentAllocs: any[], defaultStartDate: string) => {
        const projAllocs = currentAllocs.filter(a => Number(a.projectId) === Number(projectId));
        if (projAllocs.length === 0) return defaultStartDate;
        let earliest = new Date('2099-12-31');
        let latest = new Date('1970-01-01');
        let hasDev = false;
        projAllocs.forEach(a => {
          if (a.allocationType !== 'test') {
            hasDev = true;
            const s = new Date(a.startDate);
            const e = new Date(a.endDate);
            if (s < earliest) earliest = s;
            if (e > latest) latest = e;
          }
        });
        if (!hasDev) return defaultStartDate;
        
        const midpointTime = earliest.getTime() + (latest.getTime() - earliest.getTime()) / 2;
        let d = new Date(midpointTime);
        while(d > earliest && !workingDaySet.has(d.toISOString().split('T')[0])) {
           d.setDate(d.getDate() - 1);
        }
        return d.toISOString().split('T')[0];
      };

      const applySuggestions = async (suggestions: AIMicroAllocation[], phase: 'dev' | 'test', pool: any[]) => {
        let count = 0;
        console.group(`[Hard Logic] Applying ${suggestions.length} AI suggestions for ${phase.toUpperCase()}`);
        const { gaps: cGaps, idle: cIdle } = runAudit(readyProjects, resources, currentAllocations);
        
        for (const sug of suggestions) {
          checkStop();
          const project = pool.find(p => Number(p.id) === Number(sug.projectId));
          const resource = resources.find(r => Number(r.id) === Number(sug.resourceId));
          if (!project || !resource) continue;

          const pGap = cGaps.find(g => Number(g.id) === Number(project.id));
          const rIdle = cIdle.find(r => Number(r.id) === Number(resource.id));
          if (!pGap || !rIdle) continue;

          const targetGap = phase === 'dev' ? pGap.devGap : pGap.testGap;
          const exactFinalMd = Math.min(sug.allocatedMd, targetGap, rIdle.idleMd);
          const finalMd = Math.ceil(exactFinalMd);

          if (finalMd >= 1) {
            const perc = sug.allocationPercentage || 100;
            let start = isValidDateStr(project.startDate) ? project.startDate! : defaultStart;
            if (phase === 'test') start = calculateTestStartDate(project.id!, currentAllocations, start);
            const startDate = findEarliestFitDate(resource.id!, currentAllocations, start, perc, resources, project.id!);
            if (startDate > scheduleMaxDate) continue;
            
            let endDate = calculateEndDate(startDate, exactFinalMd, perc);
            
            // To prevent a task from crossing week boundary into an illegally occupied week, 
            // we should ideally truncate it, but calculateEndDate handles working days.
            // For now, if we assign it, the updateResourceCalendar will mark the occupied weeks.
            // If it crosses into a week occupied by ANOTHER project, we need to stop it.
            // Let's truncate endDate if it hits a week occupied by another project.
            let curr = new Date(startDate);
            const eDate = new Date(endDate);
            let truncatedDate = endDate;
            const resCalendar = getResourceCalendar(resource, currentAllocations);
            
            while (curr <= eDate) {
              const dStr = curr.toISOString().split('T')[0];
              const slot = resCalendar.find(s => s.date === dStr);
              if (slot && slot.assignedNonOpProjects.size > 0 && !slot.assignedNonOpProjects.has(project.id!)) {
                // Hitting a boundary of another project! Truncate right before this.
                let prev = new Date(curr);
                prev.setDate(prev.getDate() - 1);
                truncatedDate = prev.toISOString().split('T')[0];
                break;
              }
              curr.setDate(curr.getDate() + 1);
            }
            
            endDate = truncatedDate;
            if (endDate < startDate) continue; // Cannot even schedule 1 day
            
            // Recalculate exactFinalMd based on potentially truncated endDate
            const actualWorkingDays = getWorkingDays(new Date(startDate), new Date(endDate), workingDaySet);
            const actualMd = Math.min((actualWorkingDays * perc) / 100, exactFinalMd);
            if (actualMd < 1) continue;

            if (endDate > scheduleMaxDate) endDate = scheduleMaxDate;
            const allocToSave = { 
              resourceId: resource.id!, 
              projectId: project.id!, 
              allocationPercentage: perc, 
              startDate, 
              endDate, 
              allocationType: phase 
            };
            currentAllocations.push(allocToSave);
            await db.allocations.add({
              ...allocToSave,
              // Round before saving to DB
              allocationPercentage: Math.round(perc)
            } as any);
            count++;
            totalAllocatedThisSession += actualMd;
            
            updateResourceCalendar(resource.id!, allocToSave);
            if (phase === 'dev') pGap.devGap -= actualMd; else pGap.testGap -= actualMd;
            rIdle.idleMd -= actualMd;
          }
        }
        console.groupEnd();
        return count;
      };

      // PASS 0: Deterministic Ops Scheduling (Product Operations)
      setScheduleStatus(`⚙️ 阶段零：按月分配产品运维基础人天...`);
      const operations = await db.productOperations.toArray();
      if (operations.length > 0) {
        // Identify Leads (Good resources) to protect
        const leads = new Set<string>();
        readyProjects.forEach(p => {
          if (p.projectTechLead) leads.add(p.projectTechLead);
          if (p.projectQualityLead) leads.add(p.projectQualityLead);
        });

        for (const op of operations) {
          checkStop();
          
          // Find candidate resources matching the product name
          const candidates = resources.filter(r => r.skills?.includes(op.productName));
          
          // Sort candidates: Non-leads first
          candidates.sort((a, b) => {
            const aIsLead = leads.has(a.name) ? 1 : 0;
            const bIsLead = leads.has(b.name) ? 1 : 0;
            return aIsLead - bIsLead;
          });

          for (let m = startMonth; m <= endMonth; m++) {
            const targetDevMd = op.monthlyDevMd;
            const targetTestMd = op.monthlyTestMd;
            if (targetDevMd <= 0 && targetTestMd <= 0) continue;

            const monthStart = `${selectedYear}-${String(m).padStart(2, '0')}-01`;
            const monthLastDay = new Date(selectedYear, m, 0).getDate();
            const monthEnd = `${selectedYear}-${String(m).padStart(2, '0')}-${String(monthLastDay).padStart(2, '0')}`;

            const allocateOpForMonth = async (targetMd: number, phase: 'dev' | 'test') => {
              let remainingMd = targetMd;
              const phaseCandidates = candidates.filter(r => {
                if (phase === 'dev') return ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role);
                return r.role === '测试工程师';
              });

              for (const res of phaseCandidates) {
                if (remainingMd <= 0) break;
                const { idle } = runAudit([], resources, currentAllocations);
                const rIdle = idle.find(r => r.id === res.id);
                if (!rIdle || rIdle.idleMd < 1) continue;

                // Check how many days the resource has available in this specific month
                const resCalendar = getResourceCalendar(res, currentAllocations);
                const monthSlots = resCalendar.filter(s => s.date >= monthStart && s.date <= monthEnd && s.available >= 100);
                if (monthSlots.length === 0) continue;

                const allocMd = Math.min(remainingMd, monthSlots.length);
                if (allocMd < 1) continue;

                const perc = 100;
                // Start from the first available slot in this month
                const startDate = monthSlots[0].date;
                let endDate = calculateEndDate(startDate, allocMd, perc);
                
                if (endDate > monthEnd) {
                  endDate = monthEnd;
                }

                // Recalculate actual MD allocated in this window in case it was capped
                const actualWorkingDays = getWorkingDays(new Date(startDate), new Date(endDate), workingDaySet);
                const actualAllocMd = Math.min((actualWorkingDays * perc) / 100, remainingMd);

                if (actualAllocMd >= 1) {
                  const allocToSave = { 
                    resourceId: res.id!, 
                    projectId: -(op.id! + 1000000), // Virtual project ID for Ops
                    allocationPercentage: perc, 
                    startDate, 
                    endDate, 
                    allocationType: phase 
                  };
                  currentAllocations.push(allocToSave);
                  await db.allocations.add({
                    ...allocToSave,
                    allocationPercentage: Math.round(perc)
                  } as any);
                  
                  updateResourceCalendar(res.id!, allocToSave);
                  remainingMd -= actualAllocMd;
                }
              }
            };

            if (targetDevMd > 0) await allocateOpForMonth(targetDevMd, 'dev');
            if (targetTestMd > 0) await allocateOpForMonth(targetTestMd, 'test');
          }
        }
      }

      // PASS 1: Priority Mini-Batches
      setCurrentStep(2);
      
      const savedBatchSize = await getStorageItem('aiBatchSize');
      const BATCH_SIZE = savedBatchSize ? Number(savedBatchSize) : 3;
      
      for (let i = 0; i < readyProjects.length; i += BATCH_SIZE) {
        checkStop();
        const batch = readyProjects.slice(i, i + BATCH_SIZE);
        setScheduleStatus(`🛠️ 阶段一：像素匹配 [${i+1}~${Math.min(i+BATCH_SIZE, readyProjects.length)}]...`);
        const { gaps: dGaps, idle: dIdle } = runAudit(readyProjects, resources, currentAllocations);
        const bDev = batch.map(p => ({ ...p, gap: Math.ceil(dGaps.find(g => g.id === p.id)?.devGap || 0), projectTechLead: p.projectTechLead, detailsProductDevMd: p.detailsProductDevMd })).filter(p => p.gap >= 1);
        if (bDev.length && dIdle.some(r => ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role))) {
          const sug = await suggestAllocationsForBatch(bDev as any, dIdle.filter(r => ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role)), 'dev', strategy, false, signal);
          checkStop();
          await applySuggestions(sug, 'dev', batch);
        }
        checkStop();
        const { gaps: tGaps, idle: tIdle } = runAudit(readyProjects, resources, currentAllocations);
        const bTest = batch.map(p => ({ ...p, gap: Math.ceil(tGaps.find(g => g.id === p.id)?.testGap || 0), projectQualityLead: p.projectQualityLead, detailsProductTestMd: p.detailsProductTestMd })).filter(p => p.gap >= 1);
        if (bTest.length && tIdle.some(r => r.role === '测试工程师')) {
          const sug = await suggestAllocationsForBatch(bTest as any, tIdle.filter(r => r.role === '测试工程师'), 'test', strategy, false, signal);
          checkStop();
          await applySuggestions(sug, 'test', batch);
        }
      }

      // PASS 2: Integrity Audit
      checkStop();
      setScheduleStatus(`🛡️ 阶段二：完整性审计回滚...`);
      let retryQueue: any[] = [];
      const { gaps: aGaps } = runAudit(readyProjects, resources, currentAllocations);
      for (const project of readyProjects) {
        checkStop();
        const g = aGaps.find(pg => Number(pg.id) === Number(project.id));
        if (g && project.devTotalMd > 0 && project.testTotalMd > 0) {
          const devAllocated = project.devTotalMd - g.devGap;
          const isDevSevereUnderAlloc = (devAllocated < (project.devTotalMd * 0.5)) && g.testGap === project.testTotalMd;
          if (
            (g.devGap < project.devTotalMd && g.testGap === project.testTotalMd) || 
            (g.devGap === project.devTotalMd && g.testGap < project.testTotalMd) ||
            isDevSevereUnderAlloc
          ) {
            currentAllocations = currentAllocations.filter(a => Number(a.projectId) !== Number(project.id));
            await db.allocations.where('projectId').equals(project.id!).delete();
            retryQueue.push(project);
            sharedMatrix.clear();
          }
        }
      }

      // PASS 3: Convergence Loops
      setCurrentStep(3);
      let loop = 1;
      let progress = true;
      while (progress && loop <= 3) {
        checkStop();
        setScheduleStatus(`🌾 阶段三：循环收割 (轮次 ${loop}/3)...`);
        const startMD = totalAllocatedThisSession;
        const { gaps: hGaps, idle: hIdle } = runAudit(readyProjects, resources, currentAllocations);
        if (hGaps.length === 0 || hIdle.length === 0) break;
        const pool = [...retryQueue, ...readyProjects.filter(p => !retryQueue.includes(p))];
        const devG = hGaps.map(g => {
          const p = readyProjects.find(rp => rp.id === g.id);
          return { ...g, gap: Math.ceil(g.devGap), projectTechLead: p?.projectTechLead, detailsProductDevMd: p?.detailsProductDevMd };
        }).filter(g => g.gap >= 1);
        const devI = hIdle.filter(r => ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role));
        if (devG.length && devI.length) {
          const sug = await suggestAllocationsForBatch(devG as any, devI, 'dev', strategy, true, signal);
          checkStop();
          await applySuggestions(sug, 'dev', pool);
        }
        checkStop();
        const { gaps: hGaps2, idle: hIdle2 } = runAudit(readyProjects, resources, currentAllocations);
        const testG = hGaps2.map(g => {
          const p = readyProjects.find(rp => rp.id === g.id);
          return { ...g, gap: Math.ceil(g.testGap), projectQualityLead: p?.projectQualityLead, detailsProductTestMd: p?.detailsProductTestMd };
        }).filter(g => g.gap >= 1);
        const testI = hIdle2.filter(r => r.role === '测试工程师');
        if (testG.length && testI.length) {
          const sug = await suggestAllocationsForBatch(testG as any, testI, 'test', strategy, true, signal);
          checkStop();
          await applySuggestions(sug, 'test', pool);
        }
        progress = totalAllocatedThisSession > startMD;
        loop++;
      }

      setCurrentStep(4);
      setScheduleStatus('✨ 方案 A 像素级调度完成！');
      console.groupEnd();
      setTimeout(() => { if (!stopRequestedRef.current) { setScheduleStatus(''); setCurrentStep(0); } }, 5000);
    } catch (err: any) {
      if (err.message === 'MANUAL_STOP' || err.name === 'AbortError') {
        setScheduleStatus('🛑 排期已手动停止');
        setCurrentStep(0);
      } else {
        console.error(err);
        setError(err.message);
        setCurrentStep(0);
      }
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
