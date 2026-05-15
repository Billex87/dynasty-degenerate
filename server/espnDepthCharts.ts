import { findLatestProviderDataSnapshot, upsertProviderDataSnapshot } from './db';
import { getProviderSnapshotDateKey, parseProviderSnapshotPayload } from './providerDataSnapshots';

export interface EspnDepthChartEntry {
  team: string;
  position: string;
  order: number;
  playerName: string;
  espnId: string | null;
  groupName: string | null;
}

interface EspnDepthChartPlayer {
  name?: string;
  displayName?: string;
  shortName?: string;
  href?: string;
  uid?: string;
}

interface EspnDepthChartGroup {
  name?: string;
  rows?: unknown[];
}

export interface EspnTeamDepthChart {
  team: string;
  entries: EspnDepthChartEntry[];
  byEspnId: Map<string, EspnDepthChartEntry[]>;
  byName: Map<string, EspnDepthChartEntry[]>;
}

export interface DepthChartDiagnostics {
  checkedPlayerCount: number;
  matchedPlayerCount: number;
  mismatchCount: number;
  requestedTeams: string[];
  loadedTeams: string[];
  failedTeams: string[];
  durationMs: number;
  generatedAt: string;
}

export interface EspnDepthChartFetchResult {
  playerDepthCharts: Record<string, EspnDepthChartEntry>;
  diagnostics: DepthChartDiagnostics;
}

export interface EspnDepthChartWarmResult {
  requestedTeams: string[];
  loadedTeams: string[];
  failedTeams: string[];
  durationMs: number;
  generatedAt: string;
}

const ESPN_FITT_MARKER = "window['__espnfitt__']=";
const ESPN_DEPTH_CHART_CACHE_TTL_MS = 1000 * 60 * 30;
const ESPN_DEPTH_CHART_CONCURRENCY = 6;
const ESPN_DEPTH_CHART_SNAPSHOT_SOURCE_KEY = 'espn-depth-charts-v1';
const teamDepthChartCache = new Map<string, { expiresAt: number; chart: EspnTeamDepthChart | null }>();

type EspnDepthChartLoadOptions = {
  sourceMode?: 'live' | 'snapshot';
};

type EspnDepthChartSnapshotPayload = {
  schemaVersion: 1;
  generatedAt: string;
  snapshotKey: string;
  teams: Record<string, EspnDepthChartEntry[]>;
};

const ESPN_TEAM_ABBR_BY_SLEEPER_TEAM: Record<string, string> = {
  ARI: 'ari',
  ATL: 'atl',
  BAL: 'bal',
  BUF: 'buf',
  CAR: 'car',
  CHI: 'chi',
  CIN: 'cin',
  CLE: 'cle',
  DAL: 'dal',
  DEN: 'den',
  DET: 'det',
  GB: 'gb',
  HOU: 'hou',
  IND: 'ind',
  JAC: 'jax',
  JAX: 'jax',
  KC: 'kc',
  LA: 'lar',
  LAC: 'lac',
  LAR: 'lar',
  LV: 'lv',
  MIA: 'mia',
  MIN: 'min',
  NE: 'ne',
  NO: 'no',
  NYG: 'nyg',
  NYJ: 'nyj',
  OAK: 'lv',
  PHI: 'phi',
  PIT: 'pit',
  SD: 'lac',
  SEA: 'sea',
  SF: 'sf',
  STL: 'lar',
  TB: 'tb',
  TEN: 'ten',
  WAS: 'wsh',
  WSH: 'wsh',
};

function normalizeTeamAbbr(team: unknown): string | null {
  if (typeof team !== 'string' || !team.trim()) return null;
  return ESPN_TEAM_ABBR_BY_SLEEPER_TEAM[team.trim().toUpperCase()] || team.trim().toLowerCase();
}

function normalizeDepthPosition(position: unknown): string | null {
  if (typeof position !== 'string' || !position.trim()) return null;
  const normalized = position.trim().toUpperCase();
  if (['LWR', 'RWR', 'SWR'].includes(normalized)) return 'WR';
  if (normalized === 'PK') return 'K';
  if (normalized === 'HB') return 'RB';
  return normalized;
}

function normalizeNameKey(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function getPlayerName(player: EspnDepthChartPlayer): string | null {
  return player.displayName || player.name || player.shortName || null;
}

function getEspnId(player: EspnDepthChartPlayer): string | null {
  const uidId = typeof player.uid === 'string' ? player.uid.match(/~a:(\d+)/)?.[1] : null;
  if (uidId) return uidId;
  return typeof player.href === 'string' ? player.href.match(/\/id\/(\d+)/)?.[1] || null : null;
}

function getGroupPriority(groupName: string | null | undefined): number {
  const normalized = (groupName || '').toLowerCase();
  if (normalized.includes('special')) return 3;
  if (normalized.includes('base') || normalized.includes('nickel') || normalized.includes('dime')) return 2;
  return 1;
}

function addIndexValue<T>(map: Map<string, T[]>, key: string | null | undefined, value: T) {
  if (!key) return;
  const current = map.get(key);
  if (current) {
    current.push(value);
  } else {
    map.set(key, [value]);
  }
}

function extractEspnFittPayload(html: string): unknown | null {
  const start = html.indexOf(ESPN_FITT_MARKER);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;
  const objectStart = start + ESPN_FITT_MARKER.length;

  for (let index = objectStart; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(html.slice(objectStart, index + 1));
      }
    }
  }

  return null;
}

function isDepthChartGroup(value: unknown): value is EspnDepthChartGroup {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as EspnDepthChartGroup).name === 'string'
    && Array.isArray((value as EspnDepthChartGroup).rows)
  );
}

function findDepthGroups(value: unknown): EspnDepthChartGroup[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value) && value.every(isDepthChartGroup)) return value;

  const depth = (value as any)?.page?.content?.depth;
  const directGroups = depth?.dethTeamGroups || depth?.depthTeamGroups || depth?.teamGroups || depth?.groups;
  if (Array.isArray(directGroups) && directGroups.every(isDepthChartGroup)) return directGroups;

  for (const child of Object.values(value as Record<string, unknown>)) {
    const found = findDepthGroups(child);
    if (found.length) return found;
  }

  return [];
}

function parseGroupEntries(group: EspnDepthChartGroup, team: string): EspnDepthChartEntry[] {
  const rowsByPosition = new Map<string, EspnDepthChartPlayer[][]>();

  for (const rawRow of group.rows || []) {
    if (!Array.isArray(rawRow) || rawRow.length < 2) continue;
    const position = normalizeDepthPosition(rawRow[0]);
    if (!position) continue;
    const players = rawRow
      .slice(1)
      .filter((item): item is EspnDepthChartPlayer => Boolean(item && typeof item === 'object' && getPlayerName(item as EspnDepthChartPlayer)));
    if (!players.length) continue;
    rowsByPosition.set(position, [...(rowsByPosition.get(position) || []), players]);
  }

  const entries: EspnDepthChartEntry[] = [];
  for (const [position, rows] of Array.from(rowsByPosition.entries())) {
    const maxDepth = Math.max(...rows.map((row) => row.length));
    let order = 1;
    for (let columnIndex = 0; columnIndex < maxDepth; columnIndex += 1) {
      for (const row of rows) {
        const player = row[columnIndex];
        if (!player) continue;
        const playerName = getPlayerName(player);
        if (!playerName) continue;
        entries.push({
          team,
          position,
          order,
          playerName,
          espnId: getEspnId(player),
          groupName: group.name || null,
        });
        order += 1;
      }
    }
  }

  return entries;
}

function indexTeamDepthChart(team: string, entries: EspnDepthChartEntry[]): EspnTeamDepthChart {
  const sortedEntries = [...entries].sort((a, b) => {
    const priorityDelta = getGroupPriority(a.groupName) - getGroupPriority(b.groupName);
    if (priorityDelta !== 0) return priorityDelta;
    if (a.position !== b.position) return a.position.localeCompare(b.position);
    return a.order - b.order;
  });
  const byEspnId = new Map<string, EspnDepthChartEntry[]>();
  const byName = new Map<string, EspnDepthChartEntry[]>();

  for (const entry of sortedEntries) {
    addIndexValue(byEspnId, entry.espnId, entry);
    addIndexValue(byName, normalizeNameKey(entry.playerName), entry);
  }

  return { team, entries: sortedEntries, byEspnId, byName };
}

function parseEspnDepthChartSnapshot(payload?: string | null): EspnDepthChartSnapshotPayload | null {
  const parsed = parseProviderSnapshotPayload<Partial<EspnDepthChartSnapshotPayload>>(payload);
  if (
    parsed?.schemaVersion !== 1 ||
    typeof parsed.snapshotKey !== 'string' ||
    !parsed.teams ||
    typeof parsed.teams !== 'object' ||
    Array.isArray(parsed.teams)
  ) {
    return null;
  }

  return parsed as EspnDepthChartSnapshotPayload;
}

async function loadStoredEspnDepthCharts(teams: string[]): Promise<Map<string, EspnTeamDepthChart | null>> {
  const stored = await findLatestProviderDataSnapshot(ESPN_DEPTH_CHART_SNAPSHOT_SOURCE_KEY);
  const snapshot = parseEspnDepthChartSnapshot(stored?.payload);
  const charts = new Map<string, EspnTeamDepthChart | null>();

  for (const team of teams) {
    const entries = snapshot?.teams?.[team] || null;
    charts.set(team, entries ? indexTeamDepthChart(team, entries) : null);
  }

  return charts;
}

async function persistEspnDepthChartSnapshot(chartsByTeam: Map<string, EspnTeamDepthChart | null>, now = new Date()) {
  const teams = Object.fromEntries(
    Array.from(chartsByTeam.entries())
      .filter((entry): entry is [string, EspnTeamDepthChart] => Boolean(entry[1]))
      .map(([team, chart]) => [team, chart.entries])
  );
  if (!Object.keys(teams).length) return;

  const snapshotKey = getProviderSnapshotDateKey(now);
  const payload: EspnDepthChartSnapshotPayload = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    snapshotKey,
    teams,
  };

  try {
    await upsertProviderDataSnapshot({
      sourceKey: ESPN_DEPTH_CHART_SNAPSHOT_SOURCE_KEY,
      snapshotKey,
      payload: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn('[ESPN Depth Charts] Failed to persist depth chart snapshot:', error);
  }
}

export function parseEspnDepthChartHtml(html: string, team: string): EspnTeamDepthChart | null {
  const payload = extractEspnFittPayload(html);
  if (!payload) return null;

  const groups = findDepthGroups(payload);
  if (!groups.length) return null;

  return indexTeamDepthChart(
    team,
    groups.flatMap((group) => parseGroupEntries(group, team))
  );
}

async function fetchEspnTeamDepthChart(team: string): Promise<EspnTeamDepthChart | null> {
  const now = Date.now();
  const cached = teamDepthChartCache.get(team);
  if (cached && cached.expiresAt > now) return cached.chart;

  try {
    const response = await fetch(`https://www.espn.com/nfl/team/depth/_/name/${team}/data`, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'DynastyDegeneratesBot/1.0 depth-chart-enrichment',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const chart = parseEspnDepthChartHtml(await response.text(), team);
    teamDepthChartCache.set(team, { expiresAt: now + ESPN_DEPTH_CHART_CACHE_TTL_MS, chart });
    return chart;
  } catch (error) {
    console.warn(`[ESPN Depth Charts] Failed to load ${team.toUpperCase()} depth chart:`, error);
    teamDepthChartCache.set(team, { expiresAt: now + 1000 * 60 * 5, chart: null });
    return null;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function selectBestEntry(matches: EspnDepthChartEntry[] | undefined, playerPosition: string | null): EspnDepthChartEntry | null {
  if (!matches?.length) return null;
  const samePosition = playerPosition ? matches.filter((entry) => normalizeDepthPosition(entry.position) === playerPosition) : [];
  const candidates = samePosition.length ? samePosition : matches.filter((entry) => getGroupPriority(entry.groupName) === 1);
  return (candidates.length ? candidates : matches)[0] || null;
}

function normalizeDepthOrder(order: unknown): number | null {
  const numeric = Number(order);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function hasDepthChartMismatch(player: Record<string, any> | undefined, entry: EspnDepthChartEntry | undefined): boolean {
  if (!player || !entry) return false;
  return normalizeDepthPosition(player.depth_chart_position) !== normalizeDepthPosition(entry.position)
    || normalizeDepthOrder(player.depth_chart_order) !== normalizeDepthOrder(entry.order);
}

function getPlayerIdsWithTeam(playerIds: Iterable<string>, players: Record<string, any>): string[] {
  return Array.from(new Set(Array.from(playerIds).filter(Boolean)))
    .filter((playerId) => Boolean(normalizeTeamAbbr(players[playerId]?.team)));
}

export function buildDepthChartDiagnostics(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  chartsByTeam: Map<string, EspnTeamDepthChart | null>,
  playerDepthCharts: Record<string, EspnDepthChartEntry>,
  durationMs = 0
): DepthChartDiagnostics {
  const checkedPlayerIds = getPlayerIdsWithTeam(playerIds, players);
  const requestedTeams = Array.from(chartsByTeam.keys()).sort();
  const loadedTeams = requestedTeams.filter((team) => Boolean(chartsByTeam.get(team)));
  const failedTeams = requestedTeams.filter((team) => !chartsByTeam.get(team));

  return {
    checkedPlayerCount: checkedPlayerIds.length,
    matchedPlayerCount: Object.keys(playerDepthCharts).length,
    mismatchCount: checkedPlayerIds.filter((playerId) => hasDepthChartMismatch(players[playerId], playerDepthCharts[playerId])).length,
    requestedTeams,
    loadedTeams,
    failedTeams,
    durationMs: Math.max(0, Math.round(durationMs)),
    generatedAt: new Date().toISOString(),
  };
}

export function matchEspnDepthChartsToPlayers(
  chartsByTeam: Map<string, EspnTeamDepthChart | null>,
  playerIds: Iterable<string>,
  players: Record<string, any>
): Record<string, EspnDepthChartEntry> {
  const matchedEntries: Record<string, EspnDepthChartEntry> = {};

  for (const playerId of Array.from(new Set(Array.from(playerIds).filter(Boolean)))) {
    const player = players[playerId];
    const team = normalizeTeamAbbr(player?.team);
    if (!player || !team) continue;

    const chart = chartsByTeam.get(team);
    if (!chart) continue;

    const playerPosition = normalizeDepthPosition(player.position);
    const espnId = player.espn_id ? String(player.espn_id) : null;
    const directMatch = selectBestEntry(espnId ? chart.byEspnId.get(espnId) : undefined, playerPosition);
    const nameMatch = directMatch
      || selectBestEntry(chart.byName.get(normalizeNameKey(player.full_name || `${player.first_name || ''} ${player.last_name || ''}`)), playerPosition);

    if (nameMatch && (!playerPosition || normalizeDepthPosition(nameMatch.position) === playerPosition)) {
      matchedEntries[playerId] = nameMatch;
    }
  }

  return matchedEntries;
}

export async function fetchEspnDepthChartsForPlayersWithDiagnostics(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  options: EspnDepthChartLoadOptions = {}
): Promise<EspnDepthChartFetchResult> {
  const startedAt = Date.now();
  const uniquePlayerIds = Array.from(new Set(Array.from(playerIds).filter(Boolean)));
  const uniqueTeams = Array.from(new Set(
    uniquePlayerIds
      .map((playerId) => normalizeTeamAbbr(players[playerId]?.team))
      .filter((team): team is string => Boolean(team))
  ));

  if (!uniqueTeams.length) {
    const emptyCharts = new Map<string, EspnTeamDepthChart | null>();
    return {
      playerDepthCharts: {},
      diagnostics: buildDepthChartDiagnostics(uniquePlayerIds, players, emptyCharts, {}, Date.now() - startedAt),
    };
  }

  const chartsByTeam = options.sourceMode === 'snapshot'
    ? await loadStoredEspnDepthCharts(uniqueTeams)
    : new Map(await mapLimit(uniqueTeams, ESPN_DEPTH_CHART_CONCURRENCY, async (team) => [team, await fetchEspnTeamDepthChart(team)] as const));
  const playerDepthCharts = matchEspnDepthChartsToPlayers(chartsByTeam, uniquePlayerIds, players);
  return {
    playerDepthCharts,
    diagnostics: buildDepthChartDiagnostics(uniquePlayerIds, players, chartsByTeam, playerDepthCharts, Date.now() - startedAt),
  };
}

export async function fetchEspnDepthChartsForPlayers(
  playerIds: Iterable<string>,
  players: Record<string, any>
): Promise<Record<string, EspnDepthChartEntry>> {
  return (await fetchEspnDepthChartsForPlayersWithDiagnostics(playerIds, players)).playerDepthCharts;
}

export async function warmEspnDepthChartsForTeams(teams: Iterable<string>): Promise<EspnDepthChartWarmResult> {
  const startedAt = Date.now();
  const requestedTeams = Array.from(new Set(
    Array.from(teams)
      .map((team) => normalizeTeamAbbr(team))
      .filter((team): team is string => Boolean(team))
  )).sort();
  const charts = await mapLimit(requestedTeams, ESPN_DEPTH_CHART_CONCURRENCY, async (team) => [team, await fetchEspnTeamDepthChart(team)] as const);
  const chartsByTeam = new Map(charts);
  await persistEspnDepthChartSnapshot(chartsByTeam);
  const loadedTeams = requestedTeams.filter((team) => Boolean(chartsByTeam.get(team)));
  const failedTeams = requestedTeams.filter((team) => !chartsByTeam.get(team));

  return {
    requestedTeams,
    loadedTeams,
    failedTeams,
    durationMs: Math.max(0, Math.round(Date.now() - startedAt)),
    generatedAt: new Date().toISOString(),
  };
}
