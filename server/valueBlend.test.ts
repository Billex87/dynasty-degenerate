import { describe, expect, it } from 'vitest';
import { loadBlendedValueProfiles, type KtcSnapshotProfileKey, type ValueProfileSourceValues } from './valueBlend';

const emptyKtcProfiles = {
  sf_ppr: {},
  sf_ppr_tep_0_5: {},
  sf_ppr_tep_1_0: {},
  sf_ppr_tep_1_5: {},
  one_qb_ppr: {},
  one_qb_ppr_tep_0_5: {},
  one_qb_ppr_tep_1_0: {},
  one_qb_ppr_tep_1_5: {},
} satisfies Record<KtcSnapshotProfileKey, Record<string, never>>;

function buildSourceProfiles(overrides: Partial<ValueProfileSourceValues> = {}): ValueProfileSourceValues {
  return {
    fantasyCalc: {},
    dynastyProcess: { one_qb: {}, superflex: {} },
    fantasyPros: { STD: {}, HALF: {}, PPR: {} },
    flockFantasy: { SUPERFLEX: {}, ONEQB: {}, PROSPECTS_SF: {}, PROSPECTS: {} },
    dynastyNerds: { PPR: {}, SFLEX: {}, STD: {}, SFLEXTEP: {} },
    dynastyDealerBenchmark: {},
    ...overrides,
  } as ValueProfileSourceValues;
}

describe('value blending', () => {
  it('does not promote prospect-only Flock values into dynasty waiver value', async () => {
    const profiles = await loadBlendedValueProfiles(emptyKtcProfiles, buildSourceProfiles({
      dynastyProcess: {
        one_qb: {
          dallenbentley: { name: 'Dallen Bentley', position: 'TE', dynastyValue: 4 },
        },
        superflex: {
          dallenbentley: { name: 'Dallen Bentley', position: 'TE', dynastyValue: 3 },
        },
      },
      flockFantasy: {
        SUPERFLEX: {},
        ONEQB: {},
        PROSPECTS_SF: {
          dallenbentley: {
            name: 'Dallen Bentley',
            position: 'TE',
            dynastyValue: 1728,
            overallRank: 56,
            positionRank: 'TE15',
            format: 'PROSPECTS_SF',
          },
        },
        PROSPECTS: {
          dallenbentley: {
            name: 'Dallen Bentley',
            position: 'TE',
            dynastyValue: 1869,
            overallRank: 54,
            positionRank: 'TE15',
            format: 'PROSPECTS',
          },
        },
      },
      dynastyDealerBenchmark: {
        dallenbentley: { name: 'Dallen Bentley', position: 'TE', currentValue: 8 },
      },
    }));

    const row = profiles['12_sf_ppr_base'].dallenbentley;
    expect(row).toMatchObject({
      name: 'Dallen Bentley',
      ktc_value: 3,
      dynasty_value: 3,
      expert_value_dynastyprocess: 3,
      benchmark_value_dynastydealer: 8,
      value_sources: ['DynastyProcess'],
    });
    expect(row.expert_value_flock).toBeUndefined();
    expect(row.flock_position_rank).toBeUndefined();
    expect(row.position_rank).toBeUndefined();
  });

  it('keeps Flock prospect values when another dynasty market source supports the player', async () => {
    const profiles = await loadBlendedValueProfiles({
      ...emptyKtcProfiles,
      sf_ppr: {
        supportedte: {
          name: 'Supported TE',
          ktc_value: 1000,
          position_rank: 'TE50',
        },
      },
    }, buildSourceProfiles({
      flockFantasy: {
        SUPERFLEX: {},
        ONEQB: {},
        PROSPECTS_SF: {
          supportedte: {
            name: 'Supported TE',
            position: 'TE',
            dynastyValue: 1728,
            overallRank: 56,
            positionRank: 'TE15',
            format: 'PROSPECTS_SF',
          },
        },
        PROSPECTS: {},
      },
    }));

    const row = profiles['12_sf_ppr_base'].supportedte;
    expect(row.expert_value_flock).toBe(1728);
    expect(row.flock_position_rank).toBe('TE15');
    expect(row.value_sources).toEqual(expect.arrayContaining(['FlockFantasy', 'KTC']));
    expect(row.ktc_value).toBeGreaterThan(1000);
  });
});
