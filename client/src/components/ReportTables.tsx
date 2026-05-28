import { Card } from "@/components/ui/card";
import { AIReadPanel } from "@/components/AIReadPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  LockKeyhole,
  Scissors,
  ShieldCheck,
  Star,
  Target,
  X as XIcon,
} from "lucide-react";
import type {
  DraftPick,
  ManagerIntelPlayer,
  PlayerDetails,
  RecentTransactionPlayer,
  ReportData,
  SleeperWaiverClaimSignal,
  TaxiTriageItem,
  TrendingPlayer,
} from "@shared/types";
export { SleeperWaiverClaimsTable } from "./reportTables/SleeperWaiverClaimsTable";
export { TradeProposalSignalsTable } from "./reportTables/TradeProposalSignalsTable";
import { PlayerNameWithHeadshot } from "./PlayerNameWithHeadshot";
import {
  ChampionAvatarFrame,
  ManagerChampionshipPills,
} from "./ManagerChampionships";
import { PlayerDetailModal, type PlayerModalData } from "./PlayerDetailModal";
import { TeamLogoPill } from "./TeamLogoPill";
import {
  EmptyState,
  PlayerIdentityRow,
  ReportCard,
} from "./reportPrimitives";
import { AITronSurface, type AITronTheme } from "./AITronSurface";
import {
  buildPlayerModalData,
  clampPercentValue,
  CommandMiniBadge,
  FeatureCard,
  findLandedPick,
  formatCompactValue,
  formatOutcomeDeltaLabel,
  formatOutcomeDate,
  formatPickRound,
  getAiNeuralSurfaceClass,
  getManagerHeadingClassName,
  getOutcomeAssetStatus,
  getOutcomePlayerSeasonValue,
  getPlayerStatusClass,
  getPlayerStatusLabel,
  getTradeLedgerPlayerRank,
  getTradeLedgerPlayerValue,
  getTradeGapVerdict as getSharedTradeGapVerdict,
  getTradeLensNumber,
  getTradeWarLeagueValueMode,
  IntelligenceMetric,
  isRedraftTradeWarMode,
  normalizeManagerKey,
  OwnerMetricPill,
  OwnerSummaryTile,
  parsePositionRankValue,
  parseTradePickItem,
  parseTradeOutcomeDate,
  parseTradePlayerItem,
  parseValueAdjustmentItem,
  PositionRankPill,
  renderManagerName,
  splitTradeItems,
  TradeValuePill,
  addYears,
  didManagerMakeLandedPick,
  type ManagerAvatars,
  type PlayerDetailsById,
} from "./reportTables/shared";
import {
  normalizeLeagueValueMode,
  type LeagueValueMode,
} from "@/lib/leagueValueMode";
import { getTeamTileStyle } from "@/lib/teamTileStyle";
import { getPlayerAvailability } from "@/lib/playerStatus";
import {
  compareManagersByViewerAndStanding,
  sortRowsByViewerAndStanding,
} from "@/lib/managerOrdering";
import { isPlaceholderManagerName } from "@/lib/managerDisplay";
import {
  getManagerProfileLabel,
  getOwnerIntelProfileLabel,
} from "@/lib/managerProfileLabels";
import { viewerOwnedHighlightClass } from "@/lib/viewerHighlight";
import { getBalancedGridStyle } from "@/lib/balancedGrid";
import { OwnerIntelPcbRoutes } from "./reportTables/OwnerIntelPcbRoutes";
import {
  ManagerDepthTile,
  BenchBaselineList,
  OwnerIntelDepthPlayerButton,
  TradeableDepthList,
  getHeatPillClass,
  orderOwnerBadgesForCompactRows,
} from "./reportTables/OwnerIntelDepthComponents";
import { OwnerScoreStrip, formatOwnerScore } from "./reportTables/OwnerScoreStrip";
import { PlayerInsightTile } from "./reportTables/OwnerIntelPlayerTile";
import {
  FullRosterRankTiles,
  StartingRosterRankTiles,
} from "./reportTables/OwnerRankTiles";
import {
  combineSuperflexQuarterbackGroups,
  getSwapFitLabel,
  isQuarterbackLineupGroup,
  sortLineupGroupsForDisplay,
} from "./reportTables/lineupUtils";
import {
  buildManagerSignalTags,
  buildOwnerIntelTileTags,
  getPillToneClass,
  titleCasePill,
} from "./reportTables/ownerIntelTags";

export {
  buildPlayerModalData,
  CommandMiniBadge,
  FeatureCard,
  formatCompactValue,
  getAiNeuralSurfaceClass,
  getManagerHeadingClassName,
  getPlayerStatusClass,
  getPlayerStatusLabel,
  IntelligenceMetric,
  OwnerMetricPill,
  OwnerSummaryTile,
  parsePositionRankValue,
  PositionRankPill,
};
export { ManagerIntelligenceCards } from "./reportTables/ManagerIntelligenceCards";
export type { ManagerAvatars, PlayerDetailsById };
type CurrentPositionRankById = ReportData["currentPositionRankById"];
type LeagueOverviewRows = ReportData["leagueOverview"];
type ManagerRosterIntelRows = NonNullable<
  ReportData["managerRosterIntelligence"]
>;
type DynastyTimelineRows = NonNullable<ReportData["dynastyTimelines"]>;
type ManagerCountRow = ReportData["managerPositionCounts"][number];
type CountPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

const COUNT_POSITIONS: CountPosition[] = ["QB", "RB", "WR", "TE", "K", "DEF"];

function normalizeReportManagerName(manager?: string | null): string {
  return manager?.trim().toLowerCase() || "";
}

function getCommandPlayerValueLens(
  player: Pick<ManagerIntelPlayer, "seasonValue" | "value">
) {
  const hasSeasonValue =
    typeof player.seasonValue === "number" &&
    Number.isFinite(player.seasonValue) &&
    player.seasonValue > 0;
  return {
    label: hasSeasonValue ? "Season" : "Dynasty",
    value: hasSeasonValue ? Number(player.seasonValue) : player.value,
    className: hasSeasonValue
      ? "manager-command-season-value"
      : "manager-command-season-value manager-command-dynasty-value",
    kind: hasSeasonValue ? ("season" as const) : ("dynasty" as const),
  };
}

function getCommandPlayerDynastyLens(player: CommandPlayer) {
  const profile = player.playerDetails?.valueProfile;
  return {
    value:
      profile?.dynastyValue ?? profile?.balancedValue ?? player.value ?? null,
    rank:
      profile?.dynastyPositionRank ||
      profile?.balancedPositionRank ||
      player.currentPositionRank ||
      null,
  };
}

function getCommandPlayerSeasonLens(player: CommandPlayer) {
  const profile = player.playerDetails?.valueProfile;
  return {
    value:
      player.seasonValue ??
      profile?.seasonValue ??
      profile?.fantasyProsSeasonValue ??
      null,
    rank:
      player.seasonPositionRank ||
      profile?.seasonPositionRank ||
      profile?.fantasyProsPositionRank ||
      null,
  };
}

function getTaxiActionClassName(action?: string | null) {
  return (
    String(action || "default")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "default"
  );
}

function getTaxiDisplayAction(action?: string | null) {
  if (action === "Cuttable") return "Cuts";
  return action || undefined;
}

function getTaxiActionSortRank(action?: string | null) {
  switch (action) {
    case "Promote Now":
      return 0;
    case "Keep Parked":
      return 1;
    case "Trade Sweetener":
      return 2;
    case "Taxi Risk":
      return 3;
    case "Cuttable":
      return 4;
    default:
      return 5;
  }
}

function sortTaxiTriageItems(items: TaxiTriageItem[]) {
  return [...items].sort((a, b) => {
    const actionRank =
      getTaxiActionSortRank(a.taxiAction) - getTaxiActionSortRank(b.taxiAction);
    if (actionRank) return actionRank;

    return (
      (b.taxiScore || 0) - (a.taxiScore || 0) ||
      (b.seasonValue || b.value || 0) - (a.seasonValue || a.value || 0) ||
      a.name.localeCompare(b.name)
    );
  });
}

function normalizeIntelNote(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|with|for|and|or|to|of|in|if|it|is|this|that)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeIntelNotes(
  notes: Array<string | null | undefined>,
  suppress: Array<string | null | undefined> = []
) {
  const seen = new Set<string>();
  const suppressKeys = suppress
    .filter((note): note is string => Boolean(note))
    .map(normalizeIntelNote)
    .filter(Boolean);

  return notes
    .filter((note): note is string => Boolean(note))
    .filter(note => {
      const key = normalizeIntelNote(note);
      if (!key || seen.has(key)) return false;
      if (
        suppressKeys.some(
          suppressKey => suppressKey.includes(key) || key.includes(suppressKey)
        )
      )
        return false;
      seen.add(key);
      return true;
    });
}

function normalizeIntelPlayerName(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function noteMentionsPlayerName(note: string, name: string): boolean {
  const normalizedName = normalizeIntelPlayerName(name);
  return (
    normalizedName.length >= 3 && note.toLowerCase().includes(normalizedName)
  );
}

function getDynastyTradeTrackedNames(row: OwnerIntelRow): string[] {
  const names = [
    row.buyTarget?.name,
    row.sellCandidate?.name,
    row.tradeChip?.name,
    row.oldestPlayer?.name,
  ].filter((name): name is string => Boolean(name));
  return Array.from(new Set(names.map(name => name.trim()).filter(Boolean)));
}

function filterByPlayerNameMentionBudget<T>(
  items: T[],
  getCopy: (item: T) => string,
  trackedNames: string[],
  seededCopies: string[] = [],
  maxMentions = 2
): T[] {
  if (!trackedNames.length) return items;

  const counts = new Map<string, number>();
  seededCopies.forEach(copy => {
    trackedNames.forEach(name => {
      if (copy && noteMentionsPlayerName(copy, name)) {
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    });
  });

  return items.filter(item => {
    const copy = getCopy(item);
    const mentionedNames = trackedNames.filter(name =>
      noteMentionsPlayerName(copy, name)
    );
    if (mentionedNames.some(name => (counts.get(name) || 0) >= maxMentions))
      return false;
    mentionedNames.forEach(name =>
      counts.set(name, (counts.get(name) || 0) + 1)
    );
    return true;
  });
}

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
type OwnerNeedPosition = "QB" | "RB" | "WR" | "TE";
type OwnerSignalTone =
  | "neutral"
  | "dynasty"
  | "contender"
  | "rebuilder"
  | "good"
  | "contender-gold"
  | "warn"
  | "danger"
  | "future"
  | "elite"
  | "balanced"
  | "weak-contender"
  | "weak-rebuilder"
  | "squeak";
type DynastyAiTheme =
  | "trade"
  | "window"
  | "draft"
  | "churn"
  | "risk"
  | "upside"
  | "sell"
  | "core"
  | "neutral";
type OwnerSignalTag = { label: string; tone?: OwnerSignalTone };
type OwnerBuildLabel =
  | "Thanos"
  | "Heavyweight"
  | "Rich Fraud"
  | "Loaded Loser"
  | "Broke Flex"
  | "You Better Win"
  | "Might Surprise"
  | "Pick Hoarder"
  | "Felony Roster"
  | "No Future"
  | "Mid As Hell"
  | "Crown Me"
  | "Title Threat"
  | "Ring Ready"
  | "Could Be a Threat"
  | "Dangerous"
  | "Real Threat"
  | "One Move Away"
  | "Scares Me a Little"
  | "Could Steal It"
  | "Fake Tough"
  | "Upset Alert"
  | "Meh"
  | "Free Win"
  | "Future Rich"
  | "Future Menace"
  | "Future Stacked"
  | "Pick Rich"
  | "Growth"
  | "Cooking"
  | "Actually Building"
  | "Half Built"
  | "Still Cooking"
  | "All In"
  | "Time to Rebuild"
  | "Rebuilding"
  | "Work In Progress"
  | "Free Money"
  | "Sell Your Team"
  | "Try Harder"
  | "Playoff Push"
  | "Starter Need"
  | "Depth Build";
type OwnerScoreLens = {
  fullRosterScore: number | null;
  dynastyScore: number | null;
  contenderScore: number | null;
  rebuilderScore: number | null;
  buildLabel: OwnerBuildLabel;
  buildTone: OwnerSignalTone;
};
type OwnerIntelSortMode = "dynasty" | "contender" | "rebuilder";
type DynastyAiSuggestion = {
  title: string;
  copy: string;
  tone: OwnerSignalTone;
  theme?: DynastyAiTheme;
  wide?: boolean;
};

const AI_RECOMMENDATION_BADGE_LABEL = "AI TARGET";
const AI_RECOMMENDATION_BANNER_LABEL = "AI PICKUP SIGNAL";

function getAITronThemeForDynastySurface(
  theme: DynastyAiTheme = "neutral"
): AITronTheme {
  switch (theme) {
    case "core":
    case "upside":
      return "green";
    case "draft":
    case "risk":
      return "amber";
    case "sell":
      return "red";
    case "trade":
    case "window":
      return "blue";
    case "churn":
    case "neutral":
    default:
      return "cyan";
  }
}

const STARTING_ROSTER_STRENGTH_TITLE = "Starting Lineup Slot Ranks";
const STARTING_ROSTER_STRENGTH_COMPARISON =
  "league rank by required lineup slot";
const STARTING_ROSTER_STRENGTH_NOTE =
  "Ranks this manager’s submitted Sleeper starters when returned, otherwise the slot-aware projected lineup, against every roster using this league’s actual required slots. QB/SF includes the superflex QB path; K and DEF appear only when the league starts them.";
const BENCH_BASELINE_NOTE =
  "Compares the best non-starting QB, RB, WR, and TE using season value and season position rank after the submitted or projected starters are removed.";
const TRADEABLE_DEPTH_NOTE =
  "Shows active bench trade chips by season value and season rank only. Taxi and IR players are left out.";

type TradeWarMode =
  | "dynasty"
  | "contender"
  | "rebuilder"
  | "starter-upgrade"
  | "depth-fix"
  | "positional-need"
  | "playoff-push"
  | "waiver-leverage";
function formatSignedCompactValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${value > 0 ? "+" : ""}${formatCompactValue(value)}`;
}

function buildOwnerBestMove(row: OwnerIntelRow): string {
  const need = row.tradePlan?.needPosition;
  const surplus = row.tradePlan?.surplusPosition;
  const buyName = row.buyTarget?.name;
  const sellName = row.sellCandidate?.name || row.tradeChip?.name;
  const sellValue = row.sellCandidate?.value || row.tradeChip?.value || 0;
  const buyValue = row.buyTarget?.value || 0;
  const targetValueGapIsTooWide =
    sellValue > 0 && buyValue > sellValue * 1.35 + 250;
  const buildLens = /rebuild/i.test(row.timeline || row.identity)
    ? "rebuild timeline"
    : /contend|win/i.test(row.timeline || row.identity)
      ? "contender lineup"
      : "team window";

  if (need && surplus && buyName && sellName) {
    if (targetValueGapIsTooWide) {
      return `${sellName} should not be priced as a one-for-one for ${buyName}. Either package him with added value for ${need} help, or shop him for a similar-value ${need} who fits this ${buildLens}.`;
    }

    return `Shop ${surplus} surplus (${sellName}) for similar-value ${need} help like ${buyName}. That is the cleanest way to turn excess roster value into a lineup fix.`;
  }

  if (need && buyName) {
    return `The clearest add is ${need} help. Start with players in the same value band as the movable bench pieces; only chase ${buyName} if picks or a package make the price realistic.`;
  }

  if (surplus && sellName) {
    return `This roster has extra ${surplus} value. ${sellName} is the easiest trade chip if another manager overpays.`;
  }

  if (row.tradePlan?.summary) return row.tradePlan.summary;

  return "No forced trade path. This roster should wait for another manager to pay above market instead of creating a move just to move.";
}

function buildOwnerWindowCopy(
  row: OwnerIntelRow,
  timelineRow: OwnerTimelineRow | null | undefined
): string {
  if (!timelineRow) {
    return `${titleCasePill(row.identity)} build. The model does not have enough timeline data to call a clean contender or rebuild lane yet.`;
  }

  const contenderScore = timelineRow.contenderScore;
  const rebuildScore = timelineRow.rebuildScore;
  const agingRisk = timelineRow.agingRisk;

  if (contenderScore >= 75 && contenderScore >= rebuildScore + 12) {
    return `Win-now lean. Contender score ${contenderScore}/100, rebuild score ${rebuildScore}/100, aging risk ${agingRisk}/100. This team should protect weekly starters and buy injury insurance before chasing long-term value.`;
  }

  if (rebuildScore >= contenderScore + 10) {
    return `Rebuild lean. Rebuild score ${rebuildScore}/100 beats contender score ${contenderScore}/100. Move older short-window points for younger assets, picks, or players rising in dynasty value.`;
  }

  return `Middle-build profile. Contender score ${contenderScore}/100 and rebuild score ${rebuildScore}/100 are close enough that this team should avoid all-in trades unless the upgrade clearly changes the lineup.`;
}

function buildOwnerShapeCopy(row: OwnerIntelRow): string {
  const starterShare = Math.round(row.starterValuePct);
  const ageCopy =
    row.avgAge !== null
      ? `Average roster age is ${row.avgAge}.`
      : "Age profile is still incomplete.";
  const benchCopy = row.bestBenchStash
    ? `${row.bestBenchStash.name} is the best bench leverage piece.`
    : "There is no obvious bench leverage piece yet.";
  const depthCopy =
    starterShare >= 58
      ? `${starterShare}% of value sits in starters, so this team is built to score now.`
      : starterShare <= 45
        ? `${starterShare}% of value sits in starters, so too much value may be parked outside the weekly lineup.`
        : `${starterShare}% of value sits in starters, which is a balanced roster shape.`;

  return `${titleCasePill(row.identity)} profile. ${depthCopy} ${ageCopy} ${benchCopy}`;
}

function buildOwnerTradeDraftProfile(
  tradeRow: OwnerTradeRow | null | undefined,
  pickRow: OwnerPickRow | null | undefined
): string {
  const parts = [
    tradeRow ? `${tradeRow.tradeCount} trades` : null,
    tradeRow ? `${tradeRow.winPct}% win rate` : null,
    tradeRow ? `${formatSignedCompactValue(tradeRow.profit)} net profit` : null,
    tradeRow?.favoritePartner
      ? `favorite partner: ${tradeRow.favoritePartner}`
      : null,
    pickRow ? `${pickRow.count2026 + pickRow.count2027} future picks` : null,
    pickRow ? `${formatCompactValue(pickRow.totalValue)} draft capital` : null,
  ].filter(Boolean);

  return parts.length
    ? `${parts.join(" • ")}.`
    : "No trade or draft-capital profile yet.";
}

function buildOwnerHealthCopy(row: OwnerIntelRow): string {
  const missed = row.starterAvailability.avgGamesMissed;
  const risk = titleCasePill(row.starterAvailability.riskLevel);
  const healthScore =
    row.rosterHealthScore !== null && row.rosterHealthScore !== undefined
      ? `Health score ${row.rosterHealthScore}/100`
      : "Health score unavailable";
  const riskiest = row.starterAvailability.riskiestStarter?.name;
  const insurance = row.injuryInsurance
    ? `Best internal cover is ${row.injuryInsurance.name} (${row.injuryInsurance.currentPositionRank || row.injuryInsurance.seasonPositionRank || row.injuryInsurance.pos}).`
    : "No clear internal insurance piece stands out.";
  const depthCoverCount = [
    ...(row.benchPlayers || []),
    ...(row.reservePlayers || []),
  ].filter(
    player =>
      ["RB", "WR", "TE"].includes(player.pos) &&
      (player.seasonValue || player.value) >= 900
  ).length;
  const depthCopy = `${depthCoverCount} bench/reserve skill player${depthCoverCount === 1 ? "" : "s"} clear useful depth value.`;

  if (missed === null || missed === undefined) {
    return `${healthScore}. Availability sample is still thin, so lean more on current role, depth value, and roster age. ${insurance}`;
  }

  if (missed >= 3) {
    return `${healthScore}. ${risk} availability risk: starters averaged ${missed} missed games. ${riskiest ? `${riskiest} is the biggest risk flag.` : "Bench insurance should matter more than luxury depth."} ${insurance} ${depthCopy}`;
  }

  if (missed >= 1.5) {
    return `${healthScore}. ${risk} availability risk: starters averaged ${missed} missed games. ${riskiest ? `${riskiest} is the player to insure around.` : "This roster should keep one extra usable spot starter."} ${insurance} ${depthCopy}`;
  }

  return `${healthScore}. ${risk} availability risk: starters averaged ${missed} missed games, so this roster can be more aggressive consolidating depth. ${insurance} ${depthCopy}`;
}

function buildOwnerWeakSpotCopy(row: OwnerIntelRow): string {
  if (row.benchBaseline?.length) {
    const weakBench = [...row.benchBaseline]
      .filter(tile => tile.leagueRank !== null)
      .sort((a, b) => (b.leagueRank || 0) - (a.leagueRank || 0))[0];
    const bestBench = [...row.benchBaseline]
      .filter(tile => tile.leagueRank !== null)
      .sort((a, b) => (a.leagueRank || 99) - (b.leagueRank || 99))[0];

    if (
      weakBench &&
      weakBench.leagueRank &&
      ["Playable", "Problem"].includes(weakBench.grade)
    ) {
      return `${weakBench.label} is the softest bench lane. ${weakBench.player ? `${weakBench.player.name} is the first option there` : "There is no clear player there"}, and that depth ranks #${weakBench.leagueRank} in this league.`;
    }

    if (bestBench?.player) {
      return `The bench baseline is usable. ${bestBench.player.name} is the cleanest next-man-up profile, and ${bestBench.label} ranks #${bestBench.leagueRank} in this league.`;
    }

    return "The bench baseline is thin because there are not enough ranked non-starters to compare cleanly.";
  }

  const qbRank = parsePositionRankValue(row.holes.bestQbRank);
  const rb2Rank = parsePositionRankValue(row.holes.rb2Rank);
  const wr3Rank = parsePositionRankValue(row.holes.wr3Rank);
  const teRank = parsePositionRankValue(row.holes.te1Rank);
  const notes = [
    qbRank !== null && qbRank > 18
      ? `QB is led by ${row.holes.bestQbRank}, so superflex depth is the first place to compare against the league.`
      : null,
    rb2Rank !== null && rb2Rank > 28
      ? `RB2 sits at ${row.holes.rb2Rank}, below the comfort line for a weekly contender.`
      : null,
    wr3Rank !== null && wr3Rank > 36
      ? `WR3 sits at ${row.holes.wr3Rank}, so receiver depth is thinner than the top name suggests.`
      : null,
    teRank !== null && teRank > 14
      ? `TE is led by ${row.holes.te1Rank}, which can cap weekly ceiling.`
      : null,
    row.holes.flexDepth <= 5
      ? `Flex depth is ${row.holes.flexDepth}, so the bench cushion is limited.`
      : null,
  ].filter(Boolean);

  if (notes.length) return notes.join(" ");

  return "The required starter spots are all in a playable range, so there is no obvious position to attack. The better angle is manager preference, timing, or offering a clear upgrade instead of treating this roster like it has a glaring hole.";
}

function buildDynastyOwnerTags({
  row,
  overviewRow,
  growthRow,
  pickRow,
  allGrowthRows = [],
  allPickRows = [],
  leagueSize = 0,
}: {
  row: OwnerIntelRow;
  overviewRow?: LeagueOverviewRows[number] | null;
  growthRow?: OwnerGrowthRow | null;
  pickRow?: OwnerPickRow | null;
  allGrowthRows?: OwnerGrowthRow[];
  allPickRows?: OwnerPickRow[];
  leagueSize?: number;
}): OwnerSignalTag[] {
  const tags: Array<OwnerSignalTag | null> = [
    buildOwnerValueTag(overviewRow, leagueSize),
    buildOwnerPickTag(pickRow, allPickRows),
    buildOwnerGrowthTag(growthRow, allGrowthRows),
    buildOwnerRosterShapeTag(row, overviewRow, leagueSize),
    ...row.ageFlags
      .filter(flag => !/availability|durable/i.test(flag))
      .slice(0, 2)
      .map(flag => ({
        label: titleCasePill(flag),
        tone:
          flag.toLowerCase().includes("old") ||
          flag.toLowerCase().includes("aging")
            ? ("danger" as const)
            : ("future" as const),
      })),
  ];

  const seen = new Set<string>();
  return tags
    .filter((tag): tag is OwnerSignalTag => Boolean(tag))
    .filter(tag => {
      const key = tag.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function buildOwnerValueTag(
  overviewRow?: LeagueOverviewRows[number] | null,
  leagueSize = 0
): OwnerSignalTag | null {
  if (!overviewRow) return null;
  const rank = overviewRow.rank_value;
  const bottomCutoff = leagueSize > 0 ? Math.max(leagueSize - 1, 8) : 8;

  if (rank <= 3) return { label: `Elite Value #${rank}`, tone: "good" };
  if (rank >= bottomCutoff)
    return { label: `Value #${rank}`, tone: "warn" };
  return { label: `Value #${rank}`, tone: "neutral" };
}

function getFuturePickCount(pickRow?: OwnerPickRow | null): number {
  return (pickRow?.count2026 || 0) + (pickRow?.count2027 || 0);
}

function averageFinite(values: number[]): number {
  const finite = values.filter(value => Number.isFinite(value));
  if (!finite.length) return 0;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function rankScoreWithinLeague<T>(
  rows: T[],
  target: T | null | undefined,
  getScore: (row: T) => number | null | undefined,
  direction: "asc" | "desc" = "desc"
): number | null {
  if (!target) return null;
  const targetScore = getScore(target);
  if (
    targetScore === null ||
    targetScore === undefined ||
    !Number.isFinite(targetScore)
  )
    return null;
  const scores = rows
    .map(getScore)
    .filter(
      (score): score is number =>
        score !== null && score !== undefined && Number.isFinite(score)
    );
  if (!scores.length) return null;
  const betterScores = scores.filter(score =>
    direction === "desc" ? score > targetScore : score < targetScore
  );
  return betterScores.length + 1;
}

function getLeagueSignalWindow(rowCount: number): number {
  return Math.max(1, Math.ceil(rowCount * 0.2));
}

function buildOwnerPickTag(
  pickRow?: OwnerPickRow | null,
  allPickRows: OwnerPickRow[] = []
): OwnerSignalTag | null {
  if (!pickRow || !allPickRows.length) return null;

  const pickCount = getFuturePickCount(pickRow);
  const pickCounts = allPickRows.map(getFuturePickCount);
  const pickValues = allPickRows.map(row => row.totalValue || 0);
  const acquiredCounts = allPickRows.map(row => row.acquiredPicks || 0);
  const averagePickCount = averageFinite(pickCounts);
  const averagePickValue = averageFinite(pickValues);
  const averageAcquired = averageFinite(acquiredCounts);
  const valueRank = rankScoreWithinLeague(
    allPickRows,
    pickRow,
    row => row.totalValue || 0
  );
  const countRank = rankScoreWithinLeague(
    allPickRows,
    pickRow,
    getFuturePickCount
  );
  const acquiredRank = rankScoreWithinLeague(
    allPickRows,
    pickRow,
    row => row.acquiredPicks || 0
  );
  const topWindow = getLeagueSignalWindow(allPickRows.length);
  const bottomWindowStart = Math.max(1, allPickRows.length - topWindow + 1);
  const clearlyAboveLeague =
    pickCount >= averagePickCount + 2 ||
    (pickRow.totalValue || 0) >= averagePickValue * 1.18 ||
    (pickRow.acquiredPicks || 0) >= Math.max(2, averageAcquired + 1);
  const clearlyBelowLeague =
    pickCount <= averagePickCount - 2 ||
    (pickRow.totalValue || 0) <= averagePickValue * 0.82;

  if (valueRank !== null && valueRank <= topWindow && clearlyAboveLeague) {
    return { label: `Pick War Chest #${valueRank}`, tone: "future" };
  }

  if (countRank !== null && countRank <= topWindow && clearlyAboveLeague) {
    return { label: `${pickCount} Future Picks`, tone: "future" };
  }

  if (
    acquiredRank !== null &&
    acquiredRank <= topWindow &&
    (pickRow.acquiredPicks || 0) >= Math.max(2, averageAcquired + 1)
  ) {
    return { label: `${pickRow.acquiredPicks} Extra Picks`, tone: "future" };
  }

  if (
    valueRank !== null &&
    valueRank >= bottomWindowStart &&
    clearlyBelowLeague
  ) {
    return { label: `Pick Light #${valueRank}`, tone: "warn" };
  }

  return null;
}

function buildOwnerGrowthTag(
  growthRow?: OwnerGrowthRow | null,
  allGrowthRows: OwnerGrowthRow[] = []
): OwnerSignalTag | null {
  if (!growthRow || !allGrowthRows.length) return null;
  const rank = rankScoreWithinLeague(
    allGrowthRows,
    growthRow,
    row => row.growth
  );
  const topWindow = getLeagueSignalWindow(allGrowthRows.length);
  const bottomWindowStart = Math.max(1, allGrowthRows.length - topWindow + 1);
  const averageGrowth = averageFinite(allGrowthRows.map(row => row.growth));
  const growthCopy = `${growthRow.growth >= 0 ? "+" : ""}${growthRow.growth.toFixed(1)}%`;

  if (
    rank !== null &&
    rank <= topWindow &&
    growthRow.growth >= Math.max(5, averageGrowth + 2)
  ) {
    return { label: `Growth ${growthCopy}`, tone: "good" };
  }

  if (
    rank !== null &&
    rank >= bottomWindowStart &&
    growthRow.growth <= Math.min(-2, averageGrowth - 2)
  ) {
    return { label: `Value Slide ${growthCopy}`, tone: "danger" };
  }

  return null;
}

function getOwnerPositionRank(
  overviewRow: LeagueOverviewRows[number] | null | undefined,
  position?: string | null
): number | null {
  if (!overviewRow || !position) return null;
  if (position === "QB") return overviewRow.rank_qb ?? null;
  if (position === "RB") return overviewRow.rank_rb ?? null;
  if (position === "WR") return overviewRow.rank_wr ?? null;
  if (position === "TE") return overviewRow.rank_te ?? null;
  return null;
}

function isOwnerNeedPosition(
  position?: string | null
): position is OwnerNeedPosition {
  return (
    position === "QB" ||
    position === "RB" ||
    position === "WR" ||
    position === "TE"
  );
}

function getOwnerSlotGrade(
  row: OwnerIntelRow,
  position?: string | null
): string {
  if (!position) return "";
  const slotKey = position === "QB" ? "QB_SF" : position;
  const slotGrade = row.startingRosterStrength?.find(
    slot => slot.key === slotKey
  )?.grade;
  return (
    slotGrade ||
    row.positionGrades?.[position as "QB" | "RB" | "WR" | "TE"]?.grade ||
    ""
  );
}

function getOwnerPositionGrade(
  row: OwnerIntelRow,
  position?: string | null
): string {
  if (!isOwnerNeedPosition(position)) return "";
  return row.positionGrades?.[position]?.grade || "";
}

function getOwnerRosterPositionCount(
  row: OwnerIntelRow,
  position: OwnerNeedPosition
): number {
  return (
    row.rosterPlayers?.filter(player => player.pos === position).length || 0
  );
}

function hasOwnerPositionDepthCover(
  row: OwnerIntelRow,
  position?: string | null
): boolean {
  if (position !== "WR" && position !== "RB") return false;

  const positionGrade = getOwnerPositionGrade(row, position).toLowerCase();
  const tradePlanCopy = row.tradePlan?.summary?.toLowerCase() || "";
  const hasTradeableDepth = Boolean(
    row.tradeableDepth?.some(tile => tile.position === position && tile.player)
  );
  const rosterCount = getOwnerRosterPositionCount(row, position);
  const depthCountThreshold = position === "WR" ? 7 : 6;

  return (
    row.holes.flexDepth >= 8 &&
    (/elite|strong/.test(positionGrade) ||
      hasTradeableDepth ||
      rosterCount >= depthCountThreshold ||
      new RegExp(
        `\\b${position}\\b.*\\b(surplus|depth)\\b|\\b(surplus|depth)\\b.*\\b${position}\\b`,
        "i"
      ).test(tradePlanCopy))
  );
}

function isOwnerCredibleNeed(
  row: OwnerIntelRow,
  position?: string | null,
  overviewRow?: LeagueOverviewRows[number] | null,
  leagueSize = 0
): boolean {
  if (!position) return false;
  const slotGrade = getOwnerSlotGrade(row, position).toLowerCase();
  const positionGrade = getOwnerPositionGrade(row, position).toLowerCase();
  const grade = `${slotGrade} ${positionGrade}`.trim();
  const summary = row.holes?.summary || "";
  const hasExplicitHole = new RegExp(`\\b${position}\\b`, "i").test(summary);
  const positionRank = getOwnerPositionRank(overviewRow, position);
  const bottomWindowStart =
    leagueSize > 0 ? Math.max(1, Math.floor(leagueSize * 0.7)) : 8;
  const isBottomRoom =
    positionRank !== null && positionRank >= bottomWindowStart;
  const hasDepthCover = hasOwnerPositionDepthCover(row, position);
  const hasWeakPositionGrade = /problem|weak/i.test(positionGrade);
  const hasWeakStarterGrade = /problem|weak/i.test(slotGrade);

  if (hasDepthCover && !hasWeakPositionGrade) return false;
  if (/elite|strong/i.test(grade) && !hasExplicitHole && !isBottomRoom)
    return false;
  if (hasWeakPositionGrade || (hasWeakStarterGrade && !hasDepthCover))
    return true;
  if (hasExplicitHole && !/elite|strong/i.test(grade)) return true;
  if (hasExplicitHole && isBottomRoom && !hasDepthCover) return true;
  return isBottomRoom && /playable/i.test(grade) && !hasDepthCover;
}

function getOwnerEffectiveNeedPosition(
  row: OwnerIntelRow,
  overviewRow?: LeagueOverviewRows[number] | null,
  leagueSize = 0
): string | null {
  const plannedNeed = row.tradePlan?.needPosition || null;
  if (isOwnerCredibleNeed(row, plannedNeed, overviewRow, leagueSize))
    return plannedNeed;

  const fallbackNeeds = (["QB", "RB", "WR", "TE"] as const)
    .filter(position =>
      isOwnerCredibleNeed(row, position, overviewRow, leagueSize)
    )
    .sort(
      (a, b) =>
        (getOwnerPositionRank(overviewRow, b) || 0) -
        (getOwnerPositionRank(overviewRow, a) || 0)
    );

  return fallbackNeeds[0] || null;
}

function buildOwnerRosterShapeTag(
  row: OwnerIntelRow,
  overviewRow?: LeagueOverviewRows[number] | null,
  leagueSize = 0
): OwnerSignalTag | null {
  const surplus = row.tradePlan?.surplusPosition;
  const effectiveNeed = getOwnerEffectiveNeedPosition(
    row,
    overviewRow,
    leagueSize
  );

  if (effectiveNeed) return { label: `Needs ${effectiveNeed}`, tone: "warn" };
  if (surplus) return { label: `${surplus} Surplus`, tone: "good" };
  if (row.starterAvailability?.riskLevel === "high")
    return { label: "Injury Watch", tone: "danger" };
  return null;
}

function toOwnerScore(value?: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function normalizeOwnerValueScore(
  value?: number | null,
  maxValue = 0
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || maxValue <= 0)
    return null;
  return Math.round(Math.max(0, Math.min(100, (value / maxValue) * 100)));
}

function isOwnerRebuildLane(label?: string | null): boolean {
  return Boolean(
    label &&
      /rebuild|draft mode|future rich|future menace|future stacked|pick rich|pick hoarder|pick stash|growth rocket|cooking|actually building|half built|time to rebuild|work in progress|lunch money/i.test(label)
  );
}

function isOwnerStrongRebuildLane(label?: string | null): boolean {
  return Boolean(
    label &&
      /strong rebuild|future rich|future menace|future stacked|pick rich|pick hoarder|pick stash|growth rocket|draft mode/i.test(
        label.toLowerCase()
      )
  );
}

function isOwnerContenderLane(label?: string | null): boolean {
  return Boolean(
    label &&
      /contender|final boss|thanos|heavyweight|rich fraud|loaded loser|you better win|crown me|all in|ring ready|one move away|scares me|could steal it|fake tough|dangerous|upset alert|problem|spoiler|title threat|playoff push|wild card/i.test(label)
  );
}

function isOwnerStrongContenderLane(label?: string | null): boolean {
  return Boolean(
    label &&
      /strong contender|final boss|thanos|heavyweight|crown me|all in|title threat|you better win/i.test(
        label.toLowerCase()
      )
  );
}

function getOwnerTeamTypeLabel({
  row,
  timelineRow,
  powerRow,
  overviewRow,
  leagueSize = 0,
  dynastyScore,
}: {
  row: OwnerIntelRow;
  timelineRow?: OwnerTimelineRow | null;
  powerRow?: OwnerPowerRow | null;
  overviewRow?: LeagueOverviewRows[number] | null;
  leagueSize?: number;
  dynastyScore?: number | null;
}): OwnerBuildLabel {
  return getManagerProfileLabel(powerRow?.tier, powerRow?.score, {
    powerRow,
    timelineRow,
    managerRow: row,
    overviewRow,
    dynastyScore,
    leagueSize,
  }).label as OwnerBuildLabel;
}

function getOwnerTeamTypeTone(label: string): OwnerSignalTone {
  if (/final boss|thanos/i.test(label)) return "elite";
  if (/crown me/i.test(label)) return "contender-gold";
  if (/heavyweight|rich fraud|loaded loser|you better win|ring ready|real threat|one move away|all in|title threat|playoff/i.test(label)) return "good";
  if (/might surprise|scares me|could steal it|fake tough|broke flex|upset alert|spoiler|wild card|dangerous|problem/i.test(label)) return "weak-contender";
  if (/starter need/i.test(label)) return "weak-contender";
  if (/meh|mid as hell|middle child|balanced|depth build/i.test(label))
    return "balanced";
  if (/future rich|future menace|future stacked|pick rich|pick hoarder|pick stash|growth rocket|rebuilding|draft mode/i.test(label))
    return "future";
  if (/actually building|cooking|half built|time to rebuild|still cooking|work in progress/i.test(label))
    return "weak-rebuilder";
  if (/all in/i.test(label)) return "good";
  if (/free money|free win|sell your team|felony roster|no future|try harder|lunch money/i.test(label))
    return "squeak";
  return isOwnerRebuildLane(label) ? "future" : "good";
}

function getOwnerTeamTypeToneForMode(
  label: string,
  sortMode: OwnerIntelSortMode
): OwnerSignalTone {
  if (/thanos/i.test(label)) return "elite";
  if (sortMode === "dynasty") return "dynasty";
  if (sortMode === "contender") {
    return /crown me/i.test(label) ? "contender-gold" : "contender";
  }
  return "rebuilder";
}

function buildOwnerScoreLens({
  row,
  timelineRow,
  powerRow,
  overviewRow,
  growthRow,
  maxGrowthValue,
  leagueSize = 0,
  sortMode = "dynasty",
}: {
  row: OwnerIntelRow;
  timelineRow?: OwnerTimelineRow | null;
  powerRow?: OwnerPowerRow | null;
  overviewRow?: LeagueOverviewRows[number] | null;
  growthRow?: OwnerGrowthRow | null;
  maxGrowthValue: number;
  leagueSize?: number;
  sortMode?: OwnerIntelSortMode;
}): OwnerScoreLens {
  const fullRosterScore = toOwnerScore(powerRow?.score);
  const dynastyScore =
    toOwnerScore(powerRow?.rosterValue) ??
    normalizeOwnerValueScore(growthRow?.total_val, maxGrowthValue);
  const contenderScore = toOwnerScore(timelineRow?.contenderScore);
  const rebuilderScore = toOwnerScore(timelineRow?.rebuildScore);
  const fallbackBuildLabel = getOwnerTeamTypeLabel({
    row,
    timelineRow,
    powerRow,
    overviewRow,
    leagueSize,
    dynastyScore,
  });
  const activeScore =
    sortMode === "contender"
      ? contenderScore
      : sortMode === "rebuilder"
        ? rebuilderScore
        : dynastyScore;
  const buildLabel = getOwnerIntelProfileLabel(
    sortMode,
    activeScore,
    fallbackBuildLabel,
    {
      dynastyScore,
      contenderScore,
      rebuilderScore,
    }
  ).label as OwnerBuildLabel;

  return {
    fullRosterScore,
    dynastyScore,
    contenderScore,
    rebuilderScore,
    buildLabel,
    buildTone: getOwnerTeamTypeToneForMode(buildLabel, sortMode),
  };
}

function buildRedraftOwnerProfileLabel(
  row: OwnerIntelRow,
  powerRow?: OwnerPowerRow | null,
  overviewRow?: LeagueOverviewRows[number] | null,
  leagueSize = 0
): OwnerBuildLabel {
  const starterRank = powerRow?.starterStrength ?? 0;
  const valueRank = overviewRow?.rank_value ?? leagueSize;
  if (
    starterRank >= 78 ||
    valueRank <= Math.max(1, Math.ceil(leagueSize * 0.3))
  )
    return "Playoff Push";
  if (
    row.pressurePoints?.length ||
    row.holes.summary !== "No major roster hole flagged"
  )
    return "Starter Need";
  return "Depth Build";
}

function buildRedraftOwnerTags({
  row,
  overviewRow,
}: {
  row: OwnerIntelRow;
  overviewRow?: LeagueOverviewRows[number] | null;
}): OwnerSignalTag[] {
  const tags: OwnerSignalTag[] = [
    overviewRow
      ? { label: `Current value #${overviewRow.rank_value}`, tone: "info" }
      : null,
    row.starterSeasonValue
      ? {
          label: `Starters ${formatCompactValue(row.starterSeasonValue)}`,
          tone: "good",
        }
      : null,
    row.benchValue
      ? {
          label: `Bench ${formatCompactValue(row.benchValue)}`,
          tone: "neutral",
        }
      : null,
    row.holes.summary && row.holes.summary !== "No major roster hole flagged"
      ? {
          label: titleCasePill(
            row.holes.summary.split(",")[0]?.trim() || "Position gap"
          ),
          tone: "warn",
        }
      : null,
    row.pressurePoints?.length
      ? { label: `${row.pressurePoints.length} pressure flags`, tone: "warn" }
      : null,
  ].filter(Boolean) as OwnerSignalTag[];
  return tags.slice(0, 5);
}

function buildRedraftRosterRead(
  row: OwnerIntelRow,
  overviewRow?: LeagueOverviewRows[number] | null
): string {
  const valueRank = overviewRow ? `#${overviewRow.rank_value}` : "unranked";
  const starterValue = row.starterSeasonValue || row.starterValue;
  const bestStarter =
    row.untouchablePlayers?.[0] || row.lastSeasonStud || row.breakoutCandidate;
  const weakest = row.weakestStarter;
  const gap =
    row.holes.summary && row.holes.summary !== "No major roster hole flagged"
      ? row.holes.summary
      : "no obvious position gap";
  return `Current-season roster profile is ${valueRank} by value with ${formatCompactValue(starterValue)} in projected starter strength. ${bestStarter ? `${bestStarter.name} is the headline weekly asset.` : "No single weekly anchor is separated from the roster yet."} ${weakest ? `${weakest.name} is the starter spot to pressure-test.` : "Starter floor is not clearly exposed by one player."} Main roster gap: ${gap}.`;
}

function buildRedraftBestMove(row: OwnerIntelRow): string {
  const buy = row.buyTarget || row.injuryInsurance || row.breakoutCandidate;
  const sell =
    row.sellCandidate || row.droppablePlayers?.[0] || row.bestBenchStash;
  const need = row.tradePlan?.needPosition || null;
  if (need && buy) {
    return `Starter upgrade lens: chase a current-season ${need} improvement such as ${buy.name} if the cost comes from bench depth, not a locked starter.`;
  }
  if (sell) {
    return `Depth fix lens: use ${sell.name} as waiver or trade leverage if it improves weekly starter viability or cleans up a bench clog.`;
  }
  return `No forced redraft move. Prioritize current opportunity, weekly role, and positional need before chasing raw market value.`;
}

function buildRedraftActionNotes(row: OwnerIntelRow): string[] {
  return [
    row.weakestStarter
      ? `Starter pressure: ${row.weakestStarter.name} is the first lineup spot to upgrade.`
      : null,
    row.injuryInsurance
      ? `Bench insurance: ${row.injuryInsurance.name} protects weekly lineup depth.`
      : null,
    row.breakoutCandidate
      ? `Opportunity watch: ${row.breakoutCandidate.name} has enough current-season upside to hold.`
      : null,
    row.droppablePlayers?.length
      ? `Churn list: ${row.droppablePlayers
          .map(player => player.name)
          .slice(0, 2)
          .join(", ")} are waiver-upgrade candidates.`
      : null,
    row.tradePlan?.needPosition
      ? `Position gap: prioritize ${row.tradePlan.needPosition} starter viability over long-term value.`
      : null,
  ]
    .filter(Boolean)
    .slice(0, 4) as string[];
}

function buildDynastyRosterRead(
  row: OwnerIntelRow,
  overviewRow?: LeagueOverviewRows[number] | null,
  buildLabel?: OwnerBuildLabel
): string {
  const valueRank = overviewRow ? `#${overviewRow.rank_value}` : "unranked";
  const ageCopy =
    row.avgAge !== null
      ? `Average roster age is ${row.avgAge}, with ${row.avgAgeByPosition.RB ?? "-"} RB age and ${row.avgAgeByPosition.WR ?? "-"} WR age.`
      : "Age profile is incomplete.";
  const core = row.untouchablePlayers?.length
    ? `Core assets: ${row.untouchablePlayers
        .map(
          player =>
            `${player.name} (${player.currentPositionRank || player.pos})`
        )
        .slice(0, 3)
        .join(", ")}.`
    : row.youngCorePlayer
      ? `Best core asset is ${row.youngCorePlayer.name} (${row.youngCorePlayer.currentPositionRank || row.youngCorePlayer.pos}).`
      : "No obvious elite young core asset is separated from the pack yet.";
  const risk =
    row.oldestPlayer &&
    (row.oldestPlayer.playerDetails?.age || 0) >= 28 &&
    row.oldestPlayer.value >= 1200
      ? `${row.oldestPlayer.name} is the dynasty age/liquidity risk to monitor.`
      : row.sellCandidate
        ? `${row.sellCandidate.name} is the cleanest dynasty sell candidate if market value can be turned into younger value.`
        : "There is no forced age/liquidity sell from the current blend.";

  return `${buildLabel || "Contender"} dynasty profile with roster value ${valueRank}. ${ageCopy} ${core} ${risk}`;
}

function buildDynastyBestMove(
  row: OwnerIntelRow,
  pickRow?: OwnerPickRow | null,
  buildLabel?: OwnerBuildLabel | null,
  overviewRow?: LeagueOverviewRows[number] | null,
  leagueSize = 0
): string {
  const buy = row.buyTarget;
  const sell = row.sellCandidate || row.oldestPlayer;
  const tradeChip = row.tradeChip || row.bestBenchStash;
  const effectiveNeed = getOwnerEffectiveNeedPosition(
    row,
    overviewRow,
    leagueSize
  );
  const buyPosition = isOwnerNeedPosition(buy?.pos) ? buy.pos : null;
  const buyIsCoveredDepth =
    Boolean(buyPosition) &&
    (!effectiveNeed || buyPosition !== effectiveNeed) &&
    hasOwnerPositionDepthCover(row, buyPosition);
  const hasPickWarChest = Boolean(
    pickRow && pickRow.count2026 + pickRow.count2027 >= 15
  );
  const pickAsk = hasPickWarChest
    ? "future firsts or younger insulated players"
    : "future firsts, seconds, or young players who can gain market value";

  if (
    isOwnerRebuildLane(buildLabel) ||
    /rebuild/i.test(row.identity) ||
    /rebuild/i.test(row.timeline)
  ) {
    if (sell) {
      return `${isOwnerStrongRebuildLane(buildLabel) ? "Strong rebuild" : "Soft rebuild"} lens: shop ${sell.name} for ${pickAsk}. This roster is not being treated like a title team, so do not buy short-window points unless the player can still gain dynasty value.`;
    }
    return `${isOwnerStrongRebuildLane(buildLabel) ? "Strong rebuild" : "Soft rebuild"} lens: keep collecting liquid assets. ${hasPickWarChest ? "The pick bank is already useful, so wait for a manager to overpay for a veteran." : "Add picks or young insulated players before chasing points."}`;
  }

  if (
    isOwnerContenderLane(buildLabel) &&
    tradeChip &&
    buy &&
    !buyIsCoveredDepth
  ) {
    return `${isOwnerStrongContenderLane(buildLabel) ? "Strong contender" : "Contender"} dynasty lens: use movable value like ${tradeChip.name} to chase a stable long-term asset such as ${buy.name}. ${isOwnerStrongContenderLane(buildLabel) ? "This roster can justify paying from depth for a real title-edge upgrade." : "The goal is not just this season’s points; it is keeping the contender window liquid."}`;
  }

  if (isOwnerContenderLane(buildLabel) && tradeChip) {
    return `${isOwnerStrongContenderLane(buildLabel) ? "Strong contender" : "Contender"} dynasty lens: no forced buy from a covered room. Use ${tradeChip.name} only when the return creates a clear weekly starter edge${effectiveNeed ? ` at ${effectiveNeed}` : ""}, otherwise preserve the depth advantage and make the room overpay.`;
  }

  if (
    /contend|win/i.test(row.identity) &&
    tradeChip &&
    buy &&
    !buyIsCoveredDepth
  ) {
    return `Contender dynasty lens: use movable value like ${tradeChip.name} to chase a stable long-term asset such as ${buy.name}. The goal is not just this season's points; it is keeping the contender window liquid.`;
  }

  if (buy && sell && !buyIsCoveredDepth) {
    return `Value arbitrage: compare ${sell.name} against younger or safer market profiles like ${buy.name}. If the room prices them similarly, take the side with better dynasty insulation.`;
  }

  return `No forced dynasty move. Keep the core intact, keep the liquid assets liquid, and only move when another manager pays above the blended market.`;
}

function buildDynastyActionNotes(
  row: OwnerIntelRow,
  pickRow?: OwnerPickRow | null
): string[] {
  const notes = [
    row.buyTarget
      ? `Target watchlist: ${row.buyTarget.name} is the cleanest outside dynasty target in this value band.`
      : null,
    row.sellCandidate
      ? `Sell discipline: ${row.sellCandidate.name} should be shopped before role, age, or market liquidity moves against him.`
      : null,
    row.breakoutCandidate
      ? `Upside hold: ${row.breakoutCandidate.name} has enough age/value runway to keep unless the offer includes a safer asset tier.`
      : null,
    row.droppablePlayers?.length
      ? `Roster churn: ${row.droppablePlayers
          .map(player => player.name)
          .slice(0, 2)
          .join(
            ", "
          )} are the first dynasty-value cuts if a better stash appears.`
      : null,
    pickRow && pickRow.count2026 + pickRow.count2027 >= 15
      ? `Draft capital gives this manager leverage: ${pickRow.count2026} 2026 picks and ${pickRow.count2027} 2027 picks can buy a distressed asset without touching the core.`
      : null,
  ].filter(Boolean) as string[];

  return notes.slice(0, 4);
}

function buildDynastyCoreProtection(
  row: OwnerIntelRow,
  buildLabel?: OwnerBuildLabel | null
): DynastyAiSuggestion | null {
  const protectedCore = (row.untouchablePlayers || []).slice(0, 2);
  const core = protectedCore[0] || row.youngCorePlayer;
  if (!core) return null;

  const protectedNames = protectedCore.length
    ? protectedCore
        .map(player => `${player.name} (${getPlayerRankCopy(player)})`)
        .join(" and ")
    : `${core.name} (${getPlayerRankCopy(core)})`;
  const isContender =
    isOwnerContenderLane(buildLabel) || /contend|win/i.test(row.identity);
  const isRebuild =
    isOwnerRebuildLane(buildLabel) || /rebuild/i.test(row.identity);

  return {
    title: "AI Core Protection",
    tone: isRebuild ? "future" : isContender ? "good" : "neutral",
    theme: "core",
    copy: `${protectedNames} should be treated as the roster spine. ${isRebuild ? "Only move core value if the return resets the age curve and adds liquid draft capital." : isContender ? "Contender upgrades should be funded from depth or picks before this tier enters the offer." : "Use this tier as the comparison point for any consolidation offer before accepting a flatter asset package."}`,
  };
}

function buildDynastySellLine(row: OwnerIntelRow): DynastyAiSuggestion | null {
  const sell = row.sellCandidate || row.oldestPlayer || row.tradeChip;
  if (!sell) return null;
  const age = sell.playerDetails?.age;
  const rankCopy = getPlayerRankCopy(sell);
  const ageCopy = age ? `${age}-year-old ` : "";

  return {
    title: "AI Sell Line",
    tone: row.oldestPlayer?.player_id === sell.player_id ? "danger" : "warn",
    theme: "sell",
    copy: `${sell.name} is the ${ageCopy}${rankCopy} exit monitor. Set the sell line before sending offers: the return should add better age, safer role insulation, or at least one liquid pick. Do not let a lateral points offer become the new baseline.`,
  };
}

function buildDynastyUpsideSignal(
  row: OwnerIntelRow
): DynastyAiSuggestion | null {
  const upside =
    row.breakoutCandidate || row.bestBenchStash || row.youngCorePlayer;
  if (!upside) return null;

  return {
    title: "AI Upside Signal",
    tone: "future",
    theme: "upside",
    copy: `${upside.name} is the asymmetric hold. The model is treating the profile as more useful than a flat value chip, so the exit price should be a safer young asset tier, a meaningful pick upgrade, or a starter who clearly changes lineup math.`,
  };
}

function getPlayerRankCopy(player?: ManagerIntelPlayer | null): string {
  if (!player) return "";
  return (
    player.currentPositionRank ||
    player.seasonPositionRank ||
    player.pos ||
    "asset"
  );
}

function buildDynastyTradeBuilder(
  row: OwnerIntelRow,
  pickRow?: OwnerPickRow | null,
  buildLabel?: OwnerBuildLabel | null,
  overviewRow?: LeagueOverviewRows[number] | null,
  leagueSize = 0
): string {
  const need = getOwnerEffectiveNeedPosition(row, overviewRow, leagueSize);
  const surplus = row.tradePlan?.surplusPosition;
  const buy = row.buyTarget;
  const sell = row.sellCandidate || row.tradeChip || row.bestBenchStash;
  const buyPosition = isOwnerNeedPosition(buy?.pos) ? buy.pos : null;
  const buyFitsNeed = Boolean(
    buy && (!need || !buyPosition || buyPosition === need)
  );
  const buyIsCoveredDepth =
    Boolean(buyPosition) &&
    (!need || buyPosition !== need) &&
    hasOwnerPositionDepthCover(row, buyPosition);
  const pickCount = (pickRow?.count2026 || 0) + (pickRow?.count2027 || 0);

  if (isOwnerRebuildLane(buildLabel)) {
    const olderSell = row.oldestPlayer || row.sellCandidate || sell;
    if (olderSell) {
      return `${isOwnerStrongRebuildLane(buildLabel) ? "Hard reset path" : "Soft pivot path"}: start with ${olderSell.name} (${getPlayerRankCopy(olderSell)}) and ask for future draft leverage or a younger insulated asset. The model is prioritizing future draft position and market liquidity over this season's points.`;
    }
    return `${isOwnerStrongRebuildLane(buildLabel) ? "Hard reset path" : "Soft pivot path"}: do not spend picks into the current lineup. Float veterans first and use every deal to improve future draft capital, youth, or liquidity.`;
  }

  if (
    isOwnerStrongContenderLane(buildLabel) &&
    buy &&
    sell &&
    !buyIsCoveredDepth
  ) {
    return `Title push path: start with ${sell.name} (${getPlayerRankCopy(sell)}) as movable depth and target ${buy.name} only if the deal creates a clear weekly edge. Strong contenders can spend, but the core should stay intact.`;
  }

  if (need && surplus && buyFitsNeed && buy && sell) {
    return `Build offers from the roster shape, not the player name. Start with ${sell.name} (${getPlayerRankCopy(sell)}) as the movable ${surplus} piece, then price up only if ${buy.name} fixes ${need} without draining the core.`;
  }

  if (need && buyFitsNeed && buy) {
    return `The model sees ${need} as the cleanest outside add. Use ${buy.name} as the market anchor, then search one value tier below if the ask includes premium picks.`;
  }

  if (surplus && sell) {
    return `This roster has extra ${surplus} value. Float ${sell.name} as the first name in packages and ask for youth, picks, or a cleaner starter fit before accepting lateral points.`;
  }

  if (pickCount >= 15 && buy && !buyIsCoveredDepth) {
    return `The pick bank creates optionality. Open with a future pick before touching the core, then walk away if ${buy.name} costs a cornerstone player plus draft capital.`;
  }

  return "No clean package is forced. Let the room create the overpay, then use the roster read to decide whether the return improves age, liquidity, or weekly lineup leverage.";
}

function buildDynastyWindowGuardrail(
  row: OwnerIntelRow,
  pickRow?: OwnerPickRow | null,
  buildLabel?: OwnerBuildLabel | null
): DynastyAiSuggestion {
  const pickCount = (pickRow?.count2026 || 0) + (pickRow?.count2027 || 0);
  const core = row.untouchablePlayers?.[0] || row.youngCorePlayer;
  const olderRisk =
    row.oldestPlayer && (row.oldestPlayer.playerDetails?.age || 0) >= 28
      ? row.oldestPlayer
      : null;
  const isRebuild =
    isOwnerRebuildLane(buildLabel) ||
    /rebuild/i.test(row.identity) ||
    /rebuild/i.test(row.timeline);
  const isStrongRebuild = isOwnerStrongRebuildLane(buildLabel);
  const isStrongContender = isOwnerStrongContenderLane(buildLabel);
  const isContender =
    isOwnerContenderLane(buildLabel) ||
    /contend|win/i.test(row.identity) ||
    /contend|win/i.test(row.timeline);

  if (isRebuild) {
    return {
      title: "AI Window Guardrail",
      tone: isStrongRebuild ? "future" : "warn",
      theme: "window",
      copy: `${isStrongRebuild ? "Strong rebuild rule" : "Soft rebuild rule"}: every accepted deal should improve future draft position, add a younger insulated asset, or create more liquid draft capital. ${core ? `Keep ${core.name} as the core reference point.` : "Do not sell young value just to make the current lineup look cleaner."} ${pickCount >= 15 ? "The pick base is strong enough to wait for distressed sellers." : "Add picks before buying short-window production."}`,
    };
  }

  if (isContender) {
    return {
      title: "AI Window Guardrail",
      tone: "good",
      theme: "window",
      copy: `${isStrongContender ? "Strong contender rule" : "Contender rule"}: spend from depth, not the spine of the roster. ${isStrongContender ? "You can pay for a title-edge starter, but do not turn the elite core into a one-week rental bet." : olderRisk ? `${olderRisk.name} is the veteran value to keep liquid.` : "Avoid converting young value into aging points unless the weekly lineup clearly jumps a tier."}`,
    };
  }

  return {
    title: "AI Window Guardrail",
    tone: "warn",
    theme: "window",
    copy: `Soft rebuild rule: do not let one trade pick the direction by accident. Only buy points if the upgrade is a clear starter, and sell veterans when the return adds youth or picks without making the lineup collapse.`,
  };
}

function buildDynastyRosterChurn(row: OwnerIntelRow): DynastyAiSuggestion {
  const cutNames =
    row.droppablePlayers?.slice(0, 2).map(player => player.name) || [];
  const stash =
    row.bestBenchStash || row.breakoutCandidate || row.youngCorePlayer;
  const upside = row.breakoutCandidate;

  if (cutNames.length && stash) {
    return {
      title: "AI Roster Churn",
      tone: "warn",
      theme: "churn",
      copy: `First churn path: protect ${stash.name} and use ${cutNames.join(", ")} as the first cut candidate${cutNames.length === 1 ? "" : "s"} when a better stash appears. The back of the roster should create upside, not hold low-liquidity names.`,
    };
  }

  if (upside) {
    return {
      title: "AI Roster Churn",
      tone: "future",
      theme: "churn",
      copy: `${upside.name} is the upside hold. Do not cash that profile out for a flat value return unless the deal adds a safer young asset or a meaningful pick upgrade.`,
    };
  }

  return {
    title: "AI Roster Churn",
    tone: "neutral",
    theme: "churn",
    copy: "No obvious dynasty cut pressure is showing. Keep the last roster spots flexible and make waivers beat the current stash value before churning.",
  };
}

function buildDynastyPickLeverage(
  pickRow?: OwnerPickRow | null
): DynastyAiSuggestion {
  const pickCount = (pickRow?.count2026 || 0) + (pickRow?.count2027 || 0);
  const draftValue = pickRow ? formatCompactValue(pickRow.totalValue) : null;

  if (!pickRow) {
    return {
      title: "AI Pick Leverage",
      tone: "neutral",
      theme: "draft",
      copy: "Draft-capital data is thin for this manager, so the model should price trades through player liquidity first and avoid assuming picks can solve the roster shape.",
    };
  }

  if (pickCount >= 15) {
    return {
      title: "AI Pick Leverage",
      tone: "future",
      theme: "draft",
      copy: `${pickCount} future picks and ${draftValue} of draft capital gives this roster leverage. Use picks as the first sweetener before attaching core players. A pick-rich team should make other managers solve their lineup urgency.`,
    };
  }

  if (pickCount <= 12) {
    return {
      title: "AI Pick Leverage",
      tone: "warn",
      theme: "draft",
      copy: `${pickCount} future picks is light enough that draft capital should be protected. If a veteran is moved, ask for at least one liquid pick or a younger player who can gain market value.`,
    };
  }

  return {
    title: "AI Pick Leverage",
    tone: "neutral",
    theme: "draft",
    copy: `${pickCount} future picks and ${draftValue} of draft capital is a workable bank. Spend one pick only when it turns a bench asset into a true starter or a safer dynasty profile.`,
  };
}

function buildDynastySituationRadar(row: OwnerIntelRow): DynastyAiSuggestion | null {
  const summary = row.situationSummary;
  if (!summary?.backedCount) return null;
  const topBoost = summary.topBoostPlayer;
  const topRisk = summary.topRiskPlayer;

  if (summary.riskCount > summary.boostCount && topRisk) {
    return {
      title: "AI Situation Radar",
      tone: "warn",
      theme: "risk",
      copy: `${summary.note} Do not treat this as a pure market-value roster; role pressure is showing up before the trade card should get more aggressive.`,
    };
  }

  if (summary.boostCount && topBoost) {
    return {
      title: "AI Situation Radar",
      tone: "good",
      theme: "upside",
      copy: `${summary.note} That gives this manager a reason to hold or price the upside above a flat blended-value number.`,
    };
  }

  if (summary.sourceLimitedCount || summary.staleCount) {
    return {
      title: "AI Situation Radar",
      tone: "warn",
      theme: "risk",
      copy: `${summary.note} Keep the read capped until usage, news, injury, or depth-chart context refreshes.`,
    };
  }

  return {
    title: "AI Situation Radar",
    tone: "neutral",
    theme: "neutral",
    copy: `${summary.note} No strong role swing is forcing action, so trades should stay anchored to roster construction and market value.`,
  };
}

function buildDynastyRiskRadar(row: OwnerIntelRow): DynastyAiSuggestion {
  const riskStarter = row.starterAvailability?.riskiestStarter;
  const insurance = row.injuryInsurance;
  const oldest = row.oldestPlayer;
  const missed = row.starterAvailability?.avgGamesMissed;

  if (riskStarter && insurance) {
    return {
      title: "AI Risk Radar",
      tone: "danger",
      theme: "risk",
      copy: `${riskStarter.name} is the availability flag. Keep ${insurance.name} as internal cover unless the trade return materially improves age, role security, or pick liquidity.`,
    };
  }

  if (missed !== null && missed !== undefined && missed >= 2) {
    return {
      title: "AI Risk Radar",
      tone: "warn",
      theme: "risk",
      copy: `Starters averaged ${missed} missed games, so depth is not just decoration here. Consolidate only when the incoming player is durable enough to reduce weekly fragility.`,
    };
  }

  if (
    oldest &&
    (oldest.playerDetails?.age || 0) >= 28 &&
    oldest.value >= 1200
  ) {
    return {
      title: "AI Risk Radar",
      tone: "warn",
      theme: "risk",
      copy: `${oldest.name} is the age/liquidity monitor. Keep him if the lineup needs points, but set the sell line before the market starts treating the profile like declining value.`,
    };
  }

  return {
    title: "AI Risk Radar",
    tone: "good",
    theme: "risk",
    copy: "No severe health or age flag is forcing action. That gives this roster permission to be selective instead of accepting discounts for safer but lower-upside assets.",
  };
}

function buildDynastyOfferFilter(
  row: OwnerIntelRow,
  overviewRow?: LeagueOverviewRows[number] | null
): DynastyAiSuggestion {
  const buy = row.buyTarget;
  const sell = row.sellCandidate || row.tradeChip || row.bestBenchStash;
  const valueRank = overviewRow?.rank_value;
  const rankCopy = valueRank
    ? `roster value rank #${valueRank}`
    : "the current roster value";

  if (buy && sell) {
    return {
      title: "AI Offer Filter",
      tone: "good",
      theme: "trade",
      copy: `Auto-compare every offer to this baseline: would you rather hold ${sell.name}, or reset that value into ${buy.name} plus better age, liquidity, or lineup fit? If the answer is not obvious, make the other manager add.`,
    };
  }

  return {
    title: "AI Offer Filter",
    tone: "neutral",
    theme: "trade",
    copy: `Use ${rankCopy} as the floor. Decline trades that make the roster older, thinner, and less liquid unless the weekly starter upgrade is immediate and measurable.`,
  };
}

function buildDynastyAiSuggestions({
  row,
  pickRow,
  overviewRow,
  buildLabel,
  leagueSize = 0,
  seededTradeCopies = [],
  suppress = [],
}: {
  row: OwnerIntelRow;
  pickRow?: OwnerPickRow | null;
  overviewRow?: LeagueOverviewRows[number] | null;
  buildLabel?: OwnerBuildLabel | null;
  leagueSize?: number;
  seededTradeCopies?: string[];
  suppress?: Array<string | null | undefined>;
}): DynastyAiSuggestion[] {
  const effectiveNeed = getOwnerEffectiveNeedPosition(
    row,
    overviewRow,
    leagueSize
  );
  const baseCards: DynastyAiSuggestion[] = [
    {
      title: "AI Trade Builder",
      tone: isOwnerRebuildLane(buildLabel)
        ? isOwnerStrongRebuildLane(buildLabel)
          ? "future"
          : "warn"
        : effectiveNeed
          ? "good"
          : "neutral",
      theme: "trade",
      copy: buildDynastyTradeBuilder(
        row,
        pickRow,
        buildLabel,
        overviewRow,
        leagueSize
      ),
    },
    buildDynastySituationRadar(row),
    buildDynastyWindowGuardrail(row, pickRow, buildLabel),
    buildDynastyPickLeverage(pickRow),
    buildDynastyRosterChurn(row),
    buildDynastyRiskRadar(row),
    buildDynastyOfferFilter(row, overviewRow),
    buildDynastyCoreProtection(row, buildLabel),
    buildDynastySellLine(row),
    buildDynastyUpsideSignal(row),
  ].filter((card): card is DynastyAiSuggestion => Boolean(card));
  const actionMeta: Array<{
    title: string;
    tone: OwnerSignalTone;
    theme: DynastyAiTheme;
  }> = [
    { title: "AI Watchlist", tone: "good", theme: "trade" },
    { title: "AI Sell Discipline", tone: "warn", theme: "sell" },
    { title: "AI Upside Hold", tone: "future", theme: "upside" },
    { title: "AI Cut List", tone: "danger", theme: "churn" },
    { title: "AI Draft Leverage", tone: "future", theme: "draft" },
  ];
  const actionCards = buildDynastyActionNotes(row, pickRow).map(
    (copy, index) => ({
      ...(actionMeta[index] || {
        title: "AI Note",
        tone: "neutral" as const,
        theme: "neutral" as const,
      }),
      copy,
    })
  );
  const dedupedCopy = dedupeIntelNotes(
    [...baseCards, ...actionCards].map(card => card.copy),
    suppress
  );
  const candidateCards = dedupedCopy
    .map(copy =>
      [...baseCards, ...actionCards].find(card => card.copy === copy)
    )
    .filter((card): card is DynastyAiSuggestion => Boolean(card));

  return filterByPlayerNameMentionBudget(
    candidateCards,
    card => card.copy,
    getDynastyTradeTrackedNames(row),
    seededTradeCopies
  ).slice(0, 3);
}

function buildSeasonRosterRead({
  selectedIntel,
  selectedCounts,
  lineupGroups,
  canStepInGroups,
}: {
  selectedIntel?: OwnerIntelRow | null;
  selectedCounts?: ManagerCountRow | null;
  lineupGroups: Array<{
    label: string;
    count?: number;
    players: CommandPlayer[];
  }>;
  canStepInGroups: Array<{ label: string; players: CommandPlayer[] }>;
}): string {
  const missingGroups = lineupGroups.filter(
    group => group.players.length < Math.max(1, group.count ?? 1)
  );
  const starterCount = selectedCounts
    ? selectedCounts.QB_starters +
      selectedCounts.RB_starters +
      selectedCounts.WR_starters +
      selectedCounts.TE_starters +
      (selectedCounts.K_starters || 0) +
      (selectedCounts.DEF_starters || 0)
    : lineupGroups.reduce((sum, group) => sum + group.players.length, 0);
  const depthNames = canStepInGroups.flatMap(group =>
    group.players
      .slice(0, 2)
      .map(
        player =>
          `${player.name} (${player.seasonPositionRank || player.currentPositionRank || player.pos})`
      )
  );
  const weakStarter = selectedIntel?.weakestStarter;
  const riskStarter = selectedIntel?.starterAvailability?.riskiestStarter;
  const starterSourceLabel =
    selectedCounts?.starterSource === "Sleeper"
      ? "submitted Sleeper starters"
      : "projected starters";
  const riskCopy =
    selectedIntel?.starterAvailability?.avgGamesMissed !== null &&
    selectedIntel?.starterAvailability?.avgGamesMissed !== undefined
      ? `Availability risk is ${selectedIntel.starterAvailability.riskLevel}; ${starterSourceLabel} averaged ${selectedIntel.starterAvailability.avgGamesMissed} missed games.`
      : "Availability history is limited, so current season rank and role carry more weight.";
  const weakCopy = weakStarter
    ? `${weakStarter.name} (${weakStarter.seasonPositionRank || weakStarter.currentPositionRank || weakStarter.pos}) is the first starter to upgrade.`
    : "No starter is clearly below the league line.";
  const depthCopy = depthNames.length
    ? `Best next-man-up options: ${depthNames.slice(0, 4).join(", ")}.`
    : `There is not much starter-grade depth behind the ${starterSourceLabel}.`;
  const missingCopy = missingGroups.length
    ? `Lineup fill warning: ${missingGroups.map(group => group.label).join(", ")} needs a better season-rank option.`
    : `${starterCount} ${starterSourceLabel} fill from ranked active players.`;
  const situationCopy = selectedIntel?.situationSummary?.backedCount
    ? `Football context: ${selectedIntel.situationSummary.note}`
    : "Football-context role reads are still thin for this roster, so the season read stays rank/value driven.";

  return `${missingCopy} ${weakCopy} ${riskCopy} ${depthCopy} ${situationCopy}`;
}

function buildSeasonInsuranceRead(row?: OwnerIntelRow | null): string | null {
  if (!row?.injuryInsurance && !row?.starterAvailability?.riskiestStarter)
    return null;
  const risky = row.starterAvailability?.riskiestStarter;
  const cover = row.injuryInsurance;

  if (risky && cover) {
    return `${risky.name} is the player to insure around. ${cover.name} (${cover.seasonPositionRank || cover.currentPositionRank || cover.pos}) is the best internal emergency cover. If the real-life backup is cheap on waivers or in a small trade, compare that role path against keeping ${cover.name} as the first in-house patch.`;
  }

  if (cover) {
    return `${cover.name} is the cleanest internal injury cover. This roster should avoid cutting that profile unless waivers produce a clearer season role.`;
  }

  return `${risky?.name} is the main availability concern, but there is no clean internal cover showing in the current season ranks.`;
}

function CommandPlayerTile({
  player,
  onClick,
  variant = "default",
  label,
  note,
  showValueStack = false,
  swapSignal,
}: {
  player: CommandPlayer;
  onClick: () => void;
  variant?: "default" | "step";
  label?: string;
  note?: string | null;
  showValueStack?: boolean;
  swapSignal?: CommandSwapSignal;
}) {
  const valueLens = getCommandPlayerValueLens(player);
  const seasonRank =
    player.seasonPositionRank || player.currentPositionRank || player.pos;
  const dynastyLens = getCommandPlayerDynastyLens(player);
  const seasonLens = getCommandPlayerSeasonLens(player);
  const availability = getPlayerAvailability(player.playerDetails);
  const gameLockState = getCommandPlayerGameLockState(player);
  const shouldShowStatusPill =
    Boolean(gameLockState.label) ||
    !showValueStack ||
    availability.tone !== "taxi";

  return (
    <button
      type="button"
      className={`player-team-tile manager-command-player-tile ${variant === "step" ? "manager-command-player-tile-step" : ""} ${swapSignal ? `manager-command-player-tile-swap manager-command-player-tile-swap-${swapSignal.role}` : ""}`}
      style={getTeamTileStyle(player.playerDetails?.team)}
      onClick={onClick}
      aria-label={
        swapSignal
          ? `${player.name}, ${swapSignal.label}, ${swapSignal.confidencePct}% confidence`
          : undefined
      }
    >
      {label && (
        <div
          className={`manager-intel-player-kicker manager-command-action-pill manager-command-action-${getTaxiActionClassName(label)}`}
        >
          {label}
        </div>
      )}
      {swapSignal && (
        <div
          className={`manager-command-swap-corner manager-command-swap-corner-${swapSignal.role}`}
        >
          <span>{swapSignal.label}</span>
          <strong>{swapSignal.confidencePct}%</strong>
        </div>
      )}
      <div className="manager-command-player-tile-main">
        <PlayerNameWithHeadshot
          playerId={player.player_id}
          playerName={player.name}
          team={player.playerDetails?.team}
          position={player.pos}
        />
      </div>
      {note && <p className="manager-command-player-tile-note">{note}</p>}
      <div className="manager-command-player-tile-pills">
        <div className="manager-command-player-tile-pills-main">
          <TeamLogoPill team={player.playerDetails?.team} />
          {showValueStack ? (
            <>
              <span className="manager-command-season-value manager-command-dynasty-value manager-command-value-rank-pill">
                <span className="manager-command-value-label">
                  <em>Dynasty</em>
                  {formatCompactValue(dynastyLens.value)}
                </span>
                <PositionRankPill rank={dynastyLens.rank} />
              </span>
              <span className="manager-command-season-value manager-command-value-rank-pill">
                <span className="manager-command-value-label">
                  <em>Season</em>
                  {formatCompactValue(seasonLens.value)}
                </span>
                <PositionRankPill rank={seasonLens.rank} />
              </span>
            </>
          ) : (
            <>
              <span className={valueLens.className}>
                <em>{valueLens.label}</em>
                {formatCompactValue(valueLens.value)}
              </span>
              <PositionRankPill rank={seasonRank} />
            </>
          )}
        </div>
        {shouldShowStatusPill && (
          <div className="manager-command-player-status-row">
            <span
              className={`manager-command-status-pill is-${availability.tone}`}
            >
              {availability.label}
            </span>
            {gameLockState.label && (
              <span
                className={`manager-command-status-pill manager-command-lock-status ${gameLockState.isLocked ? "is-locked" : "is-locking"}`}
                title={gameLockState.reason || undefined}
              >
                <LockKeyhole aria-hidden="true" />
                {gameLockState.label}
              </span>
            )}
            {swapSignal?.detail && (
              <span
                className={`manager-command-status-pill manager-command-swap-status is-${swapSignal.role === "out" ? "risk" : "active"}`}
              >
                {swapSignal.detail}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

type CommandPlayer =
  | ManagerIntelPlayer
  | NonNullable<
      ReportData["managerPositionCounts"][number]["starterPlayers"]
    >[number];

type LineupSwapSeverity = "watch" | "recommended" | "urgent";

type LineupSwapOption = {
  player: CommandPlayer;
  confidencePct: number;
  scoreEdge: number;
  projectedPointEdge: number | null;
  fitLabel: string;
  reason: string;
  reasonBullets: string[];
};

type LineupSwapRecommendation = {
  starterOut: CommandPlayer;
  groupLabel: string;
  severity: LineupSwapSeverity;
  summary: string;
  options: LineupSwapOption[];
};

type CommandSwapSignal = {
  role: "out" | "in";
  confidencePct: number;
  label: string;
  detail?: string;
};

function getFiniteNumber(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function getFirstFiniteNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const numeric = getFiniteNumber(value);
    if (numeric !== null) return numeric;
  }
  return null;
}

function getFirstTextValue(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getCommandPlayerProjectionRead(player: CommandPlayer): {
  projectedPoints: number | null;
  sourceLabel: string | null;
} {
  const playerRecord = player as unknown as Record<string, unknown>;
  const details = player.playerDetails as
    | (PlayerDetails & Record<string, unknown>)
    | undefined;
  const valueProfile = details?.valueProfile as
    | (NonNullable<PlayerDetails["valueProfile"]> & Record<string, unknown>)
    | undefined;
  const projectedPoints = getFirstFiniteNumber(
    playerRecord.weeklyProjection,
    playerRecord.projectedPoints,
    playerRecord.projectedFantasyPoints,
    playerRecord.projection,
    playerRecord.fantasyProjection,
    details?.weeklyProjection,
    details?.projectedPoints,
    details?.projectedFantasyPoints,
    details?.projection,
    details?.fantasyProjection,
    valueProfile?.weeklyProjection,
    valueProfile?.projectedPoints,
    valueProfile?.projectedFantasyPoints,
    valueProfile?.fantasyProsProjection,
    valueProfile?.fantasyProsProjectedPoints
  );

  return {
    projectedPoints,
    sourceLabel: projectedPoints !== null ? "stored weekly projection" : null,
  };
}

function formatLineupLockCountdown(
  kickoffMs: number,
  nowMs = Date.now()
): string {
  const remainingMs = Math.max(0, kickoffMs - nowMs);
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Locks in ${days}d ${hours}h`;
  if (hours > 0) return `Locks in ${hours}h ${minutes}m`;
  return `Locks in ${minutes}m`;
}

function getCommandPlayerGameLockState(player: CommandPlayer): {
  isLocked: boolean;
  label: string | null;
  reason: string | null;
} {
  const playerRecord = player as unknown as Record<string, unknown>;
  const details = player.playerDetails as
    | (PlayerDetails & Record<string, unknown>)
    | undefined;
  const explicitLock = [
    playerRecord.isLocked,
    playerRecord.locked,
    playerRecord.gameLocked,
    playerRecord.lineupLocked,
    details?.isLocked,
    details?.locked,
    details?.gameLocked,
    details?.lineupLocked,
  ].some(
    value => value === true || value === "true" || value === 1 || value === "1"
  );

  if (explicitLock) {
    return {
      isLocked: true,
      label: "Locked",
      reason: "The player is marked as lineup locked by the report data.",
    };
  }

  const status = getFirstTextValue(
    playerRecord.gameStatus,
    playerRecord.status,
    playerRecord.lineupStatus,
    details?.gameStatus,
    details?.status,
    details?.lineupStatus
  );
  if (
    status &&
    !/pre|scheduled|upcoming|not[_\s-]?started/i.test(status) &&
    /locked|started|live|in[_\s-]?progress|halftime|final|complete/i.test(
      status
    )
  ) {
    return {
      isLocked: true,
      label: "Locked",
      reason: `Game status is ${status}.`,
    };
  }

  const kickoffValue =
    getFirstTextValue(
      playerRecord.kickoffAt,
      playerRecord.gameStartTime,
      playerRecord.gameStart,
      playerRecord.startTime,
      playerRecord.kickoff,
      details?.kickoffAt,
      details?.gameStartTime,
      details?.gameStart,
      details?.startTime,
      details?.kickoff
    ) ??
    getFirstFiniteNumber(
      playerRecord.kickoffAt,
      playerRecord.gameStartTime,
      playerRecord.gameStart,
      playerRecord.startTime,
      playerRecord.kickoff,
      details?.kickoffAt,
      details?.gameStartTime,
      details?.gameStart,
      details?.startTime,
      details?.kickoff
    );
  if (kickoffValue !== null) {
    const rawTime =
      typeof kickoffValue === "number"
        ? kickoffValue
        : Date.parse(kickoffValue);
    const kickoffMs =
      rawTime && rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime;
    if (Number.isFinite(kickoffMs) && kickoffMs <= Date.now()) {
      return {
        isLocked: true,
        label: "Locked",
        reason: "Kickoff time has passed.",
      };
    }
    if (Number.isFinite(kickoffMs)) {
      return {
        isLocked: false,
        label: formatLineupLockCountdown(kickoffMs),
        reason:
          "Projected lineup lock is based on kickoff time in the report data.",
      };
    }
  }

  return { isLocked: false, label: null, reason: null };
}

function formatProjectedPointEdge(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)} pts`;
}

function getCommandPlayerSeasonScore(player: CommandPlayer): number {
  const seasonLens = getCommandPlayerSeasonLens(player);
  const projectionRead = getCommandPlayerProjectionRead(player);
  const projectionScore =
    projectionRead.projectedPoints !== null
      ? projectionRead.projectedPoints * 420
      : 0;
  const value = Number(
    seasonLens.value ?? player.seasonValue ?? player.value ?? 0
  );
  const rank = parsePositionRankValue(
    seasonLens.rank || player.seasonPositionRank || player.currentPositionRank
  );
  const rankScore = rank ? Math.max(0, 2300 - rank * 24) : 0;
  const availability = getPlayerAvailability(player.playerDetails);
  const availabilityPenalty =
    availability.tone === "risk"
      ? 420
      : availability.tone === "warning"
        ? 220
        : 0;
  return Math.max(projectionScore, value || 0, rankScore) - availabilityPenalty;
}

function getLineupGroupEligiblePositions(group: {
  key?: string;
  label?: string;
}): CountPosition[] {
  const key = String(group.key || group.label || "").toUpperCase();
  if (key.includes("QB_SF") || key.includes("QB/SF") || key.includes("SUPER"))
    return ["QB", "RB", "WR", "TE"];
  if (key.includes("FLEX")) return ["RB", "WR", "TE"];
  if (key.includes("QB")) return ["QB"];
  if (key.includes("RB")) return ["RB"];
  if (key.includes("WR")) return ["WR"];
  if (key.includes("TE")) return ["TE"];
  if (key.includes("DEF")) return ["DEF"];
  if (key.includes("K")) return ["K"];
  return ["RB", "WR", "TE"];
}

function isLineupSwapEligible(
  group: { key?: string; label?: string },
  player: CommandPlayer
): boolean {
  return getLineupGroupEligiblePositions(group).includes(
    player.pos as CountPosition
  );
}

function getLineupSwapSeverity(
  confidencePct: number,
  scoreEdge: number,
  projectedPointEdge: number | null
): LineupSwapSeverity {
  if (projectedPointEdge !== null && projectedPointEdge >= 4) return "urgent";
  if (projectedPointEdge !== null && projectedPointEdge >= 2.2)
    return "recommended";
  if (confidencePct >= 82 || scoreEdge >= 650) return "urgent";
  if (confidencePct >= 70 || scoreEdge >= 360) return "recommended";
  return "watch";
}

function getLineupSwapSeverityLabel(severity: LineupSwapSeverity): string {
  if (severity === "urgent") return "Swap pressure";
  if (severity === "recommended") return "Recommended";
  return "Watch";
}

function getManagerMatchupPreview(data: ReportData, manager?: string | null) {
  if (!manager) return null;
  const normalized = normalizeReportManagerName(manager);
  return (
    data.matchupPreviews?.find(
      row => normalizeReportManagerName(row.manager) === normalized
    ) || null
  );
}

function buildLineupSwapRecommendations({
  data,
  manager,
  lineupGroups,
  stepInGroups,
  selectedIntel,
}: {
  data: ReportData;
  manager?: string | null;
  lineupGroups: Array<{
    key?: string;
    label?: string;
    count?: number;
    players: CommandPlayer[];
  }>;
  stepInGroups: Array<{ label: string; players: CommandPlayer[] }>;
  selectedIntel?: ManagerRosterIntelRows[number] | null;
}): LineupSwapRecommendation[] {
  const benchPlayers = stepInGroups.flatMap(group => group.players);
  if (!benchPlayers.length) return [];

  const matchup = getManagerMatchupPreview(data, manager);
  const vulnerableIds = new Set(
    [
      ...(matchup?.vulnerableSpots || []),
      ...(matchup?.boomBustRisks || []),
      selectedIntel?.weakestStarter,
      selectedIntel?.starterAvailability?.riskiestStarter,
    ]
      .filter(Boolean)
      .map(player => player?.player_id)
  );
  const mustStartIds = new Set(
    (matchup?.mustStarts || []).map(player => player.player_id)
  );
  const recommendations: LineupSwapRecommendation[] = [];

  lineupGroups.forEach(group => {
    const fitLabel = getSwapFitLabel(group.label || group.key);
    group.players.forEach(starter => {
      if (mustStartIds.has(starter.player_id)) return;
      if (getCommandPlayerGameLockState(starter).isLocked) return;

      const starterScore = getCommandPlayerSeasonScore(starter);
      const starterProjection = getCommandPlayerProjectionRead(starter);
      const starterIsFlagged = vulnerableIds.has(starter.player_id);
      const options = benchPlayers
        .filter(
          candidate =>
            candidate.player_id !== starter.player_id &&
            isLineupSwapEligible(group, candidate)
        )
        .filter(candidate => !getCommandPlayerGameLockState(candidate).isLocked)
        .map(candidate => {
          const candidateScore = getCommandPlayerSeasonScore(candidate);
          const candidateProjection = getCommandPlayerProjectionRead(candidate);
          const scoreEdge = candidateScore - starterScore;
          const projectedPointEdge =
            candidateProjection.projectedPoints !== null &&
            starterProjection.projectedPoints !== null
              ? Math.round(
                  (candidateProjection.projectedPoints -
                    starterProjection.projectedPoints) *
                    10
                ) / 10
              : null;
          const samePositionBonus = candidate.pos === starter.pos ? 4 : 0;
          const flaggedBonus = starterIsFlagged ? 8 : 0;
          const edgePct =
            starterScore > 0
              ? (scoreEdge / Math.max(starterScore, 1)) * 100
              : scoreEdge > 0
                ? 14
                : 0;
          const projectionBonus =
            projectedPointEdge !== null
              ? Math.max(-8, Math.min(18, projectedPointEdge * 4.5))
              : 0;
          const confidencePct = clampPercentValue(
            58 +
              edgePct * 1.35 +
              projectionBonus +
              samePositionBonus +
              flaggedBonus
          );
          const candidateRank =
            getCommandPlayerSeasonLens(candidate).rank ||
            candidate.seasonPositionRank ||
            candidate.currentPositionRank ||
            candidate.pos;
          const starterRank =
            getCommandPlayerSeasonLens(starter).rank ||
            starter.seasonPositionRank ||
            starter.currentPositionRank ||
            starter.pos;
          const projectedPointCopy =
            formatProjectedPointEdge(projectedPointEdge);
          const reasonBullets = [
            projectedPointCopy
              ? `Stored weekly projection edge: ${candidate.name} is ${projectedPointCopy} ahead of ${starter.name}.`
              : `No ready stored weekly projection is attached for this matchup; using current-season value, rank, and availability.`,
            scoreEdge > 0
              ? `Starter-score edge: ${formatCompactValue(scoreEdge)} in the current-season model.`
              : starterIsFlagged
                ? `${starter.name} is already flagged by the matchup or availability model.`
                : `${candidate.name} is close enough to monitor before lineup lock.`,
            candidateRank && starterRank
              ? `Season ranks: ${candidate.name} ${candidateRank}, ${starter.name} ${starterRank}.`
              : null,
            starterIsFlagged
              ? `${starter.name} appears in the vulnerable starter set for this manager.`
              : null,
            candidateProjection.sourceLabel
              ? `Stored weekly projection context is attached.`
              : null,
          ].filter(Boolean) as string[];
          const reason =
            scoreEdge > 0
              ? `${candidate.name} clears ${starter.name} by ${formatCompactValue(scoreEdge)} in current-season starter score.`
              : starterIsFlagged
                ? `${starter.name} is already flagged, and ${candidate.name} is the closest eligible cover.`
                : `${candidate.name} is close enough to monitor against ${starter.name} before lock.`;
          return {
            player: candidate,
            confidencePct,
            scoreEdge,
            projectedPointEdge,
            fitLabel,
            reason:
              `${reason} ${projectedPointCopy ? `${projectedPointCopy} weekly projection edge.` : ""} ${candidateRank && starterRank ? `${candidateRank} vs ${starterRank}.` : ""}`.trim(),
            reasonBullets,
          };
        })
        .filter(
          option =>
            option.scoreEdge >= 125 ||
            (option.projectedPointEdge !== null &&
              option.projectedPointEdge >= 0.8) ||
            (starterIsFlagged && option.confidencePct >= 62)
        )
        .sort(
          (a, b) =>
            b.confidencePct - a.confidencePct || b.scoreEdge - a.scoreEdge
        )
        .slice(0, 3)
        .reduce<LineupSwapOption[]>((adjusted, option, index) => {
          const previousConfidence =
            adjusted[index - 1]?.confidencePct ?? option.confidencePct;
          adjusted.push({
            ...option,
            confidencePct:
              index === 0
                ? option.confidencePct
                : Math.min(
                    option.confidencePct,
                    Math.max(0, previousConfidence - 7)
                  ),
          });
          return adjusted;
        }, []);

      if (!options.length) return;
      const topOption = options[0];
      const severity = getLineupSwapSeverity(
        topOption.confidencePct,
        topOption.scoreEdge,
        topOption.projectedPointEdge
      );
      recommendations.push({
        starterOut: starter,
        groupLabel: fitLabel,
        severity,
        summary: `${starter.name} is the tile to pressure-test. ${topOption.player.name} is the strongest replacement signal at ${topOption.confidencePct}% confidence${formatProjectedPointEdge(topOption.projectedPointEdge) ? ` with a ${formatProjectedPointEdge(topOption.projectedPointEdge)} projection edge` : ""}.`,
        options,
      });
    });
  });

  return recommendations
    .sort((a, b) => {
      const severityRank: Record<LineupSwapSeverity, number> = {
        urgent: 0,
        recommended: 1,
        watch: 2,
      };
      return (
        severityRank[a.severity] - severityRank[b.severity] ||
        b.options[0].confidencePct - a.options[0].confidencePct ||
        b.options[0].scoreEdge - a.options[0].scoreEdge
      );
    })
    .slice(0, 4);
}

export function LeagueCommandCenter({
  data,
  managerAvatars,
  leagueId,
  leagueLogo,
  section = "all",
  viewerManager,
  currentStandings,
  leagueValueMode: leagueValueModeInput = "dynasty",
}: {
  data: ReportData;
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
  section?: "all" | "roster" | "taxi";
  viewerManager?: string | null;
  currentStandings?: ReportData["currentStandings"];
  leagueValueMode?: ReportData["leagueValueMode"];
}) {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );
  const intel = data.managerRosterIntelligence || [];
  const leagueValueMode = normalizeLeagueValueMode(
    leagueValueModeInput ||
      data.leagueDiagnostics?.valueMode ||
      data.leagueValueMode
  );
  const isRedraft = leagueValueMode === "redraft";
  const isVisibleManager = (manager?: string | null) =>
    !(isRedraft && isPlaceholderManagerName(manager));
  const visibleIntel = intel.filter(row => isVisibleManager(row.manager));
  const starterDepth = (data.managerPositionCounts || [])
    .filter(row => isVisibleManager(row.manager))
    .map(row => {
      const rowIntel = intel.find(item => item.manager === row.manager);
      const starterSeasonValue = (row.starterPlayers || []).reduce(
        (sum, player) => sum + (player.seasonValue || player.value || 0),
        0
      );

      return {
        manager: row.manager,
        starterCount:
          row.QB_starters +
          row.RB_starters +
          row.WR_starters +
          row.TE_starters +
          (row.K_starters || 0) +
          (row.DEF_starters || 0),
        totalPlayers:
          row.QB + row.RB + row.WR + row.TE + (row.K || 0) + (row.DEF || 0),
        starterSeasonValue,
        starterAvailability: rowIntel?.starterAvailability,
        rosterHealthScore: rowIntel?.rosterHealthScore,
        pressurePoints: rowIntel?.pressurePoints || [],
      };
    })
    .sort(
      (a, b) =>
        b.starterCount - a.starterCount ||
        b.starterSeasonValue - a.starterSeasonValue ||
        b.totalPlayers - a.totalPlayers ||
        compareManagersByViewerAndStanding(a.manager, b.manager, {
          viewerManager,
          standings: currentStandings,
          leagueOverview: data.leagueOverview,
        })
    );
  const taxiDepth = visibleIntel
    .filter(row => row.taxiTriage?.items.length)
    .map(row => ({
      manager: row.manager,
      taxiTriage: row.taxiTriage,
    }))
    .sort((a, b) => {
      const aPromote = a.taxiTriage.counts["Promote Now"] || 0;
      const bPromote = b.taxiTriage.counts["Promote Now"] || 0;
      const aCut = a.taxiTriage.counts.Cuttable || 0;
      const bCut = b.taxiTriage.counts.Cuttable || 0;
      return (
        bPromote - aPromote ||
        bCut - aCut ||
        b.taxiTriage.items.length - a.taxiTriage.items.length ||
        compareManagersByViewerAndStanding(a.manager, b.manager, {
          viewerManager,
          standings: currentStandings,
          leagueOverview: data.leagueOverview,
        })
      );
    });
  const selectedIntel = selectedManager
    ? visibleIntel.find(row => row.manager === selectedManager)
    : null;
  const selectedCounts = selectedManager
    ? data.managerPositionCounts.find(row => row.manager === selectedManager && isVisibleManager(row.manager))
    : null;
  const openManager = (manager: string) => setSelectedManager(manager);
  const openCommandPlayerForManager = (
    manager: string,
    player: CommandPlayer
  ) => {
    const valueLens =
      leagueValueMode === "redraft"
        ? {
            label: "Season",
            value:
              getCommandPlayerSeasonLens(player).value ??
              player.seasonValue ??
              player.value,
            className: "manager-command-season-value",
            kind: "season" as const,
          }
        : getCommandPlayerValueLens(player);
    const rank =
      valueLens.kind === "season"
        ? player.seasonPositionRank || player.currentPositionRank || player.pos
        : player.currentPositionRank || player.seasonPositionRank || player.pos;
    const taxiRead = player as Partial<TaxiTriageItem>;
    setSelectedPlayer(
      buildPlayerModalData({
        playerId: player.player_id,
        playerName: player.name,
        playerPos: player.pos,
        value: valueLens.value,
        playerDetails: player.playerDetails,
        playerDetailsById: data.playerDetailsById,
        manager: player.owner || manager,
        managerAvatarUrl: managerAvatars?.[player.owner || manager],
        currentPositionRank: rank,
        valueMode:
          leagueValueMode === "redraft" || valueLens.kind === "season"
            ? "redraft"
            : "dynasty",
        taxiAction: taxiRead.taxiAction,
        taxiReason: taxiRead.taxiReason,
      })
    );
  };
  const openCommandPlayer = (player: CommandPlayer) => {
    if (!selectedManager) return;
    openCommandPlayerForManager(selectedManager, player);
  };
  const selectedStarters = selectedCounts?.starterPlayers || [];
  const selectedLineupPlayers =
    selectedCounts?.lineupPlayers || selectedStarters;
  const fallbackStarterGroups = (players: typeof selectedStarters) => {
    const used = new Set<string>();
    const take = (position: string, count: number) => {
      const picked = players
        .filter(
          player => player.pos === position && !used.has(player.player_id)
        )
        .sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value))
        .slice(0, count);
      picked.forEach(player => used.add(player.player_id));
      return picked;
    };
    const qbs = take("QB", 2);
    const rbs = take("RB", 2);
    const wrs = take("WR", 2);
    const tes = take("TE", 1);
    const flex = players
      .filter(
        player =>
          ["RB", "WR", "TE"].includes(player.pos) && !used.has(player.player_id)
      )
      .sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value))
      .slice(0, 2);
    return [
      { key: "QB_SF", label: "QB / SF", count: 2, players: qbs },
      { key: "RB", label: "RB", count: 2, players: rbs },
      { key: "WR", label: "WR", count: 2, players: wrs },
      { key: "TE", label: "TE", count: 1, players: tes },
      { key: "FLEX", label: "Flex", count: 2, players: flex },
    ];
  };
  const rawLineupGroups = selectedCounts?.starterGroups?.length
    ? sortLineupGroupsForDisplay(
        selectedCounts.starterGroups.map(group => ({
          key: group.key,
          label: group.label,
          count: group.count,
          players: group.players || [],
        }))
      )
    : sortLineupGroupsForDisplay(fallbackStarterGroups(selectedStarters));
  const lineupGroups = combineSuperflexQuarterbackGroups(rawLineupGroups);
  const projectedLineupIds = new Set(
    (selectedStarters.length
      ? selectedStarters
      : lineupGroups.flatMap(group => group.players)
    ).map(player => player.player_id)
  );
  const hasKickerSlot = lineupGroups.some(
    group =>
      group.players.some(player => player.pos === "K") ||
      /^K\b/i.test(group.label)
  );
  const hasDefenseSlot = lineupGroups.some(
    group =>
      group.players.some(player => player.pos === "DEF") ||
      /^DEF\b/i.test(group.label)
  );
  const canStepInGroups = [
    {
      label: "QB",
      players: selectedLineupPlayers
        .filter(
          player =>
            player.pos === "QB" && !projectedLineupIds.has(player.player_id)
        )
        .sort(
          (a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value)
        ),
    },
    {
      label: "Flex",
      players: selectedLineupPlayers
        .filter(
          player =>
            ["RB", "WR", "TE"].includes(player.pos) &&
            !projectedLineupIds.has(player.player_id)
        )
        .sort(
          (a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value)
        ),
    },
    hasKickerSlot
      ? {
          label: "K",
          players: selectedLineupPlayers
            .filter(
              player =>
                player.pos === "K" && !projectedLineupIds.has(player.player_id)
            )
            .sort(
              (a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value)
            ),
        }
      : null,
    hasDefenseSlot
      ? {
          label: "DEF",
          players: selectedLineupPlayers
            .filter(
              player =>
                player.pos === "DEF" &&
                !projectedLineupIds.has(player.player_id)
            )
            .sort(
              (a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value)
            ),
        }
      : null,
  ].filter(
    (
      group
    ): group is { label: string; players: typeof selectedLineupPlayers } =>
      Boolean(group && group.players.length)
  );
  const lineupSwapRecommendations = buildLineupSwapRecommendations({
    data,
    manager: selectedManager,
    lineupGroups,
    stepInGroups: canStepInGroups,
    selectedIntel,
  });
  const swapByStarterId = new Map(
    lineupSwapRecommendations.map(recommendation => [
      recommendation.starterOut.player_id,
      recommendation,
    ])
  );
  const swapOptionByPlayerId = new Map<string, LineupSwapOption>();
  lineupSwapRecommendations.forEach(recommendation => {
    recommendation.options.forEach(option => {
      const existing = swapOptionByPlayerId.get(option.player.player_id);
      if (!existing || option.confidencePct > existing.confidencePct) {
        swapOptionByPlayerId.set(option.player.player_id, option);
      }
    });
  });
  const selectedStarterSeasonValue = selectedStarters.reduce(
    (sum, player) => sum + (player.seasonValue || player.value || 0),
    0
  );
  const selectedTaxiCount = selectedIntel?.taxiTriage?.items.length || 0;
  const selectedTaxiPromoteCount =
    selectedIntel?.taxiTriage?.counts["Promote Now"] || 0;
  const selectedTaxiParkedCount =
    selectedIntel?.taxiTriage?.counts["Keep Parked"] || 0;
  const selectedTaxiCutCount = selectedIntel?.taxiTriage?.counts.Cuttable || 0;
  const selectedTaxiItems = sortTaxiTriageItems(
    selectedIntel?.taxiTriage?.items || []
  );
  const selectedSeasonTags = (() => {
    if (!selectedIntel) return [];
    const starterCount = selectedCounts
      ? selectedCounts.QB_starters +
        selectedCounts.RB_starters +
        selectedCounts.WR_starters +
        selectedCounts.TE_starters +
        (selectedCounts.K_starters || 0) +
        (selectedCounts.DEF_starters || 0)
      : 0;
    const tags: Array<{
      label: string;
      tone: "neutral" | "good" | "warn" | "danger" | "future";
    }> = [
      starterCount
        ? {
            label: `${starterCount} ${selectedCounts?.starterSource === "Sleeper" ? "Sleeper starters" : "projected starters"}`,
            tone: "neutral",
          }
        : null,
      selectedStarterSeasonValue
        ? {
            label: `Season value ${formatCompactValue(selectedStarterSeasonValue)}`,
            tone: "good",
          }
        : null,
      selectedIntel.rosterHealthScore !== null &&
      selectedIntel.rosterHealthScore !== undefined
        ? {
            label: `Health ${selectedIntel.rosterHealthScore}`,
            tone:
              selectedIntel.rosterHealthScore >= 75
                ? "good"
                : selectedIntel.rosterHealthScore <= 45
                  ? "danger"
                  : "warn",
          }
        : null,
      selectedIntel.starterAvailability?.riskLevel === "high"
        ? { label: "Injury Watch", tone: "danger" }
        : null,
      selectedIntel.holes.summary &&
      selectedIntel.holes.summary !== "No major roster hole flagged"
        ? {
            label: titleCasePill(
              selectedIntel.holes.summary.split(",")[0]?.trim() ||
                "Lineup Pressure"
            ),
            tone: "warn",
          }
        : null,
      lineupSwapRecommendations.length
        ? {
            label: `${lineupSwapRecommendations.length} start/sit calls`,
            tone: "warn",
          }
        : null,
      selectedIntel.pressurePoints?.length
        ? {
            label: `${selectedIntel.pressurePoints.length} pressure flags`,
            tone: "warn",
          }
        : null,
    ].filter(Boolean) as Array<{
      label: string;
      tone: "neutral" | "good" | "warn" | "danger" | "future";
    }>;
    return tags.slice(0, 6);
  })();
  const startingRosterStrengthTiles = sortLineupGroupsForDisplay(
    selectedIntel?.startingRosterStrength || []
  );
  const hasStartingRosterStrength =
    startingRosterStrengthTiles.length > 0 ||
    Boolean(selectedIntel?.positionGrades);

  return (
    <>
      <div className="command-center-grid">
        {section !== "taxi" && (
          <FeatureCard
            number={1}
            title="Projected Roster Board"
            kicker="Season starter room"
            className="command-feature-card-wide"
            hideNumber
            hideHeader={section !== "all"}
          >
            <div
              className="command-depth-grid balanced-tile-grid"
              style={getBalancedGridStyle(starterDepth.length)}
            >
              {starterDepth.map(row => (
                <ManagerDepthTile
                  key={row.manager}
                  manager={row.manager}
                  avatarUrl={managerAvatars?.[row.manager]}
                  className={`${viewerOwnedHighlightClass(
                    row.manager,
                    viewerManager
                  )} projected-roster-depth-tile`.trim()}
                  badges={[
                    { label: `${row.starterCount} starters`, tone: "neutral" },
                    ...(row.starterSeasonValue
                      ? [
                          {
                            label: `Starters ${formatCompactValue(row.starterSeasonValue)}`,
                            tone: "good" as const,
                          },
                        ]
                      : []),
                    ...(row.starterAvailability?.avgGamesMissed !== null &&
                    row.starterAvailability?.avgGamesMissed !== undefined
                      ? [
                          {
                            label: `${row.starterAvailability.avgGamesMissed} missed/gm`,
                            tone:
                              row.starterAvailability.riskLevel === "high"
                                ? ("danger" as const)
                                : row.starterAvailability.riskLevel === "medium"
                                  ? ("warn" as const)
                                  : ("good" as const),
                          },
                        ]
                      : []),
                    ...(row.rosterHealthScore
                      ? [
                          {
                            label: `Health ${row.rosterHealthScore}`,
                            tone:
                              row.rosterHealthScore >= 75
                                ? ("good" as const)
                                : row.rosterHealthScore <= 45
                                  ? ("danger" as const)
                                  : ("warn" as const),
                          },
                        ]
                      : []),
                  ]}
                  onClick={() => openManager(row.manager)}
                />
              ))}
            </div>
          </FeatureCard>
        )}

        {section !== "roster" && taxiDepth.length ? (
          <FeatureCard
            number={2}
            title="Taxi Squad Triage"
            kicker="Taxi-only activation checks"
            className="command-feature-card-wide"
            hideNumber
            hideHeader={section !== "all"}
          >
            {section === "taxi" ? (
              <div className="manager-command-taxi-overview-list">
                {taxiDepth.map(row => {
                  const taxiItems = sortTaxiTriageItems(
                    row.taxiTriage.items || []
                  );

                  return (
                    <section
                      key={row.manager}
                      className="manager-command-taxi-overview-group"
                    >
                      <ManagerDepthTile
                        manager={row.manager}
                        avatarUrl={managerAvatars?.[row.manager]}
                        className={`taxi-triage-depth-tile ${viewerOwnedHighlightClass(
                          row.manager,
                          viewerManager
                        )}`}
                        subtitle={
                          row.taxiTriage.counts["Promote Now"]
                            ? `${row.taxiTriage.counts["Promote Now"]} promote`
                            : null
                        }
                        subtitleTone="balanced"
                        badges={[
                          {
                            label: `${row.taxiTriage.items.length} taxi`,
                            tone: "neutral",
                          },
                          ...(row.taxiTriage.counts["Keep Parked"]
                            ? [
                                {
                                  label: `${row.taxiTriage.counts["Keep Parked"]} stash`,
                                  tone: "future" as const,
                                },
                              ]
                            : []),
                          ...(row.taxiTriage.counts["Taxi Risk"]
                            ? [
                                {
                                  label: `${row.taxiTriage.counts["Taxi Risk"]} risk`,
                                  tone: "warn" as const,
                                },
                              ]
                            : []),
                          ...(row.taxiTriage.counts.Cuttable
                            ? [
                                {
                                  label: `${row.taxiTriage.counts.Cuttable} cuts`,
                                  tone: "danger" as const,
                                },
                              ]
                            : []),
                        ]}
                        onClick={() => openManager(row.manager)}
                      />
                      <div
                        className="manager-command-taxi-overview-player-grid manager-command-tile-grid balanced-tile-grid balanced-centered-tile-grid"
                        style={getBalancedGridStyle(
                          Math.max(taxiItems.length, 2),
                          2
                        )}
                      >
                        {taxiItems.map(player => (
                          <CommandPlayerTile
                            key={player.player_id}
                            label={getTaxiDisplayAction(player.taxiAction)}
                            note={player.taxiReason}
                            player={player}
                            showValueStack
                            onClick={() =>
                              openCommandPlayerForManager(row.manager, player)
                            }
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div
                className="command-depth-grid balanced-tile-grid"
                style={getBalancedGridStyle(taxiDepth.length)}
              >
                {taxiDepth.map(row => (
                  <ManagerDepthTile
                    key={row.manager}
                    manager={row.manager}
                    avatarUrl={managerAvatars?.[row.manager]}
                    className={`taxi-triage-depth-tile ${viewerOwnedHighlightClass(
                      row.manager,
                      viewerManager
                    )}`}
                    subtitle={
                      row.taxiTriage.counts["Promote Now"]
                        ? `${row.taxiTriage.counts["Promote Now"]} promote`
                        : null
                    }
                    subtitleTone="balanced"
                    badges={[
                      {
                        label: `${row.taxiTriage.items.length} taxi`,
                        tone: "neutral",
                      },
                      ...(row.taxiTriage.counts["Keep Parked"]
                        ? [
                            {
                              label: `${row.taxiTriage.counts["Keep Parked"]} stash`,
                              tone: "future" as const,
                            },
                          ]
                        : []),
                      ...(row.taxiTriage.counts["Taxi Risk"]
                        ? [
                            {
                              label: `${row.taxiTriage.counts["Taxi Risk"]} risk`,
                              tone: "warn" as const,
                            },
                          ]
                        : []),
                      ...(row.taxiTriage.counts.Cuttable
                        ? [
                            {
                              label: `${row.taxiTriage.counts.Cuttable} cuts`,
                              tone: "danger" as const,
                            },
                          ]
                        : []),
                    ]}
                    onClick={() => openManager(row.manager)}
                  />
                ))}
              </div>
            )}
          </FeatureCard>
        ) : null}
      </div>
      <Dialog
        open={selectedManager !== null}
        onOpenChange={open => !open && setSelectedManager(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="manager-command-dialog max-w-3xl border-cyan-300/20 bg-slate-950 p-0 text-slate-100"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {selectedManager || "Manager"} Command Center
            </DialogTitle>
            <DialogDescription>
              Manager-level calculation details and data points.
            </DialogDescription>
          </DialogHeader>
          {selectedManager && (
            <div className="manager-command-modal-inner">
              <div className="manager-command-hero">
                {managerAvatars?.[selectedManager] && (
                  <>
                    <img
                      src={managerAvatars[selectedManager] || ""}
                      alt=""
                      className="manager-hero-wash"
                    />
                    <img
                      src={managerAvatars[selectedManager] || ""}
                      alt=""
                      className="manager-hero-watermark"
                    />
                  </>
                )}
                <div className="manager-hero-scrim" />
                <button
                  type="button"
                  className="manager-modal-close"
                  onClick={() => setSelectedManager(null)}
                  aria-label={`Close ${selectedManager} details`}
                >
                  <XIcon aria-hidden="true" />
                </button>
                <div className="manager-command-title-lockup">
                  <ChampionAvatarFrame
                    managerName={selectedManager}
                    className="manager-command-champion-frame"
                  >
                    {managerAvatars?.[selectedManager] ? (
                      <img
                        src={managerAvatars[selectedManager] || ""}
                        alt={selectedManager}
                        className="manager-command-avatar"
                      />
                    ) : (
                      <span className="manager-command-avatar">
                        {selectedManager[0]?.toUpperCase() || "?"}
                      </span>
                    )}
                  </ChampionAvatarFrame>
                  <div className="min-w-0">
                    <p>
                      {section === "taxi"
                        ? "Taxi Squad Triage"
                        : "Projected Season Roster"}
                    </p>
                    <h3 className={getManagerHeadingClassName(selectedManager)}>
                      {selectedManager}
                    </h3>
                    <ManagerChampionshipPills
                      managerName={selectedManager}
                      className="manager-command-championships"
                    />
                  </div>
                </div>
                <div
                  className={`manager-command-hero-metrics ${section === "taxi" ? "manager-command-hero-metrics-taxi" : "manager-command-hero-metrics-season"}`}
                >
                  {section === "taxi" ? (
                    <>
                      <IntelligenceMetric
                        label="Taxi"
                        value={selectedTaxiCount || "-"}
                      />
                      <IntelligenceMetric
                        label="Promote"
                        value={selectedTaxiPromoteCount || 0}
                        tone={selectedTaxiPromoteCount ? "positive" : "neutral"}
                      />
                      <IntelligenceMetric
                        label="Stash"
                        value={selectedTaxiParkedCount || 0}
                      />
                      <IntelligenceMetric
                        label="Cuts"
                        value={selectedTaxiCutCount || 0}
                        tone={selectedTaxiCutCount ? "negative" : "neutral"}
                      />
                    </>
                  ) : (
                    <>
                      <IntelligenceMetric
                        label="Season Value"
                        value={
                          selectedStarterSeasonValue
                            ? formatCompactValue(selectedStarterSeasonValue)
                            : "-"
                        }
                      />
                      <IntelligenceMetric
                        label="Health"
                        value={selectedIntel?.rosterHealthScore ?? "-"}
                      />
                    </>
                  )}
                </div>
              </div>
              <div className="manager-command-body">
                {section === "taxi" ? (
                  selectedIntel?.taxiTriage?.items.length ? (
                    <div className="manager-command-section manager-command-taxi">
                      <p className="manager-command-taxi-note manager-command-taxi-note-primary">
                        Activation calls use current-season values and ranks
                        against active starters and injury fill-ins.
                      </p>
                      <div
                        className="manager-command-tile-grid balanced-tile-grid balanced-centered-tile-grid"
                        style={getBalancedGridStyle(
                          Math.max(selectedTaxiItems.length, 4),
                          4
                        )}
                      >
                        {selectedTaxiItems.map(player => (
                          <CommandPlayerTile
                            key={player.player_id}
                            label={getTaxiDisplayAction(player.taxiAction)}
                            note={player.taxiReason}
                            player={player}
                            showValueStack
                            onClick={() => openCommandPlayer(player)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="manager-command-section manager-command-taxi">
                      <h4>Taxi Squad Triage</h4>
                      <p className="manager-command-taxi-summary">
                        No taxi players reported by Sleeper for this roster.
                      </p>
                    </div>
                  )
                ) : (
                  <>
                    <StartingRosterRankTiles
                      manager={selectedManager}
                      managerPositionCounts={data.managerPositionCounts}
                    />
                    {hasStartingRosterStrength ? (
                      <div className="manager-command-section">
                        <h4 className="owner-intel-comparison-heading">
                          <span>{STARTING_ROSTER_STRENGTH_TITLE}</span>
                          <small>{STARTING_ROSTER_STRENGTH_COMPARISON}</small>
                        </h4>
                        <p className="owner-intel-section-note">
                          {STARTING_ROSTER_STRENGTH_NOTE}
                        </p>
                        <div className="owner-intel-heat-grid">
                          {startingRosterStrengthTiles.length
                            ? startingRosterStrengthTiles.map(tile => (
                                <span
                                  key={tile.key}
                                  className={getHeatPillClass(
                                    tile.key,
                                    tile.grade
                                  )}
                                  title={tile.note}
                                >
                                  <strong>{tile.label}</strong>
                                  <em>
                                    {tile.leagueRank
                                      ? `#${tile.leagueRank}`
                                      : "-"}
                                  </em>
                                  <small>{tile.grade || "Empty"}</small>
                                </span>
                              ))
                            : (["QB", "RB", "WR", "TE"] as const).map(pos => {
                                const grade =
                                  selectedIntel?.positionGrades?.[pos];
                                return (
                                  <span
                                    key={pos}
                                    className={getHeatPillClass(
                                      pos,
                                      grade?.grade
                                    )}
                                  >
                                    <strong>{pos}</strong>
                                    <em>
                                      {grade?.rank ? `#${grade.rank}` : "-"}
                                    </em>
                                    <small>{grade?.grade || "Empty"}</small>
                                  </span>
                                );
                              })}
                        </div>
                      </div>
                    ) : null}
                    {selectedSeasonTags.length ? (
                      <div
                        className="manager-command-tag-row"
                        aria-label="Season roster tags"
                      >
                        {selectedSeasonTags.map(tag => (
                          <span
                            key={tag.label}
                            className={`manager-intel-pill report-pill-shell report-inline-pill command-mini-badge-${tag.tone}`}
                          >
                            {tag.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="manager-command-grid">
                      <div className="manager-command-lineup-panel">
                        <h4>Projected Starters</h4>
                        <div className="manager-command-tile-lineup">
                          {lineupGroups.map(group => (
                            <div
                              key={group.label}
                              className="manager-command-tile-group"
                            >
                              <span>{group.label}</span>
                              <div
                                className="manager-command-tile-grid balanced-tile-grid"
                                style={getBalancedGridStyle(
                                  Math.max(group.players.length, 1)
                                )}
                              >
                                {group.players.length ? (
                                  group.players.map(player => (
                                    <CommandPlayerTile
                                      key={player.player_id}
                                      player={player}
                                      swapSignal={
                                        swapByStarterId.has(player.player_id)
                                          ? {
                                              role: "out",
                                              label: "Review",
                                              confidencePct:
                                                swapByStarterId.get(
                                                  player.player_id
                                                )?.options[0]?.confidencePct ||
                                                0,
                                              detail: "Swap watch",
                                            }
                                          : undefined
                                      }
                                      onClick={() => openCommandPlayer(player)}
                                    />
                                  ))
                                ) : (
                                  <span className="manager-command-empty-tile">
                                    Needs Help
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="manager-command-lineup-panel manager-command-lineup-panel-step">
                        <h4>Can Step In</h4>
                        <div className="manager-command-tile-lineup manager-command-step-in">
                          {canStepInGroups.length ? (
                            canStepInGroups.map(group => (
                              <div
                                key={group.label}
                                className="manager-command-tile-group"
                              >
                                <span>{group.label}</span>
                                <div
                                  className="manager-command-tile-grid balanced-tile-grid"
                                  style={getBalancedGridStyle(
                                    group.players.length
                                  )}
                                >
                                  {group.players.map(player => (
                                    <CommandPlayerTile
                                      key={player.player_id}
                                      player={player}
                                      variant="step"
                                      swapSignal={
                                        swapOptionByPlayerId.has(
                                          player.player_id
                                        )
                                          ? {
                                              role: "in",
                                              label: `Best Fit ${
                                                swapOptionByPlayerId.get(
                                                  player.player_id
                                                )?.fitLabel || group.label
                                              }`,
                                              confidencePct:
                                                swapOptionByPlayerId.get(
                                                  player.player_id
                                                )?.confidencePct || 0,
                                              detail: `Best Fit ${
                                                swapOptionByPlayerId.get(
                                                  player.player_id
                                                )?.fitLabel || group.label
                                              }`,
                                            }
                                          : undefined
                                      }
                                      onClick={() => openCommandPlayer(player)}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <span className="manager-command-empty-tile">
                              No starter-grade depth
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {lineupSwapRecommendations.length ? (
                      <div className="manager-command-section manager-command-swap-read">
                        <h4>Start/Sit Swap Signals</h4>
                        <div className="manager-command-swap-grid">
                          {lineupSwapRecommendations.map(recommendation => {
                            const topOption = recommendation.options[0];
                            return (
                              <div
                                key={recommendation.starterOut.player_id}
                                className={`manager-command-swap-card manager-command-swap-card-${recommendation.severity}`}
                              >
                                <div className="manager-command-swap-card-head">
                                  <span>
                                    {getLineupSwapSeverityLabel(
                                      recommendation.severity
                                    )}
                                  </span>
                                  <strong>{recommendation.groupLabel}</strong>
                                </div>
                                <p>{recommendation.summary}</p>
                                <div className="manager-command-swap-flow">
                                  <span className="manager-command-swap-out-name">
                                    <em>Replace</em>
                                    <span className="manager-command-swap-player">
                                      <PlayerNameWithHeadshot
                                        playerId={
                                          recommendation.starterOut.player_id
                                        }
                                        playerName={
                                          recommendation.starterOut.name
                                        }
                                        team={
                                          recommendation.starterOut
                                            .playerDetails?.team
                                        }
                                        position={recommendation.starterOut.pos}
                                      />
                                    </span>
                                  </span>
                                  <ArrowRight
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  <div className="manager-command-swap-options">
                                    {recommendation.options.map(option => (
                                      <span
                                        key={option.player.player_id}
                                        title={option.reason}
                                      >
                                        <span className="manager-command-swap-player">
                                          <PlayerNameWithHeadshot
                                            playerId={option.player.player_id}
                                            playerName={option.player.name}
                                            team={option.player.playerDetails?.team}
                                            position={option.player.pos}
                                          />
                                        </span>
                                        <em>
                                          {option.confidencePct}%
                                          {formatProjectedPointEdge(
                                            option.projectedPointEdge
                                          )
                                            ? ` • ${formatProjectedPointEdge(option.projectedPointEdge)}`
                                            : ""}
                                        </em>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                {topOption?.reasonBullets.length ? (
                                  <details className="manager-command-swap-details">
                                    <summary>Why this swap</summary>
                                    <ul>
                                      {topOption.reasonBullets.map(reason => (
                                        <li key={reason}>{reason}</li>
                                      ))}
                                    </ul>
                                  </details>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {selectedIntel?.pressurePoints?.length ? (
                      <div className="manager-command-section manager-command-pressure-points">
                        <h4>Pressure Points</h4>
                        <ul>
                          {selectedIntel.pressurePoints.map(point => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        managerAvatars={managerAvatars}
        playerDetailsById={data.playerDetailsById}
      />
    </>
  );
}

export function OwnerIntelMatrix({
  data,
  managerAvatars,
  leagueId,
  leagueLogo,
  viewerManager,
  currentStandings: _currentStandings,
  leagueValueMode: leagueValueModeInput = "dynasty",
  ownerIntelSortMode = "dynasty",
}: {
  data: ReportData;
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
  viewerManager?: string | null;
  currentStandings?: ReportData["currentStandings"];
  leagueValueMode?: ReportData["leagueValueMode"];
  ownerIntelSortMode?: OwnerIntelSortMode;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const intelRows = data.managerRosterIntelligence || [];
  const leagueValueMode = normalizeLeagueValueMode(
    leagueValueModeInput ||
      data.leagueDiagnostics?.valueMode ||
      data.leagueValueMode
  );
  const isRedraft = leagueValueMode === "redraft";
  const visibleIntelRows = isRedraft
    ? intelRows.filter(row => !isPlaceholderManagerName(row.manager))
    : intelRows;
  if (!visibleIntelRows.length) return null;

  const pickRows = data.pickPortfolios || [];
  const growthRows = data.managerRosterValueGrowth || [];
  const powerRows = data.powerRankings || [];
  const maxGrowthValue = Math.max(
    0,
    ...growthRows.map(row => row.total_val || 0)
  );
  const getTradeRow = (manager: string) =>
    data.tradeTendencies?.find(row => row.manager === manager);
  const getPickRow = (manager: string) =>
    pickRows.find(row => row.manager === manager);
  const getOverviewRow = (manager: string) =>
    data.leagueOverview.find(row => row.manager === manager);
  const getGrowthRow = (manager: string) =>
    growthRows.find(row => row.manager === manager);
  const getPowerRow = (manager: string) =>
    powerRows.find(row => row.manager === manager);
  const getTimelineRow = (manager: string) =>
    data.dynastyTimelines?.find(row => row.manager === manager);
  const getScoreLensForRow = (row: OwnerIntelRow) =>
    buildOwnerScoreLens({
      row,
      timelineRow: getTimelineRow(row.manager),
      powerRow: getPowerRow(row.manager),
      overviewRow: getOverviewRow(row.manager),
      growthRow: getGrowthRow(row.manager),
      maxGrowthValue,
      leagueSize: visibleIntelRows.length,
      sortMode: ownerIntelSortMode,
    });
  const getSortScoreForRow = (row: OwnerIntelRow) => {
    const scoreLens = getScoreLensForRow(row);
    if (ownerIntelSortMode === "contender")
      return scoreLens.contenderScore ?? -1;
    if (ownerIntelSortMode === "rebuilder")
      return scoreLens.rebuilderScore ?? -1;
    return scoreLens.dynastyScore ?? -1;
  };
  const orderedIntelRows = [...visibleIntelRows].sort((a, b) => {
    const scoreDiff = getSortScoreForRow(b) - getSortScoreForRow(a);
    if (scoreDiff !== 0) return scoreDiff;
    const aRank =
      getOverviewRow(a.manager)?.rank_value ?? Number.MAX_SAFE_INTEGER;
    const bRank =
      getOverviewRow(b.manager)?.rank_value ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    if (
      viewerManager &&
      a.manager === viewerManager &&
      b.manager !== viewerManager
    )
      return -1;
    if (
      viewerManager &&
      b.manager === viewerManager &&
      a.manager !== viewerManager
    )
      return 1;
    return a.manager.localeCompare(b.manager);
  });
  const selectedRow = selectedOwner
    ? orderedIntelRows.find(row => row.manager === selectedOwner)
    : null;
  const selectedTradeRow = selectedRow
    ? getTradeRow(selectedRow.manager)
    : null;
  const selectedPickRow = selectedRow ? getPickRow(selectedRow.manager) : null;
  const selectedOverviewRow = selectedRow
    ? getOverviewRow(selectedRow.manager)
    : null;
  const selectedGrowthRow = selectedRow
    ? getGrowthRow(selectedRow.manager)
    : null;
  const selectedPowerRow = selectedRow
    ? getPowerRow(selectedRow.manager)
    : null;
  const selectedScoreLens = selectedRow
    ? getScoreLensForRow(selectedRow)
    : null;
  const selectedTeamType =
    selectedRow && isRedraft
      ? buildRedraftOwnerProfileLabel(
          selectedRow,
          selectedPowerRow,
          selectedOverviewRow,
          orderedIntelRows.length
        )
      : selectedScoreLens?.buildLabel || null;
  const selectedOwnerTags = selectedRow
    ? isRedraft
      ? buildRedraftOwnerTags({
          row: selectedRow,
          overviewRow: selectedOverviewRow,
        })
      : buildDynastyOwnerTags({
          row: selectedRow,
          overviewRow: selectedOverviewRow,
          growthRow: selectedGrowthRow,
          pickRow: selectedPickRow,
          allGrowthRows: growthRows,
          allPickRows: pickRows,
          leagueSize: orderedIntelRows.length,
        })
    : [];
  const selectedPlayerSectionsBase: Array<{
    label: string;
    player: ManagerIntelPlayer | null;
    tone?: "neutral" | "warn" | "danger";
    crownedRank?: string | null;
  }> = selectedRow
    ? isRedraft
      ? [
          {
            label: "Starter Anchor",
            player:
              selectedRow.untouchablePlayers?.[0] || selectedRow.lastSeasonStud,
          },
          { label: "Starter Upgrade", player: selectedRow.buyTarget },
          {
            label: "Bench Leverage",
            player: selectedRow.tradeChip || selectedRow.bestBenchStash,
          },
          {
            label: "Position Gap",
            player: selectedRow.weakestStarter,
            tone: "warn",
          },
          {
            label: "Waiver Cut",
            player: selectedRow.droppablePlayers?.[0] || null,
            tone: "danger",
          },
          { label: "Injury Cover", player: selectedRow.injuryInsurance },
          { label: "Opportunity Play", player: selectedRow.breakoutCandidate },
        ]
      : [
          {
            label: "Untouchable",
            player:
              selectedRow.untouchablePlayers?.[0] ||
              selectedRow.youngCorePlayer,
          },
          { label: "Buy Idea", player: selectedRow.buyTarget },
          {
            label: "Sell Idea",
            player: selectedRow.sellCandidate,
            tone: "warn",
          },
          { label: "Trade Chip", player: selectedRow.tradeChip },
          {
            label: "Droppable",
            player: selectedRow.droppablePlayers?.[0] || null,
            tone: "danger",
          },
          { label: "Bench Stash", player: selectedRow.bestBenchStash },
          { label: "Young Core", player: selectedRow.youngCorePlayer },
          { label: "Upside Play", player: selectedRow.breakoutCandidate },
          { label: "Age Risk", player: selectedRow.oldestPlayer, tone: "warn" },
        ]
    : [];
  const selectedPlayerSections = selectedPlayerSectionsBase.filter(
    (item, index, rows) => {
      if (!item.player) return false;
      return (
        rows.findIndex(
          candidate => candidate.player?.player_id === item.player?.player_id
        ) === index
      );
    }
  );
  const selectedRosterRead = selectedRow
    ? isRedraft
      ? buildRedraftRosterRead(selectedRow, selectedOverviewRow)
      : buildDynastyRosterRead(
          selectedRow,
          selectedOverviewRow,
          selectedScoreLens?.buildLabel
        )
    : "";
  const selectedBestMove = selectedRow
    ? isRedraft
      ? buildRedraftBestMove(selectedRow)
      : buildDynastyBestMove(
          selectedRow,
          selectedPickRow,
          selectedScoreLens?.buildLabel,
          selectedOverviewRow,
          orderedIntelRows.length
        )
    : "";
  const selectedTradeDraftProfile = selectedRow
    ? isRedraft
      ? `Current-season context: prioritize starter strength (${formatCompactValue(selectedRow.starterSeasonValue || selectedRow.starterValue)}), bench depth (${formatCompactValue(selectedRow.benchValue)}), and position gaps over long-term asset leverage.`
      : buildOwnerTradeDraftProfile(selectedTradeRow, selectedPickRow)
    : "";
  const selectedRosterTraceItems = selectedRow
    ? [
        `${selectedRow.manager} profile: ${selectedRow.identity || 'returned owner identity'} / ${selectedRow.timeline || 'unknown timeline'}.`,
        selectedOverviewRow ? `League value rank #${selectedOverviewRow.rank_value}; QB/RB/WR/TE ranks stay in the position tiles.` : 'No league overview rank row returned.',
        `Starter value ${formatCompactValue(selectedRow.starterSeasonValue || selectedRow.starterValue)} and bench value ${formatCompactValue(selectedRow.benchValue)} drive the roster read.`,
        `${selectedRow.starterAvailability?.riskLevel || 'unknown'} starter availability risk from returned roster data.`,
      ]
    : [];
  const selectedMoveTraceItems = selectedRow
    ? [
        selectedRow.tradePlan?.needPosition ? `Need signal: ${selectedRow.tradePlan.needPosition}.` : 'No clean need position returned.',
        selectedRow.tradePlan?.surplusPosition ? `Surplus signal: ${selectedRow.tradePlan.surplusPosition}.` : 'No clean surplus position returned.',
        selectedRow.buyTarget ? `Buy target evidence: ${selectedRow.buyTarget.name}.` : 'No buy target returned.',
        selectedRow.sellCandidate ? `Sell/watch evidence: ${selectedRow.sellCandidate.name}.` : 'No sell/watch candidate returned.',
      ]
    : [];
  const selectedMarketTraceItems = selectedRow
    ? [
        selectedTradeRow ? `Manager trade tendency: ${selectedTradeRow.tradeCount} trades, ${formatCompactValue(selectedTradeRow.profit)} profit.` : 'No manager trade tendency row returned.',
        selectedPickRow ? `Pick portfolio: ${selectedPickRow.count2026 + selectedPickRow.count2027} future picks worth ${formatCompactValue(selectedPickRow.totalValue)}.` : 'No pick portfolio row returned.',
        selectedPowerRow ? `Power context: #${selectedPowerRow.rank} with ${selectedPowerRow.score} score.` : 'No power ranking row returned.',
        selectedGrowthRow ? `Value growth context: ${formatCompactValue(selectedGrowthRow.growth)} movement.` : 'No value-growth row returned.',
      ]
    : [];
  const selectedAiSuggestions =
    selectedRow && !isRedraft
      ? buildDynastyAiSuggestions({
          row: selectedRow,
          pickRow: selectedPickRow,
          overviewRow: selectedOverviewRow,
          buildLabel: selectedScoreLens?.buildLabel,
          leagueSize: orderedIntelRows.length,
          seededTradeCopies: [selectedBestMove],
          suppress: [
            selectedRosterRead,
            selectedBestMove,
            selectedTradeDraftProfile,
          ],
        })
      : [];
  const selectedActionNotes = selectedRow
    ? isRedraft
      ? buildRedraftActionNotes(selectedRow)
      : filterByPlayerNameMentionBudget(
          dedupeIntelNotes(
            buildDynastyActionNotes(selectedRow, selectedPickRow),
            [
              selectedRosterRead,
              selectedBestMove,
              selectedTradeDraftProfile,
              ...selectedAiSuggestions.map(card => card.copy),
            ]
          ),
          note => note,
          getDynastyTradeTrackedNames(selectedRow),
          [selectedBestMove, ...selectedAiSuggestions.map(card => card.copy)]
        ).slice(0, 4)
    : [];
  const selectedActionNoteCards = selectedActionNotes
    .slice(0, 3)
    .map((note, index) => {
      const splitIndex = note.indexOf(":");
      const title =
        splitIndex > 0
          ? note.slice(0, splitIndex).trim()
          : ["Target watchlist", "Upside hold", "Roster churn"][index] ||
            "AI note";
      const copy = splitIndex > 0 ? note.slice(splitIndex + 1).trim() : note;
      const Icon = [Target, ShieldCheck, Star][index % 3];

      return {
        note,
        title,
        copy,
        Icon,
        tone: index === 0 ? "target" : index === 1 ? "hold" : "churn",
      };
    });
  const selectedActionRailCards = selectedActionNoteCards.length || !selectedRow
    ? selectedActionNoteCards
    : [
        {
          note: `${selectedRow.manager}-roster-signal`,
          title: "Roster signal",
          copy: selectedTeamType || selectedRow.identity || "Owner profile needs more league evidence.",
          Icon: ShieldCheck,
          tone: "hold",
        },
        {
          note: `${selectedRow.manager}-move-signal`,
          title: "Move signal",
          copy: selectedRow.tradePlan?.needPosition
            ? `Prioritize the ${selectedRow.tradePlan.needPosition} lane before adding luxury depth.`
            : "No single position need is clean enough to force a move.",
          Icon: Target,
          tone: "target",
        },
        {
          note: `${selectedRow.manager}-market-signal`,
          title: "Market signal",
          copy: selectedTradeDraftProfile || "Trade and pick context is thin for this owner.",
          Icon: Star,
          tone: "churn",
        },
      ];

  return (
    <>
      <div
        className="command-depth-grid balanced-tile-grid"
        style={getBalancedGridStyle(orderedIntelRows.length)}
      >
        {orderedIntelRows.map(row => {
          const pickRow = getPickRow(row.manager);
          const overviewRow = getOverviewRow(row.manager);
          const growthRow = getGrowthRow(row.manager);
          const powerRow = getPowerRow(row.manager);
          const scoreLens = getScoreLensForRow(row);
          return (
            <ManagerDepthTile
              key={row.manager}
              manager={row.manager}
              avatarUrl={managerAvatars?.[row.manager]}
              className={viewerOwnedHighlightClass(row.manager, viewerManager)}
              subtitle={
                isRedraft
                  ? buildRedraftOwnerProfileLabel(
                      row,
                      powerRow,
                      overviewRow,
                      orderedIntelRows.length
                    )
                  : scoreLens.buildLabel
              }
              subtitleTone={
                isRedraft
                  ? getOwnerTeamTypeTone(
                      buildRedraftOwnerProfileLabel(
                        row,
                        powerRow,
                        overviewRow,
                        orderedIntelRows.length
                      )
                    )
                  : scoreLens.buildTone
              }
              scoreStrip={
                <OwnerScoreStrip
                  scores={scoreLens}
                  compact
                  leagueValueMode={leagueValueMode}
                />
              }
              badges={
                isRedraft
                  ? buildRedraftOwnerTags({ row, overviewRow })
                  : buildDynastyOwnerTags({
                      row,
                      overviewRow,
                      growthRow,
                      pickRow,
                      allGrowthRows: growthRows,
                      allPickRows: pickRows,
                      leagueSize: orderedIntelRows.length,
                    })
              }
              onClick={() => setSelectedOwner(row.manager)}
            />
          );
        })}
      </div>

      <Dialog
        open={selectedRow !== null}
        onOpenChange={open => !open && setSelectedOwner(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="manager-command-dialog owner-intel-dialog max-w-5xl border-cyan-300/20 bg-slate-950 p-0 text-slate-100"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {selectedRow?.manager || "Owner"} Intel Lab
            </DialogTitle>
            <DialogDescription>
              Owner intelligence, trade ideas, player flags, and roster notes.
            </DialogDescription>
          </DialogHeader>
          {selectedRow && (
            <div className="manager-command-modal-inner">
              <div className="manager-command-hero">
                {managerAvatars?.[selectedRow.manager] && (
                  <>
                    <img
                      src={managerAvatars[selectedRow.manager] || ""}
                      alt=""
                      className="manager-hero-wash"
                    />
                    <img
                      src={managerAvatars[selectedRow.manager] || ""}
                      alt=""
                      className="manager-hero-watermark"
                    />
                  </>
                )}
                <div className="manager-hero-scrim" />
                <button
                  type="button"
                  className="manager-modal-close"
                  onClick={() => setSelectedOwner(null)}
                  aria-label={`Close ${selectedRow.manager} details`}
                >
                  <XIcon aria-hidden="true" />
                </button>
                <div className="manager-command-title-lockup">
                  <ChampionAvatarFrame
                    managerName={selectedRow.manager}
                    className="manager-command-champion-frame"
                  >
                    {managerAvatars?.[selectedRow.manager] ? (
                      <img
                        src={managerAvatars[selectedRow.manager] || ""}
                        alt={selectedRow.manager}
                        className="manager-command-avatar"
                      />
                    ) : (
                      <span className="manager-command-avatar">
                        {selectedRow.manager[0]?.toUpperCase() || "?"}
                      </span>
                    )}
                  </ChampionAvatarFrame>
                  <div className="min-w-0">
                    <p>{isRedraft ? "Owner Reads" : "Owner Intel Lab"}</p>
                    <h3
                      className={getManagerHeadingClassName(
                        selectedRow.manager
                      )}
                    >
                      {selectedRow.manager}
                    </h3>
                    {selectedTeamType && (
                      <span
                        className={`manager-command-team-type manager-command-team-type-${selectedScoreLens?.buildTone || getOwnerTeamTypeTone(selectedTeamType)}`}
                      >
                        {selectedTeamType}
                      </span>
                    )}
                    <ManagerChampionshipPills
                      managerName={selectedRow.manager}
                      className="manager-command-championships"
                    />
                  </div>
                </div>
                <div className="manager-command-hero-metrics owner-intel-hero-metrics">
                  <IntelligenceMetric
                    label={isRedraft ? "Current" : "Dynasty"}
                    value={formatOwnerScore(selectedScoreLens?.dynastyScore)}
                  />
                  <IntelligenceMetric
                    label={isRedraft ? "Starters" : "Contender"}
                    value={formatOwnerScore(selectedScoreLens?.contenderScore)}
                    tone={
                      isOwnerContenderLane(selectedScoreLens?.buildLabel)
                        ? "positive"
                        : "neutral"
                    }
                  />
                  <IntelligenceMetric
                    label={isRedraft ? "Bench" : "Rebuilder"}
                    value={formatOwnerScore(selectedScoreLens?.rebuilderScore)}
                    tone={
                      isOwnerRebuildLane(selectedScoreLens?.buildLabel)
                        ? "positive"
                        : "neutral"
                    }
                  />
                </div>
              </div>

              <div className="manager-command-body">
                <div className="owner-intel-tags">
                  {selectedOwnerTags.map(tag => (
                    <span
                      key={tag.label}
                      className={`manager-intel-pill report-pill-shell report-inline-pill command-mini-badge-${tag.tone}`}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>

                {selectedOverviewRow ? (
                  <FullRosterRankTiles overviewRow={selectedOverviewRow} />
                ) : null}

                <div
                  className="owner-intel-player-grid balanced-tile-grid"
                  style={getBalancedGridStyle(
                    selectedPlayerSections.filter(item => item.player).length
                  )}
                >
                  {selectedPlayerSections.map(item =>
                    item.player ? (
                      <PlayerInsightTile
                        key={`${item.label}-${item.player.player_id}`}
                        label={item.label}
                        player={item.player}
                        manager={selectedRow.manager}
                        managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                        playerDetailsById={data.playerDetailsById}
                        onSelect={setSelectedPlayer}
                        tone={item.tone}
                        crownedRank={item.crownedRank}
                        leagueValueMode={leagueValueMode}
                      />
                    ) : null
                  )}
                </div>

                <div
                  className="owner-intel-pcb-system"
                  data-testid="owner-intel-pcb-system"
                >
                  <OwnerIntelPcbRoutes />
                  <div className="owner-intel-read-grid owner-intel-read-grid-pcb">
                    <AIReadPanel
                      title={isRedraft ? "Roster Read" : "Dynasty Roster Read"}
                      body={selectedRosterRead}
                      decision={{
                        label: "Watch",
                        detail:
                          "Roster shape is context for the actual move; do not treat it as a transaction by itself.",
                        tone: "watch",
                        status: "Context read",
                      }}
                      traceLabel="Why this fired"
                      traceItems={selectedRosterTraceItems}
                      backgroundVariant="roster"
                      severity="info"
                      className="owner-intel-read-wide"
                    />

                    <AIReadPanel
                      title={isRedraft ? "Best Move" : "Dynasty Best Move"}
                      body={selectedBestMove}
                      decision={{
                        label: "Do this",
                        detail: selectedBestMove,
                        tone: "go",
                        status: "Primary move",
                      }}
                      traceItems={selectedMoveTraceItems}
                      backgroundVariant="trade"
                      severity="info"
                    />

                    <AIReadPanel
                      title={
                        isRedraft ? "Starter / Bench Context" : "Market / Picks"
                      }
                      body={selectedTradeDraftProfile}
                      decision={{
                        label: "Watch",
                        detail:
                          "Use this as deal context; the Best Move panel owns the action call.",
                        tone: "watch",
                        status: "Context read",
                      }}
                      traceLabel="Why this fired"
                      traceItems={selectedMarketTraceItems}
                      backgroundVariant="market"
                      severity="warn"
                    />

                    {selectedAiSuggestions.map(card => {
                      const titleKey = card.title.toLowerCase();
                      const panelVariant = card.wide
                        ? "monthly"
                        : titleKey.includes("trade")
                          ? "trade"
                          : titleKey.includes("pick") ||
                              titleKey.includes("market") ||
                              titleKey.includes("leverage")
                            ? "market"
                            : titleKey.includes("offer") ||
                                titleKey.includes("filter")
                              ? "waiver"
                              : titleKey.includes("churn")
                                ? "lineup"
                                : titleKey.includes("risk")
                                  ? "draft"
                                  : titleKey.includes("guardrail") ||
                                      titleKey.includes("core")
                                    ? "league"
                                    : "blueprint";

                      const panelSeverity =
                        card.tone === "danger"
                          ? "danger"
                          : card.tone === "warn"
                            ? "warn"
                            : card.tone === "good"
                              ? "good"
                              : "info";
                      const cardDecision =
                        card.tone === "danger"
                          ? {
                              label: "Do not force it",
                              detail: card.copy,
                              tone: "stop" as const,
                              status: "Guardrail",
                            }
                          : card.tone === "warn"
                            ? {
                                label: "Watch",
                                detail: card.copy,
                                tone: "watch" as const,
                                status: "Caution",
                              }
                            : {
                                label: "Do this",
                                detail: card.copy,
                                tone: "go" as const,
                                status: "Action lane",
                              };

                      return (
                        <AIReadPanel
                          key={`${card.title}-${card.copy}`}
                          title={card.title}
                          body={card.copy}
                          decision={cardDecision}
                          traceLabel="Why this fired"
                          traceItems={[
                            `Owner profile: ${selectedRow.identity || 'returned owner identity'}.`,
                            `Timeline: ${selectedRow.timeline || selectedTeamType || 'unknown'}.`,
                            selectedOverviewRow ? `Value rank #${selectedOverviewRow.rank_value}.` : 'No league value rank returned.',
                            `Signal source: ${card.title}.`,
                          ]}
                          backgroundVariant={panelVariant}
                          severity={panelSeverity}
                          className={getAiNeuralSurfaceClass(
                            card.theme || "neutral",
                            `owner-intel-ai-card owner-intel-ai-card-${card.tone} ${card.theme ? `owner-intel-ai-theme-${card.theme}` : ""} ${card.wide ? "owner-intel-read-wide" : ""}`
                          )}
                        />
                      );
                    })}

                    {selectedRow ? (
                      <AIReadPanel
                        title={isRedraft ? "Lineup Notes" : "Dynasty AI Notes"}
                        backgroundVariant="monthly"
                        severity="info"
                        className={getAiNeuralSurfaceClass(
                          "neutral",
                          "owner-intel-wild-notes"
                        )}
                        body={
                          <div className="ai-notes-feature-shell">
                            <svg
                              className="ai-notes-feature-rail"
                              viewBox="0 0 100 24"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path
                                className="ai-notes-feature-route ai-notes-feature-route-cyan ai-notes-feature-route-primary"
                                d="M1 17.5 H13 L17 13.25 H29 L33 10.5 H48 L53 13.25 H67 L72 17.5 H99"
                              />
                              <path
                                className="ai-notes-feature-route ai-notes-feature-route-cyan ai-notes-feature-route-secondary"
                                d="M2 5.5 H18 L22 8.25 H39 L43 6 H58 L62 8.75 H79 L83 5.75 H98"
                              />
                              <path
                                className="ai-notes-feature-route ai-notes-feature-route-amber ai-notes-feature-route-tertiary"
                                d="M5 20.5 H21 V18.25 H35 L39 15.5 H61 L65 18.25 H78 V20.5 H96"
                              />
                              <path
                                className="ai-notes-feature-route ai-notes-feature-route-amber ai-notes-feature-route-corner"
                                d="M9 2.75 H24 V5.25 H35 M65 5.25 H76 V2.75 H91"
                              />
                              <circle
                                className="ai-notes-feature-node ai-notes-feature-node-cyan"
                                cx="17"
                                cy="13.25"
                                r="0.7"
                              />
                              <circle
                                className="ai-notes-feature-node ai-notes-feature-node-cyan"
                                cx="33"
                                cy="10.5"
                                r="0.65"
                              />
                              <circle
                                className="ai-notes-feature-node ai-notes-feature-node-cyan"
                                cx="53"
                                cy="13.25"
                                r="0.72"
                              />
                              <circle
                                className="ai-notes-feature-node ai-notes-feature-node-cyan"
                                cx="72"
                                cy="17.5"
                                r="0.65"
                              />
                              <circle
                                className="ai-notes-feature-node ai-notes-feature-node-amber"
                                cx="39"
                                cy="15.5"
                                r="0.62"
                              />
                              <circle
                                className="ai-notes-feature-node ai-notes-feature-node-amber"
                                cx="65"
                                cy="18.25"
                                r="0.68"
                              />
                              <circle
                                className="ai-notes-feature-node ai-notes-feature-node-amber"
                                cx="83"
                                cy="5.75"
                                r="0.6"
                              />
                            </svg>

                            <div className="ai-notes-module-grid">
                              {selectedActionRailCards.map(card => {
                                const NoteIcon = card.Icon;

                                return (
                                  <section
                                    key={card.note}
                                    className={`ai-notes-module ai-notes-module-${card.tone}`}
                                  >
                                    <span
                                      className="ai-notes-module-icon"
                                      aria-hidden="true"
                                    >
                                      <NoteIcon />
                                    </span>
                                    <p>
                                      <strong>{card.title}:</strong> {card.copy}
                                    </p>
                                  </section>
                                );
                              })}
                            </div>
                          </div>
                        }
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        managerAvatars={managerAvatars}
        playerDetailsById={data.playerDetailsById}
      />
    </>
  );
}
