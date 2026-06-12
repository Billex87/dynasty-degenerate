import { AUTOPILOT_MOCK_DATA } from "@/lib/autopilot/mockData";
import { buildAutopilotData } from "@/lib/autopilot/buildAutopilotData";
import {
  formatDashboardSignedPercentLabel,
} from "@/features/report/lib/reportDashboardUtils";
import type { AIActionQueueItem } from "@/lib/autopilot/types";
import {
  normalizeLeagueValueMode,
  type LeagueValueMode,
} from "@/lib/leagueValueMode";
import type { ReportDeltaChange, ReportDeltaTone } from "@/features/report/components/ReportDeltaBrief";
import type { ReportNextMoveDestination } from "@/features/report/lib/reportNextMoveBrief";
import type { ReportData } from "@shared/types";

export const REPORT_DELTA_SNAPSHOT_KEY =
  "dynasty-degenerates:report-delta-snapshots:v1";
export const REPORT_DELTA_MAX_LEAGUES = 12;

export type ReportDeltaPlayer = {
  id: string;
  name: string;
  position: string | null;
  team: string | null;
  metricLabel: string | null;
};

export type ReportDeltaAction = {
  id: string;
  source?: AIActionQueueItem["source"] | null;
  decision: AIActionQueueItem["decision"];
  label: string;
  action: string;
  target: string;
  confidence: number;
};

export type ReportDeltaSnapshot = {
  schemaVersion: 1;
  leagueId: string;
  leagueName: string;
  savedAt: number;
  valueMode: LeagueValueMode;
  action: ReportDeltaAction | null;
  topRiser: ReportDeltaPlayer | null;
  topFaller: ReportDeltaPlayer | null;
  topWaiver: ReportDeltaPlayer | null;
  tradeCount: number;
  transactionCount: number;
  scheduleStatus: string | null;
  scheduleSignalCount: number;
  aiConfidence: number | null;
  signature: string;
};

export type ReportDeltaSnapshotStore = {
  schemaVersion: 1;
  snapshots: Record<string, ReportDeltaSnapshot>;
};

function getReportDeltaPlayerId(
  player?: { player_id?: string | null; id?: string | null; name?: string | null } | null
) {
  return String(player?.player_id || player?.id || player?.name || "").trim();
}

function buildReportDeltaPlayer(
  player?: {
    player_id?: string | null;
    id?: string | null;
    name?: string | null;
    pos?: string | null;
    position?: string | null;
    team?: string | null;
    playerDetails?: { team?: string | null } | null;
  } | null,
  metricLabel?: string | null
): ReportDeltaPlayer | null {
  const name = String(player?.name || "").trim();
  if (!name) return null;
  return {
    id: getReportDeltaPlayerId(player) || name,
    name,
    position: player?.pos || player?.position || null,
    team: player?.playerDetails?.team || player?.team || null,
    metricLabel: metricLabel || null,
  };
}

function getReportDeltaPlayerFingerprint(
  player?: ReportDeltaPlayer | null
) {
  if (!player) return "none";
  return `${player.id || player.name}:${player.position || ""}`;
}

function getReportDeltaActionFingerprint(
  action?: ReportDeltaAction | null
) {
  if (!action) return "none";
  return `${action.id}:${action.decision}:${action.action}:${action.target}:${action.confidence}`;
}

function getReportDeltaSnapshotSignature(
  snapshot: Omit<ReportDeltaSnapshot, "signature">
) {
  return [
    snapshot.valueMode,
    getReportDeltaActionFingerprint(snapshot.action),
    getReportDeltaPlayerFingerprint(snapshot.topRiser),
    getReportDeltaPlayerFingerprint(snapshot.topFaller),
    getReportDeltaPlayerFingerprint(snapshot.topWaiver),
    snapshot.tradeCount,
    snapshot.transactionCount,
    snapshot.scheduleStatus || "none",
    snapshot.scheduleSignalCount,
    snapshot.aiConfidence ?? "none",
  ].join("|");
}

function buildReportDeltaAction(
  reportData: ReportData,
  valueMode: LeagueValueMode
): ReportDeltaAction | null {
  const autopilotMode = valueMode === "redraft" ? "redraft" : "dynasty";
  try {
    const action = buildAutopilotData({
      reportData,
      mode: autopilotMode,
      fallback: AUTOPILOT_MOCK_DATA[autopilotMode],
    }).actionQueue?.[0];
    if (!action) return null;
    return {
      id: action.id,
      source: action.source,
      decision: action.decision,
      label: action.label,
      action: action.action,
      target: action.target,
      confidence: action.confidence,
    };
  } catch {
    return null;
  }
}

function getReportDeltaActionTone(action?: ReportDeltaAction | null): ReportDeltaTone {
  if (!action) return "neutral";
  if (action.decision === "do") return "good";
  if (action.decision === "blocked") return "danger";
  if (action.decision === "hold") return "warn";
  return "info";
}

function describeReportDeltaAction(action?: ReportDeltaAction | null): string {
  if (!action) return "no primary action";
  const verb = String(action.action || action.label || "").trim();
  return verb ? `${verb}: ${action.target}` : action.target;
}

function describeReportDeltaPlayer(
  player?: ReportDeltaPlayer | null
): string {
  if (!player) return "No player";
  const meta = [player.position, player.team].filter(Boolean).join(" · ");
  return meta ? `${player.name} (${meta})` : player.name;
}

type BuildReportDeltaChangesContext = {
  hasLeaguemateScoutRows?: boolean;
};

function getReportDeltaActionDestination(
  action: ReportDeltaAction,
  context: BuildReportDeltaChangesContext
): ReportNextMoveDestination {
  if (action.source === "waiver") {
    return {
      tab: "momentum",
      sectionKey: "waiver-intelligence",
      sectionTitle: "Waiver Intelligence",
      buttonLabel: "Open Waiver Intelligence",
      focusText: action.target,
    };
  }

  if (action.source === "trade") {
    return {
      tab: "trades",
      sectionKey: "trade-war-room",
      sectionTitle: "Trade War Room",
      buttonLabel: "Open Trade War Room",
      focusText: action.target,
    };
  }

  if (action.source === "lineup") {
    return context.hasLeaguemateScoutRows
      ? {
          tab: "rankings",
          sectionKey: "scout-leaguemates",
          sectionTitle: "Scout Leaguemates",
          buttonLabel: "Open Scout Leaguemates",
          focusText: action.target,
        }
      : {
          tab: "rankings",
          sectionKey: "full-roster-rankings",
          sectionTitle: "Full Roster Rankings",
          buttonLabel: "Open Roster Rankings",
          focusText: action.target,
        };
  }

  return {
    tab: "overview",
    sectionKey: "owner-intel",
    sectionTitle: "Owner Intel",
    buttonLabel: "Open Owner Intel",
    focusText: action.target,
  };
}

function getReportDeltaWaiverDestination(
  player: ReportDeltaPlayer
): ReportNextMoveDestination {
  return {
    tab: "momentum",
    sectionKey: "waiver-intelligence",
    sectionTitle: "Waiver Intelligence",
    buttonLabel: "Open Waiver Intelligence",
    focusText: player.name,
  };
}

function getReportDeltaTransactionsDestination(): ReportNextMoveDestination {
  return {
    tab: "momentum",
    sectionKey: "recent-transactions",
    sectionTitle: "Recent Transactions",
    buttonLabel: "Open Recent Transactions",
  };
}

function getReportDeltaMarketMoversDestination(
  player: ReportDeltaPlayer
): ReportNextMoveDestination {
  return {
    tab: "momentum",
    sectionKey: "market-movers",
    sectionTitle: "Market Movers",
    buttonLabel: "Open Market Movers",
    focusText: player.name,
  };
}

function getReportDeltaTradeDestination(): ReportNextMoveDestination {
  return {
    tab: "trades",
    sectionKey: "trade-war-room",
    sectionTitle: "Trade War Room",
    buttonLabel: "Open Trade War Room",
  };
}

export function getEmptyReportDeltaSnapshotStore(): ReportDeltaSnapshotStore {
  return {
    schemaVersion: 1,
    snapshots: {},
  };
}

function readReportDeltaSnapshotStore(): ReportDeltaSnapshotStore {
  if (typeof window === "undefined") return getEmptyReportDeltaSnapshotStore();
  try {
    const raw = window.localStorage.getItem(REPORT_DELTA_SNAPSHOT_KEY);
    if (!raw) return getEmptyReportDeltaSnapshotStore();
    const parsed = JSON.parse(raw) as Partial<ReportDeltaSnapshotStore>;
    if (parsed.schemaVersion !== 1 || !parsed.snapshots) {
      return getEmptyReportDeltaSnapshotStore();
    }
    return {
      schemaVersion: 1,
      snapshots: parsed.snapshots as Record<string, ReportDeltaSnapshot>,
    };
  } catch {
    window.localStorage.removeItem(REPORT_DELTA_SNAPSHOT_KEY);
    return getEmptyReportDeltaSnapshotStore();
  }
}

export function readReportDeltaSnapshot(
  leagueId?: string | null
): ReportDeltaSnapshot | null {
  const normalizedLeagueId = String(leagueId || "").trim();
  if (!normalizedLeagueId) return null;
  return readReportDeltaSnapshotStore().snapshots[normalizedLeagueId] || null;
}

export function writeReportDeltaSnapshot(snapshot: ReportDeltaSnapshot) {
  if (typeof window === "undefined") return;
  const store = readReportDeltaSnapshotStore();
  const nextSnapshots: Record<string, ReportDeltaSnapshot> = {
    ...store.snapshots,
    [snapshot.leagueId]: snapshot,
  };
  const prunedEntries = Object.entries(nextSnapshots)
    .sort(([, a], [, b]) => (b.savedAt || 0) - (a.savedAt || 0))
    .slice(0, REPORT_DELTA_MAX_LEAGUES);

  try {
    window.localStorage.setItem(
      REPORT_DELTA_SNAPSHOT_KEY,
      JSON.stringify({
        schemaVersion: 1,
        snapshots: prunedEntries.reduce<Record<string, ReportDeltaSnapshot>>(
          (acc, [key, value]) => {
            acc[key] = value;
            return acc;
          },
          {}
        ),
      })
    );
  } catch {
    window.localStorage.removeItem(REPORT_DELTA_SNAPSHOT_KEY);
  }
}

export function buildReportDeltaSnapshot(
  reportData: ReportData,
  leagueId: string,
  leagueName: string
): ReportDeltaSnapshot | null {
  const normalizedLeagueId = leagueId.trim();
  if (!normalizedLeagueId) return null;
  const valueMode = normalizeLeagueValueMode(
    reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
  );
  const topRiser =
    [...(reportData.weeklyRisers || [])].sort(
      (a, b) => (b.pct_change || 0) - (a.pct_change || 0)
    )[0] || null;
  const topFaller =
    [...(reportData.weeklyFallers || [])].sort(
      (a, b) => (a.pct_change || 0) - (b.pct_change || 0)
    )[0] || null;
  const weeklyWaiverTarget =
    [...(reportData.waiverIntelligence?.weeklyEcrTargets || [])].sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    )[0]?.player || null;
  const topWaiver =
    weeklyWaiverTarget ||
    [...(reportData.waiverIntelligence?.availableTrendingAdds || [])].sort(
      (a, b) => (b.count || 0) - (a.count || 0)
    )[0] ||
    null;
  const schedulePlanning = reportData.schedulePlanning || null;
  const scheduleSignalCount =
    (schedulePlanning?.rosterGaps?.length || 0) +
    (schedulePlanning?.streamerCandidates?.length || 0) +
    (schedulePlanning?.byeWeekNotes?.length || 0);
  const snapshotWithoutSignature: Omit<ReportDeltaSnapshot, "signature"> = {
    schemaVersion: 1,
    leagueId: normalizedLeagueId,
    leagueName: leagueName || "Sleeper League",
    savedAt: Date.now(),
    valueMode,
    action: buildReportDeltaAction(reportData, valueMode),
    topRiser: buildReportDeltaPlayer(
      topRiser,
      topRiser ? formatDashboardSignedPercentLabel(topRiser.pct_change) : null
    ),
    topFaller: buildReportDeltaPlayer(
      topFaller,
      topFaller ? formatDashboardSignedPercentLabel(topFaller.pct_change) : null
    ),
    topWaiver: buildReportDeltaPlayer(topWaiver, topWaiver ? "Top available" : null),
    tradeCount: reportData.tradeHistory?.length || 0,
    transactionCount: reportData.recentTransactions?.length || 0,
    scheduleStatus: schedulePlanning?.status || null,
    scheduleSignalCount,
    aiConfidence: reportData.leagueDiagnostics?.aiConfidence?.score ?? null,
  };

  return {
    ...snapshotWithoutSignature,
    signature: getReportDeltaSnapshotSignature(snapshotWithoutSignature),
  };
}

export function buildReportDeltaChanges(
  previous: ReportDeltaSnapshot | null,
  current: ReportDeltaSnapshot | null,
  context: BuildReportDeltaChangesContext = {}
): ReportDeltaChange[] {
  if (!previous || !current || previous.signature === current.signature) {
    return [];
  }

  const changes: ReportDeltaChange[] = [];
  const previousAction = previous.action;
  const currentAction = current.action;
  if (getReportDeltaActionFingerprint(previousAction) !== getReportDeltaActionFingerprint(currentAction) && currentAction) {
    changes.push({
      id: "action",
      label: "Decision changed",
      summary: describeReportDeltaAction(currentAction),
      detail: previousAction
        ? `Previously ${describeReportDeltaAction(previousAction)}. Now ${describeReportDeltaAction(currentAction)}.`
        : `${describeReportDeltaAction(currentAction)} is the current primary action.`,
      tone: getReportDeltaActionTone(currentAction),
      receipts: [
        `Previous: ${previousAction ? describeReportDeltaAction(previousAction) : "no action"}`,
        `Current confidence: ${currentAction.confidence}%`,
        `Mode: ${current.valueMode}`,
      ],
      destination: getReportDeltaActionDestination(currentAction, context),
      priority: 10,
    });
  }

  if (getReportDeltaPlayerFingerprint(previous.topWaiver) !== getReportDeltaPlayerFingerprint(current.topWaiver) && current.topWaiver) {
    changes.push({
      id: "waiver",
      label: "Waiver target changed",
      summary: describeReportDeltaPlayer(current.topWaiver),
      detail: previous.topWaiver
        ? `Moved ahead of ${previous.topWaiver.name} in the available-player read.`
        : "A new available-player target has enough evidence to surface.",
      tone: "info",
      receipts: [
        current.topWaiver.metricLabel || "Top available",
        `Previous: ${previous.topWaiver?.name || "none"}`,
      ],
      destination: getReportDeltaWaiverDestination(current.topWaiver),
      priority: 8,
    });
  }

  if (current.transactionCount > previous.transactionCount) {
    const added = current.transactionCount - previous.transactionCount;
    changes.push({
      id: "transactions",
      label: "Sleeper activity changed",
      summary: `${added} new transaction${added === 1 ? "" : "s"}`,
      detail: "Roster ownership/status moved since the last saved report.",
      tone: "warn",
      receipts: [
        `Previous events: ${previous.transactionCount}`,
        `Current events: ${current.transactionCount}`,
      ],
      destination: getReportDeltaTransactionsDestination(),
      priority: 7,
    });
  }

  if (current.tradeCount > previous.tradeCount) {
    const added = current.tradeCount - previous.tradeCount;
    changes.push({
      id: "trades",
      label: "Trade market moved",
      summary: `${added} new trade${added === 1 ? "" : "s"}`,
      detail: "The trade ledger changed enough to re-check manager tendencies.",
      tone: "info",
      receipts: [
        `Previous trades: ${previous.tradeCount}`,
        `Current trades: ${current.tradeCount}`,
      ],
      destination: getReportDeltaTradeDestination(),
      priority: 6,
    });
  }

  if (getReportDeltaPlayerFingerprint(previous.topRiser) !== getReportDeltaPlayerFingerprint(current.topRiser) && current.topRiser) {
    changes.push({
      id: "riser",
      label: "Top riser changed",
      summary: describeReportDeltaPlayer(current.topRiser),
      detail: `${current.topRiser.name} is now the strongest positive market move.`,
      tone: "good",
      receipts: [
        current.topRiser.metricLabel || "Positive weekly movement",
        `Previous: ${previous.topRiser?.name || "none"}`,
      ],
      destination: getReportDeltaMarketMoversDestination(current.topRiser),
      priority: 5,
    });
  }

  if (getReportDeltaPlayerFingerprint(previous.topFaller) !== getReportDeltaPlayerFingerprint(current.topFaller) && current.topFaller) {
    changes.push({
      id: "faller",
      label: "Top faller changed",
      summary: describeReportDeltaPlayer(current.topFaller),
      detail: `${current.topFaller.name} is now the sharpest negative market move.`,
      tone: "danger",
      receipts: [
        current.topFaller.metricLabel || "Negative weekly movement",
        `Previous: ${previous.topFaller?.name || "none"}`,
      ],
      destination: getReportDeltaMarketMoversDestination(current.topFaller),
      priority: 4,
    });
  }

  if (
    previous.scheduleStatus !== current.scheduleStatus ||
    previous.scheduleSignalCount !== current.scheduleSignalCount
  ) {
    changes.push({
      id: "schedule",
      label: "Schedule read updated",
      summary: `${current.scheduleSignalCount} schedule signal${current.scheduleSignalCount === 1 ? "" : "s"}`,
      detail: "Bye-week, streamer, or schedule-planning context changed.",
      tone: current.scheduleStatus === "ready" ? "good" : "warn",
      receipts: [
        `Previous: ${previous.scheduleStatus || "missing"}`,
        `Current: ${current.scheduleStatus || "missing"}`,
      ],
      priority: 3,
    });
  }

  if (
    typeof previous.aiConfidence === "number" &&
    typeof current.aiConfidence === "number" &&
    Math.abs(current.aiConfidence - previous.aiConfidence) >= 5
  ) {
    const delta = current.aiConfidence - previous.aiConfidence;
    changes.push({
      id: "confidence",
      label: "Read strength moved",
      summary: `${delta > 0 ? "+" : ""}${delta} read strength`,
      detail:
        delta > 0
          ? "The current read has firmer roster, value, or schedule support."
          : "The current read needs a firmer roster, value, or schedule signal than the baseline.",
      tone: delta > 0 ? "good" : "warn",
      receipts: [
        `Previous: ${previous.aiConfidence}`,
        `Current: ${current.aiConfidence}`,
      ],
      priority: 2,
    });
  }

  return changes.sort((a, b) => b.priority - a.priority);
}
