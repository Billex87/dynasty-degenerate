import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchFantasyProsDraftRankings,
  fetchFantasyProsDynastyRankings,
  fetchFantasyProsPlayerPoints,
  normalizeFantasyProsRankingsPayload,
} from './fantasyPros';

describe('FantasyPros API client', () => {
  afterEach(() => {
    delete process.env.FANTASYPROS_API_KEY;
    delete process.env.ENABLE_FANTASYPROS_DYNASTY_RANKINGS;
    vi.unstubAllGlobals();
  });

  it('uses the documented uppercase NFL sport path and x-api-key header', async () => {
    process.env.FANTASYPROS_API_KEY = 'test-fantasypros-key';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      last_updated: '2026-05-11T00:00:00Z',
      players: [{
        player_name: 'Christian McCaffrey',
        player_position_id: 'RB',
        player_team_id: 'SF',
        rank_ecr: 2,
        pos_rank: 'RB1',
        tier: 1,
      }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const rows = await fetchFantasyProsDraftRankings('2026', 'PPR');

    expect(rows.christianmccaffrey).toMatchObject({
      name: 'Christian McCaffrey',
      position: 'RB',
      team: 'SF',
      overallRank: 2,
      positionRank: 'RB1',
      tier: 1,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.fantasypros.com/public/v2/json/NFL/2026/consensus-rankings?position=ALL&type=DRAFT&scoring=PPR&week=0',
      { headers: { 'x-api-key': 'test-fantasypros-key' } },
    );
  });

  it('normalizes dynasty rankings as dynasty values instead of season values', () => {
    const rows = normalizeFantasyProsRankingsPayload({
      year: 2026,
      last_updated: '2026-05-11T00:00:00Z',
      total_experts: 22,
      players: [{
        player_name: 'Malik Nabers',
        player_position_id: 'WR',
        player_team_id: 'NYG',
        rank_ecr: 8,
        pos_rank: 'WR3',
        rank_min: 3,
        rank_max: 18,
      }],
    }, {
      season: '2026',
      rankingType: 'DYNASTY',
    });

    expect(rows.maliknabers).toMatchObject({
      name: 'Malik Nabers',
      rankingType: 'DYNASTY',
      overallRank: 8,
      positionRank: 'WR3',
      totalExperts: 22,
      bestRank: 3,
      worstRank: 18,
    });
    expect(rows.maliknabers.dynastyValue).toBeGreaterThan(0);
    expect(rows.maliknabers.seasonValue).toBeUndefined();
  });

  it('requests FantasyPros Dynasty rankings with the documented consensus endpoint', async () => {
    process.env.FANTASYPROS_API_KEY = 'test-fantasypros-key';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      year: 2031,
      total_experts: 22,
      players: [{
        player_name: 'Bijan Robinson',
        player_position_id: 'RB',
        player_team_id: 'ATL',
        rank_ecr: 5,
        pos_rank: 'RB2',
      }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const rows = await fetchFantasyProsDynastyRankings('2031', 'PPR');

    expect(rows.bijanrobinson).toMatchObject({
      name: 'Bijan Robinson',
      rankingType: 'DYNASTY',
      position: 'RB',
      overallRank: 5,
      positionRank: 'RB2',
    });
    expect(rows.bijanrobinson.dynastyValue).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.fantasypros.com/public/v2/json/NFL/2031/consensus-rankings?position=ALL&type=DYNASTY&scoring=PPR&week=0',
      { headers: { 'x-api-key': 'test-fantasypros-key' } },
    );
  });

  it('uses the documented lowercase NFL player-points path', async () => {
    process.env.FANTASYPROS_API_KEY = 'test-fantasypros-key';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      season: '2026',
      scoring: 'PPR',
      players: [{
        player_name: 'Ja\'Marr Chase',
        position_id: 'WR',
        team_id: 'CIN',
        games: 17,
        points: 301.2,
        average: 17.7,
        weeks: { '1': 21.4 },
      }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const rows = await fetchFantasyProsPlayerPoints('2026', 'PPR');

    expect(rows.jamarrchase).toMatchObject({
      name: 'Ja\'Marr Chase',
      position: 'WR',
      team: 'CIN',
      games: 17,
      points: 301.2,
      average: 17.7,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.fantasypros.com/public/v2/json/nfl/2026/player-points?position=ALL&scoring=PPR',
      { headers: { 'x-api-key': 'test-fantasypros-key' } },
    );
  });
});
