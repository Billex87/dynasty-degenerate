import { type CSSProperties, type ReactNode } from "react";

import { ManagerTrendAvatar } from "@/components/ManagerTrendAvatar";
import { ReportTooltip } from "@/components/reportPrimitives";
import { StatTile } from "@/components/tiles";
import {
  DURATION,
  Odometer,
  formatCount,
  useCountUp,
  useMotionInViewOnce,
  useValueBlip,
} from "@/lib/motion";

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
export type DashboardMetricValueFormatter = (value: number) => string;

export type DashboardHeroMetric = {
  key: string;
  kind?: DashboardVisualMetricKind;
  label: string;
  value: ReactNode;
  numericValue?: number | null;
  valueFormatter?: DashboardMetricValueFormatter;
  subLabel?: ReactNode;
  helper?: ReactNode;
  score?: number | null;
  tone?: DashboardMetricTone;
  bars?: DashboardMetricBar[];
  badges?: DashboardMetricBadge[];
  targetManager?: string | null;
  avatarUrl?: string | null;
  managerTrendDelta?: number | null;
  deltaDirection?: "up" | "down" | "flat";
};

export type DashboardSpotlightBlock = {
  key: string;
  label: string;
  value: ReactNode;
  subLabel?: string;
  tone?: DashboardMetricTone;
};

function getFiniteMetricNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatDashboardAnimatedValue(
  value: number,
  formatter?: DashboardMetricValueFormatter
) {
  return formatter ? formatter(value) : formatCount(value);
}

function formatDashboardBlipDelta(
  delta: number,
  formatter?: DashboardMetricValueFormatter
) {
  const label = formatter ? formatter(delta) : formatCount(delta, { plus: true });
  return delta > 0 && !label.startsWith("+") ? `+${label}` : label;
}

function DashboardMetricValue({
  metric,
  mode = "count",
}: {
  metric: DashboardHeroMetric;
  mode?: "count" | "odometer";
}) {
  const numericValue = getFiniteMetricNumber(metric.numericValue);
  const { hasEntered, ref } = useMotionInViewOnce<HTMLSpanElement>();
  const countTarget = numericValue !== null && hasEntered ? numericValue : 0;
  const countedValue = useCountUp(countTarget, {
    durationMs: DURATION.count,
    formatter: metric.valueFormatter,
  });
  const blip = useValueBlip(numericValue, {
    deltaFormatter: delta => formatDashboardBlipDelta(delta, metric.valueFormatter),
  });

  if (numericValue === null) {
    return <>{metric.value}</>;
  }

  const finalValue = formatDashboardAnimatedValue(
    numericValue,
    metric.valueFormatter
  );

  return (
    <span
      className="dd-motion-count-value dd-value-blip-anchor"
      data-blip-direction={blip?.direction}
      ref={ref}
    >
      <span aria-hidden="true" className="dd-motion-count-reserve">
        {finalValue}
      </span>
      <span className="dd-motion-count-live">
        {mode === "odometer" ? (
          <Odometer
            value={countTarget}
            formatter={metric.valueFormatter}
          />
        ) : (
          countedValue
        )}
      </span>
      {blip && (
        <span
          key={blip.id}
          aria-hidden="true"
          className="dd-value-blip-floater"
          data-direction={blip.direction}
        >
          {blip.label}
        </span>
      )}
    </span>
  );
}

function getDashboardFallbackInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "DD";
}

export function DashboardManagerAvatar({
  manager,
  avatarUrl,
  trendDelta,
}: {
  manager: string;
  avatarUrl?: string | null;
  trendDelta?: number | null;
}) {
  return (
    <ManagerTrendAvatar manager={manager} trendDelta={trendDelta}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" aria-hidden="true" />
      ) : (
        <span aria-hidden="true">{getDashboardFallbackInitials(manager)}</span>
      )}
    </ManagerTrendAvatar>
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
  const leadingBarIndex = bars.reduce(
    (bestIndex, bar, index) =>
      Math.max(0, bar.value) > Math.max(0, bars[bestIndex]?.value || 0)
        ? index
        : bestIndex,
    0
  );
  const {
    animationsEnabled,
    hasEntered,
    ref: barsRef,
  } = useMotionInViewOnce<HTMLDivElement>();
  const animateIn = !animationsEnabled || hasEntered;

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
              trendDelta={metric.managerTrendDelta}
            />
          </div>
          <strong>
            <DashboardMetricValue metric={metric} />
          </strong>
        </div>
      ) : (
        <strong>
          <DashboardMetricValue metric={metric} />
        </strong>
      )}
      {bars.length ? (
        <div
          className="dashboard-mini-bars"
          data-animate-in={animateIn ? "true" : "false"}
          ref={barsRef}
          aria-hidden="true"
        >
          {bars.map((bar, index) => (
            <DashboardMiniBarRow
              animateValue={animateIn}
              bar={bar}
              index={index}
              isLead={index === leadingBarIndex}
              key={bar.label}
              maxValue={maxValue}
              tone={bar.tone || metric.tone || "info"}
            />
          ))}
        </div>
      ) : null}
    </StatTile>
  );
}

function DashboardMiniBarRow({
  animateValue,
  bar,
  index,
  isLead,
  maxValue,
  tone,
}: {
  animateValue: boolean;
  bar: DashboardMetricBar;
  index: number;
  isLead: boolean;
  maxValue: number;
  tone: DashboardMetricTone;
}) {
  const rawDisplayValue = bar.displayValue ?? bar.value;
  const numericDisplayValue =
    typeof rawDisplayValue === "number" && Number.isFinite(rawDisplayValue)
      ? rawDisplayValue
      : null;
  const countedValue = useCountUp(
    numericDisplayValue !== null && animateValue ? numericDisplayValue : 0,
    { durationMs: DURATION.count }
  );

  const barStyle = {
    "--dashboard-bar-score": `${Math.max(
      6,
      Math.round((Math.max(0, bar.value) / maxValue) * 100)
    )}%`,
    "--dd-motion-bar-delay": `${index * 120}ms`,
  } as CSSProperties;

  return (
    <div
      className="dashboard-mini-bar-row"
      data-lead={isLead ? "true" : undefined}
      data-tone={tone}
      style={barStyle}
    >
      <b>{bar.label}</b>
      <i>
        <span />
      </i>
      <em>{numericDisplayValue !== null ? countedValue : rawDisplayValue}</em>
    </div>
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
  const {
    animationsEnabled,
    hasEntered,
    ref: valueRef,
  } = useMotionInViewOnce<HTMLElement>();
  const direction = metric.deltaDirection || "flat";
  const shouldPulse = animationsEnabled && hasEntered && direction !== "flat";

  return (
    <StatTile
      className={`dashboard-metric-card dashboard-delta-metric ${
        shouldPulse ? "dd-motion-delta-pulse" : ""
      }`.trim()}
      tone={metric.tone || "neutral"}
      label={metric.label}
      helper={metric.helper}
      subLabel={metric.subLabel}
      data-direction={direction}
    >
      {metric.targetManager ? (
        <div className="dashboard-target-lockup">
          <div className="dashboard-target-avatar" aria-hidden="true">
            <DashboardManagerAvatar
              manager={metric.targetManager}
              avatarUrl={metric.avatarUrl}
              trendDelta={metric.managerTrendDelta}
            />
          </div>
          <ReportTooltip content={valueTitle}>
            <strong ref={valueRef} data-name-size={nameSize}>
              <DashboardMetricValue metric={metric} />
            </strong>
          </ReportTooltip>
        </div>
      ) : (
        <ReportTooltip content={valueTitle}>
          <strong ref={valueRef} data-name-size={nameSize}>
            <DashboardMetricValue metric={metric} />
          </strong>
        </ReportTooltip>
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
              trendDelta={metric.managerTrendDelta}
            />
          </div>
        )}
        <ReportTooltip content={valueTitle}>
          <strong data-name-size={nameSize}>
            <DashboardMetricValue metric={metric} />
          </strong>
        </ReportTooltip>
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
              trendDelta={metric.managerTrendDelta}
            />
          </div>
          <ReportTooltip content={valueTitle}>
            <strong data-name-size={nameSize}>
              <DashboardMetricValue metric={metric} />
            </strong>
          </ReportTooltip>
        </div>
      ) : (
        <ReportTooltip content={valueTitle}>
          <strong>
            <DashboardMetricValue metric={metric} />
          </strong>
        </ReportTooltip>
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
        value={
          <DashboardMetricValue
            metric={metric}
            mode={metric.key === "team-value" ? "odometer" : "count"}
          />
        }
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
        value={<DashboardMetricValue metric={metric} />}
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
      value={
        <DashboardMetricValue
          metric={metric}
          mode={metric.key === "team-value" ? "odometer" : "count"}
        />
      }
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
          className="dashboard-spotlight-focus-card dd-glass"
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
