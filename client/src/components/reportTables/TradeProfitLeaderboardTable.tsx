import React, { useState } from "react";
import { X as XIcon } from "lucide-react";
import type { DraftPick, ReportData } from "@shared/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChampionAvatarFrame, ManagerChampionshipPills } from "../ManagerChampionships";
import { PlayerDetailModal, type PlayerModalData } from "../PlayerDetailModal";
import { getBalancedGridStyle } from "@/lib/balancedGrid";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import { sortRowsByViewerAndStanding } from "@/lib/managerOrdering";
import { viewerOwnedHighlightClass } from "@/lib/viewerHighlight";
import {
  OwnerMetricPill,
  OwnerSummaryTile,
  TradeEmptyState,
  renderManagerName,
  type ManagerAvatars,
  type PlayerDetailsById,
} from "./shared";
import {
  TradeDetailPanel,
  buildTradeLedgerEvaluation,
  getManagerTradeEvaluationResult,
  getManagerTradeEvaluationSwing,
  getTradeOpponent,
} from "./tradeLedgerUtils";

type CurrentPositionRankById = ReportData["currentPositionRankById"];
type DynastyTimelineRows = NonNullable<ReportData["dynastyTimelines"]>;
type LeagueOverviewRows = ReportData["leagueOverview"];

export default function TradeProfitLeaderboardTable({
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
  leagueDiagnostics,
  currentStandings,
  standingsHistory,
  leagueValueMode = "dynasty",
}: {
  data: ReportData["tradeProfitLeaderboard"];
  managerAvatars?: ManagerAvatars;
  tradeHistory?: ReportData["tradeHistory"];
  draftPicks?: DraftPick[];
  playerDetailsById?: PlayerDetailsById;
  currentPositionRankById?: CurrentPositionRankById;
  tradeTendencies?: ReportData["tradeTendencies"];
  managerRosterIntelligence?: ReportData["managerRosterIntelligence"];
  dynastyTimelines?: DynastyTimelineRows;
  leagueOverview?: LeagueOverviewRows;
  leagueId?: string;
  leagueLogo?: string | null;
  viewerManager?: string | null;
  leagueDiagnostics?: ReportData["leagueDiagnostics"];
  currentStandings?: ReportData["currentStandings"];
  standingsHistory?: ReportData["standingsHistory"];
  leagueValueMode?: ReportData["leagueValueMode"];
}) {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [selectedManagerTradeKey, setSelectedManagerTradeKey] = useState<
    string | null
  >(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );
  const evaluatedProfitRows = React.useMemo(() => {
    if (!tradeHistory.length) return data;

    const summary = new Map<
      string,
      { profit: number; wins: number; trade_count: number }
    >();
    data.forEach(row => {
      summary.set(row.manager, { profit: 0, wins: 0, trade_count: 0 });
    });

    tradeHistory.forEach(trade => {
      const evaluation = buildTradeLedgerEvaluation(
        trade,
        dynastyTimelines,
        managerRosterIntelligence,
        playerDetailsById,
        draftPicks,
        leagueValueMode
      );
      [trade.team_a, trade.team_b].forEach(manager => {
        const current = summary.get(manager) || {
          profit: 0,
          wins: 0,
          trade_count: 0,
        };
        current.profit += getManagerTradeEvaluationSwing(evaluation, manager);
        current.wins += evaluation.winners.includes(manager) ? 1 : 0;
        current.trade_count += 1;
        summary.set(manager, current);
      });
    });

    return data
      .map(row => {
        const next = summary.get(row.manager);
        return next ? { ...row, ...next } : row;
      })
      .sort((a, b) => b.profit - a.profit)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [
    data,
    draftPicks,
    dynastyTimelines,
    leagueValueMode,
    managerRosterIntelligence,
    playerDetailsById,
    tradeHistory,
  ]);
  const selectedManagerTrades = selectedManager
    ? [...tradeHistory]
        .filter(
          trade =>
            trade.team_a === selectedManager || trade.team_b === selectedManager
        )
        .reverse()
    : [];
  const selectedManagerSummary = selectedManager
    ? evaluatedProfitRows.find(row => row.manager === selectedManager)
    : undefined;
  const selectedManagerTendency = selectedManager
    ? tradeTendencies?.find(row => row.manager === selectedManager)
    : undefined;

  const orderedRows = React.useMemo(
    () =>
      sortRowsByViewerAndStanding(evaluatedProfitRows, row => row.manager, {
        viewerManager,
        standings: currentStandings,
        leagueOverview,
      }),
    [currentStandings, evaluatedProfitRows, leagueOverview, viewerManager]
  );

  if (!orderedRows.length) {
    return (
      <TradeEmptyState
        title="No completed trades found"
        description={
          normalizeLeagueValueMode(leagueValueMode) === "redraft"
            ? "This redraft league does not have completed trades in the report data yet. Once trades are completed, this section will show current-season trade edge."
            : "This league does not have completed trades in the report data yet. Once trades are completed, this section will show dynasty trade edge."
        }
      />
    );
  }

  return (
    <div className="owner-tile-shell">
      <div
        className="owner-tile-grid trade-profit-tile-grid balanced-tile-grid"
        style={getBalancedGridStyle(orderedRows.length)}
      >
        {orderedRows.map(row => {
          const winPct =
            row.trade_count > 0
              ? Math.round((row.wins / row.trade_count) * 100)
              : 0;
          const tendency = tradeTendencies?.find(
            item => item.manager === row.manager
          );
          const habit = tendency ? getTradeHabit(tendency) : null;

          return (
            <OwnerSummaryTile
              key={row.rank}
              manager={row.manager}
              avatarUrl={managerAvatars?.[row.manager]}
              className={viewerOwnedHighlightClass(row.manager, viewerManager)}
              onClick={() => setSelectedManager(row.manager)}
            >
              <OwnerMetricPill label="Wins" value={row.wins} tone="warn" />
              <OwnerMetricPill label="Win %" value={`${winPct}%`} tone="info" />
              <OwnerMetricPill label="Trades" value={row.trade_count} />
              <OwnerMetricPill
                label="Profit"
                value={`${row.profit >= 0 ? "+" : ""}${row.profit.toLocaleString()}`}
                tone={row.profit >= 0 ? "good" : "danger"}
              />
              {habit && (
                <span className={`trade-habit-pill ${habit.className}`}>
                  {habit.label}
                </span>
              )}
              {tendency?.favoritePartner && (
                <span
                  className="trade-partner-pill"
                  title={`Likes trading with ${tendency.favoritePartner}`}
                >
                  <em>Likes with</em>
                  {renderManagerName(tendency.favoritePartner, managerAvatars)}
                </span>
              )}
            </OwnerSummaryTile>
          );
        })}
      </div>
      <Dialog
        open={selectedManager !== null}
        onOpenChange={open => {
          if (open) return;
          setSelectedManager(null);
          setSelectedManagerTradeKey(null);
          setSelectedPlayer(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="trade-manager-modal max-h-[82vh] max-w-[calc(100vw-1rem)] overflow-hidden border-cyan-300/20 bg-slate-950 p-0 text-slate-100 shadow-2xl shadow-black/70 sm:max-w-2xl"
        >
          {selectedManager && (
            <div className="trade-manager-modal-inner">
              <div className="trade-manager-modal-hero">
                {managerAvatars?.[selectedManager] && (
                  <>
                    <img
                      src={managerAvatars[selectedManager] || ""}
                      alt=""
                      className="manager-hero-wash"
                    />
                    <img
                      src={managerAvatars[selectedManager] || ""}
                      alt=""
                      className="manager-hero-watermark"
                    />
                  </>
                )}
                <div className="manager-hero-scrim" />
                <button
                  type="button"
                  className="manager-modal-close"
                  onClick={() => {
                    setSelectedManager(null);
                    setSelectedManagerTradeKey(null);
                    setSelectedPlayer(null);
                  }}
                  aria-label={`Close ${selectedManager} details`}
                >
                  <XIcon aria-hidden="true" />
                </button>
                <DialogHeader className="trade-manager-header relative pr-8">
                  <div className="trade-manager-title-lockup">
                    <ChampionAvatarFrame
                      managerName={selectedManager}
                      className="trade-manager-title-avatar"
                    >
                      {managerAvatars?.[selectedManager] ? (
                        <img
                          src={managerAvatars[selectedManager] || ""}
                          alt={selectedManager}
                        />
                      ) : (
                        <span>
                          {selectedManager.trim()[0]?.toUpperCase() || "?"}
                        </span>
                      )}
                    </ChampionAvatarFrame>
                    <div className="min-w-0 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
                        Trade Portfolio
                      </p>
                      <DialogTitle className="athletic-headline mt-1 truncate text-3xl font-black leading-none text-orange-400">
                        {selectedManager}
                      </DialogTitle>
                      <DialogDescription className="sr-only">
                        Trade portfolio detail with manager trade totals,
                        profit, partner history, and player-level trade context.
                      </DialogDescription>
                      <ManagerChampionshipPills
                        managerName={selectedManager}
                        className="mt-2 justify-center"
                      />
                    </div>
                  </div>
                </DialogHeader>
              </div>
              <div className="trade-manager-stats">
                <div>
                  <span>Trades</span>
                  <strong>
                    {selectedManagerSummary?.trade_count ??
                      selectedManagerTrades.length}
                  </strong>
                </div>
                <div>
                  <span>Wins</span>
                  <strong>{selectedManagerSummary?.wins ?? 0}</strong>
                </div>
                <div>
                  <span>Profit</span>
                  <strong
                    className={
                      (selectedManagerSummary?.profit ?? 0) >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {(selectedManagerSummary?.profit ?? 0) >= 0 ? "+" : ""}
                    {(selectedManagerSummary?.profit ?? 0).toLocaleString()}
                  </strong>
                </div>
                {selectedManagerTendency && (
                  <>
                    <div>
                      <span>Avg Gap</span>
                      <strong>
                        {selectedManagerTendency.avgGap.toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span>Win %</span>
                      <strong>{selectedManagerTendency.winPct}%</strong>
                    </div>
                    <div>
                      <span>Partner</span>
                      <strong>
                        {selectedManagerTendency.favoritePartner || "-"}
                      </strong>
                    </div>
                  </>
                )}
              </div>
              {selectedManagerTendency && (
                <div className="trade-manager-tendency-strip">
                  <span
                    className={`trade-habit-pill ${getTradeHabit(selectedManagerTendency).className}`}
                  >
                    {getTradeHabit(selectedManagerTendency).label}
                  </span>
                  {selectedManagerTendency.overpaysForPicks && (
                    <span className="trade-habit-pill trade-habit-warn">
                      Pays For Picks
                    </span>
                  )}
                  {selectedManagerTendency.overpaysForVeterans && (
                    <span className="trade-habit-pill trade-habit-warn">
                      Vet Shopper
                    </span>
                  )}
                  {selectedManagerTendency.favoritePartner && (
                    <span className="trade-habit-pill trade-habit-info">
                      Likes {selectedManagerTendency.favoritePartner}
                    </span>
                  )}
                </div>
              )}
              <div className="trade-manager-list">
                {selectedManagerTrades.map((trade, tradeIndex) => {
                  const tradeEvaluation = buildTradeLedgerEvaluation(
                    trade,
                    dynastyTimelines,
                    managerRosterIntelligence,
                    playerDetailsById,
                    draftPicks,
                    leagueValueMode
                  );
                  const swing = getManagerTradeEvaluationSwing(
                    tradeEvaluation,
                    selectedManager
                  );
                  const result = getManagerTradeEvaluationResult(
                    tradeEvaluation,
                    selectedManager
                  );
                  const opponent = getTradeOpponent(trade, selectedManager);
                  const tradeKey = `${trade.date}-${trade.team_a}-${trade.team_b}-${tradeIndex}`;
                  const isTradeOpen = selectedManagerTradeKey === tradeKey;

                  return (
                    <div key={tradeKey} className="trade-manager-trade-wrap">
                      <button
                        type="button"
                        className="trade-manager-trade"
                        onClick={() =>
                          setSelectedManagerTradeKey(
                            isTradeOpen ? null : tradeKey
                          )
                        }
                        aria-expanded={isTradeOpen}
                      >
                        <div className="min-w-0">
                          <div className="trade-manager-date">{trade.date}</div>
                          <div className="trade-manager-opponent">
                            vs {opponent}
                          </div>
                        </div>
                        <span
                          className={`trade-manager-result trade-manager-result-${result === "Loss" ? "loss" : result === "Even Win" ? "even" : "win"}`}
                        >
                          {result}
                        </span>
                        <span
                          className={`trade-manager-swing ${swing >= 0 ? "text-green-400" : "text-red-400"}`}
                        >
                          {swing >= 0 ? "+" : ""}
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
                            managerRosterIntelligence={
                              managerRosterIntelligence
                            }
                            dynastyTimelines={dynastyTimelines}
                            leagueOverview={leagueOverview}
                            leagueDiagnostics={leagueDiagnostics}
                            standingsHistory={standingsHistory}
                            currentStandings={currentStandings}
                            leagueValueMode={leagueValueMode}
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
                playerDetailsById={playerDetailsById}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getTradeHabit(
  row: NonNullable<ReportData["tradeTendencies"]>[number]
) {
  if (row.tradeCount === 0)
    return { label: "Quiet So Far", className: "trade-habit-neutral" };
  if (row.tradeCount === 1) {
    return row.profit >= 0
      ? { label: "One Deal, Won It", className: "trade-habit-good" }
      : { label: "One Deal, Paid Up", className: "trade-habit-warn" };
  }
  if (row.profit >= 2500 && row.winPct >= 60)
    return { label: "Trade Shark", className: "trade-habit-good" };
  if (row.profit >= 1000)
    return { label: "Value Hunter", className: "trade-habit-good" };
  if (row.profit <= -2500)
    return { label: "League Donor", className: "trade-habit-danger" };
  if (row.profit <= -1000)
    return { label: "Pays the Tax", className: "trade-habit-warn" };
  if (row.avgGap <= 300)
    return { label: "Fair Dealer", className: "trade-habit-neutral" };
  if (row.overpaysForPicks)
    return { label: "Pick Chaser", className: "trade-habit-warn" };
  if (row.overpaysForVeterans)
    return { label: "Vet Shopper", className: "trade-habit-warn" };
  if (row.tradeCount >= 8)
    return { label: "Volume Trader", className: "trade-habit-info" };
  if (row.winPct >= 67)
    return { label: "Sharp Closer", className: "trade-habit-good" };
  return { label: "Risk Taker", className: "trade-habit-info" };
}
