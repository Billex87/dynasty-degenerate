import type { Dispatch, SetStateAction } from "react";

import { rememberAutocompleteValue } from "@/features/home/lib/inputHelpers";
import {
  findCachedSleeperUser,
  readCachedSleeperUsers,
  rememberCachedSleeperLeagueShortcut,
  type CachedSleeperUser,
  type SleeperLeagueOption,
  type SleeperUserSession,
} from "@/features/home/lib/leagueHistory";

type UseHomeLeagueHistoryActionsOptions = {
  cachedSleeperUsers: CachedSleeperUser[];
  leagueIdHistoryKey: string;
  sleeperUsername: string;
  userLeagues: SleeperLeagueOption[];
  viewerUserId: string | null;
  viewerUsername: string | null;
  setCachedSleeperUsers: Dispatch<SetStateAction<CachedSleeperUser[]>>;
  setLeagueIdHistory: Dispatch<SetStateAction<string[]>>;
};

export function useHomeLeagueHistoryActions({
  cachedSleeperUsers,
  leagueIdHistoryKey,
  sleeperUsername,
  userLeagues,
  viewerUserId,
  viewerUsername,
  setCachedSleeperUsers,
  setLeagueIdHistory,
}: UseHomeLeagueHistoryActionsOptions) {
  const rememberLeagueId = (value: string) => {
    setLeagueIdHistory(rememberAutocompleteValue(leagueIdHistoryKey, value));
  };

  const getCurrentSessionUserForCache = (): SleeperUserSession | null => {
    const cachedUser = findCachedSleeperUser(
      cachedSleeperUsers,
      viewerUserId,
      sleeperUsername
    );
    const username = sleeperUsername.trim() || cachedUser?.username || "";
    if (!username) return null;

    return {
      userId: viewerUserId || cachedUser?.userId || username,
      username: cachedUser?.username || viewerUsername || username,
      displayName: cachedUser?.displayName || viewerUsername || username,
      avatarUrl: cachedUser?.avatarUrl || null,
      hasAdminPermissions:
        cachedUser?.hasAdminPermissions === true ||
        cachedUser?.isPrivilegedReportViewer === true,
      isPrivilegedReportViewer:
        cachedUser?.hasAdminPermissions === true ||
        cachedUser?.isPrivilegedReportViewer === true,
    };
  };

  const rememberCurrentUserLeagueShortcut = (nextLeagueId: string) => {
    if (!userLeagues.some(league => league.leagueId === nextLeagueId)) return;
    const sessionUser = getCurrentSessionUserForCache();
    const username = sleeperUsername.trim() || sessionUser?.username || "";
    if (!sessionUser || !username) return;

    const nextUsers = rememberCachedSleeperLeagueShortcut({
      users: readCachedSleeperUsers(),
      user: sessionUser,
      username,
      leagues: userLeagues,
      leagueId: nextLeagueId,
    });
    setCachedSleeperUsers(nextUsers);
  };

  return {
    rememberCurrentUserLeagueShortcut,
    rememberLeagueId,
  };
}
