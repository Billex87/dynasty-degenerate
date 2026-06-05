import { describe, expect, it } from 'vitest';
import { probeSleeperMatchupContextReadiness } from './sleeperMatchupContextReadiness';
import type { PlayerProjectionSnapshotPayload } from './playerProjectionSnapshots';

function projectionSnapshot(playerIds: string[]): PlayerProjectionSnapshotPayload {
  return {
    schemaVersion: 1,
    sourceKey: 'player-projection-snapshots-v1:sleeper:PPR:weekly',
    snapshotKey: '2026:1:sleeper-ppr-2026-w1',
    source: 'sleeper',
    scoringProfile: 'PPR',
    projectionType: 'weekly',
    sourceVersion: 'sleeper-ppr-2026-w1',
    season: '2026',
    week: 1,
    fetchedAt: '2026-06-05T00:00:00.000Z',
    publishedAt: null,
    validForWeek: 1,
    providerUpdatedAt: null,
    rowCount: playerIds.length,
    positionCoverage: { QB: playerIds.length },
    missingStarterCount: null,
    sourceError: null,
    staleReason: null,
    checksum: 'fixture',
    parserVersion: 1,
    rows: playerIds.map((playerId, index) => ({
      sourcePlayerId: playerId,
      playerId,
      playerName: `Player ${index + 1}`,
      position: 'QB',
      team: 'BUF',
      opponent: 'MIA',
      week: 1,
      season: '2026',
      projectedFantasyPoints: 10 + index,
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      source: 'sleeper',
      providerUpdatedAt: null,
      gameId: null,
      homeAway: null,
      identityStatus: 'matched',
      sourceTrace: ['fixture'],
      note: 'fixture',
    })),
    quarantinedRows: [],
    identityDiagnostics: {
      status: 'ready',
      totalRows: playerIds.length,
      normalizedRows: playerIds.length,
      quarantinedRows: 0,
      matchedRows: playerIds.length,
      sourceOnlyRows: 0,
      ambiguousRows: 0,
      missingIdentityRows: 0,
      duplicateSourcePlayerIds: [],
      duplicatePlayerIds: [],
    },
  };
}

describe('Sleeper matchup context readiness', () => {
  it('passes when Sleeper exposes matchup IDs, paired opponents, submitted starters, and stored projection coverage', async () => {
    const fetchJson = async (url: string) => {
      if (url.endsWith('/state/nfl')) return { season: '2026', week: 1, season_type: 'regular' };
      if (url.endsWith('/league/1312139584427012096')) {
        return {
          league_id: '1312139584427012096',
          season: '2026',
          status: 'in_season',
          scoring_settings: { rec: 1 },
        };
      }
      if (url.endsWith('/users')) return [{ user_id: 'u1' }, { user_id: 'u2' }];
      if (url.endsWith('/rosters')) {
        return [
          { roster_id: 1, owner_id: 'u1', players: ['p1', 'p2'], starters: ['p1'] },
          { roster_id: 2, owner_id: 'u2', players: ['p3', 'p4'], starters: ['p3'] },
        ];
      }
      if (url.endsWith('/matchups/1')) {
        return [
          { roster_id: 1, matchup_id: 10, starters: ['p1', 'p2'], players_points: { p1: 0 } },
          { roster_id: 2, matchup_id: 10, starters: ['p3', 'p4'], players_points: { p3: 0 } },
        ];
      }
      return null;
    };

    const result = await probeSleeperMatchupContextReadiness({
      leagueIds: ['1312139584427012096'],
      fetchJson: fetchJson as any,
      loadProjectionSnapshot: async () => projectionSnapshot(['p1', 'p2', 'p3', 'p4']),
    });

    expect(result.ok).toBe(true);
    expect(result.leagues[0]).toMatchObject({
      ok: true,
      leagueLabel: 'league:...2096',
      matchupIdRowCount: 2,
      matchupPairCount: 1,
      opponentMappedRowCount: 2,
      submittedLineupRowCount: 2,
      submittedStarterProjectionCoveredCount: 4,
      projectionSnapshotStatus: 'ready',
      failures: [],
    });
    expect(JSON.stringify(result)).not.toContain('1312139584427012096');
  });

  it('fails closed with metadata failures when matchup rows or projection coverage are missing', async () => {
    const result = await probeSleeperMatchupContextReadiness({
      leagueIds: ['1312139584427012096'],
      week: 1,
      fetchJson: (async (url: string) => {
        if (url.endsWith('/state/nfl')) return { season: '2026', week: 1 };
        if (url.endsWith('/league/1312139584427012096')) return { season: '2026', scoring_settings: { rec: 0.5 } };
        if (url.endsWith('/users')) return [{ user_id: 'u1' }];
        if (url.endsWith('/rosters')) return [{ roster_id: 1, owner_id: 'u1', players: ['p1'], starters: ['p1'] }];
        if (url.endsWith('/matchups/1')) return [];
        return null;
      }) as any,
      loadProjectionSnapshot: async () => null,
    });

    expect(result.ok).toBe(false);
    expect(result.leagues[0].scoringProfile).toBe('HALF_PPR');
    expect(result.leagues[0].failures).toEqual(expect.arrayContaining([
      'week 1 matchup rows missing',
      'matchup IDs missing',
      'opponent matchup pairs missing',
      'submitted lineup starters missing',
      'stored Sleeper projection snapshot missing',
    ]));
  });
});
