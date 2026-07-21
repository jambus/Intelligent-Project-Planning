import { getWorkingDays } from './dateUtils.ts';

/**
 * Shared, pure project-gap auditor used by BOTH the scheduling engine
 * (SchedulingContext) and the dashboard UI (Dashboard) so the two never drift
 * apart.
 *
 * Precision note (#8): man-days are accumulated at full precision and only
 * compared after summation. Never round each allocation individually and then
 * add them up \u2014 that introduces a cumulative rounding error that can make a
 * fully-staffed project still appear to have a gap (or vice-versa).
 *
 * Filtering (e.g. `devGap >= 1`) is intentionally left to the caller because the
 * engine and the UI use slightly different thresholds.
 */
export interface ProjectGap {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  devGap: number;
  testGap: number;
}

export const computeProjectGaps = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  projects: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resources: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allocations: any[],
  workingDaySet?: Set<string>
): ProjectGap[] => {
  return projects.map(p => {
    const pAllocations = allocations.filter(a => Number(a.projectId) === Number(p.id));
    let dev = 0, test = 0;
    pAllocations.forEach(a => {
      const res = resources.find(r => Number(r.id) === Number(a.resourceId));
      const workingDays = getWorkingDays(new Date(a.startDate), new Date(a.endDate), workingDaySet);
      // Accumulate at full precision; do NOT round per-allocation.
      const md = (workingDays * (a.allocationPercentage || 0)) / 100;
      if (a.allocationType === 'test' || (res && ['测试工程师', '测试组长'].includes(res.role))) test += md; else dev += md;
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
  });
};
