import { describe, expect, it } from 'vitest';
import {
  buildDraftSharksPublicSosSnapshot,
  buildDraftSharksSosRowsFromVueAppData,
  parseDraftSharksVueAppData,
} from './draftSharksPublicSosSnapshot';

const html = `
<html>
  <head></head>
  <body>
    <script>
      var vueAppData = {"teamData":[
        {"abbr":"KC","schedule":[
          {"week":1,"home":1,"update_time":"2026-05-19 21:05:30","opponent":{"abbr":"LV","currentSosFpa":{"against_qb_percent_diff":"0.112","against_rb_percent_diff":"-0.081","against_wr_percent_diff":"0.040","against_te_percent_diff":"0.250","against_k_percent_diff":"-0.120","against_def_percent_diff":"0.330"}}},
          {"week":2,"home":0,"update_time":"2026-05-20 21:05:30","opponent":{"abbr":"DEN","currentSosFpa":{"against_qb_percent_diff":"-0.094","against_rb_percent_diff":"0.090","against_wr_percent_diff":"0.100","against_te_percent_diff":"-0.100","against_k_percent_diff":"0.050","against_def_percent_diff":"-0.090"}}},
          {"week":19,"home":1,"opponent":{"abbr":"BUF","currentSosFpa":{"against_qb_percent_diff":"0.999"}}}
        ]}
      ]};
    </script>
  </body>
</html>`;

describe('DraftSharks public SOS snapshot parser', () => {
  it('extracts vueAppData from the public page html', () => {
    const data = parseDraftSharksVueAppData(html) as { teamData: unknown[] };

    expect(data.teamData).toHaveLength(1);
  });

  it('builds team-position rows from embedded schedule opponent percentages', () => {
    const rows = buildDraftSharksSosRowsFromVueAppData({
      data: parseDraftSharksVueAppData(html),
      fetchedAt: '2026-06-04T18:00:00.000Z',
    });

    expect(rows).toHaveLength(6);
    expect(rows.find((row) => row.team === 'KC' && row.position === 'QB')).toMatchObject({
      seasonSOS: 0.9,
      remainingSOS: 0.9,
      tier: 'neutral',
      streamerWeeks: [1],
      avoidWeeks: [2],
      weeks: [
        {
          week: 1,
          opponent: 'LV',
          homeAway: 'home',
          matchup_percent: 11.2,
        },
        {
          week: 2,
          opponent: 'DEN',
          homeAway: 'away',
          matchup_percent: -9.4,
        },
      ],
    });
  });

  it('builds a draftsharks-sos-v1 snapshot payload readable by the existing loader contract', () => {
    const snapshot = buildDraftSharksPublicSosSnapshot({
      html,
      season: 2026,
      sourceVersion: 'public-test',
      fetchedAt: '2026-06-04T18:00:00.000Z',
      sourceUrl: 'https://www.draftsharks.com/strength-of-schedule/qb',
      minProfileCount: 6,
    });

    expect(snapshot).toMatchObject({
      sourceKey: 'draftsharks-sos-v1',
      snapshotKey: '2026:public-test',
      rowCount: 6,
      profileCount: 6,
    });
    expect(snapshot.payload.context.profiles['KC:DEF']).toMatchObject({
      remainingSOS: 12,
      streamerWeeks: [1],
      avoidWeeks: [2],
    });
  });

  it('fails closed when public-page coverage drops below the expected threshold', () => {
    expect(() => buildDraftSharksPublicSosSnapshot({
      html,
      season: 2026,
      sourceVersion: 'too-small',
      fetchedAt: '2026-06-04T18:00:00.000Z',
    })).toThrow(/coverage is too low/i);
  });
});
