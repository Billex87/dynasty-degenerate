import type { ManagerStarterPlayer, ReportData } from "@shared/types";

const STARTER_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
const BLOCKED_VISIBLE_NAME_KEYS = new Set(["dallenbentley", "dallasbentley"]);

type WaiverPlayerLike = {
  player_id?: string | null;
  name?: string | null;
  playerDetails?: {
    fullName?: string | null;
  } | null;
};

type WaiverIdentitySet = {
  ids: Set<string>;
  names: Set<string>;
};

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeLineupPosition(value?: string | null): string {
  const normalized = String(value || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (["DST", "D", "DEFENSE"].includes(normalized)) return "DEF";
  if (normalized === "PK") return "K";
  if (["SUPERFLEX", "QBSF", "OP"].includes(normalized)) return "SUPER_FLEX";
  if (["WRT", "WRRBT", "WRRBTE"].includes(normalized)) return "FLEX";
  return normalized;
}

function canFillStarterSlot(player: ManagerStarterPlayer, slot: string): boolean {
  const position = normalizeLineupPosition(player.pos);
  const normalizedSlot = normalizeLineupPosition(slot);
  if (normalizedSlot === "FLEX") return ["RB", "WR", "TE"].includes(position);
  if (normalizedSlot === "SUPER_FLEX") return ["QB", "RB", "WR", "TE"].includes(position);
  return STARTER_POSITIONS.has(normalizedSlot) && position === normalizedSlot;
}

function playerKey(player: Pick<ManagerStarterPlayer, "player_id" | "name">): string {
  return player.player_id || String(player.name || "").trim().toLowerCase();
}

function cleanNameKey(value?: string | null): string {
  return String(value || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function omittedWaiverIdentities(reportData: ReportData): WaiverIdentitySet {
  const omittedCandidates = asArray(reportData.waiverIntelligence?.omittedCandidates)
    .filter(candidate => candidate.action === "omit");
  return {
    ids: new Set(
      omittedCandidates
        .map(candidate => candidate.player_id)
        .filter((playerId): playerId is string => Boolean(playerId))
    ),
    names: new Set([
      ...omittedCandidates.map(candidate => cleanNameKey(candidate.name)).filter(Boolean),
      ...Array.from(BLOCKED_VISIBLE_NAME_KEYS),
    ]),
  };
}

function isOmittedWaiverPlayer(
  player: WaiverPlayerLike,
  omitted: WaiverIdentitySet
): boolean {
  if (player.player_id && omitted.ids.has(player.player_id)) return true;
  const nameKey = cleanNameKey(player.name || player.playerDetails?.fullName || null);
  return Boolean(nameKey && omitted.names.has(nameKey));
}

function withoutOmittedPlayers<T extends WaiverPlayerLike>(
  players: T[] | null | undefined,
  omitted: WaiverIdentitySet
): T[] {
  return asArray(players).filter(player => !isOmittedWaiverPlayer(player, omitted));
}

function sanitizeWaiverIntelligence(reportData: ReportData): ReportData {
  const waiver = reportData.waiverIntelligence;
  if (!waiver) return reportData;

  const omitted = omittedWaiverIdentities(reportData);
  if (!omitted.ids.size && !omitted.names.size) return reportData;

  const highestKtcAvailable = waiver.highestKtcAvailable && isOmittedWaiverPlayer(waiver.highestKtcAvailable, omitted)
    ? null
    : waiver.highestKtcAvailable;
  const bestAvailableByPosition = Object.fromEntries(
    Object.entries(waiver.bestAvailableByPosition || {}).map(([position, player]) => [
      position,
      player && isOmittedWaiverPlayer(player, omitted) ? null : player,
    ])
  ) as typeof waiver.bestAvailableByPosition;

  return {
    ...reportData,
    trendingAdds: withoutOmittedPlayers(reportData.trendingAdds, omitted),
    waiverIntelligence: {
      ...waiver,
      availableTrendingAdds: withoutOmittedPlayers(waiver.availableTrendingAdds, omitted),
      highestKtcAvailable,
      bestAvailableByPosition,
      bestTaxiStashes: withoutOmittedPlayers(waiver.bestTaxiStashes, omitted),
      recentlyDroppedValuable: withoutOmittedPlayers(waiver.recentlyDroppedValuable, omitted),
    },
  };
}

function sanitizeStarterGroups(reportData: ReportData): ReportData {
  if (!reportData.managerPositionCounts?.length) return reportData;

  let changed = false;
  const managerPositionCounts = reportData.managerPositionCounts.map(row => {
    if (!row.starterGroups?.length) return row;

    const usedPlayerKeys = new Set<string>();
    const starterPool = asArray(row.starterPlayers).filter(player => {
      const key = playerKey(player);
      return key && !usedPlayerKeys.has(key);
    });

    const starterGroups = row.starterGroups.map(group => {
      const targetCount = Math.max(0, Number(group.count || 0));
      let players = asArray(group.players);
      players.forEach(player => {
        const key = playerKey(player);
        if (key) usedPlayerKeys.add(key);
      });

      if (players.length < targetCount && starterPool.length) {
        const fillPlayers = starterPool.filter(player => {
          const key = playerKey(player);
          return key && !usedPlayerKeys.has(key) && canFillStarterSlot(player, group.key);
        });
        for (const player of fillPlayers) {
          if (players.length >= targetCount) break;
          players = [...players, player];
          usedPlayerKeys.add(playerKey(player));
        }
      }

      if (players.length !== asArray(group.players).length || group.count !== players.length) {
        changed = true;
        return {
          ...group,
          count: players.length,
          players,
        };
      }

      return group;
    });

    return starterGroups === row.starterGroups ? row : { ...row, starterGroups };
  });

  return changed ? { ...reportData, managerPositionCounts } : reportData;
}

export function sanitizeCachedReportData(reportData: ReportData): ReportData {
  return sanitizeStarterGroups(sanitizeWaiverIntelligence(reportData));
}

export function sanitizeCachedReport<T extends { reportData: ReportData }>(report: T): T {
  const reportData = sanitizeCachedReportData(report.reportData);
  return reportData === report.reportData ? report : { ...report, reportData };
}
