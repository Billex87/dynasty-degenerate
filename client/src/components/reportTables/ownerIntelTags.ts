import type { ReportData } from "@shared/types";
import { getManagerProfileLabel } from "@/lib/managerProfileLabels";

type OwnerIntelRow = NonNullable<
  ReportData["managerRosterIntelligence"]
>[number];
type OwnerTradeRow = NonNullable<ReportData["tradeTendencies"]>[number];
type OwnerPickRow = NonNullable<ReportData["pickPortfolios"]>[number];
type OwnerTimelineRow = NonNullable<ReportData["dynastyTimelines"]>[number];
type OwnerPowerRow = NonNullable<ReportData["powerRankings"]>[number];
type OwnerGrowthRow = NonNullable<
  ReportData["managerRosterValueGrowth"]
>[number];

export type ManagerSignalTag = {
  label: string;
  tone: "neutral" | "good" | "warn" | "danger" | "future" | "elite";
};

export type OwnerIntelTileTag = {
  label: string;
  tone: "neutral" | "good" | "warn" | "danger" | "future";
};

export function titleCasePill(value: string): string {
  const acronyms = new Set(["QB", "RB", "WR", "TE", "SF", "PPR", "FA"]);
  return value.replace(/\w\S*/g, word => {
    const upper = word.toUpperCase();
    if (/^(QB|RB|WR|TE)\d+$/i.test(word)) return upper;
    if (acronyms.has(upper)) return upper;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

export function getPillToneClass(value: string): string {
  const normalized = value.toLowerCase();
  if (
    normalized.includes("old") ||
    normalized.includes("risk") ||
    normalized.includes("weak") ||
    normalized.includes("behind") ||
    normalized.includes("thin") ||
    normalized.includes("fragile") ||
    normalized.includes("cuttable")
  ) {
    return "manager-intel-pill-danger";
  }
  if (
    normalized.includes("young") ||
    normalized.includes("contender") ||
    normalized.includes("win") ||
    normalized.includes("elite") ||
    normalized.includes("shark") ||
    normalized.includes("war chest") ||
    normalized.includes("final boss") ||
    normalized.includes("thanos") ||
    normalized.includes("heavyweight") ||
    normalized.includes("problem") ||
    normalized.includes("spoiler") ||
    normalized.includes("title threat") ||
    normalized.includes("playoff push") ||
    normalized.includes("no brakes")
  ) {
    return "manager-intel-pill-good";
  }
  if (
    normalized.includes("rebuild") ||
    normalized.includes("future") ||
    normalized.includes("youth") ||
    normalized.includes("draft mode")
  ) {
    return "manager-intel-pill-future";
  }
  return "manager-intel-pill-neutral";
}

export function buildManagerSignalTags({
  identity,
  starterCount,
  powerScore,
  timeline,
  rosterHealthScore,
  avgAge,
  starterAvailability,
  holesSummary,
  tradeRow,
  pickRow,
  ageFlags = [],
}: {
  identity?: string | null;
  starterCount?: number | null;
  powerScore?: number | null;
  timeline?: OwnerTimelineRow | null;
  rosterHealthScore?: number | null;
  avgAge?: number | null;
  starterAvailability?: OwnerIntelRow["starterAvailability"] | null;
  holesSummary?: string | null;
  tradeRow?: OwnerTradeRow | null;
  pickRow?: OwnerPickRow | null;
  ageFlags?: string[];
}): ManagerSignalTag[] {
  const contenders = timeline?.contenderScore ?? 0;
  const rebuild = timeline?.rebuildScore ?? 0;
  const agingRisk = timeline?.agingRisk ?? 0;
  const futurePickCount = (pickRow?.count2026 || 0) + (pickRow?.count2027 || 0);
  const tags: ManagerSignalTag[] = [];

  if (powerScore !== null && powerScore !== undefined && powerScore >= 90)
    tags.push({ label: `Thanos ${powerScore}`, tone: "elite" });
  else if (powerScore !== null && powerScore !== undefined && powerScore <= 48)
    tags.push({ label: `Needs Work ${powerScore}`, tone: "danger" });

  if (contenders >= 90 && contenders - rebuild >= 22)
    tags.push({ label: `Title Threat ${contenders}`, tone: "good" });
  else if (contenders >= 80 && contenders - rebuild >= 14)
    tags.push({ label: `Might Surprise ${contenders}`, tone: "good" });
  else if (contenders >= 70 && contenders - rebuild >= 4)
    tags.push({ label: `Could Steal It ${contenders}`, tone: "warn" });
  else if (rebuild >= 68 && rebuild - contenders >= 10)
    tags.push({ label: `Future Rich ${rebuild}`, tone: "future" });
  else if (contenders >= 70 && rebuild >= 52)
    tags.push({ label: "Fork In Road", tone: "warn" });

  if (
    identity &&
    !["Balanced", "Middle Build"].includes(titleCasePill(identity))
  ) {
    tags.push({
      label: titleCasePill(identity),
      tone: getPillToneClass(identity).includes("danger")
        ? "danger"
        : getPillToneClass(identity).includes("future")
          ? "future"
          : "neutral",
    });
  }
  if (starterCount !== null && starterCount !== undefined && starterCount >= 12)
    tags.push({ label: `${starterCount} Starters`, tone: "good" });
  if (starterCount !== null && starterCount !== undefined && starterCount <= 8)
    tags.push({ label: `${starterCount} Starters`, tone: "warn" });
  if (
    rosterHealthScore !== null &&
    rosterHealthScore !== undefined &&
    rosterHealthScore >= 82
  )
    tags.push({ label: `Durable ${rosterHealthScore}`, tone: "good" });
  if (
    rosterHealthScore !== null &&
    rosterHealthScore !== undefined &&
    rosterHealthScore <= 48
  )
    tags.push({ label: `Fragile ${rosterHealthScore}`, tone: "danger" });
  if (starterAvailability?.riskLevel === "high")
    tags.push({ label: "Injury Watch", tone: "danger" });
  if (avgAge !== null && avgAge !== undefined && avgAge >= 27.6)
    tags.push({ label: "Age Cliff Watch", tone: "danger" });
  if (avgAge !== null && avgAge !== undefined && avgAge <= 25)
    tags.push({ label: "Youth Core", tone: "future" });
  if (agingRisk >= 58)
    tags.push({ label: `Age Risk ${agingRisk}`, tone: "danger" });
  if (futurePickCount >= 17)
    tags.push({ label: "Pick War Chest", tone: "future" });
  if (futurePickCount <= 12 && futurePickCount > 0)
    tags.push({ label: "Pick Light", tone: "warn" });
  if (
    tradeRow &&
    tradeRow.tradeCount >= 5 &&
    tradeRow.profit >= 2500 &&
    tradeRow.winPct >= 60
  )
    tags.push({ label: "Trade Shark", tone: "good" });
  if (tradeRow && tradeRow.tradeCount >= 4 && tradeRow.profit <= -2500)
    tags.push({ label: "Trade Tax", tone: "danger" });
  const primaryNeed =
    holesSummary && holesSummary !== "No major roster hole flagged"
      ? holesSummary.split(",")[0]?.trim()
      : null;
  if (primaryNeed)
    tags.push({ label: titleCasePill(primaryNeed), tone: "warn" });
  ageFlags
    .filter(flag => /old|young|durable|availability/i.test(flag))
    .slice(0, 1)
    .forEach(flag =>
      tags.push({
        label: titleCasePill(flag),
        tone: getPillToneClass(flag).includes("danger")
          ? "danger"
          : getPillToneClass(flag).includes("future")
            ? "future"
            : "neutral",
      })
    );

  const seen = new Set<string>();
  return tags
    .filter(tag => {
      const key = tag.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 7);
}

export function buildOwnerIntelTileTags({
  identity,
  powerRow,
  timeline,
  growthRow,
  starterAvailability,
  holesSummary,
  pickRow,
}: {
  identity?: string | null;
  powerRow?: OwnerPowerRow | null;
  timeline?: OwnerTimelineRow | null;
  growthRow?: OwnerGrowthRow | null;
  starterAvailability?: OwnerIntelRow["starterAvailability"] | null;
  holesSummary?: string | null;
  pickRow?: OwnerPickRow | null;
}): OwnerIntelTileTag[] {
  const tags: OwnerIntelTileTag[] = [];

  if (powerRow) {
    tags.push({
      label: `#${powerRow.rank} ${getManagerProfileLabel(powerRow.tier, powerRow.score).label}`,
      tone:
        powerRow.score >= 78
          ? "good"
          : powerRow.score <= 50
            ? "danger"
            : "neutral",
    });
  }

  if (growthRow) {
    tags.push({
      label: `${growthRow.growth >= 0 ? "+" : ""}${growthRow.growth.toFixed(1)}% growth`,
      tone: growthRow.growth >= 0 ? "good" : "danger",
    });
  }

  const contenderScore = timeline?.contenderScore ?? 0;
  const rebuildScore = timeline?.rebuildScore ?? 0;
  if (contenderScore >= 84 && contenderScore - rebuildScore >= 18) {
    tags.push({ label: "Contender Window", tone: "good" });
  } else if (rebuildScore >= 68 && rebuildScore - contenderScore >= 10) {
    tags.push({ label: "Rebuild Window", tone: "future" });
  } else if (contenderScore >= 70 && rebuildScore >= 52) {
    tags.push({ label: "Fork In Road", tone: "warn" });
  } else if (identity) {
    const normalizedIdentity = titleCasePill(identity);
    if (!["Balanced", "Middle Build"].includes(normalizedIdentity)) {
      tags.push({
        label: normalizedIdentity,
        tone: getPillToneClass(identity).includes("danger")
          ? "danger"
          : getPillToneClass(identity).includes("future")
            ? "future"
            : "neutral",
      });
    }
  }

  const primaryNeed =
    holesSummary && holesSummary !== "No major roster hole flagged"
      ? holesSummary.split(",")[0]?.trim()
      : null;
  if (primaryNeed) {
    tags.push({ label: titleCasePill(primaryNeed), tone: "warn" });
  } else if (starterAvailability?.riskLevel === "high") {
    tags.push({ label: "Injury Watch", tone: "danger" });
  }

  const futurePickCount = (pickRow?.count2026 || 0) + (pickRow?.count2027 || 0);
  if (futurePickCount >= 17) {
    tags.push({ label: "Pick War Chest", tone: "future" });
  }

  const seen = new Set<string>();
  return tags
    .filter(tag => {
      const key = tag.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}
