import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Scissors, ShieldCheck } from "lucide-react";
import type {
  PlayerDetails,
  RecentTransactionPlayer,
  ReportData,
  TrendingPlayer,
} from "@shared/types";
import { ManagerNameWithAvatar } from "../ManagerNameWithAvatar";
import { PlayerDetailModal, type PlayerModalData } from "../PlayerDetailModal";
import { TeamLogoPill } from "../TeamLogoPill";
import { PlayerIdentityRow, ReportCard } from "../reportPrimitives";
import { getPlayerRankForMode } from "@/lib/leagueValueMode";
import { getTeamTileStyle } from "@/lib/teamTileStyle";
import {
  buildPlayerModalData,
  formatCompactValue,
  PositionRankPill,
  type ManagerAvatars,
  type PlayerDetailsById,
} from "./shared";

const AI_RECOMMENDATION_BADGE_LABEL = "AI TARGET";
const AI_NEURAL_SURFACE_CLASS = "ai-neural-surface";
const DEFAULT_VISIBLE_TRANSACTION_DATE_COUNT = 3;
const WAIVER_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
type WaiverPosition = (typeof WAIVER_POSITIONS)[number];

function getAiNeuralSurfaceClass(theme = "neutral", extraClassName = "") {
  return [
    AI_NEURAL_SURFACE_CLASS,
    `${AI_NEURAL_SURFACE_CLASS}-${theme}`,
    extraClassName,
  ]
    .filter(Boolean)
    .join(" ");
}

function parsePositionRankValue(rank: string | null | undefined): number | null {
  const match = String(rank || "").match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function isWaiverPosition(
  position: string | null | undefined
): position is WaiverPosition {
  return WAIVER_POSITIONS.includes(position as WaiverPosition);
}

function getWaiverPlayerDetails(
  player: TrendingPlayer,
  playerDetailsById?: PlayerDetailsById
): PlayerDetails | undefined {
  const mappedDetails = playerDetailsById?.[player.player_id];
  if (!mappedDetails) return player.playerDetails;
  return {
    ...player.playerDetails,
    ...mappedDetails,
    valueProfile:
      mappedDetails.valueProfile || player.playerDetails?.valueProfile,
  };
}

function isNonDynastyWaiverPosition(
  position: string | null | undefined
): boolean {
  return position === "K" || position === "DEF";
}

function getWaiverDynastyValue(
  player: TrendingPlayer,
  playerDetailsById?: PlayerDetailsById
): number {
  if (isNonDynastyWaiverPosition(player.pos)) return 0;
  const details = getWaiverPlayerDetails(player, playerDetailsById);
  return Math.round(
    details?.valueProfile?.dynastyValue ??
      details?.valueProfile?.balancedValue ??
      player.ktcValue ??
      0
  );
}

function getWaiverSeasonValue(
  player: TrendingPlayer,
  playerDetailsById?: PlayerDetailsById
): number {
  const details = getWaiverPlayerDetails(player, playerDetailsById);
  const fallbackSeasonValue = isNonDynastyWaiverPosition(player.pos)
    ? player.ktcValue
    : null;
  return Math.round(
    details?.valueProfile?.seasonValue ??
      details?.valueProfile?.fantasyProsSeasonValue ??
      fallbackSeasonValue ??
      0
  );
}

function getWaiverPlayerValue(
  player: TrendingPlayer,
  playerDetailsById?: PlayerDetailsById
): number {
  return (
    getWaiverDynastyValue(player, playerDetailsById) ||
    getWaiverSeasonValue(player, playerDetailsById) ||
    Math.round(player.ktcValue || 0)
  );
}

function collectWaiverCandidates(
  data: NonNullable<ReportData["waiverIntelligence"]>
): TrendingPlayer[] {
  const byId = new Map<string, TrendingPlayer>();
  const addPlayer = (player: TrendingPlayer | null | undefined) => {
    if (!player?.player_id || player.owner || !isWaiverPosition(player.pos))
      return;
    if (!byId.has(player.player_id)) byId.set(player.player_id, player);
  };

  addPlayer(data.highestKtcAvailable);
  Object.values(data.bestAvailableByPosition).forEach(addPlayer);
  data.bestTaxiStashes.forEach(addPlayer);
  data.availableTrendingAdds.forEach(addPlayer);
  data.recentlyDroppedValuable.forEach(addPlayer);
  data.weeklyEcrTargets?.forEach(target => addPlayer(target.player));

  return Array.from(byId.values());
}

export default function RecentTransactionsPanel({
  data,
  waiverIntelligence,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
  leagueValueMode = "dynasty",
}: {
  data?: ReportData["recentTransactions"];
  waiverIntelligence?: ReportData["waiverIntelligence"];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
  leagueValueMode?: ReportData["leagueValueMode"];
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );
  const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);
  const [transactionSort, setTransactionSort] =
    useState<RecentTransactionSort>("add");
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  useEffect(() => {
    setShowAllTransactions(false);
  }, [data]);
  const sortedTransactions = useMemo(
    () => sortRecentTransactionsByDate(data || []),
    [data]
  );
  const visibleTransactionDateKeys = useMemo(
    () =>
      getRecentTransactionVisibleDateKeys(
        sortedTransactions,
        DEFAULT_VISIBLE_TRANSACTION_DATE_COUNT
      ),
    [sortedTransactions]
  );
  const visibleTransactionDateKeySet = useMemo(
    () => new Set(visibleTransactionDateKeys),
    [visibleTransactionDateKeys]
  );
  const hiddenTransactions = sortedTransactions.filter(
    transaction =>
      !visibleTransactionDateKeySet.has(
        getRecentTransactionDateKey(transaction.date)
      )
  );
  const visibleTransactions = showAllTransactions
    ? sortedTransactions
    : sortedTransactions.filter(transaction =>
        visibleTransactionDateKeySet.has(
          getRecentTransactionDateKey(transaction.date)
        )
      );
  const transactionGroups = useMemo(
    () => buildRecentTransactionGroups(visibleTransactions, transactionSort),
    [visibleTransactions, transactionSort]
  );
  const waiverCandidates = useMemo(
    () =>
      waiverIntelligence ? collectWaiverCandidates(waiverIntelligence) : [],
    [waiverIntelligence]
  );
  if (!data?.length) return null;

  const openTransactionPlayer = (
    player: NonNullable<ReportData["recentTransactions"]>[number]["addedPlayer"],
    transaction?: RecentTransactionRow,
    tone: "add" | "drop" | "alt" = "add"
  ) => {
    if (!player) return;
    const leagueRank = getTransactionPlayerRank(player, leagueValueMode);
    const manager = tone === "add" ? transaction?.manager || null : null;
    setSelectedPlayer(
      buildPlayerModalData({
        playerId: player.player_id,
        playerName: player.name,
        playerPos: player.pos,
        value: player.ktcValue,
        playerDetails: player.playerDetails,
        playerDetailsById,
        currentPositionRank: leagueRank,
        manager,
        managerAvatarUrl: manager ? managerAvatars?.[manager] : null,
        valueMode: leagueValueMode,
      })
    );
  };

  const openSuggestedAddPlayer = (player: TrendingPlayer) => {
    const details = getWaiverPlayerDetails(player, playerDetailsById);
    const leagueRank = getTransactionPlayerRank(
      { ...player, playerDetails: details || player.playerDetails },
      leagueValueMode
    );
    setSelectedPlayer(
      buildPlayerModalData({
        playerId: player.player_id,
        playerName: player.name,
        playerPos: player.pos,
        value: getWaiverPlayerValue(player, playerDetailsById),
        playerDetails: details,
        playerDetailsById,
        currentPositionRank: leagueRank,
        manager: player.owner || null,
        managerAvatarUrl: player.owner ? managerAvatars?.[player.owner] : null,
        valueMode: leagueValueMode,
      })
    );
  };

  const renderPlayerRow = (
    label: string,
    player: NonNullable<
      ReportData["recentTransactions"]
    >[number]["addedPlayer"],
    tone: "add" | "drop" | "alt" = "add",
    embeddedInsight?: BetterCutInsight | null,
    transaction?: RecentTransactionRow
  ) => {
    if (!player) return null;
    const leagueRank = getTransactionPlayerRank(player, leagueValueMode);
    return (
      <button
        type="button"
        className={`player-team-tile recent-transaction-player recent-transaction-player-${tone}${embeddedInsight ? " recent-transaction-player-has-insight" : ""}`}
        style={getTeamTileStyle(player.playerDetails?.team || player.team)}
        onClick={() => openTransactionPlayer(player, transaction, tone)}
      >
        <div className="recent-transaction-player-head">
          <span
            className={`recent-transaction-player-label recent-transaction-player-label-${tone}`}
          >
            {label}
          </span>
        </div>
        <PlayerIdentityRow
          className="recent-transaction-player-main"
          playerId={player.player_id}
          playerName={player.name}
          team={player.playerDetails?.team || player.team}
          position={player.pos}
          hideMeta
        />
        <div className="recent-transaction-player-pills">
          <TeamLogoPill team={player.playerDetails?.team || player.team} />
          <PositionRankPill rank={leagueRank || player.pos} />
          <span>{formatCompactValue(player.ktcValue)}</span>
        </div>
        {embeddedInsight
          ? renderBetterCutInsight(embeddedInsight, "embedded")
          : null}
      </button>
    );
  };

  const renderSuggestedAdd = (
    player: TrendingPlayer,
    transaction: RecentTransactionRow
  ) => {
    const details = getWaiverPlayerDetails(player, playerDetailsById);
    const value = getWaiverPlayerValue(player, playerDetailsById);
    const rank = getTransactionPlayerRank(
      { ...player, playerDetails: details || player.playerDetails },
      leagueValueMode
    );

    return (
      <button
        type="button"
        className={getAiNeuralSurfaceClass(
          "trade",
          "player-team-tile recent-transaction-player recent-transaction-player-suggestion"
        )}
        style={getTeamTileStyle(details?.team || player.team)}
        onClick={() => openSuggestedAddPlayer(player)}
      >
        <div className="recent-transaction-player-head">
          <span className="recent-transaction-player-label recent-transaction-player-label-suggestion ai-recommendation-badge">
            {AI_RECOMMENDATION_BADGE_LABEL}
          </span>
        </div>
        <PlayerIdentityRow
          className="recent-transaction-player-main"
          playerId={player.player_id}
          playerName={player.name}
          team={details?.team || player.team}
          position={player.pos}
          hideMeta
        />
        <div className="recent-transaction-player-pills">
          <TeamLogoPill team={details?.team || player.team} />
          <PositionRankPill rank={rank || player.pos} />
          <span>{formatCompactValue(value)}</span>
        </div>
        <p className="recent-transaction-player-note">
          {buildSuggestedBetterAddReason(transaction, player, leagueValueMode)}
        </p>
      </button>
    );
  };

  const renderBetterCutInsight = (
    insight: BetterCutInsight,
    placement: "standalone" | "embedded" = "standalone"
  ) => {
    return (
      <div
        className={
          placement === "embedded"
            ? "recent-transaction-inline-insight"
            : "recent-transaction-insight-card recent-transaction-insight-card-alt"
        }
      >
        <div className="recent-transaction-insight-head">
          <span className="recent-transaction-insight-title">
            Why Better Cut
          </span>
          <span className="recent-transaction-insight-lens">
            {insight.lensLabel}
          </span>
        </div>
        <div className="recent-transaction-insight-matchup">
          <span className="recent-transaction-insight-chip recent-transaction-insight-chip-keep">
            <ShieldCheck aria-hidden="true" />
            <span>
              <em>Keep</em>
              <strong>{insight.keepName}</strong>
            </span>
            <b>{insight.keepRank}</b>
          </span>
          <ArrowRight
            className="recent-transaction-insight-arrow"
            aria-hidden="true"
          />
          <span className="recent-transaction-insight-chip recent-transaction-insight-chip-cut">
            <Scissors aria-hidden="true" />
            <span>
              <em>Cut</em>
              <strong>{insight.cutName}</strong>
            </span>
            <b>{insight.cutRank}</b>
          </span>
        </div>
        <p>{insight.reason}</p>
      </div>
    );
  };

  return (
    <div className="recent-transaction-date-list">
      {transactionGroups.map(group => {
        const isExpanded = expandedDateKey === group.dateKey;
        return (
          <div
            key={group.dateKey}
            className={`recent-transaction-date-group ${isExpanded ? "is-open" : ""}`}
          >
            <div className="recent-transaction-date-header">
              <button
                type="button"
                className="recent-transaction-date-toggle"
                onClick={() =>
                  setExpandedDateKey(isExpanded ? null : group.dateKey)
                }
                aria-expanded={isExpanded}
              >
                <span className="recent-transaction-date-label">
                  <ChevronDown
                    className={`h-4 w-4 text-orange-300 transition-transform ${isExpanded ? "rotate-180" : "-rotate-90"}`}
                  />
                  <span>{group.displayDate}</span>
                </span>
              </button>
              <span className="recent-transaction-day-pills">
                <button
                  type="button"
                  className={`recent-transaction-day-pill recent-transaction-day-pill-add ${transactionSort === "add" ? "is-active" : ""}`}
                  onClick={() => {
                    setTransactionSort("add");
                    setExpandedDateKey(group.dateKey);
                  }}
                  aria-pressed={transactionSort === "add"}
                >
                  Adds {group.addCount}
                </button>
                <button
                  type="button"
                  className={`recent-transaction-day-pill recent-transaction-day-pill-drop ${transactionSort === "drop" ? "is-active" : ""}`}
                  onClick={() => {
                    setTransactionSort("drop");
                    setExpandedDateKey(group.dateKey);
                  }}
                  aria-pressed={transactionSort === "drop"}
                >
                  Drops {group.dropCount}
                </button>
              </span>
            </div>

            {isExpanded && (
              <div className="recent-transaction-day-panel">
                {group.transactions.map(transaction => {
                  const suggestedBetterAdd =
                    transaction.addedPlayer && !transaction.droppedPlayer
                      ? getRecentTransactionSuggestedBetterAdd(
                          transaction,
                          waiverCandidates,
                          playerDetailsById
                        )
                      : null;
                  const betterCutInsight = transaction.alternativeDrop
                    ? buildBetterCutInsight(transaction, leagueValueMode)
                    : null;
                  const validBetterCutInsight = betterCutInsight?.isBetterCut
                    ? betterCutInsight
                    : null;

                  return (
                    <ReportCard
                      key={transaction.id}
                      className="recent-transaction-card mobile-stacked-row"
                    >
                      <div className="recent-transaction-top">
                        <div className="recent-transaction-manager">
                          <ManagerNameWithAvatar
                            avatarUrl={managerAvatars?.[transaction.manager]}
                            managerName={transaction.manager}
                          />
                        </div>
                        <div className="recent-transaction-meta">
                          <span
                            className={`recent-transaction-type-pill ${transaction.type === "Free Agent" ? "recent-transaction-type-fa" : "recent-transaction-type-waiver"}`}
                          >
                            {transaction.type === "Free Agent"
                              ? "FA"
                              : "Waiver"}
                          </span>
                          {transaction.bidAmount !== null && (
                            <strong>${transaction.bidAmount}</strong>
                          )}
                        </div>
                      </div>
                      <div
                        className={`recent-transaction-player-grid${validBetterCutInsight ? " recent-transaction-player-grid-with-insight" : ""}`}
                      >
                        {renderPlayerRow(
                          "Added",
                          transaction.addedPlayer,
                          "add",
                          null,
                          transaction
                        )}
                        {renderPlayerRow(
                          "Dropped",
                          transaction.droppedPlayer,
                          "drop",
                          null,
                          transaction
                        )}
                        {validBetterCutInsight &&
                          renderPlayerRow(
                            "Better Cut",
                            transaction.alternativeDrop,
                            "alt",
                            validBetterCutInsight,
                            transaction
                          )}
                        {suggestedBetterAdd &&
                          renderSuggestedAdd(suggestedBetterAdd, transaction)}
                      </div>
                    </ReportCard>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {hiddenTransactions.length > 0 && (
        <div className="recent-transaction-display-controls">
          <button
            type="button"
            className="recent-transaction-display-button"
            onClick={() => {
              const nextShowAll = !showAllTransactions;
              setShowAllTransactions(nextShowAll);
              setExpandedDateKey(null);
            }}
          >
            {showAllTransactions
              ? `Show last ${DEFAULT_VISIBLE_TRANSACTION_DATE_COUNT} dates`
              : getRecentTransactionDisplayAllLabel(hiddenTransactions)}
          </button>
          <span>
            {showAllTransactions
              ? `${sortedTransactions.length} transactions shown`
              : `${hiddenTransactions.length} transactions from older dates hidden`}
          </span>
        </div>
      )}
      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        managerAvatars={managerAvatars}
        playerDetailsById={playerDetailsById}
      />
    </div>
  );
}

type RecentTransactionRow = NonNullable<
  ReportData["recentTransactions"]
>[number];
type RecentTransactionSort = "add" | "drop";
type BetterCutInsight = ReturnType<typeof buildBetterCutInsight>;

function getRecentTransactionSuggestedBetterAdd(
  transaction: RecentTransactionRow,
  candidates: TrendingPlayer[],
  playerDetailsById?: PlayerDetailsById
): TrendingPlayer | null {
  const addedPlayer = transaction.addedPlayer;
  if (!addedPlayer || !candidates.length) return null;

  const ignoredPlayerIds = new Set(
    [
      addedPlayer.player_id,
      transaction.droppedPlayer?.player_id,
      transaction.alternativeDrop?.player_id,
    ].filter(Boolean)
  );
  const addedValue = addedPlayer.ktcValue || 0;
  const sortedCandidates = candidates
    .filter(
      player => player.player_id && !ignoredPlayerIds.has(player.player_id)
    )
    .map(player => ({
      player,
      value: getWaiverPlayerValue(player, playerDetailsById),
      samePosition: player.pos === addedPlayer.pos,
    }))
    .filter(({ value }) => value > 0)
    .sort((a, b) => {
      const valueDiff = b.value - a.value;
      if (valueDiff !== 0) return valueDiff;
      return Number(b.samePosition) - Number(a.samePosition);
    });

  return (
    sortedCandidates.find(({ value }) => value > addedValue + 100)?.player ||
    sortedCandidates[0]?.player ||
    null
  );
}

type TransactionInsightPlayer = {
  name: string;
  pos?: string | null;
  currentPositionRank?: string | null;
  playerDetails?: PlayerDetails;
};

function getLeagueValueLensLabel(
  leagueValueMode: ReportData["leagueValueMode"] = "dynasty"
): string {
  if (leagueValueMode === "redraft") return "Redraft Value";
  if (leagueValueMode === "keeper") return "Keeper Value";
  return "Dynasty Value";
}

function getLeagueValueLensCopy(
  leagueValueMode: ReportData["leagueValueMode"] = "dynasty"
): string {
  if (leagueValueMode === "redraft") return "redraft";
  if (leagueValueMode === "keeper") return "keeper";
  return "dynasty";
}

function getTransactionPlayerRank(
  player: TransactionInsightPlayer | null | undefined,
  leagueValueMode: ReportData["leagueValueMode"] = "dynasty"
): string {
  if (!player) return "-";
  return (
    getPlayerRankForMode({
      valueProfile: player.playerDetails?.valueProfile,
      fallbackRank: player.currentPositionRank || player.pos,
      mode: leagueValueMode,
      context: "rankings",
    }) ||
    player.currentPositionRank ||
    player.pos ||
    "-"
  );
}

function buildBetterCutInsight(
  transaction: RecentTransactionRow,
  leagueValueMode: ReportData["leagueValueMode"] = "dynasty"
) {
  const droppedPlayer = transaction.droppedPlayer;
  const alternativeDrop = transaction.alternativeDrop;
  const keepRank = getTransactionPlayerRank(droppedPlayer, leagueValueMode);
  const cutRank = getTransactionPlayerRank(alternativeDrop, leagueValueMode);
  const lensCopy = getLeagueValueLensCopy(leagueValueMode);
  const droppedRankNumber = parsePositionRankValue(keepRank);
  const cutRankNumber = parsePositionRankValue(cutRank);
  const samePosition = Boolean(
    droppedPlayer?.pos &&
      alternativeDrop?.pos &&
      droppedPlayer.pos === alternativeDrop.pos
  );
  const droppedValue = droppedPlayer?.ktcValue || 0;
  const cutValue = alternativeDrop?.ktcValue || 0;
  const hasSamePositionRankComparison =
    samePosition && cutRankNumber !== null && droppedRankNumber !== null;
  const rankedBehindSamePosition =
    hasSamePositionRankComparison && cutRankNumber > droppedRankNumber;
  const lowerValueChurn =
    cutValue > 0 &&
    droppedValue > 0 &&
    cutValue + 250 < droppedValue &&
    (!samePosition || !hasSamePositionRankComparison);
  const isBetterCut = Boolean(
    droppedPlayer &&
      alternativeDrop &&
      (rankedBehindSamePosition || lowerValueChurn)
  );

  let reason = `${alternativeDrop?.name || "The alternate cut"} was the cleaner churn piece than ${droppedPlayer?.name || "the logged drop"} by ${lensCopy} roster fit.`;

  if (droppedPlayer && alternativeDrop && cutRankNumber && droppedRankNumber) {
    if (samePosition && cutRankNumber > droppedRankNumber) {
      reason = `${alternativeDrop.name} sits behind ${droppedPlayer.name} in the ${lensCopy} position stack, making the lower-ranked ${alternativeDrop.pos} the cleaner churn.`;
    } else if (!samePosition && cutRankNumber > droppedRankNumber) {
      reason = `${alternativeDrop.name}'s ${cutRank} profile was the softer roster hold than ${droppedPlayer.name}'s ${keepRank} profile.`;
    } else {
      reason = `${alternativeDrop.name} was the better churn target only if the roster needed ${droppedPlayer.pos} depth more than another ${alternativeDrop.pos} stash.`;
    }
  } else if (
    droppedPlayer &&
    alternativeDrop &&
    cutRank !== "-" &&
    keepRank !== "-"
  ) {
    reason = `${alternativeDrop.name} carried the cleaner ${lensCopy} cut profile at ${cutRank}; ${droppedPlayer.name} still showed as ${keepRank}.`;
  } else if (
    droppedPlayer &&
    alternativeDrop &&
    alternativeDrop.pos !== droppedPlayer.pos
  ) {
    reason = `This is a roster-shape call: keep the harder-to-replace ${droppedPlayer.pos} depth and churn the extra ${alternativeDrop.pos} stash.`;
  }

  return {
    lensLabel: getLeagueValueLensLabel(leagueValueMode),
    keepName: droppedPlayer?.name || "Logged drop",
    keepRank,
    cutName: alternativeDrop?.name || "Alt cut",
    cutRank,
    reason,
    isBetterCut,
  };
}

function buildSuggestedBetterAddReason(
  transaction: RecentTransactionRow,
  suggestedPlayer: TrendingPlayer,
  leagueValueMode: ReportData["leagueValueMode"] = "dynasty"
): string {
  const addedPlayer = transaction.addedPlayer;
  const lensCopy = getLeagueValueLensCopy(leagueValueMode);
  const suggestedRank = getTransactionPlayerRank(
    suggestedPlayer,
    leagueValueMode
  );
  const addedRank = getTransactionPlayerRank(addedPlayer, leagueValueMode);
  const suggestedRankNumber = parsePositionRankValue(suggestedRank);
  const addedRankNumber = parsePositionRankValue(addedRank);

  if (addedPlayer && suggestedRankNumber && addedRankNumber) {
    if (
      suggestedPlayer.pos === addedPlayer.pos &&
      suggestedRankNumber < addedRankNumber
    ) {
      return `${suggestedPlayer.name} is the cleaner ${lensCopy} stash at ${suggestedRank}; ${addedPlayer.name} sits at ${addedRank}.`;
    }
    if (suggestedRankNumber < addedRankNumber) {
      return `Better ${lensCopy} positional profile: ${suggestedRank} versus ${addedPlayer.name} at ${addedRank}.`;
    }
  }
  if (
    addedPlayer &&
    suggestedPlayer.pos === addedPlayer.pos &&
    suggestedRank !== "-"
  ) {
    return `Cleaner same-position stash by ${lensCopy} rank at ${suggestedRank}.`;
  }
  if (suggestedRank !== "-") {
    return `Best remaining waiver option by ${lensCopy} positional profile at ${suggestedRank}.`;
  }
  return `Best remaining waiver option by current roster profile.`;
}

function buildRecentTransactionGroups(
  data: RecentTransactionRow[],
  sortMode: RecentTransactionSort
) {
  const groups = new Map<
    string,
    {
      dateKey: string;
      displayDate: string;
      transactions: RecentTransactionRow[];
      addCount: number;
      dropCount: number;
    }
  >();

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
    .map(group => ({
      ...group,
      transactions: [...group.transactions].sort((a, b) =>
        compareRecentTransactions(a, b, sortMode)
      ),
    }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

function sortRecentTransactionsByDate(
  data: RecentTransactionRow[]
): RecentTransactionRow[] {
  return [...data].sort((a, b) => {
    const timeDiff =
      getRecentTransactionTime(b.date) - getRecentTransactionTime(a.date);
    if (timeDiff !== 0) return timeDiff;
    return String(b.id).localeCompare(String(a.id));
  });
}

function getRecentTransactionTime(date: string): number {
  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getRecentTransactionVisibleDateKeys(
  transactions: RecentTransactionRow[],
  limit: number
): string[] {
  const visibleDateKeys: string[] = [];
  const seenDateKeys = new Set<string>();

  for (const transaction of transactions) {
    const dateKey = getRecentTransactionDateKey(transaction.date);
    if (seenDateKeys.has(dateKey)) continue;
    seenDateKeys.add(dateKey);
    visibleDateKeys.push(dateKey);
    if (visibleDateKeys.length >= limit) break;
  }

  return visibleDateKeys;
}

function getRecentTransactionYear(date: string): string | null {
  const rawDate = String(date || "").trim();
  const dateMatch = rawDate.match(/^(\d{4})-/);
  if (dateMatch) return dateMatch[1];

  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    return String(parsed.getFullYear());
  }

  return null;
}

function getRecentTransactionDisplayAllLabel(
  hiddenTransactions: RecentTransactionRow[]
): string {
  const hiddenCount = hiddenTransactions.length;
  const years = Array.from(
    new Set(
      hiddenTransactions
        .map(transaction => getRecentTransactionYear(transaction.date))
        .filter((year): year is string => Boolean(year))
    )
  );
  const currentYear = String(new Date().getFullYear());

  if (years.length === 1 && years[0] !== currentYear) {
    return `Display ${years[0]} (${hiddenCount})`;
  }

  if (years.length > 1) {
    return `Display all years (${hiddenCount})`;
  }

  return `Display all (${hiddenCount})`;
}

function compareRecentTransactions(
  a: RecentTransactionRow,
  b: RecentTransactionRow,
  sortMode: RecentTransactionSort
) {
  const primaryDiff =
    getRecentTransactionSortValue(b, sortMode) -
    getRecentTransactionSortValue(a, sortMode);
  if (primaryDiff !== 0) return primaryDiff;

  const secondaryMode: RecentTransactionSort =
    sortMode === "add" ? "drop" : "add";
  const secondaryDiff =
    getRecentTransactionSortValue(b, secondaryMode) -
    getRecentTransactionSortValue(a, secondaryMode);
  if (secondaryDiff !== 0) return secondaryDiff;

  return String(b.id).localeCompare(String(a.id));
}

function getRecentTransactionSortValue(
  transaction: RecentTransactionRow,
  sortMode: RecentTransactionSort
) {
  const player =
    sortMode === "add" ? transaction.addedPlayer : transaction.droppedPlayer;
  return player?.ktcValue ?? -1;
}

function getRecentTransactionDateKey(date: string): string {
  const rawDate = String(date || "").trim();
  const dateMatch = rawDate.match(/^\d{4}-\d{2}-\d{2}/);
  if (dateMatch) return dateMatch[0];

  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return rawDate || "Unknown Date";
}
