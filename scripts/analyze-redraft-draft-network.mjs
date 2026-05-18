#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';
const DEFAULT_DRAFT_ROUNDS_TO_SEQUENCE = 4;
const DEFAULT_COMPLETED_SEASONS = 4;
const DEFAULT_MANAGER_DEPTH = 1;
const DEFAULT_MAX_MANAGERS = 250;
const DEFAULT_MAX_LEAGUES = 1000;
const DEFAULT_REQUEST_DELAY_MS = Number.parseInt(process.env.REDRAFT_DRAFT_ANALYZER_DELAY_MS || '250', 10);

function printUsage() {
  console.log(`Usage:
  pnpm analyze:redraft-draft-network --username <sleeper-username> [--depth 1] [--completed-seasons 4]

Options:
  --username <name>         Sleeper username to seed the manager graph.
  --user-id <id>            Sleeper user ID to seed the graph when username is not available.
  --depth <n>               Manager graph depth. Default: 1. Max: 2.
  --completed-seasons <n>   Number of completed seasons to scan. Default: 4.
  --season <year>           Explicit completed season to scan. Repeat or comma-separate for multiple seasons.
  --rounds <n>              Number of champion picks to include in the position sequence. Default: 4.
  --max-managers <n>        Manager discovery cap. Default: 250.
  --max-leagues <n>         League discovery cap. Default: 1000.
  --delay-ms <n>            Delay between Sleeper calls. Default: ${DEFAULT_REQUEST_DELAY_MS}.
  --out <path>              Optional file path for the aggregate JSON artifact.
  --help                    Show this help text.

The command prints aggregate JSON only. It does not store raw league, user, or player rows.
By default it excludes the active calendar season because champion outcomes are not known yet.`);
}

function parsePositiveInt(value, label, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be a number from ${min} to ${max}.`);
  }
  return parsed;
}

function getDefaultCompletedSeasons(count) {
  const lastCompletedSeason = new Date().getFullYear() - 1;
  return Array.from({ length: count }, (_, index) => String(lastCompletedSeason - index));
}

function parseSeasonValues(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const explicitSeasons = [];
  const args = {
    username: '',
    userId: '',
    depth: DEFAULT_MANAGER_DEPTH,
    completedSeasons: DEFAULT_COMPLETED_SEASONS,
    rounds: DEFAULT_DRAFT_ROUNDS_TO_SEQUENCE,
    maxManagers: DEFAULT_MAX_MANAGERS,
    maxLeagues: DEFAULT_MAX_LEAGUES,
    delayMs: DEFAULT_REQUEST_DELAY_MS,
    outFile: '',
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--username') {
      args.username = String(argv[++i] || '').trim();
      continue;
    }
    if (arg === '--user-id') {
      args.userId = String(argv[++i] || '').trim();
      continue;
    }
    if (arg === '--depth') {
      args.depth = parsePositiveInt(argv[++i], '--depth', 0, 2);
      continue;
    }
    if (arg === '--completed-seasons') {
      args.completedSeasons = parsePositiveInt(argv[++i], '--completed-seasons', 1, 10);
      continue;
    }
    if (arg === '--season') {
      explicitSeasons.push(...parseSeasonValues(argv[++i]));
      continue;
    }
    if (arg === '--rounds') {
      args.rounds = parsePositiveInt(argv[++i], '--rounds', 1, 12);
      continue;
    }
    if (arg === '--max-managers') {
      args.maxManagers = parsePositiveInt(argv[++i], '--max-managers', 1, 5000);
      continue;
    }
    if (arg === '--max-leagues') {
      args.maxLeagues = parsePositiveInt(argv[++i], '--max-leagues', 1, 25000);
      continue;
    }
    if (arg === '--delay-ms') {
      args.delayMs = parsePositiveInt(argv[++i], '--delay-ms', 0, 10000);
      continue;
    }
    if (arg === '--out') {
      args.outFile = String(argv[++i] || '').trim();
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  args.seasons = explicitSeasons.length
    ? [...new Set(explicitSeasons)]
    : getDefaultCompletedSeasons(args.completedSeasons);

  if (!args.help && !args.username && !args.userId) {
    throw new Error('Provide --username or --user-id.');
  }

  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(path, delayMs) {
  if (delayMs > 0) await sleep(delayMs);
  const response = await fetch(`${SLEEPER_BASE_URL}${path}`, {
    headers: { accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const error = new Error(`Sleeper returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function increment(counter, key, amount = 1) {
  if (!key) return;
  counter[key] = (counter[key] || 0) + amount;
}

function getLeagueType(league) {
  const type = Number(league?.settings?.type);
  if (type === 2) return 'dynasty';
  if (type === 1) return 'keeper';
  return 'redraft';
}

function getPprBucket(scoringSettings = {}) {
  const rec = Number(scoringSettings.rec || 0);
  if (rec >= 0.95) return 'ppr';
  if (rec >= 0.45) return 'half_ppr';
  return 'standard';
}

function getLeagueSizeBucket(league, rosters = []) {
  const teams = Number(league?.total_rosters || league?.settings?.num_teams || rosters.length || 0);
  if (!teams) return 'unknown_teams';
  return `${teams}_team`;
}

function isSuperflex(league) {
  return Array.isArray(league?.roster_positions)
    && league.roster_positions.some(position => String(position).toUpperCase().includes('SUPER_FLEX'));
}

function hasTep(league) {
  const teReceptionBonus = Number(league?.scoring_settings?.bonus_rec_te || 0);
  const teFirstDownBonus = Number(league?.scoring_settings?.bonus_fd_te || 0);
  return teReceptionBonus > 0 || teFirstDownBonus > 0;
}

function getFormatBucket(league, rosters) {
  return [
    getLeagueSizeBucket(league, rosters),
    getPprBucket(league?.scoring_settings || {}),
    isSuperflex(league) ? 'sf' : '1qb',
    hasTep(league) ? 'tep' : 'base',
  ].join('_');
}

function pickBestDraft(drafts = [], league) {
  const season = String(league?.season || '');
  const completeDrafts = drafts.filter(draft => String(draft?.status || '').toLowerCase() === 'complete');
  const sameSeason = completeDrafts.filter(draft => String(draft?.season || '') === season);
  const candidates = sameSeason.length ? sameSeason : completeDrafts;

  return candidates
    .slice()
    .sort((a, b) => {
      const roundsA = Number(a?.settings?.rounds || 0);
      const roundsB = Number(b?.settings?.rounds || 0);
      const createdA = Number(a?.created || a?.start_time || 0);
      const createdB = Number(b?.created || b?.start_time || 0);
      return roundsB - roundsA || createdB - createdA;
    })[0] || null;
}

function getTopPointsRosterId(rosters = []) {
  return rosters
    .slice()
    .sort((a, b) => {
      const pointsA = Number(a?.settings?.fpts || 0) + Number(a?.settings?.fpts_decimal || 0) / 100;
      const pointsB = Number(b?.settings?.fpts || 0) + Number(b?.settings?.fpts_decimal || 0) / 100;
      return pointsB - pointsA;
    })[0]?.roster_id || null;
}

async function getChampionRosterId(leagueId, rosters, delayMs) {
  const bracket = await fetchJson(`/league/${leagueId}/winners_bracket`, delayMs);
  if (!Array.isArray(bracket) || bracket.length === 0) return getTopPointsRosterId(rosters);

  const finalMatchup = bracket
    .filter(matchup => matchup?.w)
    .sort((a, b) => Number(b?.r || 0) - Number(a?.r || 0))[0];

  return finalMatchup?.w || getTopPointsRosterId(rosters);
}

function normalizePosition(value) {
  const pos = String(value || '').toUpperCase();
  if (pos === 'DEF' || pos === 'DST') return 'DEF';
  if (['QB', 'RB', 'WR', 'TE', 'K'].includes(pos)) return pos;
  return 'UNK';
}

function getDraftPicksForRoster(picks = [], rosterId) {
  return picks
    .filter(pick => String(pick?.roster_id || '') === String(rosterId))
    .map(pick => ({
      pickNo: Number(pick?.pick_no || 0),
      round: Number(pick?.round || 0),
      draftSlot: Number(pick?.draft_slot || 0),
      position: normalizePosition(pick?.metadata?.position),
    }))
    .filter(pick => pick.pickNo > 0 && pick.position !== 'UNK')
    .sort((a, b) => a.pickNo - b.pickNo);
}

function classifyStrategy(sequence = []) {
  const first = sequence[0];
  const second = sequence[1];
  const firstFour = sequence.slice(0, 4);
  const rbCount = firstFour.filter(pos => pos === 'RB').length;
  const wrCount = firstFour.filter(pos => pos === 'WR').length;
  const qbIndex = sequence.indexOf('QB');
  const teIndex = sequence.indexOf('TE');

  if (first === 'RB' && second === 'RB') return 'RB-RB';
  if (first === 'WR' && second === 'WR') return 'WR-WR';
  if (first === 'RB' && rbCount === 1) return 'hero RB';
  if (rbCount === 0) return 'zero RB';
  if (qbIndex >= 0 && qbIndex <= 2) return 'elite QB early';
  if (teIndex >= 0 && teIndex <= 2) return 'early TE';
  if (rbCount >= 2 && wrCount >= 2) return 'balanced';
  return 'other';
}

function makeEmptyAggregate(rounds, source) {
  return {
    generatedAt: new Date().toISOString(),
    rounds,
    source,
    privacy: 'aggregate_only_no_raw_league_user_or_player_rows',
    inputLeagueCount: 0,
    eligibleLeagueCount: 0,
    skipped: {},
    totals: {
      championFirstPickPosition: {},
      championPositionSequence: {},
      championStrategy: {},
      championDraftSlot: {},
      topPointsFirstPickPosition: {},
    },
    byFormatBucket: {},
  };
}

function getBucket(aggregate, key) {
  if (!aggregate.byFormatBucket[key]) {
    aggregate.byFormatBucket[key] = {
      eligibleLeagueCount: 0,
      championFirstPickPosition: {},
      championPositionSequence: {},
      championStrategy: {},
      championDraftSlot: {},
      topPointsFirstPickPosition: {},
    };
  }
  return aggregate.byFormatBucket[key];
}

function addLeagueToAggregate(aggregate, leagueSummary) {
  const {
    formatBucket,
    championSequence,
    championDraftSlot,
    topPointsSequence,
  } = leagueSummary;
  const sequenceKey = championSequence.join('-');
  const strategy = classifyStrategy(championSequence);
  const bucket = getBucket(aggregate, formatBucket);

  aggregate.eligibleLeagueCount += 1;
  bucket.eligibleLeagueCount += 1;

  increment(aggregate.totals.championFirstPickPosition, championSequence[0]);
  increment(aggregate.totals.championPositionSequence, sequenceKey);
  increment(aggregate.totals.championStrategy, strategy);
  increment(aggregate.totals.championDraftSlot, String(championDraftSlot || 'unknown'));
  increment(aggregate.totals.topPointsFirstPickPosition, topPointsSequence[0]);

  increment(bucket.championFirstPickPosition, championSequence[0]);
  increment(bucket.championPositionSequence, sequenceKey);
  increment(bucket.championStrategy, strategy);
  increment(bucket.championDraftSlot, String(championDraftSlot || 'unknown'));
  increment(bucket.topPointsFirstPickPosition, topPointsSequence[0]);
}

async function analyzeLeague(leagueId, rounds, delayMs) {
  const league = await fetchJson(`/league/${leagueId}`, delayMs);
  if (!league) return { skipped: 'league_not_found' };
  if (getLeagueType(league) !== 'redraft') return { skipped: 'not_redraft' };

  const [rosters, drafts] = await Promise.all([
    fetchJson(`/league/${leagueId}/rosters`, delayMs),
    fetchJson(`/league/${leagueId}/drafts`, delayMs),
  ]);
  if (!Array.isArray(rosters) || rosters.length === 0) return { skipped: 'missing_rosters' };
  if (!Array.isArray(drafts) || drafts.length === 0) return { skipped: 'missing_drafts' };

  const draft = pickBestDraft(drafts, league);
  if (!draft?.draft_id) return { skipped: 'missing_complete_draft' };

  const [picks, championRosterId] = await Promise.all([
    fetchJson(`/draft/${draft.draft_id}/picks`, delayMs),
    getChampionRosterId(leagueId, rosters, delayMs),
  ]);
  if (!Array.isArray(picks) || picks.length === 0) return { skipped: 'missing_draft_picks' };
  if (!championRosterId) return { skipped: 'missing_champion' };

  const topPointsRosterId = getTopPointsRosterId(rosters);
  const championPicks = getDraftPicksForRoster(picks, championRosterId);
  const topPointsPicks = getDraftPicksForRoster(picks, topPointsRosterId);
  if (championPicks.length < rounds) return { skipped: 'not_enough_champion_picks' };

  return {
    formatBucket: getFormatBucket(league, rosters),
    championSequence: championPicks.slice(0, rounds).map(pick => pick.position),
    championDraftSlot: championPicks[0]?.draftSlot || null,
    topPointsSequence: topPointsPicks.slice(0, rounds).map(pick => pick.position),
  };
}

async function resolveSeedUser(args) {
  if (args.userId) {
    return {
      userId: args.userId,
      username: args.username || null,
    };
  }

  const user = await fetchJson(`/user/${encodeURIComponent(args.username)}`, args.delayMs);
  if (!user?.user_id) throw new Error('Sleeper user not found.');
  return {
    userId: String(user.user_id),
    username: user.username || args.username,
  };
}

function makeDiscovery(seasons) {
  return {
    seasons,
    managersSeen: 0,
    leaguesSeen: 0,
    redraftLeagues: 0,
    formatCounts: {},
    depthCounts: {},
    skipped: {},
  };
}

async function discoverLeagueNetwork(seedUser, args) {
  const discovery = makeDiscovery(args.seasons);
  const queue = [{ userId: seedUser.userId, username: seedUser.username, depth: 0 }];
  const seenManagers = new Set();
  const seenLeagues = new Set();
  const discoveredRedraftLeagueIds = [];

  while (queue.length > 0) {
    const manager = queue.shift();
    if (!manager?.userId || seenManagers.has(manager.userId)) continue;
    if (seenManagers.size >= args.maxManagers) {
      increment(discovery.skipped, 'manager_cap_reached');
      break;
    }

    seenManagers.add(manager.userId);
    discovery.managersSeen = seenManagers.size;
    increment(discovery.depthCounts, String(manager.depth));

    for (const season of args.seasons) {
      let leagues = [];
      try {
        leagues = await fetchJson(`/user/${manager.userId}/leagues/nfl/${season}`, args.delayMs);
      } catch {
        increment(discovery.skipped, 'user_league_fetch_failed');
        continue;
      }
      if (!Array.isArray(leagues)) continue;

      for (const league of leagues) {
        const leagueId = String(league?.league_id || '');
        if (!leagueId || seenLeagues.has(leagueId)) continue;
        if (seenLeagues.size >= args.maxLeagues) {
          increment(discovery.skipped, 'league_cap_reached');
          discovery.leaguesSeen = seenLeagues.size;
          return { discovery, redraftLeagueIds: discoveredRedraftLeagueIds };
        }

        seenLeagues.add(leagueId);
        discovery.leaguesSeen = seenLeagues.size;

        if (getLeagueType(league) === 'redraft') {
          discovery.redraftLeagues += 1;
          discoveredRedraftLeagueIds.push(leagueId);
          increment(discovery.formatCounts, getFormatBucket(league, []));
        }

        if (manager.depth < args.depth) {
          try {
            const users = await fetchJson(`/league/${leagueId}/users`, args.delayMs);
            if (Array.isArray(users)) {
              for (const user of users) {
                const userId = String(user?.user_id || '');
                if (userId && !seenManagers.has(userId)) {
                  queue.push({
                    userId,
                    username: user?.username || null,
                    depth: manager.depth + 1,
                  });
                }
              }
            }
          } catch {
            increment(discovery.skipped, 'league_users_fetch_failed');
          }
        }
      }
    }
  }

  return { discovery, redraftLeagueIds: discoveredRedraftLeagueIds };
}

async function aggregateDiscoveredLeagues(redraftLeagueIds, args) {
  const aggregate = makeEmptyAggregate(args.rounds, 'sleeper_username_manager_network');
  aggregate.inputLeagueCount = redraftLeagueIds.length;

  for (const leagueId of redraftLeagueIds) {
    try {
      const result = await analyzeLeague(leagueId, args.rounds, args.delayMs);
      if (result?.skipped) {
        increment(aggregate.skipped, result.skipped);
      } else {
        addLeagueToAggregate(aggregate, result);
      }
    } catch {
      increment(aggregate.skipped, 'league_analysis_failed');
    }
  }

  return aggregate;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const seedUser = await resolveSeedUser(args);
  const { discovery, redraftLeagueIds } = await discoverLeagueNetwork(seedUser, args);
  const aggregate = await aggregateDiscoveredLeagues(redraftLeagueIds, args);

  const payload = {
    seedUsername: seedUser.username || null,
    seedUserId: seedUser.userId,
    generatedAt: new Date().toISOString(),
    policy: {
      managerDepth: args.depth,
      seasons: args.seasons,
      excludedActiveSeason: String(new Date().getFullYear()),
      maxManagers: args.maxManagers,
      maxLeagues: args.maxLeagues,
      delayMs: args.delayMs,
      storage: 'none; aggregate-only terminal output',
    },
    discovery,
    aggregate,
  };

  const output = `${JSON.stringify(payload, null, 2)}\n`;
  if (args.outFile) {
    await fs.mkdir(path.dirname(path.resolve(args.outFile)), { recursive: true });
    await fs.writeFile(args.outFile, output);
  }
  console.log(output);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
