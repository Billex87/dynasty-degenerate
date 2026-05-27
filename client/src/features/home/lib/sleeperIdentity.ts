export const SLEEPER_ID_PATTERN = /^\d{8,24}$/;

export function getValidSleeperUserId(userId?: string | null): string | null {
  const trimmedUserId = userId?.trim();
  return trimmedUserId && SLEEPER_ID_PATTERN.test(trimmedUserId)
    ? trimmedUserId
    : null;
}

export function normalizeViewerIdentifier(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}
