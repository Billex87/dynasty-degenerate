import { useCallback, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import type { AdminViewMode } from "@/features/home/lib/adminMode";
import { rememberAdminPassphraseVerifiedForSession } from "@/features/home/lib/adminSessionState";

type UseHomeAdminLoginOptions = {
  adminPassphrase: string;
  setAdminPassphrase: Dispatch<SetStateAction<string>>;
  setAdminViewMode: Dispatch<SetStateAction<AdminViewMode | null>>;
  setAdminViewerManager: Dispatch<SetStateAction<string | null>>;
  setIsAdminAccessModalOpen: Dispatch<SetStateAction<boolean>>;
  setIsAdminPassphraseVerifiedForSession: Dispatch<SetStateAction<boolean>>;
};

export function useHomeAdminLogin({
  adminPassphrase,
  setAdminPassphrase,
  setAdminViewMode,
  setAdminViewerManager,
  setIsAdminAccessModalOpen,
  setIsAdminPassphraseVerifiedForSession,
}: UseHomeAdminLoginOptions) {
  const utils = trpc.useUtils();
  const {
    isPending: isAdminLoginPending,
    mutate: submitAdminLogin,
  } = trpc.auth.adminLogin.useMutation({
    onSuccess: async () => {
      rememberAdminPassphraseVerifiedForSession();
      setIsAdminPassphraseVerifiedForSession(true);
      setAdminPassphrase("");
      setIsAdminAccessModalOpen(false);
      setAdminViewMode("admin");
      setAdminViewerManager(null);
      await utils.auth.me.invalidate();
      toast.success("Admin session unlocked.");
    },
    onError: loginError => {
      toast.error(loginError.message);
    },
  });

  const handleAdminAccessOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      setIsAdminAccessModalOpen(false);
      setAdminPassphrase("");
    },
    [setAdminPassphrase, setIsAdminAccessModalOpen]
  );

  const handleAdminStayRegularView = useCallback(() => {
    setIsAdminAccessModalOpen(false);
    setAdminPassphrase("");
  }, [setAdminPassphrase, setIsAdminAccessModalOpen]);

  const handleAdminSubmit = useCallback(() => {
    submitAdminLogin({ passphrase: adminPassphrase });
  }, [adminPassphrase, submitAdminLogin]);

  return {
    handleAdminAccessOpenChange,
    handleAdminStayRegularView,
    handleAdminSubmit,
    isAdminLoginPending,
  };
}
