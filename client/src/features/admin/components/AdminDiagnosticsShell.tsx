import type { ReportData } from "@shared/types";
import {
  AdminAIReadoutDiagnosticsSection,
} from "@/features/admin/components/AdminAIReadoutSections";
import { AdminAICalibrationSection } from "@/features/admin/components/AdminCalibrationSections";
import { AdminSourceCoverageSection } from "@/features/admin/components/AdminSourceCoverageSections";
import { AdminLeagueSharpnessSection } from "@/features/admin/components/AdminReadoutSections";
import { AdminManagerPersonalityIntelSection } from "@/features/admin/components/AdminReadoutSections";
import { AdminValueDiagnosticsSection } from "@/features/admin/components/AdminValueDiagnosticsSections";
import { AdminProviderTelemetrySection, AdminTrafficTelemetrySection } from "@/features/admin/components/AdminTrafficSections";
import { AdminPlayerReceiptDiagnosticsSection } from "@/features/admin/components/AdminPlayerReceiptSections";

type AdminDiagnosticsShellProps = {
  reportData: ReportData;
  onLeagueSelect: (leagueId: string) => void | Promise<void>;
};

export function AdminDiagnosticsShell({
  reportData,
  onLeagueSelect,
}: AdminDiagnosticsShellProps) {
  return (
    <section
      className="admin-diagnostics-shell ai-surface-r3f admin-diagnostics-shell-tron"
      aria-label="Admin diagnostics"
    >
      <div className="admin-diagnostics-shell-header">
        <span>Admin Diagnostics</span>
        <p>
          Operational checks separated from the league report so normal owner
          analysis stays focused.
        </p>
      </div>
      <AdminAICalibrationSection />
      <AdminProviderTelemetrySection />
      <AdminSourceCoverageSection />
      <AdminTrafficTelemetrySection onLeagueSelect={onLeagueSelect} />
      <AdminValueDiagnosticsSection reportData={reportData} />
      <AdminLeagueSharpnessSection reportData={reportData} />
      <AdminManagerPersonalityIntelSection reportData={reportData} />
      <AdminAIReadoutDiagnosticsSection reportData={reportData} />
      <AdminPlayerReceiptDiagnosticsSection reportData={reportData} />
    </section>
  );
}
