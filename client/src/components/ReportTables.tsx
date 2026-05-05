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
import React, { useMemo, useState } from 'react';
import { ChevronDown, Crown, X as XIcon } from 'lucide-react';
import type { DraftPick, ManagerIntelPlayer, PlayerDetails, ReportData, TrendingPlayer } from '@shared/types';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { ChampionAvatarFrame, ManagerChampionshipPills } from './ManagerChampionships';
import { PlayerDetailModal, type PlayerModalData } from './PlayerDetailModal';
import { TeamLogoPill } from './TeamLogoPill';
import { getPositionRankPillClass } from '@/lib/positionRank';
import { getTeamTileStyle } from '@/lib/teamTileStyle';
import { getPlayerAvailability, getPlayerAvailabilityClass } from '@/lib/playerStatus';
import { compareManagersByViewerAndStanding, sortRowsByOverviewStrength, sortRowsByViewerAndStanding } from '@/lib/managerOrdering';

type ManagerAvatars = ReportData['managerAvatars'];
type PlayerDetailsById = ReportData['playerDetailsById'];
type CurrentPositionRankById = ReportData['currentPositionRankById'];
type LeagueOverviewRows = ReportData['leagueOverview'];
type ManagerRosterIntelRows = NonNullable<ReportData['managerRosterIntelligence']>;
type DynastyTimelineRows = NonNullable<ReportData['dynastyTimelines']>;

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
        rosterStatus: playerDetails.rosterStatus || mappedDetails?.rosterStatus,
        displayStatus: (playerDetails.rosterStatus ? playerDetails.displayStatus : mappedDetails?.displayStatus) || playerDetails.displayStatus,
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

function getPlayerStatusLabel(details?: PlayerDetails | null): string {
  return getPlayerAvailability(details).label;
}

function getPlayerStatusClass(details?: PlayerDetails | null): string {
  return getPlayerAvailabilityClass(details);
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
          <ChampionAvatarFrame managerName={manager} showAccolades={false}>
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
  buildLens?: ManagerBuildLens,
) {
  const avatarUrl = managerAvatars?.[manager];
  const initial = manager.trim()[0]?.toUpperCase() || '?';

  return (
    <span className={`trade-side-manager ${isWinner ? 'trade-side-manager-winner' : 'trade-side-manager-other'}`}>
      <span className="trade-mobile-avatar-wrap">
        <ChampionAvatarFrame managerName={manager} showAccolades={false}>
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
      <span className="trade-side-manager-lockup">
        <span className="trade-side-manager-name">{manager}</span>
        {buildLens && <ManagerBuildPill lens={buildLens} />}
      </span>
    </span>
  );
}

function ManagerBuildPill({ lens }: { lens: ManagerBuildLens }) {
  return (
    <span className={`trade-build-pill trade-build-pill-${lens.tone}`} title={lens.reason}>
      {lens.label}
    </span>
  );
}

function renderTradeLedgerManagerName(
  manager: string,
  managerAvatars?: ManagerAvatars,
  buildLens?: ManagerBuildLens,
) {
  return (
    <span className="trade-ledger-manager-lockup">
      {renderManagerName(manager, managerAvatars)}
      {buildLens && <ManagerBuildPill lens={buildLens} />}
    </span>
  );
}

function renderTradeFitReadManager(manager: string, managerAvatars?: ManagerAvatars) {
  const avatarUrl = managerAvatars?.[manager];
  const initial = manager.trim()[0]?.toUpperCase() || '?';

  return (
    <span className="trade-fit-read-manager">
      <span>{manager}</span>
      <ChampionAvatarFrame managerName={manager} showAccolades={false}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={manager} />
        ) : (
          <span aria-hidden="true" className="trade-fit-read-manager-fallback">
            {initial}
          </span>
        )}
      </ChampionAvatarFrame>
    </span>
  );
}

function renderTradeFitRead(
  read: TradeFitRead,
  {
    managerAvatars,
    playerDetailsById,
    onPlayerClick,
  }: {
    managerAvatars?: ManagerAvatars;
    playerDetailsById?: PlayerDetailsById;
    onPlayerClick?: (player: PlayerModalData) => void;
  }
) {
  return (
    <div key={read.manager} className={`trade-fit-read trade-fit-read-${read.tone}`}>
      <div className="trade-fit-read-top">
        <span>{read.label}</span>
        {renderTradeFitReadManager(read.manager, managerAvatars)}
      </div>
      <p>{read.note}</p>
      {read.target && (
        <button
          type="button"
          className="trade-fit-target"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!onPlayerClick) return;
            onPlayerClick(buildPlayerModalData({
              playerId: read.target?.player_id,
              playerName: read.target?.name || '',
              playerPos: read.target?.pos,
              value: read.target?.value,
              playerDetails: read.target?.playerDetails,
              playerDetailsById,
              manager: read.target?.owner,
              currentPositionRank: read.target?.seasonPositionRank || read.target?.currentPositionRank,
            }));
          }}
        >
          <span className="trade-fit-target-label">Better target: {read.target.name}</span>
          <PositionRankPill rank={read.target.seasonPositionRank || read.target.currentPositionRank || read.target.pos} />
        </button>
      )}
    </div>
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
  if( gap < 5000 ) return { label: 'Delete the App', className: 'trade-gap-verdict-nuclear' };
  if( gap < 6000 ) return { label: 'Call the Lawyer', className: 'trade-gap-verdict-nuclear' };
  if( gap < 7500 ) return { label: 'Generational Fleece', className: 'trade-gap-verdict-nuclear' };
    return { label: 'Eternal Shame', className: 'trade-gap-verdict-nuclear' };
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

const TRADE_LEDGER_MUTUAL_WIN_GAP = 250;

type ManagerBuildLens = {
  mode: TradeWarMode;
  label: string;
  tone: 'contender' | 'rebuilder' | 'middle';
  reason: string;
};

type TradeLedgerSideEvaluation = {
  manager: string;
  lens: ManagerBuildLens;
  values: number[];
  adjustment: number;
  total: number;
};

type TradeLedgerEvaluation = {
  teamA: TradeLedgerSideEvaluation;
  teamB: TradeLedgerSideEvaluation;
  pointGap: number;
  winners: string[];
};

function getManagerBuildLens(
  manager: string,
  dynastyTimelines?: DynastyTimelineRows,
  managerRosterIntelligence?: ReportData['managerRosterIntelligence'],
): ManagerBuildLens {
  const timeline = dynastyTimelines?.find((row) => row.manager === manager);
  if (timeline) {
    const { contenderScore, rebuildScore, label } = timeline;
    const reason = `${label}: contender ${contenderScore}, rebuild ${rebuildScore}`;

    if (contenderScore >= 74 && contenderScore >= rebuildScore - 6) {
      return { mode: 'contender', label: 'Contender', tone: 'contender', reason };
    }

    if (rebuildScore >= 68 && rebuildScore > contenderScore) {
      return { mode: 'rebuilder', label: 'Rebuilder', tone: 'rebuilder', reason };
    }

    if (/contender|win|playoff/i.test(label)) {
      return { mode: 'contender', label: 'Contender', tone: 'contender', reason };
    }

    if (/rebuild|future/i.test(label)) {
      return { mode: 'rebuilder', label: 'Rebuilder', tone: 'rebuilder', reason };
    }

    return { mode: 'dynasty', label: 'Middle', tone: 'middle', reason };
  }

  const intel = managerRosterIntelligence?.find((row) => row.manager === manager);
  const fallbackLabel = `${intel?.timeline || intel?.identity || 'No timeline score'}`;
  if (/rebuild|future|youth/i.test(fallbackLabel)) {
    return { mode: 'rebuilder', label: 'Rebuilder', tone: 'rebuilder', reason: fallbackLabel };
  }
  if (/contender|win|playoff/i.test(fallbackLabel)) {
    return { mode: 'contender', label: 'Contender', tone: 'contender', reason: fallbackLabel };
  }

  return { mode: 'dynasty', label: 'Middle', tone: 'middle', reason: fallbackLabel };
}

function getTradeContextLens(context?: ReportData['tradeHistory'][number]['team_a_context']): ManagerBuildLens | null {
  if (!context) return null;
  return {
    mode: context.mode,
    label: context.mode === 'contender' ? 'Contender' : context.mode === 'rebuilder' ? 'Rebuilder' : 'Middle',
    tone: context.mode === 'contender' ? 'contender' : context.mode === 'rebuilder' ? 'rebuilder' : 'middle',
    reason: context.reason,
  };
}

function getTradeRowBuildLens(
  row: ReportData['tradeHistory'][number],
  manager: string,
  dynastyTimelines?: DynastyTimelineRows,
  managerRosterIntelligence?: ReportData['managerRosterIntelligence'],
): ManagerBuildLens {
  const context = row.team_a === manager
    ? row.team_a_context
    : row.team_b === manager
      ? row.team_b_context
      : undefined;

  return getTradeContextLens(context)
    || getManagerBuildLens(manager, dynastyTimelines, managerRosterIntelligence);
}

function getTradeLensNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

function getTradeLedgerPlayerValue(
  playerItem: ReturnType<typeof parseTradePlayerItem>,
  details: PlayerDetails | undefined,
  mode: TradeWarMode,
): number | null {
  if (!playerItem) return null;
  const profile = details?.valueProfile;
  if (mode === 'contender') {
    return getTradeLensNumber(profile?.contenderValue)
      ?? getTradeLensNumber(profile?.seasonValue)
      ?? playerItem.value;
  }
  if (mode === 'rebuilder') {
    return getTradeLensNumber(profile?.rebuilderValue)
      ?? getTradeLensNumber(profile?.dynastyValue)
      ?? playerItem.value;
  }
  return playerItem.value;
}

function getTradeLedgerPlayerRank(
  playerId: string,
  details: PlayerDetails | undefined,
  currentPositionRankById: CurrentPositionRankById | undefined,
  mode: TradeWarMode,
) {
  const profile = details?.valueProfile;
  if (mode === 'contender') {
    return profile?.contenderPositionRank
      || profile?.seasonPositionRank
      || currentPositionRankById?.[playerId]
      || profile?.dynastyPositionRank
      || details?.position
      || null;
  }
  if (mode === 'rebuilder') {
    return profile?.rebuilderPositionRank
      || profile?.dynastyPositionRank
      || currentPositionRankById?.[playerId]
      || profile?.balancedPositionRank
      || details?.position
      || null;
  }
  return currentPositionRankById?.[playerId]
    || profile?.dynastyPositionRank
    || profile?.balancedPositionRank
    || profile?.seasonPositionRank
    || details?.position
    || null;
}

function getTradeLedgerItemValues(
  items: string,
  mode: TradeWarMode,
  playerDetailsById?: PlayerDetailsById,
) {
  return splitTradeItems(items)
    .map((item) => {
      const trimmed = item.trim();
      if (!trimmed || parseValueAdjustmentItem(trimmed) !== null) return null;

      const playerItem = parseTradePlayerItem(trimmed);
      if (playerItem) {
        return getTradeLedgerPlayerValue(playerItem, playerDetailsById?.[playerItem.playerId], mode);
      }

      const pickItem = parseTradePickItem(trimmed);
      if (pickItem) return getTradeLensNumber(pickItem.value);

      return null;
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));
}

function calculateTradeLedgerValueAdjustment(sideValues: number[], otherSideValues: number[]): number {
  if (!sideValues.length || !otherSideValues.length) return 0;
  const bestPlayerVal = Math.max(...sideValues, ...otherSideValues);
  if (sideValues.includes(bestPlayerVal) && sideValues.length < otherSideValues.length) {
    const diff = otherSideValues.length - sideValues.length;
    const avgPkgVal = otherSideValues.reduce((sum, value) => sum + value, 0) / otherSideValues.length;
    return Math.floor(avgPkgVal * 0.25 * diff);
  }
  return 0;
}

function chooseTradeLedgerWinners(
  managerA: string,
  managerB: string,
  valueA: number,
  valueB: number,
): string[] {
  const pointGap = Math.abs(valueA - valueB);
  if (pointGap <= TRADE_LEDGER_MUTUAL_WIN_GAP) return [managerA, managerB];
  return valueA > valueB ? [managerA] : [managerB];
}

function buildTradeLedgerEvaluation(
  row: ReportData['tradeHistory'][number],
  dynastyTimelines?: DynastyTimelineRows,
  managerRosterIntelligence?: ReportData['managerRosterIntelligence'],
  playerDetailsById?: PlayerDetailsById,
): TradeLedgerEvaluation {
  const teamALens = getTradeRowBuildLens(row, row.team_a, dynastyTimelines, managerRosterIntelligence);
  const teamBLens = getTradeRowBuildLens(row, row.team_b, dynastyTimelines, managerRosterIntelligence);
  const teamAValues = getTradeLedgerItemValues(row.team_a_items, teamALens.mode, playerDetailsById);
  const teamBValues = getTradeLedgerItemValues(row.team_b_items, teamBLens.mode, playerDetailsById);
  const teamAAdjustment = calculateTradeLedgerValueAdjustment(teamAValues, teamBValues);
  const teamBAdjustment = calculateTradeLedgerValueAdjustment(teamBValues, teamAValues);
  const teamATotal = teamAValues.reduce((sum, value) => sum + value, 0) + teamAAdjustment;
  const teamBTotal = teamBValues.reduce((sum, value) => sum + value, 0) + teamBAdjustment;
  const evaluatedTeamATotal = teamATotal || row.team_a_total;
  const evaluatedTeamBTotal = teamBTotal || row.team_b_total;

  return {
    teamA: {
      manager: row.team_a,
      lens: teamALens,
      values: teamAValues,
      adjustment: teamAAdjustment,
      total: evaluatedTeamATotal,
    },
    teamB: {
      manager: row.team_b,
      lens: teamBLens,
      values: teamBValues,
      adjustment: teamBAdjustment,
      total: evaluatedTeamBTotal,
    },
    pointGap: Math.abs(evaluatedTeamATotal - evaluatedTeamBTotal),
    winners: chooseTradeLedgerWinners(row.team_a, row.team_b, evaluatedTeamATotal, evaluatedTeamBTotal),
  };
}

function getTradeLensSourceNote(row: ReportData['tradeHistory'][number]): string | null {
  const contextA = row.team_a_context;
  const contextB = row.team_b_context;
  if (!contextA && !contextB) return null;
  if (contextA?.source === 'historical-roster' || contextB?.source === 'historical-roster') {
    return 'Values are shown through each manager\'s pre-trade roster lens, not today\'s roster identity.';
  }
  return null;
}

function getTradeSideEvaluation(manager: string, evaluation: TradeLedgerEvaluation): TradeLedgerSideEvaluation {
  return evaluation.teamA.manager === manager ? evaluation.teamA : evaluation.teamB;
}

function getTradeDisplaySides(
  row: ReportData['tradeHistory'][number],
  evaluation?: TradeLedgerEvaluation,
) {
  const winners = evaluation?.winners || (row.winners?.length ? row.winners : [row.winner]);
  const isTeamAWinner = winners.includes(row.team_a);
  const isTeamBWinner = winners.includes(row.team_b);
  const isMutualWin = isTeamAWinner && isTeamBWinner;
  const winnerSide = isTeamBWinner && !isTeamAWinner ? 'team_b' : 'team_a';
  const teamATotal = evaluation?.teamA.total ?? row.team_a_total;
  const teamBTotal = evaluation?.teamB.total ?? row.team_b_total;
  const loserName = isMutualWin
    ? 'Both Win'
    : winnerSide === 'team_a' ? row.team_b : row.team_a;
  const leftSide = isMutualWin
      ? {
        manager: row.team_a,
        items: row.team_a_items,
        total: teamATotal,
        isWinner: true,
      }
    : winnerSide === 'team_a'
    ? {
        manager: row.team_a,
        items: row.team_a_items,
        total: teamATotal,
        isWinner: true,
      }
    : {
        manager: row.team_b,
        items: row.team_b_items,
        total: teamBTotal,
        isWinner: true,
      };
  const rightSide = isMutualWin
    ? {
        manager: row.team_b,
        items: row.team_b_items,
        total: teamBTotal,
        isWinner: true,
      }
    : winnerSide === 'team_a'
    ? {
        manager: row.team_b,
        items: row.team_b_items,
        total: teamBTotal,
        isWinner: false,
      }
    : {
        manager: row.team_a,
        items: row.team_a_items,
        total: teamATotal,
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
  managerRosterIntelligence,
  dynastyTimelines,
  leagueOverview,
  onPlayerClick,
}: {
  row: ReportData['tradeHistory'][number];
  draftPicks?: DraftPick[];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  currentPositionRankById?: CurrentPositionRankById;
  managerRosterIntelligence?: ReportData['managerRosterIntelligence'];
  dynastyTimelines?: DynastyTimelineRows;
  leagueOverview?: LeagueOverviewRows;
  onPlayerClick?: (player: PlayerModalData) => void;
}) {
  const tradeEvaluation = buildTradeLedgerEvaluation(row, dynastyTimelines, managerRosterIntelligence, playerDetailsById);
  const { leftSide, rightSide } = getTradeDisplaySides(row, tradeEvaluation);
  const tradeFitReads = buildTradeFitReads(row, managerRosterIntelligence, playerDetailsById);
  const tradeFitReadsByManager = new Map(
    tradeFitReads.map((read) => [read.manager, read])
  );
  const intelByManager = new Map((managerRosterIntelligence || []).map((intel) => [intel.manager, intel]));
  const tradeLensNote = getTradeLensSourceNote(row);

  return (
    <div className="trade-detail-panel">
      <div className="trade-detail-header">
        <div>
          <div className="trade-detail-title">Trade Ledger</div>
          {tradeLensNote && (
            <p className="mt-1 max-w-xl text-xs text-cyan-200/75">
              {tradeLensNote}
            </p>
          )}
        </div>
        <div className="trade-detail-gap">
          <span>Gap</span>
          <strong>{tradeEvaluation.pointGap.toLocaleString()}</strong>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {[leftSide, rightSide].map((side) => {
          const sideEvaluation = getTradeSideEvaluation(side.manager, tradeEvaluation);
          const displayItems = splitTradeItems(side.items)
            .filter((item) => parseValueAdjustmentItem(item.trim()) === null);

          return (
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
                {renderTradeSideManager(side.manager, side.isWinner, managerAvatars, sideEvaluation.lens)}
                <div className={`trade-side-total ${side.isWinner ? 'trade-side-total-win' : 'trade-side-total-other'}`}>
                  <span>Total</span>
                  <strong>{sideEvaluation.total.toLocaleString()}</strong>
                </div>
              </div>
              <div className="relative pt-3">
                <div className="trade-side-assets text-sm text-slate-300">
                  {displayItems
                    .map((item, i) => renderTradeItem(item, i, {
                      draftPicks,
                      playerDetailsById,
                      currentPositionRankById,
                      onPlayerClick,
                      manager: side.manager,
                      managerAvatarUrl: managerAvatars?.[side.manager],
                      valueMode: sideEvaluation.lens.mode,
                    }))}
                  {sideEvaluation.adjustment > 0 && renderTradeItem(
                    `VALUE_ADJUSTMENT:+${sideEvaluation.adjustment}`,
                    displayItems.length,
                  )}
                </div>
                {renderTradeOverviewImpact({
                  manager: side.manager,
                  incomingItems: side.items,
                  outgoingItems: side === leftSide ? rightSide.items : leftSide.items,
                  intel: intelByManager.get(side.manager),
                  playerDetailsById,
                })}
                {tradeFitReadsByManager.has(side.manager) && (
                  <div className="trade-side-fit-reads">
                    {renderTradeFitRead(
                      tradeFitReadsByManager.get(side.manager)!,
                      {
                        managerAvatars,
                        playerDetailsById,
                        onPlayerClick,
                      }
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
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

  const normalizeOwner = (value: string | null | undefined) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\d+$/g, '');
  const parsedOwner = normalizeOwner(parsedPick.originalOwner);
  const parsedDraftSlot = parsedPick.pickNumber
    ? Number(parsedPick.pickNumber.split('.')[1])
    : null;

  const candidates = draftPicks.filter((pick) => {
    const baseMatch =
      pick.draftYear === parsedPick.draftYear &&
      pick.round === parsedPick.round &&
      normalizeOwner(pick.originalOwner) === parsedOwner;

    if (!baseMatch) return false;
    if (!Number.isFinite(parsedDraftSlot)) return true;
    return pick.draftSlot === parsedDraftSlot;
  });

  return candidates[0] || null;
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
    valueMode = 'dynasty',
  }: {
    draftPicks?: DraftPick[];
    playerDetailsById?: PlayerDetailsById;
    currentPositionRankById?: CurrentPositionRankById;
    onPlayerClick?: (player: PlayerModalData) => void;
    manager?: string;
    managerAvatarUrl?: string | null;
    valueMode?: TradeWarMode;
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
    const currentRank = getTradeLedgerPlayerRank(playerItem.playerId, details, currentPositionRankById, valueMode);
    const displayedValue = getTradeLedgerPlayerValue(playerItem, details, valueMode);
    const valueGain = valueMode === 'dynasty' && playerItem.value !== null && playerItem.tradeDateValue !== null
      ? playerItem.value - playerItem.tradeDateValue
      : undefined;
    const content = (
      <>
        <span className="trade-asset-player-main">
          <PlayerNameWithHeadshot
            playerId={playerItem.playerId}
            playerName={playerItem.playerName}
          />
        </span>
        <span className="trade-asset-player-meta">
          <span className="trade-asset-player-pills">
            <TeamLogoPill team={details?.team} />
            <PositionRankPill rank={currentRank || 'Player'} />
          </span>
          {displayedValue !== null && (
            <span className="value-pill trade-asset-player-value">
              {displayedValue.toLocaleString()}
            </span>
          )}
        </span>
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
              value: displayedValue,
              valueGain,
              valueChangeNote: valueMode === 'dynasty' && playerItem.tradeDate
                ? `Change from this trade on ${playerItem.tradeDate} to today.`
                : undefined,
              playerDetails: details,
              playerDetailsById,
              manager,
              managerAvatarUrl,
              currentPositionRank: currentRank,
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
            <PositionRankPill
              rank={
                landedPick.currentPositionRank
                || (landedPick.player_id ? currentPositionRankById?.[landedPick.player_id] : null)
                || landedPick.playerPos
              }
            />
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

function splitTradeItems(items: string): string[] {
  return items
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTradeItemSignal(items: string, playerDetailsById?: PlayerDetailsById) {
  const positions = new Set<string>();
  let hasPick = false;
  const playerNames: string[] = [];

  splitTradeItems(items).forEach((item) => {
    const player = parseTradePlayerItem(item);
    if (player) {
      playerNames.push(player.playerName);
      const position = playerDetailsById?.[player.playerId]?.position;
      if (position && ['QB', 'RB', 'WR', 'TE'].includes(position)) positions.add(position);
      return;
    }

    if (parseTradePickItem(item)) {
      hasPick = true;
    }
  });

  return { positions, hasPick, playerNames };
}

function buildTradeFitReads(
  row: ReportData['tradeHistory'][number],
  managerRosterIntelligence?: ReportData['managerRosterIntelligence'],
  playerDetailsById?: PlayerDetailsById
): TradeFitRead[] {
  if (!managerRosterIntelligence?.length) return [];

  const intelByManager = new Map(managerRosterIntelligence.map((intel) => [intel.manager, intel]));
  const sides = [
    { manager: row.team_a, incoming: row.team_a_items, outgoing: row.team_b_items },
    { manager: row.team_b, incoming: row.team_b_items, outgoing: row.team_a_items },
  ];

  const reads: TradeFitRead[] = [];

  sides.forEach((side) => {
    const intel = intelByManager.get(side.manager);
    if (!intel) return;

    const incoming = getTradeItemSignal(side.incoming, playerDetailsById);
    const outgoing = getTradeItemSignal(side.outgoing, playerDetailsById);
    const need = intel.tradePlan?.needPosition || null;
    const surplus = intel.tradePlan?.surplusPosition || null;
    const boughtNeed = Boolean(need && incoming.positions.has(need));
    const soldSurplus = Boolean(surplus && outgoing.positions.has(surplus));
    const boughtSurplus = Boolean(surplus && incoming.positions.has(surplus));
    const soldNeed = Boolean(need && outgoing.positions.has(need));
    const target = need && intel.buyTarget && !boughtNeed ? intel.buyTarget : null;
    const targetRank = target?.seasonPositionRank || target?.currentPositionRank || target?.pos;

    if (boughtNeed && soldSurplus) {
      reads.push({
        manager: side.manager,
        label: 'Clean Fit',
        tone: 'good',
        note: `This lines up with the roster map: added ${need} help while selling from the ${surplus} surplus.`,
      });
      return;
    }

    if (boughtNeed) {
      reads.push({
        manager: side.manager,
        label: 'Solved A Need',
        tone: 'good',
        note: `This trade makes sense for ${side.manager}: the incoming side attacks the ${need} need directly.`,
      });
      return;
    }

    if (soldNeed) {
      reads.push({
        manager: side.manager,
        label: 'Roster Fit Problem',
        tone: 'warn',
        note: `This deal moved value away from ${side.manager}'s biggest ${need} pressure point. The cleaner move was buying that position, not spending it.`,
        target,
      });
      return;
    }

    if (boughtSurplus && surplus) {
      reads.push({
        manager: side.manager,
        label: 'More Of The Same',
        tone: 'warn',
        note: `This adds more ${surplus} value to an area that already looked like the surplus. The roster would probably feel cleaner if that value chased ${need || 'a weaker spot'}.`,
        target,
      });
      return;
    }

    if (incoming.hasPick && intel.timeline.toLowerCase().includes('rebuild')) {
      reads.push({
        manager: side.manager,
        label: 'Timeline Match',
        tone: 'good',
        note: `Getting picks fits the rebuild timeline. This is the kind of value that gives the roster more shots without forcing a short-term lineup decision.`,
      });
      return;
    }

    if (outgoing.hasPick && intel.timeline.toLowerCase().includes('contender')) {
      reads.push({
        manager: side.manager,
        label: 'Contender Move',
        tone: 'good',
        note: `Spending pick value can make sense for a contender if the player acquired starts right away or protects a fragile position.`,
      });
      return;
    }

    if (target) {
      reads.push({
        manager: side.manager,
        label: 'Better Target',
        tone: 'neutral',
        note: `The value path was not terrible, but ${side.manager}'s roster need points more toward ${target.name}${targetRank ? ` (${targetRank})` : ''}.`,
        target,
      });
      return;
    }

    reads.push({
      manager: side.manager,
      label: 'Neutral Fit',
      tone: 'neutral',
      note: `No obvious roster-fit issue. This reads more like a value bet than a clear positional fix.`,
    });
  });

  return reads;
}

function renderTradeOverviewImpact({
  manager,
  incomingItems,
  outgoingItems,
  intel,
  playerDetailsById,
}: {
  manager: string;
  incomingItems: string;
  outgoingItems: string;
  intel?: ManagerRosterIntelRows[number];
  playerDetailsById?: PlayerDetailsById;
}) {
  if (!intel) return null;

  const incoming = getTradeItemSignal(incomingItems, playerDetailsById);
  const outgoing = getTradeItemSignal(outgoingItems, playerDetailsById);
  const need = intel?.tradePlan?.needPosition || null;
  const surplus = intel?.tradePlan?.surplusPosition || null;
  const boughtNeed = Boolean(need && incoming.positions.has(need));
  const soldNeed = Boolean(need && outgoing.positions.has(need));
  const soldSurplus = Boolean(surplus && outgoing.positions.has(surplus));
  const boughtSurplus = Boolean(surplus && incoming.positions.has(surplus));

  const impactPills: Array<{ label: string; tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'info' }> = [];
  if (need) {
    impactPills.push({
      label: boughtNeed ? `Fixed ${need}` : `${need} Still Thin`,
      tone: boughtNeed ? 'good' : 'warn',
    });
  }
  if (surplus && soldSurplus) impactPills.push({ label: `Moved ${surplus} Surplus`, tone: 'info' });
  if (need && soldNeed) impactPills.push({ label: `Spent ${need}`, tone: 'danger' });
  if (surplus && boughtSurplus) impactPills.push({ label: `Added More ${surplus}`, tone: 'warn' });

  const notes: string[] = [];
  if (boughtNeed && soldSurplus) {
    notes.push(`${manager} converted ${surplus} depth into ${need} help.`);
  } else if (boughtNeed && need) {
    notes.push(`${manager} used this deal to patch the ${need} need.`);
  } else if (need) {
    notes.push(`${manager} still came out of this trade without solving ${need}.`);
  }
  if (soldNeed && need) {
    notes.push(`They also moved pieces from the same ${need} room.`);
  }
  if (!notes.length && intel?.holes.summary) {
    notes.push(intel.holes.summary);
  }

  if (impactPills.length === 0 && notes.length === 0) return null;

  return (
    <div className="trade-side-impact">
      {(impactPills.length > 0 || notes.length > 0) && (
        <div className="trade-side-impact-read">
          {impactPills.length > 0 && (
            <div className="trade-side-impact-pill-row">
              {impactPills.map((pill) => (
                <span
                  key={pill.label}
                  className={`command-mini-badge command-mini-badge-${pill.tone || 'neutral'}`}
                >
                  {pill.label}
                </span>
              ))}
            </div>
          )}
          {notes.length > 0 && <p>{notes.join(' ')}</p>}
        </div>
      )}
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
  if (normalized.includes('old') || normalized.includes('risk') || normalized.includes('weak') || normalized.includes('behind') || normalized.includes('thin') || normalized.includes('fragile') || normalized.includes('cuttable')) {
    return 'manager-intel-pill-danger';
  }
  if (normalized.includes('young') || normalized.includes('contender') || normalized.includes('win') || normalized.includes('elite') || normalized.includes('shark') || normalized.includes('war chest')) {
    return 'manager-intel-pill-good';
  }
  if (normalized.includes('rebuild') || normalized.includes('future') || normalized.includes('youth')) {
    return 'manager-intel-pill-future';
  }
  return 'manager-intel-pill-neutral';
}

function buildManagerSignalTags({
  identity,
  starterCount,
  powerScore,
  timeline,
  rosterHealthScore,
  avgAge,
  starterAvailability,
  holesSummary,
  tradeRow,
  pickRow,
  ageFlags = [],
}: {
  identity?: string | null;
  starterCount?: number | null;
  powerScore?: number | null;
  timeline?: OwnerTimelineRow | null;
  rosterHealthScore?: number | null;
  avgAge?: number | null;
  starterAvailability?: OwnerIntelRow['starterAvailability'] | null;
  holesSummary?: string | null;
  tradeRow?: OwnerTradeRow | null;
  pickRow?: OwnerPickRow | null;
  ageFlags?: string[];
}): Array<{ label: string; tone: 'neutral' | 'good' | 'warn' | 'danger' | 'future' }> {
  const contenders = timeline?.contenderScore ?? 0;
  const rebuild = timeline?.rebuildScore ?? 0;
  const agingRisk = timeline?.agingRisk ?? 0;
  const futurePickCount = (pickRow?.count2026 || 0) + (pickRow?.count2027 || 0);
  const tags: Array<{ label: string; tone: 'neutral' | 'good' | 'warn' | 'danger' | 'future' }> = [];

  if (powerScore !== null && powerScore !== undefined && powerScore >= 86) tags.push({ label: `Juggernaut ${powerScore}`, tone: 'good' });
  else if (powerScore !== null && powerScore !== undefined && powerScore <= 48) tags.push({ label: `Needs Work ${powerScore}`, tone: 'danger' });

  if (contenders >= 84 && contenders - rebuild >= 18) tags.push({ label: `True Contender ${contenders}`, tone: 'good' });
  else if (rebuild >= 68 && rebuild - contenders >= 10) tags.push({ label: `Rebuild Mode ${rebuild}`, tone: 'future' });
  else if (contenders >= 70 && rebuild >= 52) tags.push({ label: 'Fork In Road', tone: 'warn' });

  if (identity && !['Balanced', 'Middle Build'].includes(titleCasePill(identity))) {
    tags.push({ label: titleCasePill(identity), tone: getPillToneClass(identity).includes('danger') ? 'danger' : getPillToneClass(identity).includes('future') ? 'future' : 'neutral' });
  }
  if (starterCount !== null && starterCount !== undefined && starterCount >= 12) tags.push({ label: `${starterCount} Starters`, tone: 'good' });
  if (starterCount !== null && starterCount !== undefined && starterCount <= 8) tags.push({ label: `${starterCount} Starters`, tone: 'warn' });
  if (rosterHealthScore !== null && rosterHealthScore !== undefined && rosterHealthScore >= 82) tags.push({ label: `Durable ${rosterHealthScore}`, tone: 'good' });
  if (rosterHealthScore !== null && rosterHealthScore !== undefined && rosterHealthScore <= 48) tags.push({ label: `Fragile ${rosterHealthScore}`, tone: 'danger' });
  if (starterAvailability?.riskLevel === 'high') tags.push({ label: 'Injury Watch', tone: 'danger' });
  if (avgAge !== null && avgAge !== undefined && avgAge >= 27.6) tags.push({ label: 'Age Cliff Watch', tone: 'danger' });
  if (avgAge !== null && avgAge !== undefined && avgAge <= 25) tags.push({ label: 'Youth Core', tone: 'future' });
  if (agingRisk >= 58) tags.push({ label: `Age Risk ${agingRisk}`, tone: 'danger' });
  if (futurePickCount >= 17) tags.push({ label: 'Pick War Chest', tone: 'future' });
  if (futurePickCount <= 12 && futurePickCount > 0) tags.push({ label: 'Pick Light', tone: 'warn' });
  if (tradeRow && tradeRow.tradeCount >= 5 && tradeRow.profit >= 2500 && tradeRow.winPct >= 60) tags.push({ label: 'Trade Shark', tone: 'good' });
  if (tradeRow && tradeRow.tradeCount >= 4 && tradeRow.profit <= -2500) tags.push({ label: 'Trade Tax', tone: 'danger' });
  const primaryNeed = holesSummary && holesSummary !== 'No major roster hole flagged'
    ? holesSummary.split(',')[0]?.trim()
    : null;
  if (primaryNeed) tags.push({ label: titleCasePill(primaryNeed), tone: 'warn' });
  ageFlags
    .filter((flag) => /old|young|durable|availability/i.test(flag))
    .slice(0, 1)
    .forEach((flag) => tags.push({ label: titleCasePill(flag), tone: getPillToneClass(flag).includes('danger') ? 'danger' : getPillToneClass(flag).includes('future') ? 'future' : 'neutral' }));

  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = tag.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 7);
}

function buildOwnerIntelTileTags({
  identity,
  powerRow,
  timeline,
  growthRow,
  starterAvailability,
  holesSummary,
  pickRow,
}: {
  identity?: string | null;
  powerRow?: OwnerPowerRow | null;
  timeline?: OwnerTimelineRow | null;
  growthRow?: OwnerGrowthRow | null;
  starterAvailability?: OwnerIntelRow['starterAvailability'] | null;
  holesSummary?: string | null;
  pickRow?: OwnerPickRow | null;
}): Array<{ label: string; tone: 'neutral' | 'good' | 'warn' | 'danger' | 'future' }> {
  const tags: Array<{ label: string; tone: 'neutral' | 'good' | 'warn' | 'danger' | 'future' }> = [];

  if (powerRow) {
    tags.push({
      label: `#${powerRow.rank} ${powerRow.tier}`,
      tone: powerRow.score >= 78 ? 'good' : powerRow.score <= 50 ? 'danger' : 'neutral',
    });
  }

  if (growthRow) {
    tags.push({
      label: `${growthRow.growth >= 0 ? '+' : ''}${growthRow.growth.toFixed(1)}% growth`,
      tone: growthRow.growth >= 0 ? 'good' : 'danger',
    });
  }

  const contenderScore = timeline?.contenderScore ?? 0;
  const rebuildScore = timeline?.rebuildScore ?? 0;
  if (contenderScore >= 84 && contenderScore - rebuildScore >= 18) {
    tags.push({ label: 'Contender Window', tone: 'good' });
  } else if (rebuildScore >= 68 && rebuildScore - contenderScore >= 10) {
    tags.push({ label: 'Rebuild Window', tone: 'future' });
  } else if (contenderScore >= 70 && rebuildScore >= 52) {
    tags.push({ label: 'Fork In Road', tone: 'warn' });
  } else if (identity) {
    const normalizedIdentity = titleCasePill(identity);
    if (!['Balanced', 'Middle Build'].includes(normalizedIdentity)) {
      tags.push({
        label: normalizedIdentity,
        tone: getPillToneClass(identity).includes('danger')
          ? 'danger'
          : getPillToneClass(identity).includes('future')
            ? 'future'
            : 'neutral',
      });
    }
  }

  const primaryNeed = holesSummary && holesSummary !== 'No major roster hole flagged'
    ? holesSummary.split(',')[0]?.trim()
    : null;
  if (primaryNeed) {
    tags.push({ label: titleCasePill(primaryNeed), tone: 'warn' });
  } else if (starterAvailability?.riskLevel === 'high') {
    tags.push({ label: 'Injury Watch', tone: 'danger' });
  }

  const futurePickCount = (pickRow?.count2026 || 0) + (pickRow?.count2027 || 0);
  if (futurePickCount >= 17) {
    tags.push({ label: 'Pick War Chest', tone: 'future' });
  }

  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = tag.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
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
type OwnerPowerRow = NonNullable<ReportData['powerRankings']>[number];
type OwnerGrowthRow = NonNullable<ReportData['managerRosterValueGrowth']>[number];
type TradeWarMode = 'dynasty' | 'contender' | 'rebuilder';
type TradeWarAsset = ManagerIntelPlayer & {
  manager: string;
  assetState: 'roster' | 'bench' | 'taxi' | 'reserve';
};
type TradeFitRead = {
  manager: string;
  label: string;
  note: string;
  tone: 'good' | 'warn' | 'neutral';
  target?: ManagerIntelPlayer | null;
};

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

function buildOwnerBestMove(row: OwnerIntelRow): string {
  const need = row.tradePlan?.needPosition;
  const surplus = row.tradePlan?.surplusPosition;
  const buyName = row.buyTarget?.name;
  const sellName = row.sellCandidate?.name || row.tradeChip?.name;
  const sellValue = row.sellCandidate?.value || row.tradeChip?.value || 0;
  const buyValue = row.buyTarget?.value || 0;
  const targetValueGapIsTooWide = sellValue > 0 && buyValue > sellValue * 1.35 + 250;
  const buildLens = /rebuild/i.test(row.timeline || row.identity)
    ? 'rebuild timeline'
    : /contend|win/i.test(row.timeline || row.identity)
      ? 'contender lineup'
      : 'team window';

  if (need && surplus && buyName && sellName) {
    if (targetValueGapIsTooWide) {
      return `${sellName} should not be priced as a one-for-one for ${buyName}. Either package him with added value for ${need} help, or shop him for a similar-value ${need} who fits this ${buildLens}.`;
    }

    return `Shop ${surplus} surplus (${sellName}) for similar-value ${need} help like ${buyName}. That is the cleanest way to turn excess roster value into a lineup fix.`;
  }

  if (need && buyName) {
    return `The clearest add is ${need} help. Start with players in the same value band as the movable bench pieces; only chase ${buyName} if picks or a package make the price realistic.`;
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
  const risk = titleCasePill(row.starterAvailability.riskLevel);
  const healthScore = row.rosterHealthScore !== null && row.rosterHealthScore !== undefined
    ? `Health score ${row.rosterHealthScore}/100`
    : 'Health score unavailable';
  const riskiest = row.starterAvailability.riskiestStarter?.name;
  const insurance = row.injuryInsurance
    ? `Best internal cover is ${row.injuryInsurance.name} (${row.injuryInsurance.currentPositionRank || row.injuryInsurance.seasonPositionRank || row.injuryInsurance.pos}).`
    : 'No clear internal insurance piece stands out.';
  const depthCoverCount = [...(row.benchPlayers || []), ...(row.reservePlayers || [])]
    .filter((player) => ['RB', 'WR', 'TE'].includes(player.pos) && (player.seasonValue || player.value) >= 900)
    .length;
  const depthCopy = `${depthCoverCount} bench/reserve skill player${depthCoverCount === 1 ? '' : 's'} clear useful depth value.`;

  if (missed === null || missed === undefined) {
    return `${healthScore}. Availability sample is still thin, so lean more on current role, depth value, and roster age. ${insurance}`;
  }

  if (missed >= 3) {
    return `${healthScore}. ${risk} availability risk: starters averaged ${missed} missed games. ${riskiest ? `${riskiest} is the biggest risk flag.` : 'Bench insurance should matter more than luxury depth.'} ${insurance} ${depthCopy}`;
  }

  if (missed >= 1.5) {
    return `${healthScore}. ${risk} availability risk: starters averaged ${missed} missed games. ${riskiest ? `${riskiest} is the player to insure around.` : 'This roster should keep one extra usable spot starter.'} ${insurance} ${depthCopy}`;
  }

  return `${healthScore}. ${risk} availability risk: starters averaged ${missed} missed games, so this roster can be more aggressive consolidating depth. ${insurance} ${depthCopy}`;
}

function buildOwnerWeakSpotCopy(row: OwnerIntelRow): string {
  const qbRank = parsePositionRankValue(row.holes.bestQbRank);
  const rb2Rank = parsePositionRankValue(row.holes.rb2Rank);
  const wr3Rank = parsePositionRankValue(row.holes.wr3Rank);
  const teRank = parsePositionRankValue(row.holes.te1Rank);
  const notes = [
    qbRank !== null && qbRank > 18 ? `QB is led by ${row.holes.bestQbRank}, so superflex depth is the first place to compare against the league.` : null,
    rb2Rank !== null && rb2Rank > 28 ? `RB2 sits at ${row.holes.rb2Rank}, below the comfort line for a weekly contender.` : null,
    wr3Rank !== null && wr3Rank > 36 ? `WR3 sits at ${row.holes.wr3Rank}, so receiver depth is thinner than the top name suggests.` : null,
    teRank !== null && teRank > 14 ? `TE is led by ${row.holes.te1Rank}, which can cap weekly ceiling.` : null,
    row.holes.flexDepth <= 5 ? `Flex depth is ${row.holes.flexDepth}, so the bench cushion is limited.` : null,
  ].filter(Boolean);

  if (notes.length) return notes.join(' ');

  return 'No emergency hole from the baseline ranks. The better angle is finding manager preference or value timing, not assuming an obvious roster flaw.';
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
        <TeamLogoPill team={playerTeam} />
        <PositionRankPill rank={player.currentPositionRank || player.seasonPositionRank || player.pos} />
        {extraPill && <span>{extraPill}</span>}
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

function getTradeWarAssetValue(player: ManagerIntelPlayer, mode: TradeWarMode): number {
  const profile = player.playerDetails?.valueProfile;
  const dynasty = profile?.dynastyValue ?? profile?.balancedValue ?? player.value ?? 0;
  const season = player.seasonValue ?? profile?.seasonValue ?? profile?.fantasyProsSeasonValue ?? dynasty;
  if (mode === 'contender') return Math.round(profile?.contenderValue ?? (dynasty * 0.4 + season * 0.6));
  if (mode === 'rebuilder') return Math.round(profile?.rebuilderValue ?? dynasty);
  return Math.round(dynasty);
}

function getTradeWarAssetRank(player: ManagerIntelPlayer, mode: TradeWarMode): string | null | undefined {
  const profile = player.playerDetails?.valueProfile;
  if (mode === 'contender') return profile?.contenderPositionRank || profile?.seasonPositionRank || player.seasonPositionRank || player.currentPositionRank;
  if (mode === 'rebuilder') return profile?.rebuilderPositionRank || profile?.dynastyPositionRank || player.currentPositionRank || player.seasonPositionRank;
  return profile?.dynastyPositionRank || profile?.balancedPositionRank || player.currentPositionRank || player.seasonPositionRank;
}

function getTradeWarAssetTeam(player: ManagerIntelPlayer): string | null | undefined {
  return player.playerDetails?.team;
}

function getTradeWarModeLabel(mode: TradeWarMode): string {
  if (mode === 'contender') return 'Contender';
  if (mode === 'rebuilder') return 'Rebuilder';
  return 'Dynasty';
}

function getTradeWarGapLabel(gap: number): { label: string; className: string } {
  const absGap = Math.abs(gap);
  if (absGap <= 250) return { label: 'Clean Enough', className: 'trade-war-gap-even' };
  if (absGap <= 650) return { label: 'Needs Sweetener', className: 'trade-war-gap-close' };
  if (absGap <= 1400) return { label: 'Side Needs Help', className: 'trade-war-gap-warn' };
  return { label: 'Too Lopsided', className: 'trade-war-gap-danger' };
}

function getTradeWarPositionCounts(players: TradeWarAsset[]) {
  return players.reduce<Record<string, number>>((acc, player) => {
    acc[player.pos] = (acc[player.pos] || 0) + 1;
    return acc;
  }, {});
}

type TradeWarMetricKey = 'QB' | 'RB' | 'WR' | 'TE' | 'Value' | 'Power' | 'Contender' | 'Rebuild';

type TradeWarRosterMetrics = Record<TradeWarMetricKey, number>;

type TradeWarMetricRanks = Record<TradeWarMetricKey, number>;

type TradeWarRosterSnapshot = {
  metrics: TradeWarRosterMetrics;
  ranks: TradeWarMetricRanks;
  needPosition: string | null;
  surplusPosition: string | null;
  avgAge: number | null;
};

const TRADE_WAR_LINEUP_SLOTS = {
  QB: 2,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 2,
} as const;

function getTradeWarPlayerAge(player: TradeWarAsset): number | null {
  const raw = player.playerDetails?.age;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function getTradeWarModeRankLabel(mode: TradeWarMode): string {
  if (mode === 'contender') return 'Season';
  if (mode === 'rebuilder') return 'Rebuild';
  return 'Dynasty';
}

function sumTradeWarTopByPosition(players: TradeWarAsset[], position: 'QB' | 'RB' | 'WR' | 'TE', count: number, mode: TradeWarMode) {
  return players
    .filter((player) => player.pos === position)
    .sort((a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode))
    .slice(0, count)
    .reduce((sum, player) => sum + getTradeWarAssetValue(player, mode), 0);
}

function buildTradeWarLineupScore(players: TradeWarAsset[], mode: TradeWarMode) {
  const used = new Set<string>();
  const lockPosition = (position: 'QB' | 'RB' | 'WR' | 'TE', count: number) => {
    const chosen = players
      .filter((player) => player.pos === position)
      .sort((a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode))
      .slice(0, count);
    chosen.forEach((player) => used.add(player.player_id));
    return chosen;
  };

  const qbs = lockPosition('QB', TRADE_WAR_LINEUP_SLOTS.QB);
  const rbs = lockPosition('RB', TRADE_WAR_LINEUP_SLOTS.RB);
  const wrs = lockPosition('WR', TRADE_WAR_LINEUP_SLOTS.WR);
  const tes = lockPosition('TE', TRADE_WAR_LINEUP_SLOTS.TE);
  const flex = players
    .filter((player) => ['RB', 'WR', 'TE'].includes(player.pos) && !used.has(player.player_id))
    .sort((a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode))
    .slice(0, TRADE_WAR_LINEUP_SLOTS.FLEX);

  const total = [...qbs, ...rbs, ...wrs, ...tes, ...flex].reduce((sum, player) => sum + getTradeWarAssetValue(player, mode), 0);
  return {
    total,
    flexTotal: flex.reduce((sum, player) => sum + getTradeWarAssetValue(player, mode), 0),
  };
}

function buildTradeWarMetrics(players: TradeWarAsset[], positionMode: TradeWarMode = 'contender'): TradeWarRosterMetrics {
  const dynastyTotal = players.reduce((sum, player) => sum + getTradeWarAssetValue(player, 'dynasty'), 0);
  const contenderTotal = players.reduce((sum, player) => sum + getTradeWarAssetValue(player, 'contender'), 0);
  const rebuildTotal = players.reduce((sum, player) => sum + getTradeWarAssetValue(player, 'rebuilder'), 0);
  const contenderLineup = buildTradeWarLineupScore(players, 'contender');
  const rebuildLineup = buildTradeWarLineupScore(players, 'rebuilder');
  const dynastyLineup = buildTradeWarLineupScore(players, 'dynasty');
  const ages = players.map(getTradeWarPlayerAge).filter((age): age is number => age !== null);
  const averageAge = ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : 0;
  const ageCredit = Math.max(0, 31 - averageAge) * 65;

  return {
    QB: sumTradeWarTopByPosition(players, 'QB', TRADE_WAR_LINEUP_SLOTS.QB, positionMode),
    RB: sumTradeWarTopByPosition(players, 'RB', TRADE_WAR_LINEUP_SLOTS.RB, positionMode),
    WR: sumTradeWarTopByPosition(players, 'WR', TRADE_WAR_LINEUP_SLOTS.WR, positionMode),
    TE: sumTradeWarTopByPosition(players, 'TE', TRADE_WAR_LINEUP_SLOTS.TE, positionMode),
    Value: dynastyTotal,
    Power: Math.round((contenderLineup.total * 0.52) + (dynastyLineup.total * 0.3) + (rebuildTotal * 0.14) + ageCredit),
    Contender: Math.round(contenderLineup.total),
    Rebuild: Math.round((rebuildTotal * 0.72) + (rebuildLineup.total * 0.22) + ageCredit),
  };
}

function buildTradeWarRankMaps(metricsByManager: Map<string, TradeWarRosterMetrics>) {
  const metricKeys: TradeWarMetricKey[] = ['QB', 'RB', 'WR', 'TE', 'Value', 'Power', 'Contender', 'Rebuild'];
  const rankMaps = new Map<string, TradeWarMetricRanks>();

  metricsByManager.forEach((_metrics, manager) => {
    rankMaps.set(manager, {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
      Value: 0,
      Power: 0,
      Contender: 0,
      Rebuild: 0,
    });
  });

  metricKeys.forEach((metric) => {
    const ranked = Array.from(metricsByManager.entries()).sort((a, b) => b[1][metric] - a[1][metric]);
    ranked.forEach(([manager], index) => {
      rankMaps.get(manager)![metric] = index + 1;
    });
  });

  return rankMaps;
}

function formatTradeWarRankShift(label: string, before: number, after: number) {
  const delta = before - after;
  if (delta === 0) return `${label} #${before}`;
  return `${label} #${before} -> #${after}`;
}

function buildTradeWarSnapshot({
  manager,
  row,
  metricsByManager,
  rankMaps,
  assets,
}: {
  manager: string;
  row?: OwnerIntelRow;
  metricsByManager: Map<string, TradeWarRosterMetrics>;
  rankMaps: Map<string, TradeWarMetricRanks>;
  assets: TradeWarAsset[];
}): TradeWarRosterSnapshot {
  const metrics = metricsByManager.get(manager) || buildTradeWarMetrics(assets);
  const ages = assets.map(getTradeWarPlayerAge).filter((age): age is number => age !== null);
  return {
    metrics,
    ranks: rankMaps.get(manager) || {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
      Value: 0,
      Power: 0,
      Contender: 0,
      Rebuild: 0,
    },
    needPosition: row?.tradePlan?.needPosition || null,
    surplusPosition: row?.tradePlan?.surplusPosition || null,
    avgAge: ages.length ? Number((ages.reduce((sum, age) => sum + age, 0) / ages.length).toFixed(1)) : null,
  };
}

function buildTradeWarSimulationNotes({
  manager,
  before,
  after,
  mode,
}: {
  manager: string;
  before: TradeWarRosterSnapshot;
  after: TradeWarRosterSnapshot;
  mode: TradeWarMode;
}) {
  const notes: string[] = [];
  const need = before.needPosition;
  const surplus = before.surplusPosition;

  if (need) {
    const beforeNeedRank = before.ranks[need as 'QB' | 'RB' | 'WR' | 'TE'];
    const afterNeedRank = after.ranks[need as 'QB' | 'RB' | 'WR' | 'TE'];
    if (afterNeedRank < beforeNeedRank) {
      notes.push(`${manager} improves the ${need} room from #${beforeNeedRank} to #${afterNeedRank}.`);
    } else if (afterNeedRank > beforeNeedRank) {
      notes.push(`${manager} leaves ${need} weaker, sliding from #${beforeNeedRank} to #${afterNeedRank}.`);
    } else {
      notes.push(`${manager}'s ${need} room stays flat at #${afterNeedRank}.`);
    }
  }

  if (surplus) {
    const beforeSurplusRank = before.ranks[surplus as 'QB' | 'RB' | 'WR' | 'TE'];
    const afterSurplusRank = after.ranks[surplus as 'QB' | 'RB' | 'WR' | 'TE'];
    if (afterSurplusRank > beforeSurplusRank) {
      notes.push(`${manager} is spending down ${surplus} depth, moving that room from #${beforeSurplusRank} to #${afterSurplusRank}.`);
    }
  }

  const metricKey = mode === 'contender' ? 'Contender' : mode === 'rebuilder' ? 'Rebuild' : 'Value';
  const metricLabel = mode === 'contender' ? 'contender score' : mode === 'rebuilder' ? 'rebuild score' : 'dynasty value';
  const beforeMetricRank = before.ranks[metricKey];
  const afterMetricRank = after.ranks[metricKey];
  if (afterMetricRank < beforeMetricRank) {
    notes.push(`The ${getTradeWarModeLabel(mode).toLowerCase()} lens likes it: ${metricLabel} improves from #${beforeMetricRank} to #${afterMetricRank}.`);
  } else if (afterMetricRank > beforeMetricRank) {
    notes.push(`The ${getTradeWarModeLabel(mode).toLowerCase()} lens pushes back: ${metricLabel} falls from #${beforeMetricRank} to #${afterMetricRank}.`);
  }

  if (after.ranks.Power !== before.ranks.Power) {
    notes.push(`Overall power moves from #${before.ranks.Power} to #${after.ranks.Power}.`);
  }

  if (!notes.length) {
    notes.push(`${manager}'s roster shape barely moves. This is mostly a value swap.`);
  }

  return notes.slice(0, 4);
}

function buildTradeWarTargetSuggestion({
  manager,
  otherManager,
  row,
  currentIncoming,
  opponentAssets,
  mode,
}: {
  manager: string;
  otherManager: string;
  row?: OwnerIntelRow;
  currentIncoming: TradeWarAsset[];
  opponentAssets: TradeWarAsset[];
  mode: TradeWarMode;
}) {
  const need = row?.tradePlan?.needPosition;
  if (!need) return null;
  const currentlyBuyingNeed = currentIncoming.some((asset) => asset.pos === need);
  const candidates = opponentAssets
    .filter((asset) => asset.pos === need)
    .sort((a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode));

  if (!candidates.length) return null;
  const best = candidates[0];
  const currentNeedPiece = currentIncoming
    .filter((asset) => asset.pos === need)
    .sort((a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode))[0];

  if (currentNeedPiece && getTradeWarAssetValue(currentNeedPiece, mode) >= getTradeWarAssetValue(best, mode) - 75) {
    return null;
  }

  return {
    label: currentlyBuyingNeed ? `Better ${need} target from ${otherManager}` : `Need target from ${otherManager}`,
    summary: currentlyBuyingNeed
      ? `${manager} is buying ${need}, but ${best.name} is the cleaner ${getTradeWarModeLabel(mode).toLowerCase()} fit from ${otherManager}.`
      : `${manager} still needs ${need}. ${best.name} is the best ${need} target sitting on ${otherManager}'s roster.`,
    asset: best,
  };
}

function buildTradeWarSweetenerSuggestion({
  manager,
  row,
  selectedIds,
  selectedAllIds,
  allAssets,
  gap,
  mode,
}: {
  manager: string;
  row?: OwnerIntelRow;
  selectedIds: string[];
  selectedAllIds: Set<string>;
  allAssets: TradeWarAsset[];
  gap: number;
  mode: TradeWarMode;
}) {
  const absGap = Math.abs(gap);
  if (absGap <= 250) return null;
  const surplus = row?.tradePlan?.surplusPosition;
  const candidates = allAssets
    .filter((asset) => asset.manager === manager && !selectedIds.includes(asset.player_id) && !selectedAllIds.has(asset.player_id))
    .filter((asset) => !surplus || asset.pos === surplus)
    .map((asset) => ({ asset, value: getTradeWarAssetValue(asset, mode) }))
    .filter(({ value }) => value > 0 && value <= absGap * 1.65)
    .sort((a, b) => Math.abs(absGap - a.value) - Math.abs(absGap - b.value));

  const best = candidates[0];
  if (!best) return null;
  return {
    label: `${manager} add-on`,
    summary: `${manager} can close the gap by floating ${best.asset.name} from the ${best.asset.pos} room.`,
    asset: best.asset,
  };
}

function buildTradeWarFitNotes({
  manager,
  row,
  incoming,
  outgoing,
}: {
  manager: string;
  row?: OwnerIntelRow;
  incoming: TradeWarAsset[];
  outgoing: TradeWarAsset[];
}): string[] {
  if (!row) return [`Pick ${manager}'s roster first so this can judge the construction fit.`];
  const notes: string[] = [];
  const incomingCounts = getTradeWarPositionCounts(incoming);
  const outgoingCounts = getTradeWarPositionCounts(outgoing);
  const need = row.tradePlan?.needPosition;
  const surplus = row.tradePlan?.surplusPosition;

  if (need && incomingCounts[need]) {
    notes.push(`${manager} is actually buying a need at ${need}.`);
  }
  if (surplus && outgoingCounts[surplus]) {
    notes.push(`${manager} is spending from surplus ${surplus} depth.`);
  }
  if (surplus && incomingCounts[surplus]) {
    notes.push(`Warning: this adds more ${surplus} to a room already flagged as surplus.`);
  }
  if (need && outgoingCounts[need]) {
    notes.push(`Warning: this ships out ${need}, which is the roster's cleanest need spot.`);
  }

  if (!notes.length && incoming.length) {
    notes.push(`${manager}'s roster fit is neutral. The deal is mostly about value, not construction.`);
  }
  if (!incoming.length) {
    notes.push(`${manager} has not received anything yet.`);
  }
  return notes.slice(0, 3);
}

function buildTradeWarModalData({
  asset,
  playerDetailsById,
  managerAvatars,
  value,
  mode,
}: {
  asset: TradeWarAsset;
  playerDetailsById?: PlayerDetailsById;
  managerAvatars?: ManagerAvatars;
  value: number;
  mode: TradeWarMode;
}) {
  return buildPlayerModalData({
    playerId: asset.player_id,
    playerName: asset.name,
    playerPos: asset.pos,
    value,
    playerDetails: asset.playerDetails,
    playerDetailsById,
    currentPositionRank: getTradeWarAssetRank(asset, mode),
    manager: asset.manager,
    managerAvatarUrl: managerAvatars?.[asset.manager],
    valueChangeNote: `${getTradeWarModeLabel(mode)} trade lens value.`,
  });
}

function TradeWarPlayerCard({
  asset,
  mode,
  isHighlighted,
  isSideOwner,
  managerAvatars,
  onAdd,
  onDetails,
}: {
  asset: TradeWarAsset;
  mode: TradeWarMode;
  isHighlighted: boolean;
  isSideOwner: boolean;
  managerAvatars?: ManagerAvatars;
  onAdd: () => void;
  onDetails: () => void;
}) {
  const value = getTradeWarAssetValue(asset, mode);
  const rank = getTradeWarAssetRank(asset, mode);
  const team = getTradeWarAssetTeam(asset);
  return (
    <div
      className={`player-team-tile trade-war-player-card ${isHighlighted ? '' : 'trade-war-player-muted'}`}
      style={getTeamTileStyle(team)}
    >
      <button type="button" className="trade-war-player-add" onClick={onAdd}>
        <span className="trade-war-player-name">
          <PlayerNameWithHeadshot playerId={asset.player_id} playerName={asset.name} />
        </span>
        <span className="trade-war-owner">
          <ChampionAvatarFrame managerName={asset.manager} className="trade-war-owner-avatar">
            {managerAvatars?.[asset.manager] ? (
              <img src={managerAvatars[asset.manager] || ''} alt={asset.manager} />
            ) : (
              <span>{asset.manager.trim()[0]?.toUpperCase() || '?'}</span>
            )}
          </ChampionAvatarFrame>
          <span>{asset.manager}</span>
        </span>
        <span className="trade-war-player-pills">
          <TeamLogoPill team={team} />
          <PositionRankPill rank={rank || asset.pos} />
          <span>{formatCompactValue(value)}</span>
          {!isSideOwner && <span className="trade-war-off-roster-pill">Other roster</span>}
        </span>
      </button>
      <button type="button" className="trade-war-detail-button" onClick={onDetails}>
        Card
      </button>
    </div>
  );
}

function getHeatPillClass(position: 'QB' | 'RB' | 'WR' | 'TE', grade?: string | null) {
  return `owner-intel-heat-pill owner-intel-heat-position-${position.toLowerCase()} owner-intel-heat-${String(grade || 'empty').toLowerCase()}`;
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
        <TeamLogoPill team={player.playerDetails?.team} />
        <PositionRankPill rank={player.currentPositionRank || player.seasonPositionRank || player.pos} />
        <span className={`manager-command-status-pill ${getPlayerStatusClass(player.playerDetails)}`}>
          {getPlayerStatusLabel(player.playerDetails)}
        </span>
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
  hideHeader = false,
}: {
  number: number;
  title: string;
  kicker: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
  hideNumber?: boolean;
  hideHeader?: boolean;
}) {
  return (
    <Card className={`command-feature-card ${className}`}>
      {!hideHeader && (
        <div className="command-feature-top">
          {!hideNumber && <span className="command-feature-number">{String(number).padStart(2, '0')}</span>}
          <div className="min-w-0">
            <p>{kicker}</p>
            <h3>{title}</h3>
          </div>
        </div>
      )}
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
  section = 'all',
  viewerManager,
  currentStandings,
}: {
  data: ReportData;
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
  section?: 'all' | 'roster' | 'taxi';
  viewerManager?: string | null;
  currentStandings?: ReportData['currentStandings'];
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
    }))
    .sort((a, b) => b.starterCount - a.starterCount || b.totalPlayers - a.totalPlayers || compareManagersByViewerAndStanding(a.manager, b.manager, { viewerManager, standings: currentStandings, leagueOverview: data.leagueOverview }));
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
      return bPromote - aPromote || bCut - aCut || b.taxiTriage.items.length - a.taxiTriage.items.length || compareManagersByViewerAndStanding(a.manager, b.manager, { viewerManager, standings: currentStandings, leagueOverview: data.leagueOverview });
    });
  const selectedIntel = selectedManager ? intel.find((row) => row.manager === selectedManager) : null;
  const selectedCounts = selectedManager ? data.managerPositionCounts.find((row) => row.manager === selectedManager) : null;
  const selectedTrade = selectedManager ? trades.find((row) => row.manager === selectedManager) : null;
  const selectedPick = selectedManager ? picks.find((row) => row.manager === selectedManager) : null;
  const selectedPower = selectedManager ? power.find((row) => row.manager === selectedManager) : null;
  const selectedTimeline = selectedManager ? timelines.find((row) => row.manager === selectedManager) : null;
  const selectedOverview = selectedManager ? data.leagueOverview.find((row) => row.manager === selectedManager) : null;
  const selectedGrowth = selectedManager ? data.managerRosterValueGrowth.find((row) => row.manager === selectedManager) : null;
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
    if (!selectedIntel) return [];
    const tags = buildOwnerIntelTileTags({
      identity: selectedIntel.identity,
      powerRow: selectedPower,
      timeline: selectedTimeline,
      growthRow: selectedGrowth,
      starterAvailability: selectedIntel.starterAvailability,
      holesSummary: selectedIntel.holes.summary,
      pickRow: selectedPick,
    });
    return tags.slice(0, 6);
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
      {section !== 'taxi' && (
        <FeatureCard
          number={1}
          title="Roster Depth Board"
          kicker="Starter-grade depth"
          className="command-feature-card-wide"
          hideNumber
          hideHeader={section !== 'all'}
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
      )}

      {section !== 'roster' && taxiDepth.length ? (
        <FeatureCard
          number={2}
          title="Taxi Squad Triage"
          kicker="Promote, stash, trade, cut"
          className="command-feature-card-wide"
          hideNumber
          hideHeader={section !== 'all'}
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
                <IntelligenceMetric label="Power" value={selectedPower?.score ?? '-'} />
              </div>
            </div>
            <div className="manager-command-body">
              {selectedManagerTags.length ? (
                <div className="manager-command-tag-row" aria-label="Manager profile tags">
                  {selectedManagerTags.map((tag) => (
                    <span key={tag.label} className={`manager-intel-pill command-mini-badge-${tag.tone}`}>
                      {tag.label}
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
                  <h4>Position Strength</h4>
                  <p className="owner-intel-section-note">League rank of each lineup cutoff: QB2/SF, RB2, WR3, and TE1. Lower is stronger.</p>
                  <div className="owner-intel-heat-grid">
                    {(['QB', 'RB', 'WR', 'TE'] as const).map((pos) => {
                      const grade = selectedIntel.positionGrades?.[pos];
                      return (
                        <span key={pos} className={getHeatPillClass(pos, grade?.grade)}>
                          <strong>{pos}</strong>
                          <em>{grade?.grade || 'Empty'}</em>
                          <small>{grade?.rank ? `#${grade.rank}` : '-'}</small>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {section === 'taxi' && selectedIntel?.taxiTriage?.items.length ? (
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
  viewerManager: _viewerManager,
  currentStandings: _currentStandings,
}: {
  data: ReportData;
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
  viewerManager?: string | null;
  currentStandings?: ReportData['currentStandings'];
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
  const getGrowthRow = (manager: string) => data.managerRosterValueGrowth.find((row) => row.manager === manager);
  const orderedIntelRows = sortRowsByOverviewStrength(intelRows, (row) => row.manager, {
    powerRankings: data.powerRankings,
    dynastyTimelines: data.dynastyTimelines,
    leagueOverview: data.leagueOverview,
  });
  const selectedRow = selectedOwner ? orderedIntelRows.find((row) => row.manager === selectedOwner) : null;
  const selectedCountRow = selectedRow ? getCountRow(selectedRow.manager) : null;
  const selectedTradeRow = selectedRow ? getTradeRow(selectedRow.manager) : null;
  const selectedPickRow = selectedRow ? getPickRow(selectedRow.manager) : null;
  const selectedPowerRow = selectedRow ? getPowerRow(selectedRow.manager) : null;
  const selectedTimelineRow = selectedRow ? getTimelineRow(selectedRow.manager) : null;
  const selectedOverviewRow = selectedRow ? getOverviewRow(selectedRow.manager) : null;
  const selectedGrowthRow = selectedRow ? getGrowthRow(selectedRow.manager) : null;
  const selectedStarterCount = selectedCountRow ? selectedCountRow.QB_starters + selectedCountRow.RB_starters + selectedCountRow.WR_starters + selectedCountRow.TE_starters : null;
  const selectedValueCompPlayers = selectedRow
    ? (['QB', 'RB', 'WR', 'TE'] as const)
      .map((pos) => ({
        position: pos,
        player: selectedRow.similarValuePlayers[pos],
      }))
      .filter((item): item is { position: 'QB' | 'RB' | 'WR' | 'TE'; player: ManagerIntelPlayer } => Boolean(item.player))
    : [];
  const selectedOwnerTags = selectedRow ? buildOwnerIntelTileTags({
    identity: selectedRow.identity,
    powerRow: selectedPowerRow,
    timeline: selectedTimelineRow,
    growthRow: selectedGrowthRow,
    starterAvailability: selectedRow.starterAvailability,
    holesSummary: selectedRow.holes.summary,
    pickRow: selectedPickRow,
  }) : [];
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
        {orderedIntelRows.map((row) => {
          const countRow = getCountRow(row.manager);
          const tradeRow = getTradeRow(row.manager);
          const pickRow = getPickRow(row.manager);
          const powerRow = getPowerRow(row.manager);
          const timelineRow = getTimelineRow(row.manager);
          const growthRow = getGrowthRow(row.manager);
          const starterCount = countRow ? countRow.QB_starters + countRow.RB_starters + countRow.WR_starters + countRow.TE_starters : null;
          return (
            <ManagerDepthTile
              key={row.manager}
              manager={row.manager}
              avatarUrl={managerAvatars?.[row.manager]}
              badges={[
                ...buildOwnerIntelTileTags({
                  identity: row.identity,
                  powerRow,
                  timeline: timelineRow,
                  growthRow,
                  starterAvailability: row.starterAvailability,
                  holesSummary: row.holes.summary,
                  pickRow,
                }),
              ]}
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
                  <IntelligenceMetric label="Avg Age" value={selectedRow.avgAge ?? '-'} />
                </div>
              </div>

              <div className="manager-command-body">
                <div className="owner-intel-tags">
                  {selectedOwnerTags.map((tag) => (
                    <span key={tag.label} className={`manager-intel-pill command-mini-badge-${tag.tone}`}>
                      {tag.label}
                    </span>
                  ))}
                </div>

                <div className="owner-intel-stat-grid">
                  <IntelligenceMetric label="Lineup Share" value={`${selectedRow.starterValuePct}%`} />
                  <IntelligenceMetric label="Current Value" value={selectedGrowthRow ? formatCompactValue(selectedGrowthRow.total_val) : '-'} />
                  <IntelligenceMetric label="Future Picks" value={selectedPickRow ? `${selectedPickRow.count2026 + selectedPickRow.count2027}` : '-'} />
                  <IntelligenceMetric label="Power Rank" value={selectedPowerRow ? `#${selectedPowerRow.rank}` : '-'} />
                  <IntelligenceMetric label="Win-Now" value={selectedTimelineRow?.contenderScore ?? '-'} />
                  <IntelligenceMetric label="Rebuild" value={selectedTimelineRow?.rebuildScore ?? '-'} />
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

                <div className="owner-intel-read-grid">
                  {selectedRow.positionGrades ? (
                    <div className="owner-intel-roster-heat">
                      <h4>Position Strength</h4>
                      <p className="owner-intel-section-note">League rank of each lineup cutoff: QB2/SF, RB2, WR3, and TE1. Lower is stronger.</p>
                      <div className="owner-intel-heat-grid">
                        {(['QB', 'RB', 'WR', 'TE'] as const).map((pos) => {
                          const grade = selectedRow.positionGrades?.[pos];
                          return (
                            <span key={pos} className={getHeatPillClass(pos, grade?.grade)}>
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
                    <h4>Trade / Picks</h4>
                    <p>{selectedTradeDraftProfile}</p>
                  </div>
                  <div>
                    <h4>Health Check</h4>
                    <p>{selectedHealthCheck}</p>
                  </div>
                  <div>
                    <h4>Position Baseline</h4>
                    <div className="owner-intel-attack-list">
                      <span><strong>QB</strong><PositionRankPill rank={selectedRow.holes.bestQbRank} /></span>
                      <span><strong>RB2</strong><PositionRankPill rank={selectedRow.holes.rb2Rank} /></span>
                      <span><strong>WR3</strong><PositionRankPill rank={selectedRow.holes.wr3Rank} /></span>
                      <span><strong>TE</strong><PositionRankPill rank={selectedRow.holes.te1Rank} /></span>
                      <span><strong>Flex</strong><em>{selectedRow.holes.flexDepth}</em></span>
                    </div>
                    <p>{selectedWeakSpotCopy}</p>
                  </div>
                  {selectedValueCompPlayers.length ? (
                    <div className="owner-intel-value-map">
                      <h4>Tradeable Depth</h4>
                      <p className="owner-intel-section-note">Next same-position value piece behind the starter group.</p>
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
                            <span className="owner-intel-value-pill">{formatCompactValue(player.value)}</span>
                            <PositionRankPill rank={player.currentPositionRank || player.seasonPositionRank || player.pos} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
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
        title="Team Score Profile"
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
        note={selectedRow ? `Team score blends weekly starter strength, total roster shape, positional balance, draft capital, youth, and trade efficiency. ${selectedRow.manager} is currently ${selectedRow.tier} with a ${selectedRow.score}/100 score.` : undefined}
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
                  valueChangeNote: 'Blended value change over the last 7 days.',
                }))}
              >
                <div className="weekly-momentum-tile-top">
                  <span>{isPositive ? 'Riser' : 'Faller'}</span>
                  <div
                    className="weekly-momentum-values weekly-momentum-values-top"
                    aria-label={`Value moved from ${formatCompactValue(row.val_last)} to ${formatCompactValue(row.val_now)}`}
                  >
                    <span>{formatCompactValue(row.val_last)}</span>
                    <span className="weekly-momentum-value-arrow" aria-hidden="true">→</span>
                    <span>{formatCompactValue(row.val_now)}</span>
                  </div>
                  <strong className={isPositive ? 'text-emerald-300' : 'text-rose-300'}>
                    {row.pct_change >= 0 ? '+' : ''}
                    {row.pct_change.toFixed(1)}%
                  </strong>
                </div>
                <div className="weekly-momentum-identity">
                  <div className="weekly-momentum-player">
                    <PlayerNameWithHeadshot playerId={row.player_id} playerName={row.name} />
                  </div>
                  <div className="weekly-momentum-manager">
                    {renderManagerName(row.owner, managerAvatars)}
                  </div>
                </div>
                <div className="weekly-momentum-pills">
                  <TeamLogoPill team={playerDetails?.team} />
                  <PositionRankPill rank={row.currentPositionRank || row.pos} />
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
                <div className="trending-player-card-identity">
                  <div className="trending-player-card-main">
                    <PlayerNameWithHeadshot playerId={row.player_id} playerName={row.name} />
                  </div>
                  <div className="trending-player-card-owner">
                    {row.owner ? renderManagerName(row.owner, managerAvatars) : (
                      <span className="available-manager-label">Available</span>
                    )}
                  </div>
                </div>
                <div className="trending-player-card-pills">
                  <TeamLogoPill team={playerDetails?.team || row.team} />
                  <PositionRankPill rank={row.currentPositionRank || row.pos} />
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
              <div className="player-tile-identity">
                <div className="player-tile-main">
                  <PlayerNameWithHeadshot playerId={row.player_id} playerName={row.name} />
                </div>
                <div className="player-tile-owner">
                  {renderManagerName(row.owner, managerAvatars)}
                </div>
              </div>
              <div className="player-tile-pills">
                <TeamLogoPill team={details?.team} />
                <PositionRankPill rank={row.currentPositionRank || row.pos} />
                <span>{row.age !== null ? `${row.age} yrs` : 'Age N/A'}</span>
              </div>
              <div className="player-tile-value-strip">
                <span>{formatCompactValue(row.val_2026)}</span>
                <span aria-hidden="true">→</span>
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

export function TradeWarRoom({
  data,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
  leagueOverview,
  powerRankings,
  dynastyTimelines,
  viewerManager,
  currentStandings,
}: {
  data?: ReportData['managerRosterIntelligence'];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
  leagueOverview?: ReportData['leagueOverview'];
  powerRankings?: ReportData['powerRankings'];
  dynastyTimelines?: ReportData['dynastyTimelines'];
  viewerManager?: string | null;
  currentStandings?: ReportData['currentStandings'];
}) {
  const managers = React.useMemo(
    () => sortRowsByViewerAndStanding(data || [], (row) => row.manager, {
      viewerManager,
      standings: currentStandings,
      leagueOverview,
    }).map((row) => row.manager),
    [currentStandings, data, leagueOverview, viewerManager]
  );
  const managerRows = React.useMemo(() => new Map((data || []).map((row) => [row.manager, row])), [data]);
  const [mode, setMode] = useState<TradeWarMode>('dynasty');
  const [managerAState, setManagerAState] = useState('');
  const [managerBState, setManagerBState] = useState('');
  const managerA = managerAState || managers[0] || '';
  const managerB = managerBState || managers.find((manager) => manager !== managerA) || managers[0] || '';
  const [sideAIds, setSideAIds] = useState<string[]>([]);
  const [sideBIds, setSideBIds] = useState<string[]>([]);
  const [queryA, setQueryA] = useState('');
  const [queryB, setQueryB] = useState('');
  const [mobilePickerOpen, setMobilePickerOpen] = useState<{ A: boolean; B: boolean }>({ A: false, B: false });
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);

  const allAssets = React.useMemo(() => {
    const mapped = new Map<string, TradeWarAsset>();
    (data || []).forEach((row) => {
      const addPlayers = (players: ManagerIntelPlayer[] | undefined, assetState: TradeWarAsset['assetState']) => {
        (players || []).forEach((player) => {
          if (!player?.player_id || mapped.has(player.player_id)) return;
          mapped.set(player.player_id, {
            ...player,
            manager: player.owner || row.manager,
            assetState,
          });
        });
      };
      addPlayers(row.rosterPlayers, 'roster');
      addPlayers(row.benchPlayers, 'bench');
      addPlayers(row.reservePlayers, 'reserve');
      addPlayers(row.taxiPlayers, 'taxi');
    });
    return Array.from(mapped.values()).sort((a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode));
  }, [data, mode]);

  const assetById = React.useMemo(() => new Map(allAssets.map((asset) => [asset.player_id, asset])), [allAssets]);
  const selectedAllIds = React.useMemo(() => new Set([...sideAIds, ...sideBIds]), [sideAIds, sideBIds]);
  const sideAAssets = sideAIds.map((id) => assetById.get(id)).filter((asset): asset is TradeWarAsset => Boolean(asset));
  const sideBAssets = sideBIds.map((id) => assetById.get(id)).filter((asset): asset is TradeWarAsset => Boolean(asset));
  const sideATotal = sideAAssets.reduce((sum, asset) => sum + getTradeWarAssetValue(asset, mode), 0);
  const sideBTotal = sideBAssets.reduce((sum, asset) => sum + getTradeWarAssetValue(asset, mode), 0);
  const valueGap = sideBTotal - sideATotal;
  const gapRead = getTradeWarGapLabel(valueGap);
  const managerARow = managerRows.get(managerA);
  const managerBRow = managerRows.get(managerB);
  const assetsByManager = React.useMemo(() => {
    const grouped = new Map<string, TradeWarAsset[]>();
    allAssets.forEach((asset) => {
      const existing = grouped.get(asset.manager) || [];
      existing.push(asset);
      grouped.set(asset.manager, existing);
    });
    return grouped;
  }, [allAssets]);

  const baselineMetricsByManager = React.useMemo(() => {
    const mapped = new Map<string, TradeWarRosterMetrics>();
    assetsByManager.forEach((assets, manager) => {
      mapped.set(manager, buildTradeWarMetrics(assets, mode));
    });
    return mapped;
  }, [assetsByManager, mode]);

  const simulatedAssetsByManager = React.useMemo(() => {
    const next = new Map<string, TradeWarAsset[]>();
    assetsByManager.forEach((assets, manager) => {
      next.set(manager, [...assets]);
    });

    const applySwap = (manager: string, outgoingIds: string[], incomingAssets: TradeWarAsset[]) => {
      const current = next.get(manager) || [];
      const filtered = current.filter((asset) => !outgoingIds.includes(asset.player_id));
      next.set(manager, [...filtered, ...incomingAssets]);
    };

    applySwap(managerA, sideAIds, sideBAssets);
    applySwap(managerB, sideBIds, sideAAssets);
    return next;
  }, [assetsByManager, managerA, managerB, sideAAssets, sideAIds, sideBAssets, sideBIds]);

  const simulatedMetricsByManager = React.useMemo(() => {
    const mapped = new Map<string, TradeWarRosterMetrics>();
    simulatedAssetsByManager.forEach((assets, manager) => {
      mapped.set(manager, buildTradeWarMetrics(assets, mode));
    });
    return mapped;
  }, [simulatedAssetsByManager, mode]);

  const baselineRankMaps = React.useMemo(() => buildTradeWarRankMaps(baselineMetricsByManager), [baselineMetricsByManager]);
  const simulatedRankMaps = React.useMemo(() => buildTradeWarRankMaps(simulatedMetricsByManager), [simulatedMetricsByManager]);

  const beforeA = buildTradeWarSnapshot({
    manager: managerA,
    row: managerARow,
    metricsByManager: baselineMetricsByManager,
    rankMaps: baselineRankMaps,
    assets: assetsByManager.get(managerA) || [],
  });
  const afterA = buildTradeWarSnapshot({
    manager: managerA,
    row: managerARow,
    metricsByManager: simulatedMetricsByManager,
    rankMaps: simulatedRankMaps,
    assets: simulatedAssetsByManager.get(managerA) || [],
  });
  const beforeB = buildTradeWarSnapshot({
    manager: managerB,
    row: managerBRow,
    metricsByManager: baselineMetricsByManager,
    rankMaps: baselineRankMaps,
    assets: assetsByManager.get(managerB) || [],
  });
  const afterB = buildTradeWarSnapshot({
    manager: managerB,
    row: managerBRow,
    metricsByManager: simulatedMetricsByManager,
    rankMaps: simulatedRankMaps,
    assets: simulatedAssetsByManager.get(managerB) || [],
  });

  const managerAFitNotes = buildTradeWarSimulationNotes({
    manager: managerA,
    before: beforeA,
    after: afterA,
    mode,
  });
  const managerBFitNotes = buildTradeWarSimulationNotes({
    manager: managerB,
    before: beforeB,
    after: afterB,
    mode,
  });

  const managerATarget = buildTradeWarTargetSuggestion({
    manager: managerA,
    otherManager: managerB,
    row: managerARow,
    currentIncoming: sideBAssets,
    opponentAssets: assetsByManager.get(managerB) || [],
    mode,
  });
  const managerBTarget = buildTradeWarTargetSuggestion({
    manager: managerB,
    otherManager: managerA,
    row: managerBRow,
    currentIncoming: sideAAssets,
    opponentAssets: assetsByManager.get(managerA) || [],
    mode,
  });

  const getSearchResults = (query: string, sideManager: string) => {
    const normalized = query.trim().toLowerCase();
    return allAssets
      .filter((asset) => !selectedAllIds.has(asset.player_id))
      .filter((asset) => !normalized || asset.name.toLowerCase().includes(normalized))
      .sort((a, b) => {
        const ownedDelta = Number(b.manager === sideManager) - Number(a.manager === sideManager);
        if (ownedDelta) return ownedDelta;
        return getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode);
      })
      .slice(0, normalized ? 12 : 8);
  };

  const addOnSuggestion = buildTradeWarSweetenerSuggestion({
    manager: valueGap > 0 ? managerA : managerB,
    row: valueGap > 0 ? managerARow : managerBRow,
    selectedIds: valueGap > 0 ? sideAIds : sideBIds,
    selectedAllIds,
    allAssets,
    gap: valueGap,
    mode,
  });

  const leagueOverviewByManager = React.useMemo(() => new Map((leagueOverview || []).map((row) => [row.manager, row])), [leagueOverview]);
  const powerByManager = React.useMemo(() => new Map((powerRankings || []).map((row) => [row.manager, row])), [powerRankings]);
  const timelineByManager = React.useMemo(() => new Map((dynastyTimelines || []).map((row) => [row.manager, row])), [dynastyTimelines]);

  const renderSuggestedAsset = (suggestion: { label: string; summary: string; asset: TradeWarAsset } | null) => {
    if (!suggestion) return null;
    const team = getTradeWarAssetTeam(suggestion.asset);
    return (
      <div className="trade-war-suggestion-block">
        <span>{suggestion.label}</span>
        <p>{suggestion.summary}</p>
        <button
          type="button"
          className="player-team-tile trade-war-suggested-asset"
          style={getTeamTileStyle(team)}
          onClick={() => openAssetModal(suggestion.asset)}
        >
          <div className="trade-war-suggested-main">
            <PlayerNameWithHeadshot playerId={suggestion.asset.player_id} playerName={suggestion.asset.name} />
            <span className="trade-war-player-pills">
              <TeamLogoPill team={team} />
              <PositionRankPill rank={getTradeWarAssetRank(suggestion.asset, mode) || suggestion.asset.pos} />
              <span>{formatCompactValue(getTradeWarAssetValue(suggestion.asset, mode))}</span>
            </span>
          </div>
        </button>
      </div>
    );
  };

  const renderRankPanel = (
    manager: string,
    before: TradeWarRosterSnapshot,
    after: TradeWarRosterSnapshot,
  ) => {
    const powerRow = powerByManager.get(manager);
    const timelineRow = timelineByManager.get(manager);
    const overviewRow = leagueOverviewByManager.get(manager);
    return (
      <div className="trade-war-note-panel">
        <span>{manager} Before / After</span>
        <div className="trade-war-rank-pills">
          <span>{formatTradeWarRankShift('QB', before.ranks.QB, after.ranks.QB)}</span>
          <span>{formatTradeWarRankShift('RB', before.ranks.RB, after.ranks.RB)}</span>
          <span>{formatTradeWarRankShift('WR', before.ranks.WR, after.ranks.WR)}</span>
          <span>{formatTradeWarRankShift('TE', before.ranks.TE, after.ranks.TE)}</span>
          <span>{formatTradeWarRankShift('Value', before.ranks.Value, after.ranks.Value)}</span>
          <span>{formatTradeWarRankShift('Power', before.ranks.Power, after.ranks.Power)}</span>
          <span>{formatTradeWarRankShift('Contender', before.ranks.Contender, after.ranks.Contender)}</span>
          <span>{formatTradeWarRankShift('Rebuild', before.ranks.Rebuild, after.ranks.Rebuild)}</span>
        </div>
        <p>
          {getTradeWarModeLabel(mode)} lens focuses on {getTradeWarModeRankLabel(mode).toLowerCase()} value. 
          {overviewRow ? ` Current overview ranks were QB #${overviewRow.rank_qb}, RB #${overviewRow.rank_rb}, WR #${overviewRow.rank_wr}, TE #${overviewRow.rank_te}, Value #${overviewRow.rank_value}.` : ''}
          {powerRow ? ` Stored power score ${powerRow.score}.` : ''}
          {timelineRow ? ` Stored timeline reads contender ${timelineRow.contenderScore}, rebuild ${timelineRow.rebuildScore}.` : ''}
        </p>
      </div>
    );
  };

  const openAssetModal = (asset: TradeWarAsset) => {
    setSelectedPlayer(buildTradeWarModalData({
      asset,
      playerDetailsById,
      managerAvatars,
      value: getTradeWarAssetValue(asset, mode),
      mode,
    }));
  };

  const renderSelectedAssets = (
    assets: TradeWarAsset[],
    removeAsset: (playerId: string) => void,
    emptyText: string
  ) => {
    if (!assets.length) {
      return <div className="trade-war-empty">{emptyText}</div>;
    }

    return (
      <div className="trade-war-selected-assets">
        {assets.map((asset) => {
          const team = getTradeWarAssetTeam(asset);
          const value = getTradeWarAssetValue(asset, mode);
          return (
            <div key={asset.player_id} className="player-team-tile trade-war-selected-asset" style={getTeamTileStyle(team)}>
              <button type="button" className="trade-war-selected-main" onClick={() => openAssetModal(asset)}>
                <PlayerNameWithHeadshot playerId={asset.player_id} playerName={asset.name} />
                <span className="trade-war-player-pills">
                  <TeamLogoPill team={team} />
                  <PositionRankPill rank={getTradeWarAssetRank(asset, mode) || asset.pos} />
                  <span>{formatCompactValue(value)}</span>
                </span>
              </button>
              <button
                type="button"
                className="trade-war-remove"
                aria-label={`Remove ${asset.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  removeAsset(asset.player_id);
                }}
              >
                <XIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTradeSide = ({
    label,
    sideKey,
    manager,
    otherManager,
    query,
    setQuery,
    assets,
    setAssets,
    total,
  }: {
    label: string;
    sideKey: 'A' | 'B';
    manager: string;
    otherManager: string;
    query: string;
    setQuery: (value: string) => void;
    assets: TradeWarAsset[];
    setAssets: React.Dispatch<React.SetStateAction<string[]>>;
    total: number;
  }) => {
    const results = getSearchResults(query, manager);
    const highlightedManagers = new Set([manager, ...assets.map((asset) => asset.manager)]);
    const isPickerOpen = mobilePickerOpen[sideKey];

    return (
      <div className="trade-war-side">
        <div className="trade-war-side-header">
          <div className="trade-war-manager-lockup">
            <ChampionAvatarFrame managerName={manager} className="trade-war-manager-avatar">
              {managerAvatars?.[manager] ? (
                <img src={managerAvatars[manager] || ''} alt={manager} />
              ) : (
                <span>{manager.trim()[0]?.toUpperCase() || '?'}</span>
              )}
            </ChampionAvatarFrame>
            <div>
              <span>{label}</span>
              <strong>{manager}</strong>
            </div>
          </div>
          <div className="trade-war-side-total">
            <span>Sends</span>
            <strong>{total.toLocaleString()}</strong>
          </div>
        </div>

        {renderSelectedAssets(
          assets,
          (playerId) => setAssets((current) => current.filter((id) => id !== playerId)),
          `${manager} has not added assets yet.`
        )}

        <div className={`trade-war-picker ${isPickerOpen ? 'trade-war-picker-open' : ''}`}>
          <button
            type="button"
            className="trade-war-picker-toggle"
            onClick={() => setMobilePickerOpen((current) => ({ ...current, [sideKey]: !current[sideKey] }))}
            aria-expanded={isPickerOpen}
          >
            <span>Add / Browse Players</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isPickerOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>

          <div className="trade-war-picker-body">
            <label className="trade-war-search">
              <span>Add player</span>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${manager}, ${otherManager}, or anyone`}
              />
            </label>

            <div className="trade-war-player-grid">
              {results.map((asset) => (
                <TradeWarPlayerCard
                  key={asset.player_id}
                  asset={asset}
                  mode={mode}
                  managerAvatars={managerAvatars}
                  isHighlighted={highlightedManagers.has(asset.manager)}
                  isSideOwner={asset.manager === manager}
                  onAdd={() => setAssets((current) => current.includes(asset.player_id) ? current : [...current, asset.player_id])}
                  onDetails={() => openAssetModal(asset)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!data?.length) return null;

  return (
    <div className="trade-war-room">
      <div className="trade-war-top">
        <div className="trade-war-mode-tabs" role="tablist" aria-label="Trade value lens">
          {(['dynasty', 'contender', 'rebuilder'] as TradeWarMode[]).map((option) => (
            <button
              key={option}
              type="button"
              className={mode === option ? 'active' : ''}
              onClick={() => setMode(option)}
            >
              {getTradeWarModeLabel(option)}
            </button>
          ))}
        </div>
      </div>

      <div className="trade-war-manager-selects">
        <label>
          <span>Side A</span>
          <select
            value={managerA}
            onChange={(event) => {
              const nextManager = event.target.value;
              setManagerAState(nextManager);
              if (nextManager === managerB) {
                setManagerBState(managers.find((manager) => manager !== nextManager) || nextManager);
              }
            }}
          >
            {managers.map((manager) => (
              <option key={manager} value={manager}>{manager}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Side B</span>
          <select
            value={managerB}
            onChange={(event) => {
              const nextManager = event.target.value;
              setManagerBState(nextManager);
              if (nextManager === managerA) {
                setManagerAState(managers.find((manager) => manager !== nextManager) || nextManager);
              }
            }}
          >
            {managers.map((manager) => (
              <option key={manager} value={manager}>{manager}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="trade-war-scoreboard">
        <div>
          <span>{managerA} sends</span>
          <strong>{sideATotal.toLocaleString()}</strong>
        </div>
        <div className={`trade-war-gap ${gapRead.className}`}>
          <span>{gapRead.label}</span>
          <strong>{Math.abs(valueGap).toLocaleString()}</strong>
          <small>{valueGap === 0 ? 'No value gap' : valueGap > 0 ? `${managerA} receives more` : `${managerB} receives more`}</small>
        </div>
        <div>
          <span>{managerB} sends</span>
          <strong>{sideBTotal.toLocaleString()}</strong>
        </div>
      </div>

      <div className="trade-war-side-grid">
        {renderTradeSide({
          label: 'Side A',
          sideKey: 'A',
          manager: managerA,
          otherManager: managerB,
          query: queryA,
          setQuery: setQueryA,
          assets: sideAAssets,
          setAssets: setSideAIds,
          total: sideATotal,
        })}
        {renderTradeSide({
          label: 'Side B',
          sideKey: 'B',
          manager: managerB,
          otherManager: managerA,
          query: queryB,
          setQuery: setQueryB,
          assets: sideBAssets,
          setAssets: setSideBIds,
          total: sideBTotal,
        })}
      </div>

      <div className="trade-war-read-grid">
        {renderRankPanel(managerA, beforeA, afterA)}
        {renderRankPanel(managerB, beforeB, afterB)}
        <div className="trade-war-note-panel">
          <span>Roster Fit</span>
          {[...managerAFitNotes, ...managerBFitNotes].map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
        <div className="trade-war-note-panel trade-war-suggestions">
          <span>Make It Work</span>
          {renderSuggestedAsset(managerATarget)}
          {renderSuggestedAsset(managerBTarget)}
          {renderSuggestedAsset(addOnSuggestion)}
          {!managerATarget && !managerBTarget && !addOnSuggestion && (
            <p>This is already inside a normal negotiation window. Use fit, not just exact math, to decide.</p>
          )}
        </div>
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
  tradeTendencies,
  managerRosterIntelligence,
  dynastyTimelines,
  leagueOverview,
  leagueId,
  leagueLogo,
  viewerManager,
  currentStandings,
}: {
  data: ReportData['tradeProfitLeaderboard'];
  managerAvatars?: ManagerAvatars;
  tradeHistory?: ReportData['tradeHistory'];
  draftPicks?: DraftPick[];
  playerDetailsById?: PlayerDetailsById;
  currentPositionRankById?: CurrentPositionRankById;
  tradeTendencies?: ReportData['tradeTendencies'];
  managerRosterIntelligence?: ReportData['managerRosterIntelligence'];
  dynastyTimelines?: DynastyTimelineRows;
  leagueOverview?: LeagueOverviewRows;
  leagueId?: string;
  leagueLogo?: string | null;
  viewerManager?: string | null;
  currentStandings?: ReportData['currentStandings'];
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
  const selectedManagerTendency = selectedManager
    ? tradeTendencies?.find((row) => row.manager === selectedManager)
    : undefined;

  const orderedRows = React.useMemo(
    () => sortRowsByViewerAndStanding(data, (row) => row.manager, {
      viewerManager,
      standings: currentStandings,
      leagueOverview,
    }),
    [currentStandings, data, leagueOverview, viewerManager]
  );

  return (
    <div className="owner-tile-shell">
      <div className="owner-tile-grid trade-profit-tile-grid">
                {orderedRows.map((row) => {
          const winPct = row.trade_count > 0 ? Math.round((row.wins / row.trade_count) * 100) : 0;
          const tendency = tradeTendencies?.find((item) => item.manager === row.manager);
          const habit = tendency ? getTradeHabit(tendency) : null;

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
              {habit && <span className={`trade-habit-pill ${habit.className}`}>{habit.label}</span>}
              {tendency?.favoritePartner && (
                <OwnerMetricPill
                  label="Likes Trading With"
                  value={renderPartnerName(tendency.favoritePartner, managerAvatars)}
                  tone="info"
                />
              )}
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
                {selectedManagerTendency && (
                  <>
                    <div>
                      <span>Avg Gap</span>
                      <strong>{selectedManagerTendency.avgGap.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>Win %</span>
                      <strong>{selectedManagerTendency.winPct}%</strong>
                    </div>
                    <div>
                      <span>Partner</span>
                      <strong>{selectedManagerTendency.favoritePartner || '-'}</strong>
                    </div>
                  </>
                )}
              </div>
              {selectedManagerTendency && (
                <div className="trade-manager-tendency-strip">
                  <span className={`trade-habit-pill ${getTradeHabit(selectedManagerTendency).className}`}>
                    {getTradeHabit(selectedManagerTendency).label}
                  </span>
                  {selectedManagerTendency.overpaysForPicks && <span className="trade-habit-pill trade-habit-warn">Pays For Picks</span>}
                  {selectedManagerTendency.overpaysForVeterans && <span className="trade-habit-pill trade-habit-warn">Vet Shopper</span>}
                  {selectedManagerTendency.favoritePartner && (
                    <span className="trade-habit-pill trade-habit-info">
                      Likes {selectedManagerTendency.favoritePartner}
                    </span>
                  )}
                </div>
              )}
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
                            managerRosterIntelligence={managerRosterIntelligence}
                            dynastyTimelines={dynastyTimelines}
                            leagueOverview={leagueOverview}
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
  managerRosterIntelligence,
  dynastyTimelines,
  leagueOverview,
  leagueId,
  leagueLogo,
  viewerManager: _viewerManager,
  currentStandings: _currentStandings,
}: {
  data: ReportData['tradeHistory'];
  draftPicks?: DraftPick[];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  currentPositionRankById?: CurrentPositionRankById;
  managerRosterIntelligence?: ReportData['managerRosterIntelligence'];
  dynastyTimelines?: DynastyTimelineRows;
  leagueOverview?: LeagueOverviewRows;
  leagueId?: string;
  leagueLogo?: string | null;
  viewerManager?: string | null;
  currentStandings?: ReportData['currentStandings'];
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
              const tradeEvaluation = buildTradeLedgerEvaluation(row, dynastyTimelines, managerRosterIntelligence, playerDetailsById);
              const { winners, loserName } = getTradeDisplaySides(row, tradeEvaluation);
              const tradeKey = `${row.date}-${row.team_a}-${row.team_b}-${idx}`;
              const shouldSwapSummary = stableTradeSeed(tradeKey) % 2 === 1;
              const summaryManagers = shouldSwapSummary
                ? [row.team_b, row.team_a]
                : [row.team_a, row.team_b];
              const gapVerdict = getTradeGapVerdict(tradeEvaluation.pointGap);
              const tradeLensNote = getTradeLensSourceNote(row);

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
                        {tradeLensNote ? (
                          <span
                            className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200 md:inline-flex"
                            title={tradeLensNote}
                          >
                            Trade-Date Lens
                          </span>
                        ) : null}
                      </div>
                      <div className="trade-mobile-summary">
                        {renderTradeSummaryManager(summaryManagers[0], winners.includes(summaryManagers[0]), managerAvatars)}
                        <span className="trade-mobile-vs">vs</span>
                        {renderTradeSummaryManager(summaryManagers[1], winners.includes(summaryManagers[1]), managerAvatars)}
                      </div>
                    </TableCell>
                    <TableCell className="trade-ledger-manager-cell font-semibold text-sm text-orange-300">
                      {winners.map((winner) => (
                        <span key={winner}>
                          {renderTradeLedgerManagerName(
                            winner,
                            managerAvatars,
                            getTradeSideEvaluation(winner, tradeEvaluation).lens,
                          )}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell className="trade-ledger-manager-cell font-semibold text-sm text-cyan-300">
                      {loserName === 'Both Win'
                        ? renderManagerName(loserName, managerAvatars)
                        : renderTradeLedgerManagerName(
                            loserName,
                            managerAvatars,
                            getTradeSideEvaluation(loserName, tradeEvaluation).lens,
                          )}
                    </TableCell>
                    <TableCell className="trade-gap-cell text-center text-slate-300">
                      <span className={`trade-gap-verdict ${gapVerdict.className}`}>
                        {gapVerdict.label}
                      </span>
                      <span className="value-pill">{tradeEvaluation.pointGap.toLocaleString()}</span>
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
                          managerRosterIntelligence={managerRosterIntelligence}
                          dynastyTimelines={dynastyTimelines}
                          leagueOverview={leagueOverview}
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
  managerRosterIntelligence,
  dynastyTimelines,
  leagueOverview,
  leagueId,
  leagueLogo,
}: {
  data: ReportData['tradeHistory'];
  managerAvatars?: ManagerAvatars;
  draftPicks?: DraftPick[];
  playerDetailsById?: PlayerDetailsById;
  currentPositionRankById?: CurrentPositionRankById;
  managerRosterIntelligence?: ReportData['managerRosterIntelligence'];
  dynastyTimelines?: DynastyTimelineRows;
  leagueOverview?: LeagueOverviewRows;
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
              managerRosterIntelligence={managerRosterIntelligence}
              dynastyTimelines={dynastyTimelines}
              leagueOverview={leagueOverview}
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
    ...data.bestTaxiStashes.map((player, index) => ({ label: `Taxi Stash ${index + 1}`, player })),
  ].filter((card) => card.player);

  return (
    <div className="player-tile-grid waiver-intel-grid">
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
            <TeamLogoPill team={player?.playerDetails?.team || player?.team} />
            <PositionRankPill rank={player?.currentPositionRank || player?.pos || '-'} />
            {label.startsWith('Taxi Stash') && <span>Rookie Stash</span>}
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

export function RecentTransactionsPanel({
  data,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
}: {
  data?: ReportData['recentTransactions'];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);
  const [transactionSort, setTransactionSort] = useState<RecentTransactionSort>('add');
  const transactionGroups = useMemo(() => buildRecentTransactionGroups(data || [], transactionSort), [data, transactionSort]);
  if (!data?.length) return null;

  const openTransactionPlayer = (player: NonNullable<ReportData['recentTransactions']>[number]['addedPlayer']) => {
    if (!player) return;
    setSelectedPlayer(buildPlayerModalData({
      playerId: player.player_id,
      playerName: player.name,
      playerPos: player.pos,
      value: player.ktcValue,
      playerDetails: player.playerDetails,
      playerDetailsById,
      currentPositionRank: player.currentPositionRank,
    }));
  };

  const renderPlayerRow = (
    label: string,
    player: NonNullable<ReportData['recentTransactions']>[number]['addedPlayer'],
    tone: 'add' | 'drop' | 'alt' = 'add',
  ) => {
    if (!player) return null;
    return (
      <button
        type="button"
        className={`player-team-tile recent-transaction-player recent-transaction-player-${tone}`}
        style={getTeamTileStyle(player.playerDetails?.team || player.team)}
        onClick={() => openTransactionPlayer(player)}
      >
        <div className="recent-transaction-player-head">
          <span className={`recent-transaction-player-label recent-transaction-player-label-${tone}`}>
            {label}
          </span>
        </div>
        <div className="recent-transaction-player-main">
          <PlayerNameWithHeadshot playerId={player.player_id} playerName={player.name} />
        </div>
        <div className="recent-transaction-player-pills">
          <TeamLogoPill team={player.playerDetails?.team || player.team} />
          <PositionRankPill rank={player.currentPositionRank || player.pos} />
          <span>{formatCompactValue(player.ktcValue)}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="recent-transaction-date-list">
      {transactionGroups.map((group) => {
        const isExpanded = expandedDateKey === group.dateKey;
        return (
          <div key={group.dateKey} className={`recent-transaction-date-group ${isExpanded ? 'is-open' : ''}`}>
            <div className="recent-transaction-date-header">
              <button
                type="button"
                className="recent-transaction-date-toggle"
                onClick={() => setExpandedDateKey(isExpanded ? null : group.dateKey)}
                aria-expanded={isExpanded}
              >
                <span className="recent-transaction-date-label">
                  <ChevronDown className={`h-4 w-4 text-orange-300 transition-transform ${isExpanded ? 'rotate-180' : '-rotate-90'}`} />
                  <span>{group.displayDate}</span>
                </span>
              </button>
              <span className="recent-transaction-day-pills">
                <button
                  type="button"
                  className={`recent-transaction-day-pill recent-transaction-day-pill-add ${transactionSort === 'add' ? 'is-active' : ''}`}
                  onClick={() => {
                    setTransactionSort('add');
                    setExpandedDateKey(group.dateKey);
                  }}
                  aria-pressed={transactionSort === 'add'}
                >
                  Adds {group.addCount}
                </button>
                <button
                  type="button"
                  className={`recent-transaction-day-pill recent-transaction-day-pill-drop ${transactionSort === 'drop' ? 'is-active' : ''}`}
                  onClick={() => {
                    setTransactionSort('drop');
                    setExpandedDateKey(group.dateKey);
                  }}
                  aria-pressed={transactionSort === 'drop'}
                >
                  Drops {group.dropCount}
                </button>
              </span>
            </div>

            {isExpanded && (
              <div className="recent-transaction-day-panel">
                {group.transactions.map((transaction) => (
                  <div key={transaction.id} className="report-card recent-transaction-card">
                    <div className="recent-transaction-top">
                      <div className="recent-transaction-manager">
                        <ManagerNameWithAvatar avatarUrl={managerAvatars?.[transaction.manager]} managerName={transaction.manager} />
                      </div>
                      <div className="recent-transaction-meta">
                        <span className={`recent-transaction-type-pill ${transaction.type === 'Free Agent' ? 'recent-transaction-type-fa' : 'recent-transaction-type-waiver'}`}>
                          {transaction.type === 'Free Agent' ? 'FA' : 'Waiver'}
                        </span>
                        {transaction.bidAmount !== null && <strong>${transaction.bidAmount}</strong>}
                      </div>
                    </div>
                    <div className="recent-transaction-player-grid">
                      {renderPlayerRow('Added', transaction.addedPlayer, 'add')}
                      {renderPlayerRow('Dropped', transaction.droppedPlayer, 'drop')}
                      {renderPlayerRow('Better Cut', transaction.alternativeDrop, 'alt')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
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

type RecentTransactionRow = NonNullable<ReportData['recentTransactions']>[number];
type RecentTransactionSort = 'add' | 'drop';

function buildRecentTransactionGroups(data: RecentTransactionRow[], sortMode: RecentTransactionSort) {
  const groups = new Map<string, {
    dateKey: string;
    displayDate: string;
    transactions: RecentTransactionRow[];
    addCount: number;
    dropCount: number;
  }>();

  for (const transaction of data) {
    const dateKey = getRecentTransactionDateKey(transaction.date);
    const group = groups.get(dateKey) || {
      dateKey,
      displayDate: dateKey,
      transactions: [],
      addCount: 0,
      dropCount: 0,
    };

    group.transactions.push(transaction);
    if (transaction.addedPlayer) group.addCount += 1;
    if (transaction.droppedPlayer) group.dropCount += 1;
    groups.set(dateKey, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      transactions: [...group.transactions].sort((a, b) => compareRecentTransactions(a, b, sortMode)),
    }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

function compareRecentTransactions(a: RecentTransactionRow, b: RecentTransactionRow, sortMode: RecentTransactionSort) {
  const primaryDiff = getRecentTransactionSortValue(b, sortMode) - getRecentTransactionSortValue(a, sortMode);
  if (primaryDiff !== 0) return primaryDiff;

  const secondaryMode: RecentTransactionSort = sortMode === 'add' ? 'drop' : 'add';
  const secondaryDiff = getRecentTransactionSortValue(b, secondaryMode) - getRecentTransactionSortValue(a, secondaryMode);
  if (secondaryDiff !== 0) return secondaryDiff;

  return String(b.id).localeCompare(String(a.id));
}

function getRecentTransactionSortValue(transaction: RecentTransactionRow, sortMode: RecentTransactionSort) {
  const player = sortMode === 'add' ? transaction.addedPlayer : transaction.droppedPlayer;
  return player?.ktcValue ?? -1;
}

function getRecentTransactionDateKey(date: string): string {
  const rawDate = String(date || '').trim();
  const dateMatch = rawDate.match(/^\d{4}-\d{2}-\d{2}/);
  if (dateMatch) return dateMatch[0];

  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return rawDate || 'Unknown Date';
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
            <div className="trade-market-player">
              <PlayerNameWithHeadshot playerId={player.player_id} playerName={player.name} />
            </div>
            <div className="trade-market-manager">
              {renderManagerName(player.owner, managerAvatars)}
            </div>
          </div>
          <div className="trade-market-pills">
            <TeamLogoPill team={player.playerDetails?.team} />
            <PositionRankPill rank={player.currentPositionRank || player.pos} />
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

type PositionDepthSignal = ReportData['positionDepth'][number];

const POSITION_DEPTH_ORDER: Record<string, number> = {
  QB: 0,
  RB: 1,
  WR: 2,
  TE: 3,
};

function sortPositionDepthSignals(a: PositionDepthSignal, b: PositionDepthSignal) {
  const statusOrder = (signal: PositionDepthSignal) => (signal.status === 'shortage' ? 0 : 1);
  return (
    statusOrder(a) - statusOrder(b) ||
    (POSITION_DEPTH_ORDER[a.position] ?? 99) - (POSITION_DEPTH_ORDER[b.position] ?? 99)
  );
}

function getPositionDepthSignalLabel(status: PositionDepthSignal['status']) {
  return status === 'shortage' ? 'Shortage' : 'Excess';
}

function getPositionDepthNeedLabel(status: PositionDepthSignal['status']) {
  return status === 'shortage' ? 'Need' : 'Extra';
}

function getPositionDepthRead(signal: PositionDepthSignal) {
  return `${signal.manager} is flagged for ${signal.status === 'shortage' ? 'the league-low count' : 'the league-high count'} at ${signal.position}. This compares the full roster counts for that position across the league.`;
}


export function ManagerPositionCountsTable({
  data,
  positionDepth = [],
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
}: {
  data: ReportData['managerPositionCounts'];
  positionDepth?: ReportData['positionDepth'];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedManager, setSelectedManager] = useState<ReportData['managerPositionCounts'][number] | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const selectedAvatar = selectedManager ? managerAvatars?.[selectedManager.manager] : null;
  const selectedStarters = selectedManager?.starterPlayers || [];
  const positionDepthByManager = useMemo(() => {
    const signalsByManager = new Map<string, PositionDepthSignal[]>();

    positionDepth.forEach((signal) => {
      const managerSignals = signalsByManager.get(signal.manager) || [];
      managerSignals.push(signal);
      signalsByManager.set(signal.manager, managerSignals);
    });

    signalsByManager.forEach((signals) => signals.sort(sortPositionDepthSignals));
    return signalsByManager;
  }, [positionDepth]);
  const selectedDepthSignals = selectedManager ? positionDepthByManager.get(selectedManager.manager) || [] : [];

  return (
    <div className="owner-tile-shell">
      <div className="owner-tile-grid position-counts-tile-grid">
        {data.map((row, idx) => {
          const depthSignals = positionDepthByManager.get(row.manager) || [];

          return (
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
              {depthSignals.slice(0, 2).map((signal) => (
                <OwnerMetricPill
                  key={`${signal.position}-${signal.status}`}
                  label={getPositionDepthNeedLabel(signal.status)}
                  value={signal.position}
                  tone={signal.status === 'shortage' ? 'danger' : 'good'}
                />
              ))}
              {depthSignals.length > 2 && (
                <OwnerMetricPill label="Depth" value={`+${depthSignals.length - 2}`} tone="info" />
              )}
            </OwnerSummaryTile>
          );
        })}
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
            <div className="manager-command-modal-inner starter-modal-inner max-h-[calc(100dvh-1rem)] min-h-0 sm:max-h-[86vh]">
              <div className="manager-command-hero starter-modal-hero">
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
                <div className="manager-command-title-lockup">
                  <ChampionAvatarFrame managerName={selectedManager.manager} className="manager-command-champion-frame">
                    {selectedAvatar ? (
                      <img
                        src={selectedAvatar}
                        alt={selectedManager.manager}
                        className="manager-command-avatar"
                      />
                    ) : (
                      <span className="manager-command-avatar">
                        {selectedManager.manager[0]?.toUpperCase() || '?'}
                      </span>
                    )}
                  </ChampionAvatarFrame>
                  <div className="min-w-0">
                    <p>Starter Room</p>
                    <h3>{selectedManager.manager}</h3>
                    <ManagerChampionshipPills managerName={selectedManager.manager} className="manager-command-championships" />
                    <p className="starter-modal-subtitle">
                      {selectedStarters.length} starter{selectedStarters.length === 1 ? '' : 's'} by positional rank
                    </p>
                  </div>
                </div>
                <div className="manager-command-hero-metrics starter-modal-metrics">
                  <IntelligenceMetric label="QB" value={`${selectedManager.QB_starters}/${selectedManager.QB}`} />
                  <IntelligenceMetric label="RB" value={`${selectedManager.RB_starters}/${selectedManager.RB}`} />
                  <IntelligenceMetric label="WR" value={`${selectedManager.WR_starters}/${selectedManager.WR}`} />
                  <IntelligenceMetric label="TE" value={`${selectedManager.TE_starters}/${selectedManager.TE}`} />
                </div>
              </div>
              <div className="starter-modal-body min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
                {selectedDepthSignals.length > 0 && (
                  <div className="starter-depth-signal-board" aria-label="Position depth signals">
                    {selectedDepthSignals.map((signal) => (
                      <div
                        key={`${signal.position}-${signal.status}`}
                        className={`starter-depth-signal-card starter-depth-signal-${signal.status}`}
                      >
                        <div className="starter-depth-signal-metrics">
                          <IntelligenceMetric
                            label={getPositionDepthNeedLabel(signal.status)}
                            value={signal.position}
                            tone={signal.status === 'shortage' ? 'negative' : 'positive'}
                          />
                          <IntelligenceMetric label="Count" value={signal.count} />
                          <IntelligenceMetric
                            label="Signal"
                            value={getPositionDepthSignalLabel(signal.status)}
                            tone={signal.status === 'shortage' ? 'negative' : 'positive'}
                          />
                        </div>
                        <div className="starter-depth-read">
                          <span>Read</span>
                          <p>{getPositionDepthRead(signal)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                          <TeamLogoPill team={player.playerDetails?.team} className="starter-player-team-pill" />
                          <PositionRankPill rank={player.currentPositionRank || player.seasonPositionRank || player.pos} />
                          <span className={`starter-player-status-pill ${getPlayerStatusClass(player.playerDetails)}`}>
                            {getPlayerStatusLabel(player.playerDetails)}
                          </span>
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
