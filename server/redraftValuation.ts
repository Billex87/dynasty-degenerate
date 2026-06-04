import type {
  ManagerStarterPlayer,
  PlayerDetails,
  RedraftValuationRow,
  RedraftValuationSummary,
  ReportData,
  TrendingPlayer,
  WeeklyProjectionContext,
} from "../shared/types";

type RedraftPlayerLike = (ManagerStarterPlayer | TrendingPlayer) & {
  player_id?: string;
  name?: string;
  pos?: string;
  team?: string | null;
  owner?: string | null;
  ktcValue?: number | null;
  seasonValue?: number | null;
  value?: number | null;
  weeklyProjection?: WeeklyProjectionContext | null;
  playerDetails?: PlayerDetails;
};

const DEFAULT_ROW_LIMIT = 120;
const PROJECTION_VALUE_MULTIPLIER = 430;

type ReplacementBaseline = {
  playerId: string;
  name: string;
  position: string;
  value: number;
};

function round(value: number): number {
  return Math.round(value);
}

function asNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function getProjectionStatus(reportData: ReportData): RedraftValuationSummary["projectionStatus"] {
  return reportData.weeklyProjectionDiagnostics?.status || "missing";
}

function isProjectionReady(reportData: ReportData): boolean {
  return reportData.weeklyProjectionDiagnostics?.status === "ready" &&
    Number(reportData.weeklyProjectionDiagnostics.attachedPlayerCount || 0) > 0;
}

function getPlayerDetails(player: RedraftPlayerLike, reportData: ReportData): PlayerDetails | null {
  return player.playerDetails || (player.player_id ? reportData.playerDetailsById?.[player.player_id] : null) || null;
}

function getBaseValue(player: RedraftPlayerLike, details: PlayerDetails | null): number {
  return Math.max(
    0,
    round(
      asNumber(player.seasonValue) ??
      asNumber(details?.valueProfile?.seasonValue) ??
      asNumber(details?.valueProfile?.fantasyProsSeasonValue) ??
      asNumber(details?.valueProfile?.fantasyCalcRedraft) ??
      asNumber(player.ktcValue) ??
      asNumber(player.value) ??
      asNumber(details?.valueProfile?.dynastyValue) ??
      0
    )
  );
}

function getProjectionValue(player: RedraftPlayerLike, details: PlayerDetails | null, projectionReady: boolean): number | null {
  if (!projectionReady) return null;
  const projection = player.weeklyProjection || details?.weeklyProjection || null;
  if (projection?.status !== "ready") return null;
  return round(projection.projectedFantasyPoints * PROJECTION_VALUE_MULTIPLIER);
}

function getScheduleAdjustment(details: PlayerDetails | null): number {
  const tier = details?.schedule?.scheduleTier;
  if (tier === "elite") return 550;
  if (tier === "easy") return 325;
  if (tier === "hard") return -325;
  return 0;
}

function getByeAdjustment(details: PlayerDetails | null, currentWeek?: number | null): number {
  const byeWeek = asNumber(details?.schedule?.byeWeek);
  const week = asNumber(currentWeek);
  if (!byeWeek || !week) return 0;
  if (byeWeek < week) return 0;
  if (byeWeek <= week + 2) return -275;
  if (byeWeek <= week + 5) return -125;
  return 0;
}

function getRoleAdjustment(details: PlayerDetails | null): number {
  const usage = details?.usageTrend;
  const situation = details?.playerSituationDelta;
  let adjustment = 0;

  if (usage?.targetTrend === "up") adjustment += 180;
  if (usage?.carryTrend === "up") adjustment += 160;
  if (usage?.targetTrend === "down") adjustment -= 160;
  if (usage?.carryTrend === "down") adjustment -= 140;
  if (asNumber(usage?.recentTargets) !== null && Number(usage?.recentTargets) >= 24) adjustment += 120;
  if (asNumber(usage?.recentCarries) !== null && Number(usage?.recentCarries) >= 36) adjustment += 120;

  if (situation?.action === "buy") adjustment += Math.round(Math.min(220, Math.max(0, situation.score || 0) * 2));
  if (situation?.action === "sell") adjustment -= Math.round(Math.min(220, Math.max(0, situation.score || 0) * 2));

  return adjustment;
}

function normalizePosition(position?: string | null): string {
  const normalized = String(position || "").trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  return normalized || "UNK";
}

function normalizeStatus(value?: string | null): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getInjuryNewsAdjustment(details: PlayerDetails | null): { adjustment: number; note: string | null } {
  if (!details) return { adjustment: 0, note: null };
  const statuses = [
    details.injuryStatus,
    details.status,
    details.rosterStatus,
    details.displayStatus,
  ].map(normalizeStatus).filter(Boolean);
  let adjustment = 0;
  const notes: string[] = [];

  if (statuses.some(status => ["OUT", "IR", "INJURED RESERVE", "PUP", "PHYSICALLY UNABLE", "NFI", "NON FOOTBALL INJURY", "SUSPENDED"].includes(status))) {
    adjustment -= 1400;
    notes.push("hard availability status");
  } else if (statuses.some(status => status.includes("DOUBTFUL"))) {
    adjustment -= 750;
    notes.push("doubtful availability status");
  } else if (statuses.some(status => status.includes("QUESTIONABLE") || status === "Q")) {
    adjustment -= 325;
    notes.push("questionable availability status");
  }

  for (const signal of details.playerSituationDelta?.dynamicSignals || []) {
    if (signal.type !== "injury" && signal.type !== "news") continue;
    if (signal.direction === "risk") {
      adjustment -= 250;
      notes.push(signal.label || `${signal.type} risk`);
    }
    if (signal.direction === "boost") {
      adjustment += 100;
      notes.push(signal.label || `${signal.type} boost`);
    }
  }

  if ((details.playerSituationDelta?.cautionFlags || []).some(flag => /injur|news|status|questionable|doubtful|limited/i.test(flag))) {
    adjustment -= 150;
    notes.push("situation caution flag");
  }

  const capped = Math.max(-1600, Math.min(250, adjustment));
  return {
    adjustment: capped,
    note: capped ? `Availability/news adjustment from ${notes.slice(0, 3).join(", ")}.` : null,
  };
}

function isAvailablePlayer(player: RedraftPlayerLike): boolean {
  const owner = String(player.owner || "").trim();
  return !owner || /^available$/i.test(owner);
}

function collectWaiverReplacementPlayers(reportData: ReportData): RedraftPlayerLike[] {
  const waiver = reportData.waiverIntelligence;
  if (!waiver) return [];
  const omittedIds = new Set((waiver.omittedCandidates || []).map(candidate => candidate.player_id).filter(Boolean));
  const candidates = [
    waiver.highestKtcAvailable,
    ...Object.values(waiver.bestAvailableByPosition || {}),
    ...(waiver.availableTrendingAdds || []),
    ...(waiver.recentlyDroppedValuable || []),
    ...(waiver.weeklyEcrTargets || []).map(target => target.player),
  ];
  const players: RedraftPlayerLike[] = [];
  for (const candidate of candidates) {
    if (!candidate || omittedIds.has(candidate.player_id || "")) continue;
    players.push({ ...(candidate as RedraftPlayerLike), owner: candidate.owner || null });
  }
  return players;
}

function buildReplacementBaselines(reportData: ReportData): Map<string, ReplacementBaseline> {
  const baselines = new Map<string, ReplacementBaseline>();
  for (const player of collectWaiverReplacementPlayers(reportData)) {
    const details = getPlayerDetails(player, reportData);
    const value = getBaseValue(player, details);
    if (value <= 0) continue;
    const position = normalizePosition(player.pos || details?.position);
    const existing = baselines.get(position);
    if (!existing || value > existing.value) {
      baselines.set(position, {
        playerId: player.player_id || details?.playerId || "",
        name: player.name || details?.fullName || player.player_id || "Available player",
        position,
        value,
      });
    }
  }
  return baselines;
}

function getReplacementAdjustment(input: {
  player: RedraftPlayerLike;
  details: PlayerDetails | null;
  baseValue: number;
  replacementBaselines: Map<string, ReplacementBaseline>;
}): { adjustment: number; note: string | null } {
  const position = normalizePosition(input.player.pos || input.details?.position);
  const baseline = input.replacementBaselines.get(position);
  if (!baseline || input.baseValue <= 0) return { adjustment: 0, note: null };

  if (isAvailablePlayer(input.player)) {
    const edge = input.baseValue - baseline.value;
    if (edge >= 400) {
      return { adjustment: 325, note: `${input.player.name || input.details?.fullName || "Player"} clears available ${position} replacement level by ${edge}.` };
    }
    if (edge >= -250) {
      return { adjustment: 175, note: `${input.player.name || input.details?.fullName || "Player"} is near the top available ${position} replacement level.` };
    }
    return { adjustment: 0, note: null };
  }

  const replacementGap = input.baseValue - baseline.value;
  if (replacementGap <= 250) {
    return { adjustment: -375, note: `${baseline.name} is a near-equivalent available ${position} replacement.` };
  }
  if (replacementGap <= 750) {
    return { adjustment: -225, note: `${baseline.name} is a viable available ${position} replacement within ${replacementGap} value.` };
  }
  if (replacementGap <= 1250) {
    return { adjustment: -100, note: `${baseline.name} keeps ${position} replacement pressure in range.` };
  }
  return { adjustment: 0, note: null };
}

function getBlendValue(input: {
  baseValue: number;
  projectionValue: number | null;
  scheduleAdjustment: number;
  byeAdjustment: number;
  roleAdjustment: number;
  injuryAdjustment: number;
  replacementAdjustment: number;
  projectionReady: boolean;
}): number {
  if (!input.projectionReady) return input.baseValue;
  const blendedCore = input.projectionValue === null
    ? input.baseValue
    : input.baseValue * 0.62 + input.projectionValue * 0.38;
  return Math.max(
    0,
    round(
      blendedCore +
      input.scheduleAdjustment +
      input.byeAdjustment +
      input.roleAdjustment +
      input.injuryAdjustment +
      input.replacementAdjustment
    )
  );
}

function getConfidence(input: {
  projectionReady: boolean;
  projectionValue: number | null;
  scheduleAdjustment: number;
  roleAdjustment: number;
  injuryAdjustment: number;
  replacementAdjustment: number;
  baseValue: number;
}): number {
  return Math.min(
    92,
    Math.round(
      44 +
      (input.baseValue > 0 ? 12 : 0) +
      (input.projectionReady && input.projectionValue !== null ? 22 : 0) +
      (input.scheduleAdjustment !== 0 ? 7 : 0) +
      (input.roleAdjustment !== 0 ? 7 : 0) +
      (input.injuryAdjustment !== 0 ? 5 : 0) +
      (input.replacementAdjustment !== 0 ? 5 : 0)
    )
  );
}

function getSourceCount(input: {
  baseValue: number;
  projectionValue: number | null;
  scheduleAdjustment: number;
  byeAdjustment: number;
  roleAdjustment: number;
  injuryAdjustment: number;
  replacementAdjustment: number;
}): number {
  return [
    input.baseValue > 0,
    input.projectionValue !== null,
    input.scheduleAdjustment !== 0,
    input.byeAdjustment !== 0,
    input.roleAdjustment !== 0,
    input.injuryAdjustment !== 0,
    input.replacementAdjustment !== 0,
  ].filter(Boolean).length;
}

function getPlayerKey(player: RedraftPlayerLike): string | null {
  return player.player_id || (player.name ? `${player.name}:${player.pos || ""}` : null);
}

function collectPlayers(reportData: ReportData): RedraftPlayerLike[] {
  const byKey = new Map<string, RedraftPlayerLike>();
  const add = (player: RedraftPlayerLike | null | undefined, owner?: string | null) => {
    if (!player?.name && !player?.player_id) return;
    const key = getPlayerKey(player);
    if (!key || byKey.has(key)) return;
    byKey.set(key, owner && !player.owner ? { ...player, owner } : player);
  };

  for (const row of reportData.managerPositionCounts || []) {
    [...(row.starterPlayers || []), ...(row.lineupPlayers || []), ...(row.rosterPlayers || [])]
      .forEach(player => add(player, row.manager));
  }

  const waiver = reportData.waiverIntelligence;
  if (waiver) {
    [
      waiver.highestKtcAvailable,
      ...Object.values(waiver.bestAvailableByPosition || {}),
      ...(waiver.availableTrendingAdds || []),
      ...(waiver.recentlyDroppedValuable || []),
      ...(waiver.weeklyEcrTargets || []).map(target => target.player),
      ...(waiver.specialTeamsStreamerTargets || []).map(target => target.player),
      ...(waiver.defensePairingTargets || []).map(target => target.player),
    ].forEach(player => add(player as RedraftPlayerLike | null | undefined, null));
  }

  return Array.from(byKey.values());
}

function buildRow(
  player: RedraftPlayerLike,
  reportData: ReportData,
  projectionReady: boolean,
  replacementBaselines: Map<string, ReplacementBaseline>,
  currentWeek?: number | null
): RedraftValuationRow | null {
  const details = getPlayerDetails(player, reportData);
  const playerId = player.player_id || details?.playerId || "";
  const name = player.name || details?.fullName || playerId;
  const position = player.pos || details?.position || "UNK";
  if (!name || position === "PICK") return null;

  const baseValue = getBaseValue(player, details);
  const projectionValue = getProjectionValue(player, details, projectionReady);
  const scheduleAdjustment = projectionReady ? getScheduleAdjustment(details) : 0;
  const byeAdjustment = projectionReady ? getByeAdjustment(details, currentWeek) : 0;
  const roleAdjustment = projectionReady ? getRoleAdjustment(details) : 0;
  const injuryRead = projectionReady ? getInjuryNewsAdjustment(details) : { adjustment: 0, note: null };
  const replacementRead = projectionReady
    ? getReplacementAdjustment({ player, details, baseValue, replacementBaselines })
    : { adjustment: 0, note: null };
  const injuryAdjustment = injuryRead.adjustment;
  const replacementAdjustment = replacementRead.adjustment;
  const finalValue = getBlendValue({
    baseValue,
    projectionValue,
    scheduleAdjustment,
    byeAdjustment,
    roleAdjustment,
    injuryAdjustment,
    replacementAdjustment,
    projectionReady,
  });
  const status: RedraftValuationRow["status"] = !projectionReady
    ? "value-only"
    : projectionValue === null
      ? "partial"
      : "ready";

  return {
    playerId,
    name,
    position,
    team: player.team || details?.team || null,
    owner: player.owner || null,
    baseValue,
    projectionValue,
    scheduleAdjustment,
    byeAdjustment,
    roleAdjustment,
    injuryAdjustment,
    replacementAdjustment,
    finalValue,
    valueDelta: finalValue - baseValue,
    confidence: getConfidence({
      projectionReady,
      projectionValue,
      scheduleAdjustment,
      roleAdjustment,
      injuryAdjustment,
      replacementAdjustment,
      baseValue,
    }),
    status,
    sourceCount: getSourceCount({
      baseValue,
      projectionValue,
      scheduleAdjustment,
      byeAdjustment,
      roleAdjustment,
      injuryAdjustment,
      replacementAdjustment,
    }),
    components: [
      { key: "base-value", label: "Current-season value", value: baseValue, note: "Existing redraft/season value fallback." },
      projectionValue !== null
        ? { key: "weekly-projection", label: "Weekly projection", value: projectionValue, note: "Stored weekly projection converted to value scale." }
        : null,
      scheduleAdjustment
        ? { key: "schedule-sos", label: "Schedule/SOS", value: scheduleAdjustment, note: `${details?.schedule?.scheduleTier || "Neutral"} schedule tier adjustment.` }
        : null,
      byeAdjustment
        ? { key: "bye-context", label: "Bye timing", value: byeAdjustment, note: "Near-term bye timing adjustment." }
        : null,
      roleAdjustment
        ? { key: "role-trend", label: "Role trend", value: roleAdjustment, note: "Usage and situation trend adjustment." }
        : null,
      injuryAdjustment
        ? { key: "injury-news", label: "Injury/news", value: injuryAdjustment, note: injuryRead.note || "Availability and news status adjustment." }
        : null,
      replacementAdjustment
        ? { key: "replacement-level", label: "Replacement level", value: replacementAdjustment, note: replacementRead.note || "Same-position replacement availability adjustment." }
        : null,
    ].filter((component): component is RedraftValuationRow["components"][number] => Boolean(component)),
    note: status === "value-only"
      ? "Projection readiness failed; using existing current-season value fallback."
      : status === "partial"
        ? "No ready player projection attached; using current-season value plus available context."
        : "Blended from current-season value, stored weekly projection, schedule, bye, role, injury/news, and replacement-level context.",
  };
}

export function buildRedraftValuation(
  reportData: ReportData,
  options: {
    generatedAt?: string;
    currentWeek?: number | null;
    limit?: number;
  } = {}
): RedraftValuationSummary {
  const projectionReady = isProjectionReady(reportData);
  const projectionStatus = getProjectionStatus(reportData);
  const replacementBaselines = buildReplacementBaselines(reportData);
  const rows = collectPlayers(reportData)
    .map(player => buildRow(player, reportData, projectionReady, replacementBaselines, options.currentWeek ?? reportData.weeklyProjectionDiagnostics?.week ?? null))
    .filter((row): row is RedraftValuationRow => Boolean(row && row.baseValue > 0))
    .sort((a, b) => b.finalValue - a.finalValue || b.confidence - a.confidence)
    .slice(0, options.limit ?? DEFAULT_ROW_LIMIT);
  const readyCount = rows.filter(row => row.status === "ready").length;
  const status: RedraftValuationSummary["status"] = !projectionReady
    ? "value-only"
    : readyCount === rows.length && rows.length > 0
      ? "ready"
      : "partial";

  return {
    status,
    source: "stored-redraft-valuation",
    projectionStatus,
    generatedAt: options.generatedAt || new Date().toISOString(),
    rows,
    note: projectionReady
      ? "Redraft valuation blends existing current-season value with stored weekly projection, SOS, bye timing, role trend, injury/news status, and replacement-level context where available."
      : "Redraft valuation is using existing current-season value fallback because weekly projections are not ready.",
  };
}
