import { useEffect, useMemo, useRef, useState } from "react";
import type { ReportData } from "@shared/types";
import { gradeRoster } from "@shared/blueprint/playerGrading";
import { getDraftCapitalScore, getOverallGrade } from "@shared/blueprint/rosterAggregates";
import { clamp01, easeOutCubic, useAnimationsEnabled, useMotionInViewOnce } from "@/lib/motion";
import { isViewerManagerMatch } from "@/lib/viewerHighlight";

type AxisKey = "star" | "youth" | "depth" | "draft" | "momentum";
type RadarWeighting = "dynasty" | "winNow";
type RadarAxis = { key: AxisKey; label: string; score: number };
type RadarRow = { manager: string; axes: RadarAxis[]; winNowAxes: RadarAxis[] };
type ManagerRosterRow = NonNullable<ReportData["managerRosterIntelligence"]>[number];
type PowerRankingRow = NonNullable<ReportData["powerRankings"]>[number];

const AXIS_LABELS: Array<{ key: AxisKey; label: string }> = [
  { key: "star", label: "Star Power" },
  { key: "youth", label: "Youth" },
  { key: "depth", label: "Depth" },
  { key: "draft", label: "Draft Capital" },
  { key: "momentum", label: "Momentum" },
];

const CENTER = 100;
const RADIUS = 72;
const AXIS_COUNT = AXIS_LABELS.length;
const FULL_PROGRESS = Array(AXIS_COUNT).fill(1);
const ZERO_SCORES = Array(AXIS_COUNT).fill(0);
const RADAR_WEIGHTING_OPTIONS: Array<{ key: RadarWeighting; label: string }> = [
  { key: "dynasty", label: "Dynasty" },
  { key: "winNow", label: "Win-now" },
];

function clampScore(value: number | null | undefined): number | null {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(10, score > 10 ? score / 10 : score));
}

function roundRadarScore(value: number): number {
  return Math.round(Math.max(0, Math.min(10, value)) * 10) / 10;
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values: number[]): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function axisPoint(index: number, score: number, progress = 1) {
  const angle = -Math.PI / 2 + (index / AXIS_COUNT) * Math.PI * 2;
  const radius = RADIUS * clamp01(score / 10) * clamp01(progress);
  return { x: CENTER + Math.cos(angle) * radius, y: CENTER + Math.sin(angle) * radius };
}

function polygonPoints(scores: number[], progress = FULL_PROGRESS): string {
  return scores.map((score, index) => {
    const point = axisPoint(index, score, progress[index] ?? 1);
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).join(" ");
}

function getYouthScore(row: ManagerRosterRow, power?: PowerRankingRow): number | null {
  const powerYouth = clampScore(power?.youthScore);
  if (powerYouth !== null) return powerYouth;
  if (row.avgAge === null || row.avgAge === undefined) return null;
  return Math.max(0, Math.min(10, 10 - ((row.avgAge - 24) / 6) * 8));
}

function buildWinNowAxes(axes: RadarAxis[], graded: ReturnType<typeof gradeRoster>): RadarAxis[] {
  const currentStarterScore =
    average(
      [...graded]
        .sort((a, b) => b.production - a.production)
        .slice(0, Math.min(8, graded.length))
        .map(entry => entry.production)
    ) ?? 0;

  return axes.map(axis => {
    let score = axis.score;
    if (axis.key === "star") score = axis.score * 0.58 + currentStarterScore * 0.42;
    else if (axis.key === "depth") score = axis.score * 0.72 + currentStarterScore * 0.28;
    else if (axis.key === "youth") score = axis.score * 0.58;
    else if (axis.key === "draft") score = axis.score * 0.52;

    return { ...axis, score: roundRadarScore(score) };
  });
}

function buildRadarRows(reportData: ReportData, leagueValueMode: ReportData["leagueValueMode"]): RadarRow[] {
  const managers = reportData.managerRosterIntelligence || [];
  const powerByManager = new Map((reportData.powerRankings || []).map(row => [row.manager, row]));
  const pickPortfolios = reportData.pickPortfolios || [];
  const pickByManager = new Map(pickPortfolios.map(row => [row.manager, row]));
  const pickRankByManager = new Map(
    [...pickPortfolios]
      .sort((a, b) => b.totalValue - a.totalValue)
      .map((row, index) => [row.manager, index + 1])
  );

  return managers.flatMap((row) => {
    const players = row.rosterPlayers || [];
    const graded = gradeRoster(players, leagueValueMode);
    const pick = pickByManager.get(row.manager);
    if (graded.length < 3 || !pick) return [];

    const topAverage = average(graded.slice(0, 5).map(entry => entry.composite));
    const fullAverage = average(graded.map(entry => entry.composite));
    const depthScore = topAverage && fullAverage ? Math.min(10, (fullAverage / topAverage) * 10) : null;
    const power = powerByManager.get(row.manager);
    const axes = ([
      { key: "star", label: "Star Power", score: roundRadarScore(topAverage ?? 0) },
      { key: "youth", label: "Youth", score: roundRadarScore(getYouthScore(row, power) ?? 0) },
      { key: "depth", label: "Depth", score: roundRadarScore(depthScore ?? getOverallGrade(graded)) },
      {
        key: "draft",
        label: "Draft Capital",
        score: roundRadarScore(getDraftCapitalScore({
          totalValue: pick.totalValue,
          leagueRank: pickRankByManager.get(row.manager) || null,
          leagueSize: pickPortfolios.length || null,
        })),
      },
      { key: "momentum", label: "Momentum", score: roundRadarScore(average(graded.map(entry => entry.situational)) ?? 0) },
    ] satisfies RadarAxis[]);

    return axes.every(axis => Number.isFinite(axis.score))
      ? [{ manager: row.manager, axes, winNowAxes: buildWinNowAxes(axes, graded) }]
      : [];
  });
}

export function hasTeamProfileRadarData({
  reportData,
  viewerManager,
  leagueValueMode,
}: {
  reportData: ReportData;
  viewerManager?: string | null;
  leagueValueMode: ReportData["leagueValueMode"];
}) {
  const rows = buildRadarRows(reportData, leagueValueMode);
  const viewerRow = rows.find(row => isViewerManagerMatch(row.manager, viewerManager || reportData.viewerManager));
  return Boolean(viewerRow && rows.length >= 2);
}

export function TeamProfileRadar({
  reportData,
  viewerManager,
  leagueValueMode,
}: { reportData: ReportData; viewerManager?: string | null; leagueValueMode: ReportData["leagueValueMode"] }) {
  const rows = useMemo(() => buildRadarRows(reportData, leagueValueMode), [reportData, leagueValueMode]);
  const viewerRow = rows.find(row => isViewerManagerMatch(row.manager, viewerManager || reportData.viewerManager));
  const [weighting, setWeighting] = useState<RadarWeighting>("dynasty");
  const medianScores = useMemo(
    () => AXIS_LABELS.map(axis => median(rows.map(row => row.axes.find(item => item.key === axis.key)?.score ?? 0))),
    [rows]
  );
  const activeAxes = weighting === "winNow" ? viewerRow?.winNowAxes : viewerRow?.axes;
  const targetScores = useMemo(() => activeAxes?.map(axis => axis.score) || ZERO_SCORES, [activeAxes]);
  const targetScoreKey = `${weighting}:${targetScores.join(":")}`;
  const { hasEntered, ref } = useMotionInViewOnce<HTMLDivElement>();
  const animationsEnabled = useAnimationsEnabled();
  const [displayScores, setDisplayScores] = useState(() => animationsEnabled ? ZERO_SCORES : targetScores);
  const displayScoresRef = useRef(displayScores);
  const introPlayedRef = useRef(false);
  const activeWeightingLabel = weighting === "winNow" ? "Win-now weighting" : "Dynasty weighting";

  useEffect(() => {
    displayScoresRef.current = displayScores;
  }, [displayScores]);

  useEffect(() => {
    if (!viewerRow || !animationsEnabled || !hasEntered) {
      setDisplayScores(targetScores);
      if (!animationsEnabled) introPlayedRef.current = true;
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const isIntro = !introPlayedRef.current;
    const fromScores = isIntro ? ZERO_SCORES : displayScoresRef.current;
    const axisDelay = isIntro ? 80 : 0;
    const step = (now: number) => {
      const next = targetScores.map((target, index) => {
        const progress = easeOutCubic((now - startedAt - index * axisDelay) / 600);
        return fromScores[index] + (target - fromScores[index]) * progress;
      });
      setDisplayScores(next);
      if (next.some((value, index) => Math.abs(value - targetScores[index]) > 0.01)) {
        frame = window.requestAnimationFrame(step);
        return;
      }
      introPlayedRef.current = true;
      setDisplayScores(targetScores);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [animationsEnabled, hasEntered, targetScoreKey, targetScores, viewerRow]);

  if (!viewerRow || rows.length < 2) return null;

  return (
    <div ref={ref} className="team-profile-radar">
      <div className="team-profile-radar-copy">
        <span>Team Profile</span>
        <strong>{viewerRow.manager}</strong>
        <em className="team-profile-radar-active-label">{activeWeightingLabel}</em>
        <p>Blueprint factors vs league median from current report data.</p>
        <div className="team-profile-radar-weighting" role="group" aria-label="Radar weighting">
          {RADAR_WEIGHTING_OPTIONS.map(option => (
            <button
              key={option.key}
              type="button"
              className={weighting === option.key ? "active" : ""}
              aria-pressed={weighting === option.key}
              onClick={() => setWeighting(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 200 200" role="img" aria-label={`${viewerRow.manager} team profile radar`}>
        {[2.5, 5, 7.5, 10].map(score => (
          <polygon key={score} points={polygonPoints(Array(AXIS_COUNT).fill(score))} className="team-profile-radar-ring" />
        ))}
        {AXIS_LABELS.map((axis, index) => {
          const point = axisPoint(index, 10);
          return <line key={axis.key} x1={CENTER} y1={CENTER} x2={point.x} y2={point.y} className="team-profile-radar-axis" />;
        })}
        <polygon points={polygonPoints(medianScores)} className="team-profile-radar-median" />
        <polygon points={polygonPoints(displayScores, FULL_PROGRESS)} className="team-profile-radar-viewer" />
        <polygon points={polygonPoints(displayScores, FULL_PROGRESS)} className="team-profile-radar-viewer-fill" />
      </svg>
      <div className="team-profile-radar-legend">
        {(activeAxes || viewerRow.axes).map(axis => (
          <span key={axis.key}>
            {axis.label}
            <strong>{axis.score.toFixed(1)}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
