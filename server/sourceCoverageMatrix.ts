import type { SourceSnapshotFreshnessDiagnostic } from '../shared/types';
import type { StoredSourceHealthEvent } from './db';

export type SourceCoverageStatus = 'loaded' | 'stale' | 'missing' | 'error' | 'blocked' | 'research';
export type SourceCoverageLevel = 'info' | 'warn' | 'danger';

type MatrixContext = {
  currentSeason: string;
  previousSeason: string;
  valueProfileKey: string;
  devyProfileKey?: string | null;
};

type SourceCoverageDefinition = {
  sourceKey: string;
  source: string;
  category: string;
  endpoint: string;
  authModel: string;
  refreshCadence: string;
  rateLimit: string;
  snapshotSourceKey?: string | ((context: MatrixContext) => string);
  healthSourceKeys?: string[];
  fieldMap: string[];
  ids: string[];
  timestamps: string[];
  usedNow: string[];
  couldPowerLater: string[];
  knownGaps: string[];
  complianceNote: string;
  statusWhenUnbacked?: SourceCoverageStatus;
};

export type SourceCoverageRow = {
  sourceKey: string;
  source: string;
  category: string;
  endpoint: string;
  authModel: string;
  refreshCadence: string;
  rateLimit: string;
  status: SourceCoverageStatus;
  level: SourceCoverageLevel;
  snapshotKey: string | null;
  tableName: string | null;
  updatedAt: string | null;
  ageHours: number | null;
  rowCount: number | null;
  payloadSizeBytes: number | null;
  fieldMap: string[];
  ids: string[];
  timestamps: string[];
  usedNow: string[];
  couldPowerLater: string[];
  knownGaps: string[];
  complianceNote: string;
  lastHealthStatus: string | null;
  lastHealthMessage: string | null;
  lastHealthAt: string | null;
};

export type SourceCoverageMatrix = {
  generatedAt: string;
  lookbackDays: number;
  totals: {
    sources: number;
    loaded: number;
    stale: number;
    missing: number;
    error: number;
    blocked: number;
    research: number;
    snapshotBacked: number;
    needsApproval: number;
  };
  rows: SourceCoverageRow[];
};

const SOURCE_DEFINITIONS: SourceCoverageDefinition[] = [
  {
    sourceKey: 'sleeper-league',
    source: 'Sleeper league API',
    category: 'User-load league data',
    endpoint: 'docs.sleeper.com league, roster, user, draft, transaction, matchup, and player endpoints',
    authModel: 'Public league/user endpoints; hidden trade-center import requires first-party user token and is not stored',
    refreshCadence: 'Only on user league load or explicit admin import',
    rateLimit: 'Respect Sleeper limits through load-time provider policy and short-lived request caching',
    fieldMap: ['league_id', 'season', 'settings', 'scoring_settings', 'rosters', 'users', 'players', 'drafts', 'traded_picks', 'transactions', 'matchups'],
    ids: ['sleeper_league_id', 'sleeper_user_id', 'sleeper_player_id', 'roster_id', 'transaction_id', 'draft_id'],
    timestamps: ['season', 'week', 'created', 'status_updated', 'last_transaction_at'],
    usedNow: ['league analysis', 'roster intelligence', 'draft/trade/waiver history', 'identity matching'],
    couldPowerLater: ['current-week matchup reads', 'lineup guidance', 'cross-league exposure', 'alerts'],
    knownGaps: ['Sleeper does not expose every projection/prop/start-sit signal through the league API'],
    complianceNote: 'Allowed normal load dependency because it is the user-selected league source of truth.',
    statusWhenUnbacked: 'loaded',
  },
  {
    sourceKey: 'ktc-blended-values',
    source: 'Blended dynasty value snapshot',
    category: 'Nightly value snapshot',
    endpoint: 'ktcSnapshots latest stored snapshot',
    authModel: 'Stored internal snapshot only',
    refreshCadence: 'Nightly job',
    rateLimit: 'No provider call during report load',
    snapshotSourceKey: 'ktc-blended-values-v1',
    fieldMap: ['player_id', 'player_name', 'position', 'team', 'value', 'rank', 'source_coverage', 'updated_at'],
    ids: ['sleeper_player_id', 'source player IDs where available'],
    timestamps: ['snapshotDate', 'createdAt'],
    usedNow: ['dynasty value baseline', 'trade values', 'manager roster valuation', 'confidence support'],
    couldPowerLater: ['value movement', 'market trend charts', 'source trace views'],
    knownGaps: ['Community market feeds can lag news or role changes'],
    complianceNote: 'Report load reads stored snapshots only.',
  },
  {
    sourceKey: 'redraft-source-snapshot',
    source: 'Redraft source snapshot',
    category: 'Nightly ranking snapshot',
    endpoint: 'redraftSourceSnapshots by season',
    authModel: 'Stored internal snapshot assembled by cron',
    refreshCadence: 'Nightly job in season',
    rateLimit: 'No provider call during report load',
    snapshotSourceKey: context => `redraft-source-snapshot:${context.currentSeason}`,
    fieldMap: ['player_id', 'name', 'position', 'team', 'rank', 'projection', 'adp', 'source', 'scoring_format'],
    ids: ['sleeper_player_id', 'fantasypros_id', 'espn_id', 'yahoo_id when present'],
    timestamps: ['snapshotKey', 'updatedAt', 'source updated timestamp when present'],
    usedNow: ['redraft rankings', 'lineup assumptions', 'source diagnostics'],
    couldPowerLater: ['ADP vs value-over-cost', 'weekly projection deltas', 'start/sit confidence'],
    knownGaps: ['Sub-source freshness varies by provider and package access'],
    complianceNote: 'Use only approved packages and stored snapshots.',
  },
  {
    sourceKey: 'fantasypros-rankings',
    source: 'FantasyPros rankings and projections',
    category: 'Nightly/provider snapshot input',
    endpoint: 'FantasyPros rankings, projections, ADP, compare-player, player-points, and news endpoints',
    authModel: 'API key when configured; production usage requires approved rights',
    refreshCadence: 'Nightly jobs and stored snapshots',
    rateLimit: 'Provider telemetry tracks calls, cache hits, failures, and 429s',
    healthSourceKeys: ['fantasypros', 'fantasypros-rankings', 'fantasypros-redraft', 'fantasypros-devy', 'fantasypros-news-v1'],
    fieldMap: ['player_id', 'player_name', 'position', 'team', 'rank', 'tier', 'adp', 'projected_points', 'injury_status', 'news'],
    ids: ['FantasyPros player ID', 'name/team/position join keys', 'external IDs when returned'],
    timestamps: ['updated', 'published_at', 'snapshotKey', 'updatedAt'],
    usedNow: ['dynasty/redraft/devy blend context', 'news/status notes', 'confidence calibration'],
    couldPowerLater: ['news-to-value movement', 'matchup preview', 'trade explainers', 'lineup strength'],
    knownGaps: ['Commercial/production terms and exact rate limits must remain explicit before primary paid use'],
    complianceNote: 'Keep calls in cron/admin flows; user reports read stored results.',
    statusWhenUnbacked: 'research',
  },
  {
    sourceKey: 'fantasypros-news-v1',
    source: 'FantasyPros news snapshot',
    category: 'Nightly/provider snapshot',
    endpoint: 'providerDataSnapshots fantasypros-news-v1',
    authModel: 'API key when configured',
    refreshCadence: 'Nightly job',
    rateLimit: 'Tracked by provider telemetry',
    snapshotSourceKey: 'fantasypros-news-v1',
    fieldMap: ['player_name', 'player_id', 'team', 'position', 'headline', 'summary', 'published_at', 'source_url'],
    ids: ['FantasyPros player ID', 'name/team/position join keys'],
    timestamps: ['published_at', 'snapshotKey', 'updatedAt'],
    usedNow: ['player status context', 'admin freshness diagnostics'],
    couldPowerLater: ['news-to-value movement', 'injury-risk narratives'],
    knownGaps: ['News joins depend on player identity normalization'],
    complianceNote: 'Stored news metadata only; do not print article payloads or secrets.',
  },
  {
    sourceKey: 'devy-source-snapshot',
    source: 'Devy and rookie source snapshot',
    category: 'Nightly/devy snapshot',
    endpoint: 'devySourceSnapshots by profile key',
    authModel: 'Stored internal snapshot assembled by cron',
    refreshCadence: 'Weekly or manual refresh outside peak draft windows',
    rateLimit: 'No provider call during report load',
    snapshotSourceKey: context => `devy-source-snapshot:${context.devyProfileKey || context.valueProfileKey}`,
    fieldMap: ['player_name', 'college', 'position', 'class_year', 'rank', 'source', 'score', 'draft_year'],
    ids: ['normalized player key', 'source player IDs when present'],
    timestamps: ['snapshotKey', 'updatedAt', 'source updated timestamp when present'],
    usedNow: ['devy rankings', 'rookie/prospect context'],
    couldPowerLater: ['prospect comparison', 'draft-class tiers', 'rookie draft prep'],
    knownGaps: ['Prospect names and colleges require more normalization than NFL player IDs'],
    complianceNote: 'Stored snapshot only during report load.',
  },
  {
    sourceKey: 'espn-depth-charts-v1',
    source: 'ESPN depth-chart snapshot',
    category: 'Nightly/provider snapshot',
    endpoint: 'providerDataSnapshots espn-depth-charts-v1',
    authModel: 'Public metadata fetch through scheduled job',
    refreshCadence: 'Nightly job in season',
    rateLimit: 'No provider call during report load',
    snapshotSourceKey: 'espn-depth-charts-v1',
    fieldMap: ['team', 'position', 'depth_order', 'player_name', 'espn_id', 'status'],
    ids: ['ESPN player ID', 'team abbreviation', 'name/team join key'],
    timestamps: ['snapshotKey', 'updatedAt'],
    usedNow: ['depth-chart hints', 'schedule/player role context'],
    couldPowerLater: ['opportunity changes', 'injury replacement reads', 'lineup risk flags'],
    knownGaps: ['Depth order semantics can differ by team and page source'],
    complianceNote: 'Stored metadata only; no report-load ESPN fetch.',
  },
  {
    sourceKey: 'draftsharks-sos-v1',
    source: 'DraftSharks SOS snapshot',
    category: 'Approved partner snapshot',
    endpoint: 'providerDataSnapshots draftsharks-sos-v1',
    authModel: 'Partner/control-panel API key and URL required',
    refreshCadence: 'Weekly schedule job when enabled',
    rateLimit: 'Feature-flag gated; no provider call during report load',
    snapshotSourceKey: 'draftsharks-sos-v1',
    fieldMap: ['team', 'position', 'season_sos', 'tier', 'streamer_weeks', 'avoid_weeks', 'updated_at'],
    ids: ['NFL team abbreviation', 'position'],
    timestamps: ['updated_at', 'snapshotKey', 'updatedAt'],
    usedNow: ['schedule planning shell when configured'],
    couldPowerLater: ['streamer weeks', 'avoid weeks', 'matchup reads', 'D/ST planning'],
    knownGaps: ['Final partner URL and payload shape must come from DraftSharks'],
    complianceNote: 'Do not scrape public DraftSharks pages.',
  },
  {
    sourceKey: 'player-props-opticodds-v1',
    source: 'OpticOdds player props snapshot',
    category: 'Licensed props snapshot',
    endpoint: 'providerDataSnapshots player-props-opticodds-v1',
    authModel: 'OpticOdds API key required',
    refreshCadence: 'Nightly or pregame cron only after approval',
    rateLimit: 'Feature-flag gated and provider-telemetry tracked',
    snapshotSourceKey: 'player-props-opticodds-v1',
    fieldMap: ['player_name', 'team', 'opponent', 'market', 'line', 'over_price', 'under_price', 'sportsbook', 'starts_at'],
    ids: ['provider event ID', 'provider player key', 'name/team join key'],
    timestamps: ['starts_at', 'last_updated', 'snapshotKey', 'updatedAt'],
    usedNow: ['prop-market signal shell from stored snapshots'],
    couldPowerLater: ['start/sit confidence', 'market-implied role', 'injury-risk confidence'],
    knownGaps: ['Needs real API key, sportsbook coverage tuning, and compliance boundaries before public UI'],
    complianceNote: 'Use generic market-signal language and approved/licensed feeds only.',
  },
  {
    sourceKey: 'sleeper-season-stats',
    source: 'Sleeper season stats snapshot',
    category: 'Historical production snapshot',
    endpoint: 'providerDataSnapshots sleeper-season-stats-v1',
    authModel: 'Sleeper public stats through cron',
    refreshCadence: 'Seasonal or long-term refresh',
    rateLimit: 'No provider call during report load',
    snapshotSourceKey: context => `sleeper-season-stats-v1:${context.previousSeason}`,
    fieldMap: ['player_id', 'season', 'week', 'team', 'position', 'stats'],
    ids: ['Sleeper player ID'],
    timestamps: ['season', 'week', 'snapshotKey', 'updatedAt'],
    usedNow: ['production context and historical signal foundation'],
    couldPowerLater: ['cohort engine', 'breakout/falloff detection', 'age/value curves'],
    knownGaps: ['Historical backfill depth and stat normalization still need tuning'],
    complianceNote: 'Stored stats only during report load.',
  },
  {
    sourceKey: 'prospect-snapshot-nfl-draft-buzz',
    source: 'NFL Draft Buzz prospect snapshot',
    category: 'Prospect snapshot',
    endpoint: 'prospectSnapshots NFL Draft Buzz',
    authModel: 'Stored prospect snapshot',
    refreshCadence: 'Monthly or draft-cycle refresh',
    rateLimit: 'No provider call during report load',
    snapshotSourceKey: 'prospect-snapshot:NFL Draft Buzz',
    fieldMap: ['player_name', 'position', 'school', 'class_year', 'height', 'weight', 'rank', 'scouting_summary', 'image_url'],
    ids: ['normalized prospect key', 'college/name join key'],
    timestamps: ['snapshotMonth', 'createdAt'],
    usedNow: ['devy and rookie prospect handling'],
    couldPowerLater: ['scouting cards', 'prospect comparisons', 'draft-class profiles'],
    knownGaps: ['Image/logo consistency and monthly freshness need monitoring'],
    complianceNote: 'Keep compact summaries and metadata; avoid full-page payload output.',
  },
  {
    sourceKey: 'fantasycalc',
    source: 'FantasyCalc values',
    category: 'Value source input',
    endpoint: 'FantasyCalc value feed imported into value snapshots',
    authModel: 'Approved/public feed path only',
    refreshCadence: 'Nightly source job',
    rateLimit: 'No report-load provider call',
    fieldMap: ['player_name', 'position', 'team', 'value', 'rank', 'format', 'source_metadata'],
    ids: ['source player ID when present', 'name/team/position join key'],
    timestamps: ['source updated timestamp', 'snapshotDate'],
    usedNow: ['blended values', 'confidence support'],
    couldPowerLater: ['market trend comparisons', 'value volatility'],
    knownGaps: ['Refresh cadence and source coverage details need continued audit'],
    complianceNote: 'Use only stored values in user reports.',
    statusWhenUnbacked: 'loaded',
  },
  {
    sourceKey: 'flock-fantasy',
    source: 'Flock Fantasy rankings',
    category: 'Value/source research',
    endpoint: 'Imported source rows where available',
    authModel: 'Approved/public feed path only',
    refreshCadence: 'Nightly source job when available',
    rateLimit: 'No report-load provider call',
    fieldMap: ['player_name', 'position', 'team', 'rank', 'exposure', 'format'],
    ids: ['source player key when present', 'name/team/position join key'],
    timestamps: ['snapshotDate', 'source updated timestamp when present'],
    usedNow: ['dynasty/rookie blend support and source research'],
    couldPowerLater: ['portfolio exposure', 'roster concentration'],
    knownGaps: ['Feed stability and usage rights need explicit approval'],
    complianceNote: 'Do not add user-load calls.',
    statusWhenUnbacked: 'research',
  },
  {
    sourceKey: 'dynasty-nerds',
    source: 'Dynasty Nerds rankings',
    category: 'Value/source input',
    endpoint: 'Imported dynasty and rookie ranking rows',
    authModel: 'Approved source path only',
    refreshCadence: 'Nightly source job when available',
    rateLimit: 'No report-load provider call',
    fieldMap: ['player_name', 'position', 'team', 'rank', 'format', 'rookie_flag'],
    ids: ['source player key when present', 'name/team/position join key'],
    timestamps: ['snapshotDate', 'source updated timestamp when present'],
    usedNow: ['dynasty and rookie blending'],
    couldPowerLater: ['format-specific rookie draft reads'],
    knownGaps: ['Freshness by format and exact coverage should stay visible'],
    complianceNote: 'Use stored rankings only.',
    statusWhenUnbacked: 'loaded',
  },
  {
    sourceKey: 'fantasy-nerds',
    source: 'Fantasy Nerds API',
    category: 'Projection/ranking candidate',
    endpoint: 'Fantasy Nerds rankings/projections/ADP endpoints when key is configured',
    authModel: 'API key/package dependent',
    refreshCadence: 'Nightly source job if approved',
    rateLimit: 'Provider telemetry required before weighting',
    fieldMap: ['player_name', 'position', 'team', 'rank', 'projection', 'adp', 'package'],
    ids: ['Fantasy Nerds player ID when returned', 'name/team/position join key'],
    timestamps: ['source updated timestamp', 'snapshotDate'],
    usedNow: ['source-coverage checks'],
    couldPowerLater: ['redraft projections', 'projection validation'],
    knownGaps: ['Current supported endpoints and package access need production key confirmation'],
    complianceNote: 'Keep as cron/admin-only until approved.',
    statusWhenUnbacked: 'research',
  },
  {
    sourceKey: 'dynastyprocess-nflverse',
    source: 'DynastyProcess and nflverse IDs',
    category: 'Public dataset / identity support',
    endpoint: 'DynastyProcess values and nflverse player ID maps',
    authModel: 'Public dataset terms',
    refreshCadence: 'Nightly or weekly source job',
    rateLimit: 'No user-load provider call',
    fieldMap: ['player_name', 'merge_name', 'position', 'team', 'platform_ids', 'value', 'age', 'draft_metadata'],
    ids: ['sleeper_id', 'espn_id', 'yahoo_id', 'fantasypros_id', 'gsis_id', 'pfr_id'],
    timestamps: ['dataset version', 'snapshotDate'],
    usedNow: ['identity mapping', 'dynasty fallback/stabilizer'],
    couldPowerLater: ['alias normalization', 'cross-platform joins', 'source trace'],
    knownGaps: ['Dataset versioning and freshness should stay explicit'],
    complianceNote: 'Good candidate for static/nightly enrichment.',
    statusWhenUnbacked: 'loaded',
  },
  {
    sourceKey: 'yahoo-fantrax-ffpc',
    source: 'Yahoo, Fantrax, and FFPC candidates',
    category: 'External research',
    endpoint: 'Official/approved docs and probe-only reachability checks',
    authModel: 'Yahoo OAuth/application approval; Fantrax and FFPC need approved partner paths',
    refreshCadence: 'Research only until approved',
    rateLimit: 'No production calls until terms and auth are approved',
    fieldMap: ['league/team/player IDs', 'matchups', 'rosters', 'projected points', 'ADP/ownership if licensed'],
    ids: ['yahoo_player_id', 'fantrax_player_id', 'ffpc contest/player IDs when licensed'],
    timestamps: ['season', 'week', 'projection updated timestamp if returned'],
    usedNow: ['todo/research only'],
    couldPowerLater: ['source validation', 'platform connector', 'ADP/high-stakes market signal'],
    knownGaps: ['Need approval, exact payload shapes, and production terms before integration'],
    complianceNote: 'Do not scrape or authenticate with user cookies.',
    statusWhenUnbacked: 'blocked',
  },
];

function snapshotKeyForDefinition(definition: SourceCoverageDefinition, context: MatrixContext): string | null {
  if (!definition.snapshotSourceKey) return null;
  return typeof definition.snapshotSourceKey === 'function'
    ? definition.snapshotSourceKey(context)
    : definition.snapshotSourceKey;
}

function latestHealthForDefinition(definition: SourceCoverageDefinition, healthEvents: StoredSourceHealthEvent[]): StoredSourceHealthEvent | null {
  const sourceKeys = new Set([definition.sourceKey, ...(definition.healthSourceKeys || [])]);
  let latest: StoredSourceHealthEvent | null = null;

  for (const event of healthEvents) {
    if (!sourceKeys.has(event.sourceKey) && !Array.from(sourceKeys).some((key) => event.sourceKey.startsWith(key))) {
      continue;
    }
    if (!latest || event.createdAt > latest.createdAt) {
      latest = event;
    }
  }

  return latest;
}

function levelForStatus(status: SourceCoverageStatus, health: StoredSourceHealthEvent | null): SourceCoverageLevel {
  if (status === 'error' || health?.level === 'danger') return 'danger';
  if (status === 'stale' || status === 'missing' || status === 'blocked' || status === 'research' || health?.level === 'warn') {
    return 'warn';
  }
  return 'info';
}

function buildTotals(rows: SourceCoverageRow[]): SourceCoverageMatrix['totals'] {
  return {
    sources: rows.length,
    loaded: rows.filter((row) => row.status === 'loaded').length,
    stale: rows.filter((row) => row.status === 'stale').length,
    missing: rows.filter((row) => row.status === 'missing').length,
    error: rows.filter((row) => row.status === 'error').length,
    blocked: rows.filter((row) => row.status === 'blocked').length,
    research: rows.filter((row) => row.status === 'research').length,
    snapshotBacked: rows.filter((row) => row.snapshotKey || row.tableName).length,
    needsApproval: rows.filter((row) => row.status === 'blocked' || row.status === 'research' || /approval|approved|terms/i.test(row.complianceNote)).length,
  };
}

export function buildSourceCoverageMatrix(input: {
  currentSeason: string;
  previousSeason?: string | null;
  valueProfileKey: string;
  devyProfileKey?: string | null;
  lookbackDays: number;
  freshnessDiagnostics: SourceSnapshotFreshnessDiagnostic[];
  healthEvents?: StoredSourceHealthEvent[];
  generatedAt?: Date;
}): SourceCoverageMatrix {
  const context: MatrixContext = {
    currentSeason: input.currentSeason,
    previousSeason: input.previousSeason || String(Number(input.currentSeason) - 1),
    valueProfileKey: input.valueProfileKey,
    devyProfileKey: input.devyProfileKey,
  };
  const diagnosticsBySource = new Map(input.freshnessDiagnostics.map((diagnostic) => [diagnostic.sourceKey, diagnostic]));
  const healthEvents = input.healthEvents || [];

  const rows = SOURCE_DEFINITIONS.map((definition): SourceCoverageRow => {
    const expectedSnapshotKey = snapshotKeyForDefinition(definition, context);
    const diagnostic = expectedSnapshotKey ? diagnosticsBySource.get(expectedSnapshotKey) || null : null;
    const health = latestHealthForDefinition(definition, healthEvents);
    const status = diagnostic?.status || definition.statusWhenUnbacked || 'research';
    const level = diagnostic?.level || levelForStatus(status, health);

    return {
      sourceKey: definition.sourceKey,
      source: definition.source,
      category: definition.category,
      endpoint: definition.endpoint,
      authModel: definition.authModel,
      refreshCadence: definition.refreshCadence,
      rateLimit: definition.rateLimit,
      status,
      level,
      snapshotKey: diagnostic?.snapshotKey || null,
      tableName: diagnostic?.tableName || null,
      updatedAt: diagnostic?.updatedAt || null,
      ageHours: diagnostic?.ageHours ?? null,
      rowCount: diagnostic?.rowCount ?? health?.rowCount ?? null,
      payloadSizeBytes: diagnostic?.payloadSizeBytes ?? null,
      fieldMap: definition.fieldMap,
      ids: definition.ids,
      timestamps: definition.timestamps,
      usedNow: definition.usedNow,
      couldPowerLater: definition.couldPowerLater,
      knownGaps: definition.knownGaps,
      complianceNote: definition.complianceNote,
      lastHealthStatus: diagnostic?.lastHealthStatus || health?.status || null,
      lastHealthMessage: diagnostic?.lastHealthMessage || health?.message || null,
      lastHealthAt: diagnostic?.lastHealthAt || health?.createdAt.toISOString() || null,
    };
  }).sort((a, b) => {
    const levelRank = { danger: 0, warn: 1, info: 2 };
    return levelRank[a.level] - levelRank[b.level] || a.category.localeCompare(b.category) || a.source.localeCompare(b.source);
  });

  return {
    generatedAt: (input.generatedAt || new Date()).toISOString(),
    lookbackDays: input.lookbackDays,
    totals: buildTotals(rows),
    rows,
  };
}
