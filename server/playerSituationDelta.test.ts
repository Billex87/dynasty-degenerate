import { describe, expect, it } from 'vitest';
import { buildPlayerSituationDelta, buildPlayerSituationDeltas } from './playerSituationDelta';
import type { PlayerDetails } from '../shared/types';

function player(overrides: Partial<PlayerDetails>): PlayerDetails {
  return {
    playerId: 'player-1',
    fullName: 'Test Player',
    position: 'WR',
    team: 'SEA',
    age: 23,
    valueProfile: {
      dynastyValue: 3200,
      sources: ['FantasyCalc', 'KTC'],
    },
    playerCohort: {
      draftCapital: {
        round: 2,
        pick: 45,
        tier: 'day-two',
        label: 'Round 2, pick 45',
        opportunityWindow: 'prove-it-window',
        patienceScore: 72,
        note: 'Draft capital gives some runway.',
      },
    } as NonNullable<PlayerDetails['playerCohort']>,
    ...overrides,
  } as PlayerDetails;
}

function usage(overrides: Partial<NonNullable<PlayerDetails['usageTrend']>> = {}): NonNullable<PlayerDetails['usageTrend']> {
  return {
    season: '2025',
    team: 'SEA',
    games: 17,
    targets: 82,
    carries: 0,
    receptions: 58,
    fantasyPointsPpr: 188,
    fantasyPointsPprPerGame: 11.1,
    avgTargetShare: 0.18,
    airYardsShare: 0.22,
    wopr: 0.48,
    avgOffenseSnapPct: 72,
    recentTargets: 24,
    recentCarries: 0,
    targetTrend: 'up',
    carryTrend: 'flat',
    note: 'Targets and snaps rose into the final window.',
    ...overrides,
  };
}

function teamEnvironment(overrides: Partial<NonNullable<PlayerDetails['teamEnvironment']>> = {}): NonNullable<PlayerDetails['teamEnvironment']> {
  return {
    source: 'nflverse team stats',
    season: '2025',
    team: 'SEA',
    games: 17,
    passAttempts: 590,
    carries: 390,
    targets: 570,
    dropbacks: 640,
    designedPlayVolume: 980,
    passRate: 0.61,
    rushRate: 0.39,
    playsPerGame: 64,
    targetsPerGame: 34,
    passingEpa: 0.08,
    rushingEpa: 0.01,
    passRateRank: 8,
    rushRateRank: 24,
    neutralScriptPlays: 500,
    neutralScriptPassRate: 0.6,
    redZonePlays: 140,
    redZonePassRate: 0.58,
    redZoneRushRate: 0.42,
    nonGarbagePlays: 900,
    nonGarbagePassRate: 0.6,
    estimatedSecondsPerPlay: 27,
    paceRank: 9,
    noHuddleRate: 0.08,
    tendency: 'pass-heavy',
    note: 'Seattle was pass-heavy with above-average target volume.',
    ...overrides,
  };
}

function rosterRoom(overrides: Partial<NonNullable<PlayerDetails['rosterRoom']>> = {}): NonNullable<PlayerDetails['rosterRoom']> {
  return {
    source: 'nflverse rosters/weekly rosters/depth charts/trades',
    season: '2026',
    previousSeason: '2025',
    team: 'SEA',
    position: 'WR',
    currentCount: 6,
    previousCount: 7,
    netChange: -1,
    additions: [],
    losses: [],
    rookieAdditions: [],
    premiumAdditions: [],
    depthChartTop: [{ name: 'Test Player', rank: 1, slot: 'WR1' }],
    movementTypes: ['roster-loss'],
    weeklyCoverage: { currentSeasonPlayers: 6, previousSeasonPlayers: 7 },
    opportunityDelta: {
      vacatedTargets: 150,
      vacatedCarries: 0,
      vacatedReceptions: 98,
      vacatedFantasyPointsPpr: 260,
      addedPriorTargets: 18,
      addedPriorCarries: 0,
      addedPriorReceptions: 11,
      addedPriorFantasyPointsPpr: 36,
      vacatedImpactScore: 84,
      addedThreatScore: 8,
      netOpportunityScore: 76,
      qualitySignal: 'major-opening',
      incumbentPromotionScore: 76,
      incumbentOpportunitySignal: 'major-promotion',
      topVacatedPlayer: 'Veteran Alpha',
      topAddedThreat: null,
      topReturningDepthPlayer: 'Test Player',
      returningPromotionCandidates: [],
      note: 'Major target volume left and Test Player is the top returning depth option.',
    },
    competitionLevel: 'thin',
    vacatedOpportunitySignal: 'opening',
    note: 'The room thinned out.',
    ...overrides,
  };
}

describe('player situation delta', () => {
  it('flags JSN-style vacated opportunity as a role boost', () => {
    const delta = buildPlayerSituationDelta(player({
      usageTrend: usage(),
      teamEnvironment: teamEnvironment(),
      rosterRoom: rosterRoom(),
      valueTimeline: {
        profileKey: 'dynasty',
        source: 'stored-value-snapshots',
        points: [],
        summary: {
          startValue: 2800,
          endValue: 3200,
          delta: 400,
          deltaPct: 14,
          sourceSetChanged: false,
          eventCount: 1,
          note: 'Stored value moved up after the room opened.',
        },
      },
    }), 'wr1');

    expect(delta).toMatchObject({
      primaryLabel: 'role-boost',
      action: 'buy',
    });
    expect(delta?.labels).toContain('vacated-opportunity');
    expect(delta?.summary).toMatch(/role boost/i);
  });

  it('keeps inferred free-agent or claim movement source-limited until an official transaction source exists', () => {
    const base = player({
      usageTrend: usage(),
      teamEnvironment: teamEnvironment(),
      rosterRoom: rosterRoom({ movementTypes: ['roster-loss'] }),
      valueTimeline: {
        profileKey: 'dynasty',
        source: 'stored-value-snapshots',
        points: [],
        summary: {
          startValue: 2800,
          endValue: 3200,
          delta: 400,
          deltaPct: 14,
          sourceSetChanged: false,
          eventCount: 1,
          note: 'Stored value moved up after the room opened.',
        },
      },
    });
    const confirmedDelta = buildPlayerSituationDelta(base, 'confirmed-room');
    const inferredDelta = buildPlayerSituationDelta({
      ...base,
      rosterRoom: rosterRoom({ movementTypes: ['free-agent-or-claim'] }),
    }, 'inferred-room');

    expect(inferredDelta?.dynamicSignals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'source',
        label: 'Inferred free-agent/claim movement',
        direction: 'neutral',
      }),
    ]));
    expect(inferredDelta?.cautionFlags).toContain('inferred free-agent/claim movement');
    expect(inferredDelta?.confidence).toBeLessThan(confirmedDelta?.confidence || 0);
  });

  it('keeps high-draft-capital rookies in a patience bucket when production is thin', () => {
    const delta = buildPlayerSituationDelta(player({
      fullName: 'Round One Rookie',
      age: 21,
      yearsExp: 0,
      usageTrend: null,
      rosterRoom: rosterRoom({
        opportunityDelta: {
          ...rosterRoom().opportunityDelta!,
          qualitySignal: 'stable',
          netOpportunityScore: 0,
          note: 'Room is stable.',
        },
        vacatedOpportunitySignal: 'stable',
        competitionLevel: 'normal',
      }),
      playerCohort: {
        draftCapital: {
          round: 1,
          pick: 12,
          tier: 'premium',
          label: 'Round 1, pick 12',
          opportunityWindow: 'protected-runway',
          patienceScore: 90,
          note: 'Draft capital should buy patience.',
        },
      } as NonNullable<PlayerDetails['playerCohort']>,
    }), 'rookie');

    expect(delta?.labels).toContain('draft-capital-patience');
    expect(delta?.action).toBe('stash');
    expect(delta?.missingSignals).toContain('usage trend');
  });

  it('flags premium same-position additions as a role threat', () => {
    const delta = buildPlayerSituationDelta(player({
      fullName: 'Veteran Receiver',
      age: 28,
      usageTrend: usage({ targetTrend: 'down', note: 'Targets slipped late.' }),
      teamEnvironment: teamEnvironment(),
      rosterRoom: rosterRoom({
        additions: [{ name: 'First Round WR', draftRound: 1, movementQualityTier: 'starter', movementImpactScore: 72 }],
        rookieAdditions: [{ name: 'First Round WR', draftRound: 1, movementQualityTier: 'starter', movementImpactScore: 72 }],
        premiumAdditions: [{ name: 'First Round WR', draftRound: 1, movementQualityTier: 'starter', movementImpactScore: 72 }],
        competitionLevel: 'crowded',
        vacatedOpportunitySignal: 'squeeze',
        opportunityDelta: {
          ...rosterRoom().opportunityDelta!,
          addedThreatScore: 85,
          netOpportunityScore: -70,
          qualitySignal: 'major-squeeze',
          incumbentOpportunitySignal: 'blocked',
          topAddedThreat: 'First Round WR',
          note: 'A high-impact rookie addition squeezed the room.',
        },
      }),
    }), 'vet-wr');

    expect(delta?.primaryLabel).toBe('role-threat');
    expect(delta?.labels).toContain('crowded-room');
    expect(delta?.action).toBe('monitor');
    expect(delta?.dynamicSignals.some((signal) => signal.label === 'Premium competition added')).toBe(true);
    expect(delta?.freshness.signals).toContain('roster room 2026');
  });

  it('detects an aging running back opportunity cliff', () => {
    const delta = buildPlayerSituationDelta(player({
      fullName: 'Aging Back',
      position: 'RB',
      age: 28,
      usageTrend: usage({
        carries: 118,
        targets: 24,
        receptions: 18,
        fantasyPointsPprPerGame: 8.1,
        avgTargetShare: 0.05,
        avgOffenseSnapPct: 42,
        targetTrend: 'down',
        carryTrend: 'down',
        note: 'Carries, targets, and snaps are slipping.',
      }),
      contractProfile: {
        source: 'nflverse contracts',
        investmentTier: 'fringe',
        note: 'Low guaranteed money and short commitment.',
      },
      playerCohort: {
        draftCapital: {
          round: 6,
          pick: 190,
          tier: 'late-round',
          label: 'Round 6, pick 190',
          opportunityWindow: 'short-leash',
          patienceScore: 30,
          note: 'Late capital gives little patience.',
        },
      } as NonNullable<PlayerDetails['playerCohort']>,
    }), 'aging-rb');

    expect(delta?.labels).toContain('opportunity-cliff');
    expect(delta?.labels).toContain('late-capital-urgency');
    expect(delta?.cautionFlags.join(' ')).toMatch(/leash|role|runway|opportunity|quality|availability/i);
  });

  it('caps low-sample market hype as a fragile breakout', () => {
    const delta = buildPlayerSituationDelta(player({
      fullName: 'Hype Receiver',
      valueProfile: { dynastyValue: 4600, sources: ['KTC'] },
      usageTrend: usage({
        games: 4,
        targets: 14,
        receptions: 8,
        fantasyPointsPpr: 60,
        fantasyPointsPprPerGame: 15,
        avgTargetShare: 0.09,
        airYardsShare: 0.08,
        wopr: 0.18,
        avgOffenseSnapPct: 38,
        recentTargets: 7,
        targetTrend: 'flat',
        note: 'Production spiked on limited snaps and target share.',
      }),
      valueTimeline: {
        profileKey: 'dynasty',
        source: 'stored-value-snapshots',
        points: [],
        summary: {
          startValue: 3000,
          endValue: 4600,
          delta: 1600,
          deltaPct: 53,
          sourceSetChanged: false,
          eventCount: 0,
          note: 'Market value jumped before role quality caught up.',
        },
      },
    }), 'hype-wr');

    expect(delta?.primaryLabel).toBe('fragile-breakout');
    expect(delta?.action).toBe('sell');
    expect(delta?.confidence).toBeLessThan(70);
  });

  it('exposes rolling usage and news as dynamic freshness signals', () => {
    const delta = buildPlayerSituationDelta(player({
      latestNews: {
        title: 'Test Player taking first-team reps',
        summary: 'Beat notes point to a larger role.',
        source: 'Fixture',
        publishedAt: new Date().toISOString(),
      },
      usageTrend: usage({
        rollingWindows: [{
          games: 3,
          weeks: [15, 16, 17],
          targetsPerGame: 8.3,
          carriesPerGame: 0,
          receptionsPerGame: 5.7,
          fantasyPointsPprPerGame: 17.2,
          targetDeltaPerGame: 3.1,
          carryDeltaPerGame: 0,
          note: 'Last 3 tracked games: 8.3 targets/g (+3.1 vs season), 0 carries/g (+0 vs season).',
        }],
      }),
      teamEnvironment: teamEnvironment(),
      rosterRoom: rosterRoom(),
    }), 'wr-news');

    expect(delta?.dynamicSignals.map((signal) => signal.label)).toContain('Rolling role spike');
    expect(delta?.dynamicSignals.map((signal) => signal.label)).toContain('News attached');
    expect(delta?.freshness.grade).toMatch(/fresh|usable/);
    expect(delta?.freshness.signals).toContain('rolling usage windows');
  });

  it('maps FantasyPros news categories into value-movement situation signals', () => {
    const publishedAt = new Date().toISOString();
    const delta = buildPlayerSituationDelta(player({
      fullName: 'News Receiver',
      valueProfile: {
        dynastyValue: 3000,
        sources: ['FantasyPros'],
        fantasyProsSourceTrace: [{
          source: 'FantasyPros',
          key: 'NEWS',
          label: 'Stored news',
          status: 'Injury',
          lastUpdated: publishedAt,
          evidence: 'news "News Receiver misses practice"; source FantasyPros; published 2026-06-04T00:00:00.000Z; endpoint metadata: fantasypros-news.',
        }],
      },
      latestNews: {
        title: 'News Receiver misses practice',
        summary: 'A hamstring injury kept him limited.',
        source: 'FantasyPros',
        publishedAt,
      },
      newsValueMovement: {
        newsTitle: 'News Receiver misses practice',
        newsPublishedAt: publishedAt,
        currentValue: 3000,
        previousValue: 3500,
        valueDelta: -500,
        valueDeltaPct: -14.3,
        note: 'News is attached and stored value is down 14.3% from the baseline snapshot.',
      },
      usageTrend: usage(),
      teamEnvironment: teamEnvironment(),
      rosterRoom: rosterRoom(),
    }), 'news-wr');

    const fantasyProsSignal = delta?.dynamicSignals.find((signal) => signal.label === 'Stored injury news moved value');

    expect(fantasyProsSignal).toMatchObject({
      type: 'news',
      direction: 'risk',
      eventAt: publishedAt,
      detail: 'News is attached and stored value is down 14.3% from the baseline snapshot. Stored news category: injury news.',
    });
    expect(delta?.freshness.signals.some((signal) => signal.includes('Stored injury news'))).toBe(true);
  });

  it('builds a map and skips unsupported positions', () => {
    const deltas = buildPlayerSituationDeltas({
      playerDetailsById: {
        wr: player({ usageTrend: usage() }),
        dst: player({ position: 'DEF' }),
      },
    });

    expect(Object.keys(deltas)).toEqual(['wr']);
  });
});
