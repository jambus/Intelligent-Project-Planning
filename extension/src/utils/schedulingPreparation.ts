interface ExistingAllocation {
  id?: number;
  isLocked?: boolean;
}

export const prepareExistingAllocations = <T extends ExistingAllocation>(
  allocations: T[],
  shouldClear: boolean,
): { retained: T[]; idsToDelete: number[] } => {
  if (!shouldClear) return { retained: [...allocations], idsToDelete: [] };

  return {
    retained: allocations.filter(allocation => allocation.isLocked),
    idsToDelete: allocations
      .filter(allocation => !allocation.isLocked && allocation.id !== undefined)
      .map(allocation => allocation.id as number),
  };
};
