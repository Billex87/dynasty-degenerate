import fs from 'fs';
import path from 'path';
import { getCurrentKTCRankingProfiles, getCurrentKTCRankings } from './liveKTCScraper';
import {
  getKtcProfileKeyForValueOptions,
  getValueSourceProfileKey,
  loadBlendedPlayerValues,
  type KtcSnapshotProfileKey,
  type ValueBlendOptions,
} from './valueBlend';
import {
  WEEKLY_MOMENTUM_BASELINE_FLOOR_DATE_KEY,
  getWeeklyMomentumBaselineTargetDateKey,
} from './valueBaselinePolicy';
import { findKtcSnapshotOnOrBefore } from './db';

interface KTCValues {
  [key: string]: {
    name: string;
    ktc_value: number;
    position_rank?: string;
    dynasty_value?: number;
    true_value?: number;
    redraft_value?: number;
    market_value_ktc?: number;
    expert_value_flock?: number;
    flock_rank?: number;
    flock_position_rank?: string | null;
    flock_tier?: number | null;
    flock_format?: string | null;
    flock_best_ball_value?: number;
    flock_best_ball_rank?: number;
    flock_best_ball_position_rank?: string | null;
    flock_best_ball_format?: string | null;
    expert_value_fantasypros?: number;
    fantasypros_dynasty_rank?: number;
    fantasypros_dynasty_position_rank?: string | null;
    market_value_fantasycalc?: number;
    expert_value_dynastyprocess?: number;
    expert_value_dynastynerds?: number;
    expert_value_fantasynerds?: number;
    fantasynerds_rank?: number;
    fantasynerds_position_rank?: string | null;
    dynastynerds_rank?: number;
    dynastynerds_position_rank?: string | null;
    dynastynerds_format?: string | null;
    benchmark_value_dynastydealer?: number;
    dynastydealer_vote_rating?: number | null;
    dynastydealer_updated_at?: string | null;
    fantasypros_rank?: number;
    fantasypros_position_rank?: string | null;
    fantasypros_tier?: number | null;
    fantasypros_season_value?: number;
    value_sources?: string[];
    benchmark_sources?: string[];
  };
}

type KtcProfileValues = Record<KtcSnapshotProfileKey, KTCValues>;
type FlockSnapshotSourceProfiles = Partial<Record<'SUPERFLEX' | 'ONEQB' | 'PROSPECTS_SF' | 'PROSPECTS', KTCValues>>;

let ktcValuesCache: KTCValues | null = null;
let ktcValuesLastWeekCache: KTCValues | null = null;
let blendedKtcValuesCache: Record<string, KTCValues> = {};
let storedBlendedKtcValuesCache: Record<string, KTCValues> = {};
const localKtcSnapshotCache = new Map<string, KTCValues>();
const KTC_SNAPSHOT_TIME_ZONE = 'America/Vancouver';
const BLENDED_VALUE_PROFILE_KEY_PATTERN = /^(10|12|14)_(one_qb|sf)_(standard|half_ppr|ppr)_(base|tep_0_5|tep_1_0|tep_1_5)$/;
const PRIMARY_VALUE_SOURCES = new Set(['FlockFantasy', 'FantasyPros', 'DynastyNerds', 'FantasyNerds', 'KTC', 'FantasyCalc', 'DynastyProcess']);

export const KTC_SNAPSHOT_DIR = path.join(process.cwd(), 'server', 'ktc-snapshots');
const KTC_STATIC_DIR = path.join(process.cwd(), 'server', 'ktc-static');
const VALUE_HISTORY_SHARDS_DIR = path.join(process.cwd(), 'server', 'value-history-archive', 'player-value-history-shards');

function getSnapshotDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KTC_SNAPSHOT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function cleanTimelineKey(value: string) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export async function loadKTCValues(): Promise<KTCValues> {
  if (ktcValuesCache) return ktcValuesCache;

  const staticValues = loadStaticKTCValues('ktc_values.json');
  const liveValues = await loadLiveKTCValues();
  if (Object.keys(liveValues).length > 0) {
    ktcValuesCache = {
      ...staticValues,
      ...liveValues,
    };
    return ktcValuesCache;
  }

  ktcValuesCache = staticValues;
  return ktcValuesCache;
}

type KtcValueLoadOptions = {
  sourceMode?: 'live' | 'snapshot';
};

async function loadStoredBlendedKTCValues(valueProfileKey: string): Promise<KTCValues> {
  if (storedBlendedKtcValuesCache[valueProfileKey]) return storedBlendedKtcValuesCache[valueProfileKey];

  try {
    const storedPayload = await findKtcSnapshotOnOrBefore(new Date());
    if (storedPayload) {
      const values = unwrapSnapshotValues(JSON.parse(storedPayload), valueProfileKey);
      if (hasUsableBlendedSnapshotValues(values, valueProfileKey)) {
        storedBlendedKtcValuesCache[valueProfileKey] = values;
        return values;
      }
    }
  } catch (error) {
    console.warn('[KTC Snapshot] Failed to load database snapshot for interactive values:', error);
  }

  const localValues = loadLatestLocalKtcSnapshotDaysAgo(0, valueProfileKey);
  if (Object.keys(localValues).length > 0) {
    storedBlendedKtcValuesCache[valueProfileKey] = localValues;
    return localValues;
  }

  return {};
}

export async function loadBlendedKTCValues(
  options: ValueBlendOptions = {},
  loadOptions: KtcValueLoadOptions = {}
): Promise<KTCValues> {
  const ktcProfileKey = options.ktcProfileKey || getKtcProfileKeyForValueOptions(options);
  const cacheKey = getValueSourceProfileKey({ ...options, ktcProfileKey });
  if (loadOptions.sourceMode === 'snapshot') {
    return loadStoredBlendedKTCValues(cacheKey);
  }

  if (blendedKtcValuesCache[cacheKey]) return blendedKtcValuesCache[cacheKey];

  const defaultKtcValues = await loadKTCValues();
  let profileKtcValues = defaultKtcValues;

  if (ktcProfileKey !== 'sf_ppr') {
    const profiles = await loadLiveKTCValueProfiles(false);
    const selectedProfile = profiles[ktcProfileKey];
    if (selectedProfile && Object.keys(selectedProfile).length > 0) {
      profileKtcValues = {
        ...defaultKtcValues,
        ...selectedProfile,
      };
    }
  }

  const liveBlendedValues = await loadBlendedPlayerValues(profileKtcValues, {
    ...options,
    ktcProfileKey,
  });
  if (Object.keys(liveBlendedValues).length > 0) {
    blendedKtcValuesCache[cacheKey] = liveBlendedValues;
    return blendedKtcValuesCache[cacheKey];
  }

  const storedSnapshotValues = loadLatestLocalKtcSnapshotDaysAgo(0, cacheKey);
  if (Object.keys(storedSnapshotValues).length > 0) {
    blendedKtcValuesCache[cacheKey] = storedSnapshotValues;
    return blendedKtcValuesCache[cacheKey];
  }

  blendedKtcValuesCache[cacheKey] = liveBlendedValues;
  return blendedKtcValuesCache[cacheKey];
}

function loadStaticKTCValues(fileName: string): KTCValues {
  try {
    const candidatePaths = [
      path.join(KTC_STATIC_DIR, fileName),
      path.join(process.cwd(), 'client', 'public', fileName),
    ];
    const filePath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));
    if (!filePath) return {};
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) || {};
  } catch (error) {
    console.error('Failed to load KTC values:', error);
    return {};
  }
}

function unwrapSnapshotValues(data: any, valueProfileKey?: string): KTCValues {
  const flockSourceProfiles = data?.sourceProfiles?.flockFantasy as FlockSnapshotSourceProfiles | undefined;
  const sanitizeValues = (values: KTCValues) => sanitizeKtcSnapshotValues(values, flockSourceProfiles);

  if (
    valueProfileKey &&
    data &&
    typeof data === 'object' &&
    data.blendedProfiles &&
    typeof data.blendedProfiles === 'object' &&
    data.blendedProfiles[valueProfileKey] &&
    typeof data.blendedProfiles[valueProfileKey] === 'object'
  ) {
    return sanitizeValues(data.blendedProfiles[valueProfileKey] as KTCValues);
  }

  if (data && typeof data === 'object' && data.values && typeof data.values === 'object') {
    return sanitizeValues(data.values as KTCValues);
  }

  return sanitizeValues((data || {}) as KTCValues);
}

function hasFlockSourceProfile(
  key: string,
  flockSourceProfiles: FlockSnapshotSourceProfiles | undefined,
  formats: Array<keyof FlockSnapshotSourceProfiles>
): boolean {
  return formats.some((format) => Boolean(flockSourceProfiles?.[format]?.[key]));
}

function sanitizeLowConfidenceFlockProspectValue(
  key: string,
  value: KTCValues[string],
  flockSourceProfiles?: FlockSnapshotSourceProfiles
): KTCValues[string] | null {
  const sources = new Set(value.value_sources || []);
  const hasFlockValue = sources.has('FlockFantasy') || Boolean(value.expert_value_flock);
  if (!hasFlockValue) return value;

  const hasProspectProfile = hasFlockSourceProfile(key, flockSourceProfiles, ['PROSPECTS_SF', 'PROSPECTS']);
  const hasFullProfile = hasFlockSourceProfile(key, flockSourceProfiles, ['SUPERFLEX', 'ONEQB']);
  const markedProspectFlock = Boolean(value.flock_format?.startsWith('PROSPECTS')) || (hasProspectProfile && !hasFullProfile);
  if (!markedProspectFlock) return value;

  const fallbackValue = [
    value.market_value_ktc,
    value.market_value_fantasycalc,
    value.expert_value_dynastynerds,
    value.expert_value_fantasynerds,
    value.expert_value_fantasypros,
    value.expert_value_dynastyprocess,
  ].map(candidate => Number(candidate || 0)).find(candidate => Number.isFinite(candidate) && candidate > 0) || 0;
  if (!Number.isFinite(fallbackValue) || fallbackValue <= 0) return null;

  const roundedFallback = Math.round(fallbackValue);
  const nextSources = (value.value_sources || []).filter((source) => source !== 'FlockFantasy');

  return {
    ...value,
    ktc_value: roundedFallback,
    dynasty_value: roundedFallback,
    true_value: roundedFallback,
    position_rank: undefined,
    expert_value_flock: undefined,
    flock_rank: undefined,
    flock_position_rank: undefined,
    flock_tier: undefined,
    flock_format: undefined,
    value_sources: nextSources.length ? nextSources : undefined,
  };
}

export function sanitizeKtcSnapshotValues(
  values: KTCValues,
  flockSourceProfiles?: FlockSnapshotSourceProfiles
): KTCValues {
  return Object.fromEntries(
    Object.entries(values || {})
      .map(([key, value]) => [key, sanitizeLowConfidenceFlockProspectValue(key, value, flockSourceProfiles)] as const)
      .filter((entry): entry is [string, KTCValues[string]] => Boolean(entry[1]))
  );
}

export function hasUsableBlendedSnapshotValues(values: KTCValues, valueProfileKey?: string): boolean {
  const rows = Object.values(values || {});
  if (!rows.length) return false;
  if (!valueProfileKey || !BLENDED_VALUE_PROFILE_KEY_PATTERN.test(valueProfileKey)) return true;

  return rows.some((value) => (
    Array.isArray(value.value_sources)
    && value.value_sources.some((source) => PRIMARY_VALUE_SOURCES.has(source))
  ));
}

export async function loadLiveKTCValues(forceRefresh = false): Promise<KTCValues> {
  try {
    const rankings = await getCurrentKTCRankings(forceRefresh);
    return Object.fromEntries(
      Object.entries(rankings).map(([key, player]) => [
        key,
        {
          name: player.name,
          ktc_value: player.ktc_value,
          position_rank: player.position_rank,
        },
      ])
    );
  } catch (error) {
    console.warn('Failed to load live KTC values:', error);
    return {};
  }
}

export async function loadLiveKTCValueProfiles(forceRefresh = false): Promise<Partial<KtcProfileValues>> {
  try {
    const profiles = await getCurrentKTCRankingProfiles(forceRefresh);
    return Object.fromEntries(
      Object.entries(profiles).map(([profileKey, rankings]) => [
        profileKey,
        Object.fromEntries(
          Object.entries(rankings).map(([key, player]) => [
            key,
            {
              name: player.name,
              ktc_value: player.ktc_value,
              position_rank: player.position_rank,
            },
          ])
        ),
      ])
    ) as Partial<KtcProfileValues>;
  } catch (error) {
    console.warn('Failed to load live KTC value profiles:', error);
    return {};
  }
}

export async function loadKTCValuesLastWeek(): Promise<KTCValues> {
  if (ktcValuesLastWeekCache) return ktcValuesLastWeekCache;

  ktcValuesLastWeekCache = loadStaticKTCValues('ktc_values_last_week.json');
  return ktcValuesLastWeekCache;
}

export function loadLatestLocalKtcSnapshot(): KTCValues {
  return loadLatestLocalKtcSnapshotBefore(new Date());
}

export function listLocalKtcSnapshotDateKeysSince(startDate: Date): string[] {
  try {
    if (!fs.existsSync(KTC_SNAPSHOT_DIR)) return [];
    const startDateKey = getSnapshotDateKey(startDate);
    return fs
      .readdirSync(KTC_SNAPSHOT_DIR)
      .map((file) => file.match(/^ktc-snapshot-(\d{4}-\d{2}-\d{2})\.json$/)?.[1] || null)
      .filter((dateKey): dateKey is string => Boolean(dateKey && dateKey >= startDateKey))
      .sort();
  } catch (error) {
    console.error('Failed to list local KTC snapshots:', error);
    return [];
  }
}

export function loadLocalKtcSnapshotForDate(dateKey: string, valueProfileKey?: string): KTCValues {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return {};
    const cacheKey = `date:${dateKey}:${valueProfileKey || 'default'}`;
    const cached = localKtcSnapshotCache.get(cacheKey);
    if (cached) return cached;

    const filePath = path.join(KTC_SNAPSHOT_DIR, `ktc-snapshot-${dateKey}.json`);
    if (!fs.existsSync(filePath)) return {};

    const data = fs.readFileSync(filePath, 'utf-8');
    const values = unwrapSnapshotValues(JSON.parse(data), valueProfileKey);
    localKtcSnapshotCache.set(cacheKey, values);
    return values;
  } catch (error) {
    console.error('Failed to load local KTC snapshot:', error);
    return {};
  }
}

export function loadLatestLocalKtcSnapshotBefore(beforeDate: Date, valueProfileKey?: string): KTCValues {
  try {
    if (!fs.existsSync(KTC_SNAPSHOT_DIR)) return {};
    const beforeDateKey = getSnapshotDateKey(beforeDate);
    const cacheKey = `before:${beforeDateKey}:${valueProfileKey || 'default'}`;
    const cached = localKtcSnapshotCache.get(cacheKey);
    if (cached) return cached;

    const snapshotFiles = fs
      .readdirSync(KTC_SNAPSHOT_DIR)
      .filter(file => /^ktc-snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .filter(file => file.replace('ktc-snapshot-', '').replace('.json', '') < beforeDateKey)
      .sort();

    for (const snapshotFile of snapshotFiles.reverse()) {
      const data = fs.readFileSync(path.join(KTC_SNAPSHOT_DIR, snapshotFile), 'utf-8');
      const values = unwrapSnapshotValues(JSON.parse(data), valueProfileKey);
      if (!hasUsableBlendedSnapshotValues(values, valueProfileKey)) {
        console.warn(`[KTC Snapshot] Skipping ${snapshotFile} for ${valueProfileKey || 'default'} because it is missing blended source metadata`);
        continue;
      }

      localKtcSnapshotCache.set(cacheKey, values);
      return values;
    }

    return {};
  } catch (error) {
    console.error('Failed to load local KTC snapshot:', error);
    return {};
  }
}

function loadLatestLocalKtcSnapshotOnOrBeforeDateKey(
  maxDateKey: string,
  valueProfileKey?: string,
  minDateKey?: string
): KTCValues {
  try {
    if (!fs.existsSync(KTC_SNAPSHOT_DIR)) return {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(maxDateKey)) return {};
    if (minDateKey && !/^\d{4}-\d{2}-\d{2}$/.test(minDateKey)) return {};

    const cacheKey = `on-or-before:${maxDateKey}:${minDateKey || 'none'}:${valueProfileKey || 'default'}`;
    const cached = localKtcSnapshotCache.get(cacheKey);
    if (cached) return cached;

    const snapshotFiles = fs
      .readdirSync(KTC_SNAPSHOT_DIR)
      .filter(file => /^ktc-snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .filter(file => {
        const dateKey = file.replace('ktc-snapshot-', '').replace('.json', '');
        return dateKey <= maxDateKey && (!minDateKey || dateKey >= minDateKey);
      })
      .sort();

    for (const snapshotFile of snapshotFiles.reverse()) {
      const data = fs.readFileSync(path.join(KTC_SNAPSHOT_DIR, snapshotFile), 'utf-8');
      const values = unwrapSnapshotValues(JSON.parse(data), valueProfileKey);
      if (!hasUsableBlendedSnapshotValues(values, valueProfileKey)) {
        console.warn(`[KTC Snapshot] Skipping ${snapshotFile} for ${valueProfileKey || 'default'} because it is missing blended source metadata`);
        continue;
      }

      localKtcSnapshotCache.set(cacheKey, values);
      return values;
    }

    return {};
  } catch (error) {
    console.error('Failed to load local KTC snapshot:', error);
    return {};
  }
}

export function loadLatestLocalKtcSnapshotDaysAgo(daysAgo: number, valueProfileKey?: string): KTCValues {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  targetDate.setDate(targetDate.getDate() + 1);
  return loadLatestLocalKtcSnapshotBefore(targetDate, valueProfileKey);
}

export function loadLatestLocalWeeklyMomentumSnapshot(valueProfileKey?: string, daysAgo = 7): KTCValues {
  const targetDateKey = getWeeklyMomentumBaselineTargetDateKey(daysAgo);
  const localSnapshot = loadLatestLocalKtcSnapshotOnOrBeforeDateKey(
    targetDateKey,
    valueProfileKey,
    WEEKLY_MOMENTUM_BASELINE_FLOOR_DATE_KEY
  );
  if (Object.keys(localSnapshot).length > 0) return localSnapshot;

  return loadHistoricalWeeklyMomentumSnapshot(targetDateKey, valueProfileKey);
}

type HistoricalTimelineFormat = {
  format: string;
  rawPointCount?: number;
  asOfPoints?: any[];
  windows?: Record<string, any>;
};

function getHistoricalPointOnOrBefore(format: HistoricalTimelineFormat, targetDateKey: string) {
  const points = (Array.isArray(format.asOfPoints) && format.asOfPoints.length
    ? format.asOfPoints
    : format.windows?.all?.points || []
  ).filter((point: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(point?.date || '')) && Number.isFinite(Number(point?.value)))
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

  let selected: any = null;
  for (const point of points) {
    if (point.date <= targetDateKey) selected = point;
    if (point.date > targetDateKey) break;
  }
  return selected;
}

function isUsableHistoricalBaselinePoint(point: any) {
  return Boolean(point && (Number(point.sourceCount || 0) >= 2 || (Array.isArray(point.sources) && point.sources.length >= 2)));
}

function getHistoricalBaselinePoint(
  formats: Record<string, any>,
  targetDateKey: string,
  valueProfileKey?: string
): any | null {
  if (!formats || typeof formats !== 'object') return null;
  const requestedKey = String(valueProfileKey || '').trim();
  const preferredKeys = [
    requestedKey,
    requestedKey.includes('one_qb') ? 'one_qb_ppr' : 'sf_ppr',
    requestedKey.includes('one_qb') ? 'sf_ppr' : 'one_qb_ppr',
  ].filter(Boolean);
  const candidates = [
    ...preferredKeys.flatMap((key) => formats[key] ? [formats[key]] : []),
    ...Object.values(formats)
      .filter((format): format is HistoricalTimelineFormat => Boolean(format && typeof format === 'object'))
      .sort((a, b) => Number(b.rawPointCount || 0) - Number(a.rawPointCount || 0)),
  ];

  const seen = new Set<HistoricalTimelineFormat>();
  let fallbackPoint: any = null;
  for (const format of candidates) {
    if (seen.has(format)) continue;
    seen.add(format);
    const point = getHistoricalPointOnOrBefore(format, targetDateKey);
    if (!point) continue;
    if (isUsableHistoricalBaselinePoint(point)) return point;
    fallbackPoint = fallbackPoint || point;
  }

  return fallbackPoint;
}

function historicalPointToKtcRow(player: any, point: any): KTCValues[string] | null {
  const value = Math.round(Number(point?.value));
  if (!Number.isFinite(value) || value <= 0) return null;

  return {
    name: player?.name || point?.name || '',
    ktc_value: value,
    dynasty_value: value,
    true_value: value,
    position_rank: point?.rank || null,
    market_value_ktc: point?.marketKtc ?? null,
    market_value_fantasycalc: point?.fantasyCalcDynasty ?? null,
    expert_value_fantasypros: point?.fantasyProsDynasty ?? null,
    expert_value_dynastyprocess: point?.dynastyProcess ?? null,
    expert_value_dynastynerds: point?.dynastyNerds ?? null,
    expert_value_flock: point?.flockFantasy ?? null,
    value_sources: Array.isArray(point?.sources) ? point.sources : [],
  };
}

function loadHistoricalWeeklyMomentumSnapshot(targetDateKey: string, valueProfileKey?: string): KTCValues {
  try {
    const manifestPath = path.join(VALUE_HISTORY_SHARDS_DIR, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return {};

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const shards = Array.isArray(manifest?.shards) ? manifest.shards : [];
    const values: KTCValues = {};

    for (const shard of shards) {
      const shardFile = typeof shard?.file === 'string' ? shard.file : '';
      if (!/^[a-z0-9_/-]+\.json$/i.test(shardFile)) continue;
      const shardPath = path.join(VALUE_HISTORY_SHARDS_DIR, shardFile);
      if (!fs.existsSync(shardPath)) continue;

      const payload = JSON.parse(fs.readFileSync(shardPath, 'utf-8'));
      for (const [playerKey, player] of Object.entries<any>(payload?.players || {})) {
        const point = getHistoricalBaselinePoint(player?.formats || {}, targetDateKey, valueProfileKey);
        const row = historicalPointToKtcRow(player, point);
        if (!row) continue;

        values[cleanTimelineKey(playerKey || player?.key || row.name)] = row;
      }
    }

    return values;
  } catch (error) {
    console.error('Failed to load historical weekly momentum snapshot:', error);
    return {};
  }
}

export function saveLocalKtcSnapshot(date: Date, ktcData: unknown): string | null {
  try {
    if (!fs.existsSync(KTC_SNAPSHOT_DIR)) {
      fs.mkdirSync(KTC_SNAPSHOT_DIR, { recursive: true });
    }

    const dateKey = getSnapshotDateKey(date);
    const filePath = path.join(KTC_SNAPSHOT_DIR, `ktc-snapshot-${dateKey}.json`);
    fs.writeFileSync(filePath, JSON.stringify(ktcData));
    return filePath;
  } catch (error) {
    console.error('Failed to save local KTC snapshot:', error);
    return null;
  }
}

export function clearKTCCache() {
  ktcValuesCache = null;
  ktcValuesLastWeekCache = null;
  blendedKtcValuesCache = {};
  storedBlendedKtcValuesCache = {};
  localKtcSnapshotCache.clear();
}

export { getSnapshotDateKey, KTC_SNAPSHOT_TIME_ZONE };
