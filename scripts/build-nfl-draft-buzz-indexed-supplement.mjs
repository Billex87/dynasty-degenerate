import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const SOURCE_NAME = 'NFL Draft Buzz';
const OUTPUT_FILE = path.join(process.cwd(), 'server', 'prospect-snapshots', 'nfl-draft-buzz-indexed-supplement.json');
const monthlySnapshotFile = (scrapeMonth) => path.join(process.cwd(), 'server', 'prospect-snapshots', `nfl-draft-buzz-${scrapeMonth}.json`);
const SNAPSHOT_TIME_ZONE = 'America/Vancouver';
const DRAFT_BUZZ_ROLLOVER_MONTH = 5;
const DRAFT_BUZZ_ROLLOVER_DAY = 1;
const DRAFT_BUZZ_PIPELINE_YEARS_AHEAD = 2;

function getDefaultDraftBuzzYears(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SNAPSHOT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  const year = value('year');
  const month = value('month');
  const day = value('day');
  if (!Number.isFinite(year)) return [];
  const isPastDraftRollover = month > DRAFT_BUZZ_ROLLOVER_MONTH || (month === DRAFT_BUZZ_ROLLOVER_MONTH && day >= DRAFT_BUZZ_ROLLOVER_DAY);
  const firstFutureClass = isPastDraftRollover ? year + 1 : year;
  const finalYear = year + DRAFT_BUZZ_PIPELINE_YEARS_AHEAD;
  return Array.from({ length: Math.max(0, finalYear - firstFutureClass + 1) }, (_, index) => firstFutureClass + index);
}

const DEFAULT_YEARS = getDefaultDraftBuzzYears().join(',');
const YEARS = (process.env.DRAFT_BUZZ_YEARS || DEFAULT_YEARS)
  .split(',')
  .map((year) => Number(year.trim()))
  .filter((year) => Number.isFinite(year));
const POSITIONS = (process.env.DRAFT_BUZZ_POSITIONS || 'QB,RB,WR,TE')
  .split(',')
  .map((position) => position.trim().toUpperCase())
  .filter(Boolean);
const MAX_PAGES = Number(process.env.DRAFT_BUZZ_MAX_PAGES || 8);
const PAGE_DELAY_MS = Number(process.env.DRAFT_BUZZ_PAGE_DELAY_MS || 3000);
const PAGE_READY_TIMEOUT_MS = Number(process.env.DRAFT_BUZZ_PAGE_READY_TIMEOUT_MS || 35000);
const PAGE_RETRIES = Number(process.env.DRAFT_BUZZ_PAGE_RETRIES || 2);
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
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
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getProspectSnapshotMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SNAPSHOT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}`;
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
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSourceImageUrl(url) {
  if (!url || /noImage/i.test(url)) return null;
  const normalized = url
    .replace('/Content/PlayerHeadShotsSmall/', '/Content/PlayerHeadShots/')
    .replace('/Content/collmascotsSmall/', '/Content/collmascots/');
  if (/^https?:\/\//i.test(normalized)) return normalized.replace(/^http:/i, 'https:');
  if (normalized.startsWith('/')) return `https://www.nfldraftbuzz.com${normalized}`;
  return `https://www.nfldraftbuzz.com/${normalized}`;
}

function normalizeSchoolName(value) {
  return String(value || '')
    .replace(/AANDM/g, 'A&M')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

function normalizeNflTeamAbbr(value) {
  const team = String(value || '').trim().toUpperCase();
  if (!team || team === 'FA') return null;
  const normalized = team === 'JAC' ? 'JAX' : team === 'WSH' ? 'WAS' : team;
  return NFL_TEAM_ABBRS.has(normalized) ? normalized : null;
}

function getNflTeamFromLogoUrl(url) {
  return normalizeNflTeamAbbr(String(url || '').match(/\/NFLLogos\/([A-Z]{2,3})\.png/i)?.[1]);
}

function playerCollegeFromHref(href, position) {
  const slug = String(href || '').split('/').pop() || '';
  const parts = slug.split('-').filter(Boolean);
  const positionIndex = parts.findIndex((part) => part.toUpperCase() === position);
  const fallbackPositionIndex = positionIndex < 0
    ? parts.findIndex((part) => PLAYER_SLUG_POSITIONS.has(part.toUpperCase()))
    : positionIndex;
  if (fallbackPositionIndex < 0 || fallbackPositionIndex === parts.length - 1) return null;
  return normalizeSchoolName(parts.slice(fallbackPositionIndex + 1).join(' '));
}

function playerNameFromHref(href, position) {
  const slug = String(href || '').split('/').pop() || '';
  const parts = slug.split('-').filter(Boolean);
  const positionIndex = parts.findIndex((part) => part.toUpperCase() === position);
  if (positionIndex <= 0) return null;

  return parts
    .slice(0, positionIndex)
    .join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b(Jr|Sr|II|III|IV|V)\b\.?/g, '$1')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

function playerKey(player) {
  const nameKey = String(player.name || '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, '');
  return `${player.draftYear}:${player.position}:${nameKey}`;
}

function parseRankingRows(html, draftYear, position, sourceUrl, scrapeMonth) {
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
    const logoAlt = stripTags(row.match(/player-college-image-small[\s\S]*?<img[^>]+alt="([^"]+?)(?:\s+Mascot)?"/i)?.[1]);
    const nflTeam = getNflTeamFromLogoUrl(collegeLogoUrl) || normalizeNflTeamAbbr(logoAlt);
    const logoSchool = nflTeam ? null : normalizeSchoolName(logoAlt);
    const slugSchool = playerCollegeFromHref(href, position) || playerCollegeFromHref(playerImageUrl || '', position);
    const summary = stripTags(row.match(/<td[^>]*style="text-align:left"[^>]*>([\s\S]*?)<\/td>/i)?.[1]) || null;

    players.push({
      source: SOURCE_NAME,
      sourceUrl,
      scrapeMonth,
      draftYear,
      name,
      position,
      role: position,
      college: logoSchool || slugSchool || null,
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

function dedupe(players) {
  const byKey = new Map();
  for (const player of players) {
    const key = playerKey(player);
    const existing = byKey.get(key);
    const addsMissingMedia =
      Boolean(existing)
      && ((!existing.playerImageUrl && player.playerImageUrl)
        || (!existing.collegeLogoUrl && player.collegeLogoUrl)
        || (!existing.college && player.college)
        || (!existing.nflTeam && player.nflTeam));
    const shouldPreferPlayer =
      !existing
      || (player.positionRank || 9999) < (existing.positionRank || 9999)
      || (player.rating || 0) > (existing.rating || 0)
      || addsMissingMedia
      || (String(player.sourceUrl || '').includes('/RATING/DESC') && !String(existing.sourceUrl || '').includes('/RATING/DESC'));

    if (!existing || shouldPreferPlayer) {
      byKey.set(key, {
        ...existing,
        ...player,
        name: player.name.length >= (existing?.name || '').length ? player.name : existing?.name || player.name,
        playerImageUrl: player.playerImageUrl || existing?.playerImageUrl || null,
        collegeLogoUrl: player.collegeLogoUrl || existing?.collegeLogoUrl || null,
        college: player.college || existing?.college || null,
        nflTeam: player.nflTeam || existing?.nflTeam || null,
        summary: player.summary || existing?.summary || null,
        height: player.height || existing?.height || null,
        weight: player.weight || existing?.weight || null,
        fortyYardDash: player.fortyYardDash || existing?.fortyYardDash || null,
      });
    }
  }

  return Array.from(byKey.values()).sort((a, b) => (
    a.draftYear - b.draftYear
    || a.position.localeCompare(b.position)
    || (a.positionRank || 9999) - (b.positionRank || 9999)
    || a.name.localeCompare(b.name)
  ));
}

async function readExistingSupplement() {
  try {
    const payload = JSON.parse(await fs.readFile(OUTPUT_FILE, 'utf-8'));
    return Array.isArray(payload.players) ? payload.players : [];
  } catch {
    return [];
  }
}

async function waitForRankingRows(page) {
  const startedAt = Date.now();
  let html = await page.content();
  let rowCount = (html.match(/<tr\s+data-href="/gi) || []).length;
  while (!rowCount && Date.now() - startedAt < PAGE_READY_TIMEOUT_MS) {
    await sleep(1000);
    html = await page.content();
    rowCount = (html.match(/<tr\s+data-href="/gi) || []).length;
    const title = await page.title();
    if (!/just a moment/i.test(title) && /Player Rankings|NFL Draft/i.test(html)) break;
  }
  return html;
}

async function scrapePositionPage(browser, draftYear, position, pageNumber, scrapeMonth) {
  const sourceUrl = `https://www.nfldraftbuzz.com/positions/${position}/${pageNumber}/${draftYear}/RATING/DESC`;
  let lastError = null;

  for (let attempt = 1; attempt <= PAGE_RETRIES; attempt += 1) {
    const page = await browser.newPage({ userAgent: USER_AGENT });
    try {
      await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const html = await waitForRankingRows(page);
      const title = await page.title();
      const players = parseRankingRows(html, draftYear, position, sourceUrl, scrapeMonth);
      if (players.length || !/just a moment/i.test(title)) {
        await page.close();
        return { sourceUrl, players, error: null };
      }
      lastError = 'blocked by source protection';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'failed';
    } finally {
      if (!page.isClosed()) await page.close();
    }

    if (attempt < PAGE_RETRIES) await sleep(PAGE_DELAY_MS * attempt);
  }

  return { sourceUrl, players: [], error: lastError || 'no ranking rows' };
}

const scrapeMonth = getProspectSnapshotMonth();
const existingPlayers = await readExistingSupplement();
const scrapedPlayers = [];
const errors = [];
const pages = [];
const browser = await chromium.launch({ headless: true });

try {
  for (const draftYear of YEARS) {
    for (const position of POSITIONS) {
      for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
        await sleep(PAGE_DELAY_MS);
        const result = await scrapePositionPage(browser, draftYear, position, pageNumber, scrapeMonth);
        if (result.error || !result.players.length) {
          if (pageNumber === 1 && result.error) {
            const message = `${draftYear} ${position} page ${pageNumber}: ${result.error}`;
            errors.push(message);
            console.warn(message);
          }
          break;
        }
        scrapedPlayers.push(...result.players);
        pages.push(`${draftYear} ${position} page ${pageNumber}: ${result.players.length}`);
        console.log(`${draftYear} ${position} page ${pageNumber}: ${result.players.length}`);
        if (result.players.length < 12 && pageNumber > 1) break;
      }
    }
  }
} finally {
  await browser.close();
}

const payload = {
  schemaVersion: 1,
  source: SOURCE_NAME,
  generatedAt: new Date().toISOString(),
  scrapeMonth,
  note: 'Indexed 2026-2027 Draft Buzz supplement generated from rendered Draft Buzz position pages using a normal browser session.',
  players: dedupe([...existingPlayers, ...scrapedPlayers]),
  errors,
  pages,
};

await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
const monthlySnapshotPayload = {
  schemaVersion: 1,
  source: SOURCE_NAME,
  generatedAt: payload.generatedAt,
  scrapeMonth,
  yearsTracked: YEARS,
  pageCount: pages.length,
  players: payload.players.filter((player) => YEARS.includes(player.draftYear)),
  errors,
};
const monthlyFile = monthlySnapshotFile(scrapeMonth);
await fs.writeFile(monthlyFile, `${JSON.stringify(monthlySnapshotPayload, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile: OUTPUT_FILE,
  monthlyFile,
  scrapedPlayers: scrapedPlayers.length,
  players: payload.players.length,
  errors: payload.errors.length,
}, null, 2));
