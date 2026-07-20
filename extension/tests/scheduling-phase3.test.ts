import assert from 'node:assert/strict';
import test from 'node:test';
import type { Allocation, Project, Resource } from '../src/db/index.ts';
import { generateSchedulePlan } from '../src/scheduling/engine.ts';

const makeResource = (overrides: Partial<Resource> = {}): Resource => ({
  id: 1,
  name: '开发人员',
  role: '后端工程师',
  capacity: 100,
  skills: [],
  ...overrides,
});

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 1,
  name: '项目',
  businessOwner: '',
  priority: 'Medium',
  status: 'To Do',
  digitalResponsible: '',
  startDate: '2026-07-01',
  endDate: '2026-07-31',
  estimatedGoLiveTime: '',
  comments: '',
  jiraEpicKey: '',
  devTotalMd: 1,
  testTotalMd: 0,
  teamSchedulingMode: 'all-in',
  ...overrides,
});

const allocatedDays = (allocations: Allocation[], projectId: number, workingDays: Set<string>): number => {
  return allocations
    .filter(allocation => allocation.projectId === projectId)
    .reduce((sum, allocation) => sum + Array.from(workingDays)
      .filter(date => date >= allocation.startDate && date <= allocation.endDate).length, 0);
};

test('combines all feasible fragments from the same resource for one project', () => {
  const workingDaySet = new Set(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-06', '2026-07-07']);
  const lockedAllocation: Allocation = {
    resourceId: 1,
    projectId: 99,
    startDate: '2026-07-03',
    endDate: '2026-07-03',
    allocationPercentage: 100,
    allocationType: 'dev',
    isLocked: true,
  };
  const plan = generateSchedulePlan({
    resources: [makeResource()],
    projects: [makeProject({ devTotalMd: 4 })],
    operations: [],
    existingAllocations: [lockedAllocation],
    workingDaySet,
    rangeStart: '2026-07-01',
    rangeEnd: '2026-07-31',
  });
  const projectAllocations = plan.generatedAllocations.filter(allocation => allocation.projectId === 1);

  assert.deepEqual(projectAllocations.map(allocation => [allocation.startDate, allocation.endDate]), [
    ['2026-07-01', '2026-07-02'],
    ['2026-07-06', '2026-07-07'],
  ]);
});

test('prefers an exact-fit fragment before a higher AI score with more wasted capacity', () => {
  const workingDaySet = new Set(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-06', '2026-07-07']);
  const exactFitResource = makeResource({ id: 1, name: '精准碎片人员' });
  const highScoreResource = makeResource({ id: 2, name: '高分人员' });
  const existing: Allocation[] = [{
    resourceId: 1,
    projectId: 99,
    startDate: '2026-07-03',
    endDate: '2026-07-07',
    allocationPercentage: 100,
    allocationType: 'dev',
    isLocked: true,
  }];
  const plan = generateSchedulePlan({
    resources: [exactFitResource, highScoreResource],
    projects: [makeProject({ devTotalMd: 2 })],
    operations: [],
    existingAllocations: existing,
    workingDaySet,
    rangeStart: '2026-07-01',
    rangeEnd: '2026-07-31',
    devScores: [
      { projectId: 1, resourceId: 1, score: 10, reason: '' },
      { projectId: 1, resourceId: 2, score: 100, reason: '' },
    ],
  });

  assert.equal(plan.generatedAllocations.find(allocation => allocation.projectId === 1)?.resourceId, 1);
});

test('schedules the same-priority project with the scarcest candidate pool first', () => {
  const workingDaySet = new Set(['2026-07-01']);
  const teamResource = makeResource({ id: 1, scrumTeamId: 10 });
  const globalResource = makeResource({ id: 2, name: '全局人员', scrumTeamId: 20 });
  const flexibleProject = makeProject({ id: 1, name: '全局项目', teamSchedulingMode: 'all-in' });
  const scarceProject = makeProject({ id: 2, name: '本队项目', scrumTeamId: 10, teamSchedulingMode: 'team-first' });
  const plan = generateSchedulePlan({
    resources: [teamResource, globalResource],
    projects: [flexibleProject, scarceProject],
    operations: [],
    existingAllocations: [],
    workingDaySet,
    rangeStart: '2026-07-01',
    rangeEnd: '2026-07-31',
  });

  assert.equal(plan.generatedAllocations.find(allocation => allocation.projectId === 2)?.resourceId, 1);
  assert.equal(plan.generatedAllocations.find(allocation => allocation.projectId === 1)?.resourceId, 2);
});

test('shares shortage capacity fairly between projects at the same priority', () => {
  const workingDaySet = new Set([
    '2026-07-01', '2026-07-02', '2026-07-03',
    '2026-07-06', '2026-07-07', '2026-07-08',
  ]);
  const firstProject = makeProject({ id: 1, name: '同级项目 A', devTotalMd: 6 });
  const secondProject = makeProject({ id: 2, name: '同级项目 B', devTotalMd: 6 });
  const plan = generateSchedulePlan({
    resources: [makeResource()],
    projects: [firstProject, secondProject],
    operations: [],
    existingAllocations: [],
    workingDaySet,
    rangeStart: '2026-07-01',
    rangeEnd: '2026-07-31',
  });

  assert.equal(allocatedDays(plan.generatedAllocations, 1, workingDaySet), 3);
  assert.equal(allocatedDays(plan.generatedAllocations, 2, workingDaySet), 3);
  assert.equal(plan.priorityInversions, 0);
  assert.equal(plan.residualAllocations, 0);
});
