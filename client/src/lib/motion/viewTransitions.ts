const VIEW_TRANSITION_ACTIVE_CLASS = "dd-view-transition-active";
const VIEW_TRANSITION_TIMEOUT_MS = 700;

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished?: Promise<void>;
  };
};

export function isViewTransitionActive() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains(VIEW_TRANSITION_ACTIVE_CLASS)
  );
}

export function runViewTransition(
  callback: () => void,
  { enabled }: { enabled: boolean },
) {
  if (typeof document === "undefined" || !enabled) {
    callback();
    return false;
  }

  const viewTransitionDocument = document as ViewTransitionDocument;
  if (typeof viewTransitionDocument.startViewTransition !== "function") {
    callback();
    return false;
  }

  const root = document.documentElement;
  let cleanupTimer = 0;
  const clearActive = () => {
    root.classList.remove(VIEW_TRANSITION_ACTIVE_CLASS);
    if (cleanupTimer) window.clearTimeout(cleanupTimer);
  };

  root.classList.add(VIEW_TRANSITION_ACTIVE_CLASS);
  const transition = viewTransitionDocument.startViewTransition(callback);
  cleanupTimer = window.setTimeout(clearActive, VIEW_TRANSITION_TIMEOUT_MS);
  transition.finished?.finally(clearActive);

  return true;
}
