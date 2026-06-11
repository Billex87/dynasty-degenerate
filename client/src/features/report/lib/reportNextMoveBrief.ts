import type { ReportData } from "@shared/types";
import { buildAutopilotData } from "@/lib/autopilot/buildAutopilotData";
import type {
  AIActionQueueItem,
  AutopilotData,
  AutopilotMode,
} from "@/lib/autopilot/types";
import type { LeagueValueMode } from "@/lib/leagueValueMode";

export type ReportNextMoveTelemetryProperties = {
  mode: AutopilotMode;
  decision: AIActionQueueItem["decision"];
  actionSource: AIActionQueueItem["source"];
  readStrength: "blocked" | "verify" | "strong" | "watch" | "thin";
  queueCount: number;
  hasBlockers: boolean;
  hasMissingEvidence: boolean;
};

function resolveAutopilotMode(
  leagueValueMode?: LeagueValueMode | null
): AutopilotMode {
  return leagueValueMode === "redraft" ? "redraft" : "dynasty";
}

export function createPublicNextMoveFallback(
  mode: AutopilotMode
): AutopilotData {
  const directionLabel = mode === "redraft" ? "Season setup" : "Dynasty setup";

  return {
    mode,
    headline: "Next move pending",
    direction: {
      label: directionLabel,
      confidence: 0,
      summary:
        "No manager-specific move cleared the public action guardrail yet.",
      strategy:
        "Hold the current setup until a real report signal clears roster, value, and timing checks.",
      scores: [
        { label: "Roster signal", value: 0, tone: "neutral" },
        { label: "Market signal", value: 0, tone: "neutral" },
        { label: "Timing signal", value: 0, tone: "neutral" },
      ],
      actionPlan: [],
    },
    systemRead: [],
    actionQueue: [],
    lineup: [],
    rejections: [],
    marketAnomalies: [],
    waivers: [],
    trades: [],
    projections: [],
    power: [],
    scheduleTodo: [],
  };
}

export function getReportNextMoveItems({
  reportData,
  leagueValueMode,
  leagueId,
}: {
  reportData?: ReportData | null;
  leagueValueMode?: LeagueValueMode | null;
  leagueId?: string | null;
}): AIActionQueueItem[] {
  if (!reportData) return [];

  const mode = resolveAutopilotMode(leagueValueMode);

  try {
    const autopilotData = buildAutopilotData({
      reportData,
      mode,
      fallback: createPublicNextMoveFallback(mode),
      leagueId,
    });

    if (autopilotData.dataStatus !== "Live report data") return [];
    return autopilotData.actionQueue.slice(0, 1);
  } catch {
    return [];
  }
}

export function getReportNextMoveTelemetryProperties({
  item,
  leagueValueMode,
  queueCount,
}: {
  item: AIActionQueueItem;
  leagueValueMode?: LeagueValueMode | null;
  queueCount: number;
}): ReportNextMoveTelemetryProperties {
  const hasBlockers = item.blockers.length > 0;
  const hasMissingEvidence = item.missingEvidence.length > 0;
  const readStrength =
    item.decision === "blocked" || hasBlockers
      ? "blocked"
      : hasMissingEvidence
        ? "verify"
        : item.confidence >= 78
          ? "strong"
          : item.confidence >= 46
            ? "watch"
            : "thin";

  return {
    mode: resolveAutopilotMode(leagueValueMode),
    decision: item.decision,
    actionSource: item.source,
    readStrength,
    queueCount,
    hasBlockers,
    hasMissingEvidence,
  };
}
