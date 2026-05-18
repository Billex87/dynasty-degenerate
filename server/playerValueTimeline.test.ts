import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listLocalKtcSnapshotDateKeysSince: vi.fn(),
  loadLocalKtcSnapshotForDate: vi.fn(),
}));

vi.mock('./ktcLoader', () => ({
  listLocalKtcSnapshotDateKeysSince: mocks.listLocalKtcSnapshotDateKeysSince,
  loadLocalKtcSnapshotForDate: mocks.loadLocalKtcSnapshotForDate,
}));

import { buildPlayerValueTimelineMap, getHistoricalPlayerValueAtDate } from './playerValueTimeline';

describe('player value timeline', () => {
  it('builds compact stored snapshot timelines and flags source-set changes', () => {
    mocks.listLocalKtcSnapshotDateKeysSince.mockReturnValue(['2026-05-07', '2026-05-11']);
    mocks.loadLocalKtcSnapshotForDate.mockImplementation((date: string) => ({
      malachifields: {
        name: 'Malachi Fields',
        ktc_value: date === '2026-05-07' ? 1200 : 1500,
        dynasty_value: date === '2026-05-07' ? 1200 : 1500,
        position_rank: date === '2026-05-07' ? 'WR110' : 'WR101',
        value_sources: date === '2026-05-07' ? ['KTC'] : ['KTC', 'FantasyCalc'],
        market_value_ktc: date === '2026-05-07' ? 1200 : 1500,
      },
    }));

    const result = buildPlayerValueTimelineMap({
      playerIds: ['p1'],
      players: {
        p1: {
          first_name: 'Malachi',
          last_name: 'Fields',
          position: 'WR',
        },
      },
      valueProfileKey: '12_sf_ppr_base',
      now: new Date('2026-05-12T12:00:00.000Z'),
    });

    expect(result.p1).toMatchObject({
      profileKey: '12_sf_ppr_base',
      source: 'stored-value-snapshots',
      summary: {
        startValue: 1200,
        endValue: 1500,
        delta: 300,
        deltaPct: 25,
        sourceSetChanged: true,
      },
    });
    expect(result.p1.points).toHaveLength(2);
    expect(result.p1.points[1]).toMatchObject({
      date: '2026-05-11',
      rank: 'WR101',
      sourceCount: 2,
    });
  });

  it('skips players without enough stored points', () => {
    mocks.listLocalKtcSnapshotDateKeysSince.mockReturnValue(['2026-05-07']);
    mocks.loadLocalKtcSnapshotForDate.mockReturnValue({
      demondclaiborne: {
        name: 'Demond Claiborne',
        ktc_value: 1000,
        dynasty_value: 1000,
      },
    });

    const result = buildPlayerValueTimelineMap({
      playerIds: ['p1'],
      players: {
        p1: {
          first_name: 'Demond',
          last_name: 'Claiborne',
        },
      },
      valueProfileKey: '12_sf_ppr_base',
    });

    expect(result).toEqual({});
  });

  it('adds latest-point event markers from enriched player context', () => {
    mocks.listLocalKtcSnapshotDateKeysSince.mockReturnValue(['2026-05-07', '2026-05-11']);
    mocks.loadLocalKtcSnapshotForDate.mockImplementation((date: string) => ({
      jadarianprice: {
        name: 'Jadarian Price',
        ktc_value: date === '2026-05-07' ? 4100 : 5200,
        dynasty_value: date === '2026-05-07' ? 4100 : 5200,
        position_rank: date === '2026-05-07' ? 'RB24' : 'RB18',
        value_sources: ['KTC', 'FantasyCalc'],
      },
    }));

    const result = buildPlayerValueTimelineMap({
      playerIds: ['p1'],
      players: {
        p1: {
          first_name: 'Jadarian',
          last_name: 'Price',
        },
      },
      playerDetailsById: {
        p1: {
          fullName: 'Jadarian Price',
          position: 'RB',
          nflDraftRound: 1,
          nflDraftPick: 32,
          nflDraftTeam: 'SEA',
          rosterRoom: {
            source: 'nflverse rosters/weekly rosters/depth charts/trades',
            season: '2026',
            previousSeason: '2025',
            team: 'SEA',
            position: 'RB',
            currentCount: 4,
            previousCount: 4,
            netChange: 0,
            additions: [],
            losses: [],
            rookieAdditions: [],
            premiumAdditions: [],
            depthChartTop: [],
            opportunityDelta: {
              vacatedTargets: 37,
              vacatedCarries: 230,
              vacatedReceptions: 22,
              vacatedFantasyPointsPpr: 202.3,
              addedPriorTargets: 17,
              addedPriorCarries: 130,
              addedPriorReceptions: 12,
              addedPriorFantasyPointsPpr: 96.5,
              vacatedImpactScore: 88,
              addedThreatScore: 100,
              netOpportunityScore: 0,
              qualitySignal: 'minor-opening',
              incumbentPromotionScore: 38,
              incumbentOpportunitySignal: 'minor-promotion',
              topVacatedPlayer: 'Kenneth Walker III',
              topAddedThreat: 'Jadarian Price',
              topReturningDepthPlayer: 'Zach Charbonnet',
              note: 'SEA RB net opportunity stable.',
            },
            competitionLevel: 'normal',
            vacatedOpportunitySignal: 'stable',
            note: 'SEA RB room.',
          },
        },
      },
      valueProfileKey: '12_sf_ppr_base',
    });

    const events = result.p1.points.at(-1)?.events || [];
    expect(result.p1.summary.eventCount).toBe(3);
    expect(events.map((event) => event.label)).toEqual([
      'Minor opening',
      'Role bump',
      'Premium draft capital',
    ]);
  });

  it('uses sharded historical value history without loading the full graph index', () => {
    const previousUseIndex = process.env.USE_VALUE_TIMELINE_INDEX;
    const previousIndexFile = process.env.VALUE_TIMELINE_INDEX_FILE;
    const previousShardDir = process.env.VALUE_TIMELINE_SHARDS_DIR;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'value-timeline-shards-'));
    fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify({
      schemaVersion: 1,
      shardCount: 1,
      shards: [{ key: 'ma', file: 'ma.json', playerCount: 1 }],
    }));
    fs.writeFileSync(path.join(tempDir, 'ma.json'), JSON.stringify({
      players: {
        malachifields: {
          key: 'malachifields',
          name: 'Malachi Fields',
          position: 'WR',
          lookupKeys: ['malachifields'],
          formats: {
            sf_ppr: {
              format: 'sf_ppr',
              rawPointCount: 3,
              asOfPoints: [
                { date: '2026-01-01', value: 1100, rank: 'WR120', overallRank: 230, sources: ['marketKtc'], sourceCount: 1 },
                { date: '2026-04-01', value: 1700, rank: 'WR86', overallRank: 160, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
              ],
              windows: {
                all: {
                  key: 'all',
                  label: 'All',
                  days: null,
                  pointCount: 2,
                  startDate: '2026-01-01',
                  endDate: '2026-04-01',
                  startValue: 1100,
                  endValue: 1700,
                  delta: 600,
                  deltaPct: 54.5,
                  points: [
                    { date: '2026-01-01', value: 1100, rank: 'WR120', overallRank: 230, sources: ['marketKtc'], sourceCount: 1 },
                    { date: '2026-04-01', value: 1700, rank: 'WR86', overallRank: 160, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
                  ],
                },
              },
            },
          },
        },
      },
    }));

    process.env.USE_VALUE_TIMELINE_INDEX = '1';
    process.env.VALUE_TIMELINE_SHARDS_DIR = tempDir;
    process.env.VALUE_TIMELINE_INDEX_FILE = path.join(tempDir, 'missing-full-index.json');
    mocks.listLocalKtcSnapshotDateKeysSince.mockReturnValue([]);

    const result = buildPlayerValueTimelineMap({
      playerIds: ['p1'],
      players: {
        p1: {
          first_name: 'Malachi',
          last_name: 'Fields',
          position: 'WR',
        },
      },
      valueProfileKey: '12_sf_ppr_base',
      daysBack: 500,
    });

    expect(result.p1).toMatchObject({
      source: 'historical-value-index',
      selectedWindow: 'all',
      allTimePointCount: 3,
      summary: {
        startValue: 1100,
        endValue: 1700,
        delta: 600,
      },
    });
    expect(getHistoricalPlayerValueAtDate({
      playerName: 'Malachi Fields',
      date: '2026-03-31',
      valueProfileKey: '12_sf_ppr_base',
      leagueValueMode: 'dynasty',
    })).toMatchObject({
      value: 1700,
      valueDate: '2026-04-01',
      daysAway: 1,
    });

    process.env.USE_VALUE_TIMELINE_INDEX = previousUseIndex;
    process.env.VALUE_TIMELINE_INDEX_FILE = previousIndexFile;
    process.env.VALUE_TIMELINE_SHARDS_DIR = previousShardDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('extends historical timelines with recent stored scrape points', () => {
    const previousUseIndex = process.env.USE_VALUE_TIMELINE_INDEX;
    const previousIndexFile = process.env.VALUE_TIMELINE_INDEX_FILE;
    const previousShardDir = process.env.VALUE_TIMELINE_SHARDS_DIR;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'value-timeline-overlay-'));
    fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify({
      schemaVersion: 1,
      shardCount: 1,
      shards: [{ key: 'ma', file: 'ma.json', playerCount: 1 }],
    }));
    fs.writeFileSync(path.join(tempDir, 'ma.json'), JSON.stringify({
      players: {
        malachifields: {
          key: 'malachifields',
          name: 'Malachi Fields',
          position: 'WR',
          lookupKeys: ['malachifields'],
          formats: {
            sf_ppr: {
              format: 'sf_ppr',
              rawPointCount: 2,
              asOfPoints: [
                { date: '2026-01-01', value: 1100, rank: 'WR120', overallRank: 230, sources: ['marketKtc'], sourceCount: 1 },
                { date: '2026-04-01', value: 1700, rank: 'WR86', overallRank: 160, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
              ],
              windows: {
                all: {
                  key: 'all',
                  label: 'All',
                  days: null,
                  pointCount: 2,
                  startDate: '2026-01-01',
                  endDate: '2026-04-01',
                  startValue: 1100,
                  endValue: 1700,
                  delta: 600,
                  deltaPct: 54.5,
                  points: [
                    { date: '2026-01-01', value: 1100, rank: 'WR120', overallRank: 230, sources: ['marketKtc'], sourceCount: 1 },
                    { date: '2026-04-01', value: 1700, rank: 'WR86', overallRank: 160, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
                  ],
                },
              },
            },
          },
        },
      },
    }));

    process.env.USE_VALUE_TIMELINE_INDEX = '1';
    process.env.VALUE_TIMELINE_SHARDS_DIR = tempDir;
    process.env.VALUE_TIMELINE_INDEX_FILE = path.join(tempDir, 'missing-full-index.json');
    mocks.listLocalKtcSnapshotDateKeysSince.mockReturnValue([]);

    const result = buildPlayerValueTimelineMap({
      playerIds: ['p1'],
      players: {
        p1: {
          first_name: 'Malachi',
          last_name: 'Fields',
          position: 'WR',
        },
      },
      valueProfileKey: '12_sf_ppr_base',
      daysBack: 500,
      recentStoredSnapshots: [
        {
          date: '2026-04-25',
          values: {
            malachifields: {
              name: 'Malachi Fields',
              ktc_value: 1800,
              dynasty_value: 1800,
              position_rank: 'WR78',
              value_sources: ['KTC', 'FantasyCalc'],
              market_value_ktc: 1750,
              market_value_fantasycalc: 1850,
            },
          },
        },
        {
          date: '2026-05-11',
          values: {
            malachifields: {
              name: 'Malachi Fields',
              ktc_value: 1900,
              dynasty_value: 1900,
              position_rank: 'WR72',
              value_sources: ['KTC', 'FantasyCalc', 'FlockFantasy'],
              market_value_ktc: 1800,
              market_value_fantasycalc: 1750,
              expert_value_flock: 2100,
            },
          },
        },
      ],
    });

    expect(result.p1).toMatchObject({
      source: 'historical-value-index',
      selectedWindow: 'all',
      summary: {
        startValue: 1100,
        endValue: 1900,
        delta: 800,
      },
      extremes: {
        high: { date: '2026-05-11', value: 1900, rank: 'WR72' },
      },
    });
    expect(result.p1.points.at(-1)).toMatchObject({
      date: '2026-05-11',
      value: 1900,
      rank: 'WR72',
      sourceCount: 3,
    });
    expect(result.p1.availableWindows?.map((window) => window.key)).toContain('1m');

    process.env.USE_VALUE_TIMELINE_INDEX = previousUseIndex;
    process.env.VALUE_TIMELINE_INDEX_FILE = previousIndexFile;
    process.env.VALUE_TIMELINE_SHARDS_DIR = previousShardDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('uses the historical timeline index when available', () => {
    const previousUseIndex = process.env.USE_VALUE_TIMELINE_INDEX;
    const previousIndexFile = process.env.VALUE_TIMELINE_INDEX_FILE;
    const previousShardDir = process.env.VALUE_TIMELINE_SHARDS_DIR;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'value-timeline-index-'));
    const indexFile = path.join(tempDir, 'index.json');
    fs.writeFileSync(indexFile, JSON.stringify({
      players: {
        malachifields: {
          key: 'malachifields',
          name: 'Malachi Fields',
          position: 'WR',
          lookupKeys: ['malachifields'],
          formats: {
            sf_ppr: {
              format: 'sf_ppr',
              rawPointCount: 3,
              asOfPoints: [
                { date: '2025-12-01', value: 1200, rank: 'WR110', overallRank: 220, sources: ['marketKtc'], sourceCount: 1 },
                { date: '2026-03-01', value: 1500, rank: 'WR98', overallRank: 190, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
                { date: '2026-05-17', value: 1800, rank: 'WR80', overallRank: 150, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
              ],
              windows: {
                '6m': {
                  key: '6m',
                  label: '6M',
                  days: 183,
                  pointCount: 3,
                  startDate: '2025-12-01',
                  endDate: '2026-05-17',
                  startValue: 1200,
                  endValue: 1800,
                  delta: 600,
                  deltaPct: 50,
                  points: [
                    { date: '2025-12-01', value: 1200, rank: 'WR110', overallRank: 220, sources: ['marketKtc'], sourceCount: 1 },
                    { date: '2026-03-01', value: 1500, rank: 'WR98', overallRank: 190, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
                    { date: '2026-05-17', value: 1800, rank: 'WR80', overallRank: 150, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
                  ],
                },
                all: {
                  key: 'all',
                  label: 'All',
                  days: null,
                  pointCount: 3,
                  startDate: '2025-12-01',
                  endDate: '2026-05-17',
                  startValue: 1200,
                  endValue: 1800,
                  delta: 600,
                  deltaPct: 50,
                  points: [
                    { date: '2025-12-01', value: 1200, rank: 'WR110', overallRank: 220, sources: ['marketKtc'], sourceCount: 1 },
                    { date: '2026-03-01', value: 1500, rank: 'WR98', overallRank: 190, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
                    { date: '2026-05-17', value: 1800, rank: 'WR80', overallRank: 150, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
                  ],
                },
              },
              extremes: {
                high: { date: '2026-05-17', value: 1800, rank: 'WR80', overallRank: 150, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
                low: { date: '2025-12-01', value: 1200, rank: 'WR110', overallRank: 220, sources: ['marketKtc'], sourceCount: 1 },
              },
              yearlyExtremes: [{
                year: '2026',
                high: { date: '2026-05-17', value: 1800, rank: 'WR80', overallRank: 150, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
                low: { date: '2026-03-01', value: 1500, rank: 'WR98', overallRank: 190, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
              }],
            },
          },
        },
      },
    }));

    process.env.USE_VALUE_TIMELINE_INDEX = '1';
    process.env.VALUE_TIMELINE_INDEX_FILE = indexFile;
    process.env.VALUE_TIMELINE_SHARDS_DIR = path.join(tempDir, 'missing-shards');
    mocks.listLocalKtcSnapshotDateKeysSince.mockReturnValue([]);

    const result = buildPlayerValueTimelineMap({
      playerIds: ['p1'],
      players: {
        p1: {
          first_name: 'Malachi',
          last_name: 'Fields',
          position: 'WR',
        },
      },
      valueProfileKey: '12_sf_ppr_base',
      daysBack: 180,
    });

    expect(result.p1).toMatchObject({
      source: 'historical-value-index',
      selectedWindow: '6m',
      allTimePointCount: 3,
      summary: {
        startValue: 1200,
        endValue: 1800,
        delta: 600,
        deltaPct: 50,
      },
      extremes: {
        high: { date: '2026-05-17', value: 1800, rank: 'WR80' },
        low: { date: '2025-12-01', value: 1200, rank: 'WR110' },
      },
    });
    expect(result.p1.availableWindows?.map((window) => window.key)).toEqual(['3m', '6m', '1y', 'all']);
    expect(result.p1.points.at(-1)).toMatchObject({ rank: 'WR80', overallRank: 150 });

    const asOfValue = getHistoricalPlayerValueAtDate({
      playerName: 'Malachi Fields',
      date: '2026-03-03',
      valueProfileKey: '12_sf_ppr_base',
      leagueValueMode: 'dynasty',
    });
    expect(asOfValue).toMatchObject({
      value: 1500,
      valueDate: '2026-03-01',
      daysAway: 2,
      format: 'sf_ppr',
      source: 'historical-value-index',
    });

    process.env.USE_VALUE_TIMELINE_INDEX = previousUseIndex;
    process.env.VALUE_TIMELINE_INDEX_FILE = previousIndexFile;
    process.env.VALUE_TIMELINE_SHARDS_DIR = previousShardDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
