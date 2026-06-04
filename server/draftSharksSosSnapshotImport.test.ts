import { afterEach, describe, expect, it, vi } from 'vitest';
import * as db from './db';
import {
  clearDraftSharksScheduleCacheForTests,
  getDraftSharksScheduleProfile,
  loadDraftSharksScheduleContext,
} from './draftSharksSchedule';
import {
  buildDraftSharksSosSnapshotImport,
  parseDraftSharksSosImportRows,
} from './draftSharksSosSnapshotImport';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  clearDraftSharksScheduleCacheForTests();
  vi.restoreAllMocks();
});

describe('DraftSharks SOS snapshot import', () => {
  it('parses CSV exports and builds the stored snapshot payload', () => {
    const rows = parseDraftSharksSosImportRows({
      fileName: 'draftsharks-sos.csv',
      text: [
        'team,position,seasonSOS,remainingSOS,week1,week2,streamer_weeks,avoid_weeks,updated_at',
        'MIA,WR,66,8.5,"19.1% NE","-12.4% @ BUF","1, 3",2,2026-06-04T12:00:00.000Z',
        'NYJ,RB,31,-9.8,"-18.1% PIT","10.2% @ MIA",4,"1, 5",2026-06-04T12:00:00.000Z',
      ].join('\n'),
    });
    const snapshot = buildDraftSharksSosSnapshotImport({
      rows,
      season: 2026,
      sourceVersion: 'manual-2026-06-04',
      importedAt: '2026-06-04T18:00:00.000Z',
      sourceFile: 'draftsharks-sos.csv',
    });

    expect(snapshot).toMatchObject({
      sourceKey: 'draftsharks-sos-v1',
      snapshotKey: '2026:manual-2026-06-04',
      rowCount: 2,
      profileCount: 2,
    });
    expect(snapshot.payload.context.profiles['MIA:WR']).toMatchObject({
      team: 'MIA',
      position: 'WR',
      seasonSOS: 66,
      remainingSOS: 8.5,
      streamerWeeks: [1, 3],
      avoidWeeks: [2],
      weeklyMatchups: [
        expect.objectContaining({
          week: 1,
          opponent: 'NE',
          matchupPercent: 19.1,
        }),
        expect.objectContaining({
          week: 2,
          opponent: 'BUF',
          homeAway: 'away',
          matchupPercent: -12.4,
        }),
      ],
    });
  });

  it('parses JSON row exports', () => {
    const rows = parseDraftSharksSosImportRows({
      fileName: 'draftsharks-sos.json',
      text: JSON.stringify({
        rows: [{
          team_abbr: 'KC',
          pos: 'QB',
          sos_score: 72,
          targetWeeks: [5, 9],
          week1: '11.2% LV',
        }],
      }),
    });
    const snapshot = buildDraftSharksSosSnapshotImport({
      rows,
      season: '2026',
      sourceVersion: 'json-export',
      importedAt: '2026-06-04T18:00:00.000Z',
    });

    expect(snapshot.profileCount).toBe(1);
    expect(snapshot.payload.context.profiles['KC:QB']).toMatchObject({
      seasonSOS: 72,
      streamerWeeks: [5, 9],
    });
  });

  it('produces snapshots that the report-time DraftSharks snapshot loader can read without live config', async () => {
    process.env.ENABLE_DRAFTSHARKS_SOS = 'true';
    process.env.DRAFTSHARKS_API_KEY = '';
    process.env.DRAFTSHARKS_SOS_URL = '';

    const rows = parseDraftSharksSosImportRows({
      fileName: 'draftsharks-sos.tsv',
      text: [
        'team\tposition\tseasonSOS\tweek1',
        'KC\tQB\t72\t11.2% LV',
      ].join('\n'),
    });
    const snapshot = buildDraftSharksSosSnapshotImport({
      rows,
      season: 2026,
      sourceVersion: 'tsv-copy',
      importedAt: '2026-06-04T18:00:00.000Z',
    });

    vi.spyOn(db, 'findLatestProviderDataSnapshot').mockResolvedValue({
      snapshotKey: snapshot.snapshotKey,
      updatedAt: new Date('2026-06-04T18:00:00.000Z'),
      payload: JSON.stringify(snapshot.payload),
    });

    const context = await loadDraftSharksScheduleContext({
      sourceMode: 'snapshot',
    });

    expect(context.status).toBe('loaded');
    expect(getDraftSharksScheduleProfile(context, 'KC', 'QB')).toMatchObject({
      seasonSOS: 72,
      weeklyMatchups: [
        expect.objectContaining({
          week: 1,
          opponent: 'LV',
          matchupPercent: 11.2,
        }),
      ],
    });
  });
});
