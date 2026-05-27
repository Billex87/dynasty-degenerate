import { type ReactNode } from "react";
import type {
  ManagerIntelPlayer,
  ReportData,
} from "@shared/types";
import { PlayerNameWithHeadshot } from "../PlayerNameWithHeadshot";
import type { PlayerModalData } from "../PlayerDetailModal";
import { getTeamTileStyle } from "@/lib/teamTileStyle";
import {
  formatCompactValue,
  PositionRankPill,
  TradeFairnessCardDisplay,
  TradeOutcomeAssetLine,
  TradeOutcomePanelDisplay,
  type TradeBuildLens,
  type ManagerAvatars,
  type PlayerDetailsById,
  buildPlayerModalData,
  TradeSideManager,
} from "./shared";

export type TradeOutcomeAsset = {
  id: string;
  label: string;
  name: string;
  kind: "player" | "pick";
  value: number;
  basisValue: number;
  valueDelta: number;
  seasonValue: number;
  rank?: string | null;
  detail?: string | null;
  outcomeNote?: string | null;
  status?: string | null;
  playerId?: string;
  children?: TradeOutcomeAsset[];
};

export type TradeOutcomeSide = {
  manager: string;
  side: {
    manager: string;
    items: string;
    total: number;
    isWinner: boolean;
  };
  evaluation: {
    total: number;
    lens: {
      mode: string;
      label: string;
      tone: "contender" | "rebuilder" | "middle";
      reason: string;
    };
    values: number[];
    adjustment: number;
  };
  assets: TradeOutcomeAsset[];
  assetValue: number;
  basisValue: number;
  valueDelta: number;
  seasonValue: number;
};

export type TradeOutcomeRecord = {
  manager: string;
  seasons: string[];
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  latestRank: number | null;
};

export type TradeOutcomeReview = {
  statusLabel: string;
  windowLabel: string;
  windowSubtitle: string;
  observedThroughLabel: string;
  verdict: string;
  metrics: Array<{
    label: string;
    value: string;
    note: string;
    tone: "good" | "bad" | "neutral";
  }>;
  notes: string[];
  sides: TradeOutcomeSide[];
  records: TradeOutcomeRecord[];
};

export type TradeFairnessSuggestion = {
  fromManager: string;
  toManager: string;
  gap: number;
  player: ManagerIntelPlayer;
  displayRank?: string | null;
  displayValue?: number | null;
};

export type TradeOutcomeSideCard = {
  manager: string;
  isWinner: boolean;
  total: number;
  lens: TradeBuildLens;
  managerAvatarUrl?: string | null;
  itemNodes: ReactNode[];
  adjustmentNode?: ReactNode;
  overviewImpactNode: ReactNode;
  fitReadNode?: ReactNode;
};

export function renderOutcomeAssetLine(asset: TradeOutcomeAsset) {
  return <TradeOutcomeAssetLine asset={asset} />;
}

export function TradeOutcomePanel({ outcome }: { outcome: TradeOutcomeReview }) {
  return (
    <TradeOutcomePanelDisplay
      outcome={outcome}
      renderAssetLine={(asset: unknown) =>
        renderOutcomeAssetLine(asset as TradeOutcomeAsset)
      }
    />
  );
}

export function getTradeFairnessSuggestionCopy(
  suggestion: TradeFairnessSuggestion
): string {
  return `${suggestion.fromManager} should have added ${suggestion.player.name} to ${suggestion.toManager}'s side to make this trade closer to even.`;
}

export function TradeFairnessCard({
  suggestion,
  leagueValueMode,
  managerAvatars,
  playerDetailsById,
  onPlayerClick,
}: {
  suggestion: TradeFairnessSuggestion;
  leagueValueMode: ReportData["leagueValueMode"];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  onPlayerClick?: (player: PlayerModalData) => void;
}) {
  const playerDetails =
    suggestion.player.playerDetails ||
    playerDetailsById?.[suggestion.player.player_id];

  return (
    <TradeFairnessCardDisplay
      description={getTradeFairnessSuggestionCopy(suggestion)}
      tileStyle={getTeamTileStyle(playerDetails?.team)}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        if (!onPlayerClick) return;
        onPlayerClick(
          buildPlayerModalData({
            playerId: suggestion.player.player_id,
            playerName: suggestion.player.name,
            playerPos: suggestion.player.pos,
            value: suggestion.player.value,
            playerDetails,
            playerDetailsById,
            manager: suggestion.player.owner || suggestion.fromManager,
            managerAvatarUrl: managerAvatars?.[suggestion.fromManager],
            currentPositionRank:
              suggestion.player.currentPositionRank ||
              suggestion.player.seasonPositionRank,
          })
        );
      }}
      metric={
        leagueValueMode === "redraft" ? (
          <span className="trade-fairness-value">
            {formatCompactValue(suggestion.displayValue)}
          </span>
        ) : (
          <PositionRankPill
            rank={suggestion.displayRank || suggestion.player.pos}
          />
        )
      }
    >
      <PlayerNameWithHeadshot
        playerId={suggestion.player.player_id}
        playerName={suggestion.player.name}
        team={playerDetails?.team}
        position={suggestion.player.pos}
      />
    </TradeFairnessCardDisplay>
  );
}

export function TradeDetailPanel({
  valueGap,
  tradeLensNote,
  fairnessSuggestion,
  outcomeReview,
  managerAvatars,
  playerDetailsById,
  leagueValueMode,
  onPlayerClick,
  sideCards,
}: {
  valueGap: number;
  tradeLensNote?: string | null;
  fairnessSuggestion?: TradeFairnessSuggestion | null;
  outcomeReview: TradeOutcomeReview;
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueValueMode: ReportData["leagueValueMode"];
  onPlayerClick?: (player: PlayerModalData) => void;
  sideCards: TradeOutcomeSideCard[];
}) {
  return (
    <div className="trade-detail-panel">
      <div className="trade-detail-header">
        <div className="trade-detail-heading">
          <div className="trade-detail-kicker">Trade Detail</div>
          <div className="trade-detail-title">Trade Ledger</div>
          {tradeLensNote && (
            <p className="mt-1 max-w-xl text-xs text-cyan-200/75">
              {tradeLensNote}
            </p>
          )}
        </div>
        <div
          className={`trade-detail-decision-bar ${fairnessSuggestion ? "trade-detail-decision-bar-with-balance" : ""}`}
        >
          <div className="trade-detail-gap">
            <span>Value Gap</span>
            <strong>{valueGap.toLocaleString()}</strong>
            <small>context-adjusted edge</small>
          </div>
          {fairnessSuggestion && (
            <TradeFairnessCard
              suggestion={fairnessSuggestion}
              leagueValueMode={leagueValueMode}
              managerAvatars={managerAvatars}
              playerDetailsById={playerDetailsById}
              onPlayerClick={onPlayerClick}
            />
          )}
        </div>
      </div>
      <TradeOutcomePanel outcome={outcomeReview} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {sideCards.map(side => (
          <div
            key={side.manager}
            className={`trade-side ${side.isWinner ? "trade-side-winner" : "trade-side-loser"}`}
          >
            {side.managerAvatarUrl && (
              <img
                src={side.managerAvatarUrl || ""}
                alt=""
                className="trade-side-watermark"
              />
            )}
            <div className="trade-side-header relative flex items-center justify-between gap-3 border-b border-orange-300/15 pb-3">
              <div className="min-w-0">
                <span
                  className={`trade-side-label ${side.isWinner ? "trade-side-label-win" : "trade-side-label-other"}`}
                >
                  {side.isWinner ? "Winner" : "Other Side"}
                </span>
              </div>
            <TradeSideManager
                manager={side.manager}
                isWinner={side.isWinner}
                managerAvatars={managerAvatars}
                buildLens={side.lens || undefined}
              />
              <div
                className={`trade-side-total ${side.isWinner ? "trade-side-total-win" : "trade-side-total-other"}`}
              >
                <span>Total</span>
                <strong>{side.total.toLocaleString()}</strong>
              </div>
            </div>
            <div className="relative pt-3">
              <div className="trade-side-assets text-sm text-slate-300">
                {side.itemNodes}
                {side.adjustmentNode}
              </div>
              {side.overviewImpactNode}
              {side.fitReadNode}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
