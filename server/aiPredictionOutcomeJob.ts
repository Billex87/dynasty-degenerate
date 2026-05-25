import type { AIPredictionEvent, AIPredictionOutcome } from './aiPredictionCalibration';
import {
  resolveAIPredictionOutcome,
  type AIPredictionOutcomeResolverContext,
  type AIPredictionResolvedPlayerStat,
  type AIPredictionResolvedTransaction,
  type AIPredictionResolvedValueMovement,
} from './aiPredictionOutcomeResolver';
import type { RecommendationStateSnapshot } from '../shared/recommendationOutcome';
import * as db from './db';
import * as userLoadPolicy from './loadTimeProviderPolicy';
import {
  getPlayerValueTimelineForPlayer,
  loadStoredValueTimelineSnapshotsForPlayers,
} from './playerValueTimeline';

type SleeperUser = {
  user_id?: string | number | null;
  display_name?: string | null;
  username?: string | null;
};

type SleeperRoster = {
  roster_id?: string | number | null;
  owner_id?: string | number | null;
  players?: string[] | null;
  starters?: string[] | null;
  reserve?: string[] | null;
  taxi?: string[] | null;
  metadata?: {
    team_name?: string | null;
  } | null;
};

type SleeperTransaction = {
  transaction_id?: string | number | null;
  type?: string | null;
  status?: string | null;
  adds?: Record<string, string | number | null> | null;
  drops?: Record<string, string | number | null> | null;
  roster_ids?: Array<string | number | null> | null;
  created?: string | number | null;
  status_updated?: string | number | null;
  settings?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  waiver_bid?: string | number | null;
  waiver_budget?: string | number | null;
  leg?: string | number | null;
};

type SleeperMatchup = {
  roster_id?: string | number | null;
  starters?: string[] | null;
  players_points?: Record<string, number | string | null> | null;
};

type LeagueOutcomeFacts = AIPredictionOutcomeResolverContext & {
  weeks: number[];
  transactionFactCount: number;
  playerStatFactCount: number;
  valueMovementFactCount: number;
  rosterStateFactCount: number;
};

export type AIPredictionOutcomeJobLeagueResult = {
  leagueId: string;
  eventCount: number;
  weeks: number[];
  transactionFactCount: number;
  playerStatFactCount: number;
  valueMovementFactCount: number;
  rosterStateFactCount: number;
  resolved: number;
  pending: number;
  failed: number;
  error?: string | null;
};

export type AIPredictionOutcomeJobResult = {
  ok: boolean;
  generatedAt: string;
  durationMs: number;
  scanned: number;
  resolved: number;
  pending: number;
  skipped: number;
  failed: number;
  leagues: AIPredictionOutcomeJobLeagueResult[];
};

function cleanText(value: unknown): string | null {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean || null;
}

function normalizeRosterId(value: unknown): string | null {
  const clean = cleanText(value);
  return clean ? clean : null;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function numeric(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

function getSleeperCurrentWeek(leagueInfo: any): number {
  const candidate = Number(leagueInfo?.leg ?? leagueInfo?.week ?? leagueInfo?.settings?.leg ?? 1);
  return Number.isFinite(candidate) && candidate > 0 ? Math.min(18, Math.floor(candidate)) : 1;
}

function getDateFromSleeperTimestamp(value: unknown): string | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const ms = parsed > 10_000_000_000 ? parsed : parsed * 1000;
  const date = new Date(ms);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function getDateKey(value: string | Date | null | undefined): string | null {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function daysBetweenDates(a: Date, b: Date): number {
  return Math.max(1, Math.ceil(Math.abs(b.getTime() - a.getTime()) / 86_400_000));
}

function getEventWeeks(events: AIPredictionEvent[], currentWeek: number): number[] {
  const weeks = new Set<number>();
  let hasWeeklessEvent = false;

  events.forEach((event) => {
    const week = Number(event.week);
    if (Number.isInteger(week) && week >= 1 && week <= 18) {
      weeks.add(week);
    } else {
      hasWeeklessEvent = true;
    }
  });

  if (hasWeeklessEvent) {
    weeks.add(Math.max(1, currentWeek));
    weeks.add(Math.max(1, currentWeek - 1));
  }

  if (!weeks.size) weeks.add(Math.max(1, currentWeek));
  return Array.from(weeks).sort((a, b) => a - b).slice(0, 18);
}

function buildRosterManagerLookup(users: SleeperUser[], rosters: SleeperRoster[]): Map<string, string> {
  const userById = new Map<string, SleeperUser>();
  users.forEach((user) => {
    const userId = cleanText(user.user_id);
    if (userId) userById.set(userId, user);
  });

  const managerByRosterId = new Map<string, string>();
  rosters.forEach((roster) => {
    const rosterId = normalizeRosterId(roster.roster_id);
    if (!rosterId) return;

    const user = userById.get(cleanText(roster.owner_id) || '');
    const teamName = cleanText(roster.metadata?.team_name);
    const displayName = cleanText(user?.display_name) || cleanText(user?.username);
    const label = [teamName, displayName]
      .filter((value, index, list): value is string => Boolean(value && list.indexOf(value) === index))
      .join(' / ');

    if (label) managerByRosterId.set(rosterId, label);
  });

  return managerByRosterId;
}

function buildRosterStateFacts(
  rosters: SleeperRoster[],
  managerByRosterId: Map<string, string>
): RecommendationStateSnapshot[] {
  return rosters
    .map((roster): RecommendationStateSnapshot | null => {
      const rosterId = normalizeRosterId(roster.roster_id);
      const manager = rosterId ? managerByRosterId.get(rosterId) || null : null;
      if (!manager) return null;
      const rosterPlayerIds = (roster.players || []).map(String).filter(Boolean);
      const starterPlayerIds = (roster.starters || []).map(String).filter(Boolean);
      const benchPlayerIds = rosterPlayerIds.filter(playerId => !starterPlayerIds.includes(playerId));
      return {
        manager,
        rosterPlayerIds,
        starterPlayerIds,
        benchPlayerIds,
      };
    })
    .filter((row): row is RecommendationStateSnapshot => Boolean(row));
}

function getCounterpartyLabel(
  rosterIds: Array<string | number | null> | null | undefined,
  selectedRosterId: string | null,
  managerByRosterId: Map<string, string>
): string | null {
  const counterparties = (rosterIds || [])
    .map(normalizeRosterId)
    .filter((rosterId): rosterId is string => Boolean(rosterId && rosterId !== selectedRosterId))
    .map((rosterId) => managerByRosterId.get(rosterId) || rosterId);

  return counterparties.length ? counterparties.join(' / ') : null;
}

function buildTransactionFacts(
  transactionsByWeek: SleeperTransaction[][],
  managerByRosterId: Map<string, string>,
  defaultWaiverBudget?: number | null,
  season?: string | null
): AIPredictionResolvedTransaction[] {
  const facts: AIPredictionResolvedTransaction[] = [];

  transactionsByWeek.flat().forEach((transaction) => {
    if (String(transaction.status || '').toLowerCase() !== 'complete') return;

    const occurredAt = getDateFromSleeperTimestamp(transaction.status_updated) || getDateFromSleeperTimestamp(transaction.created);
    const transactionType = String(transaction.type || '').toLowerCase();
    const adds = asRecord(transaction.adds);
    const drops = asRecord(transaction.drops);
    const settings = asRecord(transaction.settings);
    const metadata = asRecord(transaction.metadata);
    const bidAmount = numeric(settings.waiver_bid)
      ?? numeric(settings.bid)
      ?? numeric(transaction.waiver_bid)
      ?? numeric(metadata.waiver_bid);
    const waiverBudget = numeric(transaction.waiver_budget)
      ?? numeric(settings.waiver_budget)
      ?? defaultWaiverBudget
      ?? null;
    const week = numeric(transaction.leg);

    Object.entries(adds).forEach(([playerId, rosterId]) => {
      const normalizedRosterId = normalizeRosterId(rosterId);
      const manager = normalizedRosterId ? managerByRosterId.get(normalizedRosterId) || null : null;
      const counterparty = getCounterpartyLabel(transaction.roster_ids, normalizedRosterId, managerByRosterId);
      facts.push({
        type: transactionType === 'trade' ? 'trade' : 'add',
        playerId,
        manager,
        counterparty,
        occurredAt,
        bidAmount,
        waiverBudget,
        season: season || null,
        week,
      });
    });

    Object.entries(drops).forEach(([playerId, rosterId]) => {
      const normalizedRosterId = normalizeRosterId(rosterId);
      facts.push({
        type: 'drop',
        playerId,
        manager: normalizedRosterId ? managerByRosterId.get(normalizedRosterId) || null : null,
        occurredAt,
        bidAmount,
        waiverBudget,
        season: season || null,
        week,
      });
    });

    if (transactionType === 'trade' && !Object.keys(adds).length) {
      const rosterIds = transaction.roster_ids || [];
      rosterIds.forEach((rosterId) => {
        const normalizedRosterId = normalizeRosterId(rosterId);
        facts.push({
          type: 'trade',
          manager: normalizedRosterId ? managerByRosterId.get(normalizedRosterId) || null : null,
          counterparty: getCounterpartyLabel(rosterIds, normalizedRosterId, managerByRosterId),
          occurredAt,
          season: season || null,
          week,
        });
      });
    }
  });

  return facts;
}

function buildPlayerStatFacts(matchupsByWeek: SleeperMatchup[][], weeks: number[]): AIPredictionResolvedPlayerStat[] {
  const facts: AIPredictionResolvedPlayerStat[] = [];

  matchupsByWeek.forEach((matchups, index) => {
    const week = weeks[index] ?? null;
    matchups.forEach((matchup) => {
      const starters = new Set((matchup.starters || []).map(String));
      Object.entries(asRecord(matchup.players_points)).forEach(([playerId, value]) => {
        const fantasyPoints = Number(value);
        if (!Number.isFinite(fantasyPoints)) return;
        facts.push({
          playerId,
          fantasyPoints,
          started: starters.has(playerId),
          week,
        });
      });
    });
  });

  return facts;
}

function getEventValueProfileKey(event: AIPredictionEvent): string {
  return cleanText(event.metadata?.valueProfileKey) || '12_sf_ppr_base';
}

function getEventValueMode(event: AIPredictionEvent): 'dynasty' | 'redraft' | 'keeper' {
  const mode = cleanText(event.metadata?.valueMode) || cleanText(event.decisionSnapshot?.valueMode) || 'dynasty';
  return mode === 'redraft' || mode === 'keeper' ? mode : 'dynasty';
}

function eventLooksValueResolvable(event: AIPredictionEvent): boolean {
  if (event.entityType !== 'player') return false;
  if (!cleanText(event.entityName)) return false;
  if (getEventValueMode(event) === 'redraft') return false;
  const text = [
    event.surface,
    event.action,
    event.decision,
    event.metadata?.source,
    event.metadata?.recommendationType,
    event.metadata?.actionText,
    event.metadata?.archetypeKey,
    event.metadata?.archetypeLabel,
    event.whyThisFired,
    ...event.evidence,
  ].map(cleanText).filter(Boolean).join(' ').toLowerCase();
  return /\b(buy|buy-low|sell|sell-high|hold|avoid|do not chase|don't chase|market|value|trap|stash|breakout|protected runway|fragile|promotion|volume spike)\b/i.test(text);
}

function selectValuePoint(points: Array<{ date: string; value: number; sourceCount?: number | null; sources?: string[] }>, dateKey: string, direction: 'before' | 'after') {
  const sorted = points
    .filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(Number(point.value)))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (direction === 'before') {
    return [...sorted].reverse().find((point) => point.date <= dateKey) || null;
  }
  return [...sorted].reverse().find((point) => point.date > dateKey) || null;
}

function buildValueMovementFromTimeline(input: {
  event: AIPredictionEvent;
  valueProfileKey: string;
  recentStoredSnapshots: Awaited<ReturnType<typeof loadStoredValueTimelineSnapshotsForPlayers>>;
}): AIPredictionResolvedValueMovement | null {
  const playerName = cleanText(input.event.entityName);
  const createdDateKey = getDateKey(input.event.createdAt);
  if (!playerName || !createdDateKey) return null;

  const timeline = getPlayerValueTimelineForPlayer({
    playerName,
    valueProfileKey: input.valueProfileKey,
    leagueValueMode: getEventValueMode(input.event),
    selectedWindow: 'all',
    recentStoredSnapshots: input.recentStoredSnapshots,
  });
  const points = (timeline?.windows?.all?.points?.length ? timeline.windows.all.points : timeline?.points || [])
    .filter((point) => Number.isFinite(Number(point.value)));
  if (!points.length) return null;

  const baselinePoint = selectValuePoint(points, createdDateKey, 'before');
  const followUpPoint = selectValuePoint(points, baselinePoint?.date || createdDateKey, 'after');
  const metadataBaseline = numeric(input.event.metadata?.currentValue);
  const baselineValue = baselinePoint?.value ?? metadataBaseline;
  const baselineDate = baselinePoint?.date ?? (metadataBaseline !== null ? createdDateKey : null);
  if (!baselineValue || !baselineDate || !followUpPoint || followUpPoint.date <= baselineDate) return null;

  const followUpValue = Number(followUpPoint.value);
  const valueDelta = Math.round(followUpValue - baselineValue);
  const valueDeltaPct = baselineValue > 0 ? Math.round((valueDelta / baselineValue) * 1000) / 10 : null;
  return {
    playerId: cleanText(input.event.entityId),
    playerName,
    baselineDate,
    followUpDate: followUpPoint.date,
    baselineValue,
    followUpValue,
    valueDelta,
    valueDeltaPct,
    sourceCount: followUpPoint.sourceCount || followUpPoint.sources?.length || baselinePoint?.sourceCount || baselinePoint?.sources?.length || null,
    source: timeline?.source || 'stored-value-snapshots',
  };
}

async function buildValueMovementFacts(events: AIPredictionEvent[], resolvedAt: Date): Promise<AIPredictionResolvedValueMovement[]> {
  const eligibleEvents = events.filter(eventLooksValueResolvable);
  if (!eligibleEvents.length) return [];

  const byProfile = new Map<string, AIPredictionEvent[]>();
  eligibleEvents.forEach((event) => {
    const profileKey = getEventValueProfileKey(event);
    byProfile.set(profileKey, [...(byProfile.get(profileKey) || []), event]);
  });

  const facts: AIPredictionResolvedValueMovement[] = [];
  for (const [valueProfileKey, profileEvents] of Array.from(byProfile.entries())) {
    const players: Record<string, { full_name: string }> = Object.fromEntries(profileEvents.map((event: AIPredictionEvent, index: number) => [
      cleanText(event.entityId) || `event-player-${index}`,
      { full_name: cleanText(event.entityName) || cleanText(event.entityId) || `Player ${index + 1}` },
    ]));
    const playerIds = Object.keys(players);
    const oldestCreatedAt = profileEvents
      .map((event: AIPredictionEvent) => new Date(event.createdAt))
      .filter((date: Date) => Number.isFinite(date.getTime()))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0] || resolvedAt;
    const daysBack = Math.min(5000, daysBetweenDates(oldestCreatedAt, resolvedAt) + 14);

    const recentStoredSnapshots = await loadStoredValueTimelineSnapshotsForPlayers({
      playerIds,
      players,
      valueProfileKey,
      now: resolvedAt,
      daysBack,
    });

    profileEvents.forEach((event: AIPredictionEvent) => {
      const fact = buildValueMovementFromTimeline({ event, valueProfileKey, recentStoredSnapshots });
      if (fact) facts.push(fact);
    });
  }

  return facts;
}

async function fetchSleeperJson<T>(url: string, context: string): Promise<T> {
  return await userLoadPolicy.fetchUserLoadJson<T>(url, context);
}

async function fetchLeagueOutcomeFacts(leagueId: string, events: AIPredictionEvent[]): Promise<LeagueOutcomeFacts> {
  const encodedLeagueId = encodeURIComponent(leagueId);
  const leagueInfo = await fetchSleeperJson<any>(
    `https://api.sleeper.app/v1/league/${encodedLeagueId}`,
    'ai-prediction-outcome-resolution'
  );
  const currentWeek = getSleeperCurrentWeek(leagueInfo);
  const defaultWaiverBudget = numeric(leagueInfo?.settings?.waiver_budget);
  const season = cleanText(leagueInfo?.season);
  const weeks = getEventWeeks(events, currentWeek);
  const [users, rosters, transactionsByWeek, matchupsByWeek, valueMovements] = await Promise.all([
    fetchSleeperJson<SleeperUser[]>(
      `https://api.sleeper.app/v1/league/${encodedLeagueId}/users`,
      'ai-prediction-outcome-resolution'
    ).catch(() => []),
    fetchSleeperJson<SleeperRoster[]>(
      `https://api.sleeper.app/v1/league/${encodedLeagueId}/rosters`,
      'ai-prediction-outcome-resolution'
    ).catch(() => []),
    Promise.all(weeks.map((week) =>
      fetchSleeperJson<SleeperTransaction[]>(
        `https://api.sleeper.app/v1/league/${encodedLeagueId}/transactions/${week}`,
        'ai-prediction-outcome-resolution'
      ).catch(() => [])
    )),
    Promise.all(weeks.map((week) =>
      fetchSleeperJson<SleeperMatchup[]>(
        `https://api.sleeper.app/v1/league/${encodedLeagueId}/matchups/${week}`,
        'ai-prediction-outcome-resolution'
      ).catch(() => [])
    )),
    buildValueMovementFacts(events, new Date()),
  ]);

  const managerByRosterId = buildRosterManagerLookup(users || [], rosters || []);
  const rosterStates = buildRosterStateFacts(rosters || [], managerByRosterId);
  const transactions = buildTransactionFacts(transactionsByWeek, managerByRosterId, defaultWaiverBudget, season);
  const playerStats = buildPlayerStatFacts(matchupsByWeek, weeks);

  return {
    resolvedAt: new Date(),
    transactions,
    playerStats,
    valueMovements,
    rosterStates,
    weeks,
    transactionFactCount: transactions.length,
    playerStatFactCount: playerStats.length,
    valueMovementFactCount: valueMovements.length,
    rosterStateFactCount: rosterStates.length,
  };
}

function groupEventsByLeague(events: AIPredictionEvent[]): Map<string, AIPredictionEvent[]> {
  const byLeague = new Map<string, AIPredictionEvent[]>();
  events.forEach((event) => {
    const leagueId = cleanText(event.leagueId);
    if (!leagueId) return;
    byLeague.set(leagueId, [...(byLeague.get(leagueId) || []), event]);
  });
  return byLeague;
}

function shouldPersistOutcome(outcome: AIPredictionOutcome): boolean {
  return outcome.status !== 'pending';
}

export async function resolvePendingAIPredictionOutcomes(options: {
  leagueId?: string | null;
  limit?: number;
} = {}): Promise<AIPredictionOutcomeJobResult> {
  const startedAt = Date.now();
  const limit = Math.max(1, Math.min(Number(options.limit) || 200, 1000));
  const generatedAt = new Date().toISOString();
  const result: AIPredictionOutcomeJobResult = {
    ok: true,
    generatedAt,
    durationMs: 0,
    scanned: 0,
    resolved: 0,
    pending: 0,
    skipped: 0,
    failed: 0,
    leagues: [],
  };

  const events = await db.listPendingAiPredictionEvents({
    leagueId: options.leagueId || null,
    limit,
  });
  result.scanned = events.length;

  const byLeague = groupEventsByLeague(events);
  result.skipped = events.length - Array.from(byLeague.values()).reduce((sum, leagueEvents) => sum + leagueEvents.length, 0);

  for (const [leagueId, leagueEvents] of Array.from(byLeague.entries())) {
    const leagueResult: AIPredictionOutcomeJobLeagueResult = {
      leagueId,
      eventCount: leagueEvents.length,
      weeks: [],
      transactionFactCount: 0,
      playerStatFactCount: 0,
      valueMovementFactCount: 0,
      rosterStateFactCount: 0,
      resolved: 0,
      pending: 0,
      failed: 0,
      error: null,
    };
    result.leagues.push(leagueResult);

    try {
      const facts = await fetchLeagueOutcomeFacts(leagueId, leagueEvents);
      leagueResult.weeks = facts.weeks;
      leagueResult.transactionFactCount = facts.transactionFactCount;
      leagueResult.playerStatFactCount = facts.playerStatFactCount;
      leagueResult.valueMovementFactCount = facts.valueMovementFactCount;
      leagueResult.rosterStateFactCount = facts.rosterStateFactCount;

      for (const event of leagueEvents) {
        const outcome = resolveAIPredictionOutcome(event, facts);
        if (!shouldPersistOutcome(outcome)) {
          leagueResult.pending += 1;
          result.pending += 1;
          continue;
        }

        const updated = await db.updateAiPredictionOutcome({
          eventId: event.eventId,
          outcome,
        });

        if (updated) {
          leagueResult.resolved += 1;
          result.resolved += 1;
        } else {
          leagueResult.failed += 1;
          result.failed += 1;
        }
      }
    } catch (error) {
      const message = getErrorMessage(error);
      leagueResult.error = message;
      leagueResult.failed += leagueEvents.length;
      result.failed += leagueEvents.length;
      result.ok = false;
      console.warn(`[AIPredictionOutcomeJob] Failed to resolve league ${leagueId}:`, message);
    }
  }

  if (result.failed > 0) result.ok = false;
  result.durationMs = Date.now() - startedAt;
  return result;
}
