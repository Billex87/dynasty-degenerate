import { useEffect, useState, type ReactNode } from 'react';
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
import { ChevronDown, Zap, TrendingUp, BarChart3, Zap as ZapIcon, Grid3x3, Repeat2, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { SupportButton } from '@/components/SupportButton';
import {
  WeeklyMomentumTable,
  ProjectedMoversTable,
  TradeWarRoom,
  TradeProfitLeaderboardTable,
  TradeHistoryTable,
  PositionAnalysisTable,
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
const MAX_AUTOCOMPLETE_HISTORY = 12;
const CLOWN_EASTER_EGG_USERNAMES = new Set(['armchairgmzar', 'tjsmoov']);

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
  savedAt: number;
};

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

function LeaguePickerCard({
  league,
  onSelect,
}: {
  league: SleeperLeagueOption;
  onSelect: (leagueId: string) => void;
}) {
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
        {league.avatarUrl ? (
          <img src={league.avatarUrl} alt={`${league.name} icon`} className="home-league-card-icon" />
        ) : (
          <span className="home-league-card-icon home-league-card-fallback">
            {league.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 text-left">
          <span className="home-league-card-name">{league.name}</span>
          <span className="home-league-card-format home-league-card-format-desktop">
            {league.format || `${league.totalRosters || '?'}-Team Dynasty`}
          </span>
          <span className="home-league-card-format home-league-card-format-mobile">
            {league.mobileFormat || `${league.totalRosters || '?'}-Team Dynasty`}
          </span>
        </span>
      </div>
      <div className="home-league-card-pills" aria-label={`${league.name} current league standing and power rank`}>
        {league.powerRank ? (
          <span className="home-league-pill">Power #{league.powerRank}</span>
        ) : null}
        {league.standingsRank ? (
          <span className="home-league-pill">Standing #{league.standingsRank}</span>
        ) : null}
      </div>
    </button>
  );
}

export default function Home() {
  const [leagueId, setLeagueId] = useState('');
  const [sleeperUsername, setSleeperUsername] = useState('');
  const [leagueIdHistory, setLeagueIdHistory] = useState<string[]>(() => readAutocompleteHistory(LEAGUE_ID_HISTORY_KEY));
  const [sleeperUsernameHistory, setSleeperUsernameHistory] = useState<string[]>(() => readAutocompleteHistory(SLEEPER_USERNAME_HISTORY_KEY));
  const [focusedAutocomplete, setFocusedAutocomplete] = useState<'username' | 'league' | null>(null);
  const [userLeagues, setUserLeagues] = useState<SleeperLeagueOption[]>([]);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [leagueName, setLeagueName] = useState('');
  const [leagueLogo, setLeagueLogo] = useState<string | null>(null);
  const [leagueFormat, setLeagueFormat] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLeaguePickerOpen, setIsLeaguePickerOpen] = useState(false);
  const [isClownModalOpen, setIsClownModalOpen] = useState(false);

  const rememberLeagueId = (value: string) => {
    setLeagueIdHistory(rememberAutocompleteValue(LEAGUE_ID_HISTORY_KEY, value));
  };

  const rememberSleeperUsername = (value: string) => {
    setSleeperUsernameHistory(rememberAutocompleteValue(SLEEPER_USERNAME_HISTORY_KEY, value));
  };

  const analyzeMutation = trpc.league.analyze.useMutation({
    onSuccess: (data) => {
      setLeagueId(data.leagueId);
      setReportData(data.reportData);
      setLeagueName(data.leagueName);
      setLeagueLogo(data.leagueLogo);
      setLeagueFormat(data.leagueFormat);
      setIsLoading(false);
      toast.success('Report generated successfully!');
    },
    onError: (error) => {
      setIsLoading(false);
      toast.error(`Error: ${error.message}`);
    },
  });

  const userLeaguesMutation = trpc.league.getUserLeagues.useMutation({
    onSuccess: (data, variables) => {
      const username = variables.username.trim();
      setUserLeagues(data.leagues);
      setViewerUserId(data.user?.userId || null);
      if (data.leagues.length === 0) {
        toast.error('No Sleeper leagues found for this username');
        return;
      }
      rememberSleeperUsername(username);
      try {
        localStorage.setItem(
          SLEEPER_SESSION_KEY,
          JSON.stringify({
            username,
            user: data.user || null,
            leagues: data.leagues,
            savedAt: Date.now(),
          } satisfies SleeperSession)
        );
      } catch {
        // Losing this cache only affects the league switcher, not the report itself.
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
        setSleeperUsername(parsed.username || '');
        restoredViewerUserId = parsed.user?.userId || null;
        setViewerUserId(restoredViewerUserId);
        if (parsed.username) {
          setSleeperUsernameHistory(rememberAutocompleteValue(SLEEPER_USERNAME_HISTORY_KEY, parsed.username));
        }
        setUserLeagues(Array.isArray(parsed.leagues) ? parsed.leagues : []);
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

  const handleClownDismiss = () => {
    setIsClownModalOpen(false);
    setSleeperUsername('');
    setUserLeagues([]);
    setFocusedAutocomplete(null);
  };

  const handleStartOver = () => {
    localStorage.removeItem(REPORT_CACHE_KEY);
    localStorage.removeItem(LAST_LEAGUE_KEY);
    localStorage.removeItem(SLEEPER_SESSION_KEY);
    setIsLeaguePickerOpen(false);
    setReportData(null);
    setLeagueId('');
    setSleeperUsername('');
    setLeagueName('');
    setLeagueLogo(null);
    setLeagueFormat('');
    setUserLeagues([]);
    setViewerUserId(null);
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
    toast.message('No cached Sleeper leagues yet. Use Analyze Another League to start over.');
  };

  const handleAnalyzeLeagueOption = (nextLeagueId: string) => {
    setIsLeaguePickerOpen(false);
    localStorage.removeItem(REPORT_CACHE_KEY);
    setReportData(null);
    handleAnalyze(nextLeagueId);
  };

  const usernameAutocompleteOptions = getFilteredAutocompleteOptions(sleeperUsernameHistory, sleeperUsername);
  const leagueIdAutocompleteOptions = getFilteredAutocompleteOptions(leagueIdHistory, leagueId);
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

  if (reportData) {
    return (
      <ManagerChampionshipProvider championships={reportData.managerChampionships}>
      <div className="report-shell min-h-screen flex flex-col">
        {/* Premium Header */}
        <div className="report-header sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 md:py-2">
             <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6">
              {/* Left: Brand */}
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

              {/* Center: Logo */}
              <div className="hidden md:col-start-2 md:flex items-center justify-center">
                <img
                  src={DYNASTY_LOGO_SRC}
                  alt="Dynasty Degenerates Logo"
                  className="report-header-logo"
                />
              </div>

              {/* Right: League Name */}
              <button
                type="button"
                className="report-league-lockup md:col-start-3"
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
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="report-tabs">
              <TabsTrigger value="overview" className="report-tab">
                <BarChart3 className="h-4 w-4" />
                <span>Overview</span>
              </TabsTrigger>

              <TabsTrigger value="momentum" className="report-tab">
                <TrendingUp className="h-4 w-4" />
                <span className="report-tab-label-full">Weekly Momentum</span>
                <span className="report-tab-label-short">Momentum</span>
              </TabsTrigger>
              <TabsTrigger value="projections" className="report-tab hidden">
                Projections
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
                <CollapsibleReportSection title="Roster Depth Board" kicker="Starter-grade depth">
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
                {reportData.positionDepth.length > 0 && (
                  <CollapsibleReportSection title="Position Depth Analysis" kicker="Shortage and excess">
                    <PositionAnalysisTable data={reportData.positionDepth} managerAvatars={reportData.managerAvatars} />
                  </CollapsibleReportSection>
                )}
                    </>
                  );
                })()}
              </div>
            </TabsContent>

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
                <CollapsibleReportSection title="Top 10 Weekly Risers" kicker="7-day market gainers">
                   <WeeklyMomentumTable data={reportData.weeklyRisers} title="Weekly Risers" managerAvatars={reportData.managerAvatars} playerDetailsById={reportData.playerDetailsById} leagueId={leagueId} leagueLogo={leagueLogo} />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="Top 10 Weekly Fallers" kicker="7-day market drops">
                   <WeeklyMomentumTable data={reportData.weeklyFallers} title="Weekly Fallers" managerAvatars={reportData.managerAvatars} playerDetailsById={reportData.playerDetailsById} leagueId={leagueId} leagueLogo={leagueLogo} />
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
                  />
                </CollapsibleReportSection>
              </div>
            </TabsContent>

            <TabsContent value="projections" className="report-tab-content">
              <div className="flex justify-center mb-8">
                <div className="max-w-2xl p-4 bg-slate-800/30 rounded border border-slate-700 text-center">
                  <p className="text-sm text-slate-300"><span className="text-amber-400 font-semibold">One-Year Projection:</span> These values predict where players will be valued one year from now based on age and position trends.</p>
                </div>
              </div>
              <div className="space-y-8">
                <div>
                  <div className="space-y-2 mb-4">
                    <h3 className="text-center text-2xl font-bold text-emerald-400 mb-6">Top Weekly Risers</h3>
                    <p className="text-sm text-slate-400 text-center">Players about to make your league mates look stupid next year.</p>
                  </div>
                   <ProjectedMoversTable data={reportData.projectedRisers} title="Top Weekly Risers" managerAvatars={reportData.managerAvatars} playerDetailsById={reportData.playerDetailsById} leagueId={leagueId} leagueLogo={leagueLogo} />
                </div>
                <div>
                  <div className="space-y-2 mb-4">
                    <h3 className="text-center text-2xl font-bold text-red-400 mb-6">Top Weekly Fallers</h3>
                    <p className="text-sm text-slate-400 text-center">Players about to tank your roster value.</p>
                  </div>
                   <ProjectedMoversTable data={reportData.projectedFallers} title="Top Weekly Fallers" managerAvatars={reportData.managerAvatars} playerDetailsById={reportData.playerDetailsById} leagueId={leagueId} leagueLogo={leagueLogo} />
                </div>
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
                className="border-orange-500/30 text-orange-300 hover:bg-orange-500/10"
              >
                Analyze Another League
              </Button>
              <SupportButton compact />
            </div>
          </div>
        </div>

        <Dialog open={isLeaguePickerOpen} onOpenChange={setIsLeaguePickerOpen}>
          <DialogContent className="league-switch-dialog border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-2xl">
            <DialogHeader className="text-center">
              <DialogTitle className="athletic-headline text-3xl text-orange-400">
                Pick Another League
              </DialogTitle>
              <DialogDescription className="text-cyan-100/70">
                Signed in as {sleeperUsername || 'your Sleeper account'}. Choose one of your current Sleeper leagues.
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
                className="w-full border-orange-500/30 text-orange-300 hover:bg-orange-500/10 sm:w-auto"
              >
                Analyze Another League
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {clownEasterEggDialog}
      </div>
      </ManagerChampionshipProvider>
    );
  }

  return (
    <div className="home-shell min-h-screen flex flex-col">
           <div className="home-header px-4 py-6 sm:py-8">
        <div className="home-header-inner max-w-7xl mx-auto flex flex-col items-center justify-center text-center">
          <h1 className="home-header-title athletic-title mb-2">
            Dynasty<br />Degenerates
          </h1>
          <p className="home-header-tagline">
            For Degens, By Degens
          </p>
        </div>
      </div>  <div className="home-main flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-16">
        {isLoading ? (
          <div className="w-full max-w-2xl">
            <LoadingAnimation />
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
              <div className="home-support-row">
                <SupportButton />
              </div>
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
                  See every manager's total KTC value with positional rankings and 2027 projections. No bullshit, just the numbers.
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

      {/* Premium Footer */}
      {!reportData && !isLoading && (
      <div className="home-footer mt-auto flex flex-col">
        <div className="hidden sm:block max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8 mb-6 sm:mb-8">
            <div className="text-center">
              <h4 className="font-bold text-orange-400 mb-3">What We Do</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>Scrape Sleeper data in real-time</li>
                <li>Calculate KTC player values</li>
                <li>Track trade profitability</li>
                <li>Project future value</li>
              </ul>
            </div>
            <div className="text-center">
              <h4 className="font-bold text-orange-400 mb-3">Data Sources</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>Sleeper App</li>
                <li>KeepTradeCut</li>
                <li>FlockFantasy</li>
                <li>Real League Data</li>
              </ul>
            </div>
            <div className="text-center">
              <h4 className="font-bold text-orange-400 mb-3">Premium Features</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>Real-time updates</li>
                <li>Historical tracking</li>
                <li>Trade ledger breakdowns</li>
                <li>Multi-league support</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-700 text-center flex flex-col justify-end py-1 sm:py-2 px-4 sm:px-6 min-h-40 sm:min-h-48">
          <div className="flex justify-center h-40 sm:h-48 mb-0">
              <img
                src={DYNASTY_LOGO_SRC}
                alt="Dynasty Degenerates Logo"
                className="w-auto object-contain"
              />
          </div>
          <p className="bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent font-bold text-[10px] sm:text-xs md:text-sm pb-1 sm:pb-1.5 whitespace-nowrap">
            JUST SOME DEGENS WITH SCRAPING TOOLS AND A.I.
          </p>
        </div>
      </div>
      )}
      {clownEasterEggDialog}
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
