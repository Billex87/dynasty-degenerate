import { describe, expect, it } from 'vitest';
import { attachLeagueAiConfidence, buildLeagueAiConfidence } from './leagueAiConfidence';
import type { LeagueAiConfidenceSnapshotPayload } from './leagueAiConfidence';
import type { ReportData } from '../shared/types';

function createBaseReport(overrides: Partial<ReportData> = {}): ReportData {
  return {
    leagueValueMode: 'dynasty',
    leagueDiagnostics: {
      teamCount: 10,
      valueMode: 'dynasty',
      rosterSlots: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX'],
      starterSlots: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX'],
      lineupSlotSummary: '1 QB, 2 RB, 2 WR, 1 TE, Flex, Superflex',
      starterCountSummary: 'QB x20, RB x30, WR x30, TE x10',
      starterCalculation: 'Projected starters are selected from active rosters.',
      benchCalculation: 'Bench baseline uses non-starters.',
      tradeableDepthCalculation: 'Tradeable depth uses active bench players.',
      scoringSummary: 'PPR',
      receptionScoring: 1,
      tightEndPremium: 0,
      ktcProfileLabel: 'Dynasty SF PPR',
      valueSnapshotProfileCount: 1,
      valueSnapshotProfiles: ['Dynasty SF PPR'],
      valueLimitations: [],
    },
    managerRosterValueGrowth: [],
    weeklyRisers: [],
    weeklyFallers: [],
    leagueOverview: [],
    projectedRisers: [],
    projectedFallers: [],
    tradeProfitLeaderboard: [],
    tradeHistory: [],
    positionDepth: [],
    managerPositionCounts: [],
    ...overrides,
  };
}

describe('league AI confidence', () => {
  it('starts low when a league has thin history and little activity data', () => {
    const confidence = buildLeagueAiConfidence(createBaseReport());

    expect(confidence.score).toBeLessThan(60);
    expect(confidence.label).toBe('Low confidence');
    expect(confidence.signals.find((signal) => signal.key === 'leagueHistory')?.status).toBe('low');
  });

  it('increases as league history, source trust, snapshots, and activity accumulate', () => {
    const managers = Array.from({ length: 10 }, (_, index) => `Manager ${index + 1}`);
    const richReport = createBaseReport({
      managerRosterIntelligence: managers.map((manager) => ({
        manager,
        identity: 'Contender',
        timeline: 'Win-now',
        summary: 'Strong roster.',
        strategySummary: 'Buy starters.',
        starterValue: 60000,
        starterSeasonValue: 58000,
        benchValue: 20000,
        starterValuePct: 70,
        bestBenchStash: null,
        weakestStarter: null,
        oldestPlayer: null,
        youngCorePlayer: null,
        breakoutCandidate: null,
        lastSeasonStud: null,
        buyTarget: null,
        sellCandidate: null,
        tradePlan: { needPosition: null, surplusPosition: null, summary: 'Hold.' },
        tradeBlueprints: [],
        chaosNotes: [],
        marketSignals: [],
        pressurePoints: [],
        rosterHealthScore: 80,
        positionGrades: {
          QB: { rank: 1, grade: 'A', note: 'Strong' },
          RB: { rank: 1, grade: 'A', note: 'Strong' },
          WR: { rank: 1, grade: 'A', note: 'Strong' },
          TE: { rank: 1, grade: 'A', note: 'Strong' },
        },
        startingRosterStrength: null,
        benchBaseline: null,
        tradeableDepth: null,
        tradeChip: null,
        injuryInsurance: null,
        rosterPlayers: [],
        benchPlayers: [],
        taxiPlayers: [],
        reservePlayers: [],
        droppablePlayers: [],
        untouchablePlayers: [],
        taxiTriage: { items: [], summary: 'No taxi flags', counts: { 'Promote Now': 0, 'Keep Parked': 0, 'Trade Sweetener': 0, Cuttable: 0, 'Taxi Risk': 0 } },
        similarValuePlayers: {},
        avgAge: 25,
        avgAgeByPosition: { QB: 25, RB: 25, WR: 25, TE: 25 },
        starterAvailability: { avgGamesMissed: 0, riskLevel: 'Low', riskiestStarter: null },
        ageFlags: [],
        holes: { bestQbRank: null, rb2Rank: null, wr3Rank: null, te1Rank: null, flexDepth: [], summary: 'No holes' },
      })),
      managerPositionCounts: managers.map((manager) => ({
        manager,
        QB: 3,
        QB_starters: 1,
        RB: 5,
        RB_starters: 2,
        WR: 7,
        WR_starters: 3,
        TE: 3,
        TE_starters: 1,
      })),
      leagueOverview: managers.map((manager, index) => ({
        manager,
        total_val: 100000 - index * 1000,
        rank_qb: index + 1,
        rank_rb: index + 1,
        rank_wr: index + 1,
        rank_te: index + 1,
        rank_value: index + 1,
        rank_2027: index + 1,
      })),
      standingsHistory: ['2023', '2024', '2025', '2026'].flatMap((season) => managers.map((manager, index) => ({
        season,
        manager,
        rank: index + 1,
        wins: 8,
        losses: 6,
        ties: 0,
        pointsFor: 1500 - index * 10,
      }))),
      tradeHistory: Array.from({ length: 24 }, (_, index) => ({
        date: `2026-04-${String((index % 20) + 1).padStart(2, '0')}`,
        season: '2026',
        team_a: managers[index % managers.length],
        team_b: managers[(index + 1) % managers.length],
        team_a_items: 'Player A',
        team_b_items: 'Player B',
        team_a_total: 5000,
        team_b_total: 4800,
        point_gap: 200,
        winner: managers[index % managers.length],
        winners: [managers[index % managers.length]],
      })),
      tradeTendencies: managers.map((manager) => ({
        manager,
        tradeCount: 4,
        wins: 2,
        winPct: 50,
        profit: 100,
        avgGap: 200,
        favoritePartner: null,
        overpaysForPicks: false,
        overpaysForVeterans: false,
      })),
      recentTransactions: Array.from({ length: 12 }, (_, index) => ({
        id: `tx-${index}`,
        date: '2026-05-01',
        manager: managers[index % managers.length],
        type: 'Waiver' as const,
        bidAmount: 5,
        addedPlayer: null,
        droppedPlayer: null,
        alternativeDrop: null,
        note: 'Added depth.',
        losingBidsAvailable: false,
      })),
      monthlyBlueprintSnapshot: {
        month: '2026-05',
        status: 'stored',
        managerCount: 10,
        source: 'database',
      },
      monthlyBlueprintHistory: ['2026-02', '2026-03', '2026-04', '2026-05'].flatMap((snapshotMonth) => managers.map((manager) => ({
        snapshotMonth,
        manager,
      }))),
      matchupPreviews: managers.map((manager) => ({
        manager,
        opponent: 'Opponent',
        week: 1,
        howToWin: 'Start best players.',
        riskSummary: 'Normal risk.',
        mustStarts: [],
        vulnerableSpots: [],
        boomBustRisks: [],
      })),
      playerDetailsById: Object.fromEntries(Array.from({ length: 140 }, (_, index) => [`player-${index}`, {
        playerId: `player-${index}`,
        fullName: `Player ${index}`,
        position: 'WR',
        valueProfile: {
          dynastyValue: 5000,
          seasonValue: 4500,
          sources: ['KTC'],
        },
      }])),
      rankings: {
        generatedAt: '2026-05-11T00:00:00.000Z',
        dynastySf: Array.from({ length: 260 }, (_, index) => ({
          id: `rank-${index}`,
          name: `Player ${index}`,
          pos: 'WR',
          overallRank: index + 1,
          value: 9000 - index,
          sources: ['KTC'],
          sourceCount: 1,
        })),
        dynastyOneQb: [],
        devySf: [],
        devyOneQb: [],
        dynastySourceDiagnostics: [{
          key: 'ktc',
          source: 'KTC',
          board: 'dynasty',
          status: 'loaded',
          rowCount: 900,
          note: 'Loaded.',
          trustScore: 82,
        }],
      },
    });

    const confidence = buildLeagueAiConfidence(richReport);

    expect(confidence.score).toBeGreaterThan(78);
    expect(confidence.previousScore).toBeGreaterThan(0);
    expect(confidence.scoreDelta).not.toBeNull();
    expect(confidence.label).toMatch(/confidence/i);
    expect(confidence.signals.every((signal) => signal.score >= 60)).toBe(true);
    expect(confidence.managerConfidence).toHaveLength(10);
    expect(confidence.managerConfidence?.[0].previousScore).toBeGreaterThan(0);
  });

  it('raises schedule confidence when schedule planning is populated', () => {
    const confidence = buildLeagueAiConfidence(createBaseReport({
      schedulePlanning: {
        source: 'DraftSharks',
        status: 'ready',
        updatedAt: '2026-05-11T00:00:00.000Z',
        rosterGaps: [{
          manager: 'Tester',
          position: 'RB',
          weeks: [7, 9],
          severity: 'high',
          note: 'RB depth gets thin during the bye crunch.',
        }],
        streamerCandidates: [{
          playerId: 'streamer-1',
          name: 'Week 7 Streamer',
          position: 'QB',
          team: 'BUF',
          byeWeek: 12,
          seasonSOS: 42,
          scheduleTier: 'easy',
          targetWeeks: [7, 9],
          note: 'Stream during the bye stack.',
        }],
        byeWeekNotes: [{
          week: 7,
          note: 'First major bye-week crunch.',
          teams: ['BUF', 'MIA'],
        }],
      },
    }));

    const scheduleSignal = confidence.signals.find((signal) => signal.key === 'scheduleContext');

    expect(scheduleSignal?.score).toBeGreaterThan(28);
    expect(scheduleSignal?.note).toContain('schedule planning signal');
  });

  it('attaches confidence inside league diagnostics without mutating the original report', () => {
    const report = createBaseReport();
    const next = attachLeagueAiConfidence(report);

    expect(report.leagueDiagnostics?.aiConfidence).toBeUndefined();
    expect(next.leagueDiagnostics?.aiConfidence?.score).toBeGreaterThan(0);
  });

  it('uses persisted confidence snapshots for league and manager deltas', () => {
    const report = createBaseReport({
      managerRosterIntelligence: [{
        manager: 'Billy',
        identity: 'Contender',
        timeline: 'Win-now',
        summary: 'Strong roster.',
        strategySummary: 'Buy starters.',
        starterValue: 60000,
        starterSeasonValue: 58000,
        benchValue: 20000,
        starterValuePct: 70,
        bestBenchStash: null,
        weakestStarter: null,
        oldestPlayer: null,
        youngCorePlayer: null,
        breakoutCandidate: null,
        lastSeasonStud: null,
        buyTarget: null,
        sellCandidate: null,
        tradePlan: { needPosition: null, surplusPosition: null, summary: 'Hold.' },
        tradeBlueprints: [],
        chaosNotes: [],
        marketSignals: [],
        pressurePoints: [],
        rosterHealthScore: 80,
        positionGrades: {
          QB: { rank: 1, grade: 'A', note: 'Strong' },
          RB: { rank: 1, grade: 'A', note: 'Strong' },
          WR: { rank: 1, grade: 'A', note: 'Strong' },
          TE: { rank: 1, grade: 'A', note: 'Strong' },
        },
        startingRosterStrength: null,
        benchBaseline: null,
        tradeableDepth: null,
        tradeChip: null,
        injuryInsurance: null,
        rosterPlayers: [],
        benchPlayers: [],
        taxiPlayers: [],
        reservePlayers: [],
        droppablePlayers: [],
        untouchablePlayers: [],
        taxiTriage: { items: [], summary: 'No taxi flags', counts: { 'Promote Now': 0, 'Keep Parked': 0, 'Trade Sweetener': 0, Cuttable: 0, 'Taxi Risk': 0 } },
        similarValuePlayers: {},
        avgAge: 25,
        avgAgeByPosition: { QB: 25, RB: 25, WR: 25, TE: 25 },
        starterAvailability: { avgGamesMissed: 0, riskLevel: 'Low', riskiestStarter: null },
        ageFlags: [],
        holes: { bestQbRank: null, rb2Rank: null, wr3Rank: null, te1Rank: null, flexDepth: [], summary: 'No holes' },
      }],
    });
    const previousSnapshots: LeagueAiConfidenceSnapshotPayload[] = [{
      schemaVersion: 1,
      generatedAt: '2026-05-10T00:00:00.000Z',
      snapshotKey: '2026-05-10',
      leagueId: '123',
      confidence: {
        score: 41,
        label: 'Low confidence',
        note: 'Previous snapshot.',
        signals: [],
        managerConfidence: [{
          manager: 'Billy',
          score: 44,
          label: 'Low confidence',
          note: 'Previous manager snapshot.',
          signals: [],
        }],
      },
    }];

    const confidence = buildLeagueAiConfidence(report, previousSnapshots);
    const managerConfidence = confidence.managerConfidence?.find((row) => row.manager === 'Billy');

    expect(confidence.previousScore).toBe(41);
    expect(confidence.scoreDelta).toBe(confidence.score - 41);
    expect(confidence.history?.some((point) => point.snapshotKey === '2026-05-10' && point.score === 41)).toBe(true);
    expect(managerConfidence?.previousScore).toBe(44);
    expect(managerConfidence?.scoreDelta).toBe((managerConfidence?.score || 0) - 44);
  });

  it('tracks signal-level confidence deltas from previous snapshots', () => {
    const report = createBaseReport({
      tradeHistory: [{
        date: '2026-05-01',
        season: '2026',
        team_a: 'Billy',
        team_b: 'Rival',
        team_a_items: 'Pick',
        team_b_items: 'Player',
        team_a_total: 1000,
        team_b_total: 1200,
        point_gap: 200,
        winner: 'Billy',
        winners: ['Billy'],
      }],
    });
    const previousSnapshots: LeagueAiConfidenceSnapshotPayload[] = [{
      schemaVersion: 1,
      generatedAt: '2026-05-10T00:00:00.000Z',
      snapshotKey: '2026-05-10',
      leagueId: '123',
      confidence: {
        score: 35,
        label: 'Low confidence',
        note: 'Previous snapshot.',
        signals: [{
          key: 'leagueHistory',
          label: 'League history',
          score: 24,
          weight: 0.24,
          status: 'low',
          note: 'No history yet.',
        }],
      },
    }];

    const confidence = buildLeagueAiConfidence(report, previousSnapshots);
    const historySignal = confidence.signals.find((signal) => signal.key === 'leagueHistory');

    expect(historySignal?.previousScore).toBe(24);
    expect(historySignal?.scoreDelta).toBe((historySignal?.score || 0) - 24);
  });
});
