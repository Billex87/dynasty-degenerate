export type AdminViewMode = "admin" | "regular";

export type KtcAdminIdentitySource = {
  username?: string | null;
  displayName?: string | null;
};

export function getKtcAdminIdentity(
  user?: KtcAdminIdentitySource | null,
  fallbackUsername?: string
): string | null {
  return user?.username || user?.displayName || fallbackUsername || null;
}

export function normalizeAdminViewMode(value: unknown): AdminViewMode | null {
  return value === "admin" || value === "regular" ? value : null;
}
