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
import type { DraftPick, ReportData, TrendingPlayer } from '@shared/types';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { PlayerDetailModal, type PlayerModalData } from './PlayerDetailModal';

type ManagerAvatars = ReportData['managerAvatars'];
type PlayerDetailsById = ReportData['playerDetailsById'];
type CurrentPositionRankById = ReportData['currentPositionRankById'];

function buildPlayerModalData({
  playerId,
  playerName,
  playerPos,
  value,
  valueGain,
  playerDetailsById,
  playerDetails,
  manager,
  managerAvatarUrl,
  valueChangeNote,
  currentPositionRank,
}: {
  playerId?: string;
  playerName: string;
  playerPos?: string;
  value?: number | null;
  valueGain?: number | null;
  playerDetailsById?: PlayerDetailsById;
  playerDetails?: PlayerModalData['playerDetails'];
  manager?: string | null;
  managerAvatarUrl?: string | null;
  valueChangeNote?: string;
  currentPositionRank?: string | null;
}): PlayerModalData {
  const details = playerDetails || (playerId ? playerDetailsById?.[playerId] : undefined);
  return {
    player_id: playerId,
    playerName,
    playerPos: playerPos || details?.position,
    manager: manager || undefined,
    managerAvatarUrl,
    currentPositionRank,
    currentKtcValue: value ?? undefined,
    valueGain: valueGain ?? undefined,
    playerDetails: details,
    valueChangeNote,
  };
}

function renderManagerName(manager: string, managerAvatars?: ManagerAvatars) {
  return (
    <ManagerNameWithAvatar
      avatarUrl={managerAvatars?.[manager]}
      managerName={manager}
    />
  );
}

function parseTradePlayerItem(trimmed: string) {
  if (!trimmed.startsWith('PLAYER:')) return null;
  const payload = trimmed.replace('PLAYER:', '');
  const parts = payload.split('|');
  const [playerId, playerName, rawValue, rawTradeDateValue, tradeDate] = parts;
  const value = rawValue !== undefined && rawValue !== '' ? Number(rawValue) : null;
  const tradeDateValue = rawTradeDateValue !== undefined && rawTradeDateValue !== ''
    ? Number(rawTradeDateValue)
    : null;

  return {
    playerId,
    playerName,
    value: Number.isFinite(value) ? value : null,
    tradeDateValue: Number.isFinite(tradeDateValue) ? tradeDateValue : null,
    tradeDate: tradeDate || null,
  };
}

function parseValueAdjustmentItem(trimmed: string) {
  if (!trimmed.startsWith('VALUE_ADJUSTMENT:')) return null;
  const value = Number(trimmed.replace('VALUE_ADJUSTMENT:', '').replace('+', ''));
  return Number.isFinite(value) ? value : null;
}

function parseTradePickItem(trimmed: string) {
  if (!trimmed.startsWith('PICK:')) return null;
  const payload = trimmed.replace('PICK:', '');
  const [label, value] = payload.split('|');
  const match = label.match(/^(\d{4}) (.+) (\d+)(?:st|nd|rd|th)(?: \((\d+\.\d+)\))?$/);

  return {
    label,
    value: value ? Number(value) : null,
    draftYear: match?.[1] ?? null,
    originalOwner: match?.[2] ?? null,
    round: match?.[3] ? Number(match[3]) : null,
    pickNumber: match?.[4] ?? null,
  };
}

function findLandedPick(
  parsedPick: ReturnType<typeof parseTradePickItem>,
  draftPicks: DraftPick[]
) {
  if (!parsedPick?.draftYear || !parsedPick.originalOwner || !parsedPick.round) {
    return null;
  }

  return draftPicks.find(
    pick =>
      pick.draftYear === parsedPick.draftYear &&
      pick.round === parsedPick.round &&
      pick.originalOwner === parsedPick.originalOwner
  ) || null;
}

function renderTradeItem(
  item: string,
  key: number,
  {
    draftPicks = [],
    playerDetailsById,
    currentPositionRankById,
    onPlayerClick,
    manager,
    managerAvatarUrl,
  }: {
    draftPicks?: DraftPick[];
    playerDetailsById?: PlayerDetailsById;
    currentPositionRankById?: CurrentPositionRankById;
    onPlayerClick?: (player: PlayerModalData) => void;
    manager?: string;
    managerAvatarUrl?: string | null;
  } = {}
) {
  const trimmed = item.trim();
  if (!trimmed) return null;

  const valueAdjustment = parseValueAdjustmentItem(trimmed);
  if (valueAdjustment !== null) {
    return (
      <div key={key} className="flex items-center gap-2 text-xs text-blue-300">
        <span className="inline-flex h-6 items-center justify-center rounded bg-blue-500/15 px-2 font-semibold">
          STUD BOOST
        </span>
        <span>(+{valueAdjustment.toLocaleString()})</span>
      </div>
    );
  }

  const playerItem = parseTradePlayerItem(trimmed);
  if (playerItem) {
    const details = playerDetailsById?.[playerItem.playerId];
    const valueGain = playerItem.value !== null && playerItem.tradeDateValue !== null
      ? playerItem.value - playerItem.tradeDateValue
      : undefined;
    const content = (
      <>
        <PlayerNameWithHeadshot
          playerId={playerItem.playerId}
          playerName={playerItem.playerName}
        />
        {playerItem.value !== null && (
          <span className="text-xs text-slate-500">
            ({playerItem.value.toLocaleString()})
          </span>
        )}
      </>
    );

    return (
      <div key={key} className="flex items-center gap-2">
        {onPlayerClick ? (
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 text-left hover:text-orange-300"
            onClick={(event) => {
              event.stopPropagation();
              onPlayerClick(buildPlayerModalData({
                playerId: playerItem.playerId,
                playerName: playerItem.playerName,
                value: playerItem.value,
                valueGain,
                valueChangeNote: playerItem.tradeDate
                  ? `Change from this trade on ${playerItem.tradeDate} to today.`
                  : undefined,
                playerDetails: details,
                manager,
                managerAvatarUrl,
                currentPositionRank: currentPositionRankById?.[playerItem.playerId],
              }));
            }}
          >
            {content}
          </button>
        ) : (
          content
        )}
      </div>
    );
  }

  const pickItem = parseTradePickItem(trimmed);
  if (pickItem) {
    const landedPick = findLandedPick(pickItem, draftPicks);
    const landedValue = landedPick?.currentKtcValue ?? landedPick?.ktcValue ?? null;

    return (
      <div key={key} className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-orange-500/15 px-2 text-xs font-semibold text-orange-300">
            PICK
          </span>
          <span>{pickItem.label}</span>
          {pickItem.value !== null && (
            <span className="text-xs text-slate-500">
              ({pickItem.value.toLocaleString()})
            </span>
          )}
        </div>
        {landedPick && (
          <div className="ml-12 flex items-center gap-2 text-xs text-slate-400">
            <span>Landed:</span>
            {onPlayerClick ? (
              <button
                type="button"
                className="min-w-0 hover:text-orange-300"
                onClick={(event) => {
                  event.stopPropagation();
                  onPlayerClick({
                    ...landedPick,
                    manager: landedPick.manager || manager,
                    managerAvatarUrl,
                    currentPositionRank: landedPick.currentPositionRank || (landedPick.player_id ? currentPositionRankById?.[landedPick.player_id] : null),
                    playerDetails: landedPick.playerDetails || (landedPick.player_id ? playerDetailsById?.[landedPick.player_id] : undefined),
                  });
                }}
              >
                <PlayerNameWithHeadshot
                  playerId={landedPick.player_id}
                  playerName={landedPick.playerName}
                />
              </button>
            ) : (
              <PlayerNameWithHeadshot
                playerId={landedPick.player_id}
                playerName={landedPick.playerName}
              />
            )}
            {landedValue !== null && (
              <span className="text-slate-500">
                {landedValue.toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div key={key} className="flex items-center gap-2">
      <PlayerNameWithHeadshot playerName={trimmed} />
    </div>
  );
}

function getRankingColor(rank: number): string {
  // All rankings are white
  return 'text-white font-semibold';
}

export function ManagerRosterValueGrowthTable({
  data,
  managerAvatars,
}: {
  data: ReportData['managerRosterValueGrowth'];
  managerAvatars?: ManagerAvatars;
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
                <TableCell className="font-semibold text-slate-100">
                  {renderManagerName(row.manager, managerAvatars)}
                </TableCell>
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
  managerAvatars,
  leagueId,
  leagueLogo,
}: {
  data: ReportData['weeklyRisers'];
  title: string;
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);

  return (
    <div className="flex justify-center">
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
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
            {data.map((row) => (
              <TableRow
                key={`${row.player_id || row.name}-${row.owner}`}
                className="cursor-pointer border-slate-700 hover:bg-slate-800/30"
                onClick={() => setSelectedPlayer(buildPlayerModalData({
                  playerId: row.player_id,
                  playerName: row.name,
                  playerPos: row.pos,
                  value: row.val_now,
                  valueGain: row.diff,
                  playerDetails: row.playerDetails,
                  manager: row.owner,
                  managerAvatarUrl: managerAvatars?.[row.owner],
                  currentPositionRank: row.currentPositionRank,
                  valueChangeNote: 'Change from last week to this week.',
                }))}
              >
                <TableCell className="font-semibold text-slate-100">
                  <PlayerNameWithHeadshot playerId={row.player_id} playerName={row.name} />
                </TableCell>
                <TableCell className="text-slate-400">{row.pos}</TableCell>
                <TableCell className="text-slate-400">
                  {renderManagerName(row.owner, managerAvatars)}
                </TableCell>
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

export function LeagueOverviewTable({
  data,
  managerAvatars,
}: {
  data: ReportData['leagueOverview'];
  managerAvatars?: ManagerAvatars;
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
                <TableCell className="font-semibold text-slate-100">
                  {renderManagerName(row.manager, managerAvatars)}
                </TableCell>
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

export function TrendingPlayersTable({
  data,
  title,
  countLabel,
  managerAvatars,
  leagueId,
  leagueLogo,
}: {
  data: TrendingPlayer[];
  title: string;
  countLabel: 'Adds' | 'Drops';
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);

  return (
    <div className="flex justify-center">
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="border-b-2 border-orange-500/30">
              <TableRow className="border-slate-700">
                <TableHead className="text-white font-semibold">Player</TableHead>
                <TableHead className="text-white font-semibold">Position</TableHead>
                <TableHead className="text-white font-semibold">Team</TableHead>
                <TableHead className="text-white font-semibold">Manager</TableHead>
                <TableHead className="text-right text-white font-semibold">{countLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow
                  key={row.player_id}
                  className="cursor-pointer border-slate-700 hover:bg-slate-800/30"
                  onClick={() => setSelectedPlayer(buildPlayerModalData({
                    playerId: row.player_id,
                    playerName: row.name,
                    playerPos: row.pos,
                    value: row.ktcValue,
                    playerDetails: row.playerDetails,
                    currentPositionRank: row.currentPositionRank,
                    manager: row.owner || null,
                    managerAvatarUrl: row.owner ? managerAvatars?.[row.owner] : null,
                  }))}
                >
                  <TableCell className="font-semibold text-slate-100">
                    <PlayerNameWithHeadshot playerId={row.player_id} playerName={row.name} />
                  </TableCell>
                  <TableCell className="text-slate-400">{row.pos}</TableCell>
                  <TableCell className="text-slate-400">{row.team || 'FA'}</TableCell>
                  <TableCell className="text-slate-400">
                    {row.owner ? renderManagerName(row.owner, managerAvatars) : 'Available'}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-slate-300">{row.count.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow className="border-slate-700">
                  <TableCell colSpan={5} className="py-6 text-center text-slate-500">
                    No {title.toLowerCase()} available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
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

export function ProjectedMoversTable({
  data,
  title,
  managerAvatars,
  leagueId,
  leagueLogo,
}: {
  data: ReportData['projectedRisers'];
  title: string;
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);

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
              <TableRow
                key={idx}
                className="cursor-pointer border-slate-700 hover:bg-slate-800/30"
                onClick={() => setSelectedPlayer(buildPlayerModalData({
                  playerId: row.player_id,
                  playerName: row.name,
                  playerPos: row.pos,
                  value: row.val_2026,
                  valueGain: row.diff,
                  playerDetails: row.playerDetails,
                  manager: row.owner,
                  managerAvatarUrl: managerAvatars?.[row.owner],
                  currentPositionRank: row.currentPositionRank,
                  valueChangeNote: 'Projected change from current value to next year’s value.',
                }))}
              >
                <TableCell className="font-semibold text-slate-300">#{idx + 1}</TableCell>
                <TableCell className="font-semibold text-slate-100">
                  <PlayerNameWithHeadshot playerId={row.player_id} playerName={row.name} />
                </TableCell>
                <TableCell className="text-slate-400">{row.pos}</TableCell>
                <TableCell className="text-slate-400">
                  {renderManagerName(row.owner, managerAvatars)}
                </TableCell>
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

export function TradeProfitLeaderboardTable({
  data,
  managerAvatars,
}: {
  data: ReportData['tradeProfitLeaderboard'];
  managerAvatars?: ManagerAvatars;
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
                <TableCell className="font-semibold text-slate-100">
                  {renderManagerName(row.manager, managerAvatars)}
                </TableCell>
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
  draftPicks = [],
  managerAvatars,
  playerDetailsById,
  currentPositionRankById,
  leagueId,
  leagueLogo,
}: {
  data: ReportData['tradeHistory'];
  draftPicks?: DraftPick[];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  currentPositionRankById?: CurrentPositionRankById;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);

  return (
    <div className="flex justify-center">
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="text-white font-semibold">Date</TableHead>
              <TableHead className="text-white font-semibold">Winner</TableHead>
              <TableHead className="text-white font-semibold">Loser</TableHead>
              <TableHead className="text-center text-white font-semibold">Gap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...data].reverse().map((row, idx) => {
              const isExpanded = expandedIdx === idx;
              const winnerSide = row.winner === row.team_b ? 'team_b' : 'team_a';
              const loserName = winnerSide === 'team_a' ? row.team_b : row.team_a;
              const leftSide = winnerSide === 'team_a'
                ? {
                    manager: row.team_a,
                    items: row.team_a_items,
                    total: row.team_a_total,
                  }
                : {
                    manager: row.team_b,
                    items: row.team_b_items,
                    total: row.team_b_total,
                  };
              const rightSide = winnerSide === 'team_a'
                ? {
                    manager: row.team_b,
                    items: row.team_b_items,
                    total: row.team_b_total,
                  }
                : {
                    manager: row.team_a,
                    items: row.team_a_items,
                    total: row.team_a_total,
                  };
              const tradeKey = `${row.date}-${row.team_a}-${row.team_b}-${idx}`;

              return (
                <React.Fragment key={`${tradeKey}-fragment`}>
                  <TableRow
                    key={`${tradeKey}-main`}
                    className="border-slate-700 hover:bg-slate-800/30 cursor-pointer"
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  >
                    <TableCell className="text-slate-300 text-sm">{row.date}</TableCell>
                    <TableCell className={`font-semibold text-sm ${row.winner === row.team_a ? 'text-blue-400' : 'text-orange-400'}`}>
                      {renderManagerName(row.winner, managerAvatars)}
                    </TableCell>
                    <TableCell className={`font-semibold text-sm ${row.winner === row.team_a ? 'text-orange-400' : 'text-blue-400'}`}>
                      {renderManagerName(loserName, managerAvatars)}
                    </TableCell>
                    <TableCell className="text-center text-slate-300">
                      {row.point_gap.toLocaleString()}
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow key={`${tradeKey}-details`} className="border-slate-700 bg-slate-800/20">
                      <TableCell colSpan={4} className="p-6">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                          {/* Winner Details */}
                          <div className="space-y-3">
                            <h4 className="text-blue-400 font-semibold text-sm">
                              {renderManagerName(leftSide.manager, managerAvatars)}
                            </h4>
                            <div className="bg-slate-800/50 rounded p-4 space-y-2">
                              <div className="text-slate-300 text-sm space-y-1">
                                {leftSide.items
                                  .split(',')
                                  .map((item, i) => renderTradeItem(item, i, {
                                    draftPicks,
                                    playerDetailsById,
                                    currentPositionRankById,
                                    onPlayerClick: setSelectedPlayer,
                                    manager: leftSide.manager,
                                    managerAvatarUrl: managerAvatars?.[leftSide.manager],
                                  }))}
                              </div>
                              <p className="text-blue-400 font-semibold text-sm border-t border-slate-700 pt-2">
                                Total: {leftSide.total.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {/* Loser Details */}
                          <div className="space-y-3">
                            <h4 className="text-orange-400 font-semibold text-sm">
                              {renderManagerName(rightSide.manager, managerAvatars)}
                            </h4>
                            <div className="bg-slate-800/50 rounded p-4 space-y-2">
                              <div className="text-slate-300 text-sm space-y-1">
                                {rightSide.items
                                  .split(',')
                                  .map((item, i) => renderTradeItem(item, i, {
                                    draftPicks,
                                    playerDetailsById,
                                    currentPositionRankById,
                                    onPlayerClick: setSelectedPlayer,
                                    manager: rightSide.manager,
                                    managerAvatarUrl: managerAvatars?.[rightSide.manager],
                                  }))}
                              </div>
                              <p className="text-orange-400 font-semibold text-sm border-t border-slate-700 pt-2">
                                Total: {rightSide.total.toLocaleString()}
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


export function PositionAnalysisTable({
  data,
  managerAvatars,
}: {
  data: ReportData['positionDepth'];
  managerAvatars?: ManagerAvatars;
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
                      <TableCell className="font-semibold text-slate-100">
                        {renderManagerName(row.manager, managerAvatars)}
                      </TableCell>
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
                      <TableCell className="font-semibold text-slate-100">
                        {renderManagerName(row.manager, managerAvatars)}
                      </TableCell>
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
  managerAvatars,
}: {
  data: ReportData['managerPositionCounts'];
  managerAvatars?: ManagerAvatars;
}) {
  return (
    <div className="flex justify-center">
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="border-b-2 border-orange-500/30">
              <TableRow className="border-slate-700">
                <TableHead className="text-white font-semibold">
                  <div>Manager</div>
                  <div className="text-xs font-semibold text-blue-400">Starters</div>
                </TableHead>
                <TableHead className="text-center text-white font-semibold text-xs">QB</TableHead>
                <TableHead className="text-center text-white font-semibold text-xs">RB</TableHead>
                <TableHead className="text-center text-white font-semibold text-xs">WR</TableHead>
                <TableHead className="text-center text-white font-semibold text-xs">TE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => (
                <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/30">
                  <TableCell className="font-semibold text-slate-100">
                    {renderManagerName(row.manager, managerAvatars)}
                  </TableCell>
                  <TableCell className="text-center text-slate-300 text-sm">
                    <div>{row.QB}</div>
                    <div className="text-blue-400 text-xs">{row.QB_starters}</div>
                  </TableCell>
                  <TableCell className="text-center text-slate-300 text-sm">
                    <div>{row.RB}</div>
                    <div className="text-blue-400 text-xs">{row.RB_starters}</div>
                  </TableCell>
                  <TableCell className="text-center text-slate-300 text-sm">
                    <div>{row.WR}</div>
                    <div className="text-blue-400 text-xs">{row.WR_starters}</div>
                  </TableCell>
                  <TableCell className="text-center text-slate-300 text-sm">
                    <div>{row.TE}</div>
                    <div className="text-blue-400 text-xs">{row.TE_starters}</div>
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
