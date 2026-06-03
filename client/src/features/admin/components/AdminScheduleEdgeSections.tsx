import { type CSSProperties, useMemo, useState } from "react";
import { getAIEvidenceReceiptItems } from "@shared/aiEvidenceEngine";
import type { ReportData } from "@shared/types";
import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import { AdminAttentionBadge } from "@/features/report/components/AdminDiagnosticsPrimitives";
import {
  buildScheduleEdgeRows,
  buildScheduleSnapshotHealthRows,
  getScheduleEdgeRangeSummary,
  getScheduleEdgeWeeksInRange,
  formatScheduleEdgeValue,
  normalizeScheduleEdgeWeekRange,
  SCHEDULE_EDGE_POSITION_FILTERS,
  sortScheduleEdgeRows,
  type ScheduleEdgePositionFilter,
  type ScheduleEdgeSortMode,
} from "@/lib/scheduleEdgeRows";
import { ScheduleEdgePlayerCell, ScheduleEdgeWeekChip } from "@/features/report/components/AdminDiagnosticsPrimitives";

const SCHEDULE_EDGE_SORT_OPTIONS: Array<{
  value: ScheduleEdgeSortMode;
  label: string;
}> = [
  { value: "easiest", label: "Easiest" },
  { value: "toughest", label: "Toughest" },
  { value: "rank", label: "Rank" },
];

const SCHEDULE_EDGE_WEEK_OPTIONS = Array.from(
  { length: 18 },
  (_, index) => index + 1
);

export function AdminScheduleEdgeSection({
  reportData,
}: {
  reportData: ReportData;
}) {
  const [positionFilter, setPositionFilter] =
    useState<ScheduleEdgePositionFilter>("ALL");
  const [sortMode, setSortMode] = useState<ScheduleEdgeSortMode>("easiest");
  const [weekStart, setWeekStart] = useState(1);
  const [weekEnd, setWeekEnd] = useState(4);
  const rows = useMemo(() => buildScheduleEdgeRows(reportData), [reportData]);
  const healthRows = useMemo(
    () => buildScheduleSnapshotHealthRows(reportData),
    [reportData]
  );
  const selectedRange = useMemo(
    () => normalizeScheduleEdgeWeekRange({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd]
  );
  const healthPositions = SCHEDULE_EDGE_POSITION_FILTERS.filter(
    (position): position is Exclude<ScheduleEdgePositionFilter, "ALL"> =>
      position !== "ALL"
  );
  const filteredRows = useMemo(
    () =>
      positionFilter === "ALL"
        ? rows
        : rows.filter(row => row.position === positionFilter),
    [positionFilter, rows]
  );
  const visibleRows = useMemo(
    () => sortScheduleEdgeRows(filteredRows, selectedRange, sortMode),
    [filteredRows, selectedRange, sortMode]
  );
  const loadedPositions = new Set(rows.map(row => row.position));
  const sourceWarningCount = rows.filter(
    row => row.sourceTone === "warn" || row.sourceTone === "danger"
  ).length;
  const healthIssueCount = healthRows.reduce(
    (count, row) =>
      count +
      Object.values(row.cells).filter(
        cell => cell?.tone === "warn" || cell?.tone === "danger"
      ).length,
    0
  );
  const issueCount = healthIssueCount + sourceWarningCount;
  const rangeTrackStyle = {
    "--range-start": `${((selectedRange.start - 1) / 17) * 100}%`,
    "--range-end": `${((selectedRange.end - 1) / 17) * 100}%`,
  } as CSSProperties;

  if (!rows.length && !healthRows.length) return null;

  return (
    <CollapsibleReportSection
      title="Schedule Edge Table"
      kicker="DraftSharks SOS windows"
      previewAccessory={
        issueCount > 0 ? (
          <AdminAttentionBadge
            count={issueCount}
            label="Snapshot issues"
            tone={healthRows.some(row =>
              Object.values(row.cells).some(cell => cell?.tone === "danger")
            ) || rows.some(row => row.sourceTone === "danger") ? "danger" : "warn"}
          />
        ) : undefined
      }
      defaultOpen
    >
      <div className="admin-schedule-edge">
        <div className="admin-schedule-edge-controls">
          <div className="admin-schedule-edge-control-group">
            <span className="admin-schedule-edge-control-label">
              Position
            </span>
            <div className="admin-schedule-edge-toolbar" aria-label="Schedule edge filters">
              {SCHEDULE_EDGE_POSITION_FILTERS.map(position => {
                const disabled = position !== "ALL" && !loadedPositions.has(position);
                return (
                  <button
                    key={position}
                    type="button"
                    className={
                      positionFilter === position
                        ? "admin-schedule-edge-filter admin-schedule-edge-filter-active"
                        : "admin-schedule-edge-filter"
                    }
                    disabled={disabled}
                    onClick={() => setPositionFilter(position)}
                  >
                    {position === "ALL" ? "All" : position}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="admin-schedule-edge-control-group admin-schedule-edge-range-group">
            <div className="admin-schedule-edge-control-heading">
              <span className="admin-schedule-edge-control-label">Weeks</span>
              <strong>{selectedRange.start === selectedRange.end
                ? `Week ${selectedRange.start}`
                : `Weeks ${selectedRange.start}-${selectedRange.end}`}</strong>
            </div>
            <div
              className="admin-schedule-range-slider"
              style={rangeTrackStyle}
            >
              <input
                min={1}
                max={18}
                value={selectedRange.start}
                aria-label="Start week"
                type="range"
                onChange={event => {
                  const next = Number(event.currentTarget.value);
                  setWeekStart(next);
                  if (next > weekEnd) setWeekEnd(next);
                }}
              />
              <input
                min={1}
                max={18}
                value={selectedRange.end}
                aria-label="End week"
                type="range"
                onChange={event => {
                  const next = Number(event.currentTarget.value);
                  setWeekEnd(next);
                  if (next < weekStart) setWeekStart(next);
                }}
              />
            </div>
            <div
              className="admin-schedule-week-ticks"
              aria-label="Weeks 1 through 18"
            >
              {SCHEDULE_EDGE_WEEK_OPTIONS.map(week => {
                const isSelected =
                  week >= selectedRange.start && week <= selectedRange.end;
                const isEdge =
                  week === selectedRange.start || week === selectedRange.end;
                return (
                  <span
                    key={week}
                    className={[
                      "admin-schedule-week-tick",
                      isSelected ? "admin-schedule-week-tick-selected" : "",
                      isEdge ? "admin-schedule-week-tick-edge" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {week}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="admin-schedule-edge-control-group">
            <span className="admin-schedule-edge-control-label">Sort</span>
            <div className="admin-schedule-edge-toolbar" aria-label="Schedule edge sort">
              {SCHEDULE_EDGE_SORT_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    sortMode === option.value
                      ? "admin-schedule-edge-filter admin-schedule-edge-filter-active"
                      : "admin-schedule-edge-filter"
                  }
                  onClick={() => setSortMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="admin-schedule-edge-count">
          <strong>{visibleRows.length.toLocaleString()}</strong>
          <span>
            {positionFilter === "ALL" ? "players" : `${positionFilter} rows`}
          </span>
        </div>

        {rows.length ? (
          <div className="admin-schedule-edge-table-wrap">
            <table className="admin-schedule-edge-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Rank</th>
                  <th>Selected Weeks</th>
                  <th>Value</th>
                  <th>Decision</th>
                  <th>League Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => {
                  const weekRows = getScheduleEdgeWeeksInRange(row, selectedRange);
                  const summary = getScheduleEdgeRangeSummary(row, selectedRange);

                  return (
                    <tr key={row.id}>
                      <td>
                        <ScheduleEdgePlayerCell row={row} />
                      </td>
                      <td>
                        <strong>{row.seasonRank || row.bestRank}</strong>
                        <span>
                          {row.seasonRank
                            ? "Current-season rank"
                            : row.bestWeek
                              ? `Best W${row.bestWeek}`
                              : "Rolling"}
                        </span>
                        {row.seasonRank && row.bestRank !== row.seasonRank ? (
                          <span className="admin-schedule-rank-source">
                            SOS row {row.bestRank}
                          </span>
                        ) : null}
                      </td>
                      <td className="admin-schedule-edge-weeks-cell">
                        <div className="admin-schedule-week-chip-list">
                          {weekRows.map(week => (
                            <ScheduleEdgeWeekChip
                              key={`${row.id}-${week.week}`}
                              rowId={row.id}
                              week={week}
                            />
                          ))}
                          {summary.missingWeeks.map(week => (
                            <span
                              key={`${row.id}-missing-${week}`}
                              className="admin-schedule-week-chip admin-schedule-week-chip-missing"
                            >
                              <strong>W{week}</strong>
                              <span>No row</span>
                              <em>Missing</em>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <strong>{formatScheduleEdgeValue(row.value)}</strong>
                        <span>
                          {row.targetScore !== null
                            ? `Target ${Math.round(row.targetScore)}`
                            : row.currentRank
                              ? "Season value"
                              : "No rank"}
                        </span>
                      </td>
                      <td className="admin-schedule-decision-cell">
                        <span
                          className={`admin-schedule-edge-pill admin-schedule-edge-pill-${row.decisionTone}`}
                          title={row.evidenceRead.whyThisFired}
                        >
                          {row.decisionLabel}
                        </span>
                        <span
                          className={`admin-schedule-evidence-label admin-schedule-evidence-label-${row.evidenceRead.label.replace(/\s+/g, "-")}`}
                        >
                          {row.evidenceRead.label} · {row.evidenceRead.finalScore}%
                        </span>
                        <details className="admin-schedule-evidence-receipts">
                          <summary>Receipts</summary>
                          <ul>
                            {getAIEvidenceReceiptItems(row.evidenceRead).map(item => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </details>
                      </td>
                      <td>
                        <span
                          className={`admin-schedule-edge-pill admin-schedule-edge-pill-${row.availabilityTone}`}
                          title={`${row.availabilityDetail} ${row.sourceFreshness}`}
                        >
                          {row.availabilityLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-schedule-edge-empty">
            <strong>No DraftSharks SOS rows yet</strong>
            <p>
              The report did not return stored DraftSharks schedule targets.
              Refresh the DraftSharks SOS snapshot or regenerate after the
              schedule-strength job has percentage rows for the selected window.
            </p>
          </div>
        )}
        {healthRows.length > 0 && (
          <details className="admin-schedule-health-disclosure">
            <summary>
              <span>Snapshot coverage</span>
              <em>{issueCount.toLocaleString()} issues</em>
            </summary>
            <div className="admin-schedule-health">
              <div className="admin-schedule-edge-table-wrap">
                <table className="admin-schedule-edge-table admin-schedule-health-table">
                  <thead>
                    <tr>
                      <th>Week</th>
                      {healthPositions.map(position => (
                        <th key={position}>{position}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {healthRows.map(row => (
                      <tr key={row.week}>
                        <td>
                          <strong>Week {row.week}</strong>
                        </td>
                        {healthPositions.map(position => {
                          const cell = row.cells[position];
                          return (
                            <td key={position}>
                              {cell ? (
                                <span
                                  className={`admin-schedule-edge-pill admin-schedule-edge-pill-${cell.tone}`}
                                  title={cell.detail}
                                >
                                  {cell.label}
                                  {typeof cell.rowCount === "number"
                                    ? ` · ${cell.rowCount.toLocaleString()}`
                                    : ""}
                                </span>
                              ) : (
                                <span className="admin-schedule-health-missing">
                                  -
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        )}
      </div>
    </CollapsibleReportSection>
  );
}
