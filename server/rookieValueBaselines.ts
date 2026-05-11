import rookieBlendSnapshot2025 from './rookie-values/2025RookieBlendSnapshot.json' assert { type: 'json' };
import rookieValues2026 from './rookie-values/2026RookieValues.json' assert { type: 'json' };
import ktcSnapshot20260507 from './ktc-snapshots/ktc-snapshot-2026-05-07.json' assert { type: 'json' };

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
const rookie2026Snapshot = ktcSnapshot20260507 as { generatedAt?: string; values?: RookieValueMap };
const rookie2026Values = rookie2026Snapshot.values || (rookieValues2026 as RookieValueMap);

const rookieValueBaselines: Record<string, RookieValueBaseline> = {
  '2025': {
    ...rookie2025Snapshot,
    values: rookie2025Snapshot.values,
  },
  '2026': {
    label: '2026 Rookie Stabilized Blend',
    capturedAt: rookie2026Snapshot.generatedAt || '2026-05-07T18:43:15.538Z',
    comparisonMode: 'value-to-value',
    notes: 'Locked to the first stabilized May 2026 multi-source blend so early rookie-draft movement is not measured against the thinner April production blend.',
    sourceCoverage: [
      { source: 'Flock Fantasy', status: 'included', capturedAt: '2026-05-07', field: 'expert_value_flock' },
      { source: 'Dynasty Nerds', status: 'included', capturedAt: '2026-05-07', field: 'expert_value_dynastynerds' },
      { source: 'KTC', status: 'included', capturedAt: '2026-05-07', field: 'market_value_ktc' },
      { source: 'FantasyCalc', status: 'included', capturedAt: '2026-05-07', field: 'market_value_fantasycalc' },
      { source: 'DynastyProcess', status: 'included', capturedAt: '2026-05-07', field: 'expert_value_dynastyprocess' },
      { source: 'Dynasty Dealer', status: 'benchmark', capturedAt: '2026-05-07', field: 'benchmark_value_dynastydealer' },
    ],
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
