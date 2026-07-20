import { db } from '../db/index.ts';
import type { SchedulePlan } from './engine.ts';

export interface ScheduleCommitStore {
  transaction: (action: () => Promise<void>) => Promise<void>;
  deleteAllocations: (ids: number[]) => Promise<unknown>;
  addAllocations: (allocations: SchedulePlan['generatedAllocations']) => Promise<unknown>;
  updateProjectReason: (projectId: number, rejectionReason: string) => Promise<unknown>;
}

export const commitSchedulePlan = async (
  store: ScheduleCommitStore,
  allocationIdsToDelete: number[],
  plan: SchedulePlan,
): Promise<void> => {
  await store.transaction(async () => {
    if (allocationIdsToDelete.length > 0) {
      await store.deleteAllocations(allocationIdsToDelete);
    }
    if (plan.generatedAllocations.length > 0) {
      await store.addAllocations(plan.generatedAllocations);
    }
    for (const [projectId, rejectionReason] of plan.rejectionReasons) {
      await store.updateProjectReason(projectId, rejectionReason);
    }
  });
};

export const commitSchedulePlanToDb = async (
  allocationIdsToDelete: number[],
  plan: SchedulePlan,
): Promise<void> => {
  await commitSchedulePlan({
    transaction: action => db.transaction('rw', db.allocations, db.projects, action),
    deleteAllocations: ids => db.allocations.bulkDelete(ids),
    addAllocations: allocations => db.allocations.bulkAdd(allocations),
    updateProjectReason: (projectId, rejectionReason) => db.projects.update(projectId, { rejectionReason }),
  }, allocationIdsToDelete, plan);
};
