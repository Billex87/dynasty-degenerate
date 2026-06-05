import { describe, expect, it } from 'vitest';
import {
  buildMatchupPreviews,
  buildPlayerScheduleProfiles,
  buildPlayoffSchedulePlanningSummary,
  buildSchedulePlanningSummary,
  getSupportedScheduleByeWeeks,
} from './schedulePlanning';
import type { DraftSharksScheduleContext } from './draftSharksSchedule';

const players = {
  carRb: { full_name: 'Carolina Back', position: 'RB', team: 'CAR', status: 'Active' },
  kcRb: { full_name: 'Kansas City Back', position: 'RB', team: 'KC', status: 'Active' },
  detWr: { full_name: 'Detroit Wideout', position: 'WR', team: 'DET', status: 'Active' },
  phiQb: { full_name: 'Philadelphia QB', position: 'QB', team: 'PHI', status: 'Active' },
  faRb: { full_name: 'Free Agent Runner', position: 'RB', team: 'DEN', status: 'Active' },
  faWr: { full_name: 'Free Agent Wideout', position: 'WR', team: 'SEA', status: 'Active' },
};

const ktcValues = {
  carolinarb: { name: 'Carolina Back', ktc_value: 4500, redraft_value: 5200 },
  kansascityback: { name: 'Kansas City Back', ktc_value: 4300, redraft_value: 5000 },
  detroitwideout: { name: 'Detroit Wideout', ktc_value: 3900, redraft_value: 4700 },
  philadelphiaqb: { name: 'Philadelphia QB', ktc_value: 7000, redraft_value: 7100 },
  freeagentrunner: { name: 'Free Agent Runner', ktc_value: 2800, redraft_value: 3500 },
  freeagentwideout: { name: 'Free Agent Wideout', ktc_value: 2400, redraft_value: 3300 },
};

describe('schedule planning', () => {
  it('uses the official 2026 bye-week map for player schedule profiles', () => {
    const byes = getSupportedScheduleByeWeeks();
    const profiles = buildPlayerScheduleProfiles({ season: '2026', players });

    expect(byes.CAR).toBe(5);
    expect(byes.PHI).toBe(10);
    expect(profiles.carRb).toMatchObject({
      byeWeek: 5,
      scheduleTier: 'neutral',
      avoidWeeks: [5],
      source: 'NFL.com 2026 bye weeks + Sleeper league data',
    });
  });

  it('flags bye-week roster gaps and available coverage candidates', () => {
    const playerSchedules = buildPlayerScheduleProfiles({ season: '2026', players });
    const summary = buildSchedulePlanningSummary({
      season: '2026',
      currentWeek: 1,
      rosters: [{
        roster_id: 1,
        players: ['carRb', 'kcRb', 'detWr', 'phiQb'],
        starters: ['phiQb', 'carRb', 'kcRb', 'detWr'],
      }],
      rosterMap: { 1: 'Bill' },
      players,
      ktcValues,
      rosterPositions: ['QB', 'RB', 'RB', 'WR'],
      playerSchedules,
    });

    expect(summary.status).toBe('ready');
    expect(summary.byeWeekNotes?.find((row) => row.week === 5)?.teams).toEqual(['CAR', 'KC']);
    expect(summary.rosterGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        manager: 'Bill',
        position: 'RB',
        weeks: [5],
        severity: 'high',
      }),
    ]));
    expect(summary.streamerCandidates?.[0]).toMatchObject({
      playerId: 'faRb',
      position: 'RB',
      targetWeeks: [5],
    });
  });

  it('enriches player schedules and streamer windows from DraftSharks SOS context', () => {
    const draftSharksContext: DraftSharksScheduleContext = {
      status: 'loaded',
      source: 'DraftSharks SOS',
      updatedAt: '2026-05-15T12:00:00.000Z',
      profiles: {
        'DEN:RB': {
          team: 'DEN',
          position: 'RB',
          seasonSOS: 82,
          scheduleTier: 'elite',
          streamerWeeks: [6, 7],
          avoidWeeks: [10],
          source: 'DraftSharks SOS',
          updatedAt: '2026-05-15T12:00:00.000Z',
        },
      },
    };
    const profiles = buildPlayerScheduleProfiles({ season: '2026', players, draftSharksContext });
    const summary = buildSchedulePlanningSummary({
      season: '2026',
      currentWeek: 1,
      rosters: [{
        roster_id: 1,
        players: ['carRb', 'kcRb', 'detWr', 'phiQb'],
      }],
      rosterMap: { 1: 'Bill' },
      players,
      ktcValues,
      rosterPositions: ['QB', 'RB', 'RB', 'WR'],
      draftSharksContext,
    });

    expect(profiles.faRb).toMatchObject({
      source: 'NFL.com 2026 bye weeks + Sleeper league data + DraftSharks SOS',
      seasonSOS: 82,
      scheduleTier: 'elite',
      streamerWeeks: [6, 7],
      avoidWeeks: [10],
    });
    expect(summary.source).toBe('NFL.com 2026 bye weeks + Sleeper league data + DraftSharks SOS');
    expect(summary.streamerCandidates?.find((candidate) => candidate.playerId === 'faRb')).toMatchObject({
      seasonSOS: 82,
      scheduleTier: 'elite',
      targetWeeks: [5, 6, 7],
    });
  });

  it('builds playoff-week planning from stored bye/SOS profiles and waiver windows', () => {
    const summary = buildPlayoffSchedulePlanningSummary({
      season: '2026',
      rosters: [{
        roster_id: 1,
        players: ['carRb', 'kcRb', 'detWr', 'phiQb'],
        starters: ['phiQb', 'carRb', 'kcRb', 'detWr'],
      }],
      rosterMap: { 1: 'Bill' },
      players,
      ktcValues,
      playoffWeeks: [15, 16, 17],
      playerSchedules: {
        carRb: { byeWeek: 5, avoidWeeks: [15], streamerWeeks: [], seasonSOS: 32, scheduleTier: 'hard' },
        kcRb: { byeWeek: 5, avoidWeeks: [], streamerWeeks: [16], seasonSOS: 74, scheduleTier: 'easy' },
        detWr: { byeWeek: 6, avoidWeeks: [16], streamerWeeks: [], seasonSOS: 28, scheduleTier: 'hard' },
        phiQb: { byeWeek: 10, avoidWeeks: [], streamerWeeks: [17], seasonSOS: 81, scheduleTier: 'elite' },
        faRb: { byeWeek: 10, avoidWeeks: [], streamerWeeks: [15, 16], seasonSOS: 92, scheduleTier: 'elite' },
        faWr: { byeWeek: 11, avoidWeeks: [], streamerWeeks: [17], seasonSOS: 79, scheduleTier: 'easy' },
      },
    });

    expect(summary.status).toBe('ready');
    expect(summary.weeks).toEqual([15, 16, 17]);
    expect(summary.managerPlans[0]).toMatchObject({
      manager: 'Bill',
      riskScore: 4,
      upsideScore: 2,
    });
    expect(summary.managerPlans[0].weeks.find((week) => week.week === 15)?.avoidPlayers).toEqual([
      expect.objectContaining({ playerId: 'carRb', scheduleTier: 'hard' }),
    ]);
    expect(summary.managerPlans[0].weeks.find((week) => week.week === 16)?.streamerPlayers).toEqual([
      expect.objectContaining({ playerId: 'kcRb', scheduleTier: 'easy' }),
    ]);
    expect(summary.managerPlans[0].priorityAdds[0]).toMatchObject({
      playerId: 'faRb',
      targetWeeks: [15, 16],
      scheduleTier: 'elite',
    });
    expect(summary.managerPlans[0].note).toContain('stored SOS-backed waiver targets');
    const riskAction = summary.actionItems?.find((action) => action.type === 'cover-risk' && action.week === 15);
    expect(riskAction).toMatchObject({
      manager: 'Bill',
      priority: 'high',
      confidence: 58,
      affectedPlayers: [expect.objectContaining({ playerId: 'carRb', reason: 'avoid' })],
      replacementTargets: [expect.objectContaining({ playerId: 'faRb', targetWeeks: [15, 16] })],
    });
    expect(riskAction?.note).toContain('stored SOS-backed replacement option');
    const upsideAction = summary.actionItems?.find((action) => action.type === 'exploit-upside' && action.week === 17);
    expect(upsideAction).toMatchObject({
      manager: 'Bill',
      affectedPlayers: [expect.objectContaining({ playerId: 'phiQb', reason: 'streamer' })],
    });
  });

  it('caps playoff planning confidence when projection coverage is partial', () => {
    const summary = buildPlayoffSchedulePlanningSummary({
      season: '2026',
      rosters: [{
        roster_id: 1,
        players: ['phiQb', 'carRb'],
        starters: ['phiQb', 'carRb'],
      }],
      rosterMap: { 1: 'Bill' },
      players,
      ktcValues,
      playoffWeeks: [15],
      draftSharksContext: {
        status: 'loaded',
        source: 'DraftSharks SOS',
        updatedAt: '2099-01-01T00:00:00.000Z',
        profiles: {},
      },
      playerSchedules: {
        phiQb: { byeWeek: 10, avoidWeeks: [], streamerWeeks: [15], seasonSOS: 81, scheduleTier: 'elite' },
        carRb: { byeWeek: 5, avoidWeeks: [], streamerWeeks: [], seasonSOS: 50, scheduleTier: 'neutral' },
      },
      weeklyProjectionByPlayerId: {
        phiQb: {
          source: 'stored-weekly-projection',
          provider: 'sleeper',
          season: '2026',
          week: 15,
          scoringProfile: 'PPR',
          projectedFantasyPoints: 21.5,
          status: 'ready',
          note: 'Stored weekly projection fixture.',
        },
      },
    });

    const week = summary.managerPlans[0].weeks[0];
    expect(week.projectionCoverage).toMatchObject({
      coveredPlayerCount: 1,
      totalPlayerCount: 2,
      mode: 'stored-weekly-projection-blend',
    });
    expect(week.confidence).toBe(76);
    expect(week.confidenceReasons?.join(' ')).toContain('Projection coverage is partial');
    expect(summary.confidence).toBe(76);
  });

  it('caps playoff planning confidence when projections, SOS, or schedule mapping are unavailable', () => {
    const summary = buildPlayoffSchedulePlanningSummary({
      season: '2026',
      rosters: [{
        roster_id: 1,
        players: ['phiQb', 'carRb'],
        starters: ['phiQb', 'carRb'],
      }],
      rosterMap: { 1: 'Bill' },
      players,
      ktcValues,
      playoffWeeks: [15],
      playerSchedules: {
        phiQb: { byeWeek: 10, avoidWeeks: [], streamerWeeks: [15], seasonSOS: 81, scheduleTier: 'elite' },
      },
      weeklyProjectionReadiness: {
        enabled: false,
        reason: 'Projection readiness blocked by schedule snapshot missing.',
      },
      weeklyProjectionByPlayerId: {
        phiQb: {
          source: 'stored-weekly-projection',
          provider: 'sleeper',
          season: '2026',
          week: 15,
          scoringProfile: 'PPR',
          projectedFantasyPoints: 21.5,
          status: 'ready',
          note: 'Stored weekly projection fixture.',
        },
        carRb: {
          source: 'stored-weekly-projection',
          provider: 'sleeper',
          season: '2026',
          week: 15,
          scoringProfile: 'PPR',
          projectedFantasyPoints: 14.2,
          status: 'ready',
          note: 'Stored weekly projection fixture.',
        },
      },
    });

    const week = summary.managerPlans[0].weeks[0];
    expect(week.projectionCoverage.mode).toBe('schedule-value');
    expect(week.confidence).toBe(54);
    expect(week.confidenceReasons?.join(' ')).toContain('Projection readiness blocked');
    expect(week.confidenceReasons?.join(' ')).toContain('schedule/value fallback');
    expect(week.confidenceReasons?.join(' ')).toContain('Schedule mapping is partial');
    expect(week.confidenceReasons?.join(' ')).toContain('DraftSharks SOS snapshot is unavailable');
    expect(summary.managerPlans[0].confidence).toBe(54);
  });

  it('builds matchup previews from Sleeper matchup rows when available', () => {
    const previews = buildMatchupPreviews({
      season: '2026',
      week: 1,
      rosters: [
        { roster_id: 1, players: ['phiQb', 'carRb'], starters: ['phiQb', 'carRb'] },
        { roster_id: 2, players: ['detWr', 'kcRb'], starters: ['detWr', 'kcRb'] },
      ],
      rosterMap: { 1: 'Bill', 2: 'Opponent' },
      players,
      ktcValues,
      matchups: [
        { roster_id: 1, matchup_id: 10, starters: ['phiQb', 'carRb'], points: 0 },
        { roster_id: 2, matchup_id: 10, starters: ['detWr', 'kcRb'], points: 0 },
      ],
    });

    expect(previews).toHaveLength(2);
    expect(previews[0]).toMatchObject({
      week: 1,
      manager: 'Bill',
      opponentManager: 'Opponent',
      source: 'Sleeper + Dynasty Degenerates schedule model',
    });
    expect(previews[0].projectedPoints).toBeGreaterThan(0);
    expect(previews[0].positionEdges?.length).toBeGreaterThan(0);
  });

  it('uses stored schedule profiles in matchup projections and notes', () => {
    const neutral = buildMatchupPreviews({
      season: '2026',
      week: 1,
      rosters: [
        { roster_id: 1, players: ['phiQb', 'carRb'], starters: ['phiQb', 'carRb'] },
        { roster_id: 2, players: ['detWr', 'kcRb'], starters: ['detWr', 'kcRb'] },
      ],
      rosterMap: { 1: 'Bill', 2: 'Opponent' },
      players,
      ktcValues,
      matchups: [
        { roster_id: 1, matchup_id: 10, starters: ['phiQb', 'carRb'], points: 0 },
        { roster_id: 2, matchup_id: 10, starters: ['detWr', 'kcRb'], points: 0 },
      ],
    });
    const scheduled = buildMatchupPreviews({
      season: '2026',
      week: 1,
      rosters: [
        { roster_id: 1, players: ['phiQb', 'carRb'], starters: ['phiQb', 'carRb'] },
        { roster_id: 2, players: ['detWr', 'kcRb'], starters: ['detWr', 'kcRb'] },
      ],
      rosterMap: { 1: 'Bill', 2: 'Opponent' },
      players,
      ktcValues,
      playerSchedules: {
        phiQb: { seasonSOS: 80, scheduleTier: 'elite' },
        carRb: { seasonSOS: 75, scheduleTier: 'easy' },
        detWr: { seasonSOS: 30, scheduleTier: 'hard' },
        kcRb: { seasonSOS: 35, scheduleTier: 'hard' },
      },
      matchups: [
        { roster_id: 1, matchup_id: 10, starters: ['phiQb', 'carRb'], points: 0 },
        { roster_id: 2, matchup_id: 10, starters: ['detWr', 'kcRb'], points: 0 },
      ],
    });

    const neutralBill = neutral.find((preview) => preview.manager === 'Bill');
    const scheduledBill = scheduled.find((preview) => preview.manager === 'Bill');
    expect(scheduledBill?.projectedPoints || 0).toBeGreaterThan(neutralBill?.projectedPoints || 0);
    expect(scheduledBill?.winProbability || 0).toBeGreaterThan(neutralBill?.winProbability || 0);
    expect(scheduledBill?.positionEdges?.[0]?.note).toContain('stored bye/SOS profiles');
    expect(scheduledBill?.howToWin).toContain('stored bye/SOS context');
  });

  it('uses ready stored weekly projections for matchup totals before schedule/value fallback', () => {
    const previews = buildMatchupPreviews({
      season: '2026',
      week: 1,
      rosters: [
        { roster_id: 1, players: ['phiQb', 'carRb'], starters: ['phiQb', 'carRb'] },
        { roster_id: 2, players: ['detWr', 'kcRb'], starters: ['detWr', 'kcRb'] },
      ],
      rosterMap: { 1: 'Bill', 2: 'Opponent' },
      players,
      ktcValues,
      weeklyProjectionByPlayerId: {
        phiQb: {
          source: 'stored-weekly-projection',
          provider: 'sleeper',
          season: '2026',
          week: 1,
          scoringProfile: 'PPR',
          projectedFantasyPoints: 21.5,
          status: 'ready',
          note: 'Stored weekly projection fixture.',
        },
        carRb: {
          source: 'stored-weekly-projection',
          provider: 'sleeper',
          season: '2026',
          week: 1,
          scoringProfile: 'PPR',
          projectedFantasyPoints: 14.2,
          status: 'ready',
          note: 'Stored weekly projection fixture.',
        },
        detWr: {
          source: 'stored-weekly-projection',
          provider: 'sleeper',
          season: '2026',
          week: 1,
          scoringProfile: 'PPR',
          projectedFantasyPoints: 10.1,
          status: 'ready',
          note: 'Stored weekly projection fixture.',
        },
        kcRb: {
          source: 'stored-weekly-projection',
          provider: 'sleeper',
          season: '2026',
          week: 1,
          scoringProfile: 'PPR',
          projectedFantasyPoints: 12.4,
          status: 'ready',
          note: 'Stored weekly projection fixture.',
        },
      },
      matchups: [
        { roster_id: 1, matchup_id: 10, starters: ['phiQb', 'carRb'], points: 0 },
        { roster_id: 2, matchup_id: 10, starters: ['detWr', 'kcRb'], points: 0 },
      ],
    });

    const bill = previews.find((preview) => preview.manager === 'Bill');
    expect(bill?.projectedPoints).toBe(35.7);
    expect(bill?.opponentProjectedPoints).toBe(22.5);
    expect(bill?.source).toBe('Submitted lineup + stored weekly projection model');
    expect(bill?.mustStarts?.[0]?.weeklyProjection?.projectedFantasyPoints).toBe(21.5);
    expect(bill?.positionEdges?.[0]?.note).toContain('stored weekly projections');
  });

  it('blends stored weekly projections with schedule/value fallback when projection coverage is partial', () => {
    const previews = buildMatchupPreviews({
      season: '2026',
      week: 1,
      rosters: [
        { roster_id: 1, players: ['phiQb', 'carRb'], starters: ['phiQb', 'carRb'] },
        { roster_id: 2, players: ['detWr', 'kcRb'], starters: ['detWr', 'kcRb'] },
      ],
      rosterMap: { 1: 'Bill', 2: 'Opponent' },
      players,
      ktcValues,
      weeklyProjectionByPlayerId: {
        phiQb: {
          source: 'stored-weekly-projection',
          provider: 'sleeper',
          season: '2026',
          week: 1,
          scoringProfile: 'PPR',
          projectedFantasyPoints: 21.5,
          status: 'ready',
          note: 'Stored weekly projection fixture.',
        },
      },
      matchups: [
        { roster_id: 1, matchup_id: 10, starters: ['phiQb', 'carRb'], points: 0 },
        { roster_id: 2, matchup_id: 10, starters: ['detWr', 'kcRb'], points: 0 },
      ],
    });

    const bill = previews.find((preview) => preview.manager === 'Bill');
    expect(bill?.source).toBe('Submitted lineup + stored weekly projection blend');
    expect(bill?.projectedPoints || 0).toBeGreaterThan(21.5);
    expect(bill?.positionEdges?.[0]?.note).toContain('stored weekly projections');
    expect(bill?.howToWin).toContain('stored projection blend');
  });

  it('ignores stored weekly projections when projection readiness is blocked', () => {
    const previews = buildMatchupPreviews({
      season: '2026',
      week: 1,
      rosters: [
        { roster_id: 1, players: ['phiQb', 'carRb'], starters: ['phiQb', 'carRb'] },
        { roster_id: 2, players: ['detWr', 'kcRb'], starters: ['detWr', 'kcRb'] },
      ],
      rosterMap: { 1: 'Bill', 2: 'Opponent' },
      players,
      ktcValues,
      weeklyProjectionReadiness: {
        enabled: false,
        reason: 'Projection readiness blocked by schedule snapshot missing.',
      },
      weeklyProjectionByPlayerId: {
        phiQb: {
          source: 'stored-weekly-projection',
          provider: 'sleeper',
          season: '2026',
          week: 1,
          scoringProfile: 'PPR',
          projectedFantasyPoints: 21.5,
          status: 'ready',
          note: 'Stored weekly projection fixture.',
        },
        carRb: {
          source: 'stored-weekly-projection',
          provider: 'sleeper',
          season: '2026',
          week: 1,
          scoringProfile: 'PPR',
          projectedFantasyPoints: 14.2,
          status: 'ready',
          note: 'Stored weekly projection fixture.',
        },
      },
      matchups: [
        { roster_id: 1, matchup_id: 10, starters: ['phiQb', 'carRb'], points: 0 },
        { roster_id: 2, matchup_id: 10, starters: ['detWr', 'kcRb'], points: 0 },
      ],
    });

    const bill = previews.find((preview) => preview.manager === 'Bill');
    expect(bill?.source).toBe('Sleeper + Dynasty Degenerates schedule model');
    expect(bill?.projectedPoints).not.toBe(35.7);
    expect(bill?.mustStarts?.[0]?.weeklyProjection).toBeNull();
    expect(bill?.positionEdges?.[0]?.note).not.toContain('stored weekly projections');
  });

  it('does not claim stored weekly projections when the attached projection map is empty', () => {
    const previews = buildMatchupPreviews({
      season: '2026',
      week: 1,
      rosters: [
        { roster_id: 1, players: ['phiQb', 'carRb'], starters: ['phiQb', 'carRb'] },
        { roster_id: 2, players: ['detWr', 'kcRb'], starters: ['detWr', 'kcRb'] },
      ],
      rosterMap: { 1: 'Bill', 2: 'Opponent' },
      players,
      ktcValues,
      weeklyProjectionByPlayerId: {},
      matchups: [
        { roster_id: 1, matchup_id: 10, starters: ['phiQb', 'carRb'], points: 0 },
        { roster_id: 2, matchup_id: 10, starters: ['detWr', 'kcRb'], points: 0 },
      ],
    });

    const bill = previews.find((preview) => preview.manager === 'Bill');
    expect(bill?.source).toBe('Sleeper + Dynasty Degenerates schedule model');
    expect(bill?.positionEdges?.[0]?.note).not.toContain('stored weekly projections');
  });
});
