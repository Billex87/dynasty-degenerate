import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { TeamLogoPill } from './TeamLogoPill';
import {
  getPrimaryValueLabel,
  normalizeLeagueValueMode,
  type LeagueValueMode,
  type ValueContext,
} from '@/lib/leagueValueMode';

export type ReportTone = 'neutral' | 'good' | 'warn' | 'danger' | 'info' | 'positive' | 'negative';

function ownerMetricTone(tone: ReportTone): 'neutral' | 'good' | 'warn' | 'danger' | 'info' {
  if (tone === 'positive') return 'good';
  if (tone === 'negative') return 'danger';
  return tone;
}

export function ReportSectionHeader({
  title,
  kicker,
  description,
  className,
}: {
  title: string;
  kicker?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('report-section-header mb-4 text-center sm:mb-5', className)}>
      {kicker && (
        <p className="report-section-kicker text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
          {kicker}
        </p>
      )}
      <h2 className="report-section-title athletic-headline mt-1 text-xl font-black text-orange-400 sm:text-2xl">
        {title}
      </h2>
      {description && <p className="report-section-description">{description}</p>}
    </div>
  );
}

export function ReportCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('report-card-surface', className)}>
      {children}
    </div>
  );
}

export function MetricPill({
  label,
  value,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: ReportTone;
  className?: string;
}) {
  const ownerTone = ownerMetricTone(tone);
  return (
    <span
      data-position={label}
      className={cn(
        'report-pill-shell report-inline-pill report-metric-pill owner-metric-pill',
        `report-metric-pill-${tone}`,
        ownerTone !== 'neutral' && `owner-metric-pill-${ownerTone}`,
        className,
      )}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

export function ValuePill({
  value,
  mode,
  context,
  source,
  delta,
  hideWhenUnsupported = false,
  allowDynastyInRedraft = false,
  className,
}: {
  value?: number | string | null;
  mode?: LeagueValueMode | string | null;
  context: ValueContext;
  source?: string;
  delta?: number | null;
  hideWhenUnsupported?: boolean;
  allowDynastyInRedraft?: boolean;
  className?: string;
}) {
  const normalizedMode = normalizeLeagueValueMode(mode);
  const isUnsupportedDynasty = normalizedMode === 'redraft' && /dynasty/i.test(source || '') && !allowDynastyInRedraft;
  if (hideWhenUnsupported && isUnsupportedDynasty) return null;

  const numericValue = typeof value === 'number' ? value : Number(value);
  const formattedValue = value === null || value === undefined || value === ''
    ? '-'
    : typeof value === 'number' || Number.isFinite(numericValue)
      ? Number(value).toLocaleString()
      : String(value);
  const label = source || getPrimaryValueLabel(normalizedMode, context);
  const deltaLabel = delta !== null && delta !== undefined
    ? `${delta > 0 ? '+' : ''}${delta.toLocaleString()}`
    : null;

  return (
    <span
      className={cn(
        'value-pill value-pill-mode-aware',
        `value-pill-${normalizedMode}`,
        delta !== null && delta !== undefined && (delta > 0 ? 'value-pill-positive' : delta < 0 ? 'value-pill-negative' : 'value-pill-neutral'),
        className,
      )}
      title={label}
    >
      <em>{label}</em>
      <strong>{formattedValue}</strong>
      {deltaLabel && <small>{deltaLabel}</small>}
    </span>
  );
}

export function LeagueTypeBadge({
  mode,
  className,
}: {
  mode?: LeagueValueMode | string | null;
  className?: string;
}) {
  const normalizedMode = normalizeLeagueValueMode(mode);
  return (
    <span className={cn('league-type-badge', `league-type-badge-${normalizedMode}`, className)}>
      {normalizedMode === 'redraft' ? 'Redraft' : 'Dynasty'}
    </span>
  );
}

export type PreviewMetric = {
  label: string;
  compactLabel?: string;
  value: ReactNode;
  tone?: ReportTone;
  icon?: ReactNode;
  hideLabel?: boolean;
  className?: string;
};

const BAD_SIGNAL_PREVIEW_LABEL_PATTERN = /\b(?:trash|weak|weakest|drop|drops|faller|fallers|low|lowest|worst|dead|drag|cut|cuts|risk|risky|fraud|cooked|hole|liability|leak|miss|misses)\b/i;

function getPreviewMetricSignalClass(metric: PreviewMetric) {
  if (metric.tone !== 'warn') return null;
  const labelText = `${metric.label} ${metric.compactLabel || ''}`;
  return BAD_SIGNAL_PREVIEW_LABEL_PATTERN.test(labelText) ? 'analysis-preview-chip-bad-signal' : null;
}

export function PreviewMetricChips({
  metrics,
  className,
}: {
  metrics?: PreviewMetric[];
  className?: string;
}) {
  const visibleMetrics = (metrics || []).filter((metric) => metric.value !== null && metric.value !== undefined && metric.value !== '');
  if (!visibleMetrics.length) return null;

  return (
    <span
      className={cn(
        'analysis-preview-chip-row',
        visibleMetrics.length === 1 && 'analysis-preview-chip-row-single',
        visibleMetrics.some((metric) => metric.icon) && 'analysis-preview-chip-row-has-icons',
        className,
      )}
    >
      {visibleMetrics.slice(0, 6).map((metric) => (
        <span
          key={`${metric.label}-${String(metric.value)}`}
          className={cn(
            'analysis-preview-chip',
            metric.icon && 'analysis-preview-chip-has-icon',
            metric.hideLabel && 'analysis-preview-chip-label-hidden',
            metric.tone && `analysis-preview-chip-${metric.tone}`,
            getPreviewMetricSignalClass(metric),
            metric.className,
          )}
        >
          <span className={cn('analysis-preview-chip-label', metric.compactLabel && 'analysis-preview-chip-label-has-compact')}>
            {metric.icon && <span className="analysis-preview-chip-icon" aria-hidden="true">{metric.icon}</span>}
            <span className="analysis-preview-chip-label-text analysis-preview-chip-label-text-full">{metric.label}</span>
            {metric.compactLabel && (
              <span className="analysis-preview-chip-label-text analysis-preview-chip-label-text-compact">
                {metric.compactLabel}
              </span>
            )}
          </span>
          <strong>{metric.value}</strong>
        </span>
      ))}
    </span>
  );
}

export function CollapsibleAnalysisCard({
  title,
  subtitle,
  previewMetrics,
  chips,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  previewMetrics?: PreviewMetric[];
  chips?: Array<{ label: string; tone?: ReportTone }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={cn('collapsible-analysis-card', className)}>
      <summary className="collapsible-analysis-card-summary">
        <span>
          <span className="collapsible-analysis-card-title">{title}</span>
          {subtitle && <span className="collapsible-analysis-card-subtitle">{subtitle}</span>}
        </span>
        <PreviewMetricChips metrics={previewMetrics} />
        {chips?.length ? (
          <span className="analysis-insight-chip-row">
            {chips.map((chip) => (
              <span key={chip.label} className={cn('analysis-insight-chip', chip.tone && `analysis-insight-chip-${chip.tone}`)}>
                {chip.label}
              </span>
            ))}
          </span>
        ) : null}
      </summary>
      <div className="collapsible-analysis-card-body">{children}</div>
    </details>
  );
}

export function PlayerIdentityRow({
  playerId,
  playerName,
  team,
  position,
  age,
  hideMeta = false,
  className,
}: {
  playerId?: string;
  playerName: string;
  team?: string | null;
  position?: string | null;
  age?: number | string | null;
  hideMeta?: boolean;
  className?: string;
}) {
  const hasMeta = !hideMeta && Boolean(team || position || age);

  return (
    <div className={cn('report-player-identity-row', className)}>
      <PlayerNameWithHeadshot playerId={playerId} playerName={playerName} team={team} position={position} />
      {hasMeta && (
        <span className="report-player-identity-meta" aria-label={`${playerName} player context`}>
          <TeamLogoPill team={team} />
          {position && <span>{position}</span>}
          {age && <span>{age} yrs</span>}
        </span>
      )}
    </div>
  );
}

export function PlayerPill({
  playerId,
  playerName,
  team,
  position,
  className,
}: {
  playerId?: string;
  playerName: string;
  team?: string | null;
  position?: string | null;
  className?: string;
}) {
  return (
    <span className={cn('player-pill', className)}>
      <PlayerNameWithHeadshot playerId={playerId} playerName={playerName} team={team} position={position} />
    </span>
  );
}

export function PositionBadge({
  position,
  className,
}: {
  position?: string | null;
  className?: string;
}) {
  return (
    <span className={cn('position-badge', className)}>
      {position || 'N/A'}
    </span>
  );
}

export function DraftPickBadge({
  year,
  round,
  owner,
  mode,
  className,
}: {
  year?: string | number | null;
  round?: string | number | null;
  owner?: string | null;
  mode?: LeagueValueMode | string | null;
  className?: string;
}) {
  const normalizedMode = normalizeLeagueValueMode(mode);
  return (
    <span className={cn('draft-pick-badge', `draft-pick-badge-${normalizedMode}`, className)}>
      <strong>{[year, round ? `R${round}` : null].filter(Boolean).join(' ') || 'Draft Pick'}</strong>
      {owner && <em>{owner}</em>}
    </span>
  );
}

export function ManagerBadge({
  managerName,
  avatarUrl,
  displayName,
  emptyLabel = 'FA',
  className,
}: {
  managerName?: string | null;
  avatarUrl?: string | null;
  displayName?: string;
  emptyLabel?: string;
  className?: string;
}) {
  if (!managerName) {
    return (
      <span className={cn('report-manager-badge report-manager-badge-empty', className)}>
        {emptyLabel}
      </span>
    );
  }

  return (
    <span className={cn('report-manager-badge', className)}>
      <ManagerNameWithAvatar avatarUrl={avatarUrl} managerName={managerName} displayName={displayName} />
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('report-empty-state', className)}>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action && <div className="report-empty-state-action">{action}</div>}
    </div>
  );
}

export function ResponsiveDataTable<T>({
  rows,
  columns,
  getRowKey,
  emptyState,
  className,
}: {
  rows: T[];
  columns: Array<{
    key: string;
    label: string;
    render: (row: T) => ReactNode;
    mobilePrimary?: boolean;
  }>;
  getRowKey: (row: T, index: number) => string;
  emptyState?: ReactNode;
  className?: string;
}) {
  if (!rows.length) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <div className={cn('responsive-data-table', className)} role="table">
      <div className="responsive-data-table-header" role="row">
        {columns.map((column) => (
          <span key={column.key} className="responsive-data-table-header-cell" role="columnheader">
            {column.label}
          </span>
        ))}
      </div>
      <div className="responsive-data-table-body" role="rowgroup">
        {rows.map((row, rowIndex) => (
          <div key={getRowKey(row, rowIndex)} className="responsive-data-table-row" role="row">
            {columns.map((column) => (
              <span
                key={column.key}
                className={cn(column.mobilePrimary ? 'responsive-data-table-cell-primary' : undefined, 'responsive-data-table-cell')}
                data-label={column.label}
                role="cell"
              >
                {column.render(row)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MobileStackedRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mobile-stacked-row', className)}>
      {children}
    </div>
  );
}
