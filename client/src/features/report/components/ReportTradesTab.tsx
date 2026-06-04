import { type ComponentType, type FormEvent, useMemo, useState } from "react";
import { ClipboardPaste, Loader2, ShieldCheck } from "lucide-react";
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
    [reportData.adminSleeperTradeProposalSignals, reportData.adminTradeProposalSignals, reportData.adminSleeperWaiverSignals, reportData.tradeProposalSignals]
  );

  const warRoomProposalSignals = pendingTradeSignals;
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

  const handlePasteFromClipboard = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
      setImportError("Clipboard paste is not available in this browser.");
      return;
    }

    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        setImportError("Clipboard is empty.");
        return;
      }

      setSleeperAuthToken(clipboardText.trim());
      setImportStatus("Clipboard value added. Review it, then import.");
      setImportError(null);
    } catch {
      setImportError(
        "Unable to read clipboard. Paste your token manually in the input."
      );
    }
  };

  const importSleeperOffers = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = sleeperAuthToken.trim();
    if (!token) {
      setImportError("Paste the Sleeper authorization value first.");
      return;
    }

    setImportError(null);
    setImportStatus("Importing Sleeper trade center activity...");

    try {
      const result = await onImportSleeperTradeCenter(token);
      setImportStatus(
        result.transactionCount > 0
          ? `Imported ${result.tradeCount} trade ${result.tradeCount === 1 ? "item" : "items"} and ${result.waiverCount} waiver ${result.waiverCount === 1 ? "item" : "items"}.`
          : "Sleeper accepted the token, but there are no pending trade or waiver items right now."
      );
      setSleeperAuthToken("");
    } catch (error: unknown) {
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
          className="mb-5 space-y-3 border-b border-white/10 pb-5"
          onSubmit={importSleeperOffers}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Sleeper authorization
              <Input
                type="password"
                value={sleeperAuthToken}
                onChange={(event) => {
                  setSleeperAuthToken(event.target.value);
                  if (importError) setImportError(null);
                }}
                placeholder="Paste token or copied Authorization header"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
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
          <div className="flex flex-col gap-1 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              The token is used once for pending Sleeper activity and is not saved.
            </p>
            {importedTransactionCount > 0 ? (
              <p className="font-semibold text-emerald-200">
                Imported snapshot: {importedTradeCount} trades,{" "}
                {importedWaiverCount} waivers
              </p>
            ) : null}
          </div>
          {importError ? (
            <p className="text-sm font-semibold text-rose-300">{importError}</p>
          ) : null}
          {importStatus ? (
            <p className="text-sm font-semibold text-emerald-300">
              {importStatus}
            </p>
          ) : null}
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
