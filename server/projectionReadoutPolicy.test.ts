import { describe, expect, it } from 'vitest';
import { buildNflScheduleSnapshot } from './nflScheduleSnapshots';
import { buildPlayerProjectionContext } from './playerProjectionContext';
import type { PlayerMatchupArchetypeSummary, PlayerOpponentHistorySummary } from './playerMatchupActuals';
import { buildPlayerProjectionSnapshot } from './playerProjectionSnapshots';
import { buildProjectionReadoutPolicy } from './projectionReadoutPolicy';

const NOW = new Date('2026-09-10T12:00:00Z');

function buildProjectionContextFixture(overrides: {
  playerId?: string | null;
  sourcePlayerId?: string | null;
  projectedFantasyPoints?: number;
  previousProjectedFantasyPoints?: number;
  injuryStatus?: string | null;
  expertCount?: number | null;
  matchConfidence?: number | null;
  fetchedAt?: string;
  providerUpdatedAt?: string | null;
  publishedAt?: string | null;
  matchupActuals?: PlayerMatchupArchetypeSummary | null;
  playerOpponentHistory?: PlayerOpponentHistorySummary | null;
} = {}) {
  const projections = buildPlayerProjectionSnapshot({
    season: 2026,
    week: 1,
    source: 'fantasypros',
    scoringProfile: 'PPR',
    projectionType: 'weekly',
    sourceVersion: 'week1-v1',
    fetchedAt: overrides.fetchedAt || '2026-09-10T09:00:00Z',
    publishedAt: overrides.publishedAt || '2026-09-10T08:30:00Z',
    providerUpdatedAt: overrides.providerUpdatedAt === undefined ? '2026-09-10T08:45:00Z' : overrides.providerUpdatedAt,
    rows: [{
      playerId: overrides.playerId === undefined ? 'wr1' : overrides.playerId,
      sourcePlayerId: overrides.sourcePlayerId === undefined ? 'fp-wr1' : overrides.sourcePlayerId,
      playerName: 'Policy Receiver',
      team: 'JAC',
      position: 'WR',
      projectedFantasyPoints: overrides.projectedFantasyPoints ?? 16.5,
      targets: 8,
      injuryStatus: overrides.injuryStatus || null,
      expertCount: overrides.expertCount ?? 12,
      matchConfidence: overrides.matchConfidence ?? 98,
    }],
  });
  const schedule = buildNflScheduleSnapshot({
    season: 2026,
    source: 'Official schedule feed',
    sourceVersion: 'release-1',
    fetchedAt: '2026-09-01T12:00:00Z',
    publishedAt: '2026-09-01T11:00:00Z',
    rows: [
      { week: 1, gameId: 'game-1', homeTeam: 'JAX', awayTeam: 'ARI', startsAt: '2026-09-13T17:00:00Z', gameStatus: 'scheduled' },
    ],
  });
  const context = buildPlayerProjectionContext({
    projectionSnapshot: projections,
    scheduleSnapshot: schedule,
    dynastyValueByPlayerId: { wr1: 7800 },
    redraftValueByPlayerId: { wr1: 1400 },
    restOfSeasonProjectionByPlayerId: { wr1: 214 },
    longTermRoleSecurityByPlayerId: { wr1: 'stable target earner' },
    opportunityRunwayByPlayerId: { wr1: 'protected rookie-contract runway' },
    draftCapitalSignalByPlayerId: { wr1: 'Day 1 NFL draft capital' },
    matchupActualsByPlayerId: overrides.matchupActuals === undefined ? undefined : { wr1: overrides.matchupActuals },
    playerOpponentHistoryByProjectionRowKey: overrides.playerOpponentHistory === undefined
      ? undefined
      : { [projections.rows[0].rowKey]: overrides.playerOpponentHistory },
  });
  return {
    projections,
    schedule,
    row: context.rows[0],
    previousProjectedFantasyPoints: overrides.previousProjectedFantasyPoints ?? 14,
  };
}

describe('projection readout policy', () => {
  it('distinguishes unnamed provider projections from named provider claims', () => {
    const fixture = buildProjectionContextFixture();

    const read = buildProjectionReadoutPolicy({
      surface: 'player-detail',
      action: 'start',
      leagueValueMode: 'redraft',
      row: fixture.row,
      projectionSnapshot: fixture.projections,
      scheduleSnapshot: fixture.schedule,
      now: NOW,
      sourcePolicy: {
        projectionDisplayAllowed: true,
        providerAttributionAllowed: false,
      },
    });

    expect(read.evidenceKind).toBe('stored provider projection');
    expect(read.canUseProjectionClaim).toBe(true);
    expect(read.canNameProvider).toBe(false);
    expect(read.evidenceLanguage).toContain('stored provider weekly projection');
    expect(read.sourceTraceText.join(' ')).not.toContain('FantasyPros');
    expect(read.sourceTraceText.join(' ')).toContain('Week 1');
    expect(read.sourceTraceText.join(' ')).toContain('vs ARI');
  });

  it('names a provider only when attribution and source naming are approved', () => {
    const fixture = buildProjectionContextFixture();

    const read = buildProjectionReadoutPolicy({
      surface: 'player-detail',
      action: 'start',
      leagueValueMode: 'redraft',
      row: fixture.row,
      projectionSnapshot: fixture.projections,
      scheduleSnapshot: fixture.schedule,
      now: NOW,
      sourcePolicy: {
        projectionDisplayAllowed: true,
        providerAttributionAllowed: true,
        providerNamesAllowed: { fantasypros: true },
      },
    });

    expect(read.evidenceKind).toBe('provider projection');
    expect(read.canNameProvider).toBe(true);
    expect(read.evidenceLanguage).toContain('FantasyPros weekly projection');
  });

  it('drops confidence for stale, thin, source-only, unresolved-injury projection rows', () => {
    const fixture = buildProjectionContextFixture({
      playerId: null,
      sourcePlayerId: 'fp-source-only',
      expertCount: 1,
      injuryStatus: 'Questionable - limited practice',
      matchConfidence: 72,
      fetchedAt: '2026-09-01T08:00:00Z',
      publishedAt: '2026-09-01T08:00:00Z',
      providerUpdatedAt: '2026-09-01T08:00:00Z',
    });

    const read = buildProjectionReadoutPolicy({
      surface: 'player-detail',
      action: 'start',
      leagueValueMode: 'redraft',
      row: fixture.row,
      projectionSnapshot: fixture.projections,
      scheduleSnapshot: fixture.schedule,
      now: NOW,
      sourceCount: 1,
      sourcePolicy: { projectionDisplayAllowed: true },
    });

    expect(read.confidenceCap).toBeLessThanOrEqual(54);
    expect(read.softWarnings.join(' ')).toContain('Player identity is source-only');
    expect(read.softWarnings.join(' ')).toContain('Projection source coverage is thin');
    expect(read.softWarnings.join(' ')).toContain('Injury status is unresolved');
    expect(read.evidenceRead.label).not.toBe('high conviction');
  });

  it('falls back to schedule/value context when projection claims are not available', () => {
    const fixture = buildProjectionContextFixture();

    const read = buildProjectionReadoutPolicy({
      surface: 'overview',
      action: 'watch',
      leagueValueMode: 'dynasty',
      row: fixture.row,
      projectionSnapshot: null,
      scheduleSnapshot: fixture.schedule,
      now: NOW,
    });

    expect(read.canUseProjectionClaim).toBe(false);
    expect(read.evidenceKind).toBe('dynasty value');
    expect(read.fallbackCopy).toContain('schedule/value context only');
    expect(read.evidenceLanguage).not.toContain('FantasyPros');
  });

  it('caps one-week projection swings when opportunity runway says not to overreact', () => {
    const fixture = buildProjectionContextFixture({
      projectedFantasyPoints: 8,
      previousProjectedFantasyPoints: 15,
    });

    const read = buildProjectionReadoutPolicy({
      surface: 'trade',
      action: 'hold',
      leagueValueMode: 'dynasty',
      row: fixture.row,
      projectionSnapshot: fixture.projections,
      scheduleSnapshot: fixture.schedule,
      previousProjectedFantasyPoints: fixture.previousProjectedFantasyPoints,
      now: NOW,
      sourcePolicy: { projectionDisplayAllowed: true },
    });

    expect(read.confidenceCap).toBeLessThanOrEqual(68);
    expect(read.softWarnings.join(' ')).toContain('One-week projection drop conflicts');
    expect(read.opportunityRunwayText).toContain('protected rookie-contract runway');
  });

  it('does not blindly trust draft capital when usage and projection trend are deteriorating', () => {
    const fixture = buildProjectionContextFixture({
      projectedFantasyPoints: 7,
      previousProjectedFantasyPoints: 12,
    });

    const read = buildProjectionReadoutPolicy({
      surface: 'autopilot',
      action: 'hold',
      leagueValueMode: 'dynasty',
      row: fixture.row,
      projectionSnapshot: fixture.projections,
      scheduleSnapshot: fixture.schedule,
      previousProjectedFantasyPoints: fixture.previousProjectedFantasyPoints,
      roleTrend: 'declining',
      usageTrend: 'collapsed',
      injuryTrend: 'recurring',
      now: NOW,
      sourcePolicy: { projectionDisplayAllowed: true },
    });

    expect(read.confidenceCap).toBeLessThanOrEqual(62);
    expect(read.softWarnings.join(' ')).toContain('Draft capital or contract runway is not enough by itself');
  });

  it('uses historical matchup actuals as receipts and caps caution archetypes', () => {
    const fixture = buildProjectionContextFixture({
      matchupActuals: {
        position: 'WR',
        roleBucket: 'starter',
        opponentStrengthBucket: 'tough',
        homeAway: 'away',
        summaryKey: 'WR:starter:tough:away',
        sampleSize: 9,
        avgActualFantasyPoints: 9.4,
        avgProjectionError: -4.2,
        beatProjectionRate: 22.2,
        ceilingRate: 0,
        floorMissRate: 55.6,
        confidence: 64,
        recommendation: 'caution',
        reason: 'WR starter usage has elevated miss risk in this tough/away archetype.',
      },
    });

    const read = buildProjectionReadoutPolicy({
      surface: 'player-detail',
      action: 'hold',
      leagueValueMode: 'redraft',
      row: fixture.row,
      projectionSnapshot: fixture.projections,
      scheduleSnapshot: fixture.schedule,
      now: NOW,
      sourcePolicy: { projectionDisplayAllowed: true },
    });

    expect(read.confidenceCap).toBeLessThanOrEqual(64);
    expect(read.confidenceCapReason).toBe('Historical matchup caution');
    expect(read.softWarnings.join(' ')).toContain('elevated miss risk');
    expect(read.evidenceRead.evidence.join(' ')).toContain('Historical matchup actuals are available');
    expect(read.sourceTraceText.join(' ')).toContain('Historical matchup actuals');
  });

  it('uses direct player opponent history as a receipt without replacing broader evidence', () => {
    const fixture = buildProjectionContextFixture({
      playerOpponentHistory: {
        historyKey: 'wr1:WR:ARI',
        playerId: 'wr1',
        sourcePlayerId: 'fp-wr1',
        playerName: 'Policy Receiver',
        position: 'WR',
        opponent: 'ARI',
        sampleSize: 3,
        avgFantasyPoints: 18.6,
        medianFantasyPoints: 18.2,
        highFantasyPoints: 23.4,
        lowFantasyPoints: 14.2,
        avgProjectionError: 3.1,
        beatProjectionRate: 66.7,
        ceilingGameRate: 33.3,
        floorGameRate: 0,
        confidence: 74,
        recommendation: 'boost',
        reason: 'Policy Receiver has beaten projection in 66.7% of 3 career games vs ARI.',
        games: [],
      },
    });

    const read = buildProjectionReadoutPolicy({
      surface: 'player-detail',
      action: 'start',
      leagueValueMode: 'redraft',
      row: fixture.row,
      projectionSnapshot: fixture.projections,
      scheduleSnapshot: fixture.schedule,
      now: NOW,
      sourcePolicy: { projectionDisplayAllowed: true },
    });

    expect(read.evidenceRead.evidence.join(' ')).toContain('3 career games vs ARI');
    expect(read.evidenceRead.evidence.join(' ')).toContain('beaten projection in 66.7%');
    expect(read.sourceTraceText.join(' ')).toContain('Player opponent history');
    expect(read.confidenceCapReason).not.toBe('Player-opponent history caution');
  });
});
