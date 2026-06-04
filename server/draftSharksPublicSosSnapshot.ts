import {
  buildDraftSharksSosSnapshotImport,
  type DraftSharksSosSnapshotImportResult,
} from './draftSharksSosSnapshotImport';
import { upsertProviderDataSnapshot } from './db';
import type { DraftSharksScheduleContext } from './draftSharksSchedule';
import { normalizeNflTeamCode } from './nflTeamCodes';

export const DRAFTSHARKS_PUBLIC_SOS_URL = 'https://www.draftsharks.com/strength-of-schedule/qb';
export const DRAFTSHARKS_PUBLIC_SOS_PARSER_VERSION = 1;
export const MIN_DRAFTSHARKS_PUBLIC_SOS_PROFILE_COUNT = 180;

type DraftSharksPublicSosPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

type DraftSharksPublicSosRow = {
  team: string;
  position: DraftSharksPublicSosPosition;
  seasonSOS: number;
  remainingSOS: number;
  tier: 'elite' | 'easy' | 'neutral' | 'hard';
  streamerWeeks: number[];
  avoidWeeks: number[];
  updatedAt: string;
  weeks: Array<{
    week: number;
    opponent: string | null;
    homeAway: 'home' | 'away' | 'neutral' | null;
    matchup_percent: number;
  }>;
};

const POSITION_PERCENT_KEYS: Record<DraftSharksPublicSosPosition, string> = {
  QB: 'against_qb_percent_diff',
  RB: 'against_rb_percent_diff',
  WR: 'against_wr_percent_diff',
  TE: 'against_te_percent_diff',
  K: 'against_k_percent_diff',
  DEF: 'against_def_percent_diff',
};

function extractBalancedObject(text: string, startIndex: number): string | null {
  const objectStart = text.indexOf('{', startIndex);
  if (objectStart < 0) return null;

  let depth = 0;
  let quoted = false;
  let escaped = false;

  for (let index = objectStart; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return text.slice(objectStart, index + 1);
  }

  return null;
}

export function parseDraftSharksVueAppData(html: string): unknown {
  const marker = 'var vueAppData =';
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('DraftSharks SOS page did not include vueAppData.');
  }

  const json = extractBalancedObject(html, markerIndex + marker.length);
  if (!json) {
    throw new Error('DraftSharks SOS vueAppData payload could not be extracted.');
  }

  return JSON.parse(json);
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function percentFromDiff(value: unknown): number | null {
  const parsed = numberOrNull(value);
  if (parsed === null) return null;
  return Math.round(parsed * 1000) / 10;
}

function tierFromAverage(percent: number): DraftSharksPublicSosRow['tier'] {
  if (percent >= 25) return 'elite';
  if (percent >= 8) return 'easy';
  if (percent <= -8) return 'hard';
  return 'neutral';
}

function safeUpdatedAt(value: unknown, fallback: string): string {
  const date = value ? new Date(String(value)) : new Date(fallback);
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function buildDraftSharksSosRowsFromVueAppData(input: {
  data: unknown;
  fetchedAt?: string | Date | null;
}): DraftSharksPublicSosRow[] {
  const fetchedAt = input.fetchedAt ? new Date(input.fetchedAt) : new Date();
  const fallbackUpdatedAt = Number.isFinite(fetchedAt.getTime()) ? fetchedAt.toISOString() : new Date().toISOString();
  const teamData = Array.isArray((input.data as { teamData?: unknown })?.teamData)
    ? (input.data as { teamData: unknown[] }).teamData
    : [];
  const rows: DraftSharksPublicSosRow[] = [];

  for (const teamEntry of teamData) {
    if (!teamEntry || typeof teamEntry !== 'object') continue;
    const teamObject = teamEntry as Record<string, unknown>;
    const team = normalizeNflTeamCode(teamObject.abbr);
    const schedule = Array.isArray(teamObject.schedule) ? teamObject.schedule : [];
    if (!team) continue;

    for (const position of Object.keys(POSITION_PERCENT_KEYS) as DraftSharksPublicSosPosition[]) {
      const weeks: DraftSharksPublicSosRow['weeks'] = [];
      const updatedAtValues: string[] = [];

      for (const gameEntry of schedule) {
        if (!gameEntry || typeof gameEntry !== 'object') continue;
        const game = gameEntry as Record<string, unknown>;
        const week = Number(game.week);
        if (!Number.isInteger(week) || week < 1 || week > 18) continue;

        const opponent = game.opponent && typeof game.opponent === 'object'
          ? game.opponent as Record<string, unknown>
          : {};
        const sos = opponent.currentSosFpa && typeof opponent.currentSosFpa === 'object'
          ? opponent.currentSosFpa as Record<string, unknown>
          : {};
        const matchupPercent = percentFromDiff(sos[POSITION_PERCENT_KEYS[position]]);
        if (matchupPercent === null) continue;

        updatedAtValues.push(safeUpdatedAt(game.update_time, fallbackUpdatedAt));
        weeks.push({
          week,
          opponent: normalizeNflTeamCode(opponent.abbr),
          homeAway: Number(game.home) === 1 ? 'home' : 'away',
          matchup_percent: matchupPercent,
        });
      }

      if (!weeks.length) continue;
      const matchupPercents = weeks.map((week) => week.matchup_percent);
      const remainingSOS = average(matchupPercents);
      rows.push({
        team,
        position,
        seasonSOS: remainingSOS,
        remainingSOS,
        tier: tierFromAverage(remainingSOS),
        streamerWeeks: weeks
          .filter((week) => week.matchup_percent >= 8)
          .map((week) => week.week),
        avoidWeeks: weeks
          .filter((week) => week.matchup_percent <= -8)
          .map((week) => week.week),
        updatedAt: updatedAtValues.sort().at(-1) || fallbackUpdatedAt,
        weeks,
      });
    }
  }

  return rows.sort((left, right) => `${left.team}:${left.position}`.localeCompare(`${right.team}:${right.position}`));
}

export function buildDraftSharksPublicSosSnapshot(input: {
  html: string;
  season: string | number;
  sourceVersion: string;
  sourceUrl?: string | null;
  fetchedAt?: string | Date | null;
  minProfileCount?: number | null;
}): DraftSharksSosSnapshotImportResult {
  const data = parseDraftSharksVueAppData(input.html);
  const rows = buildDraftSharksSosRowsFromVueAppData({
    data,
    fetchedAt: input.fetchedAt,
  });
  const snapshot = buildDraftSharksSosSnapshotImport({
    rows,
    season: input.season,
    sourceVersion: input.sourceVersion,
    sourceName: 'DraftSharks public SOS page snapshot',
    sourceFile: input.sourceUrl || DRAFTSHARKS_PUBLIC_SOS_URL,
    importedAt: input.fetchedAt,
  });
  const minProfileCount = input.minProfileCount ?? MIN_DRAFTSHARKS_PUBLIC_SOS_PROFILE_COUNT;
  if (snapshot.profileCount < minProfileCount) {
    throw new Error(`DraftSharks public SOS snapshot coverage is too low: ${snapshot.profileCount} profile(s), expected at least ${minProfileCount}.`);
  }

  return snapshot;
}

export async function refreshDraftSharksPublicSosSnapshot(input: {
  season: string | number;
  sourceVersion: string;
  sourceUrl?: string | null;
  fetchedAt?: string | Date | null;
  fetchImpl?: typeof fetch;
  persistSnapshot?: boolean;
  minProfileCount?: number | null;
}): Promise<{
  snapshot: DraftSharksSosSnapshotImportResult;
  context: DraftSharksScheduleContext;
}> {
  const sourceUrl = input.sourceUrl || DRAFTSHARKS_PUBLIC_SOS_URL;
  const fetchImpl = input.fetchImpl || fetch;
  const fetchedAt = input.fetchedAt || new Date();
  const response = await fetchImpl(sourceUrl, {
    headers: {
      accept: 'text/html,*/*;q=0.8',
      'user-agent': 'dynasty-degenerate-draftsharks-sos-snapshot/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`DraftSharks SOS page returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const snapshot = buildDraftSharksPublicSosSnapshot({
    html,
    season: input.season,
    sourceVersion: input.sourceVersion,
    sourceUrl,
    fetchedAt,
    minProfileCount: input.minProfileCount,
  });

  if (input.persistSnapshot) {
    const persisted = await upsertProviderDataSnapshot({
      sourceKey: snapshot.sourceKey,
      snapshotKey: snapshot.snapshotKey,
      payload: JSON.stringify(snapshot.payload),
    });
    if (!persisted) {
      throw new Error('DraftSharks SOS snapshot was not persisted. Check DATABASE_URL.');
    }
  }

  return {
    snapshot,
    context: snapshot.payload.context,
  };
}
