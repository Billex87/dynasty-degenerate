import type { CSSProperties, ReactNode } from "react";

import { Tabs } from "@/components/ui/tabs";
import { ManagerChampionshipProvider } from "@/components/ManagerChampionships";
import {
  type PremiumFxVariant,
  PremiumFxLayer,
} from "@/components/PremiumFxLayer";
import type { AIVoiceMode } from "@/lib/aiVoice";
import type { ReportData } from "@shared/types";
import { ChangeLeagueDialog } from "@/features/home/components/HomeLeagueDialogs";
import { ReportDashboardFooter } from "@/features/report/components/ReportDashboardFooter";
import { ReportDashboardHeader } from "@/features/report/components/ReportDashboardHeader";
import { ReportSectionAccordionProvider } from "@/features/report/components/ReportSectionDisclosure";

type ReportDashboardShellHeaderProps = {
  hasAdminPermissions: boolean;
  canViewAdminDiagnostics: boolean;
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
};

type ReportDashboardShellFooterProps = {
  canOpenAdminToolsEntry: boolean;
  canViewAdminFeatureExpansion: boolean;
  isAdminPassphraseVerifiedForSession: boolean;
  hasManagerViewOptions: boolean;
  reportManagerNames: string[];
  effectiveViewerManager: string | null;
  managerAvatars: ReportData["managerAvatars"];
  aiVoiceMode: AIVoiceMode;
  leagueId?: string;
  leagueName?: string;
  leagueFormat?: string;
  onAIVoiceModeChange: (mode: AIVoiceMode) => void;
  onAdminToolsClick: () => void;
  onAdminViewerManagerChange: (manager: string | null) => void;
  onAnalyzeAnotherLeague: () => void;
};

type ReportDashboardShellProps = {
  isLoadingRevealPhase: boolean;
  aiVoiceMode: AIVoiceMode;
  resolvedActiveTab: string;
  reportFxVariant: PremiumFxVariant;
  onReportTabChange: (value: string) => void;
  hasAdminPermissions: ReportDashboardShellHeaderProps["hasAdminPermissions"];
  canViewAdminDiagnostics:
    ReportDashboardShellHeaderProps["canViewAdminDiagnostics"];
  canViewAutopilotTab: ReportDashboardShellHeaderProps["canViewAutopilotTab"];
  shouldShowDraftHistoryTab:
    ReportDashboardShellHeaderProps["shouldShowDraftHistoryTab"];
  reportTabsClassName: ReportDashboardShellHeaderProps["reportTabsClassName"];
  reportTabsStyle: ReportDashboardShellHeaderProps["reportTabsStyle"];
  leagueName: ReportDashboardShellHeaderProps["leagueName"];
  leagueFormatPills: ReportDashboardShellHeaderProps["leagueFormatPills"];
  leagueLogo: ReportDashboardShellHeaderProps["leagueLogo"];
  leagueLogoInitials: ReportDashboardShellHeaderProps["leagueLogoInitials"];
  onAnalyzeAnotherLeague:
    ReportDashboardShellHeaderProps["onAnalyzeAnotherLeague"];
  onHeaderLeagueClick: ReportDashboardShellHeaderProps["onHeaderLeagueClick"];
  mobileLogoSrc: ReportDashboardShellHeaderProps["mobileLogoSrc"];
  headerLogoSrc: ReportDashboardShellHeaderProps["headerLogoSrc"];
  isChangeLeagueModalOpen: boolean;
  onChangeLeagueOpenChange: (open: boolean) => void;
  onChangeLeagueStay: () => void;
  onStartOver: () => void;
  canOpenAdminToolsEntry:
    ReportDashboardShellFooterProps["canOpenAdminToolsEntry"];
  canViewAdminFeatureExpansion:
    ReportDashboardShellFooterProps["canViewAdminFeatureExpansion"];
  isAdminPassphraseVerifiedForSession:
    ReportDashboardShellFooterProps["isAdminPassphraseVerifiedForSession"];
  hasManagerViewOptions:
    ReportDashboardShellFooterProps["hasManagerViewOptions"];
  reportManagerNames: ReportDashboardShellFooterProps["reportManagerNames"];
  effectiveViewerManager:
    ReportDashboardShellFooterProps["effectiveViewerManager"];
  managerAvatars: ReportDashboardShellFooterProps["managerAvatars"];
  leagueId: ReportDashboardShellFooterProps["leagueId"];
  leagueFormat: ReportDashboardShellFooterProps["leagueFormat"];
  onAIVoiceModeChange:
    ReportDashboardShellFooterProps["onAIVoiceModeChange"];
  onAdminToolsClick: ReportDashboardShellFooterProps["onAdminToolsClick"];
  onAdminViewerManagerChange:
    ReportDashboardShellFooterProps["onAdminViewerManagerChange"];
  managerChampionships: ReportData["managerChampionships"];
  children: ReactNode;
};

export function ReportDashboardShell({
  aiVoiceMode,
  canOpenAdminToolsEntry,
  canViewAdminDiagnostics,
  canViewAdminFeatureExpansion,
  canViewAutopilotTab,
  children,
  effectiveViewerManager,
  hasAdminPermissions,
  hasManagerViewOptions,
  headerLogoSrc,
  isAdminPassphraseVerifiedForSession,
  isChangeLeagueModalOpen,
  isLoadingRevealPhase,
  leagueFormat,
  leagueFormatPills,
  leagueId,
  leagueLogo,
  leagueLogoInitials,
  leagueName,
  managerAvatars,
  managerChampionships,
  mobileLogoSrc,
  onAIVoiceModeChange,
  onAnalyzeAnotherLeague,
  onAdminToolsClick,
  onAdminViewerManagerChange,
  onChangeLeagueOpenChange,
  onChangeLeagueStay,
  onHeaderLeagueClick,
  onReportTabChange,
  onStartOver,
  reportFxVariant,
  reportManagerNames,
  reportTabsClassName,
  reportTabsStyle,
  resolvedActiveTab,
  shouldShowDraftHistoryTab,
}: ReportDashboardShellProps) {
  return (
    <ManagerChampionshipProvider championships={managerChampionships}>
      <div
        className={`report-shell min-h-screen flex flex-col ${isLoadingRevealPhase ? "report-shell-entering" : ""}`}
        data-ai-voice-mode={aiVoiceMode}
      >
        <PremiumFxLayer
          variant={reportFxVariant}
          intensity={resolvedActiveTab === "overview" ? "low" : "medium"}
        />
        <Tabs
          value={resolvedActiveTab}
          onValueChange={onReportTabChange}
          className="report-dashboard-tabs-root"
        >
          <ReportDashboardHeader
            resolvedActiveTab={resolvedActiveTab}
            hasAdminPermissions={hasAdminPermissions}
            canViewAdminDiagnostics={canViewAdminDiagnostics}
            canViewAutopilotTab={canViewAutopilotTab}
            shouldShowDraftHistoryTab={shouldShowDraftHistoryTab}
            reportTabsClassName={reportTabsClassName}
            reportTabsStyle={reportTabsStyle}
            leagueName={leagueName}
            leagueFormatPills={leagueFormatPills}
            leagueLogo={leagueLogo}
            leagueLogoInitials={leagueLogoInitials}
            onHeaderLeagueClick={onHeaderLeagueClick}
            onAnalyzeAnotherLeague={onAnalyzeAnotherLeague}
            mobileLogoSrc={mobileLogoSrc}
            headerLogoSrc={headerLogoSrc}
          />

          <ReportSectionAccordionProvider scopeKey={resolvedActiveTab}>
            {children}
          </ReportSectionAccordionProvider>

          <ReportDashboardFooter
            canOpenAdminToolsEntry={canOpenAdminToolsEntry}
            canViewAdminFeatureExpansion={canViewAdminFeatureExpansion}
            isAdminPassphraseVerifiedForSession={
              isAdminPassphraseVerifiedForSession
            }
            hasManagerViewOptions={hasManagerViewOptions}
            reportManagerNames={reportManagerNames}
            effectiveViewerManager={effectiveViewerManager}
            managerAvatars={managerAvatars}
            aiVoiceMode={aiVoiceMode}
            onAIVoiceModeChange={onAIVoiceModeChange}
            onAdminToolsClick={onAdminToolsClick}
            onAdminViewerManagerChange={onAdminViewerManagerChange}
            onAnalyzeAnotherLeague={onAnalyzeAnotherLeague}
            leagueId={leagueId}
            leagueFormat={leagueFormat}
          />
        </Tabs>

        <ChangeLeagueDialog
          open={isChangeLeagueModalOpen}
          onOpenChange={onChangeLeagueOpenChange}
          onStay={onChangeLeagueStay}
          onStartOver={onStartOver}
        />
      </div>
    </ManagerChampionshipProvider>
  );
}
