/**
 * Date and Working Day Utilities
 */

// 2026 Chinese Public Holidays (Example for the prompt)
// Simplified list for demo purposes
const defaultHolidays = [
  '2026-01-01', // New Year
  '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23', // Spring Festival
  '2026-04-04', '2026-04-05', '2026-04-06', // Qingming Festival
  '2026-05-01', '2026-05-02', '2026-05-03', // Labor Day
  '2026-06-19', '2026-06-20', '2026-06-21', // Dragon Boat Festival
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', // National Day
];

// Special Workdays (Saturdays/Sundays that are workdays)
const defaultSpecialWorkdays = [
  '2026-02-15', '2026-03-01', // Spring Festival adjustments
];

export let HOLIDAYS = new Set<string>(defaultHolidays);
export let SPECIAL_WORKDAYS = new Set<string>(defaultSpecialWorkdays);

export const updateHolidaysConfig = (holidays: string[], specialWorkdays: string[]) => {
  HOLIDAYS = new Set(holidays);
  SPECIAL_WORKDAYS = new Set(specialWorkdays);
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
  if (SPECIAL_WORKDAYS.has(dateStr)) return true;

  // If it's a holiday, return false
  if (HOLIDAYS.has(dateStr)) return false;

  // Otherwise, return true if it's a weekday
  return day !== 0 && day !== 6;
};

/**
 * Get the number of working days between two dates (inclusive)
 */
export const getWorkingDays = (start: Date, end: Date, workingDaySet?: Set<string>): number => {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    if (workingDaySet) {
      if (workingDaySet.has(dateStr)) {
        count++;
      }
    } else {
      if (isWorkingDay(current)) {
        count++;
      }
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

/**
 * Get ISO week number
 */
export const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

/**
 * Get ISO week year
 */
export const getISOWeekYear = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
};

/**
 * Get all weeks within a given month range
 */
export const getWeeksInRange = (startMonth: number, endMonth: number, year: number): { year: number, week: number, label: string, month: number }[] => {
  const start = new Date(year, startMonth - 1, 1);
  const end = new Date(year, endMonth, 0);
  
  const weeks: { year: number, week: number, label: string, month: number }[] = [];
  const current = new Date(start);
  
  while (current <= end) {
    const wYear = getISOWeekYear(current);
    const wNum = getWeekNumber(current);
    const label = `W${wNum.toString().padStart(2, '0')}`;
    
    if (!weeks.some(w => w.year === wYear && w.week === wNum)) {
      const jan4 = new Date(wYear, 0, 4);
      const day = jan4.getDay() || 7;
      const weekStart = new Date(jan4);
      weekStart.setDate(jan4.getDate() - day + 1 + (wNum - 1) * 7);
      
      weeks.push({ year: wYear, week: wNum, label, month: weekStart.getMonth() + 1 });
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return weeks;
};

/**
 * Calculate allocated man-days for a specific week
 */
export const calculateWeeklyMD = (
  allocationStart: string,
  allocationEnd: string,
  percentage: number,
  weekYear: number,
  weekNumber: number
): number => {
  const start = new Date(allocationStart);
  const end = new Date(allocationEnd);
  
  const jan4 = new Date(weekYear, 0, 4);
  const day = jan4.getDay() || 7; // 1-7
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - day + 1 + (weekNumber - 1) * 7);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  const overlapStart = start > weekStart ? start : weekStart;
  const overlapEnd = end < weekEnd ? end : weekEnd;
  
  if (overlapStart > overlapEnd) return 0;
  
  const workingDays = getWorkingDays(overlapStart, overlapEnd);
  return (workingDays * percentage) / 100;
};

