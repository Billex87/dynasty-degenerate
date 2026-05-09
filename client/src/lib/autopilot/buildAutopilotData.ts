import { getPlayerRankForMode, getPlayerValueForMode } from '@/lib/leagueValueMode';
import type {
  ManagerRosterIntelligence,
  MatchupPreview,
  PlayerDetails,
  PlayerInfo,
  PowerRanking,
  ReportData,
  TrendingPlayer,
  WeeklyMomentum,
} from '@shared/types';
import type {
  AutopilotData,
  AutopilotMode,
  AutopilotRecommendation,
  AutopilotScore,
  AutopilotTone,
  LeaguePowerRow,
  ManagerTendencyProfile,
  PlayerProjection,
  ValueDirection,
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

type AutopilotBuildInput = {
  reportData?: ReportData;
  mode: AutopilotMode;
  fallback: AutopilotData;
};

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
  const strategy = shortenText(intel?.tradePlan?.summary || intel?.pressurePoints?.[0] || intel?.marketSignals?.[0] || tendencyProfile.summary, 220)
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
    tendencyProfile.historyDepthScore >= 62 ? `Use ${tendencyProfile.label.toLowerCase()} behavior in confidence weighting; this read has enough history to matter.` : null,
    portfolio && mode === 'dynasty' ? `Use ${portfolio.count2026 + portfolio.count2027} tracked future picks as leverage, not throw-ins.` : null,
    ...fallback.actionPlan,
  ], 3);

  return {
    label,
    confidence: confidenceFromSignals(50, [intel, power, standing, timeline, tradeTendency, portfolio, data.waiverIntelligence, tendencyProfile.historyDepthScore >= 55], data.matchupPreviews?.length ? 0 : 4),
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
  const ageSignal = age
    ? position === 'RB' && age >= 28
      ? 'RB age risk'
      : age <= 24
        ? 'Young value curve'
        : `Age ${age}`
    : null;
  const confidence = confidenceFromSignals(
    direction === 'Stable' ? 58 : 62,
    [rank, value, age, signal, player.playerDetails?.valueProfile],
    direction === 'Stable' ? 4 : 0,
  );

  return {
    player: getPlayerName(player),
    position,
    direction,
    currentValue: [rank, value ? formatCompactValue(value) : null].filter(Boolean).join(' | ') || position,
    projectedMove: direction === 'Rising' ? '+watch' : direction === 'Falling' ? '-watch' : 'hold',
    confidence,
    signals: dedupeStrings([
      signal,
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

export function buildAutopilotData({ reportData, mode, fallback }: AutopilotBuildInput): AutopilotData {
  if (!reportData) return fallback;

  const focusManager = getFocusManager(reportData, fallback);
  const managerTendency = buildManagerTendencyProfile(reportData, focusManager);
  const direction = buildDirection(reportData, mode, focusManager, fallback.direction, managerTendency);

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
    projections: buildPlayerProjections(reportData, mode, focusManager, fallback.projections),
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
