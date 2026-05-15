import type { DraftBuzzScoreboardEntry, RankingPlayer, RankingsBoard } from '../shared/types';

function emptyLegacyRankings(): Pick<RankingsBoard, 'dynastySf' | 'dynastyOneQb' | 'devySf' | 'devyOneQb' | 'redraftPpr' | 'redraftHalfPpr' | 'redraftStandard'> {
  return {
    dynastySf: [],
    dynastyOneQb: [],
    devySf: [],
    devyOneQb: [],
    redraftPpr: [],
    redraftHalfPpr: [],
    redraftStandard: [],
  };
}

export function buildRankingsMetadata(rankings: RankingsBoard): RankingsBoard {
  const profileRowCounts = Object.fromEntries(
    Object.entries(rankings.profiles || {}).map(([profileKey, rows]) => [
      profileKey,
      Array.isArray(rows) ? rows.length : 0,
    ])
  );

  return {
    generatedAt: rankings.generatedAt,
    selectedProfileKey: rankings.selectedProfileKey,
    selectedProfileLabel: rankings.selectedProfileLabel,
    defaultProfileKey: rankings.defaultProfileKey,
    defaultDevyProfileKey: rankings.defaultDevyProfileKey,
    defaultRedraftProfileKey: rankings.defaultRedraftProfileKey,
    profileOptions: rankings.profileOptions || [],
    sourceWeightProfiles: rankings.sourceWeightProfiles || {},
    profiles: {},
    profileRowCounts,
    draftBuzzScoreboard: [],
    draftBuzzScoreboardCount: rankings.draftBuzzScoreboard?.length || 0,
    identityDiagnostics: rankings.identityDiagnostics || [],
    dynastySourceDiagnostics: rankings.dynastySourceDiagnostics || [],
    redraftSourceDiagnostics: rankings.redraftSourceDiagnostics || [],
    devySourceDiagnostics: rankings.devySourceDiagnostics || [],
    payloadMode: 'metadata',
    ...emptyLegacyRankings(),
  };
}

export function buildRankingProfileDetail(rankings: RankingsBoard, profileKey: string): {
  generatedAt: string;
  profileKey: string;
  rows: RankingPlayer[];
  rowCount: number;
} {
  const rows = rankings.profiles?.[profileKey] || [];
  return {
    generatedAt: rankings.generatedAt,
    profileKey,
    rows,
    rowCount: rows.length,
  };
}

export function buildRankingDraftBuzzDetail(rankings: RankingsBoard): {
  generatedAt: string;
  entries: DraftBuzzScoreboardEntry[];
  rowCount: number;
} {
  const entries = rankings.draftBuzzScoreboard || [];
  return {
    generatedAt: rankings.generatedAt,
    entries,
    rowCount: entries.length,
  };
}
