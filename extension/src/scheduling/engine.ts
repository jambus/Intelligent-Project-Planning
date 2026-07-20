import type { Allocation, ProductOperation, Project, Resource } from '../db';
import type { AIScore } from '../services/ai';
import { computeProjectGaps } from '../utils/audit.ts';
import { compareProjectsByPriority, getPriorityWeight } from '../utils/priority.ts';
import {
  applyAllocationToCalendar,
  buildResourceCalendars,
  getMonthlyRemainingCapacityDays,
  getResourceIdleMd,
  type ResourceCalendars,
} from './calendar.ts';
import { DEV_ROLES, TEST_ROLES, findEarliestFitWindow, getAllowedResourceIds, getEligibleResources, type SchedulingPhase } from './constraints.ts';

export type PlannedAllocation = Omit<Allocation, 'id'>;

export interface SchedulePlanInput {
  resources: Resource[];
  projects: Project[];
  operations: ProductOperation[];
  existingAllocations: Allocation[];
  workingDaySet: Set<string>;
  rangeStart: string;
  rangeEnd: string;
  devScores?: AIScore[];
  testScores?: AIScore[];
}

export interface SchedulePlan {
  generatedAllocations: PlannedAllocation[];
  rejectionReasons: Map<number, string>;
  priorityInversions: number;
}

const getProjectGap = (
  project: Project,
  resources: Resource[],
  allocations: Allocation[],
  workingDaySet: Set<string>,
) => computeProjectGaps([project], resources, allocations, workingDaySet)[0];

const calculateTestStartDate = (
  projectId: number,
  allocations: Allocation[],
  fallback: string,
  workingDaySet: Set<string>,
): string => {
  const devAllocations = allocations.filter(allocation => Number(allocation.projectId) === projectId
    && allocation.allocationType !== 'test');
  if (devAllocations.length === 0) return fallback;

  const earliest = devAllocations.reduce((date, allocation) => allocation.startDate < date ? allocation.startDate : date, '9999-12-31');
  const latest = devAllocations.reduce((date, allocation) => allocation.endDate > date ? allocation.endDate : date, '0000-01-01');
  const start = new Date(earliest);
  const end = new Date(latest);
  const midpoint = new Date(start.getTime() + ((end.getTime() - start.getTime()) / 2));

  while (midpoint > start && !workingDaySet.has(formatDate(midpoint))) {
    midpoint.setDate(midpoint.getDate() - 1);
  }
  return formatDate(midpoint);
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addAllocation = (
  allocation: PlannedAllocation,
  allocations: Allocation[],
  generated: PlannedAllocation[],
  calendars: ResourceCalendars,
): void => {
  allocations.push(allocation);
  generated.push(allocation);
  const calendar = calendars.get(allocation.resourceId);
  if (calendar) applyAllocationToCalendar(calendar, allocation);
};

const scheduleOperations = (
  input: SchedulePlanInput,
  allocations: Allocation[],
  generated: PlannedAllocation[],
  calendars: ResourceCalendars,
): void => {
  const leadNames = new Set(input.projects.flatMap(project => [project.projectTechLead, project.projectQualityLead].filter(Boolean) as string[]));
  const monthKeys = Array.from(new Set(Array.from(input.workingDaySet, date => date.slice(0, 7)))).sort();

  input.operations.forEach(operation => {
    if (operation.id === undefined) return;
    const skilledResources = input.resources.filter(resource => resource.skills?.includes(operation.productName));

    monthKeys.forEach(monthKey => {
      const schedulePhase = (targetMd: number, phase: SchedulingPhase) => {
        let remainingMd = targetMd;
        if (remainingMd < 0.5) return;
        const phaseResources = skilledResources.filter(resource => (phase === 'dev' ? DEV_ROLES : TEST_ROLES).includes(resource.role));
        const chiefRoles = new Set(['开发组长', '测试组长']);
        const pools = [
          phaseResources.filter(resource => !leadNames.has(resource.name) && !chiefRoles.has(resource.role)),
          phaseResources.filter(resource => leadNames.has(resource.name) && !chiefRoles.has(resource.role)),
          phaseResources.filter(resource => chiefRoles.has(resource.role)),
        ];

        pools.forEach(pool => {
          if (remainingMd < 0.5 || pool.length === 0) return;
          const mdPerPerson = Math.ceil(remainingMd / pool.length);
          pool.forEach(resource => {
            if (remainingMd < 0.5 || resource.id === undefined) return;
            const calendar = calendars.get(resource.id) || [];
            const remainingQuota = getMonthlyRemainingCapacityDays(calendar).get(monthKey) || 0;
            const freeSlots = calendar.filter(slot => slot.monthKey === monthKey && slot.available >= 100);
            const daysNeeded = Math.min(Math.ceil(Math.min(mdPerPerson, remainingMd)), remainingQuota, freeSlots.length);
            if (daysNeeded === 0) return;
            const step = freeSlots.length / daysNeeded;

            for (let index = 0; index < daysNeeded && remainingMd >= 0.5; index++) {
              const slot = freeSlots[Math.floor(index * step)];
              addAllocation({
                resourceId: resource.id,
                projectId: -(operation.id! + 1000000),
                allocationPercentage: 100,
                startDate: slot.date,
                endDate: slot.date,
                allocationType: phase,
              }, allocations, generated, calendars);
              remainingMd -= 1;
            }
          });
        });
      };

      schedulePhase(operation.monthlyDevMd, 'dev');
      schedulePhase(operation.monthlyTestMd, 'test');
    });
  });
};

export const generateSchedulePlan = (input: SchedulePlanInput): SchedulePlan => {
  const allocations: Allocation[] = input.existingAllocations.map(allocation => ({ ...allocation }));
  const generated: PlannedAllocation[] = [];
  let calendars = buildResourceCalendars(input.resources, allocations, input.workingDaySet);
  const scoresByPhase = { dev: input.devScores || [], test: input.testScores || [] };

  scheduleOperations(input, allocations, generated, calendars);

  const scoreFor = (projectId: number, resourceId: number, phase: SchedulingPhase) => {
    return scoresByPhase[phase].find(score => score.projectId === projectId && score.resourceId === resourceId)?.score || 0;
  };

  const allocatePhase = (projects: Project[], phase: SchedulingPhase, relaxed: boolean): number => {
    let added = 0;
    projects.forEach(project => {
      if (project.id === undefined) return;
      const gap = getProjectGap(project, input.resources, allocations, input.workingDaySet);
      let targetGap = phase === 'dev' ? gap.devGap : gap.testGap;
      if (targetGap <= 0.5) return;

      const leadName = phase === 'dev' ? project.projectTechLead : project.projectQualityLead;
      const candidates = getEligibleResources(project, input.resources, phase, relaxed)
        .filter(resource => resource.id !== undefined && getResourceIdleMd(calendars.get(resource.id) || []) > 0)
        .sort((a, b) => {
          const scoreDifference = scoreFor(project.id!, b.id!, phase) - scoreFor(project.id!, a.id!, phase);
          if (scoreDifference !== 0) return scoreDifference;
          const leadDifference = Number(b.name === leadName) - Number(a.name === leadName);
          return leadDifference || (a.id! - b.id!);
        });

      candidates.forEach(resource => {
        if (targetGap <= 0.5 || resource.id === undefined) return;
        const calendar = calendars.get(resource.id) || [];
        const earliestDate = phase === 'test'
          ? calculateTestStartDate(project.id!, allocations, project.startDate || input.rangeStart, input.workingDaySet)
          : project.startDate || input.rangeStart;
        const window = findEarliestFitWindow(calendar, project.id!, earliestDate);
        const idleMd = getResourceIdleMd(calendar);
        const days = Math.min(window.dates.length, idleMd, Math.ceil(targetGap));
        if (days <= 0) return;

        const allocation: PlannedAllocation = {
          resourceId: resource.id,
          projectId: project.id!,
          allocationPercentage: 100,
          startDate: window.dates[0],
          endDate: window.dates[days - 1],
          allocationType: phase,
        };
        addAllocation(allocation, allocations, generated, calendars);
        targetGap -= days;
        added++;
      });
    });
    return added;
  };

  const sortedProjects = input.projects.filter(project => project.id !== undefined).sort(compareProjectsByPriority);
  const priorityGroups = new Map<number, Project[]>();
  sortedProjects.forEach(project => {
    const weight = getPriorityWeight(project.priority);
    if (!priorityGroups.has(weight)) priorityGroups.set(weight, []);
    priorityGroups.get(weight)!.push(project);
  });

  Array.from(priorityGroups.keys()).sort((a, b) => b - a).forEach(weight => {
    const projects = priorityGroups.get(weight)!;
    allocatePhase(projects, 'dev', false);
    allocatePhase(projects, 'test', false);

    const rollbackIds = new Set<number>();
    projects.forEach(project => {
      if (project.id === undefined || project.endDate > input.rangeEnd || project.devTotalMd <= 0 || project.testTotalMd <= 0) return;
      const gap = getProjectGap(project, input.resources, allocations, input.workingDaySet);
      const allocated = (project.devTotalMd - gap.devGap) + (project.testTotalMd - gap.testGap);
      if (allocated / (project.devTotalMd + project.testTotalMd) < 0.3) rollbackIds.add(project.id);
    });
    if (rollbackIds.size > 0) {
      const rolledBackAllocations = new Set(generated.filter(allocation => rollbackIds.has(allocation.projectId)));
      for (let index = generated.length - 1; index >= 0; index--) {
        if (rollbackIds.has(generated[index].projectId)) generated.splice(index, 1);
      }
      for (let index = allocations.length - 1; index >= 0; index--) {
        if (rolledBackAllocations.has(allocations[index])) allocations.splice(index, 1);
      }
      calendars = buildResourceCalendars(input.resources, allocations, input.workingDaySet);
    }

    const maxIterations = Math.max(1, input.workingDaySet.size * input.resources.length);
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const added = allocatePhase(projects, 'dev', true) + allocatePhase(projects, 'test', true);
      if (added === 0) break;
    }
  });

  const rejectionReasons = new Map<number, string>();
  input.projects.forEach(project => {
    if (project.id === undefined) return;
    const gap = getProjectGap(project, input.resources, allocations, input.workingDaySet);
    if (gap.devGap <= 0.5 && gap.testGap <= 0.5) {
      rejectionReasons.set(project.id, '');
      return;
    }
    if (project.endDate && project.endDate > input.rangeEnd) {
      rejectionReasons.set(project.id, 'partial_window');
      return;
    }

    const allowedIds = getAllowedResourceIds(project, input.resources, true);
    let devIdle = 0;
    let testIdle = 0;
    allowedIds.forEach(resourceId => {
      const resource = input.resources.find(candidate => candidate.id === resourceId);
      const idleMd = getResourceIdleMd(calendars.get(resourceId) || []);
      if (!resource) return;
      if (TEST_ROLES.includes(resource.role)) testIdle += idleMd;
      else if (DEV_ROLES.includes(resource.role)) devIdle += idleMd;
    });
    if (project.projectTechLead || project.projectQualityLead) rejectionReasons.set(project.id, 'lead_not_idle');
    else if (gap.devGap > devIdle) rejectionReasons.set(project.id, 'no_dev_capacity');
    else if (gap.testGap > testIdle) rejectionReasons.set(project.id, 'no_test_capacity');
    else rejectionReasons.set(project.id, 'date_window_exceeded');
  });

  const projectWeights = new Map(input.projects.flatMap(project => (
    project.id === undefined ? [] : [[project.id, getPriorityWeight(project.priority)] as const]
  )));
  const allocationWeights = generated
    .filter(allocation => allocation.projectId > 0)
    .map(allocation => projectWeights.get(allocation.projectId) || 0);
  let priorityInversions = 0;
  allocationWeights.forEach((weight, index) => {
    for (let later = index + 1; later < allocationWeights.length; later++) {
      if (allocationWeights[later] > weight) priorityInversions++;
    }
  });

  return { generatedAllocations: generated, rejectionReasons, priorityInversions };
};
