import { describe, expect, it } from 'vitest';
import type { ActionPlanRecord, ManagerIntelPlayer, ReportData, WeeklyMomentum } from '@shared/types';
import { buildTradeOutcomeLearning, getBlueprintSignal, getTradePlanOutcomeRead } from './CommandCenterExpansion';

type ManagerIntelRow = NonNullable<ReportData['managerRosterIntelligence']>[number];

function player(name: string, overrides: Partial<ManagerIntelPlayer> = {}): ManagerIntelPlayer {
  return {
    name,
    pos: 'WR',
    value: 1000,
    player_id: name.toLowerCase().replace(/\s+/g, '-'),
    ...overrides,
  } as ManagerIntelPlayer;
}

function intel(overrides: Partial<ManagerIntelRow> = {}): ManagerIntelRow {
  return {
    manager: 'Bill',
    identity: 'Contender',
    timeline: 'Contend',
    summary: '',
    starterValue: 10000,
    benchValue: 5000,
    starterValuePct: 55,
    bestBenchStash: null,
    weakestStarter: null,
    oldestPlayer: null,
    youngCorePlayer: null,
    breakoutCandidate: null,
    lastSeasonStud: null,
    buyTarget: null,
    sellCandidate: null,
    tradeChip: null,
    injuryInsurance: null,
    droppablePlayers: [],
    untouchablePlayers: [],
    taxiTriage: { items: [], summary: '', counts: { stash: 0, monitor: 0, cut: 0 } },
    similarValuePlayers: { QB: null, RB: null, WR: null, TE: null },
    avgAge: null,
    avgAgeByPosition: { QB: null, RB: null, WR: null, TE: null },
    starterAvailability: { avgGamesMissed: null, riskLevel: 'low', riskiestStarter: null },
    ageFlags: [],
    holes: {
      bestQbRank: null,
      rb2Rank: null,
      wr3Rank: null,
      te1Rank: null,
      flexDepth: 0,
      summary: 'No major roster hole flagged',
    },
    ...overrides,
  } as ManagerIntelRow;
}

function momentum(item: ManagerIntelPlayer, pct_change: number): WeeklyMomentum {
  return {
    name: item.name,
    player_id: item.player_id,
    owner: 'Bill',
    pct_change,
    current_value: item.value || 0,
    previous_value: item.value || 0,
    delta: 0,
  } as WeeklyMomentum;
}

describe('getBlueprintSignal', () => {
  it('marks returned buy targets as buys', () => {
    const target = player('CeeDee Lamb');

    expect(getBlueprintSignal(target, intel({ buyTarget: target }), [], [])).toMatchObject({
      signal: 'buy',
      label: 'Buy',
    });
  });

  it('marks returned sell candidates as sells', () => {
    const candidate = player('Travis Kelce', { pos: 'TE' });

    expect(getBlueprintSignal(candidate, intel({ sellCandidate: candidate }), [], [])).toMatchObject({
      signal: 'sell',
      label: 'Sell',
    });
  });

  it('uses weekly movement when no explicit action exists', () => {
    const riser = player('Omarion Hampton', { pos: 'RB' });
    const faller = player('Kyle Pitts', { pos: 'TE' });

    expect(getBlueprintSignal(riser, intel(), [momentum(riser, 12.5)], [])).toMatchObject({
      signal: 'buy',
      label: 'Riser',
      weeklyChange: 12.5,
    });
    expect(getBlueprintSignal(faller, intel(), [], [momentum(faller, -11.2)])).toMatchObject({
      signal: 'sell',
      label: 'Faller',
      weeklyChange: -11.2,
    });
  });

  it('keeps young core and untouchable players as core holds', () => {
    const core = player('JaMarr Chase');

    expect(getBlueprintSignal(core, intel({ youngCorePlayer: core, untouchablePlayers: [core] }), [], [])).toMatchObject({
      signal: 'hold',
      label: 'Core Hold',
    });
  });
});

describe('trade outcome learning', () => {
  const basePlan: ActionPlanRecord = {
    id: 'trade:league:bill:rival:wr1',
    kind: 'trade',
    leagueId: 'league',
    manager: 'Bill',
    playerId: 'wr1',
    createdAt: Date.parse('2026-05-01T12:00:00.000Z'),
    title: 'Trade read: Rival',
    summary: 'Open with Rival.',
    status: 'saved',
    payload: {
      sourceManager: 'Bill',
      targetManager: 'Rival',
      targetPlayerId: 'wr1',
      targetPlayerName: 'Wide Receiver',
    },
  };

  it('marks saved trade reads as stale when no ledger or proposal outcome arrives', () => {
    const outcome = getTradePlanOutcomeRead(
      { tradeHistory: [], tradeProposalSignals: [] } as unknown as ReportData,
      basePlan,
      Date.parse('2026-05-20T12:00:00.000Z')
    );

    expect(outcome).toMatchObject({
      status: 'stale',
      source: 'aging-window',
    });
  });

  it('summarizes acted, blocked, stale, and open trade outcomes', () => {
    const learning = buildTradeOutcomeLearning([
      { ...basePlan, id: 'acted', status: 'acted' },
      { ...basePlan, id: 'blocked', status: 'blocked' },
      { ...basePlan, id: 'stale', status: 'stale' },
      { ...basePlan, id: 'saved', status: 'saved' },
    ]);

    expect(learning).toMatchObject({
      acted: 1,
      blocked: 1,
      stale: 1,
      open: 1,
      actedRate: 33,
    });
  });
});
