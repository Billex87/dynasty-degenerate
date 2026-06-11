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

function readSpecificSources(files: string[]): string {
  return files
    .map((file) => fs.readFileSync(path.join(SOURCE_ROOT, file), "utf8"))
    .join("\n");
}

describe("AI read action copy boundaries", () => {
  it("keeps secondary action queue rows labeled with manager-facing next-step framing", () => {
    const source = fs.readFileSync(path.join(SOURCE_ROOT, "components/AIActionQueue.tsx"), "utf8");

    expect(source).toContain("function getSecondaryQueueDetail");
    expect(source).toContain("label: 'What to verify'");
    expect(source).toContain("label: 'Manager impact'");
    expect(source).toContain("{secondaryDetail.label}: {secondaryDetail.detail}");
    expect(source).not.toContain("<em>{item.missingEvidence[0] || item.changeTriggers[0]}</em>");
    expect(source).not.toContain("label: 'Verify first'");
    expect(source).not.toContain("label: 'Could change'");
  });

  it("keeps shared AI trace drawers out of receipt/debug framing", () => {
    const source = fs.readFileSync(path.join(SOURCE_ROOT, "components/AIReadPanel.tsx"), "utf8");

    expect(source).toContain("function isManagerFacingTraceItem");
    expect(source).toContain("Read details");
    expect(source).toContain("Read strength");
    expect(source).toContain("Check roster, role, timing, and availability before acting");
    expect(source).toContain("Useful enough to act after a final roster check");
    expect(source).toContain("Hide or hold until a manager-useful signal appears");
    expect(source).not.toContain("Why this matters");
    expect(source).not.toContain("Blocked:");
    expect(source).not.toContain("Missing:");
    expect(source).not.toContain("Confidence cap:");
    expect(source).not.toContain("Strong source mix.");
    expect(source).not.toContain("Usable source mix.");
    expect(source).not.toContain("Directional read.");
  });

  it("keeps normal user-facing AI surfaces out of receipt and source-debug labels", () => {
    const source = readSpecificSources([
      "components/AIReadPanel.tsx",
      "components/AIActionQueue.tsx",
      "components/AITeamAutopilot.tsx",
      "components/CommandCenterExpansion.tsx",
      "components/PlayerDetailModal.tsx",
      "components/ReportTables.tsx",
      "components/reportTables/WaiverIntelligencePanel.tsx",
      "components/reportTables/TradeWarRoom.tsx",
      "components/reportTables/tradeLedgerUtils.tsx",
      "components/reportTables/CommandCenterLineup.tsx",
      "features/report/components/ReportNextMoveBrief.tsx",
      "features/report/components/ReportOverviewTab.tsx",
      "features/report/components/ReportDashboardShowcase.tsx",
      "features/report/lib/reportNextMoveBrief.ts",
      "lib/autopilot/buildAutopilotData.ts",
      "lib/scheduleEdgeRows.ts",
    ]);

    expect(source).not.toMatch(/Evidence band|Source-limited Read|source limited|Why it fired/i);
    expect(source).not.toMatch(/Historical Receipt|Pickup receipts|AI PICKUP/i);
    expect(source).not.toMatch(/Admin source review|Receipts Needed|No fake reads/i);
    expect(source).not.toMatch(/Stored weekly projection|stored weekly projection|Stored news/i);
    expect(source).not.toMatch(/Manager calibration|source health rows|AI receipts/i);
  });

  it("keeps normal AI surfaces out of internal confidence-cap language", () => {
    const normalSurfaceSource = readSpecificSources([
      "components/CommandCenterExpansion.tsx",
      "components/PlayerDetailModal.tsx",
      "features/home/lib/reportDelta.ts",
      "lib/aiReadDecision.ts",
    ]);
    const diagnosticSource = readSpecificSources([
      "features/admin/components/AdminCalibrationSections.tsx",
      "../../shared/aiEvidenceEngine.ts",
    ]);

    expect(normalSurfaceSource).toContain("Read strength moved");
    expect(normalSurfaceSource).toContain("read strength");
    expect(normalSurfaceSource).not.toMatch(/Confidence limited by|Limited ·|Confidence limited to/i);
    expect(normalSurfaceSource).not.toMatch(/stays confidence-limited|limited more strongly/i);
    expect(normalSurfaceSource).not.toMatch(/Confidence capped by|Confidence cap:|Capped ·/i);
    expect(normalSurfaceSource).not.toMatch(/Blocked:|Missing:|Guardrail:/);

    expect(diagnosticSource).toContain("Confidence limited to");
    expect(diagnosticSource).toContain("Do not act yet:");
    expect(diagnosticSource).toContain("Verify first:");
  });

  it("keeps public next-move telemetry free of private identifiers", () => {
    const source = readSpecificSources([
      "features/report/components/ReportNextMoveBrief.tsx",
      "features/report/lib/reportNextMoveBrief.ts",
    ]);

    expect(source).toContain("Report Next Move Visible");
    expect(source).toContain("getReportNextMoveTelemetryProperties");
    expect(source).not.toMatch(/track\([^)]*(leagueId|leagueName|username|manager|player|target)/i);
    expect(source).not.toMatch(/detail:\s*{[^}]*(leagueId|leagueName|username|manager|player|target)/i);
  });

  it("keeps exact Do this copy limited to reviewed action-owned component panels", () => {
    const matches = findExplicitComponentDoThisLabels();

    expect(matches.map((match) => match.file).sort()).toEqual([
      "components/CommandCenterExpansion.tsx",
      "components/ReportTables.tsx",
    ]);

    const blueprintGenerate = matches.find((match) => match.file === "components/CommandCenterExpansion.tsx");
    expect(blueprintGenerate?.context).toContain('title="Generate monthly blueprint"');
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
    expect(source).not.toMatch(/Why this fired/);
    expect(source).not.toMatch(/Why this swap/i);
    expect(source).not.toMatch(/Why Better Cut/i);
    expect(source).not.toMatch(/\bBetter Cut\b/i);
    expect(source).not.toMatch(/Add missing evidence/i);
    expect(source).not.toMatch(/do-this-now/i);
    expect(source).not.toMatch(/Prove preconditions/i);
    expect(source).not.toMatch(/Clear blocker/i);
    expect(source).not.toMatch(/Resolve confidence cap/i);
    expect(source).not.toMatch(/Confidence capped by/i);
    expect(source).not.toMatch(/confidence is capped/i);
    expect(source).not.toMatch(/confidence cap below/i);
    expect(source).not.toMatch(/Review confidence cap/i);
    expect(source).not.toMatch(/capped reads/i);
    expect(source).not.toMatch(/\bNo caps\b/i);
    expect(source).not.toMatch(/capped waiver read/i);
    expect(source).not.toMatch(/confidence should stay capped/i);
    expect(source).not.toMatch(/soften or cap the read/i);
    expect(source).not.toMatch(/confidence cap, not/i);
    expect(source).not.toMatch(/read capped until/i);
    expect(source).not.toMatch(/Refresh source:/i);
    expect(source).not.toMatch(/queue refused/i);
    expect(source).not.toMatch(/do-nothing counterfactual/i);
    expect(source).not.toMatch(/actively refusing/i);
  });
});
