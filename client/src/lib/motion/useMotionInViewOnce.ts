import { useEffect, useRef, useState } from "react";
import { useAnimationsEnabled } from "./useAnimationsEnabled";

type UseMotionInViewOnceOptions = {
  rootMargin?: string;
  threshold?: number;
};

export function useMotionInViewOnce<T extends Element>({
  rootMargin = "0px 0px -10% 0px",
  threshold = 0.2,
}: UseMotionInViewOnceOptions = {}) {
  const animationsEnabled = useAnimationsEnabled();
  const ref = useRef<T | null>(null);
  const [hasEntered, setHasEntered] = useState(!animationsEnabled);

  useEffect(() => {
    if (!animationsEnabled) {
      setHasEntered(true);
      return;
    }

    if (hasEntered) return;

    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setHasEntered(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setHasEntered(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [animationsEnabled, hasEntered, rootMargin, threshold]);

  return { animationsEnabled, hasEntered, ref };
}
