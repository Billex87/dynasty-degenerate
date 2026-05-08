import fs from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_FILE = path.join(process.cwd(), 'server', 'prospect-snapshots', 'nfl-draft-buzz-historical-supplement.json');
const YEARS = (process.env.DRAFT_BUZZ_YEARS || '2021,2022,2023,2024,2025')
  .split(',')
  .map((year) => Number(year.trim()))
  .filter((year) => Number.isFinite(year));
const POSITIONS = (process.env.DRAFT_BUZZ_POSITIONS || 'QB,RB,WR,TE')
  .split(',')
  .map((position) => position.trim().toUpperCase())
  .filter(Boolean);
const MAX_PAGES = 8;
const REQUEST_DELAY_MS = 500;
const FETCH_TIMEOUT_MS = 60000;
const FETCH_RETRIES = 3;
const PLAYER_SLUG_POSITIONS = new Set([
  'QB', 'RB', 'WR', 'TE', 'FB', 'LB', 'CB', 'S', 'SAF', 'EDGE', 'DE',
  'DT', 'DL', 'OL', 'OT', 'OG', 'C', 'K', 'P',
]);
const NFL_TEAM_ABBRS = new Set([
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
  'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA',
  'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB',
  'TEN', 'WAS',
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripTags(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value) {
  const parsed = Number(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSourceImageUrl(url) {
  if (!url || /noImage/i.test(url)) return null;
  const normalized = url
    .replace(/^\/web\/\d+(?:id_)?\//, '')
    .replace('/Content/PlayerHeadShotsSmall/', '/Content/PlayerHeadShots/')
    .replace('/Content/collmascotsSmall/', '/Content/collmascots/');
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith('/')) return `https://www.nfldraftbuzz.com${normalized}`;
  return `https://www.nfldraftbuzz.com/${normalized}`;
}

function normalizeSchoolName(value) {
  return String(value || '')
    .replace(/AANDM/g, 'A&M')
    .replace(/AANDM/i, 'A&M')
    .replace(/UTSA/g, 'UTSA')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

function getNflTeamFromLogoUrl(url) {
  const match = String(url || '').match(/\/NFLLogos\/([A-Z]{2,3})\.png/i);
  const team = match?.[1]?.toUpperCase();
  return team && NFL_TEAM_ABBRS.has(team) ? team : null;
}

function playerCollegeFromHref(href, position) {
  const slug = href.split('/').pop() || '';
  const parts = slug.split('-');
  const posIndex = parts.findIndex((part) => part.toUpperCase() === position);
  const fallbackPosIndex = posIndex < 0
    ? parts.findIndex((part) => PLAYER_SLUG_POSITIONS.has(part.toUpperCase()))
    : posIndex;
  if (fallbackPosIndex < 0 || fallbackPosIndex === parts.length - 1) return null;
  return normalizeSchoolName(parts.slice(fallbackPosIndex + 1).join(' '));
}

function playerNameFromHref(href, position) {
  const slug = href.split('/').pop() || '';
  const parts = slug.split('-');
  const posIndex = parts.findIndex((part) => part.toUpperCase() === position);
  if (posIndex <= 0) return null;

  return parts
    .slice(0, posIndex)
    .join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b(Jr|Sr|II|III|IV)\b\.?/g, '$1')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

function parseRankingRows(html, draftYear, position, sourceUrl) {
  const players = [];
  const rowPattern = /<tr\s+data-href="([^"]+)"[\s\S]*?<\/tr>/gi;
  let match;

  while ((match = rowPattern.exec(html))) {
    const href = match[1];
    const row = match[0];
    const rank = parseNumber(row.match(/<h6[^>]*>\s*<i>\s*(\d+)\s*<\/i>/i)?.[1]);
    const firstName = stripTags(row.match(/<span[^>]*class="firstName"[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    const lastName = stripTags(row.match(/<span[^>]*class="lastName"[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    const displayName = [firstName, lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    const hrefName = playerNameFromHref(href, position);
    const name = displayName.includes('...')
      ? hrefName || displayName.replace(/\.+$/g, '').trim()
      : displayName || hrefName || '';
    const rating = parseNumber(row.match(/whiteBold[\s\S]*?<div>\s*([0-9.]+)\s*<\/div>/i)?.[1]);
    const statusCells = Array.from(row.matchAll(/<td[^>]*class="[^"]*team-result__status d-none d-sm-table-cell[^"]*"[^>]*>([\s\S]*?)<\/td>/gi))
      .map((cell) => stripTags(cell[1]))
      .filter(Boolean);
    const parsedPosition = String(statusCells[0] || position).toUpperCase();
    if (!rank || !name || !rating || parsedPosition !== position) continue;

    const weight = statusCells[1] || null;
    const height = statusCells[2] || null;
    const fortyYardDash = parseNumber(statusCells[3]);
    const averagePositionRank = parseNumber(statusCells[4]);
    const averageOverallRank = parseNumber(statusCells[5]);
    const playerImageUrl = normalizeSourceImageUrl(row.match(/player-portrait__img[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1]);
    const collegeLogoUrl = normalizeSourceImageUrl(row.match(/player-college-image-small[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1]);
    const logoAlt = stripTags(row.match(/player-college-image-small[\s\S]*?<img[^>]+alt="([^"]+?)\s+Mascot"/i)?.[1]);
    const nflTeam = getNflTeamFromLogoUrl(collegeLogoUrl) || (NFL_TEAM_ABBRS.has(logoAlt) ? logoAlt : null);
    const college = playerCollegeFromHref(href, position)
      || playerCollegeFromHref(playerImageUrl || '', position)
      || (nflTeam ? null : logoAlt);
    const summary = stripTags(row.match(/<td[^>]*style="text-align:left"[^>]*>([\s\S]*?)<\/td>/i)?.[1]) || null;

    players.push({
      source: 'NFL Draft Buzz',
      sourceUrl,
      scrapeMonth: 'historical-wayback',
      draftYear,
      name,
      position,
      role: position,
      college,
      nflTeam,
      playerImageUrl,
      collegeLogoUrl,
      overallRank: rank,
      positionRank: rank,
      averageOverallRank,
      averagePositionRank,
      rating,
      height,
      weight,
      fortyYardDash,
      summary,
    });
  }

  return players;
}

async function fetchText(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
          'user-agent': 'DynastyDegeneratesBot/1.0 historical-nfl-draft-buzz-archive',
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_RETRIES) await sleep(REQUEST_DELAY_MS * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error('fetch failed');
}

async function getWaybackSnapshotUrls(sourceUrl) {
  const noWwwSourceUrl = sourceUrl.replace('https://www.nfldraftbuzz.com/', 'https://nfldraftbuzz.com/');
  const fallbackUrls = [
    `https://web.archive.org/web/0id_/${sourceUrl}`,
    `https://web.archive.org/web/0id_/${noWwwSourceUrl}`,
  ];
  const cdxUrl = `https://web.archive.org/cdx?url=${encodeURIComponent(sourceUrl)}&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&collapse=digest&limit=80`;
  try {
    const text = await fetchText(cdxUrl);
    const rows = JSON.parse(text);
    if (!Array.isArray(rows) || rows.length <= 1) return fallbackUrls;
    const snapshots = rows.slice(1).filter((row) => Array.isArray(row) && row[0]);
    return [
      ...snapshots
        .reverse()
        .flatMap((snapshot) => [
          `https://web.archive.org/web/${snapshot[0]}id_/${sourceUrl}`,
          `https://web.archive.org/web/${snapshot[0]}id_/${noWwwSourceUrl}`,
        ]),
      ...fallbackUrls,
    ];
  } catch {
    return fallbackUrls;
  }
}

async function fetchArchivedPositionPage(draftYear, position, page) {
  const sourceUrl = `https://www.nfldraftbuzz.com/positions/${position}/${page}/${draftYear}`;
  const snapshotUrls = await getWaybackSnapshotUrls(sourceUrl);
  if (!snapshotUrls.length) return { sourceUrl, players: [], error: 'no archived snapshot' };
  let lastError = 'no parseable archived snapshot';
  for (const snapshotUrl of snapshotUrls) {
    try {
      await sleep(REQUEST_DELAY_MS);
      const html = await fetchText(snapshotUrl);
      const players = parseRankingRows(html, draftYear, position, sourceUrl);
      if (players.length) return { sourceUrl, players, error: null };
      lastError = 'archived snapshot had no ranking rows';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'failed';
    }
  }
  return { sourceUrl, players: [], error: lastError };
}

function dedupe(players) {
  const byKey = new Map();
  for (const player of players) {
    const key = `${player.draftYear}:${player.position}:${player.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
    const existing = byKey.get(key);
    if (!existing || player.rating > existing.rating || (player.overallRank || 9999) < (existing.overallRank || 9999)) {
      byKey.set(key, player);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => (
    a.draftYear - b.draftYear
    || a.position.localeCompare(b.position)
    || (a.positionRank || 9999) - (b.positionRank || 9999)
    || a.name.localeCompare(b.name)
  ));
}

const players = [];
const errors = [];
const pages = [];

try {
  const existing = JSON.parse(await fs.readFile(OUTPUT_FILE, 'utf-8'));
  if (Array.isArray(existing.players)) {
    players.push(...existing.players);
  }
  if (Array.isArray(existing.pages)) {
    pages.push(...existing.pages.filter((page) => typeof page === 'string'));
  }
} catch {
  // First run.
}

for (const draftYear of YEARS) {
  for (const position of POSITIONS) {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      try {
        await sleep(REQUEST_DELAY_MS);
        const result = await fetchArchivedPositionPage(draftYear, position, page);
        if (result.error || !result.players.length) {
          if (page === 1 && result.error) {
            const message = `${draftYear} ${position} page ${page}: ${result.error}`;
            errors.push(message);
            console.warn(message);
          }
          break;
        }
        players.push(...result.players);
        pages.push(`${draftYear} ${position} page ${page}: ${result.players.length}`);
        console.log(`${draftYear} ${position} page ${page}: ${result.players.length}`);
      } catch (error) {
        const message = `${draftYear} ${position} page ${page}: ${error instanceof Error ? error.message : 'failed'}`;
        errors.push(message);
        console.warn(message);
        break;
      }
    }
  }
}

const payload = {
  schemaVersion: 1,
  source: 'NFL Draft Buzz',
  generatedAt: new Date().toISOString(),
  scrapeMonth: 'historical-wayback',
  note: 'Historical NFL Draft Buzz archive generated from Wayback snapshots for fantasy positions.',
  players: dedupe(players),
  errors,
  pages: Array.from(new Set(pages)),
};

await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile: OUTPUT_FILE,
  players: payload.players.length,
  errors: payload.errors.length,
}, null, 2));
