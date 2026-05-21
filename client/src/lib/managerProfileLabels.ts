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
    if (roundedScore >= 84) return result("Pick Goblin", "scanner-rebuilder");
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
    profile.label === "Ring Ready" ||
    profile.label === "Pick Rich"
  ) return 91;
  if (
    profile.label === "Could Be a Threat" ||
    profile.label === "Real Threat" ||
    profile.label === "One Move Away" ||
    profile.label === "Draft Loaded"
  ) return 86;
  if (
    profile.label === "Sneaky Problem" ||
    profile.label === "Could Steal It" ||
    profile.label === "Cooking"
  ) return 81;
  if (profile.label === "Meh") return 70;
  if (
    profile.label === "Free Money" ||
    profile.label === "Sell Your Team" ||
    profile.label === "All In" ||
    profile.label === "Time to Rebuild"
  ) return 0;
  return null;
}

function getScoreOnlyProfile(score: number): ManagerProfileResult {
  if (score >= 96) return result("Thanos", "boss");
  if (score >= 91) return result("Heavyweight", "heavyweight");
  if (score >= 86) return result("Could Be a Threat", "problem");
  if (score >= 81) return result("Sneaky Problem", "spoiler");
  if (score >= 70) return result("Meh", "balanced");
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
    if (roundedScore >= 70) return result("Future Menace", "future");
    if (roundedScore >= 61) return result("Pick Rich", "future");
    if (roundedScore >= 56) return result("Cooking", "reload");
    if (roundedScore >= 49) return result("Half Built", "balanced");
    if (contenderScore >= 90) return result("All In", "heavyweight");
    if (dynastyScore >= 84) return result("Time to Rebuild", "reload");
    return result("Sell Your Team", "squeak");
  }

  if (lane === "contender") {
    const dynastyScore = toFiniteNumber(context?.dynastyScore) ?? 0;
    const rebuilderScore = toFiniteNumber(context?.rebuilderScore) ?? 0;
    if (roundedScore >= 96) return result("Crown Me", "boss");
    if (roundedScore >= 91 && rebuilderScore < 49) {
      return result("All In", "heavyweight");
    }
    if (roundedScore >= 91) return result("Ring Ready", "heavyweight");
    if (roundedScore >= 86 && rebuilderScore < 49) {
      return result("All In", "heavyweight");
    }
    if (roundedScore >= 86 && rebuilderScore >= 60) {
      return result("One Move Away", "problem");
    }
    if (roundedScore >= 86) return result("Real Threat", "problem");
    if (roundedScore >= 81) return result("Could Steal It", "spoiler");
    if (roundedScore >= 70) return result("Meh", "balanced");
    if (rebuilderScore >= 61 || dynastyScore >= 84) {
      return result("Rebuilding", "future");
    }
    return result("Free Money", "squeak");
  }

  return getScoreOnlyProfile(roundedScore);
}

function getProfileFromLabel(label?: string | null): ManagerProfileResult {
  const normalized = String(label || "").toLowerCase();
  if (/juggernaut|final boss|thanos/.test(normalized)) {
    return result("Thanos", "boss");
  }
  if (/strong contender|heavyweight/.test(normalized)) {
    return result("Heavyweight", "heavyweight");
  }
  if (/title threat|true contender|contender|playoff push|all in|no brakes|problem|dangerous/.test(normalized)) {
    return result("Real Threat", "problem");
  }
  if (/playoff mix|chaos bracket|wild card|spoiler|upset alert|could steal it/.test(normalized)) {
    return result("Could Steal It", "spoiler");
  }
  if (/strong rebuilder|future rich|future menace|draft mode|rebuild mode/.test(normalized)) {
    return result("Future Menace", "future");
  }
  if (/reloading|reload crew|weak rebuilder|work in progress/.test(normalized)) {
    return result("Time to Rebuild", "reload");
  }
  if (/pip squeak|lunch money|try harder|first time|free money|sell your team/.test(normalized)) {
    return result("Free Money", "squeak");
  }
  if (/balanced|middle child|meh|purgatory|lost/.test(normalized)) {
    return result("Meh", "balanced");
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
  const scoreGap = titleScore - rebuildScore;
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

  if (
    titleScore >= 88 &&
    scoreGap >= 18 &&
    (hasEliteTitleValue || titleScore >= 95 || valueScore >= 96) &&
    starterShare >= 48
  ) {
    return result("Thanos", "boss");
  }

  if (
    titleScore >= 78 &&
    scoreGap >= 10 &&
    (hasTitleValue || titleScore >= 88 || valueScore >= 90) &&
    starterShare >= 44
  ) {
    return result("Heavyweight", "heavyweight");
  }

  if (
    rebuildScore >= 74 &&
    scoreGap <= -6 &&
    (futureScore >= 62 || /rebuild|future|youth/.test(source))
  ) {
    return result("Future Rich", "future");
  }

  if (
    titleScore >= 70 &&
    scoreGap >= 0 &&
    !isBasementValue &&
    (hasTitleValue || starterShare >= 48 || /contender|win|playoff/.test(source))
  ) {
    return result("Dangerous", "problem");
  }

  if (
    titleScore >= 62 &&
    scoreGap >= -8 &&
    !isBasementValue &&
    (starterShare >= 44 || valueScore >= 70 || (powerScore ?? 0) >= 68)
  ) {
    return result("Upset Alert", "spoiler");
  }

  if (
    isBasementValue &&
    titleScore <= 46 &&
    rebuildScore <= 55 &&
    starterShare <= 42
  ) {
    return result("Try Harder", "squeak");
  }

  if (
    rebuildScore >= 64 ||
    (isBottomValue && (titleScore < 70 || olderRoster)) ||
    /rebuild|future|youth/.test(source)
  ) {
    return futureScore >= 68 ? result("Future Rich", "future") : result("Work In Progress", "reload");
  }

  return result("Meh", "balanced");
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
