export type DynastySourceWeightKey =
  | 'flock'
  | 'dynastyNerds'
  | 'ktc'
  | 'fantasyCalc'
  | 'dynastyProcess';

export type DynastyRankingBoard = 'dynasty' | 'devy';

export interface DynastySourceWeights {
  flock: number;
  dynastyNerds: number;
  ktc: number;
  fantasyCalc: number;
  dynastyProcess: number;
}

export interface DynastySourceWeightOptions {
  board?: DynastyRankingBoard;
  numQbs?: number;
  ppr?: number;
  tep?: number;
}

export interface DynastySourceWeightEntry {
  key: DynastySourceWeightKey;
  source: string;
  weight: number;
  percent: number;
  note: string;
}

const SOURCE_LABELS: Record<DynastySourceWeightKey, string> = {
  flock: 'Flock Fantasy',
  dynastyNerds: 'Dynasty Nerds',
  ktc: 'KTC',
  fantasyCalc: 'FantasyCalc',
  dynastyProcess: 'DynastyProcess',
};

function normalizeNumQbs(numQbs?: number): 1 | 2 {
  return numQbs && numQbs >= 2 ? 2 : 1;
}

function normalizePpr(ppr?: number): 0 | 0.5 | 1 {
  const value = Number(ppr ?? 1);
  if (value <= 0.25) return 0;
  if (value < 0.75) return 0.5;
  return 1;
}

function normalizeTep(tep?: number): 0 | 0.5 | 1 | 1.5 {
  const value = Number(tep ?? 0);
  if (value >= 1.25) return 1.5;
  if (value >= 0.75) return 1;
  if (value >= 0.25) return 0.5;
  return 0;
}

export function getDynastySourceWeights(options: DynastySourceWeightOptions = {}): DynastySourceWeights {
  const board = options.board || 'dynasty';
  const numQbs = normalizeNumQbs(options.numQbs);
  const ppr = normalizePpr(options.ppr);
  const tep = normalizeTep(options.tep);
  const isSuperflex = numQbs === 2;
  const isStandard = ppr === 0;
  const isTep = tep > 0;

  if (board === 'devy') {
    return {
      flock: 0.45,
      ktc: 0.35,
      dynastyNerds: 0.20,
      fantasyCalc: 0,
      dynastyProcess: 0,
    };
  }

  if (isSuperflex && isTep) {
    return {
      flock: 0.35,
      dynastyNerds: 0.30,
      ktc: 0.22,
      fantasyCalc: 0.10,
      dynastyProcess: 0.03,
    };
  }

  if (isSuperflex && isStandard) {
    return {
      flock: 0.36,
      dynastyNerds: 0.28,
      ktc: 0.16,
      fantasyCalc: 0.17,
      dynastyProcess: 0.03,
    };
  }

  if (isSuperflex) {
    return {
      flock: 0.40,
      dynastyNerds: 0.25,
      ktc: 0.20,
      fantasyCalc: 0.12,
      dynastyProcess: 0.03,
    };
  }

  if (isTep && isStandard) {
    return {
      flock: 0.30,
      dynastyNerds: 0.28,
      ktc: 0.29,
      fantasyCalc: 0.10,
      dynastyProcess: 0.03,
    };
  }

  if (isTep) {
    return {
      flock: 0.34,
      dynastyNerds: 0.24,
      ktc: 0.29,
      fantasyCalc: 0.10,
      dynastyProcess: 0.03,
    };
  }

  if (isStandard) {
    return {
      flock: 0.34,
      dynastyNerds: 0.30,
      ktc: 0.16,
      fantasyCalc: 0.17,
      dynastyProcess: 0.03,
    };
  }

  return {
    flock: 0.40,
    dynastyNerds: 0.27,
    ktc: 0.18,
    fantasyCalc: 0.12,
    dynastyProcess: 0.03,
  };
}

export function getDynastySourceWeightEntries(weights: DynastySourceWeights): DynastySourceWeightEntry[] {
  const notes: Record<DynastySourceWeightKey, string> = {
    flock: 'Primary dynasty/rookie rankings signal when available.',
    dynastyNerds: 'Format-aware expert/community support, including Standard, SF, and SF TEP buckets.',
    ktc: 'Market/liquidity signal. Useful, but kept below the ranking anchors to avoid crowd-noise whiplash.',
    fantasyCalc: 'Secondary market value support with team/QB/PPR format knobs.',
    dynastyProcess: 'Small stabilizer/fallback source because it is broad and public, but less current for our use case.',
  };

  return (Object.keys(SOURCE_LABELS) as DynastySourceWeightKey[]).map((key) => ({
    key,
    source: SOURCE_LABELS[key],
    weight: weights[key],
    percent: Math.round(weights[key] * 100),
    note: notes[key],
  }));
}

export function formatDynastySourceWeights(weights: DynastySourceWeights): string {
  return getDynastySourceWeightEntries(weights)
    .filter((entry) => entry.weight > 0)
    .map((entry) => `${entry.source} ${entry.percent}%`)
    .join(', ');
}

export function getDynastySourceWeightNotes(options: DynastySourceWeightOptions = {}): string[] {
  const board = options.board || 'dynasty';
  const weights = getDynastySourceWeights(options);
  const notes = [
    `Primary blend weights: ${formatDynastySourceWeights(weights)}.`,
    'FantasyPros is 0% of dynasty value/rankings. It remains a season/projection source for redraft and projected-lineup sections only.',
    'DynastyDealer is 0% of the primary blend for now. It stays benchmark-only until its endpoint is confirmed stable and usable.',
  ];

  if (board === 'devy') {
    notes.push('College rankings use only sources with devy/prospect coverage: Flock Fantasy, KTC devy, and Dynasty Nerds where present.');
  }

  return notes;
}
