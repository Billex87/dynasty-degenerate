import type { PlayerDetails } from '@shared/types';

export type PlayerAvailabilityTone = 'active' | 'warning' | 'risk' | 'taxi';

function normalizeStatus(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const label = String(value).replace(/_/g, ' ').trim();
  return label || null;
}

export function getPlayerAvailability(details?: PlayerDetails | null): {
  label: string;
  tone: PlayerAvailabilityTone;
} {
  const label = normalizeStatus(details?.displayStatus)
    || normalizeStatus(details?.rosterStatus)
    || normalizeStatus(details?.injuryStatus)
    || normalizeStatus(details?.status)
    || 'Active';
  const lower = label.toLowerCase();

  if (lower.includes('taxi')) return { label, tone: 'taxi' };
  if (lower.includes('ir') || lower.includes('pup') || lower.includes('out') || lower.includes('doubt')) {
    return { label, tone: 'risk' };
  }
  if (lower.includes('question') || lower.includes('injur') || lower.includes('suspen')) {
    return { label, tone: 'warning' };
  }

  return { label, tone: 'active' };
}

export function getPlayerAvailabilityClass(details?: PlayerDetails | null): string {
  return `is-${getPlayerAvailability(details).tone}`;
}
