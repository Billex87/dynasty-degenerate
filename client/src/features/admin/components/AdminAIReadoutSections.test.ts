import { describe, expect, it } from "vitest";
import { createCachedCommandCenterReport } from "../../../../../tests/e2e/fixtures/cachedReports";
import type { ReportData } from "@shared/types";
import {
  buildAIDecisionLogRows,
  buildAIDecisionLogSummary,
  buildAIReadoutDiagnostics,
  buildAISurfaceRegistry,
} from "./AdminAIReadoutSections";

describe("AdminAIReadoutSections diagnostics", () => {
  it("keeps Action Queue as the only action-owning AI surface", () => {
    const reportData = createCachedCommandCenterReport().reportData;
    const diagnostics = buildAIReadoutDiagnostics(reportData);
    const registry = buildAISurfaceRegistry(diagnostics);
    const decisionRows = buildAIDecisionLogRows(reportData, diagnostics);
    const decisionSummary = buildAIDecisionLogSummary(decisionRows);

    const actionOwners = registry.rows.filter(row => row.role === "action-owner");
    expect(actionOwners).toHaveLength(1);
    expect(actionOwners[0]).toMatchObject({
      id: "autopilot-actions",
      surface: "Action Queue",
      allowedClaim: "Can recommend",
    });
    expect(
      registry.rows
        .filter(row => row.id !== "autopilot-actions")
        .every(row => row.role !== "action-owner")
    ).toBe(true);
    expect(registry.actionOwners).toBe(1);
    expect(registry.mergeRows).toBe(0);
    expect(diagnostics.duplicateRisk).toBe(0);
    expect(decisionSummary.actionRows).toBe(1);
    expect(decisionSummary.mergeRows).toBe(0);
    expect(
      decisionRows.filter(row => row.decision === "Owns Action").map(row => row.id)
    ).toEqual(["readout-autopilot-actions"]);
    expect(decisionRows.some(row => row.id === "action-queue-alternates-held")).toBe(true);
    expect(decisionRows.some(row => row.blockers.includes("Duplicate claim"))).toBe(false);
  });

  it("routes duplicate-risk readouts to merge instead of action ownership", () => {
    const reportData = createCachedCommandCenterReport().reportData;
    const diagnostics = buildAIReadoutDiagnostics(reportData);
    const duplicateDiagnostics = {
      ...diagnostics,
      duplicateRisk: 1,
      rows: diagnostics.rows.map(row =>
        row.id === "overview-trades"
          ? {
              ...row,
              duplicateRisk: true,
              note: "Trade Finder is repeating the owning Action Queue call.",
            }
          : row
      ),
    };

    const registry = buildAISurfaceRegistry(duplicateDiagnostics);
    const decisionRows = buildAIDecisionLogRows(reportData, duplicateDiagnostics);
    const decisionSummary = buildAIDecisionLogSummary(decisionRows);
    const tradeRegistryRow = registry.rows.find(row => row.id === "overview-trades");
    const tradeDecisionRow = decisionRows.find(row => row.id === "readout-overview-trades");

    expect(tradeRegistryRow).toMatchObject({
      role: "merge",
      roleLabel: "Merge",
      allowedClaim: "No separate claim",
      noiseRule: "Fold into the owner.",
      nextStep: "Merge into owner.",
    });
    expect(tradeDecisionRow).toMatchObject({
      decision: "Merge",
      tone: "danger",
      blockers: ["Duplicate claim"],
    });
    expect(tradeDecisionRow?.changeTriggers).toContain("Merge copy");
    expect(decisionSummary.mergeRows).toBe(1);
    expect(decisionSummary.actionRows).toBe(1);
    expect(
      decisionRows.filter(row => row.decision === "Owns Action").map(row => row.id)
    ).toEqual(["readout-autopilot-actions"]);
  });

  it("removes action ownership when confidence evidence is missing", () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.leagueDiagnostics = {
      ...reportData.leagueDiagnostics,
      aiConfidence: undefined,
    };

    const diagnostics = buildAIReadoutDiagnostics(reportData);
    const registry = buildAISurfaceRegistry(diagnostics);
    const actionQueueRow = registry.rows.find(row => row.id === "autopilot-actions");

    expect(registry.actionOwners).toBe(0);
    expect(actionQueueRow).toMatchObject({
      role: "hidden",
      roleLabel: "Data",
      allowedClaim: "No AI claim",
      evidenceStatus: "Missing: confidence",
    });
    expect(
      diagnostics.rows.find(row => row.id === "autopilot-actions")
    ).toMatchObject({
      hasConfidence: false,
      hasTrace: true,
      tone: "warn",
    });
  });
});
