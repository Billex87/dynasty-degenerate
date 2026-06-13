import { DashboardVisualMetric, type DashboardHeroMetric } from "@/features/report/components/ReportDashboardMetrics";
import { HeroTile } from "@/components/tiles";
import { STAGGER_STEP, StaggerGroup, StaggerItem } from "@/lib/motion";

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
  shouldAnimateMetrics?: boolean;
};

export function ReportOverviewHero({
  leagueName,
  activeTab,
  heroCopy,
  heroConfig,
  shouldAnimateMetrics = false,
}: ReportOverviewHeroProps) {
  const metricsClassName = `report-overview-metrics report-overview-metrics-${heroConfig.metrics.length}`;
  const metricTiles = heroConfig.metrics.map(metric => (
    <DashboardVisualMetric key={metric.key} metric={metric} />
  ));

  return (
    <HeroTile
      className="report-overview-hero"
      data-dashboard-tab={activeTab}
    >
      <div className="report-overview-hero-copy">
        <h2>
          {heroCopy.headline.split("\n").map(line => (
            <span key={line}>{line}</span>
          ))}
        </h2>
        <p className="report-overview-hero-subline">{heroCopy.subline}</p>
        <p>{heroCopy.body}</p>
      </div>
      {shouldAnimateMetrics ? (
        <StaggerGroup
          aria-label={`${leagueName} ${heroConfig.pillLabel.toLowerCase()}`}
          className={metricsClassName}
          data-dashboard-tab={activeTab}
          delayStepMs={STAGGER_STEP.base}
          key={`hero-metrics-${activeTab}`}
          y={14}
        >
          {heroConfig.metrics.map(metric => (
            <StaggerItem className="dd-motion-metric-item" key={metric.key}>
              <DashboardVisualMetric metric={metric} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : (
        <div
          className={metricsClassName}
          data-dashboard-tab={activeTab}
          aria-label={`${leagueName} ${heroConfig.pillLabel.toLowerCase()}`}
        >
          {metricTiles}
        </div>
      )}
    </HeroTile>
  );
}
