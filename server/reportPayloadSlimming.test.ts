import { describe, expect, it } from 'vitest';
import { slimCachedLeagueReportPayload, slimReportDataForTransfer } from './reportPayloadSlimming';
import type { ReportData } from '../shared/types';

function createReport(): ReportData {
  return {
    playerDetailsById: {
      '1': {
        age: 25,
        team: 'BUF',
        valueProfile: { dynastyValue: 1000 },
      },
    },
    weeklyRisers: [{
      player_id: '1',
      name: 'Player One',
      owner: 'A',
      pos: 'QB',
      val_last: 900,
      val_now: 1000,
      diff: 100,
      pct_change: 0.11,
      playerDetails: {
        age: 25,
        team: 'BUF',
        valueProfile: { dynastyValue: 1000 },
      },
    }],
    weeklyFallers: [{
      player_id: '2',
      name: 'Player Two',
      owner: 'B',
      pos: 'RB',
      val_last: 1000,
      val_now: 900,
      diff: -100,
      pct_change: -0.1,
      playerDetails: {
        age: 24,
        team: 'DAL',
      },
    }],
    managerRosterValueGrowth: [],
    leagueOverview: [],
    projectedRisers: [],
    projectedFallers: [],
    tradeProfitLeaderboard: [],
    tradeHistory: [],
    positionDepth: [],
    managerPositionCounts: [],
    managerRosterIntelligence: [],
    draftPicks: [],
    draftStats: [],
    powerRankings: [],
    pickPortfolios: [],
    schedulePlanning: null,
    matchupPreviews: [],
    recentTransactions: [],
  } as unknown as ReportData;
}

describe('report payload slimming', () => {
  it('compacts embedded playerDetails when playerDetailsById already carries the same player id', () => {
    const report = createReport();
    const result = slimReportDataForTransfer(report);

    expect(result.stats.compactedEmbeddedPlayerDetails).toBe(1);
    expect(result.payload.weeklyRisers[0].playerDetails).toMatchObject({
      team: 'BUF',
      age: 25,
    });
    expect(result.payload.weeklyRisers[0].playerDetails).not.toHaveProperty('valueProfile');
    expect(result.payload.weeklyFallers[0]).toHaveProperty('playerDetails');
    expect(result.payload.playerDetailsById?.['1']).toMatchObject({
      team: 'BUF',
      valueProfile: { dynastyValue: 1000 },
    });
  });

  it('compacts nested playerDetails in roster, position, draft, and trade sections', () => {
    const detailedPlayer = {
      fullName: 'Player One',
      team: 'BUF',
      position: 'QB',
      age: 25,
      valueProfile: { dynastyValue: 1000, seasonValue: 900 },
      availabilityHistory: [{ season: '2025', games: 16, gamesMissed: 1 }],
      latestNews: { title: 'Long note', source: 'FantasyPros' },
      similarTradeValues: [{ playerId: '2', name: 'Peer', value: 980 }],
    };
    const report = {
      ...createReport(),
      playerDetailsById: {
        '1': detailedPlayer,
      },
      managerRosterIntelligence: [{
        manager: 'Manager A',
        starters: [{
          player_id: '1',
          name: 'Player One',
          pos: 'QB',
          value: 1000,
          playerDetails: detailedPlayer,
        }],
      }],
      managerPositionCounts: [{
        manager: 'Manager A',
        QB: 1,
        QB_starters: 1,
        RB: 0,
        RB_starters: 0,
        WR: 0,
        WR_starters: 0,
        TE: 0,
        TE_starters: 0,
        starterPlayers: [{
          player_id: '1',
          name: 'Player One',
          pos: 'QB',
          value: 1000,
          playerDetails: detailedPlayer,
        }],
        starterGroups: [{
          key: 'QB',
          label: 'QB',
          count: 1,
          players: [{
            player_id: '1',
            name: 'Player One',
            pos: 'QB',
            value: 1000,
            playerDetails: detailedPlayer,
          }],
        }],
      }],
      draftPicks: [{
        player_id: '1',
        playerName: 'Player One',
        playerDetails: detailedPlayer,
      }],
      tradeHistory: [{
        team_a: 'Manager A',
        team_b: 'Manager B',
        date: '2026-05-15',
        teamAAdds: [{
          player_id: '1',
          name: 'Player One',
          playerDetails: detailedPlayer,
        }],
      }],
    } as unknown as ReportData;

    const result = slimReportDataForTransfer(report);
    const payload = result.payload as any;

    expect(result.stats.compactedEmbeddedPlayerDetails).toBe(6);
    expect(payload.managerRosterIntelligence?.[0]?.starters?.[0]?.playerDetails).toMatchObject({
      fullName: 'Player One',
      team: 'BUF',
      position: 'QB',
    });
    expect(payload.managerRosterIntelligence?.[0]?.starters?.[0]?.playerDetails).not.toHaveProperty('valueProfile');
    expect(payload.managerPositionCounts[0].starterPlayers?.[0]?.playerDetails).not.toHaveProperty('availabilityHistory');
    expect(payload.managerPositionCounts[0].starterGroups?.[0]?.players?.[0]?.playerDetails).not.toHaveProperty('latestNews');
    expect(payload.draftPicks?.[0]?.playerDetails).not.toHaveProperty('similarTradeValues');
    expect(payload.tradeHistory[0].teamAAdds?.[0]?.playerDetails).not.toHaveProperty('valueProfile');
  });

  it('slims cached analyze payloads without mutating unrelated payloads', () => {
    const cached = {
      leagueId: '123',
      reportData: createReport(),
    };
    const result = slimCachedLeagueReportPayload(cached);

    expect(result.stats.compactedEmbeddedPlayerDetails).toBe(1);
    expect(result.payload.reportData.weeklyRisers[0].playerDetails).toMatchObject({
      team: 'BUF',
      age: 25,
    });
    expect(result.payload.reportData.weeklyRisers[0].playerDetails).not.toHaveProperty('valueProfile');
    expect(slimCachedLeagueReportPayload({ rankings: {} }).stats.compactedEmbeddedPlayerDetails).toBe(0);
  });

  it('removes duplicated legacy ranking arrays from transfer payloads', () => {
    const row = {
      id: 'dynasty_sf_ppr:test',
      name: 'Test Player',
      pos: 'RB',
      overallRank: 1,
      value: 9000,
      sources: ['KTC'],
      sourceCount: 1,
    };
    const result = slimCachedLeagueReportPayload({
      rankings: {
        profiles: {
          dynasty_sf_ppr: [row],
        },
        dynastySf: [row],
        dynastyOneQb: [row],
        devySf: [],
        devyOneQb: [],
      },
    });

    expect(result.stats.removedRankingLegacyArrays).toBe(2);
    expect(result.payload.rankings.profiles.dynasty_sf_ppr).toHaveLength(1);
    expect(result.payload.rankings.dynastySf).toEqual([]);
    expect(result.payload.rankings.dynastyOneQb).toEqual([]);
  });

  it('compacts repeated ranking prospect profiles while preserving card and modal fields', () => {
    const prospectProfile = {
      source: 'NFL Draft Buzz',
      sourceUrl: 'https://example.com/prospect',
      scrapeMonth: '2026-05',
      draftYear: 2027,
      name: 'Future Star',
      position: 'WR',
      college: 'Ohio State',
      playerImageUrl: 'https://example.com/player.png',
      collegeLogoUrl: 'https://example.com/college.png',
      overallRank: 1,
      positionRank: 1,
      height: '6-2',
      weight: '210',
      fortyYardDash: 4.4,
      role: 'Explosive X receiver',
      summary: 'A long scouting summary that should stay out of repeated profile rows.',
      projectedRookiePick: '1.01',
    };
    const result = slimCachedLeagueReportPayload({
      rankings: {
        profiles: {
          devy_sf_ppr: [{
            id: 'devy_sf_ppr:future-star',
            name: 'Future Star',
            pos: 'WR',
            overallRank: 1,
            value: 9999,
            sources: ['NFL Draft Buzz'],
            sourceCount: 1,
            isDevy: true,
            prospectProfile,
          }],
        },
        devySf: [],
      },
    });
    const compactProfile = result.payload.rankings.profiles.devy_sf_ppr[0].prospectProfile;

    expect(result.stats.compactedRankingProspectProfiles).toBe(1);
    expect(compactProfile).toMatchObject({
      source: 'NFL Draft Buzz',
      draftYear: 2027,
      college: 'Ohio State',
      height: '6-2',
      weight: '210',
      fortyYardDash: 4.4,
      role: 'Explosive X receiver',
      projectedRookiePick: '1.01',
    });
    expect(compactProfile).not.toHaveProperty('summary');
    expect(compactProfile).not.toHaveProperty('sourceUrl');
    expect(compactProfile).not.toHaveProperty('scrapeMonth');
  });
});
