import {
  Activity,
  BadgeCheck,
  CircleOff,
  Eye,
  GitCompareArrows,
  History,
  ListChecks,
  ShieldAlert,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AITronSurface, type AITronTheme } from '@/components/AITronSurface';
import { cn } from '@/lib/utils';
import type { AIActionQueueItem } from '@/lib/autopilot/types';
import {
  getVoicedAIActionDecisionCopy,
  getVoicedAIActionDetail,
  getVoicedAIActionLabel,
  getVoicedAIActionQueueSubtitle,
  getVoicedSuppressedAIActionsCopy,
} from '@/lib/aiVoice';
import {
  buildAIConfidenceHistory,
  detectAIActionConflicts,
  readAIActionMemory,
  recordAIActionSnapshot,
  writeAIActionMemory,
  type AIActionChange,
  type AIActionMemory,
} from '@/lib/aiActionMemory';

function getDecisionIcon(decision: AIActionQueueItem['decision']) {
  if (decision === 'do') return BadgeCheck;
  if (decision === 'blocked') return ShieldAlert;
  if (decision === 'hold') return CircleOff;
  return Eye;
}

function getDecisionCopy(decision: AIActionQueueItem['decision']) {
  return getVoicedAIActionDecisionCopy(decision);
}

function getActionQueueTronTheme(tone: AIActionQueueItem['tone']): AITronTheme {
  if (tone === 'good') return 'green';
  if (tone === 'warn') return 'amber';
  if (tone === 'danger') return 'red';
  if (tone === 'info') return 'blue';
  return 'cyan';
}

function getActionQueueEvidenceBand(item: AIActionQueueItem) {
  if (item.decision === 'blocked' || item.blockers.length) return 'Blocked';
  if (item.missingEvidence.length || item.sourceHealth.some(row => /stale|missing|error|limited|unavailable|unverified/i.test(row))) {
    return 'Verify first';
  }
  if (item.confidence >= 78) return 'Strong read';
  if (item.confidence >= 46) return 'Watch only';
  return 'Not enough signal';
}

function getManagerFacingQueueDetail(value?: string | null): string {
  const clean = normalizeQueueNote(value);
  const lower = clean.toLowerCase();
  if (!clean) return 'Check roster, role, availability, and timing before acting.';
  if (/schedule|sos|matchup|bye/.test(lower)) return 'Schedule window needs a week-level check before acting.';
  if (/role|usage|lineup|starter/.test(lower)) return 'Role and lineup status need one more check before acting.';
  if (/availability|injury|roster|active|team|status/.test(lower)) return 'Availability and roster status need a final check before acting.';
  if (/trade|partner|offer|transaction/.test(lower)) return 'Trade fit needs a cleaner partner or offer path before forcing it.';
  if (/source|trace|evidence|calibration|confidence|proof|row|payload|returned|missing|guardrail/.test(lower)) {
    return 'The read needs a cleaner manager-useful signal before acting.';
  }
  return clean;
}

function getSecondaryQueueDetail(item: AIActionQueueItem): { label: string; detail: string } | null {
  if (item.missingEvidence[0]) {
    return {
      label: 'What to verify',
      detail: getManagerFacingQueueDetail(item.missingEvidence[0]),
    };
  }
  if (item.changeTriggers[0]) {
    return {
      label: 'Manager impact',
      detail: getManagerFacingQueueDetail(item.changeTriggers[0]),
    };
  }
  return null;
}

function normalizeQueueNote(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isManagerFacingQueueNote(value: string): boolean {
  const lower = value.toLowerCase();
  if (!lower) return false;

  const internalFragments = [
    'calibration',
    'confidence limited',
    'evidence check',
    'failed the evidence',
    'guardrail',
    'league activity profile',
    'league format context',
    'missing proof',
    'no active nfl team',
    'outside the trusted',
    'precondition guard',
    'rank was not enough',
    'receipt',
    'source health',
    'source trace',
    'source-limited',
  ];

  if (internalFragments.some(fragment => lower.includes(fragment))) return false;
  if (/^(check|verify first|do not act yet|missing proof):/i.test(value)) return false;
  if (/\b(rows?|source|profile|context|payload)\b/.test(lower) && /\b(loaded|returned)\b/.test(lower)) {
    return false;
  }

  return true;
}

function getQueueNotes(items: unknown[], limit: number): string[] {
  const visibleItems = items
    .map(normalizeQueueNote)
    .filter(isManagerFacingQueueNote);
  return Array.from(new Set(visibleItems)).slice(0, limit);
}

function QueueReceipts({
  item,
  compact,
}: {
  item: AIActionQueueItem;
  compact?: boolean;
}) {
  const limit = compact ? 2 : 3;
  const receipts = getQueueNotes(item.receipts, limit);
  const visibleChangeTriggers = getQueueNotes(item.changeTriggers, limit);
  const dominoEffects = compact ? (item.dominoEffects || []).slice(0, 2) : (item.dominoEffects || []).slice(0, 3);
  const visibleRiskRows = getQueueNotes([
    ...item.blockers.map(blocker => `Do not act yet: ${blocker}`),
    ...item.missingEvidence.map(missing => `Check first: ${missing}`),
  ], limit);

  if (!receipts.length && !visibleRiskRows.length && !visibleChangeTriggers.length && !dominoEffects.length) {
    return null;
  }

  return (
    <div className="ai-action-queue-receipts">
      {receipts.length > 0 && (
        <div>
          <span>Signal summary</span>
          <ul>
            {receipts.map((receipt) => (
              <li key={receipt}>{receipt}</li>
            ))}
          </ul>
        </div>
      )}
      {visibleRiskRows.length > 0 && (
        <div>
          <span>Risk checks</span>
          <ul>
            {visibleRiskRows.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>
      )}
      {visibleChangeTriggers.length > 0 && (
        <div className="ai-action-queue-change-mind">
          <span>Manager impact</span>
          <ul>
            {visibleChangeTriggers.map((trigger) => (
              <li key={trigger}>{trigger}</li>
            ))}
          </ul>
        </div>
      )}
      {dominoEffects.length > 0 && (
        <div className="ai-action-queue-domino">
          <span>Roster domino</span>
          <ul>
            {dominoEffects.map((domino) => (
              <li key={domino}>{domino}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatMemoryDate(value: number) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return 'Recent';
  }
}

function ActionConfidenceSparkline({
  points,
}: {
  points: ReturnType<typeof buildAIConfidenceHistory>;
}) {
  if (points.length < 2) return null;

  return (
    <div className="ai-action-confidence-sparkline" aria-label="AI read strength history">
      {points.map(point => (
        <span
          key={point.id}
          title={`${point.label}: ${point.confidence}% · ${formatMemoryDate(point.recordedAt)}`}
          style={{ height: `${Math.max(12, point.confidence)}%` }}
        />
      ))}
    </div>
  );
}

function ActionMemoryPanel({
  change,
  points,
  compact,
}: {
  change: AIActionChange | null;
  points: ReturnType<typeof buildAIConfidenceHistory>;
  compact?: boolean;
}) {
  if (!change && points.length < 2) return null;

  return (
    <div className="ai-action-memory-panel">
      <div>
        <span>
          <History className="h-4 w-4" aria-hidden="true" />
          Decision memory
        </span>
        <strong>{change?.changed ? 'Changed since last read' : 'Same read'}</strong>
        {change && <p>{change.summary}</p>}
      </div>
      {!compact && <ActionConfidenceSparkline points={points} />}
    </div>
  );
}

function ActionConflictPanel({
  item,
  compact,
}: {
  item: AIActionQueueItem;
  compact?: boolean;
}) {
  const conflicts = detectAIActionConflicts(item).slice(0, compact ? 2 : 4);

  return (
    <div className="ai-action-conflict-panel" aria-label="AI source conflict detector">
      <span>
        <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
        Source conflict check
      </span>
      <div>
        {conflicts.map(conflict => (
          <p key={conflict.id} className={`ai-action-conflict-${conflict.tone}`}>
            <strong>{conflict.label}</strong>
            <em>{conflict.detail}</em>
          </p>
        ))}
      </div>
    </div>
  );
}

function ActionOutcomeObserver({
  item,
  memory,
  memoryKey,
}: {
  item: AIActionQueueItem;
  memory: AIActionMemory;
  memoryKey: string;
}) {
  const observedReads = memory.history.filter(snapshot => snapshot.memoryKey === memoryKey).length;
  const expectedAction = item.expectedAction;
  const expectedCopy =
    expectedAction?.expectedRosterChange ||
    expectedAction?.expectedLineupChange ||
    'Roster, lineup, waiver, and transaction updates are compared after each provider sync.';

  return (
    <div className="ai-action-outcome-tracker" aria-label="AI recommendation outcome observer">
      <div>
        <span>Outcome observer</span>
        <strong>Passive data sync</strong>
        <em>{observedReads} recommendation read{observedReads === 1 ? '' : 's'} recorded automatically</em>
      </div>
      <p>{expectedCopy}</p>
    </div>
  );
}

export function AIActionQueue({
  items,
  title = 'AI Action Queue',
  subtitle = 'One ranked list. Act only when evidence clears the guardrails.',
  compact = false,
  presentation = 'full',
  className,
  memoryKey,
  memoryContext,
  enableOutcomeObserver = false,
  maxVisibleItems = 1,
  showSuppressedAlternates = true,
  showDiagnostics = false,
}: {
  items?: AIActionQueueItem[];
  title?: string;
  subtitle?: string;
  compact?: boolean;
  presentation?: 'full' | 'summary';
  className?: string;
  memoryKey?: string;
  memoryContext?: string;
  enableOutcomeObserver?: boolean;
  maxVisibleItems?: number;
  showSuppressedAlternates?: boolean;
  showDiagnostics?: boolean;
}) {
  const visibleLimit = compact ? 1 : Math.max(1, Math.floor(maxVisibleItems));
  const sourceQueue = (items || []).filter(Boolean);
  const queue = sourceQueue.slice(0, visibleLimit);
  const [memory, setMemory] = useState<AIActionMemory>(() => readAIActionMemory());
  const [change, setChange] = useState<AIActionChange | null>(null);
  const primary = queue[0] || null;
  const secondary = queue.slice(1);
  const suppressed = sourceQueue.slice(queue.length);
  const resolvedMemoryKey = memoryKey || `${title}:${primary?.source || 'empty'}`;
  const resolvedMemoryContext = memoryContext || title;
  const primarySignature = [
    resolvedMemoryKey,
    primary?.source || '',
    primary?.decision || '',
    primary?.action || '',
    primary?.target || '',
    primary?.confidence || '',
  ].join('|');
  const confidencePoints = useMemo(
    () => buildAIConfidenceHistory(memory.history, resolvedMemoryKey, primary),
    [memory.history, primarySignature, resolvedMemoryKey],
  );

  useEffect(() => {
    if (!primary) return;
    setMemory(current => {
      const result = recordAIActionSnapshot({
        memory: current,
        memoryKey: resolvedMemoryKey,
        context: resolvedMemoryContext,
        item: primary,
      });
      setChange(result.change);
      writeAIActionMemory(result.memory);
      return result.memory;
    });
  }, [primarySignature, resolvedMemoryContext, resolvedMemoryKey]);

  if (!primary) return null;

  const Icon = getDecisionIcon(primary.decision);
  const tronTheme = getActionQueueTronTheme(primary.tone);
  const voicedSubtitle = getVoicedAIActionQueueSubtitle(subtitle);
  const suppressedCopy = getVoicedSuppressedAIActionsCopy(suppressed.length);
  const primaryBand = getActionQueueEvidenceBand(primary);
  const tronRouteKey = [
    resolvedMemoryKey,
    primary.decision,
    primary.tone,
    primary.action,
    primary.target,
  ].join('|');

  if (presentation === 'summary') {
    return (
      <section
        className={cn(
          'ai-action-queue',
          'ai-surface-r3f',
          'ai-action-queue-tron',
          'ai-action-queue-summary',
          compact && 'ai-action-queue-compact',
          `ai-action-queue-${primary.decision}`,
          className,
        )}
        aria-label={title}
      >
        <AITronSurface
          theme={tronTheme}
          density="small"
          routeKey={tronRouteKey}
        />
        <div className="ai-action-summary-row">
          <div className="ai-action-summary-main">
            <span>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {getDecisionCopy(primary.decision)}
            </span>
            <strong>{primary.action}: {primary.target}</strong>
            <p>{getVoicedAIActionDetail(primary.detail, primary.decision)}</p>
          </div>
          <div
            className="ai-action-summary-score"
            aria-label={`AI read strength ${primaryBand}`}
            title={primaryBand}
          >
            <strong>{primaryBand}</strong>
            <span>Read strength</span>
          </div>
        </div>
        <p className="ai-action-summary-risk">{primary.risk}</p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'ai-action-queue',
        'ai-surface-r3f',
        'ai-action-queue-tron',
        compact && 'ai-action-queue-compact',
        `ai-action-queue-${primary.decision}`,
        className,
      )}
      aria-label={title}
    >
      <AITronSurface
        theme={tronTheme}
        density={compact ? 'small' : 'medium'}
        routeKey={tronRouteKey}
      />
      <div className="ai-action-queue-head">
        <span>
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          {title}
        </span>
        <p>{voicedSubtitle}</p>
      </div>

      <article className={cn('ai-action-queue-primary', `autopilot-tone-${primary.tone}`)}>
        <div className="ai-action-queue-primary-topline">
          <span>
            <Icon className="h-4 w-4" aria-hidden="true" />
            {getDecisionCopy(primary.decision)}
          </span>
          <strong>{primaryBand}</strong>
        </div>
        <div className="ai-action-queue-main">
          <span>{getVoicedAIActionLabel(primary.label, primary.decision)}</span>
          <h3>{primary.action}: {primary.target}</h3>
          <p>{getVoicedAIActionDetail(primary.detail, primary.decision)}</p>
        </div>
        <div className="ai-action-queue-read">
          <p>{primary.why}</p>
          <em>{primary.risk}</em>
        </div>
        {primary.blockers.length > 0 && (
          <div className="ai-action-queue-blockers">
            <span>Blocked because</span>
            {primary.blockers.slice(0, 2).map((blocker) => (
              <p key={blocker}>{blocker}</p>
            ))}
          </div>
        )}
        <QueueReceipts item={primary} compact={compact} />
        {showDiagnostics && <ActionConflictPanel item={primary} compact={compact} />}
        {showDiagnostics && <ActionMemoryPanel change={change} points={confidencePoints} compact={compact} />}
        {showDiagnostics && enableOutcomeObserver && !compact && (
          <ActionOutcomeObserver
            item={primary}
            memory={memory}
            memoryKey={resolvedMemoryKey}
          />
        )}
      </article>

      {secondary.length > 0 && (
        <div className="ai-action-queue-list" aria-label="Next AI actions">
          {secondary.map((item) => {
            const RowIcon = getDecisionIcon(item.decision);
            const secondaryDetail = getSecondaryQueueDetail(item);
            return (
              <article key={item.id} className={cn('ai-action-queue-row', `autopilot-tone-${item.tone}`)}>
                <span className="ai-action-queue-rank">#{item.rank}</span>
                <div>
                  <span>
                    <RowIcon className="h-4 w-4" aria-hidden="true" />
                    {getVoicedAIActionLabel(item.label, item.decision)}
                  </span>
                  <strong>{item.action}: {item.target}</strong>
                  <p>{item.why}</p>
                  {secondaryDetail && (
                    <em>{secondaryDetail.label}: {secondaryDetail.detail}</em>
                  )}
                </div>
                <span className="ai-action-queue-row-score">
                  <Activity className="h-4 w-4" aria-hidden="true" />
                  {getActionQueueEvidenceBand(item)}
                </span>
              </article>
            );
          })}
        </div>
      )}

      {showSuppressedAlternates && suppressed.length > 0 && (
        <div className="ai-action-queue-suppressed" aria-label="Suppressed lower-ranked AI actions">
          <span>{suppressedCopy.label}</span>
          <strong>{suppressedCopy.countLabel}</strong>
          <p>
            {suppressedCopy.body}
          </p>
        </div>
      )}
    </section>
  );
}
