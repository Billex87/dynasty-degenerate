import { useState, useMemo, type ReactNode } from 'react';
import type { DraftPick, ManagerDraftStats, ManagerRosterIntelligence, PlayerDetails, ReportData } from '@shared/types';
import { TrendingUp, TrendingDown, ArrowUpDown, ChevronDown } from 'lucide-react';
import { ManagerDraftPicksModal } from './ManagerDraftPicksModal';
import { PlayerDetailModal, type PlayerModalData } from './PlayerDetailModal';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { ChampionAvatarFrame } from './ManagerChampionships';
import { TeamLogoPill } from './TeamLogoPill';
import { EmptyState, MetricPill, ReportSectionHeader } from './reportPrimitives';
import { getTeamTileStyle } from '@/lib/teamTileStyle';
import { buildDraftOpportunityMap, getDraftPickKey, type DraftOpportunity } from '@/lib/draftOpportunity';
import { viewerOwnedHighlightClass } from '@/lib/viewerHighlight';
import { getBalancedGridStyle } from '@/lib/balancedGrid';

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
}

type ManagerDraftModalMode = 'portfolio' | 'audit';
type SortColumn = 'pick' | 'currentValue' | 'valueChange' | null;
type SortDirection = 'asc' | 'desc';

function formatDraftAge(age?: number | string | null): string {
  const numericAge = Number(age);
  if (!Number.isFinite(numericAge) || numericAge <= 0) return '-';
  return `${Number.isInteger(numericAge) ? numericAge : numericAge.toFixed(1)} yrs`;
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
}: DraftAnalysisProps) {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [selectedManagerMode, setSelectedManagerMode] = useState<ManagerDraftModalMode>('portfolio');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [openDraftYears, setOpenDraftYears] = useState<Set<string>>(new Set());

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
        aVal = a.currentKtcValue || 0;
        bVal = b.currentKtcValue || 0;
      } else if (sortColumn === 'valueChange') {
        aVal = a.valueGain ?? 0;
        bVal = b.valueGain ?? 0;
      } else if (sortColumn === 'pick') {
        aVal = a.pick || 0;
        bVal = b.pick || 0;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [draftPicks, sortColumn, sortDirection]);

  const draftPicksByYear = useMemo(() => {
    return sortedDraftPicks.reduce<Record<string, DraftPick[]>>((groups, pick) => {
      const year = pick.draftYear || 'Draft';
      groups[year] = groups[year] || [];
      groups[year].push(pick);
      return groups;
    }, {});
  }, [sortedDraftPicks]);
  const draftOpportunityByPick = useMemo(
    () => buildDraftOpportunityMap(draftPicks, managerRosterIntelligence || []),
    [draftPicks, managerRosterIntelligence]
  );
  const orderedDraftStats = useMemo(() => sortManagerDraftStatsByEfficiency(draftStats), [draftStats]);
  const draftYears = Object.keys(draftPicksByYear).sort((a, b) => Number(b) - Number(a));
  const draftDecisionAudits = useMemo(() => {
    return buildDraftDecisionAudits(sortedDraftPicks, managerRosterIntelligence || []);
  }, [sortedDraftPicks, managerRosterIntelligence]);
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
  const openManagerPortfolio = (manager: string) => {
    setSelectedManagerMode('portfolio');
    setSelectedManager(manager);
  };
  const openManagerAudit = (manager: string) => {
    setSelectedManagerMode('audit');
    setSelectedManager(manager);
  };
  const toggleDraftYear = (year: string) => {
    setOpenDraftYears((current) => {
      const next = new Set(current);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  const openDraftPlayer = (pick: DraftPick) => {
    setSelectedPlayer(enrichDraftPickDetails(
      pick,
      playerDetailsById,
      draftDecisionAuditByPick.get(getDraftPickKey(pick))
    ));
  };

  if (!draftPicks || draftPicks.length === 0) {
    return (
      <EmptyState
        className="draft-empty-state"
        title="No draft data available"
        description="Draft history will appear here after the league report includes completed rookie draft picks."
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Draft Capital Efficiency Leaderboard */}
      <DraftCollapsibleSection title="Draft Capital Efficiency" kicker="Hit rate first">
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
                      label="Avg Change"
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
        <DraftCollapsibleSection title="Draft Decision Audit" kicker="Most picks first">
          <div className="draft-decision-audit-note">
            Manager-level read on whether each draft stayed near the best dynasty values available. Roster need is only used as a tiebreaker after board value.
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
                        label="Avg Change"
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

      {/* Full Draft Board */}
      <section className="report-section">
        <div className="space-y-4">
          {draftYears.map((draftYear) => {
            const yearPicks = draftPicksByYear[draftYear] || [];
            const isDraftBoardOpen = openDraftYears.has(draftYear);

            return (
              <div key={draftYear}>
                <button
                  type="button"
                  className="draft-board-toggle group mx-auto mb-4 flex w-full max-w-xl items-center justify-between gap-4 rounded-xl border border-cyan-300/15 bg-slate-950/55 px-4 py-3 text-left shadow-lg shadow-black/20 transition hover:border-cyan-300/30 sm:px-5"
                  onClick={() => toggleDraftYear(draftYear)}
                  aria-expanded={isDraftBoardOpen}
                >
                  <span className="min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/80">
                      Picked players
                    </span>
                    <span className="athletic-headline mt-1 block truncate text-xl font-black text-orange-400 sm:text-2xl">
                      {draftYear} Rookie Draft
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-300">
                    {isDraftBoardOpen ? 'Hide' : `${yearPicks.length} Picks`}
                    <ChevronDown className={`h-5 w-5 text-orange-300 transition-transform ${isDraftBoardOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>

                {isDraftBoardOpen && (
                  <div className="rookie-draft-row-shell">
                    <div className="draft-sort-strip">
                      <button type="button" onClick={() => handleSort('pick')}>
                        Pick #
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleSort('currentValue')}>
                        Current Value
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
                      <span>Draft Value</span>
                      <span>Now</span>
                      <span>Now Value</span>
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
                              <DraftOpportunityNote opportunity={opportunity} />
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
                            <span className="rookie-draft-value-cell" data-label="Now">{pick.currentKtcValue ? pick.currentKtcValue.toLocaleString() : 'N/A'}</span>
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
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Manager Draft Picks Modal */}
      <ManagerDraftPicksModal
        isOpen={selectedManager !== null}
        onClose={() => setSelectedManager(null)}
        managerName={selectedManager || ''}
        managerDisplayName={selectedManager ? draftStats.find((stat) => stat.manager === selectedManager)?.managerDisplayName : undefined}
        draftPicks={selectedManagerMode === 'audit' ? draftPicksWithDecisionAudit : draftPicks}
        managerAvatarUrl={selectedManager ? managerAvatars?.[selectedManager] : null}
        playerDetailsById={playerDetailsById}
        mode={selectedManagerMode}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
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
  managerRosterIntelligence: ManagerRosterIntelligence[]
): DraftDecisionAudit[] {
  const intelByManager = new Map(managerRosterIntelligence.map((row) => [row.manager, row]));
  const byYear = draftPicks
    .filter((pick) => pick.player_id && pick.playerName && pick.playerName !== 'Unknown')
    .reduce<Record<string, DraftPick[]>>((groups, pick) => {
      const year = pick.draftYear || 'Draft';
      groups[year] = groups[year] || [];
      groups[year].push(pick);
      return groups;
    }, {});

  return Object.entries(byYear)
    .sort(([a], [b]) => Number(b) - Number(a))
    .flatMap(([, yearPicks]) => {
      const orderedPicks = [...yearPicks].sort((a, b) => a.pick - b.pick);
      return orderedPicks.map((pick) => buildDraftDecisionAudit(pick, orderedPicks, intelByManager.get(pick.manager) || null));
    });
}

function buildDraftDecisionAudit(
  pick: DraftPick,
  yearPicks: DraftPick[],
  intel: ManagerRosterIntelligence | null
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
}) {
  const draftedLabel = pick.positionRankMay2025 || pick.currentPositionRank || pick.playerPos;
  const boardPocket = boardRank <= 3 ? 'top board pocket' : boardRank <= 8 ? 'strong board pocket' : 'thin value pocket';
  const altValueGap = bestAvailableDelta > 0 ? `${bestAvailableDelta.toLocaleString()} value points` : 'roughly even value';

  if (verdict === 'Board + Fit') {
    return `${pick.playerName} was the clean kind of dynasty pick: board value first, roster fit second. ${draftedLabel} landed inside the ${boardPocket}, and ${needReason}`;
  }

  if (verdict === 'Fit Tiebreaker') {
    return `${pick.playerName} was close enough on value for roster context to matter. ${pickedPosition || pick.playerPos} helped the pressure profile, but this is still graded as a value-window pick first. ${needReason}`;
  }

  if (verdict === 'Value Pocket') {
    return `${pick.playerName} stayed in a reasonable value lane. ${draftedLabel} was not the top name left, but the gap to the board was small enough that manager preference is defensible.`;
  }

  if (verdict === 'Board Pick') {
    if (primaryNeed && !needMatch) {
      return `${pick.playerName} was the right kind of dynasty bet: take the value, then solve ${primaryNeed} later by trade. ${draftedLabel} still sat in the ${boardPocket}.`;
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
  const starterThresholds: Record<string, number> = { QB: 24, RB: 36, WR: 48, TE: 18 };
  if (position && Number.isFinite(rankNumber) && rankNumber <= (starterThresholds[position] || 0)) return true;
  return !rank && pick.currentKtcValue !== null && pick.currentKtcValue !== undefined && pick.currentKtcValue > 4000;
}

function enrichDraftPickDetails(
  pick: DraftPick,
  playerDetailsById?: Record<string, PlayerDetails>,
  audit?: DraftDecisionAudit
): PlayerModalData {
  const mappedDetails = pick.player_id ? playerDetailsById?.[pick.player_id] : undefined;
  const basePick = attachDraftDecisionAudit(pick, audit);
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
    },
  };
}

function DraftCollapsibleSection({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <details className="report-section report-disclosure">
      <summary className="report-disclosure-summary">
        <ReportSectionHeader title={title} kicker={kicker} />
        <ChevronDown className="report-disclosure-icon" aria-hidden="true" />
      </summary>
      <div className="report-disclosure-body">
        {children}
      </div>
    </details>
  );
}
