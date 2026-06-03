import type { LeagueValueMode, ManagerIntelPlayer } from '@shared/types';
import { gradeRoster } from './playerGrading';
import { getOverallGrade } from './rosterAggregates';

/**
 * League-relative blueprint stats. The per-roster engine (playerGrading.ts) reads
 * one team; this rolls every team up so the focused manager can be placed against
 * the league: value share + rank, production share + rank, blueprint percentile,
 * and how rare their build is. All inputs come from report data the client already
 * holds; figures stay null when the league inputs are missing rather than guessed.
 */

export type ManagerBlueprintRollup = {
  manager: string;
  rosterValue: number;
  productionPoints: number;
  overallGrade: number;
  buildLabel: string;
};

export type LeagueComparatives = {
  teamCount: number;
  valueShare: number | null; // 0-100, focused roster value / league total
  valueShareRank: number | null;
  productionShare: number | null; // 0-100, focused production / league total
  productionShareRank: number | null;
  percentile: number | null; // 0-100 by overall grade (higher = stronger blueprint)
  buildLabel: string | null;
  buildRarity: number | null; // 0-100, share of teams with the same build label
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeBuildLabel(label: string | null | undefined): string {
  const clean = String(label || '').replace(/\s+/g, ' ').trim();
  return clean || 'Unclassified';
}

/** Summarize one manager's roster into the figures the league rollup needs. */
export function summarizeManagerRoster(input: {
  manager: string;
  players: ManagerIntelPlayer[];
  buildLabel?: string | null;
  valueMode?: LeagueValueMode;
}): ManagerBlueprintRollup {
  const { manager, players, buildLabel, valueMode } = input;
  const rosterValue = players.reduce((sum, player) => sum + Math.max(0, player.value || 0), 0);
  const productionPoints = players.reduce(
    (sum, player) => sum + Math.max(0, player.lastSeasonFantasyPoints || 0),
    0,
  );
  const overallGrade = getOverallGrade(gradeRoster(players, valueMode));
  return {
    manager,
    rosterValue,
    productionPoints,
    overallGrade,
    buildLabel: normalizeBuildLabel(buildLabel),
  };
}

function shareAndRank(
  rollups: ManagerBlueprintRollup[],
  focusedManager: string,
  selector: (rollup: ManagerBlueprintRollup) => number,
): { share: number | null; rank: number | null } {
  const total = rollups.reduce((sum, rollup) => sum + selector(rollup), 0);
  const focused = rollups.find((rollup) => rollup.manager === focusedManager);
  if (!focused) return { share: null, rank: null };

  const share = total > 0 ? round1((selector(focused) / total) * 100) : null;
  const sorted = [...rollups].sort((a, b) => selector(b) - selector(a));
  const rank = sorted.findIndex((rollup) => rollup.manager === focusedManager) + 1;
  return { share, rank: rank > 0 ? rank : null };
}

/**
 * Place the focused manager against the league from per-team rollups.
 * Returns nulls (not zeros) when there is no league context to compare against.
 */
export function buildLeagueComparatives(
  rollups: ManagerBlueprintRollup[],
  focusedManager: string,
): LeagueComparatives {
  const teamCount = rollups.length;
  const focused = rollups.find((rollup) => rollup.manager === focusedManager);

  if (teamCount < 2 || !focused) {
    return {
      teamCount,
      valueShare: null,
      valueShareRank: null,
      productionShare: null,
      productionShareRank: null,
      percentile: null,
      buildLabel: focused ? focused.buildLabel : null,
      buildRarity: null,
    };
  }

  const value = shareAndRank(rollups, focusedManager, (rollup) => rollup.rosterValue);
  const hasProduction = rollups.some((rollup) => rollup.productionPoints > 0);
  const production = hasProduction
    ? shareAndRank(rollups, focusedManager, (rollup) => rollup.productionPoints)
    : { share: null, rank: null };

  // Percentile by overall grade: share of teams at or below the focused grade.
  const atOrBelow = rollups.filter((rollup) => rollup.overallGrade <= focused.overallGrade).length;
  const percentile = Math.round((atOrBelow / teamCount) * 100);

  // Build rarity: how many teams share the focused build label.
  const sameBuild = rollups.filter((rollup) => rollup.buildLabel === focused.buildLabel).length;
  const buildRarity = round1((sameBuild / teamCount) * 100);

  return {
    teamCount,
    valueShare: value.share,
    valueShareRank: value.rank,
    productionShare: production.share,
    productionShareRank: production.rank,
    percentile,
    buildLabel: focused.buildLabel,
    buildRarity,
  };
}
