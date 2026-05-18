import { describe, expect, it } from 'vitest';
import { getRedraftValueTimelineForPlayer } from './redraftValueTimeline';

describe('getRedraftValueTimelineForPlayer', () => {
  it('loads redraft scopes from player shards', () => {
    const timeline = getRedraftValueTimelineForPlayer('Jaxon Smith-Njigba');

    expect(timeline?.source).toBe('redraft-value-history-shards');
    expect(timeline?.scopes.map((scope) => scope.key)).toEqual(['CURRENT', 'DRAFT', 'ADP', 'ROS']);
    expect(timeline?.scopes.find((scope) => scope.key === 'CURRENT')?.latest?.rank).toBe('WR3');
  });

  it('merges suffix-name history with current snapshot rows', () => {
    const timeline = getRedraftValueTimelineForPlayer('Aaron Jones');

    expect(timeline?.matchedName).toBe('Aaron Jones Sr.');
    expect(timeline?.scopes.find((scope) => scope.key === 'CURRENT')?.pointCount).toBeGreaterThan(0);
    expect(timeline?.scopes.find((scope) => scope.key === 'DRAFT')?.pointCount).toBeGreaterThan(0);
  });
});
