import rookieValues2025 from './rookie-values/2025RookieValues.json' assert { type: 'json' };
import rookieValues2026 from './rookie-values/2026RookieValues.json' assert { type: 'json' };

export type RookieValueRecord = {
  name: string;
  ktc_value: number;
  position_rank?: string;
  position_rank_may2025?: string;
  [key: string]: unknown;
};

export type RookieValueMap = Record<string, RookieValueRecord>;

export type RookieValueBaseline = {
  label: string;
  capturedAt: string;
  values: RookieValueMap;
};

const rookieValueBaselines: Record<string, RookieValueBaseline> = {
  '2025': {
    label: '2025 Rookie Historical Blend',
    capturedAt: 'May 2025',
    values: rookieValues2025 as RookieValueMap,
  },
  '2026': {
    label: '2026 Rookie Production Blend',
    capturedAt: '2026-04-29T20:13:16.208Z',
    values: rookieValues2026 as RookieValueMap,
  },
};

export function getRookieValueBaseline(year: string): RookieValueMap | undefined {
  return rookieValueBaselines[year]?.values;
}

export function getRookieValueBaselines(): Record<string, RookieValueMap> {
  return Object.fromEntries(
    Object.entries(rookieValueBaselines).map(([year, baseline]) => [year, baseline.values])
  );
}

export function getRookieValueBaselineLabel(year: string): string | undefined {
  return rookieValueBaselines[year]?.label;
}
