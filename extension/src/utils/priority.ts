export const PRIORITY_WEIGHT = {
  MUST_WIN: 6,
  P0: 5,
  COMPLIANCE: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  UNKNOWN: 0,
} as const;

const normalizePriorityKey = (priority: string | null | undefined): string => {
  return (priority || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
};

export const getPriorityWeight = (priority: string | null | undefined): number => {
  const key = normalizePriorityKey(priority);
  const weights: Record<string, number> = {
    mustwin: PRIORITY_WEIGHT.MUST_WIN,
    p0: PRIORITY_WEIGHT.P0,
    compliance: PRIORITY_WEIGHT.COMPLIANCE,
    high: PRIORITY_WEIGHT.HIGH,
    p1: PRIORITY_WEIGHT.HIGH,
    '高': PRIORITY_WEIGHT.HIGH,
    medium: PRIORITY_WEIGHT.MEDIUM,
    p2: PRIORITY_WEIGHT.MEDIUM,
    '中': PRIORITY_WEIGHT.MEDIUM,
    low: PRIORITY_WEIGHT.LOW,
    p3: PRIORITY_WEIGHT.LOW,
    '低': PRIORITY_WEIGHT.LOW,
  };
  return weights[key] ?? PRIORITY_WEIGHT.UNKNOWN;
};

export interface PrioritizedProject {
  id?: number;
  priority?: string;
}

export const compareProjectsByPriority = (a: PrioritizedProject, b: PrioritizedProject): number => {
  return getPriorityWeight(b.priority) - getPriorityWeight(a.priority)
    || (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER);
};
