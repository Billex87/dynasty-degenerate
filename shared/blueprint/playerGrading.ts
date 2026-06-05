import type { LeagueValueMode, ManagerIntelPlayer } from '../types';

/**
 * Blueprint player grading engine ("Domain True Ranks").
 *
 * Produces a three-factor read for each rostered player from data already present
 * in ReportData — no server call, no fabricated inputs. Every factor degrades
 * gracefully when a signal is missing and records which inputs it actually used,
 * so the UI can stay honest about thin grades instead of inventing a number.
 *
 * Scores are 0-10. Definitions (tunable via WEIGHTS / POSITION_BASELINES below):
 *
 * - Insulation  — how secure the asset is: age curve (position-aware), durability
 *   (injury status), role lock (starter / depth-chart order), and positional value
 *   floor (where the player ranks at the position). High = safe to build around.
 * - Production  — recent on-field output vs a positional starter baseline: points
 *   per game, games-played availability, season position rank, and started share.
 * - Situational — environment and trajectory: strength of schedule, value trend
 *   (rising/falling), and depth-chart competition. High = tailwinds, not headwinds.
 *
 * Composite blends the three with mode-aware weights (dynasty leans Insulation,
 * redraft leans Production). Archetype is derived from composite + age + value.
 */

export type PlayerArchetype =
  | 'Foundational'
  | 'Cornerstone'
  | 'Mainstay'
  | 'Serviceable'
  | 'Upside Shot'
  | 'JAG-Insurance'
  | 'JAG-Developmental';

export type GradedPlayer = {
  player: ManagerIntelPlayer;
  insulation: number;
  production: number;
  situational: number;
  composite: number;
  archetype: PlayerArchetype;
  positionRank: number;
  compositePositionRank: string;
  /** Names of the factors that fell back to neutral because inputs were missing. */
  thinFactors: Array<'insulation' | 'production' | 'situational'>;
};

type Position = 'QB' | 'RB' | 'WR' | 'TE';

const GRADED_POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE'];

/** Neutral score used when a factor has no usable signal — never invent a high grade. */
const NEUTRAL = 5;

/**
 * Composite weights by value mode. Dynasty cares most about long-term security,
 * redraft cares most about this-year output.
 */
const WEIGHTS: Record<'dynasty' | 'redraft', { insulation: number; production: number; situational: number }> = {
  dynasty: { insulation: 0.42, production: 0.3, situational: 0.28 },
  redraft: { insulation: 0.2, production: 0.52, situational: 0.28 },
};

/**
 * Per-position tuning. `prime`/`cliff` shape the age curve; `ppgFloor`/`ppgElite`
 * set the production scale (PPR-leaning starter baselines).
 */
const POSITION_BASELINES: Record<Position, { prime: number; cliff: number; ppgFloor: number; ppgElite: number }> = {
  QB: { prime: 30, cliff: 38, ppgFloor: 14, ppgElite: 24 },
  RB: { prime: 24, cliff: 29, ppgFloor: 9, ppgElite: 20 },
  WR: { prime: 26, cliff: 31, ppgFloor: 9, ppgElite: 19 },
  TE: { prime: 27, cliff: 33, ppgFloor: 6, ppgElite: 14 },
};

function clamp(value: number, min = 0, max = 10): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizePosition(pos: string | null | undefined): Position | null {
  const clean = String(pos || '').toUpperCase();
  return (GRADED_POSITIONS as string[]).includes(clean) ? (clean as Position) : null;
}

/** Parse "WR12" / "RB3" / "QB1" style ranks into a number, or null. */
function parsePositionRank(rank: string | null | undefined): number | null {
  if (!rank) return null;
  const match = String(rank).match(/(\d+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function getMode(valueMode: LeagueValueMode | undefined): 'dynasty' | 'redraft' {
  return valueMode === 'redraft' || valueMode === 'keeper' ? 'redraft' : 'dynasty';
}

/**
 * Insulation (0-10): age curve + durability + role lock + positional value floor.
 * Returns null when no insulation signal exists at all.
 */
function scoreInsulation(player: ManagerIntelPlayer, position: Position): number | null {
  const details = player.playerDetails;
  const baseline = POSITION_BASELINES[position];
  const parts: number[] = [];

  const age = details?.age ?? null;
  if (age !== null) {
    // Full marks until prime, linear decay to the cliff, floor after.
    if (age <= baseline.prime) parts.push(9 + Math.min(1, (baseline.prime - age) / 6));
    else if (age >= baseline.cliff) parts.push(2);
    else parts.push(clamp(9 - ((age - baseline.prime) / (baseline.cliff - baseline.prime)) * 7));
  }

  const injury = String(details?.injuryStatus || '').toLowerCase();
  if (injury) {
    if (/(out|ir|pup|doubtful|suspend)/.test(injury)) parts.push(2);
    else if (/(question|limited|day)/.test(injury)) parts.push(5);
    else parts.push(8); // healthy / active
  }

  // Role lock: confirmed starter or top of the depth chart insulates the asset.
  const depthOrder = details?.depthChartOrder ?? details?.sleeperDepthChartOrder ?? null;
  if (details?.isStarter === true) parts.push(8.5);
  else if (depthOrder !== null) parts.push(clamp(9 - (depthOrder - 1) * 2.4));

  // Positional value floor: elite at the position is hard to dislodge.
  const posRank = parsePositionRank(player.currentPositionRank);
  if (posRank !== null) parts.push(clamp(10 - (posRank - 1) * 0.45));

  if (!parts.length) return null;
  return clamp(parts.reduce((sum, value) => sum + value, 0) / parts.length);
}

/**
 * Production (0-10): PPG vs positional baseline + availability + rank + started share.
 * Returns null when no production signal exists.
 */
function scoreProduction(player: ManagerIntelPlayer, position: Position): number | null {
  const details = player.playerDetails;
  const baseline = POSITION_BASELINES[position];
  const parts: number[] = [];

  const ppg = player.lastSeasonPointsPerGame ?? null;
  if (ppg !== null) {
    const span = Math.max(1, baseline.ppgElite - baseline.ppgFloor);
    parts.push(clamp(2 + ((ppg - baseline.ppgFloor) / span) * 8));
  }

  const games = player.lastSeasonGames ?? null;
  if (games !== null) parts.push(clamp((games / 17) * 10));

  const seasonRank = parsePositionRank(player.seasonPositionRank ?? player.currentPositionRank);
  if (seasonRank !== null) parts.push(clamp(10 - (seasonRank - 1) * 0.4));

  const startedPct = details?.sleeperStartedPct ?? null;
  if (startedPct !== null) parts.push(clamp((startedPct / 100) * 10));

  if (!parts.length) return null;
  return clamp(parts.reduce((sum, value) => sum + value, 0) / parts.length);
}

/** Read a value-trend delta percentage from the player's stored value timeline. */
function getValueTrendPct(player: ManagerIntelPlayer): number | null {
  const windows = player.playerDetails?.valueTimeline?.windows;
  if (!windows) return null;
  const window = windows['3m'] || windows['1m'] || windows['6m'];
  return window?.deltaPct ?? null;
}

/**
 * Situational (0-10): schedule + value trajectory + depth-chart competition.
 * Returns null when no situational signal exists.
 */
function scoreSituational(player: ManagerIntelPlayer, position: Position): number | null {
  const details = player.playerDetails;
  const parts: number[] = [];

  // Strength of schedule: DraftSharks seasonSOS is a signed points-vs-average
  // delta centered at 0 (~ -15..+15) where HIGHER = EASIER schedule. Map to a
  // 0-10 score with 0 -> 5, so an easier schedule lifts Situational.
  const sos = details?.schedule?.seasonSOS ?? null;
  if (sos !== null) {
    parts.push(clamp(5 + sos / 3));
  }
  const tier = String(details?.schedule?.scheduleTier || '').toLowerCase();
  if (tier) {
    if (/(easy|soft|favorable|green)/.test(tier)) parts.push(8);
    else if (/(hard|tough|brutal|red)/.test(tier)) parts.push(3);
    else parts.push(5);
  }

  // Trajectory: rising market value is a tailwind, falling is a headwind.
  const trendPct = getValueTrendPct(player);
  if (trendPct !== null) parts.push(clamp(5.5 + trendPct * 0.25));

  // Depth-chart competition: being buried behind teammates is situational drag.
  const depthOrder = details?.depthChartOrder ?? details?.sleeperDepthChartOrder ?? null;
  if (depthOrder !== null) parts.push(clamp(9 - (depthOrder - 1) * 2.2));

  if (!parts.length) return null;
  return clamp(parts.reduce((sum, value) => sum + value, 0) / parts.length);
}

function deriveArchetype(input: {
  composite: number;
  insulation: number;
  production: number;
  situational: number;
  age: number | null;
  position: Position;
}): PlayerArchetype {
  const { composite, insulation, production, situational, age, position } = input;
  const young = age !== null && age <= POSITION_BASELINES[position].prime - 2;

  if (composite >= 8.4 && insulation >= 7.5) return 'Foundational';
  if (composite >= 7.3) return 'Cornerstone';
  if (composite >= 6) return 'Mainstay';
  // High ceiling but unproven/young → upside shot before serviceable.
  if (young && situational >= 6 && production < 6) return 'Upside Shot';
  if (composite >= 4.5) return 'Serviceable';
  // Low composite: split developmental (young) vs insurance (veteran depth).
  return young ? 'JAG-Developmental' : 'JAG-Insurance';
}

/** Grade a single player. Returns null for positions we do not grade (K/DEF/etc.). */
export function gradePlayer(
  player: ManagerIntelPlayer,
  valueMode?: LeagueValueMode,
): Omit<GradedPlayer, 'positionRank' | 'compositePositionRank'> | null {
  const position = normalizePosition(player.pos);
  if (!position) return null;

  const rawInsulation = scoreInsulation(player, position);
  const rawProduction = scoreProduction(player, position);
  const rawSituational = scoreSituational(player, position);

  const thinFactors: GradedPlayer['thinFactors'] = [];
  if (rawInsulation === null) thinFactors.push('insulation');
  if (rawProduction === null) thinFactors.push('production');
  if (rawSituational === null) thinFactors.push('situational');

  const insulation = rawInsulation ?? NEUTRAL;
  const production = rawProduction ?? NEUTRAL;
  const situational = rawSituational ?? NEUTRAL;

  const weights = WEIGHTS[getMode(valueMode)];
  const composite = clamp(
    insulation * weights.insulation + production * weights.production + situational * weights.situational,
  );

  const archetype = deriveArchetype({
    composite,
    insulation,
    production,
    situational,
    age: player.playerDetails?.age ?? null,
    position,
  });

  return {
    player,
    insulation: round1(insulation),
    production: round1(production),
    situational: round1(situational),
    composite: round1(composite),
    archetype,
    thinFactors,
  };
}

/**
 * Grade and rank a roster. Players are graded, then ranked within their position
 * by composite to produce "QB4 / WR8"-style composite position ranks, then
 * returned sorted by composite (best first) for the Domain True Ranks table.
 */
export function gradeRoster(players: ManagerIntelPlayer[], valueMode?: LeagueValueMode): GradedPlayer[] {
  const graded = players
    .map((player) => gradePlayer(player, valueMode))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  // Rank inline in sorted order so ranks are correct even when player_id is
  // missing or duplicated (an id-keyed map would collide on those).
  const positionCounters = new Map<string, number>();
  const byPositionSorted = [...graded].sort((a, b) => b.composite - a.composite);

  return byPositionSorted.map((entry) => {
    const pos = normalizePosition(entry.player.pos);
    if (!pos) {
      return { ...entry, positionRank: 0, compositePositionRank: entry.player.pos };
    }
    const next = (positionCounters.get(pos) || 0) + 1;
    positionCounters.set(pos, next);
    return { ...entry, positionRank: next, compositePositionRank: `${pos}${next}` };
  });
}
