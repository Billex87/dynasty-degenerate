import type { CSSProperties } from "react";
import { Bot, BarChart3, ClipboardList, ListOrdered, Repeat2, TrendingUp } from "lucide-react";

import { HeaderCssLights } from "@/components/HeaderCssLights";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ReportDashboardHeaderProps {
  resolvedActiveTab: string;
  hasAdminPermissions: boolean;
  canViewAutopilotTab: boolean;
  shouldShowDraftHistoryTab: boolean;
  reportTabsClassName: string;
  reportTabsStyle: CSSProperties;
  leagueName: string;
  leagueFormatPills: string[];
  leagueLogo: string | null;
  leagueLogoInitials: string;
  onHeaderLeagueClick: () => void;
  onAnalyzeAnotherLeague: () => void;
  mobileLogoSrc: string;
  headerLogoSrc: string;
}

export function ReportDashboardHeader({
  onAnalyzeAnotherLeague,
  hasAdminPermissions,
  canViewAutopilotTab,
  shouldShowDraftHistoryTab,
  reportTabsClassName,
  reportTabsStyle,
  resolvedActiveTab,
  leagueName,
  leagueFormatPills,
  leagueLogo,
  leagueLogoInitials,
  onHeaderLeagueClick,
  mobileLogoSrc,
  headerLogoSrc,
}: ReportDashboardHeaderProps) {
  return (
    <header className="report-header sticky top-0 z-50">
      <HeaderCssLights />
      <div className="report-header-inner dd-header-content max-w-7xl mx-auto px-4 sm:pl-6 sm:pr-2 md:pl-6 md:pr-1 lg:pr-0 py-3 md:py-2">
        <div className="report-header-grid">
          <div className="report-header-brand min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                className={`report-header-mobile-brand-lockup cursor-pointer border-0 bg-transparent p-0 md:hidden ${hasAdminPermissions ? "report-header-mobile-brand-lockup-admin" : ""}`}
                onClick={onAnalyzeAnotherLeague}
                aria-label="Open league picker or return home"
              >
                <img
                  src={mobileLogoSrc}
                  alt="Dynasty Degenerates"
                  className="report-header-mobile-logo"
                />
              </button>
              <button
                type="button"
                className="report-header-logo-button hidden cursor-pointer border-0 bg-transparent p-0 md:block"
                onClick={onAnalyzeAnotherLeague}
                aria-label="Open league picker or return home"
              >
                <img
                  src={headerLogoSrc}
                  alt="Dynasty Degenerates"
                  className="report-header-logo report-header-logo-left"
                />
              </button>
            </div>
          </div>

          <TabsList
            className={`${reportTabsClassName} ${canViewAutopilotTab ? "report-tabs-with-autopilot" : ""} report-header-tabs`}
            data-active-tab={resolvedActiveTab}
            style={reportTabsStyle}
          >
            <TabsTrigger
              value="overview"
              className="report-tab"
              aria-label="Overview"
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              <span className="report-tab-label-full" aria-hidden="true">
                Overview
              </span>
              <span className="report-tab-label-short" aria-hidden="true">
                View
              </span>
            </TabsTrigger>

            {canViewAutopilotTab && (
              <TabsTrigger
                value="autopilot"
                className="report-tab"
                aria-label="AI Autopilot"
              >
                <Bot className="h-4 w-4" aria-hidden="true" />
                <span className="report-tab-label-full" aria-hidden="true">
                  AI Autopilot
                </span>
                <span className="report-tab-label-short" aria-hidden="true">
                  Auto
                </span>
              </TabsTrigger>
            )}

            <TabsTrigger
              value="momentum"
              className="report-tab"
              aria-label="Weekly Momentum"
            >
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
              <span className="report-tab-label-full" aria-hidden="true">
                Momentum
              </span>
              <span className="report-tab-label-short" aria-hidden="true">
                Pulse
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="rankings"
              className="report-tab"
              aria-label="Rankings"
            >
              <ListOrdered className="h-4 w-4" aria-hidden="true" />
                <span className="report-tab-label-full" aria-hidden="true">
                        Rankings
                      </span>
              <span className="report-tab-label-short" aria-hidden="true">
                Rank
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="trades"
              className="report-tab"
              aria-label="Trade History"
            >
              <Repeat2 className="h-4 w-4" aria-hidden="true" />
              <span className="report-tab-label-full" aria-hidden="true">
                Trades
              </span>
              <span className="report-tab-label-short" aria-hidden="true">
                Trade
              </span>
            </TabsTrigger>

            {shouldShowDraftHistoryTab && (
              <TabsTrigger
                value="draft"
                className="report-tab"
                aria-label="Draft History"
              >
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                <span className="report-tab-label-full" aria-hidden="true">
                  Draft
                </span>
                <span className="report-tab-label-short" aria-hidden="true">
                  Drafts
                </span>
              </TabsTrigger>
            )}
          </TabsList>

          <div className="report-league-zone md:col-start-3">
            <button
              type="button"
              className="report-league-lockup"
              onClick={onHeaderLeagueClick}
              aria-label="Open league switcher"
            >
              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-semibold text-orange-400 sm:text-lg md:text-xl">
                  {leagueName}
                </p>
                {leagueFormatPills.length > 0 && (
                  <p
                    className="report-league-format-row text-[11px] font-medium text-cyan-200/70 sm:text-xs"
                    aria-label={`League format: ${leagueFormatPills.join(", ")}`}
                  >
                    {leagueFormatPills.map(chip => (
                      <span
                        key={chip}
                        className="report-pill-shell report-inline-pill report-league-format-pill"
                      >
                        {chip}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </button>
            <button
              type="button"
              className="report-header-league-avatar"
              onClick={onHeaderLeagueClick}
              aria-label="Open league switcher"
            >
              {leagueLogo ? (
                <img src={leagueLogo} alt="" aria-hidden="true" />
              ) : (
                <span aria-hidden="true">{leagueLogoInitials}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
