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
    fantasyProsDynasty: {},
    flockFantasy: { SUPERFLEX: {}, ONEQB: {}, PROSPECTS_SF: {}, PROSPECTS: {}, BEST_BALL: {}, best_ball_sf: {} },
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
        BEST_BALL: {},
        best_ball_sf: {},
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

  it('keeps Flock prospect values out of current dynasty profiles even with market support', async () => {
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
        BEST_BALL: {},
        best_ball_sf: {},
      },
    }));

    const row = profiles['12_sf_ppr_base'].supportedte;
    expect(row.expert_value_flock).toBeUndefined();
    expect(row.flock_position_rank).toBeUndefined();
    expect(row.value_sources).toEqual(['KTC']);
    expect(row.ktc_value).toBe(1000);
  });

  it('does not let weak FantasyPros support promote a prospect-only Flock value', async () => {
    const profiles = await loadBlendedValueProfiles(emptyKtcProfiles, buildSourceProfiles({
      dynastyProcess: {
        one_qb: {},
        superflex: {
          thinprospectte: { name: 'Thin Prospect TE', position: 'TE', dynastyValue: 3 },
        },
      },
      fantasyProsDynasty: {
        thinprospectte: {
          name: 'Thin Prospect TE',
          position: 'TE',
          rankingType: 'DYNASTY',
          overallRank: 492,
          positionRank: 'TE81',
          dynastyValue: 111,
          value: 111,
        },
      },
      flockFantasy: {
        SUPERFLEX: {},
        ONEQB: {},
        PROSPECTS_SF: {
          thinprospectte: {
            name: 'Thin Prospect TE',
            position: 'TE',
            dynastyValue: 1728,
            overallRank: 56,
            positionRank: 'TE15',
            format: 'PROSPECTS_SF',
          },
        },
        PROSPECTS: {},
        BEST_BALL: {},
        best_ball_sf: {},
      },
      dynastyDealerBenchmark: {
        thinprospectte: { name: 'Thin Prospect TE', position: 'TE', currentValue: 8 },
      },
    }));

    const row = profiles['12_sf_ppr_base'].thinprospectte;
    expect(row).toMatchObject({
      name: 'Thin Prospect TE',
      expert_value_fantasypros: 111,
      fantasypros_dynasty_rank: 492,
      fantasypros_dynasty_position_rank: 'TE81',
      expert_value_dynastyprocess: 3,
      benchmark_value_dynastydealer: 8,
      value_sources: ['FantasyPros', 'DynastyProcess'],
    });
    expect(row.expert_value_flock).toBeUndefined();
    expect(row.flock_position_rank).toBeUndefined();
    expect(row.ktc_value).toBeLessThan(150);
  });

  it('uses Flock best-ball rankings as a redraft-only source', async () => {
    const profiles = await loadBlendedValueProfiles({
      ...emptyKtcProfiles,
      sf_ppr: {
        bestballwr: {
          name: 'Best Ball WR',
          ktc_value: 5000,
          position_rank: 'WR24',
        },
      },
    }, buildSourceProfiles({
      flockFantasy: {
        SUPERFLEX: {},
        ONEQB: {},
        PROSPECTS_SF: {},
        PROSPECTS: {},
        BEST_BALL: {},
        best_ball_sf: {
          bestballwr: {
            name: 'Best Ball WR',
            position: 'WR',
            dynastyValue: 8200,
            overallRank: 18,
            positionRank: 'WR9',
            format: 'best_ball_sf',
          },
        },
      },
    }));

    const row = profiles['12_sf_ppr_base'].bestballwr;
    expect(row).toMatchObject({
      name: 'Best Ball WR',
      ktc_value: 5000,
      dynasty_value: 5000,
      flock_best_ball_value: 8200,
      flock_best_ball_rank: 18,
      flock_best_ball_position_rank: 'WR9',
      flock_best_ball_format: 'best_ball_sf',
      redraft_value: 8200,
      value_sources: ['KTC'],
    });
    expect(row.expert_value_flock).toBeUndefined();
  });

  it('uses FantasyPros Dynasty as a dynasty blend source separate from season rankings', async () => {
    const profiles = await loadBlendedValueProfiles(emptyKtcProfiles, buildSourceProfiles({
      fantasyProsDynasty: {
        elitewr: {
          name: 'Elite WR',
          position: 'WR',
          rankingType: 'DYNASTY',
          overallRank: 12,
          positionRank: 'WR5',
          dynastyValue: 9000,
          value: 9000,
        },
      },
      fantasyPros: {
        STD: {},
        HALF: {},
        PPR: {
          elitewr: {
            name: 'Elite WR',
            position: 'WR',
            rankingType: 'DRAFT',
            overallRank: 30,
            positionRank: 'WR12',
            seasonValue: 7200,
            value: 7200,
          },
        },
      },
    }));

    const row = profiles['12_sf_ppr_base'].elitewr;
    expect(row).toMatchObject({
      name: 'Elite WR',
      expert_value_fantasypros: 9000,
      fantasypros_dynasty_rank: 12,
      fantasypros_dynasty_position_rank: 'WR5',
      fantasypros_season_value: 7200,
      value_sources: ['FantasyPros'],
    });
    expect(row.position_rank).toBe('WR1');
  });
});
