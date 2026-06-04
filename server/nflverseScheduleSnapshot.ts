import {
  buildNflScheduleSnapshot,
  type NflScheduleGameInput,
  type NflScheduleSnapshotPayload,
} from './nflScheduleSnapshots';

export const NFLVERSE_SCHEDULE_SOURCE_URL = 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';
export const NFLVERSE_SCHEDULE_PARSER_VERSION = 1;

type NflverseScheduleRow = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function parseCsv(text: string): NflverseScheduleRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const headers = parseCsvLine(lines[0] || '').map((header) => header.trim());
  if (!headers.length) return [];

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
}

function cleanText(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

function parseInteger(value: unknown): number | null {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function seasonTypeFromGameType(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'PRE') return 'pre';
  if (normalized === 'REG') return 'regular';
  if (normalized === 'POST') return 'post';
  return 'unknown';
}

function easternOffsetForDate(dateText: string): '-04:00' | '-05:00' {
  const date = new Date(`${dateText}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return '-04:00';
  const year = date.getUTCFullYear();
  const dstStart = nthWeekdayOfMonthUtc(year, 2, 0, 2);
  const dstEnd = nthWeekdayOfMonthUtc(year, 10, 0, 1);
  return date >= dstStart && date < dstEnd ? '-04:00' : '-05:00';
}

function nthWeekdayOfMonthUtc(year: number, monthIndex: number, weekday: number, occurrence: number): Date {
  const first = new Date(Date.UTC(year, monthIndex, 1, 12));
  const delta = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, monthIndex, 1 + delta + ((occurrence - 1) * 7), 12));
}

function startsAtFromNflverse(row: NflverseScheduleRow): string | null {
  const gameday = cleanText(row.gameday);
  if (!gameday) return null;
  const gametime = cleanText(row.gametime) || '12:00';
  return `${gameday}T${gametime.length === 5 ? `${gametime}:00` : gametime}${easternOffsetForDate(gameday)}`;
}

function restFlag(row: NflverseScheduleRow, predicate: (rest: number) => boolean): boolean {
  const rests = [parseInteger(row.away_rest), parseInteger(row.home_rest)]
    .filter((value): value is number => value !== null);
  return rests.some(predicate);
}

function venueTypeFromRoof(value: unknown): string | null {
  const roof = cleanText(value)?.toLowerCase();
  if (!roof) return null;
  if (roof.includes('dome') || roof.includes('closed')) return 'dome';
  if (roof.includes('open') || roof.includes('outdoor')) return 'outdoor';
  return roof;
}

function weatherSensitivityFromRoof(value: unknown): string | null {
  const venueType = venueTypeFromRoof(value);
  return venueType === 'outdoor' ? 'weather-sensitive' : null;
}

export function parseNflverseScheduleCsv(text: string, season: string | number): NflScheduleGameInput[] {
  const seasonLabel = String(season);
  return parseCsv(text)
    .filter((row) => String(row.season || '').trim() === seasonLabel)
    .filter((row) => seasonTypeFromGameType(row.game_type) === 'regular')
    .map((row): NflScheduleGameInput => ({
      season: seasonLabel,
      week: row.week,
      gameId: cleanText(row.game_id) || cleanText(row.old_game_id),
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      startsAt: startsAtFromNflverse(row),
      gameStatus: cleanText(row.result) ? 'final' : 'scheduled',
      venue: cleanText(row.stadium),
      neutralSite: /^neutral$/i.test(cleanText(row.location) || ''),
      shortRest: restFlag(row, (rest) => rest > 0 && rest <= 5),
      longRest: restFlag(row, (rest) => rest >= 10),
      venueType: venueTypeFromRoof(row.roof),
      weatherSensitivity: weatherSensitivityFromRoof(row.roof),
      seasonType: 'regular',
      projectedPlayoffWeekRelevance: Number(row.week) >= 15 && Number(row.week) <= 17,
    }));
}

export function buildNflverseScheduleSnapshot(input: {
  csv: string;
  season: string | number;
  sourceVersion: string;
  fetchedAt?: string | Date | null;
  sourceUrl?: string | null;
}): NflScheduleSnapshotPayload {
  return buildNflScheduleSnapshot({
    season: input.season,
    source: 'nflverse schedules CSV',
    sourceUrl: input.sourceUrl || NFLVERSE_SCHEDULE_SOURCE_URL,
    sourceVersion: input.sourceVersion,
    fetchedAt: input.fetchedAt,
    seasonType: 'regular',
    parserVersion: NFLVERSE_SCHEDULE_PARSER_VERSION,
    rows: parseNflverseScheduleCsv(input.csv, input.season),
  });
}
