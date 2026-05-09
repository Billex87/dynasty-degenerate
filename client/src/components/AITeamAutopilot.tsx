import { useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BadgeCheck,
  BrainCircuit,
  CalendarClock,
  ChevronRight,
  Crosshair,
  LineChart,
  ListChecks,
  Radar,
  Repeat2,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlayerRankForMode, getPlayerValueForMode, type LeagueValueMode } from '@/lib/leagueValueMode';
import type {
  ManagerIntelPlayer,
  ManagerRosterIntelligence,
  ManagerStarterPlayer,
  MatchupPreview,
  PlayerDetails,
  PlayerInfo,
  PowerRanking,
  ReportData,
  TrendingPlayer,
  WeeklyMomentum,
} from '@shared/types';

type AutopilotMode = 'dynasty' | 'redraft';
type AutopilotTone = 'good' | 'info' | 'warn' | 'danger' | 'neutral';
type ValueDirection = 'Rising' | 'Falling' | 'Stable';

type AutopilotScore = {
  label: string;
  value: number;
  tone: AutopilotTone;
};

type AutopilotRecommendation = {
  id: string;
  type: string;
  player: string;
  secondary?: string;
  action: string;
  confidence: number;
  risk: 'Low' | 'Medium' | 'High';
  upside: 'Low' | 'Medium' | 'High' | 'Elite';
  summary: string;
  reasons: string[];
  signals: string[];
  tone: AutopilotTone;
};

type PlayerProjection = {
  player: string;
  position: string;
  direction: ValueDirection;
  currentValue: string;
  projectedMove: string;
  confidence: number;
  signals: string[];
};

type LeaguePowerRow = {
  rank: number;
  team: string;
  direction: string;
  score: number;
  note: string;
  tone: AutopilotTone;
};

type AutopilotData = {
  mode: AutopilotMode;
  focusManager?: string;
  dataStatus?: string;
  headline: string;
  direction: {
    label: string;
    confidence: number;
    summary: string;
    strategy: string;
    scores: AutopilotScore[];
    actionPlan: string[];
  };
  systemRead: AutopilotScore[];
  lineup: AutopilotRecommendation[];
  waivers: AutopilotRecommendation[];
  trades: AutopilotRecommendation[];
  projections: PlayerProjection[];
  power: LeaguePowerRow[];
  scheduleTodo: string[];
};

const AUTOPILOT_DATA: Record<AutopilotMode, AutopilotData> = {
  dynasty: {
    mode: 'dynasty',
    headline: 'Long-range roster command',
    direction: {
      label: 'Middle contender',
      confidence: 82,
      summary: 'The roster can chase wins, but the AI should protect future value and avoid buying old production unless the weekly edge is obvious.',
      strategy: 'Compete while the starting lineup is healthy. If the team slips below the top playoff tier, sell older RB production for 2026 picks or young WR value.',
      scores: [
        { label: 'Win-now push', value: 76, tone: 'good' },
        { label: 'Future value', value: 61, tone: 'warn' },
        { label: 'Trade leverage', value: 84, tone: 'info' },
      ],
      actionPlan: [
        'Hold premium young WRs unless the return includes a younger tier-up.',
        'Shop older RB production to contenders before market value softens.',
        'Use bench depth and 2nds to buy one weekly starter, not a short-window name.',
      ],
    },
    systemRead: [
      { label: 'Roster data', value: 91, tone: 'good' },
      { label: 'Market signal', value: 84, tone: 'info' },
      { label: 'History depth', value: 64, tone: 'warn' },
      { label: 'Schedule data', value: 0, tone: 'neutral' },
    ],
    lineup: [
      {
        id: 'dynasty-lineup-reed',
        type: 'Start/Sit',
        player: 'Jayden Reed',
        secondary: 'over Calvin Ridley',
        action: 'Start',
        confidence: 78,
        risk: 'Medium',
        upside: 'High',
        summary: 'Reed has the better value-growth profile and gives the lineup more weekly ceiling without sacrificing the long-term build.',
        reasons: ['Young WR profile is still gaining market trust.', 'Target growth and manufactured touches matter more than veteran floor in this build.', 'The roster can absorb some weekly variance.'],
        signals: ['Age curve', 'Dynasty value trend', 'Target opportunity', 'Roster timeline'],
        tone: 'good',
      },
      {
        id: 'dynasty-lineup-rb-insurance',
        type: 'Bench',
        player: 'Older flex RB',
        secondary: 'for high-upside WR flex',
        action: 'Bench unless role is confirmed',
        confidence: 69,
        risk: 'Medium',
        upside: 'Medium',
        summary: 'The AI would rather preserve upside in a middle-contender build than chase a low-ceiling touch projection.',
        reasons: ['Older RBs need bankable volume to justify the start.', 'The team direction does not need conservative points at every flex spot.', 'Bench choice can flip if injury news creates goal-line work.'],
        signals: ['Role certainty', 'RB shelf-life risk', 'Lineup ceiling', 'Injury news pending'],
        tone: 'info',
      },
    ],
    waivers: [
      {
        id: 'dynasty-waiver-corum',
        type: 'Waiver',
        player: 'Blake Corum',
        action: 'Pick up',
        confidence: 84,
        risk: 'Low',
        upside: 'High',
        summary: 'A young backup RB behind valuable touches is the right dynasty stash profile when the bench has disposable churn spots.',
        reasons: ['Backup RBs behind concentrated workloads can spike quickly.', 'Young profile keeps value from going to zero after one quiet week.', 'The roster has enough win-now pieces to carry one stash.'],
        signals: ['Handcuff leverage', 'Age curve', 'Market value', 'Bench churn spot'],
        tone: 'good',
      },
      {
        id: 'dynasty-waiver-te-stash',
        type: 'Waiver',
        player: 'Young TE stash',
        action: 'Add if free',
        confidence: 71,
        risk: 'Medium',
        upside: 'Medium',
        summary: 'TE breakouts are slow, but a route-growth profile is a better dynasty bench use than a low-upside veteran WR.',
        reasons: ['TE age curves reward patience.', 'Route participation matters more than one-week points.', 'Replacement-level bench WRs are easy to churn.'],
        signals: ['TE development curve', 'Route growth', 'Bench opportunity cost'],
        tone: 'info',
      },
    ],
    trades: [
      {
        id: 'dynasty-trade-henry',
        type: 'Trade',
        player: 'Derrick Henry',
        secondary: 'for young WR or 2026 pick',
        action: 'Trade away',
        confidence: 86,
        risk: 'Medium',
        upside: 'High',
        summary: 'If the roster is not clearly top tier, his name value should be converted before age and RB shelf-life risk compress the market.',
        reasons: ['Older RB value can fall fast when volume slips.', 'Contenders may still pay for current production.', 'The team direction is not pure win-now.'],
        signals: ['Age risk', 'RB shelf-life risk', 'Rebuild hedge', 'Contender demand'],
        tone: 'warn',
      },
      {
        id: 'dynasty-trade-young-wr',
        type: 'Trade',
        player: 'Rashee Rice profile',
        secondary: 'before the next value spike',
        action: 'Acquire',
        confidence: 74,
        risk: 'Medium',
        upside: 'Elite',
        summary: 'The AI likes young WRs whose value can climb from role growth rather than one unsustainable touchdown stretch.',
        reasons: ['WR value curves are more forgiving than RB curves.', 'Role growth gives both weekly and future-value upside.', 'A middle build should buy liquid assets.'],
        signals: ['Youth premium', 'Market liquidity', 'Target growth', 'Roster direction'],
        tone: 'good',
      },
    ],
    projections: [
      { player: 'Jayden Reed', position: 'WR', direction: 'Rising', currentValue: 'WR2/3 band', projectedMove: '+14%', confidence: 78, signals: ['Young WR', 'Touch growth', 'Market still catching up'] },
      { player: 'Trey McBride', position: 'TE', direction: 'Stable', currentValue: 'Elite TE', projectedMove: '+2%', confidence: 81, signals: ['Elite positional scarcity', 'Strong role', 'Already priced high'] },
      { player: 'Derrick Henry', position: 'RB', direction: 'Falling', currentValue: 'Win-now RB', projectedMove: '-18%', confidence: 86, signals: ['Age cliff', 'RB shelf life', 'Name value sell window'] },
      { player: 'Young backup RB', position: 'RB', direction: 'Rising', currentValue: 'Bench stash', projectedMove: '+22%', confidence: 67, signals: ['Injury leverage', 'Cheap acquisition', 'Role optionality'] },
    ],
    power: [
      { rank: 1, team: 'AwWQQ', direction: 'Contender', score: 92, note: 'Strong starters and clean weekly ceiling.', tone: 'good' },
      { rank: 2, team: 'PurpleHaze', direction: 'Contender', score: 84, note: 'Needs TE help but still has scoring depth.', tone: 'info' },
      { rank: 3, team: 'Skids Get Beat', direction: 'Middle contender', score: 79, note: 'Best leverage is selling excess RB value for future WR liquidity.', tone: 'warn' },
      { rank: 4, team: 'OnlyFants', direction: 'Reload', score: 72, note: 'Young core gives trade flexibility.', tone: 'info' },
    ],
    scheduleTodo: [
      'Add weekly defensive matchup scoring when the league schedule is released.',
      'Compare playoff-week opponent strength for each starter.',
      'Blend matchup difficulty into start/sit confidence without overpowering talent and role.',
    ],
  },
  redraft: {
    mode: 'redraft',
    headline: 'Current-season win maximizer',
    direction: {
      label: 'Win-now push',
      confidence: 87,
      summary: 'Future value is ignored in redraft mode. The AI should chase weekly points, role certainty, and near-term injury leverage.',
      strategy: 'Turn bench stashes into usable weekly production. Do not hold low-volume players just because they have dynasty appeal.',
      scores: [
        { label: 'Weekly ceiling', value: 83, tone: 'good' },
        { label: 'Floor safety', value: 74, tone: 'info' },
        { label: 'Bench utility', value: 58, tone: 'warn' },
      ],
      actionPlan: [
        'Prioritize players with bankable snaps, routes, carries, and red-zone usage.',
        'Cut slow-developing stashes if a player has a clearer two-week role.',
        'Trade bench value for a starter upgrade before bye weeks stack up.',
      ],
    },
    systemRead: [
      { label: 'Roster data', value: 91, tone: 'good' },
      { label: 'Season value', value: 86, tone: 'good' },
      { label: 'Usage signal', value: 72, tone: 'info' },
      { label: 'Schedule data', value: 0, tone: 'neutral' },
    ],
    lineup: [
      {
        id: 'redraft-lineup-floor',
        type: 'Start/Sit',
        player: 'High-route WR',
        secondary: 'over touchdown-only flex',
        action: 'Start',
        confidence: 81,
        risk: 'Low',
        upside: 'Medium',
        summary: 'Redraft mode favors the player with clearer weekly usage and target floor.',
        reasons: ['Routes and targets are stickier than touchdown dependency.', 'The lineup needs bankable weekly points.', 'Dynasty upside is ignored in this mode.'],
        signals: ['Route participation', 'Target share', 'Weekly floor', 'Redraft value'],
        tone: 'good',
      },
      {
        id: 'redraft-lineup-qb-rush',
        type: 'Start/Sit',
        player: 'Rushing QB',
        secondary: 'over pocket passer',
        action: 'Start',
        confidence: 76,
        risk: 'Medium',
        upside: 'High',
        summary: 'Rushing points raise the weekly ceiling and reduce dependency on passing efficiency.',
        reasons: ['Rushing QBs create points without needing perfect game script.', 'Ceiling matters when projected matchup is close.', 'Passing-only profiles need a cleaner opponent read.'],
        signals: ['Rush share', 'Weekly ceiling', 'Game script', 'Positional scarcity'],
        tone: 'info',
      },
    ],
    waivers: [
      {
        id: 'redraft-waiver-workload',
        type: 'Waiver',
        player: 'Two-week volume RB',
        action: 'Pick up',
        confidence: 85,
        risk: 'Medium',
        upside: 'High',
        summary: 'In redraft, temporary workload can matter more than long-term talent.',
        reasons: ['Near-term touches beat stash value.', 'Goal-line usage can create immediate scoring windows.', 'Bench spots should produce during bye weeks.'],
        signals: ['Snap share', 'Rush share', 'Goal-line work', 'Bye-week utility'],
        tone: 'good',
      },
      {
        id: 'redraft-waiver-wr',
        type: 'Waiver',
        player: 'Slot WR with target spike',
        action: 'Add as depth',
        confidence: 73,
        risk: 'Medium',
        upside: 'Medium',
        summary: 'The profile is useful if route growth is real, but confidence stays lower until usage repeats.',
        reasons: ['One target spike is not enough by itself.', 'Slot usage can stabilize quickly if routes stay elevated.', 'Drop candidate should be a low-snap bench stash.'],
        signals: ['Target share', 'Route trend', 'Replacement value'],
        tone: 'info',
      },
    ],
    trades: [
      {
        id: 'redraft-trade-starter',
        type: 'Trade',
        player: 'Top-18 WR starter',
        secondary: 'using two bench pieces',
        action: 'Acquire',
        confidence: 79,
        risk: 'Medium',
        upside: 'High',
        summary: 'Consolidating bench value into a weekly starter is the cleanest redraft upgrade.',
        reasons: ['Bench depth does not score unless it enters the lineup.', 'Starter upgrades compound every week.', 'Future picks and dynasty age curves do not matter here.'],
        signals: ['Starter slot value', 'Bench consolidation', 'Weekly points'],
        tone: 'good',
      },
      {
        id: 'redraft-trade-sell-name',
        type: 'Trade',
        player: 'Low-usage name value',
        secondary: 'for role certainty',
        action: 'Trade away',
        confidence: 72,
        risk: 'Medium',
        upside: 'Medium',
        summary: 'Name value should be moved if weekly usage is not matching the market price.',
        reasons: ['Redraft rewards current role, not theoretical talent.', 'Market reputation can hide declining usage.', 'A safer flex profile improves weekly decision quality.'],
        signals: ['Snap decline', 'Target decline', 'Market overvalue', 'Weekly role'],
        tone: 'warn',
      },
    ],
    projections: [
      { player: 'Volume RB fill-in', position: 'RB', direction: 'Rising', currentValue: 'Flex', projectedMove: '+19%', confidence: 80, signals: ['Immediate touches', 'Goal-line role', 'Short-term injury opening'] },
      { player: 'Low-route WR', position: 'WR', direction: 'Falling', currentValue: 'Bench name', projectedMove: '-13%', confidence: 75, signals: ['Route decline', 'Target competition', 'No long-term premium in redraft'] },
      { player: 'High-route TE', position: 'TE', direction: 'Stable', currentValue: 'Back-end TE1', projectedMove: '+4%', confidence: 69, signals: ['Route participation', 'TE scarcity', 'Touchdown variance'] },
      { player: 'Rushing QB', position: 'QB', direction: 'Rising', currentValue: 'QB1 streamer', projectedMove: '+9%', confidence: 76, signals: ['Rush floor', 'Red-zone carries', 'Weekly ceiling'] },
    ],
    power: [
      { rank: 1, team: 'AwWQQ', direction: 'Win-now', score: 91, note: 'Strongest starter projection.', tone: 'good' },
      { rank: 2, team: 'Skids Get Beat', direction: 'Playoff push', score: 84, note: 'Needs bench conversion into one weekly starter.', tone: 'info' },
      { rank: 3, team: 'PurpleHaze', direction: 'Volatile', score: 78, note: 'Ceiling is strong, but floor depends on injury news.', tone: 'warn' },
      { rank: 4, team: 'OnlyFants', direction: 'Streamer build', score: 70, note: 'Can climb with waiver aggression.', tone: 'info' },
    ],
    scheduleTodo: [
      'Add opponent defensive strength once weekly schedule data is available.',
      'Blend matchup strength into QB, streamer, and flex calls.',
      'Add playoff-week matchup planning for high-seed teams.',
    ],
  },
};

type AutopilotPlayerLike = {
  player_id?: string | null;
  name?: string | null;
  pos?: string | null;
  position?: string | null;
  owner?: string | null;
  value?: number | null;
  seasonValue?: number | null;
  ktcValue?: number | null;
  val_now?: number | null;
  val_last?: number | null;
  diff?: number | null;
  pct_change?: number | null;
  age?: number | null;
  currentPositionRank?: string | null;
  seasonPositionRank?: string | null;
  playerDetails?: PlayerDetails;
};

type AutopilotBuildInput = {
  reportData?: ReportData;
  mode: AutopilotMode;
  fallback: AutopilotData;
};

const POSITION_KEYS = ['QB', 'RB', 'WR', 'TE'] as const;

function normalizeManagerName(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function sameManager(a?: string | null, b?: string | null) {
  return normalizeManagerName(a) === normalizeManagerName(b);
}

function safeNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function averageNumbers(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function scoreFromRank(rank?: number | null, total?: number | null): number | null {
  const safeRank = safeNumber(rank);
  const safeTotal = Math.max(1, safeNumber(total) || 1);
  if (!safeRank || safeRank <= 0) return null;
  if (safeTotal <= 1) return 82;
  return clampPercent(102 - ((safeRank - 1) / (safeTotal - 1)) * 66);
}

function scoreTone(score?: number | null): AutopilotTone {
  const value = safeNumber(score) ?? 0;
  if (value >= 78) return 'good';
  if (value >= 62) return 'info';
  if (value >= 42) return 'warn';
  return 'danger';
}

function confidenceFromSignals(base: number, signals: Array<unknown>, missingPenalty = 0): number {
  const signalCount = signals.filter(Boolean).length;
  return clampPercent(base + signalCount * 6 - missingPenalty);
}

function getLeagueSize(data: ReportData): number {
  return Math.max(
    data.managerRosterIntelligence?.length || 0,
    data.powerRankings?.length || 0,
    data.managerPositionCounts?.length || 0,
    data.currentStandings?.length || 0,
    1,
  );
}

function shortenText(value?: string | null, maxLength = 180): string | null {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  if (clean.length <= maxLength) return clean;
  const sentence = clean.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
  return `${sentence || clean.slice(0, maxLength)}...`;
}

function dedupeStrings(values: Array<string | null | undefined>, limit = 4): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const clean = String(value || '').trim();
    if (!clean || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    result.push(clean);
  });
  return result.slice(0, limit);
}

function formatCompactValue(value?: number | null): string {
  const numeric = safeNumber(value);
  if (numeric === null) return '-';
  const abs = Math.abs(numeric);
  const sign = numeric < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}K`;
  return `${Math.round(numeric)}`;
}

function formatSignedPercent(value?: number | null): string {
  const numeric = safeNumber(value);
  if (numeric === null) return '0%';
  const sign = numeric > 0 ? '+' : '';
  return `${sign}${Math.abs(numeric) >= 10 ? numeric.toFixed(0) : numeric.toFixed(1)}%`;
}

function parsePositionRankValue(rank?: string | null): number | null {
  const match = String(rank || '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function getPlayerName(player?: AutopilotPlayerLike | null) {
  return player?.name || player?.playerDetails?.fullName || 'Unknown player';
}

function getPlayerPosition(player?: AutopilotPlayerLike | null) {
  return player?.pos || player?.position || player?.playerDetails?.position || 'FLEX';
}

function getPlayerAge(player?: AutopilotPlayerLike | null): number | null {
  return safeNumber(player?.age ?? player?.playerDetails?.age);
}

function getAutopilotPlayerValue(player?: AutopilotPlayerLike | null, mode: AutopilotMode = 'dynasty') {
  if (!player) return null;
  const fallbackValue = mode === 'redraft'
    ? player.seasonValue ?? player.playerDetails?.valueProfile?.seasonValue ?? player.ktcValue ?? player.value ?? player.val_now
    : player.value ?? player.ktcValue ?? player.val_now ?? player.playerDetails?.valueProfile?.dynastyValue ?? player.seasonValue;

  return getPlayerValueForMode({
    valueProfile: player.playerDetails?.valueProfile,
    fallbackValue,
    mode,
    context: mode === 'redraft' ? 'starter' : 'rankings',
  });
}

function getAutopilotPlayerRank(player?: AutopilotPlayerLike | null, mode: AutopilotMode = 'dynasty') {
  if (!player) return null;
  return getPlayerRankForMode({
    valueProfile: player.playerDetails?.valueProfile,
    fallbackRank: mode === 'redraft'
      ? player.seasonPositionRank || player.currentPositionRank || getPlayerPosition(player)
      : player.currentPositionRank || player.seasonPositionRank || getPlayerPosition(player),
    mode,
    context: mode === 'redraft' ? 'starter' : 'rankings',
  });
}

function describePlayer(player?: AutopilotPlayerLike | null, mode: AutopilotMode = 'dynasty') {
  if (!player) return null;
  const rank = getAutopilotPlayerRank(player, mode);
  const value = getAutopilotPlayerValue(player, mode);
  const parts = [
    rank,
    value ? `${formatCompactValue(value)} value` : null,
    getPlayerAge(player) ? `age ${getPlayerAge(player)}` : null,
  ].filter(Boolean);
  return parts.join(' | ') || getPlayerPosition(player);
}

function getFocusManager(data: ReportData, fallback: AutopilotData): string {
  return data.viewerManager
    || data.managerRosterIntelligence?.[0]?.manager
    || data.powerRankings?.[0]?.manager
    || data.currentStandings?.[0]?.manager
    || fallback.focusManager
    || fallback.power[0]?.team
    || 'Selected team';
}

function findManagerIntel(data: ReportData, manager?: string | null): ManagerRosterIntelligence | null {
  if (!manager) return data.managerRosterIntelligence?.[0] || null;
  return data.managerRosterIntelligence?.find((row) => sameManager(row.manager, manager))
    || data.managerRosterIntelligence?.[0]
    || null;
}

function findPowerRanking(data: ReportData, manager?: string | null): PowerRanking | null {
  if (!manager) return data.powerRankings?.[0] || null;
  return data.powerRankings?.find((row) => sameManager(row.manager, manager))
    || data.powerRankings?.[0]
    || null;
}

function findStanding(data: ReportData, manager?: string | null) {
  if (!manager) return data.currentStandings?.[0] || null;
  return data.currentStandings?.find((row) => sameManager(row.manager, manager))
    || data.currentStandings?.[0]
    || null;
}

function findTradeTendency(data: ReportData, manager?: string | null) {
  if (!manager) return data.tradeTendencies?.[0] || null;
  return data.tradeTendencies?.find((row) => sameManager(row.manager, manager))
    || data.tradeTendencies?.[0]
    || null;
}

function findPickPortfolio(data: ReportData, manager?: string | null) {
  if (!manager) return data.pickPortfolios?.[0] || null;
  return data.pickPortfolios?.find((row) => sameManager(row.manager, manager))
    || data.pickPortfolios?.[0]
    || null;
}

function findTimeline(data: ReportData, manager?: string | null) {
  if (!manager) return data.dynastyTimelines?.[0] || null;
  return data.dynastyTimelines?.find((row) => sameManager(row.manager, manager))
    || data.dynastyTimelines?.[0]
    || null;
}

function getMatchupPreview(data: ReportData, manager?: string | null): MatchupPreview | null {
  if (!manager) return data.matchupPreviews?.[0] || null;
  return data.matchupPreviews?.find((row) => sameManager(row.manager, manager))
    || data.matchupPreviews?.[0]
    || null;
}

function getBestStarter(managerRow?: ReportData['managerPositionCounts'][number] | null, mode: AutopilotMode = 'dynasty') {
  return [...(managerRow?.starterPlayers || [])].sort((a, b) => {
    const aValue = getAutopilotPlayerValue(a, mode) || 0;
    const bValue = getAutopilotPlayerValue(b, mode) || 0;
    return bValue - aValue;
  })[0] || null;
}

function findManagerPositionRow(data: ReportData, manager?: string | null) {
  if (!manager) return data.managerPositionCounts?.[0] || null;
  return data.managerPositionCounts?.find((row) => sameManager(row.manager, manager))
    || data.managerPositionCounts?.[0]
    || null;
}

function getDirectionLabel(
  mode: AutopilotMode,
  intel: ManagerRosterIntelligence | null,
  power: PowerRanking | null,
  standing: ReturnType<typeof findStanding>,
  timeline: ReturnType<typeof findTimeline>,
  leagueSize: number,
) {
  if (mode === 'redraft') {
    const rank = standing?.rank || power?.rank || null;
    if (rank && rank <= Math.max(1, Math.ceil(leagueSize * 0.33))) return 'Win-now push';
    if (rank && rank <= Math.ceil(leagueSize * 0.67)) return 'Playoff hunt';
    return 'Waiver chase';
  }

  const source = `${intel?.identity || ''} ${intel?.timeline || ''} ${timeline?.label || ''}`.toLowerCase();
  if (source.includes('rebuild')) return 'Rebuild path';
  if (source.includes('contender') || source.includes('juggernaut') || source.includes('win-now')) return 'Contender';
  if (source.includes('reload')) return 'Reload';
  if (source.includes('middle')) return 'Middle contender';
  return power?.rank && power.rank <= Math.max(1, Math.ceil(leagueSize * 0.33)) ? 'Contender' : 'Middle contender';
}

function buildSystemRead(data: ReportData): AutopilotScore[] {
  const leagueSize = getLeagueSize(data);
  const rosterRows = data.managerRosterIntelligence?.length || 0;
  const profileCount = Object.values(data.playerDetailsById || {}).filter((player) => player.valueProfile).length;
  const historySeasons = new Set((data.standingsHistory || []).map((row) => row.season)).size;
  const marketSignals = [
    data.rankings,
    data.weeklyRisers?.length,
    data.weeklyFallers?.length,
    data.waiverIntelligence,
    profileCount > 20,
  ].filter(Boolean).length;

  return [
    {
      label: 'Roster data',
      value: clampPercent(42 + Math.min(46, (rosterRows / leagueSize) * 46) + (data.managerPositionCounts?.length ? 10 : 0)),
      tone: rosterRows ? 'good' : 'warn',
    },
    {
      label: 'Market signal',
      value: clampPercent(28 + marketSignals * 14 + Math.min(18, profileCount / 14)),
      tone: marketSignals >= 3 ? 'good' : marketSignals >= 2 ? 'info' : 'warn',
    },
    {
      label: 'History depth',
      value: clampPercent(20 + Math.min(42, (data.tradeHistory?.length || 0) * 2) + Math.min(28, historySeasons * 7)),
      tone: historySeasons >= 3 ? 'good' : historySeasons >= 1 || data.tradeHistory?.length ? 'info' : 'warn',
    },
    {
      label: 'Schedule data',
      value: data.matchupPreviews?.length ? clampPercent(54 + Math.min(34, data.matchupPreviews.length * 8)) : 0,
      tone: data.matchupPreviews?.length ? 'info' : 'neutral',
    },
  ];
}

function buildDirection(data: ReportData, mode: AutopilotMode, manager: string, fallback: AutopilotData['direction']): AutopilotData['direction'] {
  const intel = findManagerIntel(data, manager);
  const power = findPowerRanking(data, manager);
  const standing = findStanding(data, manager);
  const timeline = findTimeline(data, manager);
  const tradeTendency = findTradeTendency(data, manager);
  const portfolio = findPickPortfolio(data, manager);
  const leagueSize = getLeagueSize(data);
  const allPickValues = (data.pickPortfolios || []).map((row) => row.totalValue).filter((value) => value > 0);
  const maxPickValue = Math.max(...allPickValues, 1);

  const standingScore = scoreFromRank(standing?.rank, leagueSize);
  const powerScore = safeNumber(power?.score);
  const starterScore = safeNumber(power?.starterStrength);
  const seasonStarterScore = intel?.starterSeasonValue
    ? clampPercent((intel.starterSeasonValue / Math.max(1, ...((data.managerRosterIntelligence || []).map((row) => row.starterSeasonValue || row.starterValue)))) * 100)
    : null;
  const winNowScore = averageNumbers([standingScore, powerScore, starterScore, seasonStarterScore]) ?? fallback.scores[0]?.value ?? 65;

  const youthScore = safeNumber(power?.youthScore);
  const draftCapitalScore = safeNumber(power?.draftCapital);
  const ageScore = intel?.avgAge ? clampPercent(104 - intel.avgAge * 2.6) : null;
  const pickScore = portfolio?.totalValue ? clampPercent((portfolio.totalValue / maxPickValue) * 100) : null;
  const timelineScore = timeline ? clampPercent((timeline.outlook2027 || 0) * 0.55 + (timeline.rebuildScore || 0) * 0.25 + (100 - (timeline.agingRisk || 0)) * 0.2) : null;
  const futureScore = averageNumbers([youthScore, draftCapitalScore, ageScore, pickScore, timelineScore, intel?.youngCorePlayer ? 78 : null]) ?? fallback.scores[1]?.value ?? 55;

  const tradeScore = averageNumbers([
    safeNumber(power?.tradeEfficiency),
    tradeTendency ? clampPercent(45 + Math.min(26, tradeTendency.tradeCount * 4) + Math.min(18, Math.max(0, tradeTendency.winPct - 50) * 0.8)) : null,
    intel?.tradeChip || intel?.sellCandidate || intel?.buyTarget ? 78 : null,
    intel?.benchValue && intel?.starterValue ? clampPercent((intel.benchValue / Math.max(1, intel.starterValue)) * 120) : null,
  ]) ?? fallback.scores[2]?.value ?? 60;

  const directionScores: AutopilotScore[] = mode === 'redraft'
    ? [
      { label: 'Weekly ceiling', value: winNowScore, tone: scoreTone(winNowScore) },
      { label: 'Floor safety', value: averageNumbers([starterScore, standingScore, intel?.rosterHealthScore]) ?? 62, tone: scoreTone(averageNumbers([starterScore, standingScore, intel?.rosterHealthScore]) ?? 62) },
      { label: 'Bench utility', value: averageNumbers([tradeScore, intel?.benchValue && intel?.starterValue ? clampPercent((intel.benchValue / Math.max(1, intel.starterValue)) * 110) : null]) ?? tradeScore, tone: scoreTone(tradeScore) },
    ]
    : [
      { label: 'Win-now push', value: winNowScore, tone: scoreTone(winNowScore) },
      { label: 'Future value', value: futureScore, tone: scoreTone(futureScore) },
      { label: 'Trade leverage', value: tradeScore, tone: scoreTone(tradeScore) },
    ];

  const label = getDirectionLabel(mode, intel, power, standing, timeline, leagueSize);
  const summary = shortenText(intel?.strategySummary || intel?.summary, 230)
    || (mode === 'redraft'
      ? `${manager} should optimize current-season starter points first. Future dynasty value is ignored while this mode is active.`
      : `${manager} grades as ${label.toLowerCase()} with ${Math.round(winNowScore)} win-now strength and ${Math.round(futureScore)} future-value support.`);
  const strategy = shortenText(intel?.tradePlan?.summary || intel?.pressurePoints?.[0] || intel?.marketSignals?.[0], 220)
    || (mode === 'redraft'
      ? 'Turn replaceable bench value into weekly starters and waiver players with clear immediate roles.'
      : 'Protect young liquid assets, use surplus depth in trades, and only buy short-window production when it changes the weekly lineup.');

  const topWaiver = collectWaiverCandidates(data, mode, intel)[0];
  const actionPlan = dedupeStrings([
    intel?.tradePlan?.summary,
    mode === 'dynasty' && intel?.sellCandidate ? `Shop ${intel.sellCandidate.name} before the market prices in age, role, or roster-window risk.` : null,
    mode === 'dynasty' && intel?.youngCorePlayer ? `Build around ${intel.youngCorePlayer.name}; do not move that type of asset without a clear tier-up.` : null,
    mode === 'redraft' && intel?.weakestStarter ? `Pressure-test ${intel.weakestStarter.name} as the first lineup spot to upgrade.` : null,
    topWaiver ? `Check waivers for ${topWaiver.name}; it is the strongest available fit in the current report data.` : null,
    portfolio && mode === 'dynasty' ? `Use ${portfolio.count2026 + portfolio.count2027} tracked future picks as leverage, not throw-ins.` : null,
    ...fallback.actionPlan,
  ], 3);

  return {
    label,
    confidence: confidenceFromSignals(50, [intel, power, standing, timeline, tradeTendency, portfolio, data.waiverIntelligence], data.matchupPreviews?.length ? 0 : 4),
    summary,
    strategy,
    scores: directionScores,
    actionPlan,
  };
}

function recommendationConfidence(base: number, recommendationSignals: Array<unknown>) {
  return confidenceFromSignals(base, recommendationSignals, recommendationSignals.includes(null) ? 4 : 0);
}

function buildLineupRecommendations(data: ReportData, mode: AutopilotMode, manager: string, fallback: AutopilotRecommendation[]): AutopilotRecommendation[] {
  const intel = findManagerIntel(data, manager);
  const managerPositionRow = findManagerPositionRow(data, manager);
  const matchup = getMatchupPreview(data, manager);
  const bestStarter = getBestStarter(managerPositionRow, mode);
  const cards: AutopilotRecommendation[] = [];

  const mustStart = matchup?.mustStarts?.[0] || bestStarter || intel?.youngCorePlayer || intel?.lastSeasonStud;
  if (mustStart) {
    cards.push({
      id: `lineup-start-${mustStart.player_id || mustStart.name}`,
      type: 'Start/Sit',
      player: getPlayerName(mustStart),
      secondary: describePlayer(mustStart, mode) || undefined,
      action: 'Start',
      confidence: recommendationConfidence(matchup?.mustStarts?.length ? 70 : 62, [matchup, bestStarter, getAutopilotPlayerRank(mustStart, mode), getAutopilotPlayerValue(mustStart, mode)]),
      risk: matchup?.boomBustRisks?.some((risk) => risk.player_id === mustStart.player_id) ? 'Medium' : 'Low',
      upside: (getAutopilotPlayerValue(mustStart, mode) || 0) > 5000 ? 'Elite' : 'High',
      summary: matchup?.howToWin
        ? shortenText(matchup.howToWin, 170) || `${getPlayerName(mustStart)} is the clearest weekly starter in this report.`
        : `${getPlayerName(mustStart)} is the strongest currently identified starter profile for ${manager}.`,
      reasons: dedupeStrings([
        matchup?.mustStarts?.length ? 'Matchup preview marks this as a must-start profile.' : 'Projected starter value is leading this roster read.',
        getAutopilotPlayerRank(mustStart, mode) ? `${getAutopilotPlayerRank(mustStart, mode)} rank supports the lineup call.` : null,
        mode === 'redraft' ? 'Redraft mode prioritizes bankable weekly points over future value.' : 'Dynasty mode still respects current lineup pressure when the roster can compete.',
      ], 3),
      signals: dedupeStrings(['Starter value', matchup ? 'Matchup preview' : null, getAutopilotPlayerRank(mustStart, mode), mode === 'redraft' ? 'Season lens' : 'Dynasty lens'], 4),
      tone: 'good',
    });
  }

  const vulnerable = matchup?.vulnerableSpots?.[0] || matchup?.boomBustRisks?.[0] || intel?.weakestStarter;
  if (vulnerable) {
    cards.push({
      id: `lineup-risk-${vulnerable.player_id || vulnerable.name}`,
      type: 'Bench Risk',
      player: getPlayerName(vulnerable),
      secondary: intel?.injuryInsurance ? `cover: ${intel.injuryInsurance.name}` : describePlayer(vulnerable, mode) || undefined,
      action: 'Review before lock',
      confidence: recommendationConfidence(matchup?.vulnerableSpots?.length ? 68 : 58, [matchup, intel?.weakestStarter, intel?.injuryInsurance]),
      risk: 'Medium',
      upside: 'Medium',
      summary: `${getPlayerName(vulnerable)} is the first starter spot the AI would pressure-test before lineups lock.`,
      reasons: dedupeStrings([
        matchup?.vulnerableSpots?.length ? 'Matchup preview flags this slot as vulnerable.' : 'Roster intelligence marks this as the weakest starter.',
        intel?.injuryInsurance ? `${intel.injuryInsurance.name} is the best internal insurance read.` : null,
        mode === 'redraft' ? 'Short-term role certainty matters more than player name value.' : 'Do not force a low-ceiling veteran if the roster has a better value-growth path.',
      ], 3),
      signals: dedupeStrings(['Weak starter', matchup ? 'Matchup risk' : null, intel?.starterAvailability?.riskLevel ? `${intel.starterAvailability.riskLevel} availability` : null], 4),
      tone: 'warn',
    });
  }

  return cards.length ? cards.slice(0, 2) : fallback;
}

function collectWaiverCandidates(data: ReportData, mode: AutopilotMode, intel?: ManagerRosterIntelligence | null): TrendingPlayer[] {
  const waiver = data.waiverIntelligence;
  if (!waiver) return [];
  const candidates = [
    ...(waiver.availableTrendingAdds || []),
    waiver.highestKtcAvailable,
    ...(waiver.bestTaxiStashes || []),
    ...(waiver.recentlyDroppedValuable || []),
    ...Object.values(waiver.bestAvailableByPosition || {}),
  ].filter((player): player is TrendingPlayer => Boolean(player?.name));
  const seen = new Set<string>();
  return candidates
    .filter((player) => {
      const key = player.player_id || player.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => scoreWaiverCandidate(b, mode, intel) - scoreWaiverCandidate(a, mode, intel));
}

function scoreWaiverCandidate(player: TrendingPlayer, mode: AutopilotMode, intel?: ManagerRosterIntelligence | null) {
  const value = getAutopilotPlayerValue(player, mode) || 0;
  const rank = parsePositionRankValue(getAutopilotPlayerRank(player, mode));
  const age = getPlayerAge(player);
  const position = getPlayerPosition(player);
  const needBonus = intel?.tradePlan?.needPosition === position ? 18 : 0;
  const youngBonus = mode === 'dynasty' && age && age <= 24 ? 13 : 0;
  const roleBonus = mode === 'redraft' && rank && rank <= 45 ? 14 : 0;
  return Math.min(100, value / 115 + Math.min(22, (player.count || 0) / 8) + (rank ? Math.max(0, 22 - rank / 3) : 0) + needBonus + youngBonus + roleBonus);
}

function getFaabSuggestion(confidence: number, mode: AutopilotMode) {
  if (confidence >= 84) return mode === 'redraft' ? 'FAAB 12-18%' : 'FAAB 8-14%';
  if (confidence >= 74) return mode === 'redraft' ? 'FAAB 7-11%' : 'FAAB 5-8%';
  return mode === 'redraft' ? 'FAAB 3-6%' : 'FAAB 1-4%';
}

function buildWaiverRecommendations(data: ReportData, mode: AutopilotMode, manager: string, fallback: AutopilotRecommendation[]): AutopilotRecommendation[] {
  const intel = findManagerIntel(data, manager);
  const candidates = collectWaiverCandidates(data, mode, intel).slice(0, 2);
  const dropCandidate = intel?.droppablePlayers?.[0] || null;
  if (!candidates.length) return fallback;

  return candidates.map((player, index) => {
    const score = scoreWaiverCandidate(player, mode, intel);
    const confidence = clampPercent(56 + score * 0.35 + (dropCandidate ? 5 : 0));
    const rank = getAutopilotPlayerRank(player, mode);
    const age = getPlayerAge(player);
    return {
      id: `waiver-${player.player_id || player.name}`,
      type: 'Waiver',
      player: player.name,
      secondary: [getFaabSuggestion(confidence, mode), dropCandidate ? `drop ${dropCandidate.name}` : null].filter(Boolean).join(' | '),
      action: index === 0 ? 'Priority add' : 'Add if available',
      confidence,
      risk: confidence >= 78 ? 'Low' : 'Medium',
      upside: mode === 'dynasty' && age && age <= 24 ? 'High' : confidence >= 80 ? 'High' : 'Medium',
      summary: mode === 'redraft'
        ? `${player.name} is the best available current-season profile from the waiver data, with trend count and rank/value support.`
        : `${player.name} is the best available stash or value-growth profile from the waiver data.`,
      reasons: dedupeStrings([
        player.count ? `${formatCompactValue(player.count)} add/drop trend signal in the feed.` : null,
        rank ? `${rank} rank gives this more than a blind trend-chase case.` : null,
        intel?.tradePlan?.needPosition === getPlayerPosition(player) ? `Matches ${manager}'s ${getPlayerPosition(player)} need.` : null,
        dropCandidate ? `${dropCandidate.name} is a usable drop candidate if a roster spot is needed.` : null,
      ], 4),
      signals: dedupeStrings(['Available', rank, player.count ? 'Trend count' : null, mode === 'dynasty' && age && age <= 24 ? 'Young stash' : null], 4),
      tone: index === 0 ? 'good' : 'info',
    };
  });
}

function findTradePartner(data: ReportData, manager: string, needPosition?: string | null, surplusPosition?: string | null) {
  const partnerByNeed = data.positionDepth?.find((row) => row.position === needPosition && row.status === 'excess' && !sameManager(row.manager, manager));
  if (partnerByNeed) return partnerByNeed.manager;
  const partnerBySurplus = data.positionDepth?.find((row) => row.position === surplusPosition && row.status === 'shortage' && !sameManager(row.manager, manager));
  return partnerBySurplus?.manager || null;
}

function buildTradeRecommendations(data: ReportData, mode: AutopilotMode, manager: string, fallback: AutopilotRecommendation[]): AutopilotRecommendation[] {
  const intel = findManagerIntel(data, manager);
  if (!intel) return fallback;

  const partner = findTradePartner(data, manager, intel.tradePlan?.needPosition, intel.tradePlan?.surplusPosition);
  const cards: AutopilotRecommendation[] = [];

  (intel.tradeBlueprints || []).slice(0, 2).forEach((blueprint, index) => {
    const player = blueprint.givePlayer || blueprint.getPlayer || intel.sellCandidate || intel.buyTarget;
    if (!player) return;
    const isSell = blueprint.tone === 'sell' || blueprint.givePlayer;
    cards.push({
      id: `trade-blueprint-${index}-${player.player_id || player.name}`,
      type: 'Trade',
      player: getPlayerName(player),
      secondary: partner ? `target partner: ${partner}` : describePlayer(player, mode) || undefined,
      action: isSell ? 'Trade away' : 'Acquire',
      confidence: recommendationConfidence(66, [blueprint, player, partner, intel.tradePlan]),
      risk: blueprint.tone === 'risk' ? 'High' : 'Medium',
      upside: blueprint.tone === 'value' || blueprint.tone === 'buy' ? 'High' : 'Medium',
      summary: shortenText(blueprint.summary, 190) || `${getPlayerName(player)} is the cleanest trade lever in the current roster read.`,
      reasons: dedupeStrings([
        intel.tradePlan?.summary,
        partner ? `${partner} has the matching position-depth signal.` : null,
        mode === 'dynasty' ? 'Dynasty mode weighs age curve, value liquidity, and future picks.' : 'Redraft mode only cares about current-season starter points.',
      ], 3),
      signals: dedupeStrings([blueprint.label, blueprint.tone, intel.tradePlan?.needPosition ? `Need ${intel.tradePlan.needPosition}` : null, intel.tradePlan?.surplusPosition ? `Surplus ${intel.tradePlan.surplusPosition}` : null], 4),
      tone: isSell ? 'warn' : 'good',
    });
  });

  if (cards.length < 2 && intel.sellCandidate) {
    cards.push({
      id: `trade-sell-${intel.sellCandidate.player_id || intel.sellCandidate.name}`,
      type: 'Trade',
      player: intel.sellCandidate.name,
      secondary: partner ? `shop to ${partner}` : describePlayer(intel.sellCandidate, mode) || undefined,
      action: 'Trade away',
      confidence: recommendationConfidence(mode === 'dynasty' ? 68 : 62, [intel.sellCandidate, intel.tradePlan, partner, intel.marketSignals?.length]),
      risk: 'Medium',
      upside: mode === 'dynasty' ? 'High' : 'Medium',
      summary: mode === 'dynasty'
        ? `${intel.sellCandidate.name} is the best sell candidate if this roster needs to protect future value or convert fragile production.`
        : `${intel.sellCandidate.name} is the best trade-away candidate if the return upgrades a weekly starter slot.`,
      reasons: dedupeStrings([intel.tradePlan?.summary, intel.marketSignals?.[0], intel.pressurePoints?.[0]], 3),
      signals: dedupeStrings(['Sell candidate', partner ? 'Partner fit' : null, intel.tradePlan?.surplusPosition ? `Surplus ${intel.tradePlan.surplusPosition}` : null], 4),
      tone: 'warn',
    });
  }

  if (cards.length < 2 && intel.buyTarget) {
    cards.push({
      id: `trade-buy-${intel.buyTarget.player_id || intel.buyTarget.name}`,
      type: 'Trade',
      player: intel.buyTarget.name,
      secondary: partner ? `start with ${partner}` : describePlayer(intel.buyTarget, mode) || undefined,
      action: 'Acquire',
      confidence: recommendationConfidence(66, [intel.buyTarget, intel.tradePlan, partner, intel.similarValuePlayers]),
      risk: 'Medium',
      upside: 'High',
      summary: `${intel.buyTarget.name} is the cleanest external target profile for this roster's current need.`,
      reasons: dedupeStrings([intel.tradePlan?.summary, mode === 'redraft' ? 'The target improves current-season scoring.' : 'The target fits the roster window better than a generic best-player trade.'], 3),
      signals: dedupeStrings(['Buy target', partner ? 'Partner fit' : null, intel.tradePlan?.needPosition ? `Need ${intel.tradePlan.needPosition}` : null], 4),
      tone: 'good',
    });
  }

  return cards.length ? cards.slice(0, 2) : fallback;
}

function buildMomentumProjection(player: WeeklyMomentum, direction: ValueDirection, mode: AutopilotMode): PlayerProjection {
  const tone = getDirectionTone(direction);
  const value = getAutopilotPlayerValue(player, mode) || player.val_now;
  const confidence = clampPercent(58 + Math.min(25, Math.abs(player.pct_change || 0) * 1.4) + (player.playerDetails?.valueProfile ? 8 : 0));
  return {
    player: player.name,
    position: getPlayerPosition(player),
    direction,
    currentValue: [getAutopilotPlayerRank(player, mode), formatCompactValue(value)].filter(Boolean).join(' | '),
    projectedMove: formatSignedPercent(player.pct_change),
    confidence,
    signals: dedupeStrings([
      direction === 'Rising' ? '7-day value gain' : '7-day value drop',
      player.owner ? `Owned by ${player.owner}` : null,
      getAutopilotPlayerRank(player, mode),
      tone === 'good' ? 'Market momentum' : 'Sell pressure',
    ], 4),
  };
}

function buildProjectedValueProjection(player: PlayerInfo, direction: ValueDirection, mode: AutopilotMode): PlayerProjection {
  const value = getAutopilotPlayerValue(player, mode) || player.val_2027 || player.val_2026;
  return {
    player: player.name,
    position: getPlayerPosition(player),
    direction,
    currentValue: [getAutopilotPlayerRank(player, mode), formatCompactValue(value)].filter(Boolean).join(' | '),
    projectedMove: `${(player.diff || 0) >= 0 ? '+' : ''}${formatCompactValue(player.diff || 0)}`,
    confidence: confidenceFromSignals(60, [player.diff, player.playerDetails, player.currentPositionRank, player.age]),
    signals: dedupeStrings([
      direction === 'Rising' ? 'Projected value gain' : 'Projected value loss',
      player.owner ? `Owned by ${player.owner}` : null,
      getPlayerAge(player) ? `Age ${getPlayerAge(player)}` : null,
      getAutopilotPlayerRank(player, mode),
    ], 4),
  };
}

function buildPlayerProjections(data: ReportData, mode: AutopilotMode, fallback: PlayerProjection[]): PlayerProjection[] {
  const projections: PlayerProjection[] = [];
  const seen = new Set<string>();
  const addProjection = (projection: PlayerProjection) => {
    const key = projection.player.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    projections.push(projection);
  };

  [...(data.weeklyRisers || [])]
    .sort((a, b) => Math.abs(b.pct_change || 0) - Math.abs(a.pct_change || 0))
    .slice(0, 2)
    .forEach((player) => addProjection(buildMomentumProjection(player, 'Rising', mode)));

  [...(data.weeklyFallers || [])]
    .sort((a, b) => Math.abs(b.pct_change || 0) - Math.abs(a.pct_change || 0))
    .slice(0, 2)
    .forEach((player) => addProjection(buildMomentumProjection(player, 'Falling', mode)));

  if (projections.length < 4) {
    [...(data.projectedRisers || [])].slice(0, 2).forEach((player) => addProjection(buildProjectedValueProjection(player, 'Rising', mode)));
    [...(data.projectedFallers || [])].slice(0, 2).forEach((player) => addProjection(buildProjectedValueProjection(player, 'Falling', mode)));
  }

  return projections.length ? projections.slice(0, 4) : fallback;
}

function buildPowerRows(data: ReportData, mode: AutopilotMode, fallback: LeaguePowerRow[]): LeaguePowerRow[] {
  const rows = data.powerRankings?.length
    ? data.powerRankings.slice(0, 6).map((row): LeaguePowerRow => {
      const intel = findManagerIntel(data, row.manager);
      const timeline = findTimeline(data, row.manager);
      const standings = findStanding(data, row.manager);
      const direction = mode === 'redraft'
        ? standings?.rank && standings.rank <= Math.max(1, Math.ceil(getLeagueSize(data) * 0.33)) ? 'Win-now' : 'Playoff chase'
        : timeline?.label || intel?.identity || row.tier;
      return {
        rank: row.rank,
        team: row.manager,
        direction,
        score: clampPercent(row.score),
        note: shortenText(intel?.summary, 130)
          || `${row.tier} tier with ${Math.round(row.starterStrength)} starter strength and ${Math.round(row.positionalBalance)} balance.`,
        tone: scoreTone(row.score),
      };
    })
    : [];

  return rows.length ? rows : fallback;
}

function buildScheduleTodo(data: ReportData, mode: AutopilotMode): string[] {
  if (data.matchupPreviews?.length) {
    return [
      `${data.matchupPreviews.length} matchup preview${data.matchupPreviews.length === 1 ? '' : 's'} are available for weekly lineup context.`,
      'Next layer: weight defensive schedule strength by position instead of treating every matchup note equally.',
      mode === 'redraft'
        ? 'Use SOS to separate streamers and same-tier flex plays.'
        : 'Use SOS for playoff-window planning without overpowering long-term player value.',
    ];
  }

  return [
    'Add weekly defensive matchup scoring when the league schedule is released.',
    'Compare playoff-week opponent strength for each starter.',
    mode === 'redraft'
      ? 'Blend matchup difficulty into start/sit, streamer, and waiver confidence.'
      : 'Blend matchup difficulty into start/sit confidence without overpowering talent, role, and dynasty value.',
  ];
}

function buildAutopilotData({ reportData, mode, fallback }: AutopilotBuildInput): AutopilotData {
  if (!reportData) return fallback;

  const focusManager = getFocusManager(reportData, fallback);
  const direction = buildDirection(reportData, mode, focusManager, fallback.direction);
  const leagueSize = getLeagueSize(reportData);

  return {
    mode,
    focusManager,
    dataStatus: 'Live report data',
    headline: mode === 'redraft'
      ? `${focusManager} win-now cockpit`
      : `${focusManager} dynasty cockpit`,
    direction,
    systemRead: buildSystemRead(reportData),
    lineup: buildLineupRecommendations(reportData, mode, focusManager, fallback.lineup),
    waivers: buildWaiverRecommendations(reportData, mode, focusManager, fallback.waivers),
    trades: buildTradeRecommendations(reportData, mode, focusManager, fallback.trades),
    projections: buildPlayerProjections(reportData, mode, fallback.projections),
    power: buildPowerRows(reportData, mode, fallback.power),
    scheduleTodo: buildScheduleTodo(reportData, mode),
  };
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getRiskTone(risk: AutopilotRecommendation['risk']): AutopilotTone {
  if (risk === 'Low') return 'good';
  if (risk === 'High') return 'danger';
  return 'warn';
}

function getDirectionTone(direction: ValueDirection): AutopilotTone {
  if (direction === 'Rising') return 'good';
  if (direction === 'Falling') return 'danger';
  return 'info';
}

function ConfidenceMeter({
  value,
  label = 'Confidence',
  tone = 'info',
  compact = false,
}: {
  value: number;
  label?: string;
  tone?: AutopilotTone;
  compact?: boolean;
}) {
  const percent = clampPercent(value);
  return (
    <div className={cn('autopilot-confidence', compact && 'autopilot-confidence-compact', `autopilot-tone-${tone}`)}>
      <span>{label}</span>
      <strong>{percent}%</strong>
      <em role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`${label} ${percent}%`}>
        <i style={{ width: `${percent}%` }} />
      </em>
    </div>
  );
}

function SignalPills({ signals }: { signals: string[] }) {
  return (
    <div className="autopilot-signal-row">
      {signals.map((signal) => (
        <span key={signal}>{signal}</span>
      ))}
    </div>
  );
}

function SectionShell({
  eyebrow,
  title,
  icon: Icon,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('autopilot-section', className)}>
      <div className="autopilot-section-heading">
        <span>
          <Icon className="h-4 w-4" aria-hidden="true" />
          {eyebrow}
        </span>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ScoreTile({ score }: { score: AutopilotScore }) {
  const percent = clampPercent(score.value);
  return (
    <div className={cn('autopilot-score-tile', `autopilot-tone-${score.tone}`)}>
      <span>{score.label}</span>
      <strong>{percent}</strong>
      <em aria-hidden="true">
        <i style={{ width: `${percent}%` }} />
      </em>
    </div>
  );
}

function RecommendationCard({
  recommendation,
  queued,
  onToggleQueue,
}: {
  recommendation: AutopilotRecommendation;
  queued: boolean;
  onToggleQueue: (id: string) => void;
}) {
  return (
    <article className={cn('autopilot-recommendation-card', `autopilot-tone-${recommendation.tone}`)}>
      <div className="autopilot-card-topline">
        <span>{recommendation.type}</span>
        <ConfidenceMeter value={recommendation.confidence} tone={recommendation.tone} compact />
      </div>
      <div className="autopilot-card-main">
        <div>
          <span className="autopilot-action-label">{recommendation.action}</span>
          <h4>{recommendation.player}</h4>
          {recommendation.secondary && <p>{recommendation.secondary}</p>}
        </div>
      </div>
      <p className="autopilot-card-summary">{recommendation.summary}</p>
      <div className="autopilot-card-badges">
        <span className={cn('autopilot-risk-pill', `autopilot-tone-${getRiskTone(recommendation.risk)}`)}>Risk {recommendation.risk}</span>
        <span className="autopilot-upside-pill">Upside {recommendation.upside}</span>
      </div>
      <details className="autopilot-reasoning">
        <summary>
          Why the AI thinks this
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </summary>
        <ul>
          {recommendation.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <SignalPills signals={recommendation.signals} />
      </details>
      <button
        type="button"
        className={cn('autopilot-action-button', queued && 'is-queued')}
        aria-pressed={queued}
        onClick={() => onToggleQueue(recommendation.id)}
      >
        {queued ? 'Queued' : 'Queue action'}
      </button>
    </article>
  );
}

function ProjectionRow({ projection }: { projection: PlayerProjection }) {
  const tone = getDirectionTone(projection.direction);
  const Icon = projection.direction === 'Rising' ? TrendingUp : projection.direction === 'Falling' ? TrendingDown : Activity;
  return (
    <article className={cn('autopilot-projection-row', `autopilot-tone-${tone}`)}>
      <div className="autopilot-projection-player">
        <span>{projection.position}</span>
        <strong>{projection.player}</strong>
      </div>
      <div className="autopilot-projection-status">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{projection.direction}</span>
        <strong>{projection.projectedMove}</strong>
      </div>
      <div className="autopilot-projection-value">
        <span>Current</span>
        <strong>{projection.currentValue}</strong>
      </div>
      <ConfidenceMeter value={projection.confidence} tone={tone} compact />
      <SignalPills signals={projection.signals} />
    </article>
  );
}

function PowerRow({ row }: { row: LeaguePowerRow }) {
  return (
    <article className={cn('autopilot-power-row', `autopilot-tone-${row.tone}`)}>
      <span className="autopilot-power-rank">#{row.rank}</span>
      <div>
        <strong>{row.team}</strong>
        <span>{row.direction}</span>
      </div>
      <ConfidenceMeter value={row.score} label="Power" tone={row.tone} compact />
      <p>{row.note}</p>
    </article>
  );
}

function ModeButton({
  mode,
  active,
  children,
  onClick,
}: {
  mode: AutopilotMode;
  active: boolean;
  children: ReactNode;
  onClick: (mode: AutopilotMode) => void;
}) {
  return (
    <button
      type="button"
      className={cn('autopilot-mode-button', active && 'is-active')}
      aria-pressed={active}
      onClick={() => onClick(mode)}
    >
      {children}
    </button>
  );
}

export default function AITeamAutopilot({
  reportData,
  leagueName,
  leagueFormat,
  leagueValueMode,
}: {
  reportData?: ReportData;
  leagueName?: string;
  leagueFormat?: string;
  leagueValueMode?: LeagueValueMode;
}) {
  const initialMode = leagueValueMode === 'redraft' ? 'redraft' : 'dynasty';
  const [mode, setMode] = useState<AutopilotMode>(initialMode);
  const [queuedIds, setQueuedIds] = useState<Set<string>>(() => new Set());
  const data = useMemo(
    () => buildAutopilotData({ reportData, mode, fallback: AUTOPILOT_DATA[mode] }),
    [mode, reportData]
  );
  const queuedCount = queuedIds.size;
  const allRecommendations = useMemo(
    () => [...data.lineup, ...data.waivers, ...data.trades],
    [data]
  );

  const toggleQueue = (id: string) => {
    setQueuedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section className="autopilot-dashboard" data-mode={mode}>
      <div className="autopilot-hero">
        <div className="autopilot-hero-copy">
          <span className="autopilot-system-badge">
            <BrainCircuit className="h-4 w-4" aria-hidden="true" />
            AI Team Autopilot
          </span>
          <h2>{data.headline}</h2>
          <p>{data.focusManager ? `${data.focusManager} read` : leagueName || 'Selected league'}{leagueFormat ? ` · ${leagueFormat}` : ''}</p>
        </div>
        <div className="autopilot-mode-toggle" aria-label="Autopilot league mode">
          <ModeButton mode="dynasty" active={mode === 'dynasty'} onClick={setMode}>Dynasty</ModeButton>
          <ModeButton mode="redraft" active={mode === 'redraft'} onClick={setMode}>Redraft</ModeButton>
        </div>
      </div>

      <div className="autopilot-status-grid">
        {data.systemRead.map((score) => (
          <ScoreTile key={score.label} score={score} />
        ))}
      </div>

      <section className="autopilot-direction-panel">
        <div className="autopilot-direction-read">
          <span>Team Direction</span>
          <h3>{data.direction.label}</h3>
          <p>{data.direction.summary}</p>
          <ConfidenceMeter value={data.direction.confidence} tone="good" />
        </div>
        <div className="autopilot-direction-scores">
          {data.direction.scores.map((score) => (
            <ScoreTile key={score.label} score={score} />
          ))}
        </div>
        <div className="autopilot-strategy-card">
          <span>Suggested strategy</span>
          <p>{data.direction.strategy}</p>
          <ul>
            {data.direction.actionPlan.map((item) => (
              <li key={item}>
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="autopilot-command-strip">
        <div>
          <span>Action plan</span>
          <strong>{queuedCount ? `${queuedCount} queued` : 'Nothing queued'}</strong>
        </div>
        <div>
          <span>Recommendation set</span>
          <strong>{allRecommendations.length} cards</strong>
        </div>
        <div>
          <span>Backend phase</span>
          <strong>{data.dataStatus || 'Mock data'}</strong>
        </div>
      </div>

      <div className="autopilot-main-grid">
        <SectionShell eyebrow="Weekly Lineup Assistant" title="Start, bench, and flex calls" icon={ListChecks}>
          <div className="autopilot-card-grid">
            {data.lineup.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                queued={queuedIds.has(recommendation.id)}
                onToggleQueue={toggleQueue}
              />
            ))}
          </div>
        </SectionShell>

        <SectionShell eyebrow="Waiver Wire Targets" title="Pickups, drops, and FAAB posture" icon={Zap}>
          <div className="autopilot-card-grid">
            {data.waivers.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                queued={queuedIds.has(recommendation.id)}
                onToggleQueue={toggleQueue}
              />
            ))}
          </div>
        </SectionShell>

        <SectionShell eyebrow="Trade Finder" title={mode === 'dynasty' ? 'Buy future value, sell fragile windows' : 'Turn depth into weekly points'} icon={Repeat2}>
          <div className="autopilot-card-grid">
            {data.trades.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                queued={queuedIds.has(recommendation.id)}
                onToggleQueue={toggleQueue}
              />
            ))}
          </div>
        </SectionShell>

        <SectionShell eyebrow="Player Value Projection" title="Rising, falling, and stable profiles" icon={LineChart} className="autopilot-section-wide">
          <div className="autopilot-projection-list">
            {data.projections.map((projection) => (
              <ProjectionRow key={`${projection.player}-${projection.direction}`} projection={projection} />
            ))}
          </div>
        </SectionShell>

        <SectionShell eyebrow="League Power Analysis" title="Contenders, rebuilders, and trade partners" icon={Radar}>
          <div className="autopilot-power-list">
            {data.power.map((row) => (
              <PowerRow key={`${row.rank}-${row.team}`} row={row} />
            ))}
          </div>
        </SectionShell>

        <SectionShell eyebrow="Future Schedule/SOS TODO" title="Matchups come next" icon={CalendarClock}>
          <div className="autopilot-schedule-panel">
            <div className="autopilot-schedule-icon" aria-hidden="true">
              <Target className="h-7 w-7" />
            </div>
            <ul>
              {data.scheduleTodo.map((todo) => (
                <li key={todo}>
                  <Crosshair className="h-4 w-4" aria-hidden="true" />
                  {todo}
                </li>
              ))}
            </ul>
            <div className="autopilot-future-stack">
              <span>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Phase 5 input
              </span>
              <strong>Strength of schedule</strong>
            </div>
          </div>
        </SectionShell>
      </div>

      <div className="autopilot-footer-read">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        <p>{reportData ? 'This Autopilot read is generated from the current report data: rosters, manager intel, power ranks, waiver signals, value movement, trade context, and any matchup previews available.' : 'Phase 1 uses structured mock recommendations. The component is shaped so later phases can replace this data with Sleeper rosters, ranking blends, usage feeds, long-term manager tendencies, and schedule strength.'}</p>
      </div>
    </section>
  );
}
