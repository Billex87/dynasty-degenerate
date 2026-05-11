import type { DraftPick, ReportData } from '@shared/types';
import { normalizeLeagueValueMode, type LeagueValueMode } from './leagueValueMode';

export type DraftKind = NonNullable<DraftPick['draftKind']>;
type DraftKindSource = Partial<Pick<DraftPick, 'draftKind' | 'draftPickCount' | 'round'>>;
type DraftWindowSource = Partial<Pick<
  DraftPick,
  'draftValueDate' | 'currentValueDate' | 'draftYear' | 'valueGain' | 'positionRankChange' | 'draftOutcome'
>> & DraftKindSource;
export type DraftMarketMovementTone = 'riser' | 'faller' | 'neutral';
export const ROOKIE_MARKET_READ_EVALUATION_MONTH_INDEX = 8;
export const ROOKIE_MARKET_READ_EVALUATION_DAY = 1;

function isKnownDraftKind(value: unknown): value is DraftKind {
  return value === 'rookie' || value === 'startup' || value === 'main';
}

export function getDraftKind(
  pick: DraftKindSource,
  modeInput?: ReportData['leagueValueMode'] | LeagueValueMode | string | null,
): DraftKind {
  if (isKnownDraftKind(pick.draftKind)) return pick.draftKind;

  const mode = normalizeLeagueValueMode(modeInput);
  if (mode === 'redraft') return 'main';

  const pickCount = Number(pick.draftPickCount || 0);
  const round = Number(pick.round || 0);
  return pickCount >= 100 || round > 10 ? 'startup' : 'rookie';
}

export function getDraftKindLabel(kind: DraftKind): string {
  if (kind === 'startup') return 'Startup Draft';
  if (kind === 'main') return 'Main Draft';
  return 'Rookie Draft';
}

export function getDraftKindShortLabel(kind: DraftKind): string {
  if (kind === 'startup') return 'Startup';
  if (kind === 'main') return 'Main';
  return 'Rookie';
}

export function formatDraftWindowDate(date?: string | null): string | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

export function getDraftWindowLabel(
  pickOrPicks: DraftWindowSource | DraftWindowSource[],
  modeInput?: ReportData['leagueValueMode'] | LeagueValueMode | string | null,
): string | null {
  const picks = Array.isArray(pickOrPicks) ? pickOrPicks : [pickOrPicks];
  const primaryPick = picks.find((pick) => pick.draftKind || pick.draftPickCount || pick.round) || picks[0] || {};
  const mode = normalizeLeagueValueMode(modeInput);
  const kind = getDraftKind(primaryPick, mode);
  const hasTrackedDate = picks.some((pick) => Boolean(pick.draftValueDate || pick.currentValueDate));

  if (kind === 'rookie') return 'Stabilized rookie baseline';
  if (!hasTrackedDate) return null;
  if (mode === 'redraft' || kind === 'main') return 'Season value window';
  if (kind === 'startup') return 'Multi-year value window';
  return 'Tracked value window';
}

export function isFreshRookieMarketRead(
  pick: DraftWindowSource,
  modeInput?: ReportData['leagueValueMode'] | LeagueValueMode | string | null,
  now = new Date(),
): boolean {
  const mode = normalizeLeagueValueMode(modeInput);
  if (getDraftKind(pick, mode) !== 'rookie') return false;

  const draftYear = Number(pick.draftYear);
  if (!Number.isFinite(draftYear)) return false;

  const seasonEvaluationStart = new Date(
    draftYear,
    ROOKIE_MARKET_READ_EVALUATION_MONTH_INDEX,
    ROOKIE_MARKET_READ_EVALUATION_DAY,
  );
  return draftYear >= now.getFullYear() && now < seasonEvaluationStart;
}

export function getDraftMarketMovementLabel(
  pick: DraftWindowSource,
  modeInput?: ReportData['leagueValueMode'] | LeagueValueMode | string | null,
): { label: string; tone: DraftMarketMovementTone } | null {
  if (!isFreshRookieMarketRead(pick, modeInput)) return null;

  const rankChange = pick.positionRankChange ? parseInt(pick.positionRankChange, 10) : 0;
  const valueGain = Number(pick.valueGain || 0);
  if (valueGain >= 250 || rankChange >= 3) return { label: 'Early Riser', tone: 'riser' };
  if (valueGain <= -250 || rankChange <= -3) return { label: 'Early Faller', tone: 'faller' };
  if (pick.draftOutcome === 'neutral') return { label: 'Market Watch', tone: 'neutral' };
  return null;
}
