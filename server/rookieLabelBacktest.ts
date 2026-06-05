import { fileURLToPath } from 'url';
import { getRookieValueBaselineLabel, getRookieValueBaselineMetadata, getRookieValueBaselines, type RookieValueMap, type RookieValueRecord } from './rookieValueBaselines';
import { listLocalKtcSnapshotDateKeysSince, loadLocalKtcSnapshotForDate } from './ktcLoader';
import { cleanName, playerNameKeyVariants } from './leagueAnalysis';
import { buildProspectLookup, findProspectProfile, loadProspectContext } from './prospectSource';
import type { ProspectProfile } from '../shared/types';

type SnapshotValue = RookieValueRecord & {
  dynasty_value?: number;
  true_value?: number;
  redraft_value?: number;
  market_value_ktc?: number;
  fantasypros_position_rank?: string | null;
  dynastynerds_position_rank?: string | null;
  value_sources?: string[];
  benchmark_sources?: string[];
};

type SnapshotValues = Record<string, SnapshotValue>;

type SnapshotLookupEntry = {
  playerKey: string;
  row: SnapshotValue;
  score: number;
};

export type RookieBacktestOutcome =
  | 'confirmed-riser'
  | 'confirmed-faller'
  | 'watch-riser'
  | 'watch-faller'
  | 'low-denominator-watch'
  | 'stable-hold';

export type RookieBacktestReason =
  | 'large-positive-move'
  | 'large-negative-move'
  | 'mild-positive-move'
  | 'mild-negative-move'
  | 'low-baseline-denominator'
  | 'thin-source-coverage'
  | 'source-set-changed';

export type RookieBacktestClassification = {
  outcome: RookieBacktestOutcome;
  direction: 'up' | 'down' | 'flat';
  confidence: 'high' | 'medium' | 'low';
  reasons: RookieBacktestReason[];
  tradeReadoutGuardrail: string;
};

export type RookieBacktestRow = RookieBacktestClassification & {
  year: string;
  playerKey: string;
  matchedCurrentKey: string;
  name: string;
  baselineValue: number;
  currentValue: number;
  diff: number;
  pctChange: number;
  baselinePositionRank: string | null;
  currentPositionRank: string | null;
  baselineSources: string[];
  currentSources: string[];
  prospectDraftYear: number | null;
  prospectRank: number | null;
  prospectPositionRank: number | null;
};

export type RookieBacktestYearSummary = {
  year: string;
  baselineLabel: string | null;
  baselineCapturedAt: string | null;
  currentDateKey: string | null;
  baselinePlayers: number;
  filteredBaselinePlayers: number;
  comparedPlayers: number;
  unmatchedPlayers: number;
  outcomeCounts: Record<RookieBacktestOutcome, number>;
  topRisers: RookieBacktestRow[];
  topFallers: RookieBacktestRow[];
  cautionRows: RookieBacktestRow[];
  notes: string[];
};

export type RookieLabelBacktestSummary = {
  sourceMode: 'local';
  currentDateKey: string | null;
  valueProfileKey: string | null;
  years: RookieBacktestYearSummary[];
  calibrationNotes: string[];
  tradeReadoutGuidance: {
    updatesExistingTradeReadouts: false;
    nextIntegration: string[];
  };
};

type BuildRowsInput = {
  year: string;
  baselineValues: RookieValueMap;
  currentValues: SnapshotValues;
  prospectProfiles?: ProspectProfile[];
  filterToDraftYear?: number | null;
};

type BuildSummaryInput = {
  years?: string[];
  currentDateKey?: string | null;
  valueProfileKey?: string | null;
  limit?: number;
  now?: Date;
};

const OUTCOMES: RookieBacktestOutcome[] = [
  'confirmed-riser',
  'confirmed-faller',
  'watch-riser',
  'watch-faller',
  'low-denominator-watch',
  'stable-hold',
];

export function classifyRookieBacktestOutcome(input: {
  baselineValue: number;
  currentValue: number;
  baselineSources?: string[];
  currentSources?: string[];
}): RookieBacktestClassification {
  const diff = input.currentValue - input.baselineValue;
  const pctChange = input.baselineValue > 0 ? (diff / input.baselineValue) * 100 : 0;
  const baselineSources = normalizeSources(input.baselineSources);
  const currentSources = normalizeSources(input.currentSources);
  const sourceSetChanged = baselineSources.join('|') !== currentSources.join('|');
  const thinSourceCoverage = Math.min(baselineSources.length, currentSources.length) < 2;
  const reasons: RookieBacktestReason[] = [];

  if (input.baselineValue < 650 && Math.abs(diff) >= 300) reasons.push('low-baseline-denominator');
  if (diff >= 750 && pctChange >= 15) reasons.push('large-positive-move');
  if (diff <= -650 && pctChange <= -15) reasons.push('large-negative-move');
  if (diff >= 350 && pctChange >= 10 && !reasons.includes('large-positive-move')) reasons.push('mild-positive-move');
  if (diff <= -350 && pctChange <= -10 && !reasons.includes('large-negative-move')) reasons.push('mild-negative-move');
  if (thinSourceCoverage) reasons.push('thin-source-coverage');
  if (sourceSetChanged && Math.abs(diff) >= 250) reasons.push('source-set-changed');

  const loudMove = reasons.includes('large-positive-move') || reasons.includes('large-negative-move');
  const denominatorCaution = reasons.includes('low-baseline-denominator');
  const direction = diff >= 250 ? 'up' : diff <= -250 ? 'down' : 'flat';

  let outcome: RookieBacktestOutcome = 'stable-hold';
  if (denominatorCaution) {
    outcome = 'low-denominator-watch';
  } else if (reasons.includes('large-positive-move')) {
    outcome = 'confirmed-riser';
  } else if (reasons.includes('large-negative-move')) {
    outcome = 'confirmed-faller';
  } else if (reasons.includes('mild-positive-move')) {
    outcome = 'watch-riser';
  } else if (reasons.includes('mild-negative-move')) {
    outcome = 'watch-faller';
  }

  const confidence = loudMove && !thinSourceCoverage && !denominatorCaution
    ? 'high'
    : (reasons.includes('mild-positive-move') || reasons.includes('mild-negative-move')) && !denominatorCaution
    ? 'medium'
    : 'low';

  return {
    outcome,
    direction,
    confidence,
    reasons,
    tradeReadoutGuardrail: buildTradeGuardrail(outcome, confidence),
  };
}

export function buildRookieBacktestRows(input: BuildRowsInput): {
  baselinePlayers: number;
  filteredBaselinePlayers: number;
  comparedPlayers: number;
  unmatchedPlayers: number;
  rows: RookieBacktestRow[];
} {
  const currentLookup = buildSnapshotLookup(input.currentValues);
  const prospectLookup = buildProspectLookup(input.prospectProfiles || []);
  const hasDraftYearFilter = Number.isFinite(input.filterToDraftYear || NaN);
  const rows: RookieBacktestRow[] = [];
  let filteredBaselinePlayers = 0;
  let unmatchedPlayers = 0;

  for (const [playerKey, baselineRow] of Object.entries(input.baselineValues)) {
    const prospect = findProspectProfile(prospectLookup, baselineRow.name || playerKey, getPositionFromRank(getPositionRank(baselineRow)), null, input.filterToDraftYear || null)
      || findProspectProfile(prospectLookup, baselineRow.name || playerKey, getPositionFromRank(getPositionRank(baselineRow)), null, null);

    if (hasDraftYearFilter && prospect?.draftYear !== input.filterToDraftYear) continue;
    filteredBaselinePlayers += 1;

    const current = findSnapshotMatch(currentLookup, playerKey, baselineRow);
    if (!current) {
      unmatchedPlayers += 1;
      continue;
    }

    const baselineValue = getPrimaryValue(baselineRow);
    const currentValue = getPrimaryValue(current.row);
    if (baselineValue === null || currentValue === null || baselineValue <= 0 || currentValue <= 0) {
      unmatchedPlayers += 1;
      continue;
    }

    const baselineSources = normalizeSources(getSources(baselineRow));
    const currentSources = normalizeSources(current.row.value_sources);
    const classification = classifyRookieBacktestOutcome({
      baselineValue,
      currentValue,
      baselineSources,
      currentSources,
    });
    const diff = currentValue - baselineValue;
    const pctChange = Math.round((diff / baselineValue) * 1000) / 10;

    rows.push({
      ...classification,
      year: input.year,
      playerKey,
      matchedCurrentKey: current.playerKey,
      name: current.row.name || baselineRow.name || playerKey,
      baselineValue,
      currentValue,
      diff,
      pctChange,
      baselinePositionRank: getPositionRank(baselineRow),
      currentPositionRank: getPositionRank(current.row),
      baselineSources,
      currentSources,
      prospectDraftYear: prospect?.draftYear ?? null,
      prospectRank: prospect?.averageOverallRank ?? prospect?.overallRank ?? null,
      prospectPositionRank: prospect?.averagePositionRank ?? prospect?.positionRank ?? null,
    });
  }

  rows.sort((a, b) => (
    Math.abs(b.diff) - Math.abs(a.diff)
    || Math.abs(b.pctChange) - Math.abs(a.pctChange)
    || a.name.localeCompare(b.name)
  ));

  return {
    baselinePlayers: Object.keys(input.baselineValues).length,
    filteredBaselinePlayers,
    comparedPlayers: rows.length,
    unmatchedPlayers,
    rows,
  };
}

export async function buildRookieLabelBacktestSummary(input: BuildSummaryInput = {}): Promise<RookieLabelBacktestSummary> {
  const valueProfileKey = input.valueProfileKey || null;
  const limit = Math.max(1, Math.min(50, Math.floor(input.limit ?? 12)));
  const dateKeys = listLocalKtcSnapshotDateKeysSince(new Date('2000-01-01'));
  const todayKey = toDateKey(input.now || new Date());
  const currentDateKey = input.currentDateKey || latestOnOrBefore(dateKeys, todayKey);
  const currentValues = currentDateKey
    ? loadLocalKtcSnapshotForDate(currentDateKey, valueProfileKey || undefined) as SnapshotValues
    : {};
  const baselines = getRookieValueBaselines();
  const selectedYears = (input.years?.length ? input.years : Object.keys(baselines)).filter(year => baselines[year]);
  const prospectContext = await loadProspectContext();

  const years = selectedYears.map((year): RookieBacktestYearSummary => {
    const filterToDraftYear = year === '2026' ? 2026 : null;
    const result = buildRookieBacktestRows({
      year,
      baselineValues: baselines[year],
      currentValues,
      prospectProfiles: prospectContext.profiles,
      filterToDraftYear,
    });
    const rowsByRise = [...result.rows].sort((a, b) => b.diff - a.diff || b.pctChange - a.pctChange);
    const rowsByFall = [...result.rows].sort((a, b) => a.diff - b.diff || a.pctChange - b.pctChange);
    const metadata = getRookieValueBaselineMetadata(year);

    return {
      year,
      baselineLabel: getRookieValueBaselineLabel(year) || null,
      baselineCapturedAt: metadata?.capturedAt || null,
      currentDateKey,
      baselinePlayers: result.baselinePlayers,
      filteredBaselinePlayers: result.filteredBaselinePlayers,
      comparedPlayers: result.comparedPlayers,
      unmatchedPlayers: result.unmatchedPlayers,
      outcomeCounts: countOutcomes(result.rows),
      topRisers: rowsByRise.filter(row => row.diff > 0).slice(0, limit),
      topFallers: rowsByFall.filter(row => row.diff < 0).slice(0, limit),
      cautionRows: result.rows.filter(row => (
        row.outcome === 'low-denominator-watch'
        || row.reasons.includes('thin-source-coverage')
        || row.reasons.includes('source-set-changed')
      )).slice(0, limit),
      notes: buildYearNotes(year, filterToDraftYear, result),
    };
  });

  return {
    sourceMode: 'local',
    currentDateKey,
    valueProfileKey,
    years,
    calibrationNotes: [
      'Strong riser labels require both a meaningful absolute move and a meaningful percentage move so cheap players do not become automatic breakout calls.',
      'Low baseline values are downgraded into watch labels even when the percentage move is large.',
      'This pass calibrates value movement only. Historical roster-room, coaching, and depth-chart context should be wired before using these labels as hard trade recommendations.',
    ],
    tradeReadoutGuidance: {
      updatesExistingTradeReadouts: false,
      nextIntegration: [
        'Use confirmed-riser rows to warn when a trade is selling a player whose value move has already validated.',
        'Use confirmed-faller rows to cap confidence on buy-low language until situation evidence supports the rebound.',
        'Use low-denominator-watch rows as curiosity flags, not automatic add-ons to make a trade even.',
      ],
    },
  };
}

function buildSnapshotLookup(values: SnapshotValues): Map<string, SnapshotLookupEntry> {
  const lookup = new Map<string, SnapshotLookupEntry>();
  for (const [playerKey, row] of Object.entries(values)) {
    const primaryValue = getPrimaryValue(row) || 0;
    const score = normalizeSources(row.value_sources).length * 100000 + primaryValue;
    for (const variant of getLookupVariants(playerKey, row)) {
      const current = lookup.get(variant);
      if (!current || score > current.score) {
        lookup.set(variant, { playerKey, row, score });
      }
    }
  }
  return lookup;
}

function findSnapshotMatch(lookup: Map<string, SnapshotLookupEntry>, playerKey: string, row: RookieValueRecord): SnapshotLookupEntry | null {
  for (const variant of getLookupVariants(playerKey, row)) {
    const match = lookup.get(variant);
    if (match) return match;
  }
  return null;
}

function getLookupVariants(playerKey: string, row: Pick<RookieValueRecord, 'name'>): string[] {
  const values = [row.name || '', playerKey]
    .flatMap(value => playerNameKeyVariants(value))
    .map(cleanName)
    .filter(Boolean);
  return Array.from(new Set(values));
}

function countOutcomes(rows: RookieBacktestRow[]): Record<RookieBacktestOutcome, number> {
  const counts = Object.fromEntries(OUTCOMES.map(outcome => [outcome, 0])) as Record<RookieBacktestOutcome, number>;
  for (const row of rows) counts[row.outcome] += 1;
  return counts;
}

function buildYearNotes(year: string, filterToDraftYear: number | null, result: { baselinePlayers: number; filteredBaselinePlayers: number; unmatchedPlayers: number }): string[] {
  const notes: string[] = [];
  if (filterToDraftYear) {
    notes.push(`${year} baseline was filtered from ${result.baselinePlayers} blended rows to ${result.filteredBaselinePlayers} players with ${filterToDraftYear} prospect context.`);
  }
  if (result.unmatchedPlayers) {
    notes.push(`${result.unmatchedPlayers} baseline players did not have a usable current value match.`);
  }
  if (year === '2025') {
    notes.push('2025 is the cleanest backtest window because the baseline is a rookie-only draft-window snapshot.');
  }
  return notes;
}

function buildTradeGuardrail(outcome: RookieBacktestOutcome, confidence: RookieBacktestClassification['confidence']): string {
  if (outcome === 'confirmed-riser' && confidence === 'high') {
    return 'Safe to mention as a validated riser signal in trade copy.';
  }
  if (outcome === 'confirmed-faller' && confidence === 'high') {
    return 'Safe to mention as a validated faller signal in trade copy.';
  }
  if (outcome === 'low-denominator-watch') {
    return 'Downgrade to watch-list language; do not use as a trade-balancing demand by itself.';
  }
  if (outcome === 'watch-riser' || outcome === 'watch-faller') {
    return 'Use as a soft supporting note only when situation evidence agrees.';
  }
  return 'Keep trade copy neutral unless roster-room or usage evidence adds conviction.';
}

function getPrimaryValue(row: Partial<SnapshotValue>): number | null {
  return positive(row.dynasty_value)
    ?? positive(row.true_value)
    ?? positive(row.ktc_value)
    ?? positive(row.market_value_ktc)
    ?? positive(row.redraft_value)
    ?? null;
}

function getPositionRank(row: Partial<SnapshotValue>): string | null {
  const value = row.position_rank
    || row.position_rank_may2025
    || row.fantasypros_position_rank
    || row.dynastynerds_position_rank
    || null;
  return value ? String(value) : null;
}

function getPositionFromRank(rank: string | null): string | null {
  return rank?.match(/^[A-Z]+/)?.[0] || null;
}

function normalizeSources(sources?: string[] | null): string[] {
  return Array.from(new Set((sources || []).map(source => String(source).trim()).filter(Boolean))).sort();
}

function getSources(row: Partial<SnapshotValue>): string[] {
  return Array.isArray(row.value_sources) ? row.value_sources : [];
}

function positive(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function latestOnOrBefore(dateKeys: string[], maxDateKey: string): string | null {
  return [...dateKeys].filter(dateKey => dateKey <= maxDateKey).sort().pop() || null;
}

function toDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function printCliSummary(summary: RookieLabelBacktestSummary) {
  console.log(`Rookie label backtest (${summary.sourceMode})`);
  console.log(`Current snapshot: ${summary.currentDateKey || 'none'} | profile: ${summary.valueProfileKey || 'default'}`);
  for (const year of summary.years) {
    console.log(`\n${year.year} - ${year.baselineLabel || 'Rookie baseline'}`);
    console.log(`Baseline rows: ${year.baselinePlayers} | filtered: ${year.filteredBaselinePlayers} | compared: ${year.comparedPlayers} | unmatched: ${year.unmatchedPlayers}`);
    console.log(`Outcomes: ${OUTCOMES.map(outcome => `${outcome}=${year.outcomeCounts[outcome]}`).join(', ')}`);
    if (year.notes.length) console.log(`Notes: ${year.notes.join(' ')}`);
    console.log('Top risers:');
    for (const row of year.topRisers.slice(0, 8)) {
      console.log(`  ${row.name}: ${formatSigned(row.diff)} (${formatSigned(row.pctChange)}%) ${row.baselineValue} -> ${row.currentValue} [${row.outcome}, ${row.confidence}]`);
    }
    console.log('Top fallers:');
    for (const row of year.topFallers.slice(0, 8)) {
      console.log(`  ${row.name}: ${formatSigned(row.diff)} (${formatSigned(row.pctChange)}%) ${row.baselineValue} -> ${row.currentValue} [${row.outcome}, ${row.confidence}]`);
    }
  }
  console.log('\nTrade readout guidance: existing readouts are not rewritten by this audit.');
  for (const item of summary.tradeReadoutGuidance.nextIntegration) console.log(`- ${item}`);
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  buildRookieLabelBacktestSummary({
    years: process.argv.slice(2).filter(arg => /^\d{4}$/.test(arg)),
  }).then(printCliSummary).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
