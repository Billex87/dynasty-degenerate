import { HomeDialogs } from "@/features/home/components/HomeDialogs";
import { type HomeLeagueSelectionLeague } from "@/features/home/components/HomeLeagueSelection";
import {
  type AnalysisLoadingLeague,
  type LoadingTransitionPhase,
} from "@/features/report/components/ReportDialogs";
import type { CachedSleeperUser } from "@/features/home/lib/leagueHistory";
import type { LoaderManagerAnchor } from "@/features/report/components/LoaderKitBackdrop";

interface HomeDialogsContainerProps {
  isLeaguePickerOpen: boolean;
  leagues: HomeLeagueSelectionLeague[];
  sleeperUsername: string;
  activeCachedSleeperUser: CachedSleeperUser | null;
  isLeaguePickerIntelBusy: boolean;
  onLeaguePickerOpenChange: (value: boolean) => void;
  onLeagueSelect: (nextLeagueId: string) => void;
  onStartOver: () => void;
  isClownModalOpen: boolean;
  onClownDismiss: () => void;
  isAdminAccessModalOpen: boolean;
  adminPassphrase: string;
  isAdminLoginPending: boolean;
  onAdminAccessOpenChange: (open: boolean) => void;
  onAdminPassphraseChange: (value: string) => void;
  onAdminSubmit: () => void;
  onAdminStayRegularView: () => void;
  hasAuthenticatedAdminPermissions: boolean;
  isAdminUnlockModalOpen: boolean;
  onAdminUnlockDismiss: () => void;
  isLoading: boolean;
  previewMode: string | null;
  previewLoadingLoopTick: number;
  analysisCompleteMessage: AnalysisLoadingLeague | null;
  loadingTransitionPhase: LoadingTransitionPhase;
  loadingLeague: AnalysisLoadingLeague | null;
  loadingManagerAnchors: LoaderManagerAnchor[];
}

export function HomeDialogsContainer({
  isLeaguePickerOpen,
  leagues,
  sleeperUsername,
  activeCachedSleeperUser,
  isLeaguePickerIntelBusy,
  onLeaguePickerOpenChange,
  onLeagueSelect,
  onStartOver,
  isClownModalOpen,
  onClownDismiss,
  isAdminAccessModalOpen,
  adminPassphrase,
  isAdminLoginPending,
  onAdminAccessOpenChange,
  onAdminPassphraseChange,
  onAdminSubmit,
  onAdminStayRegularView,
  hasAuthenticatedAdminPermissions,
  isAdminUnlockModalOpen,
  onAdminUnlockDismiss,
  isLoading,
  previewMode,
  previewLoadingLoopTick,
  analysisCompleteMessage,
  loadingTransitionPhase,
  loadingLeague,
  loadingManagerAnchors,
}: HomeDialogsContainerProps) {
  return (
    <HomeDialogs
      isLeaguePickerOpen={isLeaguePickerOpen}
      leagues={leagues}
      sleeperUsername={sleeperUsername}
      activeCachedSleeperUser={activeCachedSleeperUser}
      isLeaguePickerIntelBusy={isLeaguePickerIntelBusy}
      onLeaguePickerOpenChange={onLeaguePickerOpenChange}
      onLeagueSelect={onLeagueSelect}
      onStartOver={onStartOver}
      isClownModalOpen={isClownModalOpen}
      onClownDismiss={onClownDismiss}
      isAdminAccessModalOpen={isAdminAccessModalOpen}
      adminPassphrase={adminPassphrase}
      isAdminLoginPending={isAdminLoginPending}
      onAdminAccessOpenChange={onAdminAccessOpenChange}
      onAdminPassphraseChange={onAdminPassphraseChange}
      onAdminSubmit={onAdminSubmit}
      onAdminStayRegularView={onAdminStayRegularView}
      hasAuthenticatedAdminPermissions={hasAuthenticatedAdminPermissions}
      isAdminUnlockModalOpen={isAdminUnlockModalOpen}
      onAdminUnlockDismiss={onAdminUnlockDismiss}
      isLoading={isLoading}
      previewMode={previewMode}
      previewLoadingLoopTick={previewLoadingLoopTick}
      analysisCompleteMessage={analysisCompleteMessage}
      loadingTransitionPhase={loadingTransitionPhase}
      loadingLeague={loadingLeague}
      loadingManagerAnchors={loadingManagerAnchors}
    />
  );
}
