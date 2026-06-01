import { isPlaceholderManagerName } from "@/lib/managerDisplay";
import type { ReportData } from "@shared/types";

export function getReportDashboardManagers(data: ReportData): string[] {
  const managers = new Set<string>();
  const add = (manager?: string | null) => {
    if (manager && !isPlaceholderManagerName(manager)) managers.add(manager);
  };
  data.leagueOverview?.forEach(row => add(row.manager));
  data.managerRosterIntelligence?.forEach(row => add(row.manager));
  data.managerPositionCounts?.forEach(row => add(row.manager));
  data.powerRankings?.forEach(row => add(row.manager));
  data.currentStandings?.forEach(row => add(row.manager));
  return Array.from(managers);
}

export function formatDashboardSignedPercentLabel(
  value?: number | null
): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  const rounded = Math.round(normalized * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}
