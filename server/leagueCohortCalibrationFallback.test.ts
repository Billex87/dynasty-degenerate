import { describe, expect, it } from 'vitest';
import {
  buildLeagueCohortCalibrationFallbackCandidates,
  selectCalibrationFallbackCandidate,
} from './leagueCohortCalibrationFallback';

const input = {
  managerId: 'manager-1',
  leagueId: 'league-1',
  managerArchetype: 'aggressive-bidder',
  leagueSharpness: 'sharp',
  leagueFormat: 'redraft',
  waiverMode: 'priority',
  qbFormat: 'sf',
  teamCount: 12,
  scoring: 'half-ppr',
  lineupFormat: '2rb-3wr-flex-superflex',
  activityLevel: 'active',
} as const;

describe('league cohort calibration fallback', () => {
  it('builds fallback candidates in exact-to-generic priority order', () => {
    const candidates = buildLeagueCohortCalibrationFallbackCandidates(input);

    expect(candidates.map((candidate) => candidate.scope)).toEqual([
      'exact-manager',
      'exact-league',
      'manager-archetype',
      'league-sharpness',
      'format-waiver-cohort',
      'generic-baseline',
    ]);
    expect(candidates[0]).toMatchObject({
      key: 'manager|manager-1|league|league-1',
      label: 'Exact manager in exact league',
      minSamples: 12,
    });
    expect(candidates[4]).toMatchObject({
      key: 'format|redraft|waiver|priority|qb|superflex|teams:standard|scoring|half-ppr|lineup|2rb-3wr-flex-superflex|activity|active',
      label: 'Format and waiver cohort',
      minSamples: 96,
    });
  });

  it('selects exact manager when enough local samples exist', () => {
    const candidates = buildLeagueCohortCalibrationFallbackCandidates(input);
    const result = selectCalibrationFallbackCandidate(candidates, {
      'manager|manager-1|league|league-1': 14,
      'league|league-1': 30,
    });

    expect(result).toMatchObject({
      sampleCount: 14,
      fallbackUsed: false,
      selected: {
        scope: 'exact-manager',
        key: 'manager|manager-1|league|league-1',
      },
      rejected: [],
    });
  });

  it('falls back through exact league and similar-league cohorts when samples are thin', () => {
    const candidates = buildLeagueCohortCalibrationFallbackCandidates(input);
    const result = selectCalibrationFallbackCandidate(candidates, {
      'manager|manager-1|league|league-1': 5,
      'league|league-1': 8,
      'manager-archetype|aggressive-bidder|format|redraft': 21,
      'sharpness|sharp|activity|active|format|redraft': 80,
      'format|redraft|waiver|priority|qb|superflex|teams:standard|scoring|half-ppr|lineup|2rb-3wr-flex-superflex|activity|active': 110,
    });

    expect(result.selected).toMatchObject({
      scope: 'league-sharpness',
      key: 'sharpness|sharp|activity|active|format|redraft',
    });
    expect(result.sampleCount).toBe(80);
    expect(result.fallbackUsed).toBe(true);
    expect(result.rejected.map((candidate) => [candidate.scope, candidate.sampleCount])).toEqual([
      ['exact-manager', 5],
      ['exact-league', 8],
      ['manager-archetype', 21],
    ]);
  });

  it('uses the generic baseline only after all exact and cohort samples miss their threshold', () => {
    const candidates = buildLeagueCohortCalibrationFallbackCandidates(input);
    const result = selectCalibrationFallbackCandidate(candidates, {
      'manager|manager-1|league|league-1': 0,
      'league|league-1': 2,
      'manager-archetype|aggressive-bidder|format|redraft': 3,
    });

    expect(result.selected).toMatchObject({
      scope: 'generic-baseline',
      key: 'generic-baseline',
    });
    expect(result.sampleCount).toBe(0);
    expect(result.fallbackUsed).toBe(true);
    expect(result.rejected).toHaveLength(5);
  });

  it('allows stricter per-scope thresholds for later tuning', () => {
    const candidates = buildLeagueCohortCalibrationFallbackCandidates(input);
    const result = selectCalibrationFallbackCandidate(
      candidates,
      {
        'manager|manager-1|league|league-1': 14,
        'league|league-1': 30,
      },
      { 'exact-manager': 18 }
    );

    expect(result.selected).toMatchObject({
      scope: 'exact-league',
      key: 'league|league-1',
    });
    expect(result.rejected[0]).toMatchObject({
      scope: 'exact-manager',
      sampleCount: 14,
      minSamples: 18,
    });
  });
});
