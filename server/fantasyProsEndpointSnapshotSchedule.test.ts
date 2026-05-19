import { describe, expect, it } from 'vitest';
import {
  getFantasyProsEndpointSnapshotScheduleLabel,
  getPacificScheduleParts,
  isFantasyProsEndpointSnapshotWindow,
} from './fantasyProsEndpointSnapshotSchedule';

describe('FantasyPros endpoint snapshot schedule', () => {
  it('detects Tuesday noon in Vancouver during daylight time', () => {
    const date = new Date('2026-09-08T19:00:00.000Z');

    expect(getPacificScheduleParts(date)).toMatchObject({
      dateKey: '2026-09-08',
      weekday: 'Tue',
      hour: 12,
      minute: 0,
    });
    expect(isFantasyProsEndpointSnapshotWindow(date)).toBe(true);
  });

  it('detects Tuesday noon in Vancouver during standard time', () => {
    expect(isFantasyProsEndpointSnapshotWindow(new Date('2026-11-10T20:00:00.000Z'))).toBe(true);
    expect(isFantasyProsEndpointSnapshotWindow(new Date('2026-11-10T19:00:00.000Z'))).toBe(false);
  });

  it('labels the schedule for cron responses', () => {
    expect(getFantasyProsEndpointSnapshotScheduleLabel()).toBe('Tues at 12:00 America/Vancouver');
  });
});
