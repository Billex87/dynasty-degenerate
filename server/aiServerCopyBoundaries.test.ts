import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const SERVER_ROOT = path.resolve(process.cwd(), "server");
const SERVER_COPY_FILES = [
  "aiPredictionCalibration.ts",
  "playerCohortEngine.ts",
  "playerSituationDelta.ts",
  "projectionRolloutFixtures.ts",
];

function readServerCopySources(): string {
  return SERVER_COPY_FILES
    .map((file) => fs.readFileSync(path.join(SERVER_ROOT, file), "utf8"))
    .join("\n");
}

describe("server AI copy boundaries", () => {
  it("keeps server-generated AI confidence copy aligned to limit language", () => {
    const source = readServerCopySources();

    expect(source).toContain("confidence is limited by");
    expect(source).toContain("confidence limit");
    expect(source).toContain("confidence stays limited");
    expect(source).toContain("confidence should stay limited");
    expect(source).not.toContain("confidence is capped by");
    expect(source).not.toContain("confidence cap");
    expect(source).not.toContain("confidence stays capped");
    expect(source).not.toContain("confidence should stay capped");
  });
});
