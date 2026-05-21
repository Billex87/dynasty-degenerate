import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  Bell,
  CalendarDays,
  ClipboardList,
  Crosshair,
  ExternalLink,
  FileText,
  Gauge,
  LineChart,
  Newspaper,
  PackageSearch,
  Radar,
  Save,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Users,
} from 'lucide-react';
import type { ActionPlanRecord, DraftPick, ManagerIntelPlayer, ManagerStarterPlayer, PlayerDetails, PlayerInfo, RankingPlayer, ReportData, TrendingPlayer, WeeklyMomentum } from '@shared/types';
import {
  evaluateAIEvidence,
  getAIEvidenceLeagueContextFromDiagnostics,
  getAIEvidenceReceiptItems,
  type AIEvidenceMode,
  type AIEvidenceResult,
} from '@shared/aiEvidenceEngine';
import { buildAIEvidenceLeagueActivityContext } from '@shared/leagueActivityContext';
import { AIReadPanel, type AIReadChip } from './AIReadPanel';
import { EmptyState, MetricPill, PlayerIdentityRow } from './reportPrimitives';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { ChampionAvatarFrame } from './ManagerChampionships';
import { TeamLogoPill } from './TeamLogoPill';
import { normalizeLeagueValueMode } from '@/lib/leagueValueMode';
import { getBalancedGridStyle } from '@/lib/balancedGrid';
import { isPlaceholderManagerName } from '@/lib/managerDisplay';
import { getManagerProfileLabel } from '@/lib/managerProfileLabels';
import { viewerOwnedHighlightClass } from '@/lib/viewerHighlight';
import { trpc } from '@/lib/trpc';
import { buildTradeValueCalibrationCoverage } from '@/lib/tradeValueCalibration';
import {
  OVERVIEW_POSITIONS as POSITIONS,
  buildOverviewPulseRead,
  getOverviewDefaultManager as getDefaultManager,
  getOverviewIntel as getIntel,
  getOverviewLeagueSize as getLeagueSize,
  getOverviewManagerOptions as getManagerOptions,
  getOverviewNeedPosition as getNeedPosition,
  getOverviewPositionGrade as getPositionGrade,
  getOverviewPositionRank as getPositionRank,
  getOverviewPower as getPower,
  getOverviewRankGrade as getRankGrade,
  getOverviewRow as getOverview,
  getOverviewSurplusPosition as getSurplusPosition,
  getOverviewValueTier as getValueTier,
  type OverviewManagerIntelRow as ManagerIntelRow,
  type OverviewPosition as Position,
} from '@/lib/overviewInsights';
import { AIActionQueue } from '@/components/AIActionQueue';
import { buildAutopilotData } from '@/lib/autopilot/buildAutopilotData';
import { AUTOPILOT_MOCK_DATA } from '@/lib/autopilot/mockData';

type ManagerAvatars = ReportData['managerAvatars'];
type BlueprintSignal = 'buy' | 'hold' | 'sell';
type BlueprintActionRow = {
  player: ManagerIntelPlayer;
  label: string;
  signal: BlueprintSignal;
  reason: string;
};
type BlueprintSignalRead = {
  signal: BlueprintSignal;
  label: string;
  reason: string;
  weeklyChange: number | null;
};
type BlueprintTrendPoint = {
  month: string;
  value: number;
  x: number;
  y: number;
};

const BLUEPRINT_TIERS = ['Elite', 'Championship', 'Contending', 'Reload', 'Rebuild'];
const WATCH_ALERT_PREFERENCES_KEY = 'dynasty-degenerates:watch-alert-preferences:v1';
const PORTFOLIO_SNAPSHOT_KEY = 'dynasty-degenerates:portfolio-snapshots:v1';
const ACTION_PLAN_STORAGE_KEY = 'dynasty-degenerates:action-plans:v1';

type WatchAlertPreferences = {
  riseThresholdPct: number;
  fallThresholdPct: number;
  trackedPlayerIds: string[];
  savedAt?: number;
};

type PortfolioSnapshotPlayer = {
  playerId: string;
  name: string;
  position?: string | null;
  team?: string | null;
  value: number;
};

type PortfolioSnapshot = {
  id: string;
  leagueKey: string;
  leagueName: string;
  manager: string;
  savedAt: number;
  totalValue: number;
  playerCount: number;
  topThreeShare: number | null;
  positionRows: Array<{ position: Position; count: number; value: number }>;
  players: PortfolioSnapshotPlayer[];
};

const DEFAULT_WATCH_ALERT_PREFERENCES: WatchAlertPreferences = {
  riseThresholdPct: 12,
  fallThresholdPct: 10,
  trackedPlayerIds: [],
};

function formatCompactValue(value?: number | null): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  if (Math.abs(numeric) >= 1000) return `${Math.round(numeric / 100) / 10}K`;
  return Math.round(numeric).toLocaleString();
}

function formatPercent(value?: number | null): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${numeric.toFixed(numeric >= 10 ? 0 : 1)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function confidenceFromEvidence(base: number, evidence: Array<[boolean, number]>, cap = 94): number {
  return clamp(
    Math.round(evidence.reduce((score, [available, weight]) => score + (available ? weight : 0), base)),
    28,
    cap
  );
}

function scaledEvidence(count: number | null | undefined, fullSample: number, maxWeight: number): number {
  const numeric = Number(count || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.min(maxWeight, (numeric / Math.max(1, fullSample)) * maxWeight);
}

function getReportTeamCount(data: ReportData): number {
  return data.leagueDiagnostics?.teamCount
    || data.managerRosterIntelligence?.length
    || data.leagueOverview?.length
    || 12;
}

function getOverviewConfidence(data: ReportData): number {
  const leagueConfidence = data.leagueDiagnostics?.aiConfidence?.score;
  if (Number.isFinite(leagueConfidence)) return clamp(Number(leagueConfidence), 0, 100);

  const teamCount = getReportTeamCount(data);
  return confidenceFromEvidence(34, [
    [Boolean(getDefaultManager(data)), 6],
    [Boolean(data.managerRosterIntelligence?.length), scaledEvidence(data.managerRosterIntelligence?.length, teamCount, 18)],
    [Boolean(data.powerRankings?.length), scaledEvidence(data.powerRankings?.length, teamCount, 12)],
    [Boolean(data.leagueOverview?.length), scaledEvidence(data.leagueOverview?.length, teamCount, 10)],
    [Boolean(data.positionDepth?.length), 8],
    [Boolean(data.tradeTendencies?.length || data.tradeHistory?.length), scaledEvidence((data.tradeTendencies?.length || 0) + (data.tradeHistory?.length || 0), teamCount + 8, 12)],
    [Boolean(data.rankings?.defaultProfileKey), 5],
    [Boolean(data.weeklyRisers?.length || data.weeklyFallers?.length), 5],
  ]);
}

function getManagerAiConfidenceScore(data: ReportData, manager: string): number | null {
  const confidence = data.leagueDiagnostics?.aiConfidence?.managerConfidence
    ?.find((row) => normalizeNameKey(row.manager) === normalizeNameKey(manager));
  const score = Number(confidence?.score);
  return Number.isFinite(score) ? clamp(score, 0, 100) : null;
}

function capByAiConfidence(data: ReportData, confidence: number, manager?: string | null, padding = 16): number {
  const caps: number[] = [];
  const leagueScore = Number(data.leagueDiagnostics?.aiConfidence?.score);
  if (Number.isFinite(leagueScore)) caps.push(clamp(leagueScore + padding, 28, 94));
  if (manager) {
    const managerScore = getManagerAiConfidenceScore(data, manager);
    if (managerScore !== null) caps.push(clamp(managerScore + padding, 28, 94));
  }
  return caps.length ? Math.min(confidence, ...caps) : confidence;
}

function getAiConfidenceDisplayNote(data: ReportData, manager?: string | null): string | null {
  const leagueConfidence = data.leagueDiagnostics?.aiConfidence;
  const managerConfidence = manager
    ? leagueConfidence?.managerConfidence?.find((row) => normalizeNameKey(row.manager) === normalizeNameKey(manager))
    : null;
  const confidence = managerConfidence || leagueConfidence;
  if (!confidence) return null;

  const delta = Number(confidence.scoreDelta);
  const trend = Number.isFinite(delta) && delta !== 0
    ? `${delta > 0 ? '+' : ''}${delta} since last snapshot`
    : Number.isFinite(delta)
      ? 'flat since last snapshot'
      : 'evidence building';
  const weakestSignal = [...(confidence.signals || [])].sort((a, b) => a.score - b.score)[0]?.label.toLowerCase();
  const scope = managerConfidence ? 'Team' : 'League';

  return weakestSignal
    ? `${scope} ${trend}; weakest ${weakestSignal}.`
    : `${scope} ${trend}.`;
}

function getMonthlyConfidence(data: ReportData, manager: string, hasPartialHistory: boolean): number {
  const managerHistoryCount = (data.monthlyBlueprintHistory || []).filter((snapshot) => snapshot.manager === manager).length;
  const rawConfidence = confidenceFromEvidence(hasPartialHistory ? 38 : 46, [
    [Boolean(getIntel(data, manager)), 12],
    [Boolean(getPower(data, manager)), 8],
    [Boolean(getOverview(data, manager)), 8],
    [Boolean(data.pickPortfolios?.some((row) => row.manager === manager)), 6],
    [Boolean(data.tradeHistory?.length), scaledEvidence(data.tradeHistory?.length, 10, 8)],
    [Boolean(data.weeklyRisers?.length || data.weeklyFallers?.length), 5],
    [managerHistoryCount >= 2, scaledEvidence(managerHistoryCount, 4, 10)],
    [data.monthlyBlueprintSnapshot?.status === 'stored', 4],
  ]);
  return capByAiConfidence(data, rawConfidence, manager, 14);
}

function getFocusedManager(data: ReportData, managerOptions = getManagerOptions(data)): string {
  return getDefaultManager(data) || managerOptions[0] || '';
}

function CommandModuleFocus({
  label,
  manager,
  avatarUrl,
}: {
  label: string;
  manager: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className="command-module-focus" aria-label={`${label}: ${manager}`}>
      <span className="command-module-focus-label">{label}</span>
      <div className="command-module-focus-value">
        <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
        <ManagerNameWithAvatar avatarUrl={avatarUrl} managerName={manager} />
      </div>
    </div>
  );
}

function getManagerReadConfidence(data: ReportData, manager: string): number {
  const rawConfidence = confidenceFromEvidence(36, [
    [Boolean(getIntel(data, manager)), 16],
    [Boolean(getPower(data, manager)), 9],
    [Boolean(getOverview(data, manager)), 9],
    [Boolean(data.managerPositionCounts?.some((row) => row.manager === manager)), 8],
    [Boolean(data.pickPortfolios?.some((row) => row.manager === manager)), 5],
    [Boolean(data.tradeTendencies?.some((row) => row.manager === manager)), 5],
    [Boolean(data.weeklyRisers?.some((row) => row.owner === manager) || data.weeklyFallers?.some((row) => row.owner === manager)), 4],
  ]);
  return capByAiConfidence(data, rawConfidence, manager, 16);
}

function getRankingsConfidence(data: ReportData, rowCount: number): number {
  const rawConfidence = confidenceFromEvidence(rowCount ? 42 : 32, [
    [rowCount > 0, scaledEvidence(rowCount, 250, 22)],
    [Boolean(data.leagueDiagnostics?.valueSnapshotProfileCount), 8],
    [Boolean(data.rankings?.defaultProfileKey), 8],
    [Boolean(data.currentPositionRankById && Object.keys(data.currentPositionRankById).length), 6],
    [Boolean(data.weeklyRisers?.length || data.weeklyFallers?.length), 6],
  ]);
  return capByAiConfidence(data, rawConfidence, null, 18);
}

function getRankingProfileRowCount(data: ReportData, profileKey?: string | null): number {
  if (!profileKey) return 0;
  const rows = data.rankings?.profiles?.[profileKey];
  if (Array.isArray(rows) && rows.length > 0) return rows.length;
  return data.rankings?.profileRowCounts?.[profileKey] || 0;
}

function getTradeHistoryConfidence(data: ReportData): number {
  const tradeCount = data.tradeHistory?.length || 0;
  const rawConfidence = confidenceFromEvidence(tradeCount ? 42 : 30, [
    [tradeCount > 0, scaledEvidence(tradeCount, 18, 22)],
    [Boolean(data.tradeTendencies?.length), scaledEvidence(data.tradeTendencies?.length, getReportTeamCount(data), 12)],
    [Boolean(data.tradeProfitLeaderboard?.length), 8],
    [Boolean(data.managerRosterIntelligence?.length), 6],
    [Boolean(data.standingsHistory?.length), 5],
  ]);
  return capByAiConfidence(data, rawConfidence, null, 16);
}

function getEvidenceChip(read: AIEvidenceResult): AIReadChip {
  return {
    label: `${read.label} ${read.finalScore}%`,
    tone:
      read.label === 'blocked'
        ? 'danger'
        : read.label === 'thin'
          ? 'warn'
          : read.canAct
            ? 'good'
            : 'info',
  };
}

function getReportEvidenceModes(data: ReportData): AIEvidenceMode[] {
  return isRedraftReportData(data)
    ? ['redraft', 'current']
    : ['dynasty', 'current'];
}

function buildOwnerIntelEvidenceRead(
  data: ReportData,
  manager: string,
  baseScore: number
): AIEvidenceResult {
  const intel = getIntel(data, manager);
  const overview = getOverview(data, manager);
  const power = getPower(data, manager);
  const counts = data.managerPositionCounts?.find((row) => row.manager === manager) || null;
  const pickPortfolio = data.pickPortfolios?.find((row) => row.manager === manager) || null;
  const tradeTendency = data.tradeTendencies?.find((row) => row.manager === manager) || null;
  const isRedraft = isRedraftReportData(data);
  const sourceCount = [
    intel,
    overview,
    power,
    counts,
    isRedraft ? true : pickPortfolio,
    tradeTendency,
  ].filter(Boolean).length;

  return evaluateAIEvidence({
    surface: 'owner-intel',
    action: 'watch',
    leagueValueMode: isRedraft ? 'redraft' : 'dynasty',
    leagueContext: getAIEvidenceLeagueContextFromDiagnostics(
      data.leagueDiagnostics,
      isRedraft ? 'redraft' : 'dynasty'
    ),
    leagueActivity: buildAIEvidenceLeagueActivityContext(data),
    signalModes: getReportEvidenceModes(data),
    baseScore,
    evidence: [
      intel ? `${manager} roster intelligence returned.` : null,
      overview ? `${manager} league overview row returned.` : null,
      power ? `${manager} power ranking returned.` : null,
      counts ? `${manager} roster position counts returned.` : null,
      pickPortfolio && !isRedraft ? `${manager} pick portfolio returned.` : null,
      tradeTendency ? `${manager} trade tendency row returned.` : null,
    ].filter((value): value is string => Boolean(value)),
    missingEvidence: [
      !intel ? 'Manager roster intelligence missing.' : null,
      !overview ? 'League overview row missing.' : null,
      !power ? 'Power ranking row missing.' : null,
      !counts ? 'Roster position counts missing.' : null,
      !isRedraft && !pickPortfolio ? 'Pick portfolio missing.' : null,
      !tradeTendency ? 'Trade tendency row missing.' : null,
    ].filter((value): value is string => Boolean(value)),
    sourceTrace: [
      { label: 'Manager roster intelligence', status: intel ? 'loaded' : 'missing', detail: manager },
      { label: 'League overview', status: overview ? 'loaded' : 'missing', detail: overview ? `Value rank #${overview.rank_value}` : null },
      { label: 'Power rankings', status: power ? 'loaded' : 'missing', detail: power ? `Power rank #${power.rank}` : null },
      { label: 'Roster position counts', status: counts ? 'loaded' : 'missing', detail: counts ? `${counts.totalRosterPlayerCount || counts.rosterPlayers?.length || 0} players` : null },
      { label: isRedraft ? 'Current-season lens' : 'Pick portfolio', status: isRedraft || pickPortfolio ? 'loaded' : 'missing', detail: isRedraft ? 'Redraft mode' : pickPortfolio ? formatCompactValue(pickPortfolio.totalValue) : null },
      { label: 'Trade tendencies', status: tradeTendency ? 'loaded' : 'missing', detail: tradeTendency ? `${tradeTendency.tradeCount} trades` : null },
    ],
    player: {
      name: manager,
      sourceCount,
      hasCurrentSeasonValue: isRedraft ? Boolean(intel && overview) : true,
      hasDynastyValue: !isRedraft ? Boolean(intel && (power || pickPortfolio)) : false,
    },
    requiresCurrentSeasonEvidence: isRedraft,
    requiresActiveTeam: false,
    requiresLiveAvailability: false,
    staleSourceCap: 60,
  });
}

function buildRankingsEvidenceRead(
  data: ReportData,
  rows: RankingPlayer[],
  baseScore: number,
  availableRowCount = rows.length
): AIEvidenceResult {
  const isRedraft = isRedraftReportData(data);
  const diagnostics = isRedraft
    ? data.rankings?.redraftSourceDiagnostics || []
    : data.rankings?.dynastySourceDiagnostics || [];
  const profileSources = data.rankings?.defaultProfileKey
    ? data.rankings.sourceWeightProfiles?.[data.rankings.defaultProfileKey]?.sources || []
    : [];
  const loadedDiagnostics = diagnostics.filter((row) => row.status === 'loaded' && row.rowCount > 0);
  const sourceCount = loadedDiagnostics.length || profileSources.length;
  const ownedCount = rows.filter((row) => row.owner).length;
  const valueRows = rows.filter((row) => !row.isPick && !row.isDevy && Number.isFinite(Number(row.value)));
  const rowCount = Math.max(rows.length, availableRowCount);

  return evaluateAIEvidence({
    surface: 'rankings',
    action: 'watch',
    leagueValueMode: isRedraft ? 'redraft' : 'dynasty',
    leagueContext: getAIEvidenceLeagueContextFromDiagnostics(
      data.leagueDiagnostics,
      isRedraft ? 'redraft' : 'dynasty'
    ),
    leagueActivity: buildAIEvidenceLeagueActivityContext(data),
    signalModes: getReportEvidenceModes(data),
    baseScore,
    evidence: [
      rowCount ? `${rowCount} ranking assets indexed.` : null,
      valueRows.length ? `${valueRows.length} player value rows returned.` : null,
      sourceCount ? `${sourceCount} ranking sources loaded.` : null,
      ownedCount ? `${ownedCount} rows include live roster ownership.` : null,
      data.rankings?.defaultProfileKey ? `Default profile ${data.rankings.defaultProfileKey}.` : null,
    ].filter((value): value is string => Boolean(value)),
    missingEvidence: [
      !rowCount ? 'Ranking rows missing.' : null,
      !sourceCount ? 'Ranking source trace missing.' : null,
      rows.length && !ownedCount ? 'Roster ownership not attached to ranking rows.' : null,
      isRedraft && !data.rankings?.defaultRedraftProfileKey ? 'Redraft profile key missing.' : null,
    ].filter((value): value is string => Boolean(value)),
    sourceTrace: diagnostics.length
      ? diagnostics.slice(0, 8).map((row) => ({
          label: row.source,
          status: row.status === 'empty' || row.status === 'disabled' ? 'missing' : row.status,
          detail: `${row.rowCount} rows - ${row.note}`,
          ageHours: row.loadedAt ? Math.max(0, Math.round(((Date.now() - Date.parse(row.loadedAt)) / (1000 * 60 * 60)) * 10) / 10) : null,
        }))
      : profileSources.slice(0, 8).map((source) => ({
          label: source.source,
          status: 'loaded' as const,
          detail: `${source.percent}% weight - ${source.note}`,
        })),
    player: {
      name: 'Ranking board',
      sourceCount,
      hasCurrentSeasonValue: isRedraft ? Boolean(rowCount && sourceCount) : true,
      hasDynastyValue: !isRedraft ? Boolean(rowCount && sourceCount) : false,
    },
    requiresCurrentSeasonEvidence: isRedraft,
    requiresActiveTeam: false,
    requiresLiveAvailability: false,
    confidenceCap: sourceCount ? null : 54,
    confidenceCapReason: sourceCount ? null : 'Ranking source trace missing',
    staleSourceCap: 60,
  });
}

function buildTradeBrowserEvidenceRead(
  data: ReportData,
  baseScore: number
): AIEvidenceResult {
  const tradeCount = data.tradeHistory?.length || 0;
  const tendencyCount = data.tradeTendencies?.length || 0;
  const profitCount = data.tradeProfitLeaderboard?.length || 0;
  const managerIntelCount = data.managerRosterIntelligence?.length || 0;
  const sourceCount = [tradeCount, tendencyCount, profitCount, managerIntelCount]
    .filter(count => count > 0).length;
  const isRedraft = isRedraftReportData(data);

  return evaluateAIEvidence({
    surface: 'trade',
    action: 'trade',
    leagueValueMode: isRedraft ? 'redraft' : 'dynasty',
    leagueContext: getAIEvidenceLeagueContextFromDiagnostics(
      data.leagueDiagnostics,
      isRedraft ? 'redraft' : 'dynasty'
    ),
    leagueActivity: buildAIEvidenceLeagueActivityContext(data),
    signalModes: getReportEvidenceModes(data),
    baseScore,
    evidence: [
      tradeCount ? `${tradeCount} completed trades returned.` : null,
      tendencyCount ? `${tendencyCount} manager trade tendency rows returned.` : null,
      profitCount ? `${profitCount} trade-profit rows returned.` : null,
      managerIntelCount ? `${managerIntelCount} manager roster rows returned for fit checks.` : null,
    ].filter((value): value is string => Boolean(value)),
    missingEvidence: [
      !tradeCount ? 'Completed trade ledger missing.' : null,
      !tendencyCount ? 'Manager trade tendencies missing.' : null,
      !profitCount ? 'Trade-profit leaderboard missing.' : null,
      !managerIntelCount ? 'Roster intelligence missing for fit checks.' : null,
    ].filter((value): value is string => Boolean(value)),
    sourceTrace: [
      { label: 'Trade history', status: tradeCount ? 'loaded' : 'missing', detail: `${tradeCount} trades` },
      { label: 'Trade tendencies', status: tendencyCount ? 'loaded' : 'missing', detail: `${tendencyCount} managers` },
      { label: 'Trade-profit leaderboard', status: profitCount ? 'loaded' : 'missing', detail: `${profitCount} rows` },
      { label: 'Roster fit context', status: managerIntelCount ? 'loaded' : 'missing', detail: `${managerIntelCount} manager rows` },
    ],
    player: {
      name: 'Trade browser',
      sourceCount,
      hasCurrentSeasonValue: isRedraft ? Boolean(managerIntelCount) : true,
      hasDynastyValue: !isRedraft ? Boolean(managerIntelCount) : false,
    },
    requiresCurrentSeasonEvidence: isRedraft,
    requiresActiveTeam: false,
    requiresLiveAvailability: false,
    confidenceCap: sourceCount <= 1 ? 58 : null,
    confidenceCapReason: sourceCount <= 1 ? 'Thin trade evidence' : null,
    staleSourceCap: 60,
  });
}

function getModuleConfidence(base: number, evidence: Array<[boolean, number]>): number {
  return confidenceFromEvidence(base, evidence, 92);
}

function normalizeNameKey(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeTradePlayerKey(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function formatTradeSignalDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function getTradeResistanceRead(
  data: ReportData,
  targetManager: string,
  targetPlayer?: ManagerIntelPlayer | null,
): { penalty: number; chip: AIReadChip | null; note: string | null; playerSpecific: boolean } {
  const managerKey = normalizeNameKey(targetManager);
  const managerSignals = (data.tradeProposalSignals || [])
    .filter((signal) => signal.managers.some((manager) => normalizeNameKey(manager) === managerKey));
  const targetPlayerNameKey = normalizeTradePlayerKey(targetPlayer?.name);
  const playerSignals = targetPlayer?.player_id
    ? managerSignals.filter((signal) => (
      signal.playerIds.includes(targetPlayer.player_id)
      || (targetPlayerNameKey && signal.playerNames.some((name) => normalizeTradePlayerKey(name) === targetPlayerNameKey))
    ))
    : [];
  const hardStatusPattern = /declin|reject|cancel|veto|fail|expire/i;
  const hardSignals = (playerSignals.length ? playerSignals : managerSignals)
    .filter((signal) => hardStatusPattern.test(signal.status));
  const signal = hardSignals[0] || playerSignals[0] || managerSignals[0] || null;
  const playerSpecificSignalCount = playerSignals.length;
  const hardSignalCount = hardSignals.length;
  const softSignalCount = Math.max(0, managerSignals.length - hardSignalCount);
  const penalty = Math.min(22, playerSpecificSignalCount * 9 + hardSignalCount * 5 + softSignalCount * 2);

  if (!signal || penalty <= 0) {
    return { penalty: 0, chip: null, note: null, playerSpecific: false };
  }

  const playerSpecific = Boolean(targetPlayer && playerSignals.length);
  const statusLabel = signal.status.replace(/_/g, ' ');
  const latestDateLabel = formatTradeSignalDate(signal.date);
  const countCopy = playerSpecific
    ? `${playerSpecificSignalCount} player-specific signal${playerSpecificSignalCount === 1 ? '' : 's'}`
    : `${managerSignals.length} non-complete trade signal${managerSignals.length === 1 ? '' : 's'}`;
  const latestCopy = latestDateLabel ? ` Latest: ${latestDateLabel}.` : '';
  const chip = playerSpecific
    ? { label: `${targetPlayer?.name} resistance`, tone: 'warn' as const }
    : { label: `${targetManager} trade friction`, tone: 'warn' as const };
  const note = playerSpecific
    ? `${targetManager} has ${countCopy} involving ${targetPlayer?.name} (${statusLabel}).${latestCopy} Lower the first ask or include a cleaner fit.`
    : `${targetManager} has ${countCopy} (${statusLabel}), so confidence is discounted until the offer fit is cleaner.${latestCopy}`;

  return { penalty, chip, note, playerSpecific };
}

function applyTradeResistance(confidence: number, resistance: { penalty: number }): number {
  return clamp(Math.round(confidence - resistance.penalty), 28, 94);
}

function toFiniteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getShortMonthLabel(month: string): string {
  const [, rawMonth] = month.split('-');
  const monthIndex = Number(rawMonth) - 1;
  if (!Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) return month;
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(2026, monthIndex, 1));
}

function buildTrendPoints(values: Array<{ month: string; value: number | null }>): BlueprintTrendPoint[] {
  const finiteValues = values.filter((row): row is { month: string; value: number } => Number.isFinite(row.value));
  if (!finiteValues.length) return [];

  const minValue = Math.min(...finiteValues.map((row) => row.value));
  const maxValue = Math.max(...finiteValues.map((row) => row.value));
  const spread = Math.max(0.1, maxValue - minValue);
  const divisor = Math.max(1, finiteValues.length - 1);

  return finiteValues.map((row, index) => ({
    ...row,
    x: finiteValues.length === 1 ? 50 : clamp((index / divisor) * 100, 5, 95),
    y: clamp(100 - ((row.value - minValue) / spread) * 100, 12, 88),
  }));
}

function getTrendDelta(points: BlueprintTrendPoint[]): number | null {
  if (points.length < 2) return null;
  return points[points.length - 1].value - points[0].value;
}

function readWatchAlertPreferences(): WatchAlertPreferences {
  if (typeof window === 'undefined') return DEFAULT_WATCH_ALERT_PREFERENCES;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WATCH_ALERT_PREFERENCES_KEY) || 'null') as Partial<WatchAlertPreferences> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_WATCH_ALERT_PREFERENCES;
    return {
      riseThresholdPct: clamp(Number(parsed.riseThresholdPct) || DEFAULT_WATCH_ALERT_PREFERENCES.riseThresholdPct, 1, 100),
      fallThresholdPct: clamp(Number(parsed.fallThresholdPct) || DEFAULT_WATCH_ALERT_PREFERENCES.fallThresholdPct, 1, 100),
      trackedPlayerIds: Array.isArray(parsed.trackedPlayerIds) ? parsed.trackedPlayerIds.filter(Boolean).map(String).slice(0, 80) : [],
      savedAt: Number(parsed.savedAt) || undefined,
    };
  } catch {
    return DEFAULT_WATCH_ALERT_PREFERENCES;
  }
}

function writeWatchAlertPreferences(preferences: WatchAlertPreferences) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WATCH_ALERT_PREFERENCES_KEY, JSON.stringify({
    ...preferences,
    savedAt: Date.now(),
  }));
}

function readPortfolioSnapshots(): PortfolioSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PORTFOLIO_SNAPSHOT_KEY) || '[]') as PortfolioSnapshot[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((snapshot) => snapshot && snapshot.id && snapshot.manager && Array.isArray(snapshot.players))
      .slice(0, 30);
  } catch {
    return [];
  }
}

function writePortfolioSnapshots(snapshots: PortfolioSnapshot[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PORTFOLIO_SNAPSHOT_KEY, JSON.stringify(snapshots.slice(0, 30)));
}

function readJsonArrayFromStorage<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function writeJsonArrayToStorage<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function readTrackedTradePlans(): ActionPlanRecord[] {
  return mergeTrackedTradePlans(
    readJsonArrayFromStorage<ActionPlanRecord>(ACTION_PLAN_STORAGE_KEY)
  ).slice(0, 80);
}

function writeTrackedTradePlans(plans: ActionPlanRecord[]) {
  const tradePlans = mergeTrackedTradePlans(plans).slice(0, 80);
  const existingActionPlans = readJsonArrayFromStorage<ActionPlanRecord>(ACTION_PLAN_STORAGE_KEY);
  const nonTradePlans = existingActionPlans.filter((plan) => plan?.kind !== 'trade');
  const nextActionPlans = [...tradePlans, ...nonTradePlans]
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    .slice(0, 100);
  writeJsonArrayToStorage(ACTION_PLAN_STORAGE_KEY, nextActionPlans);
}

function upsertTrackedTradePlan(plan: ActionPlanRecord): ActionPlanRecord[] {
  const next = [plan, ...readTrackedTradePlans().filter((item) => item.id !== plan.id)]
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    .slice(0, 80);
  writeTrackedTradePlans(next);
  return next;
}

function mergeTrackedTradePlans(...groups: ActionPlanRecord[][]): ActionPlanRecord[] {
  const byId = new Map<string, ActionPlanRecord>();
  groups.flat().forEach((plan) => {
    if (plan?.kind !== 'trade' || !plan.id) return;
    const existing = byId.get(plan.id);
    if (!existing || (plan.updatedAt || plan.createdAt) >= (existing.updatedAt || existing.createdAt)) {
      byId.set(plan.id, plan);
    }
  });
  return Array.from(byId.values())
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    .slice(0, 100);
}

function getTradePlanId(
  leagueId: string | undefined,
  sourceManager: string,
  targetManager: string,
  targetPlayer?: ManagerIntelPlayer | null,
): string {
  return [
    'trade',
    leagueId || 'unknown-league',
    normalizeNameKey(sourceManager),
    normalizeNameKey(targetManager),
    targetPlayer?.player_id || normalizeTradePlayerKey(targetPlayer?.name) || 'value-fit',
  ].join(':');
}

type TradePlanOutcomeRead = {
  status: Extract<ActionPlanRecord['status'], 'acted' | 'blocked' | 'stale'>;
  source: 'trade-history' | 'proposal-signal' | 'aging-window';
  evidenceSummary: string;
};

const TRADE_PLAN_STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

export function getTradePlanOutcomeRead(data: ReportData, plan: ActionPlanRecord, now = Date.now()): TradePlanOutcomeRead | null {
  if (plan.kind !== 'trade' || ['acted', 'blocked', 'stale'].includes(plan.status)) return null;
  const sourceManager = String(plan.payload?.sourceManager || plan.manager || '');
  const targetManager = String(plan.payload?.targetManager || '');
  const createdAt = Number(plan.createdAt || 0);
  const completedTrade = (data.tradeHistory || []).find((trade) => {
    const dateMs = Date.parse(trade.date);
    const afterPlan = !createdAt || !Number.isFinite(dateMs) || dateMs >= createdAt - 86_400_000;
    return afterPlan
      && [trade.team_a, trade.team_b].some((manager) => normalizeNameKey(manager) === normalizeNameKey(sourceManager))
      && [trade.team_a, trade.team_b].some((manager) => normalizeNameKey(manager) === normalizeNameKey(targetManager));
  });
  if (completedTrade) {
    return {
      status: 'acted',
      source: 'trade-history',
      evidenceSummary: `Completed trade found on ${completedTrade.date} between ${completedTrade.team_a} and ${completedTrade.team_b}.`,
    };
  }

  const targetPlayerId = String(plan.payload?.targetPlayerId || plan.playerId || '');
  const targetPlayerNameKey = normalizeTradePlayerKey(String(plan.payload?.targetPlayerName || ''));
  const blockedSignal = (data.tradeProposalSignals || []).find((signal) => {
    const dateMs = Date.parse(signal.date);
    const afterPlan = !createdAt || !Number.isFinite(dateMs) || dateMs >= createdAt - 86_400_000;
    const includesManagers = signal.managers.some((manager) => normalizeNameKey(manager) === normalizeNameKey(sourceManager))
      && signal.managers.some((manager) => normalizeNameKey(manager) === normalizeNameKey(targetManager));
    const includesPlayer = !targetPlayerId && !targetPlayerNameKey
      ? true
      : signal.playerIds.includes(targetPlayerId)
        || signal.playerNames.some((name) => normalizeTradePlayerKey(name) === targetPlayerNameKey);
    return afterPlan && includesManagers && includesPlayer && /declin|reject|cancel|veto|fail|expire/i.test(signal.status);
  });
  if (blockedSignal) {
    return {
      status: 'blocked',
      source: 'proposal-signal',
      evidenceSummary: `${blockedSignal.status || 'Non-complete'} proposal signal found on ${blockedSignal.date}.`,
    };
  }
  const ageMs = createdAt ? now - createdAt : 0;
  if (Number.isFinite(ageMs) && ageMs >= TRADE_PLAN_STALE_AFTER_MS) {
    return {
      status: 'stale',
      source: 'aging-window',
      evidenceSummary: 'No completed trade or blocked proposal signal appeared within 14 days of tracking this read.',
    };
  }
  return null;
}

function getTradePlanOutcomeStatus(data: ReportData, plan: ActionPlanRecord): ActionPlanRecord['status'] | null {
  return getTradePlanOutcomeRead(data, plan)?.status || null;
}

export function buildTradeOutcomeLearning(plans: ActionPlanRecord[]) {
  const tradePlans = plans.filter(plan => plan.kind === 'trade');
  if (!tradePlans.length) return null;
  const acted = tradePlans.filter(plan => plan.status === 'acted').length;
  const blocked = tradePlans.filter(plan => plan.status === 'blocked').length;
  const stale = tradePlans.filter(plan => plan.status === 'stale').length;
  const open = tradePlans.length - acted - blocked - stale;
  const completed = acted + blocked + stale;
  const actedRate = completed ? Math.round((acted / completed) * 100) : null;
  const strongestPattern = actedRate === null
    ? 'Not enough outcomes yet'
    : actedRate >= 60
      ? 'Current trade reads are converting into completed ledger activity.'
      : stale > acted && stale >= blocked
        ? 'Tracked reads are aging out; use smaller asks, clearer deadlines, or quieter managers.'
      : blocked >= acted
        ? 'Tracked reads are meeting resistance; lower first asks or use smaller sweeteners.'
        : 'Mixed outcomes; keep using manager-fit and resistance notes before pushing value.';
  return {
    acted,
    blocked,
    stale,
    open,
    actedRate,
    strongestPattern,
  };
}

function getFormatBadges(data: ReportData): string[] {
  const diagnostics = data.leagueDiagnostics;
  const teamCount = diagnostics?.teamCount || data.leagueOverview?.length;
  const slots = diagnostics?.starterSlots || diagnostics?.rosterSlots || [];
  const isSuperflex = slots.some((slot) => /SUPER_FLEX|OP|SF/i.test(slot));
  const ppr = diagnostics?.receptionScoring;
  const tep = diagnostics?.tightEndPremium;

  return [
    teamCount ? `${teamCount} teams` : null,
    isSuperflex ? 'SF' : '1QB',
    ppr === 1 ? 'PPR' : ppr === 0.5 ? '0.5 PPR' : ppr === 0 ? 'Standard' : ppr ? `${ppr} PPR` : null,
    tep ? `${tep} TEP` : '0 TEP',
  ].filter(Boolean) as string[];
}

function getMonthLabel() {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date());
}

function getPlayerLabel(player?: ManagerIntelPlayer | PlayerInfo | WeeklyMomentum | null): string {
  if (!player) return '-';
  return 'name' in player ? player.name : '-';
}

function getPlayerKey(player?: { player_id?: string | null; name?: string | null } | null): string {
  if (!player) return '';
  return player.player_id || player.name || '';
}

function isSamePlayer(a?: { player_id?: string | null; name?: string | null } | null, b?: { player_id?: string | null; name?: string | null } | null): boolean {
  if (!a || !b) return false;
  const aKey = getPlayerKey(a);
  const bKey = getPlayerKey(b);
  return Boolean(aKey && bKey && aKey === bKey);
}

function matchesAnyPlayer(player: ManagerIntelPlayer, players: Array<ManagerIntelPlayer | null | undefined>): boolean {
  return players.some((candidate) => isSamePlayer(player, candidate));
}

function uniqueBlueprintPlayers(players: Array<ManagerIntelPlayer | ManagerStarterPlayer | null | undefined>): ManagerIntelPlayer[] {
  const seen = new Set<string>();
  const normalized: ManagerIntelPlayer[] = [];
  players.filter(Boolean).forEach((player) => {
    const row = player as ManagerIntelPlayer;
    const key = getPlayerKey(row);
    if (!key || seen.has(key)) return;
    seen.add(key);
    normalized.push(row);
  });
  return normalized.sort((a, b) => (b.seasonValue || b.value || 0) - (a.seasonValue || a.value || 0));
}

function getWeeklyChange(player: ManagerIntelPlayer, risers: WeeklyMomentum[], fallers: WeeklyMomentum[]): number | null {
  const row = [...risers, ...fallers].find((item) => isSamePlayer(player, item));
  return row ? row.pct_change : null;
}

export function getBlueprintSignal(player: ManagerIntelPlayer, intel: ManagerIntelRow, risers: WeeklyMomentum[], fallers: WeeklyMomentum[]): BlueprintSignalRead {
  const weeklyChange = getWeeklyChange(player, risers, fallers);
  const buyMatches = [
    intel.buyTarget,
    intel.breakoutCandidate,
    intel.bestBenchStash,
    ...(intel.tradeBlueprints || []).map((blueprint) => blueprint.getPlayer),
  ];
  const sellMatches = [
    intel.sellCandidate,
    intel.oldestPlayer,
    intel.weakestStarter,
    ...(intel.tradeBlueprints || []).map((blueprint) => blueprint.givePlayer),
  ];

  if (matchesAnyPlayer(player, sellMatches) || (weeklyChange !== null && weeklyChange <= -8)) {
    const explicitSell = matchesAnyPlayer(player, sellMatches);
    return {
      signal: 'sell',
      label: explicitSell ? 'Sell' : 'Faller',
      reason: explicitSell ? 'Shop window' : 'Falling market',
      weeklyChange,
    };
  }

  if (matchesAnyPlayer(player, [intel.youngCorePlayer, intel.lastSeasonStud, ...(intel.untouchablePlayers || [])])) {
    return {
      signal: 'hold',
      label: 'Core Hold',
      reason: 'Insulated core',
      weeklyChange,
    };
  }

  if (matchesAnyPlayer(player, buyMatches) || (weeklyChange !== null && weeklyChange >= 8)) {
    const explicitBuy = matchesAnyPlayer(player, buyMatches);
    return {
      signal: 'buy',
      label: explicitBuy ? 'Buy' : 'Riser',
      reason: explicitBuy ? 'Value target' : 'Rising market',
      weeklyChange,
    };
  }

  return {
    signal: 'hold',
    label: 'Hold',
    reason: matchesAnyPlayer(player, intel.untouchablePlayers || []) ? 'Core hold' : 'No forced move',
    weeklyChange,
  };
}

function buildBlueprintActions(intel: ManagerIntelRow): Record<BlueprintSignal, BlueprintActionRow[]> {
  const rows: BlueprintActionRow[] = [];
  const used = new Set<string>();
  const add = (player: ManagerIntelPlayer | null | undefined, signal: BlueprintSignal, label: string, reason: string) => {
    const key = getPlayerKey(player);
    if (!player || !key || used.has(key)) return;
    used.add(key);
    rows.push({ player, label, signal, reason });
  };

  add(intel.sellCandidate, 'sell', 'Hard sell', 'Primary sell candidate');
  add(intel.oldestPlayer, 'sell', 'Soft sell', 'Age/value window');
  add(intel.weakestStarter, 'sell', 'Soft sell', 'Starter pressure point');
  (intel.tradeBlueprints || []).forEach((blueprint) => add(blueprint.givePlayer, 'sell', blueprint.tone === 'risk' ? 'Hard sell' : 'Soft sell', blueprint.label || blueprint.summary));

  add(intel.buyTarget, 'buy', 'Hard buy', 'Primary buy target');
  add(intel.breakoutCandidate, 'buy', 'Soft buy', 'Breakout profile');
  add(intel.bestBenchStash, 'buy', 'Soft buy', 'Bench stash');
  (intel.tradeBlueprints || []).forEach((blueprint) => add(blueprint.getPlayer, 'buy', blueprint.tone === 'buy' ? 'Hard buy' : 'Soft buy', blueprint.label || blueprint.summary));

  (intel.untouchablePlayers || []).slice(0, 4).forEach((player) => add(player, 'hold', 'Core hold', 'Do not move without an overpay'));
  add(intel.youngCorePlayer, 'hold', 'Core hold', 'Insulated core');
  add(intel.lastSeasonStud, 'hold', 'Hold', 'Production proof');
  add(intel.tradeChip, 'hold', 'Flexible', 'Trade chip, not a dump');

  return {
    buy: rows.filter((row) => row.signal === 'buy').slice(0, 4),
    hold: rows.filter((row) => row.signal === 'hold').slice(0, 3),
    sell: rows.filter((row) => row.signal === 'sell').slice(0, 4),
  };
}

function renderPlayerList(players: ManagerIntelPlayer[] | undefined, empty = 'No player data returned', limit = 6) {
  if (!players?.length) return <p className="command-module-empty-copy">{empty}</p>;
  return (
    <div className="command-mini-player-list">
      {players.slice(0, limit).map((player, index) => (
        <span key={`${player.player_id || player.name}-${index}`}>
          <PlayerIdentityRow
            playerId={player.player_id}
            playerName={player.name}
            team={player.playerDetails?.team}
            position={player.pos}
          />
          <em>{formatCompactValue(player.seasonValue || player.value)}</em>
        </span>
      ))}
    </div>
  );
}

function getBestTradeableAtPosition(intel: ManagerIntelRow | null, position: Position | null): ManagerIntelPlayer | null {
  if (!intel || !position) return null;
  return intel.tradeableDepth?.find((tile) => tile.position === position && tile.player)?.player
    || intel.benchPlayers?.filter((player) => player.pos === position).sort((a, b) => (b.value || 0) - (a.value || 0))[0]
    || null;
}

function getManagerPlayerPool(intel: ManagerIntelRow | null): ManagerIntelPlayer[] {
  const players = [
    ...(intel?.rosterPlayers || []),
    ...(intel?.benchPlayers || []),
    ...(intel?.untouchablePlayers || []),
    intel?.buyTarget,
    intel?.sellCandidate,
    intel?.tradeChip,
    intel?.youngCorePlayer,
    intel?.oldestPlayer,
  ].filter(Boolean) as ManagerIntelPlayer[];
  const seen = new Set<string>();
  return players.filter((player) => {
    const key = player.player_id || `${player.name}-${player.pos}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (b.seasonValue || b.value || 0) - (a.seasonValue || a.value || 0));
}

function getTradePlayerValue(player: ManagerIntelPlayer | null | undefined, data: ReportData): number {
  if (!player) return 0;
  const mode = normalizeLeagueValueMode(data.leagueDiagnostics?.valueMode || data.leagueValueMode);
  return mode === 'redraft'
    ? Math.round(player.seasonValue || player.value || 0)
    : Math.round(player.value || player.seasonValue || 0);
}

function isSuperflexLeague(data: ReportData): boolean {
  return (data.leagueDiagnostics?.starterSlots || data.leagueDiagnostics?.rosterSlots || [])
    .some((slot) => /SUPER_FLEX|OP|SF/i.test(slot));
}

function buildOverviewRead(data: ReportData) {
  const read = buildOverviewPulseRead(data);
  return {
    title: read.title,
    body: read.body,
    chips: read.chips as AIReadChip[],
  };
}

function buildOverviewEvidenceRead(data: ReportData, baseScore: number): AIEvidenceResult {
  const isRedraft = isRedraftReportData(data);
  const managerCount = getManagerOptions(data).length;
  const rosterCount = data.managerRosterIntelligence?.length || 0;
  const overviewCount = data.leagueOverview?.length || 0;
  const powerCount = data.powerRankings?.length || 0;
  const tradeSignalCount =
    (data.tradeHistory?.length || 0) +
    (data.tradeTendencies?.length || 0) +
    (data.tradeProposalSignals?.length || 0);
  const marketSignalCount =
    (data.weeklyRisers?.length || 0) +
    (data.weeklyFallers?.length || 0);
  const sourceCount = [
    rosterCount,
    overviewCount,
    powerCount,
    tradeSignalCount,
    marketSignalCount,
  ].filter(count => count > 0).length;

  return evaluateAIEvidence({
    surface: 'overview',
    action: 'watch',
    leagueValueMode: isRedraft ? 'redraft' : 'dynasty',
    leagueContext: getAIEvidenceLeagueContextFromDiagnostics(
      data.leagueDiagnostics,
      isRedraft ? 'redraft' : 'dynasty'
    ),
    leagueActivity: buildAIEvidenceLeagueActivityContext(data),
    signalModes: getReportEvidenceModes(data),
    baseScore,
    evidence: [
      managerCount ? `${managerCount} visible managers returned.` : null,
      rosterCount ? `${rosterCount} roster-intelligence rows returned.` : null,
      overviewCount ? `${overviewCount} league overview rows returned.` : null,
      powerCount ? `${powerCount} power-ranking rows returned.` : null,
      tradeSignalCount ? `${tradeSignalCount} trade signals returned.` : null,
      marketSignalCount ? `${marketSignalCount} market movement signals returned.` : null,
    ].filter((value): value is string => Boolean(value)),
    missingEvidence: [
      !managerCount ? 'No visible manager rows returned.' : null,
      !rosterCount ? 'Roster intelligence missing.' : null,
      !overviewCount ? 'League overview rows missing.' : null,
      !powerCount ? 'Power rankings missing.' : null,
      !tradeSignalCount ? 'Trade signal context missing.' : null,
      !marketSignalCount ? 'Market movement context missing.' : null,
    ].filter((value): value is string => Boolean(value)),
    sourceTrace: [
      { label: 'Visible managers', status: managerCount ? 'loaded' : 'missing', detail: `${managerCount} managers` },
      { label: 'Roster intelligence', status: rosterCount ? 'loaded' : 'missing', detail: `${rosterCount} rows` },
      { label: 'League overview', status: overviewCount ? 'loaded' : 'missing', detail: `${overviewCount} rows` },
      { label: 'Power rankings', status: powerCount ? 'loaded' : 'missing', detail: `${powerCount} rows` },
      { label: 'Trade signals', status: tradeSignalCount ? 'loaded' : 'missing', detail: `${tradeSignalCount} rows` },
      { label: 'Market movement', status: marketSignalCount ? 'loaded' : 'missing', detail: `${marketSignalCount} rows` },
    ],
    player: {
      name: 'Overview AI Pulse',
      sourceCount,
      hasCurrentSeasonValue: isRedraft ? Boolean(rosterCount || overviewCount) : true,
      hasDynastyValue: !isRedraft ? Boolean(rosterCount || overviewCount) : false,
    },
    requiresCurrentSeasonEvidence: isRedraft,
    requiresActiveTeam: false,
    requiresLiveAvailability: false,
    confidenceCap: sourceCount <= 1 ? 54 : null,
    confidenceCapReason: sourceCount <= 1 ? 'Thin overview evidence' : null,
    staleSourceCap: 60,
  });
}

export function OverviewAIPulse({
  data,
}: {
  data: ReportData;
}) {
  const read = buildOverviewRead(data);
  const confidence = getOverviewConfidence(data);
  const evidenceRead = buildOverviewEvidenceRead(data, confidence);
  const mode = isRedraftReportData(data) ? 'redraft' : 'dynasty';
  const actionQueue = useMemo(() => {
    try {
      return buildAutopilotData({
        reportData: data,
        mode,
        fallback: AUTOPILOT_MOCK_DATA[mode],
      }).actionQueue;
    } catch (error) {
      console.error('Overview AI Action Queue failed to build.', error);
      return AUTOPILOT_MOCK_DATA[mode].actionQueue;
    }
  }, [data, mode]);

  if (!evidenceRead.shouldRender) return null;

  return (
    <AIReadPanel
      title={read.title}
      subtitle="Narrative guide for the Overview stack; exact metrics stay with their owning tables."
      readType="League Exploit"
      confidence={evidenceRead.finalScore}
      confidenceNote={evidenceRead.confidenceCapReason ? `Confidence capped by ${evidenceRead.confidenceCapReason}.` : getAiConfidenceDisplayNote(data) || evidenceRead.whyThisFired}
      evidenceRead={evidenceRead}
      severity={evidenceRead.label === 'thin' ? 'warn' : evidenceRead.finalScore >= 76 ? 'info' : 'warn'}
      chips={[getEvidenceChip(evidenceRead), ...read.chips]}
      body={(
        <>
          <p>{read.body}</p>
          <AIActionQueue
            items={actionQueue}
            title="One Best Move"
            subtitle="The Overview only surfaces the highest ranked AI action."
            compact
            className="overview-ai-action-queue"
            memoryKey={`overview:${mode}:${getManagerOptions(data).join('|') || 'league'}`}
            memoryContext="Overview AI Pulse"
            enableOutcomeTracking={false}
          />
        </>
      )}
      traceItems={getAIEvidenceReceiptItems(evidenceRead)}
      backgroundVariant="league"
      className="overview-ai-pulse"
    />
  );
}

function buildTradePartners(data: ReportData, sourceManager: string) {
  const sourceIntel = getIntel(data, sourceManager);
  const sourceNeed = getNeedPosition(data, sourceManager);
  const managers = getManagerOptions(data).filter((manager) => manager !== sourceManager);

  return managers.map((manager) => {
    const intel = getIntel(data, manager);
    const need = getNeedPosition(data, manager);
    const surplus = getSurplusPosition(data, manager);
    const youOffer = getBestTradeableAtPosition(sourceIntel, need) || sourceIntel?.sellCandidate || sourceIntel?.tradeChip || null;
    const theyOffer = getBestTradeableAtPosition(intel, sourceNeed) || intel?.sellCandidate || intel?.tradeChip || null;
    const canMatchNeed = Boolean(youOffer && need);
    const canHelpYou = Boolean(theyOffer && sourceNeed);
    const tendency = data.tradeTendencies?.find((row) => normalizeNameKey(row.manager) === normalizeNameKey(manager));
    const activityAdjustment = tendency
      ? tendency.tradeCount >= 6
        ? 8
        : tendency.tradeCount >= 3
          ? 5
          : tendency.tradeCount === 0
            ? -6
            : 0
      : 0;
    const favoritePartnerAdjustment = normalizeNameKey(tendency?.favoritePartner) === normalizeNameKey(sourceManager) ? 4 : 0;
    const resistance = getTradeResistanceRead(data, manager, theyOffer);
    const confidence = applyTradeResistance(
      clamp(45 + (canMatchNeed ? 18 : 0) + (canHelpYou ? 18 : 0) + (surplus && sourceNeed === surplus ? 12 : 0) + activityAdjustment + favoritePartnerAdjustment, 35, 94),
      resistance
    );
    const label = need
      ? `${need} buyer`
      : surplus
        ? `${surplus} surplus`
        : intel?.timeline?.toLowerCase().includes('rebuild')
          ? 'Rebuild window'
          : 'Neutral partner';
    const angle = canMatchNeed && canHelpYou
      ? `two-way roster fit: you can address their ${need} need while asking about ${theyOffer?.name}`
      : canMatchNeed
        ? `you can shop ${youOffer?.name} into their ${need} need`
        : canHelpYou
          ? `they have ${theyOffer?.name}, which fits your ${sourceNeed} need`
          : `value conversation only; no clean positional fit was returned`;
    return {
      manager,
      label,
      need,
      surplus,
      youOffer,
      theyOffer,
      angle,
      confidence,
      resistanceRead: resistance,
      aiRead: `${manager} reads as ${label.toLowerCase()}. ${angle}.${resistance.note ? ` ${resistance.note}` : ''}`,
    };
  }).sort((a, b) => b.confidence - a.confidence);
}

function isRedraftReportData(data: ReportData): boolean {
  return normalizeLeagueValueMode(
    data.leagueDiagnostics?.valueMode || data.leagueValueMode
  ) === 'redraft';
}

function hasCurrentSeasonMainDraft(data: ReportData): boolean {
  const diagnostics = data.leagueDiagnostics;
  if (typeof diagnostics?.hasCurrentSeasonMainDraft === 'boolean') {
    return diagnostics.hasCurrentSeasonMainDraft;
  }

  const currentSeason = diagnostics?.currentSeason;
  if (!currentSeason) return false;

  return (data.draftPicks || []).some((pick) => {
    const draftYear = pick.draftYear ? String(pick.draftYear) : '';
    const draftKind = pick.draftKind || 'main';
    const hasPlayer =
      Boolean(pick.player_id) ||
      (Boolean(pick.playerName) && pick.playerName !== 'Unknown');

    return draftYear === currentSeason && draftKind === 'main' && hasPlayer;
  });
}

function getRedraftPowerLabel(row: NonNullable<ReportData['powerRankings']>[number]): string {
  if (row.starterStrength >= 70) return 'Playoff push';
  if (row.starterStrength >= 55) return 'Weekly contender';
  if (row.starterStrength > 0) return 'Needs starter help';
  return 'Preseason roster';
}

export function MonthlyTeamBlueprint({
  data,
  leagueName,
  leagueFormat,
  managerAvatars,
}: {
  data: ReportData;
  leagueName: string;
  leagueFormat?: string;
  managerAvatars?: ManagerAvatars;
}) {
  const managerOptions = getManagerOptions(data);
  const [generated, setGenerated] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const reportRef = useRef<HTMLElement | null>(null);
  const manager = getFocusedManager(data, managerOptions);
  const intel = getIntel(data, manager);
  const overview = getOverview(data, manager);
  const power = getPower(data, manager);
  const pickPortfolio = data.pickPortfolios?.find((row) => row.manager === manager) || null;
  const tradeTendency = data.tradeTendencies?.find((row) => row.manager === manager) || null;
  const timeline = data.dynastyTimelines?.find((row) => row.manager === manager) || null;
  const counts = data.managerPositionCounts?.find((row) => row.manager === manager) || null;
  const leagueSize = getLeagueSize(data);
  const monthLabel = getMonthLabel();
  const risers = data.weeklyRisers?.filter((row) => row.owner === manager).slice(0, 3) || [];
  const fallers = data.weeklyFallers?.filter((row) => row.owner === manager).slice(0, 3) || [];
  const tradePartners = buildTradePartners(data, manager).slice(0, 3);
  const hasPartialHistory = !data.standingsHistory?.length || !data.tradeHistory?.length || !data.weeklyRisers?.length;
  const snapshotStatus = data.monthlyBlueprintSnapshot;
  const formatBadges = getFormatBadges(data);
  const monthlyConfidence = getMonthlyConfidence(data, manager, hasPartialHistory);
  const isRedraft = isRedraftReportData(data);
  const isPreDraftRedraft = isRedraft && !hasCurrentSeasonMainDraft(data);

  if (!managerOptions.length || !intel) {
    return (
      <EmptyState
        className="command-module-empty"
        title="Team blueprint needs roster intelligence"
        description="The report did not return manager roster intelligence, so this blueprint cannot be generated without inventing data."
      />
    );
  }

  if (isPreDraftRedraft) {
    return (
      <div className="team-blueprint-lab">
        <AIReadPanel
          title="Available after the draft"
          subtitle="Once the current draft is complete, this section can use roster, draft, trade, and value movement data."
          readType="Monthly Blueprint"
          confidence={null}
          decision={{
            label: "Do not use yet",
            detail: "Current-season draft evidence is missing, so the blueprint stays locked instead of inventing a plan.",
            tone: "stop",
            status: "Locked",
          }}
          severity="warn"
          chips={[
            { label: 'Current draft pending', tone: 'warn' },
            `${managerOptions.length || data.leagueDiagnostics?.teamCount || 'League'} teams`,
          ]}
          body="This redraft league does not have a current-season main draft payload yet, so the monthly blueprint is locked instead of generating a report from empty or historical inputs."
          actions={[{ label: 'Blueprint Locked Until Draft', disabled: true }]}
          backgroundVariant="monthly"
        />
      </div>
    );
  }

  const starterPlayers = ((counts?.starterPlayers || []) as ManagerIntelPlayer[]);
  const rosterPool = uniqueBlueprintPlayers([
    ...starterPlayers,
    ...getManagerPlayerPool(intel),
  ]);
  const starterKeys = new Set(starterPlayers.map((player) => getPlayerKey(player)).filter(Boolean));
  const depthPlayers = uniqueBlueprintPlayers([
    ...(intel.benchPlayers || []),
    ...rosterPool.filter((player) => !starterKeys.has(getPlayerKey(player))),
  ]).slice(0, 14);
  const valueTier = getValueTier(overview?.rank_value, leagueSize);
  const marketRows = rosterPool.map((player) => ({
    player,
    read: getBlueprintSignal(player, intel, risers, fallers),
  }));
  const marketCounts = marketRows.reduce<Record<BlueprintSignal, number>>((countsBySignal, row) => {
    countsBySignal[row.read.signal] += 1;
    return countsBySignal;
  }, { buy: 0, hold: 0, sell: 0 });
  const marketTotal = Math.max(1, marketRows.length);
  const buyPct = Math.round((marketCounts.buy / marketTotal) * 100);
  const holdPct = Math.round((marketCounts.hold / marketTotal) * 100);
  const sellPct = Math.max(0, 100 - buyPct - holdPct);
  const marketScore = clamp(50 + buyPct * 0.7 - sellPct * 0.9, 0, 100);
  const marketGaugeStyle = { '--team-blueprint-gauge-angle': `${-68 + marketScore * 1.36}deg` } as CSSProperties;
  const marketPosture = buyPct >= sellPct + 12
    ? 'Buyer lean'
    : sellPct >= buyPct + 12
      ? 'Seller lean'
      : 'Hold-heavy';
  const managerHistory = (data.monthlyBlueprintHistory || [])
    .filter((snapshot) => snapshot.manager === manager)
    .sort((a, b) => a.snapshotMonth.localeCompare(b.snapshotMonth));
  const hasStoredTrendHistory = managerHistory.length >= 2;
  const actionRows = buildBlueprintActions(intel);
  const positionRooms = POSITIONS.map((position) => ({
    position,
    grade: getPositionGrade(data, intel, overview, position),
    players: rosterPool.filter((player) => player.pos === position).slice(0, 6),
  }));
  const positionGrades = POSITIONS.map((position) => {
    const rank = getPositionRank(overview, position);
    return {
      position,
      grade: getPositionGrade(data, intel, overview, position),
      rank,
      note: intel.positionGrades?.[position]?.note || `${position} room ranks ${rank ? `#${rank}` : 'outside the returned rank set'}.`,
    };
  });
  const overallGrade = power?.score
    ? Math.round(power.score / 10)
    : Math.round(positionGrades.reduce((sum, item) => sum + Number(item.grade || 5), 0) / positionGrades.length);
  const topPriorities = [
    intel.tradePlan?.summary,
    ...((intel.pressurePoints || []).slice(0, 3)),
    intel.holes.summary !== 'No major roster hole flagged' ? intel.holes.summary : null,
  ].filter(Boolean) as string[];
  const needPosition = getNeedPosition(data, manager);
  const surplusPosition = getSurplusPosition(data, manager);
  const priorityText = topPriorities[0] || intel.tradePlan?.summary || 'No urgent roster action was returned.';
  const pressureTitle = needPosition ? `${needPosition} depth` : 'Roster construction';
  const ageRows = POSITIONS.map((position) => {
    const age = intel.avgAgeByPosition?.[position] ?? null;
    const points = buildTrendPoints(managerHistory.map((snapshot) => ({
      month: snapshot.snapshotMonth,
      value: toFiniteNumber(snapshot.avgAgeByPosition?.[position]),
    })));
    const delta = getTrendDelta(points);
    return {
      position,
      age,
      left: age === null ? 0 : clamp(((age - 22) / 10) * 100, 0, 100),
      points,
      delta,
    };
  });
  const productionTrendPoints = buildTrendPoints(managerHistory.map((snapshot) => ({
    month: snapshot.snapshotMonth,
    value: toFiniteNumber(snapshot.starterValuePct),
  })));
  const overallGradeTrendPoints = buildTrendPoints(managerHistory.map((snapshot) => ({
    month: snapshot.snapshotMonth,
    value: toFiniteNumber(snapshot.powerRanking?.score) !== null
      ? Math.round((toFiniteNumber(snapshot.powerRanking?.score) || 0) / 10)
      : null,
  })));
  const trendCards = [
    {
      label: 'Production Share',
      value: formatPercent(intel.starterValuePct),
      points: productionTrendPoints,
      delta: getTrendDelta(productionTrendPoints),
      suffix: ' pts',
      invert: false,
    },
    {
      label: 'Action Lanes',
      value: String(topPriorities.length || 1),
      points: [],
      delta: null,
      suffix: '',
      invert: false,
    },
    {
      label: 'Overall Grade',
      value: String(overallGrade),
      points: overallGradeTrendPoints,
      delta: getTrendDelta(overallGradeTrendPoints),
      suffix: '',
      invert: false,
    },
  ];
  const tradePlayCards = tradePartners.slice(0, 2).map((partner) => ({
    partner,
    give: partner.youOffer || intel.tradeChip || intel.sellCandidate,
    ask: partner.theyOffer || intel.buyTarget || intel.breakoutCandidate,
  }));
  const monthlyReadItems = [
    {
      label: 'Direction',
      title: timeline?.label || intel.timeline || intel.identity,
      body: `${monthLabel} plan tier ${valueTier} with ${topPriorities.length || 1} returned priority lane${topPriorities.length === 1 ? '' : 's'} for this roster window.`,
    },
    {
      label: 'Construction',
      title: pressureTitle,
      body: needPosition
        ? `${needPosition} is the clearest construction gap. Use ${surplusPosition ? `${surplusPosition} depth` : 'bench flexibility'} before touching the core players.`
        : priorityText,
    },
    {
      label: 'This month',
      title: marketPosture,
      body: `${buyPct}% buy, ${holdPct}% hold, and ${sellPct}% sell from returned roster signals. Trade partner specifics live in the trade finder.`,
    },
  ];
  const handlePrintBlueprint = () => {
    if (typeof window === 'undefined') return;
    setShareStatus('Opening print dialog');
    window.print();
  };

  const handleOpenPosterView = () => {
    if (typeof window === 'undefined' || !reportRef.current) return;
    const posterWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!posterWindow) {
      setShareStatus('Poster popup blocked');
      return;
    }

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join('\n');
    posterWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>${manager} Monthly Blueprint</title>
          ${styles}
          <style>
            body { margin: 0; min-height: 100vh; background: #020617; padding: 24px; }
            .team-blueprint-report { max-width: 1440px; margin: 0 auto; }
            @media print { body { padding: 0; } .team-blueprint-report { max-width: none; } }
          </style>
        </head>
        <body>${reportRef.current.outerHTML}</body>
      </html>`);
    posterWindow.document.close();
    setShareStatus('Poster view opened');
  };

  return (
    <div className="team-blueprint-lab">
      <div className="command-module-toolbar">
        <CommandModuleFocus
          label="Team"
          manager={manager}
          avatarUrl={managerAvatars?.[manager]}
        />
        <button type="button" className="command-primary-action" onClick={() => setGenerated(true)}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          {generated ? 'Regenerate Team Blueprint' : 'Generate Team Blueprint'}
        </button>
        {generated && (
          <div className="team-blueprint-export-actions">
            <button type="button" className="command-secondary-action" onClick={handlePrintBlueprint}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Print / Save PDF
            </button>
            <button type="button" className="command-secondary-action" onClick={handleOpenPosterView}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Poster View
            </button>
            {shareStatus && <span>{shareStatus}</span>}
          </div>
        )}
      </div>

      {!generated ? (
        <AIReadPanel
          title="Monthly blueprint ready"
          subtitle="Uses current roster, league rankings, draft picks, trade history, and 7-day value movement where available."
          readType="Monthly Blueprint"
          confidence={monthlyConfidence}
          confidenceNote={getAiConfidenceDisplayNote(data, manager)}
          decision={{
            label: "Do this",
            detail: `Generate ${manager}'s ${monthLabel} blueprint from returned roster, ranking, draft, trade, and movement evidence.`,
            tone: "go",
            status: `Ready · ${monthlyConfidence}%`,
          }}
          severity={monthlyConfidence >= 78 && !hasPartialHistory ? 'good' : hasPartialHistory ? 'warn' : 'info'}
          chips={[
            snapshotStatus?.status === 'stored'
              ? `Stored ${snapshotStatus.month}`
              : snapshotStatus?.status === 'local'
                ? `Local ${snapshotStatus.month}`
                : { label: 'Snapshot not stored', tone: 'warn' },
            hasPartialHistory ? { label: 'Partial history available', tone: 'warn' } : { label: 'History loaded', tone: 'good' },
            `${managerOptions.length} teams`,
          ]}
          body={`Generate ${manager}'s ${monthLabel} roster blueprint. The report will show only returned data; missing history is flagged instead of filled in with fake trend lines.`}
          actions={[{ label: 'View Monthly Blueprint', onClick: () => setGenerated(true) }]}
          backgroundVariant="monthly"
        />
      ) : (
        <article className="team-blueprint-report" ref={reportRef}>
          <div className="team-blueprint-report-header">
            <div className="team-blueprint-lockup">
              <ChampionAvatarFrame managerName={manager} className="team-blueprint-avatar">
                {managerAvatars?.[manager] ? (
                  <img src={managerAvatars[manager] || ''} alt={manager} />
                ) : (
                  <span>{manager.slice(0, 2).toUpperCase()}</span>
                )}
              </ChampionAvatarFrame>
              <div>
                <p>The Monthly Blueprint</p>
                <h3>{manager}</h3>
                <span>{leagueName || 'Sleeper League'} · {monthLabel}</span>
              </div>
            </div>
            <div className="team-blueprint-format-badges">
              {[...formatBadges, leagueFormat ? leagueFormat : null].filter(Boolean).slice(0, 5).map((badge) => (
                <span key={String(badge)}>{badge}</span>
              ))}
              {snapshotStatus && (
                <span className={`team-blueprint-snapshot-badge team-blueprint-snapshot-badge-${snapshotStatus.status}`}>
                  {snapshotStatus.status === 'stored'
                    ? `Stored ${snapshotStatus.month}`
                    : snapshotStatus.status === 'local'
                      ? `Local snapshot ${snapshotStatus.month}`
                      : `Snapshot pending ${snapshotStatus.month}`}
                </span>
              )}
            </div>
          </div>

          {(hasPartialHistory || snapshotStatus?.warning) && (
            <div className="team-blueprint-warning">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {hasPartialHistory
                ? 'Partial history available. This blueprint uses the current roster snapshot plus returned weekly movement, trades, picks, and standings only.'
                : snapshotStatus?.warning}
            </div>
          )}

          <div className="team-blueprint-grid">
            <section className="team-blueprint-panel team-blueprint-panel-wide team-blueprint-dashboard-panel">
              <div>
                <h4>Roster Identity</h4>
                <div className="team-blueprint-metric-grid">
                  <MetricPill label="Roster archetype" value={intel.identity || '-'} tone="info" />
                  <MetricPill label="Roster window" value={timeline ? timeline.label : intel.timeline || '-'} tone="info" />
                  <MetricPill label="Plan tier" value={valueTier} tone="good" />
                  <MetricPill label="Plan grade" value={overallGrade} tone={overallGrade >= 7 ? 'good' : overallGrade <= 4 ? 'danger' : 'warn'} />
                  <MetricPill label="Priority count" value={topPriorities.length || 1} tone="info" />
                  <MetricPill label="History" value={hasPartialHistory ? 'Partial' : 'Loaded'} tone={hasPartialHistory ? 'warn' : 'good'} />
                  <MetricPill label="Snapshot" value={snapshotStatus?.status || 'live'} tone={snapshotStatus?.status === 'unavailable' ? 'warn' : 'neutral'} />
                </div>
              </div>
              <div className="team-blueprint-tier-ladder" aria-label={`Monthly plan tier ${valueTier}`}>
                <span>Monthly Plan Tier</span>
                {BLUEPRINT_TIERS.map((tier) => (
                  <strong key={tier} className={tier === valueTier ? 'team-blueprint-tier-active' : undefined}>
                    {tier}
                  </strong>
                ))}
              </div>
              <div className="team-blueprint-stat-stack">
                <span>
                  <em>Plan Focus</em>
                  <strong>{topPriorities.length ? `${topPriorities.length} priorities` : intel.identity}</strong>
                  <small>{topPriorities[0] || `${monthLabel} action lane`}</small>
                </span>
                <span>
                  <em>Plan Inputs</em>
                  <strong>{hasPartialHistory ? 'Partial' : 'Loaded'}</strong>
                  <small>{snapshotStatus?.month || monthLabel} snapshot context</small>
                </span>
              </div>
            </section>

            <section className="team-blueprint-panel team-blueprint-panel-wide team-blueprint-read-panel">
              <h4>What This Blueprint Is Telling You</h4>
              <div className="team-blueprint-read-grid">
                {monthlyReadItems.map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="team-blueprint-panel team-blueprint-panel-wide team-blueprint-room-board">
              <h4>Position Room Board</h4>
              <div className="team-blueprint-room-grid">
                {positionRooms.map((room) => (
                  <div key={room.position} className={`team-blueprint-room-card team-blueprint-position-${room.position.toLowerCase()}`}>
                    <div className="team-blueprint-room-card-head">
                      <strong>{room.position}</strong>
                      <em>Grade {room.grade}</em>
                    </div>
                    <div className="team-blueprint-room-list">
                      {room.players.map((player) => {
                        const signal = getBlueprintSignal(player, intel, risers, fallers);
                        return (
                          <span key={getPlayerKey(player)}>
                            <PlayerIdentityRow
                              playerId={player.player_id}
                              playerName={player.name}
                              team={player.playerDetails?.team}
                              position={player.pos}
                              hideMeta
                            />
                            <em className={`team-blueprint-signal-dot team-blueprint-signal-${signal.signal}`}>{signal.label}</em>
                          </span>
                        );
                      })}
                      {!room.players.length && <p>No {room.position} players returned.</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="team-blueprint-panel team-blueprint-panel-wide team-blueprint-grades-panel">
              <h4>Positional Grades</h4>
              <div className="team-blueprint-grade-grid">
                {positionGrades.map((item) => (
                  <span key={item.position}>
                    <strong>{item.grade}</strong>
                    <em>{item.position}</em>
                    <small>{item.rank ? `Rank #${item.rank}` : 'No rank'}</small>
                    <small className="team-blueprint-grade-note">{item.note}</small>
                  </span>
                ))}
                <span>
                  <strong>{getRankGrade(null)}</strong>
                  <em>Bench</em>
                  <small>{formatCompactValue(intel.benchValue)}</small>
                </span>
                <span>
                  <strong>{getRankGrade(pickPortfolio ? leagueSize - Math.min(leagueSize - 1, Math.round((pickPortfolio.totalValue || 0) / 1200)) : null, leagueSize)}</strong>
                  <em>Draft Capital</em>
                  <small>{pickPortfolio ? formatCompactValue(pickPortfolio.totalValue) : 'No picks'}</small>
                </span>
              </div>
            </section>

            <section className="team-blueprint-panel">
              <h4>Starting Lineup Signals</h4>
              {starterPlayers.length ? (
                <div className="team-blueprint-lineup-list">
                  {starterPlayers.slice(0, 9).map((player) => {
                    const signal = getBlueprintSignal(player, intel, risers, fallers);
                    return (
                      <span key={getPlayerKey(player)} className={`team-blueprint-lineup-row team-blueprint-lineup-${signal.signal}`}>
                        <PlayerIdentityRow
                          playerId={player.player_id}
                          playerName={player.name}
                          team={player.playerDetails?.team}
                          position={player.pos}
                          hideMeta
                        />
                        <em>{player.pos}</em>
                        <strong>{signal.weeklyChange !== null ? `${signal.weeklyChange > 0 ? '+' : ''}${signal.weeklyChange.toFixed(1)}%` : signal.label}</strong>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="command-module-empty-copy">Starter players were not returned.</p>
              )}
            </section>

            <section className="team-blueprint-panel">
              <h4>Team Depth</h4>
              {depthPlayers.length ? (
                <div className="team-blueprint-depth-cloud">
                  {depthPlayers.map((player) => (
                    <span key={getPlayerKey(player)} className={`team-blueprint-position-${player.pos.toLowerCase()}`}>
                      {player.name} <em>{player.pos}</em>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="command-module-empty-copy">Bench/depth player data was not returned.</p>
              )}
            </section>

            <section className="team-blueprint-panel">
              <h4>Risers / Fallers</h4>
              <div className="team-blueprint-move-board">
                <div className="team-blueprint-move-column team-blueprint-move-risers">
                  <span>Risers</span>
                  {risers.map((player, index) => (
                    <p key={`${player.player_id || player.name}-riser-${index}`}>
                      <strong>{player.name}</strong>
                      <em>+{player.pct_change.toFixed(1)}%</em>
                    </p>
                  ))}
                  {!risers.length && <p>No roster risers returned.</p>}
                </div>
                <div className="team-blueprint-move-column team-blueprint-move-fallers">
                  <span>Fallers</span>
                  {fallers.map((player, index) => (
                    <p key={`${player.player_id || player.name}-faller-${index}`}>
                      <strong>{player.name}</strong>
                      <em>{player.pct_change.toFixed(1)}%</em>
                    </p>
                  ))}
                  {!fallers.length && <p>No roster fallers returned.</p>}
                </div>
              </div>
            </section>

            <section className="team-blueprint-panel">
              <h4>Market Value Analysis</h4>
              <div className="team-blueprint-market-gauge" style={marketGaugeStyle}>
                <div className="team-blueprint-gauge-arc" aria-hidden="true">
                  <span className="team-blueprint-gauge-needle" />
                </div>
                <strong>{marketPosture}</strong>
                <div className="team-blueprint-market-pills">
                  <span className="team-blueprint-signal-buy">Buys: {buyPct}%</span>
                  <span className="team-blueprint-signal-hold">Holds: {holdPct}%</span>
                  <span className="team-blueprint-signal-sell">Sells: {sellPct}%</span>
                </div>
                <p>Derived from returned buy/sell candidates, untouchables, and weekly roster movement.</p>
              </div>
            </section>

            <section className="team-blueprint-panel">
              <h4>Positional Age Tracker</h4>
              <div className="team-blueprint-age-chart">
                {ageRows.map((row) => (
                  <span key={row.position} className={`team-blueprint-position-${row.position.toLowerCase()}`}>
                    <em>{row.position}</em>
                    <i aria-label={`${row.position} age trend`}>
                      {hasStoredTrendHistory && row.points.length >= 2
                        ? row.points.map((point) => (
                            <b
                              key={`${row.position}-${point.month}`}
                              title={`${getShortMonthLabel(point.month)} ${point.value.toFixed(1)}`}
                              style={{ left: `${point.x}%`, top: `${point.y}%` }}
                            />
                          ))
                        : row.age !== null && <b style={{ left: `${row.left}%` }} />}
                    </i>
                    <strong>{row.age !== null ? row.age.toFixed(1) : '-'}</strong>
                    <small>{row.delta === null ? 'Snapshot' : `${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(1)} age`}</small>
                  </span>
                ))}
              </div>
              <p className="team-blueprint-panel-note">
                {hasStoredTrendHistory
                  ? `${managerHistory.length} stored monthly snapshots loaded. Dots are real saved blueprint history.`
                  : 'Current roster snapshot only; monthly trends appear after this manager has at least two stored snapshots.'}
              </p>
            </section>

            <section className="team-blueprint-panel team-blueprint-panel-wide team-blueprint-trend-tape">
              <h4>Monthly Trend Tape</h4>
              <div className="team-blueprint-trend-grid">
                {trendCards.map((card) => {
                  const deltaIsGood = card.delta === null
                    ? false
                    : card.invert
                      ? card.delta < 0
                      : card.delta > 0;
                  return (
                    <span key={card.label} className={deltaIsGood ? 'team-blueprint-trend-good' : card.delta ? 'team-blueprint-trend-warn' : undefined}>
                      <em>{card.label}</em>
                      <strong>{card.value}</strong>
                      <i aria-hidden="true">
                        {card.points.length >= 2
                          ? card.points.map((point) => (
                              <b key={`${card.label}-${point.month}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} />
                            ))
                          : <b style={{ left: '50%', top: '50%' }} />}
                      </i>
                      <small>
                        {card.delta === null
                          ? 'Needs 2 stored months'
                          : `${card.delta > 0 ? '+' : ''}${card.delta.toFixed(card.label === 'Production Share' ? 1 : 0)}${card.suffix}`}
                      </small>
                    </span>
                  );
                })}
              </div>
              <p className="team-blueprint-panel-note">
                {hasStoredTrendHistory
                  ? `History window: ${managerHistory.map((snapshot) => getShortMonthLabel(snapshot.snapshotMonth)).join(' -> ')}.`
                  : 'This stays empty until stored monthly blueprints exist for this manager.'}
              </p>
            </section>

            <section className="team-blueprint-panel team-blueprint-panel-wide team-blueprint-action-board">
              <h4>Buys / Holds / Sells</h4>
              <div className="team-blueprint-action-columns">
                {(['buy', 'hold', 'sell'] as BlueprintSignal[]).map((signal) => (
                  <div key={signal} className={`team-blueprint-action-column team-blueprint-action-${signal}`}>
                    <span>{signal === 'buy' ? 'Buys [$]' : signal === 'sell' ? 'Sells [-]' : 'Holds [=]'}</span>
                    {actionRows[signal].map((row) => (
                      <div key={`${signal}-${getPlayerKey(row.player)}`}>
                        <em>{row.label}</em>
                        <PlayerIdentityRow
                          playerId={row.player.player_id}
                          playerName={row.player.name}
                          team={row.player.playerDetails?.team}
                          position={row.player.pos}
                          hideMeta
                        />
                        <small>{row.reason}</small>
                      </div>
                    ))}
                    {!actionRows[signal].length && <p>No {signal} actions returned.</p>}
                  </div>
                ))}
              </div>
            </section>

            <section className="team-blueprint-panel">
              <h4>Draft Capital</h4>
              {pickPortfolio ? (
                <div className="team-blueprint-draft-box">
                  <span>
                    <strong>2026</strong>
                    <em>{pickPortfolio.count2026} picks</em>
                    <small>{formatCompactValue(pickPortfolio.value2026)}</small>
                  </span>
                  <span>
                    <strong>2027</strong>
                    <em>{pickPortfolio.count2027} picks</em>
                    <small>{formatCompactValue(pickPortfolio.value2027)}</small>
                  </span>
                  <p>Total capital: {formatCompactValue(pickPortfolio.totalValue)}{pickPortfolio.projectedSlots?.length ? ` · ${pickPortfolio.projectedSlots.slice(0, 3).join(', ')}` : ''}</p>
                </div>
              ) : (
                <p className="command-module-empty-copy">Draft-pick portfolio was not returned.</p>
              )}
            </section>

            <section className="team-blueprint-panel">
              <h4>Top Priorities</h4>
              {topPriorities.length ? (
                <div className="team-blueprint-priority-stack">
                  {topPriorities.slice(0, 4).map((priority, index) => (
                    <span key={priority}>
                      {index === 0 ? <Target className="h-4 w-4" aria-hidden="true" /> : index === 1 ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : <Gauge className="h-4 w-4" aria-hidden="true" />}
                      <strong>{priority}</strong>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="command-module-empty-copy">No priority flags returned.</p>
              )}
            </section>

            <section className="team-blueprint-panel team-blueprint-panel-wide team-blueprint-trade-playbook">
              <h4>Trade Strategy Enhanced</h4>
              <p>{intel.tradePlan?.summary || intel.strategySummary || intel.summary}</p>
              {tradeTendency && <p>{tradeTendency.tradeCount} completed trades · {tradeTendency.winPct}% win rate · {formatCompactValue(tradeTendency.profit)} profit.</p>}
              <div className="team-blueprint-trade-grid">
                {tradePlayCards.map((card) => (
                  <div key={card.partner.manager} className="team-blueprint-trade-card">
                    <span>{card.partner.manager}</span>
                    <div>
                      <strong>Pivot from</strong>
                      {card.give ? (
                        <PlayerIdentityRow
                          playerId={card.give.player_id}
                          playerName={card.give.name}
                          team={card.give.playerDetails?.team}
                          position={card.give.pos}
                          hideMeta
                        />
                      ) : (
                        <p>No offer piece returned.</p>
                      )}
                    </div>
                    <div>
                      <strong>Ask about</strong>
                      {card.ask ? (
                        <PlayerIdentityRow
                          playerId={card.ask.player_id}
                          playerName={card.ask.name}
                          team={card.ask.playerDetails?.team}
                          position={card.ask.pos}
                          hideMeta
                        />
                      ) : (
                        <p>No target piece returned.</p>
                      )}
                    </div>
                    <em>{card.partner.confidence}% fit</em>
                  </div>
                ))}
                {!tradePlayCards.length && <p>No trade play cards could be built from returned roster data.</p>}
              </div>
            </section>

            <section className="team-blueprint-panel">
              <h4>Ideal Trade Partners</h4>
              <div className="team-blueprint-partner-list">
                {tradePartners.map((partner) => (
                  <span key={partner.manager}>
                    <strong>{partner.manager}</strong>
                    <em>{partner.label} · {partner.confidence}%</em>
                    <small>{partner.youOffer ? `Offer ${partner.youOffer.name}` : 'Offer value'} / {partner.theyOffer ? `Ask ${partner.theyOffer.name}` : 'Ask fit'}</small>
                  </span>
                ))}
                {!tradePartners.length && <p>No clean trade partners found from returned roster data.</p>}
              </div>
            </section>

            <section className="team-blueprint-panel team-blueprint-panel-wide team-blueprint-legend">
              <h4>Legend / Data Rules</h4>
              <div>
                <span><strong className="team-blueprint-signal-buy">Buy</strong> Returned buy target, breakout/stash, or strong weekly riser.</span>
                <span><strong className="team-blueprint-signal-hold">Hold</strong> Core player or no forced action from returned data.</span>
                <span><strong className="team-blueprint-signal-sell">Sell</strong> Returned sell candidate, weak starter, age/value window, or sharp faller.</span>
              </div>
            </section>

            <AIReadPanel
              title="Blueprint AI Summary"
              readType="Monthly Blueprint"
              confidence={monthlyConfidence}
              confidenceNote={getAiConfidenceDisplayNote(data, manager)}
              decision={{
                label: topPriorities[0] ? "Do this" : "Watch only",
                detail: topPriorities[0] || "No single priority is strong enough to force from this blueprint.",
                tone: topPriorities[0] ? "go" : "watch",
                status: `Blueprint · ${monthlyConfidence}%`,
              }}
              severity={monthlyConfidence >= 78 && !hasPartialHistory ? 'good' : hasPartialHistory ? 'warn' : 'info'}
              chips={[
                monthLabel,
                intel.timeline || intel.identity,
                hasPartialHistory ? { label: 'Partial history', tone: 'warn' } : { label: 'History loaded', tone: 'good' },
              ]}
              body={`${manager} profiles as ${intel.identity}. The ${monthLabel} priority is ${topPriorities[0] || intel.tradePlan?.summary || 'to keep value insulated until a clear roster-fit deal appears'}.`}
              backgroundVariant="monthly"
              className="team-blueprint-ai"
            />
          </div>
        </article>
      )}
    </div>
  );
}

export function LeaguePowerRankings({
  data,
  managerAvatars,
}: {
  data: ReportData;
  managerAvatars?: ManagerAvatars;
}) {
  const isRedraft = isRedraftReportData(data);
  const allRows = [...(data.powerRankings || [])].sort((a, b) => a.rank - b.rank || b.score - a.score);
  const placeholderRows = isRedraft ? allRows.filter((row) => isPlaceholderManagerName(row.manager)) : [];
  const rows = isRedraft
    ? allRows.filter((row) => !isPlaceholderManagerName(row.manager))
    : allRows;

  if (!rows.length) {
    return (
      <EmptyState
        className="command-module-empty"
        title={placeholderRows.length ? 'Assigned rosters are not available yet' : 'Power rankings are not available'}
        description={placeholderRows.length
          ? 'This pre-draft redraft league only returned open roster slots, so the table is waiting for assigned managers.'
          : 'This report did not include power rankings. Re-run the league analysis after roster intelligence finishes.'}
      />
    );
  }

  return (
    <div className="league-power-shell">
      {placeholderRows.length > 0 && (
        <p className="league-power-open-roster-note">
          {placeholderRows.length} open roster{placeholderRows.length === 1 ? '' : 's'} {placeholderRows.length === 1 ? 'is' : 'are'} not assigned yet.
        </p>
      )}
      <div className="league-power-grid balanced-tile-grid" style={getBalancedGridStyle(rows.length)}>
        {rows.map((row) => {
          const overview = getOverview(data, row.manager);
          const timeline = data.dynastyTimelines?.find((item) => item.manager === row.manager);
          const readiness = Math.round((row.starterStrength + row.rosterValue + row.positionalBalance) / 3);
          const redraftPowerLabel = getRedraftPowerLabel(row);
          const dynastyPowerLabel = getManagerProfileLabel(
            row.tier,
            row.score
          ).label;
          const windowLabel = timeline?.label || dynastyPowerLabel;
          const subtitle = isRedraft ? redraftPowerLabel : dynastyPowerLabel;
          const chips: AIReadChip[] = [
            `League #${row.rank}`,
            `Value #${overview?.rank_value || '-'}`,
            isRedraft ? redraftPowerLabel : windowLabel,
          ];

          return (
            <details key={`${row.rank}-${row.manager}`} className={`league-power-card ${viewerOwnedHighlightClass(row.manager, data.viewerManager)}`}>
              <summary>
                <span className="league-power-rank">#{row.rank}</span>
                <span className="league-power-manager">
                  <ManagerNameWithAvatar avatarUrl={managerAvatars?.[row.manager]} managerName={row.manager} />
                  <em>{subtitle}</em>
                </span>
                <span className="league-power-score">{row.score}</span>
              </summary>
              <div className="league-power-body">
                <div className="league-power-metrics">
                  <MetricPill label="Power slot" value={`#${row.rank}`} tone="info" />
                  <MetricPill label="Value slot" value={overview ? `#${overview.rank_value}` : formatCompactValue(row.rosterValue)} tone="info" />
                  <MetricPill label={isRedraft ? 'Season tier' : 'Tier'} value={subtitle} tone="neutral" />
                  {!isRedraft && <MetricPill label="Window" value={windowLabel} tone="info" />}
                  <MetricPill label="Starter strength" value={row.starterStrength} tone={row.starterStrength >= 70 ? 'good' : row.starterStrength <= 45 ? 'warn' : 'info'} />
                  <MetricPill label="Balance score" value={row.positionalBalance} tone={row.positionalBalance >= 70 ? 'good' : row.positionalBalance <= 45 ? 'warn' : 'info'} />
                  {!isRedraft && <MetricPill label="Draft curve" value={row.draftCapital} tone="warn" />}
                  {!isRedraft && <MetricPill label="Youth curve" value={row.youthScore} tone="info" />}
                  <MetricPill label="Readiness score" value={readiness} tone={readiness >= 70 ? 'good' : readiness <= 45 ? 'danger' : 'warn'} />
                </div>
                <AIReadPanel
                  compact
                  title={`${row.manager} power read`}
                  readType={isRedraft ? 'Weekly Power' : 'Contender Path'}
                  confidence={getManagerReadConfidence(data, row.manager)}
                  decision={{
                    label: readiness >= 70 ? "Do this" : readiness <= 45 ? "Watch only" : "Use as context",
                    detail: readiness >= 70
                      ? "Treat this manager as a priority contender benchmark."
                      : readiness <= 45
                        ? "Do not chase this profile without a cleaner roster reason."
                        : "Useful context, but roster recon should own the actual next move.",
                    tone: readiness >= 70 ? "go" : "watch",
                    status: `Power · ${readiness}`,
                  }}
                  severity={readiness >= 70 ? 'good' : readiness <= 45 ? 'warn' : 'info'}
                  chips={chips}
                  body={`${row.manager} owns league power slot #${row.rank} with a ${row.score} composite score and ${readiness} readiness score. This card stays ranking-only; use roster recon for roster causes and Trade Finder for deal paths.`}
                  traceItems={[
                    `Power rank #${row.rank} from composite score ${row.score}.`,
                    `Value slot ${overview ? `#${overview.rank_value}` : formatCompactValue(row.rosterValue)} sets the market-order signal.`,
                    `Readiness score ${readiness} blends starter strength, roster value, and positional balance.`,
                    isRedraft ? `Season tier: ${redraftPowerLabel}.` : `Window source: ${windowLabel}.`,
                  ]}
                  backgroundVariant="league"
                />
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

export function TeamBreakdownRecon({
  data,
  managerAvatars,
}: {
  data: ReportData;
  managerAvatars?: ManagerAvatars;
}) {
  const managerOptions = getManagerOptions(data);
  const manager = getFocusedManager(data, managerOptions);
  const intel = getIntel(data, manager);
  const overview = getOverview(data, manager);
  const pickPortfolio = data.pickPortfolios?.find((row) => row.manager === manager) || null;
  const tradeTendency = data.tradeTendencies?.find((row) => row.manager === manager) || null;
  const isRedraft = isRedraftReportData(data);
  const managerReadConfidence = getManagerReadConfidence(data, manager);
  const ownerEvidenceRead = buildOwnerIntelEvidenceRead(data, manager, managerReadConfidence);

  if (!managerOptions.length || !intel) {
    return (
      <EmptyState
        className="command-module-empty"
        title="Team breakdown needs manager roster data"
        description="No manager roster intelligence was returned, so this module is intentionally empty."
      />
    );
  }

  const strengths = [
    ...(intel.untouchablePlayers || []).slice(0, 2).map((player) => player.name),
    intel.youngCorePlayer?.name,
  ].filter(Boolean);
  const weaknesses = [
    ...(intel.pressurePoints || []).slice(0, 2),
    intel.holes?.summary,
  ].filter(Boolean);
  const fragileAssets = [intel.oldestPlayer, intel.starterAvailability.riskiestStarter].filter(Boolean) as ManagerIntelPlayer[];
  const insulatedAssets = (intel.untouchablePlayers?.length ? intel.untouchablePlayers : [intel.youngCorePlayer]).filter(Boolean) as ManagerIntelPlayer[];
  const redraftProfile = overview?.rank_value
    ? `current-season value #${overview.rank_value}`
    : 'current-season roster read';
  const rosterHealthRead = isRedraft
    ? `${manager} shows ${strengths.slice(0, 2).join(' and ') || redraftProfile} as the weekly scoring base, with ${weaknesses.slice(0, 2).join(' and ') || 'no major returned leak'} as the roster-health watch. This read stays current-season only; use Trade Finder for specific partners, packages, and trade targets.`
    : `${manager} shows ${strengths.slice(0, 2).join(' and ') || intel.identity || 'a returned roster identity'} as the stable base, with ${weaknesses.slice(0, 2).join(' and ') || 'no major returned leak'} as the roster-health watch. This read stops at roster causes; use Trade Finder for specific partners, packages, and trade targets.`;

  return (
    <div className="team-breakdown-recon">
      <div className="command-module-toolbar">
        <CommandModuleFocus
          label="Manager"
          manager={manager}
          avatarUrl={managerAvatars?.[manager]}
        />
      </div>

      <div className="team-breakdown-hero">
        <ManagerNameWithAvatar avatarUrl={managerAvatars?.[manager]} managerName={manager} />
        <div>
          <span>{isRedraft ? 'Season roster profile' : intel.identity}</span>
          <strong>{isRedraft ? redraftProfile : intel.timeline}</strong>
        </div>
      </div>

      <div className="team-breakdown-grid">
        <section>
          <h4>Starting Lineup Strength</h4>
          <div className="team-breakdown-metrics">
            <MetricPill label="Starter value" value={formatCompactValue(intel.starterSeasonValue || intel.starterValue)} tone="good" />
            <MetricPill label="Starter share" value={formatPercent(intel.starterValuePct)} tone="info" />
            <MetricPill label="Availability" value={intel.starterAvailability.riskLevel} tone={intel.starterAvailability.riskLevel === 'high' ? 'warn' : 'info'} />
          </div>
        </section>
        <section>
          <h4>Bench Depth</h4>
          <div className="team-breakdown-metrics">
            <MetricPill label="Bench value" value={formatCompactValue(intel.benchValue)} />
            <MetricPill label="Best stash" value={getPlayerLabel(intel.bestBenchStash)} tone="info" />
            <MetricPill label="Depth flags" value={weaknesses.length} tone={weaknesses.length ? 'warn' : 'good'} />
          </div>
        </section>
        <section>
          <h4>Positional Grades</h4>
          <div className="team-breakdown-position-strip">
            {POSITIONS.map((position) => (
              <span key={position}>
                <strong>{position}</strong>
                <em>{getPositionGrade(data, intel, overview, position)}</em>
                <small>{getPositionRank(overview, position) ? `#${getPositionRank(overview, position)}` : '-'}</small>
              </span>
            ))}
          </div>
        </section>
        <section>
          <h4>{isRedraft ? 'Season Roster Shape' : 'Age Curve / Roster Window'}</h4>
          <div className="team-breakdown-metrics">
            {isRedraft ? (
              <>
                <MetricPill label="Value rank" value={overview ? `#${overview.rank_value}` : '-'} tone="info" />
                <MetricPill label="Starter share" value={formatPercent(intel.starterValuePct)} tone="info" />
                <MetricPill label="Risk flags" value={fragileAssets.length} tone={fragileAssets.length ? 'warn' : 'good'} />
              </>
            ) : (
              <>
                <MetricPill label="Avg age" value={intel.avgAge ?? '-'} tone={intel.avgAge && intel.avgAge >= 27.5 ? 'warn' : 'info'} />
                <MetricPill label="Timeline" value={intel.timeline || '-'} tone="info" />
                <MetricPill label="Age flags" value={intel.ageFlags?.length || 0} tone={intel.ageFlags?.length ? 'warn' : 'good'} />
              </>
            )}
          </div>
        </section>
        <section>
          <h4>Draft Capital / Trade Activity</h4>
          <div className="team-breakdown-metrics">
            <MetricPill label="Pick value" value={pickPortfolio ? formatCompactValue(pickPortfolio.totalValue) : '-'} tone="warn" />
            <MetricPill label="Trades" value={tradeTendency?.tradeCount ?? 0} />
            <MetricPill label="Trade profit" value={tradeTendency ? formatCompactValue(tradeTendency.profit) : '-'} tone={(tradeTendency?.profit || 0) >= 0 ? 'good' : 'danger'} />
          </div>
        </section>
        <section>
          <h4>Best Assets</h4>
          {renderPlayerList(insulatedAssets, 'No insulated asset list returned.', 4)}
        </section>
        <section>
          <h4>Fragility Watch</h4>
          {renderPlayerList(fragileAssets, 'No fragile assets returned.', 4)}
        </section>
        <section>
          <h4>Roster Recon</h4>
          <div className="team-breakdown-recon-list">
            <span><strong>Strengths</strong>{strengths.slice(0, 3).join(' · ') || '-'}</span>
            <span><strong>Weaknesses</strong>{weaknesses.slice(0, 3).join(' · ') || '-'}</span>
            <span><strong>Tradeable surplus</strong>{intel.tradePlan?.surplusPosition || getSurplusPosition(data, manager) || '-'}</span>
            <span><strong>Positional shortage</strong>{intel.tradePlan?.needPosition || getNeedPosition(data, manager) || '-'}</span>
            <span><strong>Fragile assets</strong>{fragileAssets.map((player) => player.name).join(' · ') || '-'}</span>
            <span><strong>Insulated assets</strong>{insulatedAssets.map((player) => player.name).join(' · ') || '-'}</span>
          </div>
        </section>
        {ownerEvidenceRead.shouldRender && (
          <AIReadPanel
            title={`${manager} suggested next move`}
            readType={isRedraft ? 'Season Roster Read' : intel.timeline?.toLowerCase().includes('rebuild') ? 'Rebuild Path' : 'Contender Path'}
            confidence={ownerEvidenceRead.finalScore}
            confidenceNote={ownerEvidenceRead.confidenceCapReason ? `Confidence capped by ${ownerEvidenceRead.confidenceCapReason}.` : ownerEvidenceRead.whyThisFired}
            evidenceRead={ownerEvidenceRead}
            severity={ownerEvidenceRead.label === 'thin' ? 'warn' : weaknesses.length > 2 ? 'warn' : 'info'}
            chips={[
              getEvidenceChip(ownerEvidenceRead),
              `Need: ${getNeedPosition(data, manager) || '-'}`,
              `Surplus: ${getSurplusPosition(data, manager) || '-'}`,
              isRedraft ? redraftProfile : intel.timeline || intel.identity,
            ]}
            body={rosterHealthRead}
            traceItems={[
              `Stable base: ${strengths.slice(0, 2).join(' and ') || (isRedraft ? redraftProfile : intel.identity) || 'returned roster identity'}.`,
              `Roster watch: ${weaknesses.slice(0, 2).join(' and ') || 'no major returned leak'}.`,
              `Need/surplus lens: ${getNeedPosition(data, manager) || '-'} need, ${getSurplusPosition(data, manager) || '-'} surplus.`,
              `Health evidence: ${intel.starterAvailability.riskLevel} availability risk and ${fragileAssets.length} fragile asset flag${fragileAssets.length === 1 ? '' : 's'}.`,
              ...getAIEvidenceReceiptItems(ownerEvidenceRead),
            ]}
            backgroundVariant="roster"
            className="team-breakdown-ai"
          />
        )}
      </div>
    </div>
  );
}

export function TradePartnerFinder({
  data,
  managerAvatars,
  leagueId,
}: {
  data: ReportData;
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
}) {
  const managerOptions = getManagerOptions(data);
  const [localTrackedTradePlans, setLocalTrackedTradePlans] = useState<ActionPlanRecord[]>(() => readTrackedTradePlans());
  const utils = trpc.useUtils();
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const isServerPersistenceEnabled = Boolean(authQuery.data);
  const serverTrackedTradePlansQuery = trpc.actionPlans.list.useQuery(
    { leagueId },
    {
      enabled: isServerPersistenceEnabled,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30,
    }
  );
  const upsertTrackedTradePlanMutation = trpc.actionPlans.upsert.useMutation({
    onSuccess: async () => {
      await utils.actionPlans.list.invalidate({ leagueId });
    },
  });
  const manager = getFocusedManager(data, managerOptions);
  const recommendations = useMemo(() => buildTradePartners(data, manager).slice(0, 8), [data, manager]);
  const trackedTradePlans = useMemo(
    () => mergeTrackedTradePlans(localTrackedTradePlans, serverTrackedTradePlansQuery.data?.plans || []),
    [localTrackedTradePlans, serverTrackedTradePlansQuery.data?.plans]
  );
  const visibleTrackedTradePlans = trackedTradePlans.filter((plan) => (
    (!leagueId || !plan.leagueId || plan.leagueId === leagueId)
    && normalizeNameKey(String(plan.payload?.sourceManager || plan.manager || '')) === normalizeNameKey(manager)
  ));

  const persistTrackedTradePlan = (plan: ActionPlanRecord) => {
    const planWithUpdatedAt = {
      ...plan,
      updatedAt: Date.now(),
    };
    setLocalTrackedTradePlans(upsertTrackedTradePlan(planWithUpdatedAt));
    if (isServerPersistenceEnabled) {
      upsertTrackedTradePlanMutation.mutate({ plan: planWithUpdatedAt });
    }
  };

  useEffect(() => {
    trackedTradePlans.forEach((plan) => {
      const outcomeRead = getTradePlanOutcomeRead(data, plan);
      if (!outcomeRead || outcomeRead.status === plan.status) return;
      persistTrackedTradePlan({
        ...plan,
        status: outcomeRead.status,
        summary: outcomeRead.status === 'acted'
          ? `${plan.summary} Outcome: a completed trade with this manager is now in the ledger.`
          : outcomeRead.status === 'blocked'
            ? `${plan.summary} Outcome: a non-complete trade signal is now in the ledger.`
            : `${plan.summary} Outcome: no matching completed or blocked trade signal appeared within 14 days.`,
        payload: {
          ...plan.payload,
          outcomeStatus: outcomeRead.status,
          outcomeSource: outcomeRead.source,
          outcomeEvidenceSummary: outcomeRead.evidenceSummary,
          outcomeCheckedAt: Date.now(),
        },
      });
    });
  }, [data, trackedTradePlans, isServerPersistenceEnabled]);
  const tradeOutcomeLearning = buildTradeOutcomeLearning(visibleTrackedTradePlans);

  const trackTradePlan = (recommendation: ReturnType<typeof buildTradePartners>[number]) => {
    const plan: ActionPlanRecord = {
      id: getTradePlanId(leagueId, manager, recommendation.manager, recommendation.theyOffer),
      kind: 'trade',
      leagueId,
      manager,
      playerId: recommendation.theyOffer?.player_id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      title: `Trade read: ${recommendation.manager}`,
      summary: recommendation.aiRead,
      status: 'tracked',
      payload: {
        sourceManager: manager,
        targetManager: recommendation.manager,
        targetPlayerId: recommendation.theyOffer?.player_id || null,
        targetPlayerName: recommendation.theyOffer?.name || null,
        confidence: recommendation.confidence,
        resistanceNote: recommendation.resistanceRead.note,
      },
    };
    persistTrackedTradePlan(plan);
  };

  if (!managerOptions.length) {
    return <EmptyState className="command-module-empty" title="No managers found for trade partner matching" />;
  }

  return (
    <div className="trade-partner-finder">
      <div className="command-module-toolbar">
        <CommandModuleFocus
          label="Your team"
          manager={manager}
          avatarUrl={managerAvatars?.[manager]}
        />
      </div>
      {visibleTrackedTradePlans.length > 0 && (
        <div className="trade-outcome-strip" aria-label="Tracked trade recommendation outcomes">
          <span>Tracked trade reads</span>
          <em className="trade-outcome-sync-state">
            {isServerPersistenceEnabled ? 'Synced' : 'Local fallback'}
          </em>
          {visibleTrackedTradePlans.slice(0, 4).map((plan) => (
            <small key={plan.id} className={`trade-outcome-pill trade-outcome-pill-${plan.status}`}>
              <strong>{String(plan.payload?.targetManager || plan.title)}</strong>
              <em>{plan.status}</em>
            </small>
          ))}
        </div>
      )}
      {tradeOutcomeLearning && (
        <div className="trade-outcome-learning">
          <span>Outcome learning</span>
          <strong>
            {tradeOutcomeLearning.actedRate === null
              ? 'Learning'
              : `${tradeOutcomeLearning.actedRate}% acted`}
          </strong>
          <p>{tradeOutcomeLearning.strongestPattern}</p>
          <small>
            {tradeOutcomeLearning.acted} acted / {tradeOutcomeLearning.blocked} blocked / {tradeOutcomeLearning.stale} stale / {tradeOutcomeLearning.open} still tracked
          </small>
        </div>
      )}
      <div className="trade-partner-grid balanced-tile-grid" style={getBalancedGridStyle(recommendations.length)}>
        {recommendations.map((recommendation) => (
          <article key={recommendation.manager} className="trade-partner-card">
            <div className="trade-partner-card-head">
              <ManagerNameWithAvatar avatarUrl={managerAvatars?.[recommendation.manager]} managerName={recommendation.manager} />
              <span>{recommendation.label}</span>
            </div>
            <div className="trade-partner-angle-grid">
              <MetricPill label="They need" value={recommendation.need || '-'} tone={recommendation.need ? 'warn' : 'neutral'} />
              <MetricPill label="They have" value={recommendation.surplus || '-'} tone={recommendation.surplus ? 'info' : 'neutral'} />
              <MetricPill label="You offer" value={getPlayerLabel(recommendation.youOffer)} tone={recommendation.youOffer ? 'good' : 'neutral'} />
              <MetricPill label="Ask about" value={getPlayerLabel(recommendation.theyOffer)} tone={recommendation.theyOffer ? 'warn' : 'neutral'} />
            </div>
            <AIReadPanel
              compact
              title={`${recommendation.manager} trade read`}
              readType="Trade Window"
              confidence={recommendation.confidence}
              severity={recommendation.confidence >= 75 ? 'good' : recommendation.confidence <= 55 ? 'warn' : 'info'}
              chips={[recommendation.label, recommendation.need ? `${recommendation.need} need` : 'No clear need', recommendation.resistanceRead.chip].filter(Boolean) as AIReadChip[]}
              body={recommendation.aiRead}
              traceItems={[
                recommendation.need ? `${recommendation.manager} returned a ${recommendation.need} need.` : `${recommendation.manager} did not return a clean positional need.`,
                recommendation.surplus ? `${recommendation.manager} has ${recommendation.surplus} surplus to ask about.` : 'No surplus position was returned for the target manager.',
                recommendation.youOffer ? `Your matching offer lane starts with ${recommendation.youOffer.name}.` : 'No clean outgoing fit was returned.',
                `Resistance note: ${recommendation.resistanceRead.note || recommendation.resistanceRead.chip}.`,
              ]}
              actions={[{ label: 'Track trade read', onClick: () => trackTradePlan(recommendation) }]}
              backgroundVariant="trade"
            />
          </article>
        ))}
      </div>
    </div>
  );
}

export function TradeFinderGenerator({
  data,
}: {
  data: ReportData;
}) {
  const managerOptions = getManagerOptions(data);
  const managerOptionsKey = managerOptions.join('|');
  const sourceManager = getFocusedManager(data, managerOptions);
  const fallbackTargetManager = managerOptions.find((manager) => manager !== sourceManager) || managerOptions[0] || '';
  const [targetManager, setTargetManager] = useState(fallbackTargetManager);
  const [mode, setMode] = useState('Value neutral');
  const sourceIntel = getIntel(data, sourceManager);
  const targetIntel = getIntel(data, targetManager);
  const sourcePlayers = getManagerPlayerPool(sourceIntel);
  const targetPlayers = getManagerPlayerPool(targetIntel);
  const [awayPlayerId, setAwayPlayerId] = useState('');
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const selectedAway = sourcePlayers.find((player) => player.player_id === awayPlayerId) || sourceIntel?.sellCandidate || sourceIntel?.tradeChip || sourcePlayers[0] || null;
  const selectedTarget = targetPlayers.find((player) => player.player_id === targetPlayerId) || targetIntel?.sellCandidate || targetIntel?.tradeChip || targetPlayers[0] || null;
  const sourceCounts = data.managerPositionCounts?.find((row) => row.manager === sourceManager) || null;
  const qbDepthWarning = Boolean(
    selectedAway?.pos === 'QB'
    && isSuperflexLeague(data)
    && sourceCounts
    && sourceCounts.QB <= Math.max(2, sourceCounts.QB_starters || 2)
  );
  const awayValue = getTradePlayerValue(selectedAway, data);
  const targetValue = getTradePlayerValue(selectedTarget, data);
  const gap = targetValue - awayValue;
  const targetResistance = getTradeResistanceRead(data, targetManager, selectedTarget);
  const secondaryGive = sourcePlayers.find((player) => player.player_id !== selectedAway?.player_id && player.pos === sourceIntel?.tradePlan?.surplusPosition) || null;
  const secondaryAsk = targetPlayers.find((player) => player.player_id !== selectedTarget?.player_id && player.pos === targetIntel?.tradePlan?.surplusPosition) || null;
  const secondaryGiveValue = getTradePlayerValue(secondaryGive, data);
  const secondaryAskValue = getTradePlayerValue(secondaryAsk, data);
  const packages = selectedAway && selectedTarget && !qbDepthWarning ? [
    {
      label: 'Straight Value Check',
      give: [selectedAway],
      receive: [selectedTarget],
      gap,
      confidence: applyTradeResistance(Math.max(42, 88 - Math.round(Math.abs(gap) / 125)), targetResistance),
      note: Math.abs(gap) <= 500
        ? 'Raw value is close enough to start the conversation, then roster fit decides the rest.'
        : gap > 0
          ? 'You need a sweetener or a cheaper target because the ask is above the outgoing value.'
          : 'You are giving the stronger raw asset; ask for a small add or future flexibility.',
    },
    secondaryGive ? {
      label: 'Position Fix Package',
      give: [selectedAway, secondaryGive],
      receive: [selectedTarget],
      gap: targetValue - awayValue - secondaryGiveValue,
      confidence: applyTradeResistance(Math.max(38, 82 - Math.round(Math.abs(targetValue - awayValue - secondaryGiveValue) / 150)), targetResistance),
      note: `${secondaryGive.name} turns this into a ${sourceIntel?.tradePlan?.surplusPosition || 'depth'} consolidation package instead of a one-for-one value poke.`,
    } : null,
    secondaryAsk ? {
      label: 'Ask-Back Package',
      give: [selectedAway],
      receive: [selectedTarget, secondaryAsk],
      gap: targetValue + secondaryAskValue - awayValue,
      confidence: applyTradeResistance(Math.max(34, 78 - Math.round(Math.abs(targetValue + secondaryAskValue - awayValue) / 175)), targetResistance),
      note: `${secondaryAsk.name} is the add-back if ${targetManager} wants the cleaner headline asset.`,
    } : null,
  ].filter(Boolean) as Array<{ label: string; give: ManagerIntelPlayer[]; receive: ManagerIntelPlayer[]; gap: number; confidence: number; note: string }> : [];

  useEffect(() => {
    setTargetManager((current) => (
      current && current !== sourceManager && managerOptions.includes(current)
        ? current
        : fallbackTargetManager
    ));
    setAwayPlayerId('');
    setTargetPlayerId('');
  }, [fallbackTargetManager, managerOptionsKey, sourceManager]);

  if (managerOptions.length < 2) {
    return <EmptyState className="command-module-empty" title="Trade finder needs at least two managers" />;
  }

  return (
    <div className="trade-finder-generator">
      <div className="command-module-toolbar command-module-toolbar-wide">
        <CommandModuleFocus label="Your team" manager={sourceManager} />
        <label>
          <span>Target team</span>
          <select value={targetManager} onChange={(event) => {
            setTargetManager(event.target.value);
            setTargetPlayerId('');
          }}>
            {managerOptions.filter((manager) => manager !== sourceManager).map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label>
          <span>Trade away</span>
          <select value={selectedAway?.player_id || ''} onChange={(event) => setAwayPlayerId(event.target.value)}>
            {sourcePlayers.map((player) => <option key={player.player_id || player.name} value={player.player_id}>{player.name} ({player.pos})</option>)}
          </select>
        </label>
        <label>
          <span>Target asset</span>
          <select value={selectedTarget?.player_id || ''} onChange={(event) => setTargetPlayerId(event.target.value)}>
            {targetPlayers.map((player) => <option key={player.player_id || player.name} value={player.player_id}>{player.name} ({player.pos})</option>)}
          </select>
        </label>
        <label>
          <span>Mode</span>
          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            {['Contender', 'Rebuilder', 'Value neutral', 'Win-now', 'Youth movement', 'Position fix', 'Tier-up', 'Depth sale'].map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      <AIReadPanel
        title="Fair trade finder"
        readType="Trade Window"
        confidence={qbDepthWarning ? 40 : packages[0]?.confidence || 58}
        severity={qbDepthWarning ? 'warn' : packages.length ? 'info' : 'warn'}
        chips={[
          mode,
          selectedAway ? `Give ${selectedAway.name}` : { label: 'No outgoing asset', tone: 'warn' },
          selectedTarget ? `Ask ${selectedTarget.name}` : { label: 'No target asset', tone: 'warn' },
          targetResistance.chip,
        ].filter(Boolean) as AIReadChip[]}
        body={qbDepthWarning
          ? `Do not move ${selectedAway?.name} in this Superflex build unless another QB is coming back. The roster does not have enough QB depth for raw value math to be useful.`
          : packages.length
            ? `The cleanest starting point is ${packages[0].label.toLowerCase()} with a value gap of ${gap >= 0 ? '+' : ''}${formatCompactValue(gap)} from your side. Roster fit still matters more than calculator symmetry.${targetResistance.note ? ` ${targetResistance.note}` : ''}`
            : 'Returned roster data does not contain enough tradeable player detail to generate a responsible package.'}
        traceItems={[
          selectedAway ? `Outgoing asset: ${selectedAway.name} at ${formatCompactValue(awayValue)} value.` : 'No outgoing asset was returned.',
          selectedTarget ? `Target asset: ${selectedTarget.name} at ${formatCompactValue(targetValue)} value.` : 'No target asset was returned.',
          `Raw value gap: ${gap >= 0 ? '+' : ''}${formatCompactValue(gap)} from your side.`,
          `Target resistance: ${targetResistance.note || targetResistance.chip}.`,
        ]}
        backgroundVariant="trade"
      />

      {packages.length ? (
        <div className="trade-finder-package-grid">
          {packages.map((tradePackage) => (
            <article key={tradePackage.label} className="trade-finder-package-card">
              <div>
                <span>{tradePackage.label}</span>
                <strong>{tradePackage.gap >= 0 ? '+' : ''}{formatCompactValue(tradePackage.gap)} gap</strong>
              </div>
              <div className="trade-finder-package-sides">
                <p><strong>Give</strong>{tradePackage.give.map((player) => `${player.name} (${player.pos})`).join(' + ')}</p>
                <p><strong>Get</strong>{tradePackage.receive.map((player) => `${player.name} (${player.pos})`).join(' + ')}</p>
              </div>
              <MetricPill label="Confidence" value={`${tradePackage.confidence}%`} tone={tradePackage.confidence >= 70 ? 'good' : tradePackage.confidence <= 50 ? 'warn' : 'info'} />
              <p>{tradePackage.note}</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildLeagueExploits(data: ReportData) {
  const exploits: Array<{
    id: string;
    exploit: string;
    manager: string;
    suggestedMove: string;
    why: string;
    risk: string;
    tone: 'good' | 'info' | 'warn' | 'danger';
  }> = [];

  data.positionDepth?.forEach((row) => {
    if (!POSITIONS.includes(row.position as Position)) return;
    if (row.status === 'shortage') {
      exploits.push({
        id: `shortage-${row.manager}-${row.position}`,
        exploit: `${row.position} shortage`,
        manager: row.manager,
        suggestedMove: `Shop ${row.position} depth or build a two-for-one offer`,
        why: `${row.manager} is below the league depth baseline at ${row.position}.`,
        risk: 'Need-based teams can still reject if the incoming player is a worse lineup fit.',
        tone: 'warn',
      });
    } else {
      exploits.push({
        id: `excess-${row.manager}-${row.position}`,
        exploit: `${row.position} hoard`,
        manager: row.manager,
        suggestedMove: `Ask about their spare ${row.position} before the rest of the league notices`,
        why: `${row.manager} has above-baseline ${row.position} depth.`,
        risk: 'Surplus does not mean cheap; check their own roster needs before sending value-flat spam.',
        tone: 'info',
      });
    }
  });

  data.pickPortfolios?.forEach((row) => {
    const pickCount = row.count2026 + row.count2027;
    if (pickCount <= 2 || row.totalValue <= 1200) {
      exploits.push({
        id: `pick-poor-${row.manager}`,
        exploit: 'No pick runway',
        manager: row.manager,
        suggestedMove: 'Offer flexible draft capital in packages where they need optionality',
        why: `${row.manager} has a thin 2026/2027 pick portfolio.`,
        risk: 'If they are a true contender, picks may not be the hook.',
        tone: 'good',
      });
    } else if (pickCount >= 7 || row.totalValue >= 5000) {
      exploits.push({
        id: `pick-rich-${row.manager}`,
        exploit: 'Pick-rich manager',
        manager: row.manager,
        suggestedMove: 'Float insulated veterans or young starters for future picks',
        why: `${row.manager} has ${pickCount} tracked 2026/2027 picks worth ${formatCompactValue(row.totalValue)}.`,
        risk: 'Pick-rich rebuilders are often patient; do not anchor with depreciating assets only.',
        tone: 'info',
      });
    }
  });

  data.managerRosterIntelligence?.forEach((row) => {
    if ((row.ageFlags || []).some((flag) => /old|aging|risk/i.test(flag))) {
      exploits.push({
        id: `aging-${row.manager}`,
        exploit: 'Aging core',
        manager: row.manager,
        suggestedMove: 'Sell stability now or buy their younger bench pieces before a rebuild pivot',
        why: row.ageFlags.slice(0, 2).join(' · ') || `${row.manager} has age pressure.`,
        risk: 'Veteran-heavy contenders may value points more than age-adjusted market value.',
        tone: 'warn',
      });
    }
    if (row.timeline?.toLowerCase().includes('rebuild') || row.identity?.toLowerCase().includes('rebuild')) {
      exploits.push({
        id: `rebuild-${row.manager}`,
        exploit: 'Likely rebuild lane',
        manager: row.manager,
        suggestedMove: 'Buy productive veterans or sell picks/rookies only if the value premium is real',
        why: row.summary,
        risk: 'Rebuilders usually demand youth or picks, not bench clutter.',
        tone: 'info',
      });
    }
  });

  return exploits.slice(0, 12);
}

export function LeagueExploits({
  data,
  managerAvatars,
}: {
  data: ReportData;
  managerAvatars?: ManagerAvatars;
}) {
  const exploits = buildLeagueExploits(data);
  if (!exploits.length) {
    return (
      <EmptyState
        className="command-module-empty"
        title="No clean league exploits returned"
        description="The report did not return enough position, pick, or roster-window outliers to produce a useful exploit list."
      />
    );
  }

  return (
    <div className="league-exploit-grid balanced-tile-grid" style={getBalancedGridStyle(exploits.length)}>
      {exploits.map((exploit) => (
        <article key={exploit.id} className={`league-exploit-card league-exploit-card-${exploit.tone}`}>
          <div className="league-exploit-head">
            <span>{exploit.exploit}</span>
            <ManagerNameWithAvatar avatarUrl={managerAvatars?.[exploit.manager]} managerName={exploit.manager} />
          </div>
          <p>{exploit.suggestedMove}</p>
          <div className="league-exploit-detail">
            <span><strong>Why it works</strong>{exploit.why}</span>
            <span><strong>Risk</strong>{exploit.risk}</span>
          </div>
          <AIReadPanel
            compact
            title={`${exploit.manager} exploit read`}
            readType="League Exploit"
            confidence={getManagerReadConfidence(data, exploit.manager)}
            severity={exploit.tone}
            chips={[exploit.exploit, exploit.manager]}
            body={`${exploit.suggestedMove}. ${exploit.why}`}
            traceItems={[
              `Exploit owner: ${exploit.exploit}.`,
              `Manager signal: ${exploit.manager}.`,
              `Why: ${exploit.why}`,
              `Risk check: ${exploit.risk}`,
            ]}
            backgroundVariant="league"
          />
        </article>
      ))}
    </div>
  );
}

export function RankingsMarketRead({
  data,
}: {
  data: ReportData;
}) {
  const defaultProfileKey = isRedraftReportData(data)
    ? data.rankings?.defaultRedraftProfileKey || data.rankings?.defaultProfileKey
    : data.rankings?.defaultProfileKey;
  const rows = defaultProfileKey ? data.rankings?.profiles?.[defaultProfileKey] || [] : [];
  const availableRowCount = getRankingProfileRowCount(data, defaultProfileKey);
  const topRiser = [...rows].filter((row) => !row.isPick && !row.isDevy).sort((a, b) => (b.movement || 0) - (a.movement || 0))[0];
  const topFaller = [...rows].filter((row) => !row.isPick && !row.isDevy).sort((a, b) => (a.movement || 0) - (b.movement || 0))[0];
  const ownedCount = rows.filter((row) => row.owner).length;
  const confidence = getRankingsConfidence(data, availableRowCount);
  const evidenceRead = buildRankingsEvidenceRead(data, rows, confidence, availableRowCount);

  if (!evidenceRead.shouldRender) return null;

  return (
    <AIReadPanel
      title="Ranking board market signal"
      subtitle="This board uses league-matched values and source metadata when returned by the rankings endpoint."
      readType="Market Signal"
      confidence={evidenceRead.finalScore}
      confidenceNote={evidenceRead.confidenceCapReason ? `Confidence capped by ${evidenceRead.confidenceCapReason}.` : evidenceRead.whyThisFired}
      severity={evidenceRead.label === 'thin' ? 'warn' : evidenceRead.finalScore >= 70 ? 'info' : 'warn'}
      chips={[
        getEvidenceChip(evidenceRead),
        `${availableRowCount} assets`,
        rows.length ? `${ownedCount} rostered` : { label: 'On-demand rows', tone: 'info' },
        topRiser ? `Top riser: ${topRiser.name}` : { label: 'No riser data', tone: 'warn' },
      ]}
      body={rows.length
        ? `${topRiser ? `${topRiser.name} is the cleanest watchlist riser on the board.` : 'No ranking riser is available from this payload.'} ${topFaller ? `${topFaller.name} is the biggest discount-window check, but roster context still matters before buying.` : ''}`
        : availableRowCount
          ? `${availableRowCount.toLocaleString()} league-matched assets are indexed. Open a board row for player-specific detail.`
          : 'Rankings were not returned yet, so the market read is intentionally limited.'}
      traceItems={getAIEvidenceReceiptItems(evidenceRead)}
      backgroundVariant="market"
      className="rankings-ai-read"
    />
  );
}

export function TradeBrowserRead({
  data,
}: {
  data: ReportData;
}) {
  const trades = data.tradeHistory || [];
  const biggestGap = [...trades].sort((a, b) => Math.abs(b.point_gap || 0) - Math.abs(a.point_gap || 0))[0];
  const mostActive = [...(data.tradeTendencies || [])].sort((a, b) => b.tradeCount - a.tradeCount)[0];
  const bestProfit = [...(data.tradeProfitLeaderboard || [])].sort((a, b) => b.profit - a.profit)[0];
  const confidence = getTradeHistoryConfidence(data);
  const evidenceRead = buildTradeBrowserEvidenceRead(data, confidence);

  if (!evidenceRead.shouldRender) return null;

  return (
    <AIReadPanel
      title="Trade browser read"
      subtitle="Searchable trade ledger foundation with value-gap context, manager tendency signals, and roster-window reads."
      readType="Trade Window"
      confidence={evidenceRead.finalScore}
      confidenceNote={evidenceRead.confidenceCapReason ? `Confidence capped by ${evidenceRead.confidenceCapReason}.` : evidenceRead.whyThisFired}
      severity={evidenceRead.label === 'thin' ? 'warn' : evidenceRead.finalScore >= 68 ? 'info' : 'warn'}
      chips={[
        getEvidenceChip(evidenceRead),
        `${trades.length} trades`,
        mostActive ? `Most active: ${mostActive.manager}` : { label: 'No tendencies', tone: 'warn' },
        biggestGap ? `Largest gap ${formatCompactValue(Math.abs(biggestGap.point_gap || 0))}` : 'No gaps',
      ]}
      body={trades.length
        ? `${bestProfit ? `${bestProfit.manager} has the strongest trade-profit signal.` : 'No trade-profit leader was returned.'} ${biggestGap ? `The largest gap is ${biggestGap.team_a} / ${biggestGap.team_b} on ${biggestGap.date}; open the ledger row for side-by-side context.` : ''}`
        : 'No completed trades were returned. The browser shows an empty state instead of manufacturing trade history.'}
      traceItems={getAIEvidenceReceiptItems(evidenceRead)}
      backgroundVariant="trade"
      className="trade-browser-ai-read"
    />
  );
}

type AssistantTone = 'good' | 'info' | 'warn' | 'danger' | 'neutral';
type AssistantActionQueueRow = {
  id: string;
  lane: string;
  action: string;
  detail: string;
  priority: number;
  tone: AssistantTone;
};

function getStarterValue(player: ManagerStarterPlayer | ManagerIntelPlayer | TrendingPlayer | null | undefined): number {
  if (!player) return 0;
  return Math.round(
    ('seasonValue' in player ? player.seasonValue || 0 : 0)
    || ('value' in player ? player.value || 0 : 0)
    || ('ktcValue' in player ? player.ktcValue || 0 : 0)
  );
}

function getPlayerDetailsValue(details?: PlayerDetails | null): number {
  const profile = details?.valueProfile;
  return Math.round(
    profile?.dynastyValue
    || profile?.seasonValue
    || profile?.balancedValue
    || profile?.marketKtc
    || 0
  );
}

function getManagerPlayerIds(data: ReportData, manager: string): Set<string> {
  const intel = getIntel(data, manager);
  const counts = data.managerPositionCounts?.find((row) => row.manager === manager);
  return new Set([
    ...getManagerPlayerPool(intel).map((player) => player.player_id),
    ...((counts?.rosterPlayers || counts?.lineupPlayers || []) as ManagerStarterPlayer[]).map((player) => player.player_id),
  ].filter(Boolean));
}

function getRankingRows(data: ReportData): RankingPlayer[] {
  const profiles = data.rankings?.profiles || {};
  const defaultRows = data.rankings?.defaultProfileKey ? profiles[data.rankings.defaultProfileKey] || [] : [];
  if (defaultRows.length) return defaultRows;
  return Object.values(profiles).flat();
}

function getMarketSignalLabel(input: {
  direction: 'up' | 'down';
  pctChange: number;
  owner?: string | null;
  selectedManager: string;
  value: number;
}): { label: string; tone: AssistantTone } {
  if (input.direction === 'up') {
    if (input.owner === input.selectedManager && input.pctChange >= 12) return { label: 'Peak Value Warning', tone: 'warn' };
    if (input.pctChange >= 18) return { label: 'Hard Buy', tone: 'good' };
    return { label: 'Soft Buy', tone: 'info' };
  }
  if (input.value >= 3500 && input.pctChange <= -8) return { label: 'Discount Window', tone: 'good' };
  if (input.pctChange <= -18) return { label: 'Panic Avoid', tone: 'danger' };
  return { label: 'Soft Sell', tone: 'warn' };
}

function buildWatchSignals(data: ReportData, selectedManager: string) {
  const selectedIds = getManagerPlayerIds(data, selectedManager);
  const weeklySignals = [
    ...(data.weeklyRisers || []).map((row) => ({ row, direction: 'up' as const })),
    ...(data.weeklyFallers || []).map((row) => ({ row, direction: 'down' as const })),
  ];
  const rosterSignals = weeklySignals.filter(({ row }) => row.owner === selectedManager || (row.player_id && selectedIds.has(row.player_id)));
  const source = rosterSignals.length ? rosterSignals : weeklySignals;

  return source
    .map(({ row, direction }) => {
      const value = Math.round(row.val_now || getPlayerDetailsValue(row.playerDetails));
      const pctChange = Number(row.pct_change || 0);
      const signal = getMarketSignalLabel({ direction, pctChange, owner: row.owner, selectedManager, value });
      return {
        id: row.player_id || `${row.name}-${direction}`,
        name: row.name,
        position: row.pos,
        team: row.playerDetails?.team || null,
        playerId: row.player_id,
        owner: row.owner,
        value,
        movement: row.diff,
        pctChange,
        label: signal.label,
        tone: signal.tone,
      };
    })
    .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange) || Math.abs(b.movement) - Math.abs(a.movement))
    .slice(0, 6);
}

function getDraftCapitalScore(pick: DraftPick): number {
  if (!pick.round) return 44;
  const pickNumber = pick.pick || 99;
  if (pick.round === 1) return clamp(92 - Math.max(0, pickNumber - 1) * 2, 72, 94);
  if (pick.round === 2) return clamp(70 - Math.max(0, pickNumber - 13), 54, 72);
  if (pick.round === 3) return clamp(52 - Math.max(0, pickNumber - 25), 38, 54);
  return 34;
}

function buildRookieSignals(data: ReportData) {
  const draftSignals = (data.draftPicks || [])
    .filter((pick) => pick.playerName && !/pick/i.test(pick.playerName))
    .map((pick) => {
      const currentValue = Math.round(pick.currentKtcValue || pick.ktcValue || getPlayerDetailsValue(pick.playerDetails));
      const valueGain = Math.round(pick.valueGain ?? ((pick.currentKtcValue || 0) - (pick.ktcValue || 0)));
      const prospectRank = pick.playerDetails?.prospectProfile?.overallRank || null;
      const prospectBoost = prospectRank ? clamp(18 - Math.floor(prospectRank / 12), 0, 18) : 0;
      const valueScore = clamp(Math.round(currentValue / 115), 0, 34);
      const gainScore = clamp(Math.round(valueGain / 85), -12, 18);
      const score = clamp(getDraftCapitalScore(pick) + valueScore + gainScore + prospectBoost - 28, 1, 99);
      return {
        id: pick.player_id || `${pick.manager}-${pick.round}-${pick.pick}-${pick.playerName}`,
        name: pick.playerName,
        position: pick.playerPos,
        playerId: pick.player_id,
        team: pick.playerDetails?.team || null,
        manager: pick.manager,
        score,
        signal: valueGain > 450 ? 'Rookie Heat' : score >= 76 ? 'Draft Capital Signal' : valueGain < -450 ? 'Cooling Asset' : 'Hold Signal',
        context: `${pick.round}.${String(pick.pick || 0).padStart(2, '0')} pick${currentValue ? ` · ${formatCompactValue(currentValue)} current value` : ''}${Number.isFinite(valueGain) ? ` · ${valueGain >= 0 ? '+' : ''}${formatCompactValue(valueGain)} since draft` : ''}`,
      };
    });

  const prospectSignals = getRankingRows(data)
    .filter((row) => row.isDevy || row.prospectProfile)
    .slice(0, 6)
    .map((row) => ({
      id: row.player_id || row.id,
      name: row.name,
      position: row.pos,
      playerId: row.player_id,
      team: row.team || null,
      manager: row.owner || 'Unrostered',
      score: clamp(Math.round(92 - (row.overallRank || 60) / 2 + (row.value || 0) / 160), 1, 99),
      signal: row.projectedRookiePick || 'Prospect Signal',
      context: `${row.positionRank || `Rank #${row.overallRank}`}${row.prospectProfile?.source ? ` · ${row.prospectProfile.source}` : ''}`,
    }));

  return (draftSignals.length ? draftSignals : prospectSignals)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function buildNewsRows(data: ReportData, selectedManager: string) {
  const selectedIds = getManagerPlayerIds(data, selectedManager);
  const rosterNews = getManagerPlayerPool(getIntel(data, selectedManager))
    .filter((player) => player.playerDetails?.latestNews || player.playerDetails?.injuryStatus)
    .map((player) => ({
      id: player.player_id,
      name: player.name,
      position: player.pos,
      team: player.playerDetails?.team || null,
      title: player.playerDetails?.latestNews?.title || player.playerDetails?.injuryStatus || 'Roster status flag',
      source: player.playerDetails?.latestNews?.source || player.playerDetails?.displayStatus || player.playerDetails?.status || 'Sleeper',
      publishedAt: player.playerDetails?.latestNews?.publishedAt || null,
      isRostered: true,
    }));

  const globalNews = Object.entries(data.playerDetailsById || {})
    .filter(([playerId, details]) => details.latestNews && !selectedIds.has(playerId))
    .map(([playerId, details]) => ({
      id: playerId,
      name: details.fullName || playerId,
      position: details.position || '-',
      team: details.team || null,
      title: details.latestNews?.title || 'News flag',
      source: details.latestNews?.source || 'FantasyPros',
      publishedAt: details.latestNews?.publishedAt || null,
      isRostered: false,
    }));

  return [...rosterNews, ...globalNews].slice(0, 6);
}

function buildOwnerActionQueue({
  data,
  manager,
  watchSignals,
  rookieSignals,
  benchPressure,
  bestWaiver,
  intel,
  portfolio,
}: {
  data: ReportData;
  manager: string;
  watchSignals: ReturnType<typeof buildWatchSignals>;
  rookieSignals: ReturnType<typeof buildRookieSignals>;
  benchPressure: ManagerStarterPlayer[];
  bestWaiver: TrendingPlayer | null;
  intel: ManagerIntelRow | null;
  portfolio: ReturnType<typeof buildPortfolioExposure>;
}): AssistantActionQueueRow[] {
  const rows: AssistantActionQueueRow[] = [];
  const addRow = (row: AssistantActionQueueRow | null) => {
    if (!row || rows.some(item => item.id === row.id)) return;
    rows.push(row);
  };
  const topPartner = buildTradePartners(data, manager)[0];
  const topWatch = watchSignals[0] || null;
  const topRookie = rookieSignals.find(row => row.manager === manager) || rookieSignals[0] || null;
  const dropCandidate = intel?.droppablePlayers?.[0] || null;
  const tradeNeed = getNeedPosition(data, manager);

  addRow(benchPressure[0]
    ? {
        id: `lineup-${benchPressure[0].player_id}`,
        lane: 'Lineup',
        action: `Review ${benchPressure[0].name}`,
        detail: `${benchPressure[0].name} is the highest returned bench-pressure player against the submitted/projected starter map.`,
        priority: 90,
        tone: 'warn',
      }
    : null);
  addRow(bestWaiver
    ? {
        id: `waiver-${bestWaiver.player_id}`,
        lane: 'Waiver',
        action: `Check ${bestWaiver.name}`,
        detail: dropCandidate
          ? `${bestWaiver.name} is the best available signal here; ${dropCandidate.name} is the first returned low-friction drop candidate.`
          : `${bestWaiver.name} is the best available signal here; no automatic drop candidate was returned.`,
        priority: 84,
        tone: 'good',
      }
    : null);
  addRow(topPartner
    ? {
        id: `trade-${topPartner.manager}`,
        lane: 'Trade',
        action: `Open with ${topPartner.manager}`,
        detail: `${topPartner.label}: ${topPartner.angle}. ${topPartner.resistanceRead?.note || 'Use the trade war room for exact player and pick math.'}`,
        priority: topPartner.confidence,
        tone: topPartner.confidence >= 70 ? 'good' : topPartner.confidence >= 48 ? 'info' : 'warn',
      }
    : null);
  addRow(topWatch
    ? {
        id: `watch-${topWatch.id}`,
        lane: 'Market',
        action: `${topWatch.label}: ${topWatch.name}`,
        detail: `${topWatch.name} moved ${topWatch.pctChange >= 0 ? '+' : ''}${topWatch.pctChange.toFixed(1)}%; decide whether this is a buy window, sell window, or watch-only move.`,
        priority: Math.min(86, 58 + Math.abs(topWatch.pctChange)),
        tone: topWatch.tone,
      }
    : null);
  addRow(topRookie
    ? {
        id: `rookie-${topRookie.id}`,
        lane: 'Draft',
        action: `${topRookie.signal}: ${topRookie.name}`,
        detail: `${topRookie.context}. Draft capital and value movement are the only prospect inputs used here.`,
        priority: topRookie.score,
        tone: topRookie.score >= 76 ? 'good' : topRookie.score <= 42 ? 'warn' : 'info',
      }
    : null);
  addRow((portfolio.topThreeShare || 0) >= 55
    ? {
        id: 'portfolio-concentration',
        lane: 'Portfolio',
        action: 'Reduce top-heavy exposure',
        detail: `Top three assets carry ${formatPercent(portfolio.topThreeShare)} of this roster value; avoid adding more fragility unless it directly solves ${tradeNeed || 'a starting-slot need'}.`,
        priority: Math.round(portfolio.topThreeShare || 0),
        tone: 'warn',
      }
    : null);

  return rows.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

function buildPortfolioExposure(data: ReportData, selectedManager: string) {
  const players = getManagerPlayerPool(getIntel(data, selectedManager));
  const positionRows = POSITIONS.map((position) => {
    const positionPlayers = players.filter((player) => player.pos === position);
    const value = positionPlayers.reduce((sum, player) => sum + getTradePlayerValue(player, data), 0);
    return { position, count: positionPlayers.length, value };
  }).sort((a, b) => b.value - a.value);
  const totalValue = positionRows.reduce((sum, row) => sum + row.value, 0);
  const topAssets = [...players].sort((a, b) => getTradePlayerValue(b, data) - getTradePlayerValue(a, data)).slice(0, 5);
  const topThreeValue = topAssets.slice(0, 3).reduce((sum, player) => sum + getTradePlayerValue(player, data), 0);
  const newsRiskCount = players.filter((player) => player.playerDetails?.latestNews || player.playerDetails?.injuryStatus).length;
  return {
    positionRows,
    topAssets,
    totalValue,
    topThreeShare: totalValue ? (topThreeValue / totalValue) * 100 : null,
    newsRiskCount,
  };
}

function buildPortfolioSnapshot(data: ReportData, selectedManager: string, leagueName?: string, leagueId?: string): PortfolioSnapshot | null {
  const players = getManagerPlayerPool(getIntel(data, selectedManager));
  if (!selectedManager || !players.length) return null;
  const portfolio = buildPortfolioExposure(data, selectedManager);
  const leagueKey = leagueId || leagueName || data.leagueDiagnostics?.scoringSummary || 'current-league';
  return {
    id: `${leagueKey}:${selectedManager}`,
    leagueKey,
    leagueName: leagueName || 'Sleeper League',
    manager: selectedManager,
    savedAt: Date.now(),
    totalValue: portfolio.totalValue,
    playerCount: players.length,
    topThreeShare: portfolio.topThreeShare,
    positionRows: portfolio.positionRows,
    players: players.map((player) => ({
      playerId: player.player_id || `${player.name}-${player.pos}`,
      name: player.name,
      position: player.pos,
      team: player.playerDetails?.team || null,
      value: getTradePlayerValue(player, data),
    })),
  };
}

function upsertPortfolioSnapshot(snapshots: PortfolioSnapshot[], snapshot: PortfolioSnapshot): PortfolioSnapshot[] {
  return [
    snapshot,
    ...snapshots.filter((item) => item.id !== snapshot.id),
  ].slice(0, 30);
}

function buildSavedPortfolioSummary(snapshots: PortfolioSnapshot[]) {
  const exposure = new Map<string, {
    playerId: string;
    name: string;
    position?: string | null;
    team?: string | null;
    value: number;
    count: number;
    leagues: Set<string>;
  }>();

  snapshots.forEach((snapshot) => {
    snapshot.players.forEach((player) => {
      const key = player.playerId || `${player.name}-${player.position || ''}`;
      const existing = exposure.get(key) || {
        playerId: player.playerId,
        name: player.name,
        position: player.position,
        team: player.team,
        value: 0,
        count: 0,
        leagues: new Set<string>(),
      };
      existing.value += player.value || 0;
      existing.count += 1;
      existing.leagues.add(snapshot.leagueName);
      exposure.set(key, existing);
    });
  });

  const overexposedPlayers = Array.from(exposure.values())
    .filter((player) => player.count > 1)
    .sort((a, b) => b.count - a.count || b.value - a.value)
    .slice(0, 5)
    .map((player) => ({
      ...player,
      leagueCount: player.leagues.size,
      leagueNames: Array.from(player.leagues),
    }));

  return {
    leagueCount: new Set(snapshots.map((snapshot) => snapshot.leagueKey)).size,
    snapshotCount: snapshots.length,
    totalValue: snapshots.reduce((sum, snapshot) => sum + snapshot.totalValue, 0),
    overexposedPlayers,
  };
}

function getMatchupPreview(data: ReportData, selectedManager: string) {
  return data.matchupPreviews?.find((preview) => preview.manager === selectedManager) || data.matchupPreviews?.[0] || null;
}

function buildFeatureCoverageRows(data: ReportData, selectedManager: string, options?: {
  hasWatchPreferences?: boolean;
  savedPortfolioLeagueCount?: number;
  matchupPreviewAvailable?: boolean;
}) {
  const selectedIds = getManagerPlayerIds(data, selectedManager);
  const selectedPlayerCount = selectedIds.size;
  const newsCount = Object.values(data.playerDetailsById || {}).filter((details) => details.latestNews || details.injuryStatus).length;
  const prospectCount = getRankingRows(data).filter((row) => row.isDevy || row.prospectProfile).length;
  const hasMatchupPreview = Boolean(options?.matchupPreviewAvailable);
  const hasSleeperStarterMap = Boolean(data.managerPositionCounts?.some((row) => row.starterSource === 'Sleeper'));
  const tradeCalibrationCoverage = buildTradeValueCalibrationCoverage(
    Object.values(data.playerDetailsById || {}).map((details) => ({
      name: details.fullName || details.playerId || 'Unknown player',
      playerDetails: details,
    }))
  );
  const tradeCalibrationSignalCopy = [
    tradeCalibrationCoverage.confirmedRisers ? `${tradeCalibrationCoverage.confirmedRisers} riser${tradeCalibrationCoverage.confirmedRisers === 1 ? '' : 's'}` : null,
    tradeCalibrationCoverage.confirmedFallers ? `${tradeCalibrationCoverage.confirmedFallers} faller${tradeCalibrationCoverage.confirmedFallers === 1 ? '' : 's'}` : null,
    tradeCalibrationCoverage.watchRisers || tradeCalibrationCoverage.watchFallers
      ? `${tradeCalibrationCoverage.watchRisers + tradeCalibrationCoverage.watchFallers} watch`
      : null,
    tradeCalibrationCoverage.lowBaseWatch ? `${tradeCalibrationCoverage.lowBaseWatch} low-base` : null,
  ].filter(Boolean).join(', ');
  const situationDeltas = Object.values(data.playerDetailsById || {})
    .map((details) => details.playerSituationDelta)
    .filter(Boolean);
  const strongSituationReads = situationDeltas.filter((delta) => (delta?.confidence || 0) >= 70 && delta?.primaryLabel !== 'source-limited-route-read');
  const freshSituationReads = situationDeltas.filter((delta) => delta?.freshness?.grade === 'fresh' || delta?.freshness?.grade === 'usable');
  const situationSignalCopy = [
    strongSituationReads.length ? `${strongSituationReads.length} strong` : null,
    freshSituationReads.length ? `${freshSituationReads.length} fresh/usable` : null,
    situationDeltas.filter((delta) => delta?.primaryLabel === 'role-boost' || delta?.primaryLabel === 'vacated-opportunity').length
      ? `${situationDeltas.filter((delta) => delta?.primaryLabel === 'role-boost' || delta?.primaryLabel === 'vacated-opportunity').length} role boost`
      : null,
    situationDeltas.filter((delta) => delta?.primaryLabel === 'role-threat' || delta?.primaryLabel === 'crowded-room' || delta?.primaryLabel === 'opportunity-cliff').length
      ? `${situationDeltas.filter((delta) => delta?.primaryLabel === 'role-threat' || delta?.primaryLabel === 'crowded-room' || delta?.primaryLabel === 'opportunity-cliff').length} risk`
      : null,
  ].filter(Boolean).join(', ');

  return [
    {
      label: 'Owner Action Queue',
      status: selectedPlayerCount || data.waiverIntelligence || data.tradeTendencies?.length ? 'Backed' : 'Missing',
      note: 'Ranks the next owner move from lineup pressure, waivers, trade partners, market movement, draft signals, and exposure risk.',
      tone: selectedPlayerCount || data.waiverIntelligence || data.tradeTendencies?.length ? 'good' : 'warn',
    },
    {
      label: 'Watch Alerts',
      status: (data.weeklyRisers?.length || data.weeklyFallers?.length) ? 'Backed' : 'Missing',
      note: options?.hasWatchPreferences
        ? 'Uses returned weekly movement plus browser-saved alert thresholds and watchlist players.'
        : 'Uses returned weekly riser/faller movement. Save thresholds to turn this into a local alert board.',
      tone: (data.weeklyRisers?.length || data.weeklyFallers?.length) ? 'good' : 'warn',
    },
    {
      label: 'Lineup Optimizer',
      status: hasSleeperStarterMap ? 'Backed' : data.managerPositionCounts?.length ? 'Partial' : 'Missing',
      note: hasSleeperStarterMap
        ? 'Uses submitted Sleeper starters first, then falls back to projected starters only when no starters array is returned.'
        : 'Uses slot-aware projected starters because no submitted Sleeper starters were returned in this report.',
      tone: hasSleeperStarterMap ? 'good' : data.managerPositionCounts?.length ? 'info' : 'warn',
    },
    {
      label: 'Waiver Assistant',
      status: data.waiverIntelligence ? 'Backed' : 'Missing',
      note: 'Uses Sleeper trending, free-agent ownership checks, and returned roster need context.',
      tone: data.waiverIntelligence ? 'good' : 'warn',
    },
    {
      label: 'Portfolio View',
      status: (options?.savedPortfolioLeagueCount || 0) > 1 ? 'Backed' : selectedPlayerCount ? 'Partial' : 'Missing',
      note: (options?.savedPortfolioLeagueCount || 0) > 1
        ? `Uses ${options?.savedPortfolioLeagueCount} browser-saved league snapshots for cross-league exposure.`
        : 'Single-league exposure is real. Load/save more leagues to build player shares.',
      tone: (options?.savedPortfolioLeagueCount || 0) > 1 ? 'good' : selectedPlayerCount ? 'info' : 'warn',
    },
    {
      label: 'Rookie Signal',
      status: (data.draftPicks?.length || prospectCount) ? 'Backed' : 'Missing',
      note: 'Uses draft slots, current value, value movement, and returned prospect ranks only.',
      tone: (data.draftPicks?.length || prospectCount) ? 'good' : 'warn',
    },
    {
      label: 'Trade Calibration',
      status: tradeCalibrationCoverage.timelinePlayers
        ? tradeCalibrationCoverage.signalPlayers
          ? 'Backed'
          : 'Timeline only'
        : 'Missing',
      note: tradeCalibrationCoverage.timelinePlayers
        ? `${tradeCalibrationCoverage.timelinePlayers}/${tradeCalibrationCoverage.totalPlayers} players have stored value timelines for trade readouts${tradeCalibrationSignalCopy ? `; ${tradeCalibrationSignalCopy}.` : '; no strong riser/faller label fired.'}`
        : 'Trade readouts can still use value and fit, but no stored value timelines were returned for calibration labels.',
      tone: tradeCalibrationCoverage.signalPlayers ? 'good' : tradeCalibrationCoverage.timelinePlayers ? 'info' : 'warn',
    },
    {
      label: 'Situation Delta',
      status: situationDeltas.length
        ? strongSituationReads.length
          ? 'Backed'
          : 'Partial'
        : 'Missing',
      note: situationDeltas.length
        ? `${situationDeltas.length}/${Object.keys(data.playerDetailsById || {}).length} players have opportunity delta reads${situationSignalCopy ? `; ${situationSignalCopy}.` : '; all reads are source-limited or neutral.'}`
        : 'Player detail reads can still use value and cohort context, but no situation-delta scorer output was returned.',
      tone: strongSituationReads.length || freshSituationReads.length ? 'good' : situationDeltas.length ? 'info' : 'warn',
    },
    {
      label: 'Research Assistant',
      status: newsCount ? 'Backed' : 'Missing',
      note: 'Uses returned FantasyPros/Sleeper news and status flags when available.',
      tone: newsCount ? 'good' : 'warn',
    },
    {
      label: 'Matchup Preview',
      status: hasMatchupPreview ? 'Backed' : 'Pending',
      note: hasMatchupPreview
        ? 'Uses returned weekly matchup projection rows and submitted lineup context.'
        : 'Ready for schedule-week payloads. Until the NFL schedule and Sleeper matchups exist, it stays projection-free.',
      tone: hasMatchupPreview ? 'good' : 'warn',
    },
  ] satisfies Array<{ label: string; status: string; note: string; tone: AssistantTone }>;
}

function renderAssistantPlayerRows(players: Array<{
  id: string;
  name: string;
  position?: string | null;
  team?: string | null;
  playerId?: string;
  meta: string;
  value?: string | number;
  tone?: AssistantTone;
}>) {
  if (!players.length) return <p className="command-module-empty-copy">No returned player data for this module.</p>;
  return (
    <div className="assistant-feature-list">
      {players.map((player) => (
        <span key={player.id} className={player.tone ? `assistant-feature-list-row assistant-feature-list-row-${player.tone}` : 'assistant-feature-list-row'}>
          <PlayerIdentityRow
            playerId={player.playerId}
            playerName={player.name}
            team={player.team || undefined}
            position={player.position || undefined}
          />
          <em>{player.meta}</em>
          {player.value !== undefined ? <strong>{player.value}</strong> : null}
        </span>
      ))}
    </div>
  );
}

export function AssistantFeatureShells({
  data,
  leagueName,
  leagueId,
}: {
  data: ReportData;
  leagueName?: string;
  leagueId?: string;
}) {
  const managerOptions = getManagerOptions(data);
  const [watchPreferences, setWatchPreferences] = useState<WatchAlertPreferences>(() => readWatchAlertPreferences());
  const [watchStatus, setWatchStatus] = useState<string | null>(null);
  const [portfolioSnapshots, setPortfolioSnapshots] = useState<PortfolioSnapshot[]>(() => readPortfolioSnapshots());
  const [portfolioStatus, setPortfolioStatus] = useState<string | null>(null);
  const manager = getFocusedManager(data, managerOptions);
  const watchSignals = useMemo(() => buildWatchSignals(data, manager), [data, manager]);
  const rookieSignals = useMemo(() => buildRookieSignals(data), [data]);
  const newsRows = useMemo(() => buildNewsRows(data, manager), [data, manager]);
  const portfolio = useMemo(() => buildPortfolioExposure(data, manager), [data, manager]);
  const portfolioSnapshot = useMemo(() => buildPortfolioSnapshot(data, manager, leagueName, leagueId), [data, manager, leagueName, leagueId]);
  const savedPortfolio = useMemo(() => buildSavedPortfolioSummary(portfolioSnapshots), [portfolioSnapshots]);
  const counts = data.managerPositionCounts?.find((row) => row.manager === manager) || null;
  const usesSleeperStarterMap = counts?.starterSource === 'Sleeper';
  const intel = getIntel(data, manager);
  const power = getPower(data, manager);
  const waiverAdds = useMemo(() => {
    const byId = new Map<string, TrendingPlayer>();
    const addPlayer = (player: TrendingPlayer | null | undefined) => {
      if (!player?.player_id || byId.has(player.player_id)) return;
      byId.set(player.player_id, player);
    };
    data.waiverIntelligence?.weeklyEcrTargets?.forEach((target) => addPlayer(target.player));
    data.waiverIntelligence?.availableTrendingAdds?.forEach(addPlayer);
    if (data.waiverIntelligence?.highestKtcAvailable) addPlayer(data.waiverIntelligence.highestKtcAvailable);
    return Array.from(byId.values());
  }, [data.waiverIntelligence]);
  const starterPlayers = ((counts?.starterPlayers || []) as ManagerStarterPlayer[]).slice(0, 8);
  const starterIds = new Set(starterPlayers.map((player) => player.player_id));
  const benchPressure = ((counts?.lineupPlayers || counts?.rosterPlayers || []) as ManagerStarterPlayer[])
    .filter((player) => !starterIds.has(player.player_id))
    .sort((a, b) => getStarterValue(b) - getStarterValue(a))
    .slice(0, 4);
  const bestWaiver = waiverAdds[0] || data.waiverIntelligence?.highestKtcAvailable || null;
  const actionQueue = useMemo(() => buildOwnerActionQueue({
    data,
    manager,
    watchSignals,
    rookieSignals,
    benchPressure,
    bestWaiver,
    intel,
    portfolio,
  }), [bestWaiver, benchPressure, data, intel, manager, portfolio, rookieSignals, watchSignals]);
  const matchupPreview = getMatchupPreview(data, manager);
  const matchupDataAvailable = Boolean(matchupPreview);
  const alertingWatchSignals = watchSignals.filter((signal) => {
    if (signal.playerId && watchPreferences.trackedPlayerIds.includes(signal.playerId)) return true;
    if (signal.pctChange >= 0) return signal.pctChange >= watchPreferences.riseThresholdPct;
    return Math.abs(signal.pctChange) >= watchPreferences.fallThresholdPct;
  });
  const coverageRows = useMemo(() => buildFeatureCoverageRows(data, manager, {
    hasWatchPreferences: Boolean(watchPreferences.savedAt || watchPreferences.trackedPlayerIds.length),
    savedPortfolioLeagueCount: savedPortfolio.leagueCount,
    matchupPreviewAvailable: matchupDataAvailable,
  }), [data, manager, matchupDataAvailable, savedPortfolio.leagueCount, watchPreferences.savedAt, watchPreferences.trackedPlayerIds.length]);

  useEffect(() => {
    if (!portfolioSnapshot) return;
    setPortfolioSnapshots((current) => {
      const existing = current.find((snapshot) => snapshot.id === portfolioSnapshot.id);
      if (existing && existing.totalValue === portfolioSnapshot.totalValue && existing.playerCount === portfolioSnapshot.playerCount) {
        return current;
      }
      const next = upsertPortfolioSnapshot(current, portfolioSnapshot);
      writePortfolioSnapshots(next);
      return next;
    });
  }, [portfolioSnapshot]);

  const updateWatchPreferences = (updater: (current: WatchAlertPreferences) => WatchAlertPreferences) => {
    setWatchPreferences((current) => {
      const next = updater(current);
      writeWatchAlertPreferences(next);
      return { ...next, savedAt: Date.now() };
    });
    setWatchStatus('Saved locally');
  };

  const handleWatchThresholdChange = (field: 'riseThresholdPct' | 'fallThresholdPct', value: string) => {
    const numeric = clamp(Number(value) || DEFAULT_WATCH_ALERT_PREFERENCES[field], 1, 100);
    updateWatchPreferences((current) => ({ ...current, [field]: numeric }));
  };

  const toggleWatchedPlayer = (playerId?: string) => {
    if (!playerId) return;
    updateWatchPreferences((current) => {
      const exists = current.trackedPlayerIds.includes(playerId);
      return {
        ...current,
        trackedPlayerIds: exists
          ? current.trackedPlayerIds.filter((id) => id !== playerId)
          : [playerId, ...current.trackedPlayerIds].slice(0, 80),
      };
    });
  };

  const saveCurrentPortfolioSnapshot = () => {
    if (!portfolioSnapshot) {
      setPortfolioStatus('No roster snapshot available');
      return;
    }
    setPortfolioSnapshots((current) => {
      const next = upsertPortfolioSnapshot(current, { ...portfolioSnapshot, savedAt: Date.now() });
      writePortfolioSnapshots(next);
      return next;
    });
    setPortfolioStatus('Portfolio snapshot saved');
  };

  return (
    <div className="assistant-feature-stack">
      <div className="command-module-toolbar">
        <CommandModuleFocus label="Assistant focus" manager={manager} />
      </div>

      <section className="assistant-feature-coverage">
        <div className="assistant-feature-card-head">
          <span><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Feature Coverage</span>
          <strong>No fake data</strong>
        </div>
        <div className="assistant-feature-coverage-grid">
          {coverageRows.map((row) => (
            <span key={row.label} className={`assistant-feature-coverage-row assistant-feature-coverage-row-${row.tone}`}>
              <strong>{row.label}</strong>
              <em>{row.status}</em>
              <small>{row.note}</small>
            </span>
          ))}
        </div>
      </section>

      <section className="assistant-feature-card assistant-action-queue-card">
        <div className="assistant-feature-card-head">
          <span><ClipboardList className="h-4 w-4" aria-hidden="true" /> Owner Action Queue</span>
          <strong>{actionQueue.length ? `${actionQueue.length} moves` : 'No moves'}</strong>
        </div>
        {actionQueue.length ? (
          <div className="assistant-action-queue-list">
            {actionQueue.map((row, index) => (
              <span key={row.id} className={`assistant-action-queue-row assistant-action-queue-${row.tone}`}>
                <b>{index + 1}</b>
                <em>{row.lane}</em>
                <strong>{row.action}</strong>
                <small>{row.detail}</small>
                <i>{row.priority}%</i>
              </span>
            ))}
          </div>
        ) : (
          <p className="command-module-empty-copy">No returned lineup, waiver, trade, market, draft, or exposure signal is strong enough to queue.</p>
        )}
        <p className="assistant-action-queue-policy">
          This is the only action read in this section. The modules below are
          receipts and controls, not separate recommendations.
        </p>
      </section>

      <div className="assistant-shell-grid">
        <section className="assistant-feature-card">
          <div className="assistant-feature-card-head">
            <span><Bell className="h-4 w-4" aria-hidden="true" /> Watch Alerts</span>
            <strong>{alertingWatchSignals.length ? `${alertingWatchSignals.length} alerts` : watchSignals.length ? 'Live movement' : 'No movement'}</strong>
          </div>
          <div className="assistant-watch-controls">
            <label>
              <span>Rise alert</span>
              <input
                type="number"
                min={1}
                max={100}
                value={watchPreferences.riseThresholdPct}
                onChange={(event) => handleWatchThresholdChange('riseThresholdPct', event.target.value)}
              />
            </label>
            <label>
              <span>Fall alert</span>
              <input
                type="number"
                min={1}
                max={100}
                value={watchPreferences.fallThresholdPct}
                onChange={(event) => handleWatchThresholdChange('fallThresholdPct', event.target.value)}
              />
            </label>
            <em>{watchStatus || `${watchPreferences.trackedPlayerIds.length} watched`}</em>
          </div>
          {watchSignals.length ? (
            <div className="assistant-feature-list">
              {watchSignals.map((signal) => {
                const watched = Boolean(signal.playerId && watchPreferences.trackedPlayerIds.includes(signal.playerId));
                const alerted = alertingWatchSignals.some((item) => item.id === signal.id);
                return (
                  <span key={signal.id} className={`assistant-feature-list-row assistant-feature-list-row-action assistant-feature-list-row-${alerted ? signal.tone : 'neutral'}`}>
                    <PlayerIdentityRow
                      playerId={signal.playerId}
                      playerName={signal.name}
                      team={signal.team || undefined}
                      position={signal.position || undefined}
                    />
                    <em>{signal.pctChange >= 0 ? '+' : ''}{signal.pctChange.toFixed(1)}% · {signal.label}</em>
                    <strong>{formatCompactValue(signal.value)}</strong>
                    <button type="button" className="assistant-watch-button" onClick={() => toggleWatchedPlayer(signal.playerId)}>
                      {watched ? 'Watching' : 'Watch'}
                    </button>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="command-module-empty-copy">No returned player data for this module.</p>
          )}
        </section>

        <section className="assistant-feature-card">
          <div className="assistant-feature-card-head">
            <span><Gauge className="h-4 w-4" aria-hidden="true" /> Lineup Optimizer</span>
            <strong>{power ? `Power #${power.rank}` : 'Projected'}</strong>
          </div>
          <div className="assistant-feature-metrics">
            <MetricPill label="Starter rank" value={power?.starterStrength || '-'} tone="good" />
            <MetricPill label="Bench pressure" value={benchPressure.length} tone={benchPressure.length ? 'warn' : 'neutral'} />
            <MetricPill label="Slots" value={data.leagueDiagnostics?.lineupSlotSummary || '-'} tone="info" />
          </div>
          {renderAssistantPlayerRows((benchPressure.length ? benchPressure : starterPlayers.slice(0, 4)).map((player) => ({
            id: player.player_id,
            name: player.name,
            position: player.pos,
            team: player.playerDetails?.team || null,
            playerId: player.player_id,
            meta: benchPressure.length ? 'Bench pressure' : usesSleeperStarterMap ? 'Sleeper starter' : 'Projected starter',
            value: formatCompactValue(getStarterValue(player)),
            tone: benchPressure.length ? 'warn' : 'good',
          })))}
        </section>

        <section className="assistant-feature-card">
          <div className="assistant-feature-card-head">
            <span><PackageSearch className="h-4 w-4" aria-hidden="true" /> Waiver Assistant</span>
            <strong>{waiverAdds.length} adds</strong>
          </div>
          <div className="assistant-feature-metrics">
            <MetricPill label="Best add" value={bestWaiver?.name || '-'} tone={bestWaiver ? 'good' : 'neutral'} />
            <MetricPill label="Drop candidates" value={intel?.droppablePlayers?.length || 0} tone={intel?.droppablePlayers?.length ? 'warn' : 'neutral'} />
            <MetricPill label="Matchup trace" value={data.waiverIntelligence?.weeklyEcrTargets?.length || 0} tone={data.waiverIntelligence?.weeklyEcrTargets?.length ? 'good' : 'neutral'} />
          </div>
          {renderAssistantPlayerRows(waiverAdds.slice(0, 4).map((player) => {
            const ecrRank = player.weeklyEcr?.bestPositionRank || (player.weeklyEcr?.bestRankEcr ? `Rank ${Math.round(player.weeklyEcr.bestRankEcr)}` : null);
            return {
              id: player.player_id,
              name: player.name,
              position: player.pos,
              team: player.team || player.playerDetails?.team || null,
              playerId: player.player_id,
              meta: ecrRank ? `Next-3 ${ecrRank}` : `${player.count.toLocaleString()} adds`,
              value: formatCompactValue(player.ktcValue || getPlayerDetailsValue(player.playerDetails)),
              tone: 'good',
            };
          }))}
        </section>

        <section className="assistant-feature-card">
          <div className="assistant-feature-card-head">
            <span><Radar className="h-4 w-4" aria-hidden="true" /> Portfolio View</span>
            <strong>{savedPortfolio.leagueCount > 1 ? `${savedPortfolio.leagueCount} leagues` : 'Single league'}</strong>
          </div>
          <div className="assistant-feature-metrics">
            <MetricPill label="Tracked value" value={formatCompactValue(portfolio.totalValue)} tone="info" />
            <MetricPill label="Top-3 share" value={formatPercent(portfolio.topThreeShare)} tone={(portfolio.topThreeShare || 0) >= 55 ? 'warn' : 'good'} />
            <MetricPill label="Saved leagues" value={savedPortfolio.leagueCount || 1} tone={savedPortfolio.leagueCount > 1 ? 'good' : 'neutral'} />
          </div>
          <div className="assistant-portfolio-actions">
            <button type="button" className="command-secondary-action" onClick={saveCurrentPortfolioSnapshot}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save Snapshot
            </button>
            <span>{portfolioStatus || `${portfolioSnapshots.length} saved team snapshot${portfolioSnapshots.length === 1 ? '' : 's'}`}</span>
          </div>
          <div className="assistant-position-exposure">
            {portfolio.positionRows.map((row) => (
              <span key={row.position}>
                <strong>{row.position}</strong>
                <em>{row.count} assets</em>
                <small>{formatCompactValue(row.value)}</small>
              </span>
            ))}
          </div>
          {savedPortfolio.overexposedPlayers.length ? (
            <div className="assistant-saved-exposure">
              <span>Cross-league exposure</span>
              {savedPortfolio.overexposedPlayers.map((player) => (
                <p key={player.playerId}>
                  <strong>{player.name}</strong>
                  <em>{player.leagueCount} leagues · {formatCompactValue(player.value)}</em>
                </p>
              ))}
            </div>
          ) : null}
        </section>

        <section className="assistant-feature-card">
          <div className="assistant-feature-card-head">
            <span><Sparkles className="h-4 w-4" aria-hidden="true" /> Rookie Signal</span>
            <strong>{rookieSignals.length} graded</strong>
          </div>
          {renderAssistantPlayerRows(rookieSignals.map((row) => ({
            id: row.id,
            name: row.name,
            position: row.position,
            team: row.team,
            playerId: row.playerId,
            meta: `${row.signal} · ${row.context}`,
            value: row.score,
            tone: row.score >= 75 ? 'good' : row.score <= 42 ? 'warn' : 'info',
          })))}
        </section>

        <section className="assistant-feature-card">
          <div className="assistant-feature-card-head">
            <span><Newspaper className="h-4 w-4" aria-hidden="true" /> Research Assistant</span>
            <strong>{newsRows.length} flags</strong>
          </div>
          {renderAssistantPlayerRows(newsRows.map((row) => ({
            id: row.id,
            name: row.name,
            position: row.position,
            team: row.team,
            playerId: row.id,
            meta: `${row.isRostered ? 'Roster' : 'League'} · ${row.source}`,
            value: row.title,
            tone: row.isRostered ? 'warn' : 'info',
          })))}
        </section>

        <section className="assistant-feature-card assistant-feature-card-wide">
          <div className="assistant-feature-card-head">
            <span><Swords className="h-4 w-4" aria-hidden="true" /> Matchup Preview</span>
            <strong>{matchupDataAvailable ? `Week ${matchupPreview?.week}` : 'Schedule pending'}</strong>
          </div>
          {matchupPreview ? (
            <>
              <div className="assistant-feature-metrics">
                <MetricPill label="Opponent" value={matchupPreview.opponentManager || '-'} tone="info" />
                <MetricPill label="Your projection" value={matchupPreview.projectedPoints?.toFixed?.(1) || '-'} tone="good" />
                <MetricPill label="Win odds" value={matchupPreview.winProbability ? formatPercent(matchupPreview.winProbability <= 1 ? matchupPreview.winProbability * 100 : matchupPreview.winProbability) : '-'} tone="warn" />
              </div>
              {renderAssistantPlayerRows((matchupPreview.vulnerableSpots || matchupPreview.mustStarts || []).slice(0, 4).map((player) => ({
                id: player.player_id,
                name: player.name,
                position: player.pos,
                team: player.playerDetails?.team || null,
                playerId: player.player_id,
                meta: matchupPreview.vulnerableSpots?.some((spot) => spot.player_id === player.player_id) ? 'Vulnerable spot' : 'Must start',
                value: formatCompactValue(getStarterValue(player)),
                tone: matchupPreview.vulnerableSpots?.some((spot) => spot.player_id === player.player_id) ? 'warn' : 'good',
              })))}
            </>
          ) : (
            <div className="assistant-matchup-pending">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
              <div>
                <strong>NFL schedule dependent</strong>
                <p>Once schedule-week matchup projections are returned, this panel will add opponent edge, boom/bust, must-start, and how-you-win analysis on top of the submitted Sleeper lineup when available.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
