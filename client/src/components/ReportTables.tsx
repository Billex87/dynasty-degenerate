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
import React, { useState, type CSSProperties } from 'react';
import { ChevronDown, Crown, TrendingDown, TrendingUp } from 'lucide-react';
import type { DraftPick, ManagerIntelPlayer, ReportData, TrendingPlayer } from '@shared/types';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { PlayerDetailModal, type PlayerModalData } from './PlayerDetailModal';
import { getPositionRankPillClass } from '@/lib/positionRank';

type ManagerAvatars = ReportData['managerAvatars'];
type PlayerDetailsById = ReportData['playerDetailsById'];
type CurrentPositionRankById = ReportData['currentPositionRankById'];

const NFL_TEAM_COLORS: Record<string, { primary: string; secondary: string; accent: string }> = {
  ARI: { primary: '#97233F', secondary: '#000000', accent: '#FFB612' },
  ATL: { primary: '#A71930', secondary: '#000000', accent: '#A5ACAF' },
  BAL: { primary: '#241773', secondary: '#000000', accent: '#9E7C0C' },
  BUF: { primary: '#00338D', secondary: '#C60C30', accent: '#FFFFFF' },
  CAR: { primary: '#0085CA', secondary: '#101820', accent: '#BFC0BF' },
  CHI: { primary: '#0B162A', secondary: '#C83803', accent: '#FFFFFF' },
  CIN: { primary: '#FB4F14', secondary: '#000000', accent: '#FFFFFF' },
  CLE: { primary: '#311D00', secondary: '#FF3C00', accent: '#FFFFFF' },
  DAL: { primary: '#003594', secondary: '#041E42', accent: '#869397' },
  DEN: { primary: '#FB4F14', secondary: '#002244', accent: '#FFFFFF' },
  DET: { primary: '#0076B6', secondary: '#B0B7BC', accent: '#7fd8ff' },
  GB: { primary: '#203731', secondary: '#FFB612', accent: '#FFFFFF' },
  HOU: { primary: '#03202F', secondary: '#A71930', accent: '#FFFFFF' },
  IND: { primary: '#002C5F', secondary: '#A2AAAD', accent: '#FFFFFF' },
  JAX: { primary: '#006778', secondary: '#101820', accent: '#D7A22A' },
  KC: { primary: '#E31837', secondary: '#FFB81C', accent: '#FFFFFF' },
  LAC: { primary: '#0080C6', secondary: '#FFC20E', accent: '#FFFFFF' },
  LAR: { primary: '#003594', secondary: '#FFA300', accent: '#FFFFFF' },
  LV: { primary: '#000000', secondary: '#A5ACAF', accent: '#FFFFFF' },
  MIA: { primary: '#008E97', secondary: '#FC4C02', accent: '#FFFFFF' },
  MIN: { primary: '#4F2683', secondary: '#FFC62F', accent: '#FFFFFF' },
  NE: { primary: '#002244', secondary: '#C60C30', accent: '#B0B7BC' },
  NO: { primary: '#101820', secondary: '#D3BC8D', accent: '#FFFFFF' },
  NYG: { primary: '#0B2265', secondary: '#A71930', accent: '#FFFFFF' },
  NYJ: { primary: '#125740', secondary: '#000000', accent: '#FFFFFF' },
  PHI: { primary: '#004C54', secondary: '#A5ACAF', accent: '#FFFFFF' },
  PIT: { primary: '#101820', secondary: '#FFB612', accent: '#FFFFFF' },
  SEA: { primary: '#002244', secondary: '#69BE28', accent: '#A5ACAF' },
  SF: { primary: '#AA0000', secondary: '#B3995D', accent: '#FFFFFF' },
  TB: { primary: '#D50A0A', secondary: '#34302B', accent: '#FF7900' },
  TEN: { primary: '#0C2340', secondary: '#4B92DB', accent: '#C8102E' },
  WAS: { primary: '#5A1414', secondary: '#FFB612', accent: '#FFFFFF' },
};

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
  const mappedDetails = playerId ? playerDetailsById?.[playerId] : undefined;
  const details = playerDetails
    ? {
        ...mappedDetails,
        ...playerDetails,
        valueProfile: playerDetails.valueProfile || mappedDetails?.valueProfile,
        similarTradeValues: playerDetails.similarTradeValues || mappedDetails?.similarTradeValues,
      }
    : mappedDetails;
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

function renderPartnerName(manager: string, managerAvatars?: ManagerAvatars) {
  const avatarUrl = managerAvatars?.[manager];
  const initial = manager.trim()[0]?.toUpperCase() || '?';

  return (
    <div className="partner-chip-reverse">
      <span>{manager}</span>
      {avatarUrl ? (
        <img src={avatarUrl} alt={manager} />
      ) : (
        <span aria-hidden="true" className="partner-chip-fallback">{initial}</span>
      )}
    </div>
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

function formatCompactValue(value: number | null | undefined): string {
  if (!value) return '-';
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}K`;
  return value.toLocaleString();
}

function PickYearCell({ count, value }: { count: number; value: number }) {
  if (!count) return <span className="text-slate-500">-</span>;

  return (
    <div className="leading-tight">
      <div className="font-black text-cyan-300">{count} pick{count === 1 ? '' : 's'}</div>
      <div className="mt-0.5 text-[0.7rem] font-bold text-slate-400">{formatCompactValue(value)}</div>
    </div>
  );
}

function titleCasePill(value: string): string {
  const acronyms = new Set(['QB', 'RB', 'WR', 'TE', 'SF', 'PPR', 'FA']);
  return value.replace(/\w\S*/g, (word) => {
    const upper = word.toUpperCase();
    if (/^(QB|RB|WR|TE)\d+$/i.test(word)) return upper;
    if (acronyms.has(upper)) return upper;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function getPillToneClass(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes('old') || normalized.includes('risk') || normalized.includes('weak') || normalized.includes('behind') || normalized.includes('thin')) {
    return 'manager-intel-pill-danger';
  }
  if (normalized.includes('young') || normalized.includes('contender') || normalized.includes('win') || normalized.includes('elite')) {
    return 'manager-intel-pill-good';
  }
  if (normalized.includes('rebuild') || normalized.includes('future')) {
    return 'manager-intel-pill-future';
  }
  return 'manager-intel-pill-neutral';
}

function PlayerInsightTile({
  label,
  player,
  manager,
  managerAvatarUrl,
  onSelect,
  tone = 'neutral',
  extraPill,
  crownedRank,
}: {
  label: string;
  player: ManagerIntelPlayer | null | undefined;
  manager: string;
  managerAvatarUrl?: string | null;
  onSelect: (player: PlayerModalData) => void;
  tone?: 'neutral' | 'warn' | 'danger';
  extraPill?: string | null;
  crownedRank?: string | null;
}) {
  if (!player) return null;

  return (
    <button
      type="button"
      className={`manager-intel-player ${tone === 'warn' ? 'manager-intel-player-warn' : ''} ${tone === 'danger' ? 'manager-intel-player-danger' : ''}`}
      onClick={() => onSelect(buildPlayerModalData({
        playerId: player.player_id,
        playerName: player.name,
        playerPos: player.pos,
        value: player.value,
        playerDetails: player.playerDetails,
        currentPositionRank: player.seasonPositionRank || player.currentPositionRank,
        manager: player.owner || manager,
        managerAvatarUrl: player.owner ? undefined : managerAvatarUrl,
      }))}
    >
      <div className="manager-intel-player-kicker">{label}</div>
      <div className="manager-intel-player-main">
        <PlayerNameWithHeadshot playerId={player.player_id} playerName={player.name} />
      </div>
      <div className="manager-intel-player-pills">
        <PositionRankPill rank={player.seasonPositionRank || player.currentPositionRank || player.pos} />
        {extraPill && <span>{extraPill}</span>}
        <span>{player.playerDetails?.team || 'FA'}</span>
        <span>{formatCompactValue(player.value)}</span>
      </div>
      {crownedRank && (
        <div className="manager-intel-crown-rank">
          <Crown className="h-3.5 w-3.5" />
          <span>{crownedRank}</span>
        </div>
      )}
    </button>
  );
}

function IntelligenceMetric({ label, value, tone = 'neutral' }: { label: string; value: React.ReactNode; tone?: 'neutral' | 'positive' | 'negative' }) {
  const toneClass = tone === 'positive' ? 'text-emerald-300' : tone === 'negative' ? 'text-rose-300' : 'text-slate-100';
  return (
    <div className="rounded-xl border border-cyan-300/15 bg-slate-950/45 px-3 py-2">
      <div className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-cyan-300/80">{label}</div>
      <div className={`mt-1 text-lg font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

function ManagerMiniLine({
  manager,
  managerAvatars,
  meta,
  badges,
  onClick,
}: {
  manager: string;
  managerAvatars?: ManagerAvatars;
  meta?: React.ReactNode;
  badges?: Array<{ label: string; tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'future' }>;
  onClick?: () => void;
}) {
  const content = (
    <>
      {renderManagerName(manager, managerAvatars)}
      {badges?.length ? (
        <span className="command-mini-badges">
          {badges.map((badge) => (
            <span key={badge.label} className={`command-mini-badge command-mini-badge-${badge.tone || 'neutral'}`}>
              {badge.label}
            </span>
          ))}
        </span>
      ) : meta ? (
        <span className="command-mini-meta">{meta}</span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="command-mini-line command-mini-button" onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <div className="command-mini-line">
      {content}
    </div>
  );
}

function PlayerMiniLine({
  playerId,
  name,
  meta,
}: {
  playerId?: string;
  name: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="command-mini-line">
      <PlayerNameWithHeadshot playerId={playerId} playerName={name} />
      {meta && <span className="command-mini-meta">{meta}</span>}
    </div>
  );
}

function PositionRankPill({ rank }: { rank?: string | null }) {
  const displayRank = rank || '-';
  return <span className={getPositionRankPillClass(displayRank)}>{displayRank}</span>;
}

function getCommandPlayerTileStyle(player: CommandPlayer): CSSProperties | undefined {
  const teamColors = NFL_TEAM_COLORS[player.playerDetails?.team || ''];
  if (!teamColors) return undefined;
  return {
    '--team-primary': teamColors.primary,
    '--team-secondary': teamColors.secondary,
    '--team-accent': teamColors.accent,
  } as CSSProperties;
}

function CommandPlayerTile({
  player,
  onClick,
  variant = 'default',
  label,
}: {
  player: CommandPlayer;
  onClick: () => void;
  variant?: 'default' | 'step';
  label?: string;
}) {
  return (
    <button
      type="button"
      className={`manager-command-player-tile ${variant === 'step' ? 'manager-command-player-tile-step' : ''}`}
      style={getCommandPlayerTileStyle(player)}
      onClick={onClick}
    >
      {label && <div className="manager-intel-player-kicker">{label}</div>}
      <div className="manager-command-player-tile-main">
        <PlayerNameWithHeadshot playerId={player.player_id} playerName={player.name} />
      </div>
      <div className="manager-command-player-tile-pills">
        <PositionRankPill rank={player.seasonPositionRank || player.currentPositionRank || player.pos} />
        <span>{player.playerDetails?.team || 'FA'}</span>
        <span className="manager-command-status-pill">{formatStarterStatus(player.playerDetails?.status)}</span>
      </div>
    </button>
  );
}

function FeatureCard({
  number,
  title,
  kicker,
  note,
  children,
  className = '',
  hideNumber = false,
}: {
  number: number;
  title: string;
  kicker: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
  hideNumber?: boolean;
}) {
  return (
    <Card className={`command-feature-card ${className}`}>
      <div className="command-feature-top">
        {!hideNumber && <span className="command-feature-number">{String(number).padStart(2, '0')}</span>}
        <div className="min-w-0">
          <p>{kicker}</p>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="command-feature-body">
        {children}
      </div>
      {note && (
        <details className="command-feature-note">
          <summary>What this is based on</summary>
          <p>{note}</p>
        </details>
      )}
    </Card>
  );
}

type CommandPlayer = ManagerIntelPlayer | NonNullable<ReportData['managerPositionCounts'][number]['starterPlayers']>[number];

function ManagerDepthTile({
  manager,
  avatarUrl,
  badges,
  onClick,
}: {
  manager: string;
  avatarUrl?: string | null;
  badges: Array<{ label: string; tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'future' }>;
  onClick: () => void;
}) {
  return (
    <button type="button" className="command-depth-tile" onClick={onClick}>
      {avatarUrl && (
        <>
          <img src={avatarUrl} alt="" className="command-depth-tile-wash" />
          <img src={avatarUrl} alt="" className="command-depth-tile-mark" />
        </>
      )}
      <span className="command-depth-tile-scrim" />
      <span className="command-depth-tile-main">
        {avatarUrl ? (
          <img src={avatarUrl} alt={manager} className="command-depth-avatar" />
        ) : (
          <span className="command-depth-avatar">{manager[0]?.toUpperCase() || '?'}</span>
        )}
        <span className="command-depth-name">{manager}</span>
      </span>
      <span className="command-depth-badges">
        {badges.map((badge) => (
          <span key={badge.label} className={`command-mini-badge command-mini-badge-${badge.tone || 'neutral'}`}>
            {badge.label}
          </span>
        ))}
      </span>
    </button>
  );
}

export function LeagueCommandCenter({
  data,
  managerAvatars,
  leagueId,
  leagueLogo,
}: {
  data: ReportData;
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const intel = data.managerRosterIntelligence || [];
  const power = data.powerRankings || [];
  const timelines = data.dynastyTimelines || [];
  const trades = data.tradeTendencies || [];
  const picks = data.pickPortfolios || [];
  const starterDepth = (data.managerPositionCounts || [])
    .map((row) => ({
      manager: row.manager,
      starterCount: row.QB_starters + row.RB_starters + row.WR_starters + row.TE_starters,
      totalPlayers: row.QB + row.RB + row.WR + row.TE,
      avgAge: intel.find((item) => item.manager === row.manager)?.avgAge ?? null,
      ageFlags: intel.find((item) => item.manager === row.manager)?.ageFlags || [],
      starterAvailability: intel.find((item) => item.manager === row.manager)?.starterAvailability,
      droppablePlayers: intel.find((item) => item.manager === row.manager)?.droppablePlayers || [],
    }))
    .sort((a, b) => b.starterCount - a.starterCount || b.totalPlayers - a.totalPlayers);
  const selectedIntel = selectedManager ? intel.find((row) => row.manager === selectedManager) : null;
  const selectedCounts = selectedManager ? data.managerPositionCounts.find((row) => row.manager === selectedManager) : null;
  const selectedTrade = selectedManager ? trades.find((row) => row.manager === selectedManager) : null;
  const selectedPick = selectedManager ? picks.find((row) => row.manager === selectedManager) : null;
  const selectedPower = selectedManager ? power.find((row) => row.manager === selectedManager) : null;
  const selectedTimeline = selectedManager ? timelines.find((row) => row.manager === selectedManager) : null;
  const selectedOverview = selectedManager ? data.leagueOverview.find((row) => row.manager === selectedManager) : null;
  const openManager = (manager: string) => setSelectedManager(manager);
  const openCommandPlayer = (player: CommandPlayer) => {
    if (!selectedManager) return;
    setSelectedPlayer(buildPlayerModalData({
      playerId: player.player_id,
      playerName: player.name,
      playerPos: player.pos,
      value: player.value,
      playerDetails: player.playerDetails,
      manager: player.owner || selectedManager,
      managerAvatarUrl: managerAvatars?.[player.owner || selectedManager],
      currentPositionRank: player.seasonPositionRank || player.currentPositionRank,
    }));
  };
  const selectedStarters = selectedCounts?.starterPlayers || [];
  const selectedLineupPlayers = selectedCounts?.lineupPlayers || selectedStarters;
  const pickLineupPlayers = (players: typeof selectedLineupPlayers) => {
    const used = new Set<string>();
    const take = (position: string, count: number) => {
      const picked = players
        .filter((player) => player.pos === position && !used.has(player.player_id))
        .sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value))
        .slice(0, count);
      picked.forEach((player) => used.add(player.player_id));
      return picked;
    };
    const qbs = take('QB', 2);
    const rbs = take('RB', 2);
    const wrs = take('WR', 2);
    const tes = take('TE', 2);
    const flex = players
      .filter((player) => ['RB', 'WR', 'TE'].includes(player.pos) && !used.has(player.player_id))
      .sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value))
      .slice(0, 2);
    return [
      { label: 'QB / SF', players: qbs },
      { label: 'RB', players: rbs },
      { label: 'WR', players: wrs },
      { label: 'TE', players: tes },
      { label: 'Flex', players: flex },
    ];
  };
  const lineupGroups = pickLineupPlayers(selectedLineupPlayers);
  const projectedLineupIds = new Set(lineupGroups.flatMap((group) => group.players.map((player) => player.player_id)));
  const canStepInGroups = [
    {
      label: 'QB',
      players: selectedStarters
        .filter((player) => player.pos === 'QB' && !projectedLineupIds.has(player.player_id))
        .sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value)),
    },
    {
      label: 'Flex',
      players: selectedStarters
        .filter((player) => ['RB', 'WR', 'TE'].includes(player.pos) && !projectedLineupIds.has(player.player_id))
        .sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value)),
    },
  ].filter((group) => group.players.length);
  const selectedManagerTags = (() => {
    const timelineTag = selectedTimeline
      ? selectedTimeline.rebuildScore > selectedTimeline.contenderScore && selectedTimeline.rebuildScore >= 55
        ? 'Rebuild runway'
        : selectedTimeline.label
      : null;
    const tags = [
      selectedIntel?.identity,
      timelineTag,
      ...(selectedIntel?.ageFlags || []),
      selectedIntel?.holes.summary !== 'No major roster hole flagged' ? selectedIntel?.holes.summary : null,
    ].filter((tag): tag is string => Boolean(tag));
    return Array.from(new Set(tags.map(titleCasePill))).slice(0, 5);
  })();
  const rosterRead = (() => {
    if (!selectedIntel) return 'No roster read available yet.';
    const notes: string[] = [];
    const rbAge = selectedIntel.avgAgeByPosition.RB;
    const wrAge = selectedIntel.avgAgeByPosition.WR;
    const teAge = selectedIntel.avgAgeByPosition.TE;
    const missingLineupGroups = lineupGroups.filter((group) => group.players.length < (group.label === 'TE' ? 1 : 2));
    const rb2Rank = selectedIntel.holes.rb2Rank ? Number(selectedIntel.holes.rb2Rank.replace(/\D/g, '')) : null;
    const wr3Rank = selectedIntel.holes.wr3Rank ? Number(selectedIntel.holes.wr3Rank.replace(/\D/g, '')) : null;
    const teRank = selectedIntel.holes.te1Rank ? Number(selectedIntel.holes.te1Rank.replace(/\D/g, '')) : null;

    if (selectedTimeline) {
      notes.push(`${selectedTimeline.label}. Contender score ${selectedTimeline.contenderScore}, rebuild score ${selectedTimeline.rebuildScore}, so this team should ${selectedTimeline.contenderScore >= 70 ? 'protect weekly starters and buy injury insurance' : 'keep leaning into picks and young upside'}.`);
    }
    if (wrAge !== null && wrAge >= 27) {
      notes.push(`WR room is aging at ${wrAge.toFixed(1)} on average, so a younger wideout should be a priority before that room loses trade value.`);
    } else if (wr3Rank !== null && wr3Rank > 36) {
      notes.push(`WR depth is the soft spot: WR3 is ${selectedIntel.holes.wr3Rank}, so one injury can push a shaky receiver into the weekly lineup.`);
    }
    if (rbAge !== null && rbAge >= 26.5) {
      notes.push(`RB room is older at ${rbAge.toFixed(1)} on average; that is fine for a contender, but this is the position most likely to need a refresh soon.`);
    } else if (rb2Rank !== null && rb2Rank > 24) {
      notes.push(`RB2 is ${selectedIntel.holes.rb2Rank}, which is below the comfort line for this league size and gives other managers an obvious attack point.`);
    }
    if (teAge !== null && teAge >= 29) {
      notes.push(`TE is veteran-heavy at ${teAge.toFixed(1)} on average, so the backup plan matters if the starter loses role or health.`);
    } else if (teRank !== null && teRank > 12) {
      notes.push(`TE1 is ${selectedIntel.holes.te1Rank}, so this roster may be giving up weekly points at a single-start position.`);
    }
    if (selectedIntel.holes.flexDepth <= 1) {
      notes.push('Flex depth is thin enough that one injury could force a replacement-level player into the lineup.');
    }
    if (missingLineupGroups.length) {
      notes.push(`Lineup warning: ${missingLineupGroups.map((group) => group.label).join(', ')} does not fully fill from ranked players.`);
    }
    if (selectedIntel.weakestStarter) {
      notes.push(`Lineup upgrade spot is ${selectedIntel.weakestStarter.name} (${selectedIntel.weakestStarter.seasonPositionRank || selectedIntel.weakestStarter.currentPositionRank || selectedIntel.weakestStarter.pos}) after season value is considered.`);
    }
    if (selectedIntel.bestBenchStash) {
      notes.push(`${selectedIntel.bestBenchStash.name} (${selectedIntel.bestBenchStash.seasonPositionRank || selectedIntel.bestBenchStash.currentPositionRank || selectedIntel.bestBenchStash.pos}) is the best bench chip if this manager wants to patch a hole without touching the core.`);
    }
    if (selectedPick && selectedPick.count2026 + selectedPick.count2027 >= 15) {
      notes.push(`Draft capital is strong with ${selectedPick.count2026} 2026 picks and ${selectedPick.count2027} 2027 picks, so this team has room to buy help.`);
    }
    if (!notes.length) notes.push('This roster is fairly clean: no obvious age cliff, weak starter, or depth emergency from the current positional ranks.');
    return notes.slice(0, 5).join(' ');
  })();

  return (
    <>
    <div className="command-center-grid">
      <FeatureCard
        number={1}
        title="Roster Depth Board"
        kicker="Starter-grade depth"
        className="command-feature-card-wide"
        hideNumber
      >
        <div className="command-depth-grid">
          {starterDepth.map((row) => (
            <ManagerDepthTile
              key={row.manager}
              manager={row.manager}
              avatarUrl={managerAvatars?.[row.manager]}
              badges={[
              { label: `${row.starterCount} starters`, tone: 'neutral' },
              ...(row.avgAge !== null ? [{ label: `${row.avgAge} avg age`, tone: row.avgAge >= 27.5 ? 'warn' as const : row.avgAge <= 25 ? 'future' as const : 'good' as const }] : []),
              ...row.ageFlags.slice(0, 2).map((flag) => ({
                label: titleCasePill(flag),
                tone: flag.toLowerCase().includes('old') || flag.toLowerCase().includes('aging') ? 'danger' as const : 'future' as const,
              })),
              ...(row.starterAvailability?.avgGamesMissed !== null && row.starterAvailability?.avgGamesMissed !== undefined
                ? [{
                    label: `${row.starterAvailability.avgGamesMissed} missed/gm`,
                    tone: row.starterAvailability.riskLevel === 'high' ? 'danger' as const : row.starterAvailability.riskLevel === 'medium' ? 'warn' as const : 'good' as const,
                  }]
                : []),
              ]}
              onClick={() => openManager(row.manager)}
            />
          ))}
        </div>
      </FeatureCard>

    </div>
    <Dialog open={selectedManager !== null} onOpenChange={(open) => !open && setSelectedManager(null)}>
      <DialogContent className="manager-command-dialog max-w-3xl border-cyan-300/20 bg-slate-950 p-0 text-slate-100">
        <DialogHeader className="sr-only">
          <DialogTitle>{selectedManager || 'Manager'} Command Center</DialogTitle>
          <DialogDescription>Manager-level calculation details and data points.</DialogDescription>
        </DialogHeader>
        {selectedManager && (
          <div className="manager-command-modal-inner">
            <div className="manager-command-hero">
              {managerAvatars?.[selectedManager] && (
                <>
                  <img src={managerAvatars[selectedManager] || ''} alt="" className="manager-hero-wash" />
                  <img src={managerAvatars[selectedManager] || ''} alt="" className="manager-hero-watermark" />
                </>
              )}
              <div className="manager-hero-scrim" />
              <div className="manager-command-title-lockup">
              {managerAvatars?.[selectedManager] ? (
                <img src={managerAvatars[selectedManager] || ''} alt={selectedManager} className="manager-command-avatar" />
              ) : (
                <span className="manager-command-avatar">{selectedManager[0]?.toUpperCase() || '?'}</span>
              )}
              <div className="min-w-0">
                <p>Owner Data Room</p>
                <h3>{selectedManager}</h3>
              </div>
              </div>
              <div className="manager-command-hero-metrics">
                <IntelligenceMetric label="Starters" value={selectedCounts ? selectedCounts.QB_starters + selectedCounts.RB_starters + selectedCounts.WR_starters + selectedCounts.TE_starters : '-'} />
                <IntelligenceMetric label="Roster Age" value={selectedIntel?.avgAge ?? '-'} />
                <IntelligenceMetric label="Power Score" value={selectedPower?.score ?? '-'} />
              </div>
            </div>
            <div className="manager-command-body">
              {selectedManagerTags.length ? (
                <div className="manager-command-tag-row" aria-label="Manager profile tags">
                  {selectedManagerTags.map((tag) => (
                    <span key={tag} className={`manager-intel-pill ${getPillToneClass(tag)}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {selectedOverview ? (
                <div className="manager-command-rank-summary" aria-label="Manager league ranks">
                  <div>
                    <span>QB Rank</span>
                    <strong>#{selectedOverview.rank_qb}</strong>
                  </div>
                  <div>
                    <span>RB Rank</span>
                    <strong>#{selectedOverview.rank_rb}</strong>
                  </div>
                  <div>
                    <span>WR Rank</span>
                    <strong>#{selectedOverview.rank_wr}</strong>
                  </div>
                  <div>
                    <span>TE Rank</span>
                    <strong>#{selectedOverview.rank_te}</strong>
                  </div>
                  <div>
                    <span>Value</span>
                    <strong>#{selectedOverview.rank_value}</strong>
                  </div>
                </div>
              ) : null}
              {(selectedPower || selectedTimeline) ? (
                <div className="manager-command-score-summary" aria-label="Manager power and timeline scores">
                  {selectedPower ? (
                    <div>
                      <span>Power Rank</span>
                      <strong>#{selectedPower.rank} {selectedPower.tier}</strong>
                      <p>{selectedPower.score}/100 composite score from starters, roster value, balance, picks, youth, and trades.</p>
                    </div>
                  ) : null}
                  {selectedTimeline ? (
                    <div>
                      <span>Contender</span>
                      <strong>{selectedTimeline.contenderScore}/100</strong>
                      <p>Win-now score from starter strength and total roster value.</p>
                    </div>
                  ) : null}
                  {selectedTimeline ? (
                    <div>
                      <span>Rebuild</span>
                      <strong>{selectedTimeline.rebuildScore}/100</strong>
                      <p>Future score from 2027 outlook, youth, and distance from contention.</p>
                    </div>
                  ) : null}
                  {selectedTimeline ? (
                    <div>
                      <span>Aging Risk</span>
                      <strong>{selectedTimeline.agingRisk}/100</strong>
                      <p>Higher means the roster is older and needs age protection.</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="manager-command-grid">
                <div>
                  <h4>Projected Starters</h4>
                  <div className="manager-command-tile-lineup">
                    {lineupGroups.map((group) => (
                      <div key={group.label} className="manager-command-tile-group">
                        <span>{group.label}</span>
                        <div className="manager-command-tile-grid">
                          {group.players.length ? group.players.map((player) => (
                            <CommandPlayerTile
                              key={player.player_id}
                              player={player}
                              onClick={() => openCommandPlayer(player)}
                            />
                          )) : (
                            <span className="manager-command-empty-tile">Needs Help</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4>Can Step In</h4>
                  <div className="manager-command-tile-lineup manager-command-step-in">
                    {canStepInGroups.length ? canStepInGroups.map((group) => (
                      <div key={group.label} className="manager-command-tile-group">
                        <span>{group.label}</span>
                        <div className="manager-command-tile-grid">
                          {group.players.map((player) => (
                            <CommandPlayerTile
                              key={player.player_id}
                              player={player}
                              variant="step"
                              onClick={() => openCommandPlayer(player)}
                            />
                          ))}
                        </div>
                      </div>
                    )) : (
                      <span className="manager-command-empty-tile">No starter-grade depth</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="manager-command-section manager-command-read">
                <h4>Trade / Picks</h4>
                <p>{selectedTrade ? `${selectedTrade.tradeCount} trades, ${selectedTrade.winPct}% win rate, ${selectedTrade.profit > 0 ? '+' : ''}${selectedTrade.profit.toLocaleString()} profit` : 'No completed trade profile yet.'}</p>
                <p>{selectedPick ? `${selectedPick.count2026} picks in 2026, ${selectedPick.count2027} picks in 2027, ${formatCompactValue(selectedPick.totalValue)} total draft capital` : 'No pick portfolio data available.'}</p>
                <div className="manager-command-inline-read">
                  <h4>Roster Read</h4>
                  <p>{selectedIntel?.strategySummary || rosterRead}</p>
                </div>
              </div>
              {selectedIntel && [selectedIntel.buyTarget, selectedIntel.sellCandidate, selectedIntel.tradeChip, selectedIntel.injuryInsurance].some(Boolean) ? (
                <div className="manager-command-section">
                  <h4>Trade Ideas</h4>
                  <div className="manager-command-tile-grid">
                    {selectedIntel.buyTarget ? (
                      <CommandPlayerTile label="Buy Target" player={selectedIntel.buyTarget} onClick={() => openCommandPlayer(selectedIntel.buyTarget!)} />
                    ) : null}
                    {selectedIntel.sellCandidate ? (
                      <CommandPlayerTile label="Sell Candidate" player={selectedIntel.sellCandidate} onClick={() => openCommandPlayer(selectedIntel.sellCandidate!)} />
                    ) : null}
                    {selectedIntel.tradeChip ? (
                      <CommandPlayerTile label="Trade Chip" player={selectedIntel.tradeChip} onClick={() => openCommandPlayer(selectedIntel.tradeChip!)} />
                    ) : null}
                    {selectedIntel.injuryInsurance ? (
                      <CommandPlayerTile label="Insurance" player={selectedIntel.injuryInsurance} onClick={() => openCommandPlayer(selectedIntel.injuryInsurance!)} />
                    ) : null}
                  </div>
                </div>
              ) : null}
              {selectedIntel?.untouchablePlayers?.length ? (
                <div className="manager-command-section manager-command-untouchable">
                  <h4>Should Be Untouchable</h4>
                  <div className="manager-command-tile-grid">
                    {selectedIntel.untouchablePlayers.map((player) => (
                      <CommandPlayerTile
                        key={player.player_id}
                        player={player}
                        onClick={() => openCommandPlayer(player)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedIntel?.droppablePlayers?.length ? (
                <div className="manager-command-section">
                  <h4>Most Droppable</h4>
                  <div className="manager-command-tile-grid">
                    {selectedIntel.droppablePlayers.map((player) => (
                      <CommandPlayerTile
                        key={player.player_id}
                        player={player}
                        onClick={() => openCommandPlayer(player)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
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
    </>
  );
}

export function ManagerIntelligenceCards({
  data,
  managerAvatars,
  leagueId,
  leagueLogo,
}: {
  data?: ReportData['managerRosterIntelligence'];
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  if (!data?.length) return null;
  const selectedRow = selectedManager ? data.find((row) => row.manager === selectedManager) : null;

  return (
    <>
      <div className="command-depth-grid">
        {data.map((row) => (
          <ManagerDepthTile
            key={row.manager}
            manager={row.manager}
            avatarUrl={managerAvatars?.[row.manager]}
            badges={[
              { label: titleCasePill(row.identity), tone: getPillToneClass(row.identity).includes('good') ? 'good' : 'neutral' },
              { label: `${Math.round(row.starterValuePct)}% starters`, tone: row.starterValuePct >= 58 ? 'good' : row.starterValuePct <= 45 ? 'warn' : 'neutral' },
              ...(row.avgAge !== null ? [{ label: `${row.avgAge} avg age`, tone: row.avgAge >= 27.5 ? 'warn' as const : row.avgAge <= 25 ? 'future' as const : 'good' as const }] : []),
              { label: titleCasePill(row.timeline), tone: getPillToneClass(row.timeline).includes('future') ? 'future' : getPillToneClass(row.timeline).includes('danger') ? 'danger' : 'good' },
              ...row.ageFlags.slice(0, 2).map((flag) => ({
                label: titleCasePill(flag),
                tone: flag.toLowerCase().includes('old') || flag.toLowerCase().includes('aging') || flag.toLowerCase().includes('risk') ? 'danger' as const : 'future' as const,
              })),
              ...(row.starterAvailability.avgGamesMissed !== null
                ? [{
                    label: `${row.starterAvailability.avgGamesMissed} missed/gm`,
                    tone: row.starterAvailability.riskLevel === 'high' ? 'danger' as const : row.starterAvailability.riskLevel === 'medium' ? 'warn' as const : 'good' as const,
                  }]
                : []),
            ]}
            onClick={() => setSelectedManager(row.manager)}
          />
        ))}
      </div>

      <Dialog open={selectedRow !== null} onOpenChange={(open) => !open && setSelectedManager(null)}>
        <DialogContent className="manager-command-dialog max-w-4xl border-cyan-300/20 bg-slate-950 p-0 text-slate-100">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedRow?.manager || 'Manager'} Identity Timeline</DialogTitle>
            <DialogDescription>Roster identity, age curve, depth signals, and key players.</DialogDescription>
          </DialogHeader>
          {selectedRow && (
            <div className="manager-command-modal-inner">
              <div className="manager-command-hero">
                {managerAvatars?.[selectedRow.manager] && (
                  <>
                    <img src={managerAvatars[selectedRow.manager] || ''} alt="" className="manager-hero-wash" />
                    <img src={managerAvatars[selectedRow.manager] || ''} alt="" className="manager-hero-watermark" />
                  </>
                )}
                <div className="manager-hero-scrim" />
                <div className="manager-command-title-lockup">
                  {managerAvatars?.[selectedRow.manager] ? (
                    <img src={managerAvatars[selectedRow.manager] || ''} alt={selectedRow.manager} className="manager-command-avatar" />
                  ) : (
                    <span className="manager-command-avatar">{selectedRow.manager[0]?.toUpperCase() || '?'}</span>
                  )}
                  <div className="min-w-0">
                    <p>Team Identity</p>
                    <h3>{selectedRow.manager}</h3>
                  </div>
                </div>
                <div className="manager-command-hero-metrics">
                  <IntelligenceMetric label="Starters" value={formatCompactValue(selectedRow.starterValue)} />
                  <IntelligenceMetric label="Bench" value={formatCompactValue(selectedRow.benchValue)} />
                  <IntelligenceMetric label="Starter Share" value={`${Math.round(selectedRow.starterValuePct)}%`} />
                </div>
              </div>

              <div className="manager-command-body">
                <div className="manager-command-tag-row" aria-label="Manager identity tags">
                  {[selectedRow.identity, selectedRow.timeline, ...selectedRow.ageFlags, selectedRow.holes.summary]
                    .filter(Boolean)
                    .slice(0, 6)
                    .map((tag) => (
                      <span key={tag} className={`manager-intel-pill ${getPillToneClass(tag)}`}>
                        {titleCasePill(tag)}
                      </span>
                    ))}
                </div>

                <div className="manager-command-rank-summary">
                  <div><span>Avg Age</span><strong>{selectedRow.avgAge ?? '-'}</strong></div>
                  <div><span>QB Age</span><strong>{selectedRow.avgAgeByPosition.QB ?? '-'}</strong></div>
                  <div><span>RB Age</span><strong>{selectedRow.avgAgeByPosition.RB ?? '-'}</strong></div>
                  <div><span>WR Age</span><strong>{selectedRow.avgAgeByPosition.WR ?? '-'}</strong></div>
                  <div><span>TE Age</span><strong>{selectedRow.avgAgeByPosition.TE ?? '-'}</strong></div>
                </div>

                <div className="manager-command-grid">
                  <div className="manager-command-section">
                    <h4>Key Players</h4>
                    <div className="manager-intel-player-grid">
                      <PlayerInsightTile label="Bench Stash" player={selectedRow.bestBenchStash} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} onSelect={setSelectedPlayer} />
                      <PlayerInsightTile label="Upgrade Spot" player={selectedRow.weakestStarter} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} onSelect={setSelectedPlayer} tone="warn" />
                      <PlayerInsightTile label="Age Risk" player={selectedRow.oldestPlayer} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} onSelect={setSelectedPlayer} tone="danger" />
                      <PlayerInsightTile label="Young Core" player={selectedRow.youngCorePlayer} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} onSelect={setSelectedPlayer} />
                      <PlayerInsightTile label="Upside Play" player={selectedRow.breakoutCandidate} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} onSelect={setSelectedPlayer} />
                      <PlayerInsightTile label="Buy Target" player={selectedRow.buyTarget} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} onSelect={setSelectedPlayer} />
                      <PlayerInsightTile label="Sell Candidate" player={selectedRow.sellCandidate} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} onSelect={setSelectedPlayer} tone="warn" />
                      <PlayerInsightTile label="Trade Chip" player={selectedRow.tradeChip} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} onSelect={setSelectedPlayer} />
                      <PlayerInsightTile label="Insurance" player={selectedRow.injuryInsurance} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} onSelect={setSelectedPlayer} />
                      <PlayerInsightTile
                        label="Last Year Stud"
                        player={selectedRow.lastSeasonStud}
                        manager={selectedRow.manager}
                        managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                        onSelect={setSelectedPlayer}
                        crownedRank={selectedRow.lastSeasonStud?.lastSeasonPositionRank
                          ? `${selectedRow.lastSeasonStud.lastSeasonYear || '2025'} ${selectedRow.lastSeasonStud.lastSeasonPositionRank}`
                          : null}
                      />
                    </div>
                  </div>

                  <div className="manager-command-section manager-command-read">
                    <h4>Roster Read</h4>
                    <p>{selectedRow.strategySummary || selectedRow.summary}</p>
                    <div className="manager-command-inline-read">
                      <h4>Attack Points</h4>
                      <p>QB: {selectedRow.holes.bestQbRank || '-'} · RB2: {selectedRow.holes.rb2Rank || '-'} · WR3: {selectedRow.holes.wr3Rank || '-'} · TE1: {selectedRow.holes.te1Rank || '-'} · Flex depth: {selectedRow.holes.flexDepth}</p>
                    </div>
                    <div className="manager-command-inline-read">
                      <h4>Availability</h4>
                      <p>
                        {selectedRow.starterAvailability.avgGamesMissed !== null
                          ? `${selectedRow.starterAvailability.riskLevel.toUpperCase()} risk. Starters averaged ${selectedRow.starterAvailability.avgGamesMissed} missed games last season${selectedRow.starterAvailability.riskiestStarter ? `; ${selectedRow.starterAvailability.riskiestStarter.name} is the biggest availability flag` : ''}.`
                          : 'Availability sample is not deep enough yet.'}
                      </p>
                    </div>
                    <div className="manager-command-inline-read">
                      <h4>Similar Value</h4>
                      <p>
                        {(['QB', 'RB', 'WR', 'TE'] as const)
                          .map((pos) => selectedRow.similarValuePlayers[pos] ? `${pos}: ${selectedRow.similarValuePlayers[pos]?.name} (${selectedRow.similarValuePlayers[pos]?.currentPositionRank || pos})` : null)
                          .filter(Boolean)
                          .join(' · ') || 'No clean same-position value comps on this roster.'}
                      </p>
                    </div>
                  </div>
                </div>
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
    </>
  );
}

export function PowerRankingsTable({
  data,
  managerAvatars,
}: {
  data?: ReportData['powerRankings'];
  managerAvatars?: ManagerAvatars;
}) {
  if (!data?.length) return null;

  return (
    <div className="flex justify-center">
      <Card className="report-card-polished overflow-hidden border-slate-800 bg-slate-900">
        <Table className="report-table-polished power-rankings-table">
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="text-white font-semibold">Manager</TableHead>
              <TableHead className="text-center text-white font-semibold">Tier</TableHead>
              <TableHead className="text-right text-white font-semibold">Score</TableHead>
              <TableHead className="text-right text-white font-semibold">Starter</TableHead>
              <TableHead className="text-right text-white font-semibold">Youth</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.manager} className="border-slate-700">
                <TableCell className="font-semibold text-slate-100">{renderManagerName(row.manager, managerAvatars)}</TableCell>
                <TableCell className="text-center text-cyan-300 font-black">{row.tier}</TableCell>
                <TableCell className="text-right text-orange-300 font-black">{row.score}</TableCell>
                <TableCell className="text-right text-slate-300">{row.starterStrength}</TableCell>
                <TableCell className="text-right text-slate-300">{row.youthScore}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
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
        <div className="overflow-visible">
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
      <div className="overflow-visible">
        <Table className="report-table-polished weekly-momentum-table">
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="text-white font-semibold">Player</TableHead>
              <TableHead className="weekly-manager-heading text-white font-semibold">Manager</TableHead>
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
      <div className="overflow-visible">
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
        <div className="overflow-visible">
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
      <div className="overflow-visible">
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
        <div className="overflow-visible">
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
      <div className="overflow-visible">
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
              <div className="overflow-visible">
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
              <div className="overflow-visible">
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

export function StarterBenchSnapshot({
  data,
  managerAvatars,
  leagueId,
  leagueLogo,
}: {
  data?: ReportData['managerRosterIntelligence'];
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  if (!data?.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((row) => (
        <Card key={row.manager} className="report-card-polished border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0">{renderManagerName(row.manager, managerAvatars)}</div>
            <span className="rounded-full bg-cyan-400/10 px-2 py-1 text-[0.65rem] font-black text-cyan-300">{row.starterValuePct}% starters</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <IntelligenceMetric label="Starter Value" value={formatCompactValue(row.starterValue)} />
            <IntelligenceMetric label="Bench Value" value={formatCompactValue(row.benchValue)} />
          </div>
          <div className="mt-3 grid gap-2">
            {row.bestBenchStash && (
              <button
                type="button"
                className="rounded-xl border border-cyan-300/15 bg-slate-950/45 p-2 text-left"
                onClick={() => setSelectedPlayer(buildPlayerModalData({
                  playerId: row.bestBenchStash?.player_id,
                  playerName: row.bestBenchStash?.name || '',
                  playerPos: row.bestBenchStash?.pos,
                  value: row.bestBenchStash?.value,
                  playerDetails: row.bestBenchStash?.playerDetails,
                  currentPositionRank: row.bestBenchStash?.currentPositionRank,
                  manager: row.manager,
                  managerAvatarUrl: managerAvatars?.[row.manager],
                }))}
              >
                <div className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-cyan-300/80">Best Bench Stash</div>
                <div className="mt-1 flex items-center justify-between gap-2 text-sm font-black text-slate-100">
                  <span className="truncate">{row.bestBenchStash.name}</span>
                  <span className="text-emerald-300">{formatCompactValue(row.bestBenchStash.value)}</span>
                </div>
              </button>
            )}
            {row.weakestStarter && (
              <button
                type="button"
                className="rounded-xl border border-orange-300/15 bg-slate-950/45 p-2 text-left"
                onClick={() => setSelectedPlayer(buildPlayerModalData({
                  playerId: row.weakestStarter?.player_id,
                  playerName: row.weakestStarter?.name || '',
                  playerPos: row.weakestStarter?.pos,
                  value: row.weakestStarter?.value,
                  playerDetails: row.weakestStarter?.playerDetails,
                  currentPositionRank: row.weakestStarter?.seasonPositionRank || row.weakestStarter?.currentPositionRank,
                  manager: row.manager,
                  managerAvatarUrl: managerAvatars?.[row.manager],
                }))}
              >
                <div className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-orange-300/80">Upgrade Spot</div>
                <div className="mt-1 flex items-center justify-between gap-2 text-sm font-black text-slate-100">
                  <span className="truncate">{row.weakestStarter.name}</span>
                  <PositionRankPill rank={row.weakestStarter.seasonPositionRank || row.weakestStarter.currentPositionRank || row.weakestStarter.pos} />
                </div>
              </button>
            )}
          </div>
        </Card>
      ))}
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

export function TradeTendenciesTable({
  data,
  managerAvatars,
  tradeHistory = [],
}: {
  data?: ReportData['tradeTendencies'];
  managerAvatars?: ManagerAvatars;
  tradeHistory?: ReportData['tradeHistory'];
}) {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  if (!data?.length) return null;
  const selectedRow = selectedManager ? data.find((row) => row.manager === selectedManager) : null;
  const selectedHabit = selectedRow ? getTradeHabit(selectedRow) : null;
  const selectedTrades = selectedManager
    ? tradeHistory.filter((trade) => trade.team_a === selectedManager || trade.team_b === selectedManager)
    : [];
  const selectedSwings = selectedManager
    ? selectedTrades
        .map((trade) => ({
          trade,
          swing: getManagerTradeSwing(trade, selectedManager),
          opponent: getTradeOpponent(trade, selectedManager),
          result: getManagerTradeResult(trade, selectedManager),
        }))
        .sort((a, b) => b.swing - a.swing)
    : [];
  const biggestProfit = selectedSwings.find((item) => item.swing > 0) || null;
  const biggestLoss = [...selectedSwings].reverse().find((item) => item.swing < 0) || null;

  return (
    <div className="flex justify-center">
      <Card className="trade-tendencies-card overflow-hidden border-slate-800 bg-slate-900">
        <Table className="report-table-polished trade-tendencies-table">
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="text-white font-semibold">Manager</TableHead>
              <TableHead className="text-right text-white font-semibold">
                <span className="hidden sm:inline">Trades</span>
                <span className="sm:hidden">Deals</span>
              </TableHead>
              <TableHead className="text-right text-white font-semibold">
                <span className="hidden sm:inline">Avg Gap</span>
                <span className="sm:hidden">Avg</span>
              </TableHead>
              <TableHead className="text-right text-white font-semibold">
                <span className="hidden sm:inline">Trade Habit</span>
                <span className="sm:hidden">Habit</span>
              </TableHead>
              <TableHead className="text-right text-white font-semibold">
                <span className="hidden sm:inline">Likes Trading With</span>
                <span className="sm:hidden">Partner</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={row.manager}
                className="cursor-pointer border-slate-700"
                onClick={() => setSelectedManager(row.manager)}
              >
                <TableCell className="trade-tendencies-manager font-semibold text-slate-100">{renderManagerName(row.manager, managerAvatars)}</TableCell>
                <TableCell className="trade-tendencies-count text-right text-orange-300 font-black">{row.tradeCount}</TableCell>
                <TableCell className="trade-tendencies-gap text-right text-slate-300">{row.avgGap.toLocaleString()}</TableCell>
                <TableCell className="trade-tendencies-habit text-right text-cyan-300 font-bold">
                  <span className={`trade-habit-pill ${getTradeHabit(row).className}`}>
                    {getTradeHabit(row).label}
                  </span>
                </TableCell>
                <TableCell className="trade-tendencies-partner text-right text-slate-300">
                  {row.favoritePartner ? renderPartnerName(row.favoritePartner, managerAvatars) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={selectedManager !== null} onOpenChange={(open) => !open && setSelectedManager(null)}>
        <DialogContent className="max-h-[86vh] max-w-[calc(100vw-1rem)] overflow-y-auto border-cyan-300/20 bg-slate-950 p-0 text-slate-100 sm:max-w-2xl">
          {selectedManager && selectedRow && (
            <div className="trade-manager-modal-inner">
              <div className="trade-manager-modal-hero">
                {managerAvatars?.[selectedManager] && (
                  <>
                    <img src={managerAvatars[selectedManager] || ''} alt="" className="trade-manager-hero-wash" />
                    <img src={managerAvatars[selectedManager] || ''} alt="" className="trade-manager-hero-orb" />
                  </>
                )}
                <div className="trade-manager-hero-scrim" />
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
                        Trade Tendencies
                      </p>
                      <DialogTitle className="athletic-headline mt-1 truncate text-3xl font-black leading-none text-orange-400">
                        {selectedManager}
                      </DialogTitle>
                    </div>
                  </div>
                </DialogHeader>
              </div>
              <div className="trade-tendency-modal-body">
                <div className="trade-manager-stats">
                  <div>
                    <span>Trades</span>
                    <strong>{selectedRow.tradeCount}</strong>
                  </div>
                  <div>
                    <span>Win Rate</span>
                    <strong>{selectedRow.winPct}%</strong>
                  </div>
                  <div>
                    <span>Profit</span>
                    <strong className={selectedRow.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {selectedRow.profit >= 0 ? '+' : ''}
                      {selectedRow.profit.toLocaleString()}
                    </strong>
                  </div>
                </div>
                <div className="trade-tendency-detail-grid">
                  <div>
                    <span>Likes Trading With</span>
                    <strong>{selectedRow.favoritePartner || '-'}</strong>
                    <p>Most common trade partner by completed Sleeper deals.</p>
                  </div>
                  <div>
                    <span>Average Gap</span>
                    <strong>{selectedRow.avgGap.toLocaleString()}</strong>
                    <p>Average value difference across this manager's trades.</p>
                  </div>
                  <div>
                    <span>Trade Habit</span>
                    <strong className={selectedHabit?.className || ''}>{selectedHabit?.label || '-'}</strong>
                    <p>Based on volume, profit, win rate, average gap, and pick/veteran overpay signals.</p>
                  </div>
                  <div>
                    <span>Pick / Vet Signal</span>
                    <strong>
                      {selectedRow.overpaysForPicks
                        ? 'Pays For Picks'
                        : selectedRow.overpaysForVeterans
                          ? 'Vet Shopper'
                          : 'Balanced'}
                    </strong>
                    <p>Looks at whether value is consistently leaving for picks or older players.</p>
                  </div>
                </div>
                <div className="trade-tendency-swing-grid">
                  <div>
                    <span>Biggest Profit</span>
                    {biggestProfit ? (
                      <>
                        <strong className="text-green-400">+{biggestProfit.swing.toLocaleString()}</strong>
                        <p>{biggestProfit.trade.date} vs {biggestProfit.opponent}</p>
                      </>
                    ) : (
                      <p>No profitable trade logged.</p>
                    )}
                  </div>
                  <div>
                    <span>Biggest Loss</span>
                    {biggestLoss ? (
                      <>
                        <strong className="text-red-400">{biggestLoss.swing.toLocaleString()}</strong>
                        <p>{biggestLoss.trade.date} vs {biggestLoss.opponent}</p>
                      </>
                    ) : (
                      <p>No losing trade logged.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getTradeHabit(row: NonNullable<ReportData['tradeTendencies']>[number]) {
  if (row.tradeCount === 0) return { label: 'Quiet So Far', className: 'trade-habit-neutral' };
  if (row.tradeCount === 1) {
    return row.profit >= 0
      ? { label: 'One Deal, Won It', className: 'trade-habit-good' }
      : { label: 'One Deal, Paid Up', className: 'trade-habit-warn' };
  }
  if (row.profit >= 2500 && row.winPct >= 60) return { label: 'Trade Shark', className: 'trade-habit-good' };
  if (row.profit >= 1000) return { label: 'Value Hunter', className: 'trade-habit-good' };
  if (row.profit <= -2500) return { label: 'League Donor', className: 'trade-habit-danger' };
  if (row.profit <= -1000) return { label: 'Pays the Tax', className: 'trade-habit-warn' };
  if (row.avgGap <= 300) return { label: 'Fair Dealer', className: 'trade-habit-neutral' };
  if (row.overpaysForPicks) return { label: 'Pick Chaser', className: 'trade-habit-warn' };
  if (row.overpaysForVeterans) return { label: 'Vet Shopper', className: 'trade-habit-warn' };
  if (row.tradeCount >= 8) return { label: 'Volume Trader', className: 'trade-habit-info' };
  if (row.winPct >= 67) return { label: 'Sharp Closer', className: 'trade-habit-good' };
  return { label: 'Risk Taker', className: 'trade-habit-info' };
}

export function PickPortfolioTable({
  data,
  managerAvatars,
}: {
  data?: ReportData['pickPortfolios'];
  managerAvatars?: ManagerAvatars;
}) {
  if (!data?.length) return null;

  return (
    <div className="flex justify-center">
      <Card className="report-card-polished overflow-hidden border-slate-800 bg-slate-900">
        <Table
          className="report-table-polished pick-portfolio-table"
          containerClassName="overflow-visible"
          style={{ tableLayout: 'fixed' }}
        >
          <TableHeader className="border-b-2 border-orange-500/30">
            <TableRow className="border-slate-700">
              <TableHead className="text-white font-semibold">Manager</TableHead>
              <TableHead className="text-right text-white font-semibold">2025</TableHead>
              <TableHead className="text-right text-white font-semibold">2026</TableHead>
              <TableHead className="text-right text-white font-semibold">2027</TableHead>
              <TableHead className="text-right text-white font-semibold">Owned</TableHead>
              <TableHead className="text-right text-white font-semibold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.manager} className="border-slate-700">
                <TableCell className="font-semibold text-slate-100">{renderManagerName(row.manager, managerAvatars)}</TableCell>
                <TableCell className="text-right text-slate-300"><PickYearCell count={row.count2025} value={row.value2025} /></TableCell>
                <TableCell className="text-right text-slate-300"><PickYearCell count={row.count2026} value={row.value2026} /></TableCell>
                <TableCell className="text-right text-slate-300"><PickYearCell count={row.count2027} value={row.value2027} /></TableCell>
                <TableCell className="text-right text-cyan-300">{row.ownPicks}/{row.ownPicks + row.acquiredPicks}</TableCell>
                <TableCell className="text-right text-orange-300 font-black">{formatCompactValue(row.totalValue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export function WaiverIntelligencePanel({
  data,
  managerAvatars,
  leagueId,
  leagueLogo,
}: {
  data?: ReportData['waiverIntelligence'];
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  if (!data) return null;
  const cards = [
    { label: 'Highest Available', player: data.highestKtcAvailable },
    ...Object.entries(data.bestAvailableByPosition).map(([pos, player]) => ({ label: `Best ${pos}`, player })),
  ].filter((card) => card.player);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(({ label, player }) => (
        <button
          key={label}
          type="button"
          className="waiver-intel-card"
          onClick={() => player && setSelectedPlayer(buildPlayerModalData({
            playerId: player.player_id,
            playerName: player.name,
            playerPos: player.pos,
            value: player.ktcValue,
            playerDetails: player.playerDetails,
            currentPositionRank: player.currentPositionRank,
            manager: player.owner || null,
            managerAvatarUrl: player.owner ? managerAvatars?.[player.owner] : null,
          }))}
        >
          <div className="waiver-intel-top">
            <span className="waiver-intel-label">{label}</span>
            <span className="available-manager-label">Available</span>
          </div>
          <div className="waiver-intel-main">
            <PlayerNameWithHeadshot playerId={player?.player_id} playerName={player?.name || '-'} />
          </div>
          <div className="waiver-intel-pills">
            <PositionRankPill rank={player?.currentPositionRank || player?.pos || '-'} />
            <span>{player?.playerDetails?.team || player?.team || 'FA'}</span>
            <span>{formatCompactValue(player?.ktcValue)}</span>
          </div>
        </button>
      ))}
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

export function TradeMarketRadar({
  risers,
  fallers,
  managerAvatars,
  leagueId,
  leagueLogo,
}: {
  risers: ReportData['weeklyRisers'];
  fallers: ReportData['weeklyFallers'];
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const sellHigh = risers.filter((player) => player.val_now >= 2500).slice(0, 5);
  const buyLow = fallers.filter((player) => player.val_now >= 1800).slice(0, 5);
  const rows = [
    ...sellHigh.map((player) => ({ label: 'Sell High', tone: 'positive' as const, player })),
    ...buyLow.map((player) => ({ label: 'Buy Low', tone: 'negative' as const, player })),
  ].slice(0, 10);
  if (rows.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(({ label, tone, player }) => (
        <button
          key={`${label}-${player.player_id || player.name}`}
          type="button"
          className={`trade-market-card ${tone === 'positive' ? 'trade-market-card-sell' : 'trade-market-card-buy'}`}
          onClick={() => setSelectedPlayer(buildPlayerModalData({
            playerId: player.player_id,
            playerName: player.name,
            playerPos: player.pos,
            value: player.val_now,
            valueGain: player.diff,
            playerDetails: player.playerDetails,
            currentPositionRank: player.currentPositionRank,
            manager: player.owner,
            managerAvatarUrl: managerAvatars?.[player.owner],
            valueChangeNote: 'Change from last week to this week.',
          }))}
        >
          <div className="trade-market-top">
            <span className="trade-market-signal">{label}</span>
            <span className={`trade-market-change ${tone === 'positive' ? 'text-emerald-300' : 'text-rose-300'}`}>
              {player.diff > 0 ? '+' : ''}{player.diff.toLocaleString()}
            </span>
          </div>
          <div className="trade-market-main">
            <PlayerNameWithHeadshot playerId={player.player_id} playerName={player.name} />
            <div className="trade-market-manager">
              {renderManagerName(player.owner, managerAvatars)}
            </div>
          </div>
          <div className="trade-market-pills">
            <PositionRankPill rank={player.currentPositionRank || player.pos} />
            <span>{player.playerDetails?.team || 'FA'}</span>
            <span>{formatCompactValue(player.val_now)}</span>
          </div>
        </button>
      ))}
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
        <div className="overflow-visible">
          <Table className="report-table-polished position-counts-table">
            <TableHeader className="border-b-2 border-orange-500/30">
              <TableRow className="border-slate-700">
                <TableHead className="overview-manager-heading text-white font-semibold">
                  <div>Manager</div>
                </TableHead>
                <TableHead className="text-center text-white font-semibold text-xs">
                  <div>QB</div>
                  <div className="position-starter-header">Starters</div>
                </TableHead>
                <TableHead className="text-center text-white font-semibold text-xs">
                  <div>RB</div>
                  <div className="position-starter-header">Starters</div>
                </TableHead>
                <TableHead className="text-center text-white font-semibold text-xs">
                  <div>WR</div>
                  <div className="position-starter-header">Starters</div>
                </TableHead>
                <TableHead className="text-center text-white font-semibold text-xs">
                  <div>TE</div>
                  <div className="position-starter-header">Starters</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => (
                <TableRow
                  key={idx}
                  className="cursor-pointer border-slate-700 hover:bg-slate-800/30"
                  onClick={() => setSelectedManager(row)}
                >
                  <TableCell className="overview-manager-cell font-semibold text-slate-100">
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
                            currentPositionRank: player.seasonPositionRank || player.currentPositionRank,
                            manager: selectedManager.manager,
                            managerAvatarUrl: selectedAvatar,
                          }));
                        }}
                      >
                        <div className="starter-player-main">
                          <PlayerNameWithHeadshot playerId={player.player_id} playerName={player.name} />
                        </div>
                        <div className="starter-player-meta">
                          <PositionRankPill rank={player.seasonPositionRank || player.currentPositionRank || player.pos} />
                          <span className="starter-player-team-pill">{player.playerDetails?.team || 'FA'}</span>
                          <span className="starter-player-status-pill">{formatStarterStatus(player.playerDetails?.status)}</span>
                          <strong>{player.value.toLocaleString()}</strong>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-cyan-300/15 bg-slate-950/45 px-4 py-8 text-center text-sm font-bold text-slate-400">
                    No starters found for this manager.
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
