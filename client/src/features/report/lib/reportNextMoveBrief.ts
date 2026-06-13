import type { ReportData } from "@shared/types";
import { buildAutopilotData } from "@/lib/autopilot/buildAutopilotData";
import type {
  AIActionQueueItem,
  AutopilotData,
  AutopilotMode,
} from "@/lib/autopilot/types";
import type { LeagueValueMode } from "@/lib/leagueValueMode";

export type ReportNextMoveTab = "overview" | "momentum" | "rankings" | "trades";

export type ReportNextMoveSectionKey =
  | "waiver-intelligence"
  | "recent-transactions"
  | "market-movers"
  | "trade-war-room"
  | "scout-leaguemates"
  | "full-roster-rankings"
  | "monthly-team-blueprint"
  | "owner-intel";

export type ReportNextMoveDestination = {
  tab: ReportNextMoveTab;
  sectionKey: ReportNextMoveSectionKey;
  sectionTitle: string;
  buttonLabel: string;
  focusText?: string;
};

export type ReportNextMoveTarget = {
  tab: ReportNextMoveTab;
  sectionKey: ReportNextMoveSectionKey;
  openSignal: number;
  focusText?: string;
};

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

export function getReportNextMoveDestination({
  item,
  reportData,
  showReportAIReads = false,
}: {
  item: AIActionQueueItem;
  reportData?: ReportData | null;
  showReportAIReads?: boolean;
}): ReportNextMoveDestination {
  if (item.source === "waiver") {
    return {
      tab: "momentum",
      sectionKey: "waiver-intelligence",
      sectionTitle: "Waiver Intelligence",
      buttonLabel: "Open Waiver Intelligence",
      focusText: item.target,
    };
  }

  if (item.source === "trade") {
    return {
      tab: "trades",
      sectionKey: "trade-war-room",
      sectionTitle: "Trade War Room",
      buttonLabel: "Open Trade War Room",
      focusText: item.target,
    };
  }

  if (item.source === "lineup") {
    const hasLeaguemateScoutRows =
      (reportData?.managerRosterIntelligence?.length || 0) > 0;

    return hasLeaguemateScoutRows
      ? {
          tab: "rankings",
          sectionKey: "scout-leaguemates",
          sectionTitle: "Scout Leaguemates",
          buttonLabel: "Open Scout Leaguemates",
          focusText: item.target,
        }
      : {
          tab: "rankings",
          sectionKey: "full-roster-rankings",
          sectionTitle: "Full Roster Rankings",
          buttonLabel: "Open Roster Rankings",
          focusText: item.target,
        };
  }

  if (showReportAIReads) {
    return {
      tab: "overview",
      sectionKey: "monthly-team-blueprint",
      sectionTitle: "Monthly Team Blueprint",
      buttonLabel: "Open Monthly Blueprint",
      focusText: item.target,
    };
  }

  return {
    tab: "overview",
    sectionKey: "owner-intel",
    sectionTitle: "Owner Intel",
    buttonLabel: "Open Owner Intel",
    focusText: item.target,
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
