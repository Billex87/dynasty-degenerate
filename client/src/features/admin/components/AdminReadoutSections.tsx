import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import {
  buildLeagueSharpnessProfile,
  type LeagueSharpnessProfile,
} from "@shared/leagueSharpness";
import type { ReportData } from "@shared/types";
import {
  buildManagerPersonalityIntelRows,
  type ManagerPersonalityIntelRow,
} from "@/lib/managerPersonalityIntel";

function getLeagueSharpnessTone(
  profile: LeagueSharpnessProfile
): "good" | "info" | "warn" | "danger" {
  if (profile.tier === "shark-tank" || profile.tier === "sharp") return "good";
  if (profile.tier === "average") return "info";
  if (profile.tier === "casual") return "warn";
  return "danger";
}

function getManagerPersonalityToneLabel(row: ManagerPersonalityIntelRow): string {
  if (row.confidence === "usable") return "usable";
  if (row.confidence === "building") return "building";
  return "thin";
}

export function AdminLeagueSharpnessSection({
  reportData,
}: {
  reportData: ReportData;
}) {
  const profile = buildLeagueSharpnessProfile(reportData);
  if (!profile) return null;
  const tone = getLeagueSharpnessTone(profile);

  return (
    <CollapsibleReportSection
      title="League Sharpness Score"
      kicker="Admin eyes only"
      previewMetrics={[
        {
          label: "Score",
          value: profile.score,
          tone,
        },
        {
          label: "Samples",
          value: profile.sampleSize,
          tone: profile.confidence === "usable" ? "good" : "warn",
        },
        {
          label: "Inactive",
          value: profile.inactiveManagerCount,
          tone: profile.inactiveManagerCount ? "warn" : "good",
        },
      ]}
      premium
    >
      <div className="admin-ai-readout-diagnostics admin-league-sharpness">
        <div className="admin-league-sharpness-hero">
          <div>
            <span>{profile.label}</span>
            <strong>{profile.score}%</strong>
            <p>{profile.note}</p>
          </div>
          <div className="admin-ai-readout-chip-row">
            <em>{profile.confidence}</em>
            <em>{profile.actionBias}</em>
            <em>{profile.teamCount} teams</em>
            <em>{profile.tradeSignalsPerTeam} trades/team</em>
            <em>{profile.waiverSignalsPerTeam} waiver/team</em>
          </div>
        </div>

        <div className="admin-ai-readout-summary">
          <span>
            <strong>{profile.sampleSize}</strong>
            <em>samples</em>
          </span>
          <span>
            <strong>{profile.transactionSignalsPerTeam}</strong>
            <em>tx/team</em>
          </span>
          <span>
            <strong>{profile.tradeSignalsPerTeam}</strong>
            <em>trade/team</em>
          </span>
          <span>
            <strong>{profile.inactiveManagerCount}</strong>
            <em>inactive</em>
          </span>
        </div>

        <div className="admin-ai-readout-row-grid">
          {profile.signals.map(signal => (
            <article
              key={signal.key}
              className={`admin-ai-readout-row admin-ai-readout-row-${
                signal.status === "strong"
                  ? "good"
                  : signal.status === "building"
                    ? "warn"
                    : "danger"
              }`}
            >
              <div>
                <span>{signal.status}</span>
                <strong>{signal.label}</strong>
              </div>
              <p>{signal.note}</p>
              <div className="admin-ai-readout-chip-row">
                <em>{signal.score}%</em>
                <em>{Math.round(signal.weight * 100)}% weight</em>
              </div>
            </article>
          ))}
        </div>

        <p className="admin-ai-readout-clean">
          Sharpness now feeds the shared AI evidence layer. Strong leagues raise
          urgency on backed reads; sleepy leagues cap urgency so the app does
          not tell users to chase moves the room is unlikely to force.
        </p>
      </div>
    </CollapsibleReportSection>
  );
}

export function AdminManagerPersonalityIntelSection({
  reportData,
}: {
  reportData: ReportData;
}) {
  const rows = buildManagerPersonalityIntelRows(reportData);
  if (!rows.length) return null;
  const usableCount = rows.filter(row => row.confidence === "usable").length;
  const thinCount = rows.filter(row => row.confidence === "thin").length;
  const highestActivity = rows[0] || null;

  return (
    <CollapsibleReportSection
      title="Leaguemate Personality Intel"
      kicker="Admin eyes only"
      previewMetrics={[
        {
          label: "Managers",
          value: rows.length,
          tone: rows.length ? "info" : "warn",
        },
        {
          label: "Usable",
          value: usableCount,
          tone: usableCount ? "good" : "warn",
        },
        {
          label: "Thin",
          value: thinCount,
          tone: thinCount ? "warn" : "good",
        },
      ]}
      premium
    >
      <div className="admin-ai-readout-diagnostics admin-manager-personality-intel">
        <div className="admin-ai-readout-summary">
          <span>
            <strong>{rows.length}</strong>
            <em>profiles</em>
          </span>
          <span>
            <strong>{usableCount}</strong>
            <em>usable</em>
          </span>
          <span>
            <strong>{thinCount}</strong>
            <em>thin</em>
          </span>
          <span>
            <strong>{highestActivity?.activityScore || 0}</strong>
            <em>top activity</em>
          </span>
        </div>

        <div className="admin-schedule-edge-table-wrap">
          <table className="admin-schedule-edge-table admin-manager-personality-table">
            <thead>
              <tr>
                <th>Manager</th>
                <th>Trade Style</th>
                <th>Waiver Style</th>
                <th>Roster Habit</th>
                <th>Action Read</th>
                <th>Receipts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.manager}
                  className={`admin-ai-readout-row-${row.tone}`}
                >
                  <td>
                    <strong>{row.manager}</strong>
                    <span>{row.activityScore}% activity</span>
                    <em>{getManagerPersonalityToneLabel(row)}</em>
                  </td>
                  <td>{row.tradeStyle}</td>
                  <td>{row.waiverStyle}</td>
                  <td>{row.rosterStyle}</td>
                  <td>{row.actionRead}</td>
                  <td>
                    <div className="admin-ai-readout-chip-row">
                      {row.receipts.slice(0, 4).map(receipt => (
                        <em key={`${row.manager}-${receipt}`}>{receipt}</em>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="admin-ai-readout-clean">
          This table is hidden from normal users. It is a calibration surface for
          future manager-personality models, not a public leaguemate label yet.
        </p>
      </div>
    </CollapsibleReportSection>
  );
}
