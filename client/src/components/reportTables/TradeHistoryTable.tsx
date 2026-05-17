import React, { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { DraftPick, ReportData } from "@shared/types";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlayerDetailModal, type PlayerModalData } from "../PlayerDetailModal";
import { EmptyState } from "../reportPrimitives";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import { type ManagerAvatars, type PlayerDetailsById } from "./shared";
import {
  TradeDetailPanel,
  buildTradeFairnessSuggestion,
  buildTradeLedgerEvaluation,
  getTradeDisplaySides,
  getTradeFairnessSuggestionCopy,
  getTradeGapVerdict,
  getTradeLensSourceNote,
  getTradeSideEvaluation,
  renderManagerName,
  renderTradeSummaryManager,
  renderTradeLedgerManagerName,
  stableTradeSeed,
} from "./tradeLedgerUtils";

type CurrentPositionRankById = ReportData["currentPositionRankById"];
type LeagueOverviewRows = ReportData["leagueOverview"];
type DynastyTimelineRows = NonNullable<ReportData["dynastyTimelines"]>;

export default function TradeHistoryTable({
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
  leagueDiagnostics,
  currentStandings,
  standingsHistory,
  leagueValueMode = "dynasty",
  variant = "inline",
}: {
  data: ReportData["tradeHistory"];
  draftPicks?: DraftPick[];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  currentPositionRankById?: CurrentPositionRankById;
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
  variant?: "inline" | "modal";
}) {
  const [collapsedTradeYears, setCollapsedTradeYears] = useState<Set<string>>(
    new Set()
  );
  const [selectedTradeDetail, setSelectedTradeDetail] = useState<{
    row: ReportData["tradeHistory"][number];
    sideOrder: [string, string];
  } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );
  const isModal = variant === "modal";
  const isRedraft = normalizeLeagueValueMode(leagueValueMode) === "redraft";
  const orderedTrades = [...data].reverse();
  const tradeYears = Array.from(
    new Set(orderedTrades.map(row => row.date.slice(0, 4)))
  );
  const toggleTradeYear = (year: string) => {
    setCollapsedTradeYears(current => {
      const next = new Set(current);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  if (!data.length) {
    return (
      <EmptyState
        className="trade-empty-state"
        title="No completed trades found"
        description={
          normalizeLeagueValueMode(leagueValueMode) === "redraft"
            ? "No completed redraft trades were returned for this league. This panel will populate once Sleeper has completed trade transactions to evaluate with current-season values."
            : "No completed dynasty trades were returned for this league. This panel will populate once Sleeper has completed trade transactions to evaluate."
        }
      />
    );
  }

  return (
    <div
      className={`trade-ledger-shell ${isModal ? "trade-ledger-shell-modal" : "flex justify-center"}`}
    >
      <Card
        className={`trade-ledger-card ${isModal ? "trade-ledger-card-modal" : ""} bg-slate-900 border-slate-800 overflow-hidden`}
      >
        <div className="overflow-visible">
          <Table className="trade-ledger-table">
            <TableHeader className="border-b-2 border-orange-500/30">
              <TableRow className="border-slate-700">
                <TableHead className="text-white font-semibold">
                  Trade History
                </TableHead>
                <TableHead className="trade-ledger-manager-heading text-white font-semibold">
                  Winner
                </TableHead>
                <TableHead className="trade-ledger-manager-heading text-white font-semibold">
                  Loser
                </TableHead>
                <TableHead className="text-center text-white font-semibold">
                  Value Gap
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tradeYears.map(year => {
                const yearTrades = orderedTrades.filter(row =>
                  row.date.startsWith(year)
                );
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
                              className={`h-4 w-4 text-orange-300 transition-transform ${isYearCollapsed ? "-rotate-90" : ""}`}
                              aria-hidden="true"
                            />
                            <span>{year}</span>
                          </span>
                          <span className="trade-year-count">
                            {yearTrades.length}{" "}
                            {yearTrades.length === 1 ? "trade" : "trades"}
                          </span>
                        </button>
                      </TableCell>
                    </TableRow>

                    {!isYearCollapsed &&
                      yearTrades.map(row => {
                        const idx = orderedTrades.indexOf(row);
                        const tradeEvaluation = buildTradeLedgerEvaluation(
                          row,
                          dynastyTimelines,
                          managerRosterIntelligence,
                          playerDetailsById,
                          draftPicks,
                          leagueValueMode
                        );
                        const { winners, loserName } = getTradeDisplaySides(
                          row,
                          tradeEvaluation
                        );
                        const tradeKey = `${row.date}-${row.team_a}-${row.team_b}-${idx}`;
                        const shouldSwapSummary =
                          stableTradeSeed(tradeKey) % 2 === 1;
                        const summaryManagers: [string, string] =
                          shouldSwapSummary
                            ? [row.team_b, row.team_a]
                            : [row.team_a, row.team_b];
                        const gapVerdict = getTradeGapVerdict(
                          tradeEvaluation.pointGap
                        );
                        const tradeLensNote = getTradeLensSourceNote(
                          row,
                          leagueValueMode
                        );
                        const fairnessSuggestion = buildTradeFairnessSuggestion(
                          row,
                          tradeEvaluation,
                          leagueValueMode
                        );
                        const openTradeDetail = () =>
                          setSelectedTradeDetail({
                            row,
                            sideOrder: summaryManagers,
                          });

                        return (
                          <React.Fragment key={`${tradeKey}-fragment`}>
                            <TableRow
                              key={`${tradeKey}-main`}
                              className="trade-ledger-row border-slate-700 hover:bg-slate-800/30 cursor-pointer"
                              role="button"
                              tabIndex={0}
                              aria-haspopup="dialog"
                              aria-label={`Open trade detail for ${row.date}: ${row.team_a} and ${row.team_b}`}
                              onClick={openTradeDetail}
                              onKeyDown={event => {
                                if (event.key !== "Enter" && event.key !== " ")
                                  return;
                                event.preventDefault();
                                openTradeDetail();
                              }}
                            >
                              <TableCell className="trade-date-cell text-slate-300 text-sm">
                                <div className="trade-date-main flex items-center gap-2">
                                  <ArrowRight
                                    className="trade-row-open-icon h-4 w-4 text-orange-300 transition-transform"
                                    aria-hidden="true"
                                  />
                                  <span>{row.date}</span>
                                  {tradeLensNote ? (
                                    <span
                                      className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200 md:inline-flex"
                                      title={tradeLensNote}
                                    >
                                      {isRedraft
                                        ? "Season Lens"
                                        : "Trade-Date Lens"}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="trade-mobile-summary">
                                  {renderTradeSummaryManager(
                                    summaryManagers[0],
                                    winners.includes(summaryManagers[0]),
                                    managerAvatars
                                  )}
                                  <span className="trade-mobile-vs">vs</span>
                                  {renderTradeSummaryManager(
                                    summaryManagers[1],
                                    winners.includes(summaryManagers[1]),
                                    managerAvatars
                                  )}
                                </div>
                                <div className="trade-row-open-copy">
                                  Open full trade detail
                                </div>
                              </TableCell>
                              <TableCell className="trade-ledger-manager-cell font-semibold text-sm text-orange-300">
                                {winners.map(winner => (
                                  <span key={winner}>
                                    {renderTradeLedgerManagerName(
                                      winner,
                                      managerAvatars,
                                      getTradeSideEvaluation(
                                        winner,
                                        tradeEvaluation
                                      ).lens
                                    )}
                                  </span>
                                ))}
                              </TableCell>
                              <TableCell className="trade-ledger-manager-cell font-semibold text-sm text-cyan-300">
                                {loserName === "Both Win"
                                  ? renderManagerName(loserName, managerAvatars)
                                  : renderTradeLedgerManagerName(
                                      loserName,
                                      managerAvatars,
                                      getTradeSideEvaluation(
                                        loserName,
                                        tradeEvaluation
                                      ).lens
                                    )}
                              </TableCell>
                              <TableCell className="trade-gap-cell text-center text-slate-300">
                                <span
                                  className={`trade-gap-verdict ${gapVerdict.className}`}
                                >
                                  {gapVerdict.label}
                                </span>
                                <span
                                  className="value-pill"
                                  title="Context-adjusted value gap"
                                >
                                  {tradeEvaluation.pointGap.toLocaleString()}
                                </span>
                                {fairnessSuggestion && (
                                  <span
                                    className="trade-row-balance-chip"
                                    title={getTradeFairnessSuggestionCopy(
                                      fairnessSuggestion
                                    )}
                                  >
                                    <span>Balancing Piece</span>
                                    <strong>
                                      {fairnessSuggestion.assetKind === "pick"
                                        ? fairnessSuggestion.pick?.label
                                        : fairnessSuggestion.player?.name}
                                    </strong>
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
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
      <Dialog
        open={selectedTradeDetail !== null}
        onOpenChange={open => {
          if (open) return;
          setSelectedTradeDetail(null);
        }}
      >
        <DialogContent className="trade-detail-modal max-h-[88vh] max-w-[calc(100vw-1rem)] overflow-y-auto border-cyan-300/20 bg-slate-950 p-3 text-slate-100 sm:max-w-4xl sm:p-5">
          <DialogHeader className="sr-only">
            <DialogTitle>Trade Ledger Detail</DialogTitle>
            <DialogDescription>
              Expanded trade ledger details for the selected trade.
            </DialogDescription>
          </DialogHeader>
          {selectedTradeDetail && (
            <TradeDetailPanel
              row={selectedTradeDetail.row}
              draftPicks={draftPicks}
              managerAvatars={managerAvatars}
              playerDetailsById={playerDetailsById}
              currentPositionRankById={currentPositionRankById}
              managerRosterIntelligence={managerRosterIntelligence}
              dynastyTimelines={dynastyTimelines}
              leagueOverview={leagueOverview}
              leagueDiagnostics={leagueDiagnostics}
              sideOrder={selectedTradeDetail.sideOrder}
              standingsHistory={standingsHistory}
              currentStandings={currentStandings}
              leagueValueMode={leagueValueMode}
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
        playerDetailsById={playerDetailsById}
      />
    </div>
  );
}
