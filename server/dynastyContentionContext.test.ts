import { describe, expect, it } from 'vitest';
import { buildDynastyContentionContext } from './dynastyContentionContext';
import type { ManagerIntelPlayer, PlayerDetails, ReportData } from '../shared/types';

const projection = {
  source: 'stored-weekly-projection',
  provider: 'sleeper',
  season: '2026',
  week: 1,
  scoringProfile: 'PPR',
  projectedFantasyPoints: 13.2,
  status: 'ready',
  note: 'Stored weekly projection fixture.',
} as const;

function details(overrides: Partial<PlayerDetails>): PlayerDetails {
  return {
    playerId: 'player',
    fullName: 'Player',
    position: 'WR',
    age: 24,
    valueProfile: {
      dynastyValue: 3000,
      seasonValue: 2800,
      sources: ['KTC'],
    },
    ...overrides,
  } as PlayerDetails;
}

function player(overrides: Partial<ManagerIntelPlayer> & { player_id: string; name: string }): ManagerIntelPlayer {
  return {
    pos: 'WR',
    value: 3000,
    seasonValue: 2800,
    owner: 'Manager',
    ...overrides,
  } as ManagerIntelPlayer;
}

describe('buildDynastyContentionContext', () => {
  it('separates start-now, hold, sell-spike, buy-growth, and runway reads', () => {
    const reportData: ReportData = {
      leagueValueMode: 'dynasty',
      weeklyProjectionDiagnostics: {
        status: 'ready',
        source: 'stored-weekly-projection',
        provider: 'sleeper',
        season: '2026',
        week: 1,
        scoringProfile: 'PPR',
        rowCount: 4,
        rosteredCoveragePct: 100,
        attachedPlayerCount: 4,
        note: 'Ready.',
        warnings: [],
      },
      dynastyTimelines: [
        { manager: 'Contender', contenderScore: 88, rebuildScore: 35, outlook2027: 40, agingRisk: 55, label: 'True contender' },
        { manager: 'Builder', contenderScore: 40, rebuildScore: 82, outlook2027: 88, agingRisk: 12, label: 'Rebuild mode' },
      ],
      managerRosterIntelligence: [
        {
          manager: 'Contender',
          identity: 'Win now',
          timeline: 'True contender',
          summary: '',
          starterValue: 10000,
          starterSeasonValue: 12000,
          benchValue: 4000,
          starterValuePct: 70,
          rosterPlayers: [
            player({ player_id: 'start', name: 'Start Veteran', value: 3200, seasonValue: 5200, owner: 'Contender' }),
            player({ player_id: 'hold', name: 'Hold Rookie', value: 2800, seasonValue: 900, owner: 'Contender' }),
            player({ player_id: 'spike', name: 'Spike Flex', value: 2100, seasonValue: 3600, owner: 'Contender' }),
          ],
          benchPlayers: [],
          reservePlayers: [],
          taxiPlayers: [],
        } as any,
        {
          manager: 'Builder',
          identity: 'Future',
          timeline: 'Rebuild mode',
          summary: '',
          starterValue: 5000,
          starterSeasonValue: 4200,
          benchValue: 6000,
          starterValuePct: 42,
          rosterPlayers: [
            player({ player_id: 'growth', name: 'Growth Receiver', value: 2600, seasonValue: 2700, owner: 'Builder' }),
          ],
          benchPlayers: [],
          reservePlayers: [],
          taxiPlayers: [],
        } as any,
      ],
      playerDetailsById: {
        start: details({
          playerId: 'start',
          fullName: 'Start Veteran',
          age: 27,
          weeklyProjection: projection,
          valueProfile: { dynastyValue: 3200, seasonValue: 5200, sources: ['KTC', 'FantasyPros'] },
        }),
        hold: details({
          playerId: 'hold',
          fullName: 'Hold Rookie',
          age: 21,
          weeklyProjection: { ...projection, projectedFantasyPoints: 4.8 },
          valueProfile: { dynastyValue: 2800, seasonValue: 900, sources: ['KTC'] },
          playerCohort: {
            draftCapital: {
              round: 1,
              pick: 22,
              tier: 'premium',
              label: 'Round 1',
              opportunityWindow: 'protected-runway',
              patienceScore: 86,
              note: 'Premium draft capital.',
            },
          } as NonNullable<PlayerDetails['playerCohort']>,
        }),
        spike: details({
          playerId: 'spike',
          fullName: 'Spike Flex',
          age: 26,
          weeklyProjection: { ...projection, projectedFantasyPoints: 12.4 },
          valueProfile: { dynastyValue: 2100, seasonValue: 3600, sources: ['KTC', 'FantasyPros'] },
        }),
        growth: details({
          playerId: 'growth',
          fullName: 'Growth Receiver',
          age: 23,
          valueProfile: { dynastyValue: 2600, seasonValue: 2700, sources: ['KTC'] },
          playerSituationDelta: {
            playerId: 'growth',
            name: 'Growth Receiver',
            position: 'WR',
            score: 82,
            confidence: 78,
            primaryLabel: 'role-boost',
            labels: ['role-boost', 'vacated-opportunity'],
            action: 'buy',
            summary: '',
            trace: [],
            missingSignals: [],
            cautionFlags: [],
            components: [],
            freshness: { grade: 'fresh', score: 90, signals: ['usage'], note: 'Fresh.' },
            dynamicSignals: [],
          },
        }),
      },
      redraftValuation: {
        status: 'ready',
        source: 'stored-redraft-valuation',
        projectionStatus: 'ready',
        generatedAt: '2026-06-01T00:00:00.000Z',
        note: 'Ready.',
        rows: [
          { playerId: 'start', name: 'Start Veteran', position: 'WR', team: 'BUF', owner: 'Contender', baseValue: 3200, projectionValue: 5200, scheduleAdjustment: 120, byeAdjustment: 30, roleAdjustment: 0, finalValue: 5350, valueDelta: 2150, confidence: 86, status: 'ready', sourceCount: 4, components: [], note: 'Ready.' },
          { playerId: 'spike', name: 'Spike Flex', position: 'WR', team: 'BUF', owner: 'Contender', baseValue: 2100, projectionValue: 3600, scheduleAdjustment: 160, byeAdjustment: -20, roleAdjustment: 0, finalValue: 3740, valueDelta: 1640, confidence: 82, status: 'ready', sourceCount: 4, components: [], note: 'Ready.' },
        ] as any,
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

    const result = buildDynastyContentionContext(reportData);
    const contender = result?.managers.find((manager) => manager.manager === 'Contender');

    expect(result?.status).toBe('ready');
    expect(contender?.rosterWindow).toBe('contender');
    expect(contender?.startNow.map((read) => read.player.name)).toContain('Start Veteran');
    expect(contender?.holdThroughDevelopment.map((read) => read.player.name)).toContain('Hold Rookie');
    expect(contender?.doNotPanicRunway.map((read) => read.player.name)).toContain('Hold Rookie');
    expect(contender?.sellOnProjectionSpike.map((read) => read.player.name)).toContain('Spike Flex');
    expect(contender?.buyBeforeRoleGrowth.map((read) => read.player.name)).toContain('Growth Receiver');
    expect(result?.rows.every((read) => read.confidence >= 0 && read.confidence <= 100)).toBe(true);
    const startRead = contender?.startNow.find((read) => read.player.name === 'Start Veteran');
    expect(startRead?.scheduleContextScore).toBe(150);
    expect(startRead?.signals).toContain('schedule-context');
    expect(startRead?.signals).toContain('positive-schedule-stretch');
    expect(startRead?.signals).toContain('bye-context');
    expect(startRead?.sourceTrace.join(' ')).toContain('redraft-schedule-adjustment:120');
  });
});
