import { useEffect, useRef, useState } from "react";
import { DURATION } from "./motionTokens";
import { formatCount } from "./motionMath";
import { useAnimationsEnabled } from "./useAnimationsEnabled";

export type ValueBlipDirection = "up" | "down";

export type ValueBlip = {
  id: number;
  delta: number;
  direction: ValueBlipDirection;
  label: string;
};

type UseValueBlipOptions = {
  deltaFormatter?: (delta: number) => string;
  minDelta?: number;
};

export function useValueBlip(
  value: number | null | undefined,
  { deltaFormatter, minDelta = 0 }: UseValueBlipOptions = {},
) {
  const animationsEnabled = useAnimationsEnabled();
  const previousValueRef = useRef<number | null>(null);
  const blipIdRef = useRef(0);
  const [blip, setBlip] = useState<ValueBlip | null>(null);

  useEffect(() => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      previousValueRef.current = null;
      setBlip(null);
      return;
    }

    const previousValue = previousValueRef.current;
    previousValueRef.current = value;

    if (previousValue === null || !animationsEnabled) return;

    const delta = value - previousValue;
    if (!Number.isFinite(delta) || Math.abs(delta) <= minDelta || delta === 0) return;

    blipIdRef.current += 1;
    setBlip({
      id: blipIdRef.current,
      delta,
      direction: delta > 0 ? "up" : "down",
      label: deltaFormatter ? deltaFormatter(delta) : formatCount(delta, { plus: true }),
    });
  }, [animationsEnabled, deltaFormatter, minDelta, value]);

  useEffect(() => {
    if (!blip || typeof window === "undefined") return;

    const timeout = window.setTimeout(() => {
      setBlip(current => (current?.id === blip.id ? null : current));
    }, DURATION.blip + 80);

    return () => window.clearTimeout(timeout);
  }, [blip]);

  return blip;
}
