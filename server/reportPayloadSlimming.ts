import type { ReportData } from '../shared/types';

type SlimmingStats = {
  compactedEmbeddedPlayerDetails: number;
  compactedEmbeddedPlayerDetailsBytes: number;
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
  const stats: SlimmingStats = {
    compactedEmbeddedPlayerDetails: 0,
    compactedEmbeddedPlayerDetailsBytes: 0,
  };

  if (!detailIds.size) {
    return { payload: reportData, stats };
  }

  const payload = slimValue(reportData, detailIds, stats) as T;
  return { payload, stats };
}

export function slimCachedLeagueReportPayload<T>(payload: T): SlimmingResult<T> {
  if (!isRecord(payload) || !isRecord(payload.reportData)) {
    return {
      payload,
      stats: {
        compactedEmbeddedPlayerDetails: 0,
        compactedEmbeddedPlayerDetailsBytes: 0,
      },
    };
  }

  const { payload: reportData, stats } = slimReportDataForTransfer(payload.reportData as ReportData);
  if (!stats.compactedEmbeddedPlayerDetails) return { payload, stats };

  return {
    payload: {
      ...payload,
      reportData,
    },
    stats,
  };
}
