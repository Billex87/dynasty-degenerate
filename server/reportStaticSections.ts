import crypto from 'node:crypto';
import { findLeagueReportCache, upsertLeagueReportCache } from './db';
import { getLeagueReportCacheTtlMs } from './leagueReportCachePolicy';
import { buildPlayerScheduleProfiles } from './schedulePlanning';
import { loadSourceSnapshotFreshnessDiagnostics } from './sourceSnapshotFreshness';
import type { DraftSharksScheduleContext } from './draftSharksSchedule';
import type { PlayerScheduleProfile, ReportData, SourceSnapshotFreshnessDiagnostic } from '../shared/types';

const REPORT_STATIC_SECTIONS_CACHE_VERSION = 'league-report-static-sections-v1';
const REPORT_SOURCE_DIAGNOSTICS_CACHE_VERSION = 'league-report-source-diagnostics-v1';

type SchedulePlayer = {
  player_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string | null;
  team?: string | null;
  status?: string | null;
};

type RowCountOverride = {
  sourceKey: string;
  rowCount: number | null;
};

export type ReportStaticSections = {
  cacheKey: string;
  cacheStatus: 'hit' | 'miss';
  generatedAt: string;
  playerScheduleProfiles: Record<string, PlayerScheduleProfile>;
  prospectSourceDiagnostics?: ReportData['prospectSourceDiagnostics'];
};

export type ReportSourceDiagnosticsSection = {
  cacheKey: string;
  cacheStatus: 'hit' | 'miss';
  generatedAt: string;
  sourceSnapshotDiagnostics: SourceSnapshotFreshnessDiagnostic[];
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function getReportStaticSectionsCacheKey(input: {
  leagueValueProfileKey: string;
  currentSeason: string;
  lastCompletedSeason: string;
  staticSectionSignature?: string;
}): string {
  return [
    REPORT_STATIC_SECTIONS_CACHE_VERSION,
    input.leagueValueProfileKey || 'default',
    input.currentSeason || 'current',
    input.lastCompletedSeason || 'previous',
    input.staticSectionSignature || 'default',
  ].join(':');
}

function getStaticSectionSignature(input: {
  players: Record<string, SchedulePlayer>;
  draftSharksScheduleContext?: DraftSharksScheduleContext | null;
}): string {
  const playerRows = Object.entries(input.players || {})
    .map(([playerId, player]) => [
      playerId,
      player.position || '',
      player.team || '',
    ].join(':'))
    .sort();
  const scheduleRows = Object.entries(input.draftSharksScheduleContext?.profiles || {})
    .map(([key, profile]) => [
      key,
      profile.seasonSOS ?? '',
      profile.scheduleTier || '',
      (profile.streamerWeeks || []).join(','),
      (profile.avoidWeeks || []).join(','),
      profile.updatedAt || '',
    ].join(':'))
    .sort();
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      players: playerRows,
      scheduleStatus: input.draftSharksScheduleContext?.status || 'none',
      scheduleUpdatedAt: input.draftSharksScheduleContext?.updatedAt || null,
      scheduleRows,
    }))
    .digest('hex')
    .slice(0, 16);
}

function getRowCountSignature(rowCounts: RowCountOverride[] = []): string {
  return rowCounts
    .map((row) => `${row.sourceKey}:${row.rowCount ?? 'unknown'}`)
    .sort()
    .join('|') || 'none';
}

export function getReportSourceDiagnosticsCacheKey(input: {
  leagueValueProfileKey: string;
  currentSeason: string;
  lastCompletedSeason: string;
  currentWeek?: number | null;
  weekWindow?: number | null;
  rowCounts?: RowCountOverride[];
}): string {
  return [
    REPORT_SOURCE_DIAGNOSTICS_CACHE_VERSION,
    input.leagueValueProfileKey || 'default',
    input.currentSeason || 'current',
    input.lastCompletedSeason || 'previous',
    `week-${input.currentWeek ?? 'none'}`,
    `window-${input.weekWindow ?? 'none'}`,
    getRowCountSignature(input.rowCounts),
  ].join(':');
}

export function isReportStaticSectionsPayload(value: unknown): value is Omit<ReportStaticSections, 'cacheStatus'> {
  return Boolean(
    isRecord(value) &&
    typeof value.cacheKey === 'string' &&
    typeof value.generatedAt === 'string' &&
    isRecord(value.playerScheduleProfiles) &&
    (
      value.prospectSourceDiagnostics === undefined ||
      value.prospectSourceDiagnostics === null ||
      isRecord(value.prospectSourceDiagnostics)
    )
  );
}

export function isReportSourceDiagnosticsPayload(value: unknown): value is Omit<ReportSourceDiagnosticsSection, 'cacheStatus'> {
  return Boolean(
    isRecord(value) &&
    typeof value.cacheKey === 'string' &&
    typeof value.generatedAt === 'string' &&
    Array.isArray(value.sourceSnapshotDiagnostics)
  );
}

export async function loadReportStaticSections(input: {
  leagueId: string;
  leagueValueProfileKey: string;
  currentSeason: string;
  lastCompletedSeason: string;
  players: Record<string, SchedulePlayer>;
  draftSharksScheduleContext?: DraftSharksScheduleContext | null;
  prospectSourceDiagnostics?: ReportData['prospectSourceDiagnostics'];
  forceRefresh?: boolean;
}): Promise<ReportStaticSections> {
  const cacheKey = getReportStaticSectionsCacheKey({
    ...input,
    staticSectionSignature: getStaticSectionSignature(input),
  });

  if (!input.forceRefresh) {
    const cached = await findLeagueReportCache(cacheKey, getLeagueReportCacheTtlMs());
    if (isReportStaticSectionsPayload(cached)) {
      return {
        ...cached,
        cacheStatus: 'hit',
      };
    }
  }

  const payload: Omit<ReportStaticSections, 'cacheStatus'> = {
    cacheKey,
    generatedAt: new Date().toISOString(),
    playerScheduleProfiles: buildPlayerScheduleProfiles({
      season: input.currentSeason,
      players: input.players,
      draftSharksContext: input.draftSharksScheduleContext,
    }),
    prospectSourceDiagnostics: input.prospectSourceDiagnostics,
  };

  await upsertLeagueReportCache({
    cacheKey,
    leagueId: input.leagueId,
    viewerUserId: null,
    payload,
  });

  return {
    ...payload,
    cacheStatus: 'miss',
  };
}

export async function loadReportSourceDiagnosticsSection(input: {
  leagueId: string;
  leagueValueProfileKey: string;
  currentSeason: string;
  lastCompletedSeason: string;
  devyProfileKey?: string | null;
  currentWeek?: number | null;
  weekWindow?: number | null;
  rowCounts: RowCountOverride[];
  forceRefresh?: boolean;
}): Promise<ReportSourceDiagnosticsSection> {
  const cacheKey = getReportSourceDiagnosticsCacheKey(input);

  if (!input.forceRefresh) {
    const cached = await findLeagueReportCache(cacheKey, getLeagueReportCacheTtlMs());
    if (isReportSourceDiagnosticsPayload(cached)) {
      return {
        ...cached,
        cacheStatus: 'hit',
      };
    }
  }

  const sourceSnapshotDiagnostics = await loadSourceSnapshotFreshnessDiagnostics({
    currentSeason: input.currentSeason,
    previousSeason: input.lastCompletedSeason,
    valueProfileKey: input.leagueValueProfileKey,
    devyProfileKey: input.devyProfileKey,
    currentWeek: input.currentWeek ?? undefined,
    weekWindow: input.weekWindow ?? undefined,
    rowCounts: input.rowCounts,
  });

  const payload: Omit<ReportSourceDiagnosticsSection, 'cacheStatus'> = {
    cacheKey,
    generatedAt: new Date().toISOString(),
    sourceSnapshotDiagnostics,
  };

  await upsertLeagueReportCache({
    cacheKey,
    leagueId: input.leagueId,
    viewerUserId: null,
    payload,
  });

  return {
    ...payload,
    cacheStatus: 'miss',
  };
}
