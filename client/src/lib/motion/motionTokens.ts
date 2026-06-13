export const DURATION = {
  press: 60,
  fast: 180,
  base: 320,
  settle: 450,
  flip: 500,
  current: 550,
  ring: 700,
  count: 900,
  blip: 900,
  draw: 1100,
} as const;

export const EASE_RISE: [number, number, number, number] = [0.2, 0.8, 0.3, 1];
export const EASE_OVERSHOOT: [number, number, number, number] = [0.2, 0.9, 0.3, 1.2];
export const EASE_POP: [number, number, number, number] = [0.14, 0.84, 0.14, 1];

export const STAGGER_STEP = {
  tight: 60,
  base: 90,
  loose: 130,
} as const;

export function cssEase(ease: readonly [number, number, number, number]) {
  return `cubic-bezier(${ease.join(", ")})`;
}
