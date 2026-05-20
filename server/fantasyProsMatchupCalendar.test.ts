import { afterEach, describe, expect, it, vi } from 'vitest';
import * as db from './db';
import {
  buildFantasyProsMatchupCalendarContext,
  getFantasyProsMatchupCalendarSourceKey,
  parseFantasyProsMatchupCalendarHtml,
  refreshFantasyProsMatchupCalendarSnapshots,
  type FantasyProsMatchupCalendarSnapshotPayload,
} from './fantasyProsMatchupCalendar';

const FIXTURE_HTML = `
  <table id="data" class="player-table">
    <thead>
      <tr>
        <th>ECR</th>
        <th>Player</th>
        <th class="sorter-ranksorter">1</th>
        <th class="sorter-ranksorter">2</th>
        <th class="sorter-ranksorter">3</th>
      </tr>
    </thead>
    <tbody>
      <tr class="mpb-available mpb-player-17298">
        <td class="center td--sticky-column-ecr">1</td>
        <td class="player-label td--sticky-column-player">
          <a href="/nfl/players/josh-allen-qb.php" class="player-name fp-player-link fp-id-17298" fp-player-name="Josh Allen">
            <span class="hidden-mobile">Josh Allen</span>
            <span class="hidden-desktop">J. Allen</span>
          </a>
          <small class="grey">BUF</small>
        </td>
        <td class="matchup-cell" data-sort="30">
          <div class="wk matchup-cell__opponents-text hard"> at  HOU</div>
          <span class="rank__wrapper" data-rank="30">
            <span class="tooltip-right" data-tooltip="QBs perform below their average vs. HOU who currently ranks #30 against this position">
              <span class="hidden-aria">This is a 1 star matchup. QBs perform below their average vs. HOU who currently ranks #30 against this position</span>
            </span>
          </span>
        </td>
        <td class="matchup-cell" data-sort="13">
          <div class="wk matchup-cell__opponents-text"> vs.  DET</div>
          <span class="rank__wrapper" data-rank="13">
            <span class="hidden-aria">This is a 3 star matchup. QBs perform close to their average vs. DET who currently ranks #13 against this position</span>
          </span>
        </td>
        <td class="matchup-cell">BYE</td>
      </tr>
      <tr class="mpb-available mpb-player-17233">
        <td class="center td--sticky-column-ecr">2</td>
        <td class="player-label td--sticky-column-player">
          <a href="/nfl/players/lamar-jackson.php" class="player-name fp-player-link fp-id-17233" fp-player-name="Lamar Jackson"></a>
          <small class="grey">BAL</small>
        </td>
        <td class="matchup-cell" data-sort="1">
          <div class="wk matchup-cell__opponents-text easy"> at  DAL</div>
          <span class="rank__wrapper" data-rank="1">
            <span class="hidden-aria">This is a 5 star matchup. QBs perform better than their average vs. DAL who currently ranks #1 against this position</span>
          </span>
        </td>
        <td class="matchup-cell">BYE</td>
        <td class="matchup-cell" data-sort="26">
          <div class="wk matchup-cell__opponents-text hard"> vs.  CLE</div>
          <span class="rank__wrapper" data-rank="26">
            <span class="hidden-aria">This is a 2 star matchup. QBs perform below their average vs. CLE who currently ranks #26 against this position</span>
          </span>
        </td>
      </tr>
    </tbody>
  </table>
`;

describe('FantasyPros matchup calendar snapshots', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses weekly sortable matchup cells from the FantasyPros table', () => {
    const snapshot = parseFantasyProsMatchupCalendarHtml({
      html: FIXTURE_HTML,
      season: '2026',
      position: 'QB',
      fetchedAt: '2026-05-19T19:00:00.000Z',
    });

    expect(snapshot).toMatchObject({
      sourceKey: 'fantasypros-matchup-calendar-v1:2026:QB',
      rowCount: 2,
      weekCount: 3,
    });
    expect(snapshot.rows[0]).toMatchObject({
      fantasyProsId: '17298',
      name: 'Josh Allen',
      team: 'BUF',
      rank: 1,
      positionRank: 'QB1',
    });
    expect(snapshot.rows[0].weeks[0]).toMatchObject({
      week: 1,
      opponent: 'HOU',
      homeAway: 'away',
      opponentRank: 30,
      matchupStars: 1,
      matchupTier: 'hard',
      isBye: false,
    });
    expect(snapshot.rows[0].weeks[2]).toMatchObject({
      week: 3,
      isBye: true,
      matchupTier: 'bye',
    });
    expect(snapshot.rows[1].weeks[0]).toMatchObject({
      opponent: 'DAL',
      matchupStars: 5,
      matchupTier: 'easy',
    });
  });

  it('persists fetched position pages without storing secrets', async () => {
    const upsertSpy = vi.spyOn(db, 'upsertProviderDataSnapshot').mockResolvedValue(true);
    const fetchMock = vi.fn(async () => new Response(FIXTURE_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }));

    const results = await refreshFantasyProsMatchupCalendarSnapshots({
      season: '2026',
      positions: ['QB'],
      requestDelayMs: 0,
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: new Date('2026-05-19T19:00:00.000Z'),
    });

    expect(results).toEqual([
      expect.objectContaining({
        sourceKey: 'fantasypros-matchup-calendar-v1:2026:QB',
        status: 'loaded',
        rowCount: 2,
        weekCount: 3,
        persisted: true,
      }),
    ]);
    expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: getFantasyProsMatchupCalendarSourceKey({ season: '2026', position: 'QB' }),
      snapshotKey: '2026-05-19',
    }));
    expect(JSON.stringify(upsertSpy.mock.calls)).not.toContain('FANTASYPROS_API_KEY');
  });

  it('builds row counts and week indexes from stored snapshots', () => {
    const snapshot = parseFantasyProsMatchupCalendarHtml({
      html: FIXTURE_HTML,
      season: '2026',
      position: 'QB',
      fetchedAt: '2026-05-19T19:00:00.000Z',
    }) as FantasyProsMatchupCalendarSnapshotPayload;
    const context = buildFantasyProsMatchupCalendarContext({
      season: '2026',
      positions: ['QB'],
      snapshots: { QB: snapshot },
      generatedAt: '2026-05-19T20:00:00.000Z',
    });

    expect(context.rowCounts).toContainEqual({
      sourceKey: 'fantasypros-matchup-calendar-v1:2026:QB',
      rowCount: 2,
    });
    expect(context.rowsByPositionWeek.QB['1']['17298']).toMatchObject({
      name: 'Josh Allen',
      opponent: 'HOU',
      matchupStars: 1,
    });
    expect(context.summaries[0]).toMatchObject({
      status: 'loaded',
      rowCount: 2,
      weekCount: 3,
    });
  });
});
