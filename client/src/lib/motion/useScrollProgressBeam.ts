import { type RefObject, useEffect } from "react";

type ScrollProgressSource = "element" | "document";

function getDocumentProgress() {
  if (typeof document === "undefined") return 0;
  const root = document.documentElement;
  const scrollTop = root.scrollTop || document.body.scrollTop || 0;
  const maxScroll = Math.max(1, root.scrollHeight - root.clientHeight);
  return Math.min(1, Math.max(0, scrollTop / maxScroll));
}

function getElementProgress(element: HTMLElement) {
  const maxScroll = Math.max(1, element.scrollHeight - element.clientHeight);
  return Math.min(1, Math.max(0, element.scrollTop / maxScroll));
}

export function useScrollProgressBeam(
  ref: RefObject<HTMLElement | null>,
  { source = "element" }: { source?: ScrollProgressSource } = {},
) {
  useEffect(() => {
    const target = ref.current;
    if (typeof window === "undefined" || !target) return;

    const scroller: HTMLElement | Window =
      source === "document" ? window : target;
    const writeProgress = () => {
      const progress =
        source === "document" ? getDocumentProgress() : getElementProgress(target);
      target.style.setProperty("--dd-reading-progress", progress.toFixed(4));
    };

    writeProgress();
    scroller.addEventListener("scroll", writeProgress, { passive: true });
    window.addEventListener("resize", writeProgress, { passive: true });

    return () => {
      scroller.removeEventListener("scroll", writeProgress);
      window.removeEventListener("resize", writeProgress);
      target.style.removeProperty("--dd-reading-progress");
    };
  }, [ref, source]);
}
