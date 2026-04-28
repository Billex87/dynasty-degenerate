import { useState, useMemo, type ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import type { DraftPick, ManagerDraftStats } from '@shared/types';
import { TrendingUp, TrendingDown, ArrowUpDown, ChevronDown } from 'lucide-react';
import { ManagerDraftPicksModal } from './ManagerDraftPicksModal';
import { PlayerDetailModal } from './PlayerDetailModal';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';

interface DraftAnalysisProps {
  draftPicks: DraftPick[];
  draftStats: ManagerDraftStats[];
  managerAvatars?: Record<string, string | null>;
  leagueId?: string;
  leagueLogo?: string | null;
}

type SortColumn = 'currentValue' | 'valueChange' | null;
type SortDirection = 'asc' | 'desc';

export function DraftAnalysis({ draftPicks, draftStats, managerAvatars, leagueId, leagueLogo }: DraftAnalysisProps) {
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
        <div className="flex justify-center">
          <Card className="report-card-polished bg-slate-900 border-slate-800 overflow-hidden">
            <div className="overflow-x-hidden">
              <Table
                className="report-table-polished draft-efficiency-table"
                containerClassName="overflow-x-hidden"
                style={{ tableLayout: 'fixed' }}
              >
                <TableHeader className="border-b-2 border-orange-500/30">
                  <TableRow className="border-slate-700">
                    <TableHead className="text-white font-semibold">Manager</TableHead>
                    <TableHead className="text-right text-white font-semibold">Picks</TableHead>
                    <TableHead className="text-right text-white font-semibold">Hits</TableHead>
                    <TableHead className="text-right text-white font-semibold">Misses</TableHead>
                    <TableHead className="text-right text-white font-semibold">Starters</TableHead>
                    <TableHead className="text-right text-white font-semibold">
                      <div>Avg</div>
                      <div>Gain</div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftStats.map((stat, idx) => (
                    <TableRow 
                      key={idx} 
                      className="border-slate-700 hover:bg-slate-800/30 cursor-pointer"
                      onClick={() => setSelectedManager(stat.manager)}
                    >
                      <TableCell className="font-semibold text-slate-100">
                        <ManagerNameWithAvatar
                          avatarUrl={managerAvatars?.[stat.manager]}
                          managerName={stat.manager}
                        />
                      </TableCell>
                      <TableCell className="text-right text-slate-300">
                        {stat.totalPicks}
                      </TableCell>
                      <TableCell className="text-right text-green-400 font-semibold">
                        <span className="value-pill value-pill-good">{stat.hits}</span>
                      </TableCell>
                      <TableCell className="text-right text-red-400 font-semibold">
                        <span className="value-pill value-pill-bad">{stat.misses}</span>
                      </TableCell>
                      <TableCell className="text-right text-blue-400 font-semibold">
                        <span className="value-pill value-pill-info">{stat.starters}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-semibold ${
                            stat.avgKtcGain >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {stat.avgKtcGain >= 0 ? '+' : ''}
                          {stat.avgKtcGain.toLocaleString()}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
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
                  <div className="flex justify-center">
            <Card className="report-card-polished draft-board-card bg-slate-900 border-slate-800 overflow-hidden">
            <div className="overflow-x-hidden">
              <Table
                className="report-table-polished rookie-draft-table w-full text-xs sm:text-sm"
                containerClassName="overflow-x-hidden"
                style={{ tableLayout: 'fixed' }}
              >
                <TableHeader className="border-b-2 border-orange-500/30">
                  <TableRow className="border-slate-700">
                    <TableHead className="w-[7%] text-white font-semibold">Pick</TableHead>
                    <TableHead className="w-[32%] text-white font-semibold">Player</TableHead>
                    <TableHead className="w-[17%] text-white font-semibold">Manager</TableHead>
                    <TableHead className="w-[14%] text-right text-white font-semibold"><div>Position</div><div>Change</div></TableHead>
                    <TableHead 
                      className="w-[15%] text-right text-white font-semibold cursor-pointer hover:text-orange-400 transition-colors"
                      onClick={() => handleSort('currentValue')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <div>
                          <div>Current</div>
                          <div>Value</div>
                        </div>
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="w-[15%] text-right text-white font-semibold cursor-pointer hover:text-orange-400 transition-colors"
                      onClick={() => handleSort('valueChange')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <div>
                          <div>Value</div>
                          <div>Change</div>
                        </div>
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearPicks.map((pick, idx) => {
                    return (
                      <TableRow
                        key={`${pick.draftYear}-${pick.pick}-${pick.player_id || idx}`}
                        className="rookie-draft-row border-slate-700 hover:bg-slate-800/30 cursor-pointer"
                        onClick={() => setSelectedPlayer(pick)}
                      >
                        <TableCell className="font-semibold text-slate-300">
                          {pick.pick}
                        </TableCell>
                        <TableCell className="min-w-0 font-semibold text-slate-100">
                          <div className="min-w-0">
                            <PlayerNameWithHeadshot playerId={pick.player_id} playerName={pick.playerName} />
                          </div>
                        </TableCell>
                        <TableCell className="rookie-draft-manager-cell min-w-0 font-semibold text-slate-100">
                          <ManagerNameWithAvatar
                            avatarUrl={managerAvatars?.[pick.manager]}
                            managerName={pick.manager}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {pick.positionRankChange ? (
                            <span
                              className={`font-semibold ${
                                pick.positionRankChange.startsWith('+') ? 'text-green-400' : pick.positionRankChange.startsWith('-') ? 'text-red-400' : 'text-slate-300'
                              }`}
                            >
                              {pick.positionRankChange}
                              {pick.positionRankChange.startsWith('+') && <TrendingUp className="inline ml-1 w-4 h-4" />}
                              {pick.positionRankChange.startsWith('-') && <TrendingDown className="inline ml-1 w-4 h-4" />}
                            </span>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {pick.currentKtcValue ? (
                            <span className="font-semibold text-slate-300">
                              {pick.currentKtcValue.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {pick.valueGain !== null && pick.valueGain !== undefined ? (
                            <span
                              className={`font-semibold ${
                                pick.valueGain > 0 ? 'text-green-400' : pick.valueGain < 0 ? 'text-red-400' : 'text-slate-300'
                              }`}
                            >
                              {pick.valueGain > 0 ? '+' : ''}
                              {pick.valueGain.toLocaleString()}
                              {pick.valueGain > 0 && <TrendingUp className="inline ml-1 w-4 h-4" />}
                              {pick.valueGain < 0 && <TrendingDown className="inline ml-1 w-4 h-4" />}
                            </span>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            </Card>
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
