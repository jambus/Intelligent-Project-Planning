import { createContext, useContext, useState, type ReactNode, useRef } from 'react';
import { db } from '../db';
import { fetchAIScores } from '../services/ai';
import { calculateEndDate, isValidDateStr, getWorkingDays, formatLocalDate, buildWorkingDaySet, getISOWeekYear, getWeekNumber } from '../utils/dateUtils';
import { computeProjectGaps } from '../utils/audit';
import { getMonthlyCapacityDays } from '../utils/capacity';
import { compareProjectsByPriority } from '../utils/priority';
import { prepareExistingAllocations } from '../utils/schedulingPreparation';

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
  monthKey: string;
  totalCapacity: number;
  usedCapacity: number;
  available: number;
  assignedNonOpProjects: Set<number>;
  weekKey: string;
  monthlyCapacityDays: number;
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
    const workingDaySet = await buildWorkingDaySet(rangeStart, rangeEnd);
    
    const rejectionReasons = new Map<number, string>();

    const checkStop = () => {
      if (stopRequestedRef.current || signal.aborted) throw new Error('MANUAL_STOP');
    };

    try {
      console.group('🚀 确定性排期引擎启动 (混合 AI 打分)');
      setCurrentStep(1);
      setScheduleStatus('🚀 构建基础矩阵与 AI 打分...');
      const existingAllocations = await db.allocations.toArray();
      const preparedAllocations = prepareExistingAllocations(existingAllocations, shouldClear);
      if (preparedAllocations.idsToDelete.length > 0) {
        await db.allocations.bulkDelete(preparedAllocations.idsToDelete);
      }
      checkStop();

      let currentAllocations: any[] = preparedAllocations.retained;
      
      let totalAllocatedThisSession = 0;
      const sharedMatrix = new Map<number, DailySlot[]>();

      const getResourceCalendar = (res: any, currentAllocs: any[]) => {
        if (sharedMatrix.has(res.id)) return sharedMatrix.get(res.id)!;
        const calendar: DailySlot[] = [];
        let current = new Date(rangeStart);
        const resAllocs = currentAllocs.filter(a => Number(a.resourceId) === Number(res.id));
        const leaveDays: Set<string> = new Set(Array.isArray(res.unavailableDates) ? res.unavailableDates : []);
        const monthlyCapacityDays = getMonthlyCapacityDays(workingDaySet, leaveDays, res.capacity);
        
        while (current <= rangeEnd) {
          const dateStr = formatLocalDate(current);
          if (workingDaySet.has(dateStr)) {
            const onLeave = leaveDays.has(dateStr);
            const dayCapacity = onLeave ? 0 : 100;
            let used = 0;
            const assignedNonOpProjects = new Set<number>();
            const weekKey = `${getISOWeekYear(current)}-W${getWeekNumber(current)}`;
            const monthKey = dateStr.slice(0, 7);
            
            resAllocs.forEach(a => {
              if (dateStr >= a.startDate && dateStr <= a.endDate) {
                used += (a.allocationPercentage || 0);
                if (a.projectId > 0) {
                  assignedNonOpProjects.add(Number(a.projectId));
                }
              }
            });
            calendar.push({
              date: dateStr,
              monthKey,
              totalCapacity: dayCapacity,
              usedCapacity: used,
              available: Math.max(0, dayCapacity - used),
              assignedNonOpProjects,
              weekKey,
              monthlyCapacityDays: monthlyCapacityDays.get(monthKey) || 0,
            });
          }
          current.setDate(current.getDate() + 1);
        }
        
        // Propagate assignedNonOpProjects across all days of the same week for the resource
        // so we can easily check weekly limits on any day slot.
        const weekMap = new Map<string, Set<number>>();
        calendar.forEach(slot => {
          if (!weekMap.has(slot.weekKey)) weekMap.set(slot.weekKey, new Set());
          const weekSet = weekMap.get(slot.weekKey)!;
          slot.assignedNonOpProjects.forEach(pid => weekSet.add(pid));
        });
        calendar.forEach(slot => {
          slot.assignedNonOpProjects = weekMap.get(slot.weekKey)!;
        });

        sharedMatrix.set(res.id, calendar);
        return calendar;
      };

      const updateResourceCalendar = (resId: number, newAlloc: any) => {
        const calendar = sharedMatrix.get(resId);
        if (calendar) {
          // Find all weeks affected by this allocation
          const affectedWeeks = new Set<string>();
          calendar.forEach(slot => {
            if (slot.date >= newAlloc.startDate && slot.date <= newAlloc.endDate) {
               slot.usedCapacity += newAlloc.allocationPercentage;
               slot.available = Math.max(0, slot.totalCapacity - slot.usedCapacity);
               affectedWeeks.add(slot.weekKey);
            }
          });
          
          if (newAlloc.projectId > 0) {
            calendar.forEach(slot => {
              if (affectedWeeks.has(slot.weekKey)) {
                slot.assignedNonOpProjects.add(Number(newAlloc.projectId));
              }
            });
          }
        }
      };

      const getMonthlyRemainingCapacityDays = (calendar: DailySlot[]) => {
        const remaining = new Map<string, number>();
        const occupiedDays = new Map<string, number>();

        calendar.forEach(slot => {
          remaining.set(slot.monthKey, slot.monthlyCapacityDays);
          if (slot.usedCapacity > 0) {
            occupiedDays.set(slot.monthKey, (occupiedDays.get(slot.monthKey) || 0) + 1);
          }
        });
        occupiedDays.forEach((used, monthKey) => {
          remaining.set(monthKey, Math.max(0, (remaining.get(monthKey) || 0) - used));
        });
        return remaining;
      };

      const runAudit = (currentProjs: any[], currentRes: any[], currentAllocs: any[]) => {
        const gaps = computeProjectGaps(currentProjs, currentRes, currentAllocs, workingDaySet)
          .filter(p => Math.ceil(p.devGap) >= 1 || Math.ceil(p.testGap) >= 1);

        const idle = currentRes.map(r => {
          const calendar = getResourceCalendar(r, currentAllocs);
          const availableWindows = getAvailableWindows(calendar);
          const remainingByMonth = getMonthlyRemainingCapacityDays(calendar);
          const freeDaysByMonth = new Map<string, number>();
          calendar.forEach(slot => {
            if (slot.available >= 100) {
              freeDaysByMonth.set(slot.monthKey, (freeDaysByMonth.get(slot.monthKey) || 0) + 1);
            }
          });
          const idleMd = Array.from(remainingByMonth).reduce(
            (sum, [monthKey, remaining]) => sum + Math.min(remaining, freeDaysByMonth.get(monthKey) || 0),
            0,
          );
          const totalCapacityMd = Array.from(new Map(calendar.map(slot => [slot.monthKey, slot.monthlyCapacityDays])).values())
            .reduce((sum, days) => sum + days, 0);
          const utilization = totalCapacityMd > 0 ? ((totalCapacityMd - idleMd) / totalCapacityMd) * 100 : 0;
          const summary = availableWindows.map(w => `${w.from}~${w.to}`).join(', ');
          
          let finalSummary = summary ? `Free Days: ${summary}` : 'Full';
          if (finalSummary.length > 200 && availableWindows.length > 3) {
             finalSummary = `Free Days: ${availableWindows.slice(-3).map(w => `${w.from}~${w.to}`).join(', ')}`;
          }
          
          return { ...r, idleMd, utilization, scheduleSummary: finalSummary };
        }).filter(r => r.idleMd > 0);

        return { gaps, idle };
      };

      // 1. Fetch AI Scores upfront
      setScheduleStatus('🧠 正在请求 AI 技能匹配打分...');
      
      const { gaps: initialGaps, idle: initialIdle } = runAudit(readyProjects, resources, currentAllocations);
      
      const devG = initialGaps.filter(g => Math.ceil(g.devGap) >= 1);
      const devCandidates = initialIdle.filter(r => ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师', '开发组长'].includes(r.role));
      const devScores = (devG.length && devCandidates.length) 
        ? await fetchAIScores(devG, devCandidates, 'dev', signal) : [];
        
      checkStop();
      
      const testG = initialGaps.filter(g => Math.ceil(g.testGap) >= 1);
      const testCandidates = initialIdle.filter(r => ['测试工程师', '测试组长'].includes(r.role));
      const testScores = (testG.length && testCandidates.length) 
        ? await fetchAIScores(testG, testCandidates, 'test', signal) : [];

      const getCandidateScore = (projectId: number, resourceId: number, phase: 'dev' | 'test') => {
        const scores = phase === 'dev' ? devScores : testScores;
        const entry = scores.find(s => s.projectId === projectId && s.resourceId === resourceId);
        return entry ? entry.score : 0;
      };

      // PASS 0: Deterministic Ops Scheduling (Round-Robin)
      setScheduleStatus(`⚙️ 阶段零：按月分配产品运维基础人天 (均匀分摊)...`);
      const operations = await db.productOperations.toArray();
      if (operations.length > 0) {
        const leads = new Set<string>();
        readyProjects.forEach(p => {
          if (p.projectTechLead) leads.add(p.projectTechLead);
          if (p.projectQualityLead) leads.add(p.projectQualityLead);
        });

        for (const op of operations) {
          checkStop();
          const candidates = resources.filter(r => r.skills?.includes(op.productName));

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
                if (phase === 'dev') return ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师', '开发组长'].includes(r.role);
                return ['测试工程师', '测试组长'].includes(r.role);
              });

              const CHIEF_ROLES = ['开发组长', '测试组长'];
              const regularPool = phaseCandidates.filter(r => !leads.has(r.name) && !CHIEF_ROLES.includes(r.role));
              const leadPool = phaseCandidates.filter(r => leads.has(r.name) && !CHIEF_ROLES.includes(r.role));
              const chiefPool = phaseCandidates.filter(r => CHIEF_ROLES.includes(r.role));

              const allocateFromPoolRoundRobin = async (pool: typeof phaseCandidates) => {
                if (pool.length === 0 || remainingMd < 0.5) return;
                
                // Distribute evenly among all available people in the pool
                const mdPerPerson = Math.ceil(remainingMd / pool.length);
                
                for (const res of pool) {
                  if (remainingMd < 0.5) break;
                  
                  const targetMdForThisPerson = Math.min(mdPerPerson, remainingMd);
                  const dailyCap = 100;
                  const mdPerDay = 1;

                  const resCalendar = getResourceCalendar(res, currentAllocations);
                  const remainingCapacity = getMonthlyRemainingCapacityDays(resCalendar).get(monthStart.slice(0, 7)) || 0;
                  const monthSlots = resCalendar
                    .filter(s => s.date >= monthStart && s.date <= monthEnd && s.available >= dailyCap)
                    .sort((a, b) => a.date.localeCompare(b.date));
                  if (monthSlots.length === 0) continue;

                  const daysNeeded = Math.min(Math.ceil(targetMdForThisPerson / mdPerDay), monthSlots.length, remainingCapacity);
                  if (daysNeeded < 1) continue;

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

              await allocateFromPoolRoundRobin(regularPool);
              if (remainingMd >= 0.5) await allocateFromPoolRoundRobin(leadPool);
              if (remainingMd >= 0.5) await allocateFromPoolRoundRobin(chiefPool);
            };

            if (targetDevMd > 0) await allocateOpForMonth(targetDevMd, 'dev');
            if (targetTestMd > 0) await allocateOpForMonth(targetTestMd, 'test');
          }
        }
      }

      // DETERMINISTIC GREEDY ALLOCATION (Replaces PASS 1 & 3)
      setCurrentStep(2);
      
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

      const findEarliestFitDateAndMaxDays = (resourceId: number, currentAllocs: any[], defaultStartDate: string, resources: any[], projectId: number) => {
        const res = resources?.find(r => Number(r.id) === Number(resourceId));
        if (!res) return { startDate: "9999-12-31", maxContinuousDays: 0 };
        const calendar = getResourceCalendar(res, currentAllocs);
        const dailyCap = 100;
        const remainingCapacity = getMonthlyRemainingCapacityDays(calendar);
        
        let bestStart = "9999-12-31";
        let currentContinuousDays = 0;
        let maxContinuousDays = 0;
        
        for (let i = 0; i < calendar.length; i++) {
          const slot = calendar[i];
          if (slot.date < defaultStartDate) continue;
          
          // Max 3 projects per week constraint
          let weekIsFull = false;
          if (projectId > 0) {
             if (slot.assignedNonOpProjects.size >= 3 && !slot.assignedNonOpProjects.has(projectId)) {
               weekIsFull = true;
             }
          }
          
          const monthRemaining = remainingCapacity.get(slot.monthKey) || 0;
          if (slot.available >= dailyCap && !weekIsFull && monthRemaining > 0) {
            if (currentContinuousDays === 0) {
               bestStart = slot.date;
            }
            currentContinuousDays++;
            remainingCapacity.set(slot.monthKey, monthRemaining - 1);
          } else {
            if (currentContinuousDays > 0) {
               maxContinuousDays = Math.max(maxContinuousDays, currentContinuousDays);
               // We found a chunk. For greedy allocation, we can just return the first available chunk 
               // rather than searching for the absolute largest across the whole horizon.
               break; 
            }
            currentContinuousDays = 0;
          }
        }
        
        if (currentContinuousDays > 0) {
           maxContinuousDays = Math.max(maxContinuousDays, currentContinuousDays);
        }
        
        return { startDate: bestStart, maxContinuousDays };
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

      const greedyAllocate = async (phase: 'dev' | 'test', isLatePass: boolean) => {
        setScheduleStatus(`🛠️ 阶段一/三：核心贪心分配 (${phase.toUpperCase()} - ${isLatePass ? '全局匹配' : '严格模式'})...`);
        const { gaps: cGaps, idle: cIdle } = runAudit(readyProjects, resources, currentAllocations);
        
        const sortedProjects = [...readyProjects].sort(compareProjectsByPriority);
        
        for (const project of sortedProjects) {
          checkStop();
          let pGap = cGaps.find(g => Number(g.id) === Number(project.id));
          if (!pGap) continue;
          
          let targetGap = phase === 'dev' ? pGap.devGap : pGap.testGap;
          if (Math.ceil(targetGap) < 1) continue;

          const allowedIds = computeAllowedResourceIds(project, isLatePass);
          
          // Filter idle candidates for this phase
          const candidateRoles = phase === 'dev' 
            ? ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师', '开发组长']
            : ['测试工程师', '测试组长'];
            
          let candidates = cIdle.filter(r => candidateRoles.includes(r.role) && allowedIds.includes(r.id!));
          
          // Sort candidates by AI Score, then by whether they are a lead
          const leadName = phase === 'dev' ? project.projectTechLead : project.projectQualityLead;
          
          candidates.sort((a, b) => {
             const scoreA = getCandidateScore(project.id!, a.id!, phase);
             const scoreB = getCandidateScore(project.id!, b.id!, phase);
             if (scoreA !== scoreB) return scoreB - scoreA;
             const aIsLead = a.name === leadName ? 1 : 0;
             const bIsLead = b.name === leadName ? 1 : 0;
             return bIsLead - aIsLead;
          });

          for (const resource of candidates) {
             if (Math.ceil(targetGap) < 1) break; // Filled

             const rIdle = cIdle.find(r => r.id === resource.id);
             if (!rIdle || rIdle.idleMd <= 0) continue;

             const perc = 100;
             let start = isValidDateStr(project.startDate) ? project.startDate! : defaultStart;
             if (phase === 'test') start = calculateTestStartDate(project.id!, currentAllocations, start);
             
             const { startDate, maxContinuousDays } = findEarliestFitDateAndMaxDays(resource.id!, currentAllocations, start, resources, project.id!);
             if (startDate > scheduleMaxDate || maxContinuousDays === 0) {
               continue;
             }

             const allocatableMd = Math.min(targetGap, rIdle.idleMd, maxContinuousDays);
             const finalMd = Math.min(maxContinuousDays, Math.ceil(allocatableMd));
             
             if (finalMd > 0) {
                let endDate = calculateEndDate(startDate, finalMd, perc);
                if (endDate > scheduleMaxDate) endDate = scheduleMaxDate;
                if (endDate < startDate) continue;

                const actualWorkingDays = getWorkingDays(new Date(startDate), new Date(endDate), workingDaySet);
                const actualMd = Math.min(actualWorkingDays, finalMd);
                if (actualMd <= 0) continue;

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
                totalAllocatedThisSession += actualMd;
                
                updateResourceCalendar(resource.id!, allocToSave);
                targetGap -= actualMd;
                rIdle.idleMd -= actualMd;
                if (phase === 'dev') pGap.devGap -= actualMd; else pGap.testGap -= actualMd;
             }
          }
        }
      };

      // Run Strict Pass
      await greedyAllocate('dev', false);
      await greedyAllocate('test', false);

      // PASS 2: Integrity Audit (Relaxed Rollback)
      setCurrentStep(3);
      checkStop();
      setScheduleStatus(`🛡️ 阶段二：完整性审计回滚...`);
      let didRollback = false;
      const { gaps: aGaps } = runAudit(readyProjects, resources, currentAllocations);
      
      for (const project of readyProjects) {
        checkStop();
        if (project.endDate && project.endDate > scheduleMaxDate) {
          rejectionReasons.set(project.id!, 'partial_window');
          continue;
        }
        
        const g = aGaps.find(pg => Number(pg.id) === Number(project.id));
        if (g && project.devTotalMd > 0 && project.testTotalMd > 0) {
          const devAllocated = project.devTotalMd - g.devGap;
          const testAllocated = project.testTotalMd - g.testGap;
          const totalAllocated = devAllocated + testAllocated;
          const totalRequired = project.devTotalMd + project.testTotalMd;
          
          // Relaxed rollback condition: Rollback only if we covered less than 30% of the total needed MD
          // AND we couldn't fully cover either Dev or Test. 
          if ((totalAllocated / totalRequired) < 0.3) {
             currentAllocations = currentAllocations.filter(a => Number(a.projectId) !== Number(project.id) || a.isLocked);
             const rollbackAllocs = await db.allocations.where({ projectId: project.id! }).toArray();
             const idsToDelete = rollbackAllocs.filter(a => !a.isLocked).map(a => a.id!);
             if (idsToDelete.length > 0) {
               await db.allocations.bulkDelete(idsToDelete);
               didRollback = true;
             }
          }
        }
      }
      
      if (didRollback) {
        sharedMatrix.clear(); 
      }

      // Global Relaxed Pass (formerly PASS 3)
      await greedyAllocate('dev', true);
      await greedyAllocate('test', true);

      // Final Rejection Reason Settlement
      const { gaps: finalGaps, idle: finalIdle } = runAudit(readyProjects, resources, currentAllocations);
      for (const p of readyProjects) {
        const gap = finalGaps.find(g => g.id === p.id);
        if (gap && (gap.devGap > 0.5 || gap.testGap > 0.5)) {
          let reason = rejectionReasons.get(p.id!);
          if (!reason) {
            const allowed = computeAllowedResourceIds(p, true);
            let devIdle = 0;
            let testIdle = 0;
            allowed.forEach(rId => {
              const r = resources.find(x => x.id === rId);
              const rI = finalIdle.find(x => x.id === rId);
              if (r && rI) {
                if (['测试工程师', '测试组长'].includes(r.role)) testIdle += rI.idleMd;
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
      setScheduleStatus('✨ 确定性排期调度完成！');
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
