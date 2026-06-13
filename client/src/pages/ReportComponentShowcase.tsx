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
import { Button } from "@/components/ui/button";
import { DrawPath, Odometer, StaggerGroup, StaggerItem, useCountUp } from "@/lib/motion";
import { RotateCcw } from "lucide-react";
import { useState } from "react";

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

        <MotionFoundationQA />
      </section>
    </main>
  );
}

function MotionFoundationQA() {
  const [odometerReplay, setOdometerReplay] = useState(0);
  const [staggerReplay, setStaggerReplay] = useState(0);
  const [pathReplay, setPathReplay] = useState(0);

  return (
    <section className="mt-6 border-t border-cyan-300/10 pt-6">
      <ReportSectionHeader
        kicker="Phase 1 QA"
        title="Motion Foundation"
        description="Shared report-side animation primitives for count-up values, odometer headlines, staggered reveals, and SVG path drawing."
      />

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <ReportCard className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200/70">Odometer</p>
              <Odometer
                className="athletic-headline mt-2 block text-4xl font-black leading-none text-cyan-100 sm:text-5xl"
                key={odometerReplay}
                value={48210}
              />
            </div>
            <Button
              aria-label="Replay odometer"
              className="border-cyan-300/25 text-cyan-100 hover:bg-cyan-300/10"
              onClick={() => setOdometerReplay((replay) => replay + 1)}
              size="icon-sm"
              title="Replay odometer"
              type="button"
              variant="outline"
            >
              <RotateCcw aria-hidden="true" />
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <CountUpMetric label="Roster Value" value={48210} />
            <CountUpMetric label="Weekly Edge" plus value={1240} />
            <CountUpMetric label="Trade Score" value={87} />
          </div>
        </ReportCard>

        <ReportCard className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200/70">Stagger</p>
            <Button
              aria-label="Replay stagger"
              className="border-cyan-300/25 text-cyan-100 hover:bg-cyan-300/10"
              onClick={() => setStaggerReplay((replay) => replay + 1)}
              size="icon-sm"
              title="Replay stagger"
              type="button"
              variant="outline"
            >
              <RotateCcw aria-hidden="true" />
            </Button>
          </div>

          <StaggerGroup className="grid gap-3 sm:grid-cols-2" key={staggerReplay}>
            {["Roster Core", "Draft Capital", "Trade Leverage", "Weekly Edge"].map((label, index) => (
              <StaggerItem
                className="rounded-lg border border-cyan-300/10 bg-slate-900/70 p-3 shadow-inner shadow-cyan-950/20"
                key={label}
              >
                <p className="text-sm font-bold text-slate-100">{label}</p>
                <p className="mt-2 text-2xl font-black text-orange-300">{92 - index * 7}</p>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </ReportCard>

        <ReportCard className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200/70">Draw Path</p>
            <Button
              aria-label="Replay draw path"
              className="border-cyan-300/25 text-cyan-100 hover:bg-cyan-300/10"
              onClick={() => setPathReplay((replay) => replay + 1)}
              size="icon-sm"
              title="Replay draw path"
              type="button"
              variant="outline"
            >
              <RotateCcw aria-hidden="true" />
            </Button>
          </div>

          <div className="rounded-lg border border-cyan-300/10 bg-slate-950/60 p-4 text-cyan-200">
            <svg aria-label="Twelve point motion foundation trend line" className="h-28 w-full" role="img" viewBox="0 0 240 84">
              <DrawPath
                d="M 6 66 L 24 58 L 42 62 L 60 42 L 78 47 L 96 30 L 114 36 L 132 22 L 150 28 L 172 16 L 198 24 L 232 10"
                key={pathReplay}
                stroke="currentColor"
                strokeWidth={4}
              />
            </svg>
          </div>
        </ReportCard>
      </div>
    </section>
  );
}

function CountUpMetric({
  label,
  value,
  plus,
}: {
  label: string;
  value: number;
  plus?: boolean;
}) {
  const displayedValue = useCountUp(value, { plus });

  return (
    <div className="rounded-lg border border-cyan-300/10 bg-slate-900/70 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-cyan-100">{displayedValue}</p>
    </div>
  );
}
