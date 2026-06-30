import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getWeeksInRange, calculateWeeklyMD, buildWorkingDaySet } from '../utils/dateUtils';
import { computeProjectGaps } from '../utils/audit';

export interface DashboardContextType {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  startMonth: number;
  setStartMonth: (month: number) => void;
  endMonth: number;
  setEndMonth: (month: number) => void;
  workingDaySet: Set<string>;
  displayWeeks: any[];
  displayWeeksGrouped: { month: number, span: number }[];
  
  projects: any[];
  resources: any[];
  allocations: any[];
  operations: any[];
  scrumTeams: any[];

  readyProjects: any[];
  pendingProjects: any[];
  projectGaps: any[];
  resourceIdle: any[];
  teamCapacities: any[];

  fullyScheduledProjects: any[];
  partiallyScheduledProjects: any[];
  unscheduledProjects: any[];
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within a DashboardProvider');
  return context;
};

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const resources = useLiveQuery(() => db.resources.toArray()) || [];
  const allocations = useLiveQuery(() => db.allocations.toArray()) || [];
  const operations = useLiveQuery(() => db.productOperations.toArray()) || [];
  const scrumTeams = useLiveQuery(() => db.scrumTeams.toArray()) || [];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endMonth, setEndMonth] = useState(Math.min(12, currentMonth + 2));
  const [workingDaySet, setWorkingDaySet] = useState<Set<string>>(new Set());

  const displayWeeks = useMemo(() => {
    return getWeeksInRange(startMonth, endMonth, selectedYear);
  }, [selectedYear, startMonth, endMonth]);

  const displayWeeksGrouped = useMemo(() => {
    const groups: { month: number, span: number }[] = [];
    displayWeeks.forEach(w => {
      const last = groups[groups.length - 1];
      if (last && last.month === w.month) {
        last.span += 1;
      } else {
        groups.push({ month: w.month, span: 1 });
      }
    });
    return groups;
  }, [displayWeeks]);

  useEffect(() => {
    const rangeStart = new Date(selectedYear, startMonth - 1, 1);
    const rangeEnd = new Date(selectedYear, endMonth, 0);
    buildWorkingDaySet(rangeStart, rangeEnd).then(setWorkingDaySet);
  }, [selectedYear, startMonth, endMonth]);

  const runAuditForUI = (currentProjects: any[], currentResources: any[], currentAllocations: any[], currentScrumTeams: any[], currentWorkingDaySet: Set<string>) => {
    const gaps = computeProjectGaps(currentProjects, currentResources, currentAllocations, currentWorkingDaySet)
      .filter(p => Math.ceil(p.devGap) >= 1 || Math.ceil(p.testGap) >= 1);

    const idle = currentResources.map(r => {
      const rAllocations = currentAllocations.filter(a => Number(a.resourceId) === Number(r.id));
      let totalAllocatedMdInRange = 0;
      displayWeeks.forEach(w => {
        rAllocations.forEach(a => {
          totalAllocatedMdInRange += calculateWeeklyMD(a.startDate, a.endDate, a.allocationPercentage, w.year, w.week, currentWorkingDaySet);
        });
      });

      const leaveDays = new Set(Array.isArray(r.unavailableDates) ? r.unavailableDates : []);
      let activeWorkingDays = 0;
      currentWorkingDaySet.forEach(d => {
        if (!leaveDays.has(d)) activeWorkingDays++;
      });
      const capacityMd = (activeWorkingDays * r.capacity) / 100;
      const utilization = capacityMd > 0 ? (totalAllocatedMdInRange / capacityMd) * 100 : 0;
      return { ...r, idleMd: Math.max(0, capacityMd - totalAllocatedMdInRange), allocatedMd: totalAllocatedMdInRange, capacityMd, utilization };
    });

    const activeIdle = idle.filter(r => Math.round(r.idleMd) >= 1);

    const teamCapacities = (currentScrumTeams || []).map(team => {
      const teamResources = idle.filter(r => r.scrumTeamId === team.id);
      let totalCapacityMd = 0; let allocatedMd = 0; let idleMd = 0; let devIdleMd = 0; let testIdleMd = 0;

      teamResources.forEach(r => {
        totalCapacityMd += r.capacityMd;
        allocatedMd += r.allocatedMd;
        idleMd += r.idleMd;
        if (['前端工程师', '后端工程师', 'APP工程师', '全栈工程师', '开发组长'].includes(r.role)) devIdleMd += r.idleMd;
        else if (['测试工程师', '测试组长'].includes(r.role)) testIdleMd += r.idleMd;
      });

      return {
        ...team, totalCapacityMd, allocatedMd, idleMd, devIdleMd, testIdleMd,
        memberCount: teamResources.length,
        utilization: totalCapacityMd > 0 ? (allocatedMd / totalCapacityMd) * 100 : 0
      };
    });

    const unassignedResources = idle.filter(r => !r.scrumTeamId);
    if (unassignedResources.length > 0) {
      let totalCapacityMd = 0; let allocatedMd = 0; let idleMd = 0; let devIdleMd = 0; let testIdleMd = 0;
      unassignedResources.forEach(r => {
        totalCapacityMd += r.capacityMd; allocatedMd += r.allocatedMd; idleMd += r.idleMd;
        if (['前端工程师', '后端工程师', 'APP工程师', '全栈工程师', '开发组长'].includes(r.role)) devIdleMd += r.idleMd;
        else if (['测试工程师', '测试组长'].includes(r.role)) testIdleMd += r.idleMd;
      });
      teamCapacities.push({
        id: -1, name: '未分配 Scrum 团队', totalCapacityMd, allocatedMd, idleMd, devIdleMd, testIdleMd,
        memberCount: unassignedResources.length, utilization: totalCapacityMd > 0 ? (allocatedMd / totalCapacityMd) * 100 : 0
      });
    }

    return { gaps, idle: activeIdle, teamCapacities };
  };

  const { readyProjects, pendingProjects, projectGaps, resourceIdle, teamCapacities } = useMemo(() => {
    if (!projects.length || !resources.length || workingDaySet.size === 0) return { readyProjects: [], pendingProjects: [], projectGaps: [], resourceIdle: [], teamCapacities: [] };
    const ready = projects.filter(p => p.devTotalMd > 0 || p.testTotalMd > 0);
    const pending = projects.filter(p => p.devTotalMd === 0 && p.testTotalMd === 0);
    const { gaps, idle, teamCapacities } = runAuditForUI(ready, resources, allocations, scrumTeams, workingDaySet);
    return { readyProjects: ready, pendingProjects: pending, projectGaps: gaps, resourceIdle: idle, teamCapacities };
  }, [projects, resources, allocations, scrumTeams, workingDaySet, displayWeeks]);

  const { fullyScheduledProjects, partiallyScheduledProjects, unscheduledProjects } = useMemo(() => {
    if (!projects.length || !resources.length) return { fullyScheduledProjects: [], partiallyScheduledProjects: [], unscheduledProjects: [] };
    const ready = projects.filter(p => p.devTotalMd > 0 || p.testTotalMd > 0);
    
    const gapById = new Map(
      computeProjectGaps(ready, resources, allocations, workingDaySet).map(g => [Number(g.id), g])
    );

    const enriched = ready.map(p => {
      const g = gapById.get(Number(p.id)) || { devGap: p.devTotalMd, testGap: p.testTotalMd };
      const devDone = p.devTotalMd <= 0 || Math.ceil(g.devGap) < 1;
      const testDone = p.testTotalMd <= 0 || Math.ceil(g.testGap) < 1;
      
      const pAllocs = allocations.filter(a => Number(a.projectId) === Number(p.id));
      const devs = Array.from(new Set(pAllocs.filter(a => {
        const res = resources.find(r => Number(r.id) === Number(a.resourceId));
        return a.allocationType === 'dev' || (res && ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师', '开发组长'].includes(res.role));
      }).map(a => resources.find(r => r.id === a.resourceId)?.name))).filter(Boolean);
      const testers = Array.from(new Set(pAllocs.filter(a => {
        const res = resources.find(r => Number(r.id) === Number(a.resourceId));
        return a.allocationType === 'test' || (res && ['测试工程师', '测试组长'].includes(res.role));
      }).map(a => resources.find(r => r.id === a.resourceId)?.name))).filter(Boolean);
      
      const devViaJira = p.devTotalMd > 0 && devs.length === 0 && Math.ceil(g.devGap) < 1;
      const testViaJira = p.testTotalMd > 0 && testers.length === 0 && Math.ceil(g.testGap) < 1;
      
      const isFullyScheduled = devDone && testDone;
      const hasAllocations = pAllocs.length > 0;

      const reasonMap: Record<string, string> = {
        'lead_not_idle': 'Lead 不可用',
        'no_dev_capacity': '开发容量不足',
        'no_test_capacity': '测试容量不足',
        'date_window_exceeded': '时间窗口不足',
        'scrum_constraint_violated': '指定团队容量不足',
        'partial_window': '跨窗口部分排期'
      };

      let reason = '';
      if (!isFullyScheduled && p.rejectionReason) {
        reason = reasonMap[p.rejectionReason] || p.rejectionReason;
      }

      return { 
        ...p, 
        assignedDevs: devs.join(', '), 
        assignedTesters: testers.join(', '), 
        allPersonnel: [...new Set([...devs, ...testers])].join(', '), 
        devViaJira, 
        testViaJira,
        devGap: g.devGap,
        testGap: g.testGap,
        isFullyScheduled,
        hasAllocations,
        unscheduledReason: reason
      };
    }).sort((a, b) => Number(a.id) - Number(b.id));

    return {
      fullyScheduledProjects: enriched.filter(p => p.isFullyScheduled),
      partiallyScheduledProjects: enriched.filter(p => !p.isFullyScheduled && p.hasAllocations),
      unscheduledProjects: enriched.filter(p => !p.isFullyScheduled && !p.hasAllocations)
    };
  }, [projects, allocations, resources, resourceIdle]);

  return (
    <DashboardContext.Provider value={{
      selectedYear, setSelectedYear,
      startMonth, setStartMonth,
      endMonth, setEndMonth,
      workingDaySet,
      displayWeeks,
      displayWeeksGrouped,
      projects, resources, allocations, operations, scrumTeams,
      readyProjects, pendingProjects, projectGaps, resourceIdle, teamCapacities,
      fullyScheduledProjects, partiallyScheduledProjects, unscheduledProjects
    }}>
      {children}
    </DashboardContext.Provider>
  );
};
