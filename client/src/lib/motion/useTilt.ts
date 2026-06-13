import { type CSSProperties, type RefObject, useEffect, useState } from "react";
import { useAnimationsEnabled } from "./useAnimationsEnabled";
import { useSpringValue } from "./useSpringValue";

type TiltOptions = {
  maxX?: number;
  maxY?: number;
  disabled?: boolean;
};

type TiltStyle = CSSProperties | undefined;

const POINTER_FINE_QUERY = "(pointer: fine)";

function getLayerTransform({
  rotateX,
  rotateY,
  maxX,
  maxY,
  distance,
}: {
  rotateX: number;
  rotateY: number;
  maxX: number;
  maxY: number;
  distance: number;
}) {
  const x = maxY ? -(rotateY / maxY) * distance : 0;
  const y = maxX ? (rotateX / maxX) * distance : 0;
  return `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
}

export function useTilt<T extends HTMLElement>(
  ref: RefObject<T | null>,
  { maxX = 8, maxY = 10, disabled = false }: TiltOptions = {},
): {
  enabled: boolean;
  cardStyle: TiltStyle;
  avatarStyle: TiltStyle;
  copyStyle: TiltStyle;
} {
  const animationsEnabled = useAnimationsEnabled();
  const [finePointer, setFinePointer] = useState(false);
  const [target, setTarget] = useState({ x: 0, y: 0 });
  const rotateX = useSpringValue(target.x, { stiffness: 155, damping: 21 });
  const rotateY = useSpringValue(target.y, { stiffness: 155, damping: 21 });
  const enabled = animationsEnabled && finePointer && !disabled;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const media = window.matchMedia(POINTER_FINE_QUERY);
    const update = () => setFinePointer(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setTarget({ x: 0, y: 0 });
      return;
    }

    const element = ref.current;
    if (!element) return;

    let isSelecting = false;
    const reset = () => setTarget({ x: 0, y: 0 });

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        reset();
        return;
      }

      if (isSelecting || event.buttons !== 0) {
        reset();
        return;
      }

      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      setTarget({
        x: Math.max(-maxX, Math.min(maxX, -y * maxX * 2)),
        y: Math.max(-maxY, Math.min(maxY, x * maxY * 2)),
      });
    };

    const handlePointerDown = () => {
      isSelecting = true;
      reset();
    };
    const handlePointerUp = () => {
      isSelecting = false;
      reset();
    };

    element.addEventListener("pointermove", handlePointerMove, { passive: true });
    element.addEventListener("pointerleave", reset, { passive: true });
    element.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", handlePointerUp, { passive: true });

    return () => {
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerleave", reset);
      element.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [enabled, maxX, maxY, ref]);

  if (!enabled) {
    return {
      enabled,
      cardStyle: undefined,
      avatarStyle: undefined,
      copyStyle: undefined,
    };
  }

  return {
    enabled,
    cardStyle: {
      transform: `perspective(900px) rotateX(${rotateX.toFixed(3)}deg) rotateY(${rotateY.toFixed(3)}deg)`,
      transformStyle: "preserve-3d",
      willChange: "transform",
    },
    avatarStyle: {
      transform: getLayerTransform({ rotateX, rotateY, maxX, maxY, distance: 6 }),
      willChange: "transform",
    },
    copyStyle: {
      transform: getLayerTransform({ rotateX, rotateY, maxX, maxY, distance: 3 }),
      willChange: "transform",
    },
  };
}
