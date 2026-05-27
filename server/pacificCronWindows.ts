export const PACIFIC_TIME_ZONE = 'America/Vancouver';
export const LEAGUE_REPORT_SNAPSHOT_HOURS: readonly number[] = [8, 16];
export const PLAYER_NEWS_REFRESH_HOURS: readonly number[] = [8];
export const PLAYER_NEWS_REFRESH_MINUTE = 10;

export type PacificCronDateParts = {
  dateKey: string;
  hour: number;
  minute: number;
};

export function getPacificCronDateParts(date: Date): PacificCronDateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const value = (type: string) => parts.find((part) => part.type === type)?.value || '00';

  return {
    dateKey: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
    minute: Number(value('minute')),
  };
}

export function getPacificHour(date: Date): number {
  return getPacificCronDateParts(date).hour;
}

export function isLeagueReportSnapshotWindow(date: Date): boolean {
  return LEAGUE_REPORT_SNAPSHOT_HOURS.includes(getPacificHour(date));
}

export function isLocalLeagueReportSnapshotTick(date: Date): boolean {
  const { hour, minute } = getPacificCronDateParts(date);
  return LEAGUE_REPORT_SNAPSHOT_HOURS.includes(hour) && minute === 0;
}

export function isLocalPlayerNewsRefreshTick(date: Date): boolean {
  const { hour, minute } = getPacificCronDateParts(date);
  return PLAYER_NEWS_REFRESH_HOURS.includes(hour) && minute === PLAYER_NEWS_REFRESH_MINUTE;
}
