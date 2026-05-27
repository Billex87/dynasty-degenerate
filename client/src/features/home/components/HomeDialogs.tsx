import { type LoaderManagerAnchor } from "@/features/report/components/LoaderKitBackdrop";
import {
  AdminAccessDialog,
  AdminUnlockDialog,
  AnalysisLoadingDialog,
  type AnalysisLoadingLeague,
  type LoadingTransitionPhase,
  ClownEasterEggDialog,
} from "@/features/report/components/ReportDialogs";
import { type HomeLeagueSelectionLeague } from "@/features/home/components/HomeLeagueSelection";
import { type CachedSleeperUser } from "@/features/home/lib/leagueHistory";
import { LeaguePickerDialog } from "@/features/home/components/HomeLeagueDialogs";

interface HomeDialogsProps {
  isLeaguePickerOpen: boolean;
  leagues: HomeLeagueSelectionLeague[];
  sleeperUsername: string;
  activeCachedSleeperUser?: CachedSleeperUser | null;
  isLeaguePickerIntelBusy: boolean;
  onLeaguePickerOpenChange: (open: boolean) => void;
  onLeagueSelect: (leagueId: string) => void;
  onStartOver: () => void;

  isClownModalOpen: boolean;
  onClownDismiss: () => void;

  isAdminAccessModalOpen: boolean;
  adminPassphrase: string;
  isAdminLoginPending: boolean;
  onAdminAccessOpenChange: (open: boolean) => void;
  onAdminPassphraseChange: (passphrase: string) => void;
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

export function HomeDialogs({
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
}: HomeDialogsProps) {
  return (
    <>
      <LeaguePickerDialog
        open={isLeaguePickerOpen}
        leagues={leagues}
        sleeperUsername={sleeperUsername}
        activeCachedSleeperUser={activeCachedSleeperUser}
        isLeaguePickerIntelBusy={isLeaguePickerIntelBusy}
        onOpenChange={onLeaguePickerOpenChange}
        onLeagueSelect={onLeagueSelect}
        onStartOver={onStartOver}
      />
      <ClownEasterEggDialog
        open={isClownModalOpen}
        onOpenChange={open => {
          if (open) return;
          onClownDismiss();
        }}
        onDismiss={onClownDismiss}
      />
      <AdminAccessDialog
        open={isAdminAccessModalOpen}
        passphrase={adminPassphrase}
        isPending={isAdminLoginPending}
        onOpenChange={onAdminAccessOpenChange}
        onPassphraseChange={onAdminPassphraseChange}
        onSubmit={onAdminSubmit}
        onStayRegularView={onAdminStayRegularView}
      />
      <AdminUnlockDialog
        open={hasAuthenticatedAdminPermissions && isAdminUnlockModalOpen}
        onDismiss={onAdminUnlockDismiss}
      />
      <AnalysisLoadingDialog
        open={isLoading}
        previewMode={previewMode}
        previewLoadingLoopTick={previewLoadingLoopTick}
        analysisCompleteMessage={analysisCompleteMessage}
        loadingTransitionPhase={loadingTransitionPhase}
        loadingLeague={loadingLeague}
        loadingManagerAnchors={loadingManagerAnchors}
      />
    </>
  );
}
