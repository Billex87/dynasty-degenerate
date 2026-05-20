import type {
  MatchupWindowKey,
  MatchupWindowSet,
  MatchupWindowSummary,
  WaiverWeeklyEcrWeek,
} from './types';

const DEFAULT_SEASON_END_WEEK = 18;
const DEFAULT_PLAYOFF_WEEK_COUNT = 3;

type MatchupWindowOptions = {
  currentWeek?: number | null;
  playoffWeeks?: number[] | null;
  playoffWeekStart?: number | null;
  playoffWeekCount?: number;
  seasonEndWeek?: number;
};

export type ShortTermMatchupOutlook = {
  score: number;
  multiplier: number;
  isRoughStart: boolean;
  isStrongStart: boolean;
};

function finiteWeek(value?: number | string | null): number | null {
  const week = Number(value);
  if (!Number.isFinite(week)) return null;
  const rounded = Math.floor(week);
  return rounded > 0 ? rounded : null;
}

export function buildLeaguePlayoffWeeks(
  playoffWeekStart?: number | string | null,
  playoffWeekCount = DEFAULT_PLAYOFF_WEEK_COUNT,
  seasonEndWeek = DEFAULT_SEASON_END_WEEK
): number[] {
  const start = finiteWeek(playoffWeekStart);
  const count = Math.max(1, Math.floor(playoffWeekCount || DEFAULT_PLAYOFF_WEEK_COUNT));
  const end = Math.max(1, Math.floor(seasonEndWeek || DEFAULT_SEASON_END_WEEK));
  if (!start) return [];

  return Array.from({ length: count }, (_, index) => start + index)
    .filter((week) => week <= end);
}

function rangeFrom(start: number, count: number, seasonEndWeek: number): number[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => start + index)
    .filter((week) => week > 0 && week <= seasonEndWeek);
}

function normalizeWeekList(weeks: number[]): number[] {
  return Array.from(new Set(weeks.map(finiteWeek).filter((week): week is number => Boolean(week))))
    .sort((a, b) => a - b);
}

function starValue(week: WaiverWeeklyEcrWeek): number | null {
  if (typeof week.matchupStars === 'number' && Number.isFinite(week.matchupStars)) {
    return Math.max(1, Math.min(5, week.matchupStars));
  }
  if (typeof week.opponentRank === 'number' && Number.isFinite(week.opponentRank)) {
    const boundedRank = Math.max(1, Math.min(32, week.opponentRank));
    return 1 + ((32 - boundedRank) / 31) * 4;
  }
  return null;
}

function isEasyWeek(week: WaiverWeeklyEcrWeek): boolean {
  if (week.isBye) return false;
  return week.matchupTier === 'easy' || Number(week.matchupStars || 0) >= 4;
}

function isHardWeek(week: WaiverWeeklyEcrWeek): boolean {
  if (week.isBye) return false;
  return week.matchupTier === 'hard' || (typeof week.matchupStars === 'number' && week.matchupStars <= 2);
}

function bestByMatchup(a: WaiverWeeklyEcrWeek, b: WaiverWeeklyEcrWeek): WaiverWeeklyEcrWeek {
  const aStars = starValue(a) ?? 0;
  const bStars = starValue(b) ?? 0;
  if (aStars !== bStars) return aStars > bStars ? a : b;
  const aRank = a.opponentRank ?? Infinity;
  const bRank = b.opponentRank ?? Infinity;
  if (aRank !== bRank) return aRank < bRank ? a : b;
  return a.week <= b.week ? a : b;
}

function worstByMatchup(a: WaiverWeeklyEcrWeek, b: WaiverWeeklyEcrWeek): WaiverWeeklyEcrWeek {
  const aStars = starValue(a) ?? 6;
  const bStars = starValue(b) ?? 6;
  if (aStars !== bStars) return aStars < bStars ? a : b;
  const aRank = a.opponentRank ?? -Infinity;
  const bRank = b.opponentRank ?? -Infinity;
  if (aRank !== bRank) return aRank > bRank ? a : b;
  return a.week <= b.week ? a : b;
}

function formatWindowSummary(input: {
  label: string;
  averageStars: number | null;
  playableWeeks: number;
  easyWeeks: number;
  hardWeeks: number;
  byeWeeks: number;
}): string {
  if (!input.playableWeeks && input.byeWeeks) return `${input.label}: bye-only window.`;
  if (!input.playableWeeks) return `${input.label}: no matchup data.`;
  const parts = [
    `${input.easyWeeks} easy`,
    `${input.hardWeeks} hard`,
    input.byeWeeks ? `${input.byeWeeks} bye` : null,
    input.averageStars !== null ? `${input.averageStars.toFixed(1)} avg stars` : null,
  ].filter(Boolean);
  return `${input.label}: ${parts.join(', ')}.`;
}

function summarizeWindow(
  key: MatchupWindowKey,
  label: string,
  weeks: number[],
  rowsByWeek: Map<number, WaiverWeeklyEcrWeek>
): MatchupWindowSummary {
  const normalizedWeeks = normalizeWeekList(weeks);
  const rows = normalizedWeeks
    .map((week) => rowsByWeek.get(week))
    .filter((row): row is WaiverWeeklyEcrWeek => Boolean(row));
  const playableRows = rows.filter((row) => !row.isBye);
  const byeWeeks = rows.filter((row) => row.isBye).length;
  const easyWeeks = playableRows.filter(isEasyWeek).length;
  const hardWeeks = playableRows.filter(isHardWeek).length;
  const neutralWeeks = Math.max(0, playableRows.length - easyWeeks - hardWeeks);
  const starValues = playableRows
    .map(starValue)
    .filter((value): value is number => value !== null);
  const averageStars = starValues.length
    ? Math.round((starValues.reduce((total, value) => total + value, 0) / starValues.length) * 10) / 10
    : null;
  const score = averageStars === null
    ? null
    : Math.round(((averageStars - 1) / 4) * 100);
  const best = playableRows.length ? playableRows.reduce(bestByMatchup) : null;
  const worst = playableRows.length ? playableRows.reduce(worstByMatchup) : null;

  return {
    key,
    label,
    weeks: normalizedWeeks,
    score,
    averageStars,
    playableWeeks: playableRows.length,
    easyWeeks,
    hardWeeks,
    neutralWeeks,
    byeWeeks,
    bestWeek: best?.week ?? null,
    bestMatchupStars: best?.matchupStars ?? null,
    bestOpponentRank: best?.opponentRank ?? null,
    worstWeek: worst?.week ?? null,
    summary: formatWindowSummary({
      label,
      averageStars,
      playableWeeks: playableRows.length,
      easyWeeks,
      hardWeeks,
      byeWeeks,
    }),
  };
}

export function buildMatchupWindowSet(
  weeks: WaiverWeeklyEcrWeek[],
  options: MatchupWindowOptions = {}
): MatchupWindowSet {
  const rowsByWeek = new Map(
    weeks
      .filter((week) => finiteWeek(week.week))
      .map((week) => [Number(week.week), week])
  );
  const seasonEndWeek = Math.max(1, Math.floor(options.seasonEndWeek || DEFAULT_SEASON_END_WEEK));
  const availableWeeks = normalizeWeekList(weeks.map((week) => week.week));
  const currentWeek =
    finiteWeek(options.currentWeek) ||
    availableWeeks.find((week) => week > 0) ||
    1;
  const playoffWeeks = normalizeWeekList(
    options.playoffWeeks?.length
      ? options.playoffWeeks
      : buildLeaguePlayoffWeeks(
          options.playoffWeekStart,
          options.playoffWeekCount || DEFAULT_PLAYOFF_WEEK_COUNT,
          seasonEndWeek
        )
  );

  return {
    currentWeek,
    playoffWeeks,
    next1: summarizeWindow('next1', 'Next week', rangeFrom(currentWeek, 1, seasonEndWeek), rowsByWeek),
    next3: summarizeWindow('next3', 'Next 3', rangeFrom(currentWeek, 3, seasonEndWeek), rowsByWeek),
    next6: summarizeWindow('next6', 'Next 6', rangeFrom(currentWeek, 6, seasonEndWeek), rowsByWeek),
    restOfSeason: summarizeWindow(
      'restOfSeason',
      'Rest of season',
      rangeFrom(currentWeek, seasonEndWeek - currentWeek + 1, seasonEndWeek),
      rowsByWeek
    ),
    playoffs: summarizeWindow('playoffs', 'Playoffs', playoffWeeks, rowsByWeek),
  };
}

export function getShortTermMatchupOutlook(
  matchupWindows?: MatchupWindowSet | null
): ShortTermMatchupOutlook {
  const next3 = matchupWindows?.next3;
  if (!next3 || !next3.playableWeeks) {
    return {
      score: 35,
      multiplier: 0.55,
      isRoughStart: true,
      isStrongStart: false,
    };
  }

  const baseScore = next3.averageStars !== null
    ? ((next3.averageStars - 1) / 4) * 100
    : next3.score ?? 45;
  const adjustedScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(baseScore + next3.easyWeeks * 12 - next3.hardWeeks * 15 - next3.byeWeeks * 8)
    )
  );
  const isRoughStart =
    (next3.hardWeeks >= 2 && next3.easyWeeks === 0) ||
    adjustedScore < 35;
  const isStrongStart = adjustedScore >= 68 && next3.easyWeeks > 0;
  const multiplier = Math.max(
    0.25,
    Math.min(1.35, isRoughStart ? 0.35 : 0.55 + (adjustedScore / 100) * 0.75)
  );

  return {
    score: adjustedScore,
    multiplier,
    isRoughStart,
    isStrongStart,
  };
}
