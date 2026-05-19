import { describe, expect, it } from 'vitest';
import { getCurrentRankingSeason } from './rankingSeason';

describe('ranking season defaults', () => {
  it('does not default live ranking sources behind 2026', () => {
    expect(getCurrentRankingSeason(new Date('2025-12-15T00:00:00.000Z'), {})).toBe('2026');
  });

  it('uses an explicit ranking season override when configured', () => {
    expect(getCurrentRankingSeason(new Date('2026-05-19T00:00:00.000Z'), {
      RANKINGS_SEASON: '2027',
    })).toBe('2027');
  });
});
