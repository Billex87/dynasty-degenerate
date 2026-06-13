import { useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  CardTile,
  CompactTile,
  StatTile,
} from "@/components/tiles";
import type { TileTone } from "@/components/tiles/tileUtils";
import {
  DashboardManagerAvatar,
  DashboardVisualMetric,
  type DashboardHeroMetric,
  type DashboardSpotlightBlock,
  type DashboardSpotlightPlayerCard,
} from "@/features/report/components/ReportDashboardMetrics";
import { useAnimationsEnabled, useTilt } from "@/lib/motion";
import { formatMarketCompactValue } from "@/features/report/lib/marketMotion";

export type DashboardSpotlightRankCard = {
  position: string;
  rank: number | null;
  tier: string;
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
  managerTrendDelta?: number | null;
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
    return `report-dashboard-spotlight report-dashboard-spotlight-${variant} dd-glass`;
  }

  return [
    "report-dashboard-spotlight-inline",
    inlineSpotlightOpen
      ? "report-dashboard-spotlight dd-glass"
      : "dashboard-spotlight-inline-glass dd-glass",
  ]
    .filter(Boolean)
    .join(" ");
}

function renderDashboardRankCard({
  position,
  rank,
  tier,
  key: itemKey,
}: DashboardSpotlightRankCard & {
  key?: string;
}) {
  return (
    <span
      key={itemKey || position}
      data-position={position}
      className="dashboard-position-rank-card dashboard-rank-stack"
    >
      <em className="dashboard-rank-position">{position}</em>
      <strong className="dashboard-rank-value">{formatDashboardRank(rank)}</strong>
      <b className="dashboard-rank-tier">{tier}</b>
    </span>
  );
}

function getSpotlightChipTone(chip: string): TileTone {
  const normalized = chip.toLowerCase();
  const leadingNumber = Number(normalized.match(/^-?\d+/)?.[0] ?? NaN);

  if (normalized.includes("miss") || normalized.includes("loss") || normalized.includes("drop")) {
    return Number.isFinite(leadingNumber) && leadingNumber <= 0 ? "good" : "danger";
  }

  if (normalized.includes("hit") || normalized.includes("starter") || normalized.includes("win")) {
    return "good";
  }

  if (normalized.includes("watch") || normalized.includes("risk")) {
    return "warn";
  }

  return "brand";
}

function getNodeText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return "Spotlight card";
}

function getSpotlightPlayerValueLabel(
  player: DashboardSpotlightPlayerCard | null | undefined,
  fallback?: ReactNode,
) {
  if (player?.valueLabel) return player.valueLabel;
  if (typeof player?.value === "number" && Number.isFinite(player.value)) {
    return formatMarketCompactValue(player.value);
  }
  return getNodeText(fallback);
}

function getSpotlightPlayerStatRows(
  block: DashboardSpotlightBlock,
): Array<{ label: string; value: string }> {
  const player = block.player;
  return [
    {
      label: "Pos Rank",
      value: player?.positionRank || player?.position || block.subLabel || "-",
    },
    {
      label: "Age",
      value:
        typeof player?.age === "number" && Number.isFinite(player.age)
          ? player.age.toFixed(1).replace(/\.0$/, "")
          : "-",
    },
    {
      label: "Trend",
      value: player?.trend || block.subLabel || "-",
    },
    {
      label: "Tier",
      value:
        player?.tier !== null && player?.tier !== undefined
          ? String(player.tier)
          : block.label,
    },
  ];
}

function SpotlightFlipCard({ block }: { block: DashboardSpotlightBlock }) {
  const [flipped, setFlipped] = useState(false);
  const animationsEnabled = useAnimationsEnabled();
  const playerName = block.player?.name || getNodeText(block.value);
  const valueLabel = getSpotlightPlayerValueLabel(block.player, block.subLabel);
  const statRows = getSpotlightPlayerStatRows(block);
  const statSummary = statRows
    .map(row => `${row.label}: ${row.value}`)
    .join("; ");

  return (
    <button
      type="button"
      className="dashboard-spotlight-flip-card dd-pressable"
      data-animated={animationsEnabled ? "true" : undefined}
      data-flipped={flipped ? "true" : undefined}
      data-tone={block.tone || "neutral"}
      aria-pressed={flipped}
      aria-label={`${block.label}: ${playerName}. ${statSummary}.`}
      onClick={() => setFlipped(current => !current)}
    >
      <span className="dashboard-spotlight-flip-inner">
        <span className="dashboard-spotlight-flip-face dashboard-spotlight-flip-front">
          <span>{block.label}</span>
          <strong>{playerName}</strong>
          <b>{valueLabel}</b>
          <em>{block.player?.position || block.subLabel || "Featured asset"}</em>
        </span>
        <span className="dashboard-spotlight-flip-face dashboard-spotlight-flip-back">
          <span>Stat splits</span>
          <strong>{playerName}</strong>
          <span className="dashboard-spotlight-flip-stat-grid">
            {statRows.map(row => (
              <span key={row.label}>
                <em>{row.label}</em>
                <b>{row.value}</b>
              </span>
            ))}
          </span>
        </span>
      </span>
    </button>
  );
}

function SpotlightFlipGrid({ blocks }: { blocks: DashboardSpotlightBlock[] }) {
  if (!blocks.length) return null;

  return (
    <div className="dashboard-spotlight-flip-grid">
      {blocks.map(block => (
        <SpotlightFlipCard key={block.key} block={block} />
      ))}
    </div>
  );
}

export function ReportDashboardSpotlight({
  manager,
  managerAvatarUrl,
  managerTrendDelta,
  spotlightConfig,
  positionRankCards,
  starterRankGroups,
  swapSignals,
  isOverviewSpotlight,
  hasSpecialTeamRanks,
  variant = "sidebar",
}: ReportDashboardSpotlightProps) {
  const [inlineSpotlightOpen, setInlineSpotlightOpen] = useState(false);
  const spotlightTiltRef = useRef<HTMLElement | null>(null);
  const tilt = useTilt(spotlightTiltRef, { maxX: 8, maxY: 10 });
  const setSpotlightTiltRef = (node: HTMLElement | null) => {
    spotlightTiltRef.current = node;
  };
  const rankGridClassName = hasSpecialTeamRanks
    ? "dashboard-position-ranks dashboard-rank-grid dashboard-rank-grid-special"
    : "dashboard-position-ranks dashboard-rank-grid";

  const spotlightHeader = (
    <div className="dashboard-spotlight-header">
      <span className="dashboard-spotlight-avatar" style={tilt.avatarStyle}>
        <DashboardManagerAvatar
          manager={manager}
          avatarUrl={managerAvatarUrl}
          trendDelta={managerTrendDelta}
        />
      </span>
      <div style={tilt.copyStyle}>
        <span>{spotlightConfig.eyebrow}</span>
        <strong>{manager}</strong>
      </div>
    </div>
  );

  const spotlightBody = (
    <>
      <div className="dashboard-spotlight-metrics" style={tilt.copyStyle}>
        {spotlightConfig.metrics.map(metric => (
          <DashboardVisualMetric key={metric.key} metric={metric} />
        ))}
      </div>
      {isOverviewSpotlight ? (
        <>
          <div className="dashboard-position-rank-block" style={tilt.copyStyle}>
            <span>Full Roster Position Ranks</span>
            <div className={rankGridClassName}>
              {positionRankCards.map(({ position, rank, tier }) =>
                renderDashboardRankCard({ position, rank, tier })
              )}
            </div>
          </div>
          {starterRankGroups.length > 0 && (
            <div className="dashboard-starter-ranks" style={tilt.copyStyle}>
              <span>Projected Starter Slot Ranks</span>
              <div className={rankGridClassName}>
                {starterRankGroups.map(group =>
                  renderDashboardRankCard({
                    ...group,
                    key: group.key,
                  })
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <SpotlightFlipGrid blocks={spotlightConfig.blocks} />
      )}
      {spotlightConfig.chips.length > 0 && (
        <div className="dashboard-spotlight-chip-row" style={tilt.copyStyle}>
          {spotlightConfig.chips.map(chip => (
            <CompactTile
              key={chip}
              as="span"
              title={chip}
              tone={getSpotlightChipTone(chip)}
              size="sm"
              className="dashboard-spotlight-chip"
            />
          ))}
        </div>
      )}
      {isOverviewSpotlight && swapSignals.length > 0 && (
        <div className="dashboard-swap-signals" style={tilt.copyStyle}>
          <span>Start/Sit Swap Signals</span>
          {swapSignals.slice(0, 2).map(signal => (
            <StatTile
              key={signal}
              as="p"
              tone="warning"
              size="sm"
              value={signal}
              className="dashboard-swap-signal-item"
              style={{ overflowWrap: "anywhere" }}
            />
          ))}
        </div>
      )}
      <div className="dashboard-spotlight-read" style={tilt.copyStyle}>
        <span>{spotlightConfig.readTitle}</span>
        <p>{spotlightConfig.read}</p>
      </div>
    </>
  );

  if (variant === "inline") {
    return (
      <details
        ref={setSpotlightTiltRef}
        className={getReportDashboardSpotlightClassName({
          variant,
          inlineSpotlightOpen,
        })}
        data-tilt={tilt.enabled ? "true" : undefined}
        aria-label="Manager spotlight"
        onToggle={event => setInlineSpotlightOpen(event.currentTarget.open)}
        style={tilt.cardStyle}
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
        <CardTile as="div" className="dashboard-spotlight-inline-body">
          {spotlightBody}
        </CardTile>
      </details>
    );
  }

  return (
    <div
      ref={setSpotlightTiltRef}
      className="report-dashboard-spotlight-tilt-shell"
      data-tilt={tilt.enabled ? "true" : undefined}
      style={tilt.cardStyle}
    >
      <CardTile
        as="aside"
        className={`report-dashboard-spotlight report-dashboard-spotlight-${variant} dd-glass`}
        tone="brand"
        aria-label="Manager spotlight"
      >
        {spotlightHeader}
        {spotlightBody}
      </CardTile>
    </div>
  );
}
