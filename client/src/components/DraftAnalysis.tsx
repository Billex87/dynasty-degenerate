import { useState, useMemo } from 'react';
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
import { TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
import { ManagerDraftPicksModal } from './ManagerDraftPicksModal';
import { PlayerDetailModal } from './PlayerDetailModal';

interface DraftAnalysisProps {
  draftPicks: DraftPick[];
  draftStats: ManagerDraftStats[];
}

type SortColumn = 'currentValue' | 'valueChange' | null;
type SortDirection = 'asc' | 'desc';

export function DraftAnalysis({ draftPicks, draftStats }: DraftAnalysisProps) {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<DraftPick | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
    if (!sortColumn) return draftPicks;

    const sorted = [...draftPicks].sort((a, b) => {
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

  if (!draftPicks || draftPicks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No draft data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Draft Capital Efficiency Leaderboard */}
      <div>
        <h3 className="text-center text-2xl font-bold text-orange-400 mb-6">
          Draft Capital Efficiency
        </h3>
        <div className="flex justify-center">
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-b-2 border-orange-500/30">
                  <TableRow className="border-slate-700">
                    <TableHead className="text-white font-semibold">Manager</TableHead>
                    <TableHead className="text-right text-white font-semibold">Picks</TableHead>
                    <TableHead className="text-right text-white font-semibold">Hits</TableHead>
                    <TableHead className="text-right text-white font-semibold">Misses</TableHead>
                    <TableHead className="text-right text-white font-semibold">Value</TableHead>
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
                        {stat.manager}
                      </TableCell>
                      <TableCell className="text-right text-slate-300">
                        {stat.totalPicks}
                      </TableCell>
                      <TableCell className="text-right text-green-400 font-semibold">
                        {stat.hits}
                      </TableCell>
                      <TableCell className="text-right text-red-400 font-semibold">
                        {stat.misses}
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
      </div>

      {/* Full Draft Board */}
      <div>
        {/* Get the draft year from the first pick */}
        {draftPicks.length > 0 && (
          <h3 className="text-center text-2xl font-bold text-orange-400 mb-6">
            {draftPicks[0].draftYear || '2025'} Rookie Draft
          </h3>
        )}
        <div className="flex justify-center">
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-b-2 border-orange-500/30">
                  <TableRow className="border-slate-700">
                    <TableHead className="text-white font-semibold">Pick</TableHead>
                    <TableHead className="text-white font-semibold">Player</TableHead>
                    <TableHead className="text-right text-white font-semibold"><div>Position</div><div>Change</div></TableHead>
                    <TableHead 
                      className="text-right text-white font-semibold cursor-pointer hover:text-orange-400 transition-colors"
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
                      className="text-right text-white font-semibold cursor-pointer hover:text-orange-400 transition-colors"
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
                  {sortedDraftPicks.map((pick, idx) => {
                    return (
                      <TableRow 
                        key={idx} 
                        className="border-slate-700 hover:bg-slate-800/30 cursor-pointer"
                        onClick={() => setSelectedPlayer(pick)}
                      >
                        <TableCell className="font-semibold text-slate-300">
                          {pick.pick}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-100">
                          <div className="flex items-center gap-3">
                            {pick.headshot_url && (
                              <img
                                src={pick.headshot_url}
                                alt={pick.playerName}
                                className="w-8 h-8 rounded-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <span>{pick.playerName}</span>
                          </div>
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
      </div>

      {/* Manager Draft Picks Modal */}
      <ManagerDraftPicksModal
        isOpen={selectedManager !== null}
        onClose={() => setSelectedManager(null)}
        managerName={selectedManager || ''}
        draftPicks={draftPicks}
      />

      {/* Player Detail Modal */}
      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
      />
    </div>
  );
}
