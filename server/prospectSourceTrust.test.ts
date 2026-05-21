import { afterEach, describe, expect, it } from 'vitest';
import {
  BASE_PROSPECT_SOURCE_WEIGHTS,
  applyProspectSourceTrust,
  buildProspectSourceDiagnostics,
  calculatePreviousProspectSourceTrust,
  calculateProspectSourceTrust,
  createProspectSourceRows,
  prospectRankToValue,
  type ProspectSourceRow,
} from './prospectSourceTrust';

describe('prospect source trust', () => {
  afterEach(() => {
    delete process.env.ENABLE_DEVY_ADAPTIVE_TRUST;
  });

  it('converts prospect rank sources into stable value rows', () => {
    const rows = createProspectSourceRows({
      jeremiahsmith: {
        name: 'Jeremiah Smith',
        position: 'WR',
        rank: 1,
      },
      duplicate: {
        name: 'Jeremiah Smith',
        position: 'WR',
        rank: 3,
      },
    }, (row) => ({
      name: row.name,
      position: row.position,
      rank: row.rank,
      value: prospectRankToValue(row.rank),
    }));

    expect(rows.jeremiahsmith).toMatchObject({
      name: 'Jeremiah Smith',
      rank: 1,
      value: 10000,
    });
  });

  it('scores aligned devy sources higher than consensus outliers', () => {
    const alignedRows: Record<string, ProspectSourceRow> = {};
    const outlierRows: Record<string, ProspectSourceRow> = {};
    for (let index = 1; index <= 30; index += 1) {
      const key = `prospect${index}`;
      alignedRows[key] = {
        name: `Prospect ${index}`,
        position: 'WR',
        value: 9000 - index * 60,
      };
      outlierRows[key] = {
        name: `Prospect ${index}`,
        position: 'WR',
        value: 1000,
      };
    }

    const trust = calculateProspectSourceTrust({
      sourceMaps: {
        fantasyProsDevy: alignedRows,
        ktc: alignedRows,
        flock: alignedRows,
        prospectArchive: outlierRows,
      },
    });

    expect(trust.fantasyProsDevy?.score).toBeGreaterThan(trust.prospectArchive?.score || 0);
    expect(trust.fantasyProsDevy?.multiplier).toBeGreaterThan(1);
    expect(trust.prospectArchive?.multiplier).toBeLessThan(1);
    expect(trust.prospectArchive?.sampleSize).toBe(30);
  });

  it('keeps weights neutral while a loaded devy source has too little overlap evidence', () => {
    const trust = calculateProspectSourceTrust({
      sourceMaps: {
        ktc: {
          oneprospect: {
            name: 'One Prospect',
            position: 'RB',
            value: 5000,
          },
        },
      },
    });

    expect(trust.ktc?.multiplier).toBe(1);
    expect(applyProspectSourceTrust(BASE_PROSPECT_SOURCE_WEIGHTS, trust).ktc).toBe(BASE_PROSPECT_SOURCE_WEIGHTS.ktc);
  });

  it('keeps unavailable Flock devy out of admin diagnostics', () => {
    const trust = calculateProspectSourceTrust({
      sourceMaps: {
        fantasyProsDevy: {
          playerone: {
            name: 'Player One',
            position: 'QB',
            value: 8800,
          },
        },
      },
    });

    const diagnostics = buildProspectSourceDiagnostics({
      fantasyProsDevy: {
        playerone: {
          name: 'Player One',
          position: 'QB',
          value: 8800,
        },
      },
    }, trust);

    expect(diagnostics).toHaveLength(3);
    expect(diagnostics.find((row) => row.key === 'fantasyProsDevy')).toMatchObject({
      board: 'devy',
      status: 'loaded',
      rowCount: 1,
      trustScore: 68,
    });
    expect(diagnostics.find((row) => row.key === 'flock')).toBeUndefined();
  });

  it('calculates previous devy trust from stored source snapshots', () => {
    const previousAlignedRows: Record<string, ProspectSourceRow> = {};
    for (let index = 1; index <= 12; index += 1) {
      previousAlignedRows[`prospect${index}`] = {
        name: `Prospect ${index}`,
        position: 'RB',
        value: 8000 - index * 50,
      };
    }

    const previousTrust = calculatePreviousProspectSourceTrust([{
      schemaVersion: 1,
      generatedAt: '2026-05-10T00:00:00.000Z',
      snapshotKey: '2026-05-10',
      profileKey: 'devy_sf_ppr',
      sources: {
        fantasyProsDevy: previousAlignedRows,
        ktc: previousAlignedRows,
      },
      diagnostics: [],
    }]);

    expect(previousTrust.fantasyProsDevy?.score).toBeGreaterThan(68);
    expect(previousTrust.ktc?.effectiveWeight).toBeGreaterThan(BASE_PROSPECT_SOURCE_WEIGHTS.ktc);
  });
});
