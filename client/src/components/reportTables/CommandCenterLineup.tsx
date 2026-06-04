import { LockKeyhole } from "lucide-react";
import type { ManagerIntelPlayer, PlayerDetails, ReportData } from "@shared/types";

import { getPlayerAvailability } from "@/lib/playerStatus";
import { getTeamTileStyle } from "@/lib/teamTileStyle";
import {
  clampPercentValue,
  formatCompactValue,
  parsePositionRankValue,
  PositionRankPill,
} from "./shared";
import { getSwapFitLabel } from "./lineupUtils";
import { PlayerNameWithHeadshot } from "../PlayerNameWithHeadshot";
import { TeamLogoPill } from "../TeamLogoPill";

type CountPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

export type CommandPlayer =
  | ManagerIntelPlayer
  | NonNullable<
      ReportData["managerPositionCounts"][number]["starterPlayers"]
    >[number];

export type LineupSwapSeverity = "watch" | "recommended" | "urgent";

export type LineupSwapOption = {
  player: CommandPlayer;
  confidencePct: number;
  scoreEdge: number;
  projectedPointEdge: number | null;
  fitLabel: string;
  reason: string;
  reasonBullets: string[];
};

export type LineupSwapRecommendation = {
  starterOut: CommandPlayer;
  groupLabel: string;
  severity: LineupSwapSeverity;
  summary: string;
  options: LineupSwapOption[];
};

export type CommandSwapSignal = {
  role: "out" | "in";
  confidencePct: number;
  label: string;
  detail?: string;
};

export function getCommandPlayerValueLens(
  player: Pick<ManagerIntelPlayer, "seasonValue" | "value">
) {
  const hasSeasonValue =
    typeof player.seasonValue === "number" &&
    Number.isFinite(player.seasonValue) &&
    player.seasonValue > 0;
  return {
    label: hasSeasonValue ? "Season" : "Dynasty",
    value: hasSeasonValue ? Number(player.seasonValue) : player.value,
    className: hasSeasonValue
      ? "manager-command-season-value"
      : "manager-command-season-value manager-command-dynasty-value",
    kind: hasSeasonValue ? ("season" as const) : ("dynasty" as const),
  };
}

export function getCommandPlayerDynastyLens(player: CommandPlayer) {
  const profile = player.playerDetails?.valueProfile;
  return {
    value:
      profile?.dynastyValue ?? profile?.balancedValue ?? player.value ?? null,
    rank:
      profile?.dynastyPositionRank ||
      profile?.balancedPositionRank ||
      player.currentPositionRank ||
      null,
  };
}

export function getCommandPlayerSeasonLens(player: CommandPlayer) {
  const profile = player.playerDetails?.valueProfile;
  return {
    value:
      player.seasonValue ??
      profile?.seasonValue ??
      profile?.fantasyProsSeasonValue ??
      null,
    rank:
      player.seasonPositionRank ||
      profile?.seasonPositionRank ||
      profile?.fantasyProsPositionRank ||
      null,
  };
}

export function getCommandPlayerProjectionRead(player: CommandPlayer): {
  projectedPoints: number | null;
  sourceLabel: string | null;
} {
  const playerRecord = player as unknown as Record<string, unknown>;
  const details = player.playerDetails as
    | (PlayerDetails & Record<string, unknown>)
    | undefined;
  const valueProfile = details?.valueProfile as
    | (NonNullable<PlayerDetails["valueProfile"]> & Record<string, unknown>)
    | undefined;

  const projectedPoints = getFirstFiniteNumber(
    playerRecord.weeklyProjection,
    playerRecord.projectedPoints,
    playerRecord.projectedFantasyPoints,
    playerRecord.projection,
    playerRecord.fantasyProjection,
    details?.weeklyProjection,
    details?.projectedPoints,
    details?.projectedFantasyPoints,
    details?.projection,
    details?.fantasyProjection,
    valueProfile?.weeklyProjection,
    valueProfile?.projectedPoints,
    valueProfile?.projectedFantasyPoints,
    valueProfile?.fantasyProsProjection,
    valueProfile?.fantasyProsProjectedPoints
  );

  return {
    projectedPoints,
    sourceLabel: projectedPoints !== null ? "stored weekly projection" : null,
  };
}

function formatLineupLockCountdown(
  kickoffMs: number,
  nowMs = Date.now()
): string {
  const remainingMs = Math.max(0, kickoffMs - nowMs);
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Locks in ${days}d ${hours}h`;
  if (hours > 0) return `Locks in ${hours}h ${minutes}m`;
  return `Locks in ${minutes}m`;
}

export function getCommandPlayerGameLockState(player: CommandPlayer): {
  isLocked: boolean;
  label: string | null;
  reason: string | null;
} {
  const playerRecord = player as unknown as Record<string, unknown>;
  const details = player.playerDetails as
    | (PlayerDetails & Record<string, unknown>)
    | undefined;
  const explicitLock = [
    playerRecord.isLocked,
    playerRecord.locked,
    playerRecord.gameLocked,
    playerRecord.lineupLocked,
    details?.isLocked,
    details?.locked,
    details?.gameLocked,
    details?.lineupLocked,
  ].some(value => value === true || value === "true" || value === 1 || value === "1");

  if (explicitLock) {
    return {
      isLocked: true,
      label: "Locked",
      reason: "The player is marked as lineup locked by the report data.",
    };
  }

  const status = getFirstTextValue(
    playerRecord.gameStatus,
    playerRecord.status,
    playerRecord.lineupStatus,
    details?.gameStatus,
    details?.status,
    details?.lineupStatus
  );
  if (
    status &&
    !/pre|scheduled|upcoming|not[_\s-]?started/i.test(status) &&
    /locked|started|live|in[_\s-]?progress|halftime|final|complete/i.test(
      status
    )
  ) {
    return {
      isLocked: true,
      label: "Locked",
      reason: `Game status is ${status}.`,
    };
  }

  const kickoffValue =
    getFirstTextValue(
      playerRecord.kickoffAt,
      playerRecord.gameStartTime,
      playerRecord.gameStart,
      playerRecord.startTime,
      playerRecord.kickoff,
      details?.kickoffAt,
      details?.gameStartTime,
      details?.gameStart,
      details?.startTime,
      details?.kickoff
    ) ??
    getFirstFiniteNumber(
      playerRecord.kickoffAt,
      playerRecord.gameStartTime,
      playerRecord.gameStart,
      playerRecord.startTime,
      playerRecord.kickoff,
      details?.kickoffAt,
      details?.gameStartTime,
      details?.gameStart,
      details?.startTime,
      details?.kickoff
    );
  if (kickoffValue !== null) {
    const rawTime =
      typeof kickoffValue === "number" ? kickoffValue : Date.parse(kickoffValue);
    const kickoffMs =
      rawTime && rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime;
    if (Number.isFinite(kickoffMs) && kickoffMs <= Date.now()) {
      return {
        isLocked: true,
        label: "Locked",
        reason: "Kickoff time has passed.",
      };
    }
    if (Number.isFinite(kickoffMs)) {
      return {
        isLocked: false,
        label: formatLineupLockCountdown(kickoffMs),
        reason:
          "Projected lineup lock is based on kickoff time in the report data.",
      };
    }
  }

  return { isLocked: false, label: null, reason: null };
}

export function getCommandPlayerSeasonScore(player: CommandPlayer): number {
  const seasonLens = getCommandPlayerSeasonLens(player);
  const projectionRead = getCommandPlayerProjectionRead(player);
  const projectionScore =
    projectionRead.projectedPoints !== null
      ? projectionRead.projectedPoints * 420
      : 0;
  const value = Number(
    seasonLens.value ?? player.seasonValue ?? player.value ?? 0
  );
  const rank = parsePositionRankValue(
    seasonLens.rank || player.seasonPositionRank || player.currentPositionRank
  );
  const rankScore = rank ? Math.max(0, 2300 - rank * 24) : 0;
  const availability = getPlayerAvailability(player.playerDetails);
  const availabilityPenalty =
    availability.tone === "risk"
      ? 420
      : availability.tone === "warning"
        ? 220
        : 0;
  return Math.max(projectionScore, value || 0, rankScore) - availabilityPenalty;
}

function getLineupGroupEligiblePositions(group: {
  key?: string;
  label?: string;
}): CountPosition[] {
  const key = String(group.key || group.label || "").toUpperCase();
  if (key.includes("QB_SF") || key.includes("QB/SF") || key.includes("SUPER"))
    return ["QB", "RB", "WR", "TE"];
  if (key.includes("FLEX")) return ["RB", "WR", "TE"];
  if (key.includes("QB")) return ["QB"];
  if (key.includes("RB")) return ["RB"];
  if (key.includes("WR")) return ["WR"];
  if (key.includes("TE")) return ["TE"];
  if (key.includes("DEF")) return ["DEF"];
  if (key.includes("K")) return ["K"];
  return ["RB", "WR", "TE"];
}

function isLineupSwapEligible(
  group: { key?: string; label?: string },
  player: CommandPlayer
): boolean {
  return getLineupGroupEligiblePositions(group).includes(
    player.pos as CountPosition
  );
}

function getLineupSwapSeverity(
  confidencePct: number,
  scoreEdge: number,
  projectedPointEdge: number | null
): LineupSwapSeverity {
  if (projectedPointEdge !== null && projectedPointEdge >= 4) return "urgent";
  if (projectedPointEdge !== null && projectedPointEdge >= 2.2)
    return "recommended";
  if (confidencePct >= 82 || scoreEdge >= 650) return "urgent";
  if (confidencePct >= 70 || scoreEdge >= 360) return "recommended";
  return "watch";
}

export function getLineupSwapSeverityLabel(severity: LineupSwapSeverity): string {
  if (severity === "urgent") return "Swap pressure";
  if (severity === "recommended") return "Recommended";
  return "Watch";
}

function normalizeManagerName(manager?: string | null): string {
  return manager?.trim().toLowerCase() || "";
}

function getManagerMatchupPreview(data: ReportData, manager?: string | null) {
  if (!manager) return null;
  const normalized = normalizeManagerName(manager);
  return (
    data.matchupPreviews?.find(
      row => normalizeManagerName(row.manager) === normalized
    ) || null
  );
}

function getManagerLineupStrengthRead(data: ReportData, manager?: string | null) {
  if (!manager) return null;
  const normalized = normalizeManagerName(manager);
  return (
    data.lineupStrength?.rows?.find(
      row => normalizeManagerName(row.manager) === normalized
    ) || null
  );
}

export function buildLineupSwapRecommendations({
  data,
  manager,
  lineupGroups,
  stepInGroups,
  selectedIntel,
}: {
  data: ReportData;
  manager?: string | null;
  lineupGroups: Array<{
    key?: string;
    label?: string;
    count?: number;
    players: CommandPlayer[];
  }>;
  stepInGroups: Array<{ label: string; players: CommandPlayer[] }>;
  selectedIntel?:
    | NonNullable<ReportData["managerRosterIntelligence"]>[number]
    | null;
}) {
  const benchPlayers = stepInGroups.flatMap(group => group.players);
  if (!benchPlayers.length) return [];

  const matchup = getManagerMatchupPreview(data, manager);
  const lineupStrength = getManagerLineupStrengthRead(data, manager);
  const vulnerableIds = new Set(
    [
      ...(matchup?.vulnerableSpots || []),
      ...(matchup?.boomBustRisks || []),
      lineupStrength?.weakestStarter,
      selectedIntel?.weakestStarter,
      selectedIntel?.starterAvailability?.riskiestStarter,
    ]
      .filter(Boolean)
      .map(player => player?.player_id)
  );
  const mustStartIds = new Set(
    (matchup?.mustStarts || []).map(player => player.player_id)
  );
  const recommendations: LineupSwapRecommendation[] = [];

  lineupGroups.forEach(group => {
    const fitLabel = getSwapFitLabel(group.label || group.key);
    group.players.forEach(starter => {
      if (mustStartIds.has(starter.player_id)) return;
      if (getCommandPlayerGameLockState(starter).isLocked) return;
      const lineupStrengthAlternatives = (lineupStrength?.benchAlternatives || [])
        .filter(alternative => alternative.starter.player_id === starter.player_id)
        .filter(alternative => isLineupSwapEligible(group, alternative.alternative))
        .filter(alternative => !getCommandPlayerGameLockState(alternative.alternative).isLocked)
        .map((alternative): LineupSwapOption => {
          const projectionEdge = alternative.projectionDelta;
          const confidencePct = clampPercentValue(
            62 +
              Math.max(-10, Math.min(20, alternative.scoreDelta * 2.4)) +
              (projectionEdge !== null ? Math.max(-8, Math.min(18, projectionEdge * 4.5)) : 0)
          );
          const projectedPointCopy = formatProjectedPointEdge(projectionEdge);
          return {
            player: alternative.alternative,
            confidencePct,
            scoreEdge: Math.round(alternative.scoreDelta * 100),
            projectedPointEdge: projectionEdge,
            fitLabel,
            reason: `${alternative.note} ${
              projectedPointCopy
                ? `${projectedPointCopy} weekly projection edge.`
                : ""
            }`.trim(),
            reasonBullets: [
              `Lineup strength edge: ${alternative.note}`,
              projectedPointCopy
                ? `Stored weekly projection edge: ${alternative.alternative.name} is ${projectedPointCopy} ahead of ${starter.name}.`
                : `No ready stored weekly projection edge is attached for this specific swap.`,
              `Value delta: ${formatCompactValue(alternative.valueDelta)}.`,
            ],
          };
        });

      const starterScore = getCommandPlayerSeasonScore(starter);
      const starterProjection = getCommandPlayerProjectionRead(starter);
      const starterIsFlagged = vulnerableIds.has(starter.player_id);

      const localOptions = benchPlayers
        .filter(
          candidate =>
            candidate.player_id !== starter.player_id &&
            isLineupSwapEligible(group, candidate)
        )
        .filter(candidate => !getCommandPlayerGameLockState(candidate).isLocked)
        .map(candidate => {
          const candidateScore = getCommandPlayerSeasonScore(candidate);
          const candidateProjection = getCommandPlayerProjectionRead(candidate);
          const scoreEdge = candidateScore - starterScore;
          const projectedPointEdge =
            candidateProjection.projectedPoints !== null &&
            starterProjection.projectedPoints !== null
              ? Math.round(
                  (candidateProjection.projectedPoints -
                    starterProjection.projectedPoints) *
                    10
                ) / 10
              : null;
          const samePositionBonus = candidate.pos === starter.pos ? 4 : 0;
          const flaggedBonus = starterIsFlagged ? 8 : 0;
          const edgePct =
            starterScore > 0
              ? (scoreEdge / Math.max(starterScore, 1)) * 100
              : scoreEdge > 0
                ? 14
                : 0;
          const projectionBonus =
            projectedPointEdge !== null
              ? Math.max(-8, Math.min(18, projectedPointEdge * 4.5))
              : 0;
          const confidencePct = clampPercentValue(
            58 +
              edgePct * 1.35 +
              projectionBonus +
              samePositionBonus +
              flaggedBonus
          );
          const candidateRank =
            getCommandPlayerSeasonLens(candidate).rank ||
            candidate.seasonPositionRank ||
            candidate.currentPositionRank ||
            candidate.pos;
          const starterRank =
            getCommandPlayerSeasonLens(starter).rank ||
            starter.seasonPositionRank ||
            starter.currentPositionRank ||
            starter.pos;
          const projectedPointCopy = formatProjectedPointEdge(projectedPointEdge);
          const reasonBullets = [
            projectedPointCopy
              ? `Stored weekly projection edge: ${candidate.name} is ${projectedPointCopy} ahead of ${starter.name}.`
              : `No ready stored weekly projection is attached for this matchup; using current-season value, rank, and availability.`,
            scoreEdge > 0
              ? `Starter-score edge: ${formatCompactValue(scoreEdge)} in the current-season model.`
              : starterIsFlagged
                ? `${starter.name} is already flagged by the matchup or availability model.`
                : `${candidate.name} is close enough to monitor before lineup lock.`,
            candidateRank && starterRank
              ? `Season ranks: ${candidate.name} ${candidateRank}, ${starter.name} ${starterRank}.`
              : null,
            starterIsFlagged
              ? `${starter.name} appears in the vulnerable starter set for this manager.`
              : null,
            candidateProjection.sourceLabel
              ? `Stored weekly projection context is attached.`
              : null,
          ].filter(Boolean) as string[];
          const reason =
            scoreEdge > 0
              ? `${candidate.name} clears ${starter.name} by ${formatCompactValue(scoreEdge)} in current-season starter score.`
              : starterIsFlagged
                ? `${starter.name} is already flagged, and ${candidate.name} is the closest eligible cover.`
                : `${candidate.name} is close enough to monitor against ${starter.name} before lock.`;

          return {
            player: candidate,
            confidencePct,
            scoreEdge,
            projectedPointEdge,
            fitLabel,
            reason: `${reason} ${
              projectedPointCopy
                ? `${projectedPointCopy} weekly projection edge.`
                : ""
            } ${candidateRank && starterRank ? `${candidateRank} vs ${starterRank}.` : ""}`.trim(),
            reasonBullets,
          };
        })
        .filter(
          option =>
            option.scoreEdge >= 125 ||
            (option.projectedPointEdge !== null &&
              option.projectedPointEdge >= 0.8) ||
            (starterIsFlagged && option.confidencePct >= 62)
        )
        .sort(
          (a, b) =>
            b.confidencePct - a.confidencePct || b.scoreEdge - a.scoreEdge
        )
        .slice(0, 3);
      const options = [...lineupStrengthAlternatives, ...localOptions]
        .filter(
          option =>
            option.scoreEdge >= 125 ||
            (option.projectedPointEdge !== null &&
              option.projectedPointEdge >= 0.8) ||
            (starterIsFlagged && option.confidencePct >= 62)
        )
        .sort(
          (a, b) =>
            b.confidencePct - a.confidencePct || b.scoreEdge - a.scoreEdge
        )
        .reduce<LineupSwapOption[]>((deduped, option) => {
          const existingIndex = deduped.findIndex(
            current => current.player.player_id === option.player.player_id
          );
          if (existingIndex === -1) {
            deduped.push(option);
          } else if (
            (deduped[existingIndex].projectedPointEdge === null && option.projectedPointEdge !== null) ||
            option.confidencePct > deduped[existingIndex].confidencePct
          ) {
            deduped[existingIndex] = option;
          }
          return deduped;
        }, [])
        .slice(0, 3)
        .reduce<LineupSwapOption[]>((adjusted, option, index) => {
          const previousConfidence =
            adjusted[index - 1]?.confidencePct ?? option.confidencePct;
          adjusted.push({
            ...option,
            confidencePct:
              index === 0
                ? option.confidencePct
                : Math.min(
                    option.confidencePct,
                    Math.max(0, previousConfidence - 7)
                  ),
          });
          return adjusted;
        }, []);

      if (!options.length) return;

      const topOption = options[0];
      const severity = getLineupSwapSeverity(
        topOption.confidencePct,
        topOption.scoreEdge,
        topOption.projectedPointEdge
      );
      recommendations.push({
        starterOut: starter,
        groupLabel: fitLabel,
        severity,
        summary: `${starter.name} is the tile to pressure-test. ${topOption.player.name} is the strongest replacement signal at ${topOption.confidencePct}% confidence${formatProjectedPointEdge(topOption.projectedPointEdge) ? ` with a ${formatProjectedPointEdge(topOption.projectedPointEdge)} projection edge` : ""}.`,
        options,
      });
    });
  });

  return recommendations
    .sort((a, b) => {
      const severityRank: Record<LineupSwapSeverity, number> = {
        urgent: 0,
        recommended: 1,
        watch: 2,
      };
      return (
        severityRank[a.severity] - severityRank[b.severity] ||
        b.options[0].confidencePct - a.options[0].confidencePct ||
        b.options[0].scoreEdge - a.options[0].scoreEdge
      );
    })
    .slice(0, 4);
}

export function CommandPlayerTile({
  player,
  onClick,
  variant = "default",
  label,
  note,
  showValueStack = false,
  swapSignal,
}: {
  player: CommandPlayer;
  onClick: () => void;
  variant?: "default" | "step";
  label?: string;
  note?: string | null;
  showValueStack?: boolean;
  swapSignal?: CommandSwapSignal;
}) {
  const valueLens = getCommandPlayerValueLens(player);
  const seasonRank =
    player.seasonPositionRank || player.currentPositionRank || player.pos;
  const dynastyLens = getCommandPlayerDynastyLens(player);
  const seasonLens = getCommandPlayerSeasonLens(player);
  const availability = getPlayerAvailability(player.playerDetails);
  const gameLockState = getCommandPlayerGameLockState(player);
  const shouldShowStatusPill =
    Boolean(gameLockState.label) ||
    !showValueStack ||
    availability.tone !== "taxi";

  return (
    <button
      type="button"
      className={`player-team-tile manager-command-player-tile ${variant === "step" ? "manager-command-player-tile-step" : ""} ${swapSignal ? `manager-command-player-tile-swap manager-command-player-tile-swap-${swapSignal.role}` : ""}`}
      style={getTeamTileStyle(player.playerDetails?.team)}
      onClick={onClick}
      aria-label={
        swapSignal
          ? `${player.name}, ${swapSignal.label}, ${swapSignal.confidencePct}% confidence`
          : undefined
      }
    >
      {label && (
        <div
          className={`manager-intel-player-kicker manager-command-action-pill manager-command-action-${getTaxiActionClassName(label)}`}
        >
          {label}
        </div>
      )}
      {swapSignal && (
        <div
          className={`manager-command-swap-corner manager-command-swap-corner-${swapSignal.role}`}
        >
          <span>{swapSignal.label}</span>
          <strong>{swapSignal.confidencePct}%</strong>
        </div>
      )}
      <div className="manager-command-player-tile-main">
        <PlayerNameWithHeadshot
          playerId={player.player_id}
          playerName={player.name}
          team={player.playerDetails?.team}
          position={player.pos}
        />
      </div>
      {note && <p className="manager-command-player-tile-note">{note}</p>}
      <div className="manager-command-player-tile-pills">
        <div className="manager-command-player-tile-pills-main">
          <TeamLogoPill team={player.playerDetails?.team} />
          {showValueStack ? (
            <>
              <span className="manager-command-season-value manager-command-dynasty-value manager-command-value-rank-pill">
                <span className="manager-command-value-label">
                  <em>Dynasty</em>
                  {formatCompactValue(dynastyLens.value)}
                </span>
                <PositionRankPill rank={dynastyLens.rank} />
              </span>
              <span className="manager-command-season-value manager-command-value-rank-pill">
                <span className="manager-command-value-label">
                  <em>Season</em>
                  {formatCompactValue(seasonLens.value)}
                </span>
                <PositionRankPill rank={seasonLens.rank} />
              </span>
            </>
          ) : (
            <>
              <span className={valueLens.className}>
                <em>{valueLens.label}</em>
                {formatCompactValue(valueLens.value)}
              </span>
              <PositionRankPill rank={seasonRank} />
            </>
          )}
        </div>
        {shouldShowStatusPill && (
          <div className="manager-command-player-status-row">
            <span
              className={`manager-command-status-pill is-${availability.tone}`}
            >
              {availability.label}
            </span>
            {gameLockState.label && (
              <span
                className={`manager-command-status-pill manager-command-lock-status ${gameLockState.isLocked ? "is-locked" : "is-locking"}`}
                title={gameLockState.reason || undefined}
              >
                <LockKeyhole aria-hidden="true" />
                {gameLockState.label}
              </span>
            )}
            {swapSignal?.detail && (
              <span
                className={`manager-command-status-pill manager-command-swap-status is-${swapSignal.role === "out" ? "risk" : "active"}`}
              >
                {swapSignal.detail}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function getTaxiActionClassName(action?: string | null) {
  return (
    String(action || "default")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "default"
  );
}

export function formatProjectedPointEdge(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)} pts`;
}

function getFirstFiniteNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
          ? Number(value)
          : NaN;
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function getFirstTextValue(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
