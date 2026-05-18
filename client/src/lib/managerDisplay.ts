export function isPlaceholderManagerName(manager?: string | null): boolean {
  const normalized = String(manager || '').trim().toLowerCase();
  return !normalized || normalized === 'unknown' || normalized === 'open roster';
}
