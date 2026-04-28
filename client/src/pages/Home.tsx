import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Zap, TrendingUp, BarChart3, Zap as ZapIcon, Grid3x3 } from 'lucide-react';
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
} from '@/components/ReportTables';
import { DraftAnalysis } from '@/components/DraftAnalysis';
import type { ReportData } from '@shared/types';

export default function Home() {
  const [leagueId, setLeagueId] = useState('1312139584427012096');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [leagueName, setLeagueName] = useState('');
  const [leagueLogo, setLeagueLogo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const analyzeMutation = trpc.league.analyze.useMutation({
    onSuccess: (data) => {
      setReportData(data.reportData);
      setLeagueName(data.leagueName);
      setLeagueLogo(data.leagueLogo);
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
    csv += 'Rank,Manager,Total Profit,Trade Count\n';
    data.tradeProfitLeaderboard.forEach((row) => {
      csv += `${row.rank},${row.manager},${row.profit},${row.trade_count}\n`;
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
        {/* Premium Header */}
        <div className="border-b border-orange-500/20 bg-gradient-to-r from-slate-900/80 to-slate-950/80 backdrop-blur sticky top-0 z-50">
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
                  className="h-28 lg:h-32 w-auto max-w-[16rem] lg:max-w-[18rem] object-contain"
                />
              </div>
              
              {/* Right: League Name */}
              <div className="md:col-start-3 flex min-w-0 items-center justify-end gap-2">
                {leagueLogo && (
                  <img
                    src={leagueLogo}
                    alt={leagueName}
                    className="h-7 w-7 flex-shrink-0 rounded-full border border-orange-400/30 object-cover md:h-8 md:w-8"
                  />
                )}
                <p className="min-w-0 truncate text-right text-sm font-semibold text-orange-400/70 sm:text-lg md:text-xl">{leagueName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex flex-wrap justify-center gap-2 bg-transparent border-0 p-0 mb-10 sm:mb-6 md:mb-4 lg:mb-3 relative z-10" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', maxWidth: '500px', margin: '0 auto' }}>
              <TabsTrigger value="overview" className="data-[state=active]:bg-orange-600 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/50 outline-0 focus-visible:outline-0">
                Overview
              </TabsTrigger>

              <TabsTrigger value="momentum" className="data-[state=active]:bg-orange-600 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/50 outline-0 focus-visible:outline-0">
                Weekly Momentum
              </TabsTrigger>
              <TabsTrigger value="projections" className="data-[state=active]:bg-orange-600 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/50 outline-0 focus-visible:outline-0 hidden">
                Projections
              </TabsTrigger>
              <TabsTrigger value="trades" className="data-[state=active]:bg-orange-600 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/50 outline-0 focus-visible:outline-0">
                Trade History
              </TabsTrigger>

              <TabsTrigger value="draft" className="data-[state=active]:bg-orange-600 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/50 outline-0 focus-visible:outline-0">
                Draft History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0 pt-16 sm:pt-12 md:pt-8 lg:pt-4">
              <div className="space-y-8">
                <div>
                  <h3 className="text-center text-2xl font-bold text-orange-400 mb-6">League Overview</h3>
                  <LeagueOverviewTable data={reportData.leagueOverview} managerAvatars={reportData.managerAvatars} />
                </div>
                <div>
                  <h3 className="text-center text-2xl font-bold text-orange-400 mb-6">Manager Roster Value Growth</h3>
                  <ManagerRosterValueGrowthTable data={reportData.managerRosterValueGrowth} managerAvatars={reportData.managerAvatars} />
                </div>
                <div>
                  <h3 className="text-center text-2xl font-bold text-orange-400 mb-6">Position Depth Analysis</h3>
                  <PositionAnalysisTable data={reportData.positionDepth} managerAvatars={reportData.managerAvatars} />
                </div>
                <div>
                  <h3 className="text-center text-2xl font-bold text-orange-400 mb-6">Manager Position Counts</h3>
                  <ManagerPositionCountsTable data={reportData.managerPositionCounts} managerAvatars={reportData.managerAvatars} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="momentum" className="mt-0 pt-16 sm:pt-12 md:pt-8 lg:pt-4">
              <div className="space-y-8">
                <div>
                  <h3 className="text-center text-2xl font-bold text-orange-400 mb-6">Top 15 Weekly Risers</h3>
                   <WeeklyMomentumTable data={reportData.weeklyRisers} title="Weekly Risers" managerAvatars={reportData.managerAvatars} />
                </div>
                <div>
                  <h3 className="text-center text-2xl font-bold text-orange-400 mb-6">Top 15 Weekly Fallers</h3>
                   <WeeklyMomentumTable data={reportData.weeklyFallers} title="Weekly Fallers" managerAvatars={reportData.managerAvatars} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="projections" className="mt-0 pt-16 sm:pt-12 md:pt-8 lg:pt-4">
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
                   <ProjectedMoversTable data={reportData.projectedRisers} title="Top Weekly Risers" managerAvatars={reportData.managerAvatars} />
                </div>
                <div>
                  <div className="space-y-2 mb-4">
                    <h3 className="text-center text-2xl font-bold text-red-400 mb-6">Top Weekly Fallers</h3>
                    <p className="text-sm text-slate-400 text-center">Players about to tank your roster value.</p>
                  </div>
                   <ProjectedMoversTable data={reportData.projectedFallers} title="Top Weekly Fallers" managerAvatars={reportData.managerAvatars} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="trades" className="mt-0 pt-16 sm:pt-12 md:pt-8 lg:pt-4">
              <div className="space-y-8">
                <div>
                  <h3 className="text-center text-2xl font-bold text-orange-400 mb-6">All-Time Trade Profit Leaderboard</h3>
                  <TradeProfitLeaderboardTable data={reportData.tradeProfitLeaderboard} managerAvatars={reportData.managerAvatars} />
                </div>
                <div>
                  <h3 className="text-center text-2xl font-bold text-orange-400 mb-6">Full Trade Ledger</h3>
                  <TradeHistoryTable
                    data={reportData.tradeHistory}
                    draftPicks={reportData.draftPicks || []}
                    managerAvatars={reportData.managerAvatars}
                  />
                </div>
              </div>
            </TabsContent>



            <TabsContent value="draft" className="mt-0 pt-16 sm:pt-12 md:pt-8 lg:pt-4">
              <DraftAnalysis
                draftPicks={reportData.draftPicks || []}
                draftStats={reportData.draftStats || []}
                managerAvatars={reportData.managerAvatars}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Bottom Action Buttons */}
        <div className="border-t border-orange-500/20 bg-gradient-to-r from-slate-900/80 to-slate-950/80 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => {
                  setReportData(null);
                  setLeagueName('');
                  setLeagueLogo(null);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex flex-col">
      {/* Premium Header */}
      <div className="border-b border-orange-500/20 bg-gradient-to-r from-slate-900/80 to-slate-950/80 backdrop-blur">
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
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-16">
        {isLoading ? (
          <div className="w-full max-w-2xl">
            <LoadingAnimation />
          </div>
        ) : (
          <div className="w-full max-w-3xl space-y-8 sm:space-y-12">
            {/* Main Title */}
            <div className="space-y-3 sm:space-y-4 text-center">
              <h2 className="athletic-title text-4xl sm:text-6xl md:text-7xl bg-gradient-to-r from-orange-400 via-orange-300 to-yellow-300 bg-clip-text text-transparent">
                Obliterate Your Competition
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto">
                Stop guessing. Start dominating. Dynasty Degenerates gives you the unfair advantage with deep KTC analysis, trade profit tracking, and AI-powered projections.
              </p>
            </div>

            {/* Input Section */}
            <div className="space-y-4 sm:space-y-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-orange-500/20 rounded-lg sm:rounded-xl p-4 sm:p-8 backdrop-blur shadow-xl">
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
                className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-base gap-2 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                <Zap size={20} />
                Illegally Scraping All Data
              </Button>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-emerald-500/20 rounded-lg p-4 sm:p-6 space-y-3 hover:border-emerald-500/40 transition-all">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="font-semibold text-white">League Overview</h3>
                <p className="text-sm text-slate-400">
                  See every manager's total KTC value with positional rankings and 2027 projections. No bullshit, just the numbers.
                </p>
              </div>

              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-blue-500/20 rounded-lg p-4 sm:p-6 space-y-3 hover:border-blue-500/40 transition-all">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white">Trade History</h3>
                <p className="text-sm text-slate-400">
                  Track how your trades are valued today compared to when you made them. See who's winning and who's getting fleeced.
                </p>
              </div>

              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-purple-500/20 rounded-lg p-4 sm:p-6 space-y-3 hover:border-purple-500/40 transition-all">
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
      <div className="border-t border-orange-500/20 bg-gradient-to-r from-slate-900/80 to-slate-950/80 backdrop-blur mt-auto flex flex-col">
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
