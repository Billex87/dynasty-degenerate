import { describe, expect, it } from 'vitest';
import {
  buildProspectLookup,
  findProspectProfile,
  getProspectYears,
  normalizeEspnAthleteProfile,
  parseNflDraftBuzzMarkdown,
  shouldRunMonthlyProspectSnapshot,
} from './prospectSource';

const SAMPLE_MARKDOWN = `
## 1

![Image 1: Ohio State Mascot](https://example.com/osu.png)

[![Image 2: Julian Sayin Profile Picture](https://example.com/julian.png)](https://example.com/julian)

QB

Julian Sayin

6-1 203lbs 4.62

Pocket

203lbs 6-1 4.62 2.5 1.0

91.4

MORE

Quick-trigger passer with enough mobility and a clean intermediate profile.

## 2

![Image 2: Alabama Mascot](https://example.com/bama.png)

WR

Ryan Williams

6-0 175lbs 4.38

Vertical

175lbs 6-0 4.38 4.0 1.0

90.2

MORE

Explosive receiver prospect with early declare production and field-stretching traits.
`;

describe('NFL Draft Buzz prospect source', () => {
  it('parses offensive prospect context from rankings markdown', () => {
    const prospects = parseNflDraftBuzzMarkdown(SAMPLE_MARKDOWN, 2027, 'https://example.com');

    expect(prospects).toHaveLength(2);
    expect(prospects[0]).toMatchObject({
      name: 'Julian Sayin',
      position: 'QB',
      college: 'Ohio State',
      overallRank: 1,
      positionRank: 1,
      role: 'Pocket',
      height: '6-1',
      weight: '203lbs',
      fortyYardDash: 4.62,
      rating: 91.4,
      playerImageUrl: 'https://example.com/julian.png',
      collegeLogoUrl: 'https://example.com/osu.png',
    });
  });

  it('parses current scouting-report cards from position pages', () => {
    const markdown = `
### #1 RANKED - SCOUTING REPORT

![Image 43: Ohio State Mascot](http://www.nfldraftbuzz.com/Content/collmascots/ohio-state-buckeyes.png)

[![Image 44: Jeremiah Smith Profile Picture](http://www.nfldraftbuzz.com/Content/PlayerHeadShots/Jeremiah-Smith-WR-OhioState.png)](https://www.nfldraftbuzz.com/Player/Jeremiah-Smith-WR-OhioState)

#### Jeremiah Smith from Ohio State WR 2027 Scouting Report

###### POSITION

RANK

#1

###### OUR

RATING

94.0

 WR

All Scouts Average Overall Rank 2

All Scouts Average Position Rank 1

Height Feet 6-3

Weight Lbs 223lbs

College Junior Ohio State

Forty Time Secs 4.32

Player Summary Put the tape on and you'll see why every scout who walks through Columbus comes away shaking their head.
`;
    const prospects = parseNflDraftBuzzMarkdown(markdown, 2027, 'https://www.nfldraftbuzz.com/positions/WR/1/2027');

    expect(prospects[0]).toMatchObject({
      name: 'Jeremiah Smith',
      position: 'WR',
      college: 'Ohio State',
      draftYear: 2027,
      overallRank: 1,
      positionRank: 1,
      rating: 94,
      height: '6-3',
      weight: '223lbs',
      fortyYardDash: 4.32,
      playerImageUrl: 'https://www.nfldraftbuzz.com/Content/PlayerHeadShots/Jeremiah-Smith-WR-OhioState.png',
      collegeLogoUrl: 'https://www.nfldraftbuzz.com/Content/collmascots/ohio-state-buckeyes.png',
    });
  });

  it('parses the player rankings table rows below the scouting cards', () => {
    const markdown = `
## Player Rankings - Running Back

#Player Pos H/W/S Team Weight Height 40YD AVG POS RANK AVG OVR RANK Rating Summary
###### _1_[![Image 1: Justice Haynes Michigan Thumbnail - NFLDraftBUZZ.com](http://www.nfldraftbuzz.com/Content/PlayerHeadShotsSmall/Justice-Haynes-RB-Alabama.png)](http://www.nfldraftbuzz.com/Player/Justice-Haynes-RB-Alabama)

#### RB

Justice

 Haynes 5-11 210lbs 4.49 RB![Image 2: Michigan   Mascot](http://www.nfldraftbuzz.com/Content/collmascotsSmall/michigan-wolverines.png)

![Image 3: Michigan Mascot](http://www.nfldraftbuzz.com/Content/collmascotsSmall/michigan-wolverines.png)210lbs 5-11 4.49 4 87 84.5

[MORE>>](http://www.nfldraftbuzz.com/Player/Justice-Haynes-RB-Alabama)Between the tackles is where Haynes will earn his NFL money.
`;
    const prospects = parseNflDraftBuzzMarkdown(markdown, 2027, 'https://www.nfldraftbuzz.com/positions/RB/1/2027');

    expect(prospects).toHaveLength(1);
    expect(prospects[0]).toMatchObject({
      name: 'Justice Haynes',
      position: 'RB',
      college: 'Michigan',
      overallRank: 1,
      positionRank: 1,
      averageOverallRank: 87,
      averagePositionRank: 4,
      fortyYardDash: 4.49,
      rating: 84.5,
      playerImageUrl: 'https://www.nfldraftbuzz.com/Content/PlayerHeadShots/Justice-Haynes-RB-Alabama.png',
      collegeLogoUrl: 'https://www.nfldraftbuzz.com/Content/collmascots/michigan-wolverines.png',
    });
  });

  it('matches prospects by name, position, draft year, and college', () => {
    const lookup = buildProspectLookup(parseNflDraftBuzzMarkdown(SAMPLE_MARKDOWN, 2027, 'https://example.com'));
    const profile = findProspectProfile(lookup, 'Ryan Williams', 'WR', 'Alabama', 2027);

    expect(profile?.positionRank).toBe(1);
    expect(profile?.fortyYardDash).toBe(4.38);
  });

  it('normalizes ESPN college athlete profiles for local enrichment', () => {
    const profile = normalizeEspnAthleteProfile({
      athlete: {
        id: '5141517',
        displayName: 'Bo Jackson',
        displayHeight: '6\' 0"',
        displayWeight: '217 lbs',
        displayJersey: '#25',
        displayExperience: 'Freshman',
        displayBirthPlace: 'Cleveland, OH',
        college: { name: 'Ohio State' },
        headshot: { href: 'https://a.espncdn.com/i/headshots/college-football/players/full/5141517.png' },
        position: { abbreviation: 'RB' },
        status: { name: 'Active' },
        team: {
          logos: [
            { href: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png', rel: ['default'] },
          ],
        },
        links: [
          {
            href: 'https://www.espn.com/college-football/player/_/id/5141517/bo-jackson',
            rel: ['playercard'],
          },
        ],
      },
    }, 2028);

    expect(profile).toMatchObject({
      source: 'ESPN',
      sourceUrl: 'https://www.espn.com/college-football/player/_/id/5141517/bo-jackson',
      espnId: '5141517',
      draftYear: 2028,
      name: 'Bo Jackson',
      position: 'RB',
      role: 'RB',
      classYear: 'Freshman',
      jersey: '#25',
      status: 'Active',
      birthPlace: 'Cleveland, OH',
      college: 'Ohio State',
      playerImageUrl: 'https://a.espncdn.com/i/headshots/college-football/players/full/5141517.png',
      collegeLogoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
      height: '6-0',
      weight: '217lbs',
    });
  });

  it('only schedules monthly prospect snapshots on the first at the configured hour', () => {
    expect(shouldRunMonthlyProspectSnapshot(new Date('2026-06-01T14:00:00Z'), 7)).toBe(true);
    expect(shouldRunMonthlyProspectSnapshot(new Date('2026-06-02T14:00:00Z'), 7)).toBe(false);
  });

  it('tracks historical DraftBuzz classes plus future rookie pipeline years', () => {
    expect(getProspectYears(new Date('2026-05-08T00:00:00Z'))).toEqual([
      2021,
      2022,
      2023,
      2024,
      2025,
      2026,
      2027,
      2028,
    ]);
  });
});
