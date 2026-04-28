import { useState, type ReactNode } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, Download, Zap, TrendingUp, BarChart3, Zap as ZapIcon, Grid3x3, Repeat2, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import {
  LeagueOverviewTable,
  ManagerRosterValueGrowthTable,
  WeeklyMomentumTable,
  ProjectedMoversTable,
  TradeProfitLeaderboardTable,
  TradeHistoryTable,
  PositionAnalysisTable,
  ManagerPositionCountsTable,
  TrendingPlayersTable,
} from '@/components/ReportTables';
import { DraftAnalysis } from '@/components/DraftAnalysis';
import type { ReportData } from '@shared/types';

export default function Home() {
  const [leagueId, setLeagueId] = useState('1312139584427012096');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [leagueName, setLeagueName] = useState('');
  const [leagueLogo, setLeagueLogo] = useState<string | null>(null);
  const [leagueFormat, setLeagueFormat] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const analyzeMutation = trpc.league.analyze.useMutation({
    onSuccess: (data) => {
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

  const handleAnalyze = async () => {
    if (!leagueId.trim()) {
      toast.error('Please enter a league ID');
      return;
    }
    setIsLoading(true);
    analyzeMutation.mutate({ leagueId });
  };

  const handleDownloadCSV = () => {
    if (!reportData) {
      toast.error('No report data available');
      return;
    }

    const csv = generateCSV(reportData, leagueName);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `dynasty-degenerates-${leagueName}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateCSV = (data: ReportData, leagueName: string): string => {
    let csv = `Dynasty Degenerates Report - ${leagueName}\nGenerated: ${new Date().toLocaleString()}\n\n`;

    csv += 'LEAGUE OVERVIEW\n';
    csv += 'Manager,Total Value,QB Rank,RB Rank,WR Rank,TE Rank,Value Rank,2027 Rank\n';
    data.leagueOverview.forEach((row) => {
      csv += `${row.manager},${row.total_val},${row.rank_qb},${row.rank_rb},${row.rank_wr},${row.rank_te},${row.rank_value},${row.rank_2027}\n`;
    });

    csv += '\nMANAGER ROSTER VALUE GROWTH\n';
    csv += 'Manager,2025 Value,2026 Value,Growth %,Rank\n';
    data.managerRosterValueGrowth.forEach((row) => {
      csv += `${row.manager},${row.past_val},${row.total_val},${row.growth.toFixed(1)}%,${row.rank}\n`;
    });

    csv += '\nWEEKLY RISERS\n';
    csv += 'Rank,Player,Position,Owner,Last Week,This Week,Change\n';
    data.weeklyRisers.forEach((row, idx) => {
      csv += `${idx + 1},${row.name},${row.pos},${row.owner},${row.val_last},${row.val_now},${row.diff}\n`;
    });

    csv += '\nWEEKLY FALLERS\n';
    csv += 'Rank,Player,Position,Owner,Last Week,This Week,Change\n';
    data.weeklyFallers.forEach((row, idx) => {
      csv += `${idx + 1},${row.name},${row.pos},${row.owner},${row.val_last},${row.val_now},${row.diff}\n`;
    });

    csv += '\nPROJECTED RISERS\n';
    csv += 'Rank,Player,Position,Owner,Age,2026 Value,2027 Projection,Change\n';
    data.projectedRisers.forEach((row, idx) => {
      csv += `${idx + 1},${row.name},${row.pos},${row.owner},${row.age},${row.val_2026},${row.val_2027},${row.diff}\n`;
    });

    csv += '\nPROJECTED FALLERS\n';
    csv += 'Rank,Player,Position,Owner,Age,2026 Value,2027 Projection,Change\n';
    data.projectedFallers.forEach((row, idx) => {
      csv += `${idx + 1},${row.name},${row.pos},${row.owner},${row.age},${row.val_2026},${row.val_2027},${row.diff}\n`;
    });

    csv += '\nALL-TIME TRADE PROFIT LEADERBOARD\n';
    csv += 'Manager,Profit,Wins,Trade Count\n';
    data.tradeProfitLeaderboard.forEach((row) => {
      csv += `${row.manager},${row.profit},${row.wins},${row.trade_count}\n`;
    });

    csv += '\nFULL TRADE LEDGER\n';
    csv += 'Date,Season,Team A,Team B,Team A Items,Team B Items,Team A Total,Team B Total,Gap,Winner\n';
    data.tradeHistory.forEach((row) => {
      csv += `${row.date},${row.season},"${row.team_a}","${row.team_b}","${row.team_a_items}","${row.team_b_items}",${row.team_a_total},${row.team_b_total},${row.point_gap},${row.winner}\n`;
    });

    return csv;
  };

  if (reportData) {
    return (
      <div className="report-shell min-h-screen flex flex-col">
        {/* Premium Header */}
        <div className="report-header sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 md:py-2">
             <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6">
              {/* Left: Dynasty Degenerates */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <h2 className="athletic-headline truncate text-base sm:text-xl bg-gradient-to-r from-orange-400 to-orange-300 bg-clip-text text-transparent">
                  Dynasty Degenerates
                </h2>
              </div>
              
              {/* Center: Logo */}
              <div className="hidden md:col-start-2 md:flex items-center justify-center">
                <img 
                  src="/assets/dynasty-logo-cropped.png" 
                  alt="Dynasty Degenerates Logo" 
                  className="report-header-logo"
                />
              </div>
              
              {/* Right: League Name */}
              <div className="md:col-start-3 flex min-w-0 items-center justify-end">
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-semibold text-orange-400/70 sm:text-lg md:text-xl">{leagueName}</p>
                  {leagueFormat && (
                    <p className="truncate text-[11px] font-medium text-slate-400 sm:text-xs">
                      {leagueFormat}
                    </p>
                  )}
                </div>
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
                Overview
              </TabsTrigger>

              <TabsTrigger value="momentum" className="report-tab">
                <TrendingUp className="h-4 w-4" />
                Weekly Momentum
              </TabsTrigger>
              <TabsTrigger value="projections" className="report-tab hidden">
                Projections
              </TabsTrigger>
              <TabsTrigger value="trades" className="report-tab">
                <Repeat2 className="h-4 w-4" />
                Trade History
              </TabsTrigger>

              <TabsTrigger value="draft" className="report-tab">
                <ClipboardList className="h-4 w-4" />
                Draft History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="report-tab-content">
              <div className="space-y-6 sm:space-y-8">
                <CollapsibleReportSection title="Manager Position Counts" kicker="Starter depth">
                  <ManagerPositionCountsTable
                    data={reportData.managerPositionCounts}
                    managerAvatars={reportData.managerAvatars}
                    leagueId={leagueId}
                    leagueLogo={leagueLogo}
                  />
                </CollapsibleReportSection>
                <CollapsibleReportSection title="League Overview" kicker="Roster strength">
                  <LeagueOverviewTable data={reportData.leagueOverview} managerAvatars={reportData.managerAvatars} />
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
        <div className="border-t border-orange-500/20 bg-slate-950/80 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => {
                  setReportData(null);
                  setLeagueName('');
                  setLeagueLogo(null);
                  setLeagueFormat('');
                  setActiveTab('overview');
                }}
                variant="outline"
                className="border-orange-500/30 text-orange-300 hover:bg-orange-500/10"
              >
                Analyze Another League
              </Button>
              <Button
                onClick={handleDownloadCSV}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white gap-2 shadow-lg"
              >
                <Download size={18} />
                Export CSV
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
            <h1 className="athletic-headline text-lg sm:text-2xl bg-gradient-to-r from-orange-400 to-orange-300 bg-clip-text text-transparent">
              Dynasty Degenerates
            </h1>
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
                  Enter Your Sleeper League ID
                </label>
                <Input
                  type="text"
                  placeholder="Find in your Sleeper app settings or URL"
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                  className="bg-slate-900 border-orange-500/30 text-white placeholder:text-slate-500 h-12 text-base focus:border-orange-400 text-center"
                  onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
                />
                <p className="text-xs text-slate-400 mt-2">
                  In the Sleeper app, open your league → go to General Settings → scroll to the bottom to find your League ID.
                </p>
              </div>

              <Button
                onClick={handleAnalyze}
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
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="font-semibold text-white">League Overview</h3>
                <p className="text-sm text-slate-400">
                  See every manager's total KTC value with positional rankings and 2027 projections. No bullshit, just the numbers.
                </p>
              </div>

              <div className="home-feature-card home-feature-blue p-4 sm:p-6 space-y-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white">Trade History</h3>
                <p className="text-sm text-slate-400">
                  Track how your trades are valued today compared to when you made them. See who's winning and who's getting fleeced.
                </p>
              </div>

              <div className="home-feature-card home-feature-purple p-4 sm:p-6 space-y-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <ZapIcon className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="font-semibold text-white">Player Projections</h3>
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
                <li>CSV exports</li>
                <li>Multi-league support</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-700 text-center flex flex-col justify-end py-1 sm:py-2 px-4 sm:px-6 min-h-40 sm:min-h-48">
          <div className="flex justify-center h-40 sm:h-48 mb-0">
            <img 
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663529938437/NTiUsmvqK3XxXPP4p7F4CA/dynasty_degenerates_logo_final_90a9eceb.png" 
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
