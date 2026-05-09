import { ENV } from "./env";
import type { TrpcContext } from "./context";

const ADMIN_PERMISSION_ENV_KEYS = [
  "ADMIN_PERMISSIONS",
] as const;

export function normalizeAdminIdentifier(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function parseAdminPermissionList(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[\s,;]+/)
    .map(normalizeAdminIdentifier)
    .filter(Boolean);
}

function getAdminPermissionSet(): Set<string> {
  const configuredAdmins = ADMIN_PERMISSION_ENV_KEYS.flatMap((key) =>
    parseAdminPermissionList(process.env[key])
  );
  const ownerOpenId = normalizeAdminIdentifier(ENV.ownerOpenId);
  return new Set([
    ...configuredAdmins,
    ...(ownerOpenId ? [ownerOpenId] : []),
  ]);
}

export function hasAdminPermissionIdentifier(
  ...identifiers: Array<string | null | undefined>
): boolean {
  const adminPermissions = getAdminPermissionSet();
  if (adminPermissions.size === 0) return false;

  return identifiers
    .map(normalizeAdminIdentifier)
    .some((value) => value && adminPermissions.has(value));
}

export function hasAdminPermissionsForUser(user: NonNullable<TrpcContext["user"]>): boolean {
  if (user.role === "admin") return true;
  const email = normalizeAdminIdentifier(user.email);
  const emailName = email.split("@")[0] || "";
  return hasAdminPermissionIdentifier(user.openId, user.name, email, emailName);
}
