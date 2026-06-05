export type SourceReadinessGateStatus =
  | 'blocked'
  | 'research'
  | 'approved-for-snapshot'
  | 'approved-for-public-claim';

export type SourceReadinessEvidence = {
  termsApproval: string | null;
  endpointPath: string | null;
  authModel: string | null;
  rowCount: string | null;
  freshnessTimestamp: string | null;
  rateLimitResult: string | null;
  mappingCoverage: string | null;
  allowedAttributionLanguage: string | null;
};

export type SourceReadinessGate = {
  id: string;
  source: string;
  status: SourceReadinessGateStatus;
  normalReportLoad: 'sleeper-live-only' | 'snapshot-only' | 'blocked';
  publicClaimAllowed: boolean;
  evidence: SourceReadinessEvidence;
  nextAction: string;
};

const PUBLIC_CLAIM_EVIDENCE_FIELDS: Array<keyof SourceReadinessEvidence> = [
  'termsApproval',
  'endpointPath',
  'authModel',
  'rowCount',
  'freshnessTimestamp',
  'rateLimitResult',
  'mappingCoverage',
  'allowedAttributionLanguage',
];

export const SOURCE_READINESS_GATES: SourceReadinessGate[] = [
  {
    id: 'nfl-schedule-games-v1',
    source: 'Full NFL schedule snapshot',
    status: 'approved-for-snapshot',
    normalReportLoad: 'snapshot-only',
    publicClaimAllowed: false,
    evidence: {
      termsApproval: 'Official NFL.com schedule fields or an approved export/API derived from the same fields.',
      endpointPath: 'providerDataSnapshots nfl-schedule-games-v1:{season}:{sourceVersion}',
      authModel: 'Cron/admin snapshot import only; no normal report-load provider call.',
      rowCount: 'Required: all 32 teams and regular-season weeks used by Sleeper/projection joins.',
      freshnessTimestamp: 'Required: sourceVersion, fetchedAt, publishedAt, checksum.',
      rateLimitResult: 'Not applicable to stored approved exports; document provider cadence if API-backed.',
      mappingCoverage: 'Required: team aliases normalize through server/nflTeamCodes.ts.',
      allowedAttributionLanguage: 'Use schedule snapshot or NFL schedule context; do not imply live NFL API calls.',
    },
    nextAction: 'Keep schedule source/version evidence attached to every new schedule snapshot.',
  },
  {
    id: 'draftsharks-sos-v1',
    source: 'DraftSharks SOS snapshot',
    status: 'approved-for-snapshot',
    normalReportLoad: 'snapshot-only',
    publicClaimAllowed: false,
    evidence: {
      termsApproval: 'Approved-access snapshot/export path required; public page scraping is not allowed.',
      endpointPath: 'providerDataSnapshots draftsharks-sos-v1',
      authModel: 'Manual/cron snapshot import from approved access; no DraftSharks live report-load dependency.',
      rowCount: 'Required: QB/RB/WR/TE/K/DEF rows for all NFL teams where available.',
      freshnessTimestamp: 'Required: snapshotKey, updatedAt, source updated timestamp where available.',
      rateLimitResult: 'Weekly/manual snapshot cadence; no user-load rate limit exposure.',
      mappingCoverage: 'Required: team + fantasy position normalization.',
      allowedAttributionLanguage: 'Use schedule/SOS context unless legal/source approval allows provider attribution.',
    },
    nextAction: 'Keep weekly snapshot refresh evidence and stale-row fallback behavior visible in source freshness.',
  },
  {
    id: 'sleeper-weekly-projections-v1',
    source: 'Sleeper weekly projection snapshots',
    status: 'approved-for-snapshot',
    normalReportLoad: 'snapshot-only',
    publicClaimAllowed: false,
    evidence: {
      termsApproval: 'Allowed as stored league-adjacent projection context only; public claims still require rollout gates.',
      endpointPath: 'providerDataSnapshots player-projection-snapshots-v1:sleeper:{scoringProfile}:weekly',
      authModel: 'Cron/admin snapshot refresh; Sleeper live user loads remain limited to selected league state.',
      rowCount: 'Required: non-zero current week rows for active scoring profiles.',
      freshnessTimestamp: 'Required: validForWeek, fetchedAt, providerUpdatedAt when available.',
      rateLimitResult: 'Refresh path must be paced outside user-triggered report loads.',
      mappingCoverage: 'Required: Sleeper player IDs and identity diagnostics not broken.',
      allowedAttributionLanguage: 'Use stored weekly projection only after projection readiness passes; no public provider claim by default.',
    },
    nextAction: 'Keep projection-off sanitizer and readiness checks proving fail-closed fallback.',
  },
  {
    id: 'fantasypros-projections',
    source: 'FantasyPros projections endpoint',
    status: 'blocked',
    normalReportLoad: 'blocked',
    publicClaimAllowed: false,
    evidence: {
      termsApproval: null,
      endpointPath: 'Candidate: /nfl/{season}/projections',
      authModel: 'FantasyPros API key; cron/admin snapshots only after approval.',
      rowCount: 'Blocked until normal rate-limit probe returns stable non-zero rows.',
      freshnessTimestamp: 'Blocked until published/updated timestamps are captured in stored snapshots.',
      rateLimitResult: 'Blocked until paced expanded/projection check has no 429s under normal limits.',
      mappingCoverage: 'Blocked until FantasyPros IDs map to Sleeper IDs with quarantine rows.',
      allowedAttributionLanguage: null,
    },
    nextAction: 'Run CHECK_FANTASYPROS_EXPANDED=true CHECK_FANTASYPROS_PROJECTIONS=true pnpm run check:fantasypros after package approval.',
  },
  {
    id: 'fantasypros-ww',
    source: 'FantasyPros waiver-wire rankings',
    status: 'research',
    normalReportLoad: 'snapshot-only',
    publicClaimAllowed: false,
    evidence: {
      termsApproval: 'Requires FantasyPros API/source approval before production weighting.',
      endpointPath: 'Candidate: /NFL/{season}/consensus-rankings?type=WW',
      authModel: 'FantasyPros API key; cron/admin snapshots only.',
      rowCount: 'Last known Week 1 probe returned 200 with zero rows.',
      freshnessTimestamp: 'Required before use.',
      rateLimitResult: 'Requires closer-to-season paced check.',
      mappingCoverage: 'Requires player ID/name/team mapping validation.',
      allowedAttributionLanguage: null,
    },
    nextAction: 'Recheck closer to season and require non-zero rows before waiver-priority use.',
  },
  {
    id: 'fantasypros-targets',
    source: 'FantasyPros targets endpoint',
    status: 'blocked',
    normalReportLoad: 'blocked',
    publicClaimAllowed: false,
    evidence: {
      termsApproval: null,
      endpointPath: 'Candidate: /nfl/{season}/targets',
      authModel: 'FantasyPros API key with targets entitlement.',
      rowCount: 'Blocked until endpoint returns 200 with non-zero rows.',
      freshnessTimestamp: 'Blocked until source timestamps are captured.',
      rateLimitResult: 'Blocked until package limits are proven safe.',
      mappingCoverage: 'Requires FantasyPros-to-Sleeper player mapping.',
      allowedAttributionLanguage: null,
    },
    nextAction: 'Keep ENABLE_FANTASYPROS_TARGETS_SNAPSHOTS off until package access returns 200.',
  },
  {
    id: 'fantasypros-articles',
    source: 'FantasyPros articles endpoint',
    status: 'blocked',
    normalReportLoad: 'blocked',
    publicClaimAllowed: false,
    evidence: {
      termsApproval: null,
      endpointPath: 'Candidate: /nfl/articles',
      authModel: 'FantasyPros API key with articles entitlement.',
      rowCount: 'Blocked until endpoint returns 200 with usable metadata.',
      freshnessTimestamp: 'Blocked until article publish timestamps are captured.',
      rateLimitResult: 'Blocked until package limits are proven safe.',
      mappingCoverage: 'Requires player/team/topic mapping rules and attribution review.',
      allowedAttributionLanguage: null,
    },
    nextAction: 'Keep ENABLE_FANTASYPROS_ARTICLES_SNAPSHOTS off until package access and editorial-use terms are approved.',
  },
  {
    id: 'fantasypros-news-v1',
    source: 'FantasyPros news snapshot',
    status: 'research',
    normalReportLoad: 'snapshot-only',
    publicClaimAllowed: false,
    evidence: {
      termsApproval: 'Needs production coverage/rate-limit confirmation before public provider-attributed news claims.',
      endpointPath: 'providerDataSnapshots fantasypros-news-v1',
      authModel: 'FantasyPros API key; cron/admin snapshot only.',
      rowCount: 'Required: non-zero current player news rows.',
      freshnessTimestamp: 'Required: publishedAt and snapshot updatedAt.',
      rateLimitResult: 'Required: production package rate-limit check.',
      mappingCoverage: 'Requires player identity matching diagnostics.',
      allowedAttributionLanguage: null,
    },
    nextAction: 'Confirm production FantasyPros news API coverage, cadence, rate limits, and attribution terms.',
  },
  {
    id: 'sportsdataio-news-v1',
    source: 'SportsDataIO/RotoBaller news snapshot',
    status: 'research',
    normalReportLoad: 'snapshot-only',
    publicClaimAllowed: false,
    evidence: {
      termsApproval: 'Requires SportsDataIO news-feed entitlement and RotoBaller usage approval.',
      endpointPath: 'providerDataSnapshots sportsdataio-news-v1; candidate live endpoint /v3/nfl/scores/json/News',
      authModel: 'SportsDataIO API key; cron/admin snapshot only.',
      rowCount: 'Required: non-zero current news rows.',
      freshnessTimestamp: 'Required: publishedAt and snapshot updatedAt.',
      rateLimitResult: 'Required: package limits and call cadence.',
      mappingCoverage: 'Requires SportsDataIO player IDs or name/team mapping to Sleeper.',
      allowedAttributionLanguage: null,
    },
    nextAction: 'Validate package access, endpoint shape, rate limits, and player mapping before model use.',
  },
  {
    id: 'sportsdataio-fantasydata-beyond-news',
    source: 'SportsDataIO/FantasyData players, teams, schedule, injuries, depth charts, scoring, projections, usage routes',
    status: 'research',
    normalReportLoad: 'blocked',
    publicClaimAllowed: false,
    evidence: {
      termsApproval: null,
      endpointPath: 'Candidate endpoint family in probe: players, teams, schedule, injuries, depth charts, projections, route/usage fields.',
      authModel: 'SportsDataIO/FantasyData package key; cron/admin probes only.',
      rowCount: 'Unknown until probe runs with package access.',
      freshnessTimestamp: 'Unknown until probe captures response metadata.',
      rateLimitResult: 'Unknown until package limits are tested.',
      mappingCoverage: 'Unknown until provider player/team IDs are mapped to Sleeper/GSIS.',
      allowedAttributionLanguage: null,
    },
    nextAction: 'Run pnpm run probe:football-data-sources with approved package credentials before wiring any fields.',
  },
  {
    id: 'fantasy-nerds-api',
    source: 'Fantasy Nerds rankings/projections/ADP API',
    status: 'blocked',
    normalReportLoad: 'blocked',
    publicClaimAllowed: false,
    evidence: {
      termsApproval: null,
      endpointPath: 'Candidate: Fantasy Nerds draft-rankings, ADP, dynasty, and projections endpoints.',
      authModel: 'FANTASY_NERDS_API_KEY; TEST key rows are not production evidence.',
      rowCount: 'Blocked until current-season non-TEST rows are confirmed.',
      freshnessTimestamp: 'Blocked until current-season source timestamp is confirmed.',
      rateLimitResult: 'Blocked until package limits are documented.',
      mappingCoverage: 'Blocked until player/team mapping is validated.',
      allowedAttributionLanguage: null,
    },
    nextAction: 'Do not add or enable FANTASY_NERDS_API_KEY for production features until current-season rows are confirmed.',
  },
  {
    id: 'gridiron-data',
    source: 'GridIron Data',
    status: 'research',
    normalReportLoad: 'blocked',
    publicClaimAllowed: false,
    evidence: {
      termsApproval: null,
      endpointPath: null,
      authModel: null,
      rowCount: null,
      freshnessTimestamp: null,
      rateLimitResult: null,
      mappingCoverage: null,
      allowedAttributionLanguage: null,
    },
    nextAction: 'Revisit only after key/package access exists and endpoint coverage can be documented.',
  },
  {
    id: 'dynasty-daddy-source-selector',
    source: 'Dynasty Daddy player-page source selector',
    status: 'research',
    normalReportLoad: 'blocked',
    publicClaimAllowed: false,
    evidence: {
      termsApproval: null,
      endpointPath: null,
      authModel: null,
      rowCount: null,
      freshnessTimestamp: null,
      rateLimitResult: null,
      mappingCoverage: null,
      allowedAttributionLanguage: null,
    },
    nextAction: 'Audit exact source URLs/API paths, auth, terms, cadence, coverage, and feature mapping before integration.',
  },
  {
    id: 'official-transactions',
    source: 'Official transaction classification source',
    status: 'research',
    normalReportLoad: 'blocked',
    publicClaimAllowed: false,
    evidence: {
      termsApproval: null,
      endpointPath: null,
      authModel: null,
      rowCount: null,
      freshnessTimestamp: null,
      rateLimitResult: null,
      mappingCoverage: null,
      allowedAttributionLanguage: null,
    },
    nextAction: 'Add only after source can classify signings, releases, waivers, and reserve moves without inference.',
  },
];

export function missingPublicClaimEvidence(gate: SourceReadinessGate): Array<keyof SourceReadinessEvidence> {
  if (gate.status !== 'approved-for-public-claim' && !gate.publicClaimAllowed) return [];
  return PUBLIC_CLAIM_EVIDENCE_FIELDS.filter((field) => !gate.evidence[field]);
}

export function validateSourceReadinessGates(gates: SourceReadinessGate[] = SOURCE_READINESS_GATES): string[] {
  const ids = new Set<string>();
  const errors: string[] = [];

  for (const gate of gates) {
    if (ids.has(gate.id)) errors.push(`Duplicate gate id: ${gate.id}`);
    ids.add(gate.id);

    if (gate.publicClaimAllowed && gate.status !== 'approved-for-public-claim') {
      errors.push(`${gate.id} allows public claims without approved-for-public-claim status.`);
    }

    const missing = missingPublicClaimEvidence(gate);
    if (missing.length) {
      errors.push(`${gate.id} is missing public-claim evidence: ${missing.join(', ')}`);
    }

    if (gate.normalReportLoad !== 'sleeper-live-only' && gate.normalReportLoad !== 'snapshot-only' && gate.normalReportLoad !== 'blocked') {
      errors.push(`${gate.id} has invalid normal report load boundary.`);
    }
  }

  return errors;
}

export function summarizeSourceReadinessGates(gates: SourceReadinessGate[] = SOURCE_READINESS_GATES) {
  const totals: Record<SourceReadinessGateStatus, number> = {
    blocked: 0,
    research: 0,
    'approved-for-snapshot': 0,
    'approved-for-public-claim': 0,
  };

  for (const gate of gates) {
    totals[gate.status] += 1;
  }

  return {
    total: gates.length,
    totals,
    publicClaimReady: gates.filter((gate) => gate.status === 'approved-for-public-claim' && gate.publicClaimAllowed).length,
    snapshotReady: gates.filter((gate) => gate.status === 'approved-for-snapshot').length,
    blockedOrResearch: gates.filter((gate) => gate.status === 'blocked' || gate.status === 'research').length,
  };
}
