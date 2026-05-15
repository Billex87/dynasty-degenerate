import { normalizeLeagueValueMode, type LeagueValueMode } from './leagueValueMode';
import type { PlayerDetails } from '@shared/types';

type ValueProfile = NonNullable<PlayerDetails['valueProfile']>;

export type PlayerValueConfidenceTone = 'danger' | 'warn' | 'info' | 'good';

export type PlayerValueSourceTrace = {
  key: keyof ValueProfile;
  label: string;
  value: number;
  primary: boolean;
};

export type PlayerValueConfidence = {
  score: number;
  label: string;
  tone: PlayerValueConfidenceTone;
  sourceCount: number;
  primarySourceCount: number;
  spreadPct: number | null;
  sources: PlayerValueSourceTrace[];
  primarySources: PlayerValueSourceTrace[];
  note: string;
};

type SourceValue = {
  key: keyof ValueProfile;
  label: string;
  value?: number | null;
  primary: boolean;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function numericValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getTone(score: number): PlayerValueConfidenceTone {
  if (score >= 78) return 'good';
  if (score >= 62) return 'info';
  if (score >= 46) return 'warn';
  return 'danger';
}

function getLabel(score: number): string {
  if (score >= 78) return 'Strong';
  if (score >= 62) return 'Building';
  if (score >= 46) return 'Thin';
  return 'Low';
}

function getSourceValues(valueProfile: ValueProfile, mode: LeagueValueMode): SourceValue[] {
  const normalizedMode = normalizeLeagueValueMode(mode);

  if (normalizedMode === 'redraft') {
    return [
      { key: 'seasonValue', label: 'Season blend', value: valueProfile.seasonValue, primary: true },
      { key: 'fantasyProsSeasonValue', label: 'FantasyPros season', value: valueProfile.fantasyProsSeasonValue, primary: true },
      { key: 'fantasyCalcRedraft', label: 'FantasyCalc redraft', value: valueProfile.fantasyCalcRedraft, primary: true },
      { key: 'fantasyCalcDynasty', label: 'FantasyCalc dynasty', value: valueProfile.fantasyCalcDynasty, primary: false },
    ];
  }

  return [
    { key: 'dynastyValue', label: 'Dynasty blend', value: valueProfile.dynastyValue, primary: true },
    { key: 'marketKtc', label: 'KTC market', value: valueProfile.marketKtc, primary: true },
    { key: 'flockFantasy', label: 'Flock Fantasy', value: valueProfile.flockFantasy, primary: true },
    { key: 'fantasyProsDynasty', label: 'FantasyPros dynasty', value: valueProfile.fantasyProsDynasty, primary: true },
    { key: 'fantasyCalcDynasty', label: 'FantasyCalc dynasty', value: valueProfile.fantasyCalcDynasty, primary: true },
    { key: 'dynastyProcess', label: 'DynastyProcess', value: valueProfile.dynastyProcess, primary: true },
    { key: 'dynastyNerds', label: 'Dynasty Nerds', value: valueProfile.dynastyNerds, primary: true },
    { key: 'fantasyNerds', label: 'Fantasy Nerds', value: valueProfile.fantasyNerds, primary: true },
    { key: 'dynastyDealerBenchmark', label: 'Dynasty Dealer', value: valueProfile.dynastyDealerBenchmark, primary: false },
    { key: 'fantasyProsSeasonValue', label: 'FantasyPros season', value: valueProfile.fantasyProsSeasonValue, primary: false },
  ];
}

function calculateSpreadPct(values: number[]): number | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!Number.isFinite(average) || average <= 0) return null;
  return (max - min) / average;
}

function formatSpread(spreadPct: number | null): string {
  if (spreadPct === null) return 'single-source read';
  return `${Math.round(spreadPct * 100)}% source spread`;
}

export function getPlayerValueConfidence(input: {
  valueProfile?: PlayerDetails['valueProfile'] | null;
  mode?: LeagueValueMode | null;
}): PlayerValueConfidence {
  const mode = normalizeLeagueValueMode(input.mode || 'dynasty');
  const valueProfile = input.valueProfile || null;
  if (!valueProfile) {
    return {
      score: 34,
      label: 'Low',
      tone: 'danger',
      sourceCount: 0,
      primarySourceCount: 0,
      spreadPct: null,
      sources: [],
      primarySources: [],
      note: 'No value profile is attached to this player yet, so the read should stay conservative.',
    };
  }

  const sourceValues = getSourceValues(valueProfile, mode)
    .map((source) => ({ ...source, value: numericValue(source.value) }))
    .filter((source): source is PlayerValueSourceTrace => source.value !== null);
  const primarySources = sourceValues.filter((source) => source.primary);
  const sourceCount = sourceValues.length;
  const primarySourceCount = primarySources.length;
  const primaryValues = primarySources.map((source) => source.value);
  const spreadPct = calculateSpreadPct(primaryValues);
  const spreadPenalty = spreadPct === null
    ? 12
    : spreadPct > 0.55
      ? 24
      : spreadPct > 0.38
        ? 17
        : spreadPct > 0.24
          ? 9
          : spreadPct > 0.14
            ? 4
            : 0;
  const rankBonus = mode === 'redraft'
    ? valueProfile.seasonPositionRank || valueProfile.fantasyProsPositionRank ? 8 : 0
    : valueProfile.dynastyPositionRank || valueProfile.balancedPositionRank ? 8 : 0;
  const namedSourceBonus = Math.min(8, (valueProfile.sources?.length || 0) * 2);
  const singleSourcePenalty = primarySourceCount <= 1 ? 10 : 0;
  const score = clampScore(
    36
    + Math.min(34, primarySourceCount * 11)
    + Math.min(10, Math.max(0, sourceCount - primarySourceCount) * 4)
    + rankBonus
    + namedSourceBonus
    - spreadPenalty
    - singleSourcePenalty,
  );
  const label = getLabel(score);
  const topSources = primarySources.slice(0, 4).map((source) => source.label).join(', ');
  const sourceLabel = primarySourceCount === 1 ? 'primary source' : 'primary sources';

  return {
    score,
    label,
    tone: getTone(score),
    sourceCount,
    primarySourceCount,
    spreadPct,
    sources: sourceValues,
    primarySources,
    note: `${label} value confidence from ${primarySourceCount} ${sourceLabel}${topSources ? ` (${topSources})` : ''}; ${formatSpread(spreadPct)}.`,
  };
}
