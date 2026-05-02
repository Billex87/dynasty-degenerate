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
import type { DraftPick, ManagerIntelPlayer, ReportData, TrendingPlayer } from '@shared/types';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { ChampionAvatarFrame, ManagerChampionshipPills } from './ManagerChampionships';
import { PlayerDetailModal, type PlayerModalData } from './PlayerDetailModal';
import { getPositionRankPillClass } from '@/lib/positionRank';
import { getTeamTileStyle } from '@/lib/teamTileStyle';

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
  valueMode = 'dynasty',
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
  valueMode?: ReportData['leagueValueMode'];
}): PlayerModalData {
  const mappedDetails = playerId ? playerDetailsById?.[playerId] : undefined;
  const details = playerDetails
    ? {
        ...mappedDetails,
        ...playerDetails,
        valueProfile: playerDetails.valueProfile || mappedDetails?.valueProfile,
        lastSeasonPositionRank: playerDetails.lastSeasonPositionRank || mappedDetails?.lastSeasonPositionRank,
        lastSeasonFantasyPoints: playerDetails.lastSeasonFantasyPoints ?? mappedDetails?.lastSeasonFantasyPoints,
        lastSeasonGames: playerDetails.lastSeasonGames ?? mappedDetails?.lastSeasonGames,
        lastSeasonPointsPerGame: playerDetails.lastSeasonPointsPerGame ?? mappedDetails?.lastSeasonPointsPerGame,
        lastSeasonYear: playerDetails.lastSeasonYear || mappedDetails?.lastSeasonYear,
        availabilityHistory: playerDetails.availabilityHistory?.length ? playerDetails.availabilityHistory : mappedDetails?.availabilityHistory,
        latestNews: playerDetails.latestNews || mappedDetails?.latestNews,
        avgGamesMissed: playerDetails.avgGamesMissed ?? mappedDetails?.avgGamesMissed,
        availabilitySeasons: playerDetails.availabilitySeasons ?? mappedDetails?.availabilitySeasons,
        similarTradeValues: playerDetails.similarTradeValues || mappedDetails?.similarTradeValues,
      }
    : mappedDetails;
  const profileRank = valueMode === 'redraft'
    ? details?.valueProfile?.seasonPositionRank || details?.valueProfile?.fantasyProsPositionRank || details?.valueProfile?.dynastyPositionRank
    : details?.valueProfile?.dynastyPositionRank || details?.valueProfile?.balancedPositionRank || details?.valueProfile?.seasonPositionRank;
  return {
    player_id: playerId,
    playerName,
    playerPos: playerPos || details?.position,
    manager: manager || undefined,
    managerAvatarUrl,
    currentPositionRank: currentPositionRank || profileRank || null,
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
    <span className="partner-chip-reverse">
      <span>{manager}</span>
      <ChampionAvatarFrame managerName={manager}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={manager} />
        ) : (
          <span aria-hidden="true" className="partner-chip-fallback">{initial}</span>
        )}
      </ChampionAvatarFrame>
    </span>
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
          <ChampionAvatarFrame managerName={manager}>
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
          </ChampionAvatarFrame>
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
        <ChampionAvatarFrame managerName={manager}>
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
        </ChampionAvatarFrame>
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
            <div className="trade-side-header relative flex items-center justify-between gap-3 border-b border-orange-300/15 pb-3">
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
  const draftYear = match?.[1] ?? null;
  const round = match?.[3] ? Number(match[3]) : null;
  const pickNumber = match?.[4] ?? null;

  return {
    label,
    displayLabel: draftYear && round
      ? `${draftYear} ${formatPickRound(round)}${pickNumber ? ` (${pickNumber})` : ''}`
      : label,
    value: value ? Number(value) : null,
    draftYear,
    originalOwner: match?.[2] ?? null,
    round,
    pickNumber,
  };
}

function formatPickRound(round: number): string {
  if (round === 1) return '1st';
  if (round === 2) return '2nd';
  if (round === 3) return '3rd';
  return `${round}th`;
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
    const teamStyle = getTeamTileStyle(details?.team);
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

    if (onPlayerClick) {
      return (
        <button
          key={key}
          type="button"
          className="player-team-tile trade-asset trade-asset-clickable trade-asset-player"
          style={teamStyle}
          aria-label={`Open ${playerItem.playerName} player card`}
          onClick={(event) => {
            event.preventDefault();
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
              playerDetailsById,
              manager,
              managerAvatarUrl,
              currentPositionRank: currentPositionRankById?.[playerItem.playerId],
            }));
          }}
        >
          {content}
        </button>
      );
    }

    return (
      <div key={key} className="player-team-tile trade-asset trade-asset-player" style={teamStyle}>
        {content}
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
          <span className="min-w-0 flex-1 truncate" title={pickItem.label}>{pickItem.displayLabel}</span>
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

function formatCompactValue(value: number | null | undefined): string {
  if (!value) return '-';
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}K`;
  return value.toLocaleString();
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

function normalizeIntelNote(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an|with|for|and|or|to|of|in|if|it|is|this|that)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeIntelNotes(notes: Array<string | null | undefined>, suppress: Array<string | null | undefined> = []) {
  const seen = new Set<string>();
  const suppressKeys = suppress
    .filter((note): note is string => Boolean(note))
    .map(normalizeIntelNote)
    .filter(Boolean);

  return notes
    .filter((note): note is string => Boolean(note))
    .filter((note) => {
      const key = normalizeIntelNote(note);
      if (!key || seen.has(key)) return false;
      if (suppressKeys.some((suppressKey) => suppressKey.includes(key) || key.includes(suppressKey))) return false;
      seen.add(key);
      return true;
    });
}

type OwnerIntelRow = NonNullable<ReportData['managerRosterIntelligence']>[number];
type OwnerTradeRow = NonNullable<ReportData['tradeTendencies']>[number];
type OwnerPickRow = NonNullable<ReportData['pickPortfolios']>[number];
type OwnerTimelineRow = NonNullable<ReportData['dynastyTimelines']>[number];

function parsePositionRankValue(rank: string | null | undefined): number | null {
  const match = String(rank || '').match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function formatSignedCompactValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `${value > 0 ? '+' : ''}${formatCompactValue(value)}`;
}

function getTaxiBadgeTone(action: string): 'good' | 'future' | 'warn' | 'danger' | 'neutral' {
  if (action === 'Promote Now') return 'good';
  if (action === 'Keep Parked') return 'future';
  if (action === 'Trade Sweetener') return 'neutral';
  if (action === 'Taxi Risk') return 'warn';
  if (action === 'Cuttable') return 'danger';
  return 'neutral';
}

function buildOwnerBestMove(row: OwnerIntelRow): string {
  const need = row.tradePlan?.needPosition;
  const surplus = row.tradePlan?.surplusPosition;
  const buyName = row.buyTarget?.name;
  const sellName = row.sellCandidate?.name || row.tradeChip?.name;

  if (need && surplus && buyName && sellName) {
    return `Shop ${surplus} surplus (${sellName}) for ${need} help (${buyName}). That is the cleanest way to turn excess roster value into a lineup fix.`;
  }

  if (need && buyName) {
    return `The clearest add is ${need} help. Start talks around ${buyName}, then use bench value or picks instead of breaking the core.`;
  }

  if (surplus && sellName) {
    return `This roster has extra ${surplus} value. ${sellName} is the easiest trade chip if another manager overpays.`;
  }

  if (row.tradePlan?.summary) return row.tradePlan.summary;

  return 'No forced trade path. This roster should wait for another manager to pay above market instead of creating a move just to move.';
}

function buildOwnerWindowCopy(row: OwnerIntelRow, timelineRow: OwnerTimelineRow | null | undefined): string {
  if (!timelineRow) {
    return `${titleCasePill(row.identity)} build. The model does not have enough timeline data to call a clean contender or rebuild lane yet.`;
  }

  const contenderScore = timelineRow.contenderScore;
  const rebuildScore = timelineRow.rebuildScore;
  const agingRisk = timelineRow.agingRisk;

  if (contenderScore >= 75 && contenderScore >= rebuildScore + 12) {
    return `Win-now lean. Contender score ${contenderScore}/100, rebuild score ${rebuildScore}/100, aging risk ${agingRisk}/100. This team should protect weekly starters and buy injury insurance before chasing long-term value.`;
  }

  if (rebuildScore >= contenderScore + 10) {
    return `Rebuild lean. Rebuild score ${rebuildScore}/100 beats contender score ${contenderScore}/100. Move older short-window points for younger assets, picks, or players rising in dynasty value.`;
  }

  return `Middle-build profile. Contender score ${contenderScore}/100 and rebuild score ${rebuildScore}/100 are close enough that this team should avoid all-in trades unless the upgrade clearly changes the lineup.`;
}

function buildOwnerShapeCopy(row: OwnerIntelRow): string {
  const starterShare = Math.round(row.starterValuePct);
  const ageCopy = row.avgAge !== null
    ? `Average roster age is ${row.avgAge}.`
    : 'Age profile is still incomplete.';
  const benchCopy = row.bestBenchStash
    ? `${row.bestBenchStash.name} is the best bench leverage piece.`
    : 'There is no obvious bench leverage piece yet.';
  const depthCopy = starterShare >= 58
    ? `${starterShare}% of value sits in starters, so this team is built to score now.`
    : starterShare <= 45
      ? `${starterShare}% of value sits in starters, so too much value may be parked outside the weekly lineup.`
      : `${starterShare}% of value sits in starters, which is a balanced roster shape.`;

  return `${titleCasePill(row.identity)} profile. ${depthCopy} ${ageCopy} ${benchCopy}`;
}

function buildOwnerTradeDraftProfile(tradeRow: OwnerTradeRow | null | undefined, pickRow: OwnerPickRow | null | undefined): string {
  const parts = [
    tradeRow ? `${tradeRow.tradeCount} trades` : null,
    tradeRow ? `${tradeRow.winPct}% win rate` : null,
    tradeRow ? `${formatSignedCompactValue(tradeRow.profit)} net profit` : null,
    tradeRow?.favoritePartner ? `favorite partner: ${tradeRow.favoritePartner}` : null,
    pickRow ? `${pickRow.count2026 + pickRow.count2027} future picks` : null,
    pickRow ? `${formatCompactValue(pickRow.totalValue)} draft capital` : null,
  ].filter(Boolean);

  return parts.length ? `${parts.join(' • ')}.` : 'No trade or draft-capital profile yet.';
}

function buildOwnerHealthCopy(row: OwnerIntelRow): string {
  const missed = row.starterAvailability.avgGamesMissed;
  if (missed === null || missed === undefined) {
    return 'Availability sample is still thin, so do not overreact to the injury read yet.';
  }

  const riskiest = row.starterAvailability.riskiestStarter?.name;
  if (missed >= 3) {
    return `High-friction availability profile: starters averaged ${missed} missed games. ${riskiest ? `${riskiest} is the biggest negotiation pressure point.` : 'Bench insurance should matter more than luxury depth.'}`;
  }

  if (missed >= 1.5) {
    return `Medium injury drag: starters averaged ${missed} missed games. ${riskiest ? `${riskiest} is the player to insure around.` : 'This roster should keep one extra usable spot starter.'}`;
  }

  return `Clean availability profile: starters averaged ${missed} missed games, so this roster can be more aggressive consolidating depth.`;
}

function buildOwnerWeakSpotCopy(row: OwnerIntelRow): string {
  const qbRank = parsePositionRankValue(row.holes.bestQbRank);
  const rb2Rank = parsePositionRankValue(row.holes.rb2Rank);
  const wr3Rank = parsePositionRankValue(row.holes.wr3Rank);
  const teRank = parsePositionRankValue(row.holes.te1Rank);
  const notes = [
    qbRank !== null && qbRank > 18 ? `QB starts at ${row.holes.bestQbRank}, so superflex pressure is real.` : null,
    rb2Rank !== null && rb2Rank > 28 ? `RB2 is ${row.holes.rb2Rank}, which can leak weekly points.` : null,
    wr3Rank !== null && wr3Rank > 36 ? `WR3 is ${row.holes.wr3Rank}, so receiver depth is the easiest attack point.` : null,
    teRank !== null && teRank > 14 ? `TE1 is ${row.holes.te1Rank}, leaving a weekly ceiling gap.` : null,
    row.holes.flexDepth <= 5 ? `Only ${row.holes.flexDepth} flex-depth pieces clear the starter window.` : null,
  ].filter(Boolean);

  if (notes.length) return notes.join(' ');

  return 'No emergency hole. The better angle is forcing this manager to overpay for a preference, not attacking an obvious weak spot.';
}

function PlayerInsightTile({
  label,
  player,
  manager,
  managerAvatarUrl,
  playerDetailsById,
  onSelect,
  tone = 'neutral',
  extraPill,
  crownedRank,
}: {
  label: string;
  player: ManagerIntelPlayer | null | undefined;
  manager: string;
  managerAvatarUrl?: string | null;
  playerDetailsById?: PlayerDetailsById;
  onSelect: (player: PlayerModalData) => void;
  tone?: 'neutral' | 'warn' | 'danger';
  extraPill?: string | null;
  crownedRank?: string | null;
}) {
  if (!player) return null;
  const playerDetails = player.playerDetails || (player.player_id ? playerDetailsById?.[player.player_id] : undefined);
  const playerTeam = playerDetails?.team || null;

  return (
    <button
      type="button"
      className={`player-team-tile manager-intel-player ${tone === 'warn' ? 'manager-intel-player-warn' : ''} ${tone === 'danger' ? 'manager-intel-player-danger' : ''}`}
      style={getTeamTileStyle(playerTeam)}
      onClick={() => onSelect(buildPlayerModalData({
        playerId: player.player_id,
        playerName: player.name,
        playerPos: player.pos,
        value: player.value,
        playerDetails,
        playerDetailsById,
        currentPositionRank: player.currentPositionRank || player.seasonPositionRank,
        manager: player.owner || manager,
        managerAvatarUrl: player.owner ? undefined : managerAvatarUrl,
      }))}
    >
      <div className="manager-intel-player-kicker">{label}</div>
      <div className="manager-intel-player-main">
        <PlayerNameWithHeadshot playerId={player.player_id} playerName={player.name} />
      </div>
      <div className="manager-intel-player-pills">
        <PositionRankPill rank={player.currentPositionRank || player.seasonPositionRank || player.pos} />
        {extraPill && <span>{extraPill}</span>}
        <span>{playerTeam || 'FA'}</span>
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

function TaxiTriageRow({
  player,
  manager,
  managerAvatarUrl,
  playerDetailsById,
  onSelect,
}: {
  player: NonNullable<OwnerIntelRow['taxiTriage']>['items'][number];
  manager: string;
  managerAvatarUrl?: string | null;
  playerDetailsById?: PlayerDetailsById;
  onSelect: (player: PlayerModalData) => void;
}) {
  const playerDetails = player.playerDetails || (player.player_id ? playerDetailsById?.[player.player_id] : undefined);
  const playerTeam = playerDetails?.team || null;
  const rank = player.currentPositionRank || player.seasonPositionRank || player.pos;
  const tone = getTaxiBadgeTone(player.taxiAction);

  return (
    <button
      type="button"
      className={`player-team-tile owner-intel-taxi-row owner-intel-taxi-row-${tone}`}
      style={getTeamTileStyle(playerTeam)}
      onClick={() => onSelect(buildPlayerModalData({
        playerId: player.player_id,
        playerName: player.name,
        playerPos: player.pos,
        value: player.value,
        playerDetails,
        playerDetailsById,
        currentPositionRank: rank,
        manager,
        managerAvatarUrl,
      }))}
    >
      <div className="owner-intel-taxi-player">
        <PlayerNameWithHeadshot playerId={player.player_id} playerName={player.name} />
        <div className="owner-intel-taxi-pills">
          <PositionRankPill rank={rank} />
          <span>Taxi</span>
          <span>{playerTeam || 'FA'}</span>
          <span>{formatCompactValue(player.value)}</span>
        </div>
      </div>
      <div className="owner-intel-taxi-note">
        <span className={`command-mini-badge command-mini-badge-${tone}`}>{player.taxiAction}</span>
        <p>{player.taxiReason}</p>
      </div>
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
      className={`player-team-tile manager-command-player-tile ${variant === 'step' ? 'manager-command-player-tile-step' : ''}`}
      style={getTeamTileStyle(player.playerDetails?.team)}
      onClick={onClick}
    >
      {label && <div className="manager-intel-player-kicker">{label}</div>}
      <div className="manager-command-player-tile-main">
        <PlayerNameWithHeadshot playerId={player.player_id} playerName={player.name} />
      </div>
      <div className="manager-command-player-tile-pills">
        <PositionRankPill rank={player.currentPositionRank || player.seasonPositionRank || player.pos} />
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
        <ChampionAvatarFrame managerName={manager} className="command-depth-champion">
          {avatarUrl ? (
            <img src={avatarUrl} alt={manager} className="command-depth-avatar" />
          ) : (
            <span className="command-depth-avatar">{manager[0]?.toUpperCase() || '?'}</span>
          )}
        </ChampionAvatarFrame>
        <span className="command-depth-name">{manager}</span>
      </span>
      <span className="command-depth-badges">
        <ManagerChampionshipPills managerName={manager} className="command-depth-championships" />
        {badges.map((badge) => (
          <span key={badge.label} className={`command-mini-badge command-mini-badge-${badge.tone || 'neutral'}`}>
            {badge.label}
          </span>
        ))}
      </span>
    </button>
  );
}

function OwnerMetricPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'info';
}) {
  return (
    <div className={`owner-metric-pill owner-metric-pill-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OwnerSummaryTile({
  manager,
  avatarUrl,
  children,
  onClick,
  className = '',
}: {
  manager: string;
  avatarUrl?: string | null;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      {avatarUrl && (
        <>
          <img src={avatarUrl} alt="" className="owner-summary-wash" />
          <img src={avatarUrl} alt="" className="owner-summary-mark" />
        </>
      )}
      <span className="owner-summary-scrim" />
      <span className="owner-summary-main">
        <ChampionAvatarFrame managerName={manager} className="owner-summary-avatar-frame">
          {avatarUrl ? (
            <img src={avatarUrl} alt={manager} className="owner-summary-avatar" />
          ) : (
            <span className="owner-summary-avatar">{manager[0]?.toUpperCase() || '?'}</span>
          )}
        </ChampionAvatarFrame>
        <span className="owner-summary-name-lockup">
          <span className="owner-summary-name">{manager}</span>
          <ManagerChampionshipPills managerName={manager} className="owner-summary-championships" />
        </span>
      </span>
      <span className="owner-summary-metrics">{children}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={`owner-summary-tile ${className}`} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <div className={`owner-summary-tile ${className}`}>
      {content}
    </div>
  );
}

function OwnerQuickModal({
  open,
  onOpenChange,
  title,
  manager,
  avatarUrl,
  metrics,
  note,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  manager?: string | null;
  avatarUrl?: string | null;
  metrics: Array<{ label: string; value: React.ReactNode; tone?: 'neutral' | 'positive' | 'negative' }>;
  note?: string;
}) {
  if (!manager) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="owner-quick-modal manager-command-dialog max-w-2xl border-cyan-300/20 bg-slate-950 p-0 text-slate-100">
        <DialogHeader className="sr-only">
          <DialogTitle>{manager} {title}</DialogTitle>
          <DialogDescription>Owner detail summary.</DialogDescription>
        </DialogHeader>
        <div className="manager-command-modal-inner">
          <div className="manager-command-hero owner-quick-hero">
            {avatarUrl && (
              <>
                <img src={avatarUrl} alt="" className="manager-hero-wash" />
                <img src={avatarUrl} alt="" className="manager-hero-watermark" />
              </>
            )}
            <div className="manager-hero-scrim" />
            <div className="manager-command-title-lockup">
              <ChampionAvatarFrame managerName={manager} className="manager-command-champion-frame">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={manager} className="manager-command-avatar" />
                ) : (
                  <span className="manager-command-avatar">{manager[0]?.toUpperCase() || '?'}</span>
                )}
              </ChampionAvatarFrame>
              <div className="min-w-0">
                <p>{title}</p>
                <h3>{manager}</h3>
                <ManagerChampionshipPills managerName={manager} className="manager-command-championships" />
              </div>
            </div>
            <div className="manager-command-hero-metrics owner-quick-metrics">
              {metrics.slice(0, 6).map((metric) => (
                <IntelligenceMetric
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  tone={metric.tone}
                />
              ))}
            </div>
          </div>
          {note && (
            <div className="manager-command-body owner-quick-body">
              <div className="manager-command-section manager-command-read">
                <h4>Read</h4>
                <p>{note}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
      rosterHealthScore: intel.find((item) => item.manager === row.manager)?.rosterHealthScore,
      pressurePoints: intel.find((item) => item.manager === row.manager)?.pressurePoints || [],
      droppablePlayers: intel.find((item) => item.manager === row.manager)?.droppablePlayers || [],
      taxiTriage: intel.find((item) => item.manager === row.manager)?.taxiTriage,
    }))
    .sort((a, b) => b.starterCount - a.starterCount || b.totalPlayers - a.totalPlayers);
  const taxiDepth = intel
    .filter((row) => row.taxiTriage?.items.length)
    .map((row) => ({
      manager: row.manager,
      taxiTriage: row.taxiTriage,
    }))
    .sort((a, b) => {
      const aPromote = a.taxiTriage.counts['Promote Now'] || 0;
      const bPromote = b.taxiTriage.counts['Promote Now'] || 0;
      const aCut = a.taxiTriage.counts.Cuttable || 0;
      const bCut = b.taxiTriage.counts.Cuttable || 0;
      return bPromote - aPromote || bCut - aCut || b.taxiTriage.items.length - a.taxiTriage.items.length;
    });
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
      playerDetailsById: data.playerDetailsById,
      manager: player.owner || selectedManager,
      managerAvatarUrl: managerAvatars?.[player.owner || selectedManager],
      currentPositionRank: player.currentPositionRank || player.seasonPositionRank,
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
      notes.push(`Lineup upgrade spot is ${selectedIntel.weakestStarter.name} (${selectedIntel.weakestStarter.currentPositionRank || selectedIntel.weakestStarter.seasonPositionRank || selectedIntel.weakestStarter.pos}) after season value is considered.`);
    }
    if (selectedIntel.bestBenchStash) {
      notes.push(`${selectedIntel.bestBenchStash.name} (${selectedIntel.bestBenchStash.currentPositionRank || selectedIntel.bestBenchStash.seasonPositionRank || selectedIntel.bestBenchStash.pos}) is the best bench chip if this manager wants to patch a hole without touching the core.`);
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
              ...(row.rosterHealthScore ? [{ label: `Health ${row.rosterHealthScore}`, tone: row.rosterHealthScore >= 75 ? 'good' as const : row.rosterHealthScore <= 45 ? 'danger' as const : 'warn' as const }] : []),
              ...(row.pressurePoints.length ? [{ label: `${row.pressurePoints.length} flags`, tone: 'warn' as const }] : []),
              ]}
              onClick={() => openManager(row.manager)}
            />
          ))}
        </div>
      </FeatureCard>

      {taxiDepth.length ? (
        <FeatureCard
          number={2}
          title="Taxi Squad Triage"
          kicker="Promote, stash, trade, cut"
          className="command-feature-card-wide"
          hideNumber
        >
          <div className="command-depth-grid">
            {taxiDepth.map((row) => (
              <ManagerDepthTile
                key={row.manager}
                manager={row.manager}
                avatarUrl={managerAvatars?.[row.manager]}
                badges={[
                  { label: `${row.taxiTriage.items.length} taxi`, tone: 'neutral' },
                  ...(row.taxiTriage.counts['Promote Now'] ? [{ label: `${row.taxiTriage.counts['Promote Now']} promote`, tone: 'good' as const }] : []),
                  ...(row.taxiTriage.counts['Keep Parked'] ? [{ label: `${row.taxiTriage.counts['Keep Parked']} stash`, tone: 'future' as const }] : []),
                  ...(row.taxiTriage.counts['Trade Sweetener'] ? [{ label: `${row.taxiTriage.counts['Trade Sweetener']} sweetener`, tone: 'neutral' as const }] : []),
                  ...(row.taxiTriage.counts['Taxi Risk'] ? [{ label: `${row.taxiTriage.counts['Taxi Risk']} risk`, tone: 'warn' as const }] : []),
                  ...(row.taxiTriage.counts.Cuttable ? [{ label: `${row.taxiTriage.counts.Cuttable} cuttable`, tone: 'danger' as const }] : []),
                ]}
                onClick={() => openManager(row.manager)}
              />
            ))}
          </div>
        </FeatureCard>
      ) : null}

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
              <ChampionAvatarFrame managerName={selectedManager} className="manager-command-champion-frame">
                {managerAvatars?.[selectedManager] ? (
                  <img src={managerAvatars[selectedManager] || ''} alt={selectedManager} className="manager-command-avatar" />
                ) : (
                  <span className="manager-command-avatar">{selectedManager[0]?.toUpperCase() || '?'}</span>
                )}
              </ChampionAvatarFrame>
              <div className="min-w-0">
                <p>Owner Data Room</p>
                <h3>{selectedManager}</h3>
                <ManagerChampionshipPills managerName={selectedManager} className="manager-command-championships" />
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
              {selectedIntel?.positionGrades ? (
                <div className="manager-command-section">
                  <h4>Roster Heat Map</h4>
                  <div className="owner-intel-heat-grid">
                    {(['QB', 'RB', 'WR', 'TE'] as const).map((pos) => {
                      const grade = selectedIntel.positionGrades?.[pos];
                      return (
                        <span key={pos} className={`owner-intel-heat-pill owner-intel-heat-${String(grade?.grade || 'empty').toLowerCase()}`}>
                          <strong>{pos}</strong>
                          <em>{grade?.grade || 'Empty'}</em>
                          <small>{grade?.rank ? `#${grade.rank}` : '-'}</small>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {selectedIntel?.taxiTriage?.items.length ? (
                <div className="manager-command-section manager-command-taxi">
                  <h4>Taxi Squad Triage</h4>
                  <p className="manager-command-taxi-summary">{selectedIntel.taxiTriage.summary}</p>
                  <div className="manager-command-tile-grid">
                    {selectedIntel.taxiTriage.items.map((player) => (
                      <CommandPlayerTile
                        key={player.player_id}
                        label={player.taxiAction}
                        player={player}
                        onClick={() => openCommandPlayer(player)}
                      />
                    ))}
                  </div>
                  <div className="manager-command-taxi-reasons">
                    {selectedIntel.taxiTriage.items.slice(0, 4).map((player) => (
                      <p key={`${player.player_id}-reason`}>
                        <strong>{player.name}:</strong> {player.taxiReason}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedIntel?.tradeBlueprints?.length ? (
                <div className="manager-command-section">
                  <h4>Trade Blueprints</h4>
                  <ul>
                    {selectedIntel.tradeBlueprints.map((blueprint) => (
                      <li key={blueprint.label}>{blueprint.label}: {blueprint.summary}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {selectedIntel?.pressurePoints?.length ? (
                <div className="manager-command-section">
                  <h4>Pressure Points</h4>
                  <ul>
                    {selectedIntel.pressurePoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
  playerDetailsById,
  leagueId,
  leagueLogo,
}: {
  data?: ReportData['managerRosterIntelligence'];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
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
                  <ChampionAvatarFrame managerName={selectedRow.manager} className="manager-command-champion-frame">
                    {managerAvatars?.[selectedRow.manager] ? (
                      <img src={managerAvatars[selectedRow.manager] || ''} alt={selectedRow.manager} className="manager-command-avatar" />
                    ) : (
                      <span className="manager-command-avatar">{selectedRow.manager[0]?.toUpperCase() || '?'}</span>
                    )}
                  </ChampionAvatarFrame>
                  <div className="min-w-0">
                    <p>Team Identity</p>
                    <h3>{selectedRow.manager}</h3>
                    <ManagerChampionshipPills managerName={selectedRow.manager} className="manager-command-championships" />
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
                      <PlayerInsightTile label="Bench Stash" player={selectedRow.bestBenchStash} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} playerDetailsById={playerDetailsById} onSelect={setSelectedPlayer} />
                      <PlayerInsightTile label="Upgrade Spot" player={selectedRow.weakestStarter} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} playerDetailsById={playerDetailsById} onSelect={setSelectedPlayer} tone="warn" />
                      <PlayerInsightTile label="Age Risk" player={selectedRow.oldestPlayer} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} playerDetailsById={playerDetailsById} onSelect={setSelectedPlayer} tone="danger" />
                      <PlayerInsightTile label="Young Core" player={selectedRow.youngCorePlayer} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} playerDetailsById={playerDetailsById} onSelect={setSelectedPlayer} />
                      <PlayerInsightTile label="Upside Play" player={selectedRow.breakoutCandidate} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} playerDetailsById={playerDetailsById} onSelect={setSelectedPlayer} />
                      <PlayerInsightTile label="Buy Target" player={selectedRow.buyTarget} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} playerDetailsById={playerDetailsById} onSelect={setSelectedPlayer} />
                      <PlayerInsightTile label="Sell Candidate" player={selectedRow.sellCandidate} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} playerDetailsById={playerDetailsById} onSelect={setSelectedPlayer} tone="warn" />
                      <PlayerInsightTile label="Trade Chip" player={selectedRow.tradeChip} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} playerDetailsById={playerDetailsById} onSelect={setSelectedPlayer} />
                      <PlayerInsightTile label="Insurance" player={selectedRow.injuryInsurance} manager={selectedRow.manager} managerAvatarUrl={managerAvatars?.[selectedRow.manager]} playerDetailsById={playerDetailsById} onSelect={setSelectedPlayer} />
                      <PlayerInsightTile
                        label="Last Year Stud"
                        player={selectedRow.lastSeasonStud}
                        manager={selectedRow.manager}
                        managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                        playerDetailsById={playerDetailsById}
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

export function OwnerIntelMatrix({
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
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const intelRows = data.managerRosterIntelligence || [];
  if (!intelRows.length) return null;

  const getCountRow = (manager: string) => data.managerPositionCounts.find((row) => row.manager === manager);
  const getTradeRow = (manager: string) => data.tradeTendencies?.find((row) => row.manager === manager);
  const getPickRow = (manager: string) => data.pickPortfolios?.find((row) => row.manager === manager);
  const getPowerRow = (manager: string) => data.powerRankings?.find((row) => row.manager === manager);
  const getTimelineRow = (manager: string) => data.dynastyTimelines?.find((row) => row.manager === manager);
  const getOverviewRow = (manager: string) => data.leagueOverview.find((row) => row.manager === manager);
  const selectedRow = selectedOwner ? intelRows.find((row) => row.manager === selectedOwner) : null;
  const selectedCountRow = selectedRow ? getCountRow(selectedRow.manager) : null;
  const selectedTradeRow = selectedRow ? getTradeRow(selectedRow.manager) : null;
  const selectedPickRow = selectedRow ? getPickRow(selectedRow.manager) : null;
  const selectedPowerRow = selectedRow ? getPowerRow(selectedRow.manager) : null;
  const selectedTimelineRow = selectedRow ? getTimelineRow(selectedRow.manager) : null;
  const selectedOverviewRow = selectedRow ? getOverviewRow(selectedRow.manager) : null;
  const selectedStarterCount = selectedCountRow ? selectedCountRow.QB_starters + selectedCountRow.RB_starters + selectedCountRow.WR_starters + selectedCountRow.TE_starters : null;
  const selectedValueComps = selectedRow
    ? (['QB', 'RB', 'WR', 'TE'] as const)
      .map((pos) => selectedRow.similarValuePlayers[pos] ? `${pos}: ${selectedRow.similarValuePlayers[pos]?.name} (${selectedRow.similarValuePlayers[pos]?.currentPositionRank || selectedRow.similarValuePlayers[pos]?.pos})` : null)
      .filter(Boolean)
      .join(' · ')
    : '';
  const selectedValueCompPlayers = selectedRow
    ? (['QB', 'RB', 'WR', 'TE'] as const)
      .map((pos) => ({
        position: pos,
        player: selectedRow.similarValuePlayers[pos],
      }))
      .filter((item): item is { position: 'QB' | 'RB' | 'WR' | 'TE'; player: ManagerIntelPlayer } => Boolean(item.player))
    : [];
  const selectedOwnerTags = selectedRow ? [
    selectedRow.identity,
    selectedRow.timeline,
    selectedRow.rosterHealthScore ? `Health ${selectedRow.rosterHealthScore}` : null,
    selectedPowerRow ? `#${selectedPowerRow.rank} ${selectedPowerRow.tier}` : null,
    selectedTimelineRow ? `Contender ${selectedTimelineRow.contenderScore}` : null,
    selectedTimelineRow ? `Rebuild ${selectedTimelineRow.rebuildScore}` : null,
    selectedRow.taxiTriage?.items.length ? `${selectedRow.taxiTriage.items.length} taxi` : null,
    selectedRow.taxiTriage?.counts['Promote Now'] ? `${selectedRow.taxiTriage.counts['Promote Now']} promote` : null,
    selectedRow.taxiTriage?.counts.Cuttable ? `${selectedRow.taxiTriage.counts.Cuttable} cuttable` : null,
    ...selectedRow.ageFlags,
  ].filter(Boolean).slice(0, 8) : [];
  const selectedPlayerSectionsBase: Array<{
    label: string;
    player: ManagerIntelPlayer | null;
    tone?: 'neutral' | 'warn' | 'danger';
    crownedRank?: string | null;
  }> = selectedRow ? [
    { label: 'Untouchable', player: selectedRow.untouchablePlayers?.[0] || selectedRow.youngCorePlayer },
    { label: 'Buy Idea', player: selectedRow.buyTarget },
    { label: 'Sell Idea', player: selectedRow.sellCandidate, tone: 'warn' },
    { label: 'Trade Chip', player: selectedRow.tradeChip },
    { label: 'Insurance', player: selectedRow.injuryInsurance },
    { label: 'Droppable', player: selectedRow.droppablePlayers?.[0] || null, tone: 'danger' },
    { label: 'Weak Link', player: selectedRow.weakestStarter, tone: 'warn' },
    { label: 'Injury Flag', player: selectedRow.starterAvailability.riskiestStarter, tone: selectedRow.starterAvailability.riskLevel === 'high' ? 'danger' : 'warn' },
    { label: 'Bench Stash', player: selectedRow.bestBenchStash },
    {
      label: 'Last Year Stud',
      player: selectedRow.lastSeasonStud,
      crownedRank: selectedRow.lastSeasonStud?.lastSeasonPositionRank
        ? `${selectedRow.lastSeasonStud.lastSeasonYear || '2025'} ${selectedRow.lastSeasonStud.lastSeasonPositionRank}`
        : null,
    },
  ] : [];
  const selectedPlayerSections = selectedPlayerSectionsBase.filter((item, index, rows) => {
    if (!item.player) return false;
    return rows.findIndex((candidate) => candidate.player?.player_id === item.player?.player_id) === index;
  });
  const selectedRosterRead = selectedRow ? buildOwnerShapeCopy(selectedRow) : '';
  const selectedBestMove = selectedRow ? buildOwnerBestMove(selectedRow) : '';
  const selectedTradeDraftProfile = selectedRow ? buildOwnerTradeDraftProfile(selectedTradeRow, selectedPickRow) : '';
  const selectedHealthCheck = selectedRow ? buildOwnerHealthCopy(selectedRow) : '';
  const selectedWeakSpotCopy = selectedRow ? buildOwnerWeakSpotCopy(selectedRow) : '';
  const selectedTeamWindow = selectedRow ? buildOwnerWindowCopy(selectedRow, selectedTimelineRow) : '';
  const selectedActionNotes = selectedRow ? dedupeIntelNotes([
    selectedRow.pressurePoints?.[0],
    selectedRow.pressurePoints?.[1],
    selectedRow.marketSignals?.find((signal) => !signal.includes('External target') && !signal.includes('Internal liquidity')),
    selectedRow.untouchablePlayers?.length
      ? `Core rule: ${selectedRow.untouchablePlayers.map((player) => player.name).slice(0, 3).join(', ')} should only move for an obvious overpay.`
      : null,
    selectedRow.droppablePlayers?.length
      ? `Roster churn: ${selectedRow.droppablePlayers.map((player) => player.name).slice(0, 3).join(', ')} are the first cuts if waivers heat up.`
      : null,
  ], [
    selectedRosterRead,
    selectedBestMove,
    selectedTradeDraftProfile,
    selectedHealthCheck,
    selectedWeakSpotCopy,
    selectedTeamWindow,
  ]).slice(0, 4) : [];

  return (
    <>
      <div className="command-depth-grid">
        {intelRows.map((row) => {
          const countRow = getCountRow(row.manager);
          const tradeRow = getTradeRow(row.manager);
          const pickRow = getPickRow(row.manager);
          const powerRow = getPowerRow(row.manager);
          const timelineRow = getTimelineRow(row.manager);
          const starterCount = countRow ? countRow.QB_starters + countRow.RB_starters + countRow.WR_starters + countRow.TE_starters : null;
          return (
            <ManagerDepthTile
              key={row.manager}
              manager={row.manager}
              avatarUrl={managerAvatars?.[row.manager]}
              badges={[
                { label: titleCasePill(row.identity), tone: getPillToneClass(row.identity).includes('future') ? 'future' as const : getPillToneClass(row.identity).includes('danger') ? 'danger' as const : 'good' as const },
                ...(starterCount !== null ? [{ label: `${starterCount} starters`, tone: 'neutral' as const }] : []),
                ...(powerRow ? [{ label: `Power ${powerRow.score}`, tone: powerRow.score >= 75 ? 'good' as const : powerRow.score <= 45 ? 'warn' as const : 'neutral' as const }] : []),
                ...(row.tradePlan?.needPosition ? [{ label: `Needs ${row.tradePlan.needPosition}`, tone: 'warn' as const }] : []),
                ...(row.tradePlan?.surplusPosition ? [{ label: `Move ${row.tradePlan.surplusPosition}`, tone: 'future' as const }] : []),
                ...(tradeRow ? [{ label: `${tradeRow.tradeCount} trades`, tone: tradeRow.profit >= 0 ? 'good' as const : 'danger' as const }] : []),
                ...(pickRow ? [{ label: `${pickRow.count2026 + pickRow.count2027} picks`, tone: 'neutral' as const }] : []),
                ...(timelineRow ? [{ label: titleCasePill(timelineRow.label), tone: timelineRow.contenderScore >= 70 ? 'good' as const : 'future' as const }] : []),
              ].slice(0, 8)}
              onClick={() => setSelectedOwner(row.manager)}
            />
          );
        })}
      </div>

      <Dialog open={selectedRow !== null} onOpenChange={(open) => !open && setSelectedOwner(null)}>
        <DialogContent className="manager-command-dialog max-w-5xl border-cyan-300/20 bg-slate-950 p-0 text-slate-100">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedRow?.manager || 'Owner'} Intel Lab</DialogTitle>
            <DialogDescription>Owner intelligence, trade ideas, player flags, and roster notes.</DialogDescription>
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
                  <ChampionAvatarFrame managerName={selectedRow.manager} className="manager-command-champion-frame">
                    {managerAvatars?.[selectedRow.manager] ? (
                      <img src={managerAvatars[selectedRow.manager] || ''} alt={selectedRow.manager} className="manager-command-avatar" />
                    ) : (
                      <span className="manager-command-avatar">{selectedRow.manager[0]?.toUpperCase() || '?'}</span>
                    )}
                  </ChampionAvatarFrame>
                  <div className="min-w-0">
                    <p>Owner Intel Lab</p>
                    <h3>{selectedRow.manager}</h3>
                    <ManagerChampionshipPills managerName={selectedRow.manager} className="manager-command-championships" />
                  </div>
                </div>
                <div className="manager-command-hero-metrics">
                  <IntelligenceMetric label="Starters" value={selectedStarterCount ?? '-'} />
                  <IntelligenceMetric label="Power" value={selectedPowerRow?.score ?? '-'} />
                  <IntelligenceMetric label="Age" value={selectedRow.avgAge ?? '-'} />
                </div>
              </div>

              <div className="manager-command-body">
                <div className="owner-intel-tags">
                  {selectedOwnerTags.map((tag) => (
                    <span key={tag} className={`manager-intel-pill ${getPillToneClass(String(tag))}`}>
                      {String(tag).startsWith('#') ? tag : titleCasePill(String(tag))}
                    </span>
                  ))}
                </div>

                <div className="owner-intel-stat-grid">
                  <IntelligenceMetric label="Starter Share" value={`${selectedRow.starterValuePct}%`} />
                  <IntelligenceMetric label="Trade Profit" value={selectedTradeRow ? `${selectedTradeRow.profit > 0 ? '+' : ''}${formatCompactValue(selectedTradeRow.profit)}` : '-'} />
                  <IntelligenceMetric label="Picks" value={selectedPickRow ? `${selectedPickRow.count2026 + selectedPickRow.count2027}` : '-'} />
                  <IntelligenceMetric label="Contender" value={selectedTimelineRow?.contenderScore ?? '-'} />
                  <IntelligenceMetric label="Rebuild" value={selectedTimelineRow?.rebuildScore ?? '-'} />
                  <IntelligenceMetric label="Aging Risk" value={selectedTimelineRow?.agingRisk ?? '-'} />
                </div>

                {selectedOverviewRow ? (
                  <div className="owner-intel-ranks">
                    <span>QB #{selectedOverviewRow.rank_qb}</span>
                    <span>RB #{selectedOverviewRow.rank_rb}</span>
                    <span>WR #{selectedOverviewRow.rank_wr}</span>
                    <span>TE #{selectedOverviewRow.rank_te}</span>
                    <span>Value #{selectedOverviewRow.rank_value}</span>
                  </div>
                ) : null}

                <div className="owner-intel-player-grid">
                  {selectedPlayerSections.map((item) => item.player ? (
                    <PlayerInsightTile
                      key={`${item.label}-${item.player.player_id}`}
                      label={item.label}
                      player={item.player}
                      manager={selectedRow.manager}
                      managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                      playerDetailsById={data.playerDetailsById}
                      onSelect={setSelectedPlayer}
                      tone={item.tone}
                      crownedRank={item.crownedRank}
                    />
                  ) : null)}
                </div>

                {selectedRow.taxiTriage?.items.length ? (
                  <div className="owner-intel-taxi-panel">
                    <div className="owner-intel-taxi-header">
                      <h4>Taxi Squad Triage</h4>
                      <p>{selectedRow.taxiTriage.summary}</p>
                    </div>
                    <div className="owner-intel-taxi-list">
                      {selectedRow.taxiTriage.items.map((player) => (
                        <TaxiTriageRow
                          key={`taxi-${player.player_id}`}
                          player={player}
                          manager={selectedRow.manager}
                          managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                          playerDetailsById={data.playerDetailsById}
                          onSelect={setSelectedPlayer}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="owner-intel-read-grid">
                  {selectedRow.positionGrades ? (
                    <div className="owner-intel-roster-heat">
                      <h4>Roster Heat Map</h4>
                      <div className="owner-intel-heat-grid">
                        {(['QB', 'RB', 'WR', 'TE'] as const).map((pos) => {
                          const grade = selectedRow.positionGrades?.[pos];
                          return (
                            <span key={pos} className={`owner-intel-heat-pill owner-intel-heat-${String(grade?.grade || 'empty').toLowerCase()}`}>
                              <strong>{pos}</strong>
                              <em>{grade?.grade || 'Empty'}</em>
                              <small>{grade?.rank ? `#${grade.rank}` : '-'}</small>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  <div className="owner-intel-read-wide">
                    <h4>Roster Read</h4>
                    <p>{selectedRosterRead}</p>
                  </div>
                  <div>
                    <h4>Best Move</h4>
                    <p>{selectedBestMove}</p>
                  </div>
                  <div>
                    <h4>Trade / Draft Profile</h4>
                    <p>{selectedTradeDraftProfile}</p>
                  </div>
                  <div>
                    <h4>Health Check</h4>
                    <p>{selectedHealthCheck}</p>
                  </div>
                  <div>
                    <h4>Weak Spots</h4>
                    <div className="owner-intel-attack-list">
                      <span><strong>Best QB</strong><PositionRankPill rank={selectedRow.holes.bestQbRank} /></span>
                      <span><strong>RB2</strong><PositionRankPill rank={selectedRow.holes.rb2Rank} /></span>
                      <span><strong>WR3</strong><PositionRankPill rank={selectedRow.holes.wr3Rank} /></span>
                      <span><strong>TE1</strong><PositionRankPill rank={selectedRow.holes.te1Rank} /></span>
                      <span><strong>Flex Depth</strong><em>{selectedRow.holes.flexDepth}</em></span>
                    </div>
                    <p>{selectedWeakSpotCopy}</p>
                  </div>
                  <div className="owner-intel-value-map">
                    <h4>Market Comps</h4>
                    {selectedValueCompPlayers.length ? (
                      <div className="owner-intel-value-map-grid">
                        {selectedValueCompPlayers.map(({ position, player }) => (
                          <button
                            key={`${position}-${player.player_id}`}
                            type="button"
                            title={`${position} value comp: ${player.name}${player.owner ? ` (${player.owner})` : ''}`}
                            onClick={() => setSelectedPlayer(buildPlayerModalData({
                              playerId: player.player_id,
                              playerName: player.name,
                              playerPos: player.pos,
                              value: player.value,
                              playerDetails: player.playerDetails,
                              playerDetailsById: data.playerDetailsById,
                              currentPositionRank: player.currentPositionRank || player.seasonPositionRank,
                              manager: player.owner || selectedRow.manager,
                              managerAvatarUrl: (player.owner && managerAvatars?.[player.owner]) || managerAvatars?.[selectedRow.manager],
                            }))}
                          >
                            <strong>{position}</strong>
                            <span>
                              <em>{player.name}</em>
                              {player.owner && player.owner !== selectedRow.manager ? <small>{player.owner}</small> : null}
                            </span>
                            <PositionRankPill rank={player.currentPositionRank || player.seasonPositionRank || player.pos} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p>{selectedValueComps || 'No clean same-position value comps on this roster yet.'}</p>
                    )}
                  </div>
                  <div>
                    <h4>Team Window</h4>
                    <p>{selectedTeamWindow}</p>
                  </div>
                  {selectedActionNotes.length ? (
                    <div className="owner-intel-wild-notes">
                      <h4>What To Do Next</h4>
                      <ul>
                        {selectedActionNotes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
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
  const [selectedRow, setSelectedRow] = useState<NonNullable<ReportData['powerRankings']>[number] | null>(null);
  if (!data?.length) return null;

  return (
    <div className="owner-tile-shell">
      <div className="owner-tile-grid">
        {data.map((row) => (
          <OwnerSummaryTile
            key={row.manager}
            manager={row.manager}
            avatarUrl={managerAvatars?.[row.manager]}
            onClick={() => setSelectedRow(row)}
          >
            <OwnerMetricPill label="Tier" value={row.tier} tone="info" />
            <OwnerMetricPill label="Score" value={row.score} tone="warn" />
            <OwnerMetricPill label="Starter" value={row.starterStrength} />
            <OwnerMetricPill label="Youth" value={row.youthScore} tone="good" />
          </OwnerSummaryTile>
        ))}
      </div>
      <OwnerQuickModal
        open={selectedRow !== null}
        onOpenChange={(open) => !open && setSelectedRow(null)}
        title="Power Profile"
        manager={selectedRow?.manager}
        avatarUrl={selectedRow ? managerAvatars?.[selectedRow.manager] : null}
        metrics={selectedRow ? [
          { label: 'Tier', value: selectedRow.tier },
          { label: 'Score', value: selectedRow.score },
          { label: 'Starter', value: selectedRow.starterStrength },
          { label: 'Roster', value: selectedRow.rosterValue },
          { label: 'Balance', value: selectedRow.positionalBalance },
          { label: 'Youth', value: selectedRow.youthScore },
        ] : []}
        note={selectedRow ? `Power score blends starter strength, total value, positional balance, draft capital, youth, and trade efficiency. ${selectedRow.manager} is currently ${selectedRow.tier} with a ${selectedRow.score}/100 score.` : undefined}
      />
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
  const [selectedRow, setSelectedRow] = useState<ReportData['managerRosterValueGrowth'][number] | null>(null);

  return (
    <div className="owner-tile-shell">
      <div className="owner-tile-grid">
        {data.map((row, idx) => (
          <OwnerSummaryTile
            key={`${row.manager}-${idx}`}
            manager={row.manager}
            avatarUrl={managerAvatars?.[row.manager]}
            onClick={() => setSelectedRow(row)}
          >
            <OwnerMetricPill label="2025" value={formatCompactValue(row.past_val)} />
            <OwnerMetricPill label="Now" value={formatCompactValue(row.total_val)} tone="info" />
            <OwnerMetricPill
              label="Growth"
              value={`${row.growth >= 0 ? '+' : ''}${row.growth.toFixed(1)}%`}
              tone={row.growth >= 0 ? 'good' : 'danger'}
            />
            <OwnerMetricPill label="Proj" value={`#${row.rank}`} tone="warn" />
          </OwnerSummaryTile>
        ))}
      </div>
      <OwnerQuickModal
        open={selectedRow !== null}
        onOpenChange={(open) => !open && setSelectedRow(null)}
        title="Roster Value Growth"
        manager={selectedRow?.manager}
        avatarUrl={selectedRow ? managerAvatars?.[selectedRow.manager] : null}
        metrics={selectedRow ? [
          { label: '2025', value: formatCompactValue(selectedRow.past_val) },
          { label: 'Now', value: formatCompactValue(selectedRow.total_val), tone: 'positive' },
          { label: 'Growth', value: `${selectedRow.growth >= 0 ? '+' : ''}${selectedRow.growth.toFixed(1)}%`, tone: selectedRow.growth >= 0 ? 'positive' : 'negative' },
          { label: 'Proj Rank', value: `#${selectedRow.rank}` },
        ] : []}
        note={selectedRow ? `This compares stored baseline roster value against the current blended value view. Positive growth means the roster gained market value over the stored window.` : undefined}
      />
    </div>
  );
}

export function WeeklyMomentumTable({
  data,
  title,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
}: {
  data: ReportData['weeklyRisers'];
  title: string;
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const isRiserList = data.some((row) => row.pct_change > 0);

  return (
    <div className="weekly-momentum-wrap">
      {data.length > 0 ? (
        <div className="weekly-momentum-grid">
          {data.map((row) => {
            const playerDetails = row.playerDetails || (row.player_id ? playerDetailsById?.[row.player_id] : undefined);
            const isPositive = row.pct_change >= 0;
            return (
              <button
                key={`${row.player_id || row.name}-${row.owner}`}
                type="button"
                className={`player-team-tile weekly-momentum-tile ${isPositive ? 'weekly-momentum-tile-up' : 'weekly-momentum-tile-down'}`}
                style={getTeamTileStyle(playerDetails?.team)}
                onClick={() => setSelectedPlayer(buildPlayerModalData({
                  playerId: row.player_id,
                  playerName: row.name,
                  playerPos: row.pos,
                  value: playerDetails?.valueProfile?.dynastyValue ?? row.val_now,
                  valueGain: row.diff,
                  playerDetails,
                  playerDetailsById,
                  manager: row.owner,
                  managerAvatarUrl: managerAvatars?.[row.owner],
                  currentPositionRank: row.currentPositionRank,
                  valueChangeNote: 'KTC market change over the last 7 days.',
                }))}
              >
                <div className="weekly-momentum-tile-top">
                  <span>{isPositive ? 'Riser' : 'Faller'}</span>
                  <strong className={isPositive ? 'text-emerald-300' : 'text-rose-300'}>
                    {row.pct_change >= 0 ? '+' : ''}
                    {row.pct_change.toFixed(1)}%
                  </strong>
                </div>
                <div className="weekly-momentum-player">
                  <PlayerNameWithHeadshot playerId={row.player_id} playerName={row.name} />
                </div>
                <div className="weekly-momentum-manager">
                  {renderManagerName(row.owner, managerAvatars)}
                </div>
                <div className="weekly-momentum-pills">
                  <PositionRankPill rank={row.currentPositionRank || row.pos} />
                  <span>{playerDetails?.team || 'FA'}</span>
                  <span>{formatCompactValue(row.val_now)}</span>
                </div>
                <div className="weekly-momentum-values">
                  <span>{formatCompactValue(row.val_last)}</span>
                  <span aria-hidden="true">to</span>
                  <span>{formatCompactValue(row.val_now)}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Card className="report-card-polished weekly-momentum-empty border-slate-800 bg-slate-900">
          No {isRiserList ? 'risers' : title.toLowerCase()} found for the current 7-day window.
        </Card>
      )}
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
    <div className="owner-tile-shell">
      <div className="owner-tile-grid owner-overview-grid">
        {data.map((row, idx) => (
          <OwnerSummaryTile
            key={`${row.manager}-${idx}`}
            manager={row.manager}
            avatarUrl={managerAvatars?.[row.manager]}
          >
            <OwnerMetricPill label="Value" value={formatCompactValue(row.total_val)} tone="warn" />
            <OwnerMetricPill label="QB" value={`#${row.rank_qb}`} />
            <OwnerMetricPill label="RB" value={`#${row.rank_rb}`} />
            <OwnerMetricPill label="WR" value={`#${row.rank_wr}`} />
            <OwnerMetricPill label="TE" value={`#${row.rank_te}`} />
            <OwnerMetricPill label="Rank" value={`#${row.rank_value}`} tone="info" />
          </OwnerSummaryTile>
        ))}
      </div>
    </div>
  );
}

export function TrendingPlayersTable({
  data,
  title,
  countLabel,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
}: {
  data: TrendingPlayer[];
  title: string;
  countLabel: 'Adds' | 'Drops';
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);

  return (
    <div className="trending-card-wrap">
      {data.length > 0 ? (
        <div className="trending-card-grid">
          {data.map((row) => {
            const playerDetails = row.playerDetails || (row.player_id ? playerDetailsById?.[row.player_id] : undefined);
            return (
              <button
                key={row.player_id}
                type="button"
                className="player-team-tile trending-player-card"
                style={getTeamTileStyle(playerDetails?.team || row.team)}
                onClick={() => setSelectedPlayer(buildPlayerModalData({
                    playerId: row.player_id,
                    playerName: row.name,
                    playerPos: row.pos,
                    value: row.ktcValue,
                    playerDetails,
                    playerDetailsById,
                    currentPositionRank: row.currentPositionRank,
                    manager: row.owner || null,
                    managerAvatarUrl: row.owner ? managerAvatars?.[row.owner] : null,
                  }))}
              >
                <div className="trending-player-card-top">
                  <span>{countLabel}</span>
                  <strong>{row.count.toLocaleString()}</strong>
                </div>
                <div className="trending-player-card-main">
                  <PlayerNameWithHeadshot playerId={row.player_id} playerName={row.name} />
                </div>
                <div className="trending-player-card-owner">
                  {row.owner ? renderManagerName(row.owner, managerAvatars) : (
                    <span className="available-manager-label">Available</span>
                  )}
                </div>
                <div className="trending-player-card-pills">
                  <PositionRankPill rank={row.currentPositionRank || row.pos} />
                  <span>{playerDetails?.team || row.team || 'FA'}</span>
                  <span>{formatCompactValue(row.ktcValue)}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Card className="report-card-polished trending-empty-card border-slate-800 bg-slate-900">
          No {title.toLowerCase()} available
        </Card>
      )}
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
  playerDetailsById,
  leagueId,
  leagueLogo,
}: {
  data: ReportData['projectedRisers'];
  title: string;
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);

  return (
    <div className="player-tile-shell">
      <div className="player-tile-grid projected-movers-grid">
        {data.map((row, idx) => {
          const details = row.playerDetails || (row.player_id ? playerDetailsById?.[row.player_id] : undefined);
          const isPositive = row.diff >= 0;
          return (
            <button
              key={`${row.player_id || row.name}-${idx}`}
              type="button"
              className={`player-team-tile projected-mover-tile ${isPositive ? 'projected-mover-up' : 'projected-mover-down'}`}
              style={getTeamTileStyle(details?.team)}
              onClick={() => setSelectedPlayer(buildPlayerModalData({
                playerId: row.player_id,
                playerName: row.name,
                playerPos: row.pos,
                value: row.val_2026,
                valueGain: row.diff,
                playerDetails: details,
                playerDetailsById,
                manager: row.owner,
                managerAvatarUrl: managerAvatars?.[row.owner],
                currentPositionRank: row.currentPositionRank,
                valueChangeNote: 'Projected change from current value to next year value.',
              }))}
            >
              <div className="player-tile-topline">
                <span>#{idx + 1}</span>
                <strong className={isPositive ? 'text-emerald-300' : 'text-rose-300'}>
                  {isPositive ? '+' : ''}
                  {row.diff.toLocaleString()}
                </strong>
              </div>
              <div className="player-tile-main">
                <PlayerNameWithHeadshot playerId={row.player_id} playerName={row.name} />
              </div>
              <div className="player-tile-owner">
                {renderManagerName(row.owner, managerAvatars)}
              </div>
              <div className="player-tile-pills">
                <PositionRankPill rank={row.currentPositionRank || row.pos} />
                <span>{details?.team || 'FA'}</span>
                <span>{row.age !== null ? `${row.age} yrs` : 'Age N/A'}</span>
              </div>
              <div className="player-tile-value-strip">
                <span>{formatCompactValue(row.val_2026)}</span>
                <span>to</span>
                <span>{formatCompactValue(row.val_2027)}</span>
              </div>
            </button>
          );
        })}
      </div>
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
  leagueId,
  leagueLogo,
}: {
  data: ReportData['tradeProfitLeaderboard'];
  managerAvatars?: ManagerAvatars;
  tradeHistory?: ReportData['tradeHistory'];
  draftPicks?: DraftPick[];
  playerDetailsById?: PlayerDetailsById;
  currentPositionRankById?: CurrentPositionRankById;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [selectedManagerTradeKey, setSelectedManagerTradeKey] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const selectedManagerTrades = selectedManager
    ? [...tradeHistory]
        .filter((trade) => trade.team_a === selectedManager || trade.team_b === selectedManager)
        .reverse()
    : [];
  const selectedManagerSummary = selectedManager
    ? data.find((row) => row.manager === selectedManager)
    : undefined;

  return (
    <div className="owner-tile-shell">
      <div className="owner-tile-grid trade-profit-tile-grid">
        {data.map((row) => {
          const winPct = row.trade_count > 0 ? Math.round((row.wins / row.trade_count) * 100) : 0;

          return (
            <OwnerSummaryTile
              key={row.rank}
              manager={row.manager}
              avatarUrl={managerAvatars?.[row.manager]}
              onClick={() => setSelectedManager(row.manager)}
            >
              <OwnerMetricPill label="Wins" value={row.wins} tone="warn" />
              <OwnerMetricPill label="Win %" value={`${winPct}%`} tone="info" />
              <OwnerMetricPill label="Trades" value={row.trade_count} />
              <OwnerMetricPill
                label="Profit"
                value={`${row.profit >= 0 ? '+' : ''}${row.profit.toLocaleString()}`}
                tone={row.profit >= 0 ? 'good' : 'danger'}
              />
            </OwnerSummaryTile>
          );
        })}
      </div>
      <Dialog
        open={selectedManager !== null}
        onOpenChange={(open) => {
          if (open) return;
          setSelectedManager(null);
          setSelectedManagerTradeKey(null);
          setSelectedPlayer(null);
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
                    <ChampionAvatarFrame managerName={selectedManager} className="trade-manager-title-avatar">
                      {managerAvatars?.[selectedManager] ? (
                        <img src={managerAvatars[selectedManager] || ''} alt={selectedManager} />
                      ) : (
                        <span>{selectedManager.trim()[0]?.toUpperCase() || '?'}</span>
                      )}
                    </ChampionAvatarFrame>
                    <div className="min-w-0 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
                        Trade Portfolio
                      </p>
                      <DialogTitle className="athletic-headline mt-1 truncate text-3xl font-black leading-none text-orange-400">
                        {selectedManager}
                      </DialogTitle>
                      <ManagerChampionshipPills managerName={selectedManager} className="mt-2 justify-center" />
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
                            onPlayerClick={setSelectedPlayer}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <PlayerDetailModal
                isOpen={selectedPlayer !== null}
                onClose={() => setSelectedPlayer(null)}
                pick={selectedPlayer}
                leagueId={leagueId}
                leagueLogo={leagueLogo}
                managerAvatars={managerAvatars}
              />
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
  const [selectedRow, setSelectedRow] = useState<ReportData['positionDepth'][number] | null>(null);
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
          <div className="owner-tile-shell">
            <div className="owner-tile-grid">
              {shortages.map((row, idx) => (
                <OwnerSummaryTile
                  key={`${row.manager}-${row.position}-${idx}`}
                  manager={row.manager}
                  avatarUrl={managerAvatars?.[row.manager]}
                  onClick={() => setSelectedRow(row)}
                >
                  <OwnerMetricPill label="Need" value={row.position} tone="danger" />
                  <OwnerMetricPill label="Count" value={row.count} tone="danger" />
                </OwnerSummaryTile>
              ))}
            </div>
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
          <div className="owner-tile-shell">
            <div className="owner-tile-grid">
              {excesses.map((row, idx) => (
                <OwnerSummaryTile
                  key={`${row.manager}-${row.position}-${idx}`}
                  manager={row.manager}
                  avatarUrl={managerAvatars?.[row.manager]}
                  onClick={() => setSelectedRow(row)}
                >
                  <OwnerMetricPill label="Extra" value={row.position} tone="good" />
                  <OwnerMetricPill label="Count" value={row.count} tone="good" />
                </OwnerSummaryTile>
              ))}
            </div>
          </div>
      </div>
      )}
      <OwnerQuickModal
        open={selectedRow !== null}
        onOpenChange={(open) => !open && setSelectedRow(null)}
        title="Position Depth"
        manager={selectedRow?.manager}
        avatarUrl={selectedRow ? managerAvatars?.[selectedRow.manager] : null}
        metrics={selectedRow ? [
          { label: selectedRow.status === 'shortage' ? 'Need' : 'Extra', value: selectedRow.position, tone: selectedRow.status === 'shortage' ? 'negative' : 'positive' },
          { label: 'Count', value: selectedRow.count },
          { label: 'Signal', value: selectedRow.status === 'shortage' ? 'Shortage' : 'Excess' },
        ] : []}
        note={selectedRow ? `${selectedRow.manager} is flagged for ${selectedRow.status === 'shortage' ? 'a shortage' : 'excess depth'} at ${selectedRow.position}. This is based on position counts relative to the league average and roster requirements.` : undefined}
      />
    </div>
  );
}

export function StarterBenchSnapshot({
  data,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
}: {
  data?: ReportData['managerRosterIntelligence'];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  if (!data?.length) return null;

  return (
    <div className="player-tile-grid waiver-intel-grid">
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
                  playerDetailsById,
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
                  playerDetailsById,
                  currentPositionRank: row.weakestStarter?.currentPositionRank || row.weakestStarter?.seasonPositionRank,
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
    <div className="owner-tile-shell">
      <div className="owner-tile-grid trade-tendency-tile-grid">
        {data.map((row) => {
          const habit = getTradeHabit(row);
          return (
            <OwnerSummaryTile
              key={row.manager}
              manager={row.manager}
              avatarUrl={managerAvatars?.[row.manager]}
              onClick={() => setSelectedManager(row.manager)}
            >
              <OwnerMetricPill label="Deals" value={row.tradeCount} tone="warn" />
              <OwnerMetricPill label="Avg Gap" value={row.avgGap.toLocaleString()} />
              <span className={`trade-habit-pill ${habit.className}`}>{habit.label}</span>
              <OwnerMetricPill
                label="Partner"
                value={row.favoritePartner ? renderPartnerName(row.favoritePartner, managerAvatars) : '-'}
                tone="info"
              />
            </OwnerSummaryTile>
          );
        })}
      </div>
      <Dialog open={selectedManager !== null} onOpenChange={(open) => !open && setSelectedManager(null)}>
        <DialogContent className="trade-manager-modal max-h-[86vh] max-w-[calc(100vw-1rem)] overflow-y-auto border-cyan-300/20 bg-slate-950 p-0 text-slate-100 sm:max-w-2xl">
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
                    <ChampionAvatarFrame managerName={selectedManager} className="trade-manager-title-avatar">
                      {managerAvatars?.[selectedManager] ? (
                        <img src={managerAvatars[selectedManager] || ''} alt={selectedManager} />
                      ) : (
                        <span>{selectedManager.trim()[0]?.toUpperCase() || '?'}</span>
                      )}
                    </ChampionAvatarFrame>
                    <div className="min-w-0 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
                        Trade Tendencies
                      </p>
                      <DialogTitle className="athletic-headline mt-1 truncate text-3xl font-black leading-none text-orange-400">
                        {selectedManager}
                      </DialogTitle>
                      <ManagerChampionshipPills managerName={selectedManager} className="mt-2 justify-center" />
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

export function TradeTheftDetector({
  data,
  managerAvatars,
  draftPicks = [],
  playerDetailsById,
  currentPositionRankById,
  leagueId,
  leagueLogo,
}: {
  data: ReportData['tradeHistory'];
  managerAvatars?: ManagerAvatars;
  draftPicks?: DraftPick[];
  playerDetailsById?: PlayerDetailsById;
  currentPositionRankById?: CurrentPositionRankById;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedTrade, setSelectedTrade] = useState<ReportData['tradeHistory'][number] | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  if (!data.length) return null;

  const ordered = [...data].sort((a, b) => b.point_gap - a.point_gap);
  const managerSwings = data.flatMap((trade) => [
    {
      trade,
      manager: trade.team_a,
      opponent: trade.team_b,
      swing: getManagerTradeSwing(trade, trade.team_a),
      result: getManagerTradeResult(trade, trade.team_a),
    },
    {
      trade,
      manager: trade.team_b,
      opponent: trade.team_a,
      swing: getManagerTradeSwing(trade, trade.team_b),
      result: getManagerTradeResult(trade, trade.team_b),
    },
  ]);
  const biggestGap = ordered[0];
  const cleanestDeal = [...data].sort((a, b) => a.point_gap - b.point_gap)[0];
  const bestSwing = [...managerSwings].sort((a, b) => b.swing - a.swing)[0];
  const worstSwing = [...managerSwings].sort((a, b) => a.swing - b.swing)[0];
  const robberyCount = data.filter((trade) => trade.point_gap >= 1000).length;
  const fairCount = data.filter((trade) => trade.point_gap <= 300).length;
  const avgGap = Math.round(data.reduce((sum, trade) => sum + trade.point_gap, 0) / data.length);
  const fairRate = Math.round((fairCount / data.length) * 100);

  const cards = [
    biggestGap && {
      key: 'biggest-gap',
      eyebrow: 'Trade Theft Detector',
      title: getTradeGapVerdict(biggestGap.point_gap).label,
      value: biggestGap.point_gap.toLocaleString(),
      copy: `${biggestGap.date}: ${getTradeDisplaySides(biggestGap).winners.join(' + ')} got the biggest value gap.`,
      trade: biggestGap,
      tone: 'fire' as const,
    },
    cleanestDeal && {
      key: 'cleanest-deal',
      eyebrow: 'Cleanest Deal',
      title: getTradeGapVerdict(cleanestDeal.point_gap).label,
      value: cleanestDeal.point_gap.toLocaleString(),
      copy: `${cleanestDeal.date}: ${cleanestDeal.team_a} and ${cleanestDeal.team_b} were closest to even.`,
      trade: cleanestDeal,
      tone: 'fair' as const,
    },
    bestSwing && {
      key: 'best-swing',
      eyebrow: 'Best One-Trade Profit',
      title: bestSwing.manager,
      value: `+${bestSwing.swing.toLocaleString()}`,
      copy: `${bestSwing.result} vs ${bestSwing.opponent} on ${bestSwing.trade.date}.`,
      trade: bestSwing.trade,
      tone: 'good' as const,
    },
    worstSwing && {
      key: 'worst-swing',
      eyebrow: 'Biggest One-Trade Loss',
      title: worstSwing.manager,
      value: worstSwing.swing.toLocaleString(),
      copy: `${worstSwing.result} vs ${worstSwing.opponent} on ${worstSwing.trade.date}.`,
      trade: worstSwing.trade,
      tone: 'danger' as const,
    },
    {
      key: 'robbery-rate',
      eyebrow: 'League Market',
      title: `${robberyCount} spicy gaps`,
      value: avgGap.toLocaleString(),
      copy: `${robberyCount} of ${data.length} trades crossed a 1,000-point gap. Average gap is ${avgGap.toLocaleString()}.`,
      trade: biggestGap,
      tone: robberyCount >= Math.max(2, data.length * 0.25) ? 'fire' as const : 'fair' as const,
    },
    {
      key: 'fair-rate',
      eyebrow: 'Handshake Rate',
      title: `${fairRate}% fair-ish`,
      value: `${fairCount}/${data.length}`,
      copy: `${fairCount} trades landed within 300 points, which is our current "nobody got smoked" range.`,
      trade: cleanestDeal,
      tone: 'fair' as const,
    },
  ].filter(Boolean) as Array<{
    key: string;
    eyebrow: string;
    title: string;
    value: string;
    copy: string;
    trade?: ReportData['tradeHistory'][number] | null;
    tone: 'fire' | 'fair' | 'good' | 'danger';
  }>;

  return (
    <div className="trade-theft-wrap">
      <div className="trade-theft-grid">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`trade-theft-card trade-theft-card-${card.tone}`}
            onClick={() => card.trade && setSelectedTrade(card.trade)}
          >
            <span className="trade-theft-eyebrow">{card.eyebrow}</span>
            <span className="trade-theft-main">
              <span className="trade-theft-title">{card.title}</span>
              <span className="trade-theft-value">{card.value}</span>
            </span>
            <span className="trade-theft-copy">{card.copy}</span>
          </button>
        ))}
      </div>

      <Dialog open={selectedTrade !== null} onOpenChange={(open) => !open && setSelectedTrade(null)}>
        <DialogContent className="trade-detail-modal max-h-[88vh] max-w-[calc(100vw-1rem)] overflow-y-auto border-cyan-300/20 bg-slate-950 p-3 text-slate-100 sm:max-w-3xl sm:p-5">
          <DialogHeader className="sr-only">
            <DialogTitle>Trade Theft Detail</DialogTitle>
            <DialogDescription>Expanded trade ledger for the selected value gap.</DialogDescription>
          </DialogHeader>
          {selectedTrade && (
            <TradeDetailPanel
              row={selectedTrade}
              draftPicks={draftPicks}
              managerAvatars={managerAvatars}
              playerDetailsById={playerDetailsById}
              currentPositionRankById={currentPositionRankById}
              onPlayerClick={setSelectedPlayer}
            />
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
    <div className="owner-tile-shell">
      <div className="owner-tile-grid pick-portfolio-tile-grid">
        {data.map((row) => (
          <OwnerSummaryTile
            key={row.manager}
            manager={row.manager}
            avatarUrl={managerAvatars?.[row.manager]}
          >
            <OwnerMetricPill label="2025" value={row.count2025 ? `${row.count2025} - ${formatCompactValue(row.value2025)}` : '-'} />
            <OwnerMetricPill label="2026" value={row.count2026 ? `${row.count2026} - ${formatCompactValue(row.value2026)}` : '-'} />
            <OwnerMetricPill label="2027" value={row.count2027 ? `${row.count2027} - ${formatCompactValue(row.value2027)}` : '-'} />
            <OwnerMetricPill label="Owned" value={`${row.ownPicks}/${row.ownPicks + row.acquiredPicks}`} tone="info" />
            <OwnerMetricPill label="Total" value={formatCompactValue(row.totalValue)} tone="warn" />
          </OwnerSummaryTile>
        ))}
      </div>
    </div>
  );
}

export function WaiverIntelligencePanel({
  data,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
}: {
  data?: ReportData['waiverIntelligence'];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
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
          className="player-team-tile waiver-intel-card"
          style={getTeamTileStyle(player?.playerDetails?.team || player?.team)}
          onClick={() => player && setSelectedPlayer(buildPlayerModalData({
            playerId: player.player_id,
            playerName: player.name,
            playerPos: player.pos,
            value: player.ktcValue,
            playerDetails: player.playerDetails,
            playerDetailsById,
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
  playerDetailsById,
  leagueId,
  leagueLogo,
}: {
  risers: ReportData['weeklyRisers'];
  fallers: ReportData['weeklyFallers'];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
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
    <div className="player-tile-grid trade-market-grid">
      {rows.map(({ label, tone, player }) => (
        <button
          key={`${label}-${player.player_id || player.name}`}
          type="button"
          className={`player-team-tile trade-market-card ${tone === 'positive' ? 'trade-market-card-sell' : 'trade-market-card-buy'}`}
          style={getTeamTileStyle(player.playerDetails?.team)}
          onClick={() => setSelectedPlayer(buildPlayerModalData({
            playerId: player.player_id,
            playerName: player.name,
            playerPos: player.pos,
            value: player.val_now,
            valueGain: player.diff,
            playerDetails: player.playerDetails,
            playerDetailsById,
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
  playerDetailsById,
  leagueId,
  leagueLogo,
}: {
  data: ReportData['managerPositionCounts'];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedManager, setSelectedManager] = useState<ReportData['managerPositionCounts'][number] | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const selectedAvatar = selectedManager ? managerAvatars?.[selectedManager.manager] : null;
  const selectedStarters = selectedManager?.starterPlayers || [];

  return (
    <div className="owner-tile-shell">
      <div className="owner-tile-grid position-counts-tile-grid">
        {data.map((row, idx) => (
          <OwnerSummaryTile
            key={`${row.manager}-${idx}`}
            manager={row.manager}
            avatarUrl={managerAvatars?.[row.manager]}
            onClick={() => setSelectedManager(row)}
          >
            <OwnerMetricPill label="QB" value={`${row.QB_starters}/${row.QB}`} />
            <OwnerMetricPill label="RB" value={`${row.RB_starters}/${row.RB}`} />
            <OwnerMetricPill label="WR" value={`${row.WR_starters}/${row.WR}`} />
            <OwnerMetricPill label="TE" value={`${row.TE_starters}/${row.TE}`} />
          </OwnerSummaryTile>
        ))}
      </div>
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
                  <ChampionAvatarFrame managerName={selectedManager.manager}>
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
                  </ChampionAvatarFrame>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                      Starter Room
                    </p>
                    <h3 className="athletic-headline truncate text-3xl font-black text-orange-400 sm:text-4xl">
                      {selectedManager.manager}
                    </h3>
                    <ManagerChampionshipPills managerName={selectedManager.manager} className="mt-1" />
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
                        className="player-team-tile starter-player-tile"
                        style={getTeamTileStyle(player.playerDetails?.team)}
                        onClick={() => {
                          setSelectedPlayer(buildPlayerModalData({
                            playerId: player.player_id,
                            playerName: player.name,
                            playerPos: player.pos,
                            value: player.value,
                            playerDetails: player.playerDetails,
                            playerDetailsById,
                            currentPositionRank: player.currentPositionRank || player.seasonPositionRank,
                            manager: selectedManager.manager,
                            managerAvatarUrl: selectedAvatar,
                          }));
                        }}
                      >
                        <div className="starter-player-main">
                          <PlayerNameWithHeadshot playerId={player.player_id} playerName={player.name} />
                        </div>
                        <div className="starter-player-meta">
                          <PositionRankPill rank={player.currentPositionRank || player.seasonPositionRank || player.pos} />
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
