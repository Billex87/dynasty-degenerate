import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
export const REDUCE_EFFECTS_STORAGE_KEY = "dd-reduce-effects";
const EFFECTS_PREFERENCE_EVENT = "dynasty-degens:effects-preference";

function readPrefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function readStoredReduceEffects() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(REDUCE_EFFECTS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredReduceEffects(reduceEffects: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (reduceEffects) {
      window.localStorage.setItem(REDUCE_EFFECTS_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(REDUCE_EFFECTS_STORAGE_KEY);
    }
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(EFFECTS_PREFERENCE_EVENT));
}

function useStoredReduceEffects() {
  const [reduceEffects, setReduceEffectsState] = useState(readStoredReduceEffects);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => setReduceEffectsState(readStoredReduceEffects());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === REDUCE_EFFECTS_STORAGE_KEY) update();
    };

    window.addEventListener(EFFECTS_PREFERENCE_EVENT, update);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(EFFECTS_PREFERENCE_EVENT, update);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return reduceEffects;
}

export function useAnimationsEnabled() {
  const framerReducedMotion = useReducedMotion();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readPrefersReducedMotion);
  const reduceEffects = useStoredReduceEffects();

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setPrefersReducedMotion(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return !(framerReducedMotion === true || prefersReducedMotion || reduceEffects);
}

export function useEffectsPreference() {
  const framerReducedMotion = useReducedMotion();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readPrefersReducedMotion);
  const reduceEffects = useStoredReduceEffects();

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setPrefersReducedMotion(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const osReducedMotion = framerReducedMotion === true || prefersReducedMotion;
  const effectsEnabled = !(osReducedMotion || reduceEffects);

  return {
    effectsEnabled,
    osReducedMotion,
    reduceEffects,
    setEffectsEnabled: (enabled: boolean) => writeStoredReduceEffects(!enabled),
  };
}
