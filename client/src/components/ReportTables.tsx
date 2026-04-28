import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ChevronDown, Crown, TrendingDown, TrendingUp } from 'lucide-react';
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

function formatStarterStatus(status: string | number | null | undefined): string {
  if (status === null || status === undefined || status === '') return 'Active';
  return String(status).replace(/_/g, ' ');
}

function stableTradeSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function renderTradeSummaryManager(
  manager: string,
  isWinner: boolean,
  managerAvatars?: ManagerAvatars,
) {
  const avatarUrl = managerAvatars?.[manager];
  const initial = manager.trim()[0]?.toUpperCase() || '?';

  return (
    <span className={`trade-mobile-manager ${isWinner ? 'trade-mobile-winner' : 'trade-mobile-loser'}`}>
      <span className="manager-chip flex min-w-0 items-center gap-2">
        <span className="trade-mobile-avatar-wrap">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={manager}
              className="h-7 w-7 flex-shrink-0 rounded-full border border-cyan-300/30 object-cover shadow-sm shadow-black/30"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-slate-800 text-[11px] font-bold text-orange-300"
            >
              {initial}
            </span>
          )}
          {isWinner && <Crown className="trade-winner-crown" aria-hidden="true" />}
        </span>
        <span className="min-w-0 truncate">{manager}</span>
      </span>
    </span>
  );
}

function renderTradeSideManager(
  manager: string,
  isWinner: boolean,
  managerAvatars?: ManagerAvatars,
) {
  const avatarUrl = managerAvatars?.[manager];
  const initial = manager.trim()[0]?.toUpperCase() || '?';

  return (
    <span className={`trade-side-manager ${isWinner ? 'trade-side-manager-winner' : 'trade-side-manager-other'}`}>
      <span className="trade-mobile-avatar-wrap">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={manager}
            className="h-7 w-7 flex-shrink-0 rounded-full border border-cyan-300/30 object-cover shadow-sm shadow-black/30"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-slate-800 text-[11px] font-bold text-orange-300"
          >
            {initial}
          </span>
        )}
        {isWinner && <Crown className="trade-winner-crown" aria-hidden="true" />}
      </span>
      <span className="min-w-0 truncate">{manager}</span>
    </span>
  );
}

function getTradeGapVerdict(gap: number) {
  if (gap === 0) return { label: 'Even Steven', className: 'trade-gap-verdict-even' };
  if (gap < 100) return { label: 'Coin Flip', className: 'trade-gap-verdict-even' };
  if (gap < 200) return { label: 'Tiny Tax', className: 'trade-gap-verdict-soft' };
  if (gap < 350) return { label: 'Tip Jar', className: 'trade-gap-verdict-soft' };
  if (gap < 500) return { label: 'Pocket Change', className: 'trade-gap-verdict-soft' };
  if (gap < 650) return { label: 'Lunch Money', className: 'trade-gap-verdict-medium' };
  if (gap < 800) return { label: 'Got Finessed', className: 'trade-gap-verdict-medium' };
  if (gap < 1000) return { label: 'Sneaky L', className: 'trade-gap-verdict-medium' };
  if (gap < 1250) return { label: 'Ouch Tax', className: 'trade-gap-verdict-hot' };
  if (gap < 1500) return { label: 'Got Robbed', className: 'trade-gap-verdict-hot' };
  if (gap < 1750) return { label: 'Trade Mugging', className: 'trade-gap-verdict-hot' };
  if (gap < 2000) return { label: 'Hide the Chat', className: 'trade-gap-verdict-hot' };
  if (gap < 2250) return { label: 'Call 911', className: 'trade-gap-verdict-fire' };
  if (gap < 2500) return { label: 'League Probe', className: 'trade-gap-verdict-fire' };
  if (gap < 2750) return { label: 'Veto Bait', className: 'trade-gap-verdict-fire' };
  if (gap < 3000) return { label: 'Receipts Needed', className: 'trade-gap-verdict-fire' };
  if (gap < 3500) return { label: 'Crime Scene', className: 'trade-gap-verdict-nuclear' };
  if (gap < 4000) return { label: 'Witness Needed', className: 'trade-gap-verdict-nuclear' };
  if (gap < 5000) return { label: 'Delete the App', className: 'trade-gap-verdict-nuclear' };
  return { label: 'Gen Fleece', className: 'trade-gap-verdict-nuclear' };
}

function getManagerTradeSwing(trade: ReportData['tradeHistory'][number], manager: string) {
  if (trade.team_a === manager) return trade.team_a_total - trade.team_b_total;
  if (trade.team_b === manager) return trade.team_b_total - trade.team_a_total;
  return 0;
}

function getTradeOpponent(trade: ReportData['tradeHistory'][number], manager: string) {
  return trade.team_a === manager ? trade.team_b : trade.team_a;
}

function getManagerTradeResult(trade: ReportData['tradeHistory'][number], manager: string) {
  const winners = trade.winners?.length ? trade.winners : [trade.winner];
  if (winners.length > 1 && winners.includes(manager)) return 'Even Win';
  return winners.includes(manager) ? 'Win' : 'Loss';
}

function getTradeDisplaySides(row: ReportData['tradeHistory'][number]) {
  const winners = row.winners?.length ? row.winners : [row.winner];
  const isTeamAWinner = winners.includes(row.team_a);
  const isTeamBWinner = winners.includes(row.team_b);
  const isMutualWin = isTeamAWinner && isTeamBWinner;
  const winnerSide = isTeamBWinner && !isTeamAWinner ? 'team_b' : 'team_a';
  const loserName = isMutualWin
    ? 'Both Win'
    : winnerSide === 'team_a' ? row.team_b : row.team_a;
  const leftSide = isMutualWin
    ? {
        manager: row.team_a,
        items: row.team_a_items,
        total: row.team_a_total,
        isWinner: true,
      }
    : winnerSide === 'team_a'
    ? {
        manager: row.team_a,
        items: row.team_a_items,
        total: row.team_a_total,
        isWinner: true,
      }
    : {
        manager: row.team_b,
        items: row.team_b_items,
        total: row.team_b_total,
        isWinner: true,
      };
  const rightSide = isMutualWin
    ? {
        manager: row.team_b,
        items: row.team_b_items,
        total: row.team_b_total,
        isWinner: true,
      }
    : winnerSide === 'team_a'
    ? {
        manager: row.team_b,
        items: row.team_b_items,
        total: row.team_b_total,
        isWinner: false,
      }
    : {
        manager: row.team_a,
        items: row.team_a_items,
        total: row.team_a_total,
        isWinner: false,
      };

  return { winners, loserName, leftSide, rightSide };
}

function TradeDetailPanel({
  row,
  draftPicks = [],
  managerAvatars,
  playerDetailsById,
  currentPositionRankById,
  onPlayerClick,
}: {
  row: ReportData['tradeHistory'][number];
  draftPicks?: DraftPick[];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  currentPositionRankById?: CurrentPositionRankById;
  onPlayerClick?: (player: PlayerModalData) => void;
}) {
  const { leftSide, rightSide } = getTradeDisplaySides(row);

  return (
    <div className="trade-detail-panel">
      <div className="trade-detail-header">
        <div>
          <div className="trade-detail-title">Trade Ledger</div>
        </div>
        <div className="trade-detail-gap">
          <span>Gap</span>
          <strong>{row.point_gap.toLocaleString()}</strong>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {[leftSide, rightSide].map((side) => (
          <div
            key={side.manager}
            className={`trade-side ${side.isWinner ? 'trade-side-winner' : 'trade-side-loser'}`}
          >
            {managerAvatars?.[side.manager] && (
              <img
                src={managerAvatars[side.manager] || ''}
                alt=""
                className="trade-side-watermark"
              />
            )}
            <div className="relative flex items-center justify-between gap-3 border-b border-orange-300/15 pb-3">
              <div className="min-w-0">
                <span className={`trade-side-label ${side.isWinner ? 'trade-side-label-win' : 'trade-side-label-other'}`}>
                  {side.isWinner ? 'Winner' : 'Other Side'}
                </span>
              </div>
              {renderTradeSideManager(side.manager, side.isWinner, managerAvatars)}
              <div className={`trade-side-total ${side.isWinner ? 'trade-side-total-win' : 'trade-side-total-other'}`}>
                <span>Total</span>
                <strong>{side.total.toLocaleString()}</strong>
              </div>
            </div>
            <div className="relative space-y-2 pt-3">
              <div className="space-y-2 text-sm text-slate-300">
                {side.items
                  .split(',')
                  .map((item, i) => renderTradeItem(item, i, {
                    draftPicks,
                    playerDetailsById,
                    currentPositionRankById,
                    onPlayerClick,
                    manager: side.manager,
                    managerAvatarUrl: managerAvatars?.[side.manager],
                  }))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
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
      <div key={key} className="trade-asset trade-asset-boost">
        <span className="inline-flex h-6 items-center justify-center rounded-md bg-blue-500/15 px-2 font-black">
          STUD BOOST
        </span>
        <span>+{valueAdjustment.toLocaleString()}</span>
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
          <span className="value-pill">
            {playerItem.value.toLocaleString()}
          </span>
        )}
      </>
    );

    return (
      <div key={key} className="trade-asset">
        {onPlayerClick ? (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left hover:text-orange-300"
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
      <div key={key} className="trade-asset-block">
        <div className="trade-asset">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-orange-500/15 px-2 text-xs font-black text-orange-300">
            PICK
          </span>
          <span className="min-w-0 flex-1 truncate">{pickItem.label}</span>
          {pickItem.value !== null && (
            <span className="value-pill">
              {pickItem.value.toLocaleString()}
            </span>
          )}
        </div>
        {landedPick && (
          <div className="ml-2 mt-2 flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-950/45 px-3 py-2 text-xs text-slate-400 sm:ml-10">
            <span className="font-bold uppercase tracking-[0.12em] text-cyan-300/80">Landed</span>
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
      <Card className="report-card-polished bg-slate-900 border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="report-table-polished roster-growth-table">
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="overview-manager-heading text-white font-semibold">Manager</TableHead>
              <TableHead className="text-right text-white font-semibold"><div>2025</div><div>Value</div></TableHead>
              <TableHead className="text-right text-white font-semibold"><div>2026</div><div>Value</div></TableHead>
              <TableHead className="text-right text-white font-semibold"><div>Growth</div><div>%</div></TableHead>
              <TableHead className="text-right text-white font-semibold"><div>Projected</div><div>Rank</div></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/30">
                <TableCell className="overview-manager-cell font-semibold text-slate-100">
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
      <Card className="report-card-polished bg-slate-900 border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="report-table-polished weekly-momentum-table">
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="text-white font-semibold">Player</TableHead>
              <TableHead className="mobile-icon-manager-heading text-white font-semibold">Manager</TableHead>
              <TableHead className="text-right text-white font-semibold"><div>Last</div><div>Week</div></TableHead>
              <TableHead className="text-right text-white font-semibold"><div>This</div><div>Week</div></TableHead>
              <TableHead className="text-right text-white font-semibold">Change</TableHead>
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
                <TableCell className="weekly-manager-cell text-center text-slate-400">
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
      <Card className="report-card-polished bg-slate-900 border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="report-table-polished league-overview-table">
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="overview-manager-heading text-white font-semibold">Manager</TableHead>
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
                <TableCell className="overview-manager-cell font-semibold text-slate-100">
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
      <Card className="report-card-polished bg-slate-900 border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table
            className="trending-players-table momentum-trending-table w-full text-xs sm:text-sm"
            style={{ tableLayout: 'fixed' }}
          >
            <TableHeader className="border-b-2 border-orange-500/30">
              <TableRow className="border-slate-700">
                <TableHead className="trending-player-heading text-white font-semibold">Player</TableHead>
                <TableHead className="trending-pos-heading text-center text-white font-semibold">Position</TableHead>
                <TableHead className="trending-team-heading text-center text-white font-semibold">Team</TableHead>
                <TableHead className="mobile-icon-manager-heading text-white font-semibold">Manager</TableHead>
                <TableHead className="trending-count-heading text-right text-white font-semibold">{countLabel}</TableHead>
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
                  <TableCell className="trending-player-cell min-w-0 font-semibold text-slate-100">
                    <PlayerNameWithHeadshot playerId={row.player_id} playerName={row.name} />
                  </TableCell>
                  <TableCell className="trending-pos-cell text-center text-slate-400">{row.pos}</TableCell>
                  <TableCell className="trending-team-cell text-center text-slate-400">{row.team || 'FA'}</TableCell>
                  <TableCell className="mobile-icon-manager-cell text-slate-400">
                    {row.owner ? renderManagerName(row.owner, managerAvatars) : (
                      <span className="available-manager-label">Available</span>
                    )}
                  </TableCell>
                  <TableCell className="trending-count-cell text-right font-semibold text-slate-300">{row.count.toLocaleString()}</TableCell>
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
      <Card className="report-card-polished bg-slate-900 border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="report-table-polished projected-movers-table">
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
  tradeHistory = [],
  draftPicks = [],
  playerDetailsById,
  currentPositionRankById,
}: {
  data: ReportData['tradeProfitLeaderboard'];
  managerAvatars?: ManagerAvatars;
  tradeHistory?: ReportData['tradeHistory'];
  draftPicks?: DraftPick[];
  playerDetailsById?: PlayerDetailsById;
  currentPositionRankById?: CurrentPositionRankById;
}) {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [selectedManagerTradeKey, setSelectedManagerTradeKey] = useState<string | null>(null);
  const selectedManagerTrades = selectedManager
    ? [...tradeHistory]
        .filter((trade) => trade.team_a === selectedManager || trade.team_b === selectedManager)
        .reverse()
    : [];
  const selectedManagerSummary = selectedManager
    ? data.find((row) => row.manager === selectedManager)
    : undefined;

  return (
    <div className="flex justify-center">
      <Card className="trade-profit-card bg-slate-900 border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="trade-profit-table">
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="trade-profit-heading font-semibold">Manager</TableHead>
              <TableHead className="trade-profit-heading text-right font-semibold">Wins</TableHead>
              <TableHead className="trade-profit-heading text-right font-semibold">Win %</TableHead>
              <TableHead className="trade-profit-heading text-right font-semibold">Trades</TableHead>
              <TableHead className="trade-profit-heading text-right font-semibold">Profit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const winPct = row.trade_count > 0 ? Math.round((row.wins / row.trade_count) * 100) : 0;

              return (
              <TableRow
                key={row.rank}
                className="trade-profit-row cursor-pointer border-slate-700 hover:bg-slate-800/30"
                onClick={() => setSelectedManager(row.manager)}
              >
                <TableCell className="font-semibold text-slate-100">
                  {renderManagerName(row.manager, managerAvatars)}
                </TableCell>
                <TableCell className="trade-profit-wins text-right font-semibold text-orange-300">{row.wins}</TableCell>
                <TableCell className="trade-profit-winpct text-right font-semibold text-cyan-300">{winPct}%</TableCell>
                <TableCell className="trade-profit-trades text-right text-slate-300">{row.trade_count}</TableCell>
                <TableCell
                  className={`trade-profit-value text-right font-semibold ${
                    row.profit >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {row.profit >= 0 ? '+' : ''}
                  {row.profit.toLocaleString()}
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
          </Table>
        </div>
      </Card>
      <Dialog
        open={selectedManager !== null}
        onOpenChange={() => {
          setSelectedManager(null);
          setSelectedManagerTradeKey(null);
        }}
      >
        <DialogContent className="trade-manager-modal max-h-[82vh] max-w-[calc(100vw-1rem)] overflow-hidden border-cyan-300/20 bg-slate-950 p-0 text-slate-100 shadow-2xl shadow-black/70 sm:max-w-2xl">
          {selectedManager && (
            <div className="trade-manager-modal-inner">
              <div className="trade-manager-modal-hero">
                {managerAvatars?.[selectedManager] && (
                  <>
                    <img
                      src={managerAvatars[selectedManager] || ''}
                      alt=""
                      className="manager-hero-wash"
                    />
                    <img
                      src={managerAvatars[selectedManager] || ''}
                      alt=""
                      className="manager-hero-watermark"
                    />
                  </>
                )}
                <div className="manager-hero-scrim" />
                <DialogHeader className="trade-manager-header relative pr-8">
                  <div className="trade-manager-title-lockup">
                    <div className="trade-manager-title-avatar">
                      {managerAvatars?.[selectedManager] ? (
                        <img src={managerAvatars[selectedManager] || ''} alt={selectedManager} />
                      ) : (
                        <span>{selectedManager.trim()[0]?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                    <div className="min-w-0 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
                        Trade Portfolio
                      </p>
                      <DialogTitle className="athletic-headline mt-1 truncate text-3xl font-black leading-none text-orange-400">
                        {selectedManager}
                      </DialogTitle>
                    </div>
                  </div>
                </DialogHeader>
              </div>
              <div className="trade-manager-stats">
                <div>
                  <span>Trades</span>
                  <strong>{selectedManagerSummary?.trade_count ?? selectedManagerTrades.length}</strong>
                </div>
                <div>
                  <span>Wins</span>
                  <strong>{selectedManagerSummary?.wins ?? 0}</strong>
                </div>
                <div>
                  <span>Profit</span>
                  <strong className={(selectedManagerSummary?.profit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {(selectedManagerSummary?.profit ?? 0) >= 0 ? '+' : ''}
                    {(selectedManagerSummary?.profit ?? 0).toLocaleString()}
                  </strong>
                </div>
              </div>
              <div className="trade-manager-list">
                {selectedManagerTrades.map((trade) => {
                  const swing = getManagerTradeSwing(trade, selectedManager);
                  const result = getManagerTradeResult(trade, selectedManager);
                  const opponent = getTradeOpponent(trade, selectedManager);
                  const tradeKey = `${trade.date}-${trade.team_a}-${trade.team_b}`;
                  const isTradeOpen = selectedManagerTradeKey === tradeKey;

                  return (
                    <div key={tradeKey} className="trade-manager-trade-wrap">
                      <button
                        type="button"
                        className="trade-manager-trade"
                        onClick={() => setSelectedManagerTradeKey(isTradeOpen ? null : tradeKey)}
                        aria-expanded={isTradeOpen}
                      >
                        <div className="min-w-0">
                          <div className="trade-manager-date">{trade.date}</div>
                          <div className="trade-manager-opponent">
                            vs {opponent}
                          </div>
                        </div>
                        <span className={`trade-manager-result trade-manager-result-${result === 'Loss' ? 'loss' : result === 'Even Win' ? 'even' : 'win'}`}>
                          {result}
                        </span>
                        <span className={`trade-manager-swing ${swing >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {swing >= 0 ? '+' : ''}
                          {swing.toLocaleString()}
                        </span>
                      </button>
                      {isTradeOpen && (
                        <div className="trade-manager-detail">
                          <TradeDetailPanel
                            row={trade}
                            draftPicks={draftPicks}
                            managerAvatars={managerAvatars}
                            playerDetailsById={playerDetailsById}
                            currentPositionRankById={currentPositionRankById}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
  const [collapsedTradeYears, setCollapsedTradeYears] = useState<Set<string>>(new Set());
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const orderedTrades = [...data].reverse();
  const tradeYears = Array.from(new Set(orderedTrades.map((row) => row.date.slice(0, 4))));
  const toggleTradeYear = (year: string) => {
    setExpandedIdx(null);
    setCollapsedTradeYears((current) => {
      const next = new Set(current);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  return (
    <div className="flex justify-center">
      <Card className="trade-ledger-card bg-slate-900 border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="trade-ledger-table">
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="text-white font-semibold">Trade History</TableHead>
              <TableHead className="trade-ledger-manager-heading text-white font-semibold">Winner</TableHead>
              <TableHead className="trade-ledger-manager-heading text-white font-semibold">Loser</TableHead>
              <TableHead className="text-center text-white font-semibold">Value Gap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tradeYears.map((year) => {
              const yearTrades = orderedTrades.filter((row) => row.date.startsWith(year));
              const isYearCollapsed = collapsedTradeYears.has(year);

              return (
                <React.Fragment key={year}>
                  <TableRow className="trade-year-row border-slate-700">
                    <TableCell colSpan={4} className="trade-year-cell">
                      <button
                        type="button"
                        className="trade-year-toggle"
                        onClick={() => toggleTradeYear(year)}
                        aria-expanded={!isYearCollapsed}
                      >
                        <span className="trade-year-label">
                          <ChevronDown
                            className={`h-4 w-4 text-orange-300 transition-transform ${isYearCollapsed ? '-rotate-90' : ''}`}
                            aria-hidden="true"
                          />
                          <span>{year}</span>
                        </span>
                        <span className="trade-year-count">
                          {yearTrades.length} {yearTrades.length === 1 ? 'trade' : 'trades'}
                        </span>
                      </button>
                    </TableCell>
                  </TableRow>

                  {!isYearCollapsed && yearTrades.map((row) => {
              const idx = orderedTrades.indexOf(row);
              const isExpanded = expandedIdx === idx;
              const { winners, loserName } = getTradeDisplaySides(row);
              const tradeKey = `${row.date}-${row.team_a}-${row.team_b}-${idx}`;
              const shouldSwapSummary = stableTradeSeed(tradeKey) % 2 === 1;
              const summaryManagers = shouldSwapSummary
                ? [row.team_b, row.team_a]
                : [row.team_a, row.team_b];
              const gapVerdict = getTradeGapVerdict(row.point_gap);

              return (
                <React.Fragment key={`${tradeKey}-fragment`}>
                  <TableRow
                    key={`${tradeKey}-main`}
                    className="trade-ledger-row border-slate-700 hover:bg-slate-800/30 cursor-pointer"
                      onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    >
                    <TableCell className="trade-date-cell text-slate-300 text-sm">
                      <div className="trade-date-main flex items-center gap-2">
                        <ChevronDown className={`h-4 w-4 text-orange-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        <span>{row.date}</span>
                      </div>
                      <div className="trade-mobile-summary">
                        {renderTradeSummaryManager(summaryManagers[0], winners.includes(summaryManagers[0]), managerAvatars)}
                        <span className="trade-mobile-vs">vs</span>
                        {renderTradeSummaryManager(summaryManagers[1], winners.includes(summaryManagers[1]), managerAvatars)}
                      </div>
                    </TableCell>
                    <TableCell className="trade-ledger-manager-cell font-semibold text-sm text-orange-300">
                      {winners.map((winner) => (
                        <span key={winner}>{renderManagerName(winner, managerAvatars)}</span>
                      ))}
                    </TableCell>
                    <TableCell className="trade-ledger-manager-cell font-semibold text-sm text-cyan-300">
                      {renderManagerName(loserName, managerAvatars)}
                    </TableCell>
                    <TableCell className="trade-gap-cell text-center text-slate-300">
                      <span className={`trade-gap-verdict ${gapVerdict.className}`}>
                        {gapVerdict.label}
                      </span>
                      <span className="value-pill">{row.point_gap.toLocaleString()}</span>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow key={`${tradeKey}-details`} className="border-slate-700 bg-slate-950/35">
                      <TableCell colSpan={4} className="trade-detail-cell p-3 sm:p-6">
                        <TradeDetailPanel
                          row={row}
                          draftPicks={draftPicks}
                          managerAvatars={managerAvatars}
                          playerDetailsById={playerDetailsById}
                          currentPositionRankById={currentPositionRankById}
                          onPlayerClick={setSelectedPlayer}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
                  );
                  })}
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

  if (shortages.length === 0 && excesses.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Shortages */}
      {shortages.length > 0 && (
      <div>
        <div className="flex items-center justify-center gap-2 mb-4">
          <TrendingDown className="w-5 h-5 text-red-400" />
          <h3 className="text-xl font-bold text-red-400 text-center">Position Shortages</h3>
        </div>
          <div className="flex justify-center">
            <Card className="report-card-polished bg-slate-900 border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
              <Table className="report-table-polished position-analysis-table">
                <TableHeader className="border-b-2 border-orange-500/30">
                  <TableRow className="border-slate-700">
                    <TableHead className="overview-manager-heading text-white font-semibold">Team</TableHead>
                    <TableHead className="text-white font-semibold">Position</TableHead>
                    <TableHead className="text-right text-white font-semibold">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shortages.map((row, idx) => (
                    <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/30">
                      <TableCell className="overview-manager-cell font-semibold text-slate-100">
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
      </div>
      )}

      {/* Excesses */}
      {excesses.length > 0 && (
      <div>
        <div className="flex items-center justify-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <h3 className="text-xl font-bold text-emerald-400 text-center">Position Excess</h3>
        </div>
          <div className="flex justify-center">
            <Card className="report-card-polished bg-slate-900 border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
              <Table className="report-table-polished position-analysis-table">
                <TableHeader className="border-b-2 border-orange-500/30">
                  <TableRow className="border-slate-700">
                    <TableHead className="overview-manager-heading text-white font-semibold">Team</TableHead>
                    <TableHead className="text-white font-semibold">Position</TableHead>
                    <TableHead className="text-right text-white font-semibold">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {excesses.map((row, idx) => (
                    <TableRow key={idx} className="border-slate-700 hover:bg-slate-800/30">
                      <TableCell className="overview-manager-cell font-semibold text-slate-100">
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
      </div>
      )}
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
  leagueId,
  leagueLogo,
}: {
  data: ReportData['managerPositionCounts'];
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedManager, setSelectedManager] = useState<ReportData['managerPositionCounts'][number] | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const selectedAvatar = selectedManager ? managerAvatars?.[selectedManager.manager] : null;
  const selectedStarters = selectedManager?.starterPlayers || [];

  return (
    <div className="flex justify-center">
      <Card className="report-card-polished bg-slate-900 border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="report-table-polished position-counts-table">
            <TableHeader className="border-b-2 border-orange-500/30">
              <TableRow className="border-slate-700">
                <TableHead className="mobile-icon-manager-heading text-white font-semibold">
                  <div>Manager</div>
                </TableHead>
                <TableHead className="text-center text-white font-semibold text-xs">QB</TableHead>
                <TableHead className="text-center text-white font-semibold text-xs">RB</TableHead>
                <TableHead className="text-center text-white font-semibold text-xs">WR</TableHead>
                <TableHead className="text-center text-white font-semibold text-xs">TE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => (
                <TableRow
                  key={idx}
                  className="cursor-pointer border-slate-700 hover:bg-slate-800/30"
                  onClick={() => setSelectedManager(row)}
                >
                  <TableCell className="mobile-icon-manager-cell font-semibold text-slate-100">
                    {renderManagerName(row.manager, managerAvatars)}
                  </TableCell>
                  <TableCell className="text-center text-slate-300 text-sm">
                    <div>{row.QB}</div>
                    <div className="position-starter-count">{row.QB_starters}</div>
                  </TableCell>
                  <TableCell className="text-center text-slate-300 text-sm">
                    <div>{row.RB}</div>
                    <div className="position-starter-count">{row.RB_starters}</div>
                  </TableCell>
                  <TableCell className="text-center text-slate-300 text-sm">
                    <div>{row.WR}</div>
                    <div className="position-starter-count">{row.WR_starters}</div>
                  </TableCell>
                  <TableCell className="text-center text-slate-300 text-sm">
                    <div>{row.TE}</div>
                    <div className="position-starter-count">{row.TE_starters}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <Dialog open={selectedManager !== null} onOpenChange={(open) => !open && setSelectedManager(null)}>
        <DialogContent className="starter-modal flex max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border-cyan-300/20 bg-slate-950 p-0 text-slate-100 shadow-2xl shadow-black/70 sm:max-h-[86vh] sm:max-w-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedManager?.manager} Starters</DialogTitle>
            <DialogDescription>
              Starter players for this manager. Select a player to open the player detail modal.
            </DialogDescription>
          </DialogHeader>
          {selectedManager && (
            <div className="flex max-h-[calc(100dvh-1rem)] min-h-0 flex-col sm:max-h-[86vh]">
              <div className="starter-modal-hero relative flex-shrink-0 overflow-hidden border-b border-cyan-300/20 px-5 py-5 sm:px-7">
                {selectedAvatar && (
                  <>
                    <img
                      src={selectedAvatar}
                      alt=""
                      className="manager-hero-wash"
                    />
                    <img
                      src={selectedAvatar}
                      alt=""
                      className="manager-hero-watermark"
                    />
                  </>
                )}
                <div className="manager-hero-scrim" />
                <div className="relative flex items-center gap-4">
                  {selectedAvatar ? (
                    <img
                      src={selectedAvatar}
                      alt={selectedManager.manager}
                      className="h-16 w-16 flex-shrink-0 rounded-2xl border border-cyan-300/30 object-cover shadow-lg shadow-black/40"
                    />
                  ) : (
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-cyan-300/30 bg-slate-900 text-2xl font-black text-orange-300">
                      {selectedManager.manager[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                      Starter Room
                    </p>
                    <h3 className="athletic-headline truncate text-3xl font-black text-orange-400 sm:text-4xl">
                      {selectedManager.manager}
                    </h3>
                    <p className="mt-1 text-sm font-bold text-slate-300">
                      {selectedStarters.length} starter{selectedStarters.length === 1 ? '' : 's'} by positional rank
                    </p>
                  </div>
                </div>
              </div>
              <div className="starter-modal-body min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
                {selectedStarters.length > 0 ? (
                  <div className="starter-grid">
                    {selectedStarters.map((player) => (
                      <button
                        key={player.player_id}
                        type="button"
                        className="starter-player-tile"
                        onClick={() => {
                          setSelectedPlayer(buildPlayerModalData({
                            playerId: player.player_id,
                            playerName: player.name,
                            playerPos: player.pos,
                            value: player.value,
                            playerDetails: player.playerDetails,
                            currentPositionRank: player.currentPositionRank,
                            manager: selectedManager.manager,
                            managerAvatarUrl: selectedAvatar,
                          }));
                        }}
                      >
                        <div className="starter-player-main">
                          <PlayerNameWithHeadshot playerId={player.player_id} playerName={player.name} />
                        </div>
                        <div className="starter-player-meta">
                          <span>{player.currentPositionRank || player.pos}</span>
                          <span className="starter-player-team-pill">{player.playerDetails?.team || 'FA'}</span>
                          <span className="starter-player-status-pill">{formatStarterStatus(player.playerDetails?.status)}</span>
                          <strong>{player.value.toLocaleString()}</strong>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-cyan-300/15 bg-slate-950/45 px-4 py-8 text-center text-sm font-bold text-slate-400">
                    No ranked starters found for this manager.
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
