import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { CheckCircle2, ChevronDown, Zap, TrendingUp, BarChart3, Zap as ZapIcon, Repeat2, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { SupportButton } from '@/components/SupportButton';
import { FeedbackButton } from '@/components/FeedbackButton';
import {
  WeeklyMomentumTable,
  ProjectedMoversTable,
  TradeWarRoom,
  TradeProfitLeaderboardTable,
  TradeHistoryTable,
  ManagerPositionCountsTable,
  OwnerIntelMatrix,
  LeagueCommandCenter,
  TradeMarketRadar,
  TradeTheftDetector,
  TrendingPlayersTable,
  WaiverIntelligencePanel,
  RecentTransactionsPanel,
} from '@/components/ReportTables';
import { DraftAnalysis } from '@/components/DraftAnalysis';
import { ManagerChampionshipProvider } from '@/components/ManagerChampionships';
import type { ReportData } from '@shared/types';

const DYNASTY_LOGO_SRC = '/assets/dynasty-logo-cropped.png?v=20260428-cyan-lines';
const REPORT_CACHE_KEY = 'dynasty-degenerates:last-report:v6';
const LAST_LEAGUE_KEY = 'dynasty-degenerates:last-league:v1';
const SLEEPER_SESSION_KEY = 'dynasty-degenerates:sleeper-session:v1';
const LEAGUE_ID_HISTORY_KEY = 'dynasty-degenerates:league-id-history:v1';
const SLEEPER_USERNAME_HISTORY_KEY = 'dynasty-degenerates:sleeper-username-history:v1';
const CACHED_SLEEPER_USERS_KEY = 'dynasty-degenerates:sleeper-user-history:v1';
const MAX_AUTOCOMPLETE_HISTORY = 12;
const MAX_CACHED_SLEEPER_USERS = 5;
const MAX_CACHED_LEAGUE_SHORTCUTS = 4;
const ADMIN_VALUE_DIAGNOSTIC_START_DATE = '2026-04-30';
const CLOWN_EASTER_EGG_USERNAMES = new Set(['armchairgmzar', 'tjsmoov']);
const PRIVILEGED_REPORT_VIEWERS = new Set(['mynameisbillex', 'awwqq', 'zojozo']);

function getKtcAdminIdentity(user?: SleeperUserSession | null, fallbackUsername?: string): string | null {
  return user?.username || user?.displayName || fallbackUsername || null;
}

function normalizeViewerIdentifier(value?: string | null): string {
  return value?.trim().toLowerCase() || '';
}

function isPrivilegedReportViewer(...identifiers: Array<string | null | undefined>): boolean {
  return identifiers
    .map(normalizeViewerIdentifier)
    .some((value) => value && PRIVILEGED_REPORT_VIEWERS.has(value));
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

type SleeperUserSession = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type AdminViewMode = 'admin' | 'regular';

type CachedReport = {
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
      .slice(0, MAX_CACHED_LEAGUE_SHORTCUTS)
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
    .slice(0, MAX_CACHED_LEAGUE_SHORTCUTS);
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
  const orderedIds = [
    ...(cachedUser?.recentLeagueIds || []),
    ...leagues.map((league) => league.leagueId),
  ];
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
    .slice(0, MAX_CACHED_LEAGUE_SHORTCUTS);
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
    .slice(0, MAX_CACHED_LEAGUE_SHORTCUTS);
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

  return (
    <div className={`league-shortcut-switcher${className ? ` ${className}` : ''}`} aria-label="Recent league shortcuts">
      <span className="league-shortcut-label">{label}</span>
      <div className="league-shortcut-stack">
        {leagues.slice(0, MAX_CACHED_LEAGUE_SHORTCUTS).map((league, index) => {
          const isActive = league.leagueId === activeLeagueId;
          return (
            <button
              key={league.leagueId}
              type="button"
              className={`league-shortcut-button${isActive ? ' is-active' : ''}`}
              onClick={() => {
                if (!isActive) onSelect(league.leagueId);
              }}
              style={{ zIndex: index + 1 }}
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
        label="Leagues"
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

function HomeFooterChrome() {
  return (
    <div className="home-footer-inner max-w-7xl mx-auto">
      <HomeActionRow />
      <HomeBrandLockup />
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

function getLeagueCardNameLines(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const normalizedName = words.join(' ');

  if (words.length < 3 || normalizedName.length <= 16) {
    return [normalizedName || name];
  }

  let bestSplitIndex = 1;
  let smallestLengthDifference = Number.POSITIVE_INFINITY;

  for (let index = 1; index < words.length; index += 1) {
    const leftLength = words.slice(0, index).join(' ').length;
    const rightLength = words.slice(index).join(' ').length;
    const lengthDifference = Math.abs(leftLength - rightLength);

    if (lengthDifference < smallestLengthDifference) {
      bestSplitIndex = index;
      smallestLengthDifference = lengthDifference;
    }
  }

  return [
    words.slice(0, bestSplitIndex).join(' '),
    words.slice(bestSplitIndex).join(' '),
  ];
}

function LeaguePickerCard({
  league,
  onSelect,
}: {
  league: SleeperLeagueOption;
  onSelect: (leagueId: string) => void;
}) {
  const leagueNameLines = getLeagueCardNameLines(league.name);

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
            className="home-league-card-name"
            aria-label={league.name}
          >
            {leagueNameLines.map((line, index) => (
              <span key={`${line}-${index}`} className="home-league-card-name-line">
                {line}
              </span>
            ))}
          </span>
        </span>
      </div>
      <span className="home-league-card-format home-league-card-format-desktop">
        {league.format || `${league.totalRosters || '?'}-Team Dynasty`}
      </span>
      <span className="home-league-card-format home-league-card-format-mobile">
        {league.mobileFormat || `${league.totalRosters || '?'}-Team Dynasty`}
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

type OutlookPlayer = ReportData['projectedRisers'][number];

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
    addUniqueDiagnosticRow(rows, seen, {
      id: 'league-lineup-shape',
      area: 'League format',
      item: `${leagueDiagnostics.teamCount}-team ${leagueDiagnostics.valueMode}`,
      status: 'Dynamic input',
      tone: 'info',
      note: `${leagueDiagnostics.lineupSlotSummary}. Starter cutoffs for this league: ${leagueDiagnostics.starterCountSummary}.`,
    });
    addUniqueDiagnosticRow(rows, seen, {
      id: 'starter-bench-calculation',
      area: 'Starter math',
      item: 'Starters and bench',
      status: 'League-specific',
      tone: 'good',
      note: `${leagueDiagnostics.starterCalculation} ${leagueDiagnostics.benchCalculation}`,
    });
    addUniqueDiagnosticRow(rows, seen, {
      id: 'tradeable-depth-calculation',
      area: 'Depth math',
      item: 'Tradeable depth',
      status: 'Active bench only',
      tone: 'good',
      note: leagueDiagnostics.tradeableDepthCalculation,
    });
    addUniqueDiagnosticRow(rows, seen, {
      id: 'league-scoring-context',
      area: 'Scoring format',
      item: leagueDiagnostics.scoringSummary,
      status: leagueDiagnostics.tightEndPremium > 0 || leagueDiagnostics.receptionScoring !== 1 ? 'Adjustment needed' : 'Closest profile',
      tone: leagueDiagnostics.tightEndPremium > 0 || leagueDiagnostics.receptionScoring !== 1 ? 'warn' : 'info',
      note: leagueDiagnostics.tightEndPremium > 0
        ? `Sleeper scoring gives tight ends +${leagueDiagnostics.tightEndPremium} per reception on top of base reception scoring. TE values should eventually use a dedicated TEP market profile.`
        : `Sleeper reception scoring is ${leagueDiagnostics.receptionScoring}; values currently use the closest stored market profile, not every scoring variant.`,
    });
    addUniqueDiagnosticRow(rows, seen, {
      id: 'value-profile-storage',
      area: 'Daily value logs',
      item: `${leagueDiagnostics.valueSnapshotProfileCount} stored profile${leagueDiagnostics.valueSnapshotProfileCount === 1 ? '' : 's'}`,
      status: 'Needs expansion',
      tone: 'warn',
      note: `${leagueDiagnostics.ktcProfileLabel} Tracked profiles: ${leagueDiagnostics.valueSnapshotProfiles.join(', ')}.`,
    });
    leagueDiagnostics.valueLimitations.forEach((limitation, index) => {
      addUniqueDiagnosticRow(rows, seen, {
        id: `value-limitation-${index}`,
        area: 'Value coverage',
        item: `Limit ${index + 1}`,
        status: 'Assumption',
        tone: 'warn',
        note: limitation,
      });
    });
  }

  currentSnapshotGaps.forEach((dateKey) => {
    addUniqueDiagnosticRow(rows, seen, {
      id: `snapshot-${dateKey}`,
      area: 'Value blend',
      item: dateKey,
      status: 'Missing day',
      tone: 'danger',
      note: 'Daily blend was not stored, so any comparison touching this date is less exact.',
    });
  });

  const playersWithoutSourceMetadata = outlookPlayers
    .filter((player) => player.player_id && !getOutlookPlayerValueProfile(reportData, player));
  if (playersWithoutSourceMetadata.length) {
    addUniqueDiagnosticRow(rows, seen, {
      id: 'source-metadata-missing',
      area: 'Player values',
      item: `${playersWithoutSourceMetadata.length} Outlook players`,
      status: 'Source check unavailable',
      tone: 'warn',
      note: 'The displayed player values exist, but this report payload did not include source-level blend detail.',
    });
  }

  outlookPlayers.forEach((player) => {
    const profile = getOutlookPlayerValueProfile(reportData, player);
    if (!profile) return;

    const sources = profile.sources || [];
    const hasCoreMarketSource = Boolean(profile.marketKtc || profile.fantasyCalcDynasty || profile.dynastyProcess);
    if (sources.length >= 2 && hasCoreMarketSource) return;

    addUniqueDiagnosticRow(rows, seen, {
      id: `thin-value-${player.player_id || player.name}`,
      area: 'Player value',
      item: player.name,
      status: sources.length ? 'Thin blend' : 'No source list',
      tone: sources.length ? 'warn' : 'danger',
      note: `${sources.length || 0} source${sources.length === 1 ? '' : 's'} found for the current value; projection is more assumption-heavy.`,
    });
  });

  const missingAgePlayers = outlookPlayers.filter((player) => player.age == null);
  if (missingAgePlayers.length) {
    addUniqueDiagnosticRow(rows, seen, {
      id: 'missing-age-projection',
      area: 'Projection input',
      item: `${missingAgePlayers.length} Outlook players`,
      status: 'Age missing',
      tone: 'warn',
      note: 'One-year projection falls back to the current value when the age curve cannot be applied.',
    });
  }

  if (!rows.length) {
    rows.push({
      id: 'no-active-diagnostics',
      area: 'Value assumptions',
      item: 'Current report',
      status: 'No active flags',
      tone: 'good',
      note: 'No missing post-cutoff snapshot days or thin Outlook value blends were detected. League-format notes still show what is calculated versus inferred.',
    });
  }

  return rows.slice(0, 32);
}

function AdminValueDiagnosticsTable({ reportData }: { reportData: ReportData }) {
  const { data } = trpc.system.snapshotCoverage.useQuery(
    { lookbackDays: 14 },
    { refetchOnWindowFocus: false, staleTime: 1000 * 60 * 5 }
  );

  const rows = buildAdminValueDiagnostics(reportData, data?.missingDateKeys || []);

  return (
    <div className="admin-value-diagnostics">
      <p className="admin-value-diagnostics-intro">
        Admin eyes only. This shows what is calculated from Sleeper league settings, what is covered by stored market values, and what is still an assumption.
      </p>
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
  const [isLeaguePickerOpen, setIsLeaguePickerOpen] = useState(false);
  const [isChangeLeagueModalOpen, setIsChangeLeagueModalOpen] = useState(false);
  const [isClownModalOpen, setIsClownModalOpen] = useState(false);
  const [isAdminPermissionsModalOpen, setIsAdminPermissionsModalOpen] = useState(false);
  const successTransitionTimerRef = useRef<number | null>(null);

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
      if (successTransitionTimerRef.current) {
        window.clearTimeout(successTransitionTimerRef.current);
      }
      setLeagueId(data.leagueId);
      setLeagueName(data.leagueName);
      setLeagueLogo(data.leagueLogo);
      setLeagueFormat(data.leagueFormat);
      rememberCurrentUserLeagueShortcut(data.leagueId);
      setAnalysisCompleteMessage({
        leagueName: data.leagueName,
        leagueFormat: data.leagueFormat,
        leagueLogo: data.leagueLogo,
      });
      successTransitionTimerRef.current = window.setTimeout(() => {
        setReportData(data.reportData);
        setIsLoading(false);
        setAnalysisCompleteMessage(null);
        successTransitionTimerRef.current = null;
      }, 1400);
    },
    onError: (error) => {
      if (successTransitionTimerRef.current) {
        window.clearTimeout(successTransitionTimerRef.current);
        successTransitionTimerRef.current = null;
      }
      setAnalysisCompleteMessage(null);
      setIsLoading(false);
      toast.error(`Error: ${error.message}`);
    },
  });

  useEffect(() => () => {
    if (successTransitionTimerRef.current) {
      window.clearTimeout(successTransitionTimerRef.current);
    }
  }, []);

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
      toast.success(`Found ${data.leagues.length} Sleeper league${data.leagues.length === 1 ? '' : 's'}`);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
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
      const cachedReport = localStorage.getItem(REPORT_CACHE_KEY);
      if (cachedReport) {
        const parsed = JSON.parse(cachedReport) as CachedReport;
        setLeagueId(parsed.leagueId);
        setLeagueName(parsed.leagueName);
        setLeagueLogo(parsed.leagueLogo);
        setLeagueFormat(parsed.leagueFormat);
        setActiveTab(parsed.activeTab || 'overview');
        setReportData(parsed.reportData);
        setLeagueIdHistory(rememberAutocompleteValue(LEAGUE_ID_HISTORY_KEY, parsed.leagueId));
        return;
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
      localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify({ ...lastLeague, reportData }));
    } catch {
      localStorage.removeItem(REPORT_CACHE_KEY);
      try {
        localStorage.setItem(LAST_LEAGUE_KEY, JSON.stringify(lastLeague));
      } catch {
        localStorage.removeItem(LAST_LEAGUE_KEY);
      }
    }
  }, [activeTab, leagueFormat, leagueId, leagueLogo, leagueName, reportData]);

  const handleAnalyze = async (targetLeagueId = leagueId) => {
    const nextLeagueId = targetLeagueId.trim();
    if (!nextLeagueId) {
      toast.error('Please enter a league ID');
      return;
    }
    setLeagueId(nextLeagueId);
    rememberLeagueId(nextLeagueId);
    setAnalysisCompleteMessage(null);
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
    if (successTransitionTimerRef.current) {
      window.clearTimeout(successTransitionTimerRef.current);
      successTransitionTimerRef.current = null;
    }
    setIsLeaguePickerOpen(false);
    setIsChangeLeagueModalOpen(false);
    setAnalysisCompleteMessage(null);
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
    setAnalysisCompleteMessage(null);
    setIsLoading(true);
    analyzeMutation.mutate({ leagueId: nextLeagueId, viewerUserId: cachedUser?.userId || viewerUserId || undefined });
  };

  const usernameAutocompleteOptions = getFilteredAutocompleteOptions(sleeperUsernameHistory, sleeperUsername);
  const leagueIdAutocompleteOptions = getFilteredAutocompleteOptions(leagueIdHistory, leagueId);
  const activeCachedSleeperUser = findCachedSleeperUser(cachedSleeperUsers, viewerUserId, sleeperUsername);
  const cachedLeagueShortcuts = getLeagueShortcutsForUser(
    activeCachedSleeperUser,
    userLeagues,
    reportData ? leagueId : null
  );
  const isPrivilegedViewer = isPrivilegedReportViewer(viewerUserId, viewerUsername, sleeperUsername);
  const canViewMomentumTab = isPrivilegedViewer && adminViewMode === 'admin';
  const resolvedActiveTab = !canViewMomentumTab && activeTab === 'momentum' ? 'overview' : activeTab;
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
    }
  }, [activeTab, canViewMomentumTab]);

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
        className="border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-lg"
      >
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="athletic-headline text-3xl text-orange-400">
            Admin Permissions
          </DialogTitle>
          <DialogDescription className="text-cyan-100/75">
            This account can unlock admin-only report tools for this session.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 px-4 py-4 text-center text-sm font-semibold text-slate-200">
          Choose Admin Permissions to show the hidden Momentum and blended-value tools, or use the regular view to see the report like everyone else.
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
            Admin Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (reportData) {
    return (
      <ManagerChampionshipProvider championships={reportData.managerChampionships}>
      <div className="report-shell min-h-screen flex flex-col">
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
            <TabsList className={`report-tabs ${canViewMomentumTab ? 'report-tabs-five' : 'report-tabs-four'}`}>
              <TabsTrigger value="overview" className="report-tab">
                <BarChart3 className="h-4 w-4" />
                <span>Overview</span>
              </TabsTrigger>

              {canViewMomentumTab && (
                <TabsTrigger value="momentum" className="report-tab">
                  <TrendingUp className="h-4 w-4" />
                  <span className="report-tab-label-full">Weekly Momentum</span>
                  <span className="report-tab-label-short">Momentum</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="projections" className="report-tab">
                <ZapIcon className="h-4 w-4" />
                <span className="report-tab-label-full">1-Year Outlook</span>
                <span className="report-tab-label-short">Outlook</span>
              </TabsTrigger>
              <TabsTrigger value="trades" className="report-tab">
                <Repeat2 className="h-4 w-4" />
                <span className="report-tab-label-full">Trade History</span>
                <span className="report-tab-label-short">Trades</span>
              </TabsTrigger>

              <TabsTrigger value="draft" className="report-tab">
                <ClipboardList className="h-4 w-4" />
                <span className="report-tab-label-full">Draft History</span>
                <span className="report-tab-label-short">Draft</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="report-tab-content">
              <div className="space-y-6 sm:space-y-8">
                {(() => {
                  const hasTaxiTriage = reportData.managerRosterIntelligence?.some((row) => (row.taxiTriage?.items.length || 0) > 0);
                  return (
                    <>
                <CollapsibleReportSection title="Owner Intel Lab" kicker="Actionable owner reads">
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
                <CollapsibleReportSection title="Taxi Squad Triage" kicker="Promote, stash, trade, cut">
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
                  <CollapsibleReportSection title="Manager Position Counts" kicker="Starters vs rostered">
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
                      managerAvatars={reportData.managerAvatars}
                      playerDetailsById={reportData.playerDetailsById}
                      leagueId={leagueId}
                      leagueLogo={leagueLogo}
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

            <TabsContent value="projections" className="report-tab-content">
              <div className="space-y-6 sm:space-y-8">
                <div className="mx-auto max-w-2xl rounded-xl border border-cyan-400/20 bg-slate-900/55 px-4 py-4 text-center shadow-lg shadow-black/20">
                  <p className="text-sm leading-relaxed text-slate-300">
                    <span className="report-intro-gradient-title">One-Year Outlook</span>
                    <span className="block">This projects where player values could sit next offseason based on age curve and position trends.</span>
                  </p>
                </div>
                <CollapsibleReportSection title="2027 Value Climbers" kicker="Next-year upside">
                  <ProjectedMoversTable
                    data={reportData.projectedRisers}
                    title="2027 Value Climbers"
                    managerAvatars={reportData.managerAvatars}
                    playerDetailsById={reportData.playerDetailsById}
                    leagueId={leagueId}
                    leagueLogo={leagueLogo}
                    viewerManager={reportData.viewerManager}
                  />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="2027 Value Droppers" kicker="Next-year risk">
                  <ProjectedMoversTable
                    data={reportData.projectedFallers}
                    title="2027 Value Droppers"
                    managerAvatars={reportData.managerAvatars}
                    playerDetailsById={reportData.playerDetailsById}
                    leagueId={leagueId}
                    leagueLogo={leagueLogo}
                    viewerManager={reportData.viewerManager}
                  />
                </CollapsibleReportSection>
                {canViewMomentumTab && (
                  <CollapsibleReportSection title="Admin Eyes Only: Value Assumptions" kicker="Hidden diagnostics">
                    <AdminValueDiagnosticsTable reportData={reportData} />
                  </CollapsibleReportSection>
                )}
              </div>
            </TabsContent>

            <TabsContent value="trades" className="report-tab-content">
              <div className="trade-sections space-y-6 sm:space-y-8">
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
                  />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="Full Trade Ledger" kicker="Every completed deal">
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
                  />
                </CollapsibleReportSection>
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
              {userLeagues.map((league) => (
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
        {isLoading ? (
          <div className="home-loading-stage w-full max-w-2xl">
            <LoadingAnimation isComplete={Boolean(analysisCompleteMessage)} />
            {analysisCompleteMessage && (
              <div className="loading-success-card" role="status" aria-live="polite">
                <div className="loading-success-icon">
                  {analysisCompleteMessage.leagueLogo ? (
                    <img
                      src={analysisCompleteMessage.leagueLogo}
                      alt=""
                    />
                  ) : (
                    <CheckCircle2 aria-hidden="true" />
                  )}
                </div>
                <p className="loading-success-kicker">Report Generated</p>
                <h2 className={getLoadingSuccessTitleClassName(analysisCompleteMessage.leagueName || 'League report')}>
                  {analysisCompleteMessage.leagueName || 'League report'}
                </h2>
                {analysisCompleteMessage.leagueFormat && (
                  <p className="loading-success-format">{analysisCompleteMessage.leagueFormat}</p>
                )}
                <div className="loading-success-bar" aria-hidden="true" />
              </div>
            )}
          </div>
        ) : (
          <div className="home-hero w-full max-w-3xl space-y-8 sm:space-y-12">
            {/* Main Title */}
            <div className="space-y-3 sm:space-y-4 text-center">
              <h2 className="athletic-title home-title text-4xl sm:text-6xl md:text-7xl bg-gradient-to-r from-orange-400 via-orange-300 to-yellow-300 bg-clip-text text-transparent">
                Obliterate Your Competition
              </h2>
              <p className="home-subtitle text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto">
                Stop guessing. Start dominating. <span className="home-subtitle-name">Dynasty Degenerates</span> blends dynasty market data, season outlooks, roster context, and AI-driven reads to give you an unfair advantage over the rest of your league.
              </p>
            </div>

            {/* Input Section */}
            <div className="home-analyze-card space-y-4 sm:space-y-6 p-4 sm:p-8">
              <div className="text-center">
                <label className="block text-sm font-semibold text-slate-200 mb-3">
                  Enter Your Sleeper Username
                </label>
                <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row w-full">
                  <div className="home-autocomplete-anchor flex-1 w-full sm:w-auto">
                    <Input
                      id="sleeper-username"
                      name="sleeper-username"
                      type="text"
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
                    className="w-full sm:w-auto h-12 shrink-0 rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-5 font-bold text-cyan-100 hover:bg-cyan-400/15"
                  >
                    {userLeaguesMutation.isPending ? 'Finding...' : 'Find Leagues'}
                  </Button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Pick one of your Sleeper leagues and this will run the report automatically.
                </p>
              </div>

              {userLeagues.length > 0 && (
                <div className="home-league-picker">
                  {userLeagues.map((league) => (
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
                <label className="block text-sm font-semibold text-slate-200 mb-3">
                  Enter Your Sleeper League ID
                </label>
                <div className="home-autocomplete-anchor w-full">
                  <Input
                    id="sleeper-league-id"
                    name="sleeper-league-id"
                    type="text"
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
                <p className="text-xs text-slate-400 mt-2">
                  In the Sleeper app, open your league → go to General Settings → scroll to the bottom to find your League ID.
                </p>
              </div>

              <Button
                onClick={() => handleAnalyze()}
                disabled={isLoading}
                className="home-analyze-button w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-base gap-2 rounded-lg transition-all duration-200 shadow-lg"
              >
                <Zap size={20} />
                Illegally Scraping All Data
              </Button>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
              <div className="home-feature-card home-feature-green p-4 sm:p-6 space-y-3">
                <div className="home-feature-heading">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-white">League Overview</h3>
                </div>
                <p className="text-sm text-slate-400">
                  See every manager's total blended value with positional rankings and 2027 projections. No bullshit, just the numbers.
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
                    <ZapIcon className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-white">Player Projections</h3>
                </div>
                <p className="text-sm text-slate-400">
                  AI-powered age and position-based value projections for 2027. Get ahead of the market before everyone else does.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {!reportData && (
        <div className="home-footer mt-auto px-4 py-6 sm:py-8">
          <HomeFooterChrome />
        </div>
      )}
      {clownEasterEggDialog}
      {adminPermissionsDialog}
    </div>
  );
}

function SectionTitle({
  title,
  kicker,
}: {
  title: string;
  kicker?: string;
}) {
  return (
    <div className="mb-4 text-center sm:mb-5">
      {kicker && (
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
          {kicker}
        </p>
      )}
      <h3 className="athletic-headline mt-1 text-xl font-black text-orange-400 sm:text-2xl">
        {title}
      </h3>
    </div>
  );
}

function CollapsibleReportSection({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <details className="report-section report-disclosure">
      <summary className="report-disclosure-summary">
        <SectionTitle title={title} kicker={kicker} />
        <ChevronDown className="report-disclosure-icon" aria-hidden="true" />
      </summary>
      <div className="report-disclosure-body">
        {children}
      </div>
    </details>
  );
}
