import type { Allocation, Resource } from '../db';
import { getISOWeekYear, getWeekNumber } from '../utils/dateUtils.ts';
import { getMonthlyCapacityDays } from '../utils/capacity.ts';

export interface DailySlot {
  date: string;
  monthKey: string;
  weekKey: string;
  totalCapacity: number;
  usedCapacity: number;
  available: number;
  assignedNonOpProjects: Set<number>;
  monthlyCapacityDays: number;
}

export type ResourceCalendars = Map<number, DailySlot[]>;

export const buildResourceCalendars = (
  resources: Resource[],
  allocations: Allocation[],
  workingDates: Iterable<string>,
): ResourceCalendars => {
  const dates = Array.from(workingDates).sort();
  const calendars: ResourceCalendars = new Map();

  resources.forEach(resource => {
    if (resource.id === undefined) return;
    const leaveDays = new Set(resource.unavailableDates || []);
    const monthlyCapacity = getMonthlyCapacityDays(dates, leaveDays, resource.capacity);
    const resourceAllocations = allocations.filter(allocation => Number(allocation.resourceId) === Number(resource.id));
    const weekProjects = new Map<string, Set<number>>();

    const calendar = dates.map(date => {
      const parsedDate = new Date(date);
      const monthKey = date.slice(0, 7);
      const weekKey = `${getISOWeekYear(parsedDate)}-W${getWeekNumber(parsedDate)}`;
      const totalCapacity = leaveDays.has(date) ? 0 : 100;
      let usedCapacity = 0;
      const assignedProjects = new Set<number>();

      resourceAllocations.forEach(allocation => {
        if (date < allocation.startDate || date > allocation.endDate) return;
        usedCapacity += allocation.allocationPercentage || 0;
        if (allocation.projectId > 0) assignedProjects.add(Number(allocation.projectId));
      });

      if (!weekProjects.has(weekKey)) weekProjects.set(weekKey, new Set());
      assignedProjects.forEach(projectId => weekProjects.get(weekKey)!.add(projectId));

      return {
        date,
        monthKey,
        weekKey,
        totalCapacity,
        usedCapacity,
        available: Math.max(0, totalCapacity - usedCapacity),
        assignedNonOpProjects: assignedProjects,
        monthlyCapacityDays: monthlyCapacity.get(monthKey) || 0,
      };
    });

    calendar.forEach(slot => {
      slot.assignedNonOpProjects = weekProjects.get(slot.weekKey) || new Set();
    });
    calendars.set(resource.id, calendar);
  });

  return calendars;
};

export const applyAllocationToCalendar = (calendar: DailySlot[], allocation: Allocation): void => {
  const affectedWeeks = new Set<string>();
  calendar.forEach(slot => {
    if (slot.date < allocation.startDate || slot.date > allocation.endDate) return;
    slot.usedCapacity += allocation.allocationPercentage;
    slot.available = Math.max(0, slot.totalCapacity - slot.usedCapacity);
    affectedWeeks.add(slot.weekKey);
  });

  if (allocation.projectId > 0) {
    calendar.forEach(slot => {
      if (affectedWeeks.has(slot.weekKey)) {
        slot.assignedNonOpProjects.add(Number(allocation.projectId));
      }
    });
  }
};

export const getMonthlyRemainingCapacityDays = (calendar: DailySlot[]): Map<string, number> => {
  const remaining = new Map<string, number>();
  const occupiedDays = new Map<string, number>();

  calendar.forEach(slot => {
    remaining.set(slot.monthKey, slot.monthlyCapacityDays);
    if (slot.usedCapacity > 0) {
      occupiedDays.set(slot.monthKey, (occupiedDays.get(slot.monthKey) || 0) + 1);
    }
  });
  occupiedDays.forEach((used, monthKey) => {
    remaining.set(monthKey, Math.max(0, (remaining.get(monthKey) || 0) - used));
  });
  return remaining;
};

export const getResourceIdleMd = (calendar: DailySlot[]): number => {
  const remaining = getMonthlyRemainingCapacityDays(calendar);
  const freeDays = new Map<string, number>();
  calendar.forEach(slot => {
    if (slot.available >= 100) {
      freeDays.set(slot.monthKey, (freeDays.get(slot.monthKey) || 0) + 1);
    }
  });
  return Array.from(remaining).reduce(
    (sum, [monthKey, quota]) => sum + Math.min(quota, freeDays.get(monthKey) || 0),
    0,
  );
};
