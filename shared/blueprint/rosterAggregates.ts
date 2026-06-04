import type { ManagerIntelPlayer } from '../types';
import type { GradedPlayer, PlayerArchetype } from './playerGrading';

/**
 * Roster-level rollups for the enhanced blueprint, derived from the graded roster
 * (see playerGrading.ts) plus raw player values and draft capital. Everything here
 * is computed from data already on the report — league-relative figures are only
 * produced when the caller supplies league totals, otherwise they stay null.
 */

export type ValueSlice = {
  key: 'QB' | 'RB' | 'WR' | 'TE' | 'DC';
  value: number;
  share: number; // 0-100, share of total roster value (players + draft capital)
};

export type RosterMakeupRow = {
  archetype: PlayerArchetype;
  count: number;
  share: number; // 0-100, share of graded players
};

const VALUE_POSITIONS: Array<'QB' | 'RB' | 'WR' | 'TE'> = ['QB', 'RB', 'WR', 'TE'];

const ARCHETYPE_ORDER: PlayerArchetype[] = [
  'Foundational',
  'Cornerstone',
  'Mainstay',
  'Serviceable',
  'Upside Shot',
  'JAG-Insurance',
  'JAG-Developmental',
];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min = 0, max = 10): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeValuePosition(pos: string | null | undefined): 'QB' | 'RB' | 'WR' | 'TE' | null {
  const clean = String(pos || '').toUpperCase();
  return (VALUE_POSITIONS as string[]).includes(clean) ? (clean as 'QB' | 'RB' | 'WR' | 'TE') : null;
}

/**
 * Value Proportion pie: each position's value plus a draft-capital ("DC") slice,
 * expressed as a share of the roster's total controlled value.
 */
export function buildValueProportion(
  players: ManagerIntelPlayer[],
  draftCapitalValue = 0,
): ValueSlice[] {
  const byPosition = new Map<'QB' | 'RB' | 'WR' | 'TE', number>();
  for (const player of players) {
    const pos = normalizeValuePosition(player.pos);
    if (!pos) continue;
    byPosition.set(pos, (byPosition.get(pos) || 0) + Math.max(0, player.value || 0));
  }

  const playerTotal = Array.from(byPosition.values()).reduce((sum, value) => sum + value, 0);
  const total = playerTotal + Math.max(0, draftCapitalValue);
  if (total <= 0) return [];

  const slices: ValueSlice[] = VALUE_POSITIONS.map((pos) => {
    const value = byPosition.get(pos) || 0;
    return { key: pos, value, share: round1((value / total) * 100) };
  });

  if (draftCapitalValue > 0) {
    slices.push({ key: 'DC', value: draftCapitalValue, share: round1((draftCapitalValue / total) * 100) });
  }

  return slices;
}

/**
 * Per-position value share of the roster's *player* value (no draft capital).
 * Matches the "10.9% value share" position badges.
 */
export function buildPositionValueShare(players: ManagerIntelPlayer[]): Record<'QB' | 'RB' | 'WR' | 'TE', number> {
  const byPosition: Record<'QB' | 'RB' | 'WR' | 'TE', number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (const player of players) {
    const pos = normalizeValuePosition(player.pos);
    if (!pos) continue;
    byPosition[pos] += Math.max(0, player.value || 0);
  }
  const total = VALUE_POSITIONS.reduce((sum, pos) => sum + byPosition[pos], 0);
  const result: Record<'QB' | 'RB' | 'WR' | 'TE', number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  if (total <= 0) return result;
  for (const pos of VALUE_POSITIONS) result[pos] = round1((byPosition[pos] / total) * 100);
  return result;
}

/** Archetype distribution across the graded roster, ordered strongest tier first. */
export function buildRosterMakeup(graded: GradedPlayer[]): RosterMakeupRow[] {
  if (!graded.length) return [];
  const counts = new Map<PlayerArchetype, number>();
  for (const entry of graded) counts.set(entry.archetype, (counts.get(entry.archetype) || 0) + 1);
  const total = graded.length;
  return ARCHETYPE_ORDER.filter((archetype) => counts.has(archetype)).map((archetype) => {
    const count = counts.get(archetype) || 0;
    return { archetype, count, share: round1((count / total) * 100) };
  });
}

/**
 * Overall roster grade (0-10): average composite, with a light lift toward the
 * top of the roster so a strong core is not fully diluted by deep bench JAGs.
 */
export function getOverallGrade(graded: GradedPlayer[]): number {
  if (!graded.length) return 0;
  const sorted = [...graded].sort((a, b) => b.composite - a.composite);
  const core = sorted.slice(0, Math.min(sorted.length, 12));
  const coreAvg = core.reduce((sum, entry) => sum + entry.composite, 0) / core.length;
  const fullAvg = sorted.reduce((sum, entry) => sum + entry.composite, 0) / sorted.length;
  return round1(clamp(coreAvg * 0.6 + fullAvg * 0.4));
}

/** Average age per position across a set of players (typically starters). */
export function buildAverageAge(players: ManagerIntelPlayer[]): Record<'QB' | 'RB' | 'WR' | 'TE', number | null> {
  const sums: Record<'QB' | 'RB' | 'WR' | 'TE', { total: number; count: number }> = {
    QB: { total: 0, count: 0 },
    RB: { total: 0, count: 0 },
    WR: { total: 0, count: 0 },
    TE: { total: 0, count: 0 },
  };
  for (const player of players) {
    const pos = normalizeValuePosition(player.pos);
    const age = player.playerDetails?.age ?? null;
    if (!pos || age === null) continue;
    sums[pos].total += age;
    sums[pos].count += 1;
  }
  const result: Record<'QB' | 'RB' | 'WR' | 'TE', number | null> = { QB: null, RB: null, WR: null, TE: null };
  for (const pos of VALUE_POSITIONS) {
    result[pos] = sums[pos].count ? round1(sums[pos].total / sums[pos].count) : null;
  }
  return result;
}

/**
 * Draft-capital score (0-10). When a league rank is known, score off the rank;
 * otherwise scale the raw total value against a reference band so the number is
 * still meaningful for a single roster.
 */
export function getDraftCapitalScore(input: {
  totalValue?: number | null;
  leagueRank?: number | null;
  leagueSize?: number | null;
}): number {
  const { totalValue, leagueRank, leagueSize } = input;
  if (leagueRank && leagueSize && leagueSize > 1) {
    // Rank 1 (most capital) → 10, last → ~1.5.
    return round1(clamp(10 - ((leagueRank - 1) / (leagueSize - 1)) * 8.5, 1.5, 10));
  }
  if (totalValue && totalValue > 0) {
    // Reference: ~12k of pick value reads as a fully stocked bank.
    return round1(clamp((totalValue / 12000) * 10));
  }
  return 0;
}
