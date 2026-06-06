import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import type { PlayerDetails, ReportData } from "@shared/types";

type ReceiptDiagnosticTone = "good" | "info" | "warn" | "danger";

type PlayerReceiptDiagnosticRow = {
  id: string;
  name: string;
  position: string;
  value: number | null;
  status: "Visible" | "Internal" | "No bucket";
  tone: ReceiptDiagnosticTone;
  bucket: string;
  recommendation: string;
  sampleSize: number | null;
  confidenceGrade: string;
  improvedOrSustainedRate: number | null;
  materialFailureRate: number | null;
  medianNextProductionDelta: number | null;
  reason: string;
  guardrails: string[];
};

type ReceiptBucketSummary = {
  key: string;
  label: string;
  recommendation: string;
  confidenceGrade: string;
  sampleSize: number;
  visibleCount: number;
  internalCount: number;
  tone: ReceiptDiagnosticTone;
};

function getPlayerDiagnosticValue(details: PlayerDetails): number | null {
  const profile = details.valueProfile;
  const values = [
    profile?.dynastyValue,
    profile?.seasonValue,
    profile?.balancedValue,
    profile?.marketKtc,
    profile?.fantasyCalcDynasty,
    profile?.fantasyCalcRedraft,
  ]
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value > 0);
  return values.length ? Math.max(...values) : null;
}

function hasPlayerExternalIdentity(details: PlayerDetails): boolean {
  return Boolean(
    details.externalIds?.gsis ||
      details.externalIds?.pfr ||
      details.externalIds?.espn ||
      details.externalIds?.fantasyPros
  );
}

function getPlayerReceiptGuardrails(details: PlayerDetails): string[] {
  const guardrails: string[] = [];
  const value = getPlayerDiagnosticValue(details);
  const cohort = details.playerCohort;

  if (!hasPlayerExternalIdentity(details)) guardrails.push("missing cross-source ID");
  if (!details.usageTrend) guardrails.push("missing usage trend");
  if (
    details.lastSeasonPointsPerGame === null ||
    details.lastSeasonPointsPerGame === undefined
  ) {
    guardrails.push("missing production baseline");
  }
  if (value === null) guardrails.push("missing value baseline");
  if (cohort?.calibration?.evidenceGrade === "blocked") {
    guardrails.push("cohort evidence blocked");
  }
  if (!details.team && !details.nflDraftTeam) guardrails.push("missing NFL team context");
  if (
    value !== null &&
    value < 300 &&
    !details.usageTrend &&
    !hasPlayerExternalIdentity(details)
  ) {
    guardrails.push("low-value/noise candidate");
  }

  return Array.from(new Set(guardrails));
}

function getReceiptHiddenReason(
  details: PlayerDetails,
  guardrails: string[]
): string {
  const receipt = details.playerCohort?.seasonOutcomeReceipt;
  const calibration = details.playerCohort?.calibration;

  if (!receipt) {
    return guardrails.length
      ? `No calibrated production/role bucket matched; guardrails: ${guardrails.join(", ")}.`
      : "No calibrated production/role bucket matched the current player card inputs.";
  }
  if (receipt.displayEligible) {
    return "Visible because the bucket is non-neutral, sample-backed, usable/strong confidence, and the player evidence is not blocked.";
  }
  if (receipt.sampleSize < 14) {
    return `Internal only because ${receipt.sampleSize} historical samples is below the 14-sample visible threshold.`;
  }
  if (receipt.confidenceGrade === "thin" || receipt.confidenceGrade === "blocked") {
    return `Internal only because the bucket confidence grade is ${receipt.confidenceGrade}.`;
  }
  if (receipt.recommendation === "neutral") {
    return "Internal only because the historical bucket is neutral.";
  }
  if (calibration?.evidenceGrade === "blocked") {
    return "Internal only because the player-level cohort evidence is blocked.";
  }
  if (
    (receipt.recommendation === "amplify" ||
      receipt.recommendation === "lean-positive") &&
    !calibration?.strongReadEligible
  ) {
    return "Internal only because positive receipts require strong-read eligibility.";
  }
  return receipt.note || "Internal only until the receipt passes every display gate.";
}

function getReceiptDiagnosticTone(
  row: Pick<PlayerReceiptDiagnosticRow, "status" | "materialFailureRate" | "recommendation" | "guardrails">
): ReceiptDiagnosticTone {
  if (row.guardrails.includes("low-value/noise candidate") || row.guardrails.includes("cohort evidence blocked")) return "danger";
  if (row.recommendation === "fade-risk" || (row.materialFailureRate || 0) >= 45) return "warn";
  if (row.status === "Visible") return "good";
  if (row.guardrails.length) return "warn";
  return "info";
}

function formatReceiptRate(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return `${value}%`;
}

function formatReceiptDelta(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value}`;
}

function buildPlayerReceiptDiagnostics(reportData: ReportData): {
  rows: PlayerReceiptDiagnosticRow[];
  receiptRows: PlayerReceiptDiagnosticRow[];
  guardrailRows: PlayerReceiptDiagnosticRow[];
  bucketSummaries: ReceiptBucketSummary[];
  totals: {
    players: number;
    withReceipt: number;
    visible: number;
    internal: number;
    noBucket: number;
    guardrails: number;
  };
} {
  const rows = Object.entries(reportData.playerDetailsById || {})
    .map(([playerId, details]) => {
      const receipt = details.playerCohort?.seasonOutcomeReceipt || null;
      const guardrails = getPlayerReceiptGuardrails(details);
      const status: PlayerReceiptDiagnosticRow["status"] = receipt
        ? receipt.displayEligible
          ? "Visible"
          : "Internal"
        : "No bucket";
      const row: PlayerReceiptDiagnosticRow = {
        id: playerId,
        name: details.fullName || playerId,
        position: details.position || "N/A",
        value: getPlayerDiagnosticValue(details),
        status,
        tone: "info",
        bucket: receipt?.label || "No calibrated bucket",
        recommendation: receipt?.recommendation || "n/a",
        sampleSize: receipt?.sampleSize ?? null,
        confidenceGrade: receipt?.confidenceGrade || "n/a",
        improvedOrSustainedRate: receipt?.improvedOrSustainedRate ?? null,
        materialFailureRate: receipt?.materialFailureRate ?? null,
        medianNextProductionDelta: receipt?.medianNextProductionDelta ?? null,
        reason: getReceiptHiddenReason(details, guardrails),
        guardrails,
      };
      return {
        ...row,
        tone: getReceiptDiagnosticTone(row),
      };
    })
    .sort(
      (a, b) =>
        (a.status === "Visible" ? 0 : a.status === "Internal" ? 1 : 2) -
          (b.status === "Visible" ? 0 : b.status === "Internal" ? 1 : 2) ||
        b.guardrails.length - a.guardrails.length ||
        a.name.localeCompare(b.name)
    );

  const receiptRows = rows.filter(row => row.status !== "No bucket");
  const guardrailRows = receiptRows.filter(row => row.guardrails.length > 0);
  const bucketMap = new Map<string, ReceiptBucketSummary>();
  receiptRows.forEach(row => {
    const key = `${row.bucket}:${row.recommendation}:${row.confidenceGrade}:${row.sampleSize ?? "n/a"}`;
    const current =
      bucketMap.get(key) ||
      {
        key,
        label: row.bucket,
        recommendation: row.recommendation,
        confidenceGrade: row.confidenceGrade,
        sampleSize: row.sampleSize || 0,
        visibleCount: 0,
        internalCount: 0,
        tone: row.tone,
      };
    if (row.status === "Visible") current.visibleCount += 1;
    if (row.status === "Internal") current.internalCount += 1;
    if (row.tone === "danger" || (row.tone === "warn" && current.tone !== "danger")) {
      current.tone = row.tone;
    }
    bucketMap.set(key, current);
  });

  return {
    rows,
    receiptRows,
    guardrailRows,
    bucketSummaries: Array.from(bucketMap.values()).sort(
      (a, b) =>
        b.visibleCount - a.visibleCount ||
        b.internalCount - a.internalCount ||
        b.sampleSize - a.sampleSize ||
        a.label.localeCompare(b.label)
    ),
    totals: {
      players: rows.length,
      withReceipt: receiptRows.length,
      visible: rows.filter(row => row.status === "Visible").length,
      internal: rows.filter(row => row.status === "Internal").length,
      noBucket: rows.filter(row => row.status === "No bucket").length,
      guardrails: guardrailRows.length,
    },
  };
}

export function AdminPlayerReceiptDiagnosticsSection({
  reportData,
}: {
  reportData: ReportData;
}) {
  const diagnostics = buildPlayerReceiptDiagnostics(reportData);
  if (!diagnostics.guardrailRows.length) return null;

  return (
    <CollapsibleReportSection
      title="Player Receipt Audit"
      kicker="Historical receipt display gates and bad-read guardrails"
      previewMetrics={[
        {
          label: "Players",
          value: diagnostics.totals.players,
          tone: diagnostics.totals.players ? "info" : "warn",
        },
        {
          label: "Visible",
          value: diagnostics.totals.visible,
          tone: diagnostics.totals.visible ? "good" : "info",
        },
        {
          label: "Guardrails",
          value: diagnostics.totals.guardrails,
          tone: diagnostics.totals.guardrails ? "warn" : "good",
        },
      ]}
      premium
    >
      <div className="admin-ai-readout-diagnostics admin-player-receipt-diagnostics">
        <div className="admin-ai-readout-summary">
          <span>
            <strong>{diagnostics.totals.players}</strong>
            <em>players checked</em>
          </span>
          <span>
            <strong>{diagnostics.totals.withReceipt}</strong>
            <em>bucket matches</em>
          </span>
          <span>
            <strong>{diagnostics.totals.visible}</strong>
            <em>visible receipts</em>
          </span>
          <span>
            <strong>{diagnostics.totals.internal}</strong>
            <em>internal receipts</em>
          </span>
          <span>
            <strong>{diagnostics.totals.guardrails}</strong>
            <em>guardrail flags</em>
          </span>
        </div>

        {diagnostics.guardrailRows.length > 0 ? (
          <section
            className="admin-ai-readout-flag-panel"
            aria-label="Player receipt guardrail flags"
          >
            <div>
              <span>Guardrail Flags</span>
              <strong>
                {diagnostics.guardrailRows.length} player
                {diagnostics.guardrailRows.length === 1 ? "" : "s"} need review before stronger reads
              </strong>
            </div>
            <div className="admin-ai-readout-row-grid">
              {diagnostics.guardrailRows.slice(0, 24).map(row => (
                <article
                  key={`guardrail-${row.id}`}
                  className={`admin-ai-readout-row admin-ai-readout-row-${row.tone}`}
                >
                  <div>
                    <span>{row.status}</span>
                    <strong>{row.name} · {row.position}</strong>
                  </div>
                  <p>{row.reason}</p>
                  <div className="admin-ai-readout-chip-row">
                    <em>{row.bucket}</em>
                    <em>{row.recommendation}</em>
                    <em>{row.confidenceGrade}</em>
                    <em>{row.sampleSize ?? "n/a"} samples</em>
                    {row.guardrails.map(flag => (
                      <em key={flag}>{flag}</em>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <p className="admin-ai-readout-clean">
            No player receipt guardrails fired for this payload.
          </p>
        )}
      </div>
    </CollapsibleReportSection>
  );
}

export { formatReceiptRate, formatReceiptDelta };
