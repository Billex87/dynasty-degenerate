import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import React, { useState } from 'react';
import { ChevronDown, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReportData } from '@shared/types';

function getRankingColor(rank: number): string {
  // All rankings are white
  return 'text-white font-semibold';
}

export function ManagerRosterValueGrowthTable({
  data,
}: {
  data: ReportData['managerRosterValueGrowth'];
}) {
  return (
    <div className="flex justify-center">
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="text-white font-semibold">Manager</TableHead>
              <TableHead className="text-right text-white font-semibold"><div>2025</div><div>Value</div></TableHead>
              <TableHead className="text-right text-white font-semibold"><div>2026</div><div>Value</div></TableHead>
              <TableHead className="text-right text-white font-semibold"><div>Growth</div><div>%</div></TableHead>
              <TableHead className="text-right text-white font-semibold"><div>Projected</div><div>Rank</div></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/30">
                <TableCell className="font-semibold text-slate-100">{row.manager}</TableCell>
                <TableCell className="text-right text-slate-300">
                  {row.past_val.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-slate-300">
                  {row.total_val.toLocaleString()}
                </TableCell>
                <TableCell
                  className={`text-right font-semibold ${
                    row.growth >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {row.growth >= 0 ? '+' : ''}
                  {row.growth.toFixed(1)}%
                </TableCell>
                <TableCell className={`text-right ${getRankingColor(row.rank)}`}>#{row.rank}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

export function WeeklyMomentumTable({
  data,
  title,
}: {
  data: ReportData['weeklyRisers'];
  title: string;
}) {
  return (
    <div className="flex justify-center">
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="text-white font-semibold">Rank</TableHead>
              <TableHead className="text-white font-semibold">Player</TableHead>
              <TableHead className="text-white font-semibold">Position</TableHead>
              <TableHead className="text-white font-semibold">Manager</TableHead>
              <TableHead className="text-right text-white font-semibold"><div>Last</div><div>Week</div></TableHead>
              <TableHead className="text-right text-white font-semibold"><div>This</div><div>Week</div></TableHead>
              <TableHead className="text-right text-white font-semibold">Change</TableHead>
              <TableHead className="text-right text-white font-semibold">% Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/30">
                <TableCell className="font-semibold text-slate-300">#{idx + 1}</TableCell>
                <TableCell className="font-semibold text-slate-100">{row.name}</TableCell>
                <TableCell className="text-slate-400">{row.pos}</TableCell>
                <TableCell className="text-slate-400">{row.owner}</TableCell>
                <TableCell className="text-right text-slate-300">
                  {row.val_last.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-slate-300">
                  {row.val_now.toLocaleString()}
                </TableCell>
                <TableCell
                  className={`text-right font-semibold ${
                    row.diff >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {row.diff >= 0 ? '+' : ''}
                  {row.diff.toLocaleString()}
                </TableCell>
                <TableCell
                  className={`text-right font-semibold ${
                    row.pct_change >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {row.pct_change >= 0 ? '+' : ''}
                  {row.pct_change.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
    </div>
  );
}

export function LeagueOverviewTable({
  data,
}: {
  data: ReportData['leagueOverview'];
}) {
  return (
    <div className="flex justify-center">
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="text-white font-semibold">Manager</TableHead>
              <TableHead className="text-right text-white font-semibold"><div>Total</div><div>Value</div></TableHead>
              <TableHead className="text-center text-white font-semibold"><div>QB</div><div>Rank</div></TableHead>
              <TableHead className="text-center text-white font-semibold"><div>RB</div><div>Rank</div></TableHead>
              <TableHead className="text-center text-white font-semibold"><div>WR</div><div>Rank</div></TableHead>
              <TableHead className="text-center text-white font-semibold"><div>TE</div><div>Rank</div></TableHead>
              <TableHead className="text-center text-white font-semibold"><div>Value</div><div>Rank</div></TableHead>
              <TableHead className="text-center text-white font-semibold"><div>2027</div><div>Rank</div></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/30">
                <TableCell className="font-semibold text-slate-100">{row.manager}</TableCell>
                <TableCell className="text-right text-slate-300">
                  {row.total_val.toLocaleString()}
                </TableCell>
                <TableCell className={`text-center ${getRankingColor(row.rank_qb)}`}>#{row.rank_qb}</TableCell>
                <TableCell className={`text-center ${getRankingColor(row.rank_rb)}`}>#{row.rank_rb}</TableCell>
                <TableCell className={`text-center ${getRankingColor(row.rank_wr)}`}>#{row.rank_wr}</TableCell>
                <TableCell className={`text-center ${getRankingColor(row.rank_te)}`}>#{row.rank_te}</TableCell>
                <TableCell className={`text-center ${getRankingColor(row.rank_value)}`}>#{row.rank_value}</TableCell>
                <TableCell className={`text-center ${getRankingColor(row.rank_2027)}`}>#{row.rank_2027}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
    </div>
  );
}

export function ProjectedMoversTable({
  data,
  title,
}: {
  data: ReportData['projectedRisers'];
  title: string;
}) {
  return (
    <div className="flex justify-center">
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="text-white font-semibold">Rank</TableHead>
              <TableHead className="text-white font-semibold">Player</TableHead>
              <TableHead className="text-white font-semibold">Position</TableHead>
              <TableHead className="text-white font-semibold">Manager</TableHead>
              <TableHead className="text-right text-white font-semibold">Age</TableHead>
              <TableHead className="text-right text-white font-semibold">2026 Value</TableHead>
              <TableHead className="text-right text-white font-semibold">2027 Projection</TableHead>
              <TableHead className="text-right text-white font-semibold">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/30">
                <TableCell className="font-semibold text-slate-300">#{idx + 1}</TableCell>
                <TableCell className="font-semibold text-slate-100">{row.name}</TableCell>
                <TableCell className="text-slate-400">{row.pos}</TableCell>
                <TableCell className="text-slate-400">{row.owner}</TableCell>
                <TableCell className="text-right text-slate-300">
                  {row.age !== null ? row.age : 'N/A'}
                </TableCell>
                <TableCell className="text-right text-slate-300">
                  {row.val_2026.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-slate-300">
                  {row.val_2027.toLocaleString()}
                </TableCell>
                <TableCell
                  className={`text-right font-semibold ${
                    row.diff >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {row.diff >= 0 ? '+' : ''}
                  {row.diff.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
    </div>
  );
}

export function TradeProfitLeaderboardTable({
  data,
}: {
  data: ReportData['tradeProfitLeaderboard'];
}) {
  return (
    <div className="flex justify-center">
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="text-white font-semibold">Rank</TableHead>
              <TableHead className="text-white font-semibold">Manager</TableHead>
              <TableHead className="text-right text-white font-semibold"><div>Total</div><div>Profit</div></TableHead>
              <TableHead className="text-right text-white font-semibold">Trades</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.rank} className="border-slate-700 hover:bg-slate-800/30">
                <TableCell className="font-semibold text-slate-300">#{row.rank}</TableCell>
                <TableCell className="font-semibold text-slate-100">{row.manager}</TableCell>
                <TableCell
                  className={`text-right font-semibold ${
                    row.profit >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {row.profit >= 0 ? '+' : ''}
                  {row.profit.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-slate-300">{row.trade_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

export function TradeHistoryTable({
  data,
}: {
  data: ReportData['tradeHistory'];
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="flex justify-center">
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="w-8 text-white font-semibold"></TableHead>
              <TableHead className="text-white font-semibold">Date</TableHead>
              <TableHead className="text-white font-semibold">Team A</TableHead>
              <TableHead className="text-white font-semibold">Team B</TableHead>
              <TableHead className="text-right text-white font-semibold">A Total</TableHead>
              <TableHead className="text-right text-white font-semibold">B Total</TableHead>
              <TableHead className="text-center text-white font-semibold">Gap</TableHead>
              <TableHead className="text-center text-white font-semibold flex items-center justify-center gap-1"><span>👑</span> Winner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...data].reverse().map((row, idx) => {
              const isExpanded = expandedIdx === idx;
              const winnerColor =
                row.winner === row.team_a
                  ? 'text-purple-400'
                  : row.winner === row.team_b
                    ? 'text-amber-400'
                    : 'text-slate-400';
              const isTeamAWinner = row.winner === row.team_a;
              const isTeamBWinner = row.winner === row.team_b;
              const tradeKey = `${row.date}-${row.team_a}-${row.team_b}-${idx}`;

              return (
                <React.Fragment key={`${tradeKey}-fragment`}>
                  <TableRow
                    key={`${tradeKey}-main`}
                    className="border-slate-700 hover:bg-slate-800/30 cursor-pointer"
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  >
                    <TableCell className="text-slate-300">
                      <ChevronDown
                        size={18}
                        className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </TableCell>
                    <TableCell className="text-slate-300 text-sm">{row.date}</TableCell>
                    <TableCell className="text-blue-400 font-semibold text-sm">{row.team_a}</TableCell>
                    <TableCell className="text-orange-400 font-semibold text-sm">{row.team_b}</TableCell>
                    <TableCell className="text-right font-semibold text-blue-400">
                      {row.team_a_total.toLocaleString()}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${isTeamBWinner ? 'text-amber-300' : 'text-amber-400'}`}>
                      {row.team_b_total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center text-slate-300">
                      {row.point_gap.toLocaleString()}
                    </TableCell>
                    <TableCell className={`text-center font-bold text-sm px-3 py-2 rounded ${isTeamAWinner ? 'bg-blue-500/15 text-blue-400' : isTeamBWinner ? 'bg-orange-500/15 text-orange-400' : 'text-slate-400'}`}>
                      {row.winner}
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow key={`${tradeKey}-details`} className="border-slate-700 bg-slate-800/20">
                      <TableCell colSpan={8} className="p-6">
                        <div className="grid grid-cols-2 gap-8">
                          {/* Team A Details */}
                          <div className="space-y-3">
                            <h4 className="text-blue-400 font-semibold text-sm">{row.team_a}</h4>
                            <div className="bg-slate-800/50 rounded p-4 space-y-2">
                              <p className="text-slate-300 text-sm whitespace-pre-wrap">
                                {row.team_a_items}
                              </p>
                                <p className="text-blue-400 font-semibold text-sm border-t border-slate-700 pt-2">
                                Total: {row.team_a_total.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {/* Team B Details */}
                          <div className="space-y-3">
                            <h4 className="text-orange-400 font-semibold text-sm">{row.team_b}</h4>
                            <div className="bg-slate-800/50 rounded p-4 space-y-2">
                              <p className="text-slate-300 text-sm whitespace-pre-wrap">
                                {row.team_b_items}
                              </p>
                                <p className="text-orange-400 font-semibold text-sm border-t border-slate-700 pt-2">
                                Total: {row.team_b_total.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
    </div>
  );
}


export function PositionAnalysisTable({
  data,
}: {
  data: ReportData['positionDepth'];
}) {
  const shortages = data.filter(d => d.status === 'shortage');
  const excesses = data.filter(d => d.status === 'excess');

  return (
    <div className="space-y-8">
      {/* Shortages */}
      <div>
        <div className="flex items-center justify-center gap-2 mb-4">
          <TrendingDown className="w-5 h-5 text-red-400" />
          <h3 className="text-xl font-bold text-red-400 text-center">Position Shortages</h3>
        </div>
        {shortages.length > 0 ? (
          <div className="flex justify-center">
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-b-2 border-orange-500/30">
                  <TableRow className="border-slate-700">
                    <TableHead className="text-white font-semibold">Team</TableHead>
                    <TableHead className="text-white font-semibold">Position</TableHead>
                    <TableHead className="text-right text-white font-semibold">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shortages.map((row, idx) => (
                    <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/30">
                      <TableCell className="font-semibold text-slate-100">{row.manager}</TableCell>
                      <TableCell className="text-slate-400">{row.position}</TableCell>
                      <TableCell className="text-right text-red-400 font-semibold">{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </Card>
          </div>
        ) : (
          <div className="text-slate-400 text-center py-8">No position shortages detected</div>
        )}
      </div>

      {/* Excesses */}
      <div>
        <div className="flex items-center justify-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <h3 className="text-xl font-bold text-emerald-400 text-center">Position Excess</h3>
        </div>
        {excesses.length > 0 ? (
          <div className="flex justify-center">
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-b-2 border-orange-500/30">
                  <TableRow className="border-slate-700">
                    <TableHead className="text-white font-semibold">Team</TableHead>
                    <TableHead className="text-white font-semibold">Position</TableHead>
                    <TableHead className="text-right text-white font-semibold">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {excesses.map((row, idx) => (
                    <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/30">
                      <TableCell className="font-semibold text-slate-100">{row.manager}</TableCell>
                      <TableCell className="text-slate-400">{row.position}</TableCell>
                      <TableCell className="text-right text-emerald-400 font-semibold">{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </Card>
          </div>
        ) : (
          <div className="text-slate-400 text-center py-8">No position excess detected</div>
        )}
      </div>
    </div>
  );
}

export function SearchableWeeklyMomentumTable({
  data,
  title,
}: {
  data: ReportData['weeklyRisers'];
  title: string;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const filtered = data.filter(row =>
    row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.owner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder={`Search players or owners...`}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="bg-slate-900 border-orange-500/30 text-white placeholder:text-slate-500 focus:border-orange-400"
      />
      <WeeklyMomentumTable data={filtered} title={title} />
    </div>
  );
}

export function SearchableProjectedMoversTable({
  data,
  title,
}: {
  data: ReportData['projectedRisers'];
  title: string;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const filtered = data.filter(row =>
    row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.owner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder={`Search players or owners...`}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="bg-slate-900 border-orange-500/30 text-white placeholder:text-slate-500 focus:border-orange-400"
      />
      <ProjectedMoversTable data={filtered} title={title} />
    </div>
  );
}


export function ManagerPositionCountsTable({
  data,
}: {
  data: ReportData['managerPositionCounts'];
}) {
  return (
    <div className="flex justify-center">
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="border-b-2 border-orange-500/30">
              <TableRow className="border-slate-700">
                <TableHead className="text-white font-semibold">Manager</TableHead>
                <TableHead className="text-center text-white font-semibold">QB</TableHead>
                <TableHead className="text-center text-white font-semibold">RB</TableHead>
                <TableHead className="text-center text-white font-semibold">WR</TableHead>
                <TableHead className="text-center text-white font-semibold">TE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => (
                <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/30">
                  <TableCell className="font-semibold text-slate-100">{row.manager}</TableCell>
                  <TableCell className="text-center text-slate-300">{row.QB}</TableCell>
                  <TableCell className="text-center text-slate-300">{row.RB}</TableCell>
                  <TableCell className="text-center text-slate-300">{row.WR}</TableCell>
                  <TableCell className="text-center text-slate-300">{row.TE}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
