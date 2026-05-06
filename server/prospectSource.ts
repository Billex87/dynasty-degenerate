import fs from 'fs';
import path from 'path';
import { findLatestProspectSnapshot, upsertProspectSnapshot } from './db';
import { canonicalPlayerNameKey } from './leagueAnalysis';
import type { ProspectProfile, ProspectSourceDiagnostics } from '../shared/types';

const SOURCE_NAME = 'NFL Draft Buzz' as const;
const SNAPSHOT_TIME_ZONE = 'America/Vancouver';
const PROSPECT_SNAPSHOT_DIR = path.join(process.cwd(), 'server', 'prospect-snapshots');
const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
const MAX_PAGES_PER_YEAR = 3;

type ProspectSnapshotPayload = {
  schemaVersion: 1;
  source: typeof SOURCE_NAME;
  generatedAt: string;
  scrapeMonth: string;
  yearsTracked: number[];
  pageCount: number;
  players: ProspectProfile[];
  errors: string[];
};

type ProspectContext = {
  profiles: ProspectProfile[];
  diagnostics: ProspectSourceDiagnostics;
};

let prospectContextCache: ProspectContext | null = null;

export function getProspectSnapshotMonth(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SNAPSHOT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}`;
}

function getProspectDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SNAPSHOT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '0';
  return {
    monthKey: `${value('year')}-${value('month')}`,
    day: Number(value('day')),
    hour: Number(value('hour')),
  };
}

export function shouldRunMonthlyProspectSnapshot(date = new Date(), snapshotHour = 7): boolean {
  const { day, hour } = getProspectDateParts(date);
  return day === 1 && hour === snapshotHour;
}

function getProspectYears(date = new Date()): number[] {
  const year = Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: SNAPSHOT_TIME_ZONE,
    year: 'numeric',
  }).format(date));
  return Array.from(new Set([year - 3, year - 2, year - 1, year, year + 1, year + 2]))
    .filter((item) => Number.isFinite(item) && item >= 2020);
}

function getSourceUrl(draftYear: number, page: number) {
  return `https://www.nfldraftbuzz.com/positions/ALL/${page}/${draftYear}`;
}

function getReaderUrls(sourceUrl: string) {
  return [
    `https://r.jina.ai/http://r.jina.ai/http://${sourceUrl}`,
    `https://r.jina.ai/http://${sourceUrl}`,
    sourceUrl,
  ];
}

async function fetchProspectPageMarkdown(sourceUrl: string): Promise<string> {
  let lastError = '';
  for (const url of getReaderUrls(sourceUrl)) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/plain, text/markdown, text/html;q=0.9,*/*;q=0.8',
          'user-agent': 'DynastyDegeneratesBot/1.0 monthly-prospect-context',
        },
      });
      const text = await response.text();
      if (!response.ok) {
        lastError = `${response.status} ${response.statusText}`;
        continue;
      }
      if (/Just a moment|SecurityCompromiseError|Enable JavaScript and cookies/i.test(text)) {
        lastError = 'blocked by source protection';
        continue;
      }
      if (/NFL DRAFT \d{4} Overall Prospect Rankings|Player Rankings/i.test(text)) {
        return text;
      }
      lastError = 'unexpected page shape';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'fetch failed';
    }
  }

  throw new Error(lastError || 'No readable prospect page returned');
}

function parseNumber(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanCollegeFromImage(line: string): string | null {
  const match = line.match(/Image\s+\d+:\s+(.+?)\s+Mascot/i) || line.match(/!\[Image\s+\d+:\s+(.+?)\s+Mascot/i);
  return match?.[1]?.trim() || null;
}

function stripMarkdownNoise(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .trim();
}

function isNoiseLine(line: string): boolean {
  return (
    !line
    || line === 'MORE'
    || line === '----'
    || line.startsWith('*')
    || line.startsWith('[')
    || line.startsWith('![')
    || /^REGISTER|^Home$|^Position Ranking$/i.test(line)
    || /^Image\s+\d+:/i.test(line)
  );
}

function parseProspectBlock(rawBlock: string[], draftYear: number, sourceUrl: string): ProspectProfile | null {
  const rankMatch = rawBlock[0]?.match(/^#{1,6}\s+(\d+)\s*$/);
  const overallRank = rankMatch ? Number(rankMatch[1]) : null;
  if (!overallRank) return null;

  const college = rawBlock.map(cleanCollegeFromImage).find(Boolean) || null;
  const lines = rawBlock
    .slice(1)
    .map(stripMarkdownNoise)
    .filter((line) => !isNoiseLine(line));
  const posIndex = lines.findIndex((line) => FANTASY_POSITIONS.has(line));
  if (posIndex < 0) return null;

  const position = lines[posIndex];
  const firstMeasureIndex = lines.findIndex((line, index) => index > posIndex && /^\d+-\d+\s+\d+lbs\s+[\d.]+$/.test(line));
  if (firstMeasureIndex < 0) return null;

  const name = lines.slice(posIndex + 1, firstMeasureIndex).join(' ').replace(/\s+/g, ' ').trim();
  if (!name) return null;

  const [height, weight, fortyYardDashRaw] = lines[firstMeasureIndex].split(/\s+/);
  const roleLine = lines[firstMeasureIndex + 1];
  const role = roleLine && roleLine.length <= 24 && !/^\d/.test(roleLine) ? roleLine : position;
  const metricsLine = lines.find((line, index) => (
    index > firstMeasureIndex
    && /^\d+lbs\s+\d+-\d+\s+[\d.]+\s+[\d.]+\s+[\d.]+$/.test(line)
  ));
  const metricParts = metricsLine?.split(/\s+/) || [];
  const averageOverallRank = parseNumber(metricParts[3]);
  const averagePositionRank = parseNumber(metricParts[4]);
  const metricIndex = metricsLine ? lines.indexOf(metricsLine) : -1;
  const rating = metricIndex >= 0 ? parseNumber(lines.slice(metricIndex + 1).find((line) => /^[\d.]+$/.test(line))) : null;
  const moreIndex = rawBlock.findIndex((line) => stripMarkdownNoise(line) === 'MORE');
  const summary = moreIndex >= 0
    ? rawBlock
      .slice(moreIndex + 1)
      .map(stripMarkdownNoise)
      .find((line) => line.length > 24 && !isNoiseLine(line)) || null
    : null;

  return {
    source: SOURCE_NAME,
    sourceUrl,
    scrapeMonth: getProspectSnapshotMonth(),
    draftYear,
    name,
    position,
    role,
    college,
    overallRank,
    averageOverallRank,
    averagePositionRank,
    rating,
    height,
    weight,
    fortyYardDash: parseNumber(fortyYardDashRaw),
    summary,
  };
}

export function parseNflDraftBuzzMarkdown(markdown: string, draftYear: number, sourceUrl: string): ProspectProfile[] {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim());
  const prospects: ProspectProfile[] = [];
  let block: string[] = [];

  const flush = () => {
    if (!block.length) return;
    const parsed = parseProspectBlock(block, draftYear, sourceUrl);
    if (parsed) prospects.push(parsed);
    block = [];
  };

  for (const line of lines) {
    if (/^#{1,6}\s+\d+\s*$/.test(line)) {
      flush();
      block = [line];
      continue;
    }
    if (block.length) block.push(line);
  }
  flush();

  const positionCounts = new Map<string, number>();
  return prospects.map((prospect) => {
    const nextPositionRank = (positionCounts.get(prospect.position) || 0) + 1;
    positionCounts.set(prospect.position, nextPositionRank);
    return {
      ...prospect,
      positionRank: nextPositionRank,
    };
  });
}

function dedupeProspects(profiles: ProspectProfile[]): ProspectProfile[] {
  const byKey = new Map<string, ProspectProfile>();
  for (const profile of profiles) {
    const key = `${profile.draftYear}:${canonicalPlayerNameKey(profile.name)}:${profile.position}`;
    const existing = byKey.get(key);
    if (!existing || (profile.overallRank || 9999) < (existing.overallRank || 9999)) {
      byKey.set(key, profile);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.draftYear - b.draftYear || (a.overallRank || 9999) - (b.overallRank || 9999));
}

function saveLocalProspectSnapshot(payload: ProspectSnapshotPayload): string | null {
  try {
    if (!fs.existsSync(PROSPECT_SNAPSHOT_DIR)) {
      fs.mkdirSync(PROSPECT_SNAPSHOT_DIR, { recursive: true });
    }
    const filePath = path.join(PROSPECT_SNAPSHOT_DIR, `nfl-draft-buzz-${payload.scrapeMonth}.json`);
    fs.writeFileSync(filePath, JSON.stringify(payload));
    return filePath;
  } catch (error) {
    console.error('[NFL Draft Buzz] Failed to save local prospect snapshot:', error);
    return null;
  }
}

function normalizeProspectSnapshot(raw: unknown): ProspectSnapshotPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw as Partial<ProspectSnapshotPayload>;
  if (!Array.isArray(payload.players)) return null;
  return {
    schemaVersion: 1,
    source: SOURCE_NAME,
    generatedAt: typeof payload.generatedAt === 'string' ? payload.generatedAt : new Date().toISOString(),
    scrapeMonth: typeof payload.scrapeMonth === 'string' ? payload.scrapeMonth : getProspectSnapshotMonth(),
    yearsTracked: Array.isArray(payload.yearsTracked) ? payload.yearsTracked.filter((year): year is number => typeof year === 'number') : [],
    pageCount: typeof payload.pageCount === 'number' ? payload.pageCount : 0,
    players: payload.players,
    errors: Array.isArray(payload.errors) ? payload.errors.filter((error): error is string => typeof error === 'string') : [],
  };
}

function loadLatestLocalProspectSnapshot(): ProspectSnapshotPayload | null {
  try {
    if (!fs.existsSync(PROSPECT_SNAPSHOT_DIR)) return null;
    const file = fs
      .readdirSync(PROSPECT_SNAPSHOT_DIR)
      .filter((item) => /^nfl-draft-buzz-\d{4}-\d{2}\.json$/.test(item))
      .sort()
      .at(-1);
    if (!file) return null;
    return normalizeProspectSnapshot(JSON.parse(fs.readFileSync(path.join(PROSPECT_SNAPSHOT_DIR, file), 'utf-8')));
  } catch (error) {
    console.warn('[NFL Draft Buzz] Failed to load local prospect snapshot:', error);
    return null;
  }
}

async function loadLatestStoredProspectSnapshot(): Promise<ProspectSnapshotPayload | null> {
  const dbSnapshot = await findLatestProspectSnapshot(SOURCE_NAME);
  if (dbSnapshot) {
    try {
      const parsed = normalizeProspectSnapshot(JSON.parse(dbSnapshot));
      if (parsed) return parsed;
    } catch (error) {
      console.warn('[NFL Draft Buzz] Failed to parse stored prospect snapshot:', error);
    }
  }
  return loadLatestLocalProspectSnapshot();
}

export async function storeNflDraftBuzzProspectSnapshot(forceYears?: number[]): Promise<ProspectSnapshotPayload> {
  const scrapeMonth = getProspectSnapshotMonth();
  const years = forceYears?.length ? forceYears : getProspectYears();
  const players: ProspectProfile[] = [];
  const errors: string[] = [];
  let pageCount = 0;

  for (const draftYear of years) {
    for (let page = 1; page <= MAX_PAGES_PER_YEAR; page += 1) {
      const sourceUrl = getSourceUrl(draftYear, page);
      try {
        const markdown = await fetchProspectPageMarkdown(sourceUrl);
        const parsed = parseNflDraftBuzzMarkdown(markdown, draftYear, sourceUrl)
          .filter((profile) => FANTASY_POSITIONS.has(profile.position));
        if (!parsed.length && page > 1) break;
        players.push(...parsed);
        pageCount += 1;
      } catch (error) {
        errors.push(`${draftYear} page ${page}: ${error instanceof Error ? error.message : 'failed'}`);
        if (page === 1) break;
      }
    }
  }

  const payload: ProspectSnapshotPayload = {
    schemaVersion: 1,
    source: SOURCE_NAME,
    generatedAt: new Date().toISOString(),
    scrapeMonth,
    yearsTracked: years,
    pageCount,
    players: dedupeProspects(players),
    errors,
  };

  const localFilePath = saveLocalProspectSnapshot(payload);
  const stored = await upsertProspectSnapshot(SOURCE_NAME, scrapeMonth, JSON.stringify(payload));
  prospectContextCache = null;

  if (!stored) {
    console.warn('[NFL Draft Buzz] Database not available; saved local prospect snapshot only');
  }
  if (localFilePath) {
    console.log(`[NFL Draft Buzz] Saved prospect snapshot to ${localFilePath}`);
  }

  return payload;
}

function buildDiagnostics(payload: ProspectSnapshotPayload | null): ProspectSourceDiagnostics {
  if (!payload) {
    return {
      source: SOURCE_NAME,
      status: 'missing',
      playerCount: 0,
      yearsTracked: [],
      note: 'No monthly prospect snapshot has been stored yet. Prospect trait cards will stay hidden until the first successful monthly run.',
    };
  }

  const playerCount = payload.players.length;
  return {
    source: SOURCE_NAME,
    status: playerCount ? (payload.errors.length ? 'partial' : 'stored') : 'error',
    scrapeMonth: payload.scrapeMonth,
    generatedAt: payload.generatedAt,
    playerCount,
    yearsTracked: payload.yearsTracked,
    note: playerCount
      ? `${playerCount} offensive prospect profiles are available for college/devy context. This is context only and does not affect blended values.`
      : 'The latest monthly prospect scrape did not return offensive players.',
    errors: payload.errors,
  };
}

export async function loadProspectContext(): Promise<ProspectContext> {
  if (prospectContextCache) return prospectContextCache;
  const payload = await loadLatestStoredProspectSnapshot();
  prospectContextCache = {
    profiles: payload?.players || [],
    diagnostics: buildDiagnostics(payload),
  };
  return prospectContextCache;
}

export function buildProspectLookup(profiles: ProspectProfile[]): Map<string, ProspectProfile> {
  const lookup = new Map<string, ProspectProfile>();
  for (const profile of profiles) {
    const nameKey = canonicalPlayerNameKey(profile.name);
    if (!nameKey) continue;
    const baseKeys = [
      nameKey,
      `${nameKey}:${profile.position}`,
      `${nameKey}:${profile.draftYear}`,
    ];
    const collegeKey = profile.college ? canonicalPlayerNameKey(profile.college) : '';
    for (const key of baseKeys) {
      if (!lookup.has(key)) lookup.set(key, profile);
      if (collegeKey && !lookup.has(`${key}:${collegeKey}`)) lookup.set(`${key}:${collegeKey}`, profile);
    }
  }
  return lookup;
}

export function findProspectProfile(
  lookup: Map<string, ProspectProfile>,
  name?: string | null,
  position?: string | null,
  college?: string | null,
  rookieYear?: string | number | null
): ProspectProfile | null {
  const nameKey = canonicalPlayerNameKey(name || '');
  if (!nameKey) return null;
  const collegeKey = college ? canonicalPlayerNameKey(String(college)) : '';
  const draftYear = rookieYear ? String(rookieYear) : '';
  const positionKey = position ? String(position).toUpperCase() : '';
  const keys = [
    collegeKey && `${nameKey}:${positionKey}:${collegeKey}`,
    collegeKey && `${nameKey}:${draftYear}:${collegeKey}`,
    draftYear && `${nameKey}:${draftYear}`,
    positionKey && `${nameKey}:${positionKey}`,
    collegeKey && `${nameKey}:${collegeKey}`,
    nameKey,
  ].filter(Boolean) as string[];

  return keys.map((key) => lookup.get(key)).find(Boolean) || null;
}

export function clearProspectContextCache() {
  prospectContextCache = null;
}
