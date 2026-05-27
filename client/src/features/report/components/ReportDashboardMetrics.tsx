import type { CSSProperties, ReactNode } from "react";

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
  subLabel?: string;
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
  subLabel?: string;
  tone?: DashboardMetricTone;
  className?: string;
  helper?: ReactNode;
}) {
  return (
    <div
      className={`dashboard-metric-card ${className}`.trim()}
      data-tone={tone}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      {subLabel && <em>{subLabel}</em>}
      {helper && <small>{helper}</small>}
    </div>
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
  title: string;
  value?: ReactNode;
  score: number | null;
  label: string;
  tone?: "info" | "good" | "warn" | "danger";
  helper?: ReactNode;
}) {
  const clampedScore =
    score === null ? 0 : Math.max(0, Math.min(100, Math.round(score)));
  const graphStyle = {
    "--dashboard-balance-score": `${clampedScore}%`,
  } as CSSProperties;

  return (
    <div
      className="dashboard-metric-card dashboard-balance-metric"
      data-tone={tone}
    >
      <span>{title}</span>
      <div className="dashboard-balance-graph">
        <i style={graphStyle} aria-hidden="true" />
        <strong>{value ?? score ?? "-"}</strong>
      </div>
      <em>{label}</em>
      {helper && <small>{helper}</small>}
    </div>
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
  subLabel?: string;
  score: number | null;
  tone?: "info" | "good" | "warn" | "danger";
  helper?: ReactNode;
}) {
  const clampedScore =
    score === null ? 0 : Math.max(0, Math.min(100, Math.round(score)));

  return (
    <div className="dashboard-metric-card dashboard-meter-metric" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <i
        style={{ "--dashboard-meter-score": `${clampedScore}%` } as CSSProperties}
        aria-hidden="true"
      />
      {subLabel && <em>{subLabel}</em>}
      {helper && <small>{helper}</small>}
    </div>
  );
}

export function DashboardMiniBarStack({ metric }: { metric: DashboardHeroMetric }) {
  const bars = (metric.bars || []).slice(0, 4);
  const maxValue = Math.max(1, ...bars.map(bar => Math.max(0, bar.value)));

  return (
    <div
      className="dashboard-metric-card dashboard-mini-bar-stack"
      data-tone={metric.tone || "neutral"}
    >
      <span>{metric.label}</span>
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
      {metric.subLabel && <em>{metric.subLabel}</em>}
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
      {metric.helper && <small>{metric.helper}</small>}
    </div>
  );
}

function getDashboardTargetNameSize(value: ReactNode) {
  if (typeof value !== "string") return "normal";
  const length = value.trim().length;
  if (length >= 18) return "micro";
  if (length >= 14) return "tight";
  if (length >= 10) return "compact";
  return "normal";
}

export function DashboardDeltaMetric({ metric }: { metric: DashboardHeroMetric }) {
  const valueTitle = typeof metric.value === "string" ? metric.value : undefined;
  const nameSize = getDashboardTargetNameSize(metric.value);

  return (
    <div
      className="dashboard-metric-card dashboard-delta-metric"
      data-tone={metric.tone || "neutral"}
      data-direction={metric.deltaDirection || "flat"}
    >
      <span>{metric.label}</span>
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
      {metric.subLabel && <em>{metric.subLabel}</em>}
      {metric.helper && <small>{metric.helper}</small>}
    </div>
  );
}

export function DashboardTargetMetric({ metric }: { metric: DashboardHeroMetric }) {
  const valueTitle = typeof metric.value === "string" ? metric.value : undefined;
  const nameSize = getDashboardTargetNameSize(metric.value);

  return (
    <div
      className="dashboard-metric-card dashboard-target-metric"
      data-tone={metric.tone || "neutral"}
    >
      <span>{metric.label}</span>
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
      {metric.subLabel && <em>{metric.subLabel}</em>}
      {metric.badges?.length ? (
        <div className="dashboard-metric-badges">
          {metric.badges.slice(0, 3).map((badge, index) => (
            <b key={index} data-tone={badge.tone || metric.tone || "info"}>
              {badge.label}
            </b>
          ))}
        </div>
      ) : null}
      {metric.helper && <small>{metric.helper}</small>}
    </div>
  );
}

export function DashboardBadgeListMetric({
  metric,
}: {
  metric: DashboardHeroMetric;
}) {
  const valueTitle = typeof metric.value === "string" ? metric.value : undefined;
  const nameSize = getDashboardTargetNameSize(metric.value);

  return (
    <div
      className="dashboard-metric-card dashboard-badge-list-metric"
      data-tone={metric.tone || "neutral"}
    >
      <span>{metric.label}</span>
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
      {metric.subLabel && <em>{metric.subLabel}</em>}
      {metric.badges?.length ? (
        <div className="dashboard-metric-badges">
          {metric.badges.slice(0, 4).map((badge, index) => (
            <b key={index} data-tone={badge.tone || metric.tone || "info"}>
              {badge.label}
            </b>
          ))}
        </div>
      ) : null}
      {metric.helper && <small>{metric.helper}</small>}
    </div>
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
        <div
          key={block.key}
          className="dashboard-spotlight-focus-card"
          data-tone={block.tone || "neutral"}
        >
          <span>{block.label}</span>
          <strong>{block.value}</strong>
          {block.subLabel && <em>{block.subLabel}</em>}
        </div>
      ))}
    </div>
  );
}
