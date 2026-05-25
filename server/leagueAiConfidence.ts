import fs from 'fs';
import path from 'path';
import { listLeagueAiConfidenceSnapshots, upsertLeagueAiConfidenceSnapshot } from './db';
import type {
  LeagueAiConfidence,
  LeagueAiConfidenceCalibration,
  LeagueAiConfidenceSignal,
  LeagueAiConfidenceTrendPoint,
  ManagerAiConfidence,
  ReportData,
} from '../shared/types';

type SignalInput = Omit<LeagueAiConfidenceSignal, 'status' | 'score'> & {
  score: number;
};

export type LeagueAiConfidenceSnapshotPayload = {
  schemaVersion: 1;
  generatedAt: string;
  snapshotKey: string;
  leagueId: string;
  confidence: LeagueAiConfidence;
};

const LEAGUE_AI_CONFIDENCE_HISTORY_LIMIT = 14;
const LEAGUE_AI_CONFIDENCE_SNAPSHOT_TIME_ZONE = 'America/Vancouver';
export const LEAGUE_AI_CONFIDENCE_SNAPSHOT_DIR = path.join(process.cwd(), 'server', 'league-ai-confidence-snapshots');

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function normalizeManagerName(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

function isDisabledValue(value?: string | null): boolean {
  return /^(?:0|false|off|no|disabled)$/i.test(String(value || '').trim());
}

function areLeagueAiConfidenceSnapshotsEnabled(): boolean {
  return !isDisabledValue(process.env.ENABLE_LEAGUE_AI_CONFIDENCE_SNAPSHOTS);
}

export function getLeagueAiConfidenceSnapshotKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LEAGUE_AI_CONFIDENCE_SNAPSHOT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeLeagueId(leagueId: string): string {
  return String(leagueId || 'unknown').replace(/[^a-z0-9_-]/gi, '_');
}

function stripConfidenceHistory(confidence: LeagueAiConfidence): LeagueAiConfidence {
  const { history: _history, ...rest } = confidence;
  return rest;
}

function parseLeagueAiConfidenceSnapshot(payload?: string | null): LeagueAiConfidenceSnapshotPayload | null {
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as Partial<LeagueAiConfidenceSnapshotPayload>;
    if (parsed.schemaVersion !== 1 || !parsed.snapshotKey || !parsed.leagueId || !parsed.confidence) return null;
    if (!Number.isFinite(Number(parsed.confidence.score))) return null;
    return parsed as LeagueAiConfidenceSnapshotPayload;
  } catch {
    return null;
  }
}

function readLocalLeagueAiConfidenceSnapshots(leagueId: string, limit: number): LeagueAiConfidenceSnapshotPayload[] {
  try {
    if (!fs.existsSync(LEAGUE_AI_CONFIDENCE_SNAPSHOT_DIR)) return [];
    const safeLeagueId = sanitizeLeagueId(leagueId);
    const filePattern = new RegExp(`^league-ai-confidence-snapshot-${escapeRegExp(safeLeagueId)}-(\\d{4}-\\d{2}-\\d{2})\\.json$`);
    return fs.readdirSync(LEAGUE_AI_CONFIDENCE_SNAPSHOT_DIR)
      .filter((fileName) => filePattern.test(fileName))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, limit)
      .map((fileName) => {
        const payload = fs.readFileSync(path.join(LEAGUE_AI_CONFIDENCE_SNAPSHOT_DIR, fileName), 'utf8');
        return parseLeagueAiConfidenceSnapshot(payload);
      })
      .filter((snapshot): snapshot is LeagueAiConfidenceSnapshotPayload => Boolean(snapshot && snapshot.leagueId === leagueId));
  } catch (error) {
    console.warn('[LeagueAiConfidence] Failed to read local confidence snapshots:', error);
    return [];
  }
}

export async function loadRecentLeagueAiConfidenceSnapshots(
  leagueId: string,
  limit = LEAGUE_AI_CONFIDENCE_HISTORY_LIMIT,
): Promise<LeagueAiConfidenceSnapshotPayload[]> {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') return [];
  if (!areLeagueAiConfidenceSnapshotsEnabled()) return [];

  const snapshotsByKey = new Map<string, LeagueAiConfidenceSnapshotPayload>();

  try {
    const storedSnapshots = await listLeagueAiConfidenceSnapshots(leagueId, limit);
    for (const stored of storedSnapshots) {
      const snapshot = parseLeagueAiConfidenceSnapshot(stored.payload);
      if (snapshot?.leagueId === leagueId) snapshotsByKey.set(snapshot.snapshotKey, snapshot);
    }
  } catch (error) {
    console.warn('[LeagueAiConfidence] Failed to load database confidence snapshots:', error);
  }

  for (const snapshot of readLocalLeagueAiConfidenceSnapshots(leagueId, limit)) {
    if (!snapshotsByKey.has(snapshot.snapshotKey)) snapshotsByKey.set(snapshot.snapshotKey, snapshot);
  }

  return Array.from(snapshotsByKey.values())
    .sort((a, b) => b.snapshotKey.localeCompare(a.snapshotKey) || b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, limit);
}

export async function persistLeagueAiConfidenceSnapshot(input: {
  leagueId: string;
  confidence?: LeagueAiConfidence | null;
  snapshotDate?: Date;
  generatedAt?: string;
}): Promise<boolean> {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') return false;
  if (!input.leagueId || !input.confidence) return false;
  if (!areLeagueAiConfidenceSnapshotsEnabled()) return false;

  const snapshotDate = input.snapshotDate || new Date();
  const snapshotKey = getLeagueAiConfidenceSnapshotKey(snapshotDate);
  const payload: LeagueAiConfidenceSnapshotPayload = {
    schemaVersion: 1,
    generatedAt: input.generatedAt || snapshotDate.toISOString(),
    snapshotKey,
    leagueId: input.leagueId,
    confidence: stripConfidenceHistory(input.confidence),
  };
  const serializedPayload = JSON.stringify(payload, null, 2);
  const safeLeagueId = sanitizeLeagueId(input.leagueId);

  try {
    fs.mkdirSync(LEAGUE_AI_CONFIDENCE_SNAPSHOT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(LEAGUE_AI_CONFIDENCE_SNAPSHOT_DIR, `league-ai-confidence-snapshot-${safeLeagueId}-${snapshotKey}.json`),
      serializedPayload,
    );
  } catch (error) {
    console.warn('[LeagueAiConfidence] Failed to write local confidence snapshot:', error);
  }

  try {
    const stored = await upsertLeagueAiConfidenceSnapshot({
      snapshotKey,
      leagueId: input.leagueId,
      payload: serializedPayload,
    });
    if (!stored && !process.env.VITEST) {
      console.warn('[LeagueAiConfidence] Database unavailable; confidence snapshot saved locally only.');
    }
  } catch (error) {
    console.warn('[LeagueAiConfidence] Failed to persist confidence snapshot:', error);
  }

  return true;
}

function sameManager(a?: string | null, b?: string | null): boolean {
  return normalizeManagerName(a) === normalizeManagerName(b);
}

function scaledScore(count: number, fullSample: number, floor = 24): number {
  if (!count || count <= 0) return floor;
  return clampScore(floor + Math.min(1, count / Math.max(1, fullSample)) * (100 - floor));
}

function getSignalStatus(score: number): LeagueAiConfidenceSignal['status'] {
  if (score >= 76) return 'strong';
  if (score >= 50) return 'building';
  return 'low';
}

function createSignal(input: SignalInput): LeagueAiConfidenceSignal {
  const score = clampScore(input.score);
  return {
    ...input,
    score,
    status: getSignalStatus(score),
  };
}

function getTeamCount(data: ReportData): number {
  return Math.max(
    data.leagueDiagnostics?.teamCount || 0,
    data.managerRosterIntelligence?.length || 0,
    data.managerPositionCounts?.length || 0,
    data.leagueOverview?.length || 0,
    data.currentStandings?.length || 0,
    1,
  );
}

function uniqueCount(values: Array<string | number | null | undefined>): number {
  return new Set(values.filter((value): value is string | number => value !== null && value !== undefined && String(value).trim() !== '')).size;
}

function parseDateMs(value?: string | number | Date | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

function getRecencyWeight(value?: string | number | Date | null, now = Date.now()): number {
  const time = parseDateMs(value);
  if (time === null) return 0.45;
  const ageDays = Math.max(0, (now - time) / 86_400_000);
  if (ageDays <= 30) return 1;
  if (ageDays <= 90) return 0.78;
  if (ageDays <= 180) return 0.55;
  if (ageDays <= 365) return 0.34;
  if (ageDays <= 730) return 0.18;
  return 0.10;
}

function weightedEventCount<T>(values: T[], getDate: (value: T) => string | number | Date | null | undefined): number {
  const now = Date.now();
  return values.reduce((sum, value) => sum + getRecencyWeight(getDate(value), now), 0);
}

function getSourceTrustScore(data: ReportData): number | null {
  const diagnostics = [
    ...(data.rankings?.dynastySourceDiagnostics || []),
    ...(data.rankings?.redraftSourceDiagnostics || []),
    ...(data.rankings?.devySourceDiagnostics || []),
  ];
  const scores = diagnostics
    .map((diagnostic) => Number(diagnostic.trustScore))
    .filter((score) => Number.isFinite(score));
  return average(scores);
}

function getHistorySeasonCount(data: ReportData): number {
  return uniqueCount((data.standingsHistory || []).map((row) => row.season));
}

function getMonthlySnapshotCount(data: ReportData): number {
  const historyMonths = uniqueCount((data.monthlyBlueprintHistory || []).map((row) => row.snapshotMonth));
  const currentStored = data.monthlyBlueprintSnapshot?.status === 'stored' || data.monthlyBlueprintSnapshot?.status === 'local' ? 1 : 0;
  return Math.max(historyMonths, currentStored);
}

function getLatestSnapshotMonth(data: ReportData): string | null {
  const months = [
    ...(data.monthlyBlueprintHistory || []).map((row) => row.snapshotMonth),
    data.monthlyBlueprintSnapshot?.month,
  ]
    .filter((month): month is string => Boolean(month))
    .sort();
  return months[months.length - 1] || null;
}

function getPreviousConfidenceData(data: ReportData): ReportData | null {
  const latestMonth = getLatestSnapshotMonth(data);
  if (!latestMonth) return null;

  const previousHistory = (data.monthlyBlueprintHistory || []).filter((row) => row.snapshotMonth < latestMonth);
  if (!previousHistory.length) return null;

  const previousLatestMonth = previousHistory
    .map((row) => row.snapshotMonth)
    .sort()
    .at(-1) || null;
  const previousManagerCount = previousLatestMonth
    ? uniqueCount(previousHistory.filter((row) => row.snapshotMonth === previousLatestMonth).map((row) => row.manager))
    : 0;

  return {
    ...data,
    monthlyBlueprintHistory: previousHistory,
    monthlyBlueprintSnapshot: previousLatestMonth
      ? {
        month: previousLatestMonth,
        status: 'stored',
        managerCount: previousManagerCount,
        source: 'database',
      }
      : undefined,
  };
}

function getLabel(score: number): string {
  if (score >= 84) return 'High confidence';
  if (score >= 70) return 'Strong confidence';
  if (score >= 52) return 'Building confidence';
  return 'Low confidence';
}

function getPreviousConfidenceFromSnapshots(history: LeagueAiConfidenceSnapshotPayload[]): LeagueAiConfidence | null {
  const [latestSnapshot] = [...history]
    .filter((snapshot) => Number.isFinite(Number(snapshot.confidence?.score)))
    .sort((a, b) => b.snapshotKey.localeCompare(a.snapshotKey) || b.generatedAt.localeCompare(a.generatedAt));
  return latestSnapshot?.confidence || null;
}

function buildConfidenceHistory(
  current: LeagueAiConfidence,
  history: LeagueAiConfidenceSnapshotPayload[],
): LeagueAiConfidenceTrendPoint[] {
  const pointsByKey = new Map<string, LeagueAiConfidenceTrendPoint>();

  for (const snapshot of history) {
    const score = Number(snapshot.confidence?.score);
    if (!Number.isFinite(score)) continue;
    pointsByKey.set(snapshot.snapshotKey, {
      snapshotKey: snapshot.snapshotKey,
      generatedAt: snapshot.generatedAt || null,
      score: clampScore(score),
      label: snapshot.confidence?.label || getLabel(score),
    });
  }

  const currentSnapshotKey = getLeagueAiConfidenceSnapshotKey();
  pointsByKey.set(currentSnapshotKey, {
    snapshotKey: currentSnapshotKey,
    generatedAt: new Date().toISOString(),
    score: current.score,
    label: current.label,
  });

  return Array.from(pointsByKey.values())
    .sort((a, b) => a.snapshotKey.localeCompare(b.snapshotKey) || String(a.generatedAt || '').localeCompare(String(b.generatedAt || '')))
    .slice(-LEAGUE_AI_CONFIDENCE_HISTORY_LIMIT);
}

function attachSignalDeltas(
  currentSignals: LeagueAiConfidenceSignal[],
  previousSignals: LeagueAiConfidenceSignal[] = [],
): LeagueAiConfidenceSignal[] {
  const previousByKey = new Map(previousSignals.map((signal) => [signal.key, signal]));
  return currentSignals.map((signal) => {
    const previous = previousByKey.get(signal.key) || null;
    return {
      ...signal,
      previousScore: previous?.score ?? null,
      scoreDelta: previous ? signal.score - previous.score : null,
    };
  });
}

function parseConfiguredSeasonStart(now: Date): Date {
  const configured = process.env.NFL_SEASON_START_DATE;
  if (configured) {
    const parsed = new Date(`${configured}T00:00:00.000Z`);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return new Date(`${now.getUTCFullYear()}-09-01T00:00:00.000Z`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getCalibrationPhase(now: Date, seasonStart: Date): LeagueAiConfidenceCalibration['phase'] {
  if (now < addDays(seasonStart, -30)) return 'offseason';
  if (now < seasonStart) return 'preseason';
  if (now < addDays(seasonStart, 35)) return 'early_season';
  if (now < addDays(seasonStart, 120)) return 'in_season';
  return 'playoffs';
}

function buildLeagueAiConfidenceCalibration(data: ReportData, now = new Date()): LeagueAiConfidenceCalibration {
  const seasonStart = parseConfiguredSeasonStart(now);
  const phase = getCalibrationPhase(now, seasonStart);
  const teamCount = getTeamCount(data);
  const loadedSourceCount = [
    ...(data.rankings?.dynastySourceDiagnostics || []),
    ...(data.rankings?.redraftSourceDiagnostics || []),
    ...(data.rankings?.devySourceDiagnostics || []),
  ].filter((diagnostic) => diagnostic.status === 'loaded').length;
  const observedSampleSize = Math.round(
    (data.tradeHistory?.length || 0)
    + (data.recentTransactions?.length || 0)
    + (data.transactionBackfillDiagnostics?.transactionCount || 0)
    + (data.standingsHistory?.length || 0)
    + getMonthlySnapshotCount(data) * teamCount
    + loadedSourceCount * 12
  );
  const targetSampleSize = phase === 'offseason'
    ? 220
    : phase === 'preseason'
      ? 180
      : phase === 'early_season'
        ? 140
        : 100;
  const status: LeagueAiConfidenceCalibration['status'] = now < seasonStart
    ? 'pending'
    : observedSampleSize >= targetSampleSize
      ? 'ready'
      : 'collecting';
  const nextReviewDate = status === 'pending'
    ? seasonStart
    : status === 'ready'
      ? addDays(now, 14)
      : addDays(now, 7);

  return {
    phase,
    status,
    observedSampleSize,
    targetSampleSize,
    seasonStartDate: seasonStart.toISOString().slice(0, 10),
    nextReviewDate: nextReviewDate.toISOString().slice(0, 10),
    note: status === 'ready'
      ? 'Enough in-season league evidence exists to review and tune confidence thresholds against real outcomes.'
      : status === 'collecting'
        ? `Collecting in-season evidence for calibration (${observedSampleSize}/${targetSampleSize} observed samples).`
        : `Calibration is waiting for the season window; current samples are observed but thresholds should not be tightened before ${seasonStart.toISOString().slice(0, 10)}.`,
  };
}

function getManagerNames(data: ReportData): string[] {
  return Array.from(new Set([
    ...(data.managerRosterIntelligence || []).map((row) => row.manager),
    ...(data.managerPositionCounts || []).map((row) => row.manager),
    ...(data.leagueOverview || []).map((row) => row.manager),
    ...(data.powerRankings || []).map((row) => row.manager),
    ...(data.currentStandings || []).map((row) => row.manager),
    ...(data.monthlyBlueprintHistory || []).map((row) => row.manager),
    ...(data.schedulePlanning?.rosterGaps || []).map((row) => row.manager),
    ...(data.schedulePlanning?.streamerCandidates || []).map((row) => row.manager || ''),
  ].filter((manager): manager is string => Boolean(manager))));
}

function buildManagerConfidence(data: ReportData, manager: string): ManagerAiConfidence {
  const teamCount = getTeamCount(data);
  const intel = (data.managerRosterIntelligence || []).find((row) => sameManager(row.manager, manager)) || null;
  const positionCounts = (data.managerPositionCounts || []).find((row) => sameManager(row.manager, manager)) || null;
  const overview = (data.leagueOverview || []).find((row) => sameManager(row.manager, manager)) || null;
  const power = (data.powerRankings || []).find((row) => sameManager(row.manager, manager)) || null;
  const pickPortfolio = (data.pickPortfolios || []).find((row) => sameManager(row.manager, manager)) || null;
  const tradeTendency = (data.tradeTendencies || []).find((row) => sameManager(row.manager, manager)) || null;
  const standingsRows = (data.standingsHistory || []).filter((row) => sameManager(row.manager, manager));
  const tradeRows = (data.tradeHistory || []).filter((row) => sameManager(row.team_a, manager) || sameManager(row.team_b, manager));
  const transactionRows = (data.recentTransactions || []).filter((row) => sameManager(row.manager, manager));
  const monthlyRows = (data.monthlyBlueprintHistory || []).filter((row) => sameManager(row.manager, manager));
  const matchup = (data.matchupPreviews || []).find((row) => sameManager(row.manager, manager)) || null;
  const schedulePlanning = data.schedulePlanning || null;
  const scheduleGap = (schedulePlanning?.rosterGaps || []).find((row) => sameManager(row.manager, manager)) || null;
  const weightedTrades = weightedEventCount(tradeRows, (row) => row.date);
  const weightedTransactions = weightedEventCount(transactionRows, (row) => row.date);
  const standingSeasons = uniqueCount(standingsRows.map((row) => row.season));
  const monthlySnapshotCount = uniqueCount(monthlyRows.map((row) => row.snapshotMonth));

  const rosterScore = clampScore(average([
    intel ? 82 : null,
    positionCounts ? 78 : null,
    overview ? 74 : null,
    power ? 70 : null,
  ]) ?? 34);
  const behaviorScore = clampScore(
    24
    + Math.min(28, weightedTrades * 7)
    + Math.min(22, Math.max(0, tradeTendency?.tradeCount || 0) * 5)
    + Math.min(18, weightedTransactions * 7),
  );
  const historyScore = clampScore(
    22
    + Math.min(34, standingSeasons * 10)
    + Math.min(24, monthlySnapshotCount * 8)
    + Math.min(20, standingsRows.length * (20 / Math.max(1, teamCount * 3))),
  );
  const assetScore = clampScore(average([
    pickPortfolio ? 70 : null,
    intel?.tradePlan ? 68 : null,
    intel?.marketSignals?.length ? scaledScore(intel.marketSignals.length, 5, 36) : null,
    intel?.pressurePoints?.length ? scaledScore(intel.pressurePoints.length, 4, 36) : null,
  ]) ?? 38);
  const scheduleScore = matchup
    ? 78
    : scheduleGap
      ? 70
      : schedulePlanning?.status === 'ready'
        ? 62
        : schedulePlanning
          ? 48
          : 32;

  const signals = [
    createSignal({
      key: 'managerRoster',
      label: 'Manager roster',
      score: rosterScore,
      weight: 0.30,
      note: `${manager} ${intel ? 'has' : 'does not have'} roster intelligence, ${positionCounts ? 'position counts' : 'no position count row'}, and ${overview ? 'league overview coverage' : 'limited overview coverage'}.`,
    }),
    createSignal({
      key: 'managerBehavior',
      label: 'Manager behavior',
      score: behaviorScore,
      weight: 0.26,
      note: `${tradeRows.length} trade${tradeRows.length === 1 ? '' : 's'} and ${transactionRows.length} recent transaction${transactionRows.length === 1 ? '' : 's'} are tied to ${manager}; recent events carry more weight.`,
    }),
    createSignal({
      key: 'managerHistory',
      label: 'Manager history',
      score: historyScore,
      weight: 0.22,
      note: `${standingSeasons} standings season${standingSeasons === 1 ? '' : 's'} and ${monthlySnapshotCount} monthly snapshot${monthlySnapshotCount === 1 ? '' : 's'} are available for ${manager}.`,
    }),
    createSignal({
      key: 'managerAssets',
      label: 'Manager assets',
      score: assetScore,
      weight: 0.14,
      note: pickPortfolio ? 'Pick portfolio and roster-plan context are available.' : 'Pick portfolio or roster-plan context is limited.',
    }),
    createSignal({
      key: 'managerSchedule',
      label: 'Manager schedule',
      score: scheduleScore,
      weight: 0.08,
      note: matchup
        ? 'Weekly matchup context is available for this manager.'
        : scheduleGap
          ? `Bye-week planning notes are available for ${manager}: ${scheduleGap.position} depth pressure in ${scheduleGap.weeks.map((week) => `W${week}`).join(' · ')}.`
          : schedulePlanning?.status === 'ready'
            ? 'Schedule planning context is available, but manager-specific matchup context is still limited.'
            : 'Weekly matchup context is not available for this manager yet.',
    }),
  ];
  const score = clampScore(signals.reduce((sum, signal) => sum + signal.score * signal.weight, 0));
  const weakestSignals = [...signals].sort((a, b) => a.score - b.score).slice(0, 2);

  return {
    manager,
    score,
    label: getLabel(score),
    note: `${getLabel(score)} for ${manager}. Weakest areas: ${weakestSignals.map((signal) => signal.label.toLowerCase()).join(' and ')}.`,
    signals,
  };
}

function buildLeagueAiConfidenceCore(data: ReportData): LeagueAiConfidence {
  const teamCount = getTeamCount(data);
  const rosterCoverage = Math.max(
    data.managerRosterIntelligence?.length || 0,
    data.managerPositionCounts?.length || 0,
    data.leagueOverview?.length || 0,
  );
  const standingsSeasons = getHistorySeasonCount(data);
  const tradeCount = data.tradeHistory?.length || 0;
  const weightedTradeCount = weightedEventCount(data.tradeHistory || [], (row) => row.date);
  const transactionCount = data.recentTransactions?.length || 0;
  const backfilledTransactionCount = data.transactionBackfillDiagnostics?.transactionCount || 0;
  const weightedTransactionCount = weightedEventCount(data.recentTransactions || [], (row) => row.date);
  const monthlySnapshotCount = getMonthlySnapshotCount(data);
  const valueProfileCount = Object.values(data.playerDetailsById || {}).filter((player) => player.valueProfile).length;
  const rankingRows = Math.max(
    data.rankings?.dynastySf?.length || 0,
    data.rankings?.redraftPpr?.length || 0,
    data.rankings?.devySf?.length || 0,
  );
  const sourceTrustScore = getSourceTrustScore(data);
  const matchupCount = data.matchupPreviews?.length || 0;

  const rosterScore = clampScore(average([
    scaledScore(rosterCoverage, teamCount, 28),
    scaledScore(data.managerPositionCounts?.length || 0, teamCount, 28),
    data.leagueDiagnostics?.starterCalculation ? 78 : 42,
    data.currentStandings?.length ? scaledScore(data.currentStandings.length, teamCount, 32) : null,
  ]) ?? 34);

  const marketScore = clampScore(average([
    data.leagueDiagnostics?.valueSnapshotProfileCount ? 74 : 40,
    scaledScore(valueProfileCount, Math.max(20, teamCount * 18), 28),
    rankingRows ? scaledScore(rankingRows, 250, 36) : null,
    sourceTrustScore,
  ]) ?? 36);

  const historyScore = clampScore(
    24
    + Math.min(32, standingsSeasons * 9)
    + Math.min(28, weightedTradeCount * 2.6)
    + Math.min(16, (data.tradeTendencies?.length || 0) * (16 / Math.max(1, teamCount))),
  );

  const activityScore = clampScore(
    26
    + Math.min(36, weightedTransactionCount * 6)
    + (data.waiverIntelligence ? 12 : 0)
    + Math.min(12, (data.tradeProposalSignals?.length || 0) * 4)
    + Math.min(14, (data.draftPicks?.length || 0) / Math.max(1, teamCount)),
  );

  const memoryScore = clampScore(
    22
    + Math.min(42, monthlySnapshotCount * 12)
    + (data.monthlyBlueprintSnapshot?.status === 'stored' ? 12 : 0)
    + Math.min(16, (data.monthlyBlueprintSnapshot?.managerCount || 0) * (16 / Math.max(1, teamCount))),
  );

  const schedulePlanning = data.schedulePlanning || null;
  const scheduleSignalCount = (schedulePlanning?.rosterGaps?.length || 0)
    + (schedulePlanning?.streamerCandidates?.length || 0)
    + (schedulePlanning?.byeWeekNotes?.length || 0);
  const scheduleScore = matchupCount
    ? scaledScore(matchupCount, teamCount, 36)
    : schedulePlanning?.status === 'ready'
      ? scaledScore(scheduleSignalCount || 1, teamCount, 40)
      : schedulePlanning
        ? 48
        : 28;

  const signals = [
    createSignal({
      key: 'rosterCoverage',
      label: 'Roster coverage',
      score: rosterScore,
      weight: 0.22,
      note: `${rosterCoverage}/${teamCount} managers have roster intelligence or league overview coverage.`,
    }),
    createSignal({
      key: 'marketValues',
      label: 'Market values',
      score: marketScore,
      weight: 0.20,
      note: `${valueProfileCount.toLocaleString('en-US')} player value profiles, ${rankingRows.toLocaleString('en-US')} ranking rows, source trust ${sourceTrustScore === null ? 'pending' : `${Math.round(sourceTrustScore)}/100`}.`,
    }),
    createSignal({
      key: 'leagueHistory',
      label: 'League history',
      score: historyScore,
      weight: 0.24,
      note: `${standingsSeasons} season${standingsSeasons === 1 ? '' : 's'} of standings and ${tradeCount} trade${tradeCount === 1 ? '' : 's'} are available; recent trades count more than old trades.`,
    }),
    createSignal({
      key: 'managerActivity',
      label: 'Manager activity',
      score: activityScore,
      weight: 0.12,
      note: `${transactionCount} report transaction${transactionCount === 1 ? '' : 's'} plus ${backfilledTransactionCount} backfilled Sleeper transaction${backfilledTransactionCount === 1 ? '' : 's'} where available; newer moves carry more weight.`,
    }),
    createSignal({
      key: 'snapshotMemory',
      label: 'Snapshot memory',
      score: memoryScore,
      weight: 0.14,
      note: `${monthlySnapshotCount} monthly blueprint snapshot${monthlySnapshotCount === 1 ? '' : 's'} available for this league.`,
    }),
    createSignal({
      key: 'scheduleContext',
      label: 'Schedule context',
      score: scheduleScore,
      weight: 0.08,
      note: matchupCount
        ? `${matchupCount}/${teamCount} matchup preview${matchupCount === 1 ? '' : 's'} available.`
        : schedulePlanning?.status === 'ready'
          ? `${scheduleSignalCount.toLocaleString('en-US')} schedule planning signal${scheduleSignalCount === 1 ? '' : 's'} mapped for bye-week coverage.`
          : schedulePlanning
            ? 'Schedule planning is present but not fully populated yet.'
            : 'Schedule and matchup previews are not available yet.',
    }),
  ];

  const weightedScore = clampScore(signals.reduce((sum, signal) => sum + signal.score * signal.weight, 0));
  const weakestSignals = [...signals].sort((a, b) => a.score - b.score).slice(0, 2);
  const label = getLabel(weightedScore);
  const managerConfidence = getManagerNames(data)
    .map((manager) => buildManagerConfidence(data, manager))
    .sort((a, b) => a.manager.localeCompare(b.manager));

  return {
    score: weightedScore,
    label,
    note: `${label}. This number is intentionally allowed to start low; it rises as this league accumulates standings, trades, transactions, monthly snapshots, matchup context, and source-trust history. Current weakest areas: ${weakestSignals.map((signal) => signal.label.toLowerCase()).join(' and ')}.`,
    calibration: buildLeagueAiConfidenceCalibration(data),
    signals,
    managerConfidence,
  };
}

export function buildLeagueAiConfidence(
  data: ReportData,
  previousSnapshots: LeagueAiConfidenceSnapshotPayload[] = [],
): LeagueAiConfidence {
  const current = buildLeagueAiConfidenceCore(data);
  const previousFromSnapshots = getPreviousConfidenceFromSnapshots(previousSnapshots);
  const previousData = previousFromSnapshots ? null : getPreviousConfidenceData(data);
  const previous = previousFromSnapshots || (previousData ? buildLeagueAiConfidenceCore(previousData) : null);
  const previousManagersByName = new Map((previous?.managerConfidence || []).map((row) => [normalizeManagerName(row.manager), row]));

  return {
    ...current,
    previousScore: previous?.score ?? null,
    scoreDelta: previous ? current.score - previous.score : null,
    signals: attachSignalDeltas(current.signals, previous?.signals || []),
    history: buildConfidenceHistory(current, previousSnapshots),
    managerConfidence: current.managerConfidence?.map((managerConfidence) => {
      const previousManagerConfidence = previousManagersByName.get(normalizeManagerName(managerConfidence.manager)) || null;
      return {
        ...managerConfidence,
        previousScore: previousManagerConfidence?.score ?? null,
        scoreDelta: previousManagerConfidence ? managerConfidence.score - previousManagerConfidence.score : null,
        signals: attachSignalDeltas(managerConfidence.signals, previousManagerConfidence?.signals || []),
      };
    }),
  };
}

export function attachLeagueAiConfidence<T extends ReportData>(
  data: T,
  previousSnapshots: LeagueAiConfidenceSnapshotPayload[] = [],
): T {
  if (!data.leagueDiagnostics) return data;
  return {
    ...data,
    leagueDiagnostics: {
      ...data.leagueDiagnostics,
      aiConfidence: buildLeagueAiConfidence(data, previousSnapshots),
    },
  };
}
