import rookieBlendSnapshot2025 from './rookie-values/2025RookieBlendSnapshot.json' assert { type: 'json' };
import rookieValues2026 from './rookie-values/2026RookieValues.json' assert { type: 'json' };

export type RookieValueRecord = {
  name: string;
  ktc_value: number;
  position_rank?: string;
  position_rank_may2025?: string;
  [key: string]: unknown;
};

export type RookieValueMap = Record<string, RookieValueRecord>;

export type RookieValueSourceCoverage = {
  source: string;
  status: string;
  capturedAt?: string;
  weight?: number;
  field?: string;
  url?: string;
  notes?: string;
};

export type RookieValueBaseline = {
  label: string;
  capturedAt: string;
  comparisonMode?: string;
  notes?: string;
  sourceCoverage?: RookieValueSourceCoverage[];
  values: RookieValueMap;
};

const rookie2025Snapshot = rookieBlendSnapshot2025 as RookieValueBaseline;

const rookieValueBaselines: Record<string, RookieValueBaseline> = {
  '2025': {
    ...rookie2025Snapshot,
    values: rookie2025Snapshot.values,
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

export function getRookieValueBaselineMetadata(year: string): Omit<RookieValueBaseline, 'values'> | undefined {
  const baseline = rookieValueBaselines[year];
  if (!baseline) return undefined;
  const { values: _values, ...metadata } = baseline;
  return metadata;
}
