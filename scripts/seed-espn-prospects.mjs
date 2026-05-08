import fs from 'node:fs/promises';
import path from 'node:path';

const ESPN_SOURCE = 'ESPN';
const DEFAULT_OUTPUT = path.join(process.cwd(), 'server', 'prospect-snapshots', 'espn-college-prospects.json');
const RANKINGS_CACHE_DIR = path.join(process.cwd(), '.cache', 'league-reports');
const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
const FLAGS_WITH_VALUES = new Set(['--draft-year', '--limit', '--out']);

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function getExplicitIds() {
  const ids = [];
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (FLAGS_WITH_VALUES.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith('--')) continue;
    ids.push(arg);
  }
  return ids;
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function collegeMatches(subtitle, college) {
  const normalizedSubtitle = normalizeSearchText(subtitle);
  const normalizedCollege = normalizeSearchText(college);
  return Boolean(normalizedSubtitle && normalizedCollege && (
    normalizedSubtitle === normalizedCollege
    || normalizedSubtitle.includes(normalizedCollege)
  ));
}

function isActiveStatus(status) {
  return normalizeSearchText(status) === 'active';
}

function normalizeHeight(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const totalInches = Number(value);
    return Number.isFinite(totalInches) && totalInches > 0
      ? `${Math.floor(totalInches / 12)}-${totalInches % 12}`
      : null;
  }
  const match = String(value).match(/(\d+)\s*'\s*(\d+)/);
  return match ? `${match[1]}-${match[2]}` : String(value).trim() || null;
}

function normalizeWeight(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return `${Math.round(value)}lbs`;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? `${Math.round(parsed)}lbs` : String(value).trim() || null;
}

function getTeamLogo(athlete) {
  const logos = Array.isArray(athlete?.team?.logos) ? athlete.team.logos : [];
  return logos.find((logo) => Array.isArray(logo?.rel) && logo.rel.includes('default'))?.href
    || logos[0]?.href
    || null;
}

function getProfileUrl(athlete) {
  const links = Array.isArray(athlete?.links) ? athlete.links : [];
  return links.find((link) => Array.isArray(link?.rel) && link.rel.includes('playercard'))?.href
    || links[0]?.href
    || null;
}

function extractAthleteId(candidate) {
  const values = [candidate?.uid, candidate?.link?.web, candidate?.link?.app].filter(Boolean);
  for (const value of values) {
    const text = String(value);
    const uidMatch = text.match(/~a:(\d+)/);
    if (uidMatch) return uidMatch[1];
    const urlMatch = text.match(/\/id\/(\d+)/);
    if (urlMatch) return urlMatch[1];
  }
  return null;
}

async function fetchEspnAthletePayload(id) {
  const url = `https://site.web.api.espn.com/apis/common/v3/sports/football/college-football/athletes/${encodeURIComponent(id)}`;
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'DynastyDegeneratesBot/1.0 espn-prospect-enrichment' },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function normalizeAthlete(payload, draftYear) {
  const athlete = payload?.athlete || payload;
  const name = athlete?.displayName || athlete?.fullName;
  const position = athlete?.position?.abbreviation || athlete?.position?.name;
  if (!name || !position) return null;

  return {
    source: ESPN_SOURCE,
    sourceUrl: getProfileUrl(athlete),
    espnId: athlete.id ? String(athlete.id) : null,
    draftYear,
    name,
    position: String(position).toUpperCase(),
    role: String(position).toUpperCase(),
    classYear: athlete.displayExperience || null,
    jersey: athlete.displayJersey || (athlete.jersey ? `#${athlete.jersey}` : null),
    status: athlete.status?.name || athlete.status?.type || null,
    birthPlace: athlete.displayBirthPlace || null,
    college: athlete.college?.name || athlete.team?.shortDisplayName || athlete.team?.location || null,
    playerImageUrl: athlete.headshot?.href || null,
    collegeLogoUrl: getTeamLogo(athlete),
    height: normalizeHeight(athlete.displayHeight || athlete.height),
    weight: normalizeWeight(athlete.displayWeight || athlete.weight),
  };
}

async function readExisting(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    return { schemaVersion: 1, source: ESPN_SOURCE, generatedAt: new Date().toISOString(), players: [], errors: [] };
  }
}

async function readLatestRankingsCache() {
  try {
    const files = await fs.readdir(RANKINGS_CACHE_DIR);
    const payloads = [];
    for (const file of files) {
      try {
        const filePath = path.join(RANKINGS_CACHE_DIR, file);
        const payload = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        if (payload?.rankings?.devySf || payload?.rankings?.profiles) {
          const stat = await fs.stat(filePath);
          payloads.push({ payload: payload.rankings, mtimeMs: stat.mtimeMs });
        }
      } catch {
        // Ignore non-report JSON and partially-written cache files.
      }
    }
    return payloads.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.payload || null;
  } catch {
    return null;
  }
}

async function readBoardRows(draftYear) {
  const rankings = await readLatestRankingsCache();
  if (!rankings) return [];
  const profileRows = Object.values(rankings.profiles || {}).flatMap((rows) => Array.isArray(rows) ? rows : []);
  const rows = [
    ...(Array.isArray(rankings.devySf) ? rankings.devySf : []),
    ...(Array.isArray(rankings.devyOneQb) ? rankings.devyOneQb : []),
    ...profileRows,
  ];
  const byKey = new Map();
  for (const row of rows) {
    const name = row?.name;
    const position = String(row?.pos || row?.prospectProfile?.position || '').toUpperCase();
    const rowDraftYear = Number(row?.draftYear || row?.prospectProfile?.draftYear || 0);
    if (!name || !FANTASY_POSITIONS.has(position) || rowDraftYear !== draftYear) continue;
    const key = `${normalizeSearchText(name)}:${position}:${rowDraftYear}`;
    const existing = byKey.get(key);
    if (!existing || (row.overallRank || 9999) < (existing.overallRank || 9999)) {
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => (a.overallRank || 9999) - (b.overallRank || 9999));
}

async function resolveEspnAthleteId(row) {
  if (row?.prospectProfile?.espnId) return row.prospectProfile.espnId;
  const name = row?.name;
  const college = row?.college || row?.prospectProfile?.college || null;
  const targetPosition = String(row?.pos || row?.prospectProfile?.position || '').toUpperCase();
  if (!name) throw new Error('missing name');

  const response = await fetch(`https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(name)}&limit=10`, {
    headers: { accept: 'application/json', 'user-agent': 'DynastyDegeneratesBot/1.0 espn-prospect-enrichment' },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const result = await response.json();
  const playerGroup = Array.isArray(result.results) ? result.results.find((item) => item?.type === 'player') : null;
  const candidates = (Array.isArray(playerGroup?.contents) ? playerGroup.contents : [])
    .filter((candidate) => (
      candidate?.defaultLeagueSlug === 'college-football'
      || candidate?.description === 'NCAAF'
      || String(candidate?.link?.web || '').includes('/college-football/')
    ));
  const normalizedName = normalizeSearchText(name);
  const exactNameCandidates = candidates.filter((candidate) => normalizeSearchText(candidate.displayName) === normalizedName);
  const matched = college
    ? exactNameCandidates.find((candidate) => collegeMatches(candidate.subtitle, college))
      || candidates.find((candidate) => collegeMatches(candidate.subtitle, college))
    : exactNameCandidates.length === 1
      ? exactNameCandidates[0]
      : null;
  if (matched) {
    const id = extractAthleteId(matched);
    if (!id) throw new Error(`no ESPN college-football match for ${name}${college ? ` (${college})` : ''}`);
    return id;
  }

  if (!college && exactNameCandidates.length > 1 && targetPosition) {
    const hydratedCandidates = [];
    for (const candidate of exactNameCandidates) {
      const id = extractAthleteId(candidate);
      if (!id) continue;
      try {
        const profile = normalizeAthlete(await fetchEspnAthletePayload(id), row.draftYear || row.prospectProfile?.draftYear);
        if (profile) hydratedCandidates.push({ candidate, id, profile });
      } catch {
        // Search results are still useful even when one profile endpoint fails.
      }
    }
    const positionMatches = hydratedCandidates.filter(({ profile }) => profile.position === targetPosition);
    const activeFreshmanMatches = positionMatches.filter(({ profile }) => (
      isActiveStatus(profile.status)
      && /freshman/i.test(profile.classYear || '')
    ));
    const activeMatches = positionMatches.filter(({ profile }) => isActiveStatus(profile.status));
    const freshmanMatches = positionMatches.filter(({ profile }) => /freshman/i.test(profile.classYear || ''));
    const selected = [activeFreshmanMatches, activeMatches, freshmanMatches, positionMatches]
      .find((matches) => matches.length === 1)?.[0];
    if (selected) return selected.id;
  }

  if (!college && exactNameCandidates.length > 1) {
    throw new Error(`ambiguous ESPN college-football matches for ${name}`);
  }
  throw new Error(`no ESPN college-football match for ${name}${college ? ` (${college})` : ''}`);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const draftYear = Number(getArgValue('--draft-year'));
const outputPath = getArgValue('--out') || DEFAULT_OUTPUT;
const limit = Number(getArgValue('--limit') || 0);
const fromRankingsCache = hasFlag('--from-rankings-cache');
const dryRun = hasFlag('--dry-run');
const ids = getExplicitIds();

if (!Number.isFinite(draftYear) || (!ids.length && !fromRankingsCache)) {
  console.error('Usage: node scripts/seed-espn-prospects.mjs --draft-year 2028 [--from-rankings-cache] [--limit 25] [--dry-run] 5141517 [more ESPN athlete ids]');
  process.exit(1);
}

const existing = await readExisting(outputPath);
const byKey = new Map((existing.players || []).map((player) => [`${player.draftYear}:${player.position}:${player.name}`.toLowerCase(), player]));
const errors = new Set(Array.isArray(existing.errors) ? existing.errors : []);
const requests = ids.map((id) => ({ id, source: 'explicit id' }));

if (fromRankingsCache) {
  const rows = await readBoardRows(draftYear);
  const selectedRows = limit > 0 ? rows.slice(0, limit) : rows;
  console.log(`[ESPN Prospects] Resolving ${selectedRows.length} ${draftYear} board players from local rankings cache`);
  for (const row of selectedRows) {
    try {
      const id = await resolveEspnAthleteId(row);
      requests.push({ id, source: `${row.name} (${row.college || row.prospectProfile?.college || 'unknown school'})` });
      await sleep(150);
    } catch (error) {
      const message = `${row.name}: ${error instanceof Error ? error.message : 'failed'}`;
      errors.add(message);
      console.warn(`[ESPN Prospects] ${message}`);
    }
  }
}

const seenIds = new Set();

for (const request of requests) {
  const id = String(request.id || '').trim();
  if (!id || seenIds.has(id)) continue;
  seenIds.add(id);
  try {
    const profile = normalizeAthlete(await fetchEspnAthletePayload(id), draftYear);
    if (!profile) throw new Error('Unexpected ESPN athlete payload shape');
    for (const existingError of Array.from(errors)) {
      if (existingError.startsWith(`${profile.name}:`)) {
        errors.delete(existingError);
      }
    }
    byKey.set(`${profile.draftYear}:${profile.position}:${profile.name}`.toLowerCase(), profile);
    console.log(`${dryRun ? 'Would seed' : 'Seeded'} ${profile.name} (${profile.position}, ${profile.college || 'unknown school'}) via ${request.source}`);
    await sleep(150);
  } catch (error) {
    const message = `${id}: ${error instanceof Error ? error.message : 'failed'}`;
    errors.add(message);
    console.warn(`[ESPN Prospects] ${message}`);
  }
}

const nextPayload = {
  schemaVersion: 1,
  source: ESPN_SOURCE,
  generatedAt: new Date().toISOString(),
  players: Array.from(byKey.values()).sort((a, b) => a.draftYear - b.draftYear || a.position.localeCompare(b.position) || a.name.localeCompare(b.name)),
  errors: Array.from(errors),
};

if (dryRun) {
  console.log(`[ESPN Prospects] Dry run complete: ${nextPayload.players.length} stored players would be written to ${outputPath}`);
} else {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(nextPayload, null, 2)}\n`);
}
