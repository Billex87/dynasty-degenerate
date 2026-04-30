import { useEffect, useState, type ReactNode } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, Zap, TrendingUp, BarChart3, Zap as ZapIcon, Grid3x3, Repeat2, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import {
  ManagerRosterValueGrowthTable,
  WeeklyMomentumTable,
  ProjectedMoversTable,
  TradeProfitLeaderboardTable,
  TradeHistoryTable,
  PositionAnalysisTable,
  OwnerIntelMatrix,
  LeagueCommandCenter,
  PowerRankingsTable,
  TradeMarketRadar,
  TradeTendenciesTable,
  TrendingPlayersTable,
  WaiverIntelligencePanel,
} from '@/components/ReportTables';
import { DraftAnalysis } from '@/components/DraftAnalysis';
import type { ReportData } from '@shared/types';

const DYNASTY_LOGO_SRC = '/assets/dynasty-logo-cropped.png?v=20260428-cyan-lines';
const REPORT_CACHE_KEY = 'dynasty-degenerates:last-report:v1';
const LAST_LEAGUE_KEY = 'dynasty-degenerates:last-league:v1';

type SleeperLeagueOption = {
  leagueId: string;
  name: string;
  avatarUrl: string | null;
  season: string;
  format: string;
  totalRosters: number;
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

export default function Home() {
  const [leagueId, setLeagueId] = useState('');
  const [sleeperUsername, setSleeperUsername] = useState('');
  const [userLeagues, setUserLeagues] = useState<SleeperLeagueOption[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [leagueName, setLeagueName] = useState('');
  const [leagueLogo, setLeagueLogo] = useState<string | null>(null);
  const [leagueFormat, setLeagueFormat] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    onSuccess: (data) => {
      setUserLeagues(data.leagues);
      if (data.leagues.length === 0) {
        toast.error('No Sleeper leagues found for this username');
        return;
      }
      toast.success(`Found ${data.leagues.length} Sleeper league${data.leagues.length === 1 ? '' : 's'}`);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  useEffect(() => {
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
        setIsLoading(true);
        analyzeMutation.mutate({ leagueId: parsed.leagueId });
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
    setIsLoading(true);
    analyzeMutation.mutate({ leagueId: nextLeagueId });
  };

  const handleFindLeagues = async () => {
    if (!sleeperUsername.trim()) {
      toast.error('Please enter a Sleeper username');
      return;
    }
    userLeaguesMutation.mutate({ username: sleeperUsername.trim() });
  };

  const handleResetLeague = () => {
    localStorage.removeItem(REPORT_CACHE_KEY);
    localStorage.removeItem(LAST_LEAGUE_KEY);
    setReportData(null);
    setLeagueName('');
    setLeagueLogo(null);
    setLeagueFormat('');
    setUserLeagues([]);
    setActiveTab('overview');
  };

  if (reportData) {
    return (
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
              <div className="report-league-lockup md:col-start-3">
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
              </div>
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
                <CollapsibleReportSection title="League Command Center" kicker="10 idea preview">
                  <LeagueCommandCenter
                    data={reportData}
                    managerAvatars={reportData.managerAvatars}
                    leagueId={leagueId}
                    leagueLogo={leagueLogo}
                  />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="Owner Intel Lab" kicker="Everything we know">
                  <OwnerIntelMatrix
                    data={reportData}
                    managerAvatars={reportData.managerAvatars}
                    leagueId={leagueId}
                    leagueLogo={leagueLogo}
                  />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="Power Rankings" kicker="Composite edge">
                  <PowerRankingsTable
                    data={reportData.powerRankings}
                    managerAvatars={reportData.managerAvatars}
                  />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="Manager Roster Value Growth" kicker="Season movement">
                  <ManagerRosterValueGrowthTable data={reportData.managerRosterValueGrowth} managerAvatars={reportData.managerAvatars} />
                </CollapsibleReportSection>
                {reportData.positionDepth.length > 0 && (
                  <CollapsibleReportSection title="Position Depth Analysis" kicker="Shortage and excess">
                    <PositionAnalysisTable data={reportData.positionDepth} managerAvatars={reportData.managerAvatars} />
                  </CollapsibleReportSection>
                )}
              </div>
            </TabsContent>

            <TabsContent value="momentum" className="report-tab-content">
              <div className="space-y-6 sm:space-y-8">
                <CollapsibleReportSection title="Trade Market Radar" kicker="Buy and sell signals">
                  <TradeMarketRadar
                    risers={reportData.weeklyRisers}
                    fallers={reportData.weeklyFallers}
                    managerAvatars={reportData.managerAvatars}
                    leagueId={leagueId}
                    leagueLogo={leagueLogo}
                  />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="Waiver Intelligence" kicker="Available value">
                  <WaiverIntelligencePanel
                    data={reportData.waiverIntelligence}
                    managerAvatars={reportData.managerAvatars}
                    leagueId={leagueId}
                    leagueLogo={leagueLogo}
                  />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="Top 15 Weekly Risers" kicker="Market gainers">
                   <WeeklyMomentumTable data={reportData.weeklyRisers} title="Weekly Risers" managerAvatars={reportData.managerAvatars} leagueId={leagueId} leagueLogo={leagueLogo} />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="Top 15 Weekly Fallers" kicker="Market drops">
                   <WeeklyMomentumTable data={reportData.weeklyFallers} title="Weekly Fallers" managerAvatars={reportData.managerAvatars} leagueId={leagueId} leagueLogo={leagueLogo} />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="Trending Adds" kicker="Sleeper activity">
                  <TrendingPlayersTable
                    data={reportData.trendingAdds || []}
                    title="Trending Adds"
                    countLabel="Adds"
                    managerAvatars={reportData.managerAvatars}
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
                   <ProjectedMoversTable data={reportData.projectedRisers} title="Top Weekly Risers" managerAvatars={reportData.managerAvatars} leagueId={leagueId} leagueLogo={leagueLogo} />
                </div>
                <div>
                  <div className="space-y-2 mb-4">
                    <h3 className="text-center text-2xl font-bold text-red-400 mb-6">Top Weekly Fallers</h3>
                    <p className="text-sm text-slate-400 text-center">Players about to tank your roster value.</p>
                  </div>
                   <ProjectedMoversTable data={reportData.projectedFallers} title="Top Weekly Fallers" managerAvatars={reportData.managerAvatars} leagueId={leagueId} leagueLogo={leagueLogo} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="trades" className="report-tab-content">
              <div className="trade-sections space-y-6 sm:space-y-8">
                <CollapsibleReportSection title="All-Time Trade Profit Leaderboard" kicker="Net trade edge">
                  <TradeProfitLeaderboardTable
                    data={reportData.tradeProfitLeaderboard}
                    managerAvatars={reportData.managerAvatars}
                    tradeHistory={reportData.tradeHistory}
                    draftPicks={reportData.draftPicks || []}
                    playerDetailsById={reportData.playerDetailsById}
                    currentPositionRankById={reportData.currentPositionRankById}
                  />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="Manager Trade Tendencies" kicker="Trading personality">
                  <TradeTendenciesTable
                    data={reportData.tradeTendencies}
                    managerAvatars={reportData.managerAvatars}
                    tradeHistory={reportData.tradeHistory}
                  />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="Full Trade Ledger" kicker="Every completed deal">
                  <TradeHistoryTable
                    data={reportData.tradeHistory}
                    draftPicks={reportData.draftPicks || []}
                    managerAvatars={reportData.managerAvatars}
                    playerDetailsById={reportData.playerDetailsById}
                    currentPositionRankById={reportData.currentPositionRankById}
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
                managerAvatars={reportData.managerAvatars}
                leagueId={leagueId}
                leagueLogo={leagueLogo}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Bottom Action Buttons */}
        <div className="report-footer border-t border-orange-500/20 bg-slate-950/80 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
            <div className="flex justify-center">
              <Button
                onClick={handleResetLeague}
                variant="outline"
                className="border-orange-500/30 text-orange-300 hover:bg-orange-500/10"
              >
                Analyze Another League
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-shell min-h-screen flex flex-col">
      {/* Premium Header */}
      <div className="home-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-center">
          <div className="text-center">
            <img
              src={DYNASTY_LOGO_SRC}
              alt="Dynasty Degenerates"
              className="home-header-logo mx-auto"
            />
            <p className="text-xs text-orange-400/70">For Degens, By Degens</p>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="home-main flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-16">
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
                Stop guessing. Start dominating. Dynasty Degenerates gives you the unfair advantage with deep KTC analysis, trade profit tracking, and AI-powered projections.
              </p>
            </div>

            {/* Input Section */}
            <div className="home-analyze-card space-y-4 sm:space-y-6 p-4 sm:p-8">
              <div className="text-center">
                <label className="block text-sm font-semibold text-slate-200 mb-3">
                  Enter Your Sleeper Username
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    type="text"
                    placeholder="Sleeper username"
                    value={sleeperUsername}
                    onChange={(e) => setSleeperUsername(e.target.value)}
                    className="bg-slate-900 border-cyan-500/30 text-white placeholder:text-slate-500 h-12 text-base focus:border-cyan-300 text-center sm:text-left"
                    onKeyDown={(e) => e.key === 'Enter' && handleFindLeagues()}
                  />
                  <Button
                    type="button"
                    onClick={handleFindLeagues}
                    disabled={userLeaguesMutation.isPending}
                    className="h-12 shrink-0 rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-5 font-bold text-cyan-100 hover:bg-cyan-400/15"
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
                    <button
                      key={league.leagueId}
                      type="button"
                      className="home-league-card"
                      onClick={() => handleAnalyze(league.leagueId)}
                    >
                      {league.avatarUrl ? (
                        <img src={league.avatarUrl} alt={`${league.name} icon`} className="home-league-card-icon" />
                      ) : (
                        <span className="home-league-card-icon home-league-card-fallback">
                          {league.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 text-left">
                        <span className="home-league-card-name">{league.name}</span>
                        <span className="home-league-card-format">{league.format || `${league.totalRosters || '?'}-Team Dynasty`}</span>
                      </span>
                    </button>
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
                <Input
                  type="text"
                  placeholder="Find in your Sleeper app settings or URL"
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                  className="bg-slate-900 border-orange-500/30 text-white placeholder:text-slate-500 h-12 text-base focus:border-orange-400 text-center"
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                />
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
    <details className="report-section report-disclosure" open>
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
