import { describe, expect, it, vi, afterEach } from 'vitest';
import { getDraftMarketMovementLabel, getDraftWindowLabel, isFreshRookieMarketRead } from './draftDisplay';

describe('draftDisplay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses user-facing value basis labels without exposing comparison dates', () => {
    expect(getDraftWindowLabel({
      draftKind: 'rookie',
      draftYear: '2026',
    }, 'dynasty')).toBe('Stabilized rookie baseline');

    expect(getDraftWindowLabel({
      draftKind: 'startup',
      draftValueDate: '2025-08-24',
      currentValueDate: '2028-08-24',
    }, 'dynasty')).toBe('Multi-year value window');

    expect(getDraftWindowLabel({
      draftKind: 'main',
      draftValueDate: '2026-08-24',
      currentValueDate: '2026-12-10',
    }, 'redraft')).toBe('Season value window');
  });

  it('labels current-year rookie movement as early market reads before the season window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T12:00:00-07:00'));

    expect(isFreshRookieMarketRead({
      draftKind: 'rookie',
      draftYear: '2026',
    }, 'dynasty')).toBe(true);

    expect(getDraftMarketMovementLabel({
      draftKind: 'rookie',
      draftYear: '2026',
      valueGain: 600,
      draftOutcome: 'neutral',
    }, 'dynasty')).toEqual({ label: 'Early Riser', tone: 'riser' });

    expect(getDraftMarketMovementLabel({
      draftKind: 'rookie',
      draftYear: '2026',
      valueGain: -600,
      draftOutcome: 'neutral',
    }, 'dynasty')).toEqual({ label: 'Early Faller', tone: 'faller' });
  });

  it('stops using early rookie labels once the season evaluation window opens', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00-07:00'));

    const pick = {
      draftKind: 'rookie' as const,
      draftYear: '2026',
      valueGain: 900,
      draftOutcome: 'neutral' as const,
    };

    expect(isFreshRookieMarketRead(pick, 'dynasty')).toBe(false);
    expect(getDraftMarketMovementLabel(pick, 'dynasty')).toBeNull();
  });
});
