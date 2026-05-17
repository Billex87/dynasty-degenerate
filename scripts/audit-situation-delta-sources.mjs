#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const NFLVERSE_RELEASES = [
  { tag: 'stats_player', label: 'nflverse player stats' },
  { tag: 'stats_team', label: 'nflverse team stats' },
  { tag: 'player_stats', label: 'legacy combined player stats' },
  { tag: 'snap_counts', label: 'nflverse snap counts' },
  { tag: 'pbp', label: 'nflverse play-by-play' },
  { tag: 'pbp_participation', label: 'nflverse participation/personnel' },
  { tag: 'nextgen_stats', label: 'nflverse Next Gen Stats' },
  { tag: 'pfr_advstats', label: 'nflverse PFR advanced stats' },
  { tag: 'ftn_charting', label: 'nflverse FTN charting' },
  { tag: 'depth_charts', label: 'nflverse depth charts' },
  { tag: 'injuries', label: 'nflverse injuries' },
  { tag: 'combine', label: 'nflverse combine' },
  { tag: 'contracts', label: 'nflverse contracts' },
  { tag: 'weekly_rosters', label: 'nflverse weekly rosters' },
  { tag: 'rosters', label: 'nflverse rosters' },
  { tag: 'trades', label: 'nflverse trades' },
];

const PROSPECT_SNAPSHOTS = [
  'server/prospect-snapshots/nfl-draft-buzz-historical-supplement.json',
  'server/prospect-snapshots/nfl-draft-buzz-indexed-supplement.json',
  'server/prospect-snapshots/nfl-draft-buzz-2026-05.json',
  'server/prospect-snapshots/espn-college-prospects.json',
];

const KNOWN_NFLVERSE_FALLBACKS = {
  stats_player: {
    assetCount: 542,
    firstYear: 1999,
    lastYear: 2025,
    yearCount: 27,
    sampleAssets: ['stats_player_reg_1999.csv', 'stats_player_reg_2025.csv'],
    latestSeasonAssets: ['stats_player_reg_2025.csv'],
  },
  stats_team: {
    assetCount: 542,
    firstYear: 1999,
    lastYear: 2025,
    yearCount: 27,
    sampleAssets: ['stats_team_reg_1999.csv', 'stats_team_reg_2025.csv'],
    latestSeasonAssets: ['stats_team_reg_2025.csv'],
  },
  player_stats: {
    assetCount: 1822,
    firstYear: 1999,
    lastYear: 2024,
    yearCount: 26,
    sampleAssets: ['player_stats.csv'],
    latestSeasonAssets: ['player_stats.csv'],
  },
  snap_counts: {
    assetCount: 73,
    firstYear: 2012,
    lastYear: 2025,
    yearCount: 14,
    sampleAssets: ['snap_counts_2012.csv', 'snap_counts_2025.csv'],
    latestSeasonAssets: ['snap_counts_2025.csv'],
  },
  pbp: {
    assetCount: 160,
    firstYear: 1999,
    lastYear: 2025,
    yearCount: 27,
    sampleAssets: ['play_by_play_1999.csv', 'play_by_play_2025.csv'],
    latestSeasonAssets: ['play_by_play_2025.csv'],
  },
  pbp_participation: {
    assetCount: 46,
    firstYear: 2016,
    lastYear: 2025,
    yearCount: 10,
    sampleAssets: ['pbp_participation_2016.csv', 'pbp_participation_2025.csv'],
    latestSeasonAssets: ['pbp_participation_2025.csv'],
  },
  nextgen_stats: {
    assetCount: 95,
    firstYear: 2016,
    lastYear: 2024,
    yearCount: 9,
    sampleAssets: ['ngs_2016_receiving.csv.gz', 'ngs_2024_receiving.csv.gz'],
    latestSeasonAssets: ['ngs_2024_receiving.csv.gz'],
  },
  pfr_advstats: {
    assetCount: 190,
    firstYear: 2018,
    lastYear: 2025,
    yearCount: 8,
    sampleAssets: ['advstats_season_rec_2018.csv.gz', 'advstats_season_rec_2025.rds'],
    latestSeasonAssets: ['advstats_season_rec_2025.rds'],
  },
  ftn_charting: {
    assetCount: 18,
    firstYear: 2022,
    lastYear: 2025,
    yearCount: 4,
    sampleAssets: ['ftn_charting_2022.csv', 'ftn_charting_2025.csv'],
    latestSeasonAssets: ['ftn_charting_2025.csv'],
  },
  depth_charts: {
    assetCount: 109,
    firstYear: 2001,
    lastYear: 2026,
    yearCount: 26,
    sampleAssets: ['depth_charts_2001.csv', 'depth_charts_2026.csv'],
    latestSeasonAssets: ['depth_charts_2026.csv'],
  },
  injuries: {
    assetCount: 73,
    firstYear: 2009,
    lastYear: 2025,
    yearCount: 17,
    sampleAssets: ['injuries_2009.csv', 'injuries_2025.csv'],
    latestSeasonAssets: ['injuries_2025.csv'],
  },
  combine: {
    assetCount: 7,
    firstYear: null,
    lastYear: null,
    yearCount: 0,
    sampleAssets: ['combine.csv'],
    latestSeasonAssets: ['combine.csv'],
  },
  contracts: {
    assetCount: 7,
    firstYear: null,
    lastYear: null,
    yearCount: 0,
    sampleAssets: ['historical_contracts.csv.gz'],
    latestSeasonAssets: ['historical_contracts.csv.gz'],
  },
  weekly_rosters: {
    assetCount: 100,
    firstYear: 2002,
    lastYear: 2025,
    yearCount: 24,
    sampleAssets: ['roster_weekly_2002.csv', 'roster_weekly_2025.csv'],
    latestSeasonAssets: ['roster_weekly_2025.csv'],
  },
  rosters: {
    assetCount: 434,
    firstYear: 1920,
    lastYear: 2026,
    yearCount: 107,
    sampleAssets: ['roster_1920.csv', 'roster_2026.csv'],
    latestSeasonAssets: ['roster_2026.csv'],
  },
  trades: {
    assetCount: 9,
    firstYear: 2002,
    lastYear: 2025,
    yearCount: 24,
    sampleAssets: ['trades.csv', 'trades.csv.gz', 'trades.parquet'],
    latestSeasonAssets: ['trades.csv', 'trades.csv.gz', 'trades.parquet'],
  },
};

function extractYears(name) {
  return Array.from(name.matchAll(/(?:^|[_./-])((?:19|20)\d{2})(?=[_./-]|$)/g))
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
}

function summarizeYears(years) {
  const unique = [...new Set(years)].sort((a, b) => a - b);
  return {
    firstYear: unique[0] ?? null,
    lastYear: unique[unique.length - 1] ?? null,
    yearCount: unique.length,
    years: unique,
  };
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'dynasty-degenerate-source-audit',
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

let releaseCache = null;

async function loadReleases() {
  if (releaseCache) return releaseCache;
  const releases = [];
  for (let page = 1; page <= 5; page += 1) {
    const pageReleases = await getJson(
      `https://api.github.com/repos/nflverse/nflverse-data/releases?per_page=100&page=${page}`,
    );
    releases.push(...pageReleases);
    if (pageReleases.length < 100) break;
  }
  releaseCache = releases;
  return releases;
}

async function loadReleaseAssets(tag) {
  const releases = await loadReleases();
  const release = releases.find((candidate) => candidate.tag_name === tag);
  if (!release) {
    throw new Error(`release tag not found: ${tag}`);
  }

  if (Array.isArray(release.assets) && release.assets.length > 0) {
    return release.assets;
  }

  const assets = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = `${release.assets_url}?per_page=100&page=${page}`;
    const pageAssets = await getJson(url);
    assets.push(...pageAssets);
    if (pageAssets.length < 100) break;
  }
  return assets;
}

function summarizeAssets(assets) {
  const names = assets.map((asset) => asset.name).sort((a, b) => a.localeCompare(b));
  const years = summarizeYears(names.flatMap(extractYears));
  const latest = names.filter((name) => {
    if (!years.lastYear) return false;
    return extractYears(name).includes(years.lastYear);
  });

  return {
    assetCount: assets.length,
    ...years,
    sampleAssets: [...names.slice(0, 3), ...names.slice(-3)].filter(Boolean),
    latestSeasonAssets: latest.slice(0, 8),
  };
}

async function summarizeNflverseRelease({ tag, label }) {
  try {
    const assets = await loadReleaseAssets(tag);
    const summary = summarizeAssets(assets);
    const fallback = KNOWN_NFLVERSE_FALLBACKS[tag];
    const coverage = fallback && summary.yearCount === 0 && fallback.yearCount > 0
      ? {
          firstYear: fallback.firstYear,
          lastYear: fallback.lastYear,
          yearCount: fallback.yearCount,
          note: 'Release assets are not season-named; using last known row-level season coverage',
        }
      : {};
    return {
      tag,
      label,
      status: 'ok',
      ...summary,
      ...coverage,
    };
  } catch (error) {
    const fallback = KNOWN_NFLVERSE_FALLBACKS[tag];
    if (fallback) {
      return {
        tag,
        label,
        status: 'fallback',
        note: 'GitHub API unavailable; using last known audited coverage',
        error: error instanceof Error ? error.message : String(error),
        ...fallback,
      };
    }

    return {
      tag,
      label,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function collectFieldNames(rows) {
  const fields = new Set();
  for (const row of rows.slice(0, 25)) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    for (const key of Object.keys(row)) fields.add(key);
  }
  return [...fields].sort();
}

async function summarizeProspectSnapshot(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  try {
    const raw = await fs.readFile(fullPath, 'utf8');
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.players) ? parsed.players : [];
    const years = summarizeYears(
      rows
        .map((row) => row?.draftYear ?? row?.classYear ?? row?.year)
        .map((year) => Number(year))
        .filter(Number.isFinite),
    );

    return {
      path: relativePath,
      status: 'ok',
      rowCount: rows.length,
      ...years,
      positions: [...new Set(rows.map((row) => row?.position).filter(Boolean))].sort(),
      fields: collectFieldNames(rows),
    };
  } catch (error) {
    return {
      path: relativePath,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function printMarkdown(summary) {
  console.log('# Player Situation Delta Source Audit');
  console.log('');
  console.log(`Generated: ${summary.generatedAt}`);
  console.log('');
  console.log('## nflverse Releases');
  console.log('');
  console.log('| Source | Tag | Status | Assets | Years | Latest sample |');
  console.log('| --- | --- | --- | ---: | --- | --- |');
  for (const release of summary.nflverseReleases) {
    const yearRange =
      release.firstYear && release.lastYear
        ? `${release.firstYear}-${release.lastYear}`
        : 'n/a';
    const latest = release.latestSeasonAssets?.slice(0, 3).join('<br>') || release.error || 'n/a';
    console.log(
      `| ${release.label} | \`${release.tag}\` | ${release.status} | ${release.assetCount ?? 0} | ${yearRange} | ${latest} |`,
    );
  }

  console.log('');
  console.log('## Local Prospect Snapshots');
  console.log('');
  console.log('| Snapshot | Status | Rows | Years | Positions | Key fields |');
  console.log('| --- | --- | ---: | --- | --- | --- |');
  for (const snapshot of summary.prospectSnapshots) {
    const yearRange =
      snapshot.firstYear && snapshot.lastYear
        ? `${snapshot.firstYear}-${snapshot.lastYear}`
        : 'n/a';
    console.log(
      `| \`${snapshot.path}\` | ${snapshot.status} | ${snapshot.rowCount ?? 0} | ${yearRange} | ${(snapshot.positions ?? []).join(', ') || 'n/a'} | ${(snapshot.fields ?? []).slice(0, 12).join(', ') || snapshot.error || 'n/a'} |`,
    );
  }
}

async function main() {
  const [nflverseReleases, prospectSnapshots] = await Promise.all([
    Promise.all(NFLVERSE_RELEASES.map(summarizeNflverseRelease)),
    Promise.all(PROSPECT_SNAPSHOTS.map(summarizeProspectSnapshot)),
  ]);

  const summary = {
    generatedAt: new Date().toISOString(),
    nflverseReleases,
    prospectSnapshots,
  };

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printMarkdown(summary);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
