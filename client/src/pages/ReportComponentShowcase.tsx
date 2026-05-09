import {
  CollapsibleAnalysisCard,
  DraftPickBadge,
  EmptyState,
  LeagueTypeBadge,
  MetricPill,
  PlayerPill,
  PositionBadge,
  ReportCard,
  ReportSectionHeader,
  ResponsiveDataTable,
  ValuePill,
} from "@/components/reportPrimitives";

const sampleRows = [
  { manager: "Tester", signal: "Starter Strength", score: "91" },
  { manager: "Rival", signal: "Bench Depth", score: "78" },
];

export default function ReportComponentShowcase() {
  return (
    <main className="report-shell min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-8">
      <section className="mx-auto max-w-5xl rounded-2xl border border-cyan-300/15 bg-slate-950/95 p-4 shadow-2xl shadow-black/40 sm:p-6">
        <ReportSectionHeader
          kicker="Report Design System"
          title="Fantasy Report Primitives"
          description="Canonical report components for league format, values, cards, empty states, player identity, and responsive tables."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <ReportCard className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <LeagueTypeBadge mode="dynasty" />
              <LeagueTypeBadge mode="redraft" />
              <PositionBadge position="WR" />
              <DraftPickBadge year="2026" round="2" owner="Sample Manager" mode="dynasty" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ValuePill value={8450} mode="dynasty" context="overview" source="Dynasty Value" />
              <ValuePill value={5200} mode="redraft" context="starter" source="Season Value" delta={420} />
              <MetricPill label="Hit Rate" value="67%" tone="good" />
            </div>
            <PlayerPill playerName="Sample Starter" playerId="player-1" team="BUF" position="RB" />
          </ReportCard>

          <CollapsibleAnalysisCard
            title="Collapsed Preview Contract"
            subtitle="Closed cards should explain why they matter before expansion."
            previewMetrics={[
              { label: "Top Owner", value: "Tester", tone: "good" },
              { label: "Alerts", value: 3, tone: "warn" },
              { label: "Swing", value: "+1.2K", tone: "positive" },
            ]}
            chips={[
              { label: "desktop grid", tone: "info" },
              { label: "mobile stack", tone: "neutral" },
            ]}
          >
            <EmptyState
              title="No sample data loaded"
              description="This state shows how report panels explain missing data instead of rendering blank space."
            />
          </CollapsibleAnalysisCard>
        </div>

        <div className="mt-4">
          <ResponsiveDataTable
            rows={sampleRows}
            getRowKey={(row) => row.manager}
            columns={[
              { key: "manager", label: "Manager", render: (row) => row.manager, mobilePrimary: true },
              { key: "signal", label: "Signal", render: (row) => row.signal },
              { key: "score", label: "Score", render: (row) => row.score },
            ]}
          />
        </div>
      </section>
    </main>
  );
}
