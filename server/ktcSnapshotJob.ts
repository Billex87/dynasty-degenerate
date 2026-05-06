import { findKtcSnapshotOnOrBefore, getDb, insertKtcSnapshot } from './db';
import { loadKTCValues, loadLiveKTCValueProfiles, loadLiveKTCValues, saveLocalKtcSnapshot } from './ktcLoader';
import {
  DEFAULT_VALUE_SOURCE_PROFILE_KEY,
  KTC_SNAPSHOT_PROFILES,
  VALUE_SOURCE_PROFILE_DEFINITIONS,
  loadBlendedPlayerValues,
  loadBlendedValueProfiles,
  loadValueProfileSources,
} from './valueBlend';

type KTCValueMap = Record<string, {
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
  market_value_fantasycalc?: number;
  expert_value_dynastyprocess?: number;
  expert_value_dynastynerds?: number;
  dynastynerds_rank?: number;
  dynastynerds_position_rank?: string | null;
  dynastynerds_format?: string | null;
  benchmark_value_dynastydealer?: number;
  dynastydealer_vote_rating?: number | null;
  dynastydealer_updated_at?: string | null;
  fantasypros_season_value?: number;
  fantasypros_rank?: number;
  fantasypros_position_rank?: string | null;
  fantasypros_tier?: number | null;
  value_sources?: string[];
  benchmark_sources?: string[];
}>;

type KtcSnapshotPayload = {
  schemaVersion: 4;
  generatedAt: string;
  defaultProfile: string;
  profilesTracked: Array<{
    key: string;
    label: string;
    qbProfile: string;
    tepProfile: string;
    ppr: number;
    status: 'stored' | 'pending';
    note?: string;
  }>;
  valueProfilesTracked: Array<{
    key: string;
    label: string;
    numQbs: number;
    numTeams: number;
    ppr: number;
    tep: number;
    ktcProfileKey: string;
    fantasyProsScoring: string;
    status: 'stored' | 'pending';
    note?: string;
  }>;
  values: KTCValueMap;
  ktcProfiles: Record<string, KTCValueMap>;
  sourceProfiles: {
    fantasyCalc: Record<string, KTCValueMap>;
    flockFantasy: Record<string, KTCValueMap>;
    dynastyNerds: Record<string, KTCValueMap>;
    dynastyProcess: Record<string, KTCValueMap>;
    fantasyPros: Record<string, KTCValueMap>;
    dynastyDealerBenchmark: KTCValueMap;
  };
  blendedProfiles: Record<string, KTCValueMap>;
};

function normalizeSnapshotData(data: unknown): KTCValueMap {
  if (!data || typeof data !== 'object') return {};

  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>)
      .map(([key, value]) => {
        if (typeof value === 'number') {
          return [key, { name: key, ktc_value: value }];
        }

        if (value && typeof value === 'object') {
          const raw = value as Record<string, unknown>;
          const numberField = (field: string) =>
            typeof raw[field] === 'number' ? raw[field] as number : undefined;
          const rawFormat = typeof raw.format === 'string' ? raw.format : undefined;
          const isFlockSource = Boolean(rawFormat && ['SUPERFLEX', 'ONEQB', 'PROSPECTS_SF', 'PROSPECTS'].includes(rawFormat));
          const isDynastyNerdsSource = Boolean(rawFormat && ['PPR', 'SFLEX', 'STD', 'SFLEXTEP'].includes(rawFormat));
          const isFantasyProsSource = numberField('seasonValue') !== undefined || numberField('rankOverall') !== undefined;
          const isDynastyDealerSource = numberField('currentValue') !== undefined || numberField('baseValue') !== undefined;
          const fallbackPositionRank = typeof raw.positionRank === 'string'
            ? raw.positionRank
            : typeof raw.rankPosition === 'string'
              ? raw.rankPosition
              : undefined;
          const primaryValue = numberField('ktc_value')
            ?? numberField('true_value')
            ?? numberField('dynasty_value')
            ?? numberField('dynastyValue')
            ?? numberField('currentValue')
            ?? numberField('baseValue')
            ?? numberField('seasonValue')
            ?? numberField('redraftValue')
            ?? 0;

          if (primaryValue > 0) {
            return [
              key,
              {
                name: typeof raw.name === 'string' ? raw.name : key,
                ktc_value: primaryValue,
                position_rank: typeof raw.position_rank === 'string'
                  ? raw.position_rank
                  : typeof raw.positionRank === 'string'
                    ? raw.positionRank
                    : typeof raw.rankPosition === 'string'
                      ? raw.rankPosition
                      : undefined,
                dynasty_value: numberField('dynasty_value') ?? numberField('dynastyValue'),
                true_value: numberField('true_value'),
                redraft_value: numberField('redraft_value') ?? numberField('redraftValue'),
                market_value_ktc: numberField('market_value_ktc'),
                expert_value_flock: numberField('expert_value_flock') ?? (isFlockSource ? numberField('dynastyValue') : undefined),
                flock_rank: numberField('flock_rank') ?? (isFlockSource ? numberField('overallRank') : undefined),
                flock_position_rank: typeof raw.flock_position_rank === 'string'
                  ? raw.flock_position_rank
                  : isFlockSource ? fallbackPositionRank : undefined,
                flock_tier: numberField('flock_tier') ?? (isFlockSource ? numberField('tier') : undefined),
                flock_format: typeof raw.flock_format === 'string' ? raw.flock_format : isFlockSource ? rawFormat : undefined,
                market_value_fantasycalc: numberField('market_value_fantasycalc')
                  ?? (!isFlockSource && !isDynastyNerdsSource && !isFantasyProsSource && !isDynastyDealerSource ? numberField('dynastyValue') : undefined),
                expert_value_dynastyprocess: numberField('expert_value_dynastyprocess'),
                expert_value_dynastynerds: numberField('expert_value_dynastynerds')
                  ?? (isDynastyNerdsSource ? numberField('dynastyValue') : undefined),
                dynastynerds_rank: numberField('dynastynerds_rank')
                  ?? (isDynastyNerdsSource ? numberField('overallRank') : undefined),
                dynastynerds_position_rank: typeof raw.dynastynerds_position_rank === 'string'
                  ? raw.dynastynerds_position_rank
                  : isDynastyNerdsSource ? fallbackPositionRank : undefined,
                dynastynerds_format: typeof raw.dynastynerds_format === 'string' ? raw.dynastynerds_format : isDynastyNerdsSource ? rawFormat : undefined,
                benchmark_value_dynastydealer: numberField('benchmark_value_dynastydealer')
                  ?? (isDynastyDealerSource ? numberField('currentValue') : undefined),
                dynastydealer_vote_rating: numberField('dynastydealer_vote_rating') ?? numberField('voteRating'),
                dynastydealer_updated_at: typeof raw.dynastydealer_updated_at === 'string'
                  ? raw.dynastydealer_updated_at
                  : typeof raw.updatedAt === 'string'
                    ? raw.updatedAt
                    : undefined,
                fantasypros_season_value: numberField('fantasypros_season_value')
                  ?? (isFantasyProsSource ? numberField('seasonValue') : undefined),
                fantasypros_rank: numberField('fantasypros_rank')
                  ?? (isFantasyProsSource ? numberField('overallRank') ?? numberField('rankOverall') : undefined),
                fantasypros_position_rank: typeof raw.fantasypros_position_rank === 'string'
                  ? raw.fantasypros_position_rank
                  : isFantasyProsSource ? fallbackPositionRank : undefined,
                fantasypros_tier: numberField('fantasypros_tier'),
                value_sources: Array.isArray(raw.value_sources) ? raw.value_sources.filter((item): item is string => typeof item === 'string') : undefined,
                benchmark_sources: Array.isArray(raw.benchmark_sources) ? raw.benchmark_sources.filter((item): item is string => typeof item === 'string') : undefined,
              },
            ];
          }
        }

        return null;
      })
      .filter((entry): entry is [string, KTCValueMap[string]] => entry !== null)
  );
}

function compactSnapshotData(data: KTCValueMap): KTCValueMap {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      {
        name: value.name,
        ktc_value: value.ktc_value,
        position_rank: value.position_rank,
        dynasty_value: value.dynasty_value,
        true_value: value.true_value,
        redraft_value: value.redraft_value,
        market_value_ktc: value.market_value_ktc,
        expert_value_flock: value.expert_value_flock,
        market_value_fantasycalc: value.market_value_fantasycalc,
        expert_value_dynastyprocess: value.expert_value_dynastyprocess,
        expert_value_dynastynerds: value.expert_value_dynastynerds,
        dynastynerds_rank: value.dynastynerds_rank,
        dynastynerds_position_rank: value.dynastynerds_position_rank,
        dynastynerds_format: value.dynastynerds_format,
        fantasypros_season_value: value.fantasypros_season_value,
        fantasypros_rank: value.fantasypros_rank,
        fantasypros_position_rank: value.fantasypros_position_rank,
        benchmark_value_dynastydealer: value.benchmark_value_dynastydealer,
        dynastydealer_vote_rating: value.dynastydealer_vote_rating,
        dynastydealer_updated_at: value.dynastydealer_updated_at,
        value_sources: value.value_sources,
        benchmark_sources: value.benchmark_sources,
      },
    ])
  );
}

/**
 * Store a dated KTC snapshot for historical value-change calculations.
 */
export async function storeKtcSnapshot() {
  try {
    // Force a fresh scrape for scheduled snapshots, then fall back to local data.
    const staticAndCachedKtcData = await loadKTCValues();
    const liveKtcData = await loadLiveKTCValues(true);
    const freshKtcData = Object.keys(liveKtcData).length > 0
      ? { ...staticAndCachedKtcData, ...liveKtcData }
      : staticAndCachedKtcData;
    const [ktcData, liveProfileValues] = await Promise.all([
      loadBlendedPlayerValues(freshKtcData).catch(() => freshKtcData),
      loadLiveKTCValueProfiles(false).catch(() => ({} as Awaited<ReturnType<typeof loadLiveKTCValueProfiles>>)),
    ]);
    
    if (!ktcData || Object.keys(ktcData).length === 0) {
      console.error('[KTC Snapshot] Failed to load KTC data');
      return;
    }

    // Store the snapshot with today's date
    const snapshotDate = new Date();
    const ktcProfiles = Object.fromEntries(
      KTC_SNAPSHOT_PROFILES.map((profile) => [
        profile.key,
        normalizeSnapshotData(
          liveProfileValues[profile.key] && Object.keys(liveProfileValues[profile.key] || {}).length > 0
            ? liveProfileValues[profile.key]
            : profile.key === 'sf_ppr'
              ? freshKtcData
              : {}
        ),
      ])
    );
    const rawSourceProfiles = await loadValueProfileSources();
    const sourceProfiles = {
      fantasyCalc: Object.fromEntries(
        Object.entries(rawSourceProfiles.fantasyCalc).map(([profileKey, values]) => [profileKey, normalizeSnapshotData(values)])
      ),
      flockFantasy: Object.fromEntries(
        Object.entries(rawSourceProfiles.flockFantasy).map(([profileKey, values]) => [profileKey, normalizeSnapshotData(values)])
      ),
      dynastyNerds: Object.fromEntries(
        Object.entries(rawSourceProfiles.dynastyNerds).map(([profileKey, values]) => [profileKey, normalizeSnapshotData(values)])
      ),
      dynastyProcess: Object.fromEntries(
        Object.entries(rawSourceProfiles.dynastyProcess).map(([profileKey, values]) => [profileKey, normalizeSnapshotData(values)])
      ),
      fantasyPros: Object.fromEntries(
        Object.entries(rawSourceProfiles.fantasyPros).map(([profileKey, values]) => [profileKey, normalizeSnapshotData(values)])
      ),
      dynastyDealerBenchmark: normalizeSnapshotData(rawSourceProfiles.dynastyDealerBenchmark),
    };
    const blendedProfiles = await loadBlendedValueProfiles(ktcProfiles, rawSourceProfiles)
      .then((profiles) => Object.fromEntries(
        Object.entries(profiles).map(([profileKey, values]) => [profileKey, compactSnapshotData(normalizeSnapshotData(values))])
      ))
      .catch(() => ({} as Record<string, KTCValueMap>));
    const defaultValues = Object.keys(blendedProfiles[DEFAULT_VALUE_SOURCE_PROFILE_KEY] || {}).length > 0
      ? blendedProfiles[DEFAULT_VALUE_SOURCE_PROFILE_KEY]
      : compactSnapshotData(normalizeSnapshotData(ktcData));
    const snapshotPayload: KtcSnapshotPayload = {
      schemaVersion: 4,
      generatedAt: snapshotDate.toISOString(),
      defaultProfile: DEFAULT_VALUE_SOURCE_PROFILE_KEY,
      profilesTracked: KTC_SNAPSHOT_PROFILES.map((profile) => {
        const storedCount = Object.keys(liveProfileValues[profile.key] || {}).length;
        return {
          ...profile,
          status: storedCount > 0 ? 'stored' : 'pending',
          note: storedCount > 0
            ? `${storedCount} KTC market values stored for this profile.`
            : 'Profile metadata is tracked; dedicated values were not available in this run.',
        };
      }),
      valueProfilesTracked: VALUE_SOURCE_PROFILE_DEFINITIONS.map((profile) => {
        const storedCount = Object.keys(blendedProfiles[profile.key] || {}).length;
        return {
          key: profile.key,
          label: profile.label,
          numQbs: profile.numQbs,
          numTeams: profile.numTeams,
          ppr: profile.ppr,
          tep: profile.tep,
          ktcProfileKey: profile.ktcProfileKey,
          fantasyProsScoring: profile.fantasyProsScoring,
          status: storedCount > 0 ? 'stored' : 'pending',
          note: storedCount > 0
            ? `${storedCount} blended values stored for this league format profile.`
            : 'Profile metadata is tracked; blended values were not available in this run.',
        };
      }),
      values: defaultValues,
      ktcProfiles,
      sourceProfiles,
      blendedProfiles,
    };
    const localFilePath = saveLocalKtcSnapshot(snapshotDate, snapshotPayload);

    const db = await getDb();
    if (!db) {
      console.warn('[KTC Snapshot] Database not available; saved local snapshot only');
      if (localFilePath) {
        console.log(`[KTC Snapshot] Saved local snapshot to ${localFilePath}`);
      }
      return;
    }

    await insertKtcSnapshot(snapshotDate, JSON.stringify(snapshotPayload));

    console.log(`[KTC Snapshot] Successfully stored snapshot for ${snapshotDate.toISOString()}`);
    if (localFilePath) {
      console.log(`[KTC Snapshot] Also saved local snapshot to ${localFilePath}`);
    }
  } catch (error) {
    console.error('[KTC Snapshot] Error storing snapshot:', error);
  }
}

/**
 * Get the latest KTC snapshot from the N-day-old calendar window.
 * Used for Weekly Momentum value-change calculations.
 */
export async function getKtcSnapshotFromDaysAgo(daysAgo: number = 14, valueProfileKey?: string) {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[KTC Snapshot] Database not available, using fallback');
      return null;
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysAgo + 1);
    targetDate.setHours(0, 0, 0, 0);

    const data = await findKtcSnapshotOnOrBefore(targetDate);

    if (!data) {
      console.warn(`[KTC Snapshot] No snapshot found from at least ${daysAgo} days ago`);
      return null;
    }

    const parsed = JSON.parse(data);
    if (
      valueProfileKey &&
      parsed?.blendedProfiles &&
      typeof parsed.blendedProfiles === 'object' &&
      parsed.blendedProfiles[valueProfileKey] &&
      typeof parsed.blendedProfiles[valueProfileKey] === 'object'
    ) {
      return normalizeSnapshotData(parsed.blendedProfiles[valueProfileKey]);
    }

    return normalizeSnapshotData(parsed?.values && typeof parsed.values === 'object' ? parsed.values : parsed);
  } catch (error) {
    console.error('[KTC Snapshot] Error retrieving snapshot:', error);
    return null;
  }
}

export async function getKtcSnapshotFromSevenDaysAgo() {
  return getKtcSnapshotFromDaysAgo(7);
}
