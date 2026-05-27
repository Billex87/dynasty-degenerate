import type { ReactNode } from "react";
import type { PlayerDetails, ReportData } from "@shared/types";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  getPositionRankClass,
  getPositionRankPillClass,
} from "@/lib/positionRank";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import { ChampionAvatarFrame } from "../ManagerChampionships";
import { ManagerNameWithAvatar } from "../ManagerNameWithAvatar";
import type { PlayerModalData } from "../PlayerDetailModal";
import { EmptyState, MetricPill } from "../reportPrimitives";
import {
  getPlayerAvailability,
  getPlayerAvailabilityClass,
} from "@/lib/playerStatus";

export type ManagerAvatars = ReportData["managerAvatars"];
export type PlayerDetailsById = ReportData["playerDetailsById"];

export const VALUE_BLEND_HISTORY_START_LABEL = "May 7, 2026";
export const FIRST_FULL_BLEND_WEEK_LABEL = "May 12, 2026 after the 6 PM scrape";
const AI_NEURAL_SURFACE_CLASS = "ai-neural-surface";

export function getAiNeuralSurfaceClass(
  theme: string = "neutral",
  extraClassName = ""
) {
  return [
    "ai-surface-r3f",
    "ai-neural-surface-tron",
    AI_NEURAL_SURFACE_CLASS,
    `${AI_NEURAL_SURFACE_CLASS}-${theme}`,
    extraClassName,
  ]
    .filter(Boolean)
    .join(" ");
}

export function formatCompactValue(value: number | null | undefined): string {
  if (!value) return "-";
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}K`;
  return value.toLocaleString();
}

export function clampPercentValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeManagerKey(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\d+$/g, "");
}

export function PositionRankPill({ rank }: { rank?: string | null }) {
  const displayRank = rank || "-";
  return (
    <span className={getPositionRankPillClass(displayRank)}>{displayRank}</span>
  );
}

export function WaiverRankPill({
  label,
  rank,
  className = "",
}: {
  label: string;
  rank?: string | null;
  className?: string;
}) {
  if (!rank) return null;
  return (
    <span
      className={`waiver-intel-rank-pill ${className} ${getPositionRankClass(rank)}`}
    >
      <em>{label}</em>
      {rank}
    </span>
  );
}

export function TradeEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <EmptyState
      className="trade-empty-state"
      title={title}
      description={description}
    />
  );
}

export function renderManagerName(
  manager: string,
  managerAvatars?: ManagerAvatars
) {
  return (
    <ManagerNameWithAvatar
      avatarUrl={managerAvatars?.[manager]}
      managerName={manager}
    />
  );
}

export function getManagerHeadingClassName(
  manager: string | null | undefined
): string {
  const length = (manager || "").replace(/\s+/g, "").length;
  if (length >= 20) return "manager-modal-name manager-modal-name-xxlong";
  if (length >= 15) return "manager-modal-name manager-modal-name-xlong";
  if (length >= 10) return "manager-modal-name manager-modal-name-long";
  return "manager-modal-name";
}

export function getPlayerStatusLabel(details?: PlayerDetails | null): string {
  return getPlayerAvailability(details).label;
}

export function getPlayerStatusClass(details?: PlayerDetails | null): string {
  return getPlayerAvailabilityClass(details);
}

export function parsePositionRankValue(
  rank: string | null | undefined
): number | null {
  const match = String(rank || "").match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

export function IntelligenceMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "negative"
        ? "text-rose-300"
        : "text-slate-100";
  return (
    <div
      className={`intelligence-metric intelligence-metric-${tone} rounded-xl border border-cyan-300/15 bg-slate-950/45 px-3 py-2`}
    >
      <div className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-cyan-300/80">
        {label}
      </div>
      <div className={`mt-1 text-lg font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

export function OwnerMetricPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "good" | "warn" | "danger" | "info";
}) {
  return <MetricPill label={label} value={value} tone={tone} />;
}

export function CommandMiniBadge({
  children,
  tone = "neutral",
  className = "",
  title,
  as = "span",
}: {
  children: ReactNode;
  tone?: string | null;
  className?: string;
  title?: string;
  as?: "span" | "em";
}) {
  const Component = as;
  return (
    <Component
      className={`command-mini-badge command-mini-badge-${tone || "neutral"} ${className}`.trim()}
      title={title}
    >
      {children}
    </Component>
  );
}

export function TradeProposalMorePill({ count }: { count: number }) {
  return <span className="trade-proposal-more-pill">+{count} more</span>;
}

export function TradeProposalEmpty({ children }: { children: ReactNode }) {
  return <span className="trade-proposal-empty">{children}</span>;
}

export function TradeProposalAssetGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="trade-proposal-asset-group">
      <span className="trade-proposal-asset-label">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function OwnerSummaryTile({
  manager,
  avatarUrl,
  children,
  onClick,
  className = "",
}: {
  manager: string;
  avatarUrl?: string | null;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const isViewerTile = className.includes("viewer-owned-highlight");
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
        <ChampionAvatarFrame
          managerName={manager}
          className="owner-summary-avatar-frame"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={manager}
              className="owner-summary-avatar"
            />
          ) : (
            <span className="owner-summary-avatar">
              {manager[0]?.toUpperCase() || "?"}
            </span>
          )}
        </ChampionAvatarFrame>
        <span className="owner-summary-name-lockup">
          <span className="owner-summary-name">{manager}</span>
        </span>
      </span>
      <span className="owner-summary-metrics">{children}</span>
      {isViewerTile && (
        <span className="active-owner-badge">
          <span>Your</span>
          <span>Team</span>
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`owner-summary-tile owner-summary-button ${className}`}
        onClick={onClick}
        aria-label={`Open ${manager} owner details`}
      >
        {content}
      </button>
    );
  }

  return <div className={`owner-summary-tile ${className}`}>{content}</div>;
}

export function FeatureCard({
  number,
  title,
  kicker,
  note,
  children,
  className = "",
  hideNumber = false,
  hideHeader = false,
}: {
  number: number;
  title: string;
  kicker: string;
  note?: string;
  children: ReactNode;
  className?: string;
  hideNumber?: boolean;
  hideHeader?: boolean;
}) {
  return (
    <Card className={`command-feature-card ${className}`}>
      {!hideHeader && (
        <div className="command-feature-top">
          {!hideNumber && (
            <span className="command-feature-number">
              {String(number).padStart(2, "0")}
            </span>
          )}
          <div className="min-w-0">
            <p>{kicker}</p>
            <h3>{title}</h3>
          </div>
        </div>
      )}
      <div className="command-feature-body">{children}</div>
      {note && (
        <details className="command-feature-note">
          <summary>What this is based on</summary>
          <p>{note}</p>
        </details>
      )}
    </Card>
  );
}

export function renderActivityManagerAvatar(
  manager: string | null | undefined,
  managerAvatars?: ManagerAvatars
) {
  if (!manager) {
    return (
      <span
        className="activity-manager-avatar activity-manager-avatar-empty"
        aria-label="Available player"
        title="Available"
      >
        FA
      </span>
    );
  }

  const avatarUrl = managerAvatars?.[manager];
  const initial = manager.trim()[0]?.toUpperCase() || "?";

  return (
    <span
      className="activity-manager-avatar"
      aria-label={`Rostered by ${manager}`}
      title={manager}
    >
      <ChampionAvatarFrame managerName={manager} showAccolades={false}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" />
        ) : (
          <span aria-hidden="true" className="activity-manager-avatar-fallback">
            {initial}
          </span>
        )}
      </ChampionAvatarFrame>
    </span>
  );
}

export function ValueTrendIcon({
  value,
  className = "h-3.5 w-3.5",
}: {
  value?: number | null;
  className?: string;
}) {
  if (!value) return null;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return <Icon className={className} aria-hidden="true" />;
}

export function buildPlayerModalData({
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
  valueMode = "dynasty",
  taxiAction,
  taxiReason,
}: {
  playerId?: string;
  playerName: string;
  playerPos?: string;
  value?: number | null;
  valueGain?: number | null;
  playerDetailsById?: PlayerDetailsById;
  playerDetails?: PlayerModalData["playerDetails"];
  manager?: string | null;
  managerAvatarUrl?: string | null;
  valueChangeNote?: string;
  currentPositionRank?: string | null;
  valueMode?: ReportData["leagueValueMode"];
  taxiAction?: string | null;
  taxiReason?: string | null;
}): PlayerModalData {
  const normalizedValueMode = normalizeLeagueValueMode(valueMode);
  const mappedDetails = playerId ? playerDetailsById?.[playerId] : undefined;
  const details = playerDetails
    ? {
        ...mappedDetails,
        ...playerDetails,
        valueProfile: playerDetails.valueProfile || mappedDetails?.valueProfile,
        lastSeasonPositionRank:
          playerDetails.lastSeasonPositionRank ||
          mappedDetails?.lastSeasonPositionRank,
        lastSeasonFantasyPoints:
          playerDetails.lastSeasonFantasyPoints ??
          mappedDetails?.lastSeasonFantasyPoints,
        lastSeasonGames:
          playerDetails.lastSeasonGames ?? mappedDetails?.lastSeasonGames,
        lastSeasonPointsPerGame:
          playerDetails.lastSeasonPointsPerGame ??
          mappedDetails?.lastSeasonPointsPerGame,
        lastSeasonYear:
          playerDetails.lastSeasonYear || mappedDetails?.lastSeasonYear,
        availabilityHistory: playerDetails.availabilityHistory?.length
          ? playerDetails.availabilityHistory
          : mappedDetails?.availabilityHistory,
        latestNews: playerDetails.latestNews || mappedDetails?.latestNews,
        avgGamesMissed:
          playerDetails.avgGamesMissed ?? mappedDetails?.avgGamesMissed,
        availabilitySeasons:
          playerDetails.availabilitySeasons ??
          mappedDetails?.availabilitySeasons,
        similarTradeValues:
          playerDetails.similarTradeValues || mappedDetails?.similarTradeValues,
        rosterStatus: playerDetails.rosterStatus || mappedDetails?.rosterStatus,
        displayStatus:
          (playerDetails.rosterStatus
            ? playerDetails.displayStatus
            : mappedDetails?.displayStatus) || playerDetails.displayStatus,
        depthChartPosition: mappedDetails?.depthChartVerified
          ? mappedDetails.depthChartPosition
          : (playerDetails.depthChartPosition ??
            mappedDetails?.depthChartPosition),
        depthChartOrder: mappedDetails?.depthChartVerified
          ? mappedDetails.depthChartOrder
          : (playerDetails.depthChartOrder ?? mappedDetails?.depthChartOrder),
        sleeperDepthChartPosition:
          mappedDetails?.sleeperDepthChartPosition ??
          playerDetails.sleeperDepthChartPosition,
        sleeperDepthChartOrder:
          mappedDetails?.sleeperDepthChartOrder ??
          playerDetails.sleeperDepthChartOrder,
        depthChartVerified:
          mappedDetails?.depthChartVerified ?? playerDetails.depthChartVerified,
        depthChartMismatch:
          mappedDetails?.depthChartMismatch ?? playerDetails.depthChartMismatch,
      }
    : mappedDetails;
  const profileRank =
    normalizedValueMode === "redraft"
      ? details?.valueProfile?.seasonPositionRank ||
        details?.valueProfile?.fantasyProsPositionRank ||
        details?.valueProfile?.dynastyPositionRank
      : details?.valueProfile?.dynastyPositionRank ||
        details?.valueProfile?.balancedPositionRank ||
        details?.valueProfile?.seasonPositionRank;
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
    valueMode: normalizedValueMode,
    taxiAction: taxiAction || undefined,
    taxiReason: taxiReason || undefined,
  };
}
