import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DashboardManagerAvatar,
  DashboardSpotlightFocusGrid,
  DashboardVisualMetric,
  type DashboardHeroMetric,
  type DashboardSpotlightBlock,
} from "@/features/report/components/ReportDashboardMetrics";

export type DashboardSpotlightRankCard = {
  position: string;
  rank: number | null;
};

export type DashboardSpotlightStarterGroup = {
  key: string;
  label: string;
  position: string;
  tier: string;
  rank: number | null;
};

export type DashboardSpotlightConfig = {
  eyebrow: string;
  metrics: DashboardHeroMetric[];
  blocks: DashboardSpotlightBlock[];
  chips: string[];
  readTitle: string;
  read: string;
};

type ReportDashboardSpotlightProps = {
  manager: string;
  managerAvatarUrl?: string | null;
  spotlightConfig: DashboardSpotlightConfig;
  positionRankCards: DashboardSpotlightRankCard[];
  starterRankGroups: DashboardSpotlightStarterGroup[];
  swapSignals: string[];
  isOverviewSpotlight: boolean;
  hasSpecialTeamRanks: boolean;
  variant?: "sidebar" | "inline";
};

function formatDashboardRank(rank: number | null): string {
  return rank === null ? "#-" : `#${rank}`;
}

function getReportDashboardSpotlightClassName({
  variant,
  inlineSpotlightOpen,
}: {
  variant: "sidebar" | "inline";
  inlineSpotlightOpen: boolean;
}) {
  if (variant !== "inline") {
    return `report-dashboard-spotlight report-dashboard-spotlight-${variant}`;
  }

  return [
    "report-dashboard-spotlight-inline",
    inlineSpotlightOpen
      ? "report-dashboard-spotlight"
      : "dashboard-spotlight-inline-glass",
  ]
    .filter(Boolean)
    .join(" ");
}

export function ReportDashboardSpotlight({
  manager,
  managerAvatarUrl,
  spotlightConfig,
  positionRankCards,
  starterRankGroups,
  swapSignals,
  isOverviewSpotlight,
  hasSpecialTeamRanks,
  variant = "sidebar",
}: ReportDashboardSpotlightProps) {
  const [inlineSpotlightOpen, setInlineSpotlightOpen] = useState(false);
  const rankGridClassName = hasSpecialTeamRanks
    ? "dashboard-rank-grid dashboard-rank-grid-special"
    : "dashboard-rank-grid";

  const spotlightHeader = (
    <div className="dashboard-spotlight-header">
      <span className="dashboard-spotlight-avatar">
        <DashboardManagerAvatar
          manager={manager}
          avatarUrl={managerAvatarUrl}
        />
      </span>
      <div>
        <span>{spotlightConfig.eyebrow}</span>
        <strong>{manager}</strong>
      </div>
    </div>
  );

  const spotlightBody = (
    <>
      <div className="dashboard-spotlight-metrics">
        {spotlightConfig.metrics.map(metric => (
          <DashboardVisualMetric key={metric.key} metric={metric} />
        ))}
      </div>
      {isOverviewSpotlight ? (
        <>
          <div className="dashboard-position-rank-block">
            <span>Full Roster Position Ranks</span>
            <div className={rankGridClassName}>
              {positionRankCards.map(({ position, rank }) => (
                <span key={position} data-position={position}>
                  <em>{position}</em>
                  <strong>{formatDashboardRank(rank)}</strong>
                </span>
              ))}
            </div>
          </div>
          {starterRankGroups.length > 0 && (
            <div className="dashboard-starter-ranks">
              <span>Projected Starter Slot Ranks</span>
              <div className={rankGridClassName}>
                {starterRankGroups.map(group => (
                  <span key={group.key} data-position={group.position}>
                    <em>{group.label}</em>
                    <strong>{formatDashboardRank(group.rank)}</strong>
                    <b>{group.tier}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <DashboardSpotlightFocusGrid blocks={spotlightConfig.blocks} />
      )}
      {spotlightConfig.chips.length > 0 && (
        <div className="dashboard-spotlight-chip-row">
          {spotlightConfig.chips.map(chip => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      )}
      {isOverviewSpotlight && swapSignals.length > 0 && (
        <div className="dashboard-swap-signals">
          <span>Start/Sit Swap Signals</span>
          {swapSignals.slice(0, 2).map(signal => (
            <p key={signal}>{signal}</p>
          ))}
        </div>
      )}
      <div className="dashboard-spotlight-read">
        <span>{spotlightConfig.readTitle}</span>
        <p>{spotlightConfig.read}</p>
      </div>
    </>
  );

  if (variant === "inline") {
    return (
      <details
        className={getReportDashboardSpotlightClassName({
          variant,
          inlineSpotlightOpen,
        })}
        aria-label="Manager spotlight"
        onToggle={event => setInlineSpotlightOpen(event.currentTarget.open)}
      >
        <summary className="dashboard-spotlight-inline-summary">
          {spotlightHeader}
          <span className="dashboard-spotlight-inline-copy">
            <strong>{spotlightConfig.chips[0] || "Manager context"}</strong>
            <span>{spotlightConfig.readTitle}</span>
          </span>
          <ChevronDown
            className="dashboard-spotlight-inline-icon"
            aria-hidden="true"
          />
        </summary>
        <div className="dashboard-spotlight-inline-body">
          {spotlightBody}
        </div>
      </details>
    );
  }

  return (
    <aside
      className={`report-dashboard-spotlight report-dashboard-spotlight-${variant}`}
      aria-label="Manager spotlight"
    >
      {spotlightHeader}
      {spotlightBody}
    </aside>
  );
}
