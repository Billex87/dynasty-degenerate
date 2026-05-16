import React, { useState } from "react";
import type { DraftPick, ReportData } from "@shared/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlayerDetailModal, type PlayerModalData } from "../PlayerDetailModal";
import { EmptyState } from "../reportPrimitives";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import { type ManagerAvatars, type PlayerDetailsById } from "./shared";
import {
  TradeDetailPanel,
  buildTradeLedgerEvaluation,
  getManagerTradeEvaluationResult,
  getManagerTradeEvaluationSwing,
  getTradeDisplaySides,
  getTradeGapVerdict,
} from "./tradeLedgerUtils";

type CurrentPositionRankById = ReportData["currentPositionRankById"];
type DynastyTimelineRows = NonNullable<ReportData["dynastyTimelines"]>;
type LeagueOverviewRows = ReportData["leagueOverview"];

export default function TradeTheftDetector({
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
  leagueDiagnostics,
  currentStandings,
  standingsHistory,
  leagueValueMode = "dynasty",
}: {
  data: ReportData["tradeHistory"];
  managerAvatars?: ManagerAvatars;
  draftPicks?: DraftPick[];
  playerDetailsById?: PlayerDetailsById;
  currentPositionRankById?: CurrentPositionRankById;
  managerRosterIntelligence?: ReportData["managerRosterIntelligence"];
  dynastyTimelines?: DynastyTimelineRows;
  leagueOverview?: LeagueOverviewRows;
  leagueId?: string;
  leagueLogo?: string | null;
  leagueDiagnostics?: ReportData["leagueDiagnostics"];
  currentStandings?: ReportData["currentStandings"];
  standingsHistory?: ReportData["standingsHistory"];
  leagueValueMode?: ReportData["leagueValueMode"];
}) {
  const [selectedTrade, setSelectedTrade] = useState<
    ReportData["tradeHistory"][number] | null
  >(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );
  if (!data.length) {
    return (
      <EmptyState
        className="trade-empty-state"
        title="No completed trades found"
        description={
          normalizeLeagueValueMode(leagueValueMode) === "redraft"
            ? "There are no completed trades to balance-review yet. Once a trade is completed, this section will compare current-season value gaps."
            : "There are no completed trades to review yet. Once a trade is completed, this section will compare dynasty value gaps."
        }
      />
    );
  }

  const evaluatedTrades = data.map(trade => ({
    trade,
    evaluation: buildTradeLedgerEvaluation(
      trade,
      dynastyTimelines,
      managerRosterIntelligence,
      playerDetailsById,
      draftPicks,
      leagueValueMode
    ),
  }));
  const ordered = [...evaluatedTrades].sort(
    (a, b) => b.evaluation.pointGap - a.evaluation.pointGap
  );
  const managerSwings = evaluatedTrades.flatMap(({ trade, evaluation }) => [
    {
      trade,
      manager: trade.team_a,
      opponent: trade.team_b,
      swing: getManagerTradeEvaluationSwing(evaluation, trade.team_a),
      result: getManagerTradeEvaluationResult(evaluation, trade.team_a),
    },
    {
      trade,
      manager: trade.team_b,
      opponent: trade.team_a,
      swing: getManagerTradeEvaluationSwing(evaluation, trade.team_b),
      result: getManagerTradeEvaluationResult(evaluation, trade.team_b),
    },
  ]);
  const biggestGap = ordered[0];
  const cleanestDeal = [...evaluatedTrades].sort(
    (a, b) => a.evaluation.pointGap - b.evaluation.pointGap
  )[0];
  const bestSwing = [...managerSwings].sort((a, b) => b.swing - a.swing)[0];
  const worstSwing = [...managerSwings].sort((a, b) => a.swing - b.swing)[0];
  const robberyCount = evaluatedTrades.filter(
    ({ evaluation }) => evaluation.pointGap >= 1000
  ).length;
  const fairCount = evaluatedTrades.filter(
    ({ evaluation }) => evaluation.pointGap <= 300
  ).length;
  const avgGap = Math.round(
    evaluatedTrades.reduce(
      (sum, { evaluation }) => sum + evaluation.pointGap,
      0
    ) / data.length
  );
  const fairRate = Math.round((fairCount / data.length) * 100);
  const isRedraftTradeView =
    normalizeLeagueValueMode(leagueValueMode) === "redraft";

  const cards = [
    biggestGap && {
      key: "biggest-gap",
      eyebrow: isRedraftTradeView
        ? "Trade Balance Review"
        : "Trade Theft Detector",
      title: getTradeGapVerdict(biggestGap.evaluation.pointGap).label,
      value: biggestGap.evaluation.pointGap.toLocaleString(),
      copy: `${biggestGap.trade.date}: ${getTradeDisplaySides(biggestGap.trade, biggestGap.evaluation).winners.join(" + ")} got the biggest value gap.`,
      trade: biggestGap.trade,
      tone: "fire" as const,
    },
    cleanestDeal && {
      key: "cleanest-deal",
      eyebrow: "Cleanest Deal",
      title: getTradeGapVerdict(cleanestDeal.evaluation.pointGap).label,
      value: cleanestDeal.evaluation.pointGap.toLocaleString(),
      copy: `${cleanestDeal.trade.date}: ${cleanestDeal.trade.team_a} and ${cleanestDeal.trade.team_b} were closest to even.`,
      trade: cleanestDeal.trade,
      tone: "fair" as const,
    },
    bestSwing && {
      key: "best-swing",
      eyebrow: "Best One-Trade Profit",
      title: bestSwing.manager,
      value: `+${bestSwing.swing.toLocaleString()}`,
      copy: `${bestSwing.result} vs ${bestSwing.opponent} on ${bestSwing.trade.date}.`,
      trade: bestSwing.trade,
      tone: "good" as const,
    },
    worstSwing && {
      key: "worst-swing",
      eyebrow: "Biggest One-Trade Loss",
      title: worstSwing.manager,
      value: worstSwing.swing.toLocaleString(),
      copy: `${worstSwing.result} vs ${worstSwing.opponent} on ${worstSwing.trade.date}.`,
      trade: worstSwing.trade,
      tone: "danger" as const,
    },
    {
      key: "robbery-rate",
      eyebrow: "League Market",
      title: `${robberyCount} ${isRedraftTradeView ? "large gaps" : "spicy gaps"}`,
      value: avgGap.toLocaleString(),
      copy: `${robberyCount} of ${data.length} trades crossed a 1,000-point gap. Average ${isRedraftTradeView ? "current-season" : "dynasty"} gap is ${avgGap.toLocaleString()}.`,
      trade: biggestGap?.trade,
      tone:
        robberyCount >= Math.max(2, data.length * 0.25)
          ? ("fire" as const)
          : ("fair" as const),
    },
    {
      key: "fair-rate",
      eyebrow: "Handshake Rate",
      title: `${fairRate}% fair-ish`,
      value: `${fairCount}/${data.length}`,
      copy: `${fairCount} trades landed within 300 points, which is our current "nobody got smoked" range.`,
      trade: cleanestDeal?.trade,
      tone: "fair" as const,
    },
  ].filter(Boolean) as Array<{
    key: string;
    eyebrow: string;
    title: string;
    value: string;
    copy: string;
    trade?: ReportData["tradeHistory"][number] | null;
    tone: "fire" | "fair" | "good" | "danger";
  }>;

  return (
    <div className="trade-theft-wrap">
      <div className="trade-theft-grid">
        {cards.map(card => (
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

      <Dialog
        open={selectedTrade !== null}
        onOpenChange={open => !open && setSelectedTrade(null)}
      >
        <DialogContent className="trade-detail-modal max-h-[88vh] max-w-[calc(100vw-1rem)] overflow-y-auto border-cyan-300/20 bg-slate-950 p-3 text-slate-100 sm:max-w-3xl sm:p-5">
          <DialogHeader className="sr-only">
            <DialogTitle>Trade Theft Detail</DialogTitle>
            <DialogDescription>
              Expanded trade ledger for the selected value gap.
            </DialogDescription>
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
              leagueDiagnostics={leagueDiagnostics}
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
