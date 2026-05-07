import { describe, expect, it } from 'vitest';
import {
  buildProspectLookup,
  findProspectProfile,
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

![Image 43: Ohio State Mascot](https://www.nfldraftbuzz.com/Content/collmascots/ohio-state-buckeyes.png)

[![Image 44: Jeremiah Smith Profile Picture](https://www.nfldraftbuzz.com/Content/PlayerHeadShots/Jeremiah-Smith-WR-OhioState.png)](https://www.nfldraftbuzz.com/Player/Jeremiah-Smith-WR-OhioState)

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
    });
  });

  it('matches prospects by name, position, draft year, and college', () => {
    const lookup = buildProspectLookup(parseNflDraftBuzzMarkdown(SAMPLE_MARKDOWN, 2027, 'https://example.com'));
    const profile = findProspectProfile(lookup, 'Ryan Williams', 'WR', 'Alabama', 2027);

    expect(profile?.positionRank).toBe(1);
    expect(profile?.fortyYardDash).toBe(4.38);
  });

  it('only schedules monthly prospect snapshots on the first at the configured hour', () => {
    expect(shouldRunMonthlyProspectSnapshot(new Date('2026-06-01T14:00:00Z'), 7)).toBe(true);
    expect(shouldRunMonthlyProspectSnapshot(new Date('2026-06-02T14:00:00Z'), 7)).toBe(false);
  });
});
