/**
 * Date and Working Day Utilities
 */

// 2026 Chinese Public Holidays (Example for the prompt)
// Simplified list for demo purposes
export let HOLIDAYS = [
  '2026-01-01', // New Year
  '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23', // Spring Festival
  '2026-04-04', '2026-04-05', '2026-04-06', // Qingming Festival
  '2026-05-01', '2026-05-02', '2026-05-03', // Labor Day
  '2026-06-19', '2026-06-20', '2026-06-21', // Dragon Boat Festival
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', // National Day
];

// Special Workdays (Saturdays/Sundays that are workdays)
export let SPECIAL_WORKDAYS = [
  '2026-02-15', '2026-03-01', // Spring Festival adjustments
];

export const updateHolidaysConfig = (holidays: string[], specialWorkdays: string[]) => {
  HOLIDAYS = holidays;
  SPECIAL_WORKDAYS = specialWorkdays;
};

/**
 * Check if a string is a valid date
 */
export const isValidDateStr = (dateStr: string | undefined | null): boolean => {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
};

/**
 * Check if a date is a working day
 */
export const isWorkingDay = (date: Date): boolean => {
  if (isNaN(date.getTime())) return false;
  const dateStr = date.toISOString().split('T')[0];
  const day = date.getDay(); // 0 is Sunday, 6 is Saturday

  // If it's a special workday, return true
  if (SPECIAL_WORKDAYS.includes(dateStr)) return true;

  // If it's a holiday, return false
  if (HOLIDAYS.includes(dateStr)) return false;

  // Otherwise, return true if it's a weekday
  return day !== 0 && day !== 6;
};

/**
 * Get the number of working days between two dates (inclusive)
 */
export const getWorkingDays = (start: Date, end: Date): number => {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (isWorkingDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

/**
 * Calculate allocated man-days for a specific month
 */
export const calculateMonthlyMD = (
  allocationStart: string,
  allocationEnd: string,
  percentage: number,
  year: number,
  month: number // 1-12
): number => {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const start = new Date(allocationStart);
  const end = new Date(allocationEnd);

  // Intersection of allocation and month
  const overlapStart = start > monthStart ? start : monthStart;
  const overlapEnd = end < monthEnd ? end : monthEnd;

  if (overlapStart > overlapEnd) return 0;

  const workingDays = getWorkingDays(overlapStart, overlapEnd);
  return (workingDays * percentage) / 100;
};

/**
 * Get month names for display
 */
export const getMonthLabel = (year: number, month: number): string => {
  return `${year}-${month.toString().padStart(2, '0')}`;
};

/**
 * Calculate the end date given a start date, required MDs, and allocation percentage.
 */
export const calculateEndDate = (startDateStr: string, mdNeeded: number, percentage: number): string => {
  if (mdNeeded <= 0) return startDateStr;
  const workingDaysNeeded = Math.ceil((mdNeeded * 100) / percentage);
  
  const current = new Date(startDateStr);
  let daysAdded = 0;
  
  // Find valid working days
  while (true) {
    if (isWorkingDay(current)) {
      daysAdded++;
      if (daysAdded >= workingDaysNeeded) break;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return current.toISOString().split('T')[0];
};

