import type { Project, Resource } from '../db';
import type { DailySlot } from './calendar.ts';
import { getMonthlyRemainingCapacityDays } from './calendar.ts';

export type SchedulingPhase = 'dev' | 'test';

export const DEV_ROLES = ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师', '开发组长'];
export const TEST_ROLES = ['测试工程师', '测试组长'];

export const isRoleEligible = (resource: Resource, phase: SchedulingPhase): boolean => {
  return (phase === 'dev' ? DEV_ROLES : TEST_ROLES).includes(resource.role);
};

export const getAllowedResourceIds = (
  project: Project,
  resources: Resource[],
  relaxed: boolean,
): Set<number> => {
  const allIds = resources.flatMap(resource => resource.id === undefined ? [] : [resource.id]);
  const mode = project.teamSchedulingMode || 'all-in';

  if (mode === 'team-first' && project.scrumTeamId !== undefined) {
    return new Set(resources
      .filter(resource => Number(resource.scrumTeamId) === Number(project.scrumTeamId))
      .flatMap(resource => resource.id === undefined ? [] : [resource.id]));
  }
  if (mode === 'cross-team' && project.scrumTeamId !== undefined && !relaxed) {
    return new Set(resources
      .filter(resource => Number(resource.scrumTeamId) === Number(project.scrumTeamId))
      .flatMap(resource => resource.id === undefined ? [] : [resource.id]));
  }
  return new Set(allIds);
};

export const getEligibleResources = (
  project: Project,
  resources: Resource[],
  phase: SchedulingPhase,
  relaxed: boolean,
): Resource[] => {
  const allowedIds = getAllowedResourceIds(project, resources, relaxed);
  return resources.filter(resource => resource.id !== undefined
    && allowedIds.has(resource.id)
    && isRoleEligible(resource, phase));
};

export interface FitWindow {
  dates: string[];
}

export const findAllFitWindows = (
  calendar: DailySlot[],
  projectId: number,
  earliestDate: string,
): FitWindow[] => {
  const remainingCapacity = getMonthlyRemainingCapacityDays(calendar);
  const windows: FitWindow[] = [];
  let dates: string[] = [];

  for (const slot of calendar) {
    if (slot.date < earliestDate) continue;
    const weeklyLimitReached = slot.assignedNonOpProjects.size >= 3
      && !slot.assignedNonOpProjects.has(projectId);
    const monthRemaining = remainingCapacity.get(slot.monthKey) || 0;
    const feasible = slot.available >= 100 && !weeklyLimitReached && monthRemaining > 0;

    if (feasible) {
      dates.push(slot.date);
      remainingCapacity.set(slot.monthKey, monthRemaining - 1);
      continue;
    }
    if (dates.length > 0) {
      windows.push({ dates });
      dates = [];
    }
  }

  if (dates.length > 0) windows.push({ dates });
  return windows;
};

export const findEarliestFitWindow = (
  calendar: DailySlot[],
  projectId: number,
  earliestDate: string,
): FitWindow => {
  return findAllFitWindows(calendar, projectId, earliestDate)[0] || { dates: [] };
};
