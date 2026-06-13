import { useEffect, useMemo, useState } from "react";
import type { ReportData } from "@shared/types";
import { gradeRoster } from "@shared/blueprint/playerGrading";
import { getDraftCapitalScore, getOverallGrade } from "@shared/blueprint/rosterAggregates";
import { clamp01, easeOutCubic, useAnimationsEnabled, useMotionInViewOnce } from "@/lib/motion";
import { isViewerManagerMatch } from "@/lib/viewerHighlight";

type AxisKey = "star" | "youth" | "depth" | "draft" | "momentum";
type RadarAxis = { key: AxisKey; label: string; score: number };
type RadarRow = { manager: string; axes: RadarAxis[] };
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

function clampScore(value: number | null | undefined): number | null {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(10, score > 10 ? score / 10 : score));
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
      { key: "star", label: "Star Power", score: topAverage ?? 0 },
      { key: "youth", label: "Youth", score: getYouthScore(row, power) ?? 0 },
      { key: "depth", label: "Depth", score: depthScore ?? getOverallGrade(graded) },
      {
        key: "draft",
        label: "Draft Capital",
        score: getDraftCapitalScore({
          totalValue: pick.totalValue,
          leagueRank: pickRankByManager.get(row.manager) || null,
          leagueSize: pickPortfolios.length || null,
        }),
      },
      { key: "momentum", label: "Momentum", score: average(graded.map(entry => entry.situational)) ?? 0 },
    ] satisfies RadarAxis[]).map(axis => ({ ...axis, score: Math.round(axis.score * 10) / 10 }));

    return axes.every(axis => Number.isFinite(axis.score))
      ? [{ manager: row.manager, axes }]
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
  const medianScores = useMemo(
    () => AXIS_LABELS.map(axis => median(rows.map(row => row.axes.find(item => item.key === axis.key)?.score ?? 0))),
    [rows]
  );
  const viewerScores = useMemo(() => viewerRow?.axes.map(axis => axis.score) || [], [viewerRow]);
  const { hasEntered, ref } = useMotionInViewOnce<HTMLDivElement>();
  const animationsEnabled = useAnimationsEnabled();
  const [progress, setProgress] = useState(() => animationsEnabled ? Array(AXIS_COUNT).fill(0) : FULL_PROGRESS);
  const progressKey = viewerScores.join(":");

  useEffect(() => {
    if (!viewerRow || !animationsEnabled || !hasEntered) {
      setProgress(FULL_PROGRESS);
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const step = (now: number) => {
      const next = viewerScores.map((_, index) => easeOutCubic((now - startedAt - index * 80) / 600));
      setProgress(next);
      if (next.some(value => value < 1)) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [animationsEnabled, hasEntered, progressKey, viewerRow]);

  if (!viewerRow || rows.length < 2) return null;

  return (
    <div ref={ref} className="team-profile-radar">
      <div className="team-profile-radar-copy">
        <span>Team Profile</span>
        <strong>{viewerRow.manager}</strong>
        <p>Blueprint factors vs league median from current report data.</p>
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
        <polygon points={polygonPoints(viewerScores, progress)} className="team-profile-radar-viewer" />
        <polygon points={polygonPoints(viewerScores, progress)} className="team-profile-radar-viewer-fill" />
      </svg>
      <div className="team-profile-radar-legend">
        {viewerRow.axes.map(axis => (
          <span key={axis.key}>
            {axis.label}
            <strong>{axis.score.toFixed(1)}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
