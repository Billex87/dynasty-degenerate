import { useCallback, useEffect, useRef } from "react";

export function useQueuedTimeouts() {
  const timerRefs = useRef<number[]>([]);

  const clearQueuedTimeouts = useCallback(() => {
    timerRefs.current.forEach(timer => window.clearTimeout(timer));
    timerRefs.current = [];
  }, []);

  const queueTimeout = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timerRefs.current = timerRefs.current.filter(
        queuedTimer => queuedTimer !== timer
      );
      callback();
    }, delay);
    timerRefs.current.push(timer);
  }, []);

  useEffect(
    () => () => {
      clearQueuedTimeouts();
    },
    [clearQueuedTimeouts]
  );

  return {
    clearQueuedTimeouts,
    queueTimeout,
  };
}
