import { type CSSProperties, type ReactNode } from "react";

import { StatTile } from "@/components/tiles";

export type DashboardMetricTone = "neutral" | "info" | "good" | "warn" | "danger";
export type DashboardVisualMetricKind =
  | "standard"
  | "ring"
  | "meter"
  | "bars"
  | "delta"
  | "target"
  | "badges";
export type DashboardMetricBar = {
  label: string;
  value: number;
  displayValue?: ReactNode;
  tone?: DashboardMetricTone;
};
export type DashboardMetricBadge = {
  label: ReactNode;
  tone?: DashboardMetricTone;
};

export type DashboardHeroMetric = {
  key: string;
  kind?: DashboardVisualMetricKind;
  label: string;
  value: ReactNode;
  subLabel?: ReactNode;
  helper?: ReactNode;
  score?: number | null;
  tone?: DashboardMetricTone;
  bars?: DashboardMetricBar[];
  badges?: DashboardMetricBadge[];
  targetManager?: string | null;
  avatarUrl?: string | null;
  deltaDirection?: "up" | "down" | "flat";
};

export type DashboardSpotlightBlock = {
  key: string;
  label: string;
  value: ReactNode;
  subLabel?: string;
  tone?: DashboardMetricTone;
};

function getDashboardFallbackInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "DD";
}

export function DashboardManagerAvatar({
  manager,
  avatarUrl,
}: {
  manager: string;
  avatarUrl?: string | null;
}) {
  return avatarUrl ? (
    <img src={avatarUrl} alt="" aria-hidden="true" />
  ) : (
    <span aria-hidden="true">{getDashboardFallbackInitials(manager)}</span>
  );
}

export function DashboardMetricCard({
  label,
  value,
  subLabel,
  tone = "neutral",
  className = "",
  helper,
}: {
  label: string;
  value: ReactNode;
  subLabel?: ReactNode;
  tone?: DashboardMetricTone;
  className?: string;
  helper?: ReactNode;
}) {
  return (
    <StatTile
      tone={tone}
      className={`dashboard-metric-card ${className}`.trim()}
      label={label}
      value={value}
      subLabel={subLabel}
      helper={helper}
    />
  );
}

export function DashboardRingMetric({
  title,
  value,
  score,
  label,
  tone = "good",
  helper,
}: {
  title: ReactNode;
  value?: ReactNode;
  score: number | null;
  label: ReactNode;
  tone?: "info" | "good" | "warn" | "danger";
  helper?: ReactNode;
}) {
  const clampedScore =
    score === null ? 0 : Math.max(0, Math.min(100, Math.round(score)));
  const graphStyle = {
    "--dashboard-balance-score": `${clampedScore}%`,
  } as CSSProperties;
  const metricValue = value ?? score ?? "-";

  return (
    <StatTile
      className="dashboard-metric-card dashboard-balance-metric"
      tone={tone}
      label={title}
      subLabel={label}
      helper={helper}
      size="md"
    >
      <div className="dashboard-balance-graph">
        <i style={graphStyle} aria-hidden="true" />
        <strong>{metricValue}</strong>
      </div>
    </StatTile>
  );
}

export function DashboardBalanceMetric({
  score,
  label,
}: {
  score: number | null;
  label: string;
}) {
  return (
    <DashboardRingMetric
      title="League Balance"
      score={score}
      label={label}
      tone={
        score === null
          ? "info"
          : score >= 65
            ? "good"
            : score >= 50
              ? "warn"
              : "danger"
      }
    />
  );
}

export function DashboardMeterMetric({
  label,
  value,
  subLabel,
  score,
  tone = "info",
  helper,
}: {
  label: string;
  value: ReactNode;
  subLabel?: ReactNode;
  score: number | null;
  tone?: "info" | "good" | "warn" | "danger";
  helper?: ReactNode;
}) {
  const clampedScore =
    score === null ? 0 : Math.max(0, Math.min(100, Math.round(score)));

  return (
    <StatTile
      className="dashboard-metric-card dashboard-meter-metric"
      tone={tone}
      label={label}
      value={value}
      subLabel={subLabel}
      helper={helper}
    >
      <i
        style={{
          "--dashboard-meter-score": `${clampedScore}%`,
        } as CSSProperties}
        aria-hidden="true"
      />
    </StatTile>
  );
}

export function DashboardMiniBarStack({ metric }: { metric: DashboardHeroMetric }) {
  const bars = (metric.bars || []).slice(0, 4);
  const maxValue = Math.max(1, ...bars.map(bar => Math.max(0, bar.value)));

  return (
    <StatTile
      className="dashboard-metric-card dashboard-mini-bar-stack"
      tone={metric.tone || "neutral"}
      label={metric.label}
      subLabel={metric.subLabel}
      helper={metric.helper}
    >
      {metric.targetManager ? (
        <div className="dashboard-target-lockup">
          <div className="dashboard-target-avatar" aria-hidden="true">
            <DashboardManagerAvatar
              manager={metric.targetManager}
              avatarUrl={metric.avatarUrl}
            />
          </div>
          <strong>{metric.value}</strong>
        </div>
      ) : (
        <strong>{metric.value}</strong>
      )}
      {bars.length ? (
        <div className="dashboard-mini-bars" aria-hidden="true">
          {bars.map(bar => (
            <div
              key={bar.label}
              className="dashboard-mini-bar-row"
              data-tone={bar.tone || metric.tone || "info"}
            >
              <b>{bar.label}</b>
              <i>
                <span
                  style={
                    {
                      "--dashboard-bar-score": `${Math.max(
                        6,
                        Math.round((Math.max(0, bar.value) / maxValue) * 100)
                      )}%`,
                    } as CSSProperties
                  }
                />
              </i>
              <em>{bar.displayValue ?? bar.value}</em>
            </div>
          ))}
        </div>
      ) : null}
    </StatTile>
  );
}

function getDashboardVisualNameSize(value: ReactNode) {
  if (typeof value !== "string") return "normal";
  const length = value.trim().length;
  if (length >= 18) return "micro";
  if (length >= 14) return "tight";
  if (length >= 10) return "compact";
  return "normal";
}

export function DashboardDeltaMetric({ metric }: { metric: DashboardHeroMetric }) {
  const valueTitle =
    typeof metric.value === "string" ? metric.value : undefined;
  const nameSize = getDashboardVisualNameSize(metric.value);

  return (
    <StatTile
      className="dashboard-metric-card dashboard-delta-metric"
      tone={metric.tone || "neutral"}
      label={metric.label}
      helper={metric.helper}
      subLabel={metric.subLabel}
      data-direction={metric.deltaDirection || "flat"}
    >
      {metric.targetManager ? (
        <div className="dashboard-target-lockup">
          <div className="dashboard-target-avatar" aria-hidden="true">
            <DashboardManagerAvatar
              manager={metric.targetManager}
              avatarUrl={metric.avatarUrl}
            />
          </div>
          <strong title={valueTitle} data-name-size={nameSize}>
            {metric.value}
          </strong>
        </div>
      ) : (
        <strong title={valueTitle} data-name-size={nameSize}>
          {metric.value}
        </strong>
      )}
    </StatTile>
  );
}

export function DashboardTargetMetric({ metric }: { metric: DashboardHeroMetric }) {
  const valueTitle =
    typeof metric.value === "string" ? metric.value : undefined;
  const nameSize = getDashboardVisualNameSize(metric.value);

  return (
    <StatTile
      className="dashboard-metric-card dashboard-target-metric"
      tone={metric.tone || "neutral"}
      label={metric.label}
      subLabel={metric.subLabel}
      helper={metric.helper}
    >
      <div className="dashboard-target-lockup">
        {metric.targetManager && (
          <div className="dashboard-target-avatar" aria-hidden="true">
            <DashboardManagerAvatar
              manager={metric.targetManager}
              avatarUrl={metric.avatarUrl}
            />
          </div>
        )}
        <strong title={valueTitle} data-name-size={nameSize}>
          {metric.value}
        </strong>
      </div>
      {metric.badges?.length ? (
        <div className="dashboard-metric-badges">
          {metric.badges.slice(0, 3).map((badge, index) => (
            <b key={index} data-tone={badge.tone || metric.tone || "info"}>
              {badge.label}
            </b>
          ))}
        </div>
      ) : null}
    </StatTile>
  );
}

export function DashboardBadgeListMetric({
  metric,
}: {
  metric: DashboardHeroMetric;
}) {
  const valueTitle =
    typeof metric.value === "string" ? metric.value : undefined;
  const nameSize = getDashboardVisualNameSize(metric.value);

  return (
    <StatTile
      className="dashboard-metric-card dashboard-badge-list-metric"
      tone={metric.tone || "neutral"}
      label={metric.label}
      subLabel={metric.subLabel}
      helper={metric.helper}
    >
      {metric.targetManager ? (
        <div className="dashboard-target-lockup">
          <div className="dashboard-target-avatar" aria-hidden="true">
            <DashboardManagerAvatar
              manager={metric.targetManager}
              avatarUrl={metric.avatarUrl}
            />
          </div>
          <strong title={valueTitle} data-name-size={nameSize}>
            {metric.value}
          </strong>
        </div>
      ) : (
        <strong title={valueTitle}>{metric.value}</strong>
      )}
      {metric.badges?.length ? (
        <div className="dashboard-metric-badges">
          {metric.badges.slice(0, 4).map((badge, index) => (
            <b key={index} data-tone={badge.tone || metric.tone || "info"}>
              {badge.label}
            </b>
          ))}
        </div>
      ) : null}
    </StatTile>
  );
}

function getDashboardVisualTone(
  tone?: DashboardMetricTone
): "info" | "good" | "warn" | "danger" {
  if (tone === "good" || tone === "warn" || tone === "danger") return tone;
  return "info";
}

export function DashboardVisualMetric({
  metric,
}: {
  metric: DashboardHeroMetric;
}) {
  const tone = metric.tone || "neutral";

  if (metric.kind === "ring") {
    return (
      <DashboardRingMetric
        title={metric.label}
        value={metric.value}
        score={metric.score ?? null}
        label={metric.subLabel || ""}
        tone={getDashboardVisualTone(tone)}
        helper={metric.helper}
      />
    );
  }

  if (metric.kind === "meter") {
    return (
      <DashboardMeterMetric
        label={metric.label}
        value={metric.value}
        subLabel={metric.subLabel}
        score={metric.score ?? null}
        tone={getDashboardVisualTone(tone)}
        helper={metric.helper}
      />
    );
  }

  if (metric.kind === "bars") {
    return <DashboardMiniBarStack metric={metric} />;
  }

  if (metric.kind === "delta") {
    return <DashboardDeltaMetric metric={metric} />;
  }

  if (metric.kind === "target") {
    return <DashboardTargetMetric metric={metric} />;
  }

  if (metric.kind === "badges") {
    return <DashboardBadgeListMetric metric={metric} />;
  }

  return (
    <DashboardMetricCard
      label={metric.label}
      value={metric.value}
      subLabel={metric.subLabel}
      tone={tone}
      helper={metric.helper}
    />
  );
}

export function DashboardSpotlightFocusGrid({
  blocks,
}: {
  blocks: DashboardSpotlightBlock[];
}) {
  if (!blocks.length) return null;

  return (
    <div className="dashboard-spotlight-focus-grid">
      {blocks.map(block => (
        <StatTile
          key={block.key}
          className="dashboard-spotlight-focus-card"
          tone={block.tone || "neutral"}
          label={block.label}
          value={block.value}
          subLabel={block.subLabel}
          size="sm"
          data-tone={block.tone || "neutral"}
        />
      ))}
    </div>
  );
}
