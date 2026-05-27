import type { ReportData } from "@shared/types";

import type { LoaderManagerAnchor } from "@/features/report/components/LoaderKitBackdrop";
import { getReportManagerNames } from "@/features/report/lib/reportOverviewPreview";
import {
  normalizePortfolioLeaguePlayer,
  type PortfolioLeaguePlayer,
} from "@/features/home/lib/portfolioRows";
import { normalizeViewerIdentifier } from "@/features/home/lib/sleeperIdentity";

const CACHED_SLEEPER_USERS_KEY = "dynasty-degenerates:sleeper-user-history:v1";
const MAX_CACHED_SLEEPER_USERS = 5;
const MAX_RECENT_LEAGUES_PER_USER = 3;

export type SleeperLeagueOption = {
  leagueId: string;
  name: string;
  avatarUrl: string | null;
  season: string;
  format: string;
  mobileFormat: string;
  totalRosters: number;
  standingsRank: number | null;
  powerRank: number | null;
  rosterPlayers?: PortfolioLeaguePlayer[];
  managerAnchors?: LoaderManagerAnchor[];
};

export type LeagueRankResult = Pick<
  SleeperLeagueOption,
  "leagueId" | "standingsRank" | "powerRank" | "rosterPlayers" | "managerAnchors"
>;

export type AnalysisLeaguePreview = {
  leagueName: string;
  leagueFormat: string;
  leagueLogo: string | null;
};

export type SleeperUserSession = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  hasAdminPermissions?: boolean;
  isPrivilegedReportViewer?: boolean;
};

export type CachedSleeperUser = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  hasAdminPermissions: boolean;
  isPrivilegedReportViewer?: boolean;
  leagues: SleeperLeagueOption[];
  recentLeagueIds: string[];
  savedAt: number;
};

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeLoaderManagerAnchor(value: unknown): LoaderManagerAnchor | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) {
    return null;
  }

  return {
    id: value.id.trim(),
    avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
  };
}

function normalizeLeagueOption(value: unknown): SleeperLeagueOption | null {
  if (
    !isRecord(value) ||
    typeof value.leagueId !== "string" ||
    typeof value.name !== "string"
  ) {
    return null;
  }

  return {
    leagueId: value.leagueId,
    name: value.name,
    avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
    season: typeof value.season === "string" ? value.season : "",
    format: typeof value.format === "string" ? value.format : "",
    mobileFormat:
      typeof value.mobileFormat === "string" ? value.mobileFormat : "",
    totalRosters:
      typeof value.totalRosters === "number" ? value.totalRosters : 0,
    standingsRank:
      typeof value.standingsRank === "number" ? value.standingsRank : null,
    powerRank: typeof value.powerRank === "number" ? value.powerRank : null,
    rosterPlayers: Array.isArray(value.rosterPlayers)
      ? value.rosterPlayers
          .map(normalizePortfolioLeaguePlayer)
          .filter((player): player is PortfolioLeaguePlayer => Boolean(player))
      : undefined,
    managerAnchors: Array.isArray(value.managerAnchors)
      ? value.managerAnchors
          .map(normalizeLoaderManagerAnchor)
          .filter((anchor): anchor is LoaderManagerAnchor => Boolean(anchor))
      : undefined,
  };
}

function normalizeCachedSleeperUser(
  value: unknown
): CachedSleeperUser | null {
  if (!isRecord(value) || typeof value.username !== "string") return null;
  const username = value.username.trim();
  if (!username) return null;
  const leagues = Array.isArray(value.leagues)
    ? value.leagues
        .map(normalizeLeagueOption)
        .filter((league): league is SleeperLeagueOption => Boolean(league))
    : [];
  const validLeagueIds = new Set(leagues.map(league => league.leagueId));
  const recentLeagueIds = Array.isArray(value.recentLeagueIds)
    ? value.recentLeagueIds
        .filter((leagueId): leagueId is string => typeof leagueId === "string")
        .filter((leagueId, index, list) => list.indexOf(leagueId) === index)
        .filter(leagueId => validLeagueIds.has(leagueId))
        .slice(0, MAX_RECENT_LEAGUES_PER_USER)
    : [];
  const userId =
    typeof value.userId === "string" && value.userId.trim()
      ? value.userId
      : username;
  const displayName =
    typeof value.displayName === "string" && value.displayName.trim()
      ? value.displayName
      : username;
  const hasAdminPermissions =
    value.hasAdminPermissions === true || value.isPrivilegedReportViewer === true;

  return {
    userId,
    username,
    displayName,
    avatarUrl:
      typeof value.avatarUrl === "string" && value.avatarUrl.trim()
        ? value.avatarUrl
        : null,
    hasAdminPermissions,
    isPrivilegedReportViewer: hasAdminPermissions,
    leagues,
    recentLeagueIds,
    savedAt: typeof value.savedAt === "number" ? value.savedAt : 0,
  };
}

function writeCachedSleeperUsers(
  users: CachedSleeperUser[]
): CachedSleeperUser[] {
  const next = users
    .filter(user => user.username)
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_CACHED_SLEEPER_USERS);
  try {
    localStorage.setItem(CACHED_SLEEPER_USERS_KEY, JSON.stringify(next));
  } catch {
    // Recent account shortcuts are a convenience only.
  }
  return next;
}

export function getAnalysisLeaguePreview(
  league: SleeperLeagueOption
): AnalysisLeaguePreview {
  return {
    leagueName: league.name,
    leagueFormat:
      league.format || league.mobileFormat || `${league.totalRosters || "?"}-Team League`,
    leagueLogo: league.avatarUrl,
  };
}

export function getLeagueIdAnalysisPreview(
  leagueId: string
): AnalysisLeaguePreview {
  return {
    leagueName: "Sleeper League",
    leagueFormat: `League ID ${leagueId}`,
    leagueLogo: null,
  };
}

export function findKnownSleeperLeague(
  leagueId: string,
  userLeagues: SleeperLeagueOption[],
  cachedUsers: CachedSleeperUser[],
  extraLeagues: SleeperLeagueOption[] = []
): SleeperLeagueOption | null {
  const normalizedLeagueId = leagueId.trim();
  if (!normalizedLeagueId) return null;

  const leagueGroups = [
    extraLeagues,
    userLeagues,
    ...cachedUsers.map(user => user.leagues),
  ];

  for (const leagues of leagueGroups) {
    const match = leagues.find(league => league.leagueId === normalizedLeagueId);
    if (match) return match;
  }

  return null;
}

export function readCachedSleeperUsers(): CachedSleeperUser[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      localStorage.getItem(CACHED_SLEEPER_USERS_KEY) || "[]"
    );
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeCachedSleeperUser)
      .filter((user): user is CachedSleeperUser => Boolean(user))
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, MAX_CACHED_SLEEPER_USERS);
  } catch {
    localStorage.removeItem(CACHED_SLEEPER_USERS_KEY);
    return [];
  }
}

export function rememberCachedSleeperUser(
  user: CachedSleeperUser
): CachedSleeperUser[] {
  const normalizedUsername = normalizeViewerIdentifier(user.username);
  const normalizedUserId = normalizeViewerIdentifier(user.userId);
  const current = readCachedSleeperUsers();
  const existing = current.find(
    cachedUser =>
      normalizeViewerIdentifier(cachedUser.username) === normalizedUsername ||
      normalizeViewerIdentifier(cachedUser.userId) === normalizedUserId
  );
  const leagueIds = new Set(user.leagues.map(league => league.leagueId));
  const recentLeagueIds = (
    user.recentLeagueIds.length
      ? user.recentLeagueIds
      : existing?.recentLeagueIds || []
  )
    .filter((leagueId, index, list) => list.indexOf(leagueId) === index)
    .filter(leagueId => leagueIds.has(leagueId))
    .slice(0, MAX_RECENT_LEAGUES_PER_USER);
  return writeCachedSleeperUsers([
    { ...user, recentLeagueIds, savedAt: Date.now() },
    ...current.filter(
      cachedUser =>
        normalizeViewerIdentifier(cachedUser.username) !== normalizedUsername &&
        normalizeViewerIdentifier(cachedUser.userId) !== normalizedUserId
    ),
  ]);
}

export function buildCachedSleeperUser(
  username: string,
  user: SleeperUserSession | null | undefined,
  leagues: SleeperLeagueOption[]
): CachedSleeperUser {
  const userId = user?.userId || username;
  const displayName = user?.displayName || user?.username || username;
  const hasAdminPermissions =
    user?.hasAdminPermissions === true ||
    user?.isPrivilegedReportViewer === true;
  return {
    userId,
    username: user?.username || username,
    displayName,
    avatarUrl: user?.avatarUrl || null,
    hasAdminPermissions,
    isPrivilegedReportViewer: hasAdminPermissions,
    leagues,
    recentLeagueIds: [],
    savedAt: Date.now(),
  };
}

export function mergeLeagueRanks(
  leagues: SleeperLeagueOption[],
  ranks: LeagueRankResult[]
): SleeperLeagueOption[] {
  if (!ranks.length) return leagues;
  const rankByLeagueId = new Map(ranks.map(rank => [rank.leagueId, rank]));
  return leagues.map(league => {
    const rank = rankByLeagueId.get(league.leagueId);
    if (!rank) return league;
    return {
      ...league,
      standingsRank: rank.standingsRank,
      powerRank: rank.powerRank,
      rosterPlayers: rank.rosterPlayers || league.rosterPlayers,
      managerAnchors: Array.isArray(rank.managerAnchors)
        ? rank.managerAnchors
        : league.managerAnchors,
    };
  });
}

export function findCachedSleeperUser(
  users: CachedSleeperUser[],
  userId?: string | null,
  username?: string | null
): CachedSleeperUser | null {
  const normalizedUserId = normalizeViewerIdentifier(userId);
  const normalizedUsername = normalizeViewerIdentifier(username);
  return (
    users.find(
      user =>
        (normalizedUserId &&
          normalizeViewerIdentifier(user.userId) === normalizedUserId) ||
        (normalizedUsername &&
          normalizeViewerIdentifier(user.username) === normalizedUsername)
    ) ||
    users[0] ||
    null
  );
}

export function getOrderedLeagueOptions(
  leagues: SleeperLeagueOption[],
  cachedUser: CachedSleeperUser | null
): SleeperLeagueOption[] {
  if (!leagues.length) return [];

  const leagueById = new Map(leagues.map(league => [league.leagueId, league]));
  const seen = new Set<string>();
  const recentLeagues = (cachedUser?.recentLeagueIds || [])
    .map(leagueId => leagueById.get(leagueId))
    .filter((league): league is SleeperLeagueOption => {
      if (!league || seen.has(league.leagueId)) return false;
      seen.add(league.leagueId);
      return true;
    });

  return [
    ...recentLeagues,
    ...leagues.filter(league => !seen.has(league.leagueId)),
  ];
}

export function buildLoadingManagerAnchors(
  reportData: ReportData | null,
  viewerManager?: string | null
): LoaderManagerAnchor[] {
  if (!reportData) return [];

  return getReportManagerNames(reportData, viewerManager).map(manager => ({
    id: manager,
    avatarUrl: reportData.managerAvatars?.[manager] || null,
  }));
}

export function buildPreviewLoadingManagerAnchors(
  count = 12
): LoaderManagerAnchor[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `preview-manager-${index + 1}`,
    avatarUrl: null,
  }));
}

export function rememberCachedSleeperLeagueShortcut({
  users,
  user,
  username,
  leagues,
  leagueId,
}: {
  users: CachedSleeperUser[];
  user: SleeperUserSession | null;
  username: string;
  leagues: SleeperLeagueOption[];
  leagueId: string;
}): CachedSleeperUser[] {
  const normalizedUsername = normalizeViewerIdentifier(user?.username || username);
  const normalizedUserId = normalizeViewerIdentifier(user?.userId || username);
  const leagueIds = new Set(leagues.map(league => league.leagueId));
  if (!normalizedUsername || !leagueIds.has(leagueId)) return users;

  const existing = findCachedSleeperUser(
    users,
    user?.userId || null,
    user?.username || username
  );
  const base = existing || buildCachedSleeperUser(username, user, leagues);
  const nextRecentLeagueIds = [leagueId, ...(base.recentLeagueIds || [])]
    .filter((id, index, list) => list.indexOf(id) === index)
    .filter(id => leagueIds.has(id))
    .slice(0, MAX_RECENT_LEAGUES_PER_USER);
  const nextUser: CachedSleeperUser = {
    ...base,
    userId: user?.userId || base.userId || username,
    username: user?.username || base.username || username,
    displayName: user?.displayName || base.displayName || username,
    avatarUrl: user?.avatarUrl || base.avatarUrl || null,
    hasAdminPermissions:
      user?.hasAdminPermissions === true ||
      user?.isPrivilegedReportViewer === true ||
      base.hasAdminPermissions === true ||
      base.isPrivilegedReportViewer === true,
    isPrivilegedReportViewer:
      user?.hasAdminPermissions === true ||
      user?.isPrivilegedReportViewer === true ||
      base.hasAdminPermissions === true ||
      base.isPrivilegedReportViewer === true,
    leagues,
    recentLeagueIds: nextRecentLeagueIds,
    savedAt: Date.now(),
  };

  return writeCachedSleeperUsers([
    nextUser,
    ...users.filter(
      cachedUser =>
        normalizeViewerIdentifier(cachedUser.username) !== normalizedUsername &&
        normalizeViewerIdentifier(cachedUser.userId) !== normalizedUserId
    ),
  ]);
}

export function cachedSleeperUserToSessionUser(
  user: CachedSleeperUser
): SleeperUserSession {
  return {
    userId: user.userId,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    hasAdminPermissions: user.hasAdminPermissions,
    isPrivilegedReportViewer: user.hasAdminPermissions,
  };
}
