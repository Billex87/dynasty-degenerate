import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearRedraftValueTimelineCacheForTests, getRedraftValueTimelineForPlayer } from './redraftValueTimeline';

afterEach(() => {
  clearRedraftValueTimelineCacheForTests();
  vi.restoreAllMocks();
});

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

  it('bounds missing shard cache entries across changing shard directories', () => {
    const previousShardDir = process.env.REDRAFT_VALUE_HISTORY_SHARDS_DIR;
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'redraft-value-missing-shards-'));
    const existsSpy = vi.spyOn(fs, 'existsSync');

    try {
      const lookupFromDir = (index: number) => {
        const dir = path.join(tempRoot, `dir-${index}`);
        process.env.REDRAFT_VALUE_HISTORY_SHARDS_DIR = dir;
        return getRedraftValueTimelineForPlayer('A Missing Player');
      };

      lookupFromDir(0);
      for (let index = 1; index <= 128; index += 1) {
        lookupFromDir(index);
      }
      lookupFromDir(0);

      const firstShardPath = path.join(tempRoot, 'dir-0', 'a.json');
      const firstShardChecks = existsSpy.mock.calls
        .map(([target]) => String(target))
        .filter((target) => target === firstShardPath);
      expect(firstShardChecks).toHaveLength(2);
    } finally {
      process.env.REDRAFT_VALUE_HISTORY_SHARDS_DIR = previousShardDir;
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
