import { findLatestProviderDataSnapshot, upsertProviderDataSnapshot } from './db';
import { getProviderSnapshotDateKey, parseProviderSnapshotPayload } from './providerDataSnapshots';
import type { PlayerDetails } from '../shared/types';

export const NFLVERSE_DRAFT_CAPITAL_SOURCE_KEY = 'nflverse-draft-capital-v1';

const SOURCE_NAME = 'nflverse ffverse player IDs';
const DEFAULT_FF_PLAYER_IDS_URL = 'https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

type NflverseDraftCapitalLoadOptions = {
  sourceMode?: 'live' | 'snapshot';
  persistSnapshot?: boolean;
  forceRefresh?: boolean;
};

export type NflverseDraftCapitalRow = {
  sleeperId: string | null;
  gsisId: string | null;
  espnId: string | null;
  fantasyProsId: string | null;
  mflId: string | null;
  yahooId: string | null;
  fleaflickerId: string | null;
  pfrId: string | null;
  name: string;
  mergeName: string | null;
  position: string;
  team: string | null;
  birthdate: string | null;
  age: number | null;
  draftYear: number | null;
  draftRound: number | null;
  draftPick: number | null;
  draftOverall: number | null;
  draftTeam: string | null;
  college: string | null;
  height: number | null;
  weight: number | null;
  dbSeason: number | null;
};

export type NflverseDraftCapitalSnapshot = {
  schemaVersion: 1;
  source: typeof SOURCE_NAME;
  sourceUrl: string;
  generatedAt: string;
  snapshotKey: string;
  rowCount: number;
  rows: NflverseDraftCapitalRow[];
};

let cachedSnapshot: { loadedAt: number; value: NflverseDraftCapitalSnapshot } | null = null;

function isFresh(cache: { loadedAt: number } | null): boolean {
  return Boolean(cache && Date.now() - cache.loadedAt < CACHE_TTL_MS);
}

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (!raw || /^NA$/i.test(raw) || /^null$/i.test(raw)) return null;
  return raw;
}

function numberValue(value: unknown): number | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  if (current || row.length) {
    row.push(current);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }

  const header = rows.shift()?.map((cell) => cell.trim()) || [];
  return rows.map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ''])));
}

export function normalizeNflverseDraftCapitalRows(rows: Array<Record<string, unknown>>): NflverseDraftCapitalRow[] {
  return rows
    .map((row) => {
      const position = (stringValue(row.position) || '').toUpperCase();
      const name = stringValue(row.name) || stringValue(row.player_name) || '';
      if (!name || !FANTASY_POSITIONS.has(position)) return null;

      return {
        sleeperId: stringValue(row.sleeper_id),
        gsisId: stringValue(row.gsis_id),
        espnId: stringValue(row.espn_id),
        fantasyProsId: stringValue(row.fantasypros_id),
        mflId: stringValue(row.mfl_id),
        yahooId: stringValue(row.yahoo_id),
        fleaflickerId: stringValue(row.fleaflicker_id),
        pfrId: stringValue(row.pfr_id),
        name,
        mergeName: stringValue(row.merge_name),
        position,
        team: stringValue(row.team),
        birthdate: stringValue(row.birthdate),
        age: numberValue(row.age),
        draftYear: numberValue(row.draft_year),
        draftRound: numberValue(row.draft_round),
        draftPick: numberValue(row.draft_pick),
        draftOverall: numberValue(row.draft_ovr),
        draftTeam: stringValue(row.draft_team) || stringValue(row.team),
        college: stringValue(row.college),
        height: numberValue(row.height),
        weight: numberValue(row.weight),
        dbSeason: numberValue(row.db_season),
      };
    })
    .filter((row): row is NflverseDraftCapitalRow => Boolean(row));
}

function parseSnapshot(payload?: string | null): NflverseDraftCapitalSnapshot | null {
  const parsed = parseProviderSnapshotPayload<Partial<NflverseDraftCapitalSnapshot>>(payload);
  if (
    parsed?.schemaVersion !== 1 ||
    parsed.source !== SOURCE_NAME ||
    typeof parsed.snapshotKey !== 'string' ||
    !Array.isArray(parsed.rows)
  ) {
    return null;
  }

  return parsed as NflverseDraftCapitalSnapshot;
}

async function loadStoredSnapshot(): Promise<NflverseDraftCapitalSnapshot> {
  const stored = await findLatestProviderDataSnapshot(NFLVERSE_DRAFT_CAPITAL_SOURCE_KEY);
  const snapshot = parseSnapshot(stored?.payload);
  if (snapshot) {
    cachedSnapshot = { loadedAt: Date.now(), value: snapshot };
    return snapshot;
  }

  return {
    schemaVersion: 1,
    source: SOURCE_NAME,
    sourceUrl: DEFAULT_FF_PLAYER_IDS_URL,
    generatedAt: '',
    snapshotKey: '',
    rowCount: 0,
    rows: [],
  };
}

async function persistSnapshot(snapshot: NflverseDraftCapitalSnapshot) {
  if (!snapshot.rows.length) return false;
  return upsertProviderDataSnapshot({
    sourceKey: NFLVERSE_DRAFT_CAPITAL_SOURCE_KEY,
    snapshotKey: snapshot.snapshotKey,
    payload: JSON.stringify(snapshot),
  });
}

export async function loadNflverseDraftCapitalSnapshot(
  options: NflverseDraftCapitalLoadOptions = {}
): Promise<NflverseDraftCapitalSnapshot> {
  if (options.sourceMode === 'snapshot') return loadStoredSnapshot();
  if (!options.forceRefresh && cachedSnapshot && isFresh(cachedSnapshot)) {
    if (options.persistSnapshot) await persistSnapshot(cachedSnapshot.value);
    return cachedSnapshot.value;
  }

  const now = new Date();
  const sourceUrl = process.env.NFLVERSE_FF_PLAYER_IDS_URL || DEFAULT_FF_PLAYER_IDS_URL;
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`nflverse draft-capital fetch failed: ${response.status}`);

    const csv = await response.text();
    const rows = normalizeNflverseDraftCapitalRows(parseCsv(csv));
    const snapshot: NflverseDraftCapitalSnapshot = {
      schemaVersion: 1,
      source: SOURCE_NAME,
      sourceUrl,
      generatedAt: now.toISOString(),
      snapshotKey: getProviderSnapshotDateKey(now),
      rowCount: rows.length,
      rows,
    };

    cachedSnapshot = { loadedAt: Date.now(), value: snapshot };
    if (options.persistSnapshot) await persistSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    console.warn('[nflverse] Failed to refresh draft-capital snapshot:', error);
    return cachedSnapshot?.value || loadStoredSnapshot();
  }
}

export function buildNflverseDraftCapitalBySleeperId(
  snapshot: NflverseDraftCapitalSnapshot | null | undefined
): Record<string, NflverseDraftCapitalRow> {
  const rows = snapshot?.rows || [];
  return Object.fromEntries(
    rows
      .filter((row) => row.sleeperId)
      .map((row) => [String(row.sleeperId), row])
  );
}

export function enrichPlayerDetailsWithNflverseDraftCapital(
  playerDetailsById: Record<string, PlayerDetails>,
  draftCapitalBySleeperId: Record<string, NflverseDraftCapitalRow>
): Record<string, PlayerDetails> {
  return Object.fromEntries(
    Object.entries(playerDetailsById).map(([playerId, details]) => {
      const row = draftCapitalBySleeperId[playerId];
      if (!row) return [playerId, details];

      return [
        playerId,
        {
          ...details,
          birthDate: details.birthDate ?? row.birthdate,
          age: details.age ?? row.age,
          height: details.height ?? row.height,
          weight: details.weight ?? row.weight,
          college: details.college ?? row.college,
          rookieYear: row.draftYear ?? details.rookieYear,
          nflDraftRound: row.draftRound ?? details.nflDraftRound,
          nflDraftPick: row.draftOverall ?? row.draftPick ?? details.nflDraftPick,
          nflDraftTeam: row.draftTeam ?? details.nflDraftTeam,
          externalIds: {
            ...details.externalIds,
            gsis: details.externalIds?.gsis ?? row.gsisId,
            espn: details.externalIds?.espn ?? row.espnId,
            fantasyPros: details.externalIds?.fantasyPros ?? row.fantasyProsId,
            mfl: details.externalIds?.mfl ?? row.mflId,
            yahoo: details.externalIds?.yahoo ?? row.yahooId,
            fleaflicker: details.externalIds?.fleaflicker ?? row.fleaflickerId,
            pfr: details.externalIds?.pfr ?? row.pfrId,
          },
        },
      ];
    })
  );
}

export function clearNflverseDraftCapitalCacheForTests() {
  cachedSnapshot = null;
}

export const __testing = {
  parseCsv,
};
