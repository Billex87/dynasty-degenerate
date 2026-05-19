export const FANTASYPROS_ENDPOINT_SNAPSHOT_TIME_ZONE = 'America/Vancouver';
export const FANTASYPROS_ENDPOINT_SNAPSHOT_WEEKDAY = 'Tue';
export const FANTASYPROS_ENDPOINT_SNAPSHOT_HOUR = 12;

export function getPacificScheduleParts(date: Date): {
  dateKey: string;
  weekday: string;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FANTASYPROS_ENDPOINT_SNAPSHOT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const value = (type: string) => parts.find((part) => part.type === type)?.value || '00';

  return {
    dateKey: `${value('year')}-${value('month')}-${value('day')}`,
    weekday: value('weekday'),
    hour: Number(value('hour')),
    minute: Number(value('minute')),
  };
}

export function isFantasyProsEndpointSnapshotWindow(date: Date): boolean {
  const { weekday, hour, minute } = getPacificScheduleParts(date);
  return weekday === FANTASYPROS_ENDPOINT_SNAPSHOT_WEEKDAY
    && hour === FANTASYPROS_ENDPOINT_SNAPSHOT_HOUR
    && minute === 0;
}

export function getFantasyProsEndpointSnapshotScheduleLabel(): string {
  return `${FANTASYPROS_ENDPOINT_SNAPSHOT_WEEKDAY}s at ${String(FANTASYPROS_ENDPOINT_SNAPSHOT_HOUR).padStart(2, '0')}:00 ${FANTASYPROS_ENDPOINT_SNAPSHOT_TIME_ZONE}`;
}
