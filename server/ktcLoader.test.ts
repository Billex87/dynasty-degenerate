import { describe, expect, it } from 'vitest';
import { hasUsableBlendedSnapshotValues, sanitizeKtcSnapshotValues } from './ktcLoader';

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
