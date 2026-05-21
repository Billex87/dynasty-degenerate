import { getPlayerRankForMode, getPlayerValueForMode } from '@/lib/leagueValueMode';
import { getShortTermMatchupOutlook } from '@shared/matchupWindows';
import { evaluateAIEvidence, getAIEvidenceLeagueContextFromDiagnostics, getAIEvidenceReceiptItems } from '@shared/aiEvidenceEngine';
import type { AIEvidenceAction, AIEvidenceMode, AIEvidenceSurface, AIConfidenceLabel } from '@shared/aiEvidenceEngine';
import { buildAIEvidenceLeagueActivityContext } from '@shared/leagueActivityContext';
import type {
  ManagerRosterIntelligence,
  MatchupPreview,
  PlayerDetails,
  PlayerInfo,
  PowerRanking,
  ReportAICalibrationAdjustment,
  ReportData,
  TrendingPlayer,
  WeeklyMomentum,
} from '@shared/types';
import type {
  AIActionQueueItem,
  AIActionQueueSource,
  AIMarketAnomalyRead,
  AIReportCardRead,
  AIRejectionRead,
  AutopilotData,
  AutopilotMode,
  AutopilotRecommendation,
  AutopilotScore,
  AutopilotTone,
  FuturePickTrajectory,
  LeaguePowerRow,
  ManagerTendencyProfile,
  PlayerProjection,
  ValueDirection,
  WeeklyActionPlan,
  WeeklyRecapRead,
} from './types';

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

type ScheduleStreamerCandidate = NonNullable<NonNullable<ReportData['schedulePlanning']>['streamerCandidates']>[number];

type AutopilotBuildInput = {
  reportData?: ReportData;
  mode: AutopilotMode;
  fallback: AutopilotData;
};

type ReportCalibrationSourceAgreement = 'aligned' | 'split' | 'conflicted' | 'thin' | 'missing' | 'unknown';

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

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

function getLeagueAiConfidenceScore(data: ReportData): number | null {
  const score = safeNumber(data.leagueDiagnostics?.aiConfidence?.score);
  return score === null ? null : clampPercent(score);
}

function getManagerAiConfidenceScore(data: ReportData, manager: string): number | null {
  const confidence = data.leagueDiagnostics?.aiConfidence?.managerConfidence
    ?.find((row) => sameManager(row.manager, manager));
  const score = safeNumber(confidence?.score);
  return score === null ? null : clampPercent(score);
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

function formatWeekList(weeks?: number[] | null): string | null {
  const uniqueWeeks = Array.from(new Set((weeks || []).filter((week): week is number => Number.isFinite(week) && week > 0)))
    .sort((a, b) => a - b);
  if (!uniqueWeeks.length) return null;
  if (uniqueWeeks.length <= 3) return uniqueWeeks.map((week) => `W${week}`).join(' · ');
  return `${uniqueWeeks.slice(0, 3).map((week) => `W${week}`).join(' · ')} +${uniqueWeeks.length - 3}`;
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

function normalizeLineupPosition(position?: string | null): string {
  const normalized = String(position || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (['DST', 'D', 'DEFENSE'].includes(normalized)) return 'DEF';
  if (normalized === 'PK') return 'K';
  if (['SUPERFLEX', 'OP', 'QBSF'].includes(normalized)) return 'SUPER_FLEX';
  if (normalized === 'FLEX' || normalized === 'WRT' || normalized === 'WRRBT' || normalized === 'WRRBTE') return 'FLEX';
  if (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(normalized)) return normalized;
  return normalized || 'FLEX';
}

function isScheduleWindowSignal(
  signal?: TrendingPlayer['weeklyEcr']
): signal is NonNullable<TrendingPlayer['weeklyEcr']> {
  return Boolean(
    signal &&
      signal.signalType === 'draftsharks-sos'
  );
}

function getWaiverMatchupGuard(player: TrendingPlayer): {
  score: number;
  reason: string | null;
  signal: string | null;
} {
  const signal = player.weeklyEcr;
  if (!isScheduleWindowSignal(signal)) {
    return { score: 0, reason: null, signal: null };
  }

  const position = normalizeLineupPosition(getPlayerPosition(player));
  const isSpecialTeams = position === 'K' || position === 'DEF';
  const outlook = getShortTermMatchupOutlook(signal.matchupWindows);

  if (outlook.isRoughStart) {
    return {
      score: isSpecialTeams ? -80 : -10,
      reason: isSpecialTeams
        ? 'Early matchup window is rough, so rank alone is not enough to make this an automatic pickup.'
        : 'Early matchup window is rough enough to lower the claim priority.',
      signal: 'Rough matchup guard',
    };
  }

  if (outlook.isStrongStart) {
    return {
      score: isSpecialTeams ? 14 : 7,
      reason: 'Early matchup window supports the add case.',
      signal: 'Strong matchup window',
    };
  }

  return { score: 0, reason: null, signal: null };
}

function getPlayerLineupPosition(player?: AutopilotPlayerLike | null): string {
  return normalizeLineupPosition(getPlayerPosition(player));
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

function getPlayerSituationDelta(player?: AutopilotPlayerLike | null) {
  return player?.playerDetails?.playerSituationDelta || null;
}

function formatSituationLabel(label?: string | null) {
  return String(label || '')
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function getPlayerSituationSignal(player?: AutopilotPlayerLike | null): string | null {
  const delta = getPlayerSituationDelta(player);
  if (!delta) return null;
  const signal = formatSituationLabel(delta.primaryLabel);
  const freshness = delta.freshness?.grade ? `${delta.freshness.grade} context` : 'situation context';
  return `${signal} (${delta.confidence}% confidence, ${freshness})`;
}

function getManagerSituationCopy(intel?: ManagerRosterIntelligence | null): string | null {
  const summary = intel?.situationSummary;
  if (!summary || !summary.backedCount) return null;
  return summary.note;
}

function getManagerSituationPlayers(intel?: ManagerRosterIntelligence | null): AutopilotPlayerLike[] {
  if (!intel) return [];
  const seen = new Set<string>();
  const rawPlayers: Array<AutopilotPlayerLike | null | undefined> = [
    intel.buyTarget,
    intel.sellCandidate,
    intel.breakoutCandidate,
    intel.weakestStarter,
    intel.youngCorePlayer,
    intel.oldestPlayer,
    ...(intel.rosterPlayers || []),
    ...(intel.benchPlayers || []),
    ...(intel.taxiPlayers || []),
    ...(intel.reservePlayers || []),
  ];
  const players: AutopilotPlayerLike[] = [];
  rawPlayers.forEach((player) => {
    if (player?.player_id) players.push(player);
  });

  return players.filter((player) => {
    const key = player.player_id || getPlayerName(player);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function withReportPlayerDetails(data: ReportData, player?: AutopilotPlayerLike | null): AutopilotPlayerLike | null {
  if (!player) return null;
  const details = player.player_id ? data.playerDetailsById?.[player.player_id] : null;
  return details ? { ...player, playerDetails: details } : player;
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

function buildManagerTendencyProfile(data: ReportData, manager: string): ManagerTendencyProfile {
  const leagueSize = getLeagueSize(data);
  const tendency = findTradeTendency(data, manager);
  const tradeRows = (data.tradeHistory || []).filter((row) => sameManager(row.team_a, manager) || sameManager(row.team_b, manager));
  const transactionRows = (data.recentTransactions || []).filter((row) => sameManager(row.manager, manager));
  const standingRows = (data.standingsHistory || []).filter((row) => sameManager(row.manager, manager));
  const seasonsTracked = new Set(standingRows.map((row) => row.season)).size;
  const topHalfFinishes = standingRows.filter((row) => row.rank > 0 && row.rank <= Math.max(1, Math.ceil(leagueSize / 2))).length;
  const avgStandingRank = averageNumbers(standingRows.map((row) => row.rank));
  const avgPointsForRank = (() => {
    const bySeason = new Map<string, NonNullable<ReportData['standingsHistory']>>();
    (data.standingsHistory || []).forEach((row) => {
      const key = row.season || 'current';
      bySeason.set(key, [...(bySeason.get(key) || []), row]);
    });
    const pointRanks = Array.from(bySeason.values()).map((rows) => {
      const sorted = [...rows].sort((a, b) => b.pointsFor - a.pointsFor);
      const index = sorted.findIndex((row) => sameManager(row.manager, manager));
      return index >= 0 ? index + 1 : null;
    });
    return averageNumbers(pointRanks);
  })();

  const historyDepthScore = clampPercent(
    18
    + Math.min(34, seasonsTracked * 9)
    + Math.min(28, tradeRows.length * 4)
    + Math.min(20, transactionRows.length * 5),
  );
  const tradeActivityScore = clampPercent(
    20
    + Math.min(35, (tendency?.tradeCount || tradeRows.length) * 7)
    + Math.min(22, Math.max(0, (tendency?.winPct || 0) - 50) * 0.8)
    + Math.min(23, Math.max(0, tendency?.profit || 0) / 120),
  );
  const waiverActivityScore = clampPercent(18 + Math.min(52, transactionRows.length * 13) + (data.waiverIntelligence ? 12 : 0));
  const competitiveConsistencyScore = clampPercent(
    averageNumbers([
      avgStandingRank ? scoreFromRank(avgStandingRank, leagueSize) : null,
      avgPointsForRank ? scoreFromRank(avgPointsForRank, leagueSize) : null,
      standingRows.length ? (topHalfFinishes / standingRows.length) * 100 : null,
    ]) ?? 48,
  );
  const riskToleranceScore = clampPercent(
    averageNumbers([
      tradeActivityScore,
      transactionRows.length ? Math.min(100, transactionRows.length * 18) : null,
      tendency?.overpaysForPicks || tendency?.overpaysForVeterans ? 74 : null,
    ]) ?? tradeActivityScore,
  );

  const label = tradeActivityScore >= 78
    ? 'Aggressive trader'
    : waiverActivityScore >= 74
      ? 'Waiver churner'
      : competitiveConsistencyScore >= 72
        ? 'Steady contender'
        : historyDepthScore < 45
          ? 'Thin history'
          : 'Balanced manager';
  const summary = historyDepthScore < 45
    ? `${manager} has limited tracked history in this report, so Autopilot keeps confidence tighter until more manager behavior is available.`
    : `${manager} shows ${label.toLowerCase()} tendencies across ${seasonsTracked || 'current'} tracked season${seasonsTracked === 1 ? '' : 's'}, ${tradeRows.length || tendency?.tradeCount || 0} trade signal${(tradeRows.length || tendency?.tradeCount || 0) === 1 ? '' : 's'}, and ${transactionRows.length} recent transaction${transactionRows.length === 1 ? '' : 's'}.`;

  return {
    manager,
    label,
    summary,
    historyDepthScore,
    tradeActivityScore,
    waiverActivityScore,
    competitiveConsistencyScore,
    riskToleranceScore,
    signals: dedupeStrings([
      seasonsTracked ? `${seasonsTracked} seasons tracked` : null,
      tradeRows.length || tendency?.tradeCount ? `${tradeRows.length || tendency?.tradeCount} trade signals` : null,
      transactionRows.length ? `${transactionRows.length} recent moves` : null,
      tendency?.favoritePartner ? `Favorite partner ${tendency.favoritePartner}` : null,
      tendency?.overpaysForPicks ? 'Pays for picks' : null,
      tendency?.overpaysForVeterans ? 'Pays for veterans' : null,
    ], 5),
  };
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

function getPlayerIdentityKey(player?: AutopilotPlayerLike | null): string {
  return player?.player_id || normalizeManagerName(getPlayerName(player));
}

function isSameAutopilotPlayer(a?: AutopilotPlayerLike | null, b?: AutopilotPlayerLike | null): boolean {
  const aKey = getPlayerIdentityKey(a);
  const bKey = getPlayerIdentityKey(b);
  return Boolean(aKey && bKey && aKey === bKey);
}

function getStarterSlotKeys(
  managerRow: ReportData['managerPositionCounts'][number] | null | undefined,
  player?: AutopilotPlayerLike | null,
): string[] {
  if (!managerRow || !player) return [];
  const keys = new Set<string>();
  (managerRow.starterGroups || []).forEach((group) => {
    if ((group.players || []).some((candidate) => isSameAutopilotPlayer(candidate, player))) {
      keys.add(normalizeLineupPosition(group.key));
    }
  });
  return Array.from(keys);
}

function canPositionStartInSlot(position: string, slot: string): boolean {
  const normalizedPosition = normalizeLineupPosition(position);
  const normalizedSlot = normalizeLineupPosition(slot);
  if (normalizedSlot === 'FLEX') return ['RB', 'WR', 'TE'].includes(normalizedPosition);
  if (normalizedSlot === 'SUPER_FLEX') return ['QB', 'RB', 'WR', 'TE'].includes(normalizedPosition);
  return normalizedPosition === normalizedSlot;
}

function findManagerPlayerByIdentity(
  managerRow: ReportData['managerPositionCounts'][number] | null | undefined,
  player?: AutopilotPlayerLike | null,
): AutopilotPlayerLike | null {
  if (!managerRow || !player) return null;
  const targetKey = getPlayerIdentityKey(player);
  if (!targetKey) return null;
  return [
    ...(managerRow.lineupPlayers || []),
    ...(managerRow.rosterPlayers || []),
    ...(managerRow.starterPlayers || []),
    ...(managerRow.starterGroups || []).flatMap((group) => group.players || []),
  ].find((candidate) => getPlayerIdentityKey(candidate) === targetKey) || null;
}

function canReplaceStarterInKnownSlot({
  candidate,
  starter,
  managerRow,
}: {
  candidate?: AutopilotPlayerLike | null;
  starter?: AutopilotPlayerLike | null;
  managerRow?: ReportData['managerPositionCounts'][number] | null;
}): boolean {
  if (!candidate || !starter || isSameAutopilotPlayer(candidate, starter)) return false;
  const resolvedCandidate = managerRow ? findManagerPlayerByIdentity(managerRow, candidate) : candidate;
  const resolvedStarter = managerRow ? findManagerPlayerByIdentity(managerRow, starter) : starter;
  if (!resolvedCandidate || !resolvedStarter) return false;
  const candidatePosition = getPlayerLineupPosition(resolvedCandidate);
  const starterPosition = getPlayerLineupPosition(resolvedStarter);
  const starterSlots = getStarterSlotKeys(managerRow, resolvedStarter);
  if (!starterSlots.length) return candidatePosition === starterPosition;
  return starterSlots.some((slot) => canPositionStartInSlot(candidatePosition, slot));
}

function findManagerPlayerByName(
  managerRow: ReportData['managerPositionCounts'][number] | null | undefined,
  name?: string | null,
): AutopilotPlayerLike | null {
  const target = normalizeManagerName(name);
  if (!target) return null;
  return [
    ...(managerRow?.lineupPlayers || []),
    ...(managerRow?.rosterPlayers || []),
    ...(managerRow?.starterPlayers || []),
  ].find((player) => normalizeManagerName(player.name) === target) || null;
}

function collectStartOverCandidates(
  managerRow: ReportData['managerPositionCounts'][number] | null | undefined,
  intel?: ManagerRosterIntelligence | null,
): AutopilotPlayerLike[] {
  const seen = new Set<string>();
  const candidates = [
    ...(managerRow?.lineupPlayers || []),
    ...(managerRow?.rosterPlayers || []),
    ...(intel?.benchPlayers || []),
    intel?.breakoutCandidate,
    intel?.youngCorePlayer,
    intel?.injuryInsurance,
  ].filter(Boolean) as AutopilotPlayerLike[];

  return candidates.filter((player) => {
    const key = getPlayerIdentityKey(player);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const leagueConfidence = data.leagueDiagnostics?.aiConfidence || null;
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

  const rows: AutopilotScore[] = leagueConfidence ? [{
    label: 'League AI confidence',
    value: clampPercent(leagueConfidence.score),
    tone: scoreTone(leagueConfidence.score),
  }] : [];

  return [
    ...rows,
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

function buildDirection(
  data: ReportData,
  mode: AutopilotMode,
  manager: string,
  fallback: AutopilotData['direction'],
  tendencyProfile: ManagerTendencyProfile,
): AutopilotData['direction'] {
  const intel = findManagerIntel(data, manager);
  const power = findPowerRanking(data, manager);
  const standing = findStanding(data, manager);
  const timeline = findTimeline(data, manager);
  const tradeTendency = findTradeTendency(data, manager);
  const portfolio = findPickPortfolio(data, manager);
  const leagueSize = getLeagueSize(data);
  const allPickValues = (data.pickPortfolios || []).map((row) => row.totalValue).filter((value) => value > 0);
  const maxPickValue = Math.max(...allPickValues, 1);
  const situationCopy = getManagerSituationCopy(intel);

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
    tendencyProfile.tradeActivityScore,
    tendencyProfile.riskToleranceScore,
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
  const strategy = shortenText(intel?.tradePlan?.summary || situationCopy || intel?.pressurePoints?.[0] || intel?.marketSignals?.[0] || tendencyProfile.summary, 220)
    || (mode === 'redraft'
      ? 'Turn replaceable bench value into weekly starters and waiver players with clear immediate roles.'
      : 'Protect young liquid assets, use surplus depth in trades, and only buy short-window production when it changes the weekly lineup.');

  const topWaiver = collectWaiverCandidates(data, mode, intel)[0];
  const actionPlan = dedupeStrings([
    intel?.tradePlan?.summary,
    mode === 'dynasty' && intel?.sellCandidate ? `Shop ${intel.sellCandidate.name} before the market prices in age, role, or roster-window risk.` : null,
    mode === 'dynasty' && intel?.youngCorePlayer ? `Build around ${intel.youngCorePlayer.name}; do not move that type of asset without a clear tier-up.` : null,
    mode === 'redraft' && intel?.weakestStarter ? `Pressure-test ${intel.weakestStarter.name} as the first lineup spot to upgrade.` : null,
    situationCopy,
    topWaiver ? `Check waivers for ${topWaiver.name}; it is the strongest available fit in the current report data.` : null,
    tendencyProfile.historyDepthScore >= 62 ? `Use ${tendencyProfile.label.toLowerCase()} behavior in confidence weighting; this read has enough history to matter.` : null,
    portfolio && mode === 'dynasty' ? `Use ${portfolio.count2026 + portfolio.count2027} tracked future picks as leverage, not throw-ins.` : null,
    ...fallback.actionPlan,
  ], 3);

  const rawConfidence = confidenceFromSignals(50, [intel, power, standing, timeline, tradeTendency, portfolio, data.waiverIntelligence, tendencyProfile.historyDepthScore >= 55], data.matchupPreviews?.length ? 0 : 4);

  return {
    label,
    confidence: capConfidence(data, manager, rawConfidence),
    summary,
    strategy,
    scores: directionScores,
    actionPlan,
  };
}

function recommendationConfidence(base: number, recommendationSignals: Array<unknown>) {
  return confidenceFromSignals(base, recommendationSignals, recommendationSignals.includes(null) ? 4 : 0);
}

function getManagerEvidenceConfidenceFloor(data: ReportData, manager: string): number | null {
  const tendencyProfile = buildManagerTendencyProfile(data, manager);
  if (tendencyProfile.historyDepthScore < 70 || tendencyProfile.competitiveConsistencyScore < 68) {
    return null;
  }

  const evidenceScore = averageNumbers([
    tendencyProfile.historyDepthScore,
    tendencyProfile.competitiveConsistencyScore,
    tendencyProfile.tradeActivityScore,
  ]);

  return evidenceScore === null ? null : clampPercent(evidenceScore + 14);
}

function getAiConfidenceCap(data: ReportData, manager: string): number {
  const caps: number[] = [];
  const leagueConfidence = getLeagueAiConfidenceScore(data);
  const managerConfidence = getManagerAiConfidenceScore(data, manager);
  if (leagueConfidence !== null) caps.push(clampPercent(leagueConfidence + 18));
  if (managerConfidence !== null) caps.push(clampPercent(managerConfidence + 16));
  const confidenceCap = caps.length ? Math.max(38, Math.min(...caps)) : 100;
  const evidenceFloor = leagueConfidence === null || leagueConfidence >= 55
    ? getManagerEvidenceConfidenceFloor(data, manager)
    : null;

  return evidenceFloor === null ? confidenceCap : Math.max(confidenceCap, evidenceFloor);
}

function capConfidence(data: ReportData, manager: string, confidence: number): number {
  return Math.min(clampPercent(confidence), getAiConfidenceCap(data, manager));
}

function getConfidenceLabel(score: number): AIConfidenceLabel {
  const value = clampPercent(score);
  if (value >= 84) return 'high conviction';
  if (value >= 72) return 'priority';
  if (value >= 58) return 'actionable';
  if (value >= 42) return 'watchlist';
  return 'thin';
}

function getReportAdjustmentGroupValue(
  input: {
    surface: AIEvidenceSurface;
    action: AIEvidenceAction;
    label: AIConfidenceLabel;
    sourceAgreementState?: ReportCalibrationSourceAgreement | null;
    manager?: string | null;
    leagueFormat?: string | null;
  },
  key: string,
): string | null {
  if (key === 'surface') return input.surface;
  if (key === 'action') return input.action;
  if (key === 'label') return input.label;
  if (key === 'sourceAgreement') return input.sourceAgreementState || 'unknown';
  if (key === 'manager') return input.manager || null;
  if (key === 'leagueFormat') return input.leagueFormat || null;
  return null;
}

function matchesReportCalibrationAdjustment(
  input: Parameters<typeof getReportAdjustmentGroupValue>[0],
  adjustment: ReportAICalibrationAdjustment,
): boolean {
  if (adjustment.scope === 'global') return true;
  const entries = Object.entries(adjustment.group || {});
  if (!entries.length) return false;
  return entries.every(([key, expected]) => {
    const actual = getReportAdjustmentGroupValue(input, key);
    return actual !== null && String(actual).toLowerCase() === String(expected).toLowerCase();
  });
}

function getReportAdjustmentSpecificity(adjustment: ReportAICalibrationAdjustment): number {
  return Object.keys(adjustment.group || {}).length;
}

function findReportCalibrationAdjustment(
  data: ReportData,
  input: Parameters<typeof getReportAdjustmentGroupValue>[0],
): ReportAICalibrationAdjustment | null {
  const profile = data.aiCalibrationAdjustmentProfile;
  if (!profile?.adjustments?.length) return null;
  return profile.adjustments
    .filter((adjustment) => adjustment.scoreAdjustment !== 0 || adjustment.confidenceCap !== null)
    .filter((adjustment) => matchesReportCalibrationAdjustment(input, adjustment))
    .sort((a, b) =>
      getReportAdjustmentSpecificity(b) - getReportAdjustmentSpecificity(a) ||
      Math.abs(b.scoreAdjustment) - Math.abs(a.scoreAdjustment) ||
      b.scoredCount - a.scoredCount
    )[0] || null;
}

function inferRecommendationCalibrationAction(
  source: AIActionQueueSource,
  card: AutopilotRecommendation,
): AIEvidenceAction {
  const text = `${card.type} ${card.action} ${card.summary}`.toLowerCase();
  if (source === 'lineup') {
    if (/\bbench|sit|review\b/.test(text)) return 'sit';
    return 'start';
  }
  if (source === 'trade') return 'trade';
  if (/\bstream|kicker|defense|dst|d\/st\b/.test(text)) return 'stream';
  if (/\bstash\b/.test(text)) return 'stash';
  if (/\bavoid|don't|do not|monitor\b/.test(text)) return 'watch';
  return 'pickup';
}

function inferRecommendationSourceAgreement(card: AutopilotRecommendation): ReportCalibrationSourceAgreement {
  const evidence = card.evidenceRead;
  if (!evidence) return 'unknown';
  if (evidence.hardBlockers.length) return 'conflicted';
  if (evidence.missingEvidence.length >= 2) return 'thin';
  const traces = evidence.sourceTrace || [];
  if (!traces.length) return 'missing';
  if (traces.some((trace) => trace.status === 'error' || trace.status === 'stale')) return 'split';
  if (traces.every((trace) => !trace.status || trace.status === 'loaded')) return 'aligned';
  return 'unknown';
}

function applyReportCalibrationToRecommendation(
  data: ReportData,
  manager: string,
  source: AIActionQueueSource,
  card: AutopilotRecommendation,
): AutopilotRecommendation {
  const action = inferRecommendationCalibrationAction(source, card);
  const baseConfidence = clampPercent(card.confidence);
  const baseCap = getAiConfidenceCap(data, manager);
  const label = card.evidenceRead?.label || getConfidenceLabel(baseConfidence);
  const adjustment = findReportCalibrationAdjustment(data, {
    surface: 'autopilot',
    action,
    label,
    sourceAgreementState: inferRecommendationSourceAgreement(card),
    manager,
    leagueFormat: data.leagueDiagnostics?.valueMode || data.leagueValueMode || null,
  });
  if (!adjustment) return card;

  const adjustedCap = adjustment.confidenceCap === null
    ? baseCap
    : Math.min(baseCap, clampPercent(adjustment.confidenceCap));
  const adjustedConfidence = Math.min(clampPercent(baseConfidence + adjustment.scoreAdjustment), adjustedCap);
  if (adjustedConfidence === baseConfidence && adjustedCap === baseCap) return card;

  return {
    ...card,
    confidence: adjustedConfidence,
    risk: adjustedConfidence < 58 ? 'High' : card.risk,
    reasons: dedupeStrings([...card.reasons, `Calibration: ${adjustment.reason}`], 5),
    signals: dedupeStrings([...card.signals, 'Outcome-calibrated'], 5),
    calibration: {
      baseConfidence,
      adjustedConfidence,
      confidenceCap: adjustedCap,
      reason: adjustment.reason,
      priority: adjustment.priority,
    },
  };
}

function capRecommendationCards(
  data: ReportData,
  manager: string,
  cards: AutopilotRecommendation[],
  source: AIActionQueueSource,
): AutopilotRecommendation[] {
  return cards.map((card) => {
    const cappedConfidence = capConfidence(data, manager, card.confidence);
    const wasCapped = cappedConfidence < clampPercent(card.confidence);
    const cappedCard = {
      ...card,
      confidence: cappedConfidence,
      risk: wasCapped && cappedConfidence < 58 ? 'High' : card.risk,
      signals: wasCapped
        ? dedupeStrings([...card.signals, 'Confidence capped by league evidence'], 5)
        : card.signals,
    };
    return applyReportCalibrationToRecommendation(data, manager, source, cappedCard);
  });
}

function capWeeklyActionPlan(data: ReportData, manager: string, plan?: WeeklyActionPlan): WeeklyActionPlan | undefined {
  if (!plan) return plan;
  return {
    ...plan,
    starterToReview: plan.starterToReview
      ? {
        ...plan.starterToReview,
        confidence: capConfidence(data, manager, plan.starterToReview.confidence),
      }
      : null,
    options: plan.options.map((option) => ({
      ...option,
      confidence: capConfidence(data, manager, option.confidence),
    })),
  };
}

function capPlayerProjections(data: ReportData, manager: string, projections: PlayerProjection[]): PlayerProjection[] {
  return projections.map((projection) => {
    const cappedConfidence = capConfidence(data, manager, projection.confidence);
    const wasCapped = cappedConfidence < clampPercent(projection.confidence);
    return {
      ...projection,
      confidence: cappedConfidence,
      signals: wasCapped
        ? dedupeStrings([...projection.signals, 'Confidence capped by league evidence'], 5)
        : projection.signals,
    };
  });
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

function inferStarterToReview(lineup: AutopilotRecommendation[]) {
  const benchCall = lineup.find((recommendation) => {
    const label = `${recommendation.type} ${recommendation.action}`.toLowerCase();
    return label.includes('bench') || label.includes('review');
  });
  if (benchCall) {
    return {
      player: benchCall.player,
      position: 'FLEX',
      confidence: benchCall.confidence,
      note: benchCall.summary,
      tone: benchCall.tone,
    };
  }

  const startOver = lineup.find((recommendation) => /\bover\s+/i.test(recommendation.secondary || ''));
  const starterName = startOver?.secondary?.match(/\bover\s+([^|;,]+)/i)?.[1]?.trim();
  if (!starterName) return null;

  return {
    player: starterName,
    position: 'FLEX',
    confidence: Math.max(52, (startOver?.confidence || 66) - 8),
    note: 'Current starter to pressure-test before lock.',
    tone: 'warn' as AutopilotTone,
  };
}

function buildWeeklyActionPlan(
  data: ReportData,
  mode: AutopilotMode,
  manager: string,
  lineup: AutopilotRecommendation[],
  fallback?: WeeklyActionPlan,
): WeeklyActionPlan | undefined {
  const intel = findManagerIntel(data, manager);
  const managerPositionRow = findManagerPositionRow(data, manager);
  const matchup = getMatchupPreview(data, manager);
  const vulnerable = matchup?.vulnerableSpots?.[0] || matchup?.boomBustRisks?.[0] || intel?.weakestStarter || null;
  const inferredStarter = inferStarterToReview(lineup);
  const starterToReview = vulnerable
    ? {
      player: getPlayerName(vulnerable),
      position: getPlayerPosition(vulnerable),
      confidence: recommendationConfidence(matchup?.vulnerableSpots?.length ? 72 : 62, [vulnerable, matchup, intel?.weakestStarter]),
      note: matchup?.vulnerableSpots?.some((spot) => spot.player_id === vulnerable.player_id)
        ? 'Matchup preview marks this as the starter to re-check.'
        : 'Roster intel marks this as the first starter slot to upgrade.',
      tone: 'warn' as AutopilotTone,
    }
    : inferredStarter;
  const starterToReviewPlayer = vulnerable || findManagerPlayerByName(managerPositionRow, starterToReview?.player);

  const options: WeeklyActionPlan['options'] = [];
  const seen = new Set<string>();
  const scheduleStreamerKeys = new Set<string>();
  const starterKey = normalizeManagerName(starterToReview?.player);

  const pushOption = (
    player: AutopilotPlayerLike | AutopilotRecommendation | null | undefined,
    baseConfidence: number,
    note: string,
    tone: AutopilotTone = 'good',
  ) => {
    if (!player) return;
    const isRecommendation = 'confidence' in player && 'summary' in player && 'action' in player;
    const playerName = isRecommendation ? player.player : getPlayerName(player);
    const playerRecord = isRecommendation
      ? findManagerPlayerByName(managerPositionRow, player.player)
      : player;
    if (starterToReview && !canReplaceStarterInKnownSlot({
      candidate: playerRecord,
      starter: starterToReviewPlayer,
      managerRow: managerPositionRow,
    })) {
      return;
    }
    const key = normalizeManagerName(playerName);
    if (!playerName || seen.has(key) || key === starterKey) return;
    seen.add(key);
    const confidence = isRecommendation
      ? clampPercent(player.confidence)
      : recommendationConfidence(baseConfidence, [playerRecord, getAutopilotPlayerRank(playerRecord, mode), getAutopilotPlayerValue(playerRecord, mode), matchup]);
    options.push({
      player: playerName,
      position: getPlayerLineupPosition(playerRecord),
      confidence,
      note: isRecommendation ? shortenText(player.summary, 96) || note : note,
      tone,
    });
  };

  (matchup?.mustStarts || []).slice(0, 3).forEach((player) => pushOption(player, 74, 'Matchup model marks this as a must-start.', 'good'));
  lineup
    .filter((recommendation) => recommendation.action.toLowerCase().includes('start'))
    .forEach((recommendation) => pushOption(recommendation, recommendation.confidence, 'Lineup recommendation from the current read.', recommendation.tone));

  pushOption(getBestStarter(managerPositionRow, mode), 70, 'Highest starter value on this roster read.', 'good');
  pushOption(intel?.youngCorePlayer, mode === 'dynasty' ? 68 : 58, mode === 'dynasty' ? 'Young core profile keeps value and upside live.' : 'Start only if the weekly role is strong.', mode === 'dynasty' ? 'good' : 'info');
  pushOption(intel?.breakoutCandidate, 66, 'Breakout profile worth starting over a low-ceiling slot.', 'info');
  pushOption(intel?.injuryInsurance, 62, 'Insurance option if injury news opens touches.', 'warn');

  asArray(data.schedulePlanning?.streamerCandidates)
    .slice(0, 3)
    .forEach((candidate: ScheduleStreamerCandidate) => {
      const candidateWeeks = formatWeekList(candidate.targetWeeks);
      scheduleStreamerKeys.add(normalizeManagerName(candidate.name));
      pushOption({
        player_id: candidate.playerId,
        name: candidate.name,
        pos: candidate.position,
        playerDetails: {
          team: candidate.team || null,
          schedule: {
            byeWeek: candidate.byeWeek ?? null,
            seasonSOS: candidate.seasonSOS ?? null,
            scheduleTier: candidate.scheduleTier ?? null,
            streamerWeeks: candidate.targetWeeks || [],
            avoidWeeks: [],
            source: data.schedulePlanning?.source || null,
            updatedAt: data.schedulePlanning?.updatedAt || null,
          },
        } as PlayerDetails,
      }, candidate.seasonSOS !== null && candidate.seasonSOS !== undefined
        ? clampPercent(68 + Math.max(-12, Math.min(12, 50 - candidate.seasonSOS)))
        : 64,
      candidate.note || (candidateWeeks ? `Streamer target for ${candidateWeeks}.` : 'Schedule planner streamer target.'),
      candidate.scheduleTier === 'easy' ? 'good' : candidate.scheduleTier === 'hard' ? 'warn' : 'info');
    });

  if (options.length < 2) {
    collectStartOverCandidates(managerPositionRow, intel)
      .sort((a, b) => (getAutopilotPlayerValue(b, mode) || 0) - (getAutopilotPlayerValue(a, mode) || 0))
      .forEach((player) => pushOption(player, 60, 'Starter value keeps this player above the current risk slot.', 'info'));
  }

  const trimmedOptions = options
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  if (scheduleStreamerKeys.size) {
    const hasScheduleStreamer = trimmedOptions.some((option) => scheduleStreamerKeys.has(normalizeManagerName(option.player)));
    if (!hasScheduleStreamer) {
      const bestScheduleStreamer = [...options]
        .filter((option) => scheduleStreamerKeys.has(normalizeManagerName(option.player)))
        .sort((a, b) => b.confidence - a.confidence)[0] || null;
      if (bestScheduleStreamer) {
        if (trimmedOptions.length < 3) {
          trimmedOptions.push(bestScheduleStreamer);
        } else {
          trimmedOptions[trimmedOptions.length - 1] = bestScheduleStreamer;
        }
        trimmedOptions.sort((a, b) => b.confidence - a.confidence);
      }
    }
  }

  if (!starterToReview && !trimmedOptions.length) return fallback;

  const topOption = trimmedOptions[0];
  return {
    starterToReview,
    options: trimmedOptions,
    summary: starterToReview && topOption
      ? `${starterToReview.player} is the lineup spot to pressure-test. ${topOption.player} is the preferred start-over option at ${topOption.confidence}% confidence.`
      : fallback?.summary || 'The weekly action plan will get sharper once matchup and usage data are available.',
  };
}

function buildWeeklyRecapRead(
  weeklyPlan: WeeklyActionPlan | undefined,
  waivers: AutopilotRecommendation[],
  trades: AutopilotRecommendation[],
  mode: AutopilotMode,
  manager: string,
): WeeklyRecapRead | undefined {
  if (!weeklyPlan && !waivers.length && !trades.length) return undefined;

  const starter = weeklyPlan?.starterToReview || null;
  const startSitCalls = starter
    ? (weeklyPlan?.options || []).slice(0, 3).map((option) => ({
      sit: starter.player,
      start: option.player,
      confidence: option.confidence,
      note: `Start ${option.player} over ${starter.player}: ${option.note}`,
      tone: option.tone,
    }))
    : [];

  const topWaivers = waivers.slice(0, 2).map((recommendation) => {
    const secondary = recommendation.secondary ? ` (${recommendation.secondary})` : '';
    return `${recommendation.action}: ${recommendation.player}${secondary}. ${recommendation.summary}`;
  });

  const tradeNotes = trades.slice(0, 2).map((recommendation) => {
    const partner = recommendation.secondary ? ` ${recommendation.secondary}` : '';
    return `${recommendation.action} ${recommendation.player}${partner}. ${recommendation.summary}`;
  });

  const topCall = startSitCalls[0];
  return {
    headline: topCall
      ? `Start ${topCall.start} over ${topCall.sit}`
      : mode === 'redraft'
        ? `${manager} weekly recap`
        : `${manager} dynasty week-in-review`,
    summary: topCall
      ? `${topCall.note} This is a dynamic recap call, so it should tighten after games once actual usage and points are available.`
      : 'No lineup swap is forced yet; the recap focuses on waiver and trade moves until weekly result data lands.',
    startSitCalls,
    waiverNotes: topWaivers,
    tradeNotes,
  };
}

function formatQueueSourceTrace(recommendation: AutopilotRecommendation): string[] {
  const evidence = recommendation.evidenceRead;
  if (evidence?.sourceTrace?.length) {
    return evidence.sourceTrace.map((trace) => {
      const status = trace.status ? `${trace.status}` : 'loaded';
      return `${trace.label}: ${status}${trace.detail ? ` (${trace.detail})` : ''}`;
    });
  }

  return dedupeStrings([
    ...recommendation.signals,
    recommendation.confidence >= 70 ? 'Recommendation confidence is usable.' : 'Recommendation confidence is capped or directional.',
  ], 4);
}

function getQueueDecision(recommendation: AutopilotRecommendation): AIActionQueueItem['decision'] {
  const evidence = recommendation.evidenceRead;
  if (evidence?.hardBlockers?.length) return 'blocked';
  if (evidence && !evidence.canAct) return 'watch';
  if (recommendation.confidence >= 68) return 'do';
  if (recommendation.confidence >= 54) return 'watch';
  return 'hold';
}

function getQueueLabel(decision: AIActionQueueItem['decision']) {
  if (decision === 'do') return 'Do this now';
  if (decision === 'blocked') return 'Do not do this';
  if (decision === 'hold') return 'No forced move';
  return 'Watch only';
}

function getQueueTone(decision: AIActionQueueItem['decision'], recommendation?: AutopilotRecommendation): AutopilotTone {
  if (decision === 'blocked') return 'danger';
  if (decision === 'hold') return 'neutral';
  if (decision === 'watch') return recommendation?.tone === 'danger' ? 'danger' : 'warn';
  return recommendation?.tone || 'good';
}

function getQueueRisk(recommendation: AutopilotRecommendation, decision: AIActionQueueItem['decision']) {
  const evidence = recommendation.evidenceRead;
  const blocker = evidence?.hardBlockers?.[0];
  if (blocker) return blocker;

  if (decision === 'watch' || decision === 'hold') {
    return evidence?.confidenceCapReason ||
      evidence?.missingEvidence?.[0] ||
      `Risk ${recommendation.risk}; verify news, usage, and roster changes before acting.`;
  }

  return `Risk ${recommendation.risk}; upside ${recommendation.upside}.`;
}

function buildQueueChangeTriggers(
  recommendation: AutopilotRecommendation,
  source: AIActionQueueSource,
  decision: AIActionQueueItem['decision'],
): string[] {
  const evidence = recommendation.evidenceRead;
  const unhealthyTrace = evidence?.sourceTrace?.find((trace) =>
    trace.status === 'missing' ||
    trace.status === 'stale' ||
    trace.status === 'error' ||
    trace.status === 'limited'
  );
  const sourceTrigger =
    source === 'waiver'
      ? 'Live ownership, roster status, or recent transaction changes would block the pickup.'
      : source === 'lineup'
        ? 'New injury, role, weather, or usage news would rerank the start/sit call.'
        : source === 'trade'
          ? 'If partner need, roster surplus, or value spread changes, do not force the trade.'
          : 'A cleaner action with stronger evidence would replace this hold call.';
  const scheduleTrigger = recommendation.signals.some((signal) => /schedule|matchup|stream/i.test(signal))
    ? 'A stale or rough DraftSharks schedule window would downgrade this to watch only.'
    : null;
  const decisionTrigger =
    decision === 'do'
      ? 'A hard blocker or confidence cap below the action threshold would remove this as the top move.'
      : decision === 'blocked'
        ? 'Clear the blocker and reload live data before this can become actionable.'
        : decision === 'hold'
          ? 'A new recommendation must clear the action threshold before the queue should move.'
          : 'More evidence must clear the action threshold before this becomes a do-this-now move.';

  return dedupeStrings([
    evidence?.hardBlockers?.[0] ? `Clear blocker: ${evidence.hardBlockers[0]}` : null,
    evidence?.confidenceCapReason ? `Resolve confidence cap: ${evidence.confidenceCapReason}.` : null,
    evidence?.missingEvidence?.[0] ? `Add missing evidence: ${evidence.missingEvidence[0]}` : null,
    unhealthyTrace ? `Refresh source: ${unhealthyTrace.label}.` : null,
    sourceTrigger,
    scheduleTrigger,
    decisionTrigger,
  ], 4);
}

function buildRosterDominoEffects(
  recommendation: AutopilotRecommendation,
  source: AIActionQueueSource,
  decision: AIActionQueueItem['decision'],
): string[] {
  const secondary = recommendation.secondary || '';
  const dropMatch = secondary.match(/\bdrop\s+([^|;,]+)/i);
  const overMatch = secondary.match(/\bover\s+([^|;,]+)/i);
  const partnerMatch = secondary.match(/\b(?:target partner|shop to|start with):?\s+([^|;,]+)/i);

  if (decision === 'blocked') {
    return dedupeStrings([
      'No roster move should happen until the blocker clears.',
      'Leave the current lineup, bench, and trade posture untouched.',
    ], 3);
  }

  if (source === 'waiver') {
    return dedupeStrings([
      `${recommendation.player} becomes the roster add only if live availability still checks out.`,
      dropMatch ? `${dropMatch[1].trim()} becomes the first drop domino.` : 'Identify the actual drop before submitting the claim.',
      'Re-run the queue after the transaction so the next-best move does not use stale roster status.',
    ], 4);
  }

  if (source === 'lineup') {
    return dedupeStrings([
      overMatch ? `${overMatch[1].trim()} is the starter most likely to move to the bench.` : 'This only changes the lineup slot tied to the flagged starter.',
      'Verify injury, weather, role, and lock-time news before confirming the swap.',
      'Do not let a start/sit edge bleed into dynasty trade value by itself.',
    ], 4);
  }

  if (source === 'trade') {
    return dedupeStrings([
      partnerMatch ? `${partnerMatch[1].trim()} is the first manager to test, not a must-accept counterparty.` : 'The trade domino starts with partner fit, not generic market value.',
      'Check whether the return actually upgrades a starter, pick tier, or roster weakness.',
      'If the counter creates a new lineup hole, the trade drops back to watch only.',
    ], 4);
  }

  return dedupeStrings([
    'No roster domino is worth pulling until a higher-confidence action clears.',
    'The current roster shape is the baseline until fresh evidence changes the verdict.',
  ], 3);
}

function buildRecommendationQueueItem(
  recommendation: AutopilotRecommendation,
  source: AIActionQueueSource,
  order: number,
): Omit<AIActionQueueItem, 'rank'> & { score: number } | null {
  const evidenceScore = recommendation.evidenceRead?.finalScore;
  const confidence = clampPercent(evidenceScore === undefined
    ? recommendation.confidence
    : Math.min(evidenceScore, recommendation.confidence));
  const decision = getQueueDecision({ ...recommendation, confidence });
  const sourceWeight: Record<AIActionQueueSource, number> = {
    waiver: 6,
    lineup: 5,
    trade: 4,
    strategy: 1,
  };
  const decisionWeight: Record<AIActionQueueItem['decision'], number> = {
    do: 28,
    watch: 10,
    hold: 0,
    blocked: -18,
  };
  const evidence = recommendation.evidenceRead;
  const receipts = evidence
    ? getAIEvidenceReceiptItems(evidence)
    : recommendation.reasons;

  if (!recommendation.player || !recommendation.action) return null;

  return {
    id: `queue-${source}-${recommendation.id || order}`,
    source,
    decision,
    label: getQueueLabel(decision),
    action: recommendation.action,
    target: recommendation.player,
    detail: recommendation.secondary || recommendation.type,
    why: evidence?.whyThisFired || recommendation.summary,
    risk: getQueueRisk(recommendation, decision),
    confidence,
    tone: getQueueTone(decision, recommendation),
    blockers: evidence?.hardBlockers || [],
    missingEvidence: evidence?.missingEvidence || [],
    sourceHealth: formatQueueSourceTrace(recommendation),
    receipts: dedupeStrings([
      ...receipts,
      recommendation.calibration?.reason ? `Calibration: ${recommendation.calibration.reason}` : null,
    ], 4),
    changeTriggers: buildQueueChangeTriggers(recommendation, source, decision),
    dominoEffects: buildRosterDominoEffects(recommendation, source, decision),
    signals: dedupeStrings([
      ...recommendation.signals,
      recommendation.calibration ? 'Outcome-calibrated' : null,
    ], 4),
    score: confidence + decisionWeight[decision] + sourceWeight[source] - order,
  };
}

function buildNoForcedMoveQueueItem({
  direction,
  weeklyPlan,
  candidates,
}: {
  direction: AutopilotData['direction'];
  weeklyPlan?: WeeklyActionPlan;
  candidates: Array<Omit<AIActionQueueItem, 'rank'> & { score: number }>;
}): Omit<AIActionQueueItem, 'rank'> & { score: number } {
  const bestCandidate = candidates[0] || null;
  const missingEvidence = dedupeStrings([
    bestCandidate?.missingEvidence?.[0],
    !weeklyPlan?.options?.length ? 'No start-over option cleared the action threshold.' : null,
    'More live schedule, usage, injury, and transaction evidence would tighten the call.',
  ], 3);

  return {
    id: 'queue-strategy-no-forced-move',
    source: 'strategy',
    decision: 'hold',
    label: 'No move is best',
    action: 'Hold current setup',
    target: direction.label,
    detail: 'The queue refused to force a low-evidence action.',
    why: direction.summary,
    risk: bestCandidate?.risk || 'The biggest risk is acting on a thin edge before newer information arrives.',
    confidence: clampPercent(Math.min(direction.confidence, bestCandidate?.confidence ?? direction.confidence)),
    tone: 'neutral',
    blockers: [],
    missingEvidence,
    sourceHealth: direction.scores.map((score) => `${score.label}: ${clampPercent(score.value)}%`),
    receipts: dedupeStrings(direction.actionPlan, 4),
    changeTriggers: dedupeStrings([
      'A waiver, lineup, or trade recommendation must clear the action threshold before this hold changes.',
      missingEvidence[0] ? `Add missing evidence: ${missingEvidence[0]}` : null,
      'Fresh schedule, usage, injury, and transaction data could raise confidence enough to act.',
    ], 4),
    dominoEffects: dedupeStrings([
      'No drop, trade, or lineup swap should fire from this read.',
      'Keep the current roster baseline until one action beats the do-nothing counterfactual.',
    ], 3),
    signals: dedupeStrings(['No forced action', direction.label, weeklyPlan?.summary], 4),
    score: 30,
  };
}

function buildAIActionQueue({
  direction,
  weeklyPlan,
  lineup,
  waivers,
  trades,
}: {
  direction: AutopilotData['direction'];
  weeklyPlan?: WeeklyActionPlan;
  lineup: AutopilotRecommendation[];
  waivers: AutopilotRecommendation[];
  trades: AutopilotRecommendation[];
}): AIActionQueueItem[] {
  const candidates = [
    ...waivers.map((recommendation, index) => buildRecommendationQueueItem(recommendation, 'waiver', index)),
    ...lineup.map((recommendation, index) => buildRecommendationQueueItem(recommendation, 'lineup', index)),
    ...trades.map((recommendation, index) => buildRecommendationQueueItem(recommendation, 'trade', index)),
  ]
    .filter((item): item is Omit<AIActionQueueItem, 'rank'> & { score: number } => Boolean(item))
    .sort((a, b) => b.score - a.score);

  const actionable = candidates.filter((item) => item.decision === 'do');
  const supporting = candidates.filter((item) => item.decision !== 'do');
  const selected = actionable.length
    ? [actionable[0], ...supporting]
    : [buildNoForcedMoveQueueItem({ direction, weeklyPlan, candidates }), ...supporting];

  return selected
    .slice(0, 4)
    .map(({ score: _score, ...item }, index) => ({
      ...item,
      rank: index + 1,
    }));
}

function buildAIRejections({
  data,
  actionQueue,
}: {
  data: ReportData;
  actionQueue: AIActionQueueItem[];
}): AIRejectionRead[] {
  const rows: AIRejectionRead[] = [];

  actionQueue
    .filter((item) => item.decision === 'blocked' || item.decision === 'watch')
    .forEach((item) => {
      rows.push({
        id: `reject-${item.id}`,
        source: item.source,
        action: item.decision === 'blocked' ? `Do not ${item.action.toLowerCase()}` : `Do not force ${item.action.toLowerCase()}`,
        target: item.target,
        reason: item.blockers[0] || item.missingEvidence[0] || item.risk,
        alternative: item.decision === 'blocked'
          ? 'Reload live data and clear the blocker before this can move.'
          : 'Keep it on watch until the evidence clears the action threshold.',
        confidence: item.confidence,
        tone: item.decision === 'blocked' ? 'danger' : 'warn',
        receipts: dedupeStrings([
          item.why,
          item.receipts[0],
          item.changeTriggers[0],
        ], 3),
      });
    });

  (data.waiverIntelligence?.omittedCandidates || [])
    .filter((candidate) => candidate.action === 'omit')
    .slice(0, 3)
    .forEach((candidate) => {
      rows.push({
        id: `reject-waiver-${candidate.player_id || normalizeManagerName(candidate.name)}`,
        source: 'waiver',
        action: 'Do not add',
        target: candidate.name,
        reason: candidate.reason || 'Waiver evidence layer omitted this player.',
        alternative: 'Use the ranked queue or leave the bench spot alone.',
        confidence: clampPercent(62 + Math.min(16, candidate.sourceCount * 4)),
        tone: 'danger',
        receipts: dedupeStrings([
          candidate.rank ? `${candidate.rank} rank was not enough to clear guardrails.` : null,
          candidate.value ? `${formatCompactValue(candidate.value)} value still failed the evidence check.` : null,
          `${candidate.sourceCount} source${candidate.sourceCount === 1 ? '' : 's'} attached.`,
        ], 3),
      });
    });

  if (!rows.length && actionQueue[0]?.decision === 'hold') {
    const hold = actionQueue[0];
    rows.push({
      id: 'reject-no-forced-action',
      source: hold.source,
      action: 'Do not manufacture a move',
      target: hold.target,
      reason: hold.risk,
      alternative: 'Hold the current roster baseline.',
      confidence: hold.confidence,
      tone: 'neutral',
      receipts: dedupeStrings([hold.why, hold.missingEvidence[0], hold.changeTriggers[0]], 3),
    });
  }

  const seen = new Set<string>();
  return rows
    .filter((row) => {
      const key = `${row.action}:${row.target}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);
}

function buildMarketAnomalyReads(data: ReportData, mode: AutopilotMode, manager: string): AIMarketAnomalyRead[] {
  const rows: AIMarketAnomalyRead[] = [];
  const seen = new Set<string>();
  const pushMomentum = (
    player: WeeklyMomentum | PlayerInfo,
    direction: 'rising' | 'falling',
  ) => {
    const playerWithDetails = withReportPlayerDetails(data, player) || player;
    const playerName = getPlayerName(playerWithDetails);
    const key = getPlayerIdentityKey(playerWithDetails) || playerName.toLowerCase();
    if (!playerName || seen.has(key)) return;
    const value = getAutopilotPlayerValue(playerWithDetails, mode);
    const rank = getAutopilotPlayerRank(playerWithDetails, mode);
    const pct = safeNumber('pct_change' in playerWithDetails ? playerWithDetails.pct_change : null);
    const diff = safeNumber('diff' in playerWithDetails ? playerWithDetails.diff : null);
    const delta = getPlayerSituationDelta(playerWithDetails);
    const ownedByFocus = sameManager(playerWithDetails.owner, manager);
    const isUnowned = !playerWithDetails.owner;
    const movement = pct !== null
      ? formatSignedPercent(pct)
      : diff !== null
        ? `${diff >= 0 ? '+' : ''}${formatCompactValue(diff)}`
        : direction === 'rising'
          ? '+watch'
          : '-watch';
    const absolutePct = Math.abs(pct ?? (diff && value ? (diff / Math.max(1, value)) * 100 : 0));
    const confidence = clampPercent(58 + Math.min(24, absolutePct * 1.8) + (rank ? 6 : 0) + (delta ? 8 : 0));
    const tone: AutopilotTone =
      direction === 'falling' && ownedByFocus
        ? 'warn'
        : direction === 'rising' && isUnowned
          ? 'good'
          : direction === 'falling'
            ? 'danger'
            : 'info';
    const label =
      direction === 'rising' && isUnowned
        ? 'Unclaimed market heat'
        : direction === 'rising' && ownedByFocus
          ? 'Roster value pop'
          : direction === 'falling' && ownedByFocus
            ? 'Roster value leak'
            : direction === 'falling'
              ? 'Market fade warning'
              : 'Market mismatch';
    const suggestedAction =
      direction === 'rising' && isUnowned
        ? 'Check availability before the room catches up.'
        : direction === 'falling' && ownedByFocus
          ? 'Do not ignore the sell-window leak.'
          : direction === 'falling'
            ? 'Avoid paying full market price.'
            : 'Keep as a watchlist receipt, not an automatic move.';

    seen.add(key);
    rows.push({
      id: `market-${direction}-${key}`,
      player: playerName,
      position: getPlayerLineupPosition(playerWithDetails),
      label,
      summary: `${movement} movement${rank ? ` with ${rank}` : ''}${value ? ` and ${formatCompactValue(value)} value` : ''}.`,
      suggestedAction,
      confidence,
      tone,
      receipts: dedupeStrings([
        direction === 'rising' ? 'Market moved up this cycle.' : 'Market moved down this cycle.',
        playerWithDetails.owner ? `Owned by ${playerWithDetails.owner}.` : 'Currently unowned in this report.',
        delta ? getPlayerSituationSignal(playerWithDetails) : null,
        mode === 'redraft' ? 'Current-season lens only.' : 'Dynasty market lens.',
      ], 4),
    });
  };

  [...(data.weeklyRisers || [])]
    .sort((a, b) => Math.abs(b.pct_change || 0) - Math.abs(a.pct_change || 0))
    .slice(0, 4)
    .forEach((player) => pushMomentum(player, 'rising'));
  [...(data.weeklyFallers || [])]
    .sort((a, b) => Math.abs(b.pct_change || 0) - Math.abs(a.pct_change || 0))
    .slice(0, 4)
    .forEach((player) => pushMomentum(player, 'falling'));

  if (rows.length < 4) {
    [...(data.projectedRisers || [])].slice(0, 3).forEach((player) => pushMomentum(player, 'rising'));
    [...(data.projectedFallers || [])].slice(0, 3).forEach((player) => pushMomentum(player, 'falling'));
  }

  return rows
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);
}

function calibrationPriorityTone(priority?: ReportAICalibrationAdjustment['priority']): AutopilotTone {
  if (priority === 'danger') return 'danger';
  if (priority === 'warn') return 'warn';
  if (priority === 'info') return 'info';
  if (priority === 'good') return 'good';
  return 'neutral';
}

function buildAIReportCardRead({
  data,
  direction,
  actionQueue,
  rejections,
  marketAnomalies,
}: {
  data: ReportData;
  direction: AutopilotData['direction'];
  actionQueue: AIActionQueueItem[];
  rejections: AIRejectionRead[];
  marketAnomalies: AIMarketAnomalyRead[];
}): AIReportCardRead {
  const leagueConfidence = getLeagueAiConfidenceScore(data);
  const confidence = clampPercent(leagueConfidence ?? direction.confidence);
  const calibration = data.leagueDiagnostics?.aiConfidence?.calibration;
  const adjustmentProfile = data.aiCalibrationAdjustmentProfile;
  const topAdjustment = adjustmentProfile?.adjustments?.find((adjustment) =>
    adjustment.scoreAdjustment !== 0 || adjustment.confidenceCap !== null
  ) || null;
  const serverDelta = data.serverReportDelta || null;
  const doCount = actionQueue.filter((item) => item.decision === 'do').length;
  const blockedOrWatch = actionQueue.filter((item) => item.decision === 'blocked' || item.decision === 'watch').length;
  const sourceWarnings = actionQueue.flatMap((item) => item.sourceHealth)
    .filter((source) => /missing|stale|error|limited|0 rows|no source/i.test(source));
  const grade =
    confidence >= 88 && !sourceWarnings.length
      ? 'A'
      : confidence >= 76
        ? 'B'
        : confidence >= 62
          ? 'C'
          : 'D';
  const tone = scoreTone(confidence);
  const calibrationStatus = calibration
    ? `${calibration.observedSampleSize}/${calibration.targetSampleSize} calibration samples`
    : 'Calibration samples pending';
  const rows: AIReportCardRead['rows'] = [
    {
      label: 'One-call discipline',
      status: doCount <= 1 ? 'Clean' : `${doCount} do-this calls`,
      detail: doCount <= 1
        ? 'Only one action can own the top verdict.'
        : 'Too many actions cleared; confidence should be tightened before users see this.',
      tone: doCount <= 1 ? 'good' : 'danger',
    },
    {
      label: 'Daily delta',
      status: serverDelta?.changes?.length
        ? `${serverDelta.changes.length} server change${serverDelta.changes.length === 1 ? '' : 's'}`
        : 'No material change',
      detail: serverDelta?.summary || 'No prior server report has been attached for comparison yet.',
      tone: serverDelta?.changes?.[0]?.tone || 'neutral',
    },
    {
      label: 'Bad-idea engine',
      status: rejections.length ? `${rejections.length} blocked/watch reads` : 'No bad ideas flagged',
      detail: rejections.length
        ? 'The app is actively refusing low-evidence moves.'
        : 'No blocked read is attached to this queue right now.',
      tone: rejections.length ? 'good' : 'info',
    },
    {
      label: 'Market anomaly scan',
      status: marketAnomalies.length ? `${marketAnomalies.length} anomalies` : 'Quiet market',
      detail: marketAnomalies[0]?.summary || 'No weekly market mismatch is loud enough to surface.',
      tone: marketAnomalies.length ? marketAnomalies[0].tone : 'neutral',
    },
    {
      label: 'Calibration memory',
      status: adjustmentProfile
        ? `${adjustmentProfile.scoredCount} scored / ${adjustmentProfile.adjustments.length} adjustments`
        : calibrationStatus,
      detail: topAdjustment?.reason || calibration?.note || 'Confidence still learns from saved predictions, outcomes, and admin feedback.',
      tone: topAdjustment ? calibrationPriorityTone(topAdjustment.priority) : calibration?.status === 'ready' ? 'good' : calibration?.status === 'collecting' ? 'info' : 'warn',
    },
    {
      label: 'Source health',
      status: sourceWarnings.length ? `${sourceWarnings.length} warning${sourceWarnings.length === 1 ? '' : 's'}` : 'Clean receipts',
      detail: sourceWarnings[0] || 'Top verdict has no stale/missing/error source warning attached.',
      tone: sourceWarnings.length ? 'warn' : 'good',
    },
    {
      label: 'Guardrail pressure',
      status: blockedOrWatch ? `${blockedOrWatch} capped reads` : 'No caps',
      detail: blockedOrWatch
        ? 'Watch/blocked reads stay below the action threshold.'
        : 'No lower-confidence read is competing with the verdict.',
      tone: blockedOrWatch ? 'info' : 'good',
    },
  ];

  return {
    grade,
    confidence,
    tone,
    summary: `The AI is running at ${confidence}% league confidence with ${doCount <= 1 ? 'one-call discipline' : `${doCount} competing actions`} and ${rejections.length} bad-idea guardrail${rejections.length === 1 ? '' : 's'}.`,
    rows,
  };
}

function getProjectedPickBand(originalOwner: string, data: ReportData): string {
  const leagueSize = getLeagueSize(data);
  const standing = data.currentStandings?.find((row) => sameManager(row.manager, originalOwner));
  const rank = standing?.rank || null;
  if (!rank) return 'unplaced';
  if (rank > Math.ceil(leagueSize * 0.67)) return 'early';
  if (rank > Math.ceil(leagueSize * 0.34)) return 'mid';
  return 'late';
}

function getRookieTierForPick(round: number, band: string) {
  if (round <= 1) {
    if (band === 'early') return 'Top rookie tier: early 1st QB/RB/WR profiles';
    if (band === 'mid') return 'Middle rookie tier: Round 1 skill-position targets';
    if (band === 'late') return 'Late 1st tier: falling first-round values or premium TEs';
    return 'Round 1 rookie tier until standings create a slot band';
  }
  if (round === 2) return 'Round 2 rookie tier: role bets, productive WRs, and RB depth shots';
  if (round === 3) return 'Round 3 rookie tier: athletic bets, landing-spot winners, and taxi stashes';
  return 'Late rookie tier: taxi stashes and waiver-equivalent bets';
}

function buildFuturePickTrajectory(data: ReportData, manager: string): FuturePickTrajectory | undefined {
  const portfolios = [...(data.pickPortfolios || [])].sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0));
  if (!portfolios.length) return undefined;
  const portfolio = portfolios.find((row) => sameManager(row.manager, manager)) || portfolios[0];
  if (!portfolio) return undefined;
  const currentRank = portfolios.findIndex((row) => sameManager(row.manager, portfolio.manager)) + 1 || null;
  const picks = (portfolio.futurePicks || []).slice(0, 8).map((pick) => {
    const projectedBand = getProjectedPickBand(pick.originalOwner, data);
    return {
      label: pick.label,
      projectedBand,
      rookieTier: getRookieTierForPick(pick.round, projectedBand),
      value: pick.value,
    };
  });
  const projectedSlots = portfolio.projectedSlots || [];
  const currentValue = portfolio.totalValue || 0;
  const points = [
    { label: 'Now', value: currentValue },
    { label: '2026', value: portfolio.value2026 || 0 },
    { label: '2027', value: portfolio.value2027 || 0 },
  ].filter((point) => point.value > 0);
  const likelyRookieRange = picks[0]?.rookieTier || projectedSlots[0] || 'Future rookie tier will sharpen once pick slots move with standings.';

  return {
    manager: portfolio.manager,
    currentRank,
    currentValue,
    likelyRookieRange,
    note: projectedSlots.length
      ? `Known projected slots: ${projectedSlots.slice(0, 4).join(', ')}. Future picks should reprice as standings move during the season.`
      : 'Future pick graph is using current portfolio value and owner standings bands until exact rookie slots are known.',
    picks,
    points: points.length ? points : [{ label: 'Now', value: currentValue }],
  };
}

function collectWaiverCandidates(data: ReportData, mode: AutopilotMode, intel?: ManagerRosterIntelligence | null): TrendingPlayer[] {
  const waiver = data.waiverIntelligence;
  if (!waiver) return [];
  const omittedCandidateIds = new Set(
    (waiver.omittedCandidates || [])
      .filter((candidate) => candidate.action === 'omit')
      .map((candidate) => candidate.player_id)
  );
  const candidates = [
    ...(waiver.availableTrendingAdds || []),
    waiver.highestKtcAvailable,
    ...(waiver.bestTaxiStashes || []),
    ...(waiver.recentlyDroppedValuable || []),
    ...Object.values(waiver.bestAvailableByPosition || {}),
    ...(waiver.weeklyEcrTargets || []).map((target) => target.player),
  ].filter((player): player is TrendingPlayer => Boolean(player?.name));
  const seen = new Set<string>();
  return candidates
    .filter((player) => {
      if (omittedCandidateIds.has(player.player_id)) return false;
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
  const matchupGuard = getWaiverMatchupGuard(player);
  const needBonus = intel?.tradePlan?.needPosition === position ? 18 : 0;
  const youngBonus = mode === 'dynasty' && age && age <= 24 ? 13 : 0;
  const roleBonus = mode === 'redraft' && rank && rank <= 45 ? 14 : 0;
  const weeklyEcrRank = parsePositionRankValue(player.weeklyEcr?.bestPositionRank)
    || player.weeklyEcr?.bestRankEcr
    || null;
  const weeklyEcrBonus = weeklyEcrRank
    ? Math.max(0, 18 - weeklyEcrRank / 6) + Math.min(10, (player.weeklyEcr?.confidence || 0) / 10)
    : 0;
  return Math.max(0, Math.min(100, value / 115 + Math.min(22, (player.count || 0) / 8) + (rank ? Math.max(0, 22 - rank / 3) : 0) + needBonus + youngBonus + roleBonus + weeklyEcrBonus + matchupGuard.score));
}

function formatWaiverWeeklyEcrRead(player: TrendingPlayer): string | null {
  const signal = player.weeklyEcr;
  if (!signal?.weeks?.length) return null;
  const bestRank = signal.bestPositionRank || (signal.bestRankEcr ? `Rank ${Math.round(signal.bestRankEcr)}` : null);
  const windowWeeks = signal.matchupWindows?.next3?.weeks || null;
  const rows = windowWeeks?.length
    ? signal.weeks.filter((week) => windowWeeks.includes(week.week))
    : signal.weeks.slice(0, 3);
  const window = rows
    .map((week) => {
      if (week.isBye) return `W${week.week} BYE`;
      if (week.opponent || week.matchupStars || week.opponentRank) {
        const site = week.homeAway === 'home' ? 'vs.' : week.homeAway === 'away' ? 'at' : '';
        const opponent = week.opponent ? `${site} ${week.opponent}`.trim() : 'opponent TBD';
        const stars = typeof week.matchupStars === 'number' ? `${week.matchupStars}-star` : 'unrated';
        const rank = typeof week.opponentRank === 'number' ? `#${week.opponentRank}` : null;
        return `W${week.week} ${opponent} ${stars}${rank ? ` (${rank})` : ''}`;
      }
      return `W${week.week} ${week.positionRank || (week.rankEcr ? `Rank ${week.rankEcr}` : 'ranked')}`;
    })
    .join(' / ');
  const label = signal.source === 'DraftSharks' || signal.signalType === 'draftsharks-sos'
    ? 'DraftSharks next-3 SOS window'
    : 'FantasyPros next-3 rank window';
  const playoffSummary = signal.matchupWindows?.playoffs?.playableWeeks
    ? signal.matchupWindows.playoffs.summary
    : null;
  return [bestRank ? `${label}: ${bestRank}` : null, window, playoffSummary].filter(Boolean).join(': ') || null;
}

function formatWaiverWeeklyEcrTraceRead(player: TrendingPlayer): string | null {
  const signal = player.weeklyEcr;
  if (!signal?.sourceTrace?.length) return null;
  const loadedWeeks = signal.sourceTrace
    .map((trace) => trace.week)
    .filter((week): week is number => Number.isFinite(week))
    .sort((a, b) => a - b)
    .map((week) => `W${week}`)
    .join('/');
  const sourceLabel = signal.source === 'DraftSharks' || signal.signalType === 'draftsharks-sos'
    ? 'DraftSharks SOS'
    : 'FantasyPros rank';
  return `${loadedWeeks || 'Rolling weeks'} backed by stored ${sourceLabel} snapshots.`;
}

function getAutopilotValueSourceCount(player: TrendingPlayer): number {
  const sources = new Set((player.playerDetails?.valueProfile?.sources || []).filter(Boolean));
  if (player.weeklyEcr) sources.add(player.weeklyEcr.source === 'DraftSharks' ? 'DraftSharks SOS snapshot' : 'FantasyPros rank snapshot');
  return sources.size;
}

function getLatestAutopilotAddManager(data: ReportData, player: TrendingPlayer): string | null {
  const playerId = player.player_id;
  if (!playerId || !data.recentTransactions?.length) return null;
  const sorted = [...data.recentTransactions].sort((a, b) => {
    const aDate = Date.parse(a.date);
    const bDate = Date.parse(b.date);
    return (Number.isFinite(aDate) ? aDate : 0) - (Number.isFinite(bDate) ? bDate : 0);
  });
  let latestAction: { type: 'added' | 'dropped'; manager: string | null } | null = null;
  for (const transaction of sorted) {
    if (transaction.addedPlayer?.player_id === playerId) {
      latestAction = { type: 'added', manager: transaction.manager || null };
    }
    if (transaction.droppedPlayer?.player_id === playerId) {
      latestAction = { type: 'dropped', manager: transaction.manager || null };
    }
  }
  if (!latestAction) return null;
  return latestAction.type === 'added' ? latestAction.manager || 'another manager' : null;
}

function getFaabSuggestion(confidence: number, mode: AutopilotMode) {
  if (confidence >= 84) return mode === 'redraft' ? 'FAAB 12-18%' : 'FAAB 8-14%';
  if (confidence >= 74) return mode === 'redraft' ? 'FAAB 7-11%' : 'FAAB 5-8%';
  return mode === 'redraft' ? 'FAAB 3-6%' : 'FAAB 1-4%';
}

function buildWaiverRecommendations(data: ReportData, mode: AutopilotMode, manager: string, fallback: AutopilotRecommendation[]): AutopilotRecommendation[] {
  const intel = findManagerIntel(data, manager);
  const dropCandidate = intel?.droppablePlayers?.[0] || null;
  const rawCandidates = collectWaiverCandidates(data, mode, intel);
  if (!rawCandidates.length) return fallback;

  const candidates = rawCandidates
    .map((player) => {
      const score = scoreWaiverCandidate(player, mode, intel);
      const rank = getAutopilotPlayerRank(player, mode);
      const value = getAutopilotPlayerValue(player, mode) || 0;
      const weeklyEcrRead = formatWaiverWeeklyEcrRead(player);
      const weeklyEcrTraceRead = formatWaiverWeeklyEcrTraceRead(player);
      const matchupOutlook = isScheduleWindowSignal(player.weeklyEcr)
        ? getShortTermMatchupOutlook(player.weeklyEcr.matchupWindows)
        : null;
      const sourceCount = getAutopilotValueSourceCount(player);
      const hasCurrentSeasonValue = Boolean(
        player.playerDetails?.valueProfile?.seasonValue ||
        player.playerDetails?.valueProfile?.fantasyProsSeasonValue ||
        player.weeklyEcr
      );
      const hasDynastyValue = Boolean(
        player.playerDetails?.valueProfile?.dynastyValue ||
        player.playerDetails?.valueProfile?.balancedValue ||
        player.ktcValue
      );
      const signalModes: AIEvidenceMode[] = [
        mode === 'redraft' && hasCurrentSeasonValue ? 'redraft' : null,
        hasCurrentSeasonValue ? 'current' : null,
        mode === 'dynasty' && hasDynastyValue ? 'dynasty' : null,
        player.weeklyEcr ? 'schedule' : null,
        player.count ? 'market' : null,
        player.playerDetails?.prospectProfile ? 'prospect' : null,
      ].filter((item): item is AIEvidenceMode => Boolean(item));
      const evidenceRead = evaluateAIEvidence({
        surface: 'autopilot',
        action: getPlayerLineupPosition(player) === 'K' || getPlayerLineupPosition(player) === 'DEF' ? 'stream' : 'pickup',
        leagueValueMode: mode,
        leagueContext: getAIEvidenceLeagueContextFromDiagnostics(
          data.leagueDiagnostics,
          mode
        ),
        leagueActivity: buildAIEvidenceLeagueActivityContext(data),
        baseScore: score,
        evidence: dedupeStrings([
          rank ? `${rank} rank is attached to this waiver action.` : null,
          value > 0 ? `${formatCompactValue(value)} ${mode === 'redraft' ? 'season' : 'market'} value is attached.` : null,
          player.count ? `${formatCompactValue(player.count)} add/drop trend signal in the feed.` : null,
          weeklyEcrRead,
          intel?.tradePlan?.needPosition === getPlayerPosition(player) ? `Matches ${manager}'s ${getPlayerPosition(player)} need.` : null,
          dropCandidate ? `${dropCandidate.name} is a usable drop candidate if a roster spot is needed.` : null,
        ], 8),
        missingEvidence: dedupeStrings([
          rank ? null : 'No trusted positional rank is attached.',
          sourceCount ? null : 'No value source count is attached.',
          ['K', 'DEF'].includes(getPlayerLineupPosition(player)) && !player.weeklyEcr ? 'No short-window schedule source is attached.' : null,
        ], 8),
        sourceTrace: dedupeStrings([
          sourceCount ? `${sourceCount} value/schedule source${sourceCount === 1 ? '' : 's'} attached.` : null,
          weeklyEcrTraceRead,
        ], 8),
        signalModes,
        player: {
          name: player.name,
          position: getPlayerLineupPosition(player),
          team: player.playerDetails?.team || player.team,
          owner: player.owner,
          rosterStatus: player.playerDetails?.rosterStatus || player.playerDetails?.displayStatus || null,
          recentlyAddedBy: getLatestAutopilotAddManager(data, player),
          value,
          sourceCount,
          hasCurrentSeasonValue,
          hasDynastyValue,
          hasProspectOnlyValue: Boolean(player.playerDetails?.prospectProfile && !hasCurrentSeasonValue && !hasDynastyValue),
        },
        schedule: {
          hasScheduleData: Boolean(player.weeklyEcr?.matchupWindows || player.weeklyEcr?.weeks?.length),
          isRoughStart: Boolean(matchupOutlook?.isRoughStart),
          isStrongStart: Boolean(matchupOutlook?.isStrongStart),
          missingReason: 'No stored matchup window is attached to this streamer read.',
        },
      });
      return { player, score, rank, weeklyEcrRead, weeklyEcrTraceRead, evidenceRead };
    })
    .filter(({ evidenceRead }) => evidenceRead.shouldRender && evidenceRead.label !== 'thin')
    .sort((a, b) => b.evidenceRead.finalScore - a.evidenceRead.finalScore)
    .slice(0, 2);
  if (!candidates.length) return [];

  return candidates.map(({ player, score, rank, weeklyEcrRead, weeklyEcrTraceRead, evidenceRead }, index) => {
    const confidence = Math.min(
      evidenceRead.finalScore,
      clampPercent(56 + score * 0.35 + (dropCandidate ? 5 : 0))
    );
    const age = getPlayerAge(player);
    const matchupGuard = getWaiverMatchupGuard(player);
    const receiptItems = getAIEvidenceReceiptItems(evidenceRead);
    return {
      id: `waiver-${player.player_id || player.name}`,
      type: 'Waiver',
      player: player.name,
      secondary: [getFaabSuggestion(confidence, mode), dropCandidate ? `drop ${dropCandidate.name}` : null].filter(Boolean).join(' | '),
      action: evidenceRead.canAct ? (index === 0 ? 'Priority add' : 'Add if available') : 'Monitor only',
      confidence,
      risk: confidence >= 78 ? 'Low' : 'Medium',
      upside: mode === 'dynasty' && age && age <= 24 ? 'High' : confidence >= 80 ? 'High' : 'Medium',
      summary: mode === 'redraft'
        ? `${evidenceRead.canAct ? 'Do this' : "Don't add yet"}: ${player.name} has the strongest current-season waiver case the evidence layer allows.`
        : `${evidenceRead.canAct ? 'Do this' : "Don't add yet"}: ${player.name} has the strongest dynasty waiver case the evidence layer allows${weeklyEcrRead ? ', with short-window matchup support' : ''}.`,
      reasons: dedupeStrings([
        evidenceRead.whyThisFired,
        player.count ? `${formatCompactValue(player.count)} add/drop trend signal in the feed.` : null,
        rank ? `${rank} rank gives this more than a blind trend-chase case.` : null,
        weeklyEcrRead,
        matchupGuard.reason,
        weeklyEcrTraceRead,
        intel?.tradePlan?.needPosition === getPlayerPosition(player) ? `Matches ${manager}'s ${getPlayerPosition(player)} need.` : null,
        dropCandidate ? `${dropCandidate.name} is a usable drop candidate if a roster spot is needed.` : null,
      ], 4),
      signals: dedupeStrings([evidenceRead.label, 'Available', rank, matchupGuard.signal, weeklyEcrTraceRead ? 'Stored schedule trace' : weeklyEcrRead ? 'Schedule edge' : null, player.count ? 'Trend count' : null, mode === 'dynasty' && age && age <= 24 ? 'Young stash' : null, ...receiptItems.slice(0, 1)], 4),
      evidenceRead,
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
  const managerSituationCopy = getManagerSituationCopy(intel);
  const cards: AutopilotRecommendation[] = [];

  (intel.tradeBlueprints || []).slice(0, 2).forEach((blueprint, index) => {
    const player = withReportPlayerDetails(data, blueprint.givePlayer || blueprint.getPlayer || intel.sellCandidate || intel.buyTarget);
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
        getPlayerSituationSignal(player),
        managerSituationCopy,
        partner ? `${partner} has the matching position-depth signal.` : null,
        mode === 'dynasty' ? 'Dynasty mode weighs age curve, value liquidity, and future picks.' : 'Redraft mode only cares about current-season starter points.',
      ], 3),
      signals: dedupeStrings([blueprint.label, blueprint.tone, getPlayerSituationSignal(player), intel.tradePlan?.needPosition ? `Need ${intel.tradePlan.needPosition}` : null, intel.tradePlan?.surplusPosition ? `Surplus ${intel.tradePlan.surplusPosition}` : null], 4),
      tone: isSell ? 'warn' : 'good',
    });
  });

  if (cards.length < 2 && intel.sellCandidate) {
    const sellCandidate = withReportPlayerDetails(data, intel.sellCandidate) || intel.sellCandidate;
    cards.push({
      id: `trade-sell-${sellCandidate.player_id || sellCandidate.name}`,
      type: 'Trade',
      player: getPlayerName(sellCandidate),
      secondary: partner ? `shop to ${partner}` : describePlayer(sellCandidate, mode) || undefined,
      action: 'Trade away',
      confidence: recommendationConfidence(mode === 'dynasty' ? 68 : 62, [sellCandidate, intel.tradePlan, partner, intel.marketSignals?.length]),
      risk: 'Medium',
      upside: mode === 'dynasty' ? 'High' : 'Medium',
      summary: mode === 'dynasty'
        ? `${getPlayerName(sellCandidate)} is the best sell candidate if this roster needs to protect future value or convert fragile production.`
        : `${getPlayerName(sellCandidate)} is the best trade-away candidate if the return upgrades a weekly starter slot.`,
      reasons: dedupeStrings([intel.tradePlan?.summary, getPlayerSituationSignal(sellCandidate), intel.marketSignals?.[0], intel.pressurePoints?.[0]], 3),
      signals: dedupeStrings(['Sell candidate', getPlayerSituationSignal(sellCandidate), partner ? 'Partner fit' : null, intel.tradePlan?.surplusPosition ? `Surplus ${intel.tradePlan.surplusPosition}` : null], 4),
      tone: 'warn',
    });
  }

  if (cards.length < 2 && intel.buyTarget) {
    const buyTarget = withReportPlayerDetails(data, intel.buyTarget) || intel.buyTarget;
    cards.push({
      id: `trade-buy-${buyTarget.player_id || buyTarget.name}`,
      type: 'Trade',
      player: getPlayerName(buyTarget),
      secondary: partner ? `start with ${partner}` : describePlayer(buyTarget, mode) || undefined,
      action: 'Acquire',
      confidence: recommendationConfidence(66, [buyTarget, intel.tradePlan, partner, intel.similarValuePlayers]),
      risk: 'Medium',
      upside: 'High',
      summary: `${getPlayerName(buyTarget)} is the cleanest external target profile for this roster's current need.`,
      reasons: dedupeStrings([intel.tradePlan?.summary, getPlayerSituationSignal(buyTarget), mode === 'redraft' ? 'The target improves current-season scoring.' : 'The target fits the roster window better than a generic best-player trade.'], 3),
      signals: dedupeStrings(['Buy target', getPlayerSituationSignal(buyTarget), partner ? 'Partner fit' : null, intel.tradePlan?.needPosition ? `Need ${intel.tradePlan.needPosition}` : null], 4),
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

export function buildSleeperResearchTodo(mode: AutopilotMode): string[] {
  return [
    'Check `GET /v1/state/nfl` first so season and week context stay dynamic.',
    'Cache `GET /players/nfl/research/<season_type>/<season>[/<week>]` snapshots so rostered % and start % can trend over time.',
    'Add `GET /v1/players/nfl/{player_id}` for single-player metadata lookups.',
    'Add `GET /v1/players/nfl/{team}/depth_chart` for Sleeper-native depth chart context.',
    mode === 'redraft'
      ? 'Then wire projections into start/sit and weekly plan cards.'
      : 'Then layer projections into dynasty market reads and ranking context.',
  ];
}

function buildIntelPlayerProjection(
  player: AutopilotPlayerLike,
  direction: ValueDirection,
  mode: AutopilotMode,
  signal: string,
): PlayerProjection {
  const age = getPlayerAge(player);
  const position = getPlayerPosition(player);
  const value = getAutopilotPlayerValue(player, mode);
  const rank = getAutopilotPlayerRank(player, mode);
  const situationSignal = getPlayerSituationSignal(player);
  const situationDelta = getPlayerSituationDelta(player);
  const ageSignal = age
    ? position === 'RB' && age >= 28
      ? 'RB age risk'
      : age <= 24
        ? 'Young value curve'
        : `Age ${age}`
    : null;
  const confidence = confidenceFromSignals(
    direction === 'Stable' ? 58 : 62,
    [rank, value, age, signal, player.playerDetails?.valueProfile, situationDelta],
    direction === 'Stable' ? 4 : 0,
  );

  return {
    player: getPlayerName(player),
    position,
    direction,
    currentValue: [rank, value ? formatCompactValue(value) : null].filter(Boolean).join(' | ') || position,
    projectedMove: direction === 'Rising' ? '+watch' : direction === 'Falling' ? '-watch' : 'hold',
    confidence: Math.min(confidence, situationDelta?.freshness?.grade === 'stale' || situationDelta?.freshness?.grade === 'missing' ? 62 : 100),
    signals: dedupeStrings([
      signal,
      situationSignal,
      ageSignal,
      rank,
      mode === 'redraft' ? 'Season-only lens' : 'Dynasty value lens',
    ], 4),
  };
}

function buildPlayerProjections(data: ReportData, mode: AutopilotMode, manager: string, fallback: PlayerProjection[]): PlayerProjection[] {
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

  if (projections.length < 4) {
    const intel = findManagerIntel(data, manager);
    getManagerSituationPlayers(intel)
      .map((player) => withReportPlayerDetails(data, player) || player)
      .map((player) => {
        const delta = getPlayerSituationDelta(player);
        if (!delta || delta.confidence < 62 || delta.primaryLabel === 'source-limited-route-read') return null;
        const direction: ValueDirection = delta.action === 'buy' || delta.action === 'stash'
          ? 'Rising'
          : delta.action === 'sell' || delta.action === 'avoid'
          ? 'Falling'
          : 'Stable';
        return buildIntelPlayerProjection(player, direction, mode, formatSituationLabel(delta.primaryLabel));
      })
      .forEach((projection) => {
        if (projection) addProjection(projection);
      });
  }

  if (projections.length < 4) {
    const intel = findManagerIntel(data, manager);
    [
      intel?.youngCorePlayer ? buildIntelPlayerProjection(intel.youngCorePlayer, mode === 'redraft' ? 'Stable' : 'Rising', mode, 'Young core') : null,
      intel?.breakoutCandidate ? buildIntelPlayerProjection(intel.breakoutCandidate, 'Rising', mode, 'Breakout candidate') : null,
      intel?.sellCandidate ? buildIntelPlayerProjection(intel.sellCandidate, mode === 'redraft' ? 'Stable' : 'Falling', mode, 'Sell candidate') : null,
      intel?.oldestPlayer ? buildIntelPlayerProjection(intel.oldestPlayer, mode === 'redraft' ? 'Stable' : 'Falling', mode, 'Age-curve watch') : null,
    ].forEach((projection) => {
      if (projection) addProjection(projection);
    });
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
  const sleeperResearchTodo = buildSleeperResearchTodo(mode);
  const schedulePlanning = data.schedulePlanning;
  const rosterGaps = asArray(schedulePlanning?.rosterGaps).sort((a, b) => {
    const severityRank: Record<'low' | 'medium' | 'high', number> = { low: 0, medium: 1, high: 2 };
    return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
  });
  const streamerCandidate = asArray(schedulePlanning?.streamerCandidates)[0] || null;
  const firstByeWeek = asArray(schedulePlanning?.byeWeekNotes).sort((a, b) => a.week - b.week)[0] || null;

  if (schedulePlanning?.status === 'ready' || rosterGaps.length || streamerCandidate || firstByeWeek) {
    return [
      ...sleeperResearchTodo,
      schedulePlanning?.status === 'ready'
        ? `Schedule planning is live${schedulePlanning.source ? ` from ${schedulePlanning.source}` : ''}; use it to drive bye-week coverage.`
        : 'Schedule planning is partial; keep the bye-week and streamer lanes ready for the next data pass.',
      rosterGaps[0]
        ? `${rosterGaps[0].manager} has ${rosterGaps[0].position} depth pressure in ${formatWeekList(rosterGaps[0].weeks) || 'key bye weeks'}.`
        : 'Map roster gaps to the toughest bye-week stretches once the schedule is live.',
      streamerCandidate
        ? `${streamerCandidate.name} is a schedule-driven streamer target${formatWeekList(streamerCandidate.targetWeeks) ? ` for ${formatWeekList(streamerCandidate.targetWeeks)}` : ''}.${firstByeWeek ? ` Week ${firstByeWeek.week} is the first bye-week checkpoint${firstByeWeek.teams?.length ? ` for ${firstByeWeek.teams.join(', ')}` : ''}.` : ''}`
        : firstByeWeek
          ? `Week ${firstByeWeek.week} is the first bye-week checkpoint${firstByeWeek.teams?.length ? ` for ${firstByeWeek.teams.join(', ')}` : ''}.`
          : mode === 'redraft'
            ? 'Use SOS to separate streamers and same-tier flex plays.'
            : 'Use SOS for playoff-window planning without overpowering long-term player value.',
    ];
  }

  if (data.matchupPreviews?.length) {
    return [
      ...sleeperResearchTodo,
      `${data.matchupPreviews.length} matchup preview${data.matchupPreviews.length === 1 ? '' : 's'} are available for weekly lineup context.`,
      'Next layer: weight defensive schedule strength by position instead of treating every matchup note equally.',
      mode === 'redraft'
        ? 'Use SOS to separate streamers and same-tier flex plays.'
        : 'Use SOS for playoff-window planning without overpowering long-term player value.',
    ];
  }

  return [
    ...sleeperResearchTodo,
    'Add weekly defensive matchup scoring when the league schedule is released.',
    'Compare playoff-week opponent strength for each starter.',
    mode === 'redraft'
      ? 'Blend matchup difficulty into start/sit, streamer, and waiver confidence.'
      : 'Blend matchup difficulty into start/sit confidence without overpowering talent, role, and dynasty value.',
  ];
}

export function buildAutopilotData({ reportData, mode, fallback }: AutopilotBuildInput): AutopilotData {
  if (!reportData) return fallback;

  const focusManager = getFocusManager(reportData, fallback);
  const managerTendency = buildManagerTendencyProfile(reportData, focusManager);
  const direction = buildDirection(reportData, mode, focusManager, fallback.direction, managerTendency);
  const lineup = capRecommendationCards(reportData, focusManager, buildLineupRecommendations(reportData, mode, focusManager, fallback.lineup), 'lineup');
  const weeklyPlan = capWeeklyActionPlan(reportData, focusManager, buildWeeklyActionPlan(reportData, mode, focusManager, lineup, fallback.weeklyPlan));
  const waivers = capRecommendationCards(reportData, focusManager, buildWaiverRecommendations(reportData, mode, focusManager, fallback.waivers), 'waiver');
  const trades = capRecommendationCards(reportData, focusManager, buildTradeRecommendations(reportData, mode, focusManager, fallback.trades), 'trade');
  const projections = capPlayerProjections(reportData, focusManager, buildPlayerProjections(reportData, mode, focusManager, fallback.projections));
  const weeklyRecap = buildWeeklyRecapRead(weeklyPlan, waivers, trades, mode, focusManager);
  const actionQueue = buildAIActionQueue({ direction, weeklyPlan, lineup, waivers, trades });
  const rejections = buildAIRejections({ data: reportData, actionQueue });
  const marketAnomalies = buildMarketAnomalyReads(reportData, mode, focusManager);
  const reportCard = buildAIReportCardRead({
    data: reportData,
    direction,
    actionQueue,
    rejections,
    marketAnomalies,
  });
  const futurePickTrajectory = mode === 'dynasty'
    ? buildFuturePickTrajectory(reportData, focusManager)
    : undefined;

  return {
    mode,
    focusManager,
    dataStatus: 'Live report data',
    headline: mode === 'redraft'
      ? `${focusManager} win-now cockpit`
      : `${focusManager} dynasty cockpit`,
    direction,
    systemRead: buildSystemRead(reportData),
    actionQueue,
    lineup,
    weeklyPlan,
    weeklyRecap,
    reportCard,
    rejections,
    marketAnomalies,
    waivers,
    trades,
    projections,
    futurePickTrajectory,
    power: buildPowerRows(reportData, mode, fallback.power),
    managerTendency,
    scheduleTodo: buildScheduleTodo(reportData, mode),
  };
}

export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getRiskTone(risk: AutopilotRecommendation['risk']): AutopilotTone {
  if (risk === 'Low') return 'good';
  if (risk === 'High') return 'danger';
  return 'warn';
}

export function getDirectionTone(direction: ValueDirection): AutopilotTone {
  if (direction === 'Rising') return 'good';
  if (direction === 'Falling') return 'danger';
  return 'info';
}
