export const DEFAULT_VALUE_HISTORY_WEIGHTS = {
  marketKtc: 0.14,
  fantasyCalc: 0.1,
  fantasyPros: 0.12,
  dynastyProcess: 0.02,
  dynastyNerds: 0.23,
  fantasyNerds: 0.07,
  flockFantasy: 0.32,
};

export const VALUE_HISTORY_SOURCES = [
  {
    key: 'marketKtc',
    label: 'KeepTradeCut',
    archiveSourceNames: ['KTC'],
    currentWeight: DEFAULT_VALUE_HISTORY_WEIGHTS.marketKtc,
    status: 'archived',
    captureMode: 'direct-player-page',
    formats: ['sf_ppr', 'one_qb_ppr', 'sf_ppr_tep_0_5', 'sf_ppr_tep_1_0', 'sf_ppr_tep_1_5', 'one_qb_ppr_tep_0_5', 'one_qb_ppr_tep_1_0', 'one_qb_ppr_tep_1_5'],
    note: 'Backfilled from direct player value graph payloads. Raw points are kept in the frozen source archive.',
  },
  {
    key: 'flockFantasy',
    label: 'Flock Fantasy',
    archiveSourceNames: ['FlockFantasy'],
    currentWeight: DEFAULT_VALUE_HISTORY_WEIGHTS.flockFantasy,
    status: 'archived',
    captureMode: 'direct-player-history-endpoint',
    formats: ['SUPERFLEX', 'ONEQB', 'PROSPECTS_SF', 'PROSPECTS'],
    note: 'Backfilled from clicked-player history endpoints where the public app exposes player history. Public TEP history was not found.',
  },
  {
    key: 'fantasyCalc',
    label: 'FantasyCalc',
    archiveSourceNames: ['FantasyCalc'],
    currentWeight: DEFAULT_VALUE_HISTORY_WEIGHTS.fantasyCalc,
    status: 'archived',
    captureMode: 'direct-player-history-api',
    formats: ['sf_ppr', 'one_qb_ppr'],
    note: 'Backfilled from FantasyCalc player detail history endpoints. The source exposes dynasty 1QB/SF history, but not TEP, PPR, or team-count-specific history splits.',
  },
  {
    key: 'fantasyPros',
    label: 'FantasyPros',
    archiveSourceNames: ['FantasyPros'],
    currentWeight: DEFAULT_VALUE_HISTORY_WEIGHTS.fantasyPros,
    status: 'archived',
    captureMode: 'licensed-api-consensus-rankings',
    formats: ['sf_ppr', 'one_qb_ppr', 'redraft_ppr', 'ros_ppr', 'fantasypros_adp_ppr', 'fantasypros_dynadp_ppr', 'fantasypros_rkadp_ppr', 'devy_ppr', 'rookie_ppr'],
    note: 'Backfilled from FantasyPros consensus ranking snapshots with source last_updated dates. Dynasty ranks are stored in app 1QB/SF base PPR formats because the endpoint does not expose QB-format or TEP-specific splits.',
  },
  {
    key: 'dynastyProcess',
    label: 'DynastyProcess',
    archiveSourceNames: ['DynastyProcess'],
    currentWeight: DEFAULT_VALUE_HISTORY_WEIGHTS.dynastyProcess,
    status: 'archived',
    captureMode: 'official-github-values-players-commit-history',
    formats: ['superflex', 'one_qb'],
    note: 'Backfilled from the official DynastyProcess data repo values-players.csv commit history. Source does not publish TEP-specific values.',
  },
  {
    key: 'dynastyNerds',
    label: 'Dynasty Nerds',
    archiveSourceNames: ['DynastyNerds'],
    currentWeight: DEFAULT_VALUE_HISTORY_WEIGHTS.dynastyNerds,
    status: 'archived',
    captureMode: 'local-stored-source-snapshots',
    formats: ['PPR', 'SFLEX', 'STD', 'SFLEXTEP'],
    note: 'Archived from Dynasty Degen stored source snapshots where Dynasty Nerds columns were already captured. A direct source-native public history endpoint was not found; current page payload remains live/snapshot-backed only.',
  },
  {
    key: 'fantasyNerds',
    label: 'Fantasy Nerds',
    archiveSourceNames: ['FantasyNerds'],
    currentWeight: DEFAULT_VALUE_HISTORY_WEIGHTS.fantasyNerds,
    status: 'archived',
    captureMode: 'local-stored-source-snapshots',
    formats: ['dynasty', 'redraft', 'projections'],
    note: 'Archived from Dynasty Degen stored source snapshots where Fantasy Nerds columns were already captured. Local env does not have a real Fantasy Nerds API key; TEST rows are not treated as source history.',
  },
  {
    key: 'dynastyDealer',
    label: 'Dynasty Dealer',
    archiveSourceNames: ['DynastyDealer'],
    currentWeight: 0,
    status: 'benchmark-only',
    captureMode: 'current-benchmark-snapshot',
    formats: ['dynasty'],
    note: 'Stored as benchmark context, not part of default weighted blended value today.',
  },
  {
    key: 'futureLicensedRouteData',
    label: 'Future route/usage provider',
    archiveSourceNames: ['FantasyPointsData', 'PFF', 'FTN', 'SportsDataIO', 'FantasyData'],
    currentWeight: 0,
    status: 'future',
    captureMode: 'licensed-api-snapshots',
    formats: ['weekly', 'season', 'player-usage'],
    note: 'When added, archive raw routes, YPRR, target share, and usage fields separately from value history, then reference them in projection and confidence models.',
  },
];

export function findValueHistorySourceByBlendKey(key) {
  return VALUE_HISTORY_SOURCES.find((source) => source.key === key) || null;
}

export function getDefaultValueHistoryWeights() {
  return { ...DEFAULT_VALUE_HISTORY_WEIGHTS };
}
