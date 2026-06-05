import {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRightLeft,
  Cable,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import { ModalReportSection } from "@/features/report/components/ReportSectionDisclosure";
import { Button } from "@/components/ui/button";
import { PlayerDetailModal, type PlayerModalData } from "@/components/PlayerDetailModal";
import { PlayerIdentityRow } from "@/components/reportPrimitives";
import { TeamLogoPill } from "@/components/TeamLogoPill";
import type { ReportData, SleeperExtensionTradeCenterSnapshot } from "@shared/types";
import { getTeamTileStyle } from "@/lib/teamTileStyle";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import {
  formatCompactValue,
  PositionRankPill,
  renderActivityManagerAvatar,
} from "@/components/reportTables/shared";
import { buildMomentumPreviewMetrics } from "@/features/report/lib/reportOverviewPreview";
import { buildTradeProposalPreviewMetrics } from "@/features/report/lib/reportOverviewPreview";
import { buildTradePreviewMetrics } from "@/features/report/lib/reportOverviewPreview";

type ReportTradesTabProps = {
  reportData: ReportData;
  reportDataForView: ReportData;
  showManagerPersonalityIntel: boolean;
  showPendingSleeperActivity: boolean;
  onScoutLeaguemates: () => void;
  leagueId: string;
  leagueLogo: string | null;
  leagueValueMode: "redraft" | "dynasty";
  effectiveViewerManager: string | null;
  rankingsForReport?: ReportData["rankings"];
  tradeWarKicker: string;
  showTradeMarketRadar: boolean;
  onImportSleeperTradeCenterSnapshot: (
    snapshot: SleeperExtensionTradeCenterSnapshot
  ) => Promise<{
    tradeCount: number;
    waiverCount: number;
    transactionCount: number;
  }>;
  isImportingSleeperTradeCenterSnapshot: boolean;
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
    initialProposalSignal?: TradeProposalSignal | null;
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

const SLEEPER_HELPER_APP_SOURCE = "dynasty-degens-app";
const SLEEPER_HELPER_EXTENSION_SOURCE = "dynasty-degens-sleeper-helper";
const CURRENT_PENDING_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SLEEPER_HELPER_IMPORT_TIMEOUT_MS = 60 * 1000;

function isPendingSleeperSignalStatus(status?: string | null): boolean {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized.includes("pending") || normalized.includes("proposed");
}

function isCurrentPendingSignalDate(date?: string | null): boolean {
  const timestamp = Date.parse(String(date || ""));
  if (!Number.isFinite(timestamp)) return true;
  return Date.now() - timestamp <= CURRENT_PENDING_MAX_AGE_MS;
}

function isPendingTradeProposalSignal(signal: TradeProposalSignal): boolean {
  return isPendingSleeperSignalStatus(signal.status) && isCurrentPendingSignalDate(signal.date);
}

function getPendingActivityKind(signal: TradeProposalSignal): "trade" | "waiver" | "proposal" {
  if (signal.sourceType === "waiver" || /waiver/i.test(signal.note || "")) {
    return "waiver";
  }
  if (signal.sourceType === "trade" || signal.tradeSides?.length) {
    return "trade";
  }
  return "proposal";
}

function formatPendingActivityDate(value?: string | null): string {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return "Date unknown";
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isDefensePosition(position?: string | null): boolean {
  const normalized = String(position || "").trim().toUpperCase();
  return normalized === "DEF" || normalized === "DST";
}

const DEFENSE_TEAM_BY_NAME: Record<string, string> = {
  "arizona cardinals": "ARI",
  "atlanta falcons": "ATL",
  "baltimore ravens": "BAL",
  "buffalo bills": "BUF",
  "carolina panthers": "CAR",
  "chicago bears": "CHI",
  "cincinnati bengals": "CIN",
  "cleveland browns": "CLE",
  "dallas cowboys": "DAL",
  "denver broncos": "DEN",
  "detroit lions": "DET",
  "green bay packers": "GB",
  "houston texans": "HOU",
  "indianapolis colts": "IND",
  "jacksonville jaguars": "JAX",
  "kansas city chiefs": "KC",
  "las vegas raiders": "LV",
  "los angeles chargers": "LAC",
  "los angeles rams": "LAR",
  "miami dolphins": "MIA",
  "minnesota vikings": "MIN",
  "new england patriots": "NE",
  "new orleans saints": "NO",
  "new york giants": "NYG",
  "new york jets": "NYJ",
  "philadelphia eagles": "PHI",
  "pittsburgh steelers": "PIT",
  "san francisco 49ers": "SF",
  "seattle seahawks": "SEA",
  "tampa bay buccaneers": "TB",
  "tennessee titans": "TEN",
  "washington commanders": "WAS",
};

const DEFENSE_NAME_BY_TEAM = Object.entries(DEFENSE_TEAM_BY_NAME).reduce<Record<string, string>>(
  (map, [name, team]) => {
    map[team] = name.replace(/\b[a-z]/g, letter => letter.toUpperCase());
    return map;
  },
  {}
);

function getDefenseTeamFromName(playerName?: string | null): string | null {
  const normalized = String(playerName || "").trim().toLowerCase();
  return DEFENSE_TEAM_BY_NAME[normalized] || null;
}

function getDefenseNameFromTeam(team?: string | null): string | null {
  const normalized = String(team || "").trim().toUpperCase();
  return DEFENSE_NAME_BY_TEAM[normalized] || null;
}

function getPendingAssetDisplayName(
  playerId: string | null | undefined,
  playerName: string | null | undefined,
  playerDetailsById?: ReportData["playerDetailsById"]
): string {
  const name = String(playerName || "").trim();
  if (name) return name;

  const id = String(playerId || "").trim();
  if (!id) return "";

  const details = playerDetailsById?.[id];
  const fallbackName =
    details && typeof (details as { name?: unknown }).name === "string"
      ? (details as { name: string }).name
      : null;
  return details?.fullName || fallbackName || getDefenseNameFromTeam(id) || id;
}

function ManagerActivityChip({
  manager,
  managerAvatars,
  verb,
}: {
  manager: string;
  managerAvatars?: ReportData["managerAvatars"];
  verb: string;
}) {
  const avatarUrl = managerAvatars?.[manager] || null;
  const initials = manager
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex items-center gap-2">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-8 w-8 rounded-full border border-white/15 object-cover"
          loading="lazy"
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-xs font-black text-cyan-100">
          {initials || "?"}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-slate-50">{manager}</p>
      </div>
      <span className="ml-auto flex items-center gap-2">
        <span className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-cyan-200">
          {verb}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
          <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </span>
    </div>
  );
}

function collectPendingRankingRows(value: unknown, rows: any[] = []): any[] {
  if (!value) return rows;
  if (Array.isArray(value)) {
    value.forEach(item => collectPendingRankingRows(item, rows));
    return rows;
  }
  if (typeof value !== "object") return rows;
  const record = value as Record<string, unknown>;
  if (typeof record.name === "string" || record.id || record.playerId || record.player_id) {
    rows.push(record);
  }
  Object.values(record).forEach(item => {
    if (Array.isArray(item) || (item && typeof item === "object")) {
      collectPendingRankingRows(item, rows);
    }
  });
  return rows;
}

function normalizePendingLookupName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b(d\/st|dst|defense)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function collectPendingWaiverPlayers(
  waiverIntelligence?: ReportData["waiverIntelligence"]
): any[] {
  if (!waiverIntelligence) return [];
  const players: any[] = [];
  const seen = new Set<string>();
  const add = (player?: any | null) => {
    if (!player) return;
    const key = String(player.player_id || player.id || player.name || players.length);
    if (seen.has(key)) return;
    seen.add(key);
    players.push(player);
  };
  const addTarget = (target?: any | null) => add(target?.player);

  waiverIntelligence.defensePairingTargets?.forEach(addTarget);
  waiverIntelligence.specialTeamsStreamerTargets?.forEach(addTarget);
  waiverIntelligence.weeklyEcrTargets?.forEach(addTarget);
  waiverIntelligence.priorityWaiverTargets?.forEach(addTarget);
  add(waiverIntelligence.bestAvailableByPosition?.DEF);
  add(waiverIntelligence.highestKtcAvailable);
  waiverIntelligence.availableTrendingAdds?.forEach(add);
  waiverIntelligence.rosteredTrendingAdds?.forEach(add);
  waiverIntelligence.recentlyDroppedValuable?.forEach(add);

  return players;
}

function findPendingWaiverPlayer(
  playerId: string | null | undefined,
  playerName: string,
  waiverIntelligence?: ReportData["waiverIntelligence"]
): any | null {
  const players = collectPendingWaiverPlayers(waiverIntelligence);
  if (!players.length) return null;

  const normalizedName = normalizePendingLookupName(playerName);
  const defenseTeam = getDefenseTeamFromName(playerName);
  const defenseNickname = defenseTeam
    ? normalizedName.split(" ").filter(Boolean).at(-1) || ""
    : "";
  const matchesPlayerName = (player: any) => {
    const playerTeam = String(player?.team || "").toUpperCase();
    const playerNameNormalized = normalizePendingLookupName(String(player?.name || ""));
    return (
      playerNameNormalized === normalizedName ||
      (Boolean(defenseTeam) &&
        (playerTeam === defenseTeam ||
          playerNameNormalized === defenseNickname ||
          playerNameNormalized.endsWith(` ${defenseNickname}`)))
    );
  };

  if (defenseTeam) {
    return players.find(matchesPlayerName) || null;
  }

  return (
    players.find(player => String(player?.player_id || player?.id || "") === String(playerId || "")) ||
    players.find(matchesPlayerName) ||
    null
  );
}

function getPendingWaiverPlayerRank(player?: any | null): string | null {
  return (
    player?.playerDetails?.valueProfile?.seasonPositionRank ||
    player?.playerDetails?.valueProfile?.fantasyProsPositionRank ||
    player?.currentPositionRank ||
    player?.weeklyEcr?.bestPositionRank ||
    player?.weeklyEcr?.weeks?.find?.((week: any) => Boolean(week?.positionRank))?.positionRank ||
    null
  );
}

function getPendingWaiverPlayerValue(player?: any | null): number | null {
  const value =
    player?.playerDetails?.valueProfile?.seasonValue ??
    player?.playerDetails?.valueProfile?.fantasyProsSeasonValue ??
    player?.ktcValue ??
    null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function findPendingRankingRow(
  playerId: string | null | undefined,
  playerName: string,
  rankings?: ReportData["rankings"]
): any | null {
  if (!rankings) return null;
  const rows = collectPendingRankingRows(rankings);
  const normalizedName = normalizePendingLookupName(playerName);
  const defenseTeam = getDefenseTeamFromName(playerName);
  const normalizedNameParts = normalizedName.split(" ").filter(Boolean);
  const defenseNickname = defenseTeam
    ? normalizedNameParts[normalizedNameParts.length - 1] || ""
    : "";
  const matchesPlayerName = (row: any) => {
    const rowName = normalizePendingLookupName(
      String(row?.name || row?.fullName || row?.playerName || row?.player_name || "")
    );
    const rowTeam = String(row?.team || row?.teamAbbr || row?.teamCode || row?.nfl_team || "").toUpperCase();
    const rowPosition = row?.position || row?.pos || row?.fantasyPosition || row?.fantasy_position;
    return (
      rowName === normalizedName ||
      (Boolean(defenseTeam) &&
        (rowName === String(defenseTeam).toLowerCase() ||
          rowName.endsWith(` ${defenseNickname}`) ||
          rowName === defenseNickname ||
          (rowTeam === defenseTeam && isDefensePosition(String(rowPosition || "")))))
    );
  };
  if (defenseTeam) {
    return rows.find(row => matchesPlayerName(row)) || null;
  }

  return (
    rows.find(row => String(row?.id || row?.playerId || row?.player_id || "") === String(playerId || "")) ||
    rows.find(row => matchesPlayerName(row)) ||
    null
  );
}

function getPendingPlayerValue(
  details: NonNullable<ReportData["playerDetailsById"]>[string] | undefined,
  leagueValueMode: ReportData["leagueValueMode"],
  rankingRow?: any | null
): number | null {
  const profile = details?.valueProfile;
  const value =
    leagueValueMode === "redraft" || isDefensePosition(details?.position)
      ? profile?.seasonValue ?? profile?.fantasyProsSeasonValue ?? rankingRow?.seasonValue ?? rankingRow?.value ?? null
      : profile?.dynastyValue ?? profile?.balancedValue ?? profile?.marketKtc ?? rankingRow?.value ?? rankingRow?.ktcValue ?? null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getPendingPlayerRank(
  details: NonNullable<ReportData["playerDetailsById"]>[string] | undefined,
  leagueValueMode: ReportData["leagueValueMode"],
  rankingRow?: any | null,
  isDefense = false,
  rankFromMap?: string | null
): string | null {
  const profile = details?.valueProfile;
  const rankingPositionRank =
    rankFromMap ||
    rankingRow?.seasonPositionRank ||
    rankingRow?.fantasyProsPositionRank ||
    rankingRow?.currentPositionRank ||
    rankingRow?.positionRank ||
    rankingRow?.positionalRank ||
    rankingRow?.rank ||
    null;
  const rank =
    leagueValueMode === "redraft" || isDefense
      ? profile?.seasonPositionRank || profile?.fantasyProsPositionRank || rankingPositionRank
      : profile?.dynastyPositionRank || profile?.balancedPositionRank || rankingPositionRank;
  if (rank !== null && rank !== undefined && String(rank).trim() !== "") {
    const rankText = String(rank).trim();
    return isDefense && /^\d+$/.test(rankText) ? `DST${rankText}` : rankText;
  }
  return (
    details?.position ||
    null
  );
}

function PendingPlayerAssetCard({
  playerId,
  playerName,
  playerDetailsById,
  currentPositionRankById,
  waiverIntelligence,
  managerName,
  managerAvatars,
  leagueValueMode,
  rankings,
  onSelectPlayer,
}: {
  playerId?: string | null;
  playerName: string;
  playerDetailsById?: ReportData["playerDetailsById"];
  currentPositionRankById?: ReportData["currentPositionRankById"];
  waiverIntelligence?: ReportData["waiverIntelligence"];
  managerName?: string | null;
  managerAvatars?: ReportData["managerAvatars"];
  leagueValueMode: ReportData["leagueValueMode"];
  rankings?: ReportData["rankings"];
  onSelectPlayer: (player: PlayerModalData) => void;
}) {
  const defenseTeamFromName = getDefenseTeamFromName(playerName);
  const lookupPlayerId = defenseTeamFromName ? undefined : playerId || undefined;
  const details = lookupPlayerId ? playerDetailsById?.[lookupPlayerId] : undefined;
  const rankingRow = findPendingRankingRow(lookupPlayerId, playerName, rankings);
  const displayName = defenseTeamFromName ? playerName : details?.fullName || playerName;
  const waiverPlayer = findPendingWaiverPlayer(lookupPlayerId, displayName, waiverIntelligence);
  const inferredDefenseTeam = defenseTeamFromName || getDefenseTeamFromName(displayName);
  const rankingPosition = rankingRow?.position || rankingRow?.pos;
  const waiverPosition = waiverPlayer?.position || waiverPlayer?.pos;
  const isNamedDefense = Boolean(inferredDefenseTeam);
  const modalDetails = isNamedDefense
    ? waiverPlayer?.playerDetails || undefined
    : details || waiverPlayer?.playerDetails || undefined;
  const team = isNamedDefense
    ? inferredDefenseTeam
    : details?.team || rankingRow?.team || waiverPlayer?.team || null;
  const position = isNamedDefense
    ? "DEF"
    : details?.position || rankingPosition || waiverPosition || null;
  const isDefense = isDefensePosition(position) || Boolean(inferredDefenseTeam);
  const cleanDefenseRank = (rank?: string | null) => {
    if (!rank) return null;
    const rankText = String(rank).trim();
    if (!isDefense) return rankText;
    if (/^(DEF|DST|D\/ST)\d+/i.test(rankText)) return rankText.replace(/^D\/ST/i, "DEF");
    if (/^\d+$/.test(rankText)) return `DEF${rankText}`;
    return null;
  };
  const rankFromMap =
    cleanDefenseRank(lookupPlayerId ? currentPositionRankById?.[lookupPlayerId] : null) ||
    cleanDefenseRank(team ? currentPositionRankById?.[team] : null) ||
    cleanDefenseRank(inferredDefenseTeam ? currentPositionRankById?.[inferredDefenseTeam] : null) ||
    cleanDefenseRank(getPendingWaiverPlayerRank(waiverPlayer)) ||
    null;
  const defenseRankFromRankingRow = cleanDefenseRank(
    rankingRow?.positionRank ||
      rankingRow?.sourcePositionRank ||
      getPendingPlayerRank(undefined, leagueValueMode, rankingRow, true, null)
  );
  const defenseValueFromRankingRow =
    typeof rankingRow?.value === "number" && Number.isFinite(rankingRow.value)
      ? rankingRow.value
      : getPendingPlayerValue(undefined, leagueValueMode, rankingRow);
  const value = isDefense
    ? defenseValueFromRankingRow ?? getPendingWaiverPlayerValue(waiverPlayer)
    : getPendingPlayerValue(details, leagueValueMode, rankingRow) ?? getPendingWaiverPlayerValue(waiverPlayer);
  const rank = isDefense
    ? defenseRankFromRankingRow || rankFromMap || "DEF"
    : getPendingPlayerRank(details, leagueValueMode, rankingRow, false, rankFromMap);
  const modalPick: PlayerModalData = {
    playerName: displayName,
    player_id: playerId || undefined,
    playerPos: position || undefined,
    playerDetails: modalDetails,
    boardPositionRank: rank || position || null,
    sourcePositionRank: rank || position || null,
    managerAvatarUrl: managerName ? managerAvatars?.[managerName] || null : null,
    valueMode: normalizeLeagueValueMode(leagueValueMode),
  };

  return (
    <button
      type="button"
      onClick={() => onSelectPlayer(modalPick)}
      className="player-team-tile weekly-momentum-tile group w-full !min-h-[6.85rem] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      style={getTeamTileStyle(team)}
      aria-label={`Open ${displayName} details`}
    >
      <div className="weekly-momentum-identity">
        <PlayerIdentityRow
          className="weekly-momentum-player"
          playerId={playerId || undefined}
          playerName={displayName}
          team={team}
          position={position}
          hideMeta
        />
      </div>
      <div className="activity-card-meta-row">
        <div className="weekly-momentum-pills flex min-w-0 flex-wrap items-center gap-2">
          <PositionRankPill rank={rank || position || "-"} />
          {!isDefense ? <TeamLogoPill team={team} /> : null}
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-black text-emerald-200">
            {formatCompactValue(value)}
          </span>
        </div>
        {renderActivityManagerAvatar(managerName, managerAvatars)}
      </div>
    </button>
  );
}

function PendingPlayerAssetGrid({
  label,
  playerIds,
  playerNames,
  pickLabels = [],
  emptyLabel = "No assets listed",
  playerDetailsById,
  currentPositionRankById,
  waiverIntelligence,
  managerName,
  managerAvatars,
  leagueValueMode,
  rankings,
  onSelectPlayer,
}: {
  label: string;
  playerIds: string[];
  playerNames: string[];
  pickLabels?: string[];
  emptyLabel?: string;
  playerDetailsById?: ReportData["playerDetailsById"];
  currentPositionRankById?: ReportData["currentPositionRankById"];
  waiverIntelligence?: ReportData["waiverIntelligence"];
  managerName?: string | null;
  managerAvatars?: ReportData["managerAvatars"];
  leagueValueMode: ReportData["leagueValueMode"];
  rankings?: ReportData["rankings"];
  onSelectPlayer: (player: PlayerModalData) => void;
}) {
  const playerItemCount = Math.max(playerNames.length, playerIds.length);
  const playerItems = Array.from({ length: playerItemCount }, (_, index) => {
    const playerId = playerIds[index] || null;
    const playerName = getPendingAssetDisplayName(
      playerId,
      playerNames[index],
      playerDetailsById
    );
    return {
      playerName,
      playerId,
    };
  }).filter(item => item.playerName);

  return (
    <div className="space-y-2">
      {label ? (
        <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-cyan-200">
          {label}
        </p>
      ) : null}
      {playerItems.length || pickLabels.length ? (
        <div className="grid grid-cols-2 gap-2 sm:[grid-template-columns:repeat(auto-fill,minmax(13.25rem,13.25rem))] sm:justify-start">
          {playerItems.map(item => (
            <PendingPlayerAssetCard
              key={`${label || "asset"}:${item.playerId || item.playerName}`}
              playerId={item.playerId}
              playerName={item.playerName}
              playerDetailsById={playerDetailsById}
              currentPositionRankById={currentPositionRankById}
              waiverIntelligence={waiverIntelligence}
              managerName={managerName}
              managerAvatars={managerAvatars}
              leagueValueMode={leagueValueMode}
              rankings={rankings}
              onSelectPlayer={onSelectPlayer}
            />
          ))}
          {pickLabels.map(pickLabel => (
            <div
              key={`${label || "asset"}:pick:${pickLabel}`}
              className="player-team-tile rounded-2xl border border-amber-300/20 bg-amber-950/20 p-3"
            >
              <p className="text-sm font-black text-amber-100">{pickLabel}</p>
              <p className="mt-2 text-[0.65rem] font-black uppercase tracking-[0.16em] text-amber-200">
                Draft pick
              </p>
            </div>
          ))}
        </div>
      ) : (
        <span className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-sm text-slate-400">
          {emptyLabel}
        </span>
      )}
    </div>
  );
}

function PendingTradeSides({
  signal,
  playerDetailsById,
  currentPositionRankById,
  waiverIntelligence,
  leagueValueMode,
  managerAvatars,
  rankings,
  onSelectPlayer,
}: {
  signal: TradeProposalSignal;
  playerDetailsById?: ReportData["playerDetailsById"];
  currentPositionRankById?: ReportData["currentPositionRankById"];
  waiverIntelligence?: ReportData["waiverIntelligence"];
  leagueValueMode: ReportData["leagueValueMode"];
  managerAvatars?: ReportData["managerAvatars"];
  rankings?: ReportData["rankings"];
  onSelectPlayer: (player: PlayerModalData) => void;
}) {
  const sides = signal.tradeSides || [];
  if (!sides.length) {
    const fallbackManagers = signal.managers || [];
    if (fallbackManagers.length > 0) {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          {fallbackManagers.map((manager, index) => {
            const playerId = signal.playerIds?.[index] || null;
            const playerName = signal.playerNames?.[index] || null;
            return (
              <div
                key={`${signal.id}:${manager}`}
                className="rounded-2xl border border-white/10 bg-slate-950/45 p-3"
              >
                <ManagerActivityChip
                  manager={manager}
                  managerAvatars={managerAvatars}
                  verb="Sends"
                />
                <div className="mt-3">
                  <PendingPlayerAssetGrid
                    label=""
                    playerIds={playerId ? [playerId] : []}
                    playerNames={playerName ? [playerName] : []}
                    pickLabels={index === 0 ? signal.pickLabels || [] : []}
                    playerDetailsById={playerDetailsById}
                    currentPositionRankById={currentPositionRankById}
                    waiverIntelligence={waiverIntelligence}
                    managerName={manager}
                    managerAvatars={managerAvatars}
                    leagueValueMode={leagueValueMode}
                    rankings={rankings}
                    onSelectPlayer={onSelectPlayer}
                  />
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <PendingPlayerAssetGrid
        label=""
        playerIds={signal.playerIds || []}
        playerNames={signal.playerNames || []}
        pickLabels={signal.pickLabels || []}
        playerDetailsById={playerDetailsById}
        currentPositionRankById={currentPositionRankById}
        waiverIntelligence={waiverIntelligence}
        managerName={signal.managers?.[0] || null}
        managerAvatars={managerAvatars}
        leagueValueMode={leagueValueMode}
        rankings={rankings}
        onSelectPlayer={onSelectPlayer}
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {sides.map(side => {
        const outgoingSides = sides.filter(otherSide => otherSide.manager !== side.manager);
        const outgoingPlayerIds = outgoingSides.flatMap(otherSide => otherSide.playerIds || []);
        const outgoingPlayerNames = outgoingSides.flatMap(otherSide => otherSide.playerNames || []);
        const outgoingPickLabels = outgoingSides.flatMap(otherSide => otherSide.pickLabels || []);
        return (
        <div
          key={`${signal.id}:${side.manager}`}
          className="rounded-2xl border border-white/10 bg-slate-950/45 p-3"
        >
          <ManagerActivityChip
            manager={side.manager}
            managerAvatars={managerAvatars}
            verb="Sends"
          />
          <div className="mt-3">
            <PendingPlayerAssetGrid
              label=""
              playerIds={outgoingPlayerIds}
              playerNames={outgoingPlayerNames}
              pickLabels={outgoingPickLabels}
              playerDetailsById={playerDetailsById}
              currentPositionRankById={currentPositionRankById}
              waiverIntelligence={waiverIntelligence}
              managerName={side.manager}
              managerAvatars={managerAvatars}
              leagueValueMode={leagueValueMode}
              rankings={rankings}
              onSelectPlayer={onSelectPlayer}
            />
          </div>
        </div>
        );
      })}
    </div>
  );
}

function PendingSleeperActivityList({
  signals,
  onViewInTradeWarRoom,
  playerDetailsById,
  currentPositionRankById,
  waiverIntelligence,
  leagueValueMode,
  managerAvatars,
  rankings,
  onSelectPlayer,
}: {
  signals: TradeProposalSignal[];
  onViewInTradeWarRoom: (signal: TradeProposalSignal) => void;
  playerDetailsById?: ReportData["playerDetailsById"];
  currentPositionRankById?: ReportData["currentPositionRankById"];
  waiverIntelligence?: ReportData["waiverIntelligence"];
  leagueValueMode: ReportData["leagueValueMode"];
  managerAvatars?: ReportData["managerAvatars"];
  rankings?: ReportData["rankings"];
  onSelectPlayer: (player: PlayerModalData) => void;
}) {
  if (!signals.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm text-slate-300">
        No live pending Sleeper trades or waiver claims are imported right now.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {signals.map(signal => {
        const kind = getPendingActivityKind(signal);
        const isWaiver = kind === "waiver";
        const adds = signal.waiverAdds?.playerNames?.length
          ? signal.waiverAdds.playerNames
          : signal.playerNames || [];
        const drops = signal.waiverDrops?.playerNames || [];
        return (
          <article
            key={`${signal.id}:${signal.date}`}
            className="overflow-hidden rounded-2xl border border-cyan-300/15 bg-slate-950/45 shadow-[0_18px_60px_rgba(8,47,73,0.20)]"
          >
            <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.035] p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em] ${
                    isWaiver
                      ? "border border-sky-300/25 bg-sky-300/10 text-sky-100"
                      : "border border-orange-300/25 bg-orange-300/10 text-orange-100"
                  }`}>
                    {isWaiver ? "Waiver claim" : "Trade offer"}
                  </span>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em] text-emerald-100">
                    {signal.status || "Pending"}
                  </span>
                  {isWaiver && typeof signal.waiverBid === "number" ? (
                    <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em] text-sky-100">
                      Bid {signal.waiverBid.toLocaleString()} FAAB
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-300">
                  {formatPendingActivityDate(signal.date)}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => onViewInTradeWarRoom(signal)}
                className="h-10 bg-cyan-300 text-slate-950 hover:bg-cyan-200"
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                View in Trade War Room
              </Button>
            </div>
            <div className="p-4">
              {isWaiver ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-sky-300/15 bg-sky-950/20 p-3">
                    <ManagerActivityChip
                      manager={signal.managers?.[0] || "Manager"}
                      managerAvatars={managerAvatars}
                      verb="Claims"
                    />
                    <div className="mt-3">
                    <PendingPlayerAssetGrid
                      label=""
                      playerIds={signal.waiverAdds?.playerIds || signal.playerIds || []}
                      playerNames={adds}
                      playerDetailsById={playerDetailsById}
                      currentPositionRankById={currentPositionRankById}
                      waiverIntelligence={waiverIntelligence}
                      managerName={signal.managers?.[0] || null}
                      managerAvatars={managerAvatars}
                      leagueValueMode={leagueValueMode}
                      rankings={rankings}
                      onSelectPlayer={onSelectPlayer}
                    />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-rose-300/15 bg-rose-950/10 p-3">
                    <ManagerActivityChip
                      manager={signal.managers?.[0] || "Manager"}
                      managerAvatars={managerAvatars}
                      verb="Drops"
                    />
                    <div className="mt-3">
                    <PendingPlayerAssetGrid
                      label=""
                      playerIds={signal.waiverDrops?.playerIds || []}
                      playerNames={drops}
                      emptyLabel="No drop attached"
                      playerDetailsById={playerDetailsById}
                      currentPositionRankById={currentPositionRankById}
                      waiverIntelligence={waiverIntelligence}
                      managerName={signal.managers?.[0] || null}
                      managerAvatars={managerAvatars}
                      leagueValueMode={leagueValueMode}
                      rankings={rankings}
                      onSelectPlayer={onSelectPlayer}
                    />
                    </div>
                  </div>
                </div>
              ) : (
                <PendingTradeSides
                  signal={signal}
                  playerDetailsById={playerDetailsById}
                  currentPositionRankById={currentPositionRankById}
                  waiverIntelligence={waiverIntelligence}
                  leagueValueMode={leagueValueMode}
                  managerAvatars={managerAvatars}
                  rankings={rankings}
                  onSelectPlayer={onSelectPlayer}
                />
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

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
    sourceType: "waiver",
    waiverAdds: {
      playerIds: signal.playerIds || [],
      playerNames: signal.playerNames || [],
    },
    waiverDrops: {
      playerIds: signal.dropPlayerIds || [],
      playerNames: signal.dropPlayerNames || [],
    },
    waiverBid: signal.bidAmount,
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
  showPendingSleeperActivity,
  onScoutLeaguemates,
  leagueId,
  leagueLogo,
  leagueValueMode,
  effectiveViewerManager,
  rankingsForReport,
  tradeWarKicker,
  showTradeMarketRadar,
  onImportSleeperTradeCenterSnapshot,
  isImportingSleeperTradeCenterSnapshot,
  TradeBrowserRead,
  TradeMarketRadar,
  TradeWarRoom,
  TradeProfitLeaderboardTable,
  TradeTheftDetector,
  TradeHistoryTable,
}: ReportTradesTabProps) {
  const [helperSnapshot, setHelperSnapshot] =
    useState<SleeperExtensionTradeCenterSnapshot | null>(null);
  const [helperDetected, setHelperDetected] = useState(false);
  const [helperStatus, setHelperStatus] = useState<string | null>(null);
  const [helperError, setHelperError] = useState<string | null>(null);
  const [isHelperCaptureRunning, setIsHelperCaptureRunning] = useState(false);
  const [isHelperSuccessCollapsed, setIsHelperSuccessCollapsed] = useState(false);
  const [tradeWarRoomOpenSignal, setTradeWarRoomOpenSignal] = useState(0);
  const [tradeWarRoomSignal, setTradeWarRoomSignal] =
    useState<TradeProposalSignal | null>(null);
  const [selectedPendingPlayer, setSelectedPendingPlayer] =
    useState<PlayerModalData | null>(null);
  const tradeWarRoomRef = useRef<HTMLDivElement | null>(null);
  const autoImportPendingRef = useRef(false);
  const helperImportTimeoutRef = useRef<number | null>(null);
  const hasImportedSleeperActivity =
    Boolean(reportData.sleeperHiddenLeagueSnapshot) ||
    Boolean(reportData.adminSleeperTradeProposalSignals?.length) ||
    Boolean(reportData.adminSleeperWaiverSignals?.length);

  const showSleeperPendingActivity = showPendingSleeperActivity;

  const pendingTradeSignals = useMemo(
    () => {
      if (!showSleeperPendingActivity) return [];

      const sleeperImportedSignals = [
        ...(reportData.adminSleeperTradeProposalSignals || []),
        ...(reportData.adminSleeperWaiverSignals || []).map(
          mapWaiverSignalToTradeProposalSignal
        ),
      ];

      const publicFallbackSignals = [
        ...(reportData.adminTradeProposalSignals || []),
        ...(reportData.tradeProposalSignals || []),
      ];

      return dedupeTradeProposalSignals(
        hasImportedSleeperActivity
          ? sleeperImportedSignals
          : [...sleeperImportedSignals, ...publicFallbackSignals]
      ).filter(isPendingTradeProposalSignal);
    },
    [
      reportData.adminSleeperTradeProposalSignals,
      reportData.adminTradeProposalSignals,
      reportData.adminSleeperWaiverSignals,
      reportData.tradeProposalSignals,
      hasImportedSleeperActivity,
      showSleeperPendingActivity,
    ]
  );

  const warRoomProposalSignals = showSleeperPendingActivity ? pendingTradeSignals : [];
  const helperTransactionCount = helperSnapshot?.transactions.length ?? 0;
  const helperTradeCount =
    helperSnapshot?.transactions.filter(transaction => transaction.type === "trade")
      .length ?? 0;
  const helperWaiverCount =
    helperSnapshot?.transactions.filter(transaction => transaction.type === "waiver")
      .length ?? 0;
  const isHelperImporting =
    isHelperCaptureRunning || isImportingSleeperTradeCenterSnapshot;

  const clearHelperImportTimeout = useCallback(() => {
    if (helperImportTimeoutRef.current === null) return;
    window.clearTimeout(helperImportTimeoutRef.current);
    helperImportTimeoutRef.current = null;
  }, []);

  const startHelperImportTimeout = useCallback(() => {
    clearHelperImportTimeout();
    helperImportTimeoutRef.current = window.setTimeout(() => {
      helperImportTimeoutRef.current = null;
      autoImportPendingRef.current = false;
      setIsHelperCaptureRunning(false);
      setIsHelperSuccessCollapsed(false);
      setHelperStatus(null);
      setHelperError(
        "Still waiting on Sleeper. Refresh the Sleeper Trades and Players/Waivers tabs, then click Import Pending Transactions again."
      );
    }, SLEEPER_HELPER_IMPORT_TIMEOUT_MS);
  }, [clearHelperImportTimeout]);

  const importCapturedSnapshot = useCallback(
    async (
      snapshot: SleeperExtensionTradeCenterSnapshot,
      options: { automatic?: boolean } = {}
    ) => {
      clearHelperImportTimeout();
      setIsHelperSuccessCollapsed(false);
      setHelperError(null);
      setHelperStatus(
        options.automatic
          ? "Importing pending Sleeper trades and waivers..."
          : "Importing captured Sleeper snapshot..."
      );

      try {
        const result = await onImportSleeperTradeCenterSnapshot(snapshot);
        setHelperStatus(
          result.transactionCount > 0
            ? `Imported ${pluralizeImportCount(result.tradeCount, "pending trade")} and ${pluralizeImportCount(result.waiverCount, "waiver claim")} from Sleeper.`
            : "Sleeper connected, but there are no pending trade or waiver items right now."
        );
        setIsHelperSuccessCollapsed(result.transactionCount > 0);
      } catch (error: unknown) {
        setIsHelperSuccessCollapsed(false);
        setHelperStatus(null);
        setHelperError(
          error instanceof Error
            ? error.message
            : "Could not import the Sleeper snapshot."
        );
      } finally {
        setIsHelperCaptureRunning(false);
      }
    },
    [clearHelperImportTimeout, onImportSleeperTradeCenterSnapshot]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!showSleeperPendingActivity) return;

    const handleHelperMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const message = event.data;
      if (!message || message.source !== SLEEPER_HELPER_EXTENSION_SOURCE) return;

      if (message.type === "DYNASTY_DEGENS_SLEEPER_HELPER_READY") {
        setHelperDetected(true);
        return;
      }

      if (message.type === "DYNASTY_DEGENS_SLEEPER_HELPER_STATUS") {
        setHelperDetected(true);
        const payload = message.payload as { status?: string; detail?: string } | null;
        if (payload?.status === "error") {
          clearHelperImportTimeout();
          autoImportPendingRef.current = false;
          setIsHelperCaptureRunning(false);
          setIsHelperSuccessCollapsed(false);
          setHelperStatus(null);
          setHelperError(payload.detail || "Transaction Sync could not import transactions.");
          return;
        }
        if (payload?.detail) {
          setHelperError(null);
          setHelperStatus(payload.detail);
        }
        return;
      }

      if (message.type !== "DYNASTY_DEGENS_SLEEPER_SNAPSHOT") return;

      const payload = message.payload as SleeperExtensionTradeCenterSnapshot | null;
      if (
        !payload ||
        payload.source !== "chrome-extension" ||
        !Array.isArray(payload.transactions)
      ) {
        clearHelperImportTimeout();
        autoImportPendingRef.current = false;
        setIsHelperCaptureRunning(false);
        setIsHelperSuccessCollapsed(false);
        setHelperError("Transaction Sync sent an invalid snapshot.");
        return;
      }

      if (payload.leagueId !== leagueId) {
        clearHelperImportTimeout();
        autoImportPendingRef.current = false;
        setIsHelperCaptureRunning(false);
        setIsHelperSuccessCollapsed(false);
        setHelperSnapshot(null);
        setHelperError(
          `Transaction Sync captured league ${payload.leagueId}, but this report is ${leagueId}.`
        );
        return;
      }

      setHelperSnapshot(payload);
      setHelperDetected(true);
      setHelperError(null);
      clearHelperImportTimeout();

      if (autoImportPendingRef.current) {
        autoImportPendingRef.current = false;
        void importCapturedSnapshot(payload, { automatic: true });
        return;
      }

      setIsHelperCaptureRunning(false);
      setHelperStatus(
        payload.transactions.length > 0
          ? `Transaction Sync captured ${pluralizeImportCount(payload.transactions.length, "pending item")}. Click Import Pending Transactions to import it.`
          : "Transaction Sync connected, but the Sleeper page did not expose pending trades or waivers."
      );
    };

    window.addEventListener("message", handleHelperMessage);
    window.postMessage(
      {
        source: SLEEPER_HELPER_APP_SOURCE,
        type: "DYNASTY_DEGENS_REQUEST_SLEEPER_HELPER_STATUS",
      },
      window.location.origin
    );

    return () => {
      window.removeEventListener("message", handleHelperMessage);
      clearHelperImportTimeout();
    };
  }, [clearHelperImportTimeout, importCapturedSnapshot, leagueId, showSleeperPendingActivity]);

  const importHelperSnapshot = async () => {
    if (!helperDetected) {
      setHelperError(
        "Transaction Sync is not installed or enabled yet. Enable the extension, refresh this page, then click Import Pending Transactions again."
      );
      return;
    }

    autoImportPendingRef.current = true;
    setHelperError(null);
    setIsHelperSuccessCollapsed(false);
    setIsHelperCaptureRunning(true);
    setHelperStatus("Opening Sleeper and importing pending transactions...");
    startHelperImportTimeout();
    window.postMessage(
      {
        source: SLEEPER_HELPER_APP_SOURCE,
        type: "DYNASTY_DEGENS_START_SLEEPER_IMPORT",
        payload: { leagueId },
      },
      window.location.origin
    );
  };

  const showHelperSuccessStrip =
    isHelperSuccessCollapsed &&
    Boolean(helperSnapshot) &&
    !isHelperImporting &&
    !helperError;

  const viewSignalInTradeWarRoom = (signal: TradeProposalSignal) => {
    setTradeWarRoomSignal(signal);
    setTradeWarRoomOpenSignal(Date.now());
    window.setTimeout(() => {
      tradeWarRoomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
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
{showSleeperPendingActivity ? (
        <CollapsibleReportSection
          title="Pending Trade Offers"
          kicker="Public proposal history plus imported Sleeper trade center activity"
          previewMetrics={buildTradeProposalPreviewMetrics(reportData)}
          premium
          defaultOpen
        >
          <div className={`mb-5 space-y-4 rounded-2xl border p-4 shadow-[0_24px_80px_rgba(16,185,129,0.10)] sm:p-5 ${
            showHelperSuccessStrip
              ? "border-emerald-300/15 bg-slate-950/45"
              : "border-emerald-300/20 bg-emerald-950/20"
          }`}>
            {showHelperSuccessStrip ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.22em] text-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Imported from Sleeper
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-200">
                    {pluralizeImportCount(helperTradeCount, "trade")}, {pluralizeImportCount(helperWaiverCount, "waiver claim")} updated just now.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsHelperSuccessCollapsed(false);
                    setHelperStatus(null);
                  }}
                  className="h-10 border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20"
                >
                  Import again
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.22em] text-emerald-200">
                      <Cable className="h-3.5 w-3.5" aria-hidden="true" />
                      Transaction Sync
                    </p>
                    <h3 className="text-base font-black text-slate-50 sm:text-lg">
                      Import pending Sleeper trades and waivers
                    </h3>
                    <p className="max-w-3xl text-sm leading-6 text-slate-300">
                      Click once. Transaction Sync opens Sleeper, captures only
                      sanitized pending transaction data, and imports it back into this
                      report.
                    </p>
                  </div>
                </div>
            <div className={`rounded-xl border p-3 text-sm text-slate-300 transition-colors ${
              isHelperImporting
                ? "border-cyan-300/25 bg-cyan-950/20 shadow-[0_0_36px_rgba(34,211,238,0.12)]"
                : "border-white/10 bg-slate-950/40"
            }`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-100">
                    {isHelperImporting
                      ? "Importing pending transactions"
                      : helperSnapshot
                      ? `Captured ${helperTransactionCount} pending item${helperTransactionCount === 1 ? "" : "s"}`
                      : helperDetected
                        ? "Transaction Sync detected"
                        : "Waiting for Transaction Sync"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {isHelperImporting
                      ? "Sleeper sync in progress. Keep this tab open while the helper captures trades and waivers."
                      : helperSnapshot
                      ? `${helperTradeCount} trades, ${helperWaiverCount} waiver claims captured ${new Date(helperSnapshot.capturedAt).toLocaleString()}.`
                      : helperDetected
                        ? "Ready. The helper will open Sleeper, refresh the right pages, and import the latest pending snapshot."
                        : "Install or reload Transaction Sync in Chrome Extensions, then click this button again."}
                  </p>
                  {isHelperImporting ? (
                    <div className="mt-3 max-w-sm" aria-hidden="true">
                      <div className="loading-progress-bar-wrap !mt-0">
                        <div className="loading-progress-fill" style={{ width: "76%" }}>
                          <span className="loading-progress-shimmer" />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  onClick={importHelperSnapshot}
                  disabled={isHelperImporting}
                  className={`h-10 text-slate-950 disabled:opacity-80 ${
                    isHelperImporting
                      ? "bg-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.22)] hover:bg-cyan-300"
                      : "bg-emerald-300 hover:bg-emerald-200"
                  }`}
                >
                  {isHelperImporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Import Pending Transactions
                </Button>
              </div>
              {helperStatus ? (
                <p className={`mt-3 rounded-xl border px-3 py-2 text-sm font-semibold ${
                  isHelperImporting
                    ? "border-cyan-300/25 bg-cyan-950/35 text-cyan-100"
                    : "border-emerald-300/20 bg-emerald-950/30 text-emerald-200"
                }`}>
                  {helperStatus}
                </p>
              ) : null}
              {helperError ? (
                <p className={`mt-3 rounded-xl border px-3 py-2 text-sm font-semibold ${
                  helperError.startsWith("Still waiting")
                    ? "border-amber-300/20 bg-amber-950/30 text-amber-100"
                    : "border-rose-300/20 bg-rose-950/30 text-rose-200"
                }`}>
                  {helperError}
                </p>
              ) : null}
            </div>
              </>
            )}
          </div>
          <PendingSleeperActivityList
            signals={pendingTradeSignals}
            onViewInTradeWarRoom={viewSignalInTradeWarRoom}
            playerDetailsById={reportData.playerDetailsById}
            currentPositionRankById={reportData.currentPositionRankById}
            waiverIntelligence={reportData.waiverIntelligence}
            leagueValueMode={leagueValueMode}
            managerAvatars={reportData.managerAvatars}
            rankings={rankingsForReport}
            onSelectPlayer={setSelectedPendingPlayer}
          />
        </CollapsibleReportSection>
      ) : null}
      <PlayerDetailModal
        isOpen={selectedPendingPlayer !== null}
        onClose={() => setSelectedPendingPlayer(null)}
        pick={selectedPendingPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        managerAvatars={reportData.managerAvatars}
        playerDetailsById={reportData.playerDetailsById}
        leagueDiagnostics={reportData.leagueDiagnostics}
        calibrationProfile={reportData.aiCalibrationAdjustmentProfile}
        showAIRead={showManagerPersonalityIntel}
      />
      <div ref={tradeWarRoomRef}>
        <CollapsibleReportSection
          title="Trade War Room"
          kicker={tradeWarKicker}
          previewMetrics={buildTradePreviewMetrics(
            reportData,
            leagueValueMode,
            "war-room"
          )}
          openSignal={tradeWarRoomOpenSignal}
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
          initialProposalSignal={tradeWarRoomSignal}
        />
        </CollapsibleReportSection>
      </div>
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
