import type { Allocation, Project, Resource } from '../db';
import { computeProjectGaps } from '../utils/audit.ts';
import { getPriorityWeight } from '../utils/priority.ts';
import { buildResourceCalendars, getMonthlyRemainingCapacityDays, getResourceIdleMd } from './calendar.ts';
import { DEV_ROLES, TEST_ROLES, findAllFitWindows, getAllowedResourceIds, type SchedulingPhase } from './constraints.ts';

export interface PriorityCompletion {
  priority: string;
  weight: number;
  projectCount: number;
  requiredMd: number;
  completedMd: number;
  completionRate: number;
}

export interface ScheduleAuditReport {
  priorityInversions: number;
  overloads: number;
  matchableIdleMd: number;
  totalIdleMd: number;
  utilizationRate: number;
  priorityCompletion: PriorityCompletion[];
  idleReasonCounts: Record<string, number>;
}

const priorityLabel = (weight: number): string => {
  return ['未识别', 'Low', 'Medium', 'High', 'Compliance', 'P0', 'Must Win'][weight] || '未识别';
};

const allocationMd = (allocation: Allocation, workingDaySet: Set<string>): number => {
  let days = 0;
  workingDaySet.forEach(date => {
    if (date >= allocation.startDate && date <= allocation.endDate) days++;
  });
  return days * (allocation.allocationPercentage || 0) / 100;
};

export const createScheduleAudit = (
  projects: Project[],
  resources: Resource[],
  allocations: Allocation[],
  workingDaySet: Set<string>,
): ScheduleAuditReport => {
  const readyProjects = projects.filter(project => project.id !== undefined && (project.devTotalMd > 0 || project.testTotalMd > 0));
  const gaps = computeProjectGaps(readyProjects, resources, allocations, workingDaySet);
  const gapByProject = new Map(gaps.map(gap => [Number(gap.id), gap]));
  const calendars = buildResourceCalendars(resources, allocations, workingDaySet);
  const resourceById = new Map(resources.flatMap(resource => resource.id === undefined ? [] : [[resource.id, resource] as const]));

  let overloads = 0;
  let totalCapacityMd = 0;
  let totalIdleMd = 0;
  calendars.forEach(calendar => {
    overloads += calendar.filter(slot => slot.usedCapacity > slot.totalCapacity).length;
    const occupiedByMonth = new Map<string, number>();
    calendar.forEach(slot => {
      if (slot.usedCapacity > 0) occupiedByMonth.set(slot.monthKey, (occupiedByMonth.get(slot.monthKey) || 0) + 1);
    });
    const monthlyCapacity = new Map<string, number>();
    calendar.forEach(slot => monthlyCapacity.set(slot.monthKey, slot.monthlyCapacityDays));
    occupiedByMonth.forEach((occupied, monthKey) => {
      if (occupied > (monthlyCapacity.get(monthKey) || 0)) overloads += occupied - (monthlyCapacity.get(monthKey) || 0);
    });
    totalCapacityMd += Array.from(monthlyCapacity.values()).reduce((sum, value) => sum + value, 0);
    totalIdleMd += getResourceIdleMd(calendar);
  });

  const matchedDatesByResource = new Map<number, Set<string>>();
  resources.forEach(resource => {
    if (resource.id === undefined) return;
    const calendar = calendars.get(resource.id) || [];
    const matchedDates = new Set<string>();
    readyProjects.forEach(project => {
      const gap = gapByProject.get(project.id!);
      if (!gap || !getAllowedResourceIds(project, resources, true).has(resource.id!)) return;
      const phases: SchedulingPhase[] = [];
      if (gap.devGap > 0.5 && DEV_ROLES.includes(resource.role)) phases.push('dev');
      if (gap.testGap > 0.5 && TEST_ROLES.includes(resource.role)) phases.push('test');
      phases.forEach(() => {
        findAllFitWindows(calendar, project.id!, project.startDate || '0000-01-01')
          .forEach(window => window.dates.forEach(date => matchedDates.add(date)));
      });
    });
    matchedDatesByResource.set(resource.id, matchedDates);
  });

  let matchableIdleMd = 0;
  matchedDatesByResource.forEach((dates, resourceId) => {
    const calendar = calendars.get(resourceId) || [];
    const quota = getMonthlyRemainingCapacityDays(calendar);
    const matchedByMonth = new Map<string, number>();
    dates.forEach(date => matchedByMonth.set(date.slice(0, 7), (matchedByMonth.get(date.slice(0, 7)) || 0) + 1));
    matchedByMonth.forEach((count, monthKey) => {
      matchableIdleMd += Math.min(count, quota.get(monthKey) || 0);
    });
  });
  const totalGapMd = gaps.reduce((sum, gap) => sum + gap.devGap + gap.testGap, 0);
  matchableIdleMd = Math.min(matchableIdleMd, totalGapMd);

  const idleReasonCounts: Record<string, number> = {};
  if (totalIdleMd > matchableIdleMd) {
    const hasGap = gaps.some(gap => gap.devGap > 0.5 || gap.testGap > 0.5);
    const hasRoleCompatibleGap = resources.some(resource => gaps.some(gap =>
      (gap.devGap > 0.5 && DEV_ROLES.includes(resource.role))
      || (gap.testGap > 0.5 && TEST_ROLES.includes(resource.role))));
    const reason = !hasGap ? 'no_project_gap' : hasRoleCompatibleGap ? 'team_or_date_constraint' : 'role_mismatch';
    idleReasonCounts[reason] = totalIdleMd - matchableIdleMd;
  }

  const inversionKeys = new Set<string>();
  readyProjects.forEach(project => {
    const gap = gapByProject.get(project.id!);
    if (!gap || (gap.devGap <= 0.5 && gap.testGap <= 0.5)) return;
    const projectWeight = getPriorityWeight(project.priority);
    const allowedIds = getAllowedResourceIds(project, resources, true);
    allocations.forEach((allocation, index) => {
      if (allocation.projectId <= 0 || allocation.endDate < (project.startDate || '0000-01-01')) return;
      const allocatedProject = readyProjects.find(candidate => candidate.id === Number(allocation.projectId));
      const resource = resourceById.get(Number(allocation.resourceId));
      if (!allocatedProject || !resource || getPriorityWeight(allocatedProject.priority) >= projectWeight || !allowedIds.has(resource.id!)) return;
      const phaseMatches = (gap.devGap > 0.5 && DEV_ROLES.includes(resource.role) && allocation.allocationType !== 'test')
        || (gap.testGap > 0.5 && TEST_ROLES.includes(resource.role));
      if (phaseMatches) inversionKeys.add(`${project.id}:${allocation.id ?? index}`);
    });
  });

  const completion = new Map<number, PriorityCompletion>();
  readyProjects.forEach(project => {
    const weight = getPriorityWeight(project.priority);
    const gap = gapByProject.get(project.id!);
    const requiredMd = (project.devTotalMd || 0) + (project.testTotalMd || 0);
    const remainingMd = (gap?.devGap || 0) + (gap?.testGap || 0);
    const current = completion.get(weight) || {
      priority: priorityLabel(weight), weight, projectCount: 0, requiredMd: 0, completedMd: 0, completionRate: 0,
    };
    current.projectCount++;
    current.requiredMd += requiredMd;
    current.completedMd += Math.max(0, requiredMd - remainingMd);
    completion.set(weight, current);
  });
  const priorityCompletion = Array.from(completion.values())
    .sort((a, b) => b.weight - a.weight)
    .map(item => ({ ...item, completionRate: item.requiredMd > 0 ? item.completedMd / item.requiredMd * 100 : 100 }));
  const allocatedMd = allocations.reduce((sum, allocation) => sum + allocationMd(allocation, workingDaySet), 0);

  return {
    priorityInversions: inversionKeys.size,
    overloads,
    matchableIdleMd,
    totalIdleMd,
    utilizationRate: totalCapacityMd > 0 ? Math.min(100, allocatedMd / totalCapacityMd * 100) : 0,
    priorityCompletion,
    idleReasonCounts,
  };
};
