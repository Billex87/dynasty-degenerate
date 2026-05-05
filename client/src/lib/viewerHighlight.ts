function normalizeManagerName(value?: string | null): string {
  return value?.trim().toLowerCase() || '';
}

export function isViewerManagerMatch(manager?: string | null, viewerManager?: string | null): boolean {
  const normalizedManager = normalizeManagerName(manager);
  return Boolean(normalizedManager && normalizedManager === normalizeManagerName(viewerManager));
}

export function viewerOwnedHighlightClass(manager?: string | null, viewerManager?: string | null): string {
  return isViewerManagerMatch(manager, viewerManager) ? 'viewer-owned-highlight' : '';
}
