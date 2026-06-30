import { createContext, useContext, useState, type ReactNode, useRef } from 'react';
import { db } from '../db';
import { suggestAllocationsForBatch, type AIMicroAllocation } from '../services/ai';
import { calculateEndDate, isValidDateStr, getWorkingDays, formatLocalDate, buildWorkingDaySet } from '../utils/dateUtils';
import { computeProjectGaps } from '../utils/audit';
import { getStorageItem } from '../utils/storage';

interface SchedulingContextType {
  isScheduling: boolean;
  scheduleStatus: string;
  currentStep: number;
  error: string | null;
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
}

export const SchedulingProvider = ({ children }: { children: ReactNode }) => {
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
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
    const windows: { from: string, to: string, dailyAvailable: number }[] = [];
    if (calendar.length === 0) return windows;
    let currentWindow: any = null;
    calendar.forEach(slot => {
      // One task per day: a day is "available" only if fully free
      if (slot.available >= slot.totalCapacity && slot.totalCapacity > 0) {
        if (!currentWindow) {
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
    // Ensure the calendar (holidays / special workdays) reflects the user's saved
    // configuration even if the Holidays page was never opened this session.
    const workingDaySet = await buildWorkingDaySet(rangeStart, rangeEnd);
    
    // Map to track why projects were rejected or couldn't be scheduled
    const rejectionReasons = new Map<number, string>();

    const checkStop = () => {
      if (stopRequestedRef.current || signal.aborted) throw new Error('MANUAL_STOP');
    };

    try {
      console.group('🚀 [Persistent] 方案 A：时间槽位像素级调度启动');
      setCurrentStep(1);
      setScheduleStatus('🚀 像素建模：构建每日资源容量矩阵...');
      if (shouldClear) {
        const allIds = await db.allocations.toArray();
        const unlockedIds = allIds.filter(a => !a.isLocked).map(a => a.id!);
        await db.allocations.bulkDelete(unlockedIds);
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
        const resAllocs = currentAllocs.filter(a => Number(a.resourceId) === Number(res.id));
        const leaveDays: Set<string> = new Set(Array.isArray(res.unavailableDates) ? res.unavailableDates : []);
        while (current <= rangeEnd) {
          const dateStr = formatLocalDate(current);
          if (workingDaySet.has(dateStr)) {
            // Personal leave (请假): the resource has zero capacity that day, so it
            // can neither be allocated to nor counted as idle.
            const onLeave = leaveDays.has(dateStr);
            const dayCapacity = onLeave ? 0 : res.capacity;
            let used = 0;
            resAllocs.forEach(a => {
              if (dateStr >= a.startDate && dateStr <= a.endDate) {
                used += (a.allocationPercentage || 0);
              }
            });
            calendar.push({
              date: dateStr,
              totalCapacity: dayCapacity,
              usedCapacity: used,
              available: Math.max(0, dayCapacity - used),
            });
          }
          current.setDate(current.getDate() + 1);
        }
        
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
          });
        }
      };

      const runAudit = (currentProjs: any[], currentRes: any[], currentAllocs: any[]) => {
        const gaps = computeProjectGaps(currentProjs, currentRes, currentAllocs, workingDaySet)
          .filter(p => Math.ceil(p.devGap) >= 1 || Math.ceil(p.testGap) >= 1);

        const idle = currentRes.map(r => {
          const calendar = getResourceCalendar(r, currentAllocs);
          const availableWindows = getAvailableWindows(calendar);
          // One task per day: count fully free days as idle
          const dailyCap = r.capacity || 100;
          const idleMd = calendar.filter(slot => slot.available >= dailyCap).length;
          const totalWorkingDays = calendar.filter(slot => slot.totalCapacity > 0).length;
          const utilization = totalWorkingDays > 0 ? ((totalWorkingDays - idleMd) / totalWorkingDays) * 100 : 0;
          const summary = availableWindows.map(w => {
            return `${w.from}~${w.to}`;
          }).join(', ');
          
          let finalSummary = summary ? `Free Days: ${summary}` : 'Full';
          if (finalSummary.length > 200 && availableWindows.length > 3) {
             finalSummary = `Free Days: ${availableWindows.slice(-3).map(w => {
               return `${w.from}~${w.to}`;
             }).join(', ')}`;
          }
          
          return { ...r, idleMd, utilization, scheduleSummary: finalSummary };
        }).filter(r => r.idleMd >= 1);

        return { gaps, idle };
      };

      const findEarliestFitDate = (resourceId: number, currentAllocs: any[], defaultStartDate: string, _percentage: number, resources: any[], _projectId: number, _strategy?: string) => {
        const res = resources?.find(r => Number(r.id) === Number(resourceId));
        if (!res) return "9999-12-31";
        const calendar = getResourceCalendar(res, currentAllocs);
        const dailyCap = res.capacity || 100;
        // One task per day: require a fully free day
        const fit = calendar.find(slot => {
          if (slot.date < defaultStartDate) return false;
          return slot.available >= dailyCap;
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
        while(d > earliest && !workingDaySet.has(formatLocalDate(d))) {
           d.setDate(d.getDate() - 1);
        }
        return formatLocalDate(d);
      };

      const computeAllowedResourceIds = (p: any, isLatePass: boolean) => {
        let allowed = resources.map(r => Number(r.id));
        const teamMode = p.teamSchedulingMode || 'all-in';
        if (teamMode === 'team-first') {
          if (p.scrumTeamId) allowed = resources.filter(r => Number(r.scrumTeamId) === Number(p.scrumTeamId)).map(r => Number(r.id));
        } else if (teamMode === 'cross-team') {
          if (p.scrumTeamId && !isLatePass) {
            allowed = resources.filter(r => Number(r.scrumTeamId) === Number(p.scrumTeamId)).map(r => Number(r.id));
          }
        }
        return allowed;
      };

      const applySuggestions = async (suggestions: AIMicroAllocation[], phase: 'dev' | 'test', pool: any[], isLatePass: boolean) => {
        let count = 0;
        console.group(`[Hard Logic] Applying ${suggestions.length} AI suggestions for ${phase.toUpperCase()}`);
        const { gaps: cGaps, idle: cIdle } = runAudit(readyProjects, resources, currentAllocations);
        const focusedAssigned = new Set<number>();
        
        for (const sug of suggestions) {
          checkStop();
          const project = pool.find(p => Number(p.id) === Number(sug.projectId));
          const resource = resources.find(r => Number(r.id) === Number(sug.resourceId));
          if (!project || !resource) continue;

          if (project.schedulingStrategy === 'focused') {
            const hasAlloc = currentAllocations.some(a => Number(a.projectId) === Number(project.id) && a.allocationType === phase);
            if (focusedAssigned.has(project.id!) || hasAlloc) {
              console.warn(`[Hard Logic] Skipped secondary suggestion for focused project ${project.id}`);
              continue;
            }
            focusedAssigned.add(project.id!);
          }

          const pGap = cGaps.find(g => Number(g.id) === Number(project.id));
          const rIdle = cIdle.find(r => Number(r.id) === Number(resource.id));
          if (!pGap || !rIdle) continue;

          // Enforce Scrum Team Constraint in JS hard logic
          const allowedIds = computeAllowedResourceIds(project, isLatePass);
          if (!allowedIds.includes(Number(resource.id))) {
            console.warn(`[Hard Logic] Blocked AI suggestion violating Scrum Team constraints: Project ${project.id} -> Resource ${resource.id}`);
            rejectionReasons.set(project.id!, 'scrum_constraint_violated');
            continue;
          }

          const targetGap = phase === 'dev' ? pGap.devGap : pGap.testGap;
          const exactFinalMd = Math.min(sug.allocatedMd, targetGap, rIdle.idleMd);
          const finalMd = Math.ceil(exactFinalMd);

          if (finalMd >= 1) {
            // One task per day: always allocate at full daily capacity (100%)
            const perc = resource.capacity || 100;
            let start = isValidDateStr(project.startDate) ? project.startDate! : defaultStart;
            if (phase === 'test') start = calculateTestStartDate(project.id!, currentAllocations, start);
            const startDate = findEarliestFitDate(resource.id!, currentAllocations, start, perc, resources, project.id!, project.schedulingStrategy);
            if (startDate > scheduleMaxDate) {
              rejectionReasons.set(project.id!, 'date_window_exceeded');
              continue;
            }
            
            // Full-day allocation: endDate = startDate + finalMd working days
            let endDate = calculateEndDate(startDate, finalMd, perc);
            
            // Clip to the scheduling horizon
            if (endDate > scheduleMaxDate) endDate = scheduleMaxDate;
            if (endDate < startDate) {
              rejectionReasons.set(project.id!, 'date_window_exceeded');
              continue;
            }
            
            // Recalculate actual MD based on potentially truncated endDate
            const actualWorkingDays = getWorkingDays(new Date(startDate), new Date(endDate), workingDaySet);
            const actualMd = Math.min(actualWorkingDays, finalMd);
            if (actualMd < 1) continue;

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
                if (remainingMd < 0.5) break;

                const dailyCap = res.capacity || 100;
                const mdPerDay = dailyCap / 100;
                if (mdPerDay <= 0) continue;

                const resCalendar = getResourceCalendar(res, currentAllocations);
                // One task per day: ops always occupies full working days.
                const monthSlots = resCalendar
                  .filter(s => s.date >= monthStart && s.date <= monthEnd && s.available >= dailyCap)
                  .sort((a, b) => a.date.localeCompare(b.date));
                if (monthSlots.length === 0) continue;

                const daysNeeded = Math.min(Math.ceil(remainingMd / mdPerDay), monthSlots.length);
                if (daysNeeded < 1) continue;

                // Spread days evenly across the month to avoid clustering
                const step = monthSlots.length / daysNeeded;
                for (let i = 0; i < daysNeeded; i++) {
                  if (remainingMd < 0.5) break;
                  const slot = monthSlots[Math.floor(i * step)];
                  const allocToSave = {
                    resourceId: res.id!,
                    projectId: -(op.id! + 1000000),
                    allocationPercentage: dailyCap,
                    startDate: slot.date,
                    endDate: slot.date,
                    allocationType: phase
                  };
                  currentAllocations.push(allocToSave);
                  await db.allocations.add({
                    ...allocToSave,
                    allocationPercentage: Math.round(dailyCap)
                  } as any);
                  updateResourceCalendar(res.id!, allocToSave);
                  remainingMd -= mdPerDay;
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
        const bDev = batch.map(p => ({ 
          ...p, 
          gap: Math.ceil(dGaps.find(g => g.id === p.id)?.devGap || 0), 
          projectTechLead: p.projectTechLead, 
          detailsProductDevMd: p.detailsProductDevMd, 
          schedulingStrategy: p.schedulingStrategy,
          allowedResourceIds: computeAllowedResourceIds(p, false)
        })).filter(p => p.gap >= 1);
        if (bDev.length && dIdle.some(r => ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role))) {
          const batchAllowedIds = new Set(bDev.flatMap(p => p.allowedResourceIds));
          const filteredIdle = dIdle.filter(r => ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role) && batchAllowedIds.has(Number(r.id)));
          if (filteredIdle.length > 0) {
            const sug = await suggestAllocationsForBatch(bDev as any, filteredIdle, 'dev', false, signal);
            checkStop();
            await applySuggestions(sug, 'dev', batch, false);
          }
        }
        checkStop();
        const { gaps: tGaps, idle: tIdle } = runAudit(readyProjects, resources, currentAllocations);
        const bTest = batch.map(p => ({ 
          ...p, 
          gap: Math.ceil(tGaps.find(g => g.id === p.id)?.testGap || 0), 
          projectQualityLead: p.projectQualityLead, 
          detailsProductTestMd: p.detailsProductTestMd, 
          schedulingStrategy: p.schedulingStrategy,
          allowedResourceIds: computeAllowedResourceIds(p, false)
        })).filter(p => p.gap >= 1);
        if (bTest.length && tIdle.some(r => r.role === '测试工程师')) {
          const batchAllowedIds = new Set(bTest.flatMap(p => p.allowedResourceIds));
          const filteredIdle = tIdle.filter(r => r.role === '测试工程师' && batchAllowedIds.has(Number(r.id)));
          if (filteredIdle.length > 0) {
            const sug = await suggestAllocationsForBatch(bTest as any, filteredIdle, 'test', false, signal);
            checkStop();
            await applySuggestions(sug, 'test', batch, false);
          }
        }
      }

      // PASS 2: Integrity Audit
      checkStop();
      setScheduleStatus(`🛡️ 阶段二：完整性审计回滚...`);
      let retryQueue: any[] = [];
      let didRollback = false;
      const { gaps: aGaps } = runAudit(readyProjects, resources, currentAllocations);
      for (const project of readyProjects) {
        checkStop();
        // Skip rollback for projects whose endDate extends beyond the schedule window —
        // partial coverage is expected and acceptable for these (#30.3).
        if (project.endDate && project.endDate > scheduleMaxDate) {
          rejectionReasons.set(project.id!, 'partial_window');
          continue;
        }
        const g = aGaps.find(pg => Number(pg.id) === Number(project.id));
        if (g && project.devTotalMd > 0 && project.testTotalMd > 0) {
          const devAllocated = project.devTotalMd - g.devGap;
          const isDevSevereUnderAlloc = (devAllocated < (project.devTotalMd * 0.5)) && g.testGap === project.testTotalMd;
          if (
            (g.devGap < project.devTotalMd && g.testGap === project.testTotalMd) || 
            (g.devGap === project.devTotalMd && g.testGap < project.testTotalMd) ||
            isDevSevereUnderAlloc
          ) {
            currentAllocations = currentAllocations.filter(a => Number(a.projectId) !== Number(project.id) || a.isLocked);
            const rollbackAllocs = await db.allocations.where({ projectId: project.id! }).toArray();
            const idsToDelete = rollbackAllocs.filter(a => !a.isLocked).map(a => a.id!);
            await db.allocations.bulkDelete(idsToDelete);
            retryQueue.push(project);
            didRollback = true;
          }
        }
      }
      // Invalidate the cached calendars ONCE after all rollbacks so PASS 3 rebuilds
      // from the cleaned-up allocations (avoids O(n\u00b2) matrix rebuilds, #6).
      if (didRollback) sharedMatrix.clear();

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
          return { 
            ...g, 
            gap: Math.ceil(g.devGap), 
            projectTechLead: p?.projectTechLead, 
            detailsProductDevMd: p?.detailsProductDevMd, 
            schedulingStrategy: p?.schedulingStrategy,
            allowedResourceIds: p ? computeAllowedResourceIds(p, true) : resources.map(r => r.id!)
          };
        }).filter(g => g.gap >= 1);
        const devI = hIdle.filter(r => ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role));
        if (devG.length && devI.length) {
          const batchAllowedIds = new Set(devG.flatMap(p => p.allowedResourceIds));
          const filteredIdle = devI.filter(r => batchAllowedIds.has(Number(r.id)));
          if (filteredIdle.length > 0) {
            const sug = await suggestAllocationsForBatch(devG as any, filteredIdle, 'dev', true, signal);
            checkStop();
            await applySuggestions(sug, 'dev', pool, true);
          }
        }
        checkStop();
        const { gaps: hGaps2, idle: hIdle2 } = runAudit(readyProjects, resources, currentAllocations);
        const testG = hGaps2.map(g => {
          const p = readyProjects.find(rp => rp.id === g.id);
          return { 
            ...g, 
            gap: Math.ceil(g.testGap), 
            projectQualityLead: p?.projectQualityLead, 
            detailsProductTestMd: p?.detailsProductTestMd, 
            schedulingStrategy: p?.schedulingStrategy,
            allowedResourceIds: p ? computeAllowedResourceIds(p, true) : resources.map(r => r.id!)
          };
        }).filter(g => g.gap >= 1);
        const testI = hIdle2.filter(r => r.role === '测试工程师');
        if (testG.length && testI.length) {
          const batchAllowedIds = new Set(testG.flatMap(p => p.allowedResourceIds));
          const filteredIdle = testI.filter(r => batchAllowedIds.has(Number(r.id)));
          if (filteredIdle.length > 0) {
            const sug = await suggestAllocationsForBatch(testG as any, filteredIdle, 'test', true, signal);
            checkStop();
            await applySuggestions(sug, 'test', pool, true);
          }
        }
        progress = totalAllocatedThisSession > startMD;
        loop++;
      }

      // Final Rejection Reason Settlement
      const { gaps: finalGaps, idle: finalIdle } = runAudit(readyProjects, resources, currentAllocations);
      for (const p of readyProjects) {
        const gap = finalGaps.find(g => g.id === p.id);
        if (gap && (gap.devGap > 0.5 || gap.testGap > 0.5)) {
          let reason = rejectionReasons.get(p.id!);
          if (!reason) {
            // Infer reason from remaining capacity of allowed resources
            const allowed = computeAllowedResourceIds(p, true);
            let devIdle = 0;
            let testIdle = 0;
            allowed.forEach(rId => {
              const r = resources.find(x => x.id === rId);
              const rI = finalIdle.find(x => x.id === rId);
              if (r && rI) {
                if (r.role === '测试工程师') testIdle += rI.idleMd;
                else devIdle += rI.idleMd;
              }
            });
            if (p.projectTechLead || p.projectQualityLead) reason = 'lead_not_idle';
            else if (gap.devGap > devIdle) reason = 'no_dev_capacity';
            else if (gap.testGap > testIdle) reason = 'no_test_capacity';
            else reason = 'date_window_exceeded';
          }
          await db.projects.update(p.id!, { rejectionReason: reason });
        } else {
          await db.projects.update(p.id!, { rejectionReason: '' });
        }
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
      isScheduling, scheduleStatus, currentStep, error, handleGenerateSchedule, stopScheduling, clearError: () => setError(null)
    }}>
      {children}
    </SchedulingContext.Provider>
  );
};
