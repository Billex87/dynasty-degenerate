import type { ReactNode } from "react";
import { X as XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  ChampionAvatarFrame,
  ManagerChampionshipPills,
} from "../ManagerChampionships";
import {
  CommandMiniBadge,
  getManagerHeadingClassName,
  IntelligenceMetric,
} from "./shared";

type OwnerSignalTone =
  | "neutral"
  | "dynasty"
  | "contender"
  | "rebuilder"
  | "good"
  | "contender-gold"
  | "warn"
  | "danger"
  | "future"
  | "elite"
  | "balanced"
  | "weak-contender"
  | "weak-rebuilder"
  | "squeak";
type OwnerSignalTag = {
  label: string;
  tone?: OwnerSignalTone;
};

export function ManagerDepthTile({
  manager,
  avatarUrl,
  badges,
  subtitle,
  subtitleTone = "neutral",
  scoreStrip,
  onClick,
  className = "",
}: {
  manager: string;
  avatarUrl?: string | null;
  badges: OwnerSignalTag[];
  subtitle?: string | null;
  subtitleTone?: OwnerSignalTone;
  scoreStrip?: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  const isViewerTile = className.includes("viewer-owned-highlight");
  const orderedBadges = orderOwnerBadgesForCompactRows(badges);

  return (
    <button
      type="button"
      className={`command-depth-tile ${className}`}
      onClick={onClick}
      aria-label={`Open ${manager} manager details`}
    >
      {avatarUrl && (
        <>
          <img src={avatarUrl} alt="" className="command-depth-tile-wash" />
          <img src={avatarUrl} alt="" className="command-depth-tile-mark" />
        </>
      )}
      <span className="command-depth-tile-scrim" />
      <span className="command-depth-tile-main">
        <ChampionAvatarFrame
          managerName={manager}
          className="command-depth-champion"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={manager}
              className="command-depth-avatar"
            />
          ) : (
            <span className="command-depth-avatar">
              {manager[0]?.toUpperCase() || "?"}
            </span>
          )}
        </ChampionAvatarFrame>
        <span className="command-depth-copy">
          <span className="command-depth-name">{manager}</span>
          {subtitle && (
            <span
              className={`command-depth-subtitle command-depth-subtitle-${subtitleTone}`}
            >
              {subtitle}
            </span>
          )}
        </span>
      </span>
      {scoreStrip && <span className="command-depth-score-row">{scoreStrip}</span>}
      <span className="command-depth-badges">
        {orderedBadges.map(badge => (
          <CommandMiniBadge key={badge.label} tone={badge.tone}>
            {badge.label}
          </CommandMiniBadge>
        ))}
      </span>
      {isViewerTile && (
        <span className="active-owner-badge">
          <span>Your</span>
          <span>Team</span>
        </span>
      )}
    </button>
  );
}

export function orderOwnerBadgesForCompactRows(badges: OwnerSignalTag[]) {
  const remaining = [...badges].sort((a, b) => b.label.length - a.label.length);
  const ordered: OwnerSignalTag[] = [];

  while (remaining.length) {
    const longest = remaining.shift();
    if (longest) ordered.push(longest);

    const shortest = remaining.pop();
    if (shortest) ordered.push(shortest);
  }

  return ordered;
}

export function OwnerQuickModal({
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
  metrics: Array<{
    label: string;
    value: ReactNode;
    tone?: "neutral" | "positive" | "negative";
  }>;
  note?: string;
}) {
  if (!manager) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="owner-quick-modal manager-command-dialog max-w-2xl border-cyan-300/20 bg-slate-950 p-0 text-slate-100"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {manager} {title}
          </DialogTitle>
          <DialogDescription>Owner detail summary.</DialogDescription>
        </DialogHeader>
        <div className="manager-command-modal-inner">
          <div className="manager-command-hero owner-quick-hero">
            {avatarUrl && (
              <>
                <img src={avatarUrl} alt="" className="manager-hero-wash" />
                <img
                  src={avatarUrl}
                  alt=""
                  className="manager-hero-watermark"
                />
              </>
            )}
            <div className="manager-hero-scrim" />
            <button
              type="button"
              className="manager-modal-close"
              onClick={() => onOpenChange(false)}
              aria-label={`Close ${manager} details`}
            >
              <XIcon aria-hidden="true" />
            </button>
            <div className="manager-command-title-lockup">
              <ChampionAvatarFrame
                managerName={manager}
                className="manager-command-champion-frame"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={manager}
                    className="manager-command-avatar"
                  />
                ) : (
                  <span className="manager-command-avatar">
                    {manager[0]?.toUpperCase() || "?"}
                  </span>
                )}
              </ChampionAvatarFrame>
              <div className="min-w-0">
                <p>{title}</p>
                <h3 className={getManagerHeadingClassName(manager)}>
                  {manager}
                </h3>
                <ManagerChampionshipPills
                  managerName={manager}
                  className="manager-command-championships"
                />
              </div>
            </div>
            <div className="manager-command-hero-metrics owner-quick-metrics">
              {metrics.slice(0, 6).map(metric => (
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
