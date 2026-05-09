import type { ReactNode } from 'react';
import { BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AIReadSeverity = 'neutral' | 'good' | 'info' | 'warn' | 'danger';
export type AIReadBackgroundVariant =
  | 'blueprint'
  | 'roster'
  | 'trade'
  | 'market'
  | 'draft'
  | 'lineup'
  | 'waiver'
  | 'league'
  | 'monthly';

export type AIReadChip = string | {
  label: string;
  tone?: AIReadSeverity;
};

export type AIReadAction = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
};

export interface AIReadPanelProps {
  title: string;
  subtitle?: string;
  readType?: string;
  confidence?: number | null;
  severity?: AIReadSeverity;
  chips?: AIReadChip[];
  body: ReactNode;
  actions?: AIReadAction[];
  compact?: boolean;
  backgroundVariant?: AIReadBackgroundVariant;
  className?: string;
}

function normalizeConfidence(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function renderChip(chip: AIReadChip) {
  const label = typeof chip === 'string' ? chip : chip.label;
  const tone = typeof chip === 'string' ? 'neutral' : chip.tone || 'neutral';

  return (
    <span key={label} className={cn('ai-read-chip', `ai-read-chip-${tone}`)}>
      {label}
    </span>
  );
}

function AIReadPanelContent({
  title,
  subtitle,
  readType,
  confidence,
  severity = 'info',
  chips,
  body,
  actions,
}: Omit<AIReadPanelProps, 'compact' | 'backgroundVariant' | 'className'>) {
  const normalizedConfidence = normalizeConfidence(confidence);

  return (
    <>
      <span className="ai-read-corner ai-read-corner-top-left" aria-hidden="true" />
      <span className="ai-read-corner ai-read-corner-top-right" aria-hidden="true" />
      <span className="ai-read-corner ai-read-corner-bottom-left" aria-hidden="true" />
      <span className="ai-read-corner ai-read-corner-bottom-right" aria-hidden="true" />
      <div className="ai-read-panel-head">
        <div className="ai-read-panel-title-lockup">
          <span className="ai-read-badge">
            <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />
            AI Read
          </span>
          {readType && <span className={cn('ai-read-type', `ai-read-type-${severity}`)}>{readType}</span>}
          <h4>{title}</h4>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {normalizedConfidence !== null && (
          <div className="ai-read-confidence" aria-label={`Confidence ${normalizedConfidence}%`}>
            <span>Confidence</span>
            <strong>{normalizedConfidence}%</strong>
            <em>
              <i style={{ width: `${normalizedConfidence}%` }} />
            </em>
          </div>
        )}
      </div>
      {chips?.length ? (
        <div className="ai-read-chip-row">
          {chips.map(renderChip)}
        </div>
      ) : null}
      <div className="ai-read-body">
        {typeof body === 'string' ? <p>{body}</p> : body}
      </div>
      {actions?.length ? (
        <div className="ai-read-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled || !action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function AIReadPanel({
  compact = false,
  backgroundVariant = 'blueprint',
  severity = 'info',
  className,
  ...props
}: AIReadPanelProps) {
  const rootClassName = cn(
    'ai-read-panel',
    compact && 'ai-read-panel-compact',
    `ai-read-panel-${backgroundVariant}`,
    `ai-read-panel-severity-${severity}`,
    className,
  );

  if (compact) {
    return (
      <details className={rootClassName}>
        <summary className="ai-read-compact-summary">
          <span className="ai-read-badge">
            <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />
            AI Read
          </span>
          <span>{props.title}</span>
        </summary>
        <AIReadPanelContent {...props} severity={severity} />
      </details>
    );
  }

  return (
    <article className={rootClassName}>
      <AIReadPanelContent {...props} severity={severity} />
    </article>
  );
}
