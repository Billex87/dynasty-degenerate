import { describe, expect, it } from 'vitest';
import {
  buildHistoricalPlayerTeamMap,
  getHistoricalPlayerTeamKey,
  resolveHistoricalPlayerTeam,
  toSleeperHistoricalTeamMaps,
} from './historicalPlayerTeamMap';

describe('historical player team map', () => {
  it('builds exact season-week and derived season maps for Sleeper joins', () => {
    const map = buildHistoricalPlayerTeamMap([
      { playerId: '4984', playerName: 'Josh Allen', season: 2021, week: 5, team: 'Buffalo Bills', source: 'sleeper-weekly', confidence: 95 },
      { playerId: '4984', playerName: 'Josh Allen', season: 2021, week: 6, team: 'BUF', source: 'sleeper-weekly', confidence: 95 },
    ]);

    expect(map.coverage).toMatchObject({
      inputRows: 2,
      usableRows: 2,
      seasonWeekKeys: 2,
      seasonKeys: 1,
      playerKeys: 1,
      conflictCount: 0,
    });
    expect(map.byPlayerSeasonWeek[getHistoricalPlayerTeamKey('4984', 2021, 5)]?.team).toBe('BUF');
    expect(map.byPlayerSeason[getHistoricalPlayerTeamKey('4984', 2021)]?.team).toBe('BUF');
    expect(toSleeperHistoricalTeamMaps(map)?.byPlayerSeasonWeek?.['4984:2021:5']).toBe('BUF');
  });

  it('keeps traded-player data exact instead of inventing a player-level fallback', () => {
    const map = buildHistoricalPlayerTeamMap([
      { playerId: 'traded', season: 2022, week: 1, team: 'CAR', source: 'gamebook', confidence: 90 },
      { playerId: 'traded', season: 2022, week: 10, team: 'SF', source: 'gamebook', confidence: 90 },
    ]);

    expect(map.byPlayerSeasonWeek['traded:2022:1']?.team).toBe('CAR');
    expect(map.byPlayerSeasonWeek['traded:2022:10']?.team).toBe('SF');
    expect(map.byPlayerSeason['traded:2022']).toBeUndefined();
    expect(map.byPlayerId.traded).toBeUndefined();
    expect(resolveHistoricalPlayerTeam(map, { playerId: 'traded', season: 2022, week: 10 })).toMatchObject({
      resolution: 'season-week',
      entry: expect.objectContaining({ team: 'SF' }),
    });
    expect(resolveHistoricalPlayerTeam(map, { playerId: 'traded', season: 2022, week: 11 })).toMatchObject({
      resolution: 'missing',
    });
  });

  it('blocks ambiguous same-week conflicts without a clear confidence lead', () => {
    const map = buildHistoricalPlayerTeamMap([
      { playerId: 'ambiguous', season: 2023, week: 2, team: 'NE', source: 'source-a', confidence: 80 },
      { playerId: 'ambiguous', season: 2023, week: 2, team: 'NYJ', source: 'source-b', confidence: 76 },
    ]);

    expect(map.byPlayerSeasonWeek['ambiguous:2023:2']).toBeUndefined();
    expect(map.coverage.conflictCount).toBe(1);
    expect(map.conflicts[0]).toMatchObject({
      key: 'ambiguous:2023:2',
      scope: 'season-week',
      teams: ['NE', 'NYJ'],
    });
    expect(resolveHistoricalPlayerTeam(map, { playerId: 'ambiguous', season: 2023, week: 2 })).toMatchObject({
      resolution: 'conflict',
    });
  });
});
