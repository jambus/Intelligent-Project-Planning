import assert from 'node:assert/strict';
import test from 'node:test';
import type { Allocation, Project, Resource } from '../src/db/index.ts';
import { createScheduleAudit } from '../src/scheduling/audit.ts';
import { generateSchedulePlan } from '../src/scheduling/engine.ts';

const resource = (id: number): Resource => ({
  id,
  name: `开发人员 ${id}`,
  role: '后端工程师',
  capacity: 100,
  skills: [],
});

const project = (id: number, priority: string, devTotalMd: number): Project => ({
  id,
  name: `项目 ${id}`,
  businessOwner: '',
  priority,
  status: 'To Do',
  digitalResponsible: '',
  startDate: '2026-07-01',
  endDate: '2026-08-31',
  estimatedGoLiveTime: '',
  comments: '',
  jiraEpicKey: '',
  devTotalMd,
  testTotalMd: 0,
  teamSchedulingMode: 'all-in',
});

const workingDays = (count: number): Set<string> => {
  const dates = new Set<string>();
  const date = new Date(2026, 6, 1);
  while (dates.size < count) {
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.add(`${date.getFullYear()}-${month}-${day}`);
    }
    date.setDate(date.getDate() + 1);
  }
  return dates;
};

test('reports overload, matchable idle capacity, and completion by priority', () => {
  const dates = workingDays(4);
  const projects = [project(1, 'P0', 2), project(2, 'Low', 2)];
  const allocations: Allocation[] = [{
    id: 1,
    resourceId: 1,
    projectId: 1,
    startDate: '2026-07-01',
    endDate: '2026-07-01',
    allocationPercentage: 200,
    allocationType: 'dev',
  }];
  const report = createScheduleAudit(projects, [resource(1), resource(2)], allocations, dates);

  assert.equal(report.overloads, 1);
  assert.equal(report.matchableIdleMd, 2);
  assert.deepEqual(report.priorityCompletion.map(item => item.priority), ['P0', 'Low']);
  assert.equal(report.priorityCompletion[0].completionRate, 100);
  assert.equal(report.priorityCompletion[1].completionRate, 0);
});

test('representative schedule is deterministic, overload-free, and measurably utilizes capacity', () => {
  const dates = workingDays(30);
  const resources = Array.from({ length: 20 }, (_, index) => resource(index + 1));
  const priorities = ['Must Win', 'P0', 'Compliance', 'High', 'Medium', 'Low'];
  const projects = Array.from({ length: 60 }, (_, index) => project(index + 1, priorities[index % priorities.length], 5));
  const input = {
    resources,
    projects,
    operations: [],
    existingAllocations: [],
    workingDaySet: dates,
    rangeStart: '2026-07-01',
    rangeEnd: '2026-08-31',
  };

  const startedAt = performance.now();
  const first = generateSchedulePlan(input);
  const second = generateSchedulePlan(input);
  const elapsedMs = performance.now() - startedAt;
  const report = createScheduleAudit(projects, resources, first.generatedAllocations, dates);

  assert.deepEqual(second.generatedAllocations, first.generatedAllocations);
  assert.equal(first.priorityInversions, 0);
  assert.equal(report.priorityInversions, 0);
  assert.equal(report.overloads, 0);
  assert.equal(report.matchableIdleMd, 0);
  assert.equal(report.utilizationRate, 50);
  assert.ok(first.generatedAllocations.length > 0);
  assert.ok(elapsedMs < 2000, `representative schedule took ${elapsedMs.toFixed(1)}ms`);
});
