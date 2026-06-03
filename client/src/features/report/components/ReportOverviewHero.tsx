import { DashboardVisualMetric, type DashboardHeroMetric } from "@/features/report/components/ReportDashboardMetrics";
import { HeroTile } from "@/components/tiles";

export type ReportDashboardHeroCopy = {
  headline: string;
  subline: string;
  body: string;
};

type ReportOverviewHeroConfig = {
  pillLabel: string;
  pills: string[];
  metrics: DashboardHeroMetric[];
};

type ReportOverviewHeroProps = {
  leagueName: string;
  activeTab: string;
  heroCopy: ReportDashboardHeroCopy;
  heroConfig: ReportOverviewHeroConfig;
};

export function ReportOverviewHero({
  leagueName,
  activeTab,
  heroCopy,
  heroConfig,
}: ReportOverviewHeroProps) {
  return (
    <HeroTile
      className="report-overview-hero"
      data-dashboard-tab={activeTab}
    >
      <div className="report-overview-hero-copy">
        <h1>
          {heroCopy.headline.split("\n").map(line => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <p className="report-overview-hero-subline">{heroCopy.subline}</p>
        <p>{heroCopy.body}</p>
      </div>
      <div
        className={`report-overview-metrics report-overview-metrics-${heroConfig.metrics.length}`}
        data-dashboard-tab={activeTab}
        aria-label={`${leagueName} ${heroConfig.pillLabel.toLowerCase()}`}
      >
        {heroConfig.metrics.map(metric => (
          <DashboardVisualMetric key={metric.key} metric={metric} />
        ))}
      </div>
    </HeroTile>
  );
}
