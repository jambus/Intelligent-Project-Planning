import assert from 'node:assert/strict';
import test from 'node:test';
import type { Allocation } from '../src/db/index.ts';
import { commitSchedulePlan, type ScheduleCommitStore } from '../src/scheduling/commit.ts';
import type { SchedulePlan } from '../src/scheduling/engine.ts';

const makePlan = (): SchedulePlan => ({
  generatedAllocations: [{
    resourceId: 1,
    projectId: 1,
    startDate: '2026-07-02',
    endDate: '2026-07-02',
    allocationPercentage: 100,
    allocationType: 'dev',
  }],
  rejectionReasons: new Map([[1, '']]),
  priorityInversions: 0,
  residualAllocations: 0,
});

const makeStore = (failOnReasonUpdate = false) => {
  let allocations: Allocation[] = [{
    id: 7,
    resourceId: 1,
    projectId: 99,
    startDate: '2026-07-01',
    endDate: '2026-07-01',
    allocationPercentage: 100,
  }];
  let reasons = new Map<number, string>([[1, 'old_reason']]);

  const store: ScheduleCommitStore = {
    transaction: async action => {
      const allocationSnapshot = structuredClone(allocations);
      const reasonSnapshot = new Map(reasons);
      try {
        await action();
      } catch (error) {
        allocations = allocationSnapshot;
        reasons = reasonSnapshot;
        throw error;
      }
    },
    deleteAllocations: async ids => {
      allocations = allocations.filter(allocation => !ids.includes(allocation.id!));
    },
    addAllocations: async additions => {
      allocations.push(...additions);
    },
    updateProjectReason: async (projectId, rejectionReason) => {
      if (failOnReasonUpdate) throw new Error('injected write failure');
      reasons.set(projectId, rejectionReason);
    },
  };

  return { store, allocations: () => allocations, reasons: () => reasons };
};

test('commits allocation replacement and project reasons as one unit', async () => {
  const state = makeStore();
  await commitSchedulePlan(state.store, [7], makePlan());

  assert.equal(state.allocations().length, 1);
  assert.equal(state.allocations()[0].projectId, 1);
  assert.equal(state.reasons().get(1), '');
});

test('rolls back allocation changes when a later project update fails', async () => {
  const state = makeStore(true);
  await assert.rejects(commitSchedulePlan(state.store, [7], makePlan()), /injected write failure/);

  assert.deepEqual(state.allocations().map(allocation => allocation.id), [7]);
  assert.equal(state.reasons().get(1), 'old_reason');
});
