import { trpc } from "@/lib/trpc";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import { AdminAttentionBadge } from "@/features/report/components/AdminDiagnosticsPrimitives";
import type { RankingSourceDiagnostic, ReportData } from "@shared/types";

type AdminValueDiagnosticRow = {
  id: string;
  area: string;
  item: string;
  status: string;
  note: string;
  tone?: "good" | "warn" | "danger" | "info";
};

type AdminBlendSummary = {
  id: string;
  title: string;
  profileLabel: string;
  note: string;
  sources: Array<{
    key: string;
    source: string;
    percent: number;
    note?: string;
  }>;
};

type OutlookPlayer = ReportData["projectedRisers"][number];

const ADMIN_VALUE_DIAGNOSTIC_START_DATE = "2026-05-07";

function getValueCoverageStatus(
  note: string
): Pick<AdminValueDiagnosticRow, "status" | "tone"> {
  if (/benchmark/i.test(note)) {
    return { status: "Benchmark stored", tone: "info" };
  }
  if (/exact custom|closest|bucket/i.test(note)) {
    return { status: "Bucketed", tone: "info" };
  }
  if (/support is wired|no .*present/i.test(note)) {
    return { status: "Awaiting data", tone: "warn" };
  }
  return { status: "Tracked", tone: "good" };
}

function isActionableDiagnosticTone(
  tone?: AdminValueDiagnosticRow["tone"]
): boolean {
  return tone === "warn" || tone === "danger";
}

function formatAdminTelemetryDate(value?: string | null): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getValueCoverageItem(note: string, index: number): string {
  if (/Selected value profile/i.test(note)) return "Selected profile";
  if (/Daily snapshots/i.test(note)) return "Daily storage";
  if (/Flock Fantasy|Dynasty Nerds|Redraft/i.test(note))
    return "Source weighting";
  if (/TE premium|TEP/i.test(note)) return "TE premium bucket";
  if (/Standard|Half|PPR/i.test(note)) return "PPR bucket";
  if (/coverage/i.test(note)) return "Source coverage";
  if (/benchmark/i.test(note)) return "Benchmark source";
  return `Coverage note ${index + 1}`;
}

function getOutlookPlayerValueProfile(
  reportData: ReportData,
  player: OutlookPlayer
) {
  return (
    player.playerDetails?.valueProfile ||
    (player.player_id
      ? reportData.playerDetailsById?.[player.player_id]?.valueProfile
      : undefined)
  );
}

function addUniqueDiagnosticRow(
  rows: AdminValueDiagnosticRow[],
  seen: Set<string>,
  row: AdminValueDiagnosticRow
) {
  if (seen.has(row.id)) return;
  seen.add(row.id);
  rows.push(row);
}

function formatSignedDiagnosticDelta(value?: number | null): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric === 0) return "0";
  return `${numeric > 0 ? "+" : ""}${numeric}`;
}

function formatLeagueAiConfidenceTrend(reportData: ReportData): string | null {
  const trend = reportData.leagueDiagnostics?.aiConfidence?.history || [];
  if (trend.length < 2) return null;
  return trend
    .slice(-6)
    .map(point => `${point.snapshotKey}: ${point.score}%`)
    .join(" -> ");
}

function isPriorityAdminDiagnosticRow(row: AdminValueDiagnosticRow): boolean {
  if (row.tone === "danger") return true;
  if (row.tone !== "warn") return false;
  if (isHandledSourceTrustDiagnosticRow(row)) return false;
  return /player value|player values|ranking identities|player alias|redraft source|dynasty source|devy source|value blend|value input/i.test(
    row.area
  );
}

function isSourceTrustDiagnosticRow(row: AdminValueDiagnosticRow): boolean {
  return /(redraft|dynasty|devy) source/i.test(row.area);
}

function isSourceErrorOrStale(row: AdminValueDiagnosticRow): boolean {
  return /source error|source issue|stale data/i.test(row.status);
}

function isInformationalEmptySourceRow(
  row: AdminValueDiagnosticRow
): boolean {
  if (!isSourceTrustDiagnosticRow(row)) return false;
  if (!/no rows/i.test(row.status)) return false;
  if (isSourceErrorOrStale(row)) return false;

  return /Other available source weights normalize automatically|current status is empty|waiting for more .* consensus overlap/i.test(
    row.note
  );
}

function isHandledSourceTrustDiagnosticRow(
  row: AdminValueDiagnosticRow
): boolean {
  if (!isSourceTrustDiagnosticRow(row)) return false;
  if (isSourceErrorOrStale(row)) return false;
  if (isInformationalEmptySourceRow(row)) return true;

  return /source-excluded consensus|Trust (?:fell|rose|dropped|was unchanged)/i.test(
    row.note
  );
}

function compareAdminDiagnosticPriority(
  a: AdminValueDiagnosticRow,
  b: AdminValueDiagnosticRow
): number {
  const toneScore = (row: AdminValueDiagnosticRow) =>
    row.tone === "danger" ? 0 : row.tone === "warn" ? 1 : 2;
  return (
    toneScore(a) - toneScore(b) ||
    a.area.localeCompare(b.area) ||
    a.item.localeCompare(b.item)
  );
}

function buildAdminValueDiagnostics(
  reportData: ReportData,
  missingDateKeys: string[]
): AdminValueDiagnosticRow[] {
  const rows: AdminValueDiagnosticRow[] = [];
  const seen = new Set<string>();
  const isRedraftValueMode =
    normalizeLeagueValueMode(
      reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
    ) === "redraft";
  const currentSnapshotGaps = missingDateKeys
    .filter(dateKey => dateKey >= ADMIN_VALUE_DIAGNOSTIC_START_DATE)
    .sort();
  const outlookPlayers = [
    ...reportData.projectedRisers,
    ...reportData.projectedFallers,
  ];
  const leagueDiagnostics = reportData.leagueDiagnostics;

  if (leagueDiagnostics) {
    const leagueConfidence = leagueDiagnostics.aiConfidence;
    const leagueConfidenceDelta = formatSignedDiagnosticDelta(
      leagueConfidence?.scoreDelta
    );
    const leagueConfidenceTrend = formatLeagueAiConfidenceTrend(reportData);
    if (leagueConfidence) {
      const confidenceTone: AdminValueDiagnosticRow["tone"] =
        leagueConfidence.score < 52
          ? "warn"
          : leagueConfidence.score >= 72
            ? "good"
            : "info";
      addUniqueDiagnosticRow(rows, seen, {
        id: "league-ai-confidence",
        area: "AI confidence",
        item: `${leagueConfidence.score}% ${leagueConfidence.label}`,
        status:
          leagueConfidence.score < 52
            ? "Low confidence"
            : leagueConfidence.score >= 72
              ? "Strong"
              : "Building",
        tone: confidenceTone,
        note: leagueConfidence.note,
      });
    }
    if (leagueConfidence && (leagueConfidenceDelta || leagueConfidenceTrend)) {
      addUniqueDiagnosticRow(rows, seen, {
        id: "league-ai-confidence-trend",
        area: "AI confidence trend",
        item: leagueConfidenceDelta
          ? `${leagueConfidenceDelta} since previous snapshot`
          : `${leagueConfidence.score}% current`,
        status:
          leagueConfidence.scoreDelta === null ||
          leagueConfidence.scoreDelta === undefined
            ? "Trend building"
            : leagueConfidence.scoreDelta > 0
              ? "Improving"
              : leagueConfidence.scoreDelta < 0
                ? "Declining"
                : "Flat",
        tone:
          leagueConfidence.scoreDelta === null ||
          leagueConfidence.scoreDelta === undefined
            ? "info"
            : leagueConfidence.scoreDelta < -6
              ? "warn"
              : leagueConfidence.scoreDelta > 0
                ? "good"
                : "info",
        note: leagueConfidenceTrend
          ? `Recent confidence snapshots: ${leagueConfidenceTrend}.`
          : "Confidence deltas compare this report against the latest persisted league confidence snapshot.",
      });
    }
    if (
      leagueConfidence?.calibration &&
      leagueConfidence.calibration.status !== "ready"
    ) {
      addUniqueDiagnosticRow(rows, seen, {
        id: "league-ai-confidence-calibration",
        area: "AI confidence calibration",
        item: `${leagueConfidence.calibration.observedSampleSize}/${leagueConfidence.calibration.targetSampleSize} samples`,
        status:
          leagueConfidence.calibration.status === "pending"
            ? "Pending season"
            : "Collecting",
        tone: "info",
        note: leagueConfidence.calibration.note,
      });
    }
    leagueConfidence?.signals
      .filter(signal => signal.status !== "strong")
      .slice(0, 4)
      .forEach(signal => {
        addUniqueDiagnosticRow(rows, seen, {
          id: `league-ai-confidence-signal-${signal.key}`,
          area: "AI confidence signal",
          item: `${signal.label}: ${signal.score}%`,
          status: signal.status === "low" ? "Low evidence" : "Building",
          tone: signal.status === "low" ? "warn" : "info",
          note: signal.note,
        });
      });
    leagueConfidence?.signals
      .filter(
        signal => signal.scoreDelta !== null && signal.scoreDelta !== undefined
      )
      .sort(
        (a, b) =>
          Math.abs(Number(b.scoreDelta || 0)) -
          Math.abs(Number(a.scoreDelta || 0))
      )
      .slice(0, 6)
      .forEach(signal => {
        const delta = Number(signal.scoreDelta || 0);
        addUniqueDiagnosticRow(rows, seen, {
          id: `league-ai-confidence-signal-trend-${signal.key}`,
          area: "AI confidence signal trend",
          item: `${signal.label}: ${delta > 0 ? "+" : ""}${delta} to ${signal.score}%`,
          status: delta > 0 ? "Gaining" : delta < 0 ? "Dropping" : "Flat",
          tone: delta > 0 ? "good" : delta < -6 ? "warn" : "info",
          note:
            signal.previousScore === null || signal.previousScore === undefined
              ? signal.note
              : `Previous ${signal.previousScore}%. ${signal.note}`,
        });
      });
    leagueConfidence?.managerConfidence
      ?.filter(manager => manager.score < 62)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .forEach(manager => {
        addUniqueDiagnosticRow(rows, seen, {
          id: `manager-ai-confidence-${manager.manager}`,
          area: "Manager AI confidence",
          item: `${manager.manager}: ${manager.score}%`,
          status: manager.score < 50 ? "Low evidence" : "Building",
          tone: manager.score < 50 ? "warn" : "info",
          note: manager.note,
        });
      });

    leagueDiagnostics.valueLimitations.forEach((limitation, index) => {
      const coverageStatus = getValueCoverageStatus(limitation);
      if (!isActionableDiagnosticTone(coverageStatus.tone)) return;
      addUniqueDiagnosticRow(rows, seen, {
        id: `value-limitation-${index}`,
        area: "Value coverage",
        item: getValueCoverageItem(limitation, index),
        status: coverageStatus.status,
        tone: coverageStatus.tone,
        note: limitation,
      });
    });
  }

  if (reportData.depthChartDiagnostics) {
    const diagnostic = reportData.depthChartDiagnostics;
    const checked = diagnostic.checkedPlayerCount || 0;
    const matched = diagnostic.matchedPlayerCount || 0;
    const coveragePct = checked ? Math.round((matched / checked) * 100) : 0;
    const failedTeams = diagnostic.failedTeams.map(team => team.toUpperCase());
    const hasTeamGaps = failedTeams.length > 0;
    const tone: AdminValueDiagnosticRow["tone"] =
      hasTeamGaps || (checked > 0 && coveragePct < 60)
        ? "warn"
        : diagnostic.mismatchCount > 0
          ? "info"
          : "good";
    addUniqueDiagnosticRow(rows, seen, {
      id: "depth-chart-role-coverage",
      area: "Depth chart roles",
      item: checked
        ? `${matched}/${checked} players matched`
        : "No team players checked",
      status: hasTeamGaps
        ? "Team gaps"
        : diagnostic.mismatchCount
          ? "Stale tags found"
          : "Loaded",
      tone,
      note: [
        checked
          ? `Current team chart roles matched ${coveragePct}% of checked report players.`
          : "No active NFL team players were available for current role matching.",
        `${diagnostic.mismatchCount} Sleeper role tag${diagnostic.mismatchCount === 1 ? "" : "s"} differed from the current team chart.`,
        `Teams loaded: ${diagnostic.loadedTeams.length}/${diagnostic.requestedTeams.length}.`,
        diagnostic.cacheMode
          ? `Cache mode: ${diagnostic.cacheMode}${diagnostic.snapshotKey ? ` ${diagnostic.snapshotKey}` : ""}.`
          : null,
        diagnostic.lastWarmAt
          ? `Last warm: ${new Date(diagnostic.lastWarmAt).toLocaleString()}.`
          : null,
        typeof diagnostic.staleTeamCount === "number" && diagnostic.staleTeamCount > 0
          ? `${diagnostic.staleTeamCount} stale or missing team chart${diagnostic.staleTeamCount === 1 ? "" : "s"}.`
          : null,
        `Role enrichment took ${Math.round(diagnostic.durationMs || 0)}ms.`,
        failedTeams.length
          ? `Needs retry for: ${failedTeams.join(", ")}.`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  if (reportData.transactionBackfillDiagnostics) {
    const diagnostic = reportData.transactionBackfillDiagnostics;
    addUniqueDiagnosticRow(rows, seen, {
      id: "historical-sleeper-transactions",
      area: "Sleeper history backfill",
      item: `${diagnostic.transactionCount} transactions`,
      status: diagnostic.checkedLeagueCount
        ? `${diagnostic.seasonCount} season${diagnostic.seasonCount === 1 ? "" : "s"}`
        : "No history",
      tone: diagnostic.checkedLeagueCount ? "good" : "info",
      note: [
        `${diagnostic.checkedLeagueCount} previous league${diagnostic.checkedLeagueCount === 1 ? "" : "s"} checked.`,
        `${diagnostic.waiverOrFreeAgentCount} waiver/free-agent moves and ${diagnostic.tradeProposalCount} non-complete trade signals were backfilled for manager behavior reads.`,
        diagnostic.failedLeagueCount
          ? `${diagnostic.failedLeagueCount} historical league link${diagnostic.failedLeagueCount === 1 ? "" : "s"} failed or returned unusable data.`
          : null,
        diagnostic.brokenPreviousLeagueChainCount
          ? `${diagnostic.brokenPreviousLeagueChainCount} previous-league chain issue${diagnostic.brokenPreviousLeagueChainCount === 1 ? "" : "s"} need review.`
          : null,
      ].filter(Boolean).join(" "),
    });
  }

  if (!isRedraftValueMode && reportData.prospectSourceDiagnostics) {
    const diagnostic = reportData.prospectSourceDiagnostics;
    const tone =
      diagnostic.status === "stored"
        ? "good"
        : diagnostic.status === "partial"
          ? "warn"
          : "warn";
    if (isActionableDiagnosticTone(tone)) {
      const errorNote =
        diagnostic.status === "partial" && diagnostic.errors?.length
          ? ` ${diagnostic.errors.length} scrape gap${diagnostic.errors.length === 1 ? "" : "s"} remain. First: ${diagnostic.errors[0]}.`
          : "";
      addUniqueDiagnosticRow(rows, seen, {
        id: "prospect-context-source",
        area: "Prospect context",
        item: `${diagnostic.playerCount} profiles`,
        status:
          diagnostic.status === "partial"
            ? "Stored with gaps"
            : "Snapshot pending",
        tone,
        note: `${diagnostic.note}${errorNote}`,
      });
    }
  }

  if (
    isRedraftValueMode &&
    reportData.rankings?.redraftSourceDiagnostics?.length
  ) {
    reportData.rankings.redraftSourceDiagnostics.forEach(diagnostic => {
      const tone: AdminValueDiagnosticRow["tone"] =
        diagnostic.status === "loaded"
          ? "good"
          : diagnostic.status === "disabled"
            ? "info"
            : diagnostic.status === "empty"
              ? "warn"
              : diagnostic.status === "stale"
                ? "danger"
                : "danger";
      addUniqueDiagnosticRow(rows, seen, {
        id: `redraft-source-${diagnostic.key}`,
        area: "Redraft source",
        item: `${diagnostic.source}: ${diagnostic.rowCount.toLocaleString()} rows`,
        status:
          diagnostic.status === "loaded"
            ? "Loaded"
            : diagnostic.status === "disabled"
              ? "Disabled"
              : diagnostic.status === "empty"
                ? "No rows"
                : diagnostic.status === "stale"
                  ? "Stale data"
                  : "Source error",
        tone:
          diagnostic.trustAlert?.level === "danger"
            ? "danger"
            : diagnostic.trustAlert?.level === "warn"
              ? "warn"
              : tone,
        note: formatSourceTrustDiagnosticNote(diagnostic),
      });
    });
  }

  if (
    !isRedraftValueMode &&
    reportData.rankings?.dynastySourceDiagnostics?.length
  ) {
    reportData.rankings.dynastySourceDiagnostics.forEach(diagnostic => {
      const tone: AdminValueDiagnosticRow["tone"] =
        diagnostic.status === "loaded"
          ? "good"
          : diagnostic.status === "empty"
            ? "warn"
            : diagnostic.status === "disabled"
              ? "info"
              : "danger";
      addUniqueDiagnosticRow(rows, seen, {
        id: `dynasty-source-${diagnostic.key}`,
        area: "Dynasty source",
        item: `${diagnostic.source}: ${diagnostic.rowCount.toLocaleString()} rows`,
        status:
          diagnostic.status === "loaded"
            ? "Loaded"
            : diagnostic.status === "empty"
              ? "No rows"
              : diagnostic.status === "disabled"
                ? "Disabled"
                : diagnostic.status === "stale"
                  ? "Stale data"
                  : "Source error",
        tone:
          diagnostic.trustAlert?.level === "danger"
            ? "danger"
            : diagnostic.trustAlert?.level === "warn"
              ? "warn"
              : tone,
        note: formatSourceTrustDiagnosticNote(diagnostic),
      });
    });
  }

  if (
    !isRedraftValueMode &&
    reportData.rankings?.devySourceDiagnostics?.length
  ) {
    reportData.rankings.devySourceDiagnostics.forEach(diagnostic => {
      const tone: AdminValueDiagnosticRow["tone"] =
        diagnostic.trustAlert?.level === "danger"
          ? "danger"
          : diagnostic.trustAlert?.level === "warn"
            ? "warn"
            : diagnostic.status === "loaded"
              ? "good"
              : diagnostic.status === "empty"
                ? "warn"
                : "danger";
      addUniqueDiagnosticRow(rows, seen, {
        id: `devy-source-${diagnostic.key}`,
        area: "Devy source",
        item: `${diagnostic.source}: ${diagnostic.rowCount.toLocaleString()} rows`,
        status:
          diagnostic.status === "loaded"
            ? "Loaded"
            : diagnostic.status === "empty"
              ? "No rows"
              : "Source issue",
        tone,
        note: formatSourceTrustDiagnosticNote(diagnostic),
      });
    });
  }

  reportData.sourceSnapshotDiagnostics?.slice(0, 12).forEach(diagnostic => {
    const tone: AdminValueDiagnosticRow["tone"] =
      diagnostic.level === "danger"
        ? "danger"
        : diagnostic.level === "warn"
          ? "warn"
          : "info";
    addUniqueDiagnosticRow(rows, seen, {
      id: `source-snapshot-${diagnostic.sourceKey}`,
      area: "Snapshot freshness",
      item: diagnostic.rowCount !== null && diagnostic.rowCount !== undefined
        ? `${diagnostic.source}: ${diagnostic.rowCount.toLocaleString()} rows`
        : diagnostic.source,
      status:
        diagnostic.status === "loaded"
          ? "Fresh"
          : diagnostic.status === "stale"
            ? "Stale"
            : diagnostic.status === "missing"
              ? "Missing"
              : "Source error",
      tone,
      note: [
        diagnostic.note,
        diagnostic.snapshotKey ? `Snapshot key: ${diagnostic.snapshotKey}.` : null,
        diagnostic.updatedAt ? `Updated: ${formatAdminTelemetryDate(diagnostic.updatedAt)}.` : null,
      ].filter(Boolean).join(" "),
    });
  });

  currentSnapshotGaps.forEach(dateKey => {
    addUniqueDiagnosticRow(rows, seen, {
      id: `snapshot-${dateKey}`,
      area: "Value blend",
      item: dateKey,
      status: "Missing day",
      tone: "warn",
      note: `Daily blend was not stored after the ${ADMIN_VALUE_DIAGNOSTIC_START_DATE} blend cutoff, so any comparison touching this date uses the nearest available stored profile.`,
    });
  });

  const playersWithoutSourceMetadata = outlookPlayers.filter(
    player =>
      player.player_id && !getOutlookPlayerValueProfile(reportData, player)
  );
  if (playersWithoutSourceMetadata.length) {
    addUniqueDiagnosticRow(rows, seen, {
      id: "source-metadata-missing",
      area: "Player values",
      item: `${playersWithoutSourceMetadata.length} report players`,
      status: "Source check unavailable",
      tone: "warn",
      note: "The displayed player values exist, but this report payload did not include source-level blend detail.",
    });
  }

  const rankingIdentityDiagnostics =
    reportData.rankings?.identityDiagnostics || [];
  const unmatchedRankingRows = rankingIdentityDiagnostics.filter(
    row => row.status === "unmatched" && row.board !== "devy"
  );

  if (unmatchedRankingRows.length) {
    addUniqueDiagnosticRow(rows, seen, {
      id: "ranking-identity-unmatched",
      area: "Ranking identities",
      item: `${unmatchedRankingRows.length} source row${unmatchedRankingRows.length === 1 ? "" : "s"}`,
      status: "Needs mapping",
      tone: "danger",
      note: `Ranking rows did not match a Sleeper player. First example: ${unmatchedRankingRows[0].playerName}. These rows may show the wrong owner/avatar until mapped.`,
    });
  }

  rankingIdentityDiagnostics
    .filter(row => row.board !== "devy")
    .slice(0, 8)
    .forEach((diagnostic, index) => {
      const isCollision = diagnostic.status === "resolved-collision";
      addUniqueDiagnosticRow(rows, seen, {
        id: `ranking-alias-review-${index}-${diagnostic.id}`,
        area: "Player alias review",
        item: diagnostic.playerName,
        status: isCollision ? "Resolved collision" : "Needs mapping",
        tone: isCollision ? "warn" : "danger",
        note:
          isCollision && diagnostic.selectedPlayerName
            ? `${diagnostic.note} Source key: ${diagnostic.sourceKey}.`
            : `${diagnostic.note} Add or adjust an alias if this source row should map to a Sleeper player.`,
      });
    });

  outlookPlayers.forEach(player => {
    const profile = getOutlookPlayerValueProfile(reportData, player);
    if (!profile) return;

    const sources = profile.sources || [];
    const hasCoreMarketSource = isRedraftValueMode
      ? Boolean(
          profile.fantasyCalcRedraft ||
            profile.fantasyProsSeasonValue ||
            profile.seasonValue
        )
      : Boolean(
          profile.flockFantasy ||
            profile.dynastyNerds ||
            profile.marketKtc ||
            profile.fantasyCalcDynasty ||
            profile.dynastyProcess
        );
    if (hasCoreMarketSource) return;

    addUniqueDiagnosticRow(rows, seen, {
      id: `thin-value-${player.player_id || player.name}`,
      area: "Player value",
      item: player.name,
      status: sources.length ? "Non-primary source" : "No source list",
      tone: "warn",
      note: `${sources.length || 0} source${sources.length === 1 ? "" : "s"} found, but none are one of the primary ${isRedraftValueMode ? "redraft/current-season" : "dynasty"} blend sources. The card can render, but admin should verify the player mapping/value source.`,
    });
  });

  const missingAgePlayers = outlookPlayers.filter(player => player.age == null);
  if (missingAgePlayers.length) {
    addUniqueDiagnosticRow(rows, seen, {
      id: "missing-age-value-input",
      area: "Value input",
      item: `${missingAgePlayers.length} report players`,
      status: "Age missing",
      tone: "warn",
      note: "Age-aware value context falls back to the current value when the age curve cannot be applied.",
    });
  }

  if (!rows.length) {
    rows.push({
      id: "no-active-diagnostics",
      area: "Value assumptions",
      item: "Current report",
      status: "No active flags",
      tone: "good",
      note: "No missing post-cutoff snapshot days or unmapped primary-value players were detected. League-format notes still show what is calculated versus bucketed.",
    });
  }

  return rows.slice(0, 32);
}

function formatSourceTrustDiagnosticNote(
  diagnostic: RankingSourceDiagnostic
): string {
  const trustText = Number.isFinite(diagnostic.trustScore)
    ? `Trust ${diagnostic.trustScore}/100 (${Number(diagnostic.trustMultiplier || 1).toFixed(2)}x effective weight).${diagnostic.trustNote ? ` ${diagnostic.trustNote}.` : ""}`
    : "";
  const trustDelta = Number(diagnostic.trustScoreDelta);
  const movementText = Number.isFinite(trustDelta)
    ? trustDelta > 0
      ? `Trust rose +${trustDelta} points since the previous snapshot.`
      : trustDelta < 0
        ? `Trust fell ${Math.abs(trustDelta)} points since the previous snapshot.`
        : "Trust was unchanged since the previous snapshot."
    : "";
  return [
    diagnostic.note,
    trustText,
    movementText,
    diagnostic.trustAlert?.message || "",
    diagnostic.error ? `Error: ${diagnostic.error}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function getAdminBlendProfileLabel(
  reportData: ReportData,
  profileKey?: string | null
): string {
  if (!profileKey) return "League-matched profile";
  const profileOption = reportData.rankings?.profileOptions?.find(
    option => option.key === profileKey
  );
  return profileOption?.label || "League-matched profile";
}

function formatAdminBlendSources(
  sources: AdminBlendSummary["sources"],
  isRedraft: boolean
): AdminBlendSummary["sources"] {
  if (!isRedraft) return sources;
  const redraftSources = sources.filter(source => {
    const text = `${source.key} ${source.source} ${source.note || ""}`;
    return (
      /(redraft|season|fantasypros|current|myfantasyleague|mfl|espn|fleaflicker|yahoo|nfl fantasy)/i.test(
        text
      ) && !/(dynasty|devy|college|rookie)/i.test(text)
    );
  });

  return redraftSources.length
    ? redraftSources
    : [
        {
          key: "current-season-model",
          source: "Current-season model",
          percent: 100,
          note: "Redraft reports expose the current-season value lens by default.",
        },
      ];
}

function formatScoutingArchiveCopy(value?: string | null): string {
  return String(value || "")
    .replace(/NFL Draft Buzz/g, "archived scouting data")
    .replace(/Draft Buzz/g, "scouting archive");
}

function buildAdminBlendSummaries(reportData: ReportData): AdminBlendSummary[] {
  const rankings = reportData.rankings;
  const sourceWeightProfiles = rankings?.sourceWeightProfiles;
  if (!rankings || !sourceWeightProfiles) return [];

  const summaries: AdminBlendSummary[] = [];
  const leagueValueMode = normalizeLeagueValueMode(
    reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
  );
  const isRedraft = leagueValueMode === "redraft";
  const dynastyProfileKey = isRedraft
    ? rankings.defaultRedraftProfileKey || rankings.defaultProfileKey
    : rankings.defaultProfileKey;
  const devyProfileKey = rankings.defaultDevyProfileKey;

  if (dynastyProfileKey && sourceWeightProfiles[dynastyProfileKey]) {
    summaries.push({
      id: isRedraft
        ? "current-league-redraft-blend"
        : "current-league-dynasty-blend",
      title: isRedraft
        ? "Current League Redraft Blend"
        : "Current League Dynasty Blend",
      profileLabel: isRedraft
        ? "Current-season value blend"
        : getAdminBlendProfileLabel(reportData, dynastyProfileKey),
      note: isRedraft
        ? "Primary current-season blend for rankings, roster values, trades, and redraft owner reads in this league."
        : "Primary dynasty market blend for rankings, roster values, trades, and non-lineup dynasty reads in this league.",
      sources: formatAdminBlendSources(
        sourceWeightProfiles[dynastyProfileKey].sources
          .filter(source => source.percent > 0)
          .map(source => ({
            key: source.key,
            source: formatScoutingArchiveCopy(source.source),
            percent: source.percent,
            note: formatScoutingArchiveCopy(source.note),
          })),
        isRedraft
      ),
    });
  }

  if (!isRedraft && devyProfileKey && sourceWeightProfiles[devyProfileKey]) {
    summaries.push({
      id: "current-league-college-blend",
      title: "College Prospect Blend",
      profileLabel: getAdminBlendProfileLabel(reportData, devyProfileKey),
      note: "Prospect-board blend for college/devy assets. Prospect traits are context only and do not directly change dynasty market values.",
      sources: sourceWeightProfiles[devyProfileKey].sources
        .filter(source => source.percent > 0)
        .map(source => ({
          key: source.key,
          source: formatScoutingArchiveCopy(source.source),
          percent: source.percent,
          note: formatScoutingArchiveCopy(source.note),
        })),
    });
  }

  return summaries;
}

function getActionableMissingSnapshotDates(data?: {
  missingDateKeys?: string[];
  todayDateKey?: string | null;
}): string[] {
  if (!data?.missingDateKeys?.length || !data.todayDateKey) return [];
  return data.missingDateKeys.filter(dateKey => dateKey === data.todayDateKey);
}

function AdminValueDiagnosticsTable({
  reportData,
  rows,
  priorityRows,
  emptySourceRows,
}: {
  reportData: ReportData;
  rows: AdminValueDiagnosticRow[];
  priorityRows: AdminValueDiagnosticRow[];
  emptySourceRows: AdminValueDiagnosticRow[];
}) {
  const blendSummaries = buildAdminBlendSummaries(reportData);
  const leagueConfidence = reportData.leagueDiagnostics?.aiConfidence;
  const managerConfidenceRows = [...(leagueConfidence?.managerConfidence || [])]
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);
  const priorityIds = new Set(priorityRows.map(row => row.id));
  const visiblePriorityRows = priorityRows.slice(0, 6);
  const reviewRows = rows.filter(
    row =>
      !priorityIds.has(row.id) &&
      isActionableDiagnosticTone(row.tone) &&
      !isHandledSourceTrustDiagnosticRow(row)
  );
  const showConfidenceDrilldown =
    priorityRows.length > 0 ||
    reviewRows.some(row => /confidence/i.test(row.area));

  return (
    <div className="admin-value-diagnostics">
      <p className="admin-value-diagnostics-intro">
        Admin eyes only. Needs Attention lists real value/source problems. The
        0-row watchlist is informational so we can see optional providers that
        are configured but not currently contributing.
      </p>
      {showConfidenceDrilldown && leagueConfidence && (
        <section
          className="admin-confidence-drilldown"
          aria-label="Admin confidence drilldown"
        >
          <div className="admin-confidence-drilldown-head">
            <span>Confidence Drilldown</span>
            <strong>
              {leagueConfidence.score}% {leagueConfidence.label}
            </strong>
            <p>{leagueConfidence.note}</p>
          </div>
          <div className="admin-confidence-signal-grid">
            {leagueConfidence.signals.map(signal => {
              const delta = Number(signal.scoreDelta || 0);
              return (
                <article
                  key={signal.key}
                  className={`admin-confidence-signal-card admin-confidence-signal-card-${signal.status}`}
                >
                  <div>
                    <span>{signal.label}</span>
                    <strong>{signal.score}%</strong>
                  </div>
                  <em>
                    {signal.previousScore === null ||
                    signal.previousScore === undefined
                      ? "New signal"
                      : `${delta > 0 ? "+" : ""}${delta} from ${signal.previousScore}%`}
                  </em>
                  <p>{signal.note}</p>
                </article>
              );
            })}
          </div>
          {managerConfidenceRows.length > 0 && (
            <div
              className="admin-manager-confidence-strip"
              aria-label="Lowest manager confidence rows"
            >
              <span>Weakest manager reads</span>
              {managerConfidenceRows.map(manager => (
                <small key={manager.manager}>
                  <strong>{manager.manager}</strong>
                  <em>{manager.score}%</em>
                </small>
              ))}
            </div>
          )}
        </section>
      )}
      {visiblePriorityRows.length > 0 && (
        <section
          className="admin-critical-alerts"
          aria-label="Important admin value alerts"
        >
          <div className="admin-critical-alerts-header">
            <span>Needs Admin Attention</span>
            <strong>
              {priorityRows.length} important value/source flag
              {priorityRows.length === 1 ? "" : "s"}
            </strong>
          </div>
          <div className="admin-critical-alerts-grid">
            {visiblePriorityRows.map(row => (
              <article
                key={`priority-${row.id}`}
                className={`admin-critical-alert-card admin-critical-alert-card-${row.tone || "info"}`}
              >
                <div>
                  <span>{row.area}</span>
                  <strong>{row.item}</strong>
                </div>
                <p>{row.note}</p>
                <em>{row.status}</em>
              </article>
            ))}
          </div>
        </section>
      )}
      {blendSummaries.length > 0 && (
        <div className="admin-blend-summary-grid">
          {blendSummaries.map(summary => (
            <article key={summary.id} className="admin-blend-summary-card">
              <div className="admin-blend-summary-top">
                <span>{summary.title}</span>
                <strong>{summary.profileLabel}</strong>
              </div>
              <div
                className="admin-blend-source-list"
                aria-label={`${summary.title} source weights`}
              >
                {summary.sources.map(source => (
                  <span
                    key={source.key}
                    className="admin-blend-source-pill"
                    title={source.note}
                  >
                    <strong>{source.source}</strong>
                    <em>{source.percent}%</em>
                  </span>
                ))}
              </div>
              <p>{summary.note}</p>
            </article>
          ))}
          <article className="admin-blend-summary-card admin-blend-summary-card-note">
            <div className="admin-blend-summary-top">
              <span>Important Blend Detail</span>
              <strong>Weights normalize when sources are missing</strong>
            </div>
            <p>
              {normalizeLeagueValueMode(
                reportData.leagueDiagnostics?.valueMode ||
                  reportData.leagueValueMode
              ) === "redraft"
                ? "If a player is missing one of the current-season sources above, the available weights normalize across only the sources present. Long-term market inputs stay hidden in this report."
                : "If a player is missing one of the sources above, the available weights normalize across only the sources present. Players only get flagged below when no primary blend source is attached. Season and projection data is only for lineup and redraft-style reads, not dynasty market value."}
            </p>
            {reportData.leagueDiagnostics && (
              <p>
                Current league context: {reportData.leagueDiagnostics.teamCount}
                -team {reportData.leagueDiagnostics.scoringSummary}. Starter
                math uses {reportData.leagueDiagnostics.lineupSlotSummary}.
              </p>
            )}
          </article>
        </div>
      )}
      {emptySourceRows.length > 0 && (
        <section
          className="admin-source-history-strip"
          aria-label="Optional sources with zero rows"
        >
          <div className="admin-source-history-head">
            <span>0-row source watchlist</span>
            <strong>
              {emptySourceRows.length} optional source
              {emptySourceRows.length === 1 ? "" : "s"} returned no usable rows
            </strong>
          </div>
          <div className="admin-source-history-grid">
            {emptySourceRows.map(row => (
              <article
                key={`empty-source-${row.id}`}
                className="admin-source-history-card"
              >
                <div>
                  <span>{row.area}</span>
                  <strong>{row.item}</strong>
                </div>
                <p>{row.note}</p>
                <em>{row.status}</em>
              </article>
            ))}
          </div>
        </section>
      )}
      {reviewRows.length > 0 && (
        <div className="admin-value-diagnostics-grid">
          {reviewRows.map(row => (
            <article
              key={row.id}
              className={`admin-value-diagnostics-card admin-value-diagnostics-card-${row.tone || "info"}`}
            >
              <div className="admin-value-diagnostics-card-top">
                <div>
                  <span>{row.area}</span>
                  <strong>{row.item}</strong>
                </div>
                <span className="admin-value-diagnostics-flag">{row.status}</span>
              </div>
              <p>{row.note}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminValueDiagnosticsSection({
  reportData,
}: {
  reportData: ReportData;
}) {
  const { data } = trpc.system.snapshotCoverage.useQuery(
    { lookbackDays: 14 },
    { refetchOnWindowFocus: false, staleTime: 1000 * 60 * 5 }
  );
  const rows = buildAdminValueDiagnostics(
    reportData,
    getActionableMissingSnapshotDates(data)
  );
  const priorityRows = rows
    .filter(isPriorityAdminDiagnosticRow)
    .sort(compareAdminDiagnosticPriority);
  const emptySourceRows = rows
    .filter(isInformationalEmptySourceRow)
    .sort(compareAdminDiagnosticPriority);
  if (!priorityRows.length && !emptySourceRows.length) return null;
  const attentionSummary = {
    count: priorityRows.length,
    tone: priorityRows.some(row => row.tone === "danger") ? "danger" as const : "warn" as const,
  };

  return (
    <CollapsibleReportSection
      title="Value Source Health"
      kicker="Actionable flags and 0-row sources"
      previewAccessory={
        attentionSummary.count > 0 ? (
          <AdminAttentionBadge
            count={attentionSummary.count}
            label="Needs attention"
            tone={attentionSummary.tone}
          />
        ) : emptySourceRows.length > 0 ? (
          <AdminAttentionBadge
            count={emptySourceRows.length}
            label="0-row sources"
            tone="info"
          />
        ) : undefined
      }
      premium
    >
      <AdminValueDiagnosticsTable
        reportData={reportData}
        rows={rows}
        priorityRows={priorityRows}
        emptySourceRows={emptySourceRows}
      />
    </CollapsibleReportSection>
  );
}
