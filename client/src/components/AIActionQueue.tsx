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

function getSecondaryQueueDetail(item: AIActionQueueItem): { label: string; detail: string } | null {
  if (item.missingEvidence[0]) {
    return {
      label: 'Where to verify',
      detail: item.missingEvidence[0],
    };
  }
  if (item.changeTriggers[0]) {
    return {
      label: 'What changes this',
      detail: item.changeTriggers[0],
    };
  }
  return null;
}

function QueueReceipts({
  item,
  compact,
}: {
  item: AIActionQueueItem;
  compact?: boolean;
}) {
  const receipts = compact ? item.receipts.slice(0, 2) : item.receipts.slice(0, 3);
  const sourceHealth = compact ? item.sourceHealth.slice(0, 2) : item.sourceHealth.slice(0, 3);
  const changeTriggers = compact ? item.changeTriggers.slice(0, 2) : item.changeTriggers.slice(0, 3);
  const dominoEffects = compact ? (item.dominoEffects || []).slice(0, 2) : (item.dominoEffects || []).slice(0, 3);
  const verificationRows = sourceHealth.length
    ? sourceHealth
    : ['Verify current roster, availability, league format, and source freshness before acting.'];

  return (
    <div className="ai-action-queue-receipts">
      {receipts.length > 0 && (
        <div>
          <span>Why</span>
          <ul>
            {receipts.map((receipt) => (
              <li key={receipt}>{receipt}</li>
            ))}
          </ul>
        </div>
      )}
      {changeTriggers.length > 0 && (
        <div className="ai-action-queue-change-mind">
          <span>What changes this</span>
          <ul>
            {changeTriggers.map((trigger) => (
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
      {verificationRows.length > 0 && (
        <div>
          <span>Where to verify</span>
          <ul>
            {verificationRows.map((source) => (
              <li key={source}>{source}</li>
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
    <div className="ai-action-confidence-sparkline" aria-label="AI confidence history">
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
  enableOutcomeObserver = true,
  maxVisibleItems = 1,
  showSuppressedAlternates = true,
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
          <div className="ai-action-summary-score" aria-label={`${primary.confidence}% confidence`}>
            <strong>{primary.confidence}%</strong>
            <span>{primary.source}</span>
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
          <strong>{primary.confidence}%</strong>
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
        <ActionConflictPanel item={primary} compact={compact} />
        <ActionMemoryPanel change={change} points={confidencePoints} compact={compact} />
        {enableOutcomeObserver && !compact && (
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
                  {item.confidence}%
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
