const VALUE_BASELINE_TIME_ZONE = 'America/Vancouver';

export const WEEKLY_MOMENTUM_BASELINE_FLOOR_DATE_KEY = '2026-05-07';
export const WEEKLY_MOMENTUM_MIN_BASELINE_VALUE = 250;
export const WEEKLY_MOMENTUM_MIN_CURRENT_VALUE = 250;
export const WEEKLY_MOMENTUM_MIN_ABSOLUTE_CHANGE = 75;

function getDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VALUE_BASELINE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getDaysAgoDate(daysAgo: number, now = new Date()): Date {
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() - daysAgo);
  return targetDate;
}

export function getWeeklyMomentumBaselineTargetDateKey(daysAgo = 7, now = new Date()): string {
  const targetDateKey = getDateKey(getDaysAgoDate(daysAgo, now));
  return targetDateKey < WEEKLY_MOMENTUM_BASELINE_FLOOR_DATE_KEY
    ? WEEKLY_MOMENTUM_BASELINE_FLOOR_DATE_KEY
    : targetDateKey;
}

export function isWeeklyMomentumBaselineFloorActive(daysAgo = 7, now = new Date()): boolean {
  return getDateKey(getDaysAgoDate(daysAgo, now)) < WEEKLY_MOMENTUM_BASELINE_FLOOR_DATE_KEY;
}

export function getWeeklyMomentumBaselineTargetDate(daysAgo = 7, now = new Date()): Date {
  const targetDate = getDaysAgoDate(daysAgo, now);
  targetDate.setHours(23, 59, 59, 999);

  const floorDate = new Date('2026-05-07T23:59:59.999-07:00');
  return targetDate < floorDate ? floorDate : targetDate;
}

export function getWeeklyMomentumBaselineFloorStartDate(): Date {
  return new Date('2026-05-07T00:00:00.000-07:00');
}

export function getWeeklyMomentumPctChange(currentValue: number, baselineValue: number): number | null {
  if (!Number.isFinite(currentValue) || !Number.isFinite(baselineValue)) return null;
  if (currentValue < WEEKLY_MOMENTUM_MIN_CURRENT_VALUE) return null;
  if (baselineValue < WEEKLY_MOMENTUM_MIN_BASELINE_VALUE) return null;

  const diff = currentValue - baselineValue;
  if (diff === 0) return 0;

  return (diff / baselineValue) * 100;
}
