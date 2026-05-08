import fs from 'fs';
import path from 'path';
import { findLatestProspectSnapshot, upsertProspectSnapshot } from './db';
import { canonicalPlayerNameKey } from './leagueAnalysis';
import type { ProspectProfile, ProspectSourceDiagnostics } from '../shared/types';

const SOURCE_NAME = 'NFL Draft Buzz' as const;
const ESPN_SOURCE_NAME = 'ESPN' as const;
const SNAPSHOT_TIME_ZONE = 'America/Vancouver';
const PROSPECT_SNAPSHOT_DIR = path.join(process.cwd(), 'server', 'prospect-snapshots');
const ESPN_PROSPECT_FILE = path.join(PROSPECT_SNAPSHOT_DIR, 'espn-college-prospects.json');
const NFL_DRAFT_BUZZ_INDEXED_SUPPLEMENT_FILE = path.join(PROSPECT_SNAPSHOT_DIR, 'nfl-draft-buzz-indexed-supplement.json');
const NFL_DRAFT_BUZZ_HISTORICAL_SUPPLEMENT_FILE = path.join(PROSPECT_SNAPSHOT_DIR, 'nfl-draft-buzz-historical-supplement.json');
const FANTASY_POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;
const FANTASY_POSITION_SET = new Set<string>(FANTASY_POSITIONS);
const NFL_TEAM_ABBRS = new Set([
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
  'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA',
  'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB',
  'TEN', 'WAS',
]);
const PLAYER_SLUG_POSITIONS = new Set([
  'QB', 'RB', 'WR', 'TE', 'FB', 'LB', 'CB', 'S', 'SAF', 'EDGE', 'DE',
  'DT', 'DL', 'OL', 'OT', 'OG', 'C', 'K', 'P',
]);
const DRAFT_BUZZ_HISTORY_START_YEAR = 2021;
const MAX_PAGES_PER_POSITION = 8;
const PROSPECT_FETCH_TIMEOUT_MS = 30000;
const PROSPECT_FETCH_DELAY_MS = 2500;

class ProspectSourceProtectionError extends Error {
  constructor(message = 'blocked by source protection') {
    super(message);
    this.name = 'ProspectSourceProtectionError';
  }
}

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

type EspnProspectSnapshotPayload = {
  schemaVersion: 1;
  source: typeof ESPN_SOURCE_NAME;
  generatedAt: string;
  players: ProspectProfile[];
  errors?: string[];
};

type IndexedProspectSupplementPayload = {
  schemaVersion: 1;
  source: typeof SOURCE_NAME;
  generatedAt: string;
  scrapeMonth: string;
  note?: string;
  players: ProspectProfile[];
  errors?: string[];
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

export function getProspectYears(date = new Date()): number[] {
  const year = Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: SNAPSHOT_TIME_ZONE,
    year: 'numeric',
  }).format(date));
  const finalYear = year + 2;
  return Array.from(
    { length: Math.max(0, finalYear - DRAFT_BUZZ_HISTORY_START_YEAR + 1) },
    (_, index) => DRAFT_BUZZ_HISTORY_START_YEAR + index
  ).filter((item) => Number.isFinite(item));
}

function getSourceUrl(draftYear: number, position: string, page: number) {
  return `https://www.nfldraftbuzz.com/positions/${position}/${page}/${draftYear}`;
}

function getReaderTargetUrl(sourceUrl: string) {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.endsWith('nfldraftbuzz.com')) {
      parsed.protocol = 'http:';
      return parsed.toString();
    }
  } catch {
    return sourceUrl;
  }
  return sourceUrl;
}

function getReaderUrls(sourceUrl: string) {
  const readerTargetUrl = getReaderTargetUrl(sourceUrl);
  return [
    `https://r.jina.ai/${readerTargetUrl}`,
    `https://r.jina.ai/${sourceUrl}`,
    sourceUrl,
  ];
}

function normalizeDraftBuzzSchoolName(value?: string | null): string | null {
  const normalized = String(value || '')
    .replace(/AANDM/g, 'A&M')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || null;
}

function getNflTeamFromDraftBuzzLogoUrl(url?: string | null): string | null {
  const team = String(url || '').match(/\/NFLLogos\/([A-Z]{2,3})\.png/i)?.[1]?.toUpperCase();
  return team && NFL_TEAM_ABBRS.has(team) ? team : null;
}

function getSchoolFromDraftBuzzAssetUrl(url: string | null | undefined, expectedPosition?: string | null): string | null {
  const fileName = String(url || '').split('/').pop()?.replace(/\.[a-z0-9]+$/i, '') || '';
  const parts = fileName.split('-').filter(Boolean);
  let positionIndex = parts.findIndex((part) => part.toUpperCase() === String(expectedPosition || '').toUpperCase());
  if (positionIndex < 0) {
    positionIndex = parts.findIndex((part) => PLAYER_SLUG_POSITIONS.has(part.toUpperCase()));
  }
  if (positionIndex < 0 || positionIndex === parts.length - 1) return null;
  return normalizeDraftBuzzSchoolName(parts.slice(positionIndex + 1).join(' '));
}

function normalizeNflDraftBuzzProfile(profile: ProspectProfile): ProspectProfile {
  if (profile.source !== SOURCE_NAME) return profile;

  const college = typeof profile.college === 'string' ? profile.college.trim() : '';
  const existingTeam = typeof profile.nflTeam === 'string' ? profile.nflTeam.trim().toUpperCase() : '';
  const logoTeam = getNflTeamFromDraftBuzzLogoUrl(profile.collegeLogoUrl);
  const collegeTeam = NFL_TEAM_ABBRS.has(college.toUpperCase()) ? college.toUpperCase() : null;
  const nflTeam = existingTeam || logoTeam || collegeTeam || null;
  const school = getSchoolFromDraftBuzzAssetUrl(profile.playerImageUrl, profile.position)
    || (nflTeam ? null : normalizeDraftBuzzSchoolName(college));

  if (!nflTeam && school === college) return profile;

  return {
    ...profile,
    college: school || profile.college || null,
    collegeLogoUrl: logoTeam ? null : profile.collegeLogoUrl || null,
    nflTeam: nflTeam || profile.nflTeam || null,
  };
}

async function fetchProspectPageMarkdown(sourceUrl: string): Promise<string> {
  let lastError = '';
  for (const url of getReaderUrls(sourceUrl)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROSPECT_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/plain, text/markdown, text/html;q=0.9,*/*;q=0.8',
          'user-agent': 'DynastyDegeneratesBot/1.0 monthly-prospect-context',
        },
        signal: controller.signal,
      });
      const text = await response.text();
      if (/SecurityCompromiseError|DDoS attack suspected|blocked until/i.test(text)) {
        throw new ProspectSourceProtectionError('blocked by NFL Draft Buzz source protection');
      }
      if (/Just a moment|Enable JavaScript and cookies/i.test(text)) {
        lastError = 'blocked by source protection';
        continue;
      }
      if (!response.ok) {
        lastError = `${response.status} ${response.statusText}`;
        continue;
      }
      if (/NFL DRAFT \d{4} Overall Prospect Rankings|Player Rankings/i.test(text)) {
        return text;
      }
      lastError = 'unexpected page shape';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'fetch failed';
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(lastError || 'No readable prospect page returned');
}

function parseNumber(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEspnHeight(value?: string | number | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const totalInches = Number(value);
    if (Number.isFinite(totalInches) && totalInches > 0) {
      return `${Math.floor(totalInches / 12)}-${totalInches % 12}`;
    }
  }
  const text = String(value).trim();
  const match = text.match(/(\d+)\s*'\s*(\d+)/);
  if (match) return `${match[1]}-${match[2]}`;
  return text.replace(/\s+/g, ' ') || null;
}

function normalizeEspnWeight(value?: string | number | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return `${Math.round(value)}lbs`;
  const numeric = parseNumber(value);
  return numeric ? `${Math.round(numeric)}lbs` : String(value).trim() || null;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function cleanCollegeFromImage(line: string): string | null {
  const match = line.match(/Image\s+\d+:\s+(.+?)\s+Mascot/i) || line.match(/!\[Image\s+\d+:\s+(.+?)\s+Mascot/i);
  return match?.[1]?.trim() || null;
}

function normalizeSourceImageUrl(url: string | null | undefined, sourceUrl: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, sourceUrl);
    if (parsed.hostname.endsWith('nfldraftbuzz.com')) {
      parsed.protocol = 'https:';
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function getHighResolutionImageUrl(url: string | null | undefined): string | null {
  if (!url || /noImage/i.test(url)) return null;
  return url
    .replace('/Content/PlayerHeadShotsSmall/', '/Content/PlayerHeadShots/')
    .replace('/Content/collmascotsSmall/', '/Content/collmascots/');
}

function getEspnTeamLogo(athlete: any): string | null {
  const logos = Array.isArray(athlete?.team?.logos) ? athlete.team.logos : [];
  return logos.find((logo: any) => Array.isArray(logo?.rel) && logo.rel.includes('default'))?.href
    || logos[0]?.href
    || null;
}

function getEspnProfileUrl(athlete: any): string | null {
  const links = Array.isArray(athlete?.links) ? athlete.links : [];
  return links.find((link: any) => Array.isArray(link?.rel) && link.rel.includes('playercard'))?.href
    || links[0]?.href
    || null;
}

export function normalizeEspnAthleteProfile(raw: unknown, draftYear: number): ProspectProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw as { athlete?: any };
  const athlete = payload.athlete && typeof payload.athlete === 'object' ? payload.athlete : raw as any;
  const name = typeof athlete?.displayName === 'string'
    ? athlete.displayName
    : typeof athlete?.fullName === 'string'
      ? athlete.fullName
      : null;
  const position = athlete?.position?.abbreviation || athlete?.position?.name || null;
  if (!name || !position || !Number.isFinite(Number(draftYear))) return null;

  return {
    source: ESPN_SOURCE_NAME,
    sourceUrl: getEspnProfileUrl(athlete),
    espnId: athlete.id ? String(athlete.id) : null,
    draftYear: Number(draftYear),
    name,
    position: String(position).toUpperCase(),
    role: String(position).toUpperCase(),
    classYear: athlete.displayExperience || null,
    jersey: athlete.displayJersey || (athlete.jersey ? `#${athlete.jersey}` : null),
    status: athlete.status?.name || athlete.status?.type || null,
    birthPlace: athlete.displayBirthPlace || null,
    college: athlete.college?.name || athlete.team?.shortDisplayName || athlete.team?.location || null,
    playerImageUrl: athlete.headshot?.href || null,
    collegeLogoUrl: getEspnTeamLogo(athlete),
    height: normalizeEspnHeight(athlete.displayHeight || athlete.height),
    weight: normalizeEspnWeight(athlete.displayWeight || athlete.weight),
  };
}

function extractMarkdownImages(rawBlock: string[], sourceUrl: string): Array<{ alt: string; url: string }> {
  const images: Array<{ alt: string; url: string }> = [];
  for (const line of rawBlock) {
    for (const match of Array.from(line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g))) {
      const url = normalizeSourceImageUrl(match[2], sourceUrl);
      if (url) images.push({ alt: match[1] || '', url });
    }
  }
  return images;
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
  const images = extractMarkdownImages(rawBlock, sourceUrl);
  const collegeLogoUrl = getHighResolutionImageUrl(images.find((image) => /mascot/i.test(image.alt))?.url) || null;
  const playerImageUrl = getHighResolutionImageUrl(images.find((image) => /profile picture|thumbnail/i.test(image.alt))?.url) || null;
  const cleanLines = rawBlock.map(stripMarkdownNoise).filter(Boolean);
  const scoutingHeader = cleanLines.find((line) => /from .+ (QB|RB|WR|TE) \d{4} Scouting Report/i.test(line));
  if (scoutingHeader) {
    const rankMatch = rawBlock[0]?.match(/^#{1,6}\s+#?(\d+)/);
    const overallRank = rankMatch ? Number(rankMatch[1]) : null;
    const headerMatch = scoutingHeader.match(/^(.+?)\s+from\s+(.+?)\s+(QB|RB|WR|TE)\s+(\d{4})\s+Scouting Report/i);
    if (!headerMatch || !overallRank) return null;
    const [, nameRaw, collegeRaw, positionRaw, draftYearRaw] = headerMatch;
    const position = positionRaw.toUpperCase();
    const ratingIndex = cleanLines.findIndex((line) => /^RATING$/i.test(line));
    const rankIndex = cleanLines.findIndex((line) => /^RANK$/i.test(line));
    const collegeLine = cleanLines.find((line) => /^College\s+/i.test(line));
    const college = collegeLine
      ? collegeLine.replace(/^College\s+(Freshman|Sophomore|Junior|Senior|RS\s+\w+)\s+/i, '').trim()
      : collegeRaw.trim();
    const summaryLine = cleanLines.find((line) => /^Player Summary\s+/i.test(line));

    return {
      source: SOURCE_NAME,
      sourceUrl,
      scrapeMonth: getProspectSnapshotMonth(),
      draftYear: Number(draftYearRaw) || draftYear,
      name: nameRaw.trim(),
      position,
      role: collegeLine?.match(/^College\s+(.+?)\s+[A-Z]/)?.[1] || null,
      college,
      playerImageUrl,
      collegeLogoUrl,
      overallRank,
      positionRank: rankIndex >= 0 ? parseNumber(cleanLines[rankIndex + 1]) : null,
      averageOverallRank: parseNumber(cleanLines.find((line) => /^All Scouts Average Overall Rank/i.test(line))),
      averagePositionRank: parseNumber(cleanLines.find((line) => /^All Scouts Average Position Rank/i.test(line))),
      rating: ratingIndex >= 0 ? parseNumber(cleanLines[ratingIndex + 1]) : null,
      height: cleanLines.find((line) => /^Height Feet/i.test(line))?.replace(/^Height Feet\s+/i, '') || null,
      weight: cleanLines.find((line) => /^Weight Lbs/i.test(line))?.replace(/^Weight Lbs\s+/i, '') || null,
      fortyYardDash: parseNumber(cleanLines.find((line) => /^Forty Time Secs/i.test(line))),
      summary: summaryLine?.replace(/^Player Summary\s+/i, '') || null,
    };
  }

  const rankMatch = rawBlock[0]?.match(/^#{1,6}\s+(\d+)\s*$/);
  const overallRank = rankMatch ? Number(rankMatch[1]) : null;
  if (!overallRank) return null;

  const college = rawBlock.map(cleanCollegeFromImage).find(Boolean) || null;
  const lines = rawBlock
    .slice(1)
    .map(stripMarkdownNoise)
    .filter((line) => !isNoiseLine(line));
  const posIndex = lines.findIndex((line) => FANTASY_POSITION_SET.has(line));
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
    playerImageUrl,
    collegeLogoUrl,
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

function parseProspectRankingRow(rawBlock: string[], draftYear: number, sourceUrl: string): ProspectProfile | null {
  const rankMatch = rawBlock[0]?.match(/^######\s+_?(\d+)_?/);
  const overallRank = rankMatch ? Number(rankMatch[1]) : null;
  if (!overallRank) return null;

  const images = extractMarkdownImages(rawBlock, sourceUrl);
  const collegeLogoUrl = getHighResolutionImageUrl(images.find((image) => /mascot/i.test(image.alt))?.url) || null;
  const playerImageUrl = getHighResolutionImageUrl(images.find((image) => /profile picture|thumbnail/i.test(image.alt))?.url) || null;
  const college = rawBlock.map(cleanCollegeFromImage).find(Boolean) || null;
  const cleanLines = rawBlock
    .map(stripMarkdownNoise)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line && !/^######/.test(line) && line !== '####' && !/^Image\s+\d+:/i.test(line));
  const posIndex = cleanLines.findIndex((line) => FANTASY_POSITION_SET.has(line));
  if (posIndex < 0) return null;

  const measurementPattern = /(\d+-\d+)\s+(\d+lbs)\s+([\d.]+)/;
  let measurementIndex = -1;
  let measurementMatch: RegExpMatchArray | null = null;
  const nameParts: string[] = [];

  for (let index = posIndex + 1; index < cleanLines.length; index += 1) {
    const line = cleanLines[index];
    const match = line.match(measurementPattern);
    if (match) {
      measurementIndex = index;
      measurementMatch = match;
      const namePrefix = line.slice(0, match.index).trim();
      if (namePrefix) nameParts.push(namePrefix);
      break;
    }
    if (!FANTASY_POSITION_SET.has(line) && !/^MORE>>/i.test(line)) {
      nameParts.push(line);
    }
  }

  if (!measurementMatch) return null;
  const [height, weight, fortyYardDashRaw] = measurementMatch.slice(1);
  const name = nameParts.join(' ').replace(/\s+/g, ' ').trim();
  if (!name) return null;

  const metricIndex = cleanLines.findIndex((line, index) => (
    index > measurementIndex
    && /\d+lbs\s+\d+-\d+\s+[\d.]+\s+[\d.]+\s+[\d.]+/.test(line)
  ));
  const metricMatch = metricIndex >= 0
    ? cleanLines[metricIndex].match(/\d+lbs\s+\d+-\d+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)(?:\s+([\d.]+))?/)
    : null;
  const rating = metricMatch?.[3]
    ? parseNumber(metricMatch[3])
    : parseNumber(cleanLines.slice(Math.max(metricIndex + 1, measurementIndex + 1)).find((line) => /^[\d.]+$/.test(line)));
  const moreIndex = cleanLines.findIndex((line) => /^MORE>>/i.test(line));
  const summary = moreIndex >= 0
    ? cleanLines[moreIndex].replace(/^MORE>>\s*/i, '').trim() || cleanLines[moreIndex + 1] || null
    : null;

  return {
    source: SOURCE_NAME,
    sourceUrl,
    scrapeMonth: getProspectSnapshotMonth(),
    draftYear,
    name,
    position: cleanLines[posIndex],
    role: cleanLines[posIndex],
    college,
    playerImageUrl,
    collegeLogoUrl,
    overallRank,
    positionRank: overallRank,
    averageOverallRank: parseNumber(metricMatch?.[2]),
    averagePositionRank: parseNumber(metricMatch?.[1]),
    rating,
    height,
    weight,
    fortyYardDash: parseNumber(fortyYardDashRaw),
    summary,
  };
}

function parseProspectRankingRows(markdown: string, draftYear: number, sourceUrl: string): ProspectProfile[] {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim());
  const startIndex = lines.findIndex((line) => /^##\s+Player Rankings/i.test(line));
  if (startIndex < 0) return [];

  const prospects: ProspectProfile[] = [];
  let block: string[] = [];
  const flush = () => {
    if (!block.length) return;
    const parsed = parseProspectRankingRow(block, draftYear, sourceUrl);
    if (parsed) prospects.push(parsed);
    block = [];
  };

  for (const line of lines.slice(startIndex + 1)) {
    if (/^##\s+/.test(line)) {
      flush();
      break;
    }
    if (/^######\s+_?\d+_?/i.test(line)) {
      flush();
      block = [line];
      continue;
    }
    if (block.length) block.push(line);
  }
  flush();

  return prospects;
}

function mergeParsedProspects(profiles: ProspectProfile[]): ProspectProfile[] {
  const merged = new Map<string, ProspectProfile>();
  for (const profile of profiles) {
    const key = `${profile.draftYear}:${canonicalPlayerNameKey(profile.name)}:${profile.position}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, profile);
      continue;
    }
    const primary = profile.source === SOURCE_NAME || existing.source !== SOURCE_NAME ? profile : existing;
    const secondary = primary === profile ? existing : profile;
    merged.set(key, {
      ...primary,
      source: primary.source,
      sourceUrl: primary.sourceUrl || secondary.sourceUrl || null,
      scrapeMonth: primary.scrapeMonth || secondary.scrapeMonth || null,
      espnId: primary.espnId || secondary.espnId || null,
      classYear: primary.classYear || secondary.classYear || null,
      jersey: primary.jersey || secondary.jersey || null,
      status: primary.status || secondary.status || null,
      birthPlace: primary.birthPlace || secondary.birthPlace || null,
      playerImageUrl: primary.playerImageUrl || secondary.playerImageUrl || null,
      collegeLogoUrl: primary.collegeLogoUrl || secondary.collegeLogoUrl || null,
      college: primary.college || secondary.college || null,
      nflTeam: primary.nflTeam || secondary.nflTeam || null,
      summary: primary.summary || secondary.summary || null,
      overallRank: primary.overallRank || secondary.overallRank || null,
      positionRank: primary.positionRank || secondary.positionRank || null,
      averageOverallRank: primary.averageOverallRank || secondary.averageOverallRank || null,
      averagePositionRank: primary.averagePositionRank || secondary.averagePositionRank || null,
      rating: primary.rating || secondary.rating || null,
      height: primary.height || secondary.height || null,
      weight: primary.weight || secondary.weight || null,
      fortyYardDash: primary.fortyYardDash || secondary.fortyYardDash || null,
    });
  }
  return Array.from(merged.values()).sort((a, b) => (a.overallRank || 9999) - (b.overallRank || 9999));
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
    if (/^#{1,6}\s+(?:#\s*)?\d+\s*(?:RANKED.*)?$/i.test(line)) {
      flush();
      block = [line];
      continue;
    }
    if (block.length) block.push(line);
  }
  flush();

  const positionCounts = new Map<string, number>();
  return mergeParsedProspects([...prospects, ...parseProspectRankingRows(markdown, draftYear, sourceUrl)]).map((prospect) => {
    const nextPositionRank = (positionCounts.get(prospect.position) || 0) + 1;
    positionCounts.set(prospect.position, nextPositionRank);
    return {
      ...prospect,
      positionRank: prospect.positionRank || nextPositionRank,
    };
  });
}

function dedupeProspects(profiles: ProspectProfile[]): ProspectProfile[] {
  const byKey = new Map<string, ProspectProfile>();
  for (const rawProfile of profiles) {
    const profile = normalizeNflDraftBuzzProfile(rawProfile);
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
    players: dedupeProspects(payload.players
      .filter((profile): profile is ProspectProfile => Boolean(profile?.name && profile?.position && profile?.draftYear))
      .map((profile) => ({
        ...profile,
        source: SOURCE_NAME,
      }))),
    errors: Array.isArray(payload.errors) ? payload.errors.filter((error): error is string => typeof error === 'string') : [],
  };
}

function normalizeEspnProspectSnapshot(raw: unknown): EspnProspectSnapshotPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw as Partial<EspnProspectSnapshotPayload>;
  if (!Array.isArray(payload.players)) return null;
  return {
    schemaVersion: 1,
    source: ESPN_SOURCE_NAME,
    generatedAt: typeof payload.generatedAt === 'string' ? payload.generatedAt : new Date().toISOString(),
    players: payload.players
      .filter((profile): profile is ProspectProfile => Boolean(profile?.name && profile?.position && profile?.draftYear))
      .map((profile) => ({
        ...profile,
        source: ESPN_SOURCE_NAME,
      })),
    errors: Array.isArray(payload.errors) ? payload.errors.filter((error): error is string => typeof error === 'string') : [],
  };
}

function normalizeIndexedProspectSupplement(raw: unknown): IndexedProspectSupplementPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw as Partial<IndexedProspectSupplementPayload>;
  if (!Array.isArray(payload.players)) return null;
  return {
    schemaVersion: 1,
    source: SOURCE_NAME,
    generatedAt: typeof payload.generatedAt === 'string' ? payload.generatedAt : new Date().toISOString(),
    scrapeMonth: typeof payload.scrapeMonth === 'string' ? payload.scrapeMonth : getProspectSnapshotMonth(),
    note: typeof payload.note === 'string' ? payload.note : undefined,
    players: dedupeProspects(payload.players
      .filter((profile): profile is ProspectProfile => Boolean(profile?.name && profile?.position && profile?.draftYear))
      .map((profile) => ({
        ...profile,
        source: SOURCE_NAME,
      }))),
    errors: Array.isArray(payload.errors) ? payload.errors.filter((error): error is string => typeof error === 'string') : [],
  };
}

function loadLocalNflDraftBuzzSupplements(): IndexedProspectSupplementPayload[] {
  return [
    NFL_DRAFT_BUZZ_HISTORICAL_SUPPLEMENT_FILE,
    NFL_DRAFT_BUZZ_INDEXED_SUPPLEMENT_FILE,
  ].map((filePath) => {
    try {
      if (!fs.existsSync(filePath)) return null;
      return normalizeIndexedProspectSupplement(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
    } catch (error) {
      console.warn(`[NFL Draft Buzz] Failed to load prospect supplement ${path.basename(filePath)}:`, error);
      return null;
    }
  }).filter((payload): payload is IndexedProspectSupplementPayload => Boolean(payload));
}

function loadLocalEspnProspectSnapshot(): EspnProspectSnapshotPayload | null {
  try {
    if (!fs.existsSync(ESPN_PROSPECT_FILE)) return null;
    return normalizeEspnProspectSnapshot(JSON.parse(fs.readFileSync(ESPN_PROSPECT_FILE, 'utf-8')));
  } catch (error) {
    console.warn('[ESPN Prospects] Failed to load local prospect enrichment:', error);
    return null;
  }
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

  scrapeYears:
  for (const draftYear of years) {
    for (const position of FANTASY_POSITIONS) {
      for (let page = 1; page <= MAX_PAGES_PER_POSITION; page += 1) {
        const sourceUrl = getSourceUrl(draftYear, position, page);
        try {
          if (page > 1 || players.length) {
            await sleep(PROSPECT_FETCH_DELAY_MS);
          }
          const markdown = await fetchProspectPageMarkdown(sourceUrl);
          const parsed = parseNflDraftBuzzMarkdown(markdown, draftYear, sourceUrl)
            .filter((profile) => profile.position === position);
          if (!parsed.length) break;
          players.push(...parsed);
          pageCount += 1;
          if (parsed.length < 6 && page > 1) break;
        } catch (error) {
          errors.push(`${draftYear} ${position} page ${page}: ${error instanceof Error ? error.message : 'failed'}`);
          if (error instanceof ProspectSourceProtectionError) {
            break scrapeYears;
          }
          break;
        }
      }
    }
  }

  const previousSnapshot = errors.length ? await loadLatestStoredProspectSnapshot() : null;
  if (pageCount === 0 && errors.length && previousSnapshot?.players?.length) {
    console.warn('[NFL Draft Buzz] Scrape returned no readable pages; keeping the previous prospect snapshot unchanged');
    return {
      ...previousSnapshot,
      generatedAt: new Date().toISOString(),
      pageCount: 0,
      errors: [
        'Current scrape returned no readable pages; previous stored NFL Draft Buzz snapshot was kept unchanged.',
        ...errors,
        ...(previousSnapshot.errors || []),
      ],
    };
  }

  const mergedPlayers = previousSnapshot?.players?.length
    ? dedupeProspects([...previousSnapshot.players, ...players])
    : dedupeProspects(players);
  const yearsTracked = previousSnapshot?.yearsTracked?.length
    ? Array.from(new Set([...previousSnapshot.yearsTracked, ...years])).sort((a, b) => a - b)
    : years;

  const payload: ProspectSnapshotPayload = {
    schemaVersion: 1,
    source: SOURCE_NAME,
    generatedAt: new Date().toISOString(),
    scrapeMonth,
    yearsTracked,
    pageCount,
    players: mergedPlayers,
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

function buildDiagnostics(
  payload: ProspectSnapshotPayload | null,
  totalPlayerCount?: number,
  espnSupplementalCount = 0,
  espnErrors: string[] = []
): ProspectSourceDiagnostics {
  if (!payload) {
    return {
      source: SOURCE_NAME,
      status: espnSupplementalCount ? 'partial' : 'missing',
      playerCount: totalPlayerCount || 0,
      yearsTracked: [],
      note: espnSupplementalCount
        ? `${espnSupplementalCount} ESPN prospect profiles are available locally, but no monthly NFL Draft Buzz snapshot has been stored yet.`
        : 'No monthly prospect snapshot has been stored yet. Prospect trait cards will stay hidden until the first successful monthly run.',
      errors: espnErrors.length ? espnErrors : undefined,
    };
  }

  const playerCount = totalPlayerCount ?? payload.players.length;
  const errors = [...payload.errors, ...espnErrors];
  return {
    source: SOURCE_NAME,
    status: playerCount ? (errors.length ? 'partial' : 'stored') : 'error',
    scrapeMonth: payload.scrapeMonth,
    generatedAt: payload.generatedAt,
    playerCount,
    yearsTracked: payload.yearsTracked,
    note: playerCount
      ? `${playerCount} offensive prospect profiles are available for college/devy context${espnSupplementalCount ? `, including ${espnSupplementalCount} local ESPN enrichments` : ''}. This is context only and does not affect blended values.`
      : 'The latest monthly prospect scrape did not return offensive players.',
    errors,
  };
}

export async function loadProspectContext(): Promise<ProspectContext> {
  if (prospectContextCache) return prospectContextCache;
  const payload = await loadLatestStoredProspectSnapshot();
  const nflDraftBuzzSupplements = loadLocalNflDraftBuzzSupplements();
  const espnSnapshot = loadLocalEspnProspectSnapshot();
  const profiles = mergeParsedProspects([
    ...(payload?.players || []),
    ...nflDraftBuzzSupplements.flatMap((supplement) => supplement.players),
    ...(espnSnapshot?.players || []),
  ]);
  prospectContextCache = {
    profiles,
    diagnostics: buildDiagnostics(payload, profiles.length, espnSnapshot?.players.length || 0, [
      ...nflDraftBuzzSupplements.flatMap((supplement) => supplement.errors || []),
      ...(espnSnapshot?.errors || []),
    ]),
  };
  return prospectContextCache;
}

export function buildProspectLookup(profiles: ProspectProfile[]): Map<string, ProspectProfile> {
  const lookup = new Map<string, ProspectProfile>();
  for (const profile of profiles) {
    const nameKey = canonicalPlayerNameKey(profile.name);
    if (!nameKey) continue;
    const nameParts = nameKey.split(/\s+/).filter(Boolean);
    const firstLastKey = nameParts.length > 2 ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}` : '';
    const baseKeys = [
      nameKey,
      firstLastKey,
      `${nameKey}:${profile.position}`,
      firstLastKey && `${firstLastKey}:${profile.position}`,
      `${nameKey}:${profile.draftYear}`,
      firstLastKey && `${firstLastKey}:${profile.draftYear}`,
    ].filter(Boolean) as string[];
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
  const nameParts = nameKey.split(/\s+/).filter(Boolean);
  const firstLastKey = nameParts.length > 2 ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}` : '';
  const collegeKey = college ? canonicalPlayerNameKey(String(college)) : '';
  const draftYear = rookieYear ? String(rookieYear) : '';
  const positionKey = position ? String(position).toUpperCase() : '';
  const keys = [
    collegeKey && `${nameKey}:${positionKey}:${collegeKey}`,
    firstLastKey && collegeKey && `${firstLastKey}:${positionKey}:${collegeKey}`,
    collegeKey && `${nameKey}:${draftYear}:${collegeKey}`,
    firstLastKey && collegeKey && `${firstLastKey}:${draftYear}:${collegeKey}`,
    draftYear && `${nameKey}:${draftYear}`,
    firstLastKey && draftYear && `${firstLastKey}:${draftYear}`,
    positionKey && `${nameKey}:${positionKey}`,
    firstLastKey && positionKey && `${firstLastKey}:${positionKey}`,
    collegeKey && `${nameKey}:${collegeKey}`,
    firstLastKey && collegeKey && `${firstLastKey}:${collegeKey}`,
    nameKey,
    firstLastKey,
  ].filter(Boolean) as string[];

  return keys.map((key) => lookup.get(key)).find(Boolean) || null;
}

export function clearProspectContextCache() {
  prospectContextCache = null;
}
