import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import {
  getKtcAdminIdentity,
  type AdminViewMode,
} from "@/features/home/lib/adminMode";
import { rememberAutocompleteValue } from "@/features/home/lib/inputHelpers";
import {
  buildCachedSleeperUser,
  rememberCachedSleeperUser,
  type CachedSleeperUser,
  type SleeperLeagueOption,
} from "@/features/home/lib/leagueHistory";
import {
  formatMutationErrorMessage,
  showMutationErrorToast,
  type SleeperSession,
} from "@/features/home/lib/reportCache";
import { persistHomeAdminViewMode } from "@/features/home/hooks/useHomeAdminAccess";

type UseHomeSleeperLeagueSearchOptions = {
  clownUsernames: Set<string>;
  sleeperSessionKey: string;
  sleeperUsername: string;
  sleeperUsernameHistoryKey: string;
  setAdminViewMode: Dispatch<SetStateAction<AdminViewMode | null>>;
  setAdminViewerManager: Dispatch<SetStateAction<string | null>>;
  setAnalysisErrorMessage: Dispatch<SetStateAction<string | null>>;
  setCachedSleeperUsers: Dispatch<SetStateAction<CachedSleeperUser[]>>;
  setFocusedAutocomplete: Dispatch<SetStateAction<"username" | "league" | null>>;
  setIsClownModalOpen: Dispatch<SetStateAction<boolean>>;
  setIsLeagueIntelLoading: Dispatch<SetStateAction<boolean>>;
  setIsLeaguePickerOpen: Dispatch<SetStateAction<boolean>>;
  setPortfolioSearch: Dispatch<SetStateAction<string>>;
  setSleeperUsername: Dispatch<SetStateAction<string>>;
  setSleeperUsernameHistory: Dispatch<SetStateAction<string[]>>;
  setUserLeagues: Dispatch<SetStateAction<SleeperLeagueOption[]>>;
  setViewerUserId: Dispatch<SetStateAction<string | null>>;
  setViewerUsername: Dispatch<SetStateAction<string | null>>;
};

export function useHomeSleeperLeagueSearch({
  clownUsernames,
  sleeperSessionKey,
  sleeperUsername,
  sleeperUsernameHistoryKey,
  setAdminViewMode,
  setAdminViewerManager,
  setAnalysisErrorMessage,
  setCachedSleeperUsers,
  setFocusedAutocomplete,
  setIsClownModalOpen,
  setIsLeagueIntelLoading,
  setIsLeaguePickerOpen,
  setPortfolioSearch,
  setSleeperUsername,
  setSleeperUsernameHistory,
  setUserLeagues,
  setViewerUserId,
  setViewerUsername,
}: UseHomeSleeperLeagueSearchOptions) {
  const userLeaguesMutation = trpc.league.getUserLeagues.useMutation({
    onSuccess: (data, variables) => {
      const username = variables.username.trim();
      const nextViewerUserId = data.user?.userId || null;
      const nextViewerIdentity = getKtcAdminIdentity(data.user, username);
      const nextHasAdminPermissions =
        data.user?.hasAdminPermissions === true ||
        data.user?.isPrivilegedReportViewer === true;
      setUserLeagues(data.leagues);
      setIsLeagueIntelLoading(Boolean(nextViewerUserId && data.leagues.length));
      setViewerUserId(nextViewerUserId);
      setViewerUsername(nextViewerIdentity);
      setAdminViewMode(null);
      setAdminViewerManager(null);
      if (data.leagues.length === 0) {
        toast.error("No Sleeper leagues found for this username");
        return;
      }
      setSleeperUsernameHistory(
        rememberAutocompleteValue(sleeperUsernameHistoryKey, username)
      );
      setCachedSleeperUsers(
        rememberCachedSleeperUser(
          buildCachedSleeperUser(username, data.user, data.leagues)
        )
      );
      try {
        localStorage.setItem(
          sleeperSessionKey,
          JSON.stringify({
            username,
            user: data.user || null,
            leagues: data.leagues,
            adminViewMode: null,
            savedAt: Date.now(),
          } satisfies SleeperSession)
        );
      } catch {
        // Losing this cache only affects the league switcher, not the report itself.
      }
      if (nextHasAdminPermissions) {
        setAdminViewMode("regular");
        persistHomeAdminViewMode({
          mode: "regular",
          sleeperSessionKey,
        });
      }
      toast.success(
        `Found ${data.leagues.length} Sleeper league${data.leagues.length === 1 ? "" : "s"}`
      );
      setIsLeaguePickerOpen(true);
    },
    onError: error => {
      setAnalysisErrorMessage(formatMutationErrorMessage(error));
      showMutationErrorToast(error);
    },
  });

  const handleFindLeagues = async () => {
    const normalizedUsername = sleeperUsername.trim();
    if (!normalizedUsername) {
      setAnalysisErrorMessage("Please enter a Sleeper username.");
      toast.error("Please enter a Sleeper username");
      return;
    }
    if (clownUsernames.has(normalizedUsername.toLowerCase())) {
      setIsClownModalOpen(true);
      return;
    }
    setPortfolioSearch("");
    setAnalysisErrorMessage(null);
    setIsLeagueIntelLoading(false);
    userLeaguesMutation.mutate({ username: normalizedUsername });
  };

  const handleClownDismiss = () => {
    setIsClownModalOpen(false);
    setSleeperUsername("");
    setPortfolioSearch("");
    setAnalysisErrorMessage(null);
    setUserLeagues([]);
    setIsLeagueIntelLoading(false);
    setFocusedAutocomplete(null);
    setAdminViewMode(null);
    setAdminViewerManager(null);
  };

  return {
    handleClownDismiss,
    handleFindLeagues,
    isFindLeaguesPending: userLeaguesMutation.isPending,
  };
}
