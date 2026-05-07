import { describe, expect, it } from 'vitest';
import { hasUsableBlendedSnapshotValues } from './ktcLoader';

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
});
