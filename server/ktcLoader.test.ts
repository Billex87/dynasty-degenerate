import fs from 'fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as liveKTCScraper from './liveKTCScraper';
import * as valueBlend from './valueBlend';
import {
  clearKTCCache,
  hasUsableBlendedSnapshotValues,
  loadBlendedKTCValues,
  loadLatestLocalWeeklyMomentumSnapshot,
  sanitizeKtcSnapshotValues,
} from './ktcLoader';
import { getWeeklyMomentumBaselineTargetDateKey, getWeeklyMomentumPctChange, isWeeklyMomentumBaselineFloorActive } from './valueBaselinePolicy';

describe('hasUsableBlendedSnapshotValues', () => {
  it('rejects league-matched blended snapshots without source metadata', () => {
    expect(hasUsableBlendedSnapshotValues({
      marvinharrison: {
        name: 'Marvin Harrison',
        ktc_value: 7504,
        dynasty_value: 7504,
      },
    }, '12_sf_ppr_base')).toBe(false);
  });

  it('accepts league-matched blended snapshots with primary source metadata', () => {
    expect(hasUsableBlendedSnapshotValues({
      marvinharrisonjr: {
        name: 'Marvin Harrison Jr.',
        ktc_value: 4277,
        dynasty_value: 4277,
        value_sources: ['KTC', 'FantasyCalc', 'DynastyProcess'],
      },
    }, '12_sf_ppr_base')).toBe(true);
  });

  it('strips low-confidence Flock prospect spikes from stored blended snapshots', () => {
    const values = {
      dallenbentley: {
        name: 'Dallen Bentley',
        ktc_value: 1608,
        position_rank: 'TE35',
        dynasty_value: 1608,
        true_value: 1608,
        expert_value_flock: 1728,
        expert_value_dynastyprocess: 3,
        benchmark_value_dynastydealer: 8,
        value_sources: ['FlockFantasy', 'DynastyProcess'],
        benchmark_sources: ['DynastyDealer'],
      },
    };
    const sanitized = sanitizeKtcSnapshotValues(values, {
      PROSPECTS_SF: {
        dallenbentley: {
          name: 'Dallen Bentley',
          ktc_value: 1728,
          position_rank: 'TE15',
        },
      },
    });

    expect(sanitized.dallenbentley).toMatchObject({
      name: 'Dallen Bentley',
      ktc_value: 3,
      dynasty_value: 3,
      true_value: 3,
      expert_value_dynastyprocess: 3,
      value_sources: ['DynastyProcess'],
    });
    expect(sanitized.dallenbentley.expert_value_flock).toBeUndefined();
    expect(sanitized.dallenbentley.position_rank).toBeUndefined();
  });

  it('keeps Flock full-ranking rows even when no other market source is present', () => {
    const sanitized = sanitizeKtcSnapshotValues({
      curtissamuel: {
        name: 'Curtis Samuel',
        ktc_value: 883,
        position_rank: 'WR140',
        dynasty_value: 883,
        true_value: 883,
        expert_value_flock: 949,
        expert_value_dynastyprocess: 5,
        value_sources: ['FlockFantasy', 'DynastyProcess'],
      },
    }, {
      SUPERFLEX: {
        curtissamuel: {
          name: 'Curtis Samuel',
          ktc_value: 949,
          position_rank: 'WR127',
        },
      },
    });

    expect(sanitized.curtissamuel).toMatchObject({
      ktc_value: 883,
      position_rank: 'WR140',
      expert_value_flock: 949,
      value_sources: ['FlockFantasy', 'DynastyProcess'],
    });
  });
});

describe('weekly momentum baseline policy', () => {
  it('floors the temporary weekly comparison baseline to May 7, 2026', () => {
    expect(getWeeklyMomentumBaselineTargetDateKey(7, new Date('2026-05-11T12:00:00-07:00'))).toBe('2026-05-07');
    expect(getWeeklyMomentumBaselineTargetDateKey(7, new Date('2026-05-16T12:00:00-07:00'))).toBe('2026-05-09');
    expect(isWeeklyMomentumBaselineFloorActive(7, new Date('2026-05-11T12:00:00-07:00'))).toBe(true);
    expect(isWeeklyMomentumBaselineFloorActive(7, new Date('2026-05-16T12:00:00-07:00'))).toBe(false);
  });

  it('loads the May 7 local snapshot while the real seven-day target is earlier', () => {
    const baseline = loadLatestLocalWeeklyMomentumSnapshot('12_sf_ppr_base');
    expect(baseline.bijanrobinson?.value_sources).toEqual(expect.arrayContaining(['FlockFantasy', 'DynastyNerds']));
  });

  it('drops movement percentages with tiny denominator baselines', () => {
    expect(getWeeklyMomentumPctChange(1400, 3)).toBeNull();
    expect(getWeeklyMomentumPctChange(3500, 3000)).toBeCloseTo(16.666, 2);
  });
});

describe('loadBlendedKTCValues', () => {
  afterEach(() => {
    clearKTCCache();
    vi.restoreAllMocks();
  });

  it('prefers live blended values over stored snapshots', async () => {
    const liveValues = {
      testplayer: {
        name: 'Test Player',
        ktc_value: 2222,
        position_rank: 'WR1',
      },
    };
    const snapshotValues = {
      testplayer: {
        name: 'Test Player',
        ktc_value: 1111,
        position_rank: 'WR99',
        value_sources: ['KTC'],
      },
    };

    const originalExistsSync = fs.existsSync.bind(fs);
    const originalReaddirSync = fs.readdirSync.bind(fs);
    const originalReadFileSync = fs.readFileSync.bind(fs);
    let snapshotFileRead = false;

    vi.spyOn(liveKTCScraper, 'getCurrentKTCRankings').mockResolvedValue(liveValues as any);
    vi.spyOn(valueBlend, 'loadBlendedPlayerValues').mockImplementation(async (values) => values as any);
    vi.spyOn(fs, 'existsSync').mockImplementation((candidatePath) => {
      const path = String(candidatePath);
      if (path.includes('ktc-snapshots')) return true;
      return originalExistsSync(candidatePath);
    });
    const readdirSpy = vi.spyOn(fs, 'readdirSync').mockImplementation((candidatePath) => {
      const path = String(candidatePath);
      if (path.includes('ktc-snapshots')) return ['ktc-snapshot-2026-05-07.json'] as any;
      return originalReaddirSync(candidatePath);
    });
    vi.spyOn(fs, 'readFileSync').mockImplementation((candidatePath, options) => {
      const path = String(candidatePath);
      if (path.includes('ktc-snapshots')) {
        snapshotFileRead = true;
        return JSON.stringify(snapshotValues) as any;
      }
      return originalReadFileSync(candidatePath as any, options as any);
    });

    const result = await loadBlendedKTCValues({ ktcProfileKey: 'sf_ppr' });

    expect(liveKTCScraper.getCurrentKTCRankings).toHaveBeenCalled();
    expect(readdirSpy).not.toHaveBeenCalled();
    expect(snapshotFileRead).toBe(false);
    expect(result.testplayer?.ktc_value).toBe(2222);
    expect(result.testplayer?.position_rank).toBe('WR1');
  });
});
