import fs from 'fs';
import path from 'path';
import { insertSourceHealthEvents, type SourceHealthEventInput } from './db';
import type { RankingSourceDiagnostic } from '../shared/types';

const SOURCE_HEALTH_LOG_DIR = path.join(process.cwd(), '.cache', 'source-health');

function getSourceHealthDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getLevel(diagnostic: RankingSourceDiagnostic): SourceHealthEventInput['level'] | null {
  if (diagnostic.trustAlert?.level) return diagnostic.trustAlert.level;
  if (diagnostic.status === 'error' || diagnostic.status === 'stale') return 'danger';
  if (diagnostic.status === 'empty') return 'warn';
  return null;
}

export function buildSourceHealthEvents(input: {
  job: string;
  diagnostics: RankingSourceDiagnostic[];
}): SourceHealthEventInput[] {
  return input.diagnostics
    .map((diagnostic): SourceHealthEventInput | null => {
      const level = getLevel(diagnostic);
      if (!level) return null;

      return {
        job: input.job,
        board: diagnostic.board,
        sourceKey: diagnostic.key,
        source: diagnostic.source,
        level,
        status: diagnostic.status,
        rowCount: diagnostic.rowCount,
        message: diagnostic.trustAlert?.message || diagnostic.error || diagnostic.note,
        payload: {
          trustScore: diagnostic.trustScore ?? null,
          trustScoreDelta: diagnostic.trustScoreDelta ?? null,
          trustMultiplier: diagnostic.trustMultiplier ?? null,
          rowCountRatio: diagnostic.rowCountRatio ?? null,
          medianConsensusDeltaPct: diagnostic.medianConsensusDeltaPct ?? null,
          loadedAt: diagnostic.loadedAt ?? null,
        },
      } satisfies SourceHealthEventInput;
    })
    .filter((event): event is SourceHealthEventInput => Boolean(event));
}

function writeLocalSourceHealthEvents(events: SourceHealthEventInput[]) {
  if (!events.length || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') return;
  try {
    fs.mkdirSync(SOURCE_HEALTH_LOG_DIR, { recursive: true });
    const filePath = path.join(SOURCE_HEALTH_LOG_DIR, `source-health-${getSourceHealthDateKey()}.jsonl`);
    const lines = events.map((event) => JSON.stringify({
      ...event,
      createdAt: event.createdAt ? new Date(event.createdAt).toISOString() : new Date().toISOString(),
    })).join('\n');
    fs.appendFileSync(filePath, `${lines}\n`);
  } catch (error) {
    console.warn('[SourceHealth] Failed to write local source-health events:', error);
  }
}

function getLevelRank(level: SourceHealthEventInput['level']): number {
  if (level === 'danger') return 3;
  if (level === 'warn') return 2;
  return 1;
}

function getWebhookMinLevel(): SourceHealthEventInput['level'] {
  const configured = String(process.env.SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL || 'warn').toLowerCase();
  return configured === 'danger' ? 'danger' : configured === 'info' ? 'info' : 'warn';
}

async function sendSourceHealthAlertWebhook(events: SourceHealthEventInput[]) {
  const webhookUrl = process.env.SOURCE_HEALTH_ALERT_WEBHOOK_URL;
  if (!webhookUrl || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') return;

  const minLevel = getWebhookMinLevel();
  const alertEvents = events
    .filter((event) => event.job !== 'cached-report-source-backfill')
    .filter((event) => getLevelRank(event.level) >= getLevelRank(minLevel))
    .slice(0, 12);
  if (!alertEvents.length) return;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'source-health-alert',
        generatedAt: new Date().toISOString(),
        minLevel,
        totals: {
          events: alertEvents.length,
          danger: alertEvents.filter((event) => event.level === 'danger').length,
          warn: alertEvents.filter((event) => event.level === 'warn').length,
          info: alertEvents.filter((event) => event.level === 'info').length,
        },
        events: alertEvents.map((event) => ({
          job: event.job,
          board: event.board ?? null,
          sourceKey: event.sourceKey,
          source: event.source,
          level: event.level,
          status: event.status,
          rowCount: event.rowCount ?? null,
          message: event.message,
          createdAt: event.createdAt ? new Date(event.createdAt).toISOString() : new Date().toISOString(),
        })),
      }),
    });

    if (!response.ok) {
      console.warn(`[SourceHealth] Alert webhook failed with ${response.status}.`);
    }
  } catch (error) {
    console.warn('[SourceHealth] Failed to send alert webhook:', error);
  }
}

export async function recordSourceHealthEvents(events: SourceHealthEventInput[]) {
  if (!events.length) return { stored: false, count: 0 };
  writeLocalSourceHealthEvents(events);
  await sendSourceHealthAlertWebhook(events);

  try {
    const stored = await insertSourceHealthEvents(events);
    return { stored, count: events.length };
  } catch (error) {
    console.warn('[SourceHealth] Failed to persist source-health events:', error);
    return { stored: false, count: events.length };
  }
}
