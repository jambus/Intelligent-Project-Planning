export const normalizeCapacityPercentage = (capacity: number | null | undefined): number => {
  if (capacity === null || capacity === undefined) return 100;
  const value = Number(capacity);
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(0, value));
};

export const getMonthlyCapacityDays = (
  workingDates: Iterable<string>,
  unavailableDates: Iterable<string>,
  capacity: number | null | undefined,
): Map<string, number> => {
  const unavailable = new Set(unavailableDates);
  const activeDaysByMonth = new Map<string, number>();

  for (const date of workingDates) {
    if (unavailable.has(date)) continue;
    const monthKey = date.slice(0, 7);
    activeDaysByMonth.set(monthKey, (activeDaysByMonth.get(monthKey) || 0) + 1);
  }

  const percentage = normalizeCapacityPercentage(capacity);
  return new Map(
    Array.from(activeDaysByMonth, ([monthKey, activeDays]) => [
      monthKey,
      Math.floor((activeDays * percentage) / 100),
    ]),
  );
};
