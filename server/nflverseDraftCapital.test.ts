import { afterEach, describe, expect, it, vi } from 'vitest';
import * as db from './db';
import {
  buildNflverseDraftCapitalBySleeperId,
  clearNflverseDraftCapitalCacheForTests,
  enrichPlayerDetailsWithNflverseDraftCapital,
  loadNflverseDraftCapitalSnapshot,
  normalizeNflverseDraftCapitalRows,
  NFLVERSE_DRAFT_CAPITAL_SOURCE_KEY,
} from './nflverseDraftCapital';

afterEach(() => {
  clearNflverseDraftCapitalCacheForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('nflverse draft capital snapshots', () => {
  it('normalizes ffverse player ID rows into fantasy draft-capital rows', () => {
    const rows = normalizeNflverseDraftCapitalRows([
      {
        sleeper_id: '12522',
        gsis_id: '00-0040001',
        fantasypros_id: '24755',
        espn_id: '4688380',
        name: 'First Round Rookie',
        merge_name: 'first round rookie',
        position: 'WR',
        team: 'LVR',
        draft_year: '2026',
        draft_round: '1',
        draft_pick: '1',
        draft_ovr: '1',
        college: 'Indiana',
        db_season: '2026',
      },
      {
        sleeper_id: '999',
        name: 'Ignored Lineman',
        position: 'OL',
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        sleeperId: '12522',
        gsisId: '00-0040001',
        fantasyProsId: '24755',
        position: 'WR',
        draftYear: 2026,
        draftRound: 1,
        draftOverall: 1,
        college: 'Indiana',
      }),
    ]);
  });

  it('enriches player details by Sleeper ID for cohort runway reads', () => {
    const rows = normalizeNflverseDraftCapitalRows([
      {
        sleeper_id: '12522',
        gsis_id: '00-0040001',
        espn_id: '4688380',
        fantasypros_id: '24755',
        name: 'First Round Rookie',
        position: 'WR',
        team: 'LVR',
        birthdate: '2003-10-01',
        draft_year: '2026',
        draft_round: '1',
        draft_ovr: '1',
        college: 'Indiana',
      },
    ]);

    const enriched = enrichPlayerDetailsWithNflverseDraftCapital(
      {
        '12522': {
          playerId: '12522',
          fullName: 'First Round Rookie',
          position: 'WR',
          externalIds: {},
        },
      },
      buildNflverseDraftCapitalBySleeperId({
        schemaVersion: 1,
        source: 'nflverse ffverse player IDs',
        sourceUrl: 'test',
        generatedAt: '2026-05-17T00:00:00.000Z',
        snapshotKey: '2026-05-17',
        rowCount: rows.length,
        rows,
      })
    );

    expect(enriched['12522']).toMatchObject({
      rookieYear: 2026,
      nflDraftRound: 1,
      nflDraftPick: 1,
      college: 'Indiana',
      externalIds: {
        gsis: '00-0040001',
        espn: '4688380',
        fantasyPros: '24755',
      },
    });
  });

  it('persists a live public snapshot without printing raw provider payloads', async () => {
    vi.spyOn(db, 'upsertProviderDataSnapshot').mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => [
        'sleeper_id,gsis_id,fantasypros_id,espn_id,name,merge_name,position,team,birthdate,age,draft_year,draft_round,draft_pick,draft_ovr,college,db_season',
        '12522,00-0040001,24755,4688380,First Round Rookie,first round rookie,WR,LVR,2003-10-01,22.6,2026,1,1,1,Indiana,2026',
      ].join('\n'),
    })));

    const snapshot = await loadNflverseDraftCapitalSnapshot({ persistSnapshot: true, forceRefresh: true });

    expect(snapshot.rowCount).toBe(1);
    expect(db.upsertProviderDataSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: NFLVERSE_DRAFT_CAPITAL_SOURCE_KEY,
      snapshotKey: expect.any(String),
      payload: expect.stringContaining('"rowCount":1'),
    }));
  });
});
