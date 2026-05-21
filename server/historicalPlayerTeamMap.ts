import { normalizeNflTeamCode, type NflTeamCode } from './nflTeamCodes';
import type { SleeperHistoricalTeamMaps } from './sleeperMatchupActuals';

export type HistoricalPlayerTeamInputRow = {
  playerId?: string | number | null;
  sourcePlayerId?: string | number | null;
  playerName?: string | null;
  season?: string | number | null;
  week?: string | number | null;
  team?: string | null;
  source?: string | null;
  confidence?: string | number | null;
  updatedAt?: string | null;
};

export type HistoricalPlayerTeamResolution = 'season-week' | 'season' | 'player' | 'missing' | 'conflict';

export type HistoricalPlayerTeamEntry = {
  key: string;
  playerId: string;
  playerName: string | null;
  season: string | null;
  week: number | null;
  team: NflTeamCode;
  source: string;
  confidence: number;
  evidenceCount: number;
  updatedAt: string | null;
};

export type HistoricalPlayerTeamConflict = {
  key: string;
  scope: Exclude<HistoricalPlayerTeamResolution, 'missing'>;
  playerId: string;
  season: string | null;
  week: number | null;
  teams: NflTeamCode[];
  reason: string;
  sources: string[];
};

export type HistoricalPlayerTeamCoverage = {
  inputRows: number;
  usableRows: number;
  skippedRows: number;
  sourceCount: number;
  playerCount: number;
  seasonWeekKeys: number;
  seasonKeys: number;
  playerKeys: number;
  conflictCount: number;
};

export type HistoricalPlayerTeamMap = {
  schemaVersion: 1;
  generatedFrom: 'historical-player-team-rows';
  rowCount: number;
  sourceCount: number;
  byPlayerSeasonWeek: Record<string, HistoricalPlayerTeamEntry>;
  byPlayerSeason: Record<string, HistoricalPlayerTeamEntry>;
  byPlayerId: Record<string, HistoricalPlayerTeamEntry>;
  conflicts: HistoricalPlayerTeamConflict[];
  coverage: HistoricalPlayerTeamCoverage;
};

export type ResolveHistoricalPlayerTeamInput = {
  playerId?: string | number | null;
  sourcePlayerId?: string | number | null;
  season?: string | number | null;
  week?: string | number | null;
};

export type ResolvedHistoricalPlayerTeam = {
  resolution: HistoricalPlayerTeamResolution;
  entry: HistoricalPlayerTeamEntry | null;
  reason: string;
};

type Candidate = HistoricalPlayerTeamEntry & {
  sources: Set<string>;
};

type CandidateIndex = Record<string, Candidate[]>;

function cleanText(value: unknown): string | null {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean || null;
}

function cleanId(value: unknown): string | null {
  const clean = cleanText(value);
  return clean && clean !== '0' ? clean : null;
}

function seasonKey(value: unknown): string | null {
  const clean = cleanText(value);
  return clean ? clean.replace(/\.0$/, '') : null;
}

function weekNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function clampConfidence(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 70;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function getHistoricalPlayerTeamKey(playerId: string | number, season?: string | number | null, week?: string | number | null): string {
  const id = cleanId(playerId) || 'unknown';
  const cleanSeason = seasonKey(season);
  const cleanWeek = weekNumber(week);
  if (cleanSeason && cleanWeek !== null) return `${id}:${cleanSeason}:${cleanWeek}`;
  if (cleanSeason) return `${id}:${cleanSeason}`;
  return id;
}

function addCandidate(index: CandidateIndex, entry: HistoricalPlayerTeamEntry) {
  const existing = index[entry.key]?.find(candidate => candidate.team === entry.team);
  if (existing) {
    existing.evidenceCount += entry.evidenceCount;
    existing.confidence = Math.max(existing.confidence, entry.confidence);
    existing.updatedAt = existing.updatedAt || entry.updatedAt;
    existing.playerName = existing.playerName || entry.playerName;
    existing.sources.add(entry.source);
    existing.source = Array.from(existing.sources).sort().join(', ');
    return;
  }
  index[entry.key] = index[entry.key] || [];
  index[entry.key].push({ ...entry, sources: new Set([entry.source]) });
}

function conflictFromCandidates(
  key: string,
  scope: Exclude<HistoricalPlayerTeamResolution, 'missing'>,
  candidates: Candidate[],
  reason: string
): HistoricalPlayerTeamConflict {
  const first = candidates[0];
  return {
    key,
    scope,
    playerId: first?.playerId || key.split(':')[0] || key,
    season: first?.season ?? null,
    week: first?.week ?? null,
    teams: Array.from(new Set(candidates.map(candidate => candidate.team))).sort(),
    reason,
    sources: Array.from(new Set(candidates.flatMap(candidate => Array.from(candidate.sources)))).sort(),
  };
}

function resolveCandidateIndex(
  index: CandidateIndex,
  scope: Exclude<HistoricalPlayerTeamResolution, 'missing'>,
  conflicts: HistoricalPlayerTeamConflict[]
): Record<string, HistoricalPlayerTeamEntry> {
  const resolved: Record<string, HistoricalPlayerTeamEntry> = {};

  for (const [key, candidates] of Object.entries(index)) {
    const sorted = [...candidates].sort((a, b) => (
      b.confidence - a.confidence
      || b.evidenceCount - a.evidenceCount
      || a.team.localeCompare(b.team)
    ));
    const leader = sorted[0];
    const runnerUp = sorted[1];
    if (!leader) continue;

    if (runnerUp && leader.confidence - runnerUp.confidence < 15) {
      conflicts.push(conflictFromCandidates(key, scope, sorted, 'Conflicting teams without a clear confidence lead'));
      continue;
    }

    const { sources: _sources, ...entry } = leader;
    resolved[key] = entry;
  }

  return resolved;
}

function deriveSeasonCandidates(seasonWeekEntries: Record<string, HistoricalPlayerTeamEntry>, explicitSeasonIndex: CandidateIndex): CandidateIndex {
  const index: CandidateIndex = { ...explicitSeasonIndex };
  const bySeason = new Map<string, HistoricalPlayerTeamEntry[]>();

  Object.values(seasonWeekEntries).forEach(entry => {
    if (!entry.season) return;
    const key = getHistoricalPlayerTeamKey(entry.playerId, entry.season, null);
    const rows = bySeason.get(key) || [];
    rows.push(entry);
    bySeason.set(key, rows);
  });

  bySeason.forEach((rows, key) => {
    if (index[key]?.length) return;
    const teams = Array.from(new Set(rows.map(row => row.team)));
    if (teams.length !== 1) return;
    const first = rows[0];
    if (!first) return;
    addCandidate(index, {
      key,
      playerId: first.playerId,
      playerName: first.playerName,
      season: first.season,
      week: null,
      team: first.team,
      source: Array.from(new Set(rows.map(row => row.source))).sort().join(', '),
      confidence: Math.min(92, Math.max(...rows.map(row => row.confidence))),
      evidenceCount: rows.reduce((sum, row) => sum + row.evidenceCount, 0),
      updatedAt: first.updatedAt,
    });
  });

  return index;
}

function derivePlayerCandidates(entries: HistoricalPlayerTeamEntry[]): CandidateIndex {
  const index: CandidateIndex = {};
  const byPlayer = new Map<string, HistoricalPlayerTeamEntry[]>();

  entries.forEach(entry => {
    const rows = byPlayer.get(entry.playerId) || [];
    rows.push(entry);
    byPlayer.set(entry.playerId, rows);
  });

  byPlayer.forEach((rows, playerId) => {
    const teams = Array.from(new Set(rows.map(row => row.team)));
    if (teams.length !== 1) return;
    const first = rows[0];
    if (!first) return;
    addCandidate(index, {
      key: playerId,
      playerId,
      playerName: first.playerName,
      season: null,
      week: null,
      team: first.team,
      source: Array.from(new Set(rows.map(row => row.source))).sort().join(', '),
      confidence: Math.min(88, Math.max(...rows.map(row => row.confidence))),
      evidenceCount: rows.reduce((sum, row) => sum + row.evidenceCount, 0),
      updatedAt: first.updatedAt,
    });
  });

  return index;
}

export function buildHistoricalPlayerTeamMap(rows: HistoricalPlayerTeamInputRow[]): HistoricalPlayerTeamMap {
  const seasonWeekIndex: CandidateIndex = {};
  const explicitSeasonIndex: CandidateIndex = {};
  const directPlayerIndex: CandidateIndex = {};
  const conflicts: HistoricalPlayerTeamConflict[] = [];
  const sources = new Set<string>();
  const players = new Set<string>();
  let usableRows = 0;

  rows.forEach(row => {
    const playerId = cleanId(row.playerId) || cleanId(row.sourcePlayerId);
    const season = seasonKey(row.season);
    const week = weekNumber(row.week);
    const team = normalizeNflTeamCode(row.team);
    const source = cleanText(row.source) || 'historical-team-row';
    if (!playerId || !team) return;

    usableRows += 1;
    sources.add(source);
    players.add(playerId);

    if (season && week !== null) {
      addCandidate(seasonWeekIndex, {
        key: getHistoricalPlayerTeamKey(playerId, season, week),
        playerId,
        playerName: cleanText(row.playerName),
        season,
        week,
        team,
        source,
        confidence: clampConfidence(row.confidence),
        evidenceCount: 1,
        updatedAt: cleanText(row.updatedAt),
      });
      return;
    }

    if (season) {
      addCandidate(explicitSeasonIndex, {
        key: getHistoricalPlayerTeamKey(playerId, season, null),
        playerId,
        playerName: cleanText(row.playerName),
        season,
        week: null,
        team,
        source,
        confidence: clampConfidence(row.confidence),
        evidenceCount: 1,
        updatedAt: cleanText(row.updatedAt),
      });
      return;
    }

    addCandidate(directPlayerIndex, {
      key: getHistoricalPlayerTeamKey(playerId, null, null),
      playerId,
      playerName: cleanText(row.playerName),
      season: null,
      week: null,
      team,
      source,
      confidence: clampConfidence(row.confidence),
      evidenceCount: 1,
      updatedAt: cleanText(row.updatedAt),
    });
  });

  const byPlayerSeasonWeek = resolveCandidateIndex(seasonWeekIndex, 'season-week', conflicts);
  const byPlayerSeason = resolveCandidateIndex(deriveSeasonCandidates(byPlayerSeasonWeek, explicitSeasonIndex), 'season', conflicts);
  const derivedPlayerIndex = derivePlayerCandidates([
    ...Object.values(byPlayerSeasonWeek),
    ...Object.values(byPlayerSeason),
  ]);
  Object.entries(directPlayerIndex).forEach(([key, candidates]) => {
    candidates.forEach(candidate => addCandidate(derivedPlayerIndex, { ...candidate, key }));
  });
  const byPlayerId = resolveCandidateIndex(derivedPlayerIndex, 'player', conflicts);

  return {
    schemaVersion: 1,
    generatedFrom: 'historical-player-team-rows',
    rowCount: rows.length,
    sourceCount: sources.size,
    byPlayerSeasonWeek,
    byPlayerSeason,
    byPlayerId,
    conflicts,
    coverage: {
      inputRows: rows.length,
      usableRows,
      skippedRows: rows.length - usableRows,
      sourceCount: sources.size,
      playerCount: players.size,
      seasonWeekKeys: Object.keys(byPlayerSeasonWeek).length,
      seasonKeys: Object.keys(byPlayerSeason).length,
      playerKeys: Object.keys(byPlayerId).length,
      conflictCount: conflicts.length,
    },
  };
}

export function resolveHistoricalPlayerTeam(
  map: HistoricalPlayerTeamMap | null | undefined,
  input: ResolveHistoricalPlayerTeamInput
): ResolvedHistoricalPlayerTeam {
  const playerId = cleanId(input.playerId) || cleanId(input.sourcePlayerId);
  if (!map || !playerId) {
    return { resolution: 'missing', entry: null, reason: 'No historical player-team map or player id available' };
  }

  const season = seasonKey(input.season);
  const week = weekNumber(input.week);
  if (season && week !== null) {
    const key = getHistoricalPlayerTeamKey(playerId, season, week);
    const entry = map.byPlayerSeasonWeek[key];
    if (entry) return { resolution: 'season-week', entry, reason: `Resolved exact team for ${key}` };
    if (map.conflicts.some(conflict => conflict.key === key)) {
      return { resolution: 'conflict', entry: null, reason: `Conflicting teams for ${key}` };
    }
  }

  if (season) {
    const key = getHistoricalPlayerTeamKey(playerId, season, null);
    const entry = map.byPlayerSeason[key];
    if (entry) return { resolution: 'season', entry, reason: `Resolved season team for ${key}` };
    if (map.conflicts.some(conflict => conflict.key === key)) {
      return { resolution: 'conflict', entry: null, reason: `Conflicting season teams for ${key}` };
    }
  }

  const entry = map.byPlayerId[playerId];
  if (entry) return { resolution: 'player', entry, reason: `Resolved stable career team for ${playerId}` };
  if (map.conflicts.some(conflict => conflict.playerId === playerId && conflict.scope === 'player')) {
    return { resolution: 'conflict', entry: null, reason: `Conflicting career teams for ${playerId}` };
  }

  return { resolution: 'missing', entry: null, reason: `No historical team found for ${playerId}` };
}

export function toSleeperHistoricalTeamMaps(map: HistoricalPlayerTeamMap | null | undefined): SleeperHistoricalTeamMaps | undefined {
  if (!map) return undefined;
  return {
    byPlayerSeasonWeek: Object.fromEntries(Object.entries(map.byPlayerSeasonWeek).map(([key, entry]) => [key, entry.team])),
    byPlayerSeason: Object.fromEntries(Object.entries(map.byPlayerSeason).map(([key, entry]) => [key, entry.team])),
    byPlayerId: Object.fromEntries(Object.entries(map.byPlayerId).map(([key, entry]) => [key, entry.team])),
  };
}
