import { useEffect, useState, useMemo, type ReactNode } from 'react';
import type { DraftPick, ManagerDraftStats, ManagerRosterIntelligence, PlayerDetails, ReportData } from '@shared/types';
import { TrendingUp, TrendingDown, ArrowUpDown, ChevronDown } from 'lucide-react';
import { ManagerDraftPicksModal } from './ManagerDraftPicksModal';
import { PlayerDetailModal, type PlayerModalData } from './PlayerDetailModal';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { ChampionAvatarFrame } from './ManagerChampionships';
import { TeamLogoPill } from './TeamLogoPill';
import { EmptyState, MetricPill, PreviewMetricChips, ReportSectionHeader, type PreviewMetric } from './reportPrimitives';
import { AIReadPanel } from './AIReadPanel';
import { getTeamTileStyle } from '@/lib/teamTileStyle';
import { buildDraftOpportunityMap, getDraftPickKey, type DraftOpportunity } from '@/lib/draftOpportunity';
import { getDraftKind, getDraftKindLabel, getDraftKindShortLabel, getDraftMarketMovementLabel, getDraftWindowLabel, isFreshRookieMarketRead } from '@/lib/draftDisplay';
import { viewerOwnedHighlightClass } from '@/lib/viewerHighlight';
import { getBalancedGridStyle } from '@/lib/balancedGrid';
import { normalizeLeagueValueMode, type LeagueValueMode } from '@/lib/leagueValueMode';
import { readEnumParam, readOptionalEnumParam, replaceUrlSearchParams } from '@/lib/reportUrlState';

interface DraftAnalysisProps {
  draftPicks: DraftPick[];
  draftStats: ManagerDraftStats[];
  managerRosterIntelligence?: ManagerRosterIntelligence[];
  managerAvatars?: Record<string, string | null>;
  playerDetailsById?: Record<string, PlayerDetails>;
  leagueId?: string;
  leagueLogo?: string | null;
  viewerManager?: string | null;
  currentStandings?: ReportData['currentStandings'];
  leagueOverview?: ReportData['leagueOverview'];
  leagueValueMode?: ReportData['leagueValueMode'];
  leagueDiagnostics?: ReportData['leagueDiagnostics'];
  calibrationProfile?: ReportData['aiCalibrationAdjustmentProfile'];
  showAIReads?: boolean;
}

type ManagerDraftModalMode = 'portfolio' | 'audit';
type SortColumn = 'pick' | 'currentValue' | 'valueChange' | null;
type SortDirection = 'asc' | 'desc';
type RookieMismatchTone = 'buy' | 'sell' | 'watch' | 'hold';
type RookieMismatchRow = {
  id: string;
  pick: DraftPick;
  playerName: string;
  position: string;
  team?: string | null;
  manager: string;
  currentValue: number;
  marketDelta: number;
  marketDeltaPct: number | null;
  profileScore: number;
  opportunityScore: number;
  runwayScore: number;
  marketScore: number;
  mismatchScore: number;
  label: string;
  tone: RookieMismatchTone;
  aiRead: string;
  chips: string[];
};
const DRAFT_SORT_COLUMNS: readonly Exclude<SortColumn, null>[] = ['pick', 'currentValue', 'valueChange'];
const DRAFT_SORT_DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];

function formatDraftAge(age?: number | string | null): string {
  const numericAge = Number(age);
  if (!Number.isFinite(numericAge) || numericAge <= 0) return '-';
  return `${Number.isInteger(numericAge) ? numericAge : numericAge.toFixed(1)} yrs`;
}

function getDraftCurrentValue(pick: DraftPick, leagueValueMode: LeagueValueMode): number {
  if (leagueValueMode === 'redraft') {
    const seasonValue = pick.currentKtcValue
      ?? pick.playerDetails?.valueProfile?.seasonValue
      ?? pick.playerDetails?.valueProfile?.fantasyProsSeasonValue
      ?? 0;
    return Math.round(seasonValue || 0);
  }
  return Math.round(pick.currentKtcValue || 0);
}

function getTimelineDelta(details?: PlayerDetails): { delta: number; deltaPct: number | null } {
  const summary = details?.valueTimeline?.summary;
  if (!summary) return { delta: 0, deltaPct: null };
  return {
    delta: Math.round(summary.delta || 0),
    deltaPct: summary.deltaPct ?? null,
  };
}

function getPlayerCurrentValue(pick: DraftPick, details: PlayerDetails | undefined, leagueValueMode: LeagueValueMode): number {
  const draftValue = getDraftCurrentValue(pick, leagueValueMode);
  if (draftValue) return draftValue;
  if (leagueValueMode === 'redraft') {
    return Math.round(details?.valueProfile?.seasonValue || details?.valueProfile?.fantasyProsSeasonValue || details?.valueProfile?.fantasyCalcRedraft || 0);
  }
  return Math.round(details?.valueProfile?.dynastyValue || details?.valueProfile?.balancedValue || details?.valueProfile?.marketKtc || 0);
}

function getDraftCapitalProfileScore(pick: DraftPick, details?: PlayerDetails): number {
  const round = Number(details?.nflDraftRound ?? pick.round);
  const overallPick = Number(details?.nflDraftPick || 0);
  const rookiePick = Number(pick.pick || 0);
  let score = 44;

  if (Number.isFinite(overallPick) && overallPick > 0) {
    score = overallPick <= 32 ? 94 : overallPick <= 64 ? 82 : overallPick <= 100 ? 68 : overallPick <= 160 ? 52 : 38;
  } else if (Number.isFinite(round) && round > 0) {
    score = round === 1 ? 88 : round === 2 ? 74 : round === 3 ? 60 : round <= 5 ? 44 : 32;
  } else if (Number.isFinite(rookiePick) && rookiePick > 0) {
    score = rookiePick <= 6 ? 84 : rookiePick <= 12 ? 74 : rookiePick <= 24 ? 56 : 40;
  }

  const prospect = details?.prospectProfile;
  if (prospect?.overallRank) score += clampNumber(18 - Math.floor(prospect.overallRank / 12), 0, 18);
  if (prospect?.rating) score += clampNumber(Math.round((Number(prospect.rating) - 70) / 4), -4, 10);
  if (details?.athleticProfile?.forty && ['RB', 'WR'].includes((details.position || pick.playerPos || '').toUpperCase())) {
    score += details.athleticProfile.forty <= 4.45 ? 5 : details.athleticProfile.forty >= 4.65 ? -5 : 0;
  }

  return Math.round(clampNumber(score, 1, 99));
}

function getOpportunityMismatchScore(details?: PlayerDetails): { score: number; label: string } {
  const delta = details?.rosterRoom?.opportunityDelta;
  if (!delta) return { score: 50, label: 'Opportunity unclear' };

  let score = 50;
  if (delta.qualitySignal === 'major-opening') score += 28;
  if (delta.qualitySignal === 'minor-opening') score += 16;
  if (delta.qualitySignal === 'squeeze') score -= 16;
  if (delta.qualitySignal === 'major-squeeze') score -= 28;
  if (delta.incumbentOpportunitySignal === 'major-promotion') score += 18;
  if (delta.incumbentOpportunitySignal === 'minor-promotion') score += 10;
  if (delta.incumbentOpportunitySignal === 'blocked') score -= 18;
  score += clampNumber(Math.round((delta.netOpportunityScore || 0) / 3), -16, 16);

  const label = delta.qualitySignal === 'major-opening'
    ? 'Major room opened'
    : delta.qualitySignal === 'minor-opening'
      ? 'Room opened'
      : delta.qualitySignal === 'major-squeeze'
        ? 'Major squeeze'
        : delta.qualitySignal === 'squeeze'
          ? 'Room squeeze'
          : delta.incumbentOpportunitySignal === 'blocked'
            ? 'Blocked runway'
            : 'Stable room';

  return { score: Math.round(clampNumber(score, 1, 99)), label };
}

function getRunwayScore(pick: DraftPick, details?: PlayerDetails): { score: number; label: string } {
  const cohortDraft = details?.playerCohort?.draftCapital;
  if (cohortDraft?.patienceScore !== null && cohortDraft?.patienceScore !== undefined) {
    return {
      score: Math.round(clampNumber(cohortDraft.patienceScore, 1, 99)),
      label: cohortDraft.opportunityWindow === 'protected-runway'
        ? 'Protected runway'
        : cohortDraft.opportunityWindow === 'short-leash'
          ? 'Short leash'
          : 'Prove-it window',
    };
  }

  const round = Number(details?.nflDraftRound ?? pick.round);
  const age = Number(details?.age || 0);
  let score = Number.isFinite(round) && round > 0
    ? round === 1 ? 90 : round === 2 ? 74 : round === 3 ? 58 : round <= 5 ? 42 : 30
    : 46;
  if (Number.isFinite(age) && age > 0) score += age <= 22 ? 8 : age <= 24 ? 3 : age >= 27 ? -12 : 0;
  if (details?.contractProfile?.investmentTier === 'premium') score += 12;
  if (details?.contractProfile?.investmentTier === 'fringe') score -= 10;

  const finalScore = Math.round(clampNumber(score, 1, 99));
  return {
    score: finalScore,
    label: finalScore >= 76 ? 'Protected runway' : finalScore <= 42 ? 'Short leash' : 'Prove-it window',
  };
}

function getMarketScore(currentValue: number, marketDeltaPct: number | null): number {
  const valueScore = clampNumber(Math.round(currentValue / 95), 0, 72);
  const heatScore = marketDeltaPct === null ? 0 : clampNumber(Math.round(marketDeltaPct * 0.72), -20, 28);
  return Math.round(clampNumber(valueScore + heatScore, 1, 99));
}

function getMismatchLabel(score: number, opportunityScore: number, marketDeltaPct: number | null): { label: string; tone: RookieMismatchTone } {
  if (score >= 26) return { label: 'Underpriced breakout', tone: 'buy' };
  if (score >= 14) return { label: 'Situation riser', tone: 'buy' };
  if (score <= -24) return { label: 'Market too hot', tone: 'sell' };
  if (score <= -12 && opportunityScore <= 42) return { label: 'Opportunity blocked', tone: 'sell' };
  if (marketDeltaPct !== null && marketDeltaPct >= 25 && score < 6) return { label: 'Regression trap', tone: 'watch' };
  return { label: 'Hold with context', tone: 'hold' };
}

function buildRookieValuationMismatches({
  draftPicks,
  playerDetailsById,
  leagueValueMode,
}: {
  draftPicks: DraftPick[];
  playerDetailsById?: Record<string, PlayerDetails>;
  leagueValueMode: LeagueValueMode;
}): RookieMismatchRow[] {
  const seen = new Set<string>();
  return draftPicks
    .filter((pick) => pick.player_id && pick.playerName && pick.playerName !== 'Unknown')
    .flatMap((pick) => {
      const details = pick.playerDetails || (pick.player_id ? playerDetailsById?.[pick.player_id] : undefined);
      const isYoungOrRookie = Number(details?.yearsExp ?? 99) <= 3 || Number(details?.rookieYear || pick.draftYear || 0) >= new Date().getFullYear() - 2 || pick.draftKind === 'rookie';
      if (!isYoungOrRookie || !pick.player_id || seen.has(pick.player_id)) return [];
      seen.add(pick.player_id);

      const currentValue = getPlayerCurrentValue(pick, details, leagueValueMode);
      const timeline = getTimelineDelta(details);
      const fallbackDelta = Math.round(pick.valueGain || 0);
      const marketDelta = timeline.delta || fallbackDelta;
      const marketDeltaPct = timeline.deltaPct ?? (pick.ktcValue ? Math.round((fallbackDelta / pick.ktcValue) * 1000) / 10 : null);
      const profileScore = getDraftCapitalProfileScore(pick, details);
      const opportunity = getOpportunityMismatchScore(details);
      const runway = getRunwayScore(pick, details);
      const marketScore = getMarketScore(currentValue, marketDeltaPct);
      const supportScore = Math.round((profileScore * 0.34) + (opportunity.score * 0.38) + (runway.score * 0.28));
      const mismatchScore = Math.round(supportScore - marketScore);
      const label = getMismatchLabel(mismatchScore, opportunity.score, marketDeltaPct);
      const chips = [
        `${profileScore} profile`,
        `${opportunity.score} opportunity`,
        `${runway.score} runway`,
        marketDelta ? `${marketDelta > 0 ? '+' : ''}${marketDelta.toLocaleString()} market` : 'Flat market',
      ];
      const aiRead = `${label.label}: profile ${profileScore}, opportunity ${opportunity.score}, and runway ${runway.score} compare against a market score of ${marketScore}. ${opportunity.label}${marketDeltaPct !== null ? `; market is ${marketDeltaPct >= 0 ? 'up' : 'down'} ${Math.abs(marketDeltaPct)}%.` : '.'}`;

      return [{
        id: pick.player_id,
        pick,
        playerName: pick.playerName,
        position: pick.playerPos,
        team: details?.team ?? null,
        manager: pick.manager,
        currentValue,
        marketDelta,
        marketDeltaPct,
        profileScore,
        opportunityScore: opportunity.score,
        runwayScore: runway.score,
        marketScore,
        mismatchScore,
        label: label.label,
        tone: label.tone,
        aiRead,
        chips,
      }];
    })
    .sort((a, b) => Math.abs(b.mismatchScore) - Math.abs(a.mismatchScore) || b.currentValue - a.currentValue)
    .slice(0, 8);
}

function renderPreviewManagerIdentity(
  manager?: string | null,
  displayName?: string | null,
  managerAvatars?: Record<string, string | null>,
): ReactNode {
  if (!manager && !displayName) return '-';
  const label = displayName || manager || '-';
  const avatarUrl = manager ? managerAvatars?.[manager] : null;

  return (
    <span className="analysis-preview-manager-value" title={label}>
      <span className="analysis-preview-manager-avatar" aria-hidden="true">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" />
        ) : (
          <span>{label[0]?.toUpperCase() || '?'}</span>
        )}
      </span>
      <span className="analysis-preview-manager-name">{label}</span>
    </span>
  );
}

function getDraftGroupKey(pick: DraftPick, leagueValueMode: LeagueValueMode): string {
  return `${pick.draftYear || 'Draft'}::${getDraftKind(pick, leagueValueMode)}`;
}

function getDraftGroupYear(groupKey: string): string {
  return groupKey.split('::')[0] || groupKey;
}

function getDraftGroupKindOrder(groupKey: string): number {
  const kind = groupKey.split('::')[1];
  if (kind === 'main') return 0;
  if (kind === 'rookie') return 1;
  if (kind === 'startup') return 2;
  return 3;
}

function compareDraftGroupKeys(a: string, b: string): number {
  const yearDiff = Number(getDraftGroupYear(b) || 0) - Number(getDraftGroupYear(a) || 0);
  if (yearDiff !== 0) return yearDiff;
  const kindDiff = getDraftGroupKindOrder(a) - getDraftGroupKindOrder(b);
  if (kindDiff !== 0) return kindDiff;
  return a.localeCompare(b);
}

function getDraftGroupTitle(groupKey: string, picks: DraftPick[], leagueValueMode: LeagueValueMode): string {
  const draftYear = getDraftGroupYear(groupKey);
  const draftKindLabels = Array.from(new Set(
    picks.map((pick) => getDraftKindLabel(getDraftKind(pick, leagueValueMode)))
  ));
  const label = draftKindLabels.length === 1
    ? draftKindLabels[0]
    : 'Drafts';

  return /^\d{4}$/.test(draftYear) ? `${draftYear} ${label}` : label;
}

function buildDraftStatsPreviewMetrics(
  stats: ManagerDraftStats[],
  leagueValueMode: LeagueValueMode,
  managerAvatars?: Record<string, string | null>,
): PreviewMetric[] {
  const leader = stats[0];
  if (!leader) return [];
  const hitRate = leader.totalPicks ? `${Math.round((leader.hits / leader.totalPicks) * 100)}%` : '-';
  return [
    {
      label: 'Leader',
      compactLabel: 'Lead',
      value: renderPreviewManagerIdentity(leader.manager, leader.managerDisplayName, managerAvatars),
      tone: 'good',
    },
    { label: leagueValueMode === 'redraft' ? 'Starter Hit Rate' : 'Hit Rate', compactLabel: 'Hit Rate', value: hitRate, tone: 'info' },
  ];
}

function buildDraftDecisionPreviewMetrics(
  audits: ManagerDraftDecisionAudit[],
  managerAvatars?: Record<string, string | null>,
): PreviewMetric[] {
  const bestDecisionMaker = getBestDecisionMaker(audits);
  const worstDecisionMaker = getWorstDecisionMaker(audits);
  return [
    bestDecisionMaker ? {
      label: 'Cleanest Draft Read',
      compactLabel: 'Clean',
      value: renderPreviewManagerIdentity(bestDecisionMaker.manager, bestDecisionMaker.managerDisplayName, managerAvatars),
      tone: 'good',
      className: 'analysis-preview-chip-manager-preview',
    } : null,
    worstDecisionMaker ? {
      label: 'Biggest Audit Flag',
      compactLabel: 'Flag',
      value: renderPreviewManagerIdentity(worstDecisionMaker.manager, worstDecisionMaker.managerDisplayName, managerAvatars),
      tone: worstDecisionMaker.watchFlags ? 'danger' : 'warn',
      className: 'analysis-preview-chip-manager-preview',
    } : null,
  ].filter(Boolean) as PreviewMetric[];
}

function buildDraftYearPreviewMetrics(
  picks: DraftPick[],
  leagueValueMode: LeagueValueMode,
  draftDecisionAudits: DraftDecisionAudit[],
  managerAvatars?: Record<string, string | null>,
): PreviewMetric[] {
  const topGain = [...picks].sort((a, b) => (b.valueGain || 0) - (a.valueGain || 0))[0];
  const biggestMiss = [...picks].sort((a, b) => (a.valueGain || 0) - (b.valueGain || 0))[0];
  const hitCount = picks.filter((pick) => (
    !isFreshRookieMarketRead(pick, leagueValueMode)
    && (pick.draftOutcome === 'hit' || pick.isStarter)
  )).length;
  const draftWindowLabel = getDraftWindowLabel(picks, leagueValueMode);
  const yearPickKeys = new Set(picks.map(getDraftPickKey));
  const yearDecisionRows = buildManagerDraftDecisionAudits(
    draftDecisionAudits.filter((audit) => yearPickKeys.has(getDraftPickKey(audit.pick))),
  );
  const bestDecisionMaker = getBestDecisionMaker(yearDecisionRows);
  const worstDecisionMaker = getWorstDecisionMaker(yearDecisionRows);
  const cleanDecisionCount = draftDecisionAudits.filter((audit) => (
    yearPickKeys.has(getDraftPickKey(audit.pick)) && audit.tone !== 'watch'
  )).length;
  const cleanDecisionRate = picks.length ? `${Math.round((cleanDecisionCount / picks.length) * 100)}%` : '-';

  return [
    topGain ? { label: leagueValueMode === 'redraft' ? 'Top Current Gain' : 'Top Gain', compactLabel: 'Gain', value: topGain.playerName, tone: 'good' } : null,
    biggestMiss && (biggestMiss.valueGain || 0) < 0 ? { label: 'Biggest Miss', compactLabel: 'Miss', value: biggestMiss.playerName, tone: 'danger' } : null,
    picks.length ? { label: leagueValueMode === 'redraft' ? 'Starter Hit Rate' : 'Hit Rate', compactLabel: 'Hit Rate', value: `${Math.round((hitCount / picks.length) * 100)}%`, tone: 'info' } : null,
    draftWindowLabel ? { label: 'Value Basis', compactLabel: 'Basis', value: draftWindowLabel, tone: 'info' } : null,
    bestDecisionMaker ? {
      label: 'Cleanest Read',
      compactLabel: 'Clean',
      value: renderPreviewManagerIdentity(bestDecisionMaker.manager, bestDecisionMaker.managerDisplayName, managerAvatars),
      tone: 'good',
      className: 'analysis-preview-chip-manager-preview',
    } : null,
    worstDecisionMaker ? {
      label: 'Audit Flag',
      compactLabel: 'Flag',
      value: renderPreviewManagerIdentity(worstDecisionMaker.manager, worstDecisionMaker.managerDisplayName, managerAvatars),
      tone: worstDecisionMaker.watchFlags ? 'danger' : 'warn',
      className: 'analysis-preview-chip-manager-preview',
    } : null,
    picks.length ? { label: 'Clean Reads', compactLabel: 'Clean', value: cleanDecisionRate, tone: cleanDecisionCount === picks.length ? 'good' : 'info' } : null,
  ].filter(Boolean) as PreviewMetric[];
}

function buildDraftOpportunitySummary(
  picks: DraftPick[],
  opportunityByPick: Record<string, DraftOpportunity>,
) {
  const missed = picks
    .flatMap((pick) => {
      const opportunity = opportunityByPick[getDraftPickKey(pick)];
      if (!opportunity || opportunity.type !== 'missed') return [];
      return [{
        ...opportunity,
        draftedPlayerName: pick.playerName,
      }];
    })
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);
  const boardWins = picks.filter((pick) => opportunityByPick[getDraftPickKey(pick)]?.type === 'win').length;

  return {
    boardWins,
    missed,
  };
}

export function DraftAnalysis({
  draftPicks,
  draftStats,
  managerRosterIntelligence,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
  viewerManager,
  currentStandings,
  leagueOverview,
  leagueValueMode: leagueValueModeInput = 'dynasty',
  leagueDiagnostics,
  calibrationProfile,
  showAIReads = false,
}: DraftAnalysisProps) {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [selectedManagerMode, setSelectedManagerMode] = useState<ManagerDraftModalMode>('portfolio');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>(() => readOptionalEnumParam('draftSort', DRAFT_SORT_COLUMNS));
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => readEnumParam('draftDir', DRAFT_SORT_DIRECTIONS, 'desc'));
  const [activeDraftSectionId, setActiveDraftSectionId] = useState<string | null>(null);
  const leagueValueMode = normalizeLeagueValueMode(leagueValueModeInput);
  const isRedraft = leagueValueMode === 'redraft';

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'pick' ? 'asc' : 'desc');
    }
  };

  const sortedDraftPicks = useMemo(() => {
    const pickedOnly = draftPicks.filter((pick) => pick.player_id && pick.playerName && pick.playerName !== 'Unknown');

    if (!sortColumn) {
      return [...pickedOnly].sort((a, b) => {
        const yearDiff = Number(b.draftYear || 0) - Number(a.draftYear || 0);
        if (yearDiff !== 0) return yearDiff;
        return a.pick - b.pick;
      });
    }

    return [...pickedOnly].sort((a, b) => {
      let aVal = 0;
      let bVal = 0;

      if (sortColumn === 'currentValue') {
        aVal = getDraftCurrentValue(a, leagueValueMode);
        bVal = getDraftCurrentValue(b, leagueValueMode);
      } else if (sortColumn === 'valueChange') {
        aVal = a.valueGain ?? 0;
        bVal = b.valueGain ?? 0;
      } else if (sortColumn === 'pick') {
        aVal = a.pick || 0;
        bVal = b.pick || 0;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [draftPicks, leagueValueMode, sortColumn, sortDirection]);

  const draftPicksByYear = useMemo(() => {
    return sortedDraftPicks.reduce<Record<string, DraftPick[]>>((groups, pick) => {
      const year = getDraftGroupKey(pick, leagueValueMode);
      groups[year] = groups[year] || [];
      groups[year].push(pick);
      return groups;
    }, {});
  }, [leagueValueMode, sortedDraftPicks]);
  const draftOpportunityByPick = useMemo(
    () => buildDraftOpportunityMap(draftPicks, managerRosterIntelligence || []),
    [draftPicks, managerRosterIntelligence]
  );
  const orderedDraftStats = useMemo(() => sortManagerDraftStatsByEfficiency(draftStats), [draftStats]);
  const draftCapitalEfficiencyPicks = useMemo(
    () => isRedraft ? draftPicks : draftPicks.filter((pick) => pick.draftKind === 'rookie'),
    [draftPicks, isRedraft]
  );
  const draftYears = useMemo(() => Object.keys(draftPicksByYear).sort(compareDraftGroupKeys), [draftPicksByYear]);
  useEffect(() => {
    if (!activeDraftSectionId?.startsWith('year:')) return;
    const activeYear = activeDraftSectionId.slice('year:'.length);
    if (!draftYears.includes(activeYear)) {
      setActiveDraftSectionId(null);
    }
  }, [activeDraftSectionId, draftYears]);

  useEffect(() => {
    replaceUrlSearchParams(
      {
        draftSort: sortColumn,
        draftDir: sortColumn ? sortDirection : null,
        draftOpen: null,
      },
      { onlyForHash: '#draft' },
    );
  }, [sortColumn, sortDirection]);

  const draftDecisionAudits = useMemo(() => {
    return buildDraftDecisionAudits(sortedDraftPicks, managerRosterIntelligence || [], leagueValueMode);
  }, [sortedDraftPicks, managerRosterIntelligence, leagueValueMode]);
  const draftDecisionAuditByPick = useMemo(() => {
    const map = new Map<string, DraftDecisionAudit>();
    draftDecisionAudits.forEach((audit) => {
      map.set(getDraftPickKey(audit.pick), audit);
    });
    return map;
  }, [draftDecisionAudits]);
  const managerDraftDecisionAudits = useMemo(() => {
    return buildManagerDraftDecisionAudits(draftDecisionAudits);
  }, [draftDecisionAudits]);
  const draftPicksWithDecisionAudit = useMemo(() => {
    return draftPicks.map((pick) => attachDraftDecisionAudit(pick, draftDecisionAuditByPick.get(getDraftPickKey(pick))));
  }, [draftDecisionAuditByPick, draftPicks]);
  const rookieValuationMismatches = useMemo(() => {
    return buildRookieValuationMismatches({
      draftPicks: sortedDraftPicks,
      playerDetailsById,
      leagueValueMode,
    });
  }, [leagueValueMode, playerDetailsById, sortedDraftPicks]);
  const topRookieMismatch = rookieValuationMismatches[0] || null;
  const openManagerPortfolio = (manager: string) => {
    setSelectedManagerMode('portfolio');
    setSelectedManager(manager);
  };
  const openManagerAudit = (manager: string) => {
    setSelectedManagerMode('audit');
    setSelectedManager(manager);
  };
  const setDraftSectionOpen = (sectionId: string, isOpen: boolean) => {
    setActiveDraftSectionId((current) => {
      if (isOpen) return sectionId;
      return current === sectionId ? null : current;
    });
  };

  const openDraftPlayer = (pick: DraftPick) => {
    setSelectedPlayer(enrichDraftPickDetails(
      pick,
      playerDetailsById,
      draftDecisionAuditByPick.get(getDraftPickKey(pick)),
      leagueValueMode,
    ));
  };
  const openMismatchPlayer = (row: RookieMismatchRow) => {
    openDraftPlayer(row.pick);
  };

  if (!draftPicks || draftPicks.length === 0) {
    return (
      <EmptyState
        className="draft-empty-state"
        title="No draft data available"
        description={isRedraft
          ? 'Draft recap will appear here after the league report includes completed draft picks.'
          : 'Draft history will appear here after the league report includes completed draft picks.'}
      />
    );
  }

  const topDraftGain = [...sortedDraftPicks].sort((a, b) => (b.valueGain || 0) - (a.valueGain || 0))[0];
  const biggestDraftLeak = [...sortedDraftPicks].sort((a, b) => (a.valueGain || 0) - (b.valueGain || 0))[0];
  const viewerDraftPicks = viewerManager ? sortedDraftPicks.filter((pick) => pick.manager === viewerManager) : [];
  const topDraftGainKind = topDraftGain
    ? getDraftKindLabel(getDraftKind(topDraftGain, leagueValueMode)).toLowerCase()
    : 'draft';
  const draftReadBody = isRedraft
    ? `${topDraftGain?.playerName || 'No player'} is the strongest current starter-value result in the returned draft data. ${biggestDraftLeak && (biggestDraftLeak.valueGain || 0) < 0 ? `${biggestDraftLeak.playerName} is the cleanest review point because the current value trails the draft slot.` : 'No obvious draft leak is severe enough to flag from returned value data.'}`
    : `${topDraftGain?.playerName || 'No player'} is the biggest ${topDraftGainKind} value gain in the returned data. ${biggestDraftLeak && (biggestDraftLeak.valueGain || 0) < 0 ? `${biggestDraftLeak.playerName} is the draft-capital leak to audit before repeating that profile.` : 'No major negative value swing was returned.'}`;

  return (
    <div className="draft-analysis-stack report-command-section-stack space-y-6 sm:space-y-8">
      {showAIReads && (
        <AIReadPanel
          title={isRedraft ? 'Draft recap AI read' : 'Draft capital AI read'}
          subtitle="Uses only returned draft picks, current player values, and roster-context audit notes."
          readType="Draft Capital Read"
          confidence={sortedDraftPicks.length ? 82 : 50}
          severity={biggestDraftLeak && (biggestDraftLeak.valueGain || 0) < -500 ? 'warn' : 'info'}
          chips={[
            `${sortedDraftPicks.length} picks`,
            topDraftGain ? `Top gain: ${topDraftGain.playerName}` : 'No gains',
            viewerManager ? `${viewerDraftPicks.length} viewer picks` : 'League view',
          ]}
          body={draftReadBody}
          backgroundVariant="draft"
          className="draft-ai-read"
        />
      )}
      <div className="draft-analysis-section-grid">
      {/* Draft Capital Efficiency Leaderboard */}
      <DraftCollapsibleSection
        title={isRedraft ? 'Draft Recap Efficiency' : 'Draft Capital Efficiency'}
        kicker={isRedraft ? 'Starter hit rate first' : 'Hit rate first'}
        previewMetrics={buildDraftStatsPreviewMetrics(orderedDraftStats, leagueValueMode, managerAvatars)}
        open={activeDraftSectionId === 'efficiency'}
        onToggle={(open) => setDraftSectionOpen('efficiency', open)}
      >
        <div className="owner-tile-shell">
          <div className="owner-tile-grid draft-efficiency-tile-grid balanced-tile-grid" style={getBalancedGridStyle(orderedDraftStats.length)}>
            {orderedDraftStats.map((stat, idx) => {
              const avatarUrl = managerAvatars?.[stat.manager];
              const managerDisplayName = stat.managerDisplayName || stat.manager;
              return (
                <button
                  key={`${stat.manager}-${idx}`}
                  type="button"
                  className={`owner-summary-tile ${viewerOwnedHighlightClass(stat.manager, viewerManager)}`}
                  onClick={() => openManagerPortfolio(stat.manager)}
                >
                  {avatarUrl && (
                    <>
                      <img src={avatarUrl} alt="" className="owner-summary-wash" />
                      <img src={avatarUrl} alt="" className="owner-summary-mark" />
                    </>
                  )}
                  <span className="owner-summary-scrim" />
                  <span className="owner-summary-main">
                    <ChampionAvatarFrame managerName={stat.manager} className="owner-summary-avatar-frame">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={managerDisplayName} className="owner-summary-avatar" />
                      ) : (
                        <span className="owner-summary-avatar">{managerDisplayName[0]?.toUpperCase() || '?'}</span>
                      )}
                    </ChampionAvatarFrame>
                    <span className="owner-summary-name-lockup">
                      <span className="owner-summary-name">{managerDisplayName}</span>
                    </span>
                  </span>
                  <span className="owner-summary-metrics">
                    <MetricPill label="Picks" value={stat.totalPicks} tone="info" />
                    <MetricPill label="Hits" value={stat.hits} tone="good" />
                    <MetricPill label="Misses" value={stat.misses} tone="danger" />
                    <MetricPill label="Starters" value={stat.starters} tone="info" />
                    <MetricPill
                      label={isRedraft ? 'Avg Swing' : 'Avg Change'}
                      value={`${stat.avgKtcGain >= 0 ? '+' : ''}${stat.avgKtcGain.toLocaleString()}`}
                      tone={stat.avgKtcGain >= 0 ? 'good' : 'danger'}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </DraftCollapsibleSection>

      {managerDraftDecisionAudits.length > 0 && (
        <DraftCollapsibleSection
          title={isRedraft ? 'Draft-Day vs Current Value' : 'Draft Decision Audit'}
          kicker={isRedraft ? 'Decision quality' : 'Decision makers'}
          previewMetrics={buildDraftDecisionPreviewMetrics(managerDraftDecisionAudits, managerAvatars)}
          open={activeDraftSectionId === 'decision-audit'}
          onToggle={(open) => setDraftSectionOpen('decision-audit', open)}
        >
          <div className="draft-decision-audit-note">
            {isRedraft
              ? 'Manager-level read on whether each draft generated current-season value, starter hits, bench depth, and position-need help.'
              : 'Manager-level read on whether each draft stayed near the best dynasty values available. Roster need is only used as a tiebreaker after board value.'}
          </div>
          <div className="owner-tile-shell">
            <div className="owner-tile-grid draft-efficiency-tile-grid draft-decision-manager-grid balanced-tile-grid" style={getBalancedGridStyle(managerDraftDecisionAudits.length)}>
              {managerDraftDecisionAudits.map((audit) => {
                const avatarUrl = managerAvatars?.[audit.manager];
                const managerDisplayName = audit.managerDisplayName || audit.manager;
                return (
                  <button
                    key={audit.manager}
                    type="button"
                    className={`owner-summary-tile draft-decision-manager-tile ${audit.watchFlags > 0 ? 'draft-decision-manager-tile-watch' : 'draft-decision-manager-tile-clean'} ${viewerOwnedHighlightClass(audit.manager, viewerManager)}`}
                    onClick={() => openManagerAudit(audit.manager)}
                  >
                    {avatarUrl && (
                      <>
                        <img src={avatarUrl} alt="" className="owner-summary-wash" />
                        <img src={avatarUrl} alt="" className="owner-summary-mark" />
                      </>
                    )}
                    <span className="owner-summary-scrim" />
                    <span className="owner-summary-main">
                      <ChampionAvatarFrame managerName={audit.manager} className="owner-summary-avatar-frame">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={managerDisplayName} className="owner-summary-avatar" />
                        ) : (
                          <span className="owner-summary-avatar">{managerDisplayName[0]?.toUpperCase() || '?'}</span>
                        )}
                      </ChampionAvatarFrame>
                      <span className="owner-summary-name-lockup">
                        <span className="owner-summary-name">{managerDisplayName}</span>
                      </span>
                    </span>
                    <span className="owner-summary-metrics">
                      <MetricPill label="Picks" value={audit.totalPicks} tone="info" />
                      <MetricPill label="Hits" value={audit.hits} tone="good" />
                      <MetricPill label="Misses" value={audit.misses} tone={audit.misses ? 'danger' : 'good'} />
                      <MetricPill label="Starters" value={audit.starters} tone="info" />
                      <MetricPill
                        label={isRedraft ? 'Avg Swing' : 'Avg Change'}
                        value={`${audit.avgChange >= 0 ? '+' : ''}${audit.avgChange.toLocaleString()}`}
                        tone={audit.avgChange >= 0 ? 'good' : 'danger'}
                      />
                    </span>
                    <span className="draft-decision-manager-read">{audit.readout}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </DraftCollapsibleSection>
      )}
      </div>

      {rookieValuationMismatches.length > 0 && !isRedraft && (
        <DraftCollapsibleSection
          title="Rookie Valuation Mismatch"
          kicker="Market price vs profile, opportunity, and runway"
          previewMetrics={[
            topRookieMismatch ? { label: 'Top Flag', value: topRookieMismatch.playerName, tone: topRookieMismatch.tone === 'buy' ? 'good' : topRookieMismatch.tone === 'sell' ? 'danger' : 'warn' } : null,
            { label: 'Players Graded', value: rookieValuationMismatches.length, tone: 'info' },
            topRookieMismatch ? { label: 'Mismatch', value: `${topRookieMismatch.mismatchScore > 0 ? '+' : ''}${topRookieMismatch.mismatchScore}`, tone: Math.abs(topRookieMismatch.mismatchScore) >= 20 ? 'warn' : 'info' } : null,
          ].filter(Boolean) as PreviewMetric[]}
          open={activeDraftSectionId === 'rookie-mismatch'}
          onToggle={(open) => setDraftSectionOpen('rookie-mismatch', open)}
        >
          <div className="rookie-mismatch-board">
            <div className="rookie-mismatch-board-head">
              <p>
                This compares current value against draft capital, prospect context, roster-room change, depth pressure, and patience runway. Big positive gaps point to underpriced upside; big negative gaps point to market heat that needs more proof.
              </p>
            </div>
            <div className="rookie-mismatch-list">
              {rookieValuationMismatches.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`rookie-mismatch-row rookie-mismatch-row-${row.tone}`}
                  style={getTeamTileStyle(row.team)}
                  onClick={() => openMismatchPlayer(row)}
                  aria-label={`Open ${row.playerName} valuation mismatch detail`}
                >
                  <span className="rookie-mismatch-player">
                    <PlayerNameWithHeadshot
                      playerId={row.pick.player_id}
                      playerName={row.playerName}
                      team={row.team}
                      position={row.position}
                    />
                    <span className="rookie-mismatch-label">{row.label}</span>
                  </span>
                  <span className="rookie-mismatch-score" data-label="Mismatch">
                    {row.mismatchScore > 0 ? '+' : ''}{row.mismatchScore}
                    <small>gap</small>
                  </span>
                  <span className="rookie-mismatch-metrics" data-label="Scores">
                    <span><strong>{row.profileScore}</strong> Profile</span>
                    <span><strong>{row.opportunityScore}</strong> Opp</span>
                    <span><strong>{row.runwayScore}</strong> Runway</span>
                    <span><strong>{row.marketScore}</strong> Market</span>
                  </span>
                  <span className="rookie-mismatch-market" data-label="Market">
                    <strong>{row.currentValue ? row.currentValue.toLocaleString() : '-'}</strong>
                    <em>{row.marketDelta > 0 ? '+' : ''}{row.marketDelta.toLocaleString()}{row.marketDeltaPct !== null ? ` / ${row.marketDeltaPct > 0 ? '+' : ''}${row.marketDeltaPct}%` : ''}</em>
                  </span>
                  <span className="rookie-mismatch-read">{row.aiRead}</span>
                  <span className="rookie-mismatch-chip-row">
                    {row.chips.map((chip) => <em key={chip}>{chip}</em>)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </DraftCollapsibleSection>
      )}

      {/* Full Draft Board */}
      <div className="draft-year-card-grid">
        {draftYears.map((draftYear) => {
          const yearPicks = draftPicksByYear[draftYear] || [];
          const draftYearSectionId = `year:${draftYear}`;
          const isDraftBoardOpen = activeDraftSectionId === draftYearSectionId;
          const yearPreviewMetrics = buildDraftYearPreviewMetrics(yearPicks, leagueValueMode, draftDecisionAudits, managerAvatars);
          const draftWindowLabel = getDraftWindowLabel(yearPicks, leagueValueMode);
          const opportunitySummary = buildDraftOpportunitySummary(yearPicks, draftOpportunityByPick);

          return (
            <DraftCollapsibleSection
              key={draftYear}
              title={getDraftGroupTitle(draftYear, yearPicks, leagueValueMode)}
              kicker={draftWindowLabel
                ? `${yearPicks.length} players picked - ${draftWindowLabel}`
                : `${yearPicks.length} players picked`}
              previewMetrics={yearPreviewMetrics}
              open={isDraftBoardOpen}
              onToggle={(open) => setDraftSectionOpen(draftYearSectionId, open)}
            >
              {opportunitySummary.missed.length > 0 && (
                <div className="draft-board-context-callout">
                  <div>
                    <span>Board-value context</span>
                    <strong>
                      {opportunitySummary.boardWins.toLocaleString()} board wins ·{" "}
                      {opportunitySummary.missed.length.toLocaleString()} review spots
                    </strong>
                  </div>
                  <p>
                    {opportunitySummary.missed.map(item => (
                      `${item.draftedPlayerName} passed ${item.playerName} (${item.pickLabel}, +${item.delta.toLocaleString()})`
                    )).join(' · ')}
                  </p>
                </div>
              )}
                  <div className="rookie-draft-row-shell">
                    <div className="draft-sort-strip">
                      <button type="button" onClick={() => handleSort('pick')}>
                        Pick #
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleSort('currentValue')}>
                        {isRedraft ? 'Current Season' : 'Current Value'}
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleSort('valueChange')}>
                        Value Change
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="rookie-draft-row-header" aria-hidden="true">
                      <span>Pick</span>
                      <span>Player</span>
                      <span>Team</span>
                      <span>Age</span>
                      <span>
                        <span className="rookie-draft-header-full">Manager</span>
                        <span className="rookie-draft-header-short">Mgr</span>
                      </span>
                      <span>Draft</span>
                      <span>{isRedraft ? 'Draft-Day Value' : 'Draft Value'}</span>
                      <span>Now</span>
                      <span>{isRedraft ? 'Current Value' : 'Now Value'}</span>
                      <span>Change</span>
                    </div>
                    <div className="rookie-draft-row-list">
                      {yearPicks.map((pick, idx) => {
                        const details = pick.playerDetails || (pick.player_id ? playerDetailsById?.[pick.player_id] : undefined);
                        const gainTone = (pick.valueGain ?? 0) > 0 ? 'text-emerald-300' : (pick.valueGain ?? 0) < 0 ? 'text-rose-300' : 'text-slate-300';
                        const gainClass = (pick.valueGain ?? 0) > 0 ? 'is-positive' : (pick.valueGain ?? 0) < 0 ? 'is-negative' : '';
                        const opportunity = draftOpportunityByPick[getDraftPickKey(pick)];
                        const managerDisplayName = pick.managerDisplayName || pick.manager;
                        const ageLabel = formatDraftAge(details?.age);
                        const draftRankLabel = pick.positionRankMay2025 || pick.playerPos || 'N/A';
                        const currentRankLabel = pick.currentPositionRank || pick.playerPos || 'N/A';
                        const currentValue = getDraftCurrentValue(pick, leagueValueMode);
                        return (
                          <button
                            key={`${pick.draftYear}-${pick.pick}-${pick.player_id || idx}`}
                            type="button"
                            className={`player-team-tile rookie-draft-row mobile-stacked-row ${viewerOwnedHighlightClass(pick.manager, viewerManager)}`}
                            style={getTeamTileStyle(details?.team)}
                            onClick={() => openDraftPlayer(pick)}
                          >
                            <span className="rookie-draft-pick-cell" data-label="Pick">#{pick.pick}</span>
                            <span className="rookie-draft-player-cell">
                              <PlayerNameWithHeadshot
                                playerId={pick.player_id}
                                playerName={pick.playerName}
                                team={details?.team}
                                position={pick.playerPos}
                              />
                              <DraftOpportunityNote opportunity={opportunity?.type === 'win' ? opportunity : undefined} />
                              <DraftWindowNote pick={pick} leagueValueMode={leagueValueMode} />
                              <DraftMarketMovementNote pick={pick} leagueValueMode={leagueValueMode} />
                            </span>
                            <span className="rookie-draft-team-cell">
                              {details?.team ? <TeamLogoPill team={details.team} /> : <span className="rookie-draft-team-empty">FA</span>}
                            </span>
                            <span className="rookie-draft-age-cell" data-label="Age">{ageLabel}</span>
                            <span className="rookie-draft-manager-cell">
                              <ManagerNameWithAvatar
                                avatarUrl={managerAvatars?.[pick.manager]}
                                managerName={pick.manager}
                                displayName={managerDisplayName}
                              />
                            </span>
                            <span className="rookie-draft-rank-cell rookie-draft-rank-cell-draft" data-label="Draft">{draftRankLabel}</span>
                            <span className="rookie-draft-value-cell" data-label="Draft">{pick.ktcValue ? pick.ktcValue.toLocaleString() : 'N/A'}</span>
                            <span className="rookie-draft-rank-cell rookie-draft-rank-cell-current" data-label="Now">{currentRankLabel}</span>
                            <span className="rookie-draft-value-cell" data-label="Now">{currentValue ? currentValue.toLocaleString() : 'N/A'}</span>
                            <span className="rookie-draft-change-cell" aria-label={`${pick.playerName} value change`}>
                              <span className="rookie-draft-age-mobile" data-label="Age">{ageLabel}</span>
                              {details?.team ? (
                                <span className="rookie-draft-change-team" aria-hidden="true">
                                  <TeamLogoPill team={details.team} />
                                </span>
                              ) : null}
                              <span className={`rookie-draft-gain-cell ${gainClass} ${gainTone}`} data-label="Change">
                                {pick.valueGain !== null && pick.valueGain !== undefined
                                  ? `${pick.valueGain > 0 ? '+' : ''}${pick.valueGain.toLocaleString()}`
                                  : 'N/A'}
                                {pick.valueGain !== null && pick.valueGain !== undefined && pick.valueGain > 0 && <TrendingUp className="h-3.5 w-3.5" />}
                                {pick.valueGain !== null && pick.valueGain !== undefined && pick.valueGain < 0 && <TrendingDown className="h-3.5 w-3.5" />}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
            </DraftCollapsibleSection>
          );
        })}
      </div>

      {/* Manager Draft Picks Modal */}
      <ManagerDraftPicksModal
        isOpen={selectedManager !== null}
        onClose={() => setSelectedManager(null)}
        managerName={selectedManager || ''}
        managerDisplayName={selectedManager ? draftStats.find((stat) => stat.manager === selectedManager)?.managerDisplayName : undefined}
        draftPicks={selectedManagerMode === 'audit' ? draftPicksWithDecisionAudit : draftCapitalEfficiencyPicks}
        managerAvatarUrl={selectedManager ? managerAvatars?.[selectedManager] : null}
        playerDetailsById={playerDetailsById}
        mode={selectedManagerMode}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        leagueValueMode={leagueValueMode}
      />

      {/* Player Detail Modal */}
      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        managerAvatars={managerAvatars}
        playerDetailsById={playerDetailsById}
        leagueDiagnostics={leagueDiagnostics}
        calibrationProfile={calibrationProfile}
        showAIRead={showAIReads}
      />
    </div>
  );
}

function DraftOpportunityNote({ opportunity }: { opportunity?: DraftOpportunity }) {
  if (!opportunity) return null;

  if (opportunity.type === 'win') {
    return (
      <span className="draft-opportunity-note draft-opportunity-win">
        {opportunity.label}
      </span>
    );
  }

  return (
    <span className="draft-opportunity-note draft-opportunity-missed" title={`${opportunity.label}: ${opportunity.playerName} at ${opportunity.pickLabel}`}>
      {opportunity.label}: {opportunity.playerName}
    </span>
  );
}

function DraftWindowNote({ pick, leagueValueMode }: { pick: DraftPick; leagueValueMode: LeagueValueMode }) {
  const draftKindLabel = getDraftKindShortLabel(getDraftKind(pick, leagueValueMode));
  const draftWindowLabel = getDraftWindowLabel(pick, leagueValueMode);

  return (
    <span className="draft-opportunity-note" title={draftWindowLabel ? `Values compared against ${draftWindowLabel.toLowerCase()}` : undefined}>
      {draftWindowLabel ? `${draftKindLabel}: ${draftWindowLabel}` : draftKindLabel}
    </span>
  );
}

function DraftMarketMovementNote({ pick, leagueValueMode }: { pick: DraftPick; leagueValueMode: LeagueValueMode }) {
  const movement = getDraftMarketMovementLabel(pick, leagueValueMode);
  if (!movement) return null;

  return (
    <span className={`draft-opportunity-note draft-market-move-note draft-market-move-${movement.tone}`}>
      {movement.label}
    </span>
  );
}

type DraftDecisionTone = 'value' | 'need' | 'watch' | 'win';

interface DraftDecisionAudit {
  pick: DraftPick;
  verdict: string;
  tone: DraftDecisionTone;
  primaryNeed: string | null;
  boardRankLabel: string;
  summary: string;
  alternative: {
    label: string;
    playerName: string;
    position?: string | null;
    pickLabel?: string;
    playerPos?: string | null;
    pick?: DraftPick | null;
  } | null;
}

interface ManagerDraftDecisionAudit {
  manager: string;
  managerDisplayName?: string;
  audits: DraftDecisionAudit[];
  totalPicks: number;
  cleanReads: number;
  watchFlags: number;
  needFits: number;
  boardReads: number;
  hits: number;
  misses: number;
  starters: number;
  avgChange: number;
  readout: string;
}

function sortManagerDraftStatsByEfficiency(stats: ManagerDraftStats[]): ManagerDraftStats[] {
  return [...stats].sort((a, b) => {
    return (
      compareNumbersDesc(getHitRate(a), getHitRate(b))
      || compareNumbersAsc(getMissRate(a), getMissRate(b))
      || compareNumbersDesc(getStarterRate(a), getStarterRate(b))
      || compareNumbersDesc(a.avgKtcGain, b.avgKtcGain)
      || compareNumbersDesc(a.hits, b.hits)
      || compareNumbersDesc(a.totalPicks, b.totalPicks)
      || compareManagerLabels(a.managerDisplayName || a.manager, b.managerDisplayName || b.manager)
    );
  });
}

function buildManagerDraftDecisionAudits(audits: DraftDecisionAudit[]): ManagerDraftDecisionAudit[] {
  const grouped = audits.reduce<Record<string, DraftDecisionAudit[]>>((acc, audit) => {
    acc[audit.pick.manager] = acc[audit.pick.manager] || [];
    acc[audit.pick.manager].push(audit);
    return acc;
  }, {});

  const rows = Object.entries(grouped).map(([manager, managerAudits]) => {
    const orderedAudits = [...managerAudits].sort((a, b) => {
      const yearDiff = Number(b.pick.draftYear || 0) - Number(a.pick.draftYear || 0);
      if (yearDiff !== 0) return yearDiff;
      return a.pick.pick - b.pick.pick;
    });
    const watchFlags = orderedAudits.filter((audit) => audit.tone === 'watch').length;
    const needFits = orderedAudits.filter((audit) => audit.verdict === 'Need + Value' || audit.verdict === 'Need Fit').length;
    const boardReads = orderedAudits.filter((audit) => audit.verdict === 'Board Pick' || audit.tone === 'value' || audit.tone === 'win').length;
    const hits = orderedAudits.filter((audit) => getResolvedDraftOutcome(audit.pick) === 'hit').length;
    const misses = orderedAudits.filter((audit) => getResolvedDraftOutcome(audit.pick) === 'miss').length;
    const starters = orderedAudits.filter((audit) => getResolvedDraftStarter(audit.pick)).length;
    const avgChange = Math.round(orderedAudits.reduce((sum, audit) => sum + (audit.pick.valueGain || 0), 0) / Math.max(orderedAudits.length, 1));

    return {
      manager,
      managerDisplayName: orderedAudits[0]?.pick.managerDisplayName,
      audits: orderedAudits,
      totalPicks: orderedAudits.length,
      cleanReads: orderedAudits.length - watchFlags,
      watchFlags,
      needFits,
      boardReads,
      hits,
      misses,
      starters,
      avgChange,
      readout: buildManagerDraftDecisionReadout(orderedAudits),
    };
  });

  return sortManagerDraftDecisionAuditsByPickVolume(rows);
}

function sortManagerDraftDecisionAuditsByPickVolume(rows: ManagerDraftDecisionAudit[]): ManagerDraftDecisionAudit[] {
  return [...rows].sort((a, b) => {
    return (
      compareNumbersDesc(a.totalPicks, b.totalPicks)
      || compareManagerLabels(a.managerDisplayName || a.manager, b.managerDisplayName || b.manager)
    );
  });
}

function getBestDecisionMaker(rows: ManagerDraftDecisionAudit[]): ManagerDraftDecisionAudit | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    return (
      compareNumbersDesc(getDecisionQualityScore(a), getDecisionQualityScore(b))
      || compareNumbersAsc(getWatchFlagRate(a), getWatchFlagRate(b))
      || compareNumbersDesc(a.avgChange, b.avgChange)
      || compareNumbersDesc(a.totalPicks, b.totalPicks)
      || compareManagerLabels(a.managerDisplayName || a.manager, b.managerDisplayName || b.manager)
    );
  })[0] || null;
}

function getWorstDecisionMaker(rows: ManagerDraftDecisionAudit[]): ManagerDraftDecisionAudit | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    return (
      compareNumbersDesc(getDecisionConcernScore(a), getDecisionConcernScore(b))
      || compareNumbersDesc(getWatchFlagRate(a), getWatchFlagRate(b))
      || compareNumbersDesc(a.watchFlags, b.watchFlags)
      || compareNumbersAsc(a.avgChange, b.avgChange)
      || compareNumbersDesc(a.totalPicks, b.totalPicks)
      || compareManagerLabels(a.managerDisplayName || a.manager, b.managerDisplayName || b.manager)
    );
  })[0] || null;
}

function getDecisionQualityScore(row: ManagerDraftDecisionAudit): number {
  const totalPicks = Math.max(row.totalPicks, 1);
  const cleanRate = row.cleanReads / totalPicks;
  const boardRate = row.boardReads / totalPicks;
  const hitRate = row.hits / totalPicks;
  const missRate = row.misses / totalPicks;
  const valueScore = clampNumber(row.avgChange / 300, -14, 14);

  return (cleanRate * 100) + (boardRate * 26) + (hitRate * 12) + valueScore - (getWatchFlagRate(row) * 56) - (missRate * 10);
}

function getDecisionConcernScore(row: ManagerDraftDecisionAudit): number {
  const totalPicks = Math.max(row.totalPicks, 1);
  const missRate = row.misses / totalPicks;
  const valueConcern = clampNumber(-row.avgChange / 260, -12, 18);

  return (getWatchFlagRate(row) * 100) + (missRate * 28) + valueConcern - ((row.cleanReads / totalPicks) * 12);
}

function getWatchFlagRate(row: ManagerDraftDecisionAudit): number {
  return row.totalPicks > 0 ? row.watchFlags / row.totalPicks : 0;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getHitRate(stat: Pick<ManagerDraftStats, 'hits' | 'totalPicks'>): number {
  return stat.totalPicks > 0 ? stat.hits / stat.totalPicks : 0;
}

function getMissRate(stat: Pick<ManagerDraftStats, 'misses' | 'totalPicks'>): number {
  return stat.totalPicks > 0 ? stat.misses / stat.totalPicks : 1;
}

function getStarterRate(stat: Pick<ManagerDraftStats, 'starters' | 'totalPicks'>): number {
  return stat.totalPicks > 0 ? stat.starters / stat.totalPicks : 0;
}

function compareNumbersDesc(a: number, b: number): number {
  return b - a;
}

function compareNumbersAsc(a: number, b: number): number {
  return a - b;
}

function compareManagerLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function buildManagerDraftDecisionReadout(audits: DraftDecisionAudit[]): string {
  const watchAudits = audits.filter((audit) => audit.tone === 'watch');
  const boardReads = audits.filter((audit) => audit.tone === 'value' || audit.tone === 'win');
  const hits = audits.filter((audit) => getResolvedDraftOutcome(audit.pick) === 'hit').length;
  const misses = audits.filter((audit) => getResolvedDraftOutcome(audit.pick) === 'miss').length;

  if (watchAudits.length) {
    const mainFlag = [...watchAudits].sort((a, b) => getDraftDecisionSeverity(b) - getDraftDecisionSeverity(a))[0];
    const alternative = mainFlag.alternative?.pick
      ? ` Best follow-up comp is ${mainFlag.alternative.playerName} at ${mainFlag.alternative.pickLabel}.`
      : '';
    return `${watchAudits.length} pick${watchAudits.length === 1 ? '' : 's'} left value to question. ${mainFlag.pick.playerName} is the headline ${mainFlag.verdict.toLowerCase()}.${alternative}`;
  }

  if (hits || misses) {
    return `Clean value audit: ${boardReads.length}/${audits.length} picks stayed in a strong value lane. Current aged-result check shows ${hits} hit${hits === 1 ? '' : 's'} and ${misses} miss${misses === 1 ? '' : 'es'}.`;
  }

  return `Board-first draft: no major decision flags, and ${boardReads.length}/${audits.length} picks stayed in a clean value pocket. Fresh classes are treated as early reads, not victory laps.`;
}

function getDraftDecisionSeverity(audit: DraftDecisionAudit): number {
  if (audit.verdict === 'Passed Board Value') return 5;
  if (audit.verdict === 'Passed Position Value') return 4;
  if (audit.verdict === 'Preference Pick') return 3;
  if (audit.tone === 'watch') return 2;
  return 1;
}

function buildDraftDecisionAudits(
  draftPicks: DraftPick[],
  managerRosterIntelligence: ManagerRosterIntelligence[],
  leagueValueMode: LeagueValueMode = 'dynasty',
): DraftDecisionAudit[] {
  const intelByManager = new Map(managerRosterIntelligence.map((row) => [row.manager, row]));
  const byYear = draftPicks
    .filter((pick) => pick.player_id && pick.playerName && pick.playerName !== 'Unknown')
    .reduce<Record<string, DraftPick[]>>((groups, pick) => {
      const year = getDraftGroupKey(pick, leagueValueMode);
      groups[year] = groups[year] || [];
      groups[year].push(pick);
      return groups;
    }, {});

  return Object.entries(byYear)
    .sort(([a], [b]) => compareDraftGroupKeys(a, b))
    .flatMap(([, yearPicks]) => {
      const orderedPicks = [...yearPicks].sort((a, b) => a.pick - b.pick);
      return orderedPicks.map((pick) => buildDraftDecisionAudit(pick, orderedPicks, intelByManager.get(pick.manager) || null, leagueValueMode));
    });
}

function buildDraftDecisionAudit(
  pick: DraftPick,
  yearPicks: DraftPick[],
  intel: ManagerRosterIntelligence | null,
  leagueValueMode: LeagueValueMode = 'dynasty',
): DraftDecisionAudit {
  const needPositions = getDraftNeedPositions(intel);
  const primaryNeed = needPositions[0] || null;
  const pickedPosition = normalizePosition(pick.playerPos);
  const pickedValue = getDraftWindowValue(pick);
  const availableAtPick = yearPicks
    .filter((candidate) => candidate.pick >= pick.pick && getDraftWindowValue(candidate) > 0)
    .sort((a, b) => getDraftWindowValue(b) - getDraftWindowValue(a));
  const boardRank = Math.max(1, availableAtPick.findIndex((candidate) => getDraftPickKey(candidate) === getDraftPickKey(pick)) + 1);
  const bestAvailable = availableAtPick.find((candidate) => getDraftPickKey(candidate) !== getDraftPickKey(pick)) || null;
  const bestSamePositionAvailable = availableAtPick.find((candidate) => {
    if (getDraftPickKey(candidate) === getDraftPickKey(pick)) return false;
    return normalizePosition(candidate.playerPos) === pickedPosition;
  }) || null;
  const bestNeedAvailable = availableAtPick.find((candidate) => {
    if (getDraftPickKey(candidate) === getDraftPickKey(pick)) return false;
    return needPositions.includes(normalizePosition(candidate.playerPos));
  }) || null;
  const hasTrueNeedAlternative = Boolean(
    primaryNeed
      && bestNeedAvailable
      && normalizePosition(bestNeedAvailable.playerPos) === normalizePosition(primaryNeed)
  );
  const needMatch = Boolean(pickedPosition && needPositions.includes(pickedPosition));
  const bestAvailableDelta = bestAvailable ? getDraftWindowValue(bestAvailable) - pickedValue : 0;
  const samePositionDelta = bestSamePositionAvailable ? getDraftWindowValue(bestSamePositionAvailable) - pickedValue : 0;
  const needAlternativeDelta = bestNeedAvailable ? getDraftWindowValue(bestNeedAvailable) - pickedValue : 0;
  const boardRankLabel = boardRank <= 12 ? `Board #${boardRank}` : 'Board Reach';

  let verdict = 'Preference Pick';
  let tone: DraftDecisionTone = 'watch';
  if (boardRank <= 3 || bestAvailableDelta <= 150) {
    verdict = needMatch ? 'Board + Fit' : 'Board Pick';
    tone = 'win';
  } else if (bestAvailableDelta <= 550) {
    verdict = needMatch ? 'Fit Tiebreaker' : 'Value Pocket';
    tone = needMatch ? 'need' : 'value';
  } else if (bestSamePositionAvailable && samePositionDelta > 350) {
    verdict = 'Passed Position Value';
    tone = 'watch';
  } else if (bestAvailableDelta > 900) {
    verdict = 'Passed Board Value';
    tone = 'watch';
  } else if (needMatch) {
    verdict = 'Fit Tiebreaker';
    tone = 'need';
  }

  const needReason = primaryNeed ? getNeedReason(intel, primaryNeed) : 'No major position hole was flagged for this roster.';
  const summary = buildDraftDecisionSummary({
    verdict,
    pick,
    primaryNeed,
    pickedPosition,
    needMatch,
    boardRank,
    bestAvailableDelta,
    samePositionDelta,
    bestAvailable,
    bestSamePositionAvailable,
    needReason,
    leagueValueMode,
  });

  const alternative = buildDraftAlternative(
    pick,
    bestAvailable,
    bestSamePositionAvailable,
    bestNeedAvailable,
    needMatch,
    primaryNeed,
    bestAvailableDelta,
    samePositionDelta,
    needAlternativeDelta,
    hasTrueNeedAlternative
  );
  return {
    pick,
    verdict,
    tone,
    primaryNeed,
    boardRankLabel,
    summary,
    alternative,
  };
}

function buildDraftDecisionSummary({
  verdict,
  pick,
  primaryNeed,
  pickedPosition,
  needMatch,
  boardRank,
  bestAvailableDelta,
  samePositionDelta,
  bestAvailable,
  bestSamePositionAvailable,
  needReason,
  leagueValueMode = 'dynasty',
}: {
  verdict: string;
  pick: DraftPick;
  primaryNeed: string | null;
  pickedPosition: string;
  needMatch: boolean;
  boardRank: number;
  bestAvailableDelta: number;
  samePositionDelta: number;
  bestAvailable: DraftPick | null;
  bestSamePositionAvailable: DraftPick | null;
  needReason: string;
  leagueValueMode?: LeagueValueMode;
}) {
  const isRedraft = leagueValueMode === 'redraft';
  const draftedLabel = pick.positionRankMay2025 || pick.currentPositionRank || pick.playerPos;
  const boardPocket = boardRank <= 3 ? 'top board pocket' : boardRank <= 8 ? 'strong board pocket' : 'thin value pocket';
  const altValueGap = bestAvailableDelta > 0 ? `${bestAvailableDelta.toLocaleString()} value points` : 'roughly even value';

  if (verdict === 'Board + Fit') {
    return isRedraft
      ? `${pick.playerName} was a clean redraft pick: draft-day price, current value, and roster fit all lined up. ${draftedLabel} landed inside the ${boardPocket}, and ${needReason}`
      : `${pick.playerName} was the clean kind of dynasty pick: board value first, roster fit second. ${draftedLabel} landed inside the ${boardPocket}, and ${needReason}`;
  }

  if (verdict === 'Fit Tiebreaker') {
    return `${pick.playerName} was close enough on value for roster context to matter. ${pickedPosition || pick.playerPos} helped the pressure profile, but this is still graded as a value-window pick first. ${needReason}`;
  }

  if (verdict === 'Value Pocket') {
    return `${pick.playerName} stayed in a reasonable value lane. ${draftedLabel} was not the top name left, but the gap to the board was small enough that manager preference is defensible.`;
  }

  if (verdict === 'Board Pick') {
    if (primaryNeed && !needMatch) {
      return isRedraft
        ? `${pick.playerName} was the right kind of redraft value: take the best current-season profile, then solve ${primaryNeed} with waivers or trades. ${draftedLabel} still sat in the ${boardPocket}.`
        : `${pick.playerName} was the right kind of dynasty bet: take the value, then solve ${primaryNeed} later by trade. ${draftedLabel} still sat in the ${boardPocket}.`;
    }
    return `${pick.playerName} was mostly a value call. The roster did not need to force a position here, and ${draftedLabel} still sat in the ${boardPocket} when this pick came up.`;
  }

  if (verdict === 'Passed Position Value' || verdict === 'Passed Board Value') {
    if (bestSamePositionAvailable && samePositionDelta > 250) {
      const betterName = bestSamePositionAvailable.playerName;
      if (primaryNeed && !needMatch) {
        return `${pick.playerName} left stronger value on the board. ${betterName} graded ${samePositionDelta.toLocaleString()} value points better on the same position line at ${bestSamePositionAvailable.positionRankMay2025 || bestSamePositionAvailable.currentPositionRank || bestSamePositionAvailable.playerPos}; the ${primaryNeed} need is just supporting context.`;
      }
      return `${pick.playerName} was not the cleanest value at ${pickedPosition || pick.playerPos}. ${betterName} graded ${samePositionDelta.toLocaleString()} value points better on the same position line, so this was a straight value loss.`;
    }
    const betterName = bestAvailable?.playerName || 'a stronger board value';
    return `${pick.playerName} was more about manager preference than price. ${betterName} graded ${altValueGap} better in the same draft window, so this was a conscious pass on value.`;
  }

  if (needMatch) {
    return `${pick.playerName} split the difference between need and value. ${pickedPosition || pick.playerPos} helped the roster, but this was not one of the board's cleanest prices.`;
  }

  return `${pick.playerName} reads like a preference pick. The roster was not forced into ${pickedPosition || pick.playerPos}, and the board did not clearly demand this player over the alternatives.`;
}

function attachDraftDecisionAudit(pick: DraftPick, audit?: DraftDecisionAudit): DraftPick {
  if (!audit) return pick;

  return {
    ...pick,
    draftDecisionVerdict: audit.verdict,
    draftDecisionTone: audit.tone,
    draftDecisionPrimaryNeed: audit.primaryNeed,
    draftDecisionBoardRankLabel: audit.boardRankLabel,
    draftDecisionSummary: audit.summary,
    draftDecisionAltLabel: audit.alternative?.label || null,
    draftDecisionAltPlayerName: audit.alternative?.playerName || null,
    draftDecisionAltPosition: audit.alternative?.position || null,
    draftDecisionAltPickLabel: audit.alternative?.pickLabel || null,
  };
}

function buildDraftAlternative(
  pick: DraftPick,
  bestAvailable: DraftPick | null,
  bestSamePositionAvailable: DraftPick | null,
  bestNeedAvailable: DraftPick | null,
  needMatch: boolean,
  primaryNeed: string | null,
  bestAvailableDelta: number,
  samePositionDelta: number,
  needAlternativeDelta: number,
  hasTrueNeedAlternative: boolean
): DraftDecisionAudit['alternative'] {
  const selectedAlternative = !needMatch && hasTrueNeedAlternative && bestNeedAvailable && needAlternativeDelta >= -450
    ? bestNeedAvailable
    : bestSamePositionAvailable && samePositionDelta > 250
      ? bestSamePositionAvailable
      : bestAvailableDelta > 550
        ? bestAvailable
        : null;

  if (!selectedAlternative) {
    return {
      label: 'Read:',
      playerName: needMatch ? 'Need and board were aligned enough.' : 'No obvious better fit from the drafted players still available.',
    };
  }

  const label = selectedAlternative === bestNeedAvailable && primaryNeed && hasTrueNeedAlternative
    ? `Cleaner ${primaryNeed} target:`
    : selectedAlternative === bestSamePositionAvailable && samePositionDelta > 250
      ? 'Higher-value same-position play:'
    : primaryNeed && !needMatch
      ? `Missed value while ${primaryNeed} stayed open:`
      : 'Best board alternative:';

  return {
    label,
    playerName: selectedAlternative.playerName,
    position: selectedAlternative.positionRankMay2025 || selectedAlternative.currentPositionRank || selectedAlternative.playerPos,
    pickLabel: `${selectedAlternative.draftYear || pick.draftYear || ''} #${selectedAlternative.pick}`.trim(),
    playerPos: selectedAlternative.playerPos,
    pick: selectedAlternative,
  };
}

function getDraftNeedPositions(intel: ManagerRosterIntelligence | null): string[] {
  if (!intel) return [];

  const needs: string[] = [];
  if (intel.tradePlan?.needPosition) needs.push(intel.tradePlan.needPosition);

  const summary = (intel.holes.summary || '').toUpperCase();
  (['QB', 'RB', 'WR', 'TE'] as const).forEach((position) => {
    if (summary.includes(position)) needs.push(position);
  });

  const bestQbRank = parseRankNumber(intel.holes.bestQbRank);
  const rb2Rank = parseRankNumber(intel.holes.rb2Rank);
  const wr3Rank = parseRankNumber(intel.holes.wr3Rank);
  const te1Rank = parseRankNumber(intel.holes.te1Rank);
  if (bestQbRank !== null && bestQbRank > 16) needs.push('QB');
  if (rb2Rank !== null && rb2Rank > 28) needs.push('RB');
  if (wr3Rank !== null && wr3Rank > 36) needs.push('WR');
  if (te1Rank !== null && te1Rank > 14) needs.push('TE');

  Object.entries(intel.positionGrades || {}).forEach(([position, grade]) => {
    const gradeText = `${grade?.grade || ''} ${grade?.note || ''}`.toUpperCase();
    if (/(WEAK|THIN|NEED|LIGHT|FRAGILE|ATTACK|BEHIND)/.test(gradeText)) {
      needs.push(position);
    }
  });

  if (intel.holes.flexDepth <= 5) {
    needs.push('RB', 'WR');
  }

  return Array.from(new Set(needs.map(normalizePosition).filter(Boolean))) as string[];
}

function getNeedReason(intel: ManagerRosterIntelligence | null, position: string): string {
  if (!intel) return 'Roster context was limited, so this leans on board value.';
  const normalized = normalizePosition(position);
  if (normalized === 'QB' && intel.holes.bestQbRank) return `QB pressure showed up with the best QB at ${intel.holes.bestQbRank}.`;
  if (normalized === 'RB' && intel.holes.rb2Rank) return `RB pressure showed up with RB2 at ${intel.holes.rb2Rank}.`;
  if (normalized === 'WR' && intel.holes.wr3Rank) return `WR pressure showed up with WR3 at ${intel.holes.wr3Rank}.`;
  if (normalized === 'TE' && intel.holes.te1Rank) return `TE pressure showed up with TE1 at ${intel.holes.te1Rank}.`;
  if (intel.holes.flexDepth <= 5 && (normalized === 'RB' || normalized === 'WR')) {
    return `Flex depth was light with ${intel.holes.flexDepth} usable pieces.`;
  }
  return `${normalized} was part of the roster pressure profile.`;
}

function getDraftWindowValue(pick: DraftPick): number {
  return pick.ktcValue || pick.currentKtcValue || 0;
}

function normalizePosition(position?: string | null): string {
  const normalized = (position || '').trim().toUpperCase();
  if (normalized === 'RDP' || normalized === 'PICK') return '';
  if (normalized.startsWith('QB')) return 'QB';
  if (normalized.startsWith('RB')) return 'RB';
  if (normalized.startsWith('WR')) return 'WR';
  if (normalized.startsWith('TE')) return 'TE';
  return normalized;
}

function parseRankNumber(rank?: string | null): number | null {
  if (!rank) return null;
  const parsed = Number(rank.replace(/\D/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getResolvedDraftOutcome(pick: DraftPick): NonNullable<DraftPick['draftOutcome']> {
  if (isFreshRookieMarketRead(pick)) return 'neutral';
  if (pick.draftOutcome) return pick.draftOutcome;
  const rankChange = pick.positionRankChange ? parseInt(pick.positionRankChange, 10) : 0;
  const hasRankChange = Number.isFinite(rankChange) && rankChange !== 0;
  const draftYear = Number(pick.draftYear);
  const isFreshClass = Number.isFinite(draftYear) && draftYear >= new Date().getFullYear();
  const rankThreshold = isFreshClass ? 12 : 8;
  const valueThreshold = isFreshClass ? 1500 : 900;
  const isHit = (hasRankChange && rankChange >= rankThreshold) || (pick.valueGain !== null && pick.valueGain !== undefined && pick.valueGain >= valueThreshold);
  const isMiss = (hasRankChange && rankChange <= -rankThreshold) || (pick.valueGain !== null && pick.valueGain !== undefined && pick.valueGain <= -valueThreshold);
  if (isHit && isMiss) return (pick.valueGain || 0) >= 0 ? 'hit' : 'miss';
  if (isHit) return 'hit';
  if (isMiss) return 'miss';
  return 'neutral';
}

function getResolvedDraftStarter(pick: DraftPick): boolean {
  if (typeof pick.isStarter === 'boolean') return pick.isStarter;
  const rank = pick.currentPositionRank || '';
  const position = rank.match(/^[A-Z]+/)?.[0] || pick.playerPos;
  const rankNumber = Number(rank.match(/\d+/)?.[0]);
  const starterThresholds: Record<string, number> = { QB: 24, RB: 36, WR: 48, TE: 18, K: 12, DEF: 12 };
  if (position && Number.isFinite(rankNumber) && rankNumber <= (starterThresholds[position] || 0)) return true;
  return !rank && pick.currentKtcValue !== null && pick.currentKtcValue !== undefined && pick.currentKtcValue > 4000;
}

function enrichDraftPickDetails(
  pick: DraftPick,
  playerDetailsById?: Record<string, PlayerDetails>,
  audit?: DraftDecisionAudit,
  leagueValueMode: LeagueValueMode = 'dynasty',
): PlayerModalData {
  const mappedDetails = pick.player_id ? playerDetailsById?.[pick.player_id] : undefined;
  const basePick = {
    ...attachDraftDecisionAudit(pick, audit),
    currentKtcValue: getDraftCurrentValue(pick, leagueValueMode),
    valueMode: leagueValueMode,
  };
  if (!mappedDetails) return basePick;

  return {
    ...basePick,
    playerDetails: {
      ...mappedDetails,
      ...pick.playerDetails,
      valueProfile: pick.playerDetails?.valueProfile || mappedDetails.valueProfile,
      lastSeasonPositionRank: pick.playerDetails?.lastSeasonPositionRank || mappedDetails.lastSeasonPositionRank,
      lastSeasonFantasyPoints: pick.playerDetails?.lastSeasonFantasyPoints ?? mappedDetails.lastSeasonFantasyPoints,
      lastSeasonGames: pick.playerDetails?.lastSeasonGames ?? mappedDetails.lastSeasonGames,
      lastSeasonPointsPerGame: pick.playerDetails?.lastSeasonPointsPerGame ?? mappedDetails.lastSeasonPointsPerGame,
      lastSeasonYear: pick.playerDetails?.lastSeasonYear || mappedDetails.lastSeasonYear,
      availabilityHistory: pick.playerDetails?.availabilityHistory?.length ? pick.playerDetails.availabilityHistory : mappedDetails.availabilityHistory,
      latestNews: pick.playerDetails?.latestNews || mappedDetails.latestNews,
      avgGamesMissed: pick.playerDetails?.avgGamesMissed ?? mappedDetails.avgGamesMissed,
      availabilitySeasons: pick.playerDetails?.availabilitySeasons ?? mappedDetails.availabilitySeasons,
      similarTradeValues: pick.playerDetails?.similarTradeValues?.length ? pick.playerDetails.similarTradeValues : mappedDetails.similarTradeValues,
      depthChartPosition: mappedDetails.depthChartVerified ? mappedDetails.depthChartPosition : pick.playerDetails?.depthChartPosition ?? mappedDetails.depthChartPosition,
      depthChartOrder: mappedDetails.depthChartVerified ? mappedDetails.depthChartOrder : pick.playerDetails?.depthChartOrder ?? mappedDetails.depthChartOrder,
      sleeperDepthChartPosition: mappedDetails.sleeperDepthChartPosition ?? pick.playerDetails?.sleeperDepthChartPosition,
      sleeperDepthChartOrder: mappedDetails.sleeperDepthChartOrder ?? pick.playerDetails?.sleeperDepthChartOrder,
      depthChartVerified: mappedDetails.depthChartVerified ?? pick.playerDetails?.depthChartVerified,
      depthChartMismatch: mappedDetails.depthChartMismatch ?? pick.playerDetails?.depthChartMismatch,
    },
  };
}

function DraftCollapsibleSection({
  title,
  kicker,
  previewMetrics,
  open,
  onToggle,
  children,
}: {
  title: string;
  kicker?: string;
  previewMetrics?: PreviewMetric[];
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details className="report-section report-disclosure" open={open} onToggle={(event) => onToggle?.(event.currentTarget.open)}>
      <summary className="report-disclosure-summary">
        <ReportSectionHeader title={title} kicker={kicker} />
        <PreviewMetricChips metrics={previewMetrics} className="report-disclosure-preview" />
        <ChevronDown className="report-disclosure-icon" aria-hidden="true" />
      </summary>
      <div className="report-disclosure-body">
        <div className="report-disclosure-body-inner">
          {children}
        </div>
      </div>
    </details>
  );
}
