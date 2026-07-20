import assert from 'node:assert/strict';
import test from 'node:test';
import type { Allocation, Project, Resource } from '../src/db/index.ts';
import { buildResourceCalendars, getMonthlyRemainingCapacityDays, getResourceIdleMd } from '../src/scheduling/calendar.ts';
import { getAllowedResourceIds, getEligibleResources } from '../src/scheduling/constraints.ts';
import { generateSchedulePlan } from '../src/scheduling/engine.ts';

const makeResource = (overrides: Partial<Resource> = {}): Resource => ({
  id: 1,
  name: '张三',
  role: '后端工程师',
  capacity: 100,
  skills: [],
  ...overrides,
});

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 1,
  name: '项目',
  businessOwner: '',
  priority: 'High',
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

test('builds a pure monthly-capacity calendar from an immutable snapshot', () => {
  const resource = makeResource({ capacity: 50 });
  const workingDays = new Set([
    '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-06', '2026-07-07',
    '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-13', '2026-07-14',
  ]);
  const existing: Allocation[] = [{
    resourceId: 1,
    projectId: 99,
    startDate: '2026-07-01',
    endDate: '2026-07-01',
    allocationPercentage: 100,
    allocationType: 'dev',
  }];

  const calendars = buildResourceCalendars([resource], existing, workingDays);
  const calendar = calendars.get(1)!;

  assert.equal(getMonthlyRemainingCapacityDays(calendar).get('2026-07'), 4);
  assert.equal(getResourceIdleMd(calendar), 4);
  assert.equal(existing[0].allocationPercentage, 100);
});

test('centralizes role and team constraints for strict and relaxed matching', () => {
  const ownTeam = makeResource({ id: 1, scrumTeamId: 10 });
  const otherTeam = makeResource({ id: 2, name: '李四', scrumTeamId: 20 });
  const tester = makeResource({ id: 3, name: '王五', role: '测试工程师', scrumTeamId: 10 });
  const project = makeProject({ scrumTeamId: 10, teamSchedulingMode: 'cross-team' });
  const resources = [ownTeam, otherTeam, tester];

  assert.deepEqual(Array.from(getAllowedResourceIds(project, resources, false)), [1, 3]);
  assert.deepEqual(Array.from(getAllowedResourceIds(project, resources, true)), [1, 2, 3]);
  assert.deepEqual(getEligibleResources(project, resources, 'dev', false).map(resource => resource.id), [1]);
  assert.deepEqual(getEligibleResources(project, resources, 'test', false).map(resource => resource.id), [3]);
});

test('finishes the high-priority relaxed pass before scheduling a lower-priority project', () => {
  const workingDaySet = new Set(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-06', '2026-07-07']);
  const resource = makeResource({ id: 1, scrumTeamId: 20 });
  const highPriority = makeProject({
    id: 1,
    name: '高优先级跨团队项目',
    priority: 'P0',
    scrumTeamId: 10,
    teamSchedulingMode: 'cross-team',
    devTotalMd: 5,
  });
  const lowPriority = makeProject({
    id: 2,
    name: '低优先级全局项目',
    priority: 'Low',
    teamSchedulingMode: 'all-in',
    devTotalMd: 5,
  });
  const input = {
    resources: [resource],
    projects: [lowPriority, highPriority],
    operations: [],
    existingAllocations: [],
    workingDaySet,
    rangeStart: '2026-07-01',
    rangeEnd: '2026-07-31',
  };

  const firstPlan = generateSchedulePlan(input);
  const secondPlan = generateSchedulePlan(input);

  assert.deepEqual(firstPlan.generatedAllocations, secondPlan.generatedAllocations);
  assert.equal(firstPlan.priorityInversions, 0);
  assert.equal(firstPlan.generatedAllocations.filter(allocation => allocation.projectId === 1).length, 1);
  assert.equal(firstPlan.generatedAllocations.filter(allocation => allocation.projectId === 2).length, 0);
  assert.deepEqual(firstPlan.generatedAllocations[0], {
    resourceId: 1,
    projectId: 1,
    allocationPercentage: 100,
    startDate: '2026-07-01',
    endDate: '2026-07-07',
    allocationType: 'dev',
  });
});
