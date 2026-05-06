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
