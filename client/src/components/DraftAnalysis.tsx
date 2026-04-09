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
import { TrendingUp, TrendingDown } from 'lucide-react';

interface DraftAnalysisProps {
  draftPicks: DraftPick[];
  draftStats: ManagerDraftStats[];
}

export function DraftAnalysis({ draftPicks, draftStats }: DraftAnalysisProps) {
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
          <Card className="bg-slate-900 border-slate-800 overflow-hidden w-full max-w-4xl">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-800/50">
                  <TableRow className="border-slate-700 hover:bg-slate-800/50">
                    <TableHead className="text-slate-300">Manager</TableHead>
                    <TableHead className="text-right text-slate-300">Picks</TableHead>
                    <TableHead className="text-right text-slate-300">Avg ADP Diff</TableHead>
                    <TableHead className="text-right text-slate-300">Reaches</TableHead>
                    <TableHead className="text-right text-slate-300">Falls</TableHead>
                    <TableHead className="text-right text-slate-300">Avg KTC Gain</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftStats.map((stat, idx) => (
                    <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/30">
                      <TableCell className="font-semibold text-slate-100">
                        {stat.manager}
                      </TableCell>
                      <TableCell className="text-right text-slate-300">
                        {stat.totalPicks}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-semibold ${
                            stat.avgAdpDiff > 0 ? 'text-orange-400' : 'text-green-400'
                          }`}
                        >
                          {stat.avgAdpDiff > 0 ? '+' : ''}
                          {Math.round(stat.avgAdpDiff)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-orange-400 font-semibold">
                        {stat.reachCount}
                      </TableCell>
                      <TableCell className="text-right text-green-400 font-semibold">
                        {stat.fallCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-semibold ${
                            stat.avgKtcGain >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {stat.avgKtcGain >= 0 ? '+' : ''}
                          {Math.round(stat.avgKtcGain).toLocaleString()}
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
        <h3 className="text-center text-2xl font-bold text-orange-400 mb-6">
          Full Draft Board
        </h3>
        <div className="flex justify-center">
          <Card className="bg-slate-900 border-slate-800 overflow-hidden w-full max-w-6xl">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-800/50">
                  <TableRow className="border-slate-700 hover:bg-slate-800/50">
                    <TableHead className="text-slate-300">Round</TableHead>
                    <TableHead className="text-slate-300">Pick</TableHead>
                    <TableHead className="text-slate-300">Player</TableHead>
                    <TableHead className="text-center text-slate-300">Pos</TableHead>
                    <TableHead className="text-slate-300">Manager</TableHead>
                    <TableHead className="text-right text-slate-300">Draft Pick Position</TableHead>
                    <TableHead className="text-right text-slate-300">Current KTC Value</TableHead>
                    <TableHead className="text-right text-slate-300">Value Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftPicks.map((pick, idx) => {
                    return (
                      <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/30">
                        <TableCell className="font-semibold text-slate-300">
                          {pick.round}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-300">
                          {pick.pick}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-100">
                          {pick.playerName}
                        </TableCell>
                        <TableCell className="text-center text-slate-400">
                          {pick.playerPos}
                        </TableCell>
                        <TableCell className="text-slate-400">{pick.manager}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-300">
                          {pick.pick}
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
    </div>
  );
}
