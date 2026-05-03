import { useState, useMemo, type ReactNode } from 'react';
import type { DraftPick, ManagerDraftStats, ManagerRosterIntelligence, PlayerDetails } from '@shared/types';
import { TrendingUp, TrendingDown, ArrowUpDown, ChevronDown } from 'lucide-react';
import { ManagerDraftPicksModal } from './ManagerDraftPicksModal';
import { PlayerDetailModal, type PlayerModalData } from './PlayerDetailModal';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { ChampionAvatarFrame, ManagerChampionshipPills } from './ManagerChampionships';
import { getTeamTileStyle } from '@/lib/teamTileStyle';
import { getPositionRankPillClass } from '@/lib/positionRank';
import { buildDraftOpportunityMap, getDraftPickKey, type DraftOpportunity } from '@/lib/draftOpportunity';

interface DraftAnalysisProps {
  draftPicks: DraftPick[];
  draftStats: ManagerDraftStats[];
  managerRosterIntelligence?: ManagerRosterIntelligence[];
  managerAvatars?: Record<string, string | null>;
  playerDetailsById?: Record<string, PlayerDetails>;
  leagueId?: string;
  leagueLogo?: string | null;
}

type SortColumn = 'currentValue' | 'valueChange' | null;
type SortDirection = 'asc' | 'desc';

export function DraftAnalysis({
  draftPicks,
  draftStats,
  managerRosterIntelligence,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
}: DraftAnalysisProps) {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [closedDraftYears, setClosedDraftYears] = useState<Set<string>>(new Set());

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, start with descending (highest to lowest)
      setSortColumn(column);
      setSortDirection('desc');
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

    const sorted = [...pickedOnly].sort((a, b) => {
      let aVal: number = 0;
      let bVal: number = 0;

      if (sortColumn === 'currentValue') {
        aVal = a.currentKtcValue || 0;
        bVal = b.currentKtcValue || 0;
      } else if (sortColumn === 'valueChange') {
        aVal = a.valueGain ?? 0;
        bVal = b.valueGain ?? 0;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }, [draftPicks, sortColumn, sortDirection]);

  const draftPicksByYear = useMemo(() => {
    return sortedDraftPicks.reduce<Record<string, DraftPick[]>>((groups, pick) => {
      const year = pick.draftYear || 'Draft';
      groups[year] = groups[year] || [];
      groups[year].push(pick);
      return groups;
    }, {});
  }, [sortedDraftPicks]);
  const draftOpportunityByPick = useMemo(() => buildDraftOpportunityMap(draftPicks), [draftPicks]);
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
  const toggleDraftYear = (year: string) => {
    setClosedDraftYears((current) => {
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
      <div className="text-center py-12">
        <p className="text-slate-400">No draft data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Draft Capital Efficiency Leaderboard */}
      <DraftCollapsibleSection title="Draft Capital Efficiency" kicker="Manager hit rate">
        <div className="owner-tile-shell">
          <div className="owner-tile-grid draft-efficiency-tile-grid">
            {draftStats.map((stat, idx) => {
              const avatarUrl = managerAvatars?.[stat.manager];
              return (
                <button
                  key={`${stat.manager}-${idx}`}
                  type="button"
                  className="owner-summary-tile"
                  onClick={() => setSelectedManager(stat.manager)}
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
                        <img src={avatarUrl} alt={stat.manager} className="owner-summary-avatar" />
                      ) : (
                        <span className="owner-summary-avatar">{stat.manager[0]?.toUpperCase() || '?'}</span>
                      )}
                    </ChampionAvatarFrame>
                    <span className="owner-summary-name-lockup">
                      <span className="owner-summary-name">{stat.manager}</span>
                      <ManagerChampionshipPills managerName={stat.manager} className="owner-summary-championships" />
                    </span>
                  </span>
                  <span className="owner-summary-metrics">
                    <span className="owner-metric-pill owner-metric-pill-info"><span>Picks</span><strong>{stat.totalPicks}</strong></span>
                    <span className="owner-metric-pill owner-metric-pill-good"><span>Hits</span><strong>{stat.hits}</strong></span>
                    <span className="owner-metric-pill owner-metric-pill-danger"><span>Misses</span><strong>{stat.misses}</strong></span>
                    <span className="owner-metric-pill owner-metric-pill-info"><span>Starters</span><strong>{stat.starters}</strong></span>
                    <span className={`owner-metric-pill ${stat.avgKtcGain >= 0 ? 'owner-metric-pill-good' : 'owner-metric-pill-danger'}`}>
                      <span>Avg Gain</span>
                      <strong>{stat.avgKtcGain >= 0 ? '+' : ''}{stat.avgKtcGain.toLocaleString()}</strong>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </DraftCollapsibleSection>

      {draftDecisionAudits.length > 0 && (
        <DraftCollapsibleSection title="Draft Decision Audit" kicker="Need vs board value">
          <div className="draft-decision-audit-note">
            Uses each manager&apos;s roster pressure points, the draft-window blend, and who was still available later in that rookie draft.
          </div>
          <div className="draft-decision-grid">
            {draftDecisionAudits.map((audit) => {
              const details = audit.pick.playerDetails || (audit.pick.player_id ? playerDetailsById?.[audit.pick.player_id] : undefined);
              return (
                <button
                  key={getDraftPickKey(audit.pick)}
                  type="button"
                  className={`player-team-tile draft-decision-card draft-decision-card-${audit.tone}`}
                  style={getTeamTileStyle(details?.team)}
                  onClick={() => openDraftPlayer(audit.pick)}
                >
                  <span className="draft-decision-topline">
                    <span className={`draft-decision-verdict draft-decision-verdict-${audit.tone}`}>
                      {audit.verdict}
                    </span>
                    <span className="draft-decision-pick">{audit.pick.draftYear} #{audit.pick.pick}</span>
                  </span>
                  <span className="draft-decision-main">
                    <PlayerNameWithHeadshot playerId={audit.pick.player_id} playerName={audit.pick.playerName} />
                    <span className="draft-decision-manager-line">
                      {managerAvatars?.[audit.pick.manager] ? (
                        <img
                          src={managerAvatars[audit.pick.manager] || ''}
                          alt=""
                          className="draft-decision-manager-avatar"
                        />
                      ) : (
                        <span className="draft-decision-manager-fallback" aria-hidden="true">
                          {audit.pick.manager.trim()[0]?.toUpperCase() || '?'}
                        </span>
                      )}
                      <span className="draft-decision-manager-name">{audit.pick.manager}</span>
                    </span>
                  </span>
                  <span className="draft-decision-pills">
                    <span className={getPositionRankPillClass(audit.pick.positionRankMay2025 || audit.pick.currentPositionRank || audit.pick.playerPos)}>
                      {audit.pick.positionRankMay2025 || audit.pick.currentPositionRank || audit.pick.playerPos}
                    </span>
                    <span>{audit.primaryNeed ? `Need: ${audit.primaryNeed}` : 'No Clear Need'}</span>
                    <span>{audit.boardRankLabel}</span>
                  </span>
                  <span className="draft-decision-copy">{audit.summary}</span>
                  {audit.alternative && (
                    <span className="draft-decision-alt">
                      <strong>{audit.alternative.label}</strong>
                      <span>{audit.alternative.playerName}</span>
                      {audit.alternative.position && <em>{audit.alternative.position}</em>}
                      {audit.alternative.pickLabel && <small>{audit.alternative.pickLabel}</small>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </DraftCollapsibleSection>
      )}

      {/* Full Draft Board */}
      <section className="report-section">
        <div className="space-y-4">
          {draftYears.map((draftYear) => {
            const yearPicks = draftPicksByYear[draftYear] || [];
            const isDraftBoardOpen = !closedDraftYears.has(draftYear);

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
                      <button type="button" onClick={() => handleSort('currentValue')}>
                        Current Blend
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleSort('valueChange')}>
                        Blend Gain
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="rookie-draft-row-header" aria-hidden="true">
                      <span>Player</span>
                      <span>Manager</span>
                      <span>Pick</span>
                      <span>Draft Blend</span>
                      <span>Now Blend</span>
                      <span>Gain</span>
                    </div>
                    <div className="rookie-draft-row-list">
                      {yearPicks.map((pick, idx) => {
                        const details = pick.playerDetails || (pick.player_id ? playerDetailsById?.[pick.player_id] : undefined);
                        const gainTone = (pick.valueGain ?? 0) > 0 ? 'text-emerald-300' : (pick.valueGain ?? 0) < 0 ? 'text-rose-300' : 'text-slate-300';
                        const gainClass = (pick.valueGain ?? 0) > 0 ? 'is-positive' : (pick.valueGain ?? 0) < 0 ? 'is-negative' : '';
                        const opportunity = draftOpportunityByPick[getDraftPickKey(pick)];
                        return (
                          <button
                            key={`${pick.draftYear}-${pick.pick}-${pick.player_id || idx}`}
                            type="button"
                            className="player-team-tile rookie-draft-row"
                            style={getTeamTileStyle(details?.team)}
                            onClick={() => openDraftPlayer(pick)}
                          >
                            <span className="rookie-draft-player-cell">
                              <PlayerNameWithHeadshot playerId={pick.player_id} playerName={pick.playerName} />
                              <DraftOpportunityNote opportunity={opportunity} />
                            </span>
                            <span className="rookie-draft-manager-cell">
                              <ManagerNameWithAvatar
                                avatarUrl={managerAvatars?.[pick.manager]}
                                managerName={pick.manager}
                              />
                            </span>
                            <span className="rookie-draft-pill" data-label="Pick">{pick.draftYear ? `${pick.draftYear} ` : ''}#{pick.pick}</span>
                            <span className="rookie-draft-value-cell" data-label="Draft Blend">{pick.ktcValue ? pick.ktcValue.toLocaleString() : 'N/A'}</span>
                            <span className="rookie-draft-value-cell" data-label="Now Blend">{pick.currentKtcValue ? pick.currentKtcValue.toLocaleString() : 'N/A'}</span>
                            <span className={`rookie-draft-gain-cell ${gainClass} ${gainTone}`} data-label="Gain">
                              {pick.valueGain !== null && pick.valueGain !== undefined
                                ? `${pick.valueGain > 0 ? '+' : ''}${pick.valueGain.toLocaleString()}`
                                : 'N/A'}
                              {pick.valueGain !== null && pick.valueGain !== undefined && pick.valueGain > 0 && <TrendingUp className="h-3.5 w-3.5" />}
                              {pick.valueGain !== null && pick.valueGain !== undefined && pick.valueGain < 0 && <TrendingDown className="h-3.5 w-3.5" />}
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
        draftPicks={draftPicks}
        managerAvatarUrl={selectedManager ? managerAvatars?.[selectedManager] : null}
        playerDetailsById={playerDetailsById}
        draftOpportunityByPick={draftOpportunityByPick}
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
  } | null;
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
  const needAlternativeDelta = bestNeedAvailable ? getDraftWindowValue(bestNeedAvailable) - pickedValue : 0;
  const boardRankLabel = boardRank <= 12 ? `Board #${boardRank}` : 'Board Reach';

  let verdict = 'Preference Pick';
  let tone: DraftDecisionTone = 'watch';
  if (needMatch && boardRank <= 5) {
    verdict = 'Need + Value';
    tone = 'win';
  } else if (needMatch) {
    verdict = bestAvailableDelta > 750 ? 'Need Reach' : 'Need Fit';
    tone = bestAvailableDelta > 750 ? 'watch' : 'need';
  } else if (primaryNeed && hasTrueNeedAlternative && needAlternativeDelta >= -450) {
    verdict = 'Need Miss';
    tone = 'watch';
  } else if (boardRank <= 3 || bestAvailableDelta <= 250) {
    verdict = 'Board Pick';
    tone = 'value';
  } else if (bestAvailableDelta > 850) {
    verdict = 'Passed Value';
    tone = 'watch';
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
    needAlternativeDelta,
    bestAvailable,
    bestNeedAvailable,
    hasTrueNeedAlternative,
    needReason,
  });

  const alternative = buildDraftAlternative(
    pick,
    bestAvailable,
    bestNeedAvailable,
    needMatch,
    primaryNeed,
    bestAvailableDelta,
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
  needAlternativeDelta,
  bestAvailable,
  bestNeedAvailable,
  hasTrueNeedAlternative,
  needReason,
}: {
  verdict: string;
  pick: DraftPick;
  primaryNeed: string | null;
  pickedPosition: string;
  needMatch: boolean;
  boardRank: number;
  bestAvailableDelta: number;
  needAlternativeDelta: number;
  bestAvailable: DraftPick | null;
  bestNeedAvailable: DraftPick | null;
  hasTrueNeedAlternative: boolean;
  needReason: string;
}) {
  const draftedLabel = pick.positionRankMay2025 || pick.currentPositionRank || pick.playerPos;
  const needLabel = primaryNeed ? `${primaryNeed} help` : 'pure board value';
  const boardPocket = boardRank <= 3 ? 'top board pocket' : boardRank <= 8 ? 'strong board pocket' : 'thin value pocket';
  const altValueGap = bestAvailableDelta > 0 ? `${bestAvailableDelta.toLocaleString()} blend points` : 'roughly even value';
  const needGap = needAlternativeDelta > 0 ? `${needAlternativeDelta.toLocaleString()} blend points` : 'about the same cost';

  if (verdict === 'Need + Value') {
    return `${pick.playerName} checked both boxes. ${draftedLabel} filled the roster's ${needLabel} while still landing inside the ${boardPocket}. ${needReason}`;
  }

  if (verdict === 'Need Fit') {
    return `${pick.playerName} was a roster-driven pick first. ${pickedPosition || pick.playerPos} addressed the team's clearest pressure point, and the board gap stayed manageable. ${needReason}`;
  }

  if (verdict === 'Need Reach') {
    return `${pick.playerName} was taken for roster fit, but the price stretched. ${pickedPosition || pick.playerPos} matched the need, yet the board left ${altValueGap} on the table. ${needReason}`;
  }

  if (verdict === 'Need Miss') {
    const missedName = bestNeedAvailable?.playerName || 'another need-fit option';
    return `${pick.playerName} did not attack the roster's clearest need. ${missedName} would have hit the ${primaryNeed} hole for ${needGap}. ${needReason}`;
  }

  if (verdict === 'Board Pick') {
    if (primaryNeed && !needMatch) {
      return `${pick.playerName} was mostly a value call. ${draftedLabel} still sat in the ${boardPocket}, but the roster still came away without solving the ${primaryNeed} hole. ${needReason}`;
    }
    return `${pick.playerName} was mostly a value call. The roster did not need to force a position here, and ${draftedLabel} still sat in the ${boardPocket} when this pick came up.`;
  }

  if (verdict === 'Passed Value') {
    const betterName = bestAvailable?.playerName || 'a stronger board value';
    if (primaryNeed && !needMatch && !hasTrueNeedAlternative) {
      return `${pick.playerName} did not solve the ${primaryNeed} need, and it also passed on better board value. ${betterName} graded ${altValueGap} better in the same draft window. ${needReason}`;
    }
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
  bestNeedAvailable: DraftPick | null,
  needMatch: boolean,
  primaryNeed: string | null,
  bestAvailableDelta: number,
  needAlternativeDelta: number,
  hasTrueNeedAlternative: boolean
): DraftDecisionAudit['alternative'] {
  const selectedAlternative = !needMatch && hasTrueNeedAlternative && bestNeedAvailable && needAlternativeDelta >= -450
    ? bestNeedAvailable
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
    : primaryNeed && !needMatch
      ? `Missed value while ${primaryNeed} stayed open:`
      : 'Best board alternative:';

  return {
    label,
    playerName: selectedAlternative.playerName,
    position: selectedAlternative.positionRankMay2025 || selectedAlternative.currentPositionRank || selectedAlternative.playerPos,
    pickLabel: `${selectedAlternative.draftYear || pick.draftYear || ''} #${selectedAlternative.pick}`.trim(),
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

function DraftSectionTitle({
  title,
  kicker,
}: {
  title: string;
  kicker?: string;
}) {
  return (
    <div className="mb-4 text-center sm:mb-5">
      {kicker && (
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
          {kicker}
        </p>
      )}
      <h3 className="athletic-headline mt-1 text-xl font-black text-orange-400 sm:text-2xl">
        {title}
      </h3>
    </div>
  );
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
    <details className="report-section report-disclosure" open>
      <summary className="report-disclosure-summary">
        <DraftSectionTitle title={title} kicker={kicker} />
        <ChevronDown className="report-disclosure-icon" aria-hidden="true" />
      </summary>
      <div className="report-disclosure-body">
        {children}
      </div>
    </details>
  );
}
