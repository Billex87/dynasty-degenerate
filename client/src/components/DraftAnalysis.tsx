import { useState, useMemo, type ReactNode } from 'react';
import type { DraftPick, ManagerDraftStats, PlayerDetails } from '@shared/types';
import { TrendingUp, TrendingDown, ArrowUpDown, ChevronDown } from 'lucide-react';
import { ManagerDraftPicksModal } from './ManagerDraftPicksModal';
import { PlayerDetailModal } from './PlayerDetailModal';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { ChampionAvatarFrame, ManagerChampionshipPills } from './ManagerChampionships';
import { getTeamTileStyle } from '@/lib/teamTileStyle';

interface DraftAnalysisProps {
  draftPicks: DraftPick[];
  draftStats: ManagerDraftStats[];
  managerAvatars?: Record<string, string | null>;
  playerDetailsById?: Record<string, PlayerDetails>;
  leagueId?: string;
  leagueLogo?: string | null;
}

type SortColumn = 'currentValue' | 'valueChange' | null;
type SortDirection = 'asc' | 'desc';

export function DraftAnalysis({ draftPicks, draftStats, managerAvatars, playerDetailsById, leagueId, leagueLogo }: DraftAnalysisProps) {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<DraftPick | null>(null);
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
  const draftYears = Object.keys(draftPicksByYear).sort((a, b) => Number(b) - Number(a));
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
    setSelectedPlayer(enrichDraftPickDetails(pick, playerDetailsById));
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
                  <div className="player-tile-shell">
                    <div className="draft-sort-strip">
                      <button type="button" onClick={() => handleSort('currentValue')}>
                        Current Value
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleSort('valueChange')}>
                        Value Change
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="player-tile-grid rookie-player-grid">
                      {yearPicks.map((pick, idx) => {
                        const details = pick.playerDetails || (pick.player_id ? playerDetailsById?.[pick.player_id] : undefined);
                        const gainTone = (pick.valueGain ?? 0) > 0 ? 'text-emerald-300' : (pick.valueGain ?? 0) < 0 ? 'text-rose-300' : 'text-slate-300';
                        return (
                          <button
                            key={`${pick.draftYear}-${pick.pick}-${pick.player_id || idx}`}
                            type="button"
                            className="player-team-tile rookie-player-tile"
                            style={getTeamTileStyle(details?.team)}
                            onClick={() => openDraftPlayer(pick)}
                          >
                            <div className="player-tile-main">
                              <PlayerNameWithHeadshot playerId={pick.player_id} playerName={pick.playerName} />
                            </div>
                            <div className="player-tile-owner">
                              <ManagerNameWithAvatar
                                avatarUrl={managerAvatars?.[pick.manager]}
                                managerName={pick.manager}
                              />
                            </div>
                            <div className="player-tile-pills">
                              <span>{pick.draftYear ? `${pick.draftYear} ` : ''}#{pick.pick}</span>
                              <span>{details?.team || 'FA'}</span>
                              {pick.positionRankChange ? (
                                <span className={gainTone}>
                                  {pick.positionRankChange}
                                  {pick.positionRankChange.startsWith('+') && <TrendingUp className="ml-1 inline h-3.5 w-3.5" />}
                                  {pick.positionRankChange.startsWith('-') && <TrendingDown className="ml-1 inline h-3.5 w-3.5" />}
                                </span>
                              ) : null}
                            </div>
                            <div className="player-tile-value-strip">
                              <span>{pick.currentKtcValue ? pick.currentKtcValue.toLocaleString() : 'N/A'}</span>
                              <span>Gain</span>
                              <span className={gainTone}>
                                {pick.valueGain !== null && pick.valueGain !== undefined
                                  ? `${pick.valueGain > 0 ? '+' : ''}${pick.valueGain.toLocaleString()}`
                                  : 'N/A'}
                              </span>
                            </div>
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

function enrichDraftPickDetails(pick: DraftPick, playerDetailsById?: Record<string, PlayerDetails>): DraftPick {
  const mappedDetails = pick.player_id ? playerDetailsById?.[pick.player_id] : undefined;
  if (!mappedDetails) return pick;

  return {
    ...pick,
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
