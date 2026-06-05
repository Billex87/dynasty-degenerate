import { describe, expect, it } from 'vitest';
import {
  enrichPlayerDetailsWithNflverseContext,
  normalizeNflverseAthleticRows,
  normalizeNflverseContractRows,
  normalizeNflverseInjuryRows,
  normalizeNflverseRosterRoomRows,
  normalizeNflverseTeamEnvironmentRows,
  normalizeNflverseUsageRows,
  type NflversePlayerContext,
} from './nflversePlayerContext';
import type { PlayerDetails } from '../shared/types';

describe('nflverse player context', () => {
  it('summarizes usage, snap, injury, athletic, and contract context for player details', () => {
    const usage = normalizeNflverseUsageRows({
      season: '2025',
      statsRows: [
        { season: '2025', season_type: 'REG', week: '1', player_id: '00-1', player_display_name: 'Signal Back', position: 'RB', carries: '6', targets: '1', receptions: '1', fantasy_points_ppr: '4', target_share: '0.04' },
        { season: '2025', season_type: 'REG', week: '2', player_id: '00-1', player_display_name: 'Signal Back', position: 'RB', carries: '8', targets: '2', receptions: '2', fantasy_points_ppr: '7', target_share: '0.07' },
        { season: '2025', season_type: 'REG', week: '3', player_id: '00-1', player_display_name: 'Signal Back', position: 'RB', carries: '14', targets: '4', receptions: '3', fantasy_points_ppr: '16', target_share: '0.14' },
        { season: '2025', season_type: 'REG', week: '4', player_id: '00-1', player_display_name: 'Signal Back', position: 'RB', carries: '18', targets: '5', receptions: '4', fantasy_points_ppr: '20', target_share: '0.18' },
      ],
      snapRows: [
        { season: '2025', game_type: 'REG', player: 'Signal Back', position: 'RB', offense_pct: '0.72' },
        { season: '2025', game_type: 'REG', player: 'Signal Back', position: 'RB', offense_pct: '0.81' },
      ],
    });
    const injuries = normalizeNflverseInjuryRows([
      { season: '2025', gsis_id: '00-1', full_name: 'Signal Back', position: 'RB', report_primary_injury: 'Hamstring', report_status: 'Questionable' },
    ], '2025');
    const athletic = normalizeNflverseAthleticRows([
      { pfr_id: 'SignBa00', player_name: 'Signal Back', pos: 'RB', draft_year: '2025', ht: '5-11', wt: '214', forty: '4.45', bench: '22', vertical: '38', broad_jump: '124' },
    ]);
    const contracts = normalizeNflverseContractRows([
      { player: 'Signal Back', position: 'RB', team: 'ARI', year_signed: '2025', years: '4', value: '64000000', apy: '16000000', guaranteed: '32000000' },
    ]);
    const rosterRooms = normalizeNflverseRosterRoomRows({
      season: '2026',
      previousSeason: '2025',
      currentRosterRows: [
        { season: '2026', team: 'ARI', position: 'RB', full_name: 'Signal Back', gsis_id: '00-1', sleeper_id: '123', status: 'ACT', years_exp: '1', rookie_year: '2025', draft_round: '1', draft_number: '18' },
        { season: '2026', team: 'ARI', position: 'RB', full_name: 'Day Two Threat', gsis_id: '00-3', status: 'ACT', years_exp: '0', rookie_year: '2026', draft_round: '2', draft_number: '54' },
        { season: '2026', team: 'ARI', position: 'WR', full_name: 'Slot Add', gsis_id: '00-4', status: 'ACT', years_exp: '0', rookie_year: '2026', draft_round: '5', draft_number: '155' },
      ],
      previousRosterRows: [
        { season: '2025', team: 'ARI', position: 'RB', full_name: 'Signal Back', gsis_id: '00-1', status: 'ACT', years_exp: '1', rookie_year: '2025', draft_round: '1', draft_number: '18' },
        { season: '2025', team: 'ARI', position: 'RB', full_name: 'Veteran Gone', gsis_id: '00-2', status: 'ACT', years_exp: '6' },
      ],
      previousSeasonUsageRows: [
        {
          source: 'nflverse player stats and snap counts',
          gsisId: '00-2',
          playerName: 'Veteran Gone',
          position: 'RB',
          team: 'ARI',
          season: '2025',
          games: 16,
          targets: 51,
          carries: 178,
          receptions: 39,
          fantasyPointsPpr: 214.4,
          fantasyPointsPprPerGame: 13.4,
          avgTargetShare: 0.11,
          airYardsShare: null,
          wopr: null,
          avgOffenseSnapPct: null,
          recentTargets: 12,
          recentCarries: 42,
          targetTrend: 'flat',
          carryTrend: 'flat',
          note: 'fixture',
        },
      ],
      currentWeeklyRosterRows: [
        { season: '2026', week: '1', team: 'ARI', position: 'RB', full_name: 'Signal Back', gsis_id: '00-1', status: 'ACT', years_exp: '1', rookie_year: '2025', draft_round: '1', draft_number: '18' },
        { season: '2026', week: '1', team: 'ARI', position: 'RB', full_name: 'Day Two Threat', gsis_id: '00-3', status: 'ACT', years_exp: '0', rookie_year: '2026', draft_round: '2', draft_number: '54' },
      ],
      previousWeeklyRosterRows: [
        { season: '2025', week: '1', team: 'ARI', position: 'RB', full_name: 'Veteran Gone', gsis_id: '00-2', status: 'ACT', years_exp: '6' },
        { season: '2025', week: '12', team: 'ARI', position: 'RB', full_name: 'Veteran Gone', gsis_id: '00-2', status: 'RES', years_exp: '6' },
      ],
      depthChartRows: [
        { team: 'ARI', pos_abb: 'RB', player_name: 'Signal Back', gsis_id: '00-1', pos_rank: '1', pos_slot: 'RB1' },
        { team: 'ARI', pos_abb: 'RB', player_name: 'Day Two Threat', gsis_id: '00-3', pos_rank: '2', pos_slot: 'RB2' },
      ],
      tradeRows: [
        { season: '2025', trade_date: '2025-10-20', gave: 'ARI', received: 'TEN', pfr_id: 'GoneVe00', pfr_name: 'Veteran Gone' },
      ],
    });
    const teamEnvironment = normalizeNflverseTeamEnvironmentRows([
      { season: '2025', team: 'ARI', season_type: 'REG', games: '17', attempts: '650', sacks_suffered: '50', carries: '360', targets: '610', passing_epa: '22', rushing_epa: '-8' },
      { season: '2025', team: 'ATL', season_type: 'REG', games: '17', attempts: '500', sacks_suffered: '30', carries: '500', targets: '480', passing_epa: '-10', rushing_epa: '18' },
    ], '2025', [
      { season: '2025', season_type: 'REG', game_id: '2025_01_ARI_ATL', posteam: 'ARI', play_type: 'pass', pass_attempt: '1', qb_dropback: '1', rush_attempt: '0', score_differential: '0', yardline_100: '18', game_seconds_remaining: '3500' },
      { season: '2025', season_type: 'REG', game_id: '2025_01_ARI_ATL', posteam: 'ARI', play_type: 'pass', pass_attempt: '1', qb_dropback: '1', rush_attempt: '0', score_differential: '3', yardline_100: '12', game_seconds_remaining: '3470' },
      { season: '2025', season_type: 'REG', game_id: '2025_01_ARI_ATL', posteam: 'ARI', play_type: 'run', pass_attempt: '0', qb_dropback: '0', rush_attempt: '1', score_differential: '10', yardline_100: '50', game_seconds_remaining: '3440' },
      { season: '2025', season_type: 'REG', game_id: '2025_01_ARI_ATL', posteam: 'ATL', play_type: 'run', pass_attempt: '0', qb_dropback: '0', rush_attempt: '1', score_differential: '0', yardline_100: '10', game_seconds_remaining: '3400', no_huddle: '1' },
      { season: '2025', season_type: 'REG', game_id: '2025_01_ARI_ATL', posteam: 'ATL', play_type: 'pass', pass_attempt: '1', qb_dropback: '1', rush_attempt: '0', score_differential: '21', qtr: '4', yardline_100: '70', game_seconds_remaining: '300' },
    ]);

    const context: NflversePlayerContext = {
      usageByGsisId: { '00-1': usage[0] },
      teamEnvironmentByTeam: { ARI: teamEnvironment[0], ATL: teamEnvironment[1] },
      rosterRoomByTeamPosition: { 'ARI:RB': rosterRooms.find((row) => row.team === 'ARI' && row.position === 'RB')! },
      injuryByGsisId: { '00-1': injuries[0] },
      athleticByPfrId: { SignBa00: athletic[0] },
      athleticByNamePosition: { 'signalback:RB': athletic },
      contractByName: { signalback: contracts[0] },
      rowCounts: [],
    };
    const details: Record<string, PlayerDetails> = {
      '123': {
        playerId: '123',
        fullName: 'Signal Back',
        position: 'RB',
        team: 'ARI',
        externalIds: { gsis: '00-1', pfr: 'SignBa00' },
      },
    };

    const enriched = enrichPlayerDetailsWithNflverseContext(details, context)['123'];

    expect(enriched.usageTrend).toMatchObject({
      season: '2025',
      games: 4,
      targets: 12,
      carries: 46,
      targetTrend: 'up',
      carryTrend: 'up',
    });
    expect(enriched.usageTrend?.rollingWindows?.[0]).toMatchObject({
      games: 3,
      weeks: [2, 3, 4],
      targetsPerGame: 3.7,
      carriesPerGame: 13.3,
      targetDeltaPerGame: 0.7,
      carryDeltaPerGame: 1.8,
    });
    expect(enriched.usageTrend?.avgOffenseSnapPct).toBeCloseTo(0.765);
    expect(enriched.teamEnvironment).toMatchObject({
      team: 'ARI',
      tendency: 'pass-heavy',
      passRate: 0.66,
      rushRate: 0.34,
      neutralScriptPassRate: 1,
      redZonePassRate: 1,
      nonGarbagePassRate: 0.667,
      estimatedSecondsPerPlay: 30,
    });
    expect(enriched.rosterRoom).toMatchObject({
      season: '2026',
      previousSeason: '2025',
      team: 'ARI',
      position: 'RB',
      currentCount: 2,
      previousCount: 2,
      competitionLevel: 'normal',
      vacatedOpportunitySignal: 'stable',
    });
    expect(enriched.rosterRoom?.additions[0]).toMatchObject({
      name: 'Day Two Threat',
      draftRound: 2,
      movementType: 'draft-pick',
      firstSeenWeek: 1,
    });
    expect(enriched.rosterRoom?.losses[0]).toMatchObject({
      name: 'Veteran Gone',
      movementType: 'trade',
      lastSeenWeek: 12,
      tradeFromTeam: 'ARI',
      tradeToTeam: 'TEN',
      priorSeasonTargets: 51,
      priorSeasonCarries: 178,
      movementQualityTier: 'star',
    });
    expect(enriched.rosterRoom?.movementTypes).toContain('draft-pick');
    expect(enriched.rosterRoom?.movementTypes).toContain('trade');
    expect(enriched.rosterRoom?.opportunityDelta).toMatchObject({
      vacatedTargets: 51,
      vacatedCarries: 178,
      topVacatedPlayer: 'Veteran Gone',
      qualitySignal: 'major-opening',
    });
    expect(enriched.injuryHistory).toMatchObject({
      missedOrLimitedCount: 1,
      injuryTypes: ['Hamstring'],
    });
    expect(enriched.athleticProfile?.speedScore).toBeGreaterThan(90);
    expect(enriched.athleticProfile).toMatchObject({
      forty: 4.45,
      bench: 22,
      vertical: 38,
      broadJump: 124,
    });
    expect(enriched.contractProfile).toMatchObject({
      investmentTier: 'premium',
      apy: 16000000,
    });
  });

  it('matches combine rows by player name and fantasy position when PFR is missing', () => {
    const athletic = normalizeNflverseAthleticRows([
      { pfr_id: '', player_name: 'Fast Wideout', pos: 'WR', draft_year: '2026', ht: '6-0', wt: '190', forty: '4.33', bench: '14', vertical: '41', broad_jump: '132', cone: '6.82', shuttle: '4.12' },
      { pfr_id: 'FastWr01', player_name: 'Fast Wideout', pos: 'WR', draft_year: '2024', ht: '6-0', wt: '188', forty: '4.6' },
      { pfr_id: 'Hybrid01', player_name: 'Hybrid Corner', pos: 'CB/WR', draft_year: '2026', ht: '6-0', wt: '188', forty: '4.37' },
    ]);
    const context: NflversePlayerContext = {
      usageByGsisId: {},
      teamEnvironmentByTeam: {},
      rosterRoomByTeamPosition: {},
      injuryByGsisId: {},
      athleticByPfrId: Object.fromEntries(athletic.flatMap((row) => row.pfrId ? [[row.pfrId, row]] : [])),
      athleticByNamePosition: {
        'fastwideout:WR': athletic.filter((row) => row.playerName === 'Fast Wideout'),
        'hybridcorner:WR': athletic.filter((row) => row.playerName === 'Hybrid Corner'),
      },
      contractByName: {},
      rowCounts: [],
    };

    const enriched = enrichPlayerDetailsWithNflverseContext({
      'prospect-1': {
        fullName: 'Fast Wideout',
        position: 'WR',
        rookieYear: 2026,
        externalIds: {},
      },
      'prospect-2': {
        fullName: 'Hybrid Corner',
        position: 'WR',
        rookieYear: 2026,
        externalIds: {},
      },
    }, context);

    expect(enriched['prospect-1'].athleticProfile).toMatchObject({
      draftYear: 2026,
      forty: 4.33,
      bench: 14,
      vertical: 41,
      broadJump: 132,
      cone: 6.82,
      shuttle: 4.12,
    });
    expect(enriched['prospect-2'].athleticProfile).toMatchObject({
      position: 'WR',
      forty: 4.37,
    });
  });

  it('keeps aggregate stats_player rows honest without fake weekly trends', () => {
    const usage = normalizeNflverseUsageRows({
      season: '2025',
      statsRows: [
        { season: '2025', season_type: 'REG', player_id: '00-2', player_display_name: 'Volume Wideout', recent_team: 'BUF', position: 'WR', games: '17', targets: '141', receptions: '92', carries: '3', fantasy_points_ppr: '282.5', target_share: '0.28', air_yards_share: '0.41', wopr: '0.72' },
      ],
      snapRows: [
        { season: '2025', game_type: 'REG', player: 'Volume Wideout', position: 'WR', offense_pct: '0.88' },
      ],
    });

    expect(usage[0]).toMatchObject({
      team: 'BUF',
      games: 17,
      targets: 141,
      receptions: 92,
      avgTargetShare: 0.28,
      airYardsShare: 0.41,
      wopr: 0.72,
      targetTrend: 'unknown',
      carryTrend: 'unknown',
      recentTargets: 141,
    });
    expect(usage[0].note).toContain('aggregate stats_player snapshot');
  });

  it('builds rolling usage windows from weekly targets, carries, points, and snap rows', () => {
    const usage = normalizeNflverseUsageRows({
      season: '2025',
      statsRows: [
        { season: '2025', season_type: 'REG', week: '1', player_id: '00-usage', player_display_name: 'Usage Riser', recent_team: 'DET', position: 'WR', targets: '2', carries: '0', receptions: '1', fantasy_points_ppr: '3.1', target_share: '0.08' },
        { season: '2025', season_type: 'REG', week: '2', player_id: '00-usage', player_display_name: 'Usage Riser', recent_team: 'DET', position: 'WR', targets: '3', carries: '0', receptions: '2', fantasy_points_ppr: '5.4', target_share: '0.11' },
        { season: '2025', season_type: 'REG', week: '3', player_id: '00-usage', player_display_name: 'Usage Riser', recent_team: 'DET', position: 'WR', targets: '4', carries: '1', receptions: '3', fantasy_points_ppr: '8.2', target_share: '0.14' },
        { season: '2025', season_type: 'REG', week: '4', player_id: '00-usage', player_display_name: 'Usage Riser', recent_team: 'DET', position: 'WR', targets: '8', carries: '1', receptions: '5', fantasy_points_ppr: '13.9', target_share: '0.2' },
        { season: '2025', season_type: 'REG', week: '5', player_id: '00-usage', player_display_name: 'Usage Riser', recent_team: 'DET', position: 'WR', targets: '9', carries: '2', receptions: '6', fantasy_points_ppr: '16.5', target_share: '0.24' },
        { season: '2025', season_type: 'REG', week: '6', player_id: '00-usage', player_display_name: 'Usage Riser', recent_team: 'DET', position: 'WR', targets: '10', carries: '2', receptions: '7', fantasy_points_ppr: '19.8', target_share: '0.26' },
      ],
      snapRows: [
        { season: '2025', game_type: 'REG', week: '1', player: 'Usage Riser', position: 'WR', offense_pct: '0.42' },
        { season: '2025', game_type: 'REG', week: '2', player: 'Usage Riser', position: 'WR', offense_pct: '0.48' },
        { season: '2025', game_type: 'REG', week: '3', player: 'Usage Riser', position: 'WR', offense_pct: '0.55' },
        { season: '2025', game_type: 'REG', week: '4', player: 'Usage Riser', position: 'WR', offense_pct: '0.7' },
        { season: '2025', game_type: 'REG', week: '5', player: 'Usage Riser', position: 'WR', offense_pct: '0.75' },
        { season: '2025', game_type: 'REG', week: '6', player: 'Usage Riser', position: 'WR', offense_pct: '0.82' },
      ],
    });

    const row = usage[0];
    expect(row).toMatchObject({
      gsisId: '00-usage',
      team: 'DET',
      games: 6,
      targets: 36,
      carries: 6,
      receptions: 24,
      fantasyPointsPpr: 66.9,
      fantasyPointsPprPerGame: 11.2,
      avgTargetShare: 0.172,
      avgOffenseSnapPct: 0.62,
      recentTargets: 31,
      recentCarries: 6,
      targetTrend: 'up',
      carryTrend: 'up',
      momentum: {
        gameCount: 6,
        primaryDirection: 'sustained-growth',
        missingEvidence: [],
        confidenceCapReason: null,
      },
    });

    expect(row.rollingWindows?.find((window) => window.games === 3)).toMatchObject({
      weeks: [4, 5, 6],
      targetsPerGame: 9,
      carriesPerGame: 1.7,
      receptionsPerGame: 6,
      fantasyPointsPprPerGame: 16.7,
      targetDeltaPerGame: 3,
      carryDeltaPerGame: 0.7,
    });
    expect(row.momentum?.windows.find((window) => window.games === 3)).toMatchObject({
      weeks: [4, 5, 6],
      offenseSnapPct: 75.7,
      snapDeltaPct: 13.7,
      direction: 'sustained-growth',
    });
    expect(row.note).toContain('recent four-game targets up and carries up');
  });

  it('keeps high-prospect rookies and multiple returning promotion candidates in room math', () => {
    const rooms = normalizeNflverseRosterRoomRows({
      season: '2026',
      previousSeason: '2025',
      currentRosterRows: [
        { season: '2026', team: 'SEA', position: 'RB', full_name: 'Zach Charbonnet', gsis_id: '00-charb', status: 'ACT', years_exp: '3', rookie_year: '2023' },
        { season: '2026', team: 'SEA', position: 'RB', full_name: 'Jadarian Price', gsis_id: '', status: 'UDF' },
        { season: '2026', team: 'CHI', position: 'WR', full_name: 'Rome Odunze', gsis_id: '00-rome', status: 'ACT', years_exp: '2', rookie_year: '2024' },
        { season: '2026', team: 'CHI', position: 'WR', full_name: 'Luther Burden III', gsis_id: '00-luther', status: 'ACT', years_exp: '1', rookie_year: '2025' },
      ],
      previousRosterRows: [
        { season: '2025', team: 'SEA', position: 'RB', full_name: 'Zach Charbonnet', gsis_id: '00-charb', status: 'ACT' },
        { season: '2025', team: 'SEA', position: 'RB', full_name: 'Kenneth Walker III', gsis_id: '00-kw', status: 'ACT' },
        { season: '2025', team: 'CHI', position: 'WR', full_name: 'Rome Odunze', gsis_id: '00-rome', status: 'ACT' },
        { season: '2025', team: 'CHI', position: 'WR', full_name: 'Luther Burden III', gsis_id: '00-luther', status: 'ACT' },
        { season: '2025', team: 'CHI', position: 'WR', full_name: 'DJ Moore', gsis_id: '00-dj', status: 'ACT' },
      ],
      previousSeasonUsageRows: [
        { source: 'nflverse player stats and snap counts', gsisId: '00-kw', playerName: 'Kenneth Walker III', position: 'RB', team: 'SEA', season: '2025', games: 17, targets: 36, carries: 221, receptions: 31, fantasyPointsPpr: 191.9, fantasyPointsPprPerGame: 11.3, avgTargetShare: 0.079, avgOffenseSnapPct: null, recentTargets: 8, recentCarries: 52, targetTrend: 'flat', carryTrend: 'flat', note: 'fixture' },
        { source: 'nflverse player stats and snap counts', gsisId: '00-dj', playerName: 'DJ Moore', position: 'WR', team: 'CHI', season: '2025', games: 17, targets: 85, carries: 15, receptions: 50, fantasyPointsPpr: 172.2, fantasyPointsPprPerGame: 10.1, avgTargetShare: 0.16, avgOffenseSnapPct: null, recentTargets: 18, recentCarries: 4, targetTrend: 'flat', carryTrend: 'flat', note: 'fixture' },
      ],
      depthChartRows: [
        { team: 'SEA', pos_abb: 'RB', player_name: 'Zach Charbonnet', gsis_id: '00-charb', pos_rank: '1', pos_slot: 'RB1' },
        { team: 'SEA', pos_abb: 'RB', player_name: 'Jadarian Price', gsis_id: 'PRI206342', pos_rank: '2', pos_slot: 'RB2' },
        { team: 'CHI', pos_abb: 'WR', player_name: 'Rome Odunze', gsis_id: '00-rome', pos_rank: '1', pos_slot: 'WR1' },
        { team: 'CHI', pos_abb: 'WR', player_name: 'Luther Burden III', gsis_id: '00-luther', pos_rank: '2', pos_slot: 'WR2' },
      ],
      prospectProfiles: [
        { source: 'NFL Draft Buzz', draftYear: 2026, name: 'Jadarian Price', position: 'RB', college: 'Notre Dame', nflTeam: 'SEA', rating: 84.9, averageOverallRank: 51.9, positionRank: 2 },
      ],
    });

    const seaRb = rooms.find((row) => row.team === 'SEA' && row.position === 'RB');
    const chiWr = rooms.find((row) => row.team === 'CHI' && row.position === 'WR');

    expect(seaRb?.additions).toEqual([
      expect.objectContaining({
        name: 'Jadarian Price',
        movementType: 'draft-pick',
        movementQualityTier: 'star',
        prospectRating: 84.9,
      }),
    ]);
    expect(seaRb?.opportunityDelta?.topAddedThreat).toBe('Jadarian Price');
    expect(chiWr?.opportunityDelta?.returningPromotionCandidates).toEqual([
      expect.objectContaining({ name: 'Rome Odunze', signal: 'major-promotion' }),
      expect.objectContaining({ name: 'Luther Burden III' }),
    ]);
  });
});
