import type { ReactNode } from 'react';
import { BrainCircuit } from 'lucide-react';
import { AITronSurface, type AITronDensity, type AITronTheme } from '@/components/AITronSurface';
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
  confidenceNote?: string | null;
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

function getConfidenceLabel(value: number): string {
  if (value >= 78) return 'Strong evidence';
  if (value >= 62) return 'Building evidence';
  if (value >= 46) return 'Thin evidence';
  return 'Low evidence';
}

function getDefaultConfidenceNote(value: number): string {
  if (value >= 78) return 'Strong signal mix, but still dependent on fresh league and source data.';
  if (value >= 62) return 'Usable read with some source or league-memory gaps.';
  if (value >= 46) return 'Treat this as directional until more league/source evidence lands.';
  return 'Low-confidence read; verify before acting on it.';
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

function getAITronTheme(variant: AIReadBackgroundVariant, severity: AIReadSeverity): AITronTheme {
  if (severity === 'danger') return 'red';
  if (severity === 'good') return 'green';
  if (severity === 'warn') return 'amber';

  switch (variant) {
    case 'roster':
    case 'lineup':
      return 'green';
    case 'market':
    case 'draft':
    case 'monthly':
      return 'amber';
    case 'trade':
      return 'blue';
    case 'waiver':
      return 'cyan';
    case 'league':
      return 'blue';
    case 'blueprint':
    default:
      return 'cyan';
  }
}

function AIReadPanelContent({
  title,
  subtitle,
  readType,
  confidence,
  confidenceNote,
  severity = 'info',
  chips,
  body,
  actions,
}: Omit<AIReadPanelProps, 'compact' | 'backgroundVariant' | 'className'>) {
  const normalizedConfidence = normalizeConfidence(confidence);
  const displayedConfidenceNote = normalizedConfidence === null
    ? null
    : confidenceNote || getDefaultConfidenceNote(normalizedConfidence);

  return (
    <>
      <span className="ai-read-status-rail" aria-hidden="true" />
      <div className="ai-read-panel-head">
        <div className="ai-read-panel-title-lockup">
          <div className="ai-read-label-row">
            <span className="ai-read-badge">
              <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />
              AI Read
            </span>
            {readType && <span className={cn('ai-read-type', `ai-read-type-${severity}`)}>{readType}</span>}
          </div>
          <h4>{title}</h4>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {normalizedConfidence !== null && (
          <div className="ai-read-confidence" aria-label={`AI confidence ${normalizedConfidence}%`}>
            <span>{getConfidenceLabel(normalizedConfidence)}</span>
            <strong>{normalizedConfidence}%</strong>
            <em>
              <i style={{ width: `${normalizedConfidence}%` }} />
            </em>
            {displayedConfidenceNote && <small>{displayedConfidenceNote}</small>}
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
  const tronTheme = getAITronTheme(backgroundVariant, severity);
  const tronDensity: AITronDensity = compact ? 'small' : 'medium';
  const rootClassName = cn(
    'ai-read-panel',
    'ai-surface-r3f',
    'ai-read-panel-r3f',
    compact && 'ai-read-panel-compact',
    `ai-read-panel-${backgroundVariant}`,
    `ai-read-panel-severity-${severity}`,
    className,
  );

  if (compact) {
    return (
      <details className={rootClassName}>
        <AITronSurface theme={tronTheme} density={tronDensity} />
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
      <AITronSurface theme={tronTheme} density={tronDensity} />
      <AIReadPanelContent {...props} severity={severity} />
    </article>
  );
}
