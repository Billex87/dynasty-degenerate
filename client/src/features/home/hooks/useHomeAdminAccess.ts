import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  type AdminAuthUser,
  canViewAdminTelemetryForUser,
} from "@/features/home/lib/adminSessionState";
import type { AdminViewMode } from "@/features/home/lib/adminMode";
import type { CachedSleeperUser } from "@/features/home/lib/leagueHistory";
import type { SleeperSession } from "@/features/home/lib/reportCache";
import type { ReportData } from "@shared/types";

type PersistHomeAdminViewModeOptions = {
  mode: AdminViewMode;
  sleeperSessionKey: string;
};

export function persistHomeAdminViewMode({
  mode,
  sleeperSessionKey,
}: PersistHomeAdminViewModeOptions) {
  try {
    const sleeperSession = localStorage.getItem(sleeperSessionKey);
    if (!sleeperSession) return;
    const parsed = JSON.parse(sleeperSession) as SleeperSession;
    localStorage.setItem(
      sleeperSessionKey,
      JSON.stringify({
        ...parsed,
        adminViewMode: mode,
        savedAt: Date.now(),
      } satisfies SleeperSession)
    );
  } catch {
    // The view-mode choice only needs to last for this browser session.
  }
}

type UseHomeAdminAccessOptions = {
  activeCachedSleeperUser: CachedSleeperUser | undefined | null;
  adminViewMode: AdminViewMode | null;
  authUser: AdminAuthUser | undefined | null;
  isAdminPassphraseVerifiedForSession: boolean;
  isProduction: boolean;
  reportData: ReportData | null;
  sleeperSessionKey: string;
  unlockDismissedKey: string;
  setActiveTab: Dispatch<SetStateAction<string>>;
  setAdminPassphrase: Dispatch<SetStateAction<string>>;
  setAdminViewMode: Dispatch<SetStateAction<AdminViewMode | null>>;
  setAdminViewerManager: Dispatch<SetStateAction<string | null>>;
  setIsAdminAccessModalOpen: Dispatch<SetStateAction<boolean>>;
};

export function useHomeAdminAccess({
  activeCachedSleeperUser,
  adminViewMode,
  authUser,
  isAdminPassphraseVerifiedForSession,
  isProduction,
  reportData,
  sleeperSessionKey,
  unlockDismissedKey,
  setActiveTab,
  setAdminPassphrase,
  setAdminViewMode,
  setAdminViewerManager,
  setIsAdminAccessModalOpen,
}: UseHomeAdminAccessOptions) {
  const [isAdminUnlockModalOpen, setIsAdminUnlockModalOpen] = useState(false);
  const hasAuthenticatedAdminPermissions =
    canViewAdminTelemetryForUser(authUser);
  const hasSleeperAdminPermissions =
    activeCachedSleeperUser?.hasAdminPermissions === true ||
    activeCachedSleeperUser?.isPrivilegedReportViewer === true;
  const hasAdminPermissions =
    hasAuthenticatedAdminPermissions || hasSleeperAdminPermissions;
  const canOpenAdminToolsEntry = hasAdminPermissions || !isProduction;
  const canViewAdminFeatureExpansion =
    isAdminPassphraseVerifiedForSession &&
    (hasAuthenticatedAdminPermissions
      ? adminViewMode === "admin"
      : hasSleeperAdminPermissions && adminViewMode === "admin");
  const canViewAdminDiagnostics = canViewAdminFeatureExpansion;

  const persistAdminViewMode = useCallback(
    (mode: AdminViewMode) => {
      persistHomeAdminViewMode({ mode, sleeperSessionKey });
    },
    [sleeperSessionKey]
  );

  const handleAdminViewModeChoice = useCallback(
    (mode: AdminViewMode) => {
      setAdminViewMode(mode);
      if (mode === "regular") {
        setAdminViewerManager(null);
      }
      persistAdminViewMode(mode);
      if (mode === "regular") {
        setActiveTab("overview");
      }
    },
    [
      persistAdminViewMode,
      setActiveTab,
      setAdminViewMode,
      setAdminViewerManager,
    ]
  );

  const handleAdminModeToggle = useCallback(() => {
    handleAdminViewModeChoice(
      adminViewMode === "admin" ? "regular" : "admin"
    );
  }, [adminViewMode, handleAdminViewModeChoice]);

  useEffect(() => {
    if (
      !hasAuthenticatedAdminPermissions ||
      !reportData ||
      !canViewAdminFeatureExpansion
    )
      return;
    try {
      if (sessionStorage.getItem(unlockDismissedKey) === "true") return;
    } catch {
      // Session storage only prevents repeating this prompt.
    }
    setIsAdminUnlockModalOpen(true);
  }, [
    canViewAdminFeatureExpansion,
    hasAuthenticatedAdminPermissions,
    reportData,
    unlockDismissedKey,
  ]);

  const handleAdminUnlockModalDismiss = useCallback(() => {
    setIsAdminUnlockModalOpen(false);
    try {
      sessionStorage.setItem(unlockDismissedKey, "true");
    } catch {
      // Non-critical preference.
    }
  }, [unlockDismissedKey]);

  const handleAdminToolsClick = useCallback(() => {
    if (canOpenAdminToolsEntry) {
      if (!isAdminPassphraseVerifiedForSession) {
        setAdminPassphrase("");
        setIsAdminAccessModalOpen(true);
        return;
      }
      handleAdminModeToggle();
      return;
    }

    setAdminPassphrase("");
    setIsAdminAccessModalOpen(true);
  }, [
    canOpenAdminToolsEntry,
    handleAdminModeToggle,
    isAdminPassphraseVerifiedForSession,
    setAdminPassphrase,
    setIsAdminAccessModalOpen,
  ]);

  return {
    canOpenAdminToolsEntry,
    canViewAdminDiagnostics,
    canViewAdminFeatureExpansion,
    handleAdminToolsClick,
    handleAdminUnlockModalDismiss,
    hasAdminPermissions,
    hasAuthenticatedAdminPermissions,
    isAdminUnlockModalOpen,
  };
}
