import { MetricPill, ReportCard } from "@/components/reportPrimitives";
import type { ReportData } from "@shared/types";

type LeagueDiagnostics = NonNullable<ReportData["leagueDiagnostics"]>;

type LeagueSettingsSummaryProps = {
  diagnostics?: ReportData["leagueDiagnostics"] | null;
  leagueName: string;
  leagueValueMode: ReportData["leagueValueMode"];
};

export function LeagueSettingsSummary({
  diagnostics,
  leagueName,
  leagueValueMode,
}: LeagueSettingsSummaryProps) {
  const modeLabel =
    diagnostics?.valueMode === "redraft" || leagueValueMode === "redraft"
      ? "Redraft"
      : "Dynasty";
  const qbFormatLabel = formatQbFormat(diagnostics?.qbFormat);
  const tePremiumLabel = formatTePremium(diagnostics?.tightEndPremium);
  const draftStatusLabel =
    diagnostics?.draftStatusLabel || formatDraftStatus(diagnostics?.draftStatus);
  const scoringLabel = diagnostics?.scoringSummary || "Scoring unavailable";
  const waiverLabel =
    diagnostics?.waiverModeLabel || formatWaiverMode(diagnostics);
  const starterSlots = diagnostics?.starterSlots?.length
    ? diagnostics.starterSlots.join(", ")
    : "Starter slots unavailable";
  const rosterSlots = diagnostics?.rosterSlots?.length
    ? diagnostics.rosterSlots.join(", ")
    : "Roster slots unavailable";

  return (
    <ReportCard className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <MetricPill label="Format" value={modeLabel} tone="info" />
        <MetricPill label="QB" value={qbFormatLabel} tone="info" />
        <MetricPill
          label="TE"
          value={tePremiumLabel}
          tone={Number(diagnostics?.tightEndPremium || 0) > 0 ? "good" : "neutral"}
        />
        <MetricPill label="Draft" value={draftStatusLabel} tone="neutral" />
      </div>

      <dl
        className="grid gap-3 text-sm text-slate-200 md:grid-cols-2"
        aria-label={`${leagueName} league settings summary`}
      >
        <LeagueSettingRow label="Scoring" value={scoringLabel} />
        <LeagueSettingRow label="Waivers" value={waiverLabel} />
        <LeagueSettingRow
          label="Teams"
          value={diagnostics?.teamCount ? `${diagnostics.teamCount} teams` : "Team count unavailable"}
        />
        <LeagueSettingRow
          label="Starters"
          value={diagnostics?.starterCountSummary || starterSlots}
        />
        <LeagueSettingRow
          label="Lineup Slots"
          value={diagnostics?.lineupSlotSummary || starterSlots}
        />
        <LeagueSettingRow
          label="Roster Slots"
          value={formatRosterSize(diagnostics) || rosterSlots}
        />
        <LeagueSettingRow
          label="Bench / Reserve / Taxi"
          value={formatReserveTaxi(diagnostics)}
        />
        <LeagueSettingRow
          label="Playoffs"
          value={formatPlayoffs(diagnostics)}
        />
        {diagnostics?.passingTdPoints !== null &&
          diagnostics?.passingTdPoints !== undefined && (
            <LeagueSettingRow
              label="Passing TD"
              value={`${diagnostics.passingTdPoints} points`}
            />
          )}
        {diagnostics?.redraftTradeWindowEndDate && (
          <LeagueSettingRow
            label="Trade Deadline"
            value={diagnostics.redraftTradeWindowEndDate}
          />
        )}
      </dl>
    </ReportCard>
  );
}

function LeagueSettingRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-cyan-300/15 bg-slate-950/45 p-3">
      <dt className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-cyan-300/75">
        {label}
      </dt>
      <dd className="mt-1 font-bold leading-snug text-slate-100">{value}</dd>
    </div>
  );
}

function formatQbFormat(format?: LeagueDiagnostics["qbFormat"]) {
  if (format === "superflex") return "Superflex";
  if (format === "two_qb") return "2QB";
  if (format === "one_qb") return "1QB";
  return "QB format unavailable";
}

function formatTePremium(premium?: number | null) {
  const numericPremium = Number(premium || 0);
  if (numericPremium <= 0) return "No TE Premium";
  return `TE Premium +${numericPremium}`;
}

function formatDraftStatus(status?: LeagueDiagnostics["draftStatus"]) {
  if (status === "pre_draft") return "Pre-draft";
  if (status === "drafting") return "Drafting";
  if (status === "in_season") return "In season";
  if (status === "complete") return "Draft complete";
  return "Draft status unavailable";
}

function formatWaiverMode(diagnostics?: LeagueDiagnostics | null) {
  if (!diagnostics) return "Waiver settings unavailable";
  const mode =
    diagnostics.waiverMode === "faab"
      ? "FAAB"
      : diagnostics.waiverMode === "priority"
        ? "Priority"
        : "Waiver mode unavailable";
  if (diagnostics.waiverBudget !== null && diagnostics.waiverBudget !== undefined) {
    return `${mode}, budget ${diagnostics.waiverBudget}`;
  }
  return mode;
}

function formatRosterSize(diagnostics?: LeagueDiagnostics | null) {
  if (!diagnostics?.totalRosterSlots) return null;
  return `${diagnostics.totalRosterSlots} total roster slots`;
}

function formatReserveTaxi(diagnostics?: LeagueDiagnostics | null) {
  if (!diagnostics) return "Reserve and taxi settings unavailable";
  const parts = [
    diagnostics.reserveSlots !== undefined
      ? `${diagnostics.reserveSlots} reserve`
      : null,
    diagnostics.taxiSlots !== undefined ? `${diagnostics.taxiSlots} taxi` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "No reserve or taxi slots reported";
}

function formatPlayoffs(diagnostics?: LeagueDiagnostics | null) {
  if (!diagnostics) return "Playoff settings unavailable";
  const parts = [
    diagnostics.playoffWeekStart ? `start W${diagnostics.playoffWeekStart}` : null,
    diagnostics.championshipWeek ? `final W${diagnostics.championshipWeek}` : null,
    diagnostics.playoffWeeks?.length
      ? `weeks ${diagnostics.playoffWeeks.join(", ")}`
      : null,
  ].filter(Boolean);
  return parts.length ? parts.join("; ") : "Playoff weeks unavailable";
}
