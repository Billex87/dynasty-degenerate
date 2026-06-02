import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import { buildAutopilotData } from "@/lib/autopilot/buildAutopilotData";
import { AUTOPILOT_MOCK_DATA } from "@/lib/autopilot/mockData";
import type { AIActionQueueItem } from "@/lib/autopilot/types";
import { detectAIActionConflicts } from "@/lib/aiActionMemory";
import type { ReportData } from "@shared/types";

export type AIReadoutDiagnosticTone = "good" | "info" | "warn" | "danger";

export type AIReadoutDiagnosticRow = {
  id: string;
  tab: string;
  surface: string;
  owner: string;
  count: number;
  hasConfidence: boolean;
  hasTrace: boolean;
  duplicateRisk: boolean;
  sourceLimited: boolean;
  note: string;
  tone: AIReadoutDiagnosticTone;
};

export type AIDecisionLogRow = {
  id: string;
  lane: string;
  surface: string;
  owner: string;
  decision: string;
  confidence: string;
  tone: AIReadoutDiagnosticTone;
  why: string;
  receipts: string[];
  blockers: string[];
  missingEvidence: string[];
  changeTriggers: string[];
};

export type AISurfaceRegistryRole = "action-owner" | "context" | "hidden" | "merge";

export type AISurfaceRegistryRow = {
  id: string;
  tab: string;
  surface: string;
  owner: string;
  role: AISurfaceRegistryRole;
  roleLabel: string;
  tone: AIReadoutDiagnosticTone;
  visibility: string;
  allowedClaim: string;
  evidenceStatus: string;
  noiseRule: string;
  nextStep: string;
};

export type AIReadoutDiagnostics = ReturnType<typeof buildAIReadoutDiagnostics>;

function getAIReadoutDiagnosticTone(row: {
  hasConfidence: boolean;
  hasTrace: boolean;
  duplicateRisk: boolean;
  sourceLimited: boolean;
}): AIReadoutDiagnosticTone {
  if (row.duplicateRisk) return "danger";
  if (!row.hasConfidence || !row.hasTrace) return "warn";
  if (row.sourceLimited) return "info";
  return "good";
}

function buildAIReadoutRow(
  row: Omit<AIReadoutDiagnosticRow, "tone">
): AIReadoutDiagnosticRow {
  return {
    ...row,
    tone: getAIReadoutDiagnosticTone(row),
  };
}

function compactDecisionLogItems(
  values: Array<string | null | undefined>,
  limit = 4
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach(value => {
    const clean = String(value || "").replace(/\s+/g, " ").trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });

  return result.slice(0, limit);
}

function getAIActionDecisionLabel(decision: AIActionQueueItem["decision"]) {
  if (decision === "do") return "Do";
  if (decision === "blocked") return "Do not";
  if (decision === "hold") return "Hold";
  return "Watch";
}

function getAIActionDecisionTone(
  decision: AIActionQueueItem["decision"],
  fallbackTone: AIActionQueueItem["tone"]
): AIReadoutDiagnosticTone {
  if (decision === "do") return "good";
  if (decision === "blocked") return "danger";
  if (decision === "hold") return "info";
  if (fallbackTone === "danger" || fallbackTone === "warn" || fallbackTone === "info") {
    return fallbackTone;
  }
  return "good";
}

function getReadoutPolicy(row: AIReadoutDiagnosticRow): {
  decision: string;
  tone: AIReadoutDiagnosticTone;
} {
  if (row.duplicateRisk) {
    return {
      decision: "Merge",
      tone: "danger",
    };
  }

  if (row.count <= 0) {
    return {
      decision: "Hide",
      tone: "info",
    };
  }

  if (!row.hasConfidence || !row.hasTrace) {
    return {
      decision: "Data",
      tone: "warn",
    };
  }

  if (row.sourceLimited) {
    return {
      decision: "Support",
      tone: "info",
    };
  }

  if (row.id === "autopilot-actions") {
    return {
      decision: "Owns Action",
      tone: "good",
    };
  }

  return {
    decision: "Support",
    tone: "good",
  };
}

function getAISurfaceRegistryRole(row: AIReadoutDiagnosticRow): {
  role: AISurfaceRegistryRole;
  roleLabel: string;
  tone: AIReadoutDiagnosticTone;
} {
  if (row.duplicateRisk) {
    return {
      role: "merge",
      roleLabel: "Merge",
      tone: "danger",
    };
  }

  if (row.id === "autopilot-actions" && row.count > 0 && row.hasConfidence && row.hasTrace) {
    return {
      role: "action-owner",
      roleLabel: "Acts",
      tone: "good",
    };
  }

  if (row.count <= 0 || !row.hasConfidence || !row.hasTrace) {
    return {
      role: "hidden",
      roleLabel: row.count <= 0 ? "Hidden" : "Data",
      tone: row.count <= 0 ? "info" : "warn",
    };
  }

  return {
    role: "context",
    roleLabel: "Supports",
    tone: row.sourceLimited ? "info" : "good",
  };
}

export function buildAISurfaceRegistry(diagnostics: AIReadoutDiagnostics) {
  const rows: AISurfaceRegistryRow[] = diagnostics.rows.map(row => {
    const role = getAISurfaceRegistryRole(row);
    const missing = compactDecisionLogItems([
      !row.hasConfidence ? "confidence" : null,
      !row.hasTrace ? "source trace" : null,
      row.sourceLimited ? "fresh source coverage" : null,
    ], 3);

    return {
      id: row.id,
      tab: row.tab,
      surface: row.surface,
      owner: row.owner,
      role: role.role,
      roleLabel: role.roleLabel,
      tone: role.tone,
      visibility: row.count > 0 ? `${row.count} shown` : "Hidden",
      allowedClaim:
        role.role === "action-owner"
          ? "Can recommend"
          : role.role === "context"
            ? "Evidence only"
            : role.role === "merge"
              ? "No separate claim"
              : "No AI claim",
      evidenceStatus: missing.length
        ? `Missing: ${missing.join(", ")}`
        : row.sourceLimited
          ? "Limited source"
          : "Evidence OK",
      noiseRule:
        role.role === "action-owner"
          ? "Owns the recommendation."
          : role.role === "context"
            ? "Supports only."
            : role.role === "merge"
              ? "Fold into the owner."
              : "Keep hidden.",
      nextStep:
        role.role === "action-owner"
          ? "Hold alternates unless blocked."
          : row.duplicateRisk
            ? "Merge into owner."
            : row.count <= 0
              ? "Wait for data."
              : missing.length
                ? `Add ${missing.join(" + ")}.`
                : row.sourceLimited
                  ? "Refresh sources."
                  : "Keep as support.",
    };
  });

  return {
    rows,
    actionOwners: rows.filter(row => row.role === "action-owner").length,
    contextRows: rows.filter(row => row.role === "context").length,
    hiddenRows: rows.filter(row => row.role === "hidden").length,
    mergeRows: rows.filter(row => row.role === "merge").length,
    riskRows: rows.filter(row =>
      row.role === "hidden" || row.role === "merge" || row.tone === "warn" || row.tone === "danger"
    ).length,
  };
}

function buildAIActionDecisionLogRows(reportData: ReportData): AIDecisionLogRow[] {
  const mode = normalizeLeagueValueMode(
    reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
  );

  try {
    const actionQueue = buildAutopilotData({
      reportData,
      mode,
      fallback: AUTOPILOT_MOCK_DATA[mode],
    }).actionQueue;

    const primaryRows = (actionQueue || []).slice(0, 1).map(item => {
      const conflicts = detectAIActionConflicts(item);
      const conflictReceipts = conflicts.map(
        conflict => `${conflict.label}: ${conflict.detail}`
      );
      const conflictBlockers = conflicts
        .filter(conflict => conflict.tone === "danger")
        .map(conflict => conflict.detail);
      const conflictMissingEvidence = conflicts
        .filter(conflict => conflict.tone === "warn")
        .map(conflict => conflict.detail);

      return {
        id: `action-${item.id}`,
        lane: "Action Queue",
        surface: item.label,
        owner: `${item.source.charAt(0).toUpperCase()}${item.source.slice(1)} action`,
        decision: getAIActionDecisionLabel(item.decision),
        confidence: `${item.confidence}%`,
        tone: getAIActionDecisionTone(item.decision, item.tone),
        why: item.why || item.detail,
        receipts: compactDecisionLogItems([
          ...conflictReceipts,
          ...item.receipts,
          ...item.sourceHealth,
          item.signals[0] ? `Signal: ${item.signals[0]}` : null,
        ]),
        blockers: compactDecisionLogItems([
          ...item.blockers,
          ...conflictBlockers,
        ], 3),
        missingEvidence: compactDecisionLogItems([
          ...item.missingEvidence,
          ...conflictMissingEvidence,
        ], 3),
        changeTriggers: item.changeTriggers.slice(0, 3),
      };
    });

    const suppressedCount = Math.max(0, (actionQueue || []).length - primaryRows.length);
    if (!suppressedCount) return primaryRows;

    return [
      ...primaryRows,
      {
        id: "action-queue-alternates-held",
        lane: "Action Queue",
        surface: "Alternates",
        owner: "Queue QA",
        decision: "Support",
        confidence: "Held",
        tone: "info" as const,
        why: `${suppressedCount} lower-ranked action${suppressedCount === 1 ? "" : "s"} held back.`,
        receipts: compactDecisionLogItems([
          `${suppressedCount} alternate${suppressedCount === 1 ? "" : "s"}`,
          "Primary owns rec",
          "Details in receipts",
        ]),
        blockers: [],
        missingEvidence: [],
        changeTriggers: ["Primary blocked or weaker"],
      },
    ];
  } catch {
    return [
      {
        id: "action-queue-build-error",
        lane: "Action Queue",
        surface: "Action Queue",
        owner: "Recommendations",
        decision: "Hide",
        confidence: "Error",
        tone: "danger",
        why: "Action Queue failed to build.",
        receipts: ["Builder failed"],
        blockers: ["Build failed"],
        missingEvidence: ["Valid payload"],
        changeTriggers: ["Fix builder"],
      },
    ];
  }
}

function buildAIReadoutPolicyDecisionLogRows(
  diagnostics: AIReadoutDiagnostics
): AIDecisionLogRow[] {
  return diagnostics.rows.map(row => {
    const policy = getReadoutPolicy(row);
    return {
      id: `readout-${row.id}`,
      lane: row.tab,
      surface: row.surface,
      owner: row.owner,
      decision: policy.decision,
      confidence: row.hasConfidence ? "Yes" : "Missing",
      tone: policy.tone,
      why: row.note,
      receipts: compactDecisionLogItems([
        `${row.count} shown`,
        row.owner,
        row.hasTrace ? "Trace" : null,
        row.hasConfidence ? "Confidence" : null,
      ]),
      blockers: row.duplicateRisk
        ? ["Duplicate claim"]
        : [],
      missingEvidence: compactDecisionLogItems([
        !row.hasConfidence ? "Confidence" : null,
        !row.hasTrace ? "Source trace" : null,
        row.sourceLimited ? "Fresh source" : null,
      ]),
      changeTriggers: compactDecisionLogItems([
        row.count <= 0 ? `Return ${row.owner.toLowerCase()} data` : null,
        !row.hasConfidence ? "Add confidence" : null,
        !row.hasTrace ? "Add trace" : null,
        row.duplicateRisk ? "Merge copy" : null,
        row.sourceLimited ? "Refresh source" : null,
      ]),
    };
  });
}

export function buildAIDecisionLogRows(
  reportData: ReportData,
  diagnostics: AIReadoutDiagnostics
): AIDecisionLogRow[] {
  const actionRows = buildAIActionDecisionLogRows(reportData);
  const policyRows = buildAIReadoutPolicyDecisionLogRows(diagnostics);
  return [...actionRows, ...policyRows];
}

export function buildAIDecisionLogSummary(rows: AIDecisionLogRow[]) {
  return {
    actionRows: rows.filter(row => row.decision === "Owns Action").length,
    contextRows: rows.filter(row =>
      row.decision === "Watch" || row.decision === "Support"
    ).length,
    hiddenRows: rows.filter(row =>
      row.decision === "Hide" || row.decision === "Data"
    ).length,
    mergeRows: rows.filter(row => row.decision === "Merge").length,
  };
}

export function buildAIReadoutDiagnostics(reportData: ReportData) {
  const managerCount =
    reportData.managerRosterIntelligence?.length ||
    reportData.leagueOverview?.length ||
    0;
  const hasLeagueConfidence = Boolean(reportData.leagueDiagnostics?.aiConfidence);
  const hasManagerConfidence = Boolean(
    reportData.leagueDiagnostics?.aiConfidence?.managerConfidence?.length
  );
  const hasRosterIntel = Boolean(reportData.managerRosterIntelligence?.length);
  const hasRankings = Boolean(
    reportData.rankings?.profiles?.[reportData.rankings.defaultProfileKey || ""]?.length ||
      reportData.rankings?.dynastySf?.length ||
      reportData.rankings?.redraftPpr?.length
  );
  const hasMarketMovement = Boolean(
    reportData.weeklyRisers?.length || reportData.weeklyFallers?.length
  );
  const hasTrades = Boolean(
    reportData.tradeHistory?.length ||
      reportData.tradeTendencies?.length ||
      reportData.tradeProposalSignals?.length
  );
  const hasWaivers = Boolean(
    reportData.waiverIntelligence?.availableTrendingAdds?.length ||
      reportData.recentTransactions?.length
  );
  const hasScheduleContext = Boolean(
    reportData.matchupPreviews?.length ||
      reportData.schedulePlanning?.rosterGaps?.length ||
      reportData.schedulePlanning?.streamerCandidates?.length ||
      reportData.schedulePlanning?.byeWeekNotes?.length
  );
  const hasDraftContext = Boolean(
    reportData.draftPicks?.length || reportData.draftStats?.length
  );
  const situationDeltas = Object.values(reportData.playerDetailsById || {})
    .map(details => details.playerSituationDelta)
    .filter(Boolean);
  const freshSituationDeltas = situationDeltas.filter(delta =>
    delta?.freshness?.grade === "fresh" || delta?.freshness?.grade === "usable"
  );
  const staleSituationDeltas = situationDeltas.filter(delta =>
    delta?.freshness?.grade === "stale" || delta?.freshness?.grade === "missing"
  );

  const rows = [
    buildAIReadoutRow({
      id: "overview-pulse",
      tab: "Overview",
      surface: "Overview Pulse",
      owner: "League story",
      count: 1,
      hasConfidence: hasLeagueConfidence,
      hasTrace: true,
      duplicateRisk: false,
      sourceLimited: !hasRosterIntel,
      note: hasRosterIntel
        ? "Story only; metrics stay elsewhere."
        : "Limited until roster intel returns.",
    }),
    buildAIReadoutRow({
      id: "overview-blueprint",
      tab: "Overview",
      surface: "Monthly Blueprint",
      owner: "Long plan",
      count: managerCount ? 1 : 0,
      hasConfidence: hasLeagueConfidence || hasManagerConfidence,
      hasTrace: Boolean(reportData.monthlyBlueprintSnapshot || hasRosterIntel),
      duplicateRisk: false,
      sourceLimited: false,
      note: reportData.monthlyBlueprintSnapshot
        ? "Uses stored blueprint context."
        : "Using current report data.",
    }),
    buildAIReadoutRow({
      id: "overview-power",
      tab: "Overview",
      surface: "Power Rankings",
      owner: "League order",
      count: reportData.powerRankings?.length || 0,
      hasConfidence: hasManagerConfidence || hasLeagueConfidence,
      hasTrace: Boolean(reportData.powerRankings?.length),
      duplicateRisk: false,
      sourceLimited: !reportData.powerRankings?.length,
      note: "Rankings only; roster/trade reads live elsewhere.",
    }),
    buildAIReadoutRow({
      id: "overview-recon",
      tab: "Overview",
      surface: "Roster Recon",
      owner: "Roster health",
      count: managerCount ? 1 : 0,
      hasConfidence: hasManagerConfidence || hasLeagueConfidence,
      hasTrace: hasRosterIntel,
      duplicateRisk: false,
      sourceLimited: !hasRosterIntel,
      note: "Strengths, gaps, and next roster move.",
    }),
    buildAIReadoutRow({
      id: "overview-trades",
      tab: "Overview",
      surface: "Trade Finder",
      owner: "Trade fit",
      count: Math.max(0, managerCount ? managerCount : 0),
      hasConfidence: hasManagerConfidence || hasLeagueConfidence,
      hasTrace: hasRosterIntel,
      duplicateRisk: false,
      sourceLimited: false,
      note: hasTrades
        ? "Partners, packages, gaps, and outcomes."
        : "Uses roster fit when trade history is thin.",
    }),
    buildAIReadoutRow({
      id: "autopilot-actions",
      tab: "AI Autopilot",
      surface: "Action Queue",
      owner: "Actions",
      count: hasRosterIntel ? Math.min(6, Math.max(1, managerCount + 2)) : 0,
      hasConfidence: hasLeagueConfidence,
      hasTrace: hasRosterIntel,
      duplicateRisk: false,
      sourceLimited: false,
      note: hasScheduleContext || freshSituationDeltas.length
        ? "Uses schedule, roster, waiver, trade, and player context."
        : "Roster-first until matchup/player data is stable.",
    }),
    buildAIReadoutRow({
      id: "schedule-edge",
      tab: "Schedule",
      surface: "Schedule Edge",
      owner: "SOS/matchups",
      count: hasScheduleContext ? 1 : 0,
      hasConfidence: hasScheduleContext && hasLeagueConfidence,
      hasTrace: hasScheduleContext,
      duplicateRisk: false,
      sourceLimited: !hasScheduleContext,
      note: hasScheduleContext
        ? "DraftSharks-first support read."
        : "Hidden until schedule context returns.",
    }),
    buildAIReadoutRow({
      id: "player-situation",
      tab: "Player Detail",
      surface: "Player Situation",
      owner: "Player role",
      count: situationDeltas.length,
      hasConfidence: situationDeltas.length > 0,
      hasTrace: situationDeltas.some(delta => Boolean(delta?.trace?.length || delta?.dynamicSignals?.length)),
      duplicateRisk: false,
      sourceLimited: !freshSituationDeltas.length || staleSituationDeltas.length > freshSituationDeltas.length,
      note: situationDeltas.length
        ? `${freshSituationDeltas.length}/${situationDeltas.length} fresh; ${staleSituationDeltas.length} stale.`
        : "No player situation payload.",
    }),
    buildAIReadoutRow({
      id: "momentum-waivers",
      tab: "Momentum",
      surface: "Waivers",
      owner: "Claims/drops",
      count: reportData.waiverIntelligence?.availableTrendingAdds?.length || 0,
      hasConfidence: hasLeagueConfidence,
      hasTrace: hasWaivers,
      duplicateRisk: false,
      sourceLimited: !hasWaivers,
      note: hasWaivers
        ? "Players, drops, transactions, and needs."
        : "No waiver/transaction payload.",
    }),
    buildAIReadoutRow({
      id: "momentum-market",
      tab: "Momentum",
      surface: "Market Radar",
      owner: "Buy/sell",
      count: (reportData.weeklyRisers?.length || 0) + (reportData.weeklyFallers?.length || 0),
      hasConfidence: hasLeagueConfidence,
      hasTrace: hasMarketMovement,
      duplicateRisk: false,
      sourceLimited: !hasMarketMovement,
      note: hasMarketMovement
        ? "Weekly value movement."
        : "No riser/faller payload.",
    }),
    buildAIReadoutRow({
      id: "rankings-market",
      tab: "Rankings",
      surface: "Ranking Signal",
      owner: "Board market",
      count: hasRankings ? 1 : 0,
      hasConfidence: hasLeagueConfidence,
      hasTrace: hasRankings,
      duplicateRisk: false,
      sourceLimited: !hasRankings,
      note: hasRankings
        ? "Board-level value movement."
        : "Ranking rows missing/loading.",
    }),
    buildAIReadoutRow({
      id: "trade-browser",
      tab: "Trade History",
      surface: "Trade Browser",
      owner: "Trade ledger",
      count: hasTrades ? 1 : 0,
      hasConfidence: hasLeagueConfidence,
      hasTrace: hasTrades,
      duplicateRisk: false,
      sourceLimited: false,
      note: hasTrades
        ? "Ledger size, gaps, tendencies, and outcomes."
        : "No trade-history payload.",
    }),
    buildAIReadoutRow({
      id: "draft-history",
      tab: "Draft",
      surface: "Draft Capital",
      owner: "Draft runway",
      count: hasDraftContext ? 1 : 0,
      hasConfidence: hasLeagueConfidence,
      hasTrace: hasDraftContext,
      duplicateRisk: false,
      sourceLimited: !hasDraftContext,
      note: hasDraftContext
        ? "Draft slot, runway, and hit context."
        : "Hidden until draft payload returns.",
    }),
  ];

  const totalReadouts = rows.reduce((sum, row) => sum + row.count, 0);
  const missingConfidence = rows.filter(row => row.count > 0 && !row.hasConfidence).length;
  const missingTrace = rows.filter(row => row.count > 0 && !row.hasTrace).length;
  const duplicateRisk = rows.filter(row => row.duplicateRisk).length;
  const sourceLimited = rows.filter(row => row.count > 0 && row.sourceLimited).length;
  const tabSummaries = Array.from(
    rows.reduce((map, row) => {
      const current = map.get(row.tab) || {
        tab: row.tab,
        count: 0,
        warnings: 0,
      };
      current.count += row.count;
      if (
        row.count > 0 &&
        (!row.hasConfidence || !row.hasTrace || row.duplicateRisk)
      ) {
        current.warnings += 1;
      }
      map.set(row.tab, current);
      return map;
    }, new Map<string, { tab: string; count: number; warnings: number }>())
  ).map(([, summary]) => summary);

  return {
    rows,
    tabSummaries,
    totalReadouts,
    missingConfidence,
    missingTrace,
    duplicateRisk,
    sourceLimited,
  };
}

export function AdminAIReadoutDiagnosticsSection({
  reportData,
}: {
  reportData: ReportData;
}) {
  const diagnostics = buildAIReadoutDiagnostics(reportData);
  const registry = buildAISurfaceRegistry(diagnostics);
  const decisionLogRows = buildAIDecisionLogRows(reportData, diagnostics);
  const decisionLogSummary = buildAIDecisionLogSummary(decisionLogRows);
  const flaggedRows = diagnostics.rows.filter(
    row =>
      row.count > 0 &&
      (!row.hasConfidence || !row.hasTrace || row.duplicateRisk)
  );
  if (!flaggedRows.length && !decisionLogRows.length) return null;

  return (
    <CollapsibleReportSection
      title="AI Readout QA"
      kicker="Ownership and evidence"
      previewMetrics={[
        {
          label: "Rows",
          value: decisionLogRows.length,
          tone: decisionLogRows.length ? "info" : "warn",
        },
        {
          label: "Owner",
          value: registry.actionOwners,
          tone: registry.actionOwners === 1 ? "good" : "warn",
        },
        {
          label: "Needs Work",
          value: registry.hiddenRows + registry.mergeRows,
          tone: registry.hiddenRows || registry.mergeRows ? "warn" : "good",
        },
      ]}
      premium
    >
      <div className="admin-ai-readout-diagnostics">
        <div className="admin-ai-readout-summary">
          <span>
            <strong>{diagnostics.totalReadouts}</strong>
            <em>observed</em>
          </span>
          <span>
            <strong>{diagnostics.missingConfidence}</strong>
            <em>no confidence</em>
          </span>
          <span>
            <strong>{diagnostics.missingTrace}</strong>
            <em>no trace</em>
          </span>
          <span>
            <strong>{diagnostics.duplicateRisk}</strong>
            <em>dupes</em>
          </span>
          <span>
            <strong>{diagnostics.sourceLimited}</strong>
            <em>limited</em>
          </span>
        </div>

        <div className="admin-ai-readout-tab-grid" aria-label="AI readout count by tab">
          {diagnostics.tabSummaries.map(summary => (
            <article key={summary.tab}>
              <span>{summary.tab}</span>
              <strong>{summary.count}</strong>
              <em>{summary.warnings} flag{summary.warnings === 1 ? "" : "s"}</em>
            </article>
          ))}
        </div>

        <section
          className="admin-ai-surface-registry"
          aria-label="AI surface registry"
        >
          <div className="admin-ai-surface-registry-head">
            <div>
              <span>Surface Rules</span>
              <strong>One owner. Others support.</strong>
              <p>Shows what can act, explain, hide, or merge.</p>
            </div>
            <div className="admin-ai-surface-registry-metrics">
              <span>
                <strong>{registry.actionOwners}</strong>
                <em>owner</em>
              </span>
              <span>
                <strong>{registry.contextRows}</strong>
                <em>support</em>
              </span>
              <span>
                <strong>{registry.hiddenRows}</strong>
                <em>hidden</em>
              </span>
              <span>
                <strong>{registry.mergeRows}</strong>
                <em>merge</em>
              </span>
            </div>
          </div>

          <div className="admin-ai-surface-registry-grid">
            {registry.rows.map(row => (
              <article
                key={row.id}
                className={`admin-ai-surface-registry-row admin-ai-surface-registry-row-${row.role} admin-ai-readout-row-${row.tone}`}
              >
                <div className="admin-ai-surface-registry-row-head">
                  <span>{row.tab}</span>
                  <strong>{row.surface}</strong>
                  <em>{row.roleLabel}</em>
                </div>
                <div className="admin-ai-surface-registry-body">
                  <p>{row.noiseRule}</p>
                  <p>{row.nextStep}</p>
                </div>
                <div className="admin-ai-surface-registry-receipts">
                  <span>Own: {row.owner}</span>
                  <span>{row.visibility}</span>
                  <span>{row.allowedClaim}</span>
                  <span>{row.evidenceStatus}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="admin-ai-decision-log"
          aria-label="AI decision log rows"
        >
          <div className="admin-ai-decision-log-head">
            <div>
              <span>Rules Log</span>
              <strong>Own, support, hide, or merge.</strong>
              <p>Quick check for noisy or unsupported AI cards.</p>
            </div>
            <div className="admin-ai-decision-log-metrics">
              <span>
                <strong>{decisionLogSummary.actionRows}</strong>
                <em>owner</em>
              </span>
              <span>
                <strong>{decisionLogSummary.contextRows}</strong>
                <em>support</em>
              </span>
              <span>
                <strong>{decisionLogSummary.hiddenRows}</strong>
                <em>hidden</em>
              </span>
              <span>
                <strong>{decisionLogSummary.mergeRows}</strong>
                <em>merge</em>
              </span>
            </div>
          </div>

          <div className="admin-ai-decision-log-grid">
            {decisionLogRows.map(row => (
              <article
                key={row.id}
                className={`admin-ai-decision-log-row admin-ai-readout-row-${row.tone}`}
              >
                <div className="admin-ai-decision-log-row-head">
                  <span>{row.lane}</span>
                  <strong>{row.surface}</strong>
                  <em>{row.decision}</em>
                </div>
                <p>{row.why}</p>
                <div className="admin-ai-decision-log-receipts">
                  <span>Own: {row.owner}</span>
                  <span>Conf: {row.confidence}</span>
                  {row.receipts.map(receipt => (
                    <span key={receipt}>{receipt}</span>
                  ))}
                </div>
                {(row.blockers.length > 0 ||
                  row.missingEvidence.length > 0 ||
                  row.changeTriggers.length > 0) && (
                  <div className="admin-ai-decision-log-lists">
                    {row.blockers.length > 0 && (
                      <div>
                        <span>Blocks</span>
                        {row.blockers.map(blocker => (
                          <p key={blocker}>{blocker}</p>
                        ))}
                      </div>
                    )}
                    {row.missingEvidence.length > 0 && (
                      <div>
                        <span>Missing</span>
                        {row.missingEvidence.map(item => (
                          <p key={item}>{item}</p>
                        ))}
                      </div>
                    )}
                    {row.changeTriggers.length > 0 && (
                      <div>
                        <span>Changes</span>
                        {row.changeTriggers.map(item => (
                          <p key={item}>{item}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {flaggedRows.length > 0 ? (
          <section
            className="admin-ai-readout-flag-panel"
            aria-label="AI readout coverage flags"
          >
            <div>
              <span>Flags</span>
              <strong>
                {flaggedRows.length} to review
              </strong>
            </div>
            <div className="admin-ai-readout-row-grid">
              {flaggedRows.map(row => (
                <article
                  key={row.id}
                  className={`admin-ai-readout-row admin-ai-readout-row-${row.tone}`}
                >
                  <div>
                    <span>{row.tab}</span>
                    <strong>{row.surface}</strong>
                  </div>
                  <p>{row.note}</p>
                  <div className="admin-ai-readout-chip-row">
                    <em>{row.owner}</em>
                    {!row.hasConfidence && <em>No confidence</em>}
                    {!row.hasTrace && <em>No trace</em>}
                    {row.duplicateRisk && <em>Dupe</em>}
                    {row.sourceLimited && <em>Limited</em>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <p className="admin-ai-readout-clean">
            All observed readouts have confidence, trace, and no duplicate flags.
          </p>
        )}
      </div>
    </CollapsibleReportSection>
  );
}
