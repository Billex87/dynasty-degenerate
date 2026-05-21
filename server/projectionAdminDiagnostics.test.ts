import { describe, expect, it } from 'vitest';
import { NFL_TEAM_CODES } from './nflTeamCodes';
import { buildNflScheduleSnapshot, type NflScheduleGameInput } from './nflScheduleSnapshots';
import { buildPlayerProjectionSnapshot } from './playerProjectionSnapshots';
import {
  buildProjectionSnapshotHealthDiagnostic,
  buildScheduleSnapshotHealthDiagnostic,
  diffPlayerProjectionSnapshots,
} from './projectionAdminDiagnostics';

const NOW = new Date('2026-09-10T12:00:00Z');

function buildFullWeekRows(week = 1): NflScheduleGameInput[] {
  const rows: NflScheduleGameInput[] = [];
  for (let i = 0; i < NFL_TEAM_CODES.length; i += 2) {
    rows.push({
      season: 2026,
      week,
      gameId: `w${week}-game-${i / 2}`,
      awayTeam: NFL_TEAM_CODES[i],
      homeTeam: NFL_TEAM_CODES[i + 1],
      startsAt: `2026-09-${String(10 + i / 2).padStart(2, '0')}T17:00:00Z`,
      gameStatus: 'scheduled',
    });
  }
  return rows;
}

describe('projection admin diagnostics', () => {
  it('reports healthy schedule snapshot coverage with games per week and checksum metadata', () => {
    const schedule = buildNflScheduleSnapshot({
      season: 2026,
      source: 'Official schedule feed',
      sourceVersion: 'release-1',
      fetchedAt: '2026-09-01T12:00:00Z',
      publishedAt: '2026-09-01T11:00:00Z',
      rows: buildFullWeekRows(1),
    });

    const health = buildScheduleSnapshotHealthDiagnostic({
      snapshot: schedule,
      sleeperWeeks: [1],
      providerProjectionWeeks: [1],
    });

    expect(health.status).toBe('ready');
    expect(health.gamesPerWeek[1]).toBe(16);
    expect(health.missingTeamCount).toBe(0);
    expect(health.missingTeamsByWeek).toEqual({});
    expect(health.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(health.coverage.status).toBe('ready');
  });

  it('warns when schedule rows have team/week gaps or checksum changes', () => {
    const previous = buildNflScheduleSnapshot({
      season: 2026,
      source: 'Official schedule feed',
      sourceVersion: 'release-1',
      rows: buildFullWeekRows(1),
    });
    const partial = buildNflScheduleSnapshot({
      season: 2026,
      source: 'Official schedule feed',
      sourceVersion: 'release-2',
      rows: buildFullWeekRows(1).slice(0, 13),
    });

    const health = buildScheduleSnapshotHealthDiagnostic({
      snapshot: partial,
      previousSnapshot: previous,
      sleeperWeeks: [1, 2],
      providerProjectionWeeks: [1],
    });

    expect(health.status).toBe('warning');
    expect(health.checksumChanged).toBe(true);
    expect(health.missingTeamCount).toBeGreaterThan(0);
    expect(health.missingTeamsByWeek[1].length).toBeGreaterThan(0);
    expect(health.parserWarnings.join(' ')).toContain('fewer than 14 games');
  });

  it('reports projection snapshot health across positions, teams, stale rows, identity, and scoring gaps', () => {
    const snapshot = buildPlayerProjectionSnapshot({
      season: 2026,
      week: 1,
      source: 'fantasynerds',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: 'week1-v1',
      fetchedAt: '2026-09-01T08:00:00Z',
      publishedAt: '2026-09-01T08:00:00Z',
      providerUpdatedAt: '2026-09-01T08:00:00Z',
      missingStarterCount: 2,
      rows: [
        { playerId: 'qb1', sourcePlayerId: 'fn-1', playerName: 'QB One', team: 'JAC', position: 'QB', projectedFantasyPoints: 19.2 },
        { playerId: 'wr1', sourcePlayerId: 'fn-dup', playerName: 'WR One', team: 'JAC', position: 'WR', projectedFantasyPoints: 14.5 },
        { playerId: 'wr2', sourcePlayerId: 'fn-dup', playerName: 'WR Two', team: 'ARI', position: 'WR', projectedFantasyPoints: 12.1 },
      ],
    });

    const health = buildProjectionSnapshotHealthDiagnostic({
      snapshot,
      expectedScoringProfiles: ['PPR', 'HALF', 'STD'],
      now: NOW,
    });

    expect(health.status).toBe('warning');
    expect(health.coverageByPosition).toMatchObject({ QB: 1, WR: 2 });
    expect(health.coverageByTeam).toMatchObject({ JAX: 2, ARI: 1 });
    expect(health.coverageBySource).toMatchObject({ fantasynerds: 3 });
    expect(health.staleRows).toBe(3);
    expect(health.missingStarterCount).toBe(2);
    expect(health.duplicateSourcePlayerIds).toEqual(['fn-dup']);
    expect(health.scoringProfileGaps).toEqual(['HALF', 'STD']);
    expect(health.parserWarnings.join(' ')).toContain('stale');
  });

  it('diffs projection snapshots and flags player moves, injury changes, team shifts, and suspicious swings', () => {
    const previous = buildPlayerProjectionSnapshot({
      season: 2026,
      week: 1,
      source: 'fantasypros',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: 'week1-v1',
      rows: [
        { playerId: 'wr1', sourcePlayerId: 'fp-wr1', playerName: 'WR One', team: 'JAC', position: 'WR', projectedFantasyPoints: 10, injuryStatus: 'Healthy' },
        { playerId: 'rb1', sourcePlayerId: 'fp-rb1', playerName: 'RB One', team: 'ARI', position: 'RB', projectedFantasyPoints: 16, injuryStatus: 'Healthy' },
      ],
    });
    const current = buildPlayerProjectionSnapshot({
      season: 2026,
      week: 1,
      source: 'fantasypros',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: 'week1-v2',
      rows: [
        { playerId: 'wr1', sourcePlayerId: 'fp-wr1', playerName: 'WR One', team: 'JAC', position: 'WR', projectedFantasyPoints: 18, injuryStatus: 'Healthy' },
        { playerId: 'rb1', sourcePlayerId: 'fp-rb1', playerName: 'RB One', team: 'ARI', position: 'RB', projectedFantasyPoints: 9, injuryStatus: 'Questionable' },
        { playerId: 'te1', sourcePlayerId: 'fp-te1', playerName: 'TE One', team: 'KC', position: 'TE', projectedFantasyPoints: 7 },
      ],
    });

    const diff = diffPlayerProjectionSnapshots({ previous, current, moveLimit: 5 });

    expect(diff.status).toBe('ready');
    expect(diff.comparedRows).toBe(2);
    expect(diff.addedRows).toBe(1);
    expect(diff.biggestPlayerMoves[0]).toMatchObject({
      playerName: 'WR One',
      previousProjectedFantasyPoints: 10,
      currentProjectedFantasyPoints: 18,
      delta: 8,
    });
    expect(diff.injuryDrivenChanges[0]).toMatchObject({ playerName: 'RB One', injuryChanged: true });
    expect(diff.suspiciousProviderSwings[0]).toMatchObject({ playerName: 'WR One' });
    expect(diff.teamLevelShifts.map((row) => row.team)).toContain('JAX');
  });
});
