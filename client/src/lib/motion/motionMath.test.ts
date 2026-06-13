import { describe, expect, it } from "vitest";
import { DURATION, EASE_OVERSHOOT, EASE_POP, EASE_RISE, STAGGER_STEP } from "./motionTokens";
import { easeOutCubic, formatCount, splitDigits } from "./motionMath";
import { buildSparklinePath } from "./sparklinePath";

describe("easeOutCubic", () => {
  it("maps boundaries to boundaries", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it("is monotonic over [0, 1]", () => {
    let previous = easeOutCubic(0);

    for (let step = 1; step <= 100; step += 1) {
      const next = easeOutCubic(step / 100);
      expect(next).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
  });
});

describe("formatCount", () => {
  it("groups values with en-US separators", () => {
    expect(formatCount(48210)).toBe("48,210");
  });

  it("adds plus prefixes to positives only", () => {
    expect(formatCount(12, { plus: true })).toBe("+12");
    expect(formatCount(0, { plus: true })).toBe("0");
    expect(formatCount(-12, { plus: true })).toBe("-12");
  });

  it("rounds floats before formatting", () => {
    expect(formatCount(12.4)).toBe("12");
    expect(formatCount(12.5)).toBe("13");
  });
});

describe("splitDigits", () => {
  it("tokenizes digits and separators", () => {
    expect(splitDigits("+48,210")).toEqual([
      { kind: "char", char: "+" },
      { kind: "digit", digit: 4 },
      { kind: "digit", digit: 8 },
      { kind: "char", char: "," },
      { kind: "digit", digit: 2 },
      { kind: "digit", digit: 1 },
      { kind: "digit", digit: 0 },
    ]);
  });

  it("round-trips formatted strings", () => {
    const formatted = "-48,210";
    const tokens = splitDigits(formatted);
    const roundTrip = tokens
      .map((token) => (token.kind === "digit" ? String(token.digit) : token.char))
      .join("");

    expect(roundTrip).toBe(formatted);
  });
});

describe("motionTokens", () => {
  it("keeps durations and stagger steps positive", () => {
    expect(Object.values(DURATION).every((duration) => duration > 0)).toBe(true);
    expect(Object.values(STAGGER_STEP).every((duration) => duration > 0)).toBe(true);
  });

  it("uses four-point cubic-bezier tuples", () => {
    expect(EASE_RISE).toHaveLength(4);
    expect(EASE_OVERSHOOT).toHaveLength(4);
    expect(EASE_POP).toHaveLength(4);
  });
});

describe("buildSparklinePath", () => {
  it("maps values into a stable SVG path", () => {
    expect(buildSparklinePath([0, 10, 5], 100, 20)).toBe("M 0 20 L 50 0 L 100 10");
  });

  it("centers flat values", () => {
    expect(buildSparklinePath([7, 7, 7], 60, 18)).toBe("M 0 9 L 30 9 L 60 9");
  });

  it("returns an empty path for unusable input", () => {
    expect(buildSparklinePath([1], 60, 18)).toBe("");
    expect(buildSparklinePath([1, 2], 0, 18)).toBe("");
    expect(buildSparklinePath([Number.NaN, 2], 60, 18)).toBe("");
  });
});
