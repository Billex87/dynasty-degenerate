import { useCallback, useEffect, useRef, useState } from "react";
import { DURATION } from "./motionTokens";
import { easeOutCubic, formatCount } from "./motionMath";
import { useAnimationsEnabled } from "./useAnimationsEnabled";

type CountFormatter = (value: number) => string;

export function useCountUp(
  target: number,
  opts: { durationMs?: number; formatter?: CountFormatter; plus?: boolean } = {},
) {
  const { durationMs = DURATION.count, formatter, plus } = opts;
  const animationsEnabled = useAnimationsEnabled();
  const frameRef = useRef<number | null>(null);
  const currentValueRef = useRef(0);

  const formatFrame = useCallback(
    (value: number) => {
      const rounded = Math.round(value);
      return formatter ? formatter(rounded) : formatCount(rounded, { plus });
    },
    [formatter, plus],
  );

  const [displayValue, setDisplayValue] = useState(() => formatFrame(0));

  useEffect(() => {
    if (frameRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (!animationsEnabled || durationMs <= 0 || typeof window === "undefined") {
      currentValueRef.current = target;
      setDisplayValue(formatFrame(target));
      return;
    }

    const from = currentValueRef.current;
    const startedAt = window.performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const nextValue = from + (target - from) * easeOutCubic(progress);

      currentValueRef.current = progress >= 1 ? target : nextValue;
      setDisplayValue(formatFrame(currentValueRef.current));

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
      }
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [animationsEnabled, durationMs, formatFrame, target]);

  return animationsEnabled ? displayValue : formatFrame(target);
}
