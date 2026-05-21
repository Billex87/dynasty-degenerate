type ManagerProfileTone =
  | "boss"
  | "dynasty"
  | "scanner-contender"
  | "scanner-rebuilder"
  | "heavyweight"
  | "problem"
  | "spoiler"
  | "balanced"
  | "future"
  | "reload"
  | "squeak"
  | "neutral";

type ManagerProfileResult = {
  label: string;
  tone: ManagerProfileTone;
};

export type ManagerProfileLane = "dynasty" | "contender" | "rebuilder";

type ManagerProfileContext = {
  powerRow?: {
    score?: number | null;
    tier?: string | null;
    starterStrength?: number | null;
    rosterValue?: number | null;
    draftCapital?: number | null;
    youthScore?: number | null;
  } | null;
  timelineRow?: {
    contenderScore?: number | null;
    rebuildScore?: number | null;
    agingRisk?: number | null;
    label?: string | null;
  } | null;
  managerRow?: {
    identity?: string | null;
    timeline?: string | null;
    starterValuePct?: number | null;
    avgAge?: number | null;
    avgAgeByPosition?: Partial<Record<"QB" | "RB" | "WR" | "TE", number | null>>;
  } | null;
  overviewRow?: {
    rank_value?: number | null;
  } | null;
  dynastyScore?: number | null;
  leagueSize?: number;
};

function toFiniteNumber(value?: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function averageFinite(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function result(label: string, tone: ManagerProfileTone): ManagerProfileResult {
  return { label, tone };
}

function getScannerProfileForScore(
  score: number,
  lane: ManagerProfileLane
): ManagerProfileResult {
  const roundedScore = Math.round(score);

  if (lane === "contender") {
    if (roundedScore >= 92) return result("Fuck Around", "scanner-contender");
    if (roundedScore >= 84) return result("Smoke Show", "scanner-contender");
    if (roundedScore >= 76) return result("Pain in the Ass", "scanner-contender");
    if (roundedScore >= 64) return result("Upset Bastard", "scanner-contender");
    if (roundedScore >= 52) return result("Hanging Around", "scanner-contender");
    if (roundedScore >= 40) return result("Starter Short", "scanner-contender");
    return result("Easy Out", "scanner-contender");
  }

  if (lane === "rebuilder") {
    if (roundedScore >= 92) return result("Future Menace", "scanner-rebuilder");
    if (roundedScore >= 84) return result("Pick Sicko", "scanner-rebuilder");
    if (roundedScore >= 76) return result("Draft Hoarder", "scanner-rebuilder");
    if (roundedScore >= 64) return result("Still Cooking", "scanner-rebuilder");
    if (roundedScore >= 52) return result("Fix This Shit", "scanner-rebuilder");
    if (roundedScore >= 40) return result("Poverty Build", "scanner-rebuilder");
    return result("Check Back Never", "scanner-rebuilder");
  }

  if (roundedScore >= 92) return result("Rich as Fuck", "dynasty");
  if (roundedScore >= 84) return result("Asset Hoarder", "dynasty");
  if (roundedScore >= 76) return result("Roster Bully", "dynasty");
  if (roundedScore >= 64) return result("Deep Pockets", "dynasty");
  if (roundedScore >= 52) return result("Mid as Hell", "dynasty");
  if (roundedScore >= 40) return result("Broke Ass Build", "dynasty");
  return result("Value Dumpster", "dynasty");
}

function getScannerScoreForLane(
  lane: ManagerProfileLane,
  score?: number | null,
  context?: ManagerProfileContext
): number {
  const powerScore =
    toFiniteNumber(context?.powerRow?.score) ?? toFiniteNumber(score) ?? 0;

  if (lane === "contender") {
    return (
      toFiniteNumber(context?.timelineRow?.contenderScore) ??
      toFiniteNumber(context?.powerRow?.starterStrength) ??
      powerScore
    );
  }

  if (lane === "rebuilder") {
    return (
      toFiniteNumber(context?.timelineRow?.rebuildScore) ??
      averageFinite([
        context?.powerRow?.youthScore,
        context?.powerRow?.draftCapital,
      ]) ??
      powerScore
    );
  }

  return (
    toFiniteNumber(context?.powerRow?.rosterValue) ??
    toFiniteNumber(context?.dynastyScore) ??
    powerScore
  );
}

function getScoreForProfile(profile: ManagerProfileResult): number | null {
  if (profile.label === "Thanos") return 96;
  if (
    profile.label === "Heavyweight" ||
    profile.label === "Rich Fraud" ||
    profile.label === "Loaded Loser" ||
    profile.label === "You Better Win" ||
    profile.label === "Title Threat" ||
    profile.label === "Ring Ready" ||
    profile.label === "Future Stacked" ||
    profile.label === "Pick Rich"
  ) return 91;
  if (
    profile.label === "Could Be a Threat" ||
    profile.label === "Might Surprise" ||
    profile.label === "Broke Flex" ||
    profile.label === "Real Threat" ||
    profile.label === "One Move Away" ||
    profile.label === "Scares Me a Little" ||
    profile.label === "Draft Loaded"
  ) return 86;
  if (
    profile.label === "Sneaky Problem" ||
    profile.label === "Could Steal It" ||
    profile.label === "Fake Tough" ||
    profile.label === "Actually Building" ||
    profile.label === "Cooking"
  ) return 81;
  if (profile.label === "Meh" || profile.label === "Mid As Hell") return 70;
  if (
    profile.label === "Free Money" ||
    profile.label === "Free Win" ||
    profile.label === "Felony Roster" ||
    profile.label === "No Future" ||
    profile.label === "Sell Your Team" ||
    profile.label === "All In" ||
    profile.label === "Time to Rebuild"
  ) return 0;
  return null;
}

function getScoreOnlyProfile(score: number): ManagerProfileResult {
  if (score >= 96) return result("Thanos", "boss");
  if (score >= 91) return result("Heavyweight", "heavyweight");
  if (score >= 86) return result("Might Surprise", "problem");
  if (score >= 81) return result("Broke Flex", "spoiler");
  if (score >= 70) return result("Mid As Hell", "balanced");
  return result("Free Money", "squeak");
}

function getOwnerIntelDynastyProfileForScore(
  roundedScore: number,
  context?: {
    contenderScore?: number | null;
    rebuilderScore?: number | null;
  }
): ManagerProfileResult {
  const contenderScore = toFiniteNumber(context?.contenderScore) ?? 0;
  const rebuilderScore = toFiniteNumber(context?.rebuilderScore) ?? 0;

  if (roundedScore >= 96 && contenderScore >= 90) {
    return result("Thanos", "boss");
  }

  if (roundedScore >= 96 && contenderScore < 82 && rebuilderScore >= 70) {
    return result("Future Rich", "future");
  }

  if (roundedScore >= 96) {
    return result("Rich Fraud", "heavyweight");
  }

  if (roundedScore >= 91 && contenderScore >= 90) {
    return result("You Better Win", "heavyweight");
  }

  if (roundedScore >= 91 && rebuilderScore >= 70 && contenderScore < 86) {
    return result("Future Rich", "future");
  }

  if (roundedScore >= 91) {
    return result("Loaded Loser", "heavyweight");
  }

  if (roundedScore >= 86 && contenderScore >= 90) {
    return result("You Better Win", "heavyweight");
  }

  if (roundedScore >= 86 && rebuilderScore >= 70 && contenderScore < 86) {
    return result("Pick Hoarder", "future");
  }

  if (roundedScore >= 86) {
    return result("Might Surprise", "problem");
  }

  if (roundedScore >= 81 && contenderScore >= 90) {
    return result("You Better Win", "heavyweight");
  }

  if (roundedScore >= 81 && rebuilderScore >= 70) {
    return result("Pick Hoarder", "future");
  }

  if (roundedScore >= 81 && rebuilderScore < 49 && contenderScore < 70) {
    return result("No Future", "squeak");
  }

  if (roundedScore >= 81) {
    return result("Broke Flex", "spoiler");
  }

  if (roundedScore >= 70 && contenderScore >= 90) {
    return result("You Better Win", "heavyweight");
  }

  if (roundedScore >= 70 && rebuilderScore >= 70) {
    return result("Pick Hoarder", "future");
  }

  if (roundedScore >= 70) return result("Mid As Hell", "balanced");
  if (rebuilderScore >= 70) return result("Pick Hoarder", "future");
  if (rebuilderScore < 49 && contenderScore < 60) return result("Felony Roster", "squeak");
  if (rebuilderScore < 49) return result("No Future", "squeak");
  return result("Free Money", "squeak");
}

function getOwnerIntelProfileForScore(
  score: number,
  lane: ManagerProfileLane,
  context?: {
    dynastyScore?: number | null;
    contenderScore?: number | null;
    rebuilderScore?: number | null;
  }
): ManagerProfileResult {
  const roundedScore = Math.round(score);

  if (lane === "rebuilder") {
    const contenderScore = toFiniteNumber(context?.contenderScore) ?? 0;
    const dynastyScore = toFiniteNumber(context?.dynastyScore) ?? 0;
    if (roundedScore >= 75 && dynastyScore >= 90) {
      return result("Future Menace", "future");
    }
    if (roundedScore >= 70) return result("Future Stacked", "future");
    if (roundedScore >= 60 && dynastyScore >= 84) {
      return result("Actually Building", "reload");
    }
    if (roundedScore >= 49) return result("Half Built", "balanced");
    if (contenderScore >= 90) return result("All In", "heavyweight");
    if (dynastyScore >= 84) return result("Time to Rebuild", "reload");
    return result("Sell Your Team", "squeak");
  }

  if (lane === "contender") {
    const dynastyScore = toFiniteNumber(context?.dynastyScore) ?? 0;
    const rebuilderScore = toFiniteNumber(context?.rebuilderScore) ?? 0;
    if (roundedScore >= 96 && dynastyScore >= 90) return result("Crown Me", "boss");
    if (roundedScore >= 91 && rebuilderScore < 49) {
      return result("All In", "heavyweight");
    }
    if (roundedScore >= 91) return result("Title Threat", "heavyweight");
    if (roundedScore >= 86 && rebuilderScore < 49) {
      return result("All In", "heavyweight");
    }
    if (roundedScore >= 86 && (dynastyScore >= 90 || rebuilderScore >= 60)) {
      return result("One Move Away", "problem");
    }
    if (roundedScore >= 86) return result("Scares Me a Little", "problem");
    if (roundedScore >= 81 && dynastyScore >= 84) {
      return result("Could Steal It", "spoiler");
    }
    if (roundedScore >= 81) return result("Fake Tough", "spoiler");
    if (roundedScore >= 70) return result("Mid As Hell", "balanced");
    if (rebuilderScore >= 60 || dynastyScore >= 84) {
      return result("Rebuilding", "future");
    }
    return result("Free Win", "squeak");
  }

  return getOwnerIntelDynastyProfileForScore(roundedScore, context);
}

function getProfileFromLabel(label?: string | null): ManagerProfileResult {
  const normalized = String(label || "").toLowerCase();
  if (/juggernaut|final boss|thanos/.test(normalized)) {
    return result("Thanos", "boss");
  }
  if (/strong contender|heavyweight|rich fraud|loaded loser|you better win/.test(normalized)) {
    return result("Heavyweight", "heavyweight");
  }
  if (/title threat|true contender|contender|playoff push|all in|no brakes|problem|dangerous|might surprise|scares me/.test(normalized)) {
    return result("Scares Me a Little", "problem");
  }
  if (/playoff mix|chaos bracket|wild card|spoiler|upset alert|could steal it|fake tough|broke flex/.test(normalized)) {
    return result("Could Steal It", "spoiler");
  }
  if (/strong rebuilder|future rich|future menace|future stacked|pick rich|pick hoarder|draft mode|rebuild mode/.test(normalized)) {
    return result("Future Menace", "future");
  }
  if (/reloading|reload crew|weak rebuilder|work in progress|actually building/.test(normalized)) {
    return result("Time to Rebuild", "reload");
  }
  if (/pip squeak|lunch money|try harder|first time|free money|free win|sell your team|felony roster|no future/.test(normalized)) {
    return result("Free Money", "squeak");
  }
  if (/balanced|middle child|meh|mid as hell|purgatory|lost/.test(normalized)) {
    return result("Mid As Hell", "balanced");
  }
  return result(label || "Manager", "neutral");
}

function getContextProfile(
  label?: string | null,
  score?: number | null,
  context?: ManagerProfileContext
): ManagerProfileResult | null {
  if (!context) return null;

  const powerScore =
    toFiniteNumber(context.powerRow?.score) ?? toFiniteNumber(score);
  const titleScore =
    toFiniteNumber(context.timelineRow?.contenderScore) ??
    toFiniteNumber(context.powerRow?.starterStrength) ??
    powerScore ??
    0;
  const rebuildScore =
    toFiniteNumber(context.timelineRow?.rebuildScore) ??
    averageFinite([
      context.powerRow?.youthScore,
      context.powerRow?.draftCapital,
    ]) ??
    0;
  const valueScore =
    toFiniteNumber(context.powerRow?.rosterValue) ??
    toFiniteNumber(context.dynastyScore) ??
    powerScore ??
    0;
  const futureScore =
    averageFinite([context.powerRow?.youthScore, context.powerRow?.draftCapital]) ??
    rebuildScore;
  const starterShare =
    toFiniteNumber(context.managerRow?.starterValuePct) ??
    toFiniteNumber(context.powerRow?.starterStrength) ??
    0;
  const leagueSize = Math.max(0, Math.floor(context.leagueSize || 0));
  const valueRank = toFiniteNumber(context.overviewRow?.rank_value);
  const eliteValueCut = leagueSize ? Math.max(1, Math.ceil(leagueSize * 0.2)) : 0;
  const titleValueCut = leagueSize ? Math.max(1, Math.ceil(leagueSize * 0.35)) : 0;
  const bottomValueCut = leagueSize ? Math.max(1, Math.ceil(leagueSize * 0.68)) : 0;
  const basementValueCut = leagueSize ? Math.max(1, Math.ceil(leagueSize * 0.84)) : 0;
  const hasEliteTitleValue =
    (Boolean(valueRank) && eliteValueCut > 0 && valueRank! <= eliteValueCut) ||
    valueScore >= 94;
  const hasTitleValue =
    (Boolean(valueRank) && titleValueCut > 0 && valueRank! <= titleValueCut) ||
    valueScore >= 86;
  const isBottomValue =
    (Boolean(valueRank) && bottomValueCut > 0 && valueRank! >= bottomValueCut) ||
    valueScore <= 64;
  const isBasementValue =
    (Boolean(valueRank) && basementValueCut > 0 && valueRank! >= basementValueCut) ||
    valueScore <= 42;
  const avgAge = toFiniteNumber(context.managerRow?.avgAge);
  const rbAge = toFiniteNumber(context.managerRow?.avgAgeByPosition?.RB);
  const olderRoster = (avgAge ?? 0) >= 27.3 || (rbAge ?? 0) >= 26.8;
  const source = [
    label,
    context.powerRow?.tier,
    context.timelineRow?.label,
    context.managerRow?.identity,
    context.managerRow?.timeline,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const contextScore =
    hasEliteTitleValue && titleScore >= 88 && starterShare >= 48
      ? Math.max(valueScore, 96)
      : hasTitleValue && titleScore >= 78 && starterShare >= 44
        ? Math.max(valueScore, 91)
        : isBasementValue && titleScore <= 46 && rebuildScore <= 55
          ? Math.min(valueScore, 69)
          : valueScore;

  if (
    rebuildScore >= 64 ||
    futureScore >= 68 ||
    (isBottomValue && (titleScore < 70 || olderRoster)) ||
    /rebuild|future|youth/.test(source)
  ) {
    return getOwnerIntelDynastyProfileForScore(Math.round(contextScore), {
      contenderScore: titleScore,
      rebuilderScore: Math.max(rebuildScore, futureScore),
    });
  }

  return getOwnerIntelDynastyProfileForScore(Math.round(contextScore), {
    contenderScore: titleScore,
    rebuilderScore: rebuildScore,
  });
}

export function getManagerProfileLabel(
  label?: string | null,
  score?: number | null,
  context?: ManagerProfileContext
): ManagerProfileResult {
  const contextProfile = getContextProfile(label, score, context);
  if (contextProfile) return contextProfile;

  const finiteScore = toFiniteNumber(score);
  if (finiteScore !== null) return getScoreOnlyProfile(finiteScore);

  return getProfileFromLabel(label);
}

export function getOwnerIntelProfileLabel(
  lane: ManagerProfileLane,
  score?: number | null,
  fallbackLabel?: string | null,
  context?: {
    dynastyScore?: number | null;
    contenderScore?: number | null;
    rebuilderScore?: number | null;
  }
): ManagerProfileResult {
  const finiteScore = toFiniteNumber(score);
  if (finiteScore !== null) {
    return getOwnerIntelProfileForScore(finiteScore, lane, context);
  }

  const fallbackProfile = getProfileFromLabel(fallbackLabel);
  const fallbackScore = getScoreForProfile(fallbackProfile);
  if (fallbackScore !== null) {
    return getOwnerIntelProfileForScore(fallbackScore, lane, context);
  }

  return fallbackProfile;
}

export function getLeagueRosterScannerProfileLabel(
  label?: string | null,
  score?: number | null,
  context?: ManagerProfileContext,
  lane: ManagerProfileLane = "dynasty"
): ManagerProfileResult {
  const laneScore = getScannerScoreForLane(lane, score, context);
  const fallbackScore = toFiniteNumber(score);

  if (context || fallbackScore !== null) {
    return getScannerProfileForScore(laneScore, lane);
  }

  const labelProfile = getProfileFromLabel(label);
  const labelScore = getScoreForProfile(labelProfile);
  return getScannerProfileForScore(labelScore ?? 0, lane);
}
