import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import type {
  ManagerIntelPlayer,
  PlayerDetails,
  ReportData,
} from "@shared/types";
import { Crown, TrendingDown, TrendingUp } from "lucide-react";
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
export type TradeBuildLens = {
  label: string;
  tone: "contender" | "rebuilder" | "middle";
  reason: string;
};
export type TradeFitReadDisplay = {
  manager: string;
  label: string;
  note: string;
  tone: "good" | "warn" | "neutral";
  target?: ManagerIntelPlayer | null;
};
export type TradeOutcomePanelData = {
  statusLabel: string;
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
  sides: Array<{
    manager: string;
    evaluation: { total: number };
    assets: unknown[];
  }>;
};
export type TradeOutcomeAssetLineData = {
  id: string;
  label: string;
  name: string;
  kind: "player" | "pick";
  valueDelta: number;
  children?: Array<{ name: string }>;
};
export type TradeImpactPill = {
  label: string;
  tone?: "neutral" | "good" | "warn" | "danger" | "info";
};
export type TradeGapVerdict = {
  label: string;
  className: string;
};

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

export function TradeHabitPill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`trade-habit-pill ${className}`.trim()}>{children}</span>
  );
}

export function TradeValuePill({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span className={`value-pill ${className}`.trim()} title={title}>
      {children}
    </span>
  );
}

export function TradeSummaryManager({
  manager,
  isWinner,
  managerAvatars,
}: {
  manager: string;
  isWinner: boolean;
  managerAvatars?: ManagerAvatars;
}) {
  const avatarUrl = managerAvatars?.[manager];
  const initial = manager.trim()[0]?.toUpperCase() || "?";

  return (
    <span
      className={`trade-mobile-manager ${isWinner ? "trade-mobile-winner" : "trade-mobile-loser"}`}
    >
      <span className="report-identity-chip manager-chip flex min-w-0 items-center gap-2">
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
          {isWinner && (
            <Crown className="trade-winner-crown" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0">{manager}</span>
      </span>
    </span>
  );
}

export function TradeBuildPill({ lens }: { lens: TradeBuildLens }) {
  return (
    <span
      className={`trade-build-pill trade-build-pill-${lens.tone}`}
      title={lens.reason}
    >
      {lens.label}
    </span>
  );
}

export function TradeSideManager({
  manager,
  isWinner,
  managerAvatars,
  buildLens,
}: {
  manager: string;
  isWinner: boolean;
  managerAvatars?: ManagerAvatars;
  buildLens?: TradeBuildLens;
}) {
  const avatarUrl = managerAvatars?.[manager];
  const initial = manager.trim()[0]?.toUpperCase() || "?";

  return (
    <span
      className={`trade-side-manager ${isWinner ? "trade-side-manager-winner" : "trade-side-manager-other"}`}
    >
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
        {isWinner && (
          <Crown className="trade-winner-crown" aria-hidden="true" />
        )}
      </span>
      <span className="trade-side-manager-lockup">
        <span className="trade-side-manager-name">{manager}</span>
        {buildLens && <TradeBuildPill lens={buildLens} />}
      </span>
    </span>
  );
}

export function TradeLedgerManagerName({
  manager,
  managerAvatars,
  buildLens,
}: {
  manager: string;
  managerAvatars?: ManagerAvatars;
  buildLens?: TradeBuildLens;
}) {
  return (
    <span className="trade-ledger-manager-lockup">
      {renderManagerName(manager, managerAvatars)}
      {buildLens && <TradeBuildPill lens={buildLens} />}
    </span>
  );
}

export function TradeFitReadManager({
  manager,
  managerAvatars,
}: {
  manager: string;
  managerAvatars?: ManagerAvatars;
}) {
  const avatarUrl = managerAvatars?.[manager];
  const initial = manager.trim()[0]?.toUpperCase() || "?";

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

export function TradeFitReadCard({
  read,
  managerAvatars,
  playerDetailsById,
  onPlayerClick,
}: {
  read: TradeFitReadDisplay;
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  onPlayerClick?: (player: PlayerModalData) => void;
}) {
  return (
    <div
      key={read.manager}
      className={`trade-fit-read trade-fit-read-${read.tone}`}
    >
      <div className="trade-fit-read-top">
        <span>{read.label}</span>
        <TradeFitReadManager
          manager={read.manager}
          managerAvatars={managerAvatars}
        />
      </div>
      <p>{read.note}</p>
      {read.target && (
        <button
          type="button"
          className="trade-fit-target"
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            if (!onPlayerClick) return;
            onPlayerClick(
              buildPlayerModalData({
                playerId: read.target?.player_id,
                playerName: read.target?.name || "",
                playerPos: read.target?.pos,
                value: read.target?.value,
                playerDetails: read.target?.playerDetails,
                playerDetailsById,
                manager: read.target?.owner,
                currentPositionRank:
                  read.target?.seasonPositionRank ||
                  read.target?.currentPositionRank,
              })
            );
          }}
        >
          <span className="trade-fit-target-label">
            Trade-date target: {read.target.name}
          </span>
          <PositionRankPill
            rank={
              read.target.seasonPositionRank ||
              read.target.currentPositionRank ||
              read.target.pos
            }
          />
        </button>
      )}
    </div>
  );
}

export function TradeOutcomePanelDisplay({
  outcome,
  renderAssetLine,
}: {
  outcome: TradeOutcomePanelData;
  renderAssetLine: (asset: unknown) => ReactNode;
}) {
  return (
    <div className="trade-outcome-card">
      <div className="trade-outcome-header">
        <div>
          <span className="trade-outcome-kicker">{outcome.statusLabel}</span>
          <h4>True Trade Outcome</h4>
          <p>
            {outcome.windowSubtitle}. Observed through{" "}
            {outcome.observedThroughLabel}.
          </p>
        </div>
        <span className="trade-outcome-status">{outcome.statusLabel}</span>
      </div>
      <p className="trade-outcome-verdict">{outcome.verdict}</p>
      <div className="trade-outcome-metrics">
        {outcome.metrics.map(metric => (
          <div
            key={metric.label}
            className={`trade-outcome-metric trade-outcome-metric-${metric.tone}`}
          >
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </div>
        ))}
      </div>
      <div className="trade-outcome-sides">
        {outcome.sides.map(side => (
          <div key={side.manager} className="trade-outcome-side">
            <div className="trade-outcome-side-top">
              <span>{side.manager}</span>
              <strong>{side.evaluation.total.toLocaleString()}</strong>
            </div>
            <ul>{side.assets.slice(0, 4).map(renderAssetLine)}</ul>
          </div>
        ))}
      </div>
      <ul className="trade-outcome-notes">
        {outcome.notes.map(note => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

export function formatOutcomeDeltaLabel(value: number): string {
  if (value === 0) return "No change";
  return `${value > 0 ? "Gained" : "Lost"} ${Math.abs(value).toLocaleString()}`;
}

export function getTradeLensNumber(
  value: number | null | undefined
): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

export function parseTradeOutcomeDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

export function formatOutcomeDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function getOutcomePlayerSeasonValue(details?: PlayerDetails): number {
  return (
    getTradeLensNumber(
      details?.valueProfile?.seasonValue ??
        details?.valueProfile?.fantasyProsSeasonValue
    ) ??
    getTradeLensNumber(details?.lastSeasonFantasyPoints) ??
    0
  );
}

export function getOutcomeAssetStatus(details?: PlayerDetails): string | null {
  const status = getPlayerAvailability(details).label;
  if (status && !/^(active|healthy)$/i.test(status)) return status;
  const avgMissed = getTradeLensNumber(details?.avgGamesMissed);
  if (avgMissed && avgMissed >= 3) return `${avgMissed} avg missed games`;
  return null;
}

export function TradeOutcomeAssetLine({
  asset,
  extraBadge,
}: {
  asset: TradeOutcomeAssetLineData;
  extraBadge?: ReactNode;
}) {
  const resolvedText =
    asset.kind === "pick" && asset.name && asset.name !== asset.label
      ? ` -> ${asset.name}`
      : "";
  const childText = asset.children?.length
    ? ` -> ${asset.children.map(child => child.name).join(" + ")}`
    : resolvedText;

  return (
    <li key={asset.id}>
      <span>
        {asset.label}
        {childText}
        {extraBadge}
      </span>
      <strong
        className={
          asset.valueDelta > 0
            ? "text-emerald-300"
            : asset.valueDelta < 0
              ? "text-rose-300"
              : "text-slate-300"
        }
        title="Current value minus the value at the time of the trade"
      >
        <span className="trade-outcome-change-label">Value change</span>
        <span>{formatOutcomeDeltaLabel(asset.valueDelta)}</span>
      </strong>
    </li>
  );
}

export function TradeSideImpactRead({
  pills,
  notes,
}: {
  pills: TradeImpactPill[];
  notes: string[];
}) {
  if (pills.length === 0 && notes.length === 0) return null;

  return (
    <div className="trade-side-impact">
      <div className="trade-side-impact-read">
        {pills.length > 0 && (
          <div className="trade-side-impact-pill-row">
            {pills.map(pill => (
              <CommandMiniBadge key={pill.label} tone={pill.tone}>
                {pill.label}
              </CommandMiniBadge>
            ))}
          </div>
        )}
        {notes.length > 0 && <p>{notes.join(" ")}</p>}
      </div>
    </div>
  );
}

export function TradeFairnessCardDisplay({
  description,
  tileStyle,
  disabled = false,
  onClick,
  children,
  metric,
}: {
  description: string;
  tileStyle?: CSSProperties;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
  metric: ReactNode;
}) {
  return (
    <div className="trade-fairness-card">
      <div>
        <span>Balancing Piece</span>
        <p>{description}</p>
      </div>
      <button
        type="button"
        className="trade-fairness-player"
        style={tileStyle}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
        {metric}
      </button>
    </div>
  );
}

export function getTradeGapVerdict(
  gap: number,
  {
    largeFireLabel = "Explain That",
  }: {
    largeFireLabel?: string;
  } = {}
): TradeGapVerdict {
  if (gap === 0)
    return { label: "Even Steven", className: "trade-gap-verdict-even" };
  if (gap < 100)
    return { label: "Coin Flip", className: "trade-gap-verdict-even" };
  if (gap < 200)
    return { label: "Tiny Tax", className: "trade-gap-verdict-soft" };
  if (gap < 350)
    return { label: "Tip Jar", className: "trade-gap-verdict-soft" };
  if (gap < 500)
    return { label: "Pocket Change", className: "trade-gap-verdict-soft" };
  if (gap < 650)
    return { label: "Lunch Money", className: "trade-gap-verdict-medium" };
  if (gap < 800)
    return { label: "Got Finessed", className: "trade-gap-verdict-medium" };
  if (gap < 1000)
    return { label: "Sneaky L", className: "trade-gap-verdict-medium" };
  if (gap < 1250)
    return { label: "Ouch Tax", className: "trade-gap-verdict-hot" };
  if (gap < 1500)
    return { label: "Got Robbed", className: "trade-gap-verdict-hot" };
  if (gap < 1750)
    return { label: "Trade Mugging", className: "trade-gap-verdict-hot" };
  if (gap < 2000)
    return { label: "Hide the Chat", className: "trade-gap-verdict-hot" };
  if (gap < 2250)
    return { label: "Call 911", className: "trade-gap-verdict-fire" };
  if (gap < 2500)
    return { label: "League Probe", className: "trade-gap-verdict-fire" };
  if (gap < 2750)
    return { label: "Veto Bait", className: "trade-gap-verdict-fire" };
  if (gap < 3000)
    return { label: largeFireLabel, className: "trade-gap-verdict-fire" };
  if (gap < 3500)
    return { label: "Crime Scene", className: "trade-gap-verdict-nuclear" };
  if (gap < 4000)
    return { label: "Witness Needed", className: "trade-gap-verdict-nuclear" };
  if (gap < 5000)
    return { label: "Delete the App", className: "trade-gap-verdict-nuclear" };
  if (gap < 6000)
    return { label: "Call the Lawyer", className: "trade-gap-verdict-nuclear" };
  if (gap < 7500)
    return {
      label: "Generational Fleece",
      className: "trade-gap-verdict-nuclear",
    };
  return { label: "Eternal Shame", className: "trade-gap-verdict-nuclear" };
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
