import type { PlayerDetails } from '@shared/types';
import { normalizeLeagueValueMode, type LeagueValueMode } from './leagueValueMode';
import { getPlayerValueConfidence, type PlayerValueConfidence } from './playerValueConfidence';

type ValueProfile = NonNullable<PlayerDetails['valueProfile']>;

export const PLAYER_VALUE_LANGUAGE = {
  marketPrice: 'Market Price',
  degenRead: 'Degen Read',
  degenGap: 'Degen Gap',
  confidence: 'Confidence',
} as const;

export type PlayerValueFramingTone = 'good' | 'info' | 'warn' | 'danger';

export type PlayerValueFramingSignal = {
  label: string;
  impactPct: number;
};

export type PlayerValueFraming = {
  marketPrice: number | null;
  degenReadValue: number | null;
  degenGap: number | null;
  degenGapPct: number | null;
  readLabel: string;
  tone: PlayerValueFramingTone;
  confidence: PlayerValueConfidence;
  rangeLow: number | null;
  rangeHigh: number | null;
  signals: PlayerValueFramingSignal[];
  note: string;
};

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundValue(value: number): number {
  const absolute = Math.abs(value);
  const step = absolute >= 5000 ? 50 : absolute >= 1000 ? 25 : 10;
  return Math.round(value / step) * step;
}

function formatSignedPoints(value: number | null): string {
  if (value === null) return 'n/a';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toLocaleString()} pts`;
}

function getMarketPrice(valueProfile: ValueProfile | null, mode: LeagueValueMode, fallbackValue?: number | null): number | null {
  if (mode === 'redraft') {
    return (
      positiveNumber(valueProfile?.seasonValue)
      ?? positiveNumber(valueProfile?.fantasyProsSeasonValue)
      ?? positiveNumber(valueProfile?.fantasyCalcRedraft)
      ?? positiveNumber(fallbackValue)
    );
  }

  return (
    positiveNumber(valueProfile?.dynastyValue)
    ?? positiveNumber(valueProfile?.balancedValue)
    ?? positiveNumber(valueProfile?.marketKtc)
    ?? positiveNumber(fallbackValue)
  );
}

function getMaxGapPct(score: number): number {
  if (score >= 78) return 0.14;
  if (score >= 62) return 0.1;
  if (score >= 46) return 0.06;
  return 0.025;
}

function getRangePct(confidence: PlayerValueConfidence): number {
  const base = confidence.score >= 78
    ? 0.08
    : confidence.score >= 62
      ? 0.12
      : confidence.score >= 46
        ? 0.18
        : 0.25;
  const spreadAddon = confidence.spreadPct === null ? 0.03 : clamp(confidence.spreadPct * 0.16, 0, 0.12);
  return clamp(base + spreadAddon, 0.08, 0.32);
}

function getReadLabel(gapPct: number | null, confidence: PlayerValueConfidence): string {
  if (gapPct === null) return 'Missing price';
  if (confidence.score < 46 && Math.abs(gapPct) >= 0.02) return 'Thin read';
  if (gapPct >= 0.075) return 'Buy signal';
  if (gapPct >= 0.025) return 'Slight buy';
  if (gapPct <= -0.075) return 'Sell signal';
  if (gapPct <= -0.025) return 'Risk tax';
  return 'Fair price';
}

function getTone(gapPct: number | null, confidence: PlayerValueConfidence): PlayerValueFramingTone {
  if (gapPct === null || confidence.score < 46) return 'danger';
  if (gapPct >= 0.025) return 'good';
  if (gapPct <= -0.025) return 'warn';
  return confidence.tone === 'danger' ? 'warn' : confidence.tone;
}

function addSignal(signals: PlayerValueFramingSignal[], label: string, impactPct: number) {
  if (!Number.isFinite(impactPct) || Math.abs(impactPct) < 0.004) return;
  signals.push({ label, impactPct });
}

function buildSignals(input: {
  details?: PlayerDetails | null;
}): PlayerValueFramingSignal[] {
  const signals: PlayerValueFramingSignal[] = [];
  const cohort = input.details?.playerCohort || null;
  const situationDelta = input.details?.playerSituationDelta || null;

  if (situationDelta) {
    const confidenceWeight = clamp((situationDelta.confidence || 0) / 100, 0.25, 1);
    const magnitude = (situationDelta.score >= 72 ? 0.08 : situationDelta.score >= 58 ? 0.05 : 0.025) * confidenceWeight;
    if (situationDelta.action === 'buy' || situationDelta.action === 'stash') {
      addSignal(signals, situationDelta.primaryLabel || 'situation upside', magnitude);
    } else if (situationDelta.action === 'sell' || situationDelta.action === 'avoid') {
      addSignal(signals, situationDelta.primaryLabel || 'situation risk', -magnitude);
    }
  }

  if (cohort) {
    const confidenceWeight = clamp((cohort.confidence || 0) / 100, 0.25, 1);
    const bucket = cohort.outcomeBucket;
    if (bucket === 'breakout') addSignal(signals, 'historical breakout profile', 0.07 * confidenceWeight);
    if (bucket === 'market-under-production') addSignal(signals, 'production ahead of market', 0.06 * confidenceWeight);
    if (bucket === 'sustain') addSignal(signals, 'stable production profile', 0.025 * confidenceWeight);
    if (bucket === 'market-over-production') addSignal(signals, 'market ahead of production', -0.06 * confidenceWeight);
    if (bucket === 'fade-risk') addSignal(signals, 'fade-risk profile', -0.07 * confidenceWeight);
    if (bucket === 'injury-risk') addSignal(signals, 'availability risk profile', -0.055 * confidenceWeight);
  }

  return signals;
}

function summarizeSignals(signals: PlayerValueFramingSignal[]): string {
  const primary = [...signals].sort((a, b) => Math.abs(b.impactPct) - Math.abs(a.impactPct)).slice(0, 2);
  if (!primary.length) return 'balanced source and context signals';
  return primary.map((signal) => signal.label).join(' and ');
}

export function getPlayerValueFraming(input: {
  valueProfile?: PlayerDetails['valueProfile'] | null;
  mode?: LeagueValueMode | null;
  currentValue?: number | null;
  valueGain?: number | null;
  details?: PlayerDetails | null;
  confidence?: PlayerValueConfidence;
}): PlayerValueFraming {
  const mode = normalizeLeagueValueMode(input.mode || 'dynasty');
  const valueProfile = input.valueProfile || null;
  const confidence = input.confidence || getPlayerValueConfidence({ valueProfile, mode });
  const marketPrice = getMarketPrice(valueProfile, mode, input.currentValue);
  const signals = buildSignals({ details: input.details });

  if (!marketPrice) {
    return {
      marketPrice: null,
      degenReadValue: null,
      degenGap: null,
      degenGapPct: null,
      readLabel: 'Missing price',
      tone: 'danger',
      confidence,
      rangeLow: null,
      rangeHigh: null,
      signals,
      note: 'No Market Price is attached yet, so the Degen Read stays conservative.',
    };
  }

  const rawGapPct = signals.reduce((total, signal) => total + signal.impactPct, 0);
  const spreadMultiplier = confidence.spreadPct !== null && confidence.spreadPct >= 0.55
    ? 0.5
    : confidence.spreadPct !== null && confidence.spreadPct >= 0.38
      ? 0.72
      : 1;
  const cappedGapPct = clamp(rawGapPct * spreadMultiplier, -getMaxGapPct(confidence.score), getMaxGapPct(confidence.score));
  const degenGap = Math.abs(cappedGapPct) < 0.012 ? 0 : roundValue(marketPrice * cappedGapPct);
  const degenGapPct = degenGap === 0 ? 0 : degenGap / marketPrice;
  const degenReadValue = roundValue(marketPrice + degenGap);
  const rangePct = getRangePct(confidence);
  const rangeLow = roundValue(degenReadValue * (1 - rangePct));
  const rangeHigh = roundValue(degenReadValue * (1 + rangePct));
  const readLabel = getReadLabel(degenGapPct, confidence);
  const signalSummary = summarizeSignals(signals);

  return {
    marketPrice: roundValue(marketPrice),
    degenReadValue,
    degenGap,
    degenGapPct,
    readLabel,
    tone: getTone(degenGapPct, confidence),
    confidence,
    rangeLow,
    rangeHigh,
    signals,
    note: `${PLAYER_VALUE_LANGUAGE.degenRead}: ${readLabel}. ${PLAYER_VALUE_LANGUAGE.degenGap} is ${formatSignedPoints(degenGap)} from ${signalSummary}; ${confidence.note}`,
  };
}
