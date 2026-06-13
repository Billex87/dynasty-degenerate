import { type RefObject, useEffect } from "react";
import { useAnimationsEnabled } from "./useAnimationsEnabled";

const POINTER_FINE_QUERY = "(pointer: fine)";
const ANY_POINTER_FINE_QUERY = "(any-pointer: fine)";
const OPEN_DIALOG_SELECTOR = '[role="dialog"][data-state="open"], [data-slot="dialog-content"][data-state="open"]';

type CursorReactiveGridGate = {
  hasElement: boolean;
  disabled: boolean;
  animationsEnabled: boolean;
  hasMatchMedia: boolean;
  pointerFine: boolean;
  anyPointerFine: boolean;
};

export function shouldArmCursorReactiveGrid({
  hasElement,
  disabled,
  animationsEnabled,
  hasMatchMedia,
  pointerFine,
  anyPointerFine,
}: CursorReactiveGridGate) {
  return (
    hasElement &&
    !disabled &&
    animationsEnabled &&
    hasMatchMedia &&
    (pointerFine || anyPointerFine)
  );
}

export function useCursorReactiveGrid(
  ref: RefObject<HTMLElement | null>,
  { disabled = false }: { disabled?: boolean } = {},
) {
  const animationsEnabled = useAnimationsEnabled();

  useEffect(() => {
    const element = ref.current;
    if (typeof window === "undefined" || !window.matchMedia) {
      element?.removeAttribute("data-dd-cursor-grid");
      return;
    }

    const pointerFineMedia = window.matchMedia(POINTER_FINE_QUERY);
    const anyPointerFineMedia = window.matchMedia(ANY_POINTER_FINE_QUERY);
    if (
      !element ||
      !shouldArmCursorReactiveGrid({
        hasElement: true,
        disabled,
        animationsEnabled,
        hasMatchMedia: true,
        pointerFine: pointerFineMedia.matches,
        anyPointerFine: anyPointerFineMedia.matches,
      })
    ) {
      element?.removeAttribute("data-dd-cursor-grid");
      return;
    }

    let frame = 0;
    let latestX = 0;
    let latestY = 0;

    const clearCursor = () => {
      element.removeAttribute("data-dd-cursor-grid");
      element.style.removeProperty("--dd-cursor-x");
      element.style.removeProperty("--dd-cursor-y");
    };

    const writeCursorVars = () => {
      frame = 0;
      if (document.querySelector(OPEN_DIALOG_SELECTOR)) {
        clearCursor();
        return;
      }

      const rect = element.getBoundingClientRect();
      element.style.setProperty("--dd-cursor-x", `${Math.round(latestX - rect.left)}px`);
      element.style.setProperty("--dd-cursor-y", `${Math.round(latestY - rect.top)}px`);
      element.setAttribute("data-dd-cursor-grid", "true");
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.buttons !== 0) return;
      latestX = event.clientX;
      latestY = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(writeCursorVars);
    };

    const handlePointerLeave = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      clearCursor();
    };

    element.addEventListener("pointermove", handlePointerMove, { passive: true });
    element.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerleave", handlePointerLeave);
      clearCursor();
    };
  }, [animationsEnabled, disabled, ref]);
}
