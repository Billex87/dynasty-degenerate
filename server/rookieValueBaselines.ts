import rookieBlendSnapshot2025 from './rookie-values/2025RookieBlendSnapshot.json' assert { type: 'json' };
import rookieBlendSnapshot2026 from './rookie-values/2026RookieBlendSnapshot.json' assert { type: 'json' };
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

export type RookieDraftBaselinePolicy = {
  year: string;
  draftStartDate: string;
  draftEndDate: string;
  baselineDate: string;
  rule: string;
};

const ROOKIE_BASELINE_RULE = 'First Monday after NFL Draft weekend, then closest available archived value on or after that date when the exact date is missing.';

const rookieDraftBaselinePolicies: Record<string, RookieDraftBaselinePolicy> = {
  '2022': {
    year: '2022',
    draftStartDate: '2022-04-28',
    draftEndDate: '2022-04-30',
    baselineDate: '2022-05-02',
    rule: ROOKIE_BASELINE_RULE,
  },
  '2023': {
    year: '2023',
    draftStartDate: '2023-04-27',
    draftEndDate: '2023-04-29',
    baselineDate: '2023-05-01',
    rule: ROOKIE_BASELINE_RULE,
  },
  '2024': {
    year: '2024',
    draftStartDate: '2024-04-25',
    draftEndDate: '2024-04-27',
    baselineDate: '2024-04-29',
    rule: ROOKIE_BASELINE_RULE,
  },
  '2025': {
    year: '2025',
    draftStartDate: '2025-04-24',
    draftEndDate: '2025-04-26',
    baselineDate: '2025-04-28',
    rule: ROOKIE_BASELINE_RULE,
  },
  '2026': {
    year: '2026',
    draftStartDate: '2026-04-23',
    draftEndDate: '2026-04-25',
    baselineDate: '2026-04-27',
    rule: ROOKIE_BASELINE_RULE,
  },
};

const rookie2025Snapshot = rookieBlendSnapshot2025 as RookieValueBaseline;
const rookie2026Snapshot = rookieBlendSnapshot2026 as RookieValueBaseline;
const rookie2026Values = rookie2026Snapshot.values || (rookieValues2026 as RookieValueMap);

const rookieValueBaselines: Record<string, RookieValueBaseline> = {
  '2025': {
    ...rookie2025Snapshot,
    values: rookie2025Snapshot.values,
  },
  '2026': {
    ...rookie2026Snapshot,
    values: rookie2026Values,
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

export function getRookieDraftBaselinePolicy(year: string | number): RookieDraftBaselinePolicy | undefined {
  return rookieDraftBaselinePolicies[String(year)];
}

export function getRookieDraftBaselineDate(year: string | number): string | undefined {
  return getRookieDraftBaselinePolicy(year)?.baselineDate;
}

export function getRookieDraftBaselinePolicies(): Record<string, RookieDraftBaselinePolicy> {
  return { ...rookieDraftBaselinePolicies };
}
