import { HeaderCssLights } from "@/components/HeaderCssLights";
import { LegalFooterLink } from "@/components/LegalLinks";
import type { AIVoiceMode } from "@/lib/aiVoice";
import type { ReportData } from "@shared/types";
import { ReportFooterActions } from "@/features/report/components/ReportFooterActions";

type ReportDashboardFooterProps = {
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

export function ReportDashboardFooter({
  canOpenAdminToolsEntry,
  canViewAdminFeatureExpansion,
  isAdminPassphraseVerifiedForSession,
  hasManagerViewOptions,
  reportManagerNames,
  effectiveViewerManager,
  managerAvatars,
  aiVoiceMode,
  leagueId,
  leagueName,
  leagueFormat,
  onAIVoiceModeChange,
  onAdminToolsClick,
  onAdminViewerManagerChange,
  onAnalyzeAnotherLeague,
}: ReportDashboardFooterProps) {
  return (
    <footer className="report-footer border-t border-orange-500/20 bg-slate-950/80 backdrop-blur">
      <HeaderCssLights className="dd-footer-css-lights" />
      <div className="dd-header-content mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        <ReportFooterActions
          canOpenAdminToolsEntry={canOpenAdminToolsEntry}
          canViewAdminFeatureExpansion={canViewAdminFeatureExpansion}
          isAdminPassphraseVerifiedForSession={isAdminPassphraseVerifiedForSession}
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
          leagueName={leagueName}
          leagueFormat={leagueFormat}
        />
        <LegalFooterLink className="mt-4" />
      </div>
    </footer>
  );
}
