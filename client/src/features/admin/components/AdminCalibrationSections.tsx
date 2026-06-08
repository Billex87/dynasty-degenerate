import { Button } from "@/components/ui/button";
import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import { AdminAttentionBadge } from "@/features/report/components/AdminDiagnosticsPrimitives";
import { trpc } from "@/lib/trpc";
import { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../../server/routers";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type AICalibrationData = RouterOutputs["system"]["aiCalibration"];
type AICalibrationAdjustmentRow =
  AICalibrationData["adjustmentProfile"]["adjustments"][number];

function formatAdminTelemetryDate(value?: string | null): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getCalibrationTone(row: AICalibrationAdjustmentRow): "danger" | "warn" | "info" | "good" {
  return row.priority === "danger" || row.priority === "warn" || row.priority === "good"
    ? row.priority
    : "info";
}

function formatCalibrationGroup(group: Record<string, string>): string {
  const entries = Object.entries(group);
  if (!entries.length || group.all) return "All AI reads";
  return entries
    .map(([key, value]) => `${key.replace(/([A-Z])/g, " $1")}: ${value}`)
    .join(" · ");
}

function formatCalibrationAdjustment(row: AICalibrationAdjustmentRow): string {
  const score = row.scoreAdjustment > 0
    ? `+${row.scoreAdjustment}`
    : String(row.scoreAdjustment);
  const cap = row.confidenceCap !== null
    ? ` · cap ${row.confidenceCap}%`
    : "";
  return `${score} score${cap}`;
}

function getOutcomeMemoryBucketTone(bucket: {
  recommendation: string;
  scoredCount: number;
}): "error" | "warn" | "info" | "success" {
  if (bucket.recommendation === "review-model" || bucket.recommendation === "lower-confidence") return "error";
  if (bucket.recommendation === "raise-confidence") return "info";
  if (bucket.scoredCount < 5) return "warn";
  return "success";
}

function getOutcomeLedgerTone(status: string): "error" | "warn" | "info" | "success" {
  if (status === "miss") return "error";
  if (status === "pending") return "warn";
  if (status === "blocked" || status === "push") return "info";
  return "success";
}

function getCalibrationActionCount(data?: AICalibrationData): number {
  if (!data) return 0;
  return data.adjustmentProfile.adjustments.filter(row =>
    row.recommendation === "review-model" ||
    row.recommendation === "lower-confidence"
  ).length;
}

function AdminAICalibrationSection() {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const canViewTelemetry = canViewAdminTelemetryForUser(authQuery.data);
  const calibrationQuery = trpc.system.aiCalibration.useQuery(
    { limit: 1000 },
    {
      enabled: canViewTelemetry,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60,
    }
  );
  const actionCount = getCalibrationActionCount(calibrationQuery.data);
  const tone = calibrationQuery.data?.adjustmentProfile.adjustments.some(row => row.priority === "danger")
    ? "danger"
    : "warn";

  return (
    <CollapsibleReportSection
      title="AI Calibration"
      kicker="Outcome feedback loop"
      previewAccessory={
        actionCount > 0 ? (
          <AdminAttentionBadge
            count={actionCount}
            label="Score changes"
            tone={tone}
          />
        ) : undefined
      }
      premium
    >
      <AdminAICalibrationPanel
        canViewTelemetry={canViewTelemetry}
        isAuthLoading={authQuery.isLoading}
        data={calibrationQuery.data}
        error={calibrationQuery.error}
        isLoading={calibrationQuery.isLoading}
        isFetching={calibrationQuery.isFetching}
        refetch={calibrationQuery.refetch}
      />
    </CollapsibleReportSection>
  );
}

function AdminAICalibrationPanel({
  canViewTelemetry,
  isAuthLoading,
  data,
  error,
  isLoading,
  isFetching,
  refetch,
}: {
  canViewTelemetry: boolean;
  isAuthLoading: boolean;
  data: AICalibrationData | undefined;
  error: { message: string } | null;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}) {
  const resolveMutation = trpc.system.resolveAiPredictionOutcomes.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });
  const feedbackMutation = trpc.system.markAiPredictionOutcome.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  if (isAuthLoading) {
    return (
      <div className="rankings-empty-state">
        Checking AI calibration access...
      </div>
    );
  }

  if (!canViewTelemetry) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>AI calibration is locked until Admin Tools are unlocked.</p>
        <span>
          This panel exposes hit rates, confidence drift, and scoring changes
          from stored AI prediction outcomes.
        </span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rankings-empty-state">
        Loading AI calibration...
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>AI calibration is unavailable for this session.</p>
        <span>{error.message}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rankings-empty-state">
        No AI calibration events available.
      </div>
    );
  }

  const profile = data.adjustmentProfile;
  const global = profile.globalAdjustment;
  const actionableRows = profile.adjustments
    .filter(row =>
      row.recommendation === "review-model" ||
      row.recommendation === "lower-confidence" ||
      row.recommendation === "raise-confidence"
    )
    .slice(0, 8);
  const recentResolved = data.recentEvents
    .filter(event => event.outcomeStatus !== "pending")
    .slice(0, 8);
  const feedbackRows = data.recentEvents.slice(0, 6);
  const counterfactual = data.counterfactuals;
  const counterfactualBuckets = counterfactual.buckets
    .filter(bucket => bucket.status !== "all")
    .slice(0, 6);
  const managerTradeRows = data.managerTrades.rows.slice(0, 6);
  const moduleQualityRows = data.moduleQuality.rows;
  const outcomeMemory = data.outcomeMemory;
  const outcomeLedgerRows = outcomeMemory.ledger.slice(0, 10);
  const confidenceBuckets = outcomeMemory.confidenceBuckets.slice(0, 6);
  const moduleScorecards = outcomeMemory.moduleScorecards.slice(0, 8);
  const sharpnessBuckets = outcomeMemory.sharpnessBuckets.slice(0, 6);
  const automaticAdjustments = outcomeMemory.automaticAdjustments.slice(0, 6);
  const pendingCount = profile.pendingCount;
  const totalCards = [
    {
      label: "Scored",
      value: profile.scoredCount,
      detail: `${profile.eventCount.toLocaleString()} logged reads`,
      tone: profile.scoredCount >= 20 ? "good" : "neutral",
    },
    {
      label: "Pending",
      value: pendingCount,
      detail: pendingCount ? "Resolve outcomes to calibrate" : "No pending outcomes",
      tone: pendingCount ? "warn" : "good",
    },
    {
      label: "Hit Rate",
      value: global.hitRate === null ? "n/a" : `${global.hitRate}%`,
      detail: `${global.avgConfidence ?? 0}% average confidence`,
      tone: global.recommendation === "review-model" ? "danger" : "neutral",
    },
    {
      label: "Gap",
      value: global.calibrationGap === null ? "n/a" : `${global.calibrationGap}`,
      detail: global.reason,
      tone: global.priority,
    },
    {
      label: "Global Move",
      value: formatCalibrationAdjustment(global),
      detail: global.recommendation.replace(/-/g, " "),
      tone: global.priority,
    },
    {
      label: "Baseline Edge",
      value: counterfactual.avgEdge === null ? "n/a" : `${counterfactual.avgEdge}`,
      detail: `${counterfactual.baselineCount.toLocaleString()} reads with counterfactuals`,
      tone: counterfactual.doWithoutBaselineEdgeCount ? "warn" : "good",
    },
  ];

  return (
    <div className="admin-traffic-panel admin-ai-calibration-panel">
      <div className="admin-traffic-header">
        <div>
          <span>Calibration engine</span>
          <strong>
            Outcome-weighted AI scoring · {formatAdminTelemetryDate(data.generatedAt)}
          </strong>
        </div>
        <div className="admin-ai-calibration-actions">
          <Button
            type="button"
            variant="outline"
            className="admin-traffic-refresh"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            className="admin-traffic-refresh"
            disabled={resolveMutation.isPending}
            onClick={() => resolveMutation.mutate({ limit: 200 })}
          >
            {resolveMutation.isPending ? "Resolving..." : "Resolve Pending"}
          </Button>
        </div>
      </div>

      <div className="admin-traffic-stat-grid">
        {totalCards.map(card => (
          <article
            key={card.label}
            className={`admin-traffic-stat admin-traffic-stat-${card.tone}`}
          >
            <span>{card.label}</span>
            <strong>
              {typeof card.value === "number"
                ? card.value.toLocaleString()
                : card.value}
            </strong>
            <em>{card.detail}</em>
          </article>
        ))}
      </div>

      {resolveMutation.data && (
        <div className="admin-ai-readout-clean">
          Resolved {resolveMutation.data.resolved.toLocaleString()} outcome
          {resolveMutation.data.resolved === 1 ? "" : "s"} ·{" "}
          {resolveMutation.data.pending.toLocaleString()} still pending ·{" "}
          {resolveMutation.data.failed.toLocaleString()} failed
        </div>
      )}

      <section className="admin-outcome-memory">
        <div className="admin-outcome-memory-head">
          <div>
            <span>Outcome Memory 2.0</span>
            <strong>Every AI call gets graded or stays confidence-limited.</strong>
            <p>
              Ledger, confidence buckets, module scorecards, sharpness buckets,
              and auto-adjustment recommendations from stored prediction events.
            </p>
          </div>
          <div className="admin-ai-readout-chip-row">
            <em>{outcomeMemory.eventCount.toLocaleString()} logged</em>
            <em>{outcomeMemory.scoredCount.toLocaleString()} scored</em>
            <em>{outcomeMemory.pendingCount.toLocaleString()} pending</em>
          </div>
        </div>

        <div className="admin-traffic-grid admin-provider-telemetry-grid admin-outcome-memory-grid">
          <section className="admin-traffic-card admin-outcome-memory-ledger">
            <h4>Outcome Ledger</h4>
            <div className="admin-traffic-list">
              {outcomeLedgerRows.length ? (
                outcomeLedgerRows.map(row => (
                  <article
                    key={row.eventId}
                    className={`admin-traffic-row admin-traffic-row-${getOutcomeLedgerTone(row.outcomeStatus)}`}
                  >
                    <strong>{row.entityName || row.module}</strong>
                    <span>
                      {row.module} · {row.decision} · {row.outcomeStatus} · {row.finalScore}%
                    </span>
                    <em>
                      {row.label} · cap {row.confidenceCap}% · source {row.sourceAgreement}
                    </em>
                    <em>
                      {row.sharpnessLabel
                        ? `${row.sharpnessLabel}${row.sharpnessScore !== null ? ` ${row.sharpnessScore}%` : ""}`
                        : "sharpness not tagged"} · {row.counterfactualStatus.replace(/-/g, " ")}
                    </em>
                    {row.observedOutcomeStatus ? (
                      <em>
                        observed {row.observedOutcomeStatus.replace(/^observed_/, "").replace(/_/g, " ")}
                        {row.observedOutcomeConfidence !== null
                          ? ` · ${row.observedOutcomeConfidence}% confidence`
                          : ""}
                        {row.observedOutcomeDetectedFrom
                          ? ` · ${row.observedOutcomeDetectedFrom.replace(/_/g, " ")}`
                          : ""}
                      </em>
                    ) : null}
                    {row.evidencePreview.length ? (
                      <em>{row.evidencePreview.slice(0, 2).join(" · ")}</em>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="admin-traffic-empty">
                  No AI prediction ledger rows are stored yet.
                </p>
              )}
            </div>
          </section>

          <section className="admin-traffic-card">
            <h4>Confidence Buckets</h4>
            <div className="admin-traffic-list">
              {confidenceBuckets.length ? (
                confidenceBuckets.map(bucket => (
                  <article
                    key={bucket.key}
                    className={`admin-traffic-row admin-traffic-row-${getOutcomeMemoryBucketTone(bucket)}`}
                  >
                    <strong>{bucket.group.label}</strong>
                    <span>
                      {bucket.scoredCount.toLocaleString()} scored · hit {bucket.hitRate ?? "n/a"}%
                    </span>
                    <em>
                      avg {bucket.avgConfidence ?? "n/a"}% · gap {bucket.calibrationGap ?? "n/a"} ·{" "}
                      {bucket.recommendation.replace(/-/g, " ")}
                    </em>
                  </article>
                ))
              ) : (
                <p className="admin-traffic-empty">
                  Confidence-bucket accuracy needs resolved outcomes.
                </p>
              )}
            </div>
          </section>

          <section className="admin-traffic-card">
            <h4>Module Scorecards</h4>
            <div className="admin-traffic-list">
              {moduleScorecards.length ? (
                moduleScorecards.map(bucket => (
                  <article
                    key={bucket.key}
                    className={`admin-traffic-row admin-traffic-row-${getOutcomeMemoryBucketTone(bucket)}`}
                  >
                    <strong>
                      {bucket.group.surface} · {bucket.group.action}
                    </strong>
                    <span>
                      {bucket.eventCount.toLocaleString()} logged · {bucket.pendingCount.toLocaleString()} pending
                    </span>
                    <em>
                      hit {bucket.hitRate ?? "n/a"}% · avg {bucket.avgConfidence ?? "n/a"}% ·{" "}
                      {bucket.recommendation.replace(/-/g, " ")}
                    </em>
                  </article>
                ))
              ) : (
                <p className="admin-traffic-empty">
                  Module scorecards need stored AI calls.
                </p>
              )}
            </div>
          </section>

          <section className="admin-traffic-card">
            <h4>Sharpness Calibration</h4>
            <div className="admin-traffic-list">
              {sharpnessBuckets.length ? (
                sharpnessBuckets.map(bucket => (
                  <article
                    key={bucket.key}
                    className={`admin-traffic-row admin-traffic-row-${getOutcomeMemoryBucketTone(bucket)}`}
                  >
                    <strong>{bucket.group.leagueSharpness}</strong>
                    <span>
                      {bucket.scoredCount.toLocaleString()} scored · hit {bucket.hitRate ?? "n/a"}%
                    </span>
                    <em>
                      avg {bucket.avgConfidence ?? "n/a"}% · gap {bucket.calibrationGap ?? "n/a"} ·{" "}
                      {bucket.recommendation.replace(/-/g, " ")}
                    </em>
                  </article>
                ))
              ) : (
                <p className="admin-traffic-empty">
                  Sharpness calibration starts once tagged Action Queue calls resolve.
                </p>
              )}
            </div>
          </section>

          <section className="admin-traffic-card">
            <h4>Automatic Confidence Adjustments</h4>
            <div className="admin-traffic-list">
              {automaticAdjustments.length ? (
                automaticAdjustments.map(row => (
                  <article
                    key={row.key}
                    className={`admin-traffic-row admin-traffic-row-${getCalibrationTone(row) === "danger" ? "error" : getCalibrationTone(row)}`}
                  >
                    <strong>{formatCalibrationGroup(row.group)}</strong>
                    <span>
                      {formatCalibrationAdjustment(row)} · {row.recommendation.replace(/-/g, " ")}
                    </span>
                    <em>{row.reason}</em>
                  </article>
                ))
              ) : (
                <p className="admin-traffic-empty">
                  No automatic confidence moves yet. Keep collecting outcomes.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>

      <div className="admin-traffic-grid admin-provider-telemetry-grid">
        <section className="admin-traffic-card">
          <h4>Score Adjustments</h4>
          <div className="admin-traffic-list">
            {actionableRows.length ? (
              actionableRows.map(row => (
                <article
                  key={row.key}
                  className={`admin-traffic-row admin-traffic-row-${getCalibrationTone(row) === "danger" ? "error" : getCalibrationTone(row)}`}
                >
                  <strong>{formatCalibrationGroup(row.group)}</strong>
                  <span>
                    {formatCalibrationAdjustment(row)} · {row.recommendation.replace(/-/g, " ")}
                  </span>
                  <em>
                    {row.scoredCount.toLocaleString()} scored · hit{" "}
                    {row.hitRate ?? "n/a"}% · avg {row.avgConfidence ?? "n/a"}%
                  </em>
                  <em>{row.reason}</em>
                </article>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No actionable scoring changes yet. Keep collecting resolved
                outcomes before moving confidence.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Module Accuracy</h4>
          <div className="admin-traffic-list">
            {moduleQualityRows.map(row => (
              <article
                key={row.key}
                className={`admin-traffic-row admin-traffic-row-${
                  row.confidenceAction === "lower"
                    ? "error"
                    : row.confidenceAction === "raise"
                      ? "success"
                      : row.sampleStatus === "needs-samples"
                        ? "warn"
                        : "info"
                }`}
              >
                <strong>{row.label}</strong>
                <span>
                  {row.scoredCount.toLocaleString()} scored · {row.pendingCount.toLocaleString()} pending · hit{" "}
                  {row.hitRate ?? "n/a"}%
                </span>
                <em>
                  {row.sampleStatus.replace(/-/g, " ")} · {row.confidenceAction.replace(/-/g, " ")} · gap{" "}
                  {row.calibrationGap ?? "n/a"}
                </em>
                <em>{row.description}</em>
                {row.sampleStatus === "needs-samples" || row.sampleStatus === "collecting" ? (
                  <em>{row.nextDataNeeded}</em>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Source Agreement</h4>
          <div className="admin-traffic-list">
            {data.sourceAgreement.buckets
              .filter(bucket => bucket.key !== "all")
              .slice(0, 6)
              .map(bucket => (
                <div key={bucket.key} className="admin-traffic-row">
                  <strong>{bucket.group.sourceAgreement || "unknown"}</strong>
                  <span>
                    {bucket.scoredCount.toLocaleString()} scored · hit{" "}
                    {bucket.hitRate ?? "n/a"}% · gap {bucket.calibrationGap ?? "n/a"}
                  </span>
                  <em>{bucket.recommendation.replace(/-/g, " ")}</em>
                </div>
              ))}
            {data.sourceAgreement.buckets.length <= 1 && (
              <p className="admin-traffic-empty">
                Source-agreement samples are still building.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Baseline Tests</h4>
          <div className="admin-traffic-list">
            {counterfactualBuckets.length ? (
              counterfactualBuckets.map(bucket => (
                <div key={bucket.status} className="admin-traffic-row">
                  <strong>{bucket.status.replace(/-/g, " ")}</strong>
                  <span>
                    {bucket.eventCount.toLocaleString()} reads · edge{" "}
                    {bucket.avgEdge ?? "n/a"} · hit {bucket.hitRate ?? "n/a"}%
                  </span>
                  <em>
                    {bucket.scoredCount.toLocaleString()} scored · avg confidence{" "}
                    {bucket.avgConfidence ?? "n/a"}%
                  </em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                Counterfactual baselines are still building.
              </p>
            )}
            {counterfactual.doWithoutBaselineEdgeCount > 0 && (
              <p className="admin-ai-readout-clean">
                {counterfactual.doWithoutBaselineEdgeCount.toLocaleString()} do-read
                {counterfactual.doWithoutBaselineEdgeCount === 1 ? "" : "s"} need a stronger baseline edge.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Trade Targets</h4>
          <div className="admin-traffic-list">
            {managerTradeRows.length ? (
              managerTradeRows.map(row => (
                <div key={row.manager} className="admin-traffic-row">
                  <strong>{row.manager}</strong>
                  <span>
                    {row.recommendation.replace(/-/g, " ")} · accept{" "}
                    {row.acceptanceRate ?? "n/a"}% · edge {row.avgRealizedEdge ?? "n/a"}
                  </span>
                  <em>
                    {row.scoredCount.toLocaleString()} scored · {row.pendingCount.toLocaleString()} pending
                  </em>
                  <em>{row.note}</em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                Manager-specific trade acceptance samples are still building.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Recent Outcomes</h4>
          <div className="admin-traffic-list">
            {recentResolved.length ? (
              recentResolved.map(event => (
                <div
                  key={event.eventId}
                  className={`admin-traffic-row admin-traffic-row-${event.outcomeStatus === "miss" ? "error" : "success"}`}
                >
                  <strong>{event.entityName || event.label}</strong>
                  <span>
                    {event.surface} · {event.action} · {event.outcomeStatus} · {event.finalScore}%
                  </span>
                  <em>
                    {event.baselineLabel || "baseline"}{" "}
                    {event.baselineScore === null ? "n/a" : `${event.baselineScore}%`} ·{" "}
                    {event.counterfactualStatus.replace(/-/g, " ")}
                  </em>
                  {event.realizedEdgeStatus ? (
                    <em>
                      realized {event.realizedEdge ?? "n/a"} ·{" "}
                      {event.realizedEdgeStatus.replace(/-/g, " ")}
                      {event.feedbackSource ? ` · ${event.feedbackSource}` : ""}
                    </em>
                  ) : null}
                  <em>{formatAdminTelemetryDate(event.updatedAt)}</em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No resolved AI outcomes in the recent event window.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Manual Feedback</h4>
          <div className="admin-traffic-list">
            {feedbackRows.length ? (
              feedbackRows.map(event => (
                <div key={event.eventId} className="admin-traffic-row">
                  <strong>{event.entityName || event.label}</strong>
                  <span>
                    {event.surface} · {event.action} · {event.outcomeStatus} · expires{" "}
                    {event.expiresAt ? formatAdminTelemetryDate(event.expiresAt) : "n/a"}
                  </span>
                  <div className="admin-ai-calibration-actions">
                    <Button
                      type="button"
                      variant="outline"
                      className="admin-traffic-refresh"
                      disabled={feedbackMutation.isPending}
                      onClick={() => feedbackMutation.mutate({
                        eventId: event.eventId,
                        status: "hit",
                        note: "Admin feedback: this read worked.",
                      })}
                    >
                      Worked
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="admin-traffic-refresh"
                      disabled={feedbackMutation.isPending}
                      onClick={() => feedbackMutation.mutate({
                        eventId: event.eventId,
                        status: "miss",
                        note: "Admin feedback: this read was a bad read.",
                      })}
                    >
                      Missed
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="admin-traffic-refresh"
                      disabled={feedbackMutation.isPending}
                      onClick={() => feedbackMutation.mutate({
                        eventId: event.eventId,
                        status: "push",
                        note: "Admin feedback: this read was ignored or not scorable.",
                      })}
                    >
                      Ignored
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No recent AI reads are available for manual feedback.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function canViewAdminTelemetryForUser(
  user?: {
    role?: string | null;
    isPrivilegedAdmin?: boolean | null;
  } | null
): boolean {
  if (!user) return false;
  return user.role === "admin" || Boolean(user.isPrivilegedAdmin);
}

export { AdminAICalibrationSection };
