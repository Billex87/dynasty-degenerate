import { lazy, Suspense, useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, ChevronDown, Zap, TrendingUp, BarChart3, Repeat2, ClipboardList, ListOrdered } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { SupportButton } from '@/components/SupportButton';
import { FeedbackButton } from '@/components/FeedbackButton';
import { ManagerChampionshipProvider } from '@/components/ManagerChampionships';
import { ReportSectionHeader } from '@/components/reportPrimitives';
import { PRIVILEGED_REPORT_VIEWERS, UNAUTHED_ERR_MSG } from '@shared/const';
import type { ReportData } from '@shared/types';

const DraftAnalysis = lazy(() => import('@/components/DraftAnalysis').then((module) => ({ default: module.DraftAnalysis })));
const RankingsBoard = lazy(() => import('@/components/RankingsBoard').then((module) => ({ default: module.RankingsBoard })));
const WeeklyMomentumTable = lazy(() => import('@/components/ReportTables').then((module) => ({ default: module.WeeklyMomentumTable })));
const TradeWarRoom = lazy(() => import('@/components/ReportTables').then((module) => ({ default: module.TradeWarRoom })));
const TradeProfitLeaderboardTable = lazy(() => import('@/components/ReportTables').then((module) => ({ default: module.TradeProfitLeaderboardTable })));
const TradeHistoryTable = lazy(() => import('@/components/ReportTables').then((module) => ({ default: module.TradeHistoryTable })));
const ManagerPositionCountsTable = lazy(() => import('@/components/ReportTables').then((module) => ({ default: module.ManagerPositionCountsTable })));
const OwnerIntelMatrix = lazy(() => import('@/components/ReportTables').then((module) => ({ default: module.OwnerIntelMatrix })));
const LeagueCommandCenter = lazy(() => import('@/components/ReportTables').then((module) => ({ default: module.LeagueCommandCenter })));
const TradeMarketRadar = lazy(() => import('@/components/ReportTables').then((module) => ({ default: module.TradeMarketRadar })));
const TradeTheftDetector = lazy(() => import('@/components/ReportTables').then((module) => ({ default: module.TradeTheftDetector })));
const TrendingPlayersTable = lazy(() => import('@/components/ReportTables').then((module) => ({ default: module.TrendingPlayersTable })));
const WaiverIntelligencePanel = lazy(() => import('@/components/ReportTables').then((module) => ({ default: module.WaiverIntelligencePanel })));
const RecentTransactionsPanel = lazy(() => import('@/components/ReportTables').then((module) => ({ default: module.RecentTransactionsPanel })));

const DYNASTY_LOGO_SRC = '/assets/dynasty-logo-cropped.png?v=20260428-cyan-lines';
const REPORT_CACHE_DATA_VERSION = 'draftbuzz-history-v1';
const REPORT_CACHE_KEY = 'dynasty-degenerates:last-report:v18';
const STALE_REPORT_CACHE_KEYS = [
  'dynasty-degenerates:last-report:v10',
  'dynasty-degenerates:last-report:v11',
  'dynasty-degenerates:last-report:v12',
  'dynasty-degenerates:last-report:v13',
  'dynasty-degenerates:last-report:v14',
  'dynasty-degenerates:last-report:v15',
  'dynasty-degenerates:last-report:v16',
  'dynasty-degenerates:last-report:v17',
];
const LAST_LEAGUE_KEY = 'dynasty-degenerates:last-league:v1';
const SLEEPER_SESSION_KEY = 'dynasty-degenerates:sleeper-session:v1';
const LEAGUE_ID_HISTORY_KEY = 'dynasty-degenerates:league-id-history:v1';
const SLEEPER_USERNAME_HISTORY_KEY = 'dynasty-degenerates:sleeper-username-history:v1';
const CACHED_SLEEPER_USERS_KEY = 'dynasty-degenerates:sleeper-user-history:v1';
const MAX_AUTOCOMPLETE_HISTORY = 12;
const MAX_CACHED_SLEEPER_USERS = 5;
const MAX_RECENT_LEAGUES_PER_USER = 3;
const ADMIN_VALUE_DIAGNOSTIC_START_DATE = '2026-05-05';
const CLOWN_EASTER_EGG_USERNAMES = new Set(['armchairgmzar', 'tjsmoov']);
const PRIVILEGED_REPORT_VIEWER_SET = new Set<string>(PRIVILEGED_REPORT_VIEWERS);
const REPORT_SUCCESS_REVEAL_DELAY_MS = 1150;
const REPORT_SUCCESS_READ_AFTER_REVEAL_MS = 1850;
const REPORT_SUCCESS_KICK_MS = 900;

type LoadingTransitionPhase = 'loading' | 'success' | 'reveal' | 'kick' | 'done';

function getKtcAdminIdentity(user?: SleeperUserSession | null, fallbackUsername?: string): string | null {
  return user?.username || user?.displayName || fallbackUsername || null;
}

function normalizeViewerIdentifier(value?: string | null): string {
  return value?.trim().toLowerCase() || '';
}

function isPrivilegedReportViewer(...identifiers: Array<string | null | undefined>): boolean {
  return identifiers
    .map(normalizeViewerIdentifier)
    .some((value) => value && PRIVILEGED_REPORT_VIEWER_SET.has(value));
}

function showMutationErrorToast(error: { message: string }) {
  if (error.message === UNAUTHED_ERR_MSG) return;
  toast.error(`Error: ${error.message}`);
}

function ReportSectionLoadingFallback() {
  return (
    <div className="rankings-empty-state" role="status" aria-live="polite">
      Loading report section...
    </div>
  );
}

function ProspectArchiveLoadingState() {
  return (
    <div className="prospect-archive-loading" role="status" aria-live="polite">
      <div className="prospect-archive-loading__logo" aria-hidden="true">
        <img src="/assets/ncaa-logo.svg" alt="" />
      </div>
      <div className="prospect-archive-loading__copy">
        <span>Scouting Data Archive</span>
        <strong>Getting college prospects</strong>
        <p>Loading Draft Buzz scores, class filters, position ranks, and verified combine measurables.</p>
      </div>
      <div className="prospect-archive-loading__badges" aria-hidden="true">
        <span>NCAA</span>
        <span>Draft Buzz</span>
        <span>Prospect Scores</span>
      </div>
    </div>
  );
}

function normalizeAdminViewMode(value: unknown): AdminViewMode | null {
  return value === 'admin' || value === 'regular' ? value : null;
}

type SleeperLeagueOption = {
  leagueId: string;
  name: string;
  avatarUrl: string | null;
  season: string;
  format: string;
  mobileFormat: string;
  totalRosters: number;
  standingsRank: number | null;
  powerRank: number | null;
};

type LeagueRankResult = Pick<SleeperLeagueOption, 'leagueId' | 'standingsRank' | 'powerRank'>;

type AnalysisLeaguePreview = {
  leagueName: string;
  leagueFormat: string;
  leagueLogo: string | null;
};

type SleeperUserSession = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type AdminViewMode = 'admin' | 'regular';

type CachedReport = {
  cacheVersion?: string;
  leagueId: string;
  leagueName: string;
  leagueLogo: string | null;
  leagueFormat: string;
  activeTab: string;
  reportData: ReportData;
  savedAt: number;
};

type LastLeague = Omit<CachedReport, 'reportData'>;

type SleeperSession = {
  username: string;
  user?: SleeperUserSession | null;
  leagues: SleeperLeagueOption[];
  adminViewMode?: AdminViewMode | null;
  savedAt: number;
};

type CachedSleeperUser = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  leagues: SleeperLeagueOption[];
  recentLeagueIds: string[];
  savedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeLeagueOption(value: unknown): SleeperLeagueOption | null {
  if (!isRecord(value) || typeof value.leagueId !== 'string' || typeof value.name !== 'string') {
    return null;
  }

  return {
    leagueId: value.leagueId,
    name: value.name,
    avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : null,
    season: typeof value.season === 'string' ? value.season : '',
    format: typeof value.format === 'string' ? value.format : '',
    mobileFormat: typeof value.mobileFormat === 'string' ? value.mobileFormat : '',
    totalRosters: typeof value.totalRosters === 'number' ? value.totalRosters : 0,
    standingsRank: typeof value.standingsRank === 'number' ? value.standingsRank : null,
    powerRank: typeof value.powerRank === 'number' ? value.powerRank : null,
  };
}

function normalizeCachedSleeperUser(value: unknown): CachedSleeperUser | null {
  if (!isRecord(value) || typeof value.username !== 'string') return null;
  const username = value.username.trim();
  if (!username) return null;
  const leagues = Array.isArray(value.leagues)
    ? value.leagues.map(normalizeLeagueOption).filter((league): league is SleeperLeagueOption => Boolean(league))
    : [];
  const validLeagueIds = new Set(leagues.map((league) => league.leagueId));
  const recentLeagueIds = Array.isArray(value.recentLeagueIds)
    ? value.recentLeagueIds
      .filter((leagueId): leagueId is string => typeof leagueId === 'string')
      .filter((leagueId, index, list) => list.indexOf(leagueId) === index)
      .filter((leagueId) => validLeagueIds.has(leagueId))
      .slice(0, MAX_RECENT_LEAGUES_PER_USER)
    : [];

  return {
    userId: typeof value.userId === 'string' && value.userId.trim() ? value.userId : username,
    username,
    displayName: typeof value.displayName === 'string' && value.displayName.trim() ? value.displayName : username,
    avatarUrl: typeof value.avatarUrl === 'string' && value.avatarUrl.trim() ? value.avatarUrl : null,
    leagues,
    recentLeagueIds,
    savedAt: typeof value.savedAt === 'number' ? value.savedAt : 0,
  };
}

function readCachedSleeperUsers(): CachedSleeperUser[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHED_SLEEPER_USERS_KEY) || '[]');
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

function writeCachedSleeperUsers(users: CachedSleeperUser[]): CachedSleeperUser[] {
  const next = users
    .filter((user) => user.username)
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_CACHED_SLEEPER_USERS);
  try {
    localStorage.setItem(CACHED_SLEEPER_USERS_KEY, JSON.stringify(next));
  } catch {
    // Recent account shortcuts are a convenience only.
  }
  return next;
}

function rememberCachedSleeperUser(user: CachedSleeperUser): CachedSleeperUser[] {
  const normalizedUsername = normalizeViewerIdentifier(user.username);
  const normalizedUserId = normalizeViewerIdentifier(user.userId);
  const current = readCachedSleeperUsers();
  const existing = current.find((cachedUser) => (
    normalizeViewerIdentifier(cachedUser.username) === normalizedUsername
    || normalizeViewerIdentifier(cachedUser.userId) === normalizedUserId
  ));
  const leagueIds = new Set(user.leagues.map((league) => league.leagueId));
  const recentLeagueIds = (user.recentLeagueIds.length ? user.recentLeagueIds : existing?.recentLeagueIds || [])
    .filter((leagueId, index, list) => list.indexOf(leagueId) === index)
    .filter((leagueId) => leagueIds.has(leagueId))
    .slice(0, MAX_RECENT_LEAGUES_PER_USER);
  return writeCachedSleeperUsers([
    { ...user, recentLeagueIds, savedAt: Date.now() },
    ...current.filter((cachedUser) => (
      normalizeViewerIdentifier(cachedUser.username) !== normalizedUsername
      && normalizeViewerIdentifier(cachedUser.userId) !== normalizedUserId
    )),
  ]);
}

function buildCachedSleeperUser(
  username: string,
  user: SleeperUserSession | null | undefined,
  leagues: SleeperLeagueOption[]
): CachedSleeperUser {
  return {
    userId: user?.userId || username,
    username: user?.username || username,
    displayName: user?.displayName || user?.username || username,
    avatarUrl: user?.avatarUrl || null,
    leagues,
    recentLeagueIds: [],
    savedAt: Date.now(),
  };
}

function mergeLeagueRanks(leagues: SleeperLeagueOption[], ranks: LeagueRankResult[]): SleeperLeagueOption[] {
  if (!ranks.length) return leagues;
  const rankByLeagueId = new Map(ranks.map((rank) => [rank.leagueId, rank]));
  return leagues.map((league) => {
    const rank = rankByLeagueId.get(league.leagueId);
    if (!rank) return league;
    return {
      ...league,
      standingsRank: rank.standingsRank,
      powerRank: rank.powerRank,
    };
  });
}

function findCachedSleeperUser(
  users: CachedSleeperUser[],
  userId?: string | null,
  username?: string | null
): CachedSleeperUser | null {
  const normalizedUserId = normalizeViewerIdentifier(userId);
  const normalizedUsername = normalizeViewerIdentifier(username);
  return users.find((user) => (
    (normalizedUserId && normalizeViewerIdentifier(user.userId) === normalizedUserId)
    || (normalizedUsername && normalizeViewerIdentifier(user.username) === normalizedUsername)
  )) || users[0] || null;
}

function getLeagueFallbackInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || 'DD';
}

function getLeagueShortcutsForUser(
  cachedUser: CachedSleeperUser | null,
  userLeagues: SleeperLeagueOption[],
  activeLeagueId?: string | null
): SleeperLeagueOption[] {
  const leagues = cachedUser?.leagues.length ? cachedUser.leagues : userLeagues;
  if (!leagues.length) return [];

  const leagueById = new Map(leagues.map((league) => [league.leagueId, league]));
  const orderedIds = cachedUser?.recentLeagueIds || [];
  const seen = new Set<string>();
  return orderedIds
    .filter((leagueId) => leagueId !== activeLeagueId)
    .filter((leagueId) => {
      if (seen.has(leagueId)) return false;
      seen.add(leagueId);
      return leagueById.has(leagueId);
    })
    .map((leagueId) => leagueById.get(leagueId))
    .filter((league): league is SleeperLeagueOption => Boolean(league))
    .slice(0, MAX_RECENT_LEAGUES_PER_USER);
}

function getOrderedLeagueOptions(
  leagues: SleeperLeagueOption[],
  cachedUser: CachedSleeperUser | null
): SleeperLeagueOption[] {
  if (!leagues.length) return [];

  const leagueById = new Map(leagues.map((league) => [league.leagueId, league]));
  const seen = new Set<string>();
  const recentLeagues = (cachedUser?.recentLeagueIds || [])
    .map((leagueId) => leagueById.get(leagueId))
    .filter((league): league is SleeperLeagueOption => {
      if (!league || seen.has(league.leagueId)) return false;
      seen.add(league.leagueId);
      return true;
    });

  return [
    ...recentLeagues,
    ...leagues.filter((league) => !seen.has(league.leagueId)),
  ];
}

function rememberCachedSleeperLeagueShortcut({
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
  const leagueIds = new Set(leagues.map((league) => league.leagueId));
  if (!normalizedUsername || !leagueIds.has(leagueId)) return users;

  const existing = findCachedSleeperUser(users, user?.userId || null, user?.username || username);
  const base = existing || buildCachedSleeperUser(username, user, leagues);
  const nextRecentLeagueIds = [leagueId, ...(base.recentLeagueIds || [])]
    .filter((id, index, list) => list.indexOf(id) === index)
    .filter((id) => leagueIds.has(id))
    .slice(0, MAX_RECENT_LEAGUES_PER_USER);
  const nextUser: CachedSleeperUser = {
    ...base,
    userId: user?.userId || base.userId || username,
    username: user?.username || base.username || username,
    displayName: user?.displayName || base.displayName || username,
    avatarUrl: user?.avatarUrl || base.avatarUrl || null,
    leagues,
    recentLeagueIds: nextRecentLeagueIds,
    savedAt: Date.now(),
  };

  return writeCachedSleeperUsers([
    nextUser,
    ...users.filter((cachedUser) => (
      normalizeViewerIdentifier(cachedUser.username) !== normalizedUsername
      && normalizeViewerIdentifier(cachedUser.userId) !== normalizedUserId
    )),
  ]);
}

function cachedSleeperUserToSessionUser(user: CachedSleeperUser): SleeperUserSession {
  return {
    userId: user.userId,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

function readAutocompleteHistory(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, MAX_AUTOCOMPLETE_HISTORY);
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function rememberAutocompleteValue(key: string, value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return readAutocompleteHistory(key);
  const current = readAutocompleteHistory(key);
  const next = [trimmed, ...current.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())]
    .slice(0, MAX_AUTOCOMPLETE_HISTORY);
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Autocomplete history is a convenience only.
  }
  return next;
}

function getFilteredAutocompleteOptions(history: string[], value: string): string[] {
  const needle = value.trim().toLowerCase();
  return history
    .filter((item) => !needle || item.toLowerCase().includes(needle))
    .slice(0, 6);
}

function getLoadingSuccessTitleClassName(leagueName: string): string {
  const length = leagueName.trim().length;
  if (length >= 34) return 'loading-success-title loading-success-title-compact';
  if (length >= 20) return 'loading-success-title loading-success-title-long';
  return 'loading-success-title';
}

function HomeActionRow() {
  return (
    <div className="home-action-row">
      <SupportButton className="home-action-button" />
      <FeedbackButton className="home-action-button" />
    </div>
  );
}

function HomeLogoChrome() {
  return (
    <div className="home-header-inner max-w-7xl mx-auto">
      <div className="home-header-logo-wrap">
        <img
          src={DYNASTY_LOGO_SRC}
          alt="Dynasty Degenerates Logo"
          className="home-header-logo"
        />
      </div>
      <p className="home-header-slogan">
        Just some degens with scraping tools and A.I.
      </p>
    </div>
  );
}

function HomeCachedUserSwitcher({
  users,
  activeUsername,
  onSelect,
}: {
  users: CachedSleeperUser[];
  activeUsername: string;
  onSelect: (user: CachedSleeperUser) => void;
}) {
  if (!users.length) return null;

  const visibleUsers = users.slice(0, MAX_CACHED_SLEEPER_USERS).reverse();
  const activeIdentifier = normalizeViewerIdentifier(activeUsername);

  return (
    <div className="home-user-switcher" aria-label="Recent Sleeper accounts">
      <span className="home-user-switcher-label">Recent</span>
      <div className="home-user-stack">
        {visibleUsers.map((user, index) => {
          const label = user.displayName || user.username;
          const initials = label.slice(0, 2).toUpperCase();
          const isActive = activeIdentifier && normalizeViewerIdentifier(user.username) === activeIdentifier;
          return (
            <button
              key={`${user.userId}-${user.username}`}
              type="button"
              className={`home-user-button${isActive ? ' is-active' : ''}`}
              onClick={() => onSelect(user)}
              style={{ zIndex: index + 1 }}
              title={`Use ${label}`}
              aria-label={`Use ${label}`}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" aria-hidden="true" />
              ) : (
                <span>{initials}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LeagueShortcutStack({
  leagues,
  activeLeagueId,
  onSelect,
  className,
  label = 'Leagues',
}: {
  leagues: SleeperLeagueOption[];
  activeLeagueId?: string | null;
  onSelect: (leagueId: string) => void;
  className?: string;
  label?: string;
}) {
  if (!leagues.length) return null;

  const visibleLeagues = leagues.slice(0, MAX_RECENT_LEAGUES_PER_USER);

  return (
    <div className={`league-shortcut-switcher${className ? ` ${className}` : ''}`} aria-label="Previous league shortcuts">
      <span className="league-shortcut-label">{label}</span>
      <div className="league-shortcut-stack">
        {visibleLeagues.map((league, index) => {
          const isActive = league.leagueId === activeLeagueId;
          return (
            <button
              key={league.leagueId}
              type="button"
              className={`league-shortcut-button${isActive ? ' is-active' : ''}`}
              onClick={() => {
                if (!isActive) onSelect(league.leagueId);
              }}
              style={{ zIndex: visibleLeagues.length - index }}
              title={isActive ? `${league.name} is open` : `Open ${league.name}`}
              aria-label={isActive ? `${league.name} is open` : `Open ${league.name}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {league.avatarUrl ? (
                <img src={league.avatarUrl} alt="" aria-hidden="true" />
              ) : (
                <span>{getLeagueFallbackInitials(league.name)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HomeHeaderShortcuts({
  leagues,
  users,
  activeUsername,
  onLeagueSelect,
  onUserSelect,
}: {
  leagues: SleeperLeagueOption[];
  users: CachedSleeperUser[];
  activeUsername: string;
  onLeagueSelect: (leagueId: string) => void;
  onUserSelect: (user: CachedSleeperUser) => void;
}) {
  if (leagues.length) {
    return (
      <LeagueShortcutStack
        leagues={leagues}
        onSelect={onLeagueSelect}
        className="home-user-switcher home-league-shortcuts"
        label="Previous Leagues"
      />
    );
  }

  return (
    <HomeCachedUserSwitcher
      users={users}
      activeUsername={activeUsername}
      onSelect={onUserSelect}
    />
  );
}

function HomeBrandLockup() {
  return (
    <div className="home-footer-brand">
      <h1 className="home-header-title athletic-title mb-2">
        Dynasty<br />Degenerates
      </h1>
      <p className="home-header-tagline">
        For Degens, By Degens
      </p>
    </div>
  );
}

function HomeFooterChrome({ showBrand = true }: { showBrand?: boolean }) {
  return (
    <div className="home-footer-inner max-w-7xl mx-auto">
      <HomeActionRow />
      {showBrand && <HomeBrandLockup />}
    </div>
  );
}

function RecentEntrySuggestions({
  label,
  options,
  onSelect,
}: {
  label: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  if (!options.length) return null;

  return (
    <div className="home-autocomplete-panel" role="listbox" aria-label={label}>
      <span>Recent</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="option"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function getLeagueCardNameClassName(name: string): string {
  const length = name.trim().length;
  if (length >= 30) return 'home-league-card-name home-league-card-name-xxlong';
  if (length >= 23) return 'home-league-card-name home-league-card-name-xlong';
  if (length >= 17) return 'home-league-card-name home-league-card-name-long';
  return 'home-league-card-name';
}

function getLeagueCardFormatClassName(format: string): string {
  const length = format.trim().length;
  if (length >= 31) return 'home-league-card-format home-league-card-format-xlong';
  if (length >= 24) return 'home-league-card-format home-league-card-format-long';
  return 'home-league-card-format';
}

function LeaguePickerCard({
  league,
  onSelect,
}: {
  league: SleeperLeagueOption;
  onSelect: (leagueId: string) => void;
}) {
  const desktopFormat = league.format || `${league.totalRosters || '?'}-Team Dynasty`;
  const mobileFormat = league.mobileFormat || desktopFormat;

  return (
    <button
      type="button"
      className="home-league-card"
      onClick={() => onSelect(league.leagueId)}
    >
      {league.avatarUrl ? (
        <img src={league.avatarUrl} alt="" aria-hidden="true" className="home-league-card-watermark" />
      ) : null}
      <div className="home-league-card-top">
        <span className="home-league-card-icon-wrap">
          {league.avatarUrl ? (
            <img src={league.avatarUrl} alt={`${league.name} icon`} className="home-league-card-icon" />
          ) : (
            <span className="home-league-card-icon home-league-card-fallback">
              {league.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>
        <span className="home-league-card-body">
          <span
            className={getLeagueCardNameClassName(league.name)}
            aria-label={league.name}
            title={league.name}
          >
            {league.name}
          </span>
        </span>
      </div>
      <span className={`${getLeagueCardFormatClassName(desktopFormat)} home-league-card-format-desktop`} title={desktopFormat}>
        {desktopFormat}
      </span>
      <span className={`${getLeagueCardFormatClassName(mobileFormat)} home-league-card-format-mobile`} title={mobileFormat}>
        {mobileFormat}
      </span>
      <span className="home-league-card-ranks" aria-label={`${league.name} current league standing and power rank`}>
        {league.powerRank ? (
          <span className="home-league-pill home-league-pill-power">Power #{league.powerRank}</span>
        ) : null}
        {league.standingsRank ? (
          <span className="home-league-pill home-league-pill-standings">Standings #{league.standingsRank}</span>
        ) : null}
      </span>
    </button>
  );
}

type AdminValueDiagnosticRow = {
  id: string;
  area: string;
  item: string;
  status: string;
  note: string;
  tone?: 'good' | 'warn' | 'danger' | 'info';
};

type AdminBlendSummary = {
  id: string;
  title: string;
  profileLabel: string;
  note: string;
  sources: Array<{
    key: string;
    source: string;
    percent: number;
    note?: string;
  }>;
};

type OutlookPlayer = ReportData['projectedRisers'][number];

function getValueCoverageStatus(note: string): Pick<AdminValueDiagnosticRow, 'status' | 'tone'> {
  if (/benchmark/i.test(note)) {
    return { status: 'Benchmark stored', tone: 'info' };
  }
  if (/exact custom|closest|bucket/i.test(note)) {
    return { status: 'Bucketed', tone: 'info' };
  }
  if (/support is wired|no .*present/i.test(note)) {
    return { status: 'Awaiting data', tone: 'warn' };
  }
  return { status: 'Tracked', tone: 'good' };
}

function isActionableDiagnosticTone(tone?: AdminValueDiagnosticRow['tone']): boolean {
  return tone === 'warn' || tone === 'danger';
}

function getValueCoverageItem(note: string, index: number): string {
  if (/Selected value profile/i.test(note)) return 'Selected profile';
  if (/Daily snapshots/i.test(note)) return 'Daily storage';
  if (/Flock Fantasy|Dynasty Nerds|Redraft/i.test(note)) return 'Source weighting';
  if (/TE premium|TEP/i.test(note)) return 'TE premium bucket';
  if (/Standard|Half|PPR/i.test(note)) return 'PPR bucket';
  if (/coverage/i.test(note)) return 'Source coverage';
  if (/benchmark/i.test(note)) return 'Benchmark source';
  return `Coverage note ${index + 1}`;
}

function getOutlookPlayerValueProfile(reportData: ReportData, player: OutlookPlayer) {
  return player.playerDetails?.valueProfile
    || (player.player_id ? reportData.playerDetailsById?.[player.player_id]?.valueProfile : undefined);
}

function addUniqueDiagnosticRow(
  rows: AdminValueDiagnosticRow[],
  seen: Set<string>,
  row: AdminValueDiagnosticRow
) {
  if (seen.has(row.id)) return;
  seen.add(row.id);
  rows.push(row);
}

function buildAdminValueDiagnostics(reportData: ReportData, missingDateKeys: string[]): AdminValueDiagnosticRow[] {
  const rows: AdminValueDiagnosticRow[] = [];
  const seen = new Set<string>();
  const currentSnapshotGaps = missingDateKeys
    .filter((dateKey) => dateKey >= ADMIN_VALUE_DIAGNOSTIC_START_DATE)
    .sort();
  const outlookPlayers = [...reportData.projectedRisers, ...reportData.projectedFallers];
  const leagueDiagnostics = reportData.leagueDiagnostics;

  if (leagueDiagnostics) {
    leagueDiagnostics.valueLimitations.forEach((limitation, index) => {
      const coverageStatus = getValueCoverageStatus(limitation);
      if (!isActionableDiagnosticTone(coverageStatus.tone)) return;
      addUniqueDiagnosticRow(rows, seen, {
        id: `value-limitation-${index}`,
        area: 'Value coverage',
        item: getValueCoverageItem(limitation, index),
        status: coverageStatus.status,
        tone: coverageStatus.tone,
        note: limitation,
      });
    });
  }

  if (reportData.prospectSourceDiagnostics) {
    const diagnostic = reportData.prospectSourceDiagnostics;
    const tone = diagnostic.status === 'stored' ? 'good' : diagnostic.status === 'partial' ? 'warn' : 'warn';
    if (isActionableDiagnosticTone(tone)) {
      const errorNote = diagnostic.status === 'partial' && diagnostic.errors?.length
        ? ` ${diagnostic.errors.length} scrape gap${diagnostic.errors.length === 1 ? '' : 's'} remain. First: ${diagnostic.errors[0]}.`
        : '';
      addUniqueDiagnosticRow(rows, seen, {
        id: 'prospect-context-source',
        area: 'Prospect context',
        item: `${diagnostic.playerCount} profiles`,
        status: diagnostic.status === 'partial' ? 'Stored with gaps' : 'Snapshot pending',
        tone,
        note: `${diagnostic.note}${errorNote}`,
      });
    }
  }

  currentSnapshotGaps.forEach((dateKey) => {
    addUniqueDiagnosticRow(rows, seen, {
      id: `snapshot-${dateKey}`,
      area: 'Value blend',
      item: dateKey,
      status: 'Missing day',
      tone: 'warn',
      note: `Daily blend was not stored after the ${ADMIN_VALUE_DIAGNOSTIC_START_DATE} blend cutoff, so any comparison touching this date uses the nearest available stored profile.`,
    });
  });

  const playersWithoutSourceMetadata = outlookPlayers
    .filter((player) => player.player_id && !getOutlookPlayerValueProfile(reportData, player));
  if (playersWithoutSourceMetadata.length) {
    addUniqueDiagnosticRow(rows, seen, {
      id: 'source-metadata-missing',
      area: 'Player values',
      item: `${playersWithoutSourceMetadata.length} report players`,
      status: 'Source check unavailable',
      tone: 'warn',
      note: 'The displayed player values exist, but this report payload did not include source-level blend detail.',
    });
  }

  const rankingIdentityDiagnostics = reportData.rankings?.identityDiagnostics || [];
  const unmatchedRankingRows = rankingIdentityDiagnostics.filter((row) => row.status === 'unmatched' && row.board !== 'devy');

  if (unmatchedRankingRows.length) {
    addUniqueDiagnosticRow(rows, seen, {
      id: 'ranking-identity-unmatched',
      area: 'Ranking identities',
      item: `${unmatchedRankingRows.length} source row${unmatchedRankingRows.length === 1 ? '' : 's'}`,
      status: 'Needs mapping',
      tone: 'danger',
      note: `Ranking rows did not match a Sleeper player. First example: ${unmatchedRankingRows[0].playerName}. These rows may show the wrong owner/avatar until mapped.`,
    });
  }

  outlookPlayers.forEach((player) => {
    const profile = getOutlookPlayerValueProfile(reportData, player);
    if (!profile) return;

    const sources = profile.sources || [];
    const hasCoreMarketSource = Boolean(profile.flockFantasy || profile.dynastyNerds || profile.marketKtc || profile.fantasyCalcDynasty || profile.dynastyProcess);
    if (hasCoreMarketSource) return;

    addUniqueDiagnosticRow(rows, seen, {
      id: `thin-value-${player.player_id || player.name}`,
      area: 'Player value',
      item: player.name,
      status: sources.length ? 'Non-primary source' : 'No source list',
      tone: 'warn',
      note: `${sources.length || 0} source${sources.length === 1 ? '' : 's'} found, but none are one of the primary dynasty blend sources. The card can render, but admin should verify the player mapping/value source.`,
    });
  });

  const missingAgePlayers = outlookPlayers.filter((player) => player.age == null);
  if (missingAgePlayers.length) {
    addUniqueDiagnosticRow(rows, seen, {
      id: 'missing-age-value-input',
      area: 'Value input',
      item: `${missingAgePlayers.length} report players`,
      status: 'Age missing',
      tone: 'warn',
      note: 'Age-aware value context falls back to the current value when the age curve cannot be applied.',
    });
  }

  if (!rows.length) {
    rows.push({
      id: 'no-active-diagnostics',
      area: 'Value assumptions',
      item: 'Current report',
      status: 'No active flags',
      tone: 'good',
      note: 'No missing post-cutoff snapshot days or unmapped primary-value players were detected. League-format notes still show what is calculated versus bucketed.',
    });
  }

  return rows.slice(0, 32);
}

function getAdminBlendProfileLabel(reportData: ReportData, profileKey?: string | null): string {
  if (!profileKey) return 'League-matched profile';
  const profileOption = reportData.rankings?.profileOptions?.find((option) => option.key === profileKey);
  return profileOption?.label || 'League-matched profile';
}

function formatScoutingArchiveCopy(value?: string | null): string {
  return String(value || '')
    .replace(/NFL Draft Buzz/g, 'archived scouting data')
    .replace(/Draft Buzz/g, 'scouting archive');
}

function buildAdminBlendSummaries(reportData: ReportData): AdminBlendSummary[] {
  const rankings = reportData.rankings;
  const sourceWeightProfiles = rankings?.sourceWeightProfiles;
  if (!rankings || !sourceWeightProfiles) return [];

  const summaries: AdminBlendSummary[] = [];
  const dynastyProfileKey = rankings.defaultProfileKey;
  const devyProfileKey = rankings.defaultDevyProfileKey;

  if (dynastyProfileKey && sourceWeightProfiles[dynastyProfileKey]) {
    summaries.push({
      id: 'current-league-dynasty-blend',
      title: 'Current League Dynasty Blend',
      profileLabel: getAdminBlendProfileLabel(reportData, dynastyProfileKey),
      note: 'Primary dynasty market blend for rankings, roster values, trades, and non-lineup dynasty reads in this league.',
      sources: sourceWeightProfiles[dynastyProfileKey].sources
        .filter((source) => source.percent > 0)
        .map((source) => ({
          key: source.key,
          source: formatScoutingArchiveCopy(source.source),
          percent: source.percent,
          note: formatScoutingArchiveCopy(source.note),
        })),
    });
  }

  if (devyProfileKey && sourceWeightProfiles[devyProfileKey]) {
    summaries.push({
      id: 'current-league-college-blend',
      title: 'College Prospect Blend',
      profileLabel: getAdminBlendProfileLabel(reportData, devyProfileKey),
      note: 'Prospect-board blend for college/devy assets. Prospect traits are context only and do not directly change dynasty market values.',
      sources: sourceWeightProfiles[devyProfileKey].sources
        .filter((source) => source.percent > 0)
        .map((source) => ({
          key: source.key,
          source: formatScoutingArchiveCopy(source.source),
          percent: source.percent,
          note: formatScoutingArchiveCopy(source.note),
        })),
    });
  }

  return summaries;
}

function getActionableMissingSnapshotDates(data?: {
  missingDateKeys?: string[];
  todayDateKey?: string | null;
}): string[] {
  if (!data?.missingDateKeys?.length || !data.todayDateKey) return [];
  return data.missingDateKeys.filter((dateKey) => dateKey === data.todayDateKey);
}

function AdminValueDiagnosticsTable({ reportData }: { reportData: ReportData }) {
  const { data } = trpc.system.snapshotCoverage.useQuery(
    { lookbackDays: 14 },
    { refetchOnWindowFocus: false, staleTime: 1000 * 60 * 5 }
  );

  const rows = buildAdminValueDiagnostics(reportData, getActionableMissingSnapshotDates(data));
  const blendSummaries = buildAdminBlendSummaries(reportData);

  return (
    <div className="admin-value-diagnostics">
      <p className="admin-value-diagnostics-intro">
        Admin eyes only. This shows what is calculated from Sleeper league settings, what is covered by stored market values, and only the gaps that still need attention.
      </p>
      {blendSummaries.length > 0 && (
        <div className="admin-blend-summary-grid">
          {blendSummaries.map((summary) => (
            <article key={summary.id} className="admin-blend-summary-card">
              <div className="admin-blend-summary-top">
                <span>{summary.title}</span>
                <strong>{summary.profileLabel}</strong>
              </div>
              <div className="admin-blend-source-list" aria-label={`${summary.title} source weights`}>
                {summary.sources.map((source) => (
                  <span key={source.key} className="admin-blend-source-pill" title={source.note}>
                    <strong>{source.source}</strong>
                    <em>{source.percent}%</em>
                  </span>
                ))}
              </div>
              <p>{summary.note}</p>
            </article>
          ))}
          <article className="admin-blend-summary-card admin-blend-summary-card-note">
            <div className="admin-blend-summary-top">
              <span>Important Blend Detail</span>
              <strong>Weights normalize when sources are missing</strong>
            </div>
            <p>
              If a player is missing one of the sources above, the available weights normalize across only the sources present. Players only get flagged below when no primary blend source is attached.
              Season and projection data is only for lineup and redraft-style reads, not dynasty market value.
            </p>
            {reportData.leagueDiagnostics && (
              <p>
                Current league context: {reportData.leagueDiagnostics.teamCount}-team {reportData.leagueDiagnostics.scoringSummary}. Starter math uses {reportData.leagueDiagnostics.lineupSlotSummary}.
              </p>
            )}
          </article>
        </div>
      )}
      <div className="admin-value-diagnostics-grid">
        {rows.map((row) => (
          <article key={row.id} className={`admin-value-diagnostics-card admin-value-diagnostics-card-${row.tone || 'info'}`}>
            <div className="admin-value-diagnostics-card-top">
              <div>
                <span>{row.area}</span>
                <strong>{row.item}</strong>
              </div>
              <span className="admin-value-diagnostics-flag">{row.status}</span>
            </div>
            <p>{row.note}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function formatAdminTelemetryDate(value?: string | null): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function AdminAbuseTelemetryPanel() {
  const { data, error, isLoading, isFetching, refetch } = trpc.system.abuseTelemetry.useQuery(
    { lookbackDays: 7 },
    {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60,
    }
  );

  if (isLoading) {
    return <div className="rankings-empty-state">Loading traffic telemetry...</div>;
  }

  if (error) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>Admin traffic telemetry is unavailable for this session.</p>
        <span>{error.message}</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rankings-empty-state">No traffic telemetry available.</div>;
  }

  const totalCards = [
    { label: 'Events', value: data.totals.events },
    { label: 'Generated Reports', value: data.totals.generatedReports },
    { label: 'Cached Reports', value: data.totals.cachedReports },
    { label: 'Rate Limits', value: data.totals.rateLimitEvents },
    { label: 'Unique IPs', value: data.totals.uniqueIps },
    { label: 'Unique Leagues', value: data.totals.uniqueLeagueIds },
  ];

  return (
    <div className="admin-traffic-panel">
      <div className="admin-traffic-header">
        <div>
          <span>Last {data.lookbackDays} days</span>
          <strong>Generated {formatAdminTelemetryDate(data.generatedAt)}</strong>
        </div>
        <Button
          type="button"
          variant="outline"
          className="admin-traffic-refresh"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Refresh
        </Button>
      </div>

      <div className="admin-traffic-stat-grid">
        {totalCards.map((card) => (
          <article key={card.label} className="admin-traffic-stat">
            <span>{card.label}</span>
            <strong>{card.value.toLocaleString()}</strong>
          </article>
        ))}
      </div>

      <div className="admin-traffic-grid">
        <section className="admin-traffic-card">
          <h4>Top IPs</h4>
          <div className="admin-traffic-list">
            {data.topIps.map((entry) => (
              <div key={entry.label} className="admin-traffic-row">
                <strong>{entry.label}</strong>
                <span>{entry.count} events · {entry.rateLimited} limited · {entry.uniqueLeagueIds} leagues</span>
                <em>Last seen {formatAdminTelemetryDate(entry.lastSeen)}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Top Leagues</h4>
          <div className="admin-traffic-list">
            {data.topLeagueIds.length ? data.topLeagueIds.map((entry) => (
              <div key={entry.label} className="admin-traffic-row">
                <strong>{entry.label}</strong>
                <span>{entry.count} events · {entry.success} success · {entry.error} errors</span>
                <em>Last seen {formatAdminTelemetryDate(entry.lastSeen)}</em>
              </div>
            )) : <p className="admin-traffic-empty">No league-specific events yet.</p>}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Recent Events</h4>
          <div className="admin-traffic-list">
            {data.recentEvents.map((event) => (
              <div key={event.id} className={`admin-traffic-row admin-traffic-row-${event.status}`}>
                <strong>{event.eventType.replace(/_/g, ' ')}</strong>
                <span>{event.status} · {event.username || event.leagueId || event.ipAddress || 'unknown'}</span>
                <em>{formatAdminTelemetryDate(event.createdAt)}{event.note ? ` · ${event.note}` : ''}</em>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function Home() {
  const [leagueId, setLeagueId] = useState('');
  const [sleeperUsername, setSleeperUsername] = useState('');
  const [leagueIdHistory, setLeagueIdHistory] = useState<string[]>(() => readAutocompleteHistory(LEAGUE_ID_HISTORY_KEY));
  const [sleeperUsernameHistory, setSleeperUsernameHistory] = useState<string[]>(() => readAutocompleteHistory(SLEEPER_USERNAME_HISTORY_KEY));
  const [cachedSleeperUsers, setCachedSleeperUsers] = useState<CachedSleeperUser[]>(() => readCachedSleeperUsers());
  const [focusedAutocomplete, setFocusedAutocomplete] = useState<'username' | 'league' | null>(null);
  const [userLeagues, setUserLeagues] = useState<SleeperLeagueOption[]>([]);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [viewerUsername, setViewerUsername] = useState<string | null>(null);
  const [adminViewMode, setAdminViewMode] = useState<AdminViewMode | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportDataCacheVersion, setReportDataCacheVersion] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [leagueName, setLeagueName] = useState('');
  const [leagueLogo, setLeagueLogo] = useState<string | null>(null);
  const [leagueFormat, setLeagueFormat] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisCompleteMessage, setAnalysisCompleteMessage] = useState<{
    leagueName: string;
    leagueFormat: string;
    leagueLogo: string | null;
  } | null>(null);
  const [pendingAnalysisLeague, setPendingAnalysisLeague] = useState<AnalysisLeaguePreview | null>(null);
  const [isLeaguePickerOpen, setIsLeaguePickerOpen] = useState(false);
  const [isChangeLeagueModalOpen, setIsChangeLeagueModalOpen] = useState(false);
  const [isClownModalOpen, setIsClownModalOpen] = useState(false);
  const [isAdminPermissionsModalOpen, setIsAdminPermissionsModalOpen] = useState(false);
  const [loadingTransitionPhase, setLoadingTransitionPhase] = useState<LoadingTransitionPhase>('loading');
  const [prospectArchiveOpenedWhileLoading, setProspectArchiveOpenedWhileLoading] = useState(false);
  const successTransitionTimerRefs = useRef<number[]>([]);

  const clearSuccessTransitionTimers = () => {
    successTransitionTimerRefs.current.forEach((timer) => window.clearTimeout(timer));
    successTransitionTimerRefs.current = [];
  };

  const queueSuccessTransitionTimer = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      successTransitionTimerRefs.current = successTransitionTimerRefs.current.filter((queuedTimer) => queuedTimer !== timer);
      callback();
    }, delay);
    successTransitionTimerRefs.current.push(timer);
  };

  const rememberLeagueId = (value: string) => {
    setLeagueIdHistory(rememberAutocompleteValue(LEAGUE_ID_HISTORY_KEY, value));
  };

  const rememberSleeperUsername = (value: string) => {
    setSleeperUsernameHistory(rememberAutocompleteValue(SLEEPER_USERNAME_HISTORY_KEY, value));
  };

  const getCurrentSessionUserForCache = (): SleeperUserSession | null => {
    const cachedUser = findCachedSleeperUser(cachedSleeperUsers, viewerUserId, sleeperUsername);
    const username = sleeperUsername.trim() || cachedUser?.username || '';
    if (!username) return null;

    return {
      userId: viewerUserId || cachedUser?.userId || username,
      username: cachedUser?.username || viewerUsername || username,
      displayName: cachedUser?.displayName || viewerUsername || username,
      avatarUrl: cachedUser?.avatarUrl || null,
    };
  };

  const rememberCurrentUserLeagueShortcut = (nextLeagueId: string) => {
    if (!userLeagues.some((league) => league.leagueId === nextLeagueId)) return;
    const sessionUser = getCurrentSessionUserForCache();
    const username = sleeperUsername.trim() || sessionUser?.username || '';
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

  const analyzeMutation = trpc.league.analyze.useMutation({
    onSuccess: (data) => {
      clearSuccessTransitionTimers();
      setLeagueId(data.leagueId);
      setLeagueName(data.leagueName);
      setLeagueLogo(data.leagueLogo);
      setLeagueFormat(data.leagueFormat);
      rememberCurrentUserLeagueShortcut(data.leagueId);
      setPendingAnalysisLeague({
        leagueName: data.leagueName,
        leagueFormat: data.leagueFormat,
        leagueLogo: data.leagueLogo,
      });
      setAnalysisCompleteMessage({
        leagueName: data.leagueName,
        leagueFormat: data.leagueFormat,
        leagueLogo: data.leagueLogo,
      });
      setLoadingTransitionPhase('success');
      queueSuccessTransitionTimer(() => {
        setReportDataCacheVersion(REPORT_CACHE_DATA_VERSION);
        setReportData(data.reportData);
        setLoadingTransitionPhase('reveal');
      }, REPORT_SUCCESS_REVEAL_DELAY_MS);
      queueSuccessTransitionTimer(() => {
        setLoadingTransitionPhase('kick');
      }, REPORT_SUCCESS_REVEAL_DELAY_MS + REPORT_SUCCESS_READ_AFTER_REVEAL_MS);
      queueSuccessTransitionTimer(() => {
        setLoadingTransitionPhase('done');
        setIsLoading(false);
        setAnalysisCompleteMessage(null);
        setPendingAnalysisLeague(null);
      }, REPORT_SUCCESS_REVEAL_DELAY_MS + REPORT_SUCCESS_READ_AFTER_REVEAL_MS + REPORT_SUCCESS_KICK_MS);
    },
    onError: (error) => {
      clearSuccessTransitionTimers();
      setAnalysisCompleteMessage(null);
      setPendingAnalysisLeague(null);
      setLoadingTransitionPhase('loading');
      setIsLoading(false);
      showMutationErrorToast(error);
    },
  });

  useEffect(() => () => {
    clearSuccessTransitionTimers();
  }, []);

  const userLeagueRanksMutation = trpc.league.getUserLeagueRanks.useMutation({
    onSuccess: (data) => {
      setUserLeagues((prev) => mergeLeagueRanks(prev, data.ranks));
    },
  });

  const userLeaguesMutation = trpc.league.getUserLeagues.useMutation({
    onSuccess: (data, variables) => {
      const username = variables.username.trim();
      const nextViewerUserId = data.user?.userId || null;
      const nextViewerIdentity = getKtcAdminIdentity(data.user, username);
      const nextIsPrivilegedViewer = isPrivilegedReportViewer(nextViewerUserId, nextViewerIdentity, username);
      setUserLeagues(data.leagues);
      setViewerUserId(nextViewerUserId);
      setViewerUsername(nextViewerIdentity);
      setAdminViewMode(null);
      setIsAdminPermissionsModalOpen(false);
      if (data.leagues.length === 0) {
        toast.error('No Sleeper leagues found for this username');
        return;
      }
      rememberSleeperUsername(username);
      setCachedSleeperUsers(rememberCachedSleeperUser(buildCachedSleeperUser(username, data.user, data.leagues)));
      try {
        localStorage.setItem(
          SLEEPER_SESSION_KEY,
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
      if (nextIsPrivilegedViewer) {
        setIsAdminPermissionsModalOpen(true);
      }
      if (data.user?.userId && data.leagues.length > 0) {
        userLeagueRanksMutation.mutate({
          username,
          userId: data.user.userId,
          displayName: data.user.displayName,
          leagueIds: data.leagues.map((league) => league.leagueId),
        });
      }
      toast.success(`Found ${data.leagues.length} Sleeper league${data.leagues.length === 1 ? '' : 's'}`);
    },
    onError: (error) => {
      showMutationErrorToast(error);
    },
  });

  useEffect(() => {
    let restoredViewerUserId: string | null = null;
    try {
      const sleeperSession = localStorage.getItem(SLEEPER_SESSION_KEY);
      if (sleeperSession) {
        const parsed = JSON.parse(sleeperSession) as SleeperSession;
        const parsedLeagues = Array.isArray(parsed.leagues) ? parsed.leagues : [];
        const restoredViewerIdentity = getKtcAdminIdentity(parsed.user, parsed.username);
        const restoredAdminViewMode = normalizeAdminViewMode(parsed.adminViewMode);
        const restoredIsPrivilegedViewer = isPrivilegedReportViewer(
          parsed.user?.userId || null,
          restoredViewerIdentity,
          parsed.username
        );
        setSleeperUsername(parsed.username || '');
        restoredViewerUserId = parsed.user?.userId || null;
        setViewerUserId(restoredViewerUserId);
        setViewerUsername(restoredViewerIdentity);
        setAdminViewMode(restoredIsPrivilegedViewer ? restoredAdminViewMode : null);
        setIsAdminPermissionsModalOpen(restoredIsPrivilegedViewer && !restoredAdminViewMode);
        if (parsed.username) {
          setSleeperUsernameHistory(rememberAutocompleteValue(SLEEPER_USERNAME_HISTORY_KEY, parsed.username));
        }
        if (parsed.username && parsedLeagues.length) {
          setCachedSleeperUsers(rememberCachedSleeperUser(buildCachedSleeperUser(parsed.username, parsed.user, parsedLeagues)));
        }
        setUserLeagues(parsedLeagues);
      }
    } catch {
      localStorage.removeItem(SLEEPER_SESSION_KEY);
    }

    try {
      STALE_REPORT_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
      const cachedReport = localStorage.getItem(REPORT_CACHE_KEY);
      if (cachedReport) {
        const parsed = JSON.parse(cachedReport) as CachedReport;
        if (parsed.cacheVersion === REPORT_CACHE_DATA_VERSION) {
          setLeagueId(parsed.leagueId);
          setLeagueName(parsed.leagueName);
          setLeagueLogo(parsed.leagueLogo);
          setLeagueFormat(parsed.leagueFormat);
          setActiveTab(parsed.activeTab || 'overview');
          setReportDataCacheVersion(parsed.cacheVersion);
          setReportData(parsed.reportData);
          setLeagueIdHistory(rememberAutocompleteValue(LEAGUE_ID_HISTORY_KEY, parsed.leagueId));
          return;
        }
        localStorage.removeItem(REPORT_CACHE_KEY);
      }

      const lastLeague = localStorage.getItem(LAST_LEAGUE_KEY);
      if (lastLeague) {
        const parsed = JSON.parse(lastLeague) as LastLeague;
        setLeagueId(parsed.leagueId);
        setLeagueName(parsed.leagueName);
        setLeagueLogo(parsed.leagueLogo);
        setLeagueFormat(parsed.leagueFormat);
        setActiveTab(parsed.activeTab || 'overview');
        setLeagueIdHistory(rememberAutocompleteValue(LEAGUE_ID_HISTORY_KEY, parsed.leagueId));
        setPendingAnalysisLeague({
          leagueName: parsed.leagueName,
          leagueFormat: parsed.leagueFormat,
          leagueLogo: parsed.leagueLogo,
        });
        setLoadingTransitionPhase('loading');
        setIsLoading(true);
        analyzeMutation.mutate({ leagueId: parsed.leagueId, viewerUserId: restoredViewerUserId || undefined });
      }
    } catch {
      localStorage.removeItem(REPORT_CACHE_KEY);
      localStorage.removeItem(LAST_LEAGUE_KEY);
    }
    // Run once on boot so phone refreshes land back in the last league.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!reportData) return;

    const lastLeague: LastLeague = {
      leagueId,
      leagueName,
      leagueLogo,
      leagueFormat,
      activeTab,
      savedAt: Date.now(),
    };

    try {
      localStorage.setItem(LAST_LEAGUE_KEY, JSON.stringify(lastLeague));
      localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify({
        ...lastLeague,
        cacheVersion: REPORT_CACHE_DATA_VERSION,
        reportData,
      } satisfies CachedReport));
    } catch {
      localStorage.removeItem(REPORT_CACHE_KEY);
      try {
        localStorage.setItem(LAST_LEAGUE_KEY, JSON.stringify(lastLeague));
      } catch {
        localStorage.removeItem(LAST_LEAGUE_KEY);
      }
    }
  }, [activeTab, leagueFormat, leagueId, leagueLogo, leagueName, reportData]);

  useEffect(() => {
    if (!reportData || reportDataCacheVersion === REPORT_CACHE_DATA_VERSION || !leagueId || isLoading) return;

    localStorage.removeItem(REPORT_CACHE_KEY);
    STALE_REPORT_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
    setReportData(null);
    setReportDataCacheVersion(null);
    setAnalysisCompleteMessage(null);
    setPendingAnalysisLeague({
      leagueName,
      leagueFormat,
      leagueLogo,
    });
    setLoadingTransitionPhase('loading');
    setIsLoading(true);
    analyzeMutation.mutate({ leagueId, viewerUserId: viewerUserId || undefined });
    // This intentionally runs when a preserved React Fast Refresh state has report data
    // from an older browser cache version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportData, reportDataCacheVersion, leagueId, isLoading, viewerUserId]);

  const handleAnalyze = async (targetLeagueId = leagueId) => {
    const nextLeagueId = targetLeagueId.trim();
    if (!nextLeagueId) {
      toast.error('Please enter a league ID');
      return;
    }
    const pendingLeague = userLeagues.find((league) => league.leagueId === nextLeagueId);
    setPendingAnalysisLeague(pendingLeague ? {
      leagueName: pendingLeague.name,
      leagueFormat: pendingLeague.format || pendingLeague.mobileFormat || `${pendingLeague.totalRosters || '?'}-Team Dynasty`,
      leagueLogo: pendingLeague.avatarUrl,
    } : null);
    setLeagueId(nextLeagueId);
    rememberLeagueId(nextLeagueId);
    setAnalysisCompleteMessage(null);
    setLoadingTransitionPhase('loading');
    setIsLoading(true);
    analyzeMutation.mutate({ leagueId: nextLeagueId, viewerUserId: viewerUserId || undefined });
  };

  const handleFindLeagues = async () => {
    const normalizedUsername = sleeperUsername.trim();
    if (!normalizedUsername) {
      toast.error('Please enter a Sleeper username');
      return;
    }
    if (CLOWN_EASTER_EGG_USERNAMES.has(normalizedUsername.toLowerCase())) {
      setIsClownModalOpen(true);
      return;
    }
    userLeaguesMutation.mutate({ username: normalizedUsername });
  };

  const handleCachedSleeperUserSelect = (cachedUser: CachedSleeperUser) => {
    const sessionUser = cachedSleeperUserToSessionUser(cachedUser);
    const nextViewerIdentity = getKtcAdminIdentity(sessionUser, cachedUser.username);
    const nextIsPrivilegedViewer = isPrivilegedReportViewer(cachedUser.userId, nextViewerIdentity, cachedUser.username);
    setSleeperUsername(cachedUser.username);
    setFocusedAutocomplete(null);
    setUserLeagues(cachedUser.leagues);
    setViewerUserId(cachedUser.userId);
    setViewerUsername(nextViewerIdentity);
    setAdminViewMode(null);
    setIsAdminPermissionsModalOpen(nextIsPrivilegedViewer);
    setIsLeaguePickerOpen(false);
    setIsChangeLeagueModalOpen(false);
    rememberSleeperUsername(cachedUser.username);
    setCachedSleeperUsers(rememberCachedSleeperUser(cachedUser));

    try {
      localStorage.setItem(
        SLEEPER_SESSION_KEY,
        JSON.stringify({
          username: cachedUser.username,
          user: sessionUser,
          leagues: cachedUser.leagues,
          adminViewMode: null,
          savedAt: Date.now(),
        } satisfies SleeperSession)
      );
    } catch {
      // Account shortcuts still work for this page load.
    }

    if (!cachedUser.leagues.length) {
      userLeaguesMutation.mutate({ username: cachedUser.username });
    }
  };

  const handleClownDismiss = () => {
    setIsClownModalOpen(false);
    setSleeperUsername('');
    setUserLeagues([]);
    setFocusedAutocomplete(null);
    setAdminViewMode(null);
    setIsAdminPermissionsModalOpen(false);
  };

  const persistAdminViewMode = (mode: AdminViewMode) => {
    try {
      const sleeperSession = localStorage.getItem(SLEEPER_SESSION_KEY);
      if (!sleeperSession) return;
      const parsed = JSON.parse(sleeperSession) as SleeperSession;
      localStorage.setItem(
        SLEEPER_SESSION_KEY,
        JSON.stringify({
          ...parsed,
          adminViewMode: mode,
          savedAt: Date.now(),
        } satisfies SleeperSession)
      );
    } catch {
      // The view-mode choice only needs to last for this browser session.
    }
  };

  const handleAdminViewModeChoice = (mode: AdminViewMode) => {
    setAdminViewMode(mode);
    setIsAdminPermissionsModalOpen(false);
    persistAdminViewMode(mode);
    if (mode === 'regular') {
      setActiveTab('overview');
    }
  };

  const handleStartOver = () => {
    localStorage.removeItem(REPORT_CACHE_KEY);
    localStorage.removeItem(LAST_LEAGUE_KEY);
    localStorage.removeItem(SLEEPER_SESSION_KEY);
    clearSuccessTransitionTimers();
    setIsLeaguePickerOpen(false);
    setIsChangeLeagueModalOpen(false);
    setAnalysisCompleteMessage(null);
    setPendingAnalysisLeague(null);
    setLoadingTransitionPhase('loading');
    setReportData(null);
    setLeagueId('');
    setSleeperUsername('');
    setLeagueName('');
    setLeagueLogo(null);
    setLeagueFormat('');
    setUserLeagues([]);
    setViewerUserId(null);
    setViewerUsername(null);
    setAdminViewMode(null);
    setIsAdminPermissionsModalOpen(false);
    setActiveTab('overview');
  };

  const handleAnalyzeAnotherLeague = () => {
    if (userLeagues.length > 0) {
      setIsLeaguePickerOpen(true);
      return;
    }
    handleStartOver();
  };

  const handleHeaderLeagueClick = () => {
    if (userLeagues.length > 0) {
      setIsLeaguePickerOpen(true);
      return;
    }
    setIsChangeLeagueModalOpen(true);
  };

  const handleAnalyzeLeagueOption = (nextLeagueId: string) => {
    setIsLeaguePickerOpen(false);
    localStorage.removeItem(REPORT_CACHE_KEY);
    setReportData(null);
    handleAnalyze(nextLeagueId);
  };

  const handleCachedLeagueShortcutSelect = (nextLeagueId: string) => {
    const cachedUser = findCachedSleeperUser(cachedSleeperUsers, viewerUserId, sleeperUsername);
    const sessionUser = cachedUser ? cachedSleeperUserToSessionUser(cachedUser) : null;
    if (cachedUser && sessionUser) {
      const nextViewerIdentity = getKtcAdminIdentity(sessionUser, cachedUser.username);
      const nextIsPrivilegedViewer = isPrivilegedReportViewer(cachedUser.userId, nextViewerIdentity, cachedUser.username);
      setSleeperUsername(cachedUser.username);
      setFocusedAutocomplete(null);
      setUserLeagues(cachedUser.leagues);
      setViewerUserId(cachedUser.userId);
      setViewerUsername(nextViewerIdentity);
      setAdminViewMode(nextIsPrivilegedViewer ? adminViewMode : null);
      rememberSleeperUsername(cachedUser.username);
      setCachedSleeperUsers(rememberCachedSleeperLeagueShortcut({
        users: readCachedSleeperUsers(),
        user: sessionUser,
        username: cachedUser.username,
        leagues: cachedUser.leagues,
        leagueId: nextLeagueId,
      }));

      try {
        localStorage.setItem(
          SLEEPER_SESSION_KEY,
          JSON.stringify({
            username: cachedUser.username,
            user: sessionUser,
            leagues: cachedUser.leagues,
            adminViewMode: nextIsPrivilegedViewer ? adminViewMode : null,
            savedAt: Date.now(),
          } satisfies SleeperSession)
        );
      } catch {
        // League shortcuts are still usable for this page load.
      }
    }

    setIsLeaguePickerOpen(false);
    setIsChangeLeagueModalOpen(false);
    localStorage.removeItem(REPORT_CACHE_KEY);
    setReportData(null);
    setLeagueId(nextLeagueId);
    rememberLeagueId(nextLeagueId);
    const pendingLeague = userLeagues.find((league) => league.leagueId === nextLeagueId)
      || cachedUser?.leagues.find((league) => league.leagueId === nextLeagueId);
    setPendingAnalysisLeague(pendingLeague ? {
      leagueName: pendingLeague.name,
      leagueFormat: pendingLeague.format || pendingLeague.mobileFormat || `${pendingLeague.totalRosters || '?'}-Team Dynasty`,
      leagueLogo: pendingLeague.avatarUrl,
    } : null);
    setAnalysisCompleteMessage(null);
    setLoadingTransitionPhase('loading');
    setIsLoading(true);
    analyzeMutation.mutate({ leagueId: nextLeagueId, viewerUserId: cachedUser?.userId || viewerUserId || undefined });
  };

  const usernameAutocompleteOptions = getFilteredAutocompleteOptions(sleeperUsernameHistory, sleeperUsername);
  const leagueIdAutocompleteOptions = getFilteredAutocompleteOptions(leagueIdHistory, leagueId);
  const activeCachedSleeperUser = findCachedSleeperUser(cachedSleeperUsers, viewerUserId, sleeperUsername);
  const orderedUserLeagues = getOrderedLeagueOptions(userLeagues, activeCachedSleeperUser);
  const cachedLeagueShortcuts = getLeagueShortcutsForUser(
    activeCachedSleeperUser,
    userLeagues,
    reportData ? leagueId : null
  );
  const isPrivilegedViewer = isPrivilegedReportViewer(viewerUserId, viewerUsername, sleeperUsername);
  const canViewMomentumTab = isPrivilegedViewer && adminViewMode === 'admin';
  const migratedActiveTab = activeTab === 'projections' ? 'rankings' : activeTab;
  const resolvedActiveTab = !canViewMomentumTab && migratedActiveTab === 'momentum' ? 'overview' : migratedActiveTab;
  const rankingsQuery = trpc.league.rankings.useQuery(
    { leagueId },
    {
      enabled: Boolean(reportData && leagueId),
      staleTime: 1000 * 60 * 60 * 12,
      refetchOnWindowFocus: false,
      retry: 1,
    }
  );
  const rankingsForReport = rankingsQuery.data?.rankings || reportData?.rankings;
  const isProspectArchiveLoading = rankingsQuery.isLoading && !rankingsForReport;
  const reportDataWithRankings = reportData && rankingsForReport
    ? { ...reportData, rankings: rankingsForReport }
    : reportData;
  const handleReportTabChange = (nextTab: string) => {
    if (nextTab === 'momentum' && !canViewMomentumTab) {
      setActiveTab('overview');
      return;
    }
    setActiveTab(nextTab);
  };

  useEffect(() => {
    if (!canViewMomentumTab && activeTab === 'momentum') {
      setActiveTab('overview');
    } else if (activeTab === 'projections') {
      setActiveTab('rankings');
    }
  }, [activeTab, canViewMomentumTab]);

  useEffect(() => {
    if (!isProspectArchiveLoading) {
      setProspectArchiveOpenedWhileLoading(false);
    }
  }, [isProspectArchiveLoading]);

  const clownEasterEggDialog = (
    <Dialog open={isClownModalOpen} onOpenChange={setIsClownModalOpen}>
      <DialogContent className="clown-easter-egg-dialog border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-lg">
        <DialogHeader className="text-center">
          <DialogTitle className="athletic-headline text-3xl text-orange-400">
            Rival Alert
          </DialogTitle>
          <DialogDescription className="text-cyan-100/75">
            This username unlocked a special screen.
          </DialogDescription>
        </DialogHeader>
        <div className="clown-easter-egg-body">
          <div className="clown-easter-egg-face" aria-hidden="true">🤡</div>
          <p className="clown-easter-egg-copy">
            Rival league energy detected.
          </p>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            onClick={handleClownDismiss}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 sm:w-auto"
          >
            Back To Login
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const adminPermissionsDialog = (
    <Dialog
      open={isPrivilegedViewer && isAdminPermissionsModalOpen}
      onOpenChange={(open) => {
        if (open) setIsAdminPermissionsModalOpen(true);
      }}
    >
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="admin-permissions-dialog border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-lg"
      >
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="athletic-headline text-3xl text-orange-400">
            Admin Permissions
          </DialogTitle>
          <DialogDescription className="text-cyan-100/75">
            Unlock advanced dynasty analytics, hidden momentum grades, and blended-value diagnostics not shown in the standard report.
          </DialogDescription>
        </DialogHeader>
        <div className="admin-permissions-copy rounded-xl border border-cyan-400/15 bg-cyan-400/5 px-4 py-4 text-center text-sm font-semibold text-slate-200">
          Choose regular mode to see what everyone else sees, or unlock the full degenerate toolkit for the extra diagnostics.
        </div>
        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            onClick={() => handleAdminViewModeChoice('regular')}
            variant="outline"
            className="w-full border-slate-500/40 text-slate-100 hover:bg-slate-800 sm:w-auto"
          >
            View Like Regular Person
          </Button>
          <Button
            type="button"
            onClick={() => handleAdminViewModeChoice('admin')}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 sm:w-auto"
          >
            Unlock Admin Tools
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const loadingLeague = analysisCompleteMessage || pendingAnalysisLeague || (
    leagueName || leagueFormat || leagueLogo
      ? { leagueName, leagueFormat, leagueLogo }
      : null
  );
  const isLoadingRevealPhase = loadingTransitionPhase === 'reveal' || loadingTransitionPhase === 'kick';
  const loadingSuccessCardClassName = [
    'loading-success-card',
    analysisCompleteMessage?.leagueLogo ? 'loading-success-card-logo' : '',
    loadingTransitionPhase === 'reveal' ? 'loading-success-card-reveal' : '',
    loadingTransitionPhase === 'kick' ? 'loading-success-card-kick' : '',
  ].filter(Boolean).join(' ');
  const loadingDialog = (
    <Dialog open={isLoading} onOpenChange={() => undefined}>
      <DialogContent
        className={`analysis-loading-dialog analysis-loading-dialog-${loadingTransitionPhase} border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-lg`}
        overlayClassName={`analysis-loading-overlay analysis-loading-overlay-${loadingTransitionPhase}`}
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{analysisCompleteMessage ? 'League Report Ready' : 'Analyzing League'}</DialogTitle>
          <DialogDescription>{analysisCompleteMessage ? 'The league report is ready.' : 'Generating the selected league report.'}</DialogDescription>
        </DialogHeader>
        <div className="analysis-loading-modal-body">
          <LoadingAnimation
            isComplete={Boolean(analysisCompleteMessage)}
            leagueName={loadingLeague?.leagueName}
            leagueFormat={loadingLeague?.leagueFormat}
            leagueLogo={loadingLeague?.leagueLogo}
          />
          {analysisCompleteMessage && (
            <div
              className={loadingSuccessCardClassName}
              role="status"
              aria-live="polite"
            >
              <span className="loading-success-impact-core" aria-hidden="true" />
              <div className="loading-success-copy">
                <p className="loading-success-kicker">Report Generated</p>
                <div className="loading-success-icon">
                  {analysisCompleteMessage.leagueLogo ? (
                    <img
                      src={analysisCompleteMessage.leagueLogo}
                      alt=""
                      className="loading-success-logo-image"
                    />
                  ) : (
                    <CheckCircle2 aria-hidden="true" />
                  )}
                </div>
                <h2 className={`${getLoadingSuccessTitleClassName(analysisCompleteMessage.leagueName || 'League report')} loading-success-league-name loading-gradient-text`}>
                  {analysisCompleteMessage.leagueName || 'League report'}
                </h2>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  if (reportData) {
    const isRedraftReport = (reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode) === 'redraft';
    const displayReportData = reportDataWithRankings || reportData;
    return (
      <ManagerChampionshipProvider championships={reportData.managerChampionships}>
      <div className={`report-shell min-h-screen flex flex-col ${isLoadingRevealPhase ? 'report-shell-entering' : ''}`}>
        {/* Premium Header */}
        <div className="report-header sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 md:py-2">
             <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6">
              {/* Left: Brand */}
              <div className="report-header-brand min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <img
                    src={DYNASTY_LOGO_SRC}
                    alt="Dynasty Degenerates"
                    className="report-header-mobile-logo md:hidden"
                  />
                  <h2 className="report-header-wordmark athletic-headline hidden truncate text-base sm:text-xl md:block">
                    <span>Dynasty</span> <span>Degenerates</span>
                  </h2>
                </div>
                <Button
                  onClick={handleAnalyzeAnotherLeague}
                  variant="outline"
                  className="report-header-action hidden md:inline-flex"
                >
                  <span className="report-header-action-label">Analyze Another League</span>
                </Button>
                <span className="report-live-indicator hidden md:inline-flex" aria-label="League analysis loaded">
                  <span aria-hidden="true" />
                  League scan complete
                </span>
              </div>

              {/* Center: Logo */}
              <div className="hidden md:col-start-2 md:flex items-center justify-center">
                <img
                  src={DYNASTY_LOGO_SRC}
                  alt="Dynasty Degenerates Logo"
                  className="report-header-logo"
                />
              </div>

              {/* Right: League Name + shortcuts */}
              <div className="report-league-zone md:col-start-3">
                <button
                  type="button"
                  className="report-league-lockup"
                  onClick={handleHeaderLeagueClick}
                  aria-label="Open league switcher"
                >
                  <div className="min-w-0 text-right">
                    <p className="truncate text-sm font-semibold text-orange-400 sm:text-lg md:text-xl">{leagueName}</p>
                    {leagueFormat && (
                      <p className="truncate text-[11px] font-medium text-cyan-200/70 sm:text-xs">
                        {leagueFormat}
                      </p>
                    )}
                  </div>
                  {leagueLogo && (
                    <img
                      src={leagueLogo}
                      alt={leagueName ? `${leagueName} league icon` : 'League icon'}
                      className="report-league-icon"
                    />
                  )}
                </button>
                {cachedLeagueShortcuts.length > 0 && (
                  <LeagueShortcutStack
                    leagues={cachedLeagueShortcuts}
                    activeLeagueId={leagueId}
                    onSelect={handleCachedLeagueShortcutSelect}
                    className="report-league-shortcuts"
                    label="Switch"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 w-full">
          <Tabs value={resolvedActiveTab} onValueChange={handleReportTabChange} className="w-full">
            <TabsList
              className={`report-tabs ${canViewMomentumTab ? 'report-tabs-five' : 'report-tabs-four'}`}
              data-active-tab={resolvedActiveTab}
            >
              <TabsTrigger value="overview" className="report-tab" aria-label="Overview">
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                <span>Overview</span>
              </TabsTrigger>

              {canViewMomentumTab && (
                <TabsTrigger value="momentum" className="report-tab" aria-label="Weekly Momentum">
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  <span className="report-tab-label-full" aria-hidden="true">Weekly Momentum</span>
                  <span className="report-tab-label-short" aria-hidden="true">Trend</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="rankings" className="report-tab" aria-label="Rankings">
                <ListOrdered className="h-4 w-4" aria-hidden="true" />
                <span>Rankings</span>
              </TabsTrigger>
              <TabsTrigger value="trades" className="report-tab" aria-label="Trade History">
                <Repeat2 className="h-4 w-4" aria-hidden="true" />
                <span className="report-tab-label-full" aria-hidden="true">Trade History</span>
                <span className="report-tab-label-short" aria-hidden="true">Trades</span>
              </TabsTrigger>

              <TabsTrigger value="draft" className="report-tab" aria-label="Draft History">
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                <span className="report-tab-label-full" aria-hidden="true">Draft History</span>
                <span className="report-tab-label-short" aria-hidden="true">Draft</span>
              </TabsTrigger>
            </TabsList>

            <Suspense fallback={<ReportSectionLoadingFallback />}>
            <TabsContent value="overview" className="report-tab-content">
              <div className="space-y-6 sm:space-y-8">
                {(() => {
                  const hasTaxiTriage = !isRedraftReport && reportData.managerRosterIntelligence?.some((row) => (row.taxiTriage?.items.length || 0) > 0);
                  return (
                    <>
                <CollapsibleReportSection title="Owner Intel Lab" kicker="Dynasty owner reads">
                  <OwnerIntelMatrix
                    data={reportData}
                    managerAvatars={reportData.managerAvatars}
                    leagueId={leagueId}
                    leagueLogo={leagueLogo}
                    viewerManager={reportData.viewerManager}
                    currentStandings={reportData.currentStandings}
                  />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="Projected Roster Board" kicker="Season starter room">
                  <LeagueCommandCenter
                    data={reportData}
                    managerAvatars={reportData.managerAvatars}
                    leagueId={leagueId}
                    leagueLogo={leagueLogo}
                    section="roster"
                    viewerManager={reportData.viewerManager}
                    currentStandings={reportData.currentStandings}
                  />
                </CollapsibleReportSection>
                {hasTaxiTriage && (
                <CollapsibleReportSection title="Taxi Squad Triage" kicker="Taxi-only activation checks">
                  <LeagueCommandCenter
                    data={reportData}
                    managerAvatars={reportData.managerAvatars}
                    leagueId={leagueId}
                    leagueLogo={leagueLogo}
                    section="taxi"
                    viewerManager={reportData.viewerManager}
                    currentStandings={reportData.currentStandings}
                  />
                </CollapsibleReportSection>
                )}
                {reportData.managerPositionCounts.length > 0 && (
                  <CollapsibleReportSection title="Manager Position Counts" kicker="Full roster depth map">
                    <ManagerPositionCountsTable
                      data={reportData.managerPositionCounts}
                      positionDepth={reportData.positionDepth}
                      managerAvatars={reportData.managerAvatars}
                      playerDetailsById={reportData.playerDetailsById}
                      leagueId={leagueId}
                      leagueLogo={leagueLogo}
                      viewerManager={reportData.viewerManager}
                    />
                  </CollapsibleReportSection>
                )}
                    </>
                  );
                })()}
              </div>
            </TabsContent>

            {canViewMomentumTab && (
              <TabsContent value="momentum" className="report-tab-content">
                <div className="space-y-6 sm:space-y-8">
                  {(reportData.weeklyRisers.some((player) => player.val_now >= 2500) ||
                    reportData.weeklyFallers.some((player) => player.val_now >= 1800)) && (
                    <CollapsibleReportSection title="Trade Market Radar" kicker="Buy and sell signals">
                      <TradeMarketRadar
                        risers={reportData.weeklyRisers}
                        fallers={reportData.weeklyFallers}
                        managerAvatars={reportData.managerAvatars}
                        playerDetailsById={reportData.playerDetailsById}
                        leagueId={leagueId}
                        leagueLogo={leagueLogo}
                        viewerManager={reportData.viewerManager}
                      />
                    </CollapsibleReportSection>
                  )}
                  <CollapsibleReportSection title="Waiver Intelligence" kicker="Available value">
                    <WaiverIntelligencePanel
                      data={reportData.waiverIntelligence}
                      managerAvatars={reportData.managerAvatars}
                      playerDetailsById={reportData.playerDetailsById}
                      leagueId={leagueId}
                      leagueLogo={leagueLogo}
                      viewerManager={reportData.viewerManager}
                      managerRosterIntelligence={reportData.managerRosterIntelligence}
                      managerPositionCounts={reportData.managerPositionCounts}
                      positionDepth={reportData.positionDepth}
                      leagueDiagnostics={reportData.leagueDiagnostics}
                    />
                  </CollapsibleReportSection>
                  <CollapsibleReportSection title="Recent Transactions" kicker="Claims, drops, and churn">
                    <RecentTransactionsPanel
                      data={reportData.recentTransactions}
                      waiverIntelligence={reportData.waiverIntelligence}
                      managerAvatars={reportData.managerAvatars}
                      playerDetailsById={reportData.playerDetailsById}
                      leagueId={leagueId}
                      leagueLogo={leagueLogo}
                      leagueValueMode={reportData.leagueValueMode}
                    />
                  </CollapsibleReportSection>
                  <CollapsibleReportSection title="Top 10 Weekly Risers" kicker="7-day % gainers">
                    <WeeklyMomentumTable data={reportData.weeklyRisers} title="Weekly Risers" managerAvatars={reportData.managerAvatars} playerDetailsById={reportData.playerDetailsById} leagueId={leagueId} leagueLogo={leagueLogo} viewerManager={reportData.viewerManager} />
                  </CollapsibleReportSection>
                  <CollapsibleReportSection title="Top 10 Weekly Fallers" kicker="7-day % drops">
                    <WeeklyMomentumTable data={reportData.weeklyFallers} title="Weekly Fallers" managerAvatars={reportData.managerAvatars} playerDetailsById={reportData.playerDetailsById} leagueId={leagueId} leagueLogo={leagueLogo} viewerManager={reportData.viewerManager} />
                  </CollapsibleReportSection>
                  <CollapsibleReportSection title="Trending Adds" kicker="Sleeper activity">
                    <TrendingPlayersTable
                      data={reportData.trendingAdds || []}
                      title="Trending Adds"
                      countLabel="Adds"
                      managerAvatars={reportData.managerAvatars}
                      playerDetailsById={reportData.playerDetailsById}
                      leagueId={leagueId}
                      leagueLogo={leagueLogo}
                      viewerManager={reportData.viewerManager}
                    />
                  </CollapsibleReportSection>
                  <CollapsibleReportSection title="Trending Drops" kicker="Sleeper activity">
                    <TrendingPlayersTable
                      data={reportData.trendingDrops || []}
                      title="Trending Drops"
                      countLabel="Drops"
                      managerAvatars={reportData.managerAvatars}
                      playerDetailsById={reportData.playerDetailsById}
                      leagueId={leagueId}
                      leagueLogo={leagueLogo}
                      viewerManager={reportData.viewerManager}
                    />
                  </CollapsibleReportSection>
                </div>
              </TabsContent>
            )}

            <TabsContent value="rankings" className="report-tab-content">
              <div className="space-y-6 sm:space-y-8">
                <CollapsibleReportSection title="Full Roster Rankings" kicker="League-matched player values">
                  {rankingsQuery.isLoading && !rankingsForReport ? (
                    <div className="rankings-empty-state">Loading league-matched rankings...</div>
                  ) : (
                    <RankingsBoard
                      rankings={rankingsForReport}
                      playerDetailsById={reportData.playerDetailsById}
                      managerAvatars={reportData.managerAvatars}
                      leagueId={leagueId}
                      leagueLogo={leagueLogo}
                      viewerManager={reportData.viewerManager}
                      board="dynasty"
                      hidePicks={isRedraftReport}
                    />
                  )}
                </CollapsibleReportSection>
                {canViewMomentumTab && !isRedraftReport && (
                  <CollapsibleReportSection title="College Rankings" kicker="Future rookie pipeline">
                    {rankingsQuery.isLoading && !rankingsForReport ? (
                      <div className="rankings-empty-state">Loading college prospect rankings...</div>
                    ) : (
                      <RankingsBoard
                        rankings={rankingsForReport}
                        playerDetailsById={reportData.playerDetailsById}
                        managerAvatars={reportData.managerAvatars}
                        leagueId={leagueId}
                        leagueLogo={leagueLogo}
                        viewerManager={reportData.viewerManager}
                        board="devy"
                        hidePicks
                      />
                    )}
                  </CollapsibleReportSection>
                )}
                {canViewMomentumTab && !isRedraftReport && (
                  <CollapsibleReportSection
                    title="Prospect Score Archive"
                    kicker="Scouting data archive"
                    defaultOpen={!isProspectArchiveLoading}
                    onOpenChange={(open) => {
                      if (open && isProspectArchiveLoading) {
                        setProspectArchiveOpenedWhileLoading(true);
                      }
                    }}
                  >
                    {isProspectArchiveLoading && prospectArchiveOpenedWhileLoading ? (
                      <ProspectArchiveLoadingState />
                    ) : isProspectArchiveLoading ? null : (
                      <RankingsBoard
                        rankings={rankingsForReport}
                        playerDetailsById={reportData.playerDetailsById}
                        managerAvatars={reportData.managerAvatars}
                        leagueId={leagueId}
                        leagueLogo={leagueLogo}
                        viewerManager={reportData.viewerManager}
                        board="draftbuzz"
                        hidePicks
                      />
                    )}
                  </CollapsibleReportSection>
                )}
                {canViewMomentumTab && (
                  <>
                    <CollapsibleReportSection title="Admin Eyes Only: Traffic & Abuse" kicker="Request telemetry">
                      <AdminAbuseTelemetryPanel />
                    </CollapsibleReportSection>
                    <CollapsibleReportSection title="Admin Eyes Only: Value Assumptions" kicker="Hidden diagnostics">
                      <AdminValueDiagnosticsTable reportData={displayReportData} />
                    </CollapsibleReportSection>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="trades" className="report-tab-content">
              <div className="trade-sections space-y-6 sm:space-y-8">
                {canViewMomentumTab && (
                  <CollapsibleReportSection title="Trade War Room" kicker="Context-aware calculator">
                    <TradeWarRoom
                      data={reportData.managerRosterIntelligence}
                      managerAvatars={reportData.managerAvatars}
                      playerDetailsById={reportData.playerDetailsById}
                      leagueOverview={reportData.leagueOverview}
                      powerRankings={reportData.powerRankings}
                      dynastyTimelines={reportData.dynastyTimelines}
                      leagueId={leagueId}
                      leagueLogo={leagueLogo}
                      viewerManager={reportData.viewerManager}
                      currentStandings={reportData.currentStandings}
                    />
                  </CollapsibleReportSection>
                )}
                <CollapsibleReportSection title="All-Time Trade Profit Leaderboard" kicker="Net trade edge">
                  <TradeProfitLeaderboardTable
                    data={reportData.tradeProfitLeaderboard}
                    managerAvatars={reportData.managerAvatars}
                    tradeHistory={reportData.tradeHistory}
                    draftPicks={reportData.draftPicks || []}
                    playerDetailsById={reportData.playerDetailsById}
                    currentPositionRankById={reportData.currentPositionRankById}
                    tradeTendencies={reportData.tradeTendencies}
                    managerRosterIntelligence={reportData.managerRosterIntelligence}
                    dynastyTimelines={reportData.dynastyTimelines}
                    leagueOverview={reportData.leagueOverview}
                    leagueId={leagueId}
                    leagueLogo={leagueLogo}
                    viewerManager={reportData.viewerManager}
                    currentStandings={reportData.currentStandings}
                    standingsHistory={reportData.standingsHistory}
                    leagueValueMode={reportData.leagueValueMode}
                  />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="Trade Theft Detector" kicker="Who got cooked">
                  <TradeTheftDetector
                    data={reportData.tradeHistory}
                    managerAvatars={reportData.managerAvatars}
                    draftPicks={reportData.draftPicks || []}
                    playerDetailsById={reportData.playerDetailsById}
                    currentPositionRankById={reportData.currentPositionRankById}
                    managerRosterIntelligence={reportData.managerRosterIntelligence}
                    dynastyTimelines={reportData.dynastyTimelines}
                    leagueOverview={reportData.leagueOverview}
                    leagueId={leagueId}
                    leagueLogo={leagueLogo}
                    currentStandings={reportData.currentStandings}
                    standingsHistory={reportData.standingsHistory}
                    leagueValueMode={reportData.leagueValueMode}
                  />
                </CollapsibleReportSection>
                <ModalReportSection title="Full Trade Ledger" kicker="Every completed deal">
                  <TradeHistoryTable
                    data={reportData.tradeHistory}
                    draftPicks={reportData.draftPicks || []}
                    managerAvatars={reportData.managerAvatars}
                    playerDetailsById={reportData.playerDetailsById}
                    currentPositionRankById={reportData.currentPositionRankById}
                    managerRosterIntelligence={reportData.managerRosterIntelligence}
                    dynastyTimelines={reportData.dynastyTimelines}
                    leagueOverview={reportData.leagueOverview}
                    leagueId={leagueId}
                    leagueLogo={leagueLogo}
                    currentStandings={reportData.currentStandings}
                    standingsHistory={reportData.standingsHistory}
                    leagueValueMode={reportData.leagueValueMode}
                    variant="modal"
                  />
                </ModalReportSection>
              </div>
            </TabsContent>



            <TabsContent value="draft" className="report-tab-content">
              <DraftAnalysis
                draftPicks={reportData.draftPicks || []}
                draftStats={reportData.draftStats || []}
                managerRosterIntelligence={reportData.managerRosterIntelligence}
                managerAvatars={reportData.managerAvatars}
                playerDetailsById={reportData.playerDetailsById}
                leagueId={leagueId}
                leagueLogo={leagueLogo}
                viewerManager={reportData.viewerManager}
                currentStandings={reportData.currentStandings}
                leagueOverview={reportData.leagueOverview}
              />
            </TabsContent>
            </Suspense>
          </Tabs>
        </div>

        {/* Bottom Action Buttons */}
        <div className="report-footer border-t border-orange-500/20 bg-slate-950/80 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
            <div className="report-footer-actions">
              <Button
                onClick={handleAnalyzeAnotherLeague}
                variant="outline"
                className="report-footer-analyze-button border-orange-500/30 text-orange-300 hover:bg-orange-500/10 md:hidden"
              >
                Analyze Another League
              </Button>
              <SupportButton compact />
              <FeedbackButton
                compact
                leagueId={leagueId}
                leagueName={leagueName}
                leagueFormat={leagueFormat}
              />
            </div>
          </div>
        </div>

        <Dialog open={isLeaguePickerOpen} onOpenChange={setIsLeaguePickerOpen}>
          <DialogContent className="league-switch-dialog border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-2xl">
            <DialogHeader className="league-switch-header text-center sm:text-center">
              <DialogTitle className="athletic-headline text-3xl text-orange-400">
                Pick Another League
              </DialogTitle>
              <DialogDescription className="league-switch-description text-cyan-100/70">
                <span>Signed in as {sleeperUsername || 'your Sleeper account'}.</span>
                <span>Choose one of your current Sleeper leagues.</span>
              </DialogDescription>
            </DialogHeader>
            <div className="home-league-picker league-switch-picker">
              {orderedUserLeagues.map((league) => (
                <LeaguePickerCard
                  key={league.leagueId}
                  league={league}
                  onSelect={handleAnalyzeLeagueOption}
                />
              ))}
            </div>
            <DialogFooter className="league-switch-footer sm:justify-center">
              <Button
                type="button"
                onClick={handleStartOver}
                variant="outline"
                className="league-switch-start-over-button border-orange-500/30 text-orange-300 hover:bg-orange-500/10"
              >
                Analyze Another League
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isChangeLeagueModalOpen} onOpenChange={setIsChangeLeagueModalOpen}>
          <DialogContent className="league-switch-dialog change-league-dialog border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-md">
            <DialogHeader className="change-league-header text-center sm:text-center">
              <DialogTitle className="athletic-headline change-league-title text-3xl text-orange-400">
                Change Leagues?
              </DialogTitle>
              <DialogDescription className="change-league-copy">
                This report was opened from a league ID, so there is not a saved Sleeper league list for this session. Stay on this report, or start over to analyze a different league.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="league-switch-footer gap-2 sm:justify-center">
              <button
                type="button"
                onClick={() => setIsChangeLeagueModalOpen(false)}
                className="support-button support-button-compact change-league-stay-button"
              >
                Stay Here
              </button>
              <Button
                type="button"
                onClick={handleStartOver}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 sm:w-auto"
              >
                Analyze Another League
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {loadingDialog}
        {clownEasterEggDialog}
        {adminPermissionsDialog}
      </div>
      </ManagerChampionshipProvider>
    );
  }

  return (
    <div className="home-shell min-h-screen flex flex-col">
      <div className="home-header px-4 py-4 sm:py-5">
        <HomeLogoChrome />
        <HomeHeaderShortcuts
          leagues={cachedLeagueShortcuts}
          users={cachedSleeperUsers}
          activeUsername={sleeperUsername}
          onLeagueSelect={handleCachedLeagueShortcutSelect}
          onUserSelect={handleCachedSleeperUserSelect}
        />
      </div>
      <div className="home-main flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-16">
          <div className="home-hero w-full max-w-3xl space-y-8 sm:space-y-12">
            {/* Main Title */}
            <div className="home-hero-copy space-y-3 sm:space-y-4 text-center">
              <h2 className="athletic-title home-title text-4xl sm:text-6xl md:text-7xl bg-gradient-to-r from-orange-400 via-orange-300 to-yellow-300 bg-clip-text text-transparent" aria-label="Obliterate Your Competition">
                <span>Obliterate Your</span>
                <span>Competition</span>
              </h2>
              <p className="home-subtitle text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto">
                Stop guessing. Start dominating. <span className="home-subtitle-name">Dynasty Degenerates</span> blends dynasty market data, season outlooks, roster context, and AI-driven reads to give you an unfair advantage over the rest of your league.
              </p>
            </div>

            {/* Input Section */}
            <div className="home-analyze-card space-y-4 sm:space-y-6 p-4 sm:p-8">
              <div className="text-center">
                <label className="home-field-label block text-sm font-semibold text-slate-200 mb-3">
                  Enter Your Sleeper Username
                </label>
                <div className="home-username-row flex flex-col gap-2 sm:gap-3 sm:flex-row w-full">
                  <div className="home-autocomplete-anchor flex-1 w-full sm:w-auto">
                    <Input
                      id="sleeper-username"
                      name="sleeper-username"
                      type="text"
                      aria-label="Enter Your Sleeper Username"
                      autoComplete="username"
                      list="sleeper-username-history"
                      placeholder="Sleeper username"
                      value={sleeperUsername}
                      onChange={(e) => setSleeperUsername(e.target.value)}
                      onFocus={() => setFocusedAutocomplete('username')}
                      onBlur={() => window.setTimeout(() => setFocusedAutocomplete(null), 120)}
                      className="w-full bg-slate-900 border-cyan-500/30 text-white placeholder:text-slate-500 h-12 text-base focus:border-cyan-300 text-center sm:text-left"
                      onKeyDown={(e) => e.key === 'Enter' && handleFindLeagues()}
                    />
                    <datalist id="sleeper-username-history">
                      {sleeperUsernameHistory.map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                    {focusedAutocomplete === 'username' ? (
                      <RecentEntrySuggestions
                        label="Recent Sleeper usernames"
                        options={usernameAutocompleteOptions}
                        onSelect={(value) => {
                          setSleeperUsername(value);
                          setFocusedAutocomplete(null);
                        }}
                      />
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    onClick={handleFindLeagues}
                    disabled={userLeaguesMutation.isPending}
                    className="home-find-leagues-button w-full sm:w-auto h-12 shrink-0 rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-5 font-bold text-cyan-100 hover:bg-cyan-400/15"
                  >
                    {userLeaguesMutation.isPending ? 'Finding...' : 'Find Leagues'}
                  </Button>
                </div>
                <p className="home-field-helper text-xs text-slate-400 mt-2">
                  Pick one of your Sleeper leagues and this will run the report automatically.
                </p>
              </div>

              {userLeagues.length > 0 && (
                <div className="home-league-picker">
                  {orderedUserLeagues.map((league) => (
                    <LeaguePickerCard
                      key={league.leagueId}
                      league={league}
                      onSelect={handleAnalyze}
                    />
                  ))}
                </div>
              )}

              <div className="home-id-divider">
                <span>or use a league ID</span>
              </div>

              <div className="text-center">
                <label className="home-field-label block text-sm font-semibold text-slate-200 mb-3">
                  Enter Your Sleeper League ID
                </label>
                <div className="home-autocomplete-anchor w-full">
                  <Input
                    id="sleeper-league-id"
                    name="sleeper-league-id"
                    type="text"
                    aria-label="Enter Your Sleeper League ID"
                    autoComplete="on"
                    inputMode="numeric"
                    list="sleeper-league-id-history"
                    placeholder="Find in your Sleeper app settings or URL"
                    value={leagueId}
                    onChange={(e) => setLeagueId(e.target.value)}
                    onFocus={() => setFocusedAutocomplete('league')}
                    onBlur={() => window.setTimeout(() => setFocusedAutocomplete(null), 120)}
                    className="w-full bg-slate-900 border-orange-500/30 text-white placeholder:text-slate-500 h-12 text-base focus:border-orange-400 text-center"
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  />
                  <datalist id="sleeper-league-id-history">
                    {leagueIdHistory.map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                  {focusedAutocomplete === 'league' ? (
                    <RecentEntrySuggestions
                      label="Recent Sleeper league IDs"
                      options={leagueIdAutocompleteOptions}
                      onSelect={(value) => {
                        setLeagueId(value);
                        setFocusedAutocomplete(null);
                      }}
                    />
                  ) : null}
                </div>
                <p className="home-field-helper text-xs text-slate-400 mt-2">
                  In the Sleeper app, open your league → go to General Settings → scroll to the bottom to find your League ID.
                </p>
              </div>

              <Button
                onClick={() => handleAnalyze()}
                disabled={isLoading}
                className="home-analyze-button w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-base gap-2 rounded-lg transition-all duration-200 shadow-lg"
              >
                <Zap size={20} />
                Run Degenerate Analysis
              </Button>
            </div>

            {/* Features Grid */}
            <div className="home-feature-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
              <div className="home-feature-card home-feature-green p-4 sm:p-6 space-y-3">
                <div className="home-feature-heading">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-white">League Overview</h3>
                </div>
                <p className="text-sm text-slate-400">
                  See every manager's total blended value with position-aware roster context. No bullshit, just the numbers.
                </p>
              </div>

              <div className="home-feature-card home-feature-blue p-4 sm:p-6 space-y-3">
                <div className="home-feature-heading">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-white">Trade History</h3>
                </div>
                <p className="text-sm text-slate-400">
                  Track how your trades are valued today compared to when you made them. See who's winning and who's getting fleeced.
                </p>
              </div>

              <div className="home-feature-card home-feature-purple p-4 sm:p-6 space-y-3">
                <div className="home-feature-heading">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <ListOrdered className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-white">Player Rankings</h3>
                </div>
                <p className="text-sm text-slate-400">
                  Browse league-matched dynasty and college prospect boards across SuperFlex, Standard, and TE-premium formats.
                </p>
              </div>
            </div>
          </div>
      </div>

      {!reportData && (
        <div className="home-footer mt-auto px-4 py-6 sm:py-8">
          <HomeFooterChrome showBrand={!isLoading} />
        </div>
      )}
      {loadingDialog}
      {clownEasterEggDialog}
      {adminPermissionsDialog}
    </div>
  );
}

function CollapsibleReportSection({
  title,
  kicker,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  title: string;
  kicker?: string;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const nextOpen = event.currentTarget.open;
    setIsOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <details className="report-section report-disclosure" open={isOpen} onToggle={handleToggle}>
      <summary className="report-disclosure-summary">
        <ReportSectionHeader title={title} kicker={kicker} />
        <ChevronDown className="report-disclosure-icon" aria-hidden="true" />
      </summary>
      <div className="report-disclosure-body">
        <div className="report-disclosure-body-inner">
          {children}
        </div>
      </div>
    </details>
  );
}

function ModalReportSection({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="report-section report-disclosure report-modal-section">
      <button
        type="button"
        className="report-disclosure-summary report-modal-trigger"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <ReportSectionHeader title={title} kicker={kicker} />
        <ChevronDown className="report-disclosure-icon" aria-hidden="true" />
      </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="full-trade-ledger-modal flex max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border-cyan-300/20 bg-slate-950 p-0 text-slate-100 shadow-2xl shadow-black/70 sm:max-h-[90vh] sm:max-w-6xl">
          <DialogHeader className="trade-ledger-modal-header">
            <DialogTitle className="trade-ledger-modal-title">
              {title}
            </DialogTitle>
            {kicker && (
              <DialogDescription className="trade-ledger-modal-kicker">
                {kicker}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="trade-ledger-modal-body">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
