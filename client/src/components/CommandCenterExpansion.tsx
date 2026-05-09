import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  Bell,
  CalendarDays,
  ClipboardList,
  Copy,
  Crosshair,
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
import type { DraftPick, ManagerIntelPlayer, ManagerStarterPlayer, PlayerDetails, PlayerInfo, RankingPlayer, ReportData, TrendingPlayer, WeeklyMomentum } from '@shared/types';
import { AIReadPanel, type AIReadChip } from './AIReadPanel';
import { EmptyState, MetricPill, PlayerIdentityRow } from './reportPrimitives';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { ChampionAvatarFrame } from './ManagerChampionships';
import { TeamLogoPill } from './TeamLogoPill';
import { getLeagueModeCopy, normalizeLeagueValueMode } from '@/lib/leagueValueMode';
import { getBalancedGridStyle } from '@/lib/balancedGrid';
import { viewerOwnedHighlightClass } from '@/lib/viewerHighlight';

type ManagerAvatars = ReportData['managerAvatars'];
type ManagerIntelRow = NonNullable<ReportData['managerRosterIntelligence']>[number];
type OverviewRow = ReportData['leagueOverview'][number];
type PowerRow = NonNullable<ReportData['powerRankings']>[number];
type Position = 'QB' | 'RB' | 'WR' | 'TE';

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE'];
const WATCH_ALERT_PREFERENCES_KEY = 'dynasty-degenerates:watch-alert-preferences:v1';
const PORTFOLIO_SNAPSHOT_KEY = 'dynasty-degenerates:portfolio-snapshots:v1';

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

function getManagerOptions(data: ReportData): string[] {
  const names = [
    ...(data.managerRosterIntelligence || []).map((row) => row.manager),
    ...(data.leagueOverview || []).map((row) => row.manager),
  ];
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}

function getDefaultManager(data: ReportData): string {
  return data.viewerManager
    || [...(data.leagueOverview || [])].sort((a, b) => a.rank_value - b.rank_value)[0]?.manager
    || data.managerRosterIntelligence?.[0]?.manager
    || '';
}

function getIntel(data: ReportData, manager?: string | null): ManagerIntelRow | null {
  if (!manager) return null;
  return data.managerRosterIntelligence?.find((row) => row.manager === manager) || null;
}

function getOverview(data: ReportData, manager?: string | null): OverviewRow | null {
  if (!manager) return null;
  return data.leagueOverview?.find((row) => row.manager === manager) || null;
}

function getPower(data: ReportData, manager?: string | null): PowerRow | null {
  if (!manager) return null;
  return data.powerRankings?.find((row) => row.manager === manager) || null;
}

function getLeagueSize(data: ReportData): number {
  return data.leagueDiagnostics?.teamCount || data.leagueOverview?.length || data.managerRosterIntelligence?.length || 12;
}

function getRankGrade(rank?: number | null, leagueSize = 12): number {
  const numericRank = Number(rank);
  if (!Number.isFinite(numericRank) || numericRank <= 0) return 5;
  const percentile = 1 - (numericRank - 1) / Math.max(1, leagueSize - 1);
  return clamp(Math.round(2 + percentile * 8), 1, 10);
}

function getValueTier(rank?: number | null, leagueSize = 12): string {
  const grade = getRankGrade(rank, leagueSize);
  if (grade >= 9) return 'Elite';
  if (grade >= 7) return 'Championship';
  if (grade >= 5) return 'Contending';
  if (grade >= 3) return 'Reload';
  return 'Rebuild';
}

function getPositionRank(overview: OverviewRow | null, position: Position): number | null {
  if (!overview) return null;
  if (position === 'QB') return overview.rank_qb;
  if (position === 'RB') return overview.rank_rb;
  if (position === 'WR') return overview.rank_wr;
  return overview.rank_te;
}

function getPositionGrade(data: ReportData, intel: ManagerIntelRow | null, overview: OverviewRow | null, position: Position): string {
  const directGrade = intel?.positionGrades?.[position]?.grade;
  if (directGrade) return directGrade;
  return String(getRankGrade(getPositionRank(overview, position), getLeagueSize(data)));
}

function getValueShare(data: ReportData, overview: OverviewRow | null): number | null {
  if (!overview) return null;
  const total = (data.leagueOverview || []).reduce((sum, row) => sum + (row.total_val || 0), 0);
  return total > 0 ? (overview.total_val / total) * 100 : null;
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

function getTopStrength(power: PowerRow | null, overview: OverviewRow | null): string {
  if (!power && !overview) return 'No rank data';
  const candidates = [
    { label: 'Starter strength', value: power?.starterStrength || 0 },
    { label: 'Roster value', value: power?.rosterValue || 0 },
    { label: 'Positional balance', value: power?.positionalBalance || 0 },
    { label: 'Draft capital', value: power?.draftCapital || 0 },
    { label: 'Youth curve', value: power?.youthScore || 0 },
    ...POSITIONS.map((position) => ({
      label: `${position} room`,
      value: 12 - (getPositionRank(overview, position) || 12),
    })),
  ];
  return candidates.sort((a, b) => b.value - a.value)[0]?.label || 'No rank data';
}

function getBiggestWeakness(power: PowerRow | null, overview: OverviewRow | null): string {
  if (!power && !overview) return 'No rank data';
  const candidates = [
    { label: 'Starter strength', value: power?.starterStrength ?? 50 },
    { label: 'Roster value', value: power?.rosterValue ?? 50 },
    { label: 'Positional balance', value: power?.positionalBalance ?? 50 },
    { label: 'Draft capital', value: power?.draftCapital ?? 50 },
    { label: 'Youth curve', value: power?.youthScore ?? 50 },
    ...POSITIONS.map((position) => ({
      label: `${position} room`,
      value: 100 - (getPositionRank(overview, position) || 12) * 6,
    })),
  ];
  return candidates.sort((a, b) => a.value - b.value)[0]?.label || 'No rank data';
}

function getNeedPosition(data: ReportData, manager: string): Position | null {
  const direct = getIntel(data, manager)?.tradePlan?.needPosition;
  if (direct && POSITIONS.includes(direct)) return direct;
  const shortage = data.positionDepth?.find((row) => row.manager === manager && row.status === 'shortage');
  return POSITIONS.includes(shortage?.position as Position) ? shortage?.position as Position : null;
}

function getSurplusPosition(data: ReportData, manager: string): Position | null {
  const direct = getIntel(data, manager)?.tradePlan?.surplusPosition;
  if (direct && POSITIONS.includes(direct)) return direct;
  const surplus = data.positionDepth?.find((row) => row.manager === manager && row.status === 'excess');
  return POSITIONS.includes(surplus?.position as Position) ? surplus?.position as Position : null;
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
  const manager = getDefaultManager(data);
  const intel = getIntel(data, manager);
  const overview = getOverview(data, manager);
  const power = getPower(data, manager);
  const leagueValueMode = normalizeLeagueValueMode(data.leagueDiagnostics?.valueMode || data.leagueValueMode);
  const modeCopy = getLeagueModeCopy(leagueValueMode);
  const biggestGap = data.positionDepth?.filter((row) => row.status === 'shortage')[0];
  const bestTradePartner = buildTradePartners(data, manager)[0];
  const lead = manager
    ? `${manager} is the current command-center focus.`
    : 'Run a league report with manager roster data to unlock team-specific reads.';
  const valueLine = overview
    ? `Value rank #${overview.rank_value}, ${getTopStrength(power, overview).toLowerCase()} as the best leverage point, and ${getBiggestWeakness(power, overview).toLowerCase()} as the first pressure test.`
    : 'League overview ranks were not returned, so this read is limited to roster intelligence.';
  const gapLine = biggestGap
    ? `${biggestGap.manager} has the clearest ${biggestGap.position} shortage to exploit.`
    : 'No league-wide shortage was severe enough to flag from position-depth data.';
  const partnerLine = bestTradePartner
    ? `Best first trade angle: ${bestTradePartner.manager}, because ${bestTradePartner.angle.toLowerCase()}`
    : 'Trade partner matching needs more roster depth data.';

  return {
    title: `${modeCopy.ownerTitle} Upgrade Path`,
    body: `${lead} ${valueLine} ${gapLine} ${partnerLine}`,
    chips: [
      leagueValueMode === 'redraft' ? 'Season lens' : 'Dynasty lens',
      data.powerRankings?.length ? 'Power ranks loaded' : { label: 'No power ranks', tone: 'warn' },
      data.managerRosterIntelligence?.length ? 'Roster recon loaded' : { label: 'Roster recon missing', tone: 'warn' },
    ] as AIReadChip[],
  };
}

export function OverviewAIPulse({
  data,
}: {
  data: ReportData;
}) {
  const read = buildOverviewRead(data);
  return (
    <AIReadPanel
      title={read.title}
      subtitle="Live league scan using returned Sleeper rosters, league-matched values, and stored movement windows."
      readType="League Exploit"
      confidence={data.managerRosterIntelligence?.length ? 84 : 54}
      severity={data.managerRosterIntelligence?.length ? 'info' : 'warn'}
      chips={read.chips}
      body={read.body}
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
    const confidence = clamp(45 + (canMatchNeed ? 18 : 0) + (canHelpYou ? 18 : 0) + (surplus && sourceNeed === surplus ? 12 : 0), 35, 94);
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
      aiRead: `${manager} reads as ${label.toLowerCase()}. ${angle}.`,
    };
  }).sort((a, b) => b.confidence - a.confidence);
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
  const [selectedManager, setSelectedManager] = useState(getDefaultManager(data));
  const [generated, setGenerated] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const reportRef = useRef<HTMLElement | null>(null);
  const manager = selectedManager || managerOptions[0] || '';
  const intel = getIntel(data, manager);
  const overview = getOverview(data, manager);
  const power = getPower(data, manager);
  const pickPortfolio = data.pickPortfolios?.find((row) => row.manager === manager) || null;
  const tradeTendency = data.tradeTendencies?.find((row) => row.manager === manager) || null;
  const timeline = data.dynastyTimelines?.find((row) => row.manager === manager) || null;
  const counts = data.managerPositionCounts?.find((row) => row.manager === manager) || null;
  const leagueSize = getLeagueSize(data);
  const valueShare = getValueShare(data, overview);
  const monthLabel = getMonthLabel();
  const risers = data.weeklyRisers?.filter((row) => row.owner === manager).slice(0, 3) || [];
  const fallers = data.weeklyFallers?.filter((row) => row.owner === manager).slice(0, 3) || [];
  const tradePartners = buildTradePartners(data, manager).slice(0, 3);
  const hasPartialHistory = !data.standingsHistory?.length || !data.tradeHistory?.length || !data.weeklyRisers?.length;
  const snapshotStatus = data.monthlyBlueprintSnapshot;
  const formatBadges = getFormatBadges(data);

  if (!managerOptions.length || !intel) {
    return (
      <EmptyState
        className="command-module-empty"
        title="Team blueprint needs roster intelligence"
        description="The report did not return manager roster intelligence, so this blueprint cannot be generated without inventing data."
      />
    );
  }

  const positionGrades = POSITIONS.map((position) => ({
    position,
    grade: getPositionGrade(data, intel, overview, position),
    rank: getPositionRank(overview, position),
  }));
  const overallGrade = power?.score
    ? Math.round(power.score / 10)
    : Math.round(positionGrades.reduce((sum, item) => sum + Number(item.grade || 5), 0) / positionGrades.length);
  const topPriorities = [
    intel.tradePlan?.summary,
    ...((intel.pressurePoints || []).slice(0, 3)),
    intel.holes.summary !== 'No major roster hole flagged' ? intel.holes.summary : null,
  ].filter(Boolean) as string[];
  const blueprintShareText = [
    `${manager} ${monthLabel} Team Blueprint`,
    `${leagueName || 'Sleeper League'}${leagueFormat ? ` · ${leagueFormat}` : ''}`,
    `Roster archetype: ${intel.identity || '-'}`,
    `Value tier: ${getValueTier(overview?.rank_value, leagueSize)}`,
    `Overall grade: ${overallGrade}`,
    `Top strength: ${getTopStrength(power, overview)}`,
    `Priority: ${topPriorities[0] || intel.tradePlan?.summary || 'No priority flag returned'}`,
    hasPartialHistory ? 'History note: partial returned history only.' : 'History note: returned history loaded.',
  ].join('\n');

  const handleCopyBlueprint = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setShareStatus('Clipboard unavailable');
      return;
    }
    try {
      await navigator.clipboard.writeText(blueprintShareText);
      setShareStatus('Share text copied');
    } catch {
      setShareStatus('Clipboard blocked');
    }
  };

  const handlePrintBlueprint = () => {
    if (typeof window === 'undefined') return;
    setShareStatus('Opening print dialog');
    window.print();
  };

  return (
    <div className="team-blueprint-lab">
      <div className="command-module-toolbar">
        <label>
          <span>Team</span>
          <select value={manager} onChange={(event) => setSelectedManager(event.target.value)}>
            {managerOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <button type="button" className="command-primary-action" onClick={() => setGenerated(true)}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          {generated ? 'Regenerate Team Blueprint' : 'Generate Team Blueprint'}
        </button>
        {generated && (
          <div className="team-blueprint-export-actions">
            <button type="button" className="command-secondary-action" onClick={handleCopyBlueprint}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy Share Text
            </button>
            <button type="button" className="command-secondary-action" onClick={handlePrintBlueprint}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Print / Save PDF
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
          confidence={hasPartialHistory ? 74 : 88}
          severity={hasPartialHistory ? 'warn' : 'good'}
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
          actions={[{ label: 'Create Monthly AI Blueprint', onClick: () => setGenerated(true) }]}
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
            <section className="team-blueprint-panel team-blueprint-panel-wide">
              <h4>Roster Identity</h4>
              <div className="team-blueprint-metric-grid">
                <MetricPill label="Roster archetype" value={intel.identity || '-'} tone="info" />
                <MetricPill label="Value archetype" value={power?.tier || timeline?.label || intel.timeline || '-'} tone="warn" />
                <MetricPill label="Value tier" value={getValueTier(overview?.rank_value, leagueSize)} tone="good" />
                <MetricPill label="Overall grade" value={overallGrade} tone={overallGrade >= 7 ? 'good' : overallGrade <= 4 ? 'danger' : 'warn'} />
                <MetricPill label="Production share" value={formatPercent(intel.starterValuePct)} tone="info" />
                <MetricPill label="Value share" value={formatPercent(valueShare)} tone="neutral" />
                <MetricPill label="2-year outlook" value={timeline ? timeline.label : intel.timeline || '-'} tone="info" />
              </div>
            </section>

            <section className="team-blueprint-panel">
              <h4>Positional Grades</h4>
              <div className="team-blueprint-grade-grid">
                {positionGrades.map((item) => (
                  <span key={item.position}>
                    <strong>{item.grade}</strong>
                    <em>{item.position}</em>
                    <small>{item.rank ? `Rank #${item.rank}` : 'No rank'}</small>
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
              <h4>Starting Lineup</h4>
              {renderPlayerList((counts?.starterPlayers || []) as ManagerIntelPlayer[], 'Projected starters were not returned.', 8)}
            </section>

            <section className="team-blueprint-panel">
              <h4>Team Depth</h4>
              {renderPlayerList((intel.benchPlayers || intel.rosterPlayers || []) as ManagerIntelPlayer[], 'Bench/depth player data was not returned.', 8)}
            </section>

            <section className="team-blueprint-panel">
              <h4>Risers / Fallers</h4>
              <div className="team-blueprint-split-list">
                <div>
                  <span>Risers</span>
                  {(risers.length ? risers : []).map((player, index) => <p key={`${player.player_id || player.name}-riser-${index}`}>{player.name} +{player.pct_change.toFixed(1)}%</p>)}
                  {!risers.length && <p>No roster risers returned.</p>}
                </div>
                <div>
                  <span>Fallers</span>
                  {fallers.map((player, index) => <p key={`${player.player_id || player.name}-faller-${index}`}>{player.name} {player.pct_change.toFixed(1)}%</p>)}
                  {!fallers.length && <p>No roster fallers returned.</p>}
                </div>
              </div>
            </section>

            <section className="team-blueprint-panel">
              <h4>Market Value Analysis</h4>
              <div className="team-blueprint-split-list">
                <div>
                  <span>Buys</span>
                  <p>{getPlayerLabel(intel.buyTarget)}</p>
                  <p>{getPlayerLabel(intel.breakoutCandidate)}</p>
                </div>
                <div>
                  <span>Sells</span>
                  <p>{getPlayerLabel(intel.sellCandidate)}</p>
                  <p>{getPlayerLabel(intel.oldestPlayer)}</p>
                </div>
              </div>
            </section>

            <section className="team-blueprint-panel">
              <h4>Draft Capital</h4>
              {pickPortfolio ? (
                <div className="team-blueprint-pick-stack">
                  <span>2026: {pickPortfolio.count2026} picks · {formatCompactValue(pickPortfolio.value2026)}</span>
                  <span>2027: {pickPortfolio.count2027} picks · {formatCompactValue(pickPortfolio.value2027)}</span>
                  <span>Total: {formatCompactValue(pickPortfolio.totalValue)}</span>
                </div>
              ) : (
                <p className="command-module-empty-copy">Draft-pick portfolio was not returned.</p>
              )}
            </section>

            <section className="team-blueprint-panel">
              <h4>Trade Strategy</h4>
              <p>{intel.tradePlan?.summary || intel.strategySummary || intel.summary}</p>
              {tradeTendency && <p>{tradeTendency.tradeCount} completed trades · {tradeTendency.winPct}% win rate · {formatCompactValue(tradeTendency.profit)} profit.</p>}
            </section>

            <section className="team-blueprint-panel">
              <h4>Top Priorities</h4>
              {topPriorities.length ? (
                <ul>
                  {topPriorities.slice(0, 4).map((priority) => <li key={priority}>{priority}</li>)}
                </ul>
              ) : (
                <p className="command-module-empty-copy">No priority flags returned.</p>
              )}
            </section>

            <section className="team-blueprint-panel">
              <h4>Ideal Trade Partners</h4>
              <div className="team-blueprint-partner-list">
                {tradePartners.map((partner) => (
                  <span key={partner.manager}>
                    <strong>{partner.manager}</strong>
                    <em>{partner.label}</em>
                  </span>
                ))}
                {!tradePartners.length && <p>No clean trade partners found from returned roster data.</p>}
              </div>
            </section>

            <AIReadPanel
              title="Blueprint AI Summary"
              readType="Monthly Blueprint"
              confidence={hasPartialHistory ? 76 : 90}
              severity={hasPartialHistory ? 'warn' : 'good'}
              chips={[
                `Value rank #${overview?.rank_value || '-'}`,
                `${formatPercent(intel.starterValuePct)} starter share`,
                hasPartialHistory ? { label: 'Partial history', tone: 'warn' } : { label: 'History loaded', tone: 'good' },
              ]}
              body={`${manager} profiles as ${intel.identity} with ${getTopStrength(power, overview).toLowerCase()} as the cleanest advantage. The priority is ${topPriorities[0] || intel.tradePlan?.summary || 'to keep value insulated until a clear roster-fit deal appears'}.`}
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
  const rows = [...(data.powerRankings || [])].sort((a, b) => a.rank - b.rank || b.score - a.score);
  if (!rows.length) {
    return (
      <EmptyState
        className="command-module-empty"
        title="Power rankings are not available"
        description="This report did not include power rankings. Re-run the league analysis after roster intelligence finishes."
      />
    );
  }

  return (
    <div className="league-power-grid balanced-tile-grid" style={getBalancedGridStyle(rows.length)}>
      {rows.map((row) => {
        const intel = getIntel(data, row.manager);
        const overview = getOverview(data, row.manager);
        const timeline = data.dynastyTimelines?.find((item) => item.manager === row.manager);
        const strength = getTopStrength(row, overview);
        const weakness = getBiggestWeakness(row, overview);
        const readiness = Math.round((row.starterStrength + row.rosterValue + row.positionalBalance) / 3);
        const chips: AIReadChip[] = [
          `Value #${overview?.rank_value || '-'}`,
          `Starters ${row.starterStrength}`,
          timeline?.label || row.tier,
        ];

        return (
          <details key={row.manager} className={`league-power-card ${viewerOwnedHighlightClass(row.manager, data.viewerManager)}`}>
            <summary>
              <span className="league-power-rank">#{row.rank}</span>
              <span className="league-power-manager">
                <ManagerNameWithAvatar avatarUrl={managerAvatars?.[row.manager]} managerName={row.manager} />
                <em>{row.tier}</em>
              </span>
              <span className="league-power-score">{row.score}</span>
            </summary>
            <div className="league-power-body">
              <div className="league-power-metrics">
                <MetricPill label="Roster value" value={overview ? `#${overview.rank_value}` : formatCompactValue(row.rosterValue)} tone="info" />
                <MetricPill label="Starter rank" value={row.starterStrength} tone="good" />
                <MetricPill label="Bench" value={intel ? formatCompactValue(intel.benchValue) : '-'} />
                <MetricPill label="QB" value={overview ? `#${overview.rank_qb}` : '-'} />
                <MetricPill label="RB" value={overview ? `#${overview.rank_rb}` : '-'} />
                <MetricPill label="WR" value={overview ? `#${overview.rank_wr}` : '-'} />
                <MetricPill label="TE" value={overview ? `#${overview.rank_te}` : '-'} />
                <MetricPill label="Draft capital" value={row.draftCapital} tone="warn" />
                <MetricPill label="Youth curve" value={row.youthScore} tone="info" />
                <MetricPill label="Playoff readiness" value={readiness} tone={readiness >= 70 ? 'good' : readiness <= 45 ? 'danger' : 'warn'} />
              </div>
              <AIReadPanel
                compact
                title={`${row.manager} power read`}
                readType="Contender Path"
                confidence={82}
                severity={readiness >= 70 ? 'good' : readiness <= 45 ? 'warn' : 'info'}
                chips={chips}
                body={`${row.manager}'s best advantage is ${strength.toLowerCase()}. The biggest roster flaw is ${weakness.toLowerCase()}. ${intel?.summary || 'Roster intelligence was not returned for a deeper read.'}`}
                backgroundVariant="league"
              />
            </div>
          </details>
        );
      })}
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
  const [selectedManager, setSelectedManager] = useState(getDefaultManager(data));
  const manager = selectedManager || managerOptions[0] || '';
  const intel = getIntel(data, manager);
  const overview = getOverview(data, manager);
  const power = getPower(data, manager);
  const pickPortfolio = data.pickPortfolios?.find((row) => row.manager === manager) || null;
  const tradeTendency = data.tradeTendencies?.find((row) => row.manager === manager) || null;
  const valueShare = getValueShare(data, overview);

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
    getTopStrength(power, overview),
    ...(intel.untouchablePlayers || []).slice(0, 2).map((player) => player.name),
  ].filter(Boolean);
  const weaknesses = [
    getBiggestWeakness(power, overview),
    ...(intel.pressurePoints || []).slice(0, 2),
  ].filter(Boolean);
  const fragileAssets = [intel.oldestPlayer, intel.starterAvailability.riskiestStarter].filter(Boolean) as ManagerIntelPlayer[];
  const insulatedAssets = (intel.untouchablePlayers?.length ? intel.untouchablePlayers : [intel.youngCorePlayer]).filter(Boolean) as ManagerIntelPlayer[];

  return (
    <div className="team-breakdown-recon">
      <div className="command-module-toolbar">
        <label>
          <span>Manager</span>
          <select value={manager} onChange={(event) => setSelectedManager(event.target.value)}>
            {managerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      <div className="team-breakdown-hero">
        <ManagerNameWithAvatar avatarUrl={managerAvatars?.[manager]} managerName={manager} />
        <div>
          <span>{intel.identity}</span>
          <strong>{power?.tier || intel.timeline}</strong>
        </div>
      </div>

      <div className="team-breakdown-grid">
        <section>
          <h4>Starting Lineup Strength</h4>
          <div className="team-breakdown-metrics">
            <MetricPill label="Starter value" value={formatCompactValue(intel.starterSeasonValue || intel.starterValue)} tone="good" />
            <MetricPill label="Starter share" value={formatPercent(intel.starterValuePct)} tone="info" />
            <MetricPill label="Power score" value={power?.score || '-'} tone="warn" />
          </div>
        </section>
        <section>
          <h4>Bench Depth</h4>
          <div className="team-breakdown-metrics">
            <MetricPill label="Bench value" value={formatCompactValue(intel.benchValue)} />
            <MetricPill label="Best stash" value={getPlayerLabel(intel.bestBenchStash)} tone="info" />
            <MetricPill label="Trade chip" value={getPlayerLabel(intel.tradeChip)} tone="warn" />
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
          <h4>Age Curve / Value Share</h4>
          <div className="team-breakdown-metrics">
            <MetricPill label="Avg age" value={intel.avgAge ?? '-'} tone={intel.avgAge && intel.avgAge >= 27.5 ? 'warn' : 'info'} />
            <MetricPill label="Value share" value={formatPercent(valueShare)} tone="info" />
            <MetricPill label="Roster value rank" value={overview ? `#${overview.rank_value}` : '-'} tone="warn" />
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
          <h4>Sell Candidates</h4>
          {renderPlayerList([intel.sellCandidate, ...fragileAssets].filter(Boolean) as ManagerIntelPlayer[], 'No sell candidates returned.', 4)}
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
        <AIReadPanel
          title={`${manager} suggested next move`}
          readType={intel.timeline?.toLowerCase().includes('rebuild') ? 'Rebuild Path' : 'Contender Path'}
          confidence={84}
          severity={weaknesses.length > 2 ? 'warn' : 'info'}
          chips={[
            `Need: ${getNeedPosition(data, manager) || '-'}`,
            `Surplus: ${getSurplusPosition(data, manager) || '-'}`,
            `Value share ${formatPercent(valueShare)}`,
          ]}
          body={intel.strategySummary || intel.tradePlan?.summary || intel.summary}
          backgroundVariant="roster"
          className="team-breakdown-ai"
        />
      </div>
    </div>
  );
}

export function TradePartnerFinder({
  data,
  managerAvatars,
}: {
  data: ReportData;
  managerAvatars?: ManagerAvatars;
}) {
  const managerOptions = getManagerOptions(data);
  const [selectedManager, setSelectedManager] = useState(getDefaultManager(data));
  const manager = selectedManager || managerOptions[0] || '';
  const recommendations = useMemo(() => buildTradePartners(data, manager).slice(0, 8), [data, manager]);

  if (!managerOptions.length) {
    return <EmptyState className="command-module-empty" title="No managers found for trade partner matching" />;
  }

  return (
    <div className="trade-partner-finder">
      <div className="command-module-toolbar">
        <label>
          <span>Your team</span>
          <select value={manager} onChange={(event) => setSelectedManager(event.target.value)}>
            {managerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>
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
              title="Trade partner read"
              readType="Trade Window"
              confidence={recommendation.confidence}
              severity={recommendation.confidence >= 75 ? 'good' : recommendation.confidence <= 55 ? 'warn' : 'info'}
              chips={[recommendation.label, recommendation.need ? `${recommendation.need} need` : 'No clear need']}
              body={recommendation.aiRead}
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
  const defaultManager = getDefaultManager(data);
  const [sourceManager, setSourceManager] = useState(defaultManager);
  const [targetManager, setTargetManager] = useState(managerOptions.find((manager) => manager !== defaultManager) || managerOptions[0] || '');
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
      confidence: Math.max(42, 88 - Math.round(Math.abs(gap) / 125)),
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
      confidence: Math.max(38, 82 - Math.round(Math.abs(targetValue - awayValue - secondaryGiveValue) / 150)),
      note: `${secondaryGive.name} turns this into a ${sourceIntel?.tradePlan?.surplusPosition || 'depth'} consolidation package instead of a one-for-one value poke.`,
    } : null,
    secondaryAsk ? {
      label: 'Ask-Back Package',
      give: [selectedAway],
      receive: [selectedTarget, secondaryAsk],
      gap: targetValue + secondaryAskValue - awayValue,
      confidence: Math.max(34, 78 - Math.round(Math.abs(targetValue + secondaryAskValue - awayValue) / 175)),
      note: `${secondaryAsk.name} is the add-back if ${targetManager} wants the cleaner headline asset.`,
    } : null,
  ].filter(Boolean) as Array<{ label: string; give: ManagerIntelPlayer[]; receive: ManagerIntelPlayer[]; gap: number; confidence: number; note: string }> : [];

  if (managerOptions.length < 2) {
    return <EmptyState className="command-module-empty" title="Trade finder needs at least two managers" />;
  }

  return (
    <div className="trade-finder-generator">
      <div className="command-module-toolbar command-module-toolbar-wide">
        <label>
          <span>Your team</span>
          <select value={sourceManager} onChange={(event) => {
            const next = event.target.value;
            setSourceManager(next);
            if (next === targetManager) setTargetManager(managerOptions.find((manager) => manager !== next) || '');
            setAwayPlayerId('');
          }}>
            {managerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
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
        ]}
        body={qbDepthWarning
          ? `Do not move ${selectedAway?.name} in this Superflex build unless another QB is coming back. The roster does not have enough QB depth for raw value math to be useful.`
          : packages.length
            ? `The cleanest starting point is ${packages[0].label.toLowerCase()} with a value gap of ${gap >= 0 ? '+' : ''}${formatCompactValue(gap)} from your side. Roster fit still matters more than calculator symmetry.`
            : 'Returned roster data does not contain enough tradeable player detail to generate a responsible package.'}
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
            title="Exploit read"
            readType="League Exploit"
            confidence={78}
            severity={exploit.tone}
            chips={[exploit.exploit, exploit.manager]}
            body={`${exploit.suggestedMove}. ${exploit.why}`}
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
  const rows = data.rankings?.defaultProfileKey ? data.rankings.profiles?.[data.rankings.defaultProfileKey] || [] : [];
  const topRiser = [...rows].filter((row) => !row.isPick && !row.isDevy).sort((a, b) => (b.movement || 0) - (a.movement || 0))[0];
  const topFaller = [...rows].filter((row) => !row.isPick && !row.isDevy).sort((a, b) => (a.movement || 0) - (b.movement || 0))[0];
  const ownedCount = rows.filter((row) => row.owner).length;

  return (
    <AIReadPanel
      title="Ranking board market signal"
      subtitle="This board uses league-matched values and source metadata when returned by the rankings endpoint."
      readType="Market Signal"
      confidence={rows.length ? 82 : 50}
      severity={rows.length ? 'info' : 'warn'}
      chips={[
        `${rows.length} assets`,
        `${ownedCount} rostered`,
        topRiser ? `Top riser: ${topRiser.name}` : { label: 'No riser data', tone: 'warn' },
      ]}
      body={rows.length
        ? `${topRiser ? `${topRiser.name} is the cleanest watchlist riser on the board.` : 'No ranking riser is available from this payload.'} ${topFaller ? `${topFaller.name} is the biggest discount-window check, but roster context still matters before buying.` : ''}`
        : 'Rankings were not returned yet, so the market read is intentionally limited.'}
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

  return (
    <AIReadPanel
      title="Trade browser read"
      subtitle="Searchable trade ledger foundation with value-gap context, manager tendency signals, and roster-window reads."
      readType="Trade Window"
      confidence={trades.length ? 84 : 55}
      severity={trades.length ? 'info' : 'warn'}
      chips={[
        `${trades.length} trades`,
        mostActive ? `Most active: ${mostActive.manager}` : { label: 'No tendencies', tone: 'warn' },
        biggestGap ? `Largest gap ${formatCompactValue(Math.abs(biggestGap.point_gap || 0))}` : 'No gaps',
      ]}
      body={trades.length
        ? `${bestProfit ? `${bestProfit.manager} has the strongest trade-profit signal.` : 'No trade-profit leader was returned.'} ${biggestGap ? `The largest gap is ${biggestGap.team_a} / ${biggestGap.team_b} on ${biggestGap.date}; open the ledger row for side-by-side context.` : ''}`
        : 'No completed trades were returned. The browser shows an empty state instead of manufacturing trade history.'}
      backgroundVariant="trade"
      className="trade-browser-ai-read"
    />
  );
}

type AssistantTone = 'good' | 'info' | 'warn' | 'danger' | 'neutral';

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

  return [
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
      status: data.managerPositionCounts?.length ? 'Partial' : 'Missing',
      note: 'Uses projected starter maps. Submitted Sleeper lineup comparison needs matchup/lineup payloads.',
      tone: data.managerPositionCounts?.length ? 'info' : 'warn',
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
  const [selectedManager, setSelectedManager] = useState(getDefaultManager(data));
  const [watchPreferences, setWatchPreferences] = useState<WatchAlertPreferences>(() => readWatchAlertPreferences());
  const [watchStatus, setWatchStatus] = useState<string | null>(null);
  const [portfolioSnapshots, setPortfolioSnapshots] = useState<PortfolioSnapshot[]>(() => readPortfolioSnapshots());
  const [portfolioStatus, setPortfolioStatus] = useState<string | null>(null);
  const manager = selectedManager || managerOptions[0] || '';
  const leagueValueMode = normalizeLeagueValueMode(data.leagueDiagnostics?.valueMode || data.leagueValueMode);
  const watchSignals = useMemo(() => buildWatchSignals(data, manager), [data, manager]);
  const rookieSignals = useMemo(() => buildRookieSignals(data), [data]);
  const newsRows = useMemo(() => buildNewsRows(data, manager), [data, manager]);
  const portfolio = useMemo(() => buildPortfolioExposure(data, manager), [data, manager]);
  const portfolioSnapshot = useMemo(() => buildPortfolioSnapshot(data, manager, leagueName, leagueId), [data, manager, leagueName, leagueId]);
  const savedPortfolio = useMemo(() => buildSavedPortfolioSummary(portfolioSnapshots), [portfolioSnapshots]);
  const counts = data.managerPositionCounts?.find((row) => row.manager === manager) || null;
  const intel = getIntel(data, manager);
  const power = getPower(data, manager);
  const waiverAdds = data.waiverIntelligence?.availableTrendingAdds || [];
  const starterPlayers = ((counts?.starterPlayers || []) as ManagerStarterPlayer[]).slice(0, 8);
  const starterIds = new Set(starterPlayers.map((player) => player.player_id));
  const benchPressure = ((counts?.lineupPlayers || counts?.rosterPlayers || []) as ManagerStarterPlayer[])
    .filter((player) => !starterIds.has(player.player_id))
    .sort((a, b) => getStarterValue(b) - getStarterValue(a))
    .slice(0, 4);
  const bestWaiver = waiverAdds[0] || data.waiverIntelligence?.highestKtcAvailable || null;
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
        <label>
          <span>Assistant focus</span>
          <select value={manager} onChange={(event) => setSelectedManager(event.target.value)}>
            {managerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
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
          <AIReadPanel
            title="Market signal read"
            readType="Market Signal"
            confidence={watchSignals.length ? 82 : 52}
            severity={watchSignals.length ? 'info' : 'warn'}
            chips={[`${data.weeklyRisers?.length || 0} risers`, `${data.weeklyFallers?.length || 0} fallers`, `${watchPreferences.trackedPlayerIds.length} watched`]}
            body={watchSignals.length
              ? `${watchSignals[0].name} is the loudest returned movement signal. Alert thresholds and watchlist players are saved locally in this browser; server-side notifications can come later.`
              : 'No weekly movement payload was returned, so the watch alert module is intentionally quiet.'}
            backgroundVariant="market"
            compact
          />
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
            meta: benchPressure.length ? 'Flex pressure' : 'Projected starter',
            value: formatCompactValue(getStarterValue(player)),
            tone: benchPressure.length ? 'warn' : 'good',
          })))}
          <AIReadPanel
            title="Starter strength read"
            readType="Lineup Leak"
            confidence={counts ? 84 : 48}
            severity={benchPressure.length ? 'warn' : counts ? 'info' : 'warn'}
            chips={[counts ? 'Lineup map loaded' : { label: 'No lineup map', tone: 'warn' }, data.leagueDiagnostics?.starterCalculation ? 'Slot-aware' : 'Current roster only']}
            body={counts
              ? `Projected starters use this league's returned lineup slots. Current submitted Sleeper lineup data is not in the payload, so missed-starter value is limited to bench pressure, not confirmed lineup mistakes.`
              : 'No manager lineup map was returned for this report.'}
            backgroundVariant="lineup"
            compact
          />
        </section>

        <section className="assistant-feature-card">
          <div className="assistant-feature-card-head">
            <span><PackageSearch className="h-4 w-4" aria-hidden="true" /> Waiver Assistant</span>
            <strong>{waiverAdds.length} adds</strong>
          </div>
          <div className="assistant-feature-metrics">
            <MetricPill label="Best add" value={bestWaiver?.name || '-'} tone={bestWaiver ? 'good' : 'neutral'} />
            <MetricPill label="Drop candidates" value={intel?.droppablePlayers?.length || 0} tone={intel?.droppablePlayers?.length ? 'warn' : 'neutral'} />
            <MetricPill label="Lens" value={leagueValueMode === 'redraft' ? 'Season' : 'Dynasty'} tone="info" />
          </div>
          {renderAssistantPlayerRows(waiverAdds.slice(0, 4).map((player) => ({
            id: player.player_id,
            name: player.name,
            position: player.pos,
            team: player.team || player.playerDetails?.team || null,
            playerId: player.player_id,
            meta: `${player.count.toLocaleString()} adds`,
            value: formatCompactValue(player.ktcValue || getPlayerDetailsValue(player.playerDetails)),
            tone: 'good',
          })))}
          <AIReadPanel
            title="Waiver fit read"
            readType="Waiver Opportunity"
            confidence={waiverAdds.length ? 82 : 54}
            severity={waiverAdds.length ? 'good' : 'warn'}
            chips={[data.waiverIntelligence ? 'Sleeper waiver data' : { label: 'No waiver payload', tone: 'warn' }, leagueValueMode === 'redraft' ? 'Weekly usage lens' : 'Dynasty stash lens']}
            body={bestWaiver
              ? `${bestWaiver.name} is the highest-priority available signal from returned trending and value data. Use the full waiver panel for add/drop context.`
              : 'No available waiver targets were returned, so no add/drop recommendation is shown here.'}
            backgroundVariant="waiver"
            compact
          />
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
          <AIReadPanel
            title="Exposure read"
            readType="Monthly Blueprint"
            confidence={portfolio.totalValue ? 74 : 44}
            severity={(portfolio.topThreeShare || 0) >= 55 ? 'warn' : portfolio.totalValue ? 'info' : 'warn'}
            chips={[
              savedPortfolio.leagueCount > 1 ? `${savedPortfolio.leagueCount} saved leagues` : 'Single-league exposure',
              `${portfolio.topAssets.length} top assets`,
              savedPortfolio.overexposedPlayers.length ? `${savedPortfolio.overexposedPlayers.length} repeated assets` : { label: 'No repeated shares yet', tone: 'warn' },
            ]}
            body={savedPortfolio.leagueCount > 1
              ? `${manager}'s current largest position exposure is ${portfolio.positionRows[0]?.position || '-'}. Across saved browser snapshots, ${savedPortfolio.overexposedPlayers[0]?.name || 'no player'} is the highest repeated player-share signal.`
              : portfolio.totalValue
                ? `${manager}'s largest position exposure is ${portfolio.positionRows[0]?.position || '-'}. Load and save another league to turn this into a true cross-league shares view.`
              : 'No roster player pool was returned for portfolio exposure.'}
            backgroundVariant="blueprint"
            compact
          />
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
          <AIReadPanel
            title="Degen prospect score"
            readType="Draft Capital Read"
            confidence={rookieSignals.length ? 78 : 44}
            severity={rookieSignals.length ? 'info' : 'warn'}
            chips={[data.draftPicks?.length ? 'Draft data loaded' : { label: 'No draft picks', tone: 'warn' }, data.prospectSourceDiagnostics?.status || 'Prospect source unknown']}
            body={rookieSignals.length
              ? `${rookieSignals[0].name} has the top returned rookie/prospect signal. The score uses draft slot, returned value, value movement, and available prospect ranks only. It does not claim film grades.`
              : 'No rookie draft or prospect rows were returned for scoring.'}
            backgroundVariant="draft"
            compact
          />
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
          <AIReadPanel
            title="Research read"
            readType="Player Trend"
            confidence={newsRows.length ? 72 : 46}
            severity={newsRows.length ? 'info' : 'warn'}
            chips={[`${newsRows.length} news/status flags`, newsRows.length ? 'News payload loaded' : { label: 'No news payload', tone: 'warn' }]}
            body={newsRows.length
              ? `${newsRows[0].name} is the first returned research flag. Player detail modals can show the article context when a URL/source is present.`
              : 'No FantasyPros or Sleeper news/status payload was returned for this report.'}
            backgroundVariant="market"
            compact
          />
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
                <p>Once schedule-week matchups and submitted lineup/projection payloads are returned, this panel will switch from readiness mode to opponent edge, boom/bust, must-start, and how-you-win analysis.</p>
              </div>
            </div>
          )}
          <AIReadPanel
            title="Weekly matchup availability"
            readType="Lineup Leak"
            confidence={matchupDataAvailable ? 80 : 38}
            severity={matchupDataAvailable ? 'info' : 'warn'}
            chips={[matchupDataAvailable ? 'Matchups loaded' : { label: 'Schedule pending', tone: 'warn' }, data.leagueDiagnostics?.starterCountSummary || 'Starter slots loaded']}
            body={matchupPreview
              ? (matchupPreview.howToWin || `This matchup preview uses returned ${matchupPreview.source || 'matchup'} data. Position edge rows are shown only when the payload includes them.`)
              : 'Sleeper matchup projections, current submitted lineups, and opponent matchup rows are not part of the current report payload yet. This module stays honest until schedule-week data exists.'}
            backgroundVariant="lineup"
            compact
          />
        </section>
      </div>
    </div>
  );
}
