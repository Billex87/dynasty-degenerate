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
    status: 'import-ready',
    captureMode: 'approved-export-or-api-history',
    formats: ['dynasty', 'redraft', 'sf', 'one_qb'],
    note: 'Current values are already blended. Historical backfill should use an approved export/API history or a manually approved CSV/JSON import.',
  },
  {
    key: 'fantasyPros',
    label: 'FantasyPros',
    archiveSourceNames: ['FantasyPros'],
    currentWeight: DEFAULT_VALUE_HISTORY_WEIGHTS.fantasyPros,
    status: 'import-ready',
    captureMode: 'licensed-api-or-approved-export',
    formats: ['dynasty', 'redraft', 'rookies', 'devy', 'adp'],
    note: 'Keep historical rankings/projections private and source-traced. Use API/export only under approved terms.',
  },
  {
    key: 'dynastyProcess',
    label: 'DynastyProcess',
    archiveSourceNames: ['DynastyProcess'],
    currentWeight: DEFAULT_VALUE_HISTORY_WEIGHTS.dynastyProcess,
    status: 'import-ready',
    captureMode: 'approved-csv-snapshot-history',
    formats: ['superflex', 'one_qb'],
    note: 'Public CSV is already normalized for current blends. Historical rows should be imported as frozen CSV snapshots when approved.',
  },
  {
    key: 'dynastyNerds',
    label: 'Dynasty Nerds',
    archiveSourceNames: ['DynastyNerds'],
    currentWeight: DEFAULT_VALUE_HISTORY_WEIGHTS.dynastyNerds,
    status: 'import-ready',
    captureMode: 'approved-export-or-api-history',
    formats: ['PPR', 'SFLEX', 'STD', 'SFLEXTEP'],
    note: 'Use approved source exports/API results only; store raw rows privately for reblend and source-trust backtests.',
  },
  {
    key: 'fantasyNerds',
    label: 'Fantasy Nerds',
    archiveSourceNames: ['FantasyNerds'],
    currentWeight: DEFAULT_VALUE_HISTORY_WEIGHTS.fantasyNerds,
    status: 'import-ready',
    captureMode: 'approved-export-or-api-history',
    formats: ['dynasty', 'redraft', 'projections'],
    note: 'Current ranking/projection support can be archived through approved exports or API history once available.',
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
