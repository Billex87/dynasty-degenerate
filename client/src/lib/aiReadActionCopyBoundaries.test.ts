import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = path.resolve(process.cwd(), "client/src");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx)$/;

type DoThisMatch = {
  file: string;
  context: string;
};

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules") return [];

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath);

    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) return [];
    if (TEST_FILE_PATTERN.test(entry.name)) return [];
    return [fullPath];
  });
}

function normalizeContext(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function findExplicitComponentDoThisLabels(): DoThisMatch[] {
  return listSourceFiles(path.join(SOURCE_ROOT, "components")).flatMap((filePath) => {
    const source = fs.readFileSync(filePath, "utf8");
    return Array.from(source.matchAll(/label:\s*["']Do this["']/g)).map((match) => ({
      file: path.relative(SOURCE_ROOT, filePath),
      context: normalizeContext(source.slice(Math.max(0, match.index - 700), match.index + 1400)),
    }));
  });
}

function readSourceSubtrees(subtrees: string[]): string {
  return subtrees.flatMap((subtree) => listSourceFiles(path.join(SOURCE_ROOT, subtree)))
    .map((filePath) => fs.readFileSync(filePath, "utf8"))
    .join("\n");
}

describe("AI read action copy boundaries", () => {
  it("keeps secondary action queue rows labeled with verification or change framing", () => {
    const source = fs.readFileSync(path.join(SOURCE_ROOT, "components/AIActionQueue.tsx"), "utf8");

    expect(source).toContain("function getSecondaryQueueDetail");
    expect(source).toContain("label: 'Where to verify'");
    expect(source).toContain("label: 'What changes this'");
    expect(source).toContain("{secondaryDetail.label}: {secondaryDetail.detail}");
    expect(source).not.toContain("<em>{item.missingEvidence[0] || item.changeTriggers[0]}</em>");
  });

  it("keeps exact Do this copy limited to reviewed action-owned component panels", () => {
    const matches = findExplicitComponentDoThisLabels();

    expect(matches.map((match) => match.file).sort()).toEqual([
      "components/CommandCenterExpansion.tsx",
      "components/ReportTables.tsx",
    ]);

    const blueprintGenerate = matches.find((match) => match.file === "components/CommandCenterExpansion.tsx");
    expect(blueprintGenerate?.context).toContain('title="Monthly blueprint ready"');
    expect(blueprintGenerate?.context).toContain("View Monthly Blueprint");
    expect(blueprintGenerate?.context).toContain("Generate");

    const ownerBestMove = matches.find((match) => match.file === "components/ReportTables.tsx");
    expect(ownerBestMove?.context).toContain('title={isRedraft ? "Best Move" : "Dynasty Best Move"}');
    expect(ownerBestMove?.context).toContain('status: "Primary move"');
  });

  it("keeps matchup support labels out of must-start command copy", () => {
    const source = readSourceSubtrees(["components", "lib/autopilot"]);

    expect(source).not.toMatch(/\bMust start\b/i);
    expect(source).not.toMatch(/\bmust-start\b/i);
    expect(source).not.toMatch(/\bstart-over\b/i);
    expect(source).not.toMatch(/\bTrade away\b/i);
    expect(source).not.toMatch(/render as Do this now/i);
    expect(source).not.toMatch(/Why this fired/i);
    expect(source).not.toMatch(/Why this swap/i);
    expect(source).not.toMatch(/Why Better Cut/i);
    expect(source).not.toMatch(/Add missing evidence/i);
  });
});
