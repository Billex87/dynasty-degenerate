export type DynastySourceWeightKey =
  | 'flock'
  | 'fantasyPros'
  | 'dynastyNerds'
  | 'fantasyNerds'
  | 'ktc'
  | 'fantasyCalc'
  | 'dynastyProcess';

export type DynastyRankingBoard = 'dynasty' | 'devy';

export interface DynastySourceWeights {
  flock: number;
  fantasyPros: number;
  dynastyNerds: number;
  fantasyNerds: number;
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
  baseWeight?: number | null;
  effectiveWeight?: number | null;
  trustScore?: number | null;
  trustMultiplier?: number | null;
}

export type DynastySourceWeightTrustMap = Partial<Record<DynastySourceWeightKey, {
  score?: number | null;
  multiplier?: number | null;
  baseWeight?: number | null;
  effectiveWeight?: number | null;
}>>;

const SOURCE_LABELS: Record<DynastySourceWeightKey, string> = {
  flock: 'Flock Fantasy',
  fantasyPros: 'FantasyPros Dynasty',
  dynastyNerds: 'Dynasty Nerds',
  fantasyNerds: 'Fantasy Nerds',
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
      fantasyPros: 0,
      ktc: 0.35,
      dynastyNerds: 0.20,
      fantasyNerds: 0,
      fantasyCalc: 0,
      dynastyProcess: 0,
    };
  }

  if (isSuperflex && isTep) {
    return {
      flock: 0.23,
      fantasyPros: 0.06,
      dynastyNerds: 0.27,
      fantasyNerds: 0.07,
      ktc: 0.19,
      fantasyCalc: 0.13,
      dynastyProcess: 0.05,
    };
  }

  if (isSuperflex && isStandard) {
    return {
      flock: 0.24,
      fantasyPros: 0.06,
      dynastyNerds: 0.23,
      fantasyNerds: 0.07,
      ktc: 0.18,
      fantasyCalc: 0.17,
      dynastyProcess: 0.05,
    };
  }

  if (isSuperflex) {
    return {
      flock: 0.25,
      fantasyPros: 0.06,
      dynastyNerds: 0.22,
      fantasyNerds: 0.07,
      ktc: 0.19,
      fantasyCalc: 0.16,
      dynastyProcess: 0.05,
    };
  }

  if (isTep && isStandard) {
    return {
      flock: 0.22,
      fantasyPros: 0.06,
      dynastyNerds: 0.25,
      fantasyNerds: 0.07,
      ktc: 0.24,
      fantasyCalc: 0.11,
      dynastyProcess: 0.05,
    };
  }

  if (isTep) {
    return {
      flock: 0.23,
      fantasyPros: 0.06,
      dynastyNerds: 0.23,
      fantasyNerds: 0.07,
      ktc: 0.24,
      fantasyCalc: 0.12,
      dynastyProcess: 0.05,
    };
  }

  if (isStandard) {
    return {
      flock: 0.23,
      fantasyPros: 0.06,
      dynastyNerds: 0.25,
      fantasyNerds: 0.07,
      ktc: 0.17,
      fantasyCalc: 0.17,
      dynastyProcess: 0.05,
    };
  }

  return {
    flock: 0.25,
    fantasyPros: 0.06,
    dynastyNerds: 0.23,
    fantasyNerds: 0.07,
    ktc: 0.19,
    fantasyCalc: 0.15,
    dynastyProcess: 0.05,
  };
}

export function getDynastySourceWeightEntries(
  weights: DynastySourceWeights,
  sourceTrust: DynastySourceWeightTrustMap = {},
): DynastySourceWeightEntry[] {
  const notes: Record<DynastySourceWeightKey, string> = {
    flock: 'Primary expert-ranking anchor when available; trimmed after the historical calibration so it does not overpower market movement.',
    fantasyPros: 'API-backed FantasyPros dynasty ECR support; reduced because historical error was higher and the public ranking type is not league-format specific.',
    dynastyNerds: 'Format-aware expert/community support, including PPR, 1QB, SF, and SF TEP buckets.',
    fantasyNerds: 'API-backed consensus dynasty ranking support; kept modest because the endpoint is not league-format specific.',
    ktc: 'Market/liquidity signal raised by the historical calibration, but still balanced against ranking anchors to avoid crowd-noise whiplash.',
    fantasyCalc: 'Secondary market value support with team/QB/PPR format knobs; raised because the archive gives it enough forward samples.',
    dynastyProcess: 'Small stabilizer/fallback source because it is broad and public, with a larger baseline after calibration.',
  };

  const effectiveWeights = (Object.keys(SOURCE_LABELS) as DynastySourceWeightKey[]).map((key) => (
    sourceTrust[key]?.effectiveWeight ?? weights[key]
  ));
  const totalEffectiveWeight = effectiveWeights.reduce((sum, weight) => sum + Math.max(0, weight), 0) || 1;

  return (Object.keys(SOURCE_LABELS) as DynastySourceWeightKey[]).map((key) => {
    const trust = sourceTrust[key] || null;
    const effectiveWeight = trust?.effectiveWeight ?? weights[key];
    const trustNote = trust?.score !== undefined && trust?.score !== null
      ? ` Adaptive trust ${trust.score}/100 (${Number(trust.multiplier ?? 1).toFixed(2)}x base weight).`
      : '';
    return {
      key,
      source: SOURCE_LABELS[key],
      weight: effectiveWeight,
      percent: Math.round((effectiveWeight / totalEffectiveWeight) * 100),
      note: `${notes[key]}${trustNote}`,
      baseWeight: trust?.baseWeight ?? weights[key],
      effectiveWeight,
      trustScore: trust?.score ?? null,
      trustMultiplier: trust?.multiplier ?? null,
    };
  });
}

export function formatDynastySourceWeights(
  weights: DynastySourceWeights,
  sourceTrust: DynastySourceWeightTrustMap = {},
): string {
  return getDynastySourceWeightEntries(weights, sourceTrust)
    .filter((entry) => entry.weight > 0)
    .map((entry) => `${entry.source} ${entry.percent}%`)
    .join(', ');
}

export function getDynastySourceWeightNotes(
  options: DynastySourceWeightOptions = {},
  sourceTrust: DynastySourceWeightTrustMap = {},
): string[] {
  const board = options.board || 'dynasty';
  const weights = getDynastySourceWeights(options);
  const notes = [
    `Primary blend weights: ${formatDynastySourceWeights(weights, sourceTrust)}.`,
    'FantasyPros Dynasty now participates in the dynasty blend as API-backed expert consensus, while FantasyPros Draft/ROS stays in redraft and projected-lineup context.',
    'DynastyDealer is 0% of the primary blend for now. It stays benchmark-only until its endpoint is confirmed stable and usable.',
  ];

  if (board === 'devy') {
    notes.push('College rankings use KTC Devy for market context, FantasyPros devy ECR for board order, and archived scouting data for context. Flock Fantasy is not part of devy because it does not publish a devy board. Scouting measurements and notes do not directly create market value.');
  }

  return notes;
}
