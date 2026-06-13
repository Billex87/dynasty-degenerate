export type DigitToken =
  | { kind: "digit"; digit: number }
  | { kind: "char"; char: string };

export function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function easeOutCubic(p: number) {
  const clamped = clamp01(p);
  return 1 - Math.pow(1 - clamped, 3);
}

export function formatCount(value: number, opts: { plus?: boolean } = {}) {
  const rounded = Math.round(value);
  const formatted = rounded.toLocaleString("en-US");
  return opts.plus && rounded > 0 ? `+${formatted}` : formatted;
}

export function splitDigits(formatted: string): DigitToken[] {
  return Array.from(formatted).map((char) => {
    if (char >= "0" && char <= "9") {
      return { kind: "digit", digit: Number(char) };
    }
    return { kind: "char", char };
  });
}
