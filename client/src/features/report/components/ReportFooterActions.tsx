import { SupportButton } from "@/components/SupportButton";
import { FeedbackButton } from "@/components/FeedbackButton";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AIVoiceModeMenu } from "@/features/report/components/AIVoiceModeMenu";
import { AdminManagerSwitcher } from "@/features/report/components/AdminManagerSwitcher";
import type { AIVoiceMode } from "@/lib/aiVoice";
import { useEffectsPreference } from "@/lib/motion";
import type { ReportData } from "@shared/types";

interface ReportFooterActionsProps {
  canOpenAdminToolsEntry: boolean;
  canViewAdminFeatureExpansion: boolean;
  isAdminPassphraseVerifiedForSession: boolean;
  hasManagerViewOptions: boolean;
  reportManagerNames: string[];
  effectiveViewerManager: string | null;
  managerAvatars: ReportData["managerAvatars"];
  aiVoiceMode: AIVoiceMode;
  onAIVoiceModeChange: (mode: AIVoiceMode) => void;
  onAdminToolsClick: () => void;
  onAdminViewerManagerChange: (manager: string | null) => void;
  onAnalyzeAnotherLeague: () => void;
  leagueId?: string;
  leagueName?: string;
  leagueFormat?: string;
}

export function ReportFooterActions({
  canOpenAdminToolsEntry,
  canViewAdminFeatureExpansion,
  isAdminPassphraseVerifiedForSession,
  hasManagerViewOptions,
  reportManagerNames,
  effectiveViewerManager,
  managerAvatars,
  aiVoiceMode,
  onAIVoiceModeChange,
  onAdminToolsClick,
  onAdminViewerManagerChange,
  onAnalyzeAnotherLeague,
  leagueId,
  leagueName,
  leagueFormat,
}: ReportFooterActionsProps) {
  const { effectsEnabled, osReducedMotion, setEffectsEnabled } =
    useEffectsPreference();
  const effectsLabel = effectsEnabled ? "Effects On" : "Effects Off";

  return (
    <div className="report-footer-actions">
      <div className="report-footer-primary-actions">
        {(canOpenAdminToolsEntry ||
          (canViewAdminFeatureExpansion && hasManagerViewOptions)) && (
          <div className="report-footer-admin-row flex w-full max-w-[32rem] items-stretch justify-center gap-1.5 sm:w-auto sm:max-w-none sm:gap-2">
            {canOpenAdminToolsEntry && (
              <Button
                type="button"
                onClick={onAdminToolsClick}
                variant="outline"
                className={`report-header-action report-footer-primary-action dd-current !w-auto shrink-0 px-2.5 sm:px-3 report-header-admin-toggle ${
                  canViewAdminFeatureExpansion ? "report-header-admin-toggle-active" : ""
                }`}
                aria-pressed={canViewAdminFeatureExpansion}
                aria-label={
                  canViewAdminFeatureExpansion
                    ? "Switch to regular report view"
                    : isAdminPassphraseVerifiedForSession
                      ? "Switch to admin report view"
                      : "Unlock admin tools"
                }
                title={
                  canViewAdminFeatureExpansion
                    ? "Hide admin-only AI annotations and diagnostics"
                    : isAdminPassphraseVerifiedForSession
                      ? "Show admin-only AI annotations and diagnostics"
                      : "Enter the admin passphrase for this browser session"
                }
              >
                <span className="dd-current-line" aria-hidden="true" />
                <span className="report-header-action-label truncate">
                  {canViewAdminFeatureExpansion
                    ? "Regular Report"
                    : "Admin Tools"}
                </span>
              </Button>
            )}
            {canViewAdminFeatureExpansion && hasManagerViewOptions && (
              <AdminManagerSwitcher
                managers={reportManagerNames}
                activeManager={effectiveViewerManager}
                managerAvatars={managerAvatars}
                onSelect={onAdminViewerManagerChange}
              />
            )}
          </div>
        )}
        <AIVoiceModeMenu
          mode={aiVoiceMode}
          onChange={onAIVoiceModeChange}
        />
        <Button
          type="button"
          variant="outline"
          className="report-header-action report-footer-primary-action report-effects-toggle dd-current !w-full max-w-[32rem] justify-between gap-2 sm:!w-auto sm:max-w-none"
          aria-label={
            osReducedMotion
              ? "Effects are off because reduced motion is enabled"
              : `Turn ${effectsEnabled ? "off" : "on"} report effects`
          }
          aria-pressed={effectsEnabled}
          onClick={() => setEffectsEnabled(!effectsEnabled)}
          title={
            osReducedMotion
              ? "OS reduced-motion is active; report effects stay off."
              : "Toggle report motion effects for this browser."
          }
        >
          <span className="dd-current-line" aria-hidden="true" />
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="report-header-action-label min-w-0 truncate">
            {effectsLabel}
          </span>
        </Button>
        <Button
          onClick={onAnalyzeAnotherLeague}
          variant="outline"
          className="report-header-action report-footer-primary-action report-switch-league-trigger dd-current !w-full max-w-[32rem] sm:!w-auto sm:max-w-none"
          aria-label="Switch to another league report"
        >
          <span className="dd-current-line" aria-hidden="true" />
          <span className="report-header-action-label">
            Switch League
          </span>
        </Button>
      </div>
      <div className="report-footer-secondary-actions">
        <SupportButton compact showExternalIcon={false} />
        <FeedbackButton
          compact
          leagueId={leagueId}
          leagueName={leagueName}
          leagueFormat={leagueFormat}
        />
      </div>
    </div>
  );
}
