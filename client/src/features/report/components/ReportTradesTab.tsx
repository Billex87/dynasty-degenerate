import { type ComponentType, type FormEvent, useId, useMemo, useState } from "react";
import {
  ClipboardPaste,
  ExternalLink,
  Info,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import { ModalReportSection } from "@/features/report/components/ReportSectionDisclosure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReportData } from "@shared/types";
import { buildMomentumPreviewMetrics } from "@/features/report/lib/reportOverviewPreview";
import { buildTradeProposalPreviewMetrics } from "@/features/report/lib/reportOverviewPreview";
import { buildTradePreviewMetrics } from "@/features/report/lib/reportOverviewPreview";

type ReportTradesTabProps = {
  reportData: ReportData;
  reportDataForView: ReportData;
  showManagerPersonalityIntel: boolean;
  onScoutLeaguemates: () => void;
  leagueId: string;
  leagueLogo: string | null;
  leagueValueMode: "redraft" | "dynasty";
  effectiveViewerManager: string | null;
  rankingsForReport?: ReportData["rankings"];
  tradeWarKicker: string;
  showTradeMarketRadar: boolean;
  onImportSleeperTradeCenter: (authToken: string) => Promise<{
    tradeCount: number;
    waiverCount: number;
    transactionCount: number;
  }>;
  isImportingSleeperTradeCenter: boolean;
  TradeBrowserRead: ComponentType<{ data: ReportData }>;
  TradeMarketRadar: ComponentType<any>;
  TradeProposalSignalsTable: ComponentType<{
    data: NonNullable<ReportData["tradeProposalSignals"]>;
    managerAvatars?: ReportData["managerAvatars"];
  }>;
  TradeWarRoom: ComponentType<{
    data?: ReportData["managerRosterIntelligence"];
    managerAvatars?: ReportData["managerAvatars"];
    playerDetailsById?: ReportData["playerDetailsById"];
    leagueId?: string;
    leagueLogo?: string | null;
    leagueOverview?: ReportData["leagueOverview"];
    rankings?: ReportData["rankings"];
    pickPortfolios?: ReportData["pickPortfolios"];
    draftPicks?: ReportData["draftPicks"];
    tradeTendencies?: ReportData["tradeTendencies"];
    tradeProposalSignals?: ReportData["tradeProposalSignals"];
    recentTransactions?: ReportData["recentTransactions"];
    showManagerPersonalityIntel?: boolean;
    viewerManager?: string | null;
    currentStandings?: ReportData["currentStandings"];
    leagueValueMode?: ReportData["leagueValueMode"];
    onScoutLeaguemates?: () => void;
  }>;
  TradeProfitLeaderboardTable: ComponentType<{
    data: ReportData["tradeProfitLeaderboard"];
    managerAvatars?: ReportData["managerAvatars"];
    tradeHistory?: ReportData["tradeHistory"];
    draftPicks?: ReportData["draftPicks"];
    playerDetailsById: ReportData["playerDetailsById"];
    currentPositionRankById?: ReportData["currentPositionRankById"];
    tradeTendencies?: ReportData["tradeTendencies"];
    managerRosterIntelligence?: ReportData["managerRosterIntelligence"];
    dynastyTimelines?: ReportData["dynastyTimelines"];
    leagueOverview?: ReportData["leagueOverview"];
    leagueId?: string;
    leagueLogo?: string | null;
    viewerManager?: string | null;
    leagueDiagnostics?: ReportData["leagueDiagnostics"];
    currentStandings?: ReportData["currentStandings"];
    standingsHistory?: ReportData["standingsHistory"];
    leagueValueMode?: ReportData["leagueValueMode"];
  }>;
  TradeTheftDetector: ComponentType<{
    data: ReportData["tradeHistory"];
    managerAvatars?: ReportData["managerAvatars"];
    draftPicks?: ReportData["draftPicks"];
    playerDetailsById: ReportData["playerDetailsById"];
    currentPositionRankById?: ReportData["currentPositionRankById"];
    managerRosterIntelligence?: ReportData["managerRosterIntelligence"];
    dynastyTimelines?: ReportData["dynastyTimelines"];
    leagueOverview?: ReportData["leagueOverview"];
    leagueId?: string;
    leagueLogo?: string | null;
    leagueDiagnostics?: ReportData["leagueDiagnostics"];
    currentStandings?: ReportData["currentStandings"];
    standingsHistory?: ReportData["standingsHistory"];
    leagueValueMode?: ReportData["leagueValueMode"];
  }>;
  TradeHistoryTable: ComponentType<{
    data: ReportData["tradeHistory"];
    draftPicks?: ReportData["draftPicks"];
    managerAvatars?: ReportData["managerAvatars"];
    playerDetailsById: ReportData["playerDetailsById"];
    currentPositionRankById?: ReportData["currentPositionRankById"];
    managerRosterIntelligence?: ReportData["managerRosterIntelligence"];
    dynastyTimelines?: ReportData["dynastyTimelines"];
    leagueOverview?: ReportData["leagueOverview"];
    leagueId?: string;
    leagueLogo?: string | null;
    leagueDiagnostics?: ReportData["leagueDiagnostics"];
    currentStandings?: ReportData["currentStandings"];
    standingsHistory?: ReportData["standingsHistory"];
    leagueValueMode?: ReportData["leagueValueMode"];
    variant?: "inline" | "modal";
  }>;
};

type TradeProposalSignal = NonNullable<ReportData["tradeProposalSignals"]>[number];

const SLEEPER_AUTH_COPY_STEPS = [
  "Open this league's Sleeper Trades page in the same browser where you are signed in.",
  "Open DevTools, go to Network, then refresh the Sleeper trades page.",
  "Click the Sleeper graphql request and copy its Authorization request header.",
  "Paste the full header or just the header value here, then import.",
];

function pluralizeImportCount(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function mapWaiverSignalToTradeProposalSignal(
  signal: NonNullable<ReportData["adminSleeperWaiverSignals"]>[number]
): TradeProposalSignal {
  const playerNames = Array.from(
    new Set([...(signal.playerNames || []), ...(signal.dropPlayerNames || [])])
  );
  const playerIds = Array.from(
    new Set([...(signal.playerIds || []), ...(signal.dropPlayerIds || [])])
  );

  return {
    id: signal.id,
    date: signal.date,
    status: signal.status,
    managers: signal.managers,
    playerIds,
    playerNames,
    pickLabels: [],
    note: signal.note,
  };
}

function dedupeTradeProposalSignals(
  signals: TradeProposalSignal[]
): TradeProposalSignal[] {
  const map = new Map<string, TradeProposalSignal>();

  signals.forEach((signal, index) => {
    const id = String(signal.id || "").trim();
    const key =
      id ||
      `${signal.date || "unknown-date"}|${signal.status || "unknown-status"}|${(signal.playerIds || []).join(",")}|${(signal.managers || []).join(",")}|${index}`;
    map.set(key, signal);
  });

  return Array.from(map.values()).sort((a, b) => {
    const aTime = Date.parse(a.date || "");
    const bTime = Date.parse(b.date || "");
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) return bTime - aTime;
    if (Number.isFinite(aTime)) return -1;
    if (Number.isFinite(bTime)) return 1;
    return 0;
  });
}

export function ReportTradesTab({
  reportData,
  reportDataForView,
  showManagerPersonalityIntel,
  onScoutLeaguemates,
  leagueId,
  leagueLogo,
  leagueValueMode,
  effectiveViewerManager,
  rankingsForReport,
  tradeWarKicker,
  showTradeMarketRadar,
  onImportSleeperTradeCenter,
  isImportingSleeperTradeCenter,
  TradeBrowserRead,
  TradeMarketRadar,
  TradeProposalSignalsTable,
  TradeWarRoom,
  TradeProfitLeaderboardTable,
  TradeTheftDetector,
  TradeHistoryTable,
}: ReportTradesTabProps) {
  const sleeperAuthInputId = useId();
  const sleeperAuthHelpId = useId();
  const sleeperAuthStatusId = useId();
  const [sleeperAuthToken, setSleeperAuthToken] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const pendingTradeSignals = useMemo(
    () =>
      dedupeTradeProposalSignals([
        ...(reportData.adminSleeperTradeProposalSignals || []),
        ...(reportData.adminTradeProposalSignals || []),
        ...(reportData.tradeProposalSignals || []),
        ...(reportData.adminSleeperWaiverSignals || []).map(
          mapWaiverSignalToTradeProposalSignal
        ),
      ]),
    [
      reportData.adminSleeperTradeProposalSignals,
      reportData.adminTradeProposalSignals,
      reportData.adminSleeperWaiverSignals,
      reportData.tradeProposalSignals,
    ]
  );

  const warRoomProposalSignals = pendingTradeSignals;
  const sleeperTradesUrl = leagueId
    ? `https://sleeper.com/leagues/${encodeURIComponent(leagueId)}/trades`
    : "https://sleeper.com/";
  const hiddenSnapshot = reportData.sleeperHiddenLeagueSnapshot;
  const importedTradeCount =
    hiddenSnapshot?.tradeCount ??
    reportData.adminSleeperTradeProposalSignals?.length ??
    0;
  const importedWaiverCount =
    hiddenSnapshot?.waiverCount ?? reportData.adminSleeperWaiverSignals?.length ?? 0;
  const importedTransactionCount =
    hiddenSnapshot?.transactionCount ??
    importedTradeCount + importedWaiverCount;
  const hasImportedSnapshot = importedTransactionCount > 0;

  const handlePasteFromClipboard = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
      setImportError("Clipboard paste is not available in this browser.");
      return;
    }

    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        setImportError("Clipboard is empty. Copy the Sleeper Authorization header first.");
        return;
      }

      setSleeperAuthToken(clipboardText.trim());
      setImportStatus("Header pasted locally. Import when ready.");
      setImportError(null);
    } catch {
      setImportError(
        "Browser blocked clipboard access. Click the field and use Cmd+V instead."
      );
    }
  };

  const importSleeperOffers = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = sleeperAuthToken.trim();
    if (!token) {
      setImportError("Paste the Sleeper Authorization header first.");
      return;
    }

    setImportError(null);
    setImportStatus("Importing pending Sleeper trades and waivers...");

    try {
      const result = await onImportSleeperTradeCenter(token);
      setImportStatus(
        result.transactionCount > 0
          ? `Imported ${pluralizeImportCount(result.tradeCount, "pending trade")} and ${pluralizeImportCount(result.waiverCount, "waiver claim")}. Trade War Room now includes this snapshot.`
          : "Sleeper accepted the header, but there are no pending trade or waiver items right now."
      );
      setSleeperAuthToken("");
    } catch (error: unknown) {
      setImportStatus(null);
      setImportError(
        error instanceof Error ? error.message : "Could not import Sleeper offers."
      );
    }
  };

  return (
    <div className="trade-sections report-command-section-stack space-y-6 sm:space-y-8">
      {showTradeMarketRadar && (
        <CollapsibleReportSection
          title="Trade Market Radar"
          kicker={
            leagueValueMode === "redraft"
              ? "Current-season buy and sell signals"
              : "Buy and sell signals"
          }
          previewMetrics={buildMomentumPreviewMetrics(reportData)}
        >
          <TradeMarketRadar
            risers={reportData.weeklyRisers}
            fallers={reportData.weeklyFallers}
            managerAvatars={reportData.managerAvatars}
            playerDetailsById={reportData.playerDetailsById}
            leagueId={leagueId}
            leagueLogo={leagueLogo}
            viewerManager={effectiveViewerManager}
            leagueValueMode={leagueValueMode}
          />
        </CollapsibleReportSection>
      )}
      <TradeBrowserRead data={reportDataForView} />
      <CollapsibleReportSection
        title="Pending Trade Offers"
        kicker="Public proposal history plus imported Sleeper trade center activity"
        previewMetrics={buildTradeProposalPreviewMetrics(reportData)}
        premium
        defaultOpen
      >
        <form
          className="mb-5 space-y-4 rounded-2xl border border-emerald-300/20 bg-emerald-950/20 p-4 shadow-[0_24px_80px_rgba(16,185,129,0.10)] sm:p-5"
          onSubmit={importSleeperOffers}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.22em] text-emerald-200">
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                Sleeper bridge beta
              </p>
              <h3 className="text-base font-black text-slate-50 sm:text-lg">
                Import live pending trades and waiver claims
              </h3>
              <p className="max-w-3xl text-sm leading-6 text-slate-300">
                Sleeper's public API only exposes completed transactions. This
                one-time bridge lets a commissioner or league member import
                their visible pending activity from an active Sleeper tab.
              </p>
            </div>
            <Button
              type="button"
              asChild
              variant="outline"
              className="h-10 border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
            >
              <a href={sleeperTradesUrl} target="_blank" rel="noreferrer">
                Open Sleeper trades
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </div>

          <div className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-300 sm:grid-cols-3">
            <div>
              <p className="font-bold text-slate-100">1. Open Sleeper</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Use the button above for this league's Trades page.
              </p>
            </div>
            <div>
              <p className="font-bold text-slate-100">2. Copy the header</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Copy the Authorization request header from Sleeper's graphql
                request.
              </p>
            </div>
            <div>
              <p className="font-bold text-slate-100">3. Import once</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                The header is cleared after import; the report keeps the
                imported snapshot.
              </p>
            </div>
          </div>

          <details className="group rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-bold text-slate-100">
              <Info className="h-4 w-4 text-emerald-200" aria-hidden="true" />
              Exact copy steps
            </summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-5 text-slate-400">
              {SLEEPER_AUTH_COPY_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label
              htmlFor={sleeperAuthInputId}
              className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
            >
              One-time Sleeper session header
              <Input
                id={sleeperAuthInputId}
                type="password"
                value={sleeperAuthToken}
                onChange={(event) => {
                  setSleeperAuthToken(event.target.value);
                  if (importError) setImportError(null);
                  if (importStatus) setImportStatus(null);
                }}
                placeholder="Paste Authorization header or copied header value"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                aria-describedby={`${sleeperAuthHelpId} ${sleeperAuthStatusId}`}
                className="mt-2 normal-case tracking-normal"
              />
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePasteFromClipboard}
                disabled={isImportingSleeperTradeCenter}
                className="h-10 border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
              >
                <ClipboardPaste className="mr-2 h-4 w-4" aria-hidden="true" />
                Paste
              </Button>
              <Button
                type="submit"
                disabled={isImportingSleeperTradeCenter || !sleeperAuthToken.trim()}
                className="h-10 bg-emerald-300 text-slate-950 hover:bg-emerald-200 disabled:opacity-60"
              >
                {isImportingSleeperTradeCenter ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Import
              </Button>
            </div>
          </div>
          <div
            id={sleeperAuthHelpId}
            className="flex flex-col gap-1 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="max-w-3xl">
              The session header is used once and never saved. Imported pending
              activity is stored as a report snapshot so this league can reuse it.
            </p>
            {hasImportedSnapshot ? (
              <p className="font-semibold text-emerald-200">
                Imported snapshot: {importedTradeCount} trades,{" "}
                {importedWaiverCount} waivers
              </p>
            ) : null}
          </div>
          <div id={sleeperAuthStatusId} aria-live="polite">
            {importError ? (
              <p className="rounded-xl border border-rose-300/20 bg-rose-950/30 px-3 py-2 text-sm font-semibold text-rose-200">
                {importError}
              </p>
            ) : null}
            {importStatus ? (
              <p className="rounded-xl border border-emerald-300/20 bg-emerald-950/30 px-3 py-2 text-sm font-semibold text-emerald-200">
                {importStatus}
              </p>
            ) : null}
          </div>
        </form>
        <TradeProposalSignalsTable
          data={pendingTradeSignals}
          managerAvatars={reportData.managerAvatars}
        />
      </CollapsibleReportSection>
      <CollapsibleReportSection
        title="Trade War Room"
        kicker={tradeWarKicker}
        previewMetrics={buildTradePreviewMetrics(
          reportData,
          leagueValueMode,
          "war-room"
        )}
      >
          <TradeWarRoom
            data={reportData.managerRosterIntelligence}
          managerAvatars={reportData.managerAvatars}
          playerDetailsById={reportData.playerDetailsById}
          leagueOverview={reportData.leagueOverview}
          rankings={rankingsForReport || undefined}
          pickPortfolios={reportData.pickPortfolios}
          draftPicks={reportData.draftPicks}
          tradeTendencies={reportData.tradeTendencies}
          tradeProposalSignals={warRoomProposalSignals}
          recentTransactions={reportData.recentTransactions}
          leagueId={leagueId}
          leagueLogo={leagueLogo}
          viewerManager={effectiveViewerManager}
          currentStandings={reportData.currentStandings}
          leagueValueMode={leagueValueMode}
          showManagerPersonalityIntel={showManagerPersonalityIntel}
          onScoutLeaguemates={onScoutLeaguemates}
        />
      </CollapsibleReportSection>
      <CollapsibleReportSection
        title={
          leagueValueMode === "redraft"
            ? "Trade Value Board"
            : "Trade Profit Board"
        }
        kicker={
          leagueValueMode === "redraft"
            ? "Current-season trade edge"
            : "Net trade edge"
        }
        previewMetrics={buildTradePreviewMetrics(
          reportData,
          leagueValueMode,
          "leaderboard"
        )}
      >
        <TradeProfitLeaderboardTable
          data={reportData.tradeProfitLeaderboard}
          managerAvatars={reportData.managerAvatars}
          tradeHistory={reportData.tradeHistory}
          draftPicks={reportData.draftPicks || []}
          playerDetailsById={reportData.playerDetailsById}
          currentPositionRankById={reportData.currentPositionRankById}
          tradeTendencies={reportData.tradeTendencies}
          managerRosterIntelligence={reportData.managerRosterIntelligence}
          dynastyTimelines={reportData.dynastyTimelines}
          leagueOverview={reportData.leagueOverview}
          leagueId={leagueId}
          leagueLogo={leagueLogo}
          viewerManager={effectiveViewerManager}
          leagueDiagnostics={reportData.leagueDiagnostics}
          currentStandings={reportData.currentStandings}
          standingsHistory={reportData.standingsHistory}
          leagueValueMode={leagueValueMode}
        />
      </CollapsibleReportSection>
      <CollapsibleReportSection
        title={
          leagueValueMode === "redraft"
            ? "Trade Balance Review"
            : "Trade Theft Detector"
        }
        kicker={
          leagueValueMode === "redraft"
            ? "Largest current-season gaps"
            : "Who got cooked"
        }
        previewMetrics={buildTradePreviewMetrics(
          reportData,
          leagueValueMode,
          "theft"
        )}
      >
        <TradeTheftDetector
          data={reportData.tradeHistory}
          managerAvatars={reportData.managerAvatars}
          draftPicks={reportData.draftPicks || []}
          playerDetailsById={reportData.playerDetailsById}
          currentPositionRankById={reportData.currentPositionRankById}
          managerRosterIntelligence={reportData.managerRosterIntelligence}
          dynastyTimelines={reportData.dynastyTimelines}
          leagueOverview={reportData.leagueOverview}
          leagueId={leagueId}
          leagueLogo={leagueLogo}
          leagueDiagnostics={reportData.leagueDiagnostics}
          currentStandings={reportData.currentStandings}
          standingsHistory={reportData.standingsHistory}
          leagueValueMode={leagueValueMode}
        />
      </CollapsibleReportSection>
      <ModalReportSection
        title="Trade Receipts"
        kicker="Every completed trade"
        previewMetrics={buildTradePreviewMetrics(
          reportData,
          leagueValueMode,
          "ledger"
        )}
      >
        <TradeHistoryTable
          data={reportData.tradeHistory}
          draftPicks={reportData.draftPicks || []}
          managerAvatars={reportData.managerAvatars}
          playerDetailsById={reportData.playerDetailsById}
          currentPositionRankById={reportData.currentPositionRankById}
          managerRosterIntelligence={reportData.managerRosterIntelligence}
          dynastyTimelines={reportData.dynastyTimelines}
          leagueOverview={reportData.leagueOverview}
          leagueId={leagueId}
          leagueLogo={leagueLogo}
          leagueDiagnostics={reportData.leagueDiagnostics}
          currentStandings={reportData.currentStandings}
          standingsHistory={reportData.standingsHistory}
          leagueValueMode={leagueValueMode}
          variant="modal"
        />
      </ModalReportSection>
    </div>
  );
}
