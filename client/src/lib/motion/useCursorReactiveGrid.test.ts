import { describe, expect, it } from "vitest";

import { shouldArmCursorReactiveGrid } from "./useCursorReactiveGrid";

describe("shouldArmCursorReactiveGrid", () => {
  it("does not arm while the report shell is disabled", () => {
    expect(
      shouldArmCursorReactiveGrid({
        hasElement: true,
        disabled: true,
        animationsEnabled: true,
        hasMatchMedia: true,
        pointerFine: true,
        anyPointerFine: false,
      }),
    ).toBe(false);
  });

  it("arms when any available pointer is fine", () => {
    expect(
      shouldArmCursorReactiveGrid({
        hasElement: true,
        disabled: false,
        animationsEnabled: true,
        hasMatchMedia: true,
        pointerFine: false,
        anyPointerFine: true,
      }),
    ).toBe(true);
  });
});
