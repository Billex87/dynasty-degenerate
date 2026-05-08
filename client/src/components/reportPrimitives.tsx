import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { TeamLogoPill } from './TeamLogoPill';

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
      <h3 className="report-section-title athletic-headline mt-1 text-xl font-black text-orange-400 sm:text-2xl">
        {title}
      </h3>
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
      className={cn(
        'report-metric-pill owner-metric-pill',
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

export function PlayerIdentityRow({
  playerId,
  playerName,
  team,
  position,
  age,
  className,
}: {
  playerId?: string;
  playerName: string;
  team?: string | null;
  position?: string | null;
  age?: number | string | null;
  className?: string;
}) {
  const hasMeta = Boolean(team || position || age);

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
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('report-empty-state', className)}>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
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
