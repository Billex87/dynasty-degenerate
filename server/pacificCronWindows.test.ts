import { describe, expect, it } from 'vitest';
import {
  getPacificCronDateParts,
  isLeagueReportSnapshotWindow,
  isLocalLeagueReportSnapshotTick,
  isLocalPlayerNewsRefreshTick,
} from './pacificCronWindows';

describe('Pacific cron windows', () => {
  it('detects 8 AM and 4 PM league report windows during daylight time', () => {
    expect(getPacificCronDateParts(new Date('2026-05-27T15:00:00.000Z'))).toMatchObject({
      dateKey: '2026-05-27',
      hour: 8,
      minute: 0,
    });
    expect(isLeagueReportSnapshotWindow(new Date('2026-05-27T15:00:00.000Z'))).toBe(true);
    expect(isLeagueReportSnapshotWindow(new Date('2026-05-27T23:00:00.000Z'))).toBe(true);
    expect(isLeagueReportSnapshotWindow(new Date('2026-05-27T16:00:00.000Z'))).toBe(false);
  });

  it('detects 8 AM and 4 PM league report windows during standard time', () => {
    expect(getPacificCronDateParts(new Date('2026-01-05T16:00:00.000Z'))).toMatchObject({
      dateKey: '2026-01-05',
      hour: 8,
      minute: 0,
    });
    expect(isLeagueReportSnapshotWindow(new Date('2026-01-05T16:00:00.000Z'))).toBe(true);
    expect(isLeagueReportSnapshotWindow(new Date('2026-01-06T00:00:00.000Z'))).toBe(true);
    expect(isLeagueReportSnapshotWindow(new Date('2026-01-05T15:00:00.000Z'))).toBe(false);
  });

  it('keeps local interval jobs minute-specific', () => {
    expect(isLocalLeagueReportSnapshotTick(new Date('2026-05-27T15:00:00.000Z'))).toBe(true);
    expect(isLocalLeagueReportSnapshotTick(new Date('2026-05-27T15:15:00.000Z'))).toBe(false);
    expect(isLocalPlayerNewsRefreshTick(new Date('2026-05-27T15:10:00.000Z'))).toBe(true);
    expect(isLocalPlayerNewsRefreshTick(new Date('2026-05-27T15:00:00.000Z'))).toBe(false);
  });
});
