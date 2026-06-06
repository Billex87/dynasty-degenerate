import { Button } from "@/components/ui/button";
import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import { AdminAttentionBadge } from "@/features/report/components/AdminDiagnosticsPrimitives";
import { trpc } from "@/lib/trpc";

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

function isHandledSourceHealthEvent(event: {
  job?: string | null;
  status?: string | null;
  message?: string | null;
}): boolean {
  const job = String(event.job || "");
  const status = String(event.status || "");
  const message = String(event.message || "");
  if (!/dynamic-data-refresh|cached-report-source-backfill/i.test(job)) {
    return false;
  }
  if (!/^(loaded|empty)$/i.test(status)) return false;

  return /Other available source weights normalize automatically|source-excluded consensus|trust dropped|trust fell|waiting for more .* consensus overlap/i.test(
    message
  );
}

function isPrioritySourceHealthEvent(event: {
  level?: string | null;
  job?: string | null;
  status?: string | null;
  message?: string | null;
}): boolean {
  if (isHandledSourceHealthEvent(event)) return false;
  return event.level === "danger" || event.level === "warn";
}

function AdminTrafficTelemetrySection({
  onLeagueSelect,
}: {
  onLeagueSelect: (leagueId: string) => void | Promise<void>;
}) {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const canViewTelemetry = canViewAdminTelemetryForUser(authQuery.data);
  const { data: sourceHealth } = trpc.system.sourceHealth.useQuery(
    { lookbackDays: 7 },
    {
      enabled: canViewTelemetry,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60,
    }
  );
  const priorityEvents = (sourceHealth?.recentEvents || []).filter(
    isPrioritySourceHealthEvent
  );
  const alertTone = priorityEvents.some(event => event.level === "danger")
    ? "danger"
    : "warn";

  return (
    <CollapsibleReportSection
      title="Traffic Telemetry"
      kicker="Request telemetry"
      previewAccessory={
        priorityEvents.length > 0 ? (
          <AdminAttentionBadge
            count={priorityEvents.length}
            label="Source alerts"
            tone={alertTone}
          />
        ) : undefined
      }
      premium
    >
      <AdminAbuseTelemetryPanel onLeagueSelect={onLeagueSelect} />
    </CollapsibleReportSection>
  );
}

function AdminProviderTelemetrySection() {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const canViewTelemetry = canViewAdminTelemetryForUser(authQuery.data);
  const { data } = trpc.system.apiProviderTelemetry.useQuery(
    { lookbackDays: 7, limit: 12 },
    {
      enabled: canViewTelemetry,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60,
    }
  );
  const issueCount =
    (data?.totals.failures || 0) +
    (data?.totals.rateLimited || 0) +
    (data?.totals.userLoadNetworkCalls || 0);
  const issueTone = data?.totals.rateLimited || data?.totals.failures ? "danger" : "warn";

  return (
    <CollapsibleReportSection
      title="API Budget & Rate Limits"
      kicker="Provider telemetry"
      previewAccessory={
        issueCount > 0 ? (
          <AdminAttentionBadge
            count={issueCount}
            label="Provider issues"
            tone={issueTone}
          />
        ) : undefined
      }
      premium
    >
      <AdminProviderTelemetryPanel />
    </CollapsibleReportSection>
  );
}

type AdminProviderTelemetryBucket = {
  label: string;
  calls: number;
  networkCalls: number;
  cacheHits: number;
  cacheHitRatePct: number;
  failures: number;
  rateLimited: number;
  costUnits: number;
  avgDurationMs: number;
  lastSeen: string | null;
  lastStatus: number | null;
  lastMessage: string | null;
};

type AdminProviderTelemetryEventRow = {
  provider: string;
  endpoint: string;
  status: number | null;
  ok: boolean;
  durationMs: number | null;
  cacheStatus: string;
  scope: string;
  message: string | null;
  createdAt: string;
};

function hasProviderTelemetryIssue(row: AdminProviderTelemetryBucket): boolean {
  return row.failures > 0 || row.rateLimited > 0;
}

function isProviderBudgetDriver(row: AdminProviderTelemetryBucket): boolean {
  return hasProviderTelemetryIssue(row) || row.networkCalls > 0 || row.costUnits > 0;
}

function getProviderTelemetryRowClass(row: AdminProviderTelemetryBucket): string {
  if (row.rateLimited > 0 || row.failures > 0) return "admin-traffic-row admin-traffic-row-error";
  if (row.networkCalls > 0) return "admin-traffic-row admin-traffic-row-warn";
  return "admin-traffic-row";
}

function formatProviderTelemetryCallSummary(row: AdminProviderTelemetryBucket): string {
  const parts = [
    `${row.calls.toLocaleString()} calls`,
    `${row.networkCalls.toLocaleString()} network`,
    `${row.cacheHitRatePct}% cached`,
  ];
  if (row.costUnits > 0) parts.push(`${row.costUnits.toLocaleString()} cost`);
  return parts.join(" · ");
}

function formatProviderTelemetryIssueSummary(row: AdminProviderTelemetryBucket): string {
  const issues = [
    row.failures ? `${row.failures.toLocaleString()} failures` : null,
    row.rateLimited ? `${row.rateLimited.toLocaleString()} 429s` : null,
  ].filter(Boolean);
  return issues.length ? issues.join(" · ") : "No failures or 429s";
}

function AdminProviderTelemetryPanel() {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const canViewTelemetry = canViewAdminTelemetryForUser(authQuery.data);
  const { data, error, isLoading, isFetching, refetch } =
    trpc.system.apiProviderTelemetry.useQuery(
      { lookbackDays: 7, limit: 12 },
      {
        enabled: canViewTelemetry,
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 1000 * 60,
      }
    );

  if (authQuery.isLoading) {
    return (
      <div className="rankings-empty-state">
        Checking provider telemetry access...
      </div>
    );
  }

  if (!canViewTelemetry) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>Provider telemetry is locked until Admin Tools are unlocked.</p>
        <span>
          This panel is admin-only because it exposes source costs, failures,
          and endpoint behavior.
        </span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rankings-empty-state">
        Loading provider telemetry...
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>Provider telemetry is unavailable for this session.</p>
        <span>{error.message}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rankings-empty-state">
        No provider telemetry available.
      </div>
    );
  }

  const issueTotal = data.totals.failures + data.totals.rateLimited;
  const userLoadNetworkCalls = data.totals.userLoadNetworkCalls;
  const providerRows = data.byProvider
    .filter(isProviderBudgetDriver)
    .slice(0, 4);
  const endpointRows = data.byEndpoint
    .filter(isProviderBudgetDriver)
    .slice(0, 5);
  const scopeRows = data.byScope
    .filter(row => row.calls > 0)
    .slice(0, 5);
  const attentionRows = [
    ...data.byProvider
      .filter(hasProviderTelemetryIssue)
      .map(row => ({ ...row, group: "Provider" })),
    ...data.byEndpoint
      .filter(hasProviderTelemetryIssue)
      .map(row => ({ ...row, group: "Endpoint" })),
  ].slice(0, 6);
  const recentNetworkEvents: AdminProviderTelemetryEventRow[] = data.recentEvents
    .filter(event => !event.ok || event.status === 429 || event.cacheStatus !== "hit")
    .slice(0, 6);

  const totalCards = [
    {
      label: "Network",
      value: data.totals.networkCalls,
      detail: `${data.totals.calls.toLocaleString()} total calls`,
      tone: userLoadNetworkCalls ? "warn" : "neutral",
    },
    {
      label: "Cache Hit",
      value: `${data.totals.cacheHitRatePct}%`,
      detail: `${data.totals.cacheHits.toLocaleString()} cached responses`,
      tone: data.totals.cacheHitRatePct >= 80 || data.totals.networkCalls === 0 ? "good" : "neutral",
    },
    {
      label: "Issues",
      value: issueTotal,
      detail: issueTotal
        ? `${data.totals.failures.toLocaleString()} failures · ${data.totals.rateLimited.toLocaleString()} 429s`
        : "No failures or 429s",
      tone: data.totals.rateLimited || data.totals.failures ? "danger" : "good",
    },
    {
      label: "User Load Network",
      value: userLoadNetworkCalls,
      detail: userLoadNetworkCalls ? "Review provider boundary" : "Clean boundary",
      tone: userLoadNetworkCalls ? "warn" : "good",
    },
    {
      label: "Cost Units",
      value: data.totals.costUnits,
      detail: `${data.totals.avgDurationMs}ms avg duration`,
      tone: data.totals.costUnits ? "neutral" : "good",
    },
  ];

  return (
    <div className="admin-traffic-panel">
      <div className="admin-traffic-header">
        <div>
          <span>Last 7 days</span>
          <strong>
            Provider budget snapshot ·{" "}
            {formatAdminTelemetryDate(data.generatedAt)}
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

      <div className="admin-traffic-grid admin-provider-telemetry-grid">
        <section className="admin-traffic-card">
          <h4>Needs Attention</h4>
          <div className="admin-traffic-list">
            {attentionRows.length || userLoadNetworkCalls ? (
              <>
                {userLoadNetworkCalls > 0 && (
                  <div className="admin-traffic-row admin-traffic-row-warn">
                    <strong>User-load provider calls</strong>
                    <span>
                      {userLoadNetworkCalls.toLocaleString()} network call
                      {userLoadNetworkCalls === 1 ? "" : "s"} happened during user-load scope
                    </span>
                    <em>Normal report loads should stay snapshot-backed for provider data.</em>
                  </div>
                )}
                {attentionRows.map(row => (
                  <div
                    key={`${row.group}:${row.label}`}
                    className={getProviderTelemetryRowClass(row)}
                  >
                    <strong>
                      {row.group}: {row.label}
                    </strong>
                    <span>{formatProviderTelemetryIssueSummary(row)}</span>
                    <em>
                      {formatProviderTelemetryCallSummary(row)} · Last{" "}
                      {formatAdminTelemetryDate(row.lastSeen)}
                      {row.lastMessage ? ` · ${row.lastMessage}` : ""}
                    </em>
                  </div>
                ))}
              </>
            ) : (
              <div className="admin-provider-clean-row">
                <strong>No provider budget issues</strong>
                <span>No failures, 429s, or user-load provider network calls in this window.</span>
              </div>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Top Cost Endpoints</h4>
          <div className="admin-traffic-list">
            {endpointRows.length ? (
              endpointRows.map(endpoint => (
                <div
                  key={endpoint.label}
                  className={getProviderTelemetryRowClass(endpoint)}
                >
                  <strong>{endpoint.label}</strong>
                  <span>{formatProviderTelemetryCallSummary(endpoint)}</span>
                  <em>
                    Avg {endpoint.avgDurationMs}ms · Last{" "}
                    {formatAdminTelemetryDate(endpoint.lastSeen)}
                  </em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No endpoint cost rows worth reviewing in this window.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Provider Summary</h4>
          <div className="admin-traffic-list">
            {providerRows.length ? (
              providerRows.map(provider => (
                <div
                  key={provider.label}
                  className={getProviderTelemetryRowClass(provider)}
                >
                  <strong>{provider.label}</strong>
                  <span>{formatProviderTelemetryCallSummary(provider)}</span>
                  <em>
                    {formatProviderTelemetryIssueSummary(provider)}
                  </em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No provider rows worth reviewing in this window.
              </p>
            )}
          </div>
        </section>
      </div>

      <details className="admin-provider-telemetry-details">
        <summary>
          <span>Audit detail</span>
          <strong>
            {scopeRows.length.toLocaleString()} scopes ·{" "}
            {recentNetworkEvents.length.toLocaleString()} recent network rows
          </strong>
        </summary>
        <div className="admin-traffic-grid">
          <section className="admin-traffic-card">
            <h4>Call Scope</h4>
            <div className="admin-traffic-list">
              {scopeRows.length ? (
                scopeRows.map(scope => (
                  <div
                    key={scope.label}
                    className={getProviderTelemetryRowClass(scope)}
                  >
                    <strong>{scope.label}</strong>
                    <span>{formatProviderTelemetryCallSummary(scope)}</span>
                    <em>
                      {formatProviderTelemetryIssueSummary(scope)} · Last{" "}
                      {formatAdminTelemetryDate(scope.lastSeen)}
                    </em>
                  </div>
                ))
              ) : (
                <p className="admin-traffic-empty">
                  No scoped provider calls recorded yet.
                </p>
              )}
            </div>
          </section>

          <section className="admin-traffic-card">
            <h4>Recent Network Events</h4>
            <div className="admin-traffic-list">
              {recentNetworkEvents.length ? (
                recentNetworkEvents.map((event, index) => (
                  <div
                    key={`${event.provider}-${event.endpoint}-${event.createdAt}-${index}`}
                    className={`admin-traffic-row ${event.ok ? "" : "admin-traffic-row-error"}`}
                  >
                    <strong>
                      {event.provider} · {event.endpoint}
                    </strong>
                    <span>
                      {event.ok ? "ok" : "failed"} · {event.status ?? "n/a"} ·{" "}
                      {event.cacheStatus} · {event.scope} · {event.durationMs ?? 0}ms
                    </span>
                    <em>
                      {formatAdminTelemetryDate(event.createdAt)}
                      {event.message ? ` · ${event.message}` : ""}
                    </em>
                  </div>
                ))
              ) : (
                <p className="admin-traffic-empty">
                  No recent network events recorded.
                </p>
              )}
            </div>
          </section>
        </div>
      </details>
    </div>
  );
}

const HIDDEN_TRAFFIC_IPS = new Set([
  "205.250.64.165",
  "127.0.0.1",
  "172.226.164.57",
]);

function normalizeTrafficIpLabel(label: string): string {
  const normalized = label.trim().toLowerCase();
  const bracketedHost = normalized.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedHost?.[1]) return bracketedHost[1];
  const ipv4WithPort = normalized.match(/^((?:\d{1,3}\.){3}\d{1,3})(?::\d+)?$/);
  if (ipv4WithPort?.[1]) return ipv4WithPort[1];
  return normalized;
}

function isHiddenTrafficIp(label: string): boolean {
  const normalized = normalizeTrafficIpLabel(label);
  if (!normalized) return false;
  if (HIDDEN_TRAFFIC_IPS.has(normalized)) return true;
  if (normalized === "localhost" || normalized === "::1" || normalized === "0.0.0.0")
    return true;
  if (normalized.startsWith("127.")) return true;
  if (normalized.startsWith("::ffff:127.")) return true;
  if (normalized.startsWith("::ffff:7f")) return true;
  if (normalized === "0:0:0:0:0:0:0:1") return true;
  return false;
}

function AdminAbuseTelemetryPanel({
  onLeagueSelect,
}: {
  onLeagueSelect: (leagueId: string) => void | Promise<void>;
}) {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const canViewTelemetry = canViewAdminTelemetryForUser(authQuery.data);
  const { data, error, isLoading, isFetching, refetch } =
    trpc.system.abuseTelemetry.useQuery(
      { lookbackDays: 7 },
      {
        enabled: canViewTelemetry,
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 1000 * 60,
      }
    );
  const {
    data: sourceHealth,
    isFetching: isSourceHealthFetching,
    refetch: refetchSourceHealth,
  } = trpc.system.sourceHealth.useQuery(
    { lookbackDays: 7 },
    {
      enabled: canViewTelemetry,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60,
    }
  );

  if (authQuery.isLoading) {
    return (
      <div className="rankings-empty-state">
        Checking admin telemetry access...
      </div>
    );
  }

  if (!canViewTelemetry) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>
          Traffic telemetry is locked until you unlock Admin Tools for this
          browser session.
        </p>
        <span>
          Use the footer button to enter the first-party passphrase once, then
          this panel and the rest of the admin tools stay open until the browser
          closes.
        </span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rankings-empty-state">Loading traffic telemetry...</div>
    );
  }

  if (error) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>Admin traffic telemetry is unavailable for this session.</p>
        <span>{error.message}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rankings-empty-state">
        No traffic telemetry available.
      </div>
    );
  }

  const totalCards = [
    { label: "Events", value: data.totals.events },
    { label: "Generated Reports", value: data.totals.generatedReports },
    { label: "Cached Reports", value: data.totals.cachedReports },
    { label: "Rate Limits", value: data.totals.rateLimitEvents },
    { label: "Unique IPs", value: data.totals.uniqueIps },
    { label: "Unique Leagues", value: data.totals.uniqueLeagueIds },
  ];
  const visibleTopIps = data.topIps.filter(
    entry => !isHiddenTrafficIp(entry.label)
  );
  const prioritySourceHealthEvents = (sourceHealth?.recentEvents || [])
    .filter(isPrioritySourceHealthEvent)
    .slice(0, 6);

  return (
    <div className="admin-traffic-panel">
      <div className="admin-traffic-header">
        <div>
          <span>Last {data.lookbackDays} days</span>
          <strong>
            Generated {formatAdminTelemetryDate(data.generatedAt)}
          </strong>
        </div>
        <Button
          type="button"
          variant="outline"
          className="admin-traffic-refresh"
          disabled={isFetching || isSourceHealthFetching}
          onClick={() => {
            void refetch();
            void refetchSourceHealth();
          }}
        >
          Refresh
        </Button>
      </div>

      {prioritySourceHealthEvents.length > 0 && (
        <section
          className="admin-critical-alerts admin-critical-alerts-traffic"
          aria-label="Important source health alerts"
        >
          <div className="admin-critical-alerts-header">
            <span>Needs Admin Attention</span>
            <strong>
              {prioritySourceHealthEvents.length} source-health alert
              {prioritySourceHealthEvents.length === 1 ? "" : "s"}
            </strong>
          </div>
          <div className="admin-critical-alerts-grid">
            {prioritySourceHealthEvents.map(event => (
              <article
                key={`source-priority-${event.id}`}
                className={`admin-critical-alert-card admin-critical-alert-card-${event.level === "danger" ? "danger" : "warn"}`}
              >
                <div>
                  <span>{event.job}</span>
                  <strong>{event.source}</strong>
                </div>
                <p>{event.message}</p>
                <em>
                  {event.status} · {event.board || "source"} ·{" "}
                  {event.rowCount ?? 0} rows
                </em>
              </article>
            ))}
          </div>
        </section>
      )}

      {prioritySourceHealthEvents.length > 0 && sourceHealth?.bySource?.length ? (
        <section
          className="admin-source-history-strip"
          aria-label="Source alert history"
        >
          <div className="admin-source-history-head">
            <span>Source Alert History</span>
            <strong>
              {sourceHealth.totals.uniqueSources} source
              {sourceHealth.totals.uniqueSources === 1 ? "" : "s"} flagged in{" "}
              {sourceHealth.lookbackDays} days
            </strong>
          </div>
          <div className="admin-source-history-grid">
            {sourceHealth.bySource.slice(0, 6).map(bucket => (
              <article key={bucket.label} className="admin-source-history-card">
                <div>
                  <span>{bucket.label}</span>
                  <strong>
                    {bucket.danger} danger · {bucket.warn} warn
                  </strong>
                </div>
                <p>{bucket.lastMessage || "No message captured."}</p>
                <em>
                  First {formatAdminTelemetryDate(bucket.firstSeen)} · Latest{" "}
                  {formatAdminTelemetryDate(bucket.lastSeen)}
                </em>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="admin-traffic-stat-grid">
        {totalCards.map(card => (
          <article key={card.label} className="admin-traffic-stat">
            <span>{card.label}</span>
            <strong>{card.value.toLocaleString()}</strong>
          </article>
        ))}
      </div>

      <div className="admin-traffic-grid">
        <section className="admin-traffic-card">
          <h4>Top IPs</h4>
          <div className="admin-traffic-list">
            {visibleTopIps.length ? (
              visibleTopIps.map(entry => (
                <div key={entry.label} className="admin-traffic-row">
                  <strong>{entry.label}</strong>
                  <span>
                    {entry.count} events · {entry.rateLimited} limited ·{" "}
                    {entry.uniqueLeagueIds} leagues
                  </span>
                  <em>Last seen {formatAdminTelemetryDate(entry.lastSeen)}</em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No non-local IP traffic in this window.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Top Leagues</h4>
          <div className="admin-traffic-list">
            {data.topLeagueIds.length ? (
              data.topLeagueIds.map(entry => (
                <button
                  key={entry.label}
                  type="button"
                  className="admin-traffic-row admin-traffic-row-button"
                  onClick={() => void onLeagueSelect(entry.label)}
                >
                  <strong>{entry.label}</strong>
                  <span>
                    {entry.count} events · {entry.success} success ·{" "}
                    {entry.error} errors
                  </span>
                  <em>Last seen {formatAdminTelemetryDate(entry.lastSeen)}</em>
                </button>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No league-specific events yet.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Source Health</h4>
          <div className="admin-traffic-list">
            {sourceHealth?.recentEvents?.length ? (
              sourceHealth.recentEvents.slice(0, 8).map(event => (
                <div
                  key={event.id}
                  className={`admin-traffic-row admin-traffic-row-${
                    event.level === "danger"
                      ? "error"
                      : event.level === "warn"
                        ? "warn"
                        : "success"
                  }`}
                >
                  <strong>{event.source}</strong>
                  <span>
                    {event.level} · {event.status} · {event.board || "source"} ·{" "}
                    {event.rowCount ?? 0} rows
                  </span>
                  <em>
                    {formatAdminTelemetryDate(event.createdAt)} ·{" "}
                    {event.message}
                  </em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No source-health alerts in the last 7 days.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export { AdminProviderTelemetrySection, AdminTrafficTelemetrySection };
