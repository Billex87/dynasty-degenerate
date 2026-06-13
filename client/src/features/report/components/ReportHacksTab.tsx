import type { ComponentType } from "react";
import { ShieldCheck } from "lucide-react";

import { ReportMotionSectionStack } from "@/features/report/components/ReportMotionSectionStack";
import type { ReportData } from "@shared/types";

type ReportHacksTabProps = {
  reportDataForView: ReportData;
  onAnalyze: () => void;
  AdminScheduleEdgeSection: ComponentType<{ reportData: ReportData }>;
  AdminDiagnosticsShell: ComponentType<{
    reportData: ReportData;
    onLeagueSelect: (leagueId: string) => void | Promise<void>;
  }>;
};

function formatStoredSnapshotTime(value?: number | null) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function pluralizeCount(count: number | null | undefined, label: string) {
  const safeCount = Number(count || 0);
  return `${safeCount.toLocaleString()} ${label}${safeCount === 1 ? "" : "s"}`;
}

function StoredTransactionSyncSnapshotCard({
  reportData,
}: {
  reportData: ReportData;
}) {
  const snapshot = reportData.sleeperHiddenLeagueSnapshot;

  return (
    <section className="rounded-3xl border border-orange-300/25 bg-slate-950/55 p-4 shadow-[0_24px_90px_rgba(249,115,22,0.10)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.22em] text-cyan-100">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Admin eyes only
          </p>
          <h3 className="mt-3 text-lg font-black text-slate-50">
            Stored Transaction Sync snapshot
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            {snapshot
              ? `Latest hidden Sleeper snapshot was shared by ${snapshot.sharedBy || "unknown manager"} at ${formatStoredSnapshotTime(snapshot.sharedAt)}.`
              : "No league member has shared a Transaction Sync snapshot for this league yet."}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[26rem]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-slate-400">
              Total
            </p>
            <p className="mt-1 text-lg font-black text-slate-50">
              {pluralizeCount(snapshot?.transactionCount, "item")}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-slate-400">
              Trades
            </p>
            <p className="mt-1 text-lg font-black text-cyan-100">
              {pluralizeCount(snapshot?.tradeCount, "trade")}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-slate-400">
              Waivers
            </p>
            <p className="mt-1 text-lg font-black text-orange-100">
              {pluralizeCount(snapshot?.waiverCount, "waiver")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ReportHacksTab({
  reportDataForView,
  onAnalyze,
  AdminScheduleEdgeSection,
  AdminDiagnosticsShell,
}: ReportHacksTabProps) {
  return (
    <ReportMotionSectionStack className="report-command-section-stack space-y-6 sm:space-y-8">
      <StoredTransactionSyncSnapshotCard reportData={reportDataForView} />
      <AdminScheduleEdgeSection reportData={reportDataForView} />
      <AdminDiagnosticsShell
        reportData={reportDataForView}
        onLeagueSelect={onAnalyze}
      />
    </ReportMotionSectionStack>
  );
}
