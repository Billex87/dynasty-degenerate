import { useEffect, useRef, useState } from "react";
import { useAnimationsEnabled } from "./useAnimationsEnabled";

type SpringOptions = {
  stiffness?: number;
  damping?: number;
};

export function useSpringValue(
  target: number,
  { stiffness = 170, damping = 26 }: SpringOptions = {},
) {
  const animationsEnabled = useAnimationsEnabled();
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const velocityRef = useRef(0);

  useEffect(() => {
    if (!animationsEnabled || typeof window === "undefined") {
      valueRef.current = target;
      velocityRef.current = 0;
      setValue(target);
      return;
    }

    let frame = 0;
    let previous = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.064, Math.max(0.001, (now - previous) / 1000));
      previous = now;

      const displacement = target - valueRef.current;
      const acceleration = displacement * stiffness - velocityRef.current * damping;
      velocityRef.current += acceleration * dt;
      valueRef.current += velocityRef.current * dt;

      if (Math.abs(target - valueRef.current) < 0.001 && Math.abs(velocityRef.current) < 0.001) {
        valueRef.current = target;
        velocityRef.current = 0;
        setValue(target);
        return;
      }

      setValue(valueRef.current);
      frame = window.requestAnimationFrame(step);
    };

    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [animationsEnabled, damping, stiffness, target]);

  return value;
}
