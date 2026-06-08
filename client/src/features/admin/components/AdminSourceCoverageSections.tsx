import { Button } from "@/components/ui/button";
import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import { AdminAttentionBadge } from "@/features/report/components/AdminDiagnosticsPrimitives";
import { trpc } from "@/lib/trpc";
import type {
  SourceCoverageMatrix,
  SourceCoverageRow,
} from "../../../../../server/sourceCoverageMatrix";

type SourceCoverageMatrixData = SourceCoverageMatrix;

type AdminAuthUser = {
  role?: string | null;
  isPrivilegedAdmin?: boolean | null;
};

function canViewAdminTelemetryForUser(user?: AdminAuthUser | null): boolean {
  if (!user) return false;
  return user.role === "admin" || Boolean(user.isPrivilegedAdmin);
}

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

function formatAdminBytes(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  const bytes = Math.max(0, Number(value));
  if (bytes < 1024) return `${bytes.toLocaleString()} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString()} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAdminList(values: string[]): string {
  return values.length ? values.join(", ") : "n/a";
}

function getSourceCoverageStatusLabel(row: SourceCoverageRow): string {
  if (row.status === "loaded") return "Loaded";
  if (row.status === "stale") return "Stale";
  if (row.status === "missing") return "Missing";
  if (row.status === "error") return "Source error";
  if (row.status === "blocked") return "Needs approval";
  return "Research";
}

function getSourceCoverageToneClass(row: SourceCoverageRow): string {
  if (row.level === "danger") return "admin-source-coverage-row-danger";
  if (row.level === "warn") return "admin-source-coverage-row-warn";
  return "admin-source-coverage-row-good";
}

function isActionableSourceCoverageRow(row: SourceCoverageRow): boolean {
  if (row.status === "blocked" || row.status === "research") return false;
  if (row.status === "missing" && row.level === "info") return false;
  return row.level === "warn" || row.level === "danger";
}

function buildSourceCoverageIssueTotals(
  rows: SourceCoverageRow[]
): SourceCoverageMatrixData["totals"] {
  return {
    sources: rows.length,
    loaded: rows.filter(row => row.status === "loaded").length,
    stale: rows.filter(row => row.status === "stale").length,
    missing: rows.filter(row => row.status === "missing").length,
    error: rows.filter(row => row.status === "error").length,
    blocked: rows.filter(row => row.status === "blocked").length,
    research: rows.filter(row => row.status === "research").length,
    snapshotBacked: rows.filter(row => row.snapshotKey || row.tableName).length,
    needsApproval: rows.filter(row => /approval|approved|terms/i.test(row.complianceNote)).length,
  };
}

export function AdminSourceCoverageSection() {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const canViewTelemetry = canViewAdminTelemetryForUser(authQuery.data);
  const query = trpc.system.sourceCoverageMatrix.useQuery(
    { lookbackDays: 14 },
    {
      enabled: canViewTelemetry,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60,
    }
  );
  const needsAttention = (query.data?.rows || []).filter(
    isActionableSourceCoverageRow
  );
  const tone = needsAttention.some(row => row.level === "danger")
    ? "danger"
    : "warn";
  if (query.data && !needsAttention.length) return null;

  return (
    <CollapsibleReportSection
      title="Source Matrix"
      kicker="Actionable snapshot issues"
      previewAccessory={
        needsAttention.length > 0 ? (
          <AdminAttentionBadge
            count={needsAttention.length}
            label="Review sources"
            tone={tone}
          />
        ) : undefined
      }
      premium
    >
      <AdminSourceCoveragePanel
        canViewTelemetry={canViewTelemetry}
        isAuthLoading={authQuery.isLoading}
        data={query.data}
        error={query.error}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        refetch={query.refetch}
      />
    </CollapsibleReportSection>
  );
}

function AdminSourceCoveragePanel({
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
  data: SourceCoverageMatrixData | undefined;
  error: { message: string } | null;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}) {
  if (isAuthLoading) {
    return (
      <div className="rankings-empty-state">
        Checking source coverage access...
      </div>
    );
  }

  if (!canViewTelemetry) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>Source coverage is locked until Admin Tools are unlocked.</p>
        <span>
          This diagnostics panel is admin-only because it exposes provider
          names, refresh cadence, integration gaps, and stored evidence health.
        </span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rankings-empty-state">
        Loading source coverage matrix...
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>Source coverage is unavailable for this session.</p>
        <span>{error.message}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rankings-empty-state">
        No source coverage metadata available.
      </div>
    );
  }

  const issueRows = data.rows.filter(isActionableSourceCoverageRow);
  const issueTotals = buildSourceCoverageIssueTotals(issueRows);
  const totalCards = [
    { label: "Issues", value: issueTotals.sources },
    { label: "Errors", value: issueTotals.error },
    { label: "Stale", value: issueTotals.stale },
    { label: "Missing", value: issueTotals.missing },
    { label: "Snapshots", value: issueTotals.snapshotBacked },
    { label: "Needs Approval", value: issueTotals.needsApproval },
  ];

  return (
    <div className="admin-traffic-panel admin-source-coverage-panel">
      <div className="admin-traffic-header">
        <div>
          <span>Last {data.lookbackDays} days</span>
          <strong>
            Source coverage matrix · {formatAdminTelemetryDate(data.generatedAt)}
          </strong>
        </div>
        <Button
          type="button"
          variant="outline"
          className="admin-traffic-refresh"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Refresh
        </Button>
      </div>

      <div className="admin-traffic-stat-grid">
        {totalCards.map(card => (
          <article key={card.label} className="admin-traffic-stat">
            <span>{card.label}</span>
            <strong>{card.value.toLocaleString()}</strong>
          </article>
        ))}
      </div>

      {issueRows.length ? (
        <div className="admin-source-coverage-grid">
          <section className="admin-traffic-card admin-source-coverage-card">
            <h4>Actionable Source Issues</h4>
            <div className="admin-traffic-list">
              {issueRows.map(row => (
                <article
                  key={row.sourceKey}
                  className={`admin-traffic-row admin-source-coverage-row ${getSourceCoverageToneClass(row)}`}
                >
                  <div className="admin-source-coverage-row-head">
                    <strong>{row.source}</strong>
                    <span>{getSourceCoverageStatusLabel(row)}</span>
                  </div>
                  <span>
                    {row.category} · {row.rowCount?.toLocaleString() || "n/a"} rows ·{" "}
                    {formatAdminBytes(row.payloadSizeBytes)}
                  </span>
                  <em>
                    Updated {formatAdminTelemetryDate(row.updatedAt)}
                    {row.snapshotKey ? ` · Snapshot ${row.snapshotKey}` : ""}
                  </em>
                  <div className="admin-source-coverage-fields">
                    <span>Returns</span>
                    <p>{formatAdminList(row.fieldMap)}</p>
                  </div>
                  <div className="admin-source-coverage-fields">
                    <span>Used now</span>
                    <p>{formatAdminList(row.usedNow)}</p>
                  </div>
                  <div className="admin-source-coverage-fields">
                    <span>Could power</span>
                    <p>{formatAdminList(row.couldPowerLater)}</p>
                  </div>
                  {row.lastHealthMessage ? (
                    <em>
                      Health: {row.lastHealthStatus || "n/a"} · {row.lastHealthMessage}
                    </em>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <p className="admin-ai-readout-clean">
          No actionable source coverage issues in this payload. Optional,
          unconfigured, and research-only sources are kept out of admin
          diagnostics.
        </p>
      )}
    </div>
  );
}
