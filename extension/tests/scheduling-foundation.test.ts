import assert from 'node:assert/strict';
import test from 'node:test';
import { getMonthlyCapacityDays, normalizeCapacityPercentage } from '../src/utils/capacity.ts';
import { compareProjectsByPriority, getPriorityWeight } from '../src/utils/priority.ts';
import { prepareExistingAllocations } from '../src/utils/schedulingPreparation.ts';

test('normalizes supported priority labels and preserves import order for ties', () => {
  assert.equal(getPriorityWeight(' Must-Win '), 6);
  assert.equal(getPriorityWeight('p0'), 5);
  assert.equal(getPriorityWeight(' COMPLIANCE '), 4);
  assert.equal(getPriorityWeight('HIGH'), getPriorityWeight('P1'));
  assert.equal(getPriorityWeight('高'), getPriorityWeight('High'));
  assert.equal(getPriorityWeight('unknown'), 0);

  const sorted = [
    { id: 3, priority: 'Low' },
    { id: 2, priority: 'High' },
    { id: 1, priority: ' high ' },
    { id: 4, priority: 'P0' },
  ].sort(compareProjectsByPriority);

  assert.deepEqual(sorted.map(project => project.id), [4, 1, 2, 3]);
});

test('retains locked allocations during a full reschedule', () => {
  const allocations = [
    { id: 1, isLocked: true },
    { id: 2, isLocked: false },
    { id: 3 },
  ];

  assert.deepEqual(prepareExistingAllocations(allocations, true), {
    retained: [{ id: 1, isLocked: true }],
    idsToDelete: [2, 3],
  });
  assert.deepEqual(prepareExistingAllocations(allocations, false), {
    retained: allocations,
    idsToDelete: [],
  });
});

test('converts resource capacity into full-day monthly quotas', () => {
  assert.equal(normalizeCapacityPercentage(undefined), 100);
  assert.equal(normalizeCapacityPercentage(0), 0);
  assert.equal(normalizeCapacityPercentage(150), 100);

  const workingDates = [
    '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-06', '2026-07-07',
    '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-13', '2026-07-14',
    '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07',
  ];
  const quotas = getMonthlyCapacityDays(workingDates, ['2026-07-14'], 50);
  const twentyDayMonth = Array.from({ length: 20 }, (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`);

  assert.equal(quotas.get('2026-07'), 4);
  assert.equal(quotas.get('2026-08'), 2);
  assert.equal(getMonthlyCapacityDays(twentyDayMonth, [], 50).get('2026-09'), 10);
});
