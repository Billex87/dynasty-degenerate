import type { ReportData } from '../shared/types';

type SlimmingStats = {
  compactedEmbeddedPlayerDetails: number;
  compactedEmbeddedPlayerDetailsBytes: number;
  compactedRankingProspectProfiles: number;
  compactedRankingProspectProfileBytes: number;
  removedRankingLegacyArrays: number;
  removedRankingLegacyArrayBytes: number;
};

type SlimmingResult<T> = {
  payload: T;
  stats: SlimmingStats;
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function jsonSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return 0;
  }
}

function createSlimmingStats(): SlimmingStats {
  return {
    compactedEmbeddedPlayerDetails: 0,
    compactedEmbeddedPlayerDetailsBytes: 0,
    compactedRankingProspectProfiles: 0,
    compactedRankingProspectProfileBytes: 0,
    removedRankingLegacyArrays: 0,
    removedRankingLegacyArrayBytes: 0,
  };
}

function hasSlimmingChanges(stats: SlimmingStats): boolean {
  return stats.compactedEmbeddedPlayerDetails > 0
    || stats.compactedRankingProspectProfiles > 0
    || stats.removedRankingLegacyArrays > 0;
}

function compactPlayerDetails(details: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    [
      'fullName',
      'team',
      'position',
      'age',
      'rookieYear',
      'rosterStatus',
      'status',
      'displayStatus',
      'injuryStatus',
      'sleeperDepthChartPosition',
      'sleeperDepthChartOrder',
      'depthChartPosition',
      'depthChartOrder',
      'depthChartVerified',
      'depthChartMismatch',
    ]
      .filter((key) => details[key] !== undefined)
      .map((key) => [key, details[key]])
  );
}

function compactRankingProspectProfile(profile: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(profile)
      .filter(([key, value]) => value !== undefined && !['summary', 'sourceUrl', 'scrapeMonth'].includes(key))
  );
}

function slimRankingRow(row: unknown, stats: SlimmingStats): unknown {
  if (!isRecord(row) || !isRecord(row.prospectProfile)) return row;

  const compacted = compactRankingProspectProfile(row.prospectProfile);
  const originalBytes = jsonSize(row.prospectProfile);
  const compactedBytes = jsonSize(compacted);
  if (compactedBytes >= originalBytes) return row;

  stats.compactedRankingProspectProfiles += 1;
  stats.compactedRankingProspectProfileBytes += originalBytes - compactedBytes;
  return {
    ...row,
    prospectProfile: compacted,
  };
}

function slimRankingsBoard(rankings: unknown, stats: SlimmingStats): unknown {
  if (!isRecord(rankings)) return rankings;

  let changed = false;
  const next: Record<string, any> = { ...rankings };
  const legacyArrayKeys = [
    'dynastySf',
    'dynastyOneQb',
    'devySf',
    'devyOneQb',
    'redraftPpr',
    'redraftHalfPpr',
    'redraftStandard',
  ];

  for (const key of legacyArrayKeys) {
    if (Array.isArray(next[key]) && next[key].length > 0) {
      stats.removedRankingLegacyArrays += 1;
      stats.removedRankingLegacyArrayBytes += jsonSize(next[key]);
      next[key] = [];
      changed = true;
    }
  }

  if (isRecord(rankings.profiles)) {
    const profiles: Record<string, unknown> = {};
    let profilesChanged = false;

    for (const [key, rows] of Object.entries(rankings.profiles)) {
      if (!Array.isArray(rows)) {
        profiles[key] = rows;
        continue;
      }

      let rowsChanged = false;
      const slimmedRows = rows.map((row) => {
        const slimmed = slimRankingRow(row, stats);
        if (slimmed !== row) rowsChanged = true;
        return slimmed;
      });
      profiles[key] = rowsChanged ? slimmedRows : rows;
      if (rowsChanged) profilesChanged = true;
    }

    if (profilesChanged) {
      next.profiles = profiles;
      changed = true;
    }
  }

  return changed ? next : rankings;
}

function slimValue(value: unknown, detailIds: Set<string>, stats: SlimmingStats, insideDetailMap = false): unknown {
  if (!value || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const slimmed = slimValue(item, detailIds, stats, insideDetailMap);
      if (slimmed !== item) changed = true;
      return slimmed;
    });
    return changed ? next : value;
  }

  const record = value as Record<string, any>;
  let changed = false;
  const next: Record<string, any> = {};
  const playerId = record.player_id === null || record.player_id === undefined ? null : String(record.player_id);
  const canDropEmbeddedDetails = !insideDetailMap && playerId && detailIds.has(playerId) && isRecord(record.playerDetails);

  for (const [key, child] of Object.entries(record)) {
    if (key === 'playerDetails' && canDropEmbeddedDetails) {
      const compacted = compactPlayerDetails(child);
      const originalBytes = jsonSize(child);
      const compactedBytes = jsonSize(compacted);
      if (compactedBytes < originalBytes) {
        next[key] = compacted;
        stats.compactedEmbeddedPlayerDetails += 1;
        stats.compactedEmbeddedPlayerDetailsBytes += originalBytes - compactedBytes;
        changed = true;
        continue;
      }
      next[key] = child;
      continue;
    }

    const slimmed = slimValue(child, detailIds, stats, insideDetailMap || key === 'playerDetailsById');
    next[key] = slimmed;
    if (slimmed !== child) changed = true;
  }

  return changed ? next : value;
}

export function slimReportDataForTransfer<T extends ReportData>(reportData: T): SlimmingResult<T> {
  const detailIds = new Set(Object.keys(reportData.playerDetailsById || {}));
  const stats = createSlimmingStats();
  const slimmedDetails = detailIds.size ? slimValue(reportData, detailIds, stats) : reportData;
  const slimmedRankings = isRecord(slimmedDetails) && isRecord(slimmedDetails.rankings)
    ? slimRankingsBoard(slimmedDetails.rankings, stats)
    : null;

  if (slimmedRankings && isRecord(slimmedDetails) && slimmedRankings !== slimmedDetails.rankings) {
    return {
      payload: {
        ...slimmedDetails,
        rankings: slimmedRankings,
      } as T,
      stats,
    };
  }

  return { payload: slimmedDetails as T, stats };
}

export function slimCachedLeagueReportPayload<T>(payload: T): SlimmingResult<T> {
  if (!isRecord(payload)) {
    return { payload, stats: createSlimmingStats() };
  }

  if (isRecord(payload.reportData)) {
    const { payload: reportData, stats } = slimReportDataForTransfer(payload.reportData as ReportData);
    const slimmedRankings = isRecord(payload.rankings) ? slimRankingsBoard(payload.rankings, stats) : null;
    if (!hasSlimmingChanges(stats)) return { payload, stats };

    return {
      payload: {
        ...payload,
        reportData,
        ...(slimmedRankings && slimmedRankings !== payload.rankings ? { rankings: slimmedRankings } : {}),
      },
      stats,
    };
  }

  if (isRecord(payload.rankings)) {
    const stats = createSlimmingStats();
    const rankings = slimRankingsBoard(payload.rankings, stats);
    if (!hasSlimmingChanges(stats)) return { payload, stats };

    return {
      payload: {
        ...payload,
        rankings,
      },
      stats,
    };
  }

  return { payload, stats: createSlimmingStats() };
}
