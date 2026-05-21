import type { PlayerDetails } from "@shared/types";
import type { AIReadChip } from "@/components/AIReadPanel";

export type PlayerActionArchetypeRead = {
  key: string;
  label: string;
  tone: AIReadChip extends string ? never : NonNullable<Exclude<AIReadChip, string>["tone"]>;
  note: string;
  receipts: string[];
};

function cleanText(value?: string | null): string {
  return String(value || "").trim();
}

function hasDynamicSignal(details: PlayerDetails | null | undefined, type: string, direction?: string): boolean {
  return Boolean(details?.playerSituationDelta?.dynamicSignals?.some(signal =>
    signal.type === type && (!direction || signal.direction === direction)
  ));
}

export function buildPlayerActionArchetypeRead({
  playerName,
  position,
  details,
}: {
  playerName: string;
  position?: string | null;
  details?: PlayerDetails | null;
}): PlayerActionArchetypeRead | null {
  const delta = details?.playerSituationDelta || null;
  const cohort = details?.playerCohort || null;
  const schedule = details?.schedule || null;
  const name = cleanText(playerName) || cleanText(details?.fullName) || "Player";
  const pos = cleanText(position || details?.position);
  const receipts = [
    delta?.primaryLabel ? `Situation: ${delta.primaryLabel}` : null,
    cohort?.outcomeBucket ? `Cohort: ${cohort.outcomeBucket}` : null,
    cohort?.historicalComps?.archetype ? `Comps: ${cohort.historicalComps.archetype}` : null,
    schedule?.scheduleTier ? `Schedule: ${schedule.scheduleTier}` : null,
  ].filter(Boolean) as string[];

  if (schedule?.streamerWeeks?.length) {
    return {
      key: "schedule-streamer",
      label: "Schedule streamer",
      tone: "info",
      note: `${name} has a schedule window worth targeting, but only if role and availability stay live.`,
      receipts,
    };
  }

  if (delta?.primaryLabel === "vacated-opportunity" || hasDynamicSignal(details, "roster-room", "boost")) {
    return {
      key: "volume-spike",
      label: "Volume spike",
      tone: "good",
      note: `${name} has an opportunity-opening profile; this is the kind of role move that can beat the market.`,
      receipts,
    };
  }

  if (delta?.primaryLabel === "role-boost" || delta?.action === "stash") {
    return {
      key: "depth-chart-promotion",
      label: "Depth-chart promotion",
      tone: "good",
      note: `${name} has promotion-style context. Treat it as role evidence, not generic hype.`,
      receipts,
    };
  }

  if (delta?.primaryLabel === "draft-capital-patience" || cohort?.draftCapital?.opportunityWindow === "protected-runway") {
    return {
      key: "protected-runway",
      label: "Protected runway",
      tone: "good",
      note: `${name} has enough investment context to earn patience while the role resolves.`,
      receipts,
    };
  }

  if (cohort?.outcomeBucket === "breakout" || cohort?.outcomeBucket === "market-under-production") {
    return {
      key: "post-hype-breakout",
      label: "Post-hype breakout",
      tone: "good",
      note: `${name} has a production or cohort profile that can matter before consensus fully catches up.`,
      receipts,
    };
  }

  if (
    cohort?.outcomeBucket === "market-over-production" ||
    delta?.primaryLabel === "role-threat" ||
    delta?.primaryLabel === "crowded-room"
  ) {
    return {
      key: "market-trap",
      label: "Market trap",
      tone: "warn",
      note: `${name} has price or role risk underneath the headline value. Do not pay like the role is already locked.`,
      receipts,
    };
  }

  if (
    cohort?.outcomeBucket === "fade-risk" ||
    cohort?.outcomeBucket === "injury-risk" ||
    (details?.avgGamesMissed !== null && details?.avgGamesMissed !== undefined && details.avgGamesMissed >= 4)
  ) {
    return {
      key: "fragile-veteran",
      label: pos === "RB" || pos === "WR" || pos === "TE" ? "Fragile value" : "Availability tax",
      tone: "warn",
      note: `${name} carries a fragility tax. Use the read to price risk, not to panic-sell blindly.`,
      receipts,
    };
  }

  if (delta?.primaryLabel === "source-limited-route-read" || cohort?.outcomeBucket === "thin-signal") {
    return {
      key: "thin-role-read",
      label: "Thin role read",
      tone: "neutral",
      note: `${name} does not have enough role proof for a loud archetype yet.`,
      receipts,
    };
  }

  return null;
}
