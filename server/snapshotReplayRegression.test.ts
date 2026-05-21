import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { getDynastySourceWeights } from './dynastySourceWeights';
import {
  calculateDynastySourceTrust,
  getDynastySourceRowsFromSnapshotValues,
  type DynastySourceTrustMap,
} from './dynastySourceTrust';
import {
  calculateRedraftSourceTrust,
  type RedraftSourceSnapshotPayload,
  type RedraftSourceTrustMap,
} from './redraftRankings';
import {
  calculateProspectSourceTrust,
  type ProspectSourceSnapshotPayload,
  type ProspectSourceTrustMap,
} from './prospectSourceTrust';

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), filePath), 'utf8')) as T;
}

function hasSnapshotFile(filePath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), filePath));
}

function expectFiniteTrustWeights(
  trust: DynastySourceTrustMap | RedraftSourceTrustMap | ProspectSourceTrustMap,
  keys: string[],
) {
  for (const key of keys) {
    const row = trust[key as keyof typeof trust];
    expect(row?.status).toBe('loaded');
    expect(row?.score).toBeGreaterThanOrEqual(0);
    expect(row?.score).toBeLessThanOrEqual(100);
    expect(row?.multiplier).toBeGreaterThan(0);
    expect(row?.effectiveWeight).toBeGreaterThan(0);
  }
}

describe('stored snapshot replay regressions', () => {
  const dynastySnapshotPath = 'server/ktc-snapshots/ktc-snapshot-2026-05-07.json';
  const redraftSnapshotPath = 'server/redraft-snapshots/redraft-source-snapshot-2026-2026-05-14.json';
  const devySnapshotPath = 'server/devy-source-snapshots/devy-source-snapshot-devy_sf_ppr-2026-05-13.json';

  (hasSnapshotFile(dynastySnapshotPath) ? it : it.skip)('replays a dynasty blended-value snapshot through current source-trust logic', () => {
    const snapshot = readJsonFile<{
      blendedProfiles: Record<string, Record<string, any>>;
    }>(dynastySnapshotPath);
    const profile = snapshot.blendedProfiles['12_sf_ppr_base'];
    const sourceRows = getDynastySourceRowsFromSnapshotValues(profile);
    const trust = calculateDynastySourceTrust({
      sourceMaps: sourceRows,
      baseWeights: getDynastySourceWeights({
        board: 'dynasty',
        numQbs: 2,
        ppr: 1,
        tep: 0,
      }),
    });

    expect(Object.keys(profile)).toHaveLength(741);
    expect(profile.joshallen).toMatchObject({
      name: 'Josh Allen',
      position_rank: 'QB1',
      dynasty_value: 10084,
      redraft_value: 10299,
    });
    expect(profile.jamarrchase).toMatchObject({
      name: "Ja'Marr Chase",
      position_rank: 'WR1',
      dynasty_value: 9797,
    });
    expect(sourceRows.ktc && Object.keys(sourceRows.ktc)).toHaveLength(464);
    expect(sourceRows.flock && Object.keys(sourceRows.flock).length).toBeGreaterThan(450);
    expect(sourceRows.dynastyNerds && Object.keys(sourceRows.dynastyNerds).length).toBeGreaterThan(300);
    expectFiniteTrustWeights(trust, ['ktc', 'flock', 'dynastyNerds', 'fantasyCalc', 'dynastyProcess']);
    expect(trust.ktc?.sampleSize).toBeGreaterThan(250);
  });

  (hasSnapshotFile(redraftSnapshotPath) ? it : it.skip)('replays a redraft source snapshot through current trust thresholds', () => {
    const snapshot = readJsonFile<RedraftSourceSnapshotPayload>(redraftSnapshotPath);
    const trust = calculateRedraftSourceTrust({
      sourceMaps: snapshot.sources,
      diagnostics: snapshot.diagnostics,
      history: [],
    });

    expect(snapshot.sources.fantasyPros?.jamarrchase).toMatchObject({
      name: "Ja'Marr Chase",
      position: 'WR',
      rank: 1,
      positionRank: 'WR1',
      value: 9000,
    });
    expect(snapshot.sources.internalSeasonBlend?.jamarrchase).toMatchObject({
      rank: 3,
      positionRank: 'WR1',
      value: 9234,
    });
    expect(Object.keys(snapshot.sources.fantasyPros || {})).toHaveLength(427);
    expect(Object.keys(snapshot.sources.espnFantasy || {})).toHaveLength(700);
    expectFiniteTrustWeights(trust, ['fantasyPros', 'internalSeasonBlend', 'mflRankings', 'espnFantasy', 'nflFantasy']);
    expect(trust.fantasyPros?.sampleSize).toBeGreaterThan(100);
  });

  (hasSnapshotFile(devySnapshotPath) ? it : it.skip)('replays a devy source snapshot through current prospect trust thresholds', () => {
    const snapshot = readJsonFile<ProspectSourceSnapshotPayload>(devySnapshotPath);
    const trust = calculateProspectSourceTrust({
      sourceMaps: snapshot.sources,
    });

    expect(snapshot.sources.fantasyProsDevy?.jeremiahsmith).toMatchObject({
      name: 'Jeremiah Smith',
      position: 'WR',
      rank: 1,
      value: 10000,
    });
    expect(snapshot.sources.ktc?.jeremiahsmith).toMatchObject({
      rank: 1,
      value: 9837,
    });
    expect(snapshot.sources.prospectArchive?.jeremiahsmith).toMatchObject({
      rank: 1,
      value: 10000,
    });
    expect(Object.keys(snapshot.sources.fantasyProsDevy || {})).toHaveLength(183);
    expect(Object.keys(snapshot.sources.prospectArchive || {})).toHaveLength(287);
    expectFiniteTrustWeights(trust, ['fantasyProsDevy', 'flock', 'ktc', 'prospectArchive']);
    expect(trust.fantasyProsDevy?.sampleSize).toBeGreaterThan(50);
  });
});
