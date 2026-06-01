import type { ReactNode } from "react";

import { HomeHeaderChrome } from "@/features/home/components/HomeChrome";
import { HomeLandingFeatureCards } from "@/features/home/components/HomeLandingFeatureCards";
import { HomeSignedOutLandingFooter } from "@/features/home/components/HomeSignedOutLandingFooter";
import { HomeAnalyzeForm } from "@/features/home/components/HomeAnalyzeForm";
import { HomeWeaponsCallout } from "@/features/home/components/HomeWeaponsCallout";
import { HomeLandingHeroCopy } from "@/features/home/components/HomeLandingHeroCopy";
import {
  HomePortfolioPanel,
  type HomeLeagueSelectionLeague,
  type HomePortfolioRow,
} from "@/features/home/components/HomeLeagueSelection";
import type { HomePortfolioExposureFilter } from "@/features/home/lib/portfolioRows";

interface HomeSignedOutLandingProps {
  showHomePortfolioPanel: boolean;
  homePortfolioRows: HomePortfolioRow[];
  filteredHomePortfolioRows: HomePortfolioRow[];
  orderedUserLeagues: HomeLeagueSelectionLeague[];
  isHomePortfolioLoading: boolean;
  portfolioSearch: string;
  portfolioExposureFilter: HomePortfolioExposureFilter;
  portfolioLeagueFilter: string;
  onPortfolioSearchChange: (value: string) => void;
  onPortfolioExposureFilterChange: (value: HomePortfolioExposureFilter) => void;
  onPortfolioLeagueFilterChange: (value: string) => void;
  onAnalyzeLeagueOption: (nextLeagueId: string) => void;
  leagueId: string;
  sleeperUsername: string;
  onSleeperUsernameChange: (value: string) => void;
  leagueIdHistory: string[];
  onLeagueIdChange: (value: string) => void;
  focusedAutocomplete: "username" | "league" | null;
  onFocusedAutocompleteChange: (value: "username" | "league" | null) => void;
  usernameAutocompleteOptions: string[];
  leagueIdAutocompleteOptions: string[];
  onUsernameAutocompleteSelect: (value: string) => void;
  onLeagueIdAutocompleteSelect: (value: string) => void;
  handleFindLeagues: () => void;
  isFindLeaguesPending: boolean;
  analysisErrorMessage?: string | null;
  showLegacyLeagueIdLogin: boolean;
  handleAnalyze: () => void;
  isAnalysisBusy: boolean;
  showLoadingFooter: boolean;
  onStartOver: () => void;
  isLandingFaded: boolean;
  homeDialogs: ReactNode;
}

export function HomeSignedOutLanding({
  showHomePortfolioPanel,
  homePortfolioRows,
  filteredHomePortfolioRows,
  orderedUserLeagues,
  isHomePortfolioLoading,
  portfolioSearch,
  portfolioExposureFilter,
  portfolioLeagueFilter,
  onPortfolioSearchChange,
  onPortfolioExposureFilterChange,
  onPortfolioLeagueFilterChange,
  onAnalyzeLeagueOption,
  leagueId,
  sleeperUsername,
  onSleeperUsernameChange,
  leagueIdHistory,
  onLeagueIdChange,
  focusedAutocomplete,
  onFocusedAutocompleteChange,
  usernameAutocompleteOptions,
  leagueIdAutocompleteOptions,
  onUsernameAutocompleteSelect,
  onLeagueIdAutocompleteSelect,
  handleFindLeagues,
  isFindLeaguesPending,
  analysisErrorMessage,
  showLegacyLeagueIdLogin,
  handleAnalyze,
  isAnalysisBusy,
  showLoadingFooter,
  onStartOver,
  isLandingFaded,
  homeDialogs,
}: HomeSignedOutLandingProps) {
  return (
    <>
      <div
        className="home-shell min-h-screen flex flex-col premium-fx-host"
        style={isLandingFaded ? { opacity: 0 } : undefined}
      >
        <HomeHeaderChrome onBrandClick={onStartOver} />
        <main className="home-main flex flex-col items-center justify-center">
          <div
            className={`home-hero home-hero-dashboard${
              showHomePortfolioPanel ? " home-hero-dashboard-portfolio" : ""
            }`}
          >
            <HomeLandingHeroCopy />

            <HomeAnalyzeForm
              showLegacyLeagueIdLogin={showLegacyLeagueIdLogin}
              leagueId={leagueId}
              sleeperUsername={sleeperUsername}
              leagueIdHistory={leagueIdHistory}
              focusedAutocomplete={focusedAutocomplete}
              usernameAutocompleteOptions={usernameAutocompleteOptions}
              leagueIdAutocompleteOptions={leagueIdAutocompleteOptions}
              isFindLeaguesPending={isFindLeaguesPending}
              isAnalysisBusy={isAnalysisBusy}
              analysisErrorMessage={analysisErrorMessage}
              onFocusedAutocompleteChange={onFocusedAutocompleteChange}
              onSleeperUsernameChange={onSleeperUsernameChange}
              onLeagueIdChange={onLeagueIdChange}
              onUsernameAutocompleteSelect={onUsernameAutocompleteSelect}
              onLeagueIdAutocompleteSelect={onLeagueIdAutocompleteSelect}
              handleFindLeagues={handleFindLeagues}
              handleAnalyze={handleAnalyze}
            />

            {!showHomePortfolioPanel ? <HomeWeaponsCallout /> : null}

            {showHomePortfolioPanel ? (
              <HomePortfolioPanel
                rows={homePortfolioRows}
                filteredRows={filteredHomePortfolioRows}
                leagues={orderedUserLeagues}
                isLoading={isHomePortfolioLoading}
                query={portfolioSearch}
                exposureFilter={portfolioExposureFilter}
                selectedLeagueId={portfolioLeagueFilter}
                onQueryChange={onPortfolioSearchChange}
                onExposureFilterChange={onPortfolioExposureFilterChange}
                onLeagueFilterChange={onPortfolioLeagueFilterChange}
                onLeagueSelect={onAnalyzeLeagueOption}
              />
            ) : null}

            <HomeLandingFeatureCards />
          </div>
        </main>

        <HomeSignedOutLandingFooter
          showLoadingFooter={showLoadingFooter}
          isAnalysisBusy={isAnalysisBusy}
        />
        {homeDialogs}
      </div>
    </>
  );
}
