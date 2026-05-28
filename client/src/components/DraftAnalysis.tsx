import { useEffect, useMemo, useState } from 'react';
import type { DraftPick, ManagerDraftStats, ManagerRosterIntelligence, PlayerDetails, ReportData } from '@shared/types';
import { TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
import { ManagerDraftPicksModal } from './ManagerDraftPicksModal';
import { PlayerDetailModal, type PlayerModalData } from './PlayerDetailModal';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { ChampionAvatarFrame } from './ManagerChampionships';
import { TeamLogoPill } from './TeamLogoPill';
import { EmptyState, MetricPill, PlayerPill, type PreviewMetric } from './reportPrimitives';
import { AIReadPanel } from './AIReadPanel';
import { DraftCollapsibleSection } from '@/features/report/components/DraftCollapsibleSection';
import { DraftOpportunityNote } from '@/features/report/components/DraftOpportunityNote';
import {
  type DraftDecisionAudit,
  buildManagerDraftDecisionAudits,
  sortManagerDraftStatsByEfficiency,
} from '@/features/report/lib/draftDecisionAnalytics';
import { getTeamTileStyle } from '@/lib/teamTileStyle';
import { buildDraftOpportunityMap, getDraftPickKey, type DraftOpportunity } from '@/lib/draftOpportunity';
import { getDraftKind, getDraftKindLabel, isFreshRookieMarketRead } from '@/lib/draftDisplay';
import {
  buildDraftSignalManagerStats,
  getDraftSignalPicks,
} from '@/lib/draftDashboardMetrics';
import {
  buildDraftDecisionPreviewMetrics,
  buildDraftOpportunitySummary,
  buildDraftStatsPreviewMetrics,
  buildDraftYearPreviewMetrics,
  compareDraftGroupKeys,
  formatDraftAdp,
  formatDraftAge,
  getDraftCurrentValue,
  getDraftGroupKey,
  getDraftGroupKind,
  getDraftGroupTitle,
} from '@/features/report/lib/draftAnalysisPresentation';
import {
  attachDraftDecisionAudit,
  buildDraftDecisionAudits,
} from '@/features/report/lib/draftAnalysisDecisionEngine';
import { viewerOwnedHighlightClass } from '@/lib/viewerHighlight';
import { getBalancedGridStyle } from '@/lib/balancedGrid';
import { normalizeLeagueValueMode, type LeagueValueMode } from '@/lib/leagueValueMode';
import { readEnumParam, readOptionalEnumParam, replaceUrlSearchParams } from '@/lib/reportUrlState';
import { getPositionRankPillClass } from '@/lib/positionRank';

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
type SortColumn = 'pick' | 'adp' | 'currentAdp' | 'currentValue' | 'valueChange' | null;
type SortDirection = 'asc' | 'desc';
const DRAFT_SORT_COLUMNS: readonly Exclude<SortColumn, null>[] = ['pick', 'adp', 'currentAdp', 'currentValue', 'valueChange'];
const DRAFT_SORT_DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];

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
      setSortDirection(column === 'pick' || column === 'adp' || column === 'currentAdp' ? 'asc' : 'desc');
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
      let aVal: number | null = 0;
      let bVal: number | null = 0;

      if (sortColumn === 'currentValue') {
        aVal = getDraftCurrentValue(a, leagueValueMode);
        bVal = getDraftCurrentValue(b, leagueValueMode);
      } else if (sortColumn === 'valueChange') {
        aVal = a.valueGain ?? 0;
        bVal = b.valueGain ?? 0;
      } else if (sortColumn === 'adp') {
        aVal = typeof a.adp === 'number' && Number.isFinite(a.adp) ? a.adp : null;
        bVal = typeof b.adp === 'number' && Number.isFinite(b.adp) ? b.adp : null;
      } else if (sortColumn === 'currentAdp') {
        aVal = typeof a.currentAdp === 'number' && Number.isFinite(a.currentAdp) ? a.currentAdp : null;
        bVal = typeof b.currentAdp === 'number' && Number.isFinite(b.currentAdp) ? b.currentAdp : null;
      } else if (sortColumn === 'pick') {
        aVal = a.pick || 0;
        bVal = b.pick || 0;
      }

      if (aVal === null || bVal === null) {
        if (aVal === null && bVal === null) return a.pick - b.pick;
        return aVal === null ? 1 : -1;
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
    () => buildDraftOpportunityMap(draftPicks, managerRosterIntelligence || [], leagueValueMode),
    [draftPicks, leagueValueMode, managerRosterIntelligence]
  );
  const draftSignalPicks = useMemo(
    () => getDraftSignalPicks({ draftPicks: sortedDraftPicks, leagueValueMode }, leagueValueMode),
    [leagueValueMode, sortedDraftPicks]
  );
  const orderedDraftStats = useMemo(
    () => sortManagerDraftStatsByEfficiency(buildDraftSignalManagerStats({ draftPicks, leagueValueMode }, leagueValueMode)),
    [draftPicks, leagueValueMode]
  );
  const draftCapitalEfficiencyPicks = useMemo(
    () => getDraftSignalPicks({ draftPicks, leagueValueMode }, leagueValueMode),
    [draftPicks, leagueValueMode]
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
    return buildDraftDecisionAudits(draftSignalPicks, managerRosterIntelligence || [], leagueValueMode);
  }, [draftSignalPicks, managerRosterIntelligence, leagueValueMode]);
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
    return draftSignalPicks.map((pick) => attachDraftDecisionAudit(pick, draftDecisionAuditByPick.get(getDraftPickKey(pick))));
  }, [draftDecisionAuditByPick, draftSignalPicks]);
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

  const topDraftGain = [...draftSignalPicks].sort((a, b) => (b.valueGain || 0) - (a.valueGain || 0))[0];
  const biggestDraftLeak = [...draftSignalPicks].sort((a, b) => (a.valueGain || 0) - (b.valueGain || 0))[0];
  const viewerDraftPicks = viewerManager ? draftSignalPicks.filter((pick) => pick.manager === viewerManager) : [];
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
          confidence={draftSignalPicks.length ? 82 : 50}
          severity={biggestDraftLeak && (biggestDraftLeak.valueGain || 0) < -500 ? 'warn' : 'info'}
          chips={[
            `${draftSignalPicks.length} picks`,
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
              : 'Manager-level read on whether each rookie draft pick stayed near the best dynasty values available. Roster need is only used as a tiebreaker after board value.'}
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

      {/* Full Draft Board */}
      <div className="draft-year-card-grid">
        {draftYears.map((draftYear) => {
          const yearPicks = draftPicksByYear[draftYear] || [];
          const draftGroupKind = getDraftGroupKind(draftYear, yearPicks, leagueValueMode);
          const isStartupDraftGroup = draftGroupKind === 'startup';
          const adpColumnLabel = isStartupDraftGroup ? 'Draft ADP' : 'ADP';
          const adpColumnTitle = isStartupDraftGroup ? 'Draft ADP' : 'ADP';
          const currentAdpColumnLabel = 'Now ADP';
          const draftYearSectionId = `year:${draftYear}`;
          const isDraftBoardOpen = activeDraftSectionId === draftYearSectionId;
          const yearPreviewMetrics = buildDraftYearPreviewMetrics(yearPicks, leagueValueMode, draftDecisionAudits, managerAvatars);
          const opportunitySummary = buildDraftOpportunitySummary(yearPicks, draftOpportunityByPick);

          return (
            <DraftCollapsibleSection
              key={draftYear}
              title={getDraftGroupTitle(draftYear, yearPicks, leagueValueMode)}
              kicker={`${yearPicks.length} players picked`}
              previewMetrics={yearPreviewMetrics}
              open={isDraftBoardOpen}
              onToggle={(open) => setDraftSectionOpen(draftYearSectionId, open)}
            >
              {opportunitySummary.missed.length > 0 && (
                <div className="draft-board-context-callout">
                  <div>
                    <span>Board-value context</span>
                    <strong>
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
                  <div className={`rookie-draft-row-shell ${isStartupDraftGroup ? 'is-startup-draft-board' : ''}`}>
                    <div className={`draft-sort-strip ${isStartupDraftGroup ? 'is-startup-sort-strip' : ''}`}>
                      <button type="button" onClick={() => handleSort('pick')} aria-label="Sort by pick number">
                        Pick #
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleSort('adp')} aria-label={`Sort by ${adpColumnTitle}`} title={adpColumnTitle}>
                        {adpColumnLabel}
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                      {isStartupDraftGroup ? (
                        <button type="button" onClick={() => handleSort('currentAdp')} aria-label="Sort by current ADP" title="Current ADP">
                          {currentAdpColumnLabel}
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button type="button" onClick={() => handleSort('currentValue')} aria-label={isRedraft ? 'Sort by current season value' : 'Sort by current value'}>
                        {isRedraft ? 'Current Season' : 'Current Value'}
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleSort('valueChange')} aria-label="Sort by value change">
                        Value Change
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="rookie-draft-row-header" aria-hidden="true">
                      <span>Pick</span>
                      <span title={adpColumnTitle}>{adpColumnLabel}</span>
                      {isStartupDraftGroup ? <span title="Current ADP">{currentAdpColumnLabel}</span> : null}
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
                        const ageLabel = formatDraftAge(details?.age, 'long');
                        const tableAgeLabel = formatDraftAge(details?.age, 'short');
                        const draftRankLabel = pick.positionRankMay2025 || pick.playerPos || 'N/A';
                        const currentRankLabel = pick.currentPositionRank || pick.playerPos || 'N/A';
                        const currentValue = getDraftCurrentValue(pick, leagueValueMode);
                        const adpTitle = isStartupDraftGroup
                          ? [pick.adpSource ? `Drafted: ${pick.adpSource}` : null, pick.currentAdpSource ? `Current: ${pick.currentAdpSource}` : null]
                            .filter(Boolean)
                            .join(' | ') || undefined
                          : pick.adpSource || undefined;
                        return (
                          <button
                            key={`${pick.draftYear}-${pick.pick}-${pick.player_id || idx}`}
                            type="button"
                            className={`player-team-tile rookie-draft-row mobile-stacked-row ${viewerOwnedHighlightClass(pick.manager, viewerManager)}`}
                            style={getTeamTileStyle(details?.team)}
                            onClick={() => openDraftPlayer(pick)}
                          >
                            <span className="rookie-draft-pick-cell" data-label="Pick">
                              <span
                                className="rookie-draft-pick-manager-preview"
                                title={managerDisplayName}
                                aria-label={managerDisplayName}
                              >
                                {managerAvatars?.[pick.manager] ? (
                                  <img src={managerAvatars[pick.manager] || ''} alt="" />
                                ) : (
                                  <span aria-hidden="true">{managerDisplayName[0]?.toUpperCase() || '?'}</span>
                                )}
                              </span>
                              <span className="rookie-draft-pick-number">#{pick.pick}</span>
                            </span>
                            <span
                              className="rookie-draft-adp-cell"
                              data-label={adpColumnLabel}
                              data-mobile-label={isStartupDraftGroup ? 'Then' : 'ADP'}
                              title={adpTitle}
                            >
                              {formatDraftAdp(pick.adp)}
                            </span>
                            {isStartupDraftGroup ? (
                              <span
                                className="rookie-draft-adp-cell rookie-draft-current-adp-cell"
                                data-label={currentAdpColumnLabel}
                                data-mobile-label="Now"
                                title={pick.currentAdpSource || undefined}
                              >
                                {formatDraftAdp(pick.currentAdp)}
                              </span>
                            ) : null}
                            <span className="rookie-draft-player-cell">
                              <PlayerNameWithHeadshot
                                playerId={pick.player_id}
                                playerName={pick.playerName}
                                team={details?.team}
                                position={pick.playerPos}
                              />
                              <DraftOpportunityNote opportunity={opportunity} />
                            </span>
                            <span className="rookie-draft-team-cell">
                              <TeamLogoPill team={details?.team || null} />
                            </span>
                            <span className="rookie-draft-age-cell" data-label="Age">{tableAgeLabel}</span>
                            <span className="rookie-draft-manager-cell">
                              <ManagerNameWithAvatar
                                avatarUrl={managerAvatars?.[pick.manager]}
                                managerName={pick.manager}
                                displayName={managerDisplayName}
                                hideName
                              />
                            </span>
                            <span className={getPositionRankPillClass(draftRankLabel, 'rookie-draft-rank-cell rookie-draft-rank-cell-draft')} data-label="Draft" data-mobile-label="Then">
                              <span className="rookie-draft-mobile-cell-label">Draft</span>
                              <span className="rookie-draft-mobile-cell-main">{draftRankLabel}</span>
                            </span>
                            <span className="rookie-draft-value-cell" data-label="Draft" data-mobile-label="Then" title={pick.draftValueSource || undefined}>
                              <span className="rookie-draft-mobile-cell-label">Draft</span>
                              <span className="rookie-draft-mobile-cell-main">{pick.ktcValue ? pick.ktcValue.toLocaleString() : 'N/A'}</span>
                            </span>
                            <span className={getPositionRankPillClass(currentRankLabel, 'rookie-draft-rank-cell rookie-draft-rank-cell-current')} data-label="Now" data-mobile-label="Now">
                              <span className="rookie-draft-mobile-cell-label">Now</span>
                              <span className="rookie-draft-mobile-cell-main">{currentRankLabel}</span>
                            </span>
                            <span className="rookie-draft-value-cell" data-label="Now" data-mobile-label="Now" title={pick.currentValueSource || undefined}>
                              <span className="rookie-draft-mobile-cell-label">Now</span>
                              <span className="rookie-draft-mobile-cell-main">{currentValue ? currentValue.toLocaleString() : 'N/A'}</span>
                            </span>
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
                            <span className="rookie-draft-mobile-context">
                              <span className="rookie-draft-mobile-context-chip rookie-draft-mobile-context-team">
                                <TeamLogoPill team={details?.team || null} />
                              </span>
                              <span className="rookie-draft-mobile-context-chip rookie-draft-mobile-context-age">{ageLabel}</span>
                              <span className={getPositionRankPillClass(currentRankLabel || draftRankLabel, 'rookie-draft-mobile-context-chip rookie-draft-mobile-rank-combo')}>
                                <span>{draftRankLabel}</span>
                                <span aria-hidden="true">/</span>
                                <span>{currentRankLabel}</span>
                              </span>
                              <span
                                className="rookie-draft-mobile-context-chip rookie-draft-mobile-context-manager"
                                title={managerDisplayName}
                                aria-label={managerDisplayName}
                              >
                                {managerAvatars?.[pick.manager] ? (
                                  <img src={managerAvatars[pick.manager] || ''} alt="" />
                                ) : (
                                  <span aria-hidden="true">{managerDisplayName[0]?.toUpperCase() || '?'}</span>
                                )}
                              </span>
                              <span className="rookie-draft-mobile-adp-cluster">
                                <span className={`rookie-draft-mobile-context-chip rookie-draft-mobile-context-adp${isStartupDraftGroup ? ' rookie-draft-mobile-context-adp-then' : ''}`}>
                                  <small>{isStartupDraftGroup ? 'Then' : 'ADP'}</small>
                                  <span>{formatDraftAdp(pick.adp)}</span>
                                </span>
                                {isStartupDraftGroup ? (
                                  <span className="rookie-draft-mobile-context-chip rookie-draft-mobile-context-adp rookie-draft-mobile-context-adp-now">
                                    <small>Now</small>
                                    <span>{formatDraftAdp(pick.currentAdp)}</span>
                                  </span>
                                ) : null}
                              </span>
                              {isStartupDraftGroup ? (
                                <span className="rookie-draft-startup-mobile-market" aria-hidden="true">
                                  <span className="rookie-draft-startup-mobile-market-row">
                                    <span className="rookie-draft-startup-mobile-adp is-now">{formatDraftAdp(pick.currentAdp)}</span>
                                    <span className={getPositionRankPillClass(currentRankLabel, 'rookie-draft-startup-mobile-rank')}>{currentRankLabel}</span>
                                    <span className="rookie-draft-startup-mobile-value is-now">{currentValue ? currentValue.toLocaleString() : 'N/A'}</span>
                                    <span className="rookie-draft-startup-mobile-pick">#{pick.pick}</span>
                                  </span>
                                  <span className="rookie-draft-startup-mobile-market-row">
                                    <span className="rookie-draft-startup-mobile-adp is-then">{formatDraftAdp(pick.adp)}</span>
                                    <span className={getPositionRankPillClass(draftRankLabel, 'rookie-draft-startup-mobile-rank')}>{draftRankLabel}</span>
                                    <span className="rookie-draft-startup-mobile-value is-then">{pick.ktcValue ? pick.ktcValue.toLocaleString() : 'N/A'}</span>
                                    <span
                                      className="rookie-draft-startup-mobile-manager"
                                      title={managerDisplayName}
                                      aria-label={managerDisplayName}
                                    >
                                      {managerAvatars?.[pick.manager] ? (
                                        <img src={managerAvatars[pick.manager] || ''} alt="" />
                                      ) : (
                                        <span aria-hidden="true">{managerDisplayName[0]?.toUpperCase() || '?'}</span>
                                      )}
                                    </span>
                                  </span>
                                </span>
                              ) : null}
                              <span className="rookie-draft-mobile-context-chip rookie-draft-mobile-context-value">
                                <small>Draft</small>
                                <strong>{draftRankLabel}</strong>
                                <span>{pick.ktcValue ? pick.ktcValue.toLocaleString() : 'N/A'}</span>
                              </span>
                              <span className="rookie-draft-mobile-context-chip rookie-draft-mobile-context-value">
                                <small>Now</small>
                                <strong>{currentRankLabel}</strong>
                                <span>{currentValue ? currentValue.toLocaleString() : 'N/A'}</span>
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
        managerDisplayName={selectedManager ? orderedDraftStats.find((stat) => stat.manager === selectedManager)?.managerDisplayName : undefined}
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
