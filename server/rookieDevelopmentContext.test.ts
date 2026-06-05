import { describe, expect, it } from 'vitest';
import { buildRookieDevelopmentContext } from './rookieDevelopmentContext';
import type { ManagerIntelPlayer, PlayerDetails, ReportData } from '../shared/types';

const projection = {
  source: 'stored-weekly-projection',
  provider: 'sleeper',
  season: '2026',
  week: 1,
  scoringProfile: 'PPR',
  projectedFantasyPoints: 10.8,
  status: 'ready',
  note: 'Stored weekly projection fixture.',
} as const;

function player(overrides: Partial<ManagerIntelPlayer> & { player_id: string; name: string }): ManagerIntelPlayer {
  return {
    pos: 'WR',
    value: 2400,
    seasonValue: 1800,
    owner: 'Manager',
    ...overrides,
  } as ManagerIntelPlayer;
}

function details(overrides: Partial<PlayerDetails>): PlayerDetails {
  return {
    playerId: 'player',
    fullName: 'Player',
    position: 'WR',
    age: 22,
    rookieYear: 2026,
    yearsExp: 0,
    valueProfile: { dynastyValue: 2400, seasonValue: 1800, sources: ['KTC'] },
    ...overrides,
  } as PlayerDetails;
}

describe('buildRookieDevelopmentContext', () => {
  it('scores rookies and sophomores from draft capital, usage, depth chart barriers, and comps', () => {
    const reportData: ReportData = {
      leagueValueMode: 'dynasty',
      leagueDiagnostics: {
        teamCount: 10,
        valueMode: 'dynasty',
        currentSeason: '2026',
      } as any,
      weeklyProjectionDiagnostics: {
        status: 'ready',
        source: 'stored-weekly-projection',
        provider: 'sleeper',
        season: '2026',
        week: 1,
        scoringProfile: 'PPR',
        rowCount: 3,
        rosteredCoveragePct: 100,
        attachedPlayerCount: 3,
        note: 'Ready.',
        warnings: [],
      },
      managerRosterIntelligence: [{
        manager: 'Manager A',
        identity: 'Middle',
        timeline: 'Fork',
        summary: '',
        starterValue: 8000,
        starterSeasonValue: 7600,
        benchValue: 4000,
        starterValuePct: 65,
        rosterPlayers: [
          player({ player_id: 'promote', name: 'Promote Rookie', value: 3600, seasonValue: 3100 }),
          player({ player_id: 'blocked', name: 'Blocked Sophomore', value: 2800, seasonValue: 1200 }),
          player({ player_id: 'fragile', name: 'Fragile Rookie', value: 900, seasonValue: 400 }),
        ],
        benchPlayers: [],
        reservePlayers: [],
        taxiPlayers: [],
      } as any],
      playerDetailsById: {
        promote: details({
          playerId: 'promote',
          fullName: 'Promote Rookie',
          rookieYear: 2026,
          weeklyProjection: projection,
          valueProfile: {
            dynastyValue: 3600,
            seasonValue: 3100,
            sources: ['FantasyPros'],
            fantasyProsSourceTrace: [{
              source: 'FantasyPros',
              key: 'ROOKIES',
              label: 'FantasyPros Rookies',
              rank: 6,
              positionRank: 'WR2',
              evidence: 'rank #6; position WR2; endpoint metadata: fantasypros-rookies.',
            }],
          } as any,
          depthChartOrder: 1,
          playerCohort: {
            draftCapital: {
              round: 1,
              pick: 12,
              tier: 'premium',
              label: 'Round 1',
              opportunityWindow: 'protected-runway',
              patienceScore: 90,
              note: 'Premium investment.',
            },
            seasonOutcomeReceipt: {
              key: 'wr-premium',
              label: 'Premium WR',
              recommendation: 'amplify',
              stance: 'upside-supported',
              confidence: 82,
              confidenceGrade: 'strong',
              sampleSize: 42,
              displayEligible: true,
              productionTier: 'strong',
              roleTier: 'starter',
              trajectoryFromPrevious: 'first-season',
              improvedOrSustainedRate: 0.74,
              breakoutOrProgressionRate: 0.42,
              regressionOrCollapseRate: 0.18,
              materialFailureRate: 0.12,
              medianNextProductionDelta: 3.1,
              medianNextRoleDelta: 0.12,
              summary: '',
              note: '',
              derivedFrom: [],
            },
          } as NonNullable<PlayerDetails['playerCohort']>,
          usageTrend: {
            season: '2026',
            team: 'SEA',
            games: 4,
            targets: 32,
            carries: 1,
            receptions: 21,
            fantasyPointsPpr: 72,
            fantasyPointsPprPerGame: 18,
            avgTargetShare: 0.24,
            avgOffenseSnapPct: 82,
            recentTargets: 28,
            recentCarries: 1,
            targetTrend: 'up',
            carryTrend: 'flat',
            note: 'Usage up.',
          },
        }),
        blocked: details({
          playerId: 'blocked',
          fullName: 'Blocked Sophomore',
          rookieYear: 2025,
          yearsExp: 1,
          depthChartOrder: 4,
          playerCohort: {
            draftCapital: {
              round: 2,
              pick: 44,
              tier: 'day-two',
              label: 'Round 2',
              opportunityWindow: 'prove-it-window',
              patienceScore: 72,
              note: 'Day-two investment.',
            },
          } as NonNullable<PlayerDetails['playerCohort']>,
          rosterRoom: {
            source: 'nflverse rosters',
            season: '2026',
            previousSeason: '2025',
            team: 'DAL',
            position: 'WR',
            currentCount: 8,
            previousCount: 7,
            netChange: 1,
            additions: [],
            losses: [],
            rookieAdditions: [],
            premiumAdditions: [{ name: 'Round One Threat' }],
            depthChartTop: [{ name: 'Veteran One', rank: 1, slot: 'WR1' }],
            competitionLevel: 'crowded',
            vacatedOpportunitySignal: 'stable',
            note: 'Crowded room.',
          } as any,
        }),
        fragile: details({
          playerId: 'fragile',
          fullName: 'Fragile Rookie',
          rookieYear: 2026,
          yearsExp: 0,
          depthChartOrder: 5,
          playerCohort: {
            draftCapital: {
              round: 7,
              pick: 220,
              tier: 'late-round',
              label: 'Round 7',
              opportunityWindow: 'short-leash',
              patienceScore: 28,
              note: 'Thin investment.',
            },
            seasonOutcomeReceipt: {
              key: 'late-wr',
              label: 'Late WR',
              recommendation: 'caution',
              stance: 'risk-supported',
              confidence: 60,
              confidenceGrade: 'usable',
              sampleSize: 30,
              displayEligible: true,
              productionTier: 'low-signal',
              roleTier: 'thin',
              trajectoryFromPrevious: 'first-season',
              improvedOrSustainedRate: 0.2,
              breakoutOrProgressionRate: 0.08,
              regressionOrCollapseRate: 0.48,
              materialFailureRate: 0.62,
              medianNextProductionDelta: -2,
              medianNextRoleDelta: -0.1,
              summary: '',
              note: '',
              derivedFrom: [],
            },
          } as NonNullable<PlayerDetails['playerCohort']>,
        }),
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
    };

    const result = buildRookieDevelopmentContext(reportData);
    const actions = new Map(result?.rows.map((read) => [read.player.name, read.action]));

    expect(result?.status).toBe('ready');
    expect(actions.get('Promote Rookie')).toBe('promote-window');
    expect(actions.get('Blocked Sophomore')).toBe('blocked-by-depth-chart');
    expect(actions.get('Fragile Rookie')).toBe('fragile-profile');
    expect(result?.rows.every((read) => read.confidence >= 0 && read.confidence <= 100)).toBe(true);
    const promoteRead = result?.rows.find((read) => read.player.name === 'Promote Rookie');
    expect(promoteRead?.projectedFantasyPoints).toBe(10.8);
    expect(promoteRead?.signals).toContain('fantasypros-rookies');
    expect(promoteRead?.sourceTrace).toContain('fantasypros-rookies:rank:6');
  });
});
