import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BadgeCheck,
  BrainCircuit,
  CalendarClock,
  Camera,
  ChevronRight,
  CircleOff,
  Crosshair,
  LineChart,
  ListChecks,
  MoveRight,
  Radar,
  Repeat2,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIActionQueue } from '@/components/AIActionQueue';
import type { LeagueValueMode } from '@/lib/leagueValueMode';
import { buildAutopilotData, clampPercent, getDirectionTone, getRiskTone } from '@/lib/autopilot/buildAutopilotData';
import { AUTOPILOT_MOCK_DATA } from '@/lib/autopilot/mockData';
import type { AIMarketAnomalyRead, AIRejectionRead, AIReportCardRead, AutopilotData, AutopilotMode, AutopilotRecommendation, AutopilotScore, AutopilotTone, FuturePickTrajectory, LeaguePowerRow, PlayerProjection, WeeklyActionPlan, WeeklyRecapRead } from '@/lib/autopilot/types';
import type { ReportData } from '@shared/types';

function asArray<T>(value: T[] | undefined, fallback: T[] = []): T[] {
  return Array.isArray(value) ? value : fallback;
}

function normalizeRecommendation(
  recommendation: Partial<AutopilotRecommendation>,
  fallback: AutopilotRecommendation,
  index: number,
): AutopilotRecommendation {
  return {
    ...fallback,
    ...recommendation,
    id: recommendation.id || fallback.id || `autopilot-rec-${index}`,
    type: recommendation.type || fallback.type || 'Recommendation',
    player: recommendation.player || fallback.player || 'Player to review',
    action: recommendation.action || fallback.action || 'Review',
    confidence: Number.isFinite(recommendation.confidence) ? recommendation.confidence! : fallback.confidence,
    risk: recommendation.risk || fallback.risk || 'Medium',
    upside: recommendation.upside || fallback.upside || 'Medium',
    summary: recommendation.summary || fallback.summary || 'More context is needed before this recommendation is high confidence.',
    reasons: asArray(recommendation.reasons, fallback.reasons),
    signals: asArray(recommendation.signals, fallback.signals),
    tone: recommendation.tone || fallback.tone || 'info',
  };
}

function normalizeRecommendations(
  recommendations: AutopilotRecommendation[] | undefined,
  fallback: AutopilotRecommendation[],
): AutopilotRecommendation[] {
  if (!Array.isArray(recommendations)) return fallback;
  return recommendations.map((recommendation, index) =>
    normalizeRecommendation(recommendation, fallback[index] || fallback[0], index)
  );
}

function normalizeWeeklyPlan(
  plan: WeeklyActionPlan | undefined,
  fallback: WeeklyActionPlan | undefined,
): WeeklyActionPlan | undefined {
  if (!plan && !fallback) return undefined;
  const source = plan || fallback;
  if (!source) return undefined;
  return {
    ...source,
    starterToReview: source.starterToReview || null,
    options: asArray(source.options, fallback?.options),
    summary: source.summary || fallback?.summary || 'The weekly action plan will get sharper once more context is available.',
  };
}

function normalizeAutopilotData(
  data: AutopilotData | undefined,
  fallback: AutopilotData,
  mode: AutopilotMode,
): AutopilotData {
  const direction = data?.direction || fallback.direction;
  return {
    ...fallback,
    ...data,
    mode,
    headline: data?.headline || fallback.headline,
    direction: {
      ...fallback.direction,
      ...direction,
      scores: asArray(direction?.scores, fallback.direction.scores),
      actionPlan: asArray(direction?.actionPlan, fallback.direction.actionPlan),
    },
    systemRead: asArray(data?.systemRead, fallback.systemRead),
    actionQueue: asArray(data?.actionQueue, fallback.actionQueue).map((item, index) => ({
      ...item,
      rank: Number.isFinite(item.rank) ? item.rank : index + 1,
      blockers: asArray(item.blockers),
      missingEvidence: asArray(item.missingEvidence),
      sourceHealth: asArray(item.sourceHealth),
      receipts: asArray(item.receipts),
      changeTriggers: asArray(item.changeTriggers),
      dominoEffects: asArray(item.dominoEffects),
      signals: asArray(item.signals),
    })),
    lineup: normalizeRecommendations(data?.lineup, fallback.lineup),
    weeklyPlan: normalizeWeeklyPlan(data?.weeklyPlan, fallback.weeklyPlan),
    reportCard: data?.reportCard || fallback.reportCard,
    rejections: asArray(data?.rejections, fallback.rejections || []),
    marketAnomalies: asArray(data?.marketAnomalies, fallback.marketAnomalies || []),
    waivers: normalizeRecommendations(data?.waivers, fallback.waivers),
    trades: normalizeRecommendations(data?.trades, fallback.trades),
    projections: asArray(data?.projections, fallback.projections).map((projection, index) => ({
      ...fallback.projections[index],
      ...projection,
      player: projection.player || fallback.projections[index]?.player || 'Player to review',
      position: projection.position || fallback.projections[index]?.position || 'FLEX',
      direction: projection.direction || fallback.projections[index]?.direction || 'Stable',
      currentValue: projection.currentValue || fallback.projections[index]?.currentValue || 'Value pending',
      projectedMove: projection.projectedMove || fallback.projections[index]?.projectedMove || 'Hold',
      confidence: Number.isFinite(projection.confidence) ? projection.confidence : fallback.projections[index]?.confidence || 50,
      signals: asArray(projection.signals, fallback.projections[index]?.signals),
    })),
    power: asArray(data?.power, fallback.power),
    managerTendency: data?.managerTendency
      ? {
        ...data.managerTendency,
        signals: asArray(data.managerTendency.signals),
      }
      : fallback.managerTendency,
    scheduleTodo: asArray(data?.scheduleTodo, fallback.scheduleTodo),
  };
}

function ConfidenceMeter({
  value,
  label = 'Confidence',
  tone = 'info',
  compact = false,
}: {
  value: number;
  label?: string;
  tone?: AutopilotTone;
  compact?: boolean;
}) {
  const percent = clampPercent(value);
  return (
    <div className={cn('autopilot-confidence', compact && 'autopilot-confidence-compact', `autopilot-tone-${tone}`)}>
      <span>{label}</span>
      <strong>{percent}%</strong>
      <em role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`${label} ${percent}%`}>
        <i style={{ width: `${percent}%` }} />
      </em>
    </div>
  );
}

function SignalPills({ signals }: { signals: string[] }) {
  return (
    <div className="autopilot-signal-row">
      {signals.map((signal) => (
        <span key={signal}>{signal}</span>
      ))}
    </div>
  );
}

function SectionShell({
  eyebrow,
  title,
  icon: Icon,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('autopilot-section', className)}>
      <div className="autopilot-section-heading">
        <span>
          <Icon className="h-4 w-4" aria-hidden="true" />
          {eyebrow}
        </span>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ScoreTile({ score }: { score: AutopilotScore }) {
  const percent = clampPercent(score.value);
  return (
    <div className={cn('autopilot-score-tile', `autopilot-tone-${score.tone}`)}>
      <span>{score.label}</span>
      <strong>{percent}</strong>
      <em aria-hidden="true">
        <i style={{ width: `${percent}%` }} />
      </em>
    </div>
  );
}

function RecommendationCard({
  recommendation,
  allowTradeScreenshot = false,
}: {
  recommendation: AutopilotRecommendation;
  allowTradeScreenshot?: boolean;
}) {
  const [screenshotReady, setScreenshotReady] = useState(false);

  return (
    <article className={cn('autopilot-recommendation-card', screenshotReady && 'is-screenshot-ready', `autopilot-tone-${recommendation.tone}`)}>
      <div className="autopilot-card-topline">
        <span>{recommendation.type}</span>
        <ConfidenceMeter value={recommendation.confidence} tone={recommendation.tone} compact />
      </div>
      <div className="autopilot-card-main">
        <div>
          <span className="autopilot-action-label">{recommendation.action}</span>
          <h4>{recommendation.player}</h4>
          {recommendation.secondary && <p>{recommendation.secondary}</p>}
        </div>
      </div>
      <p className="autopilot-card-summary">{recommendation.summary}</p>
      <div className="autopilot-card-badges">
        <span className={cn('autopilot-risk-pill', `autopilot-tone-${getRiskTone(recommendation.risk)}`)}>Risk {recommendation.risk}</span>
        <span className="autopilot-upside-pill">Upside {recommendation.upside}</span>
      </div>
      <details className="autopilot-reasoning">
        <summary>
          Why the AI thinks this
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </summary>
        <ul>
          {recommendation.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <SignalPills signals={recommendation.signals} />
      </details>
      {allowTradeScreenshot && (
        <>
          <button
            type="button"
            className="autopilot-screenshot-button"
            aria-pressed={screenshotReady}
            onClick={() => setScreenshotReady((current) => !current)}
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            {screenshotReady ? 'Hide screenshot view' : 'Trade screenshot view'}
          </button>
          {screenshotReady && (
            <div className="autopilot-trade-shot" aria-label={`Screenshot-ready trade card for ${recommendation.player}`}>
              <span>{recommendation.action}</span>
              <strong>{recommendation.player}</strong>
              {recommendation.secondary && <p>{recommendation.secondary}</p>}
              <div>
                <em>{recommendation.confidence}% confidence</em>
                <em>Risk {recommendation.risk}</em>
                <em>Upside {recommendation.upside}</em>
              </div>
            </div>
          )}
        </>
      )}
    </article>
  );
}

function WeeklyActionPlanCard({ plan }: { plan?: WeeklyActionPlan }) {
  if (!plan) return null;
  const starter = plan.starterToReview;

  return (
    <div className="autopilot-weekly-plan">
      <div className={cn('autopilot-pull-card', starter && `autopilot-tone-${starter.tone}`)}>
        <span className="autopilot-pull-label">
          <CircleOff className="h-4 w-4" aria-hidden="true" />
          {starter ? 'Take me out' : 'No forced pull'}
        </span>
        <strong>{starter?.player || 'No starter flagged'}</strong>
        <p>{starter?.note || 'The current data does not force a lineup swap yet.'}</p>
        {starter && <ConfidenceMeter value={starter.confidence} label="Swap pressure" tone={starter.tone} compact />}
      </div>

      <div className="autopilot-start-options">
        <span>Start-over options</span>
        <div>
          {plan.options.map((option) => (
            <article key={`${option.player}-${option.confidence}`} className={cn('autopilot-start-option', `autopilot-tone-${option.tone}`)}>
              <div>
                <span>{option.position}</span>
                <strong>{option.player}</strong>
                <p>{option.note}</p>
              </div>
              <MoveRight className="h-4 w-4" aria-hidden="true" />
              <strong>{option.confidence}%</strong>
              <em aria-hidden="true">
                <i style={{ width: `${clampPercent(option.confidence)}%` }} />
              </em>
            </article>
          ))}
        </div>
      </div>

      <p className="autopilot-weekly-summary">{plan.summary}</p>
    </div>
  );
}

function WeeklyRecapCard({ recap }: { recap?: WeeklyRecapRead }) {
  if (!recap) return null;

  return (
    <div className="autopilot-weekly-recap">
      <div className="autopilot-weekly-recap-lead">
        <span>Best weekly correction</span>
        <strong>{recap.headline}</strong>
        <p>{recap.summary}</p>
      </div>
      {recap.startSitCalls.length > 0 && (
        <div className="autopilot-recap-call-grid">
          {recap.startSitCalls.map((call) => (
            <article key={`${call.start}-${call.sit}`} className={cn('autopilot-recap-call', `autopilot-tone-${call.tone}`)}>
              <span>Start over</span>
              <div>
                <strong>{call.start}</strong>
                <MoveRight className="h-4 w-4" aria-hidden="true" />
                <em>{call.sit}</em>
              </div>
              <ConfidenceMeter value={call.confidence} tone={call.tone} compact />
              <p>{call.note}</p>
            </article>
          ))}
        </div>
      )}
      <div className="autopilot-recap-notes">
        {[...recap.waiverNotes, ...recap.tradeNotes].slice(0, 4).map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </div>
  );
}

function AIReportCardPanel({ reportCard }: { reportCard?: AIReportCardRead }) {
  if (!reportCard) return null;

  return (
    <article className={cn('autopilot-edge-card autopilot-report-card', `autopilot-tone-${reportCard.tone}`)}>
      <div className="autopilot-edge-card-head">
        <span>Weekly AI report card</span>
        <strong>{reportCard.grade}</strong>
      </div>
      <p>{reportCard.summary}</p>
      <ConfidenceMeter value={reportCard.confidence} label="League confidence" tone={reportCard.tone} compact />
      <div className="autopilot-report-card-rows">
        {reportCard.rows.slice(0, 6).map((row) => (
          <div key={row.label} className={cn('autopilot-report-card-row', `autopilot-tone-${row.tone}`)}>
            <span>{row.label}</span>
            <strong>{row.status}</strong>
            <p>{row.detail}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function BadIdeaPanel({ rejections }: { rejections: AIRejectionRead[] }) {
  return (
    <article className="autopilot-edge-card autopilot-bad-idea-card">
      <div className="autopilot-edge-card-head">
        <span>Bad idea alert</span>
        <strong>{rejections.length ? `${rejections.length} blocked` : 'Clean'}</strong>
      </div>
      <p>
        {rejections.length
          ? 'The AI is doing the annoying but useful thing: refusing moves that do not clear the evidence bar.'
          : 'No bad idea is loud enough to block from this read.'}
      </p>
      <div className="autopilot-edge-list">
        {rejections.slice(0, 4).map((row) => (
          <article key={row.id} className={cn('autopilot-edge-row', `autopilot-tone-${row.tone}`)}>
            <div>
              <span>{row.action}</span>
              <strong>{row.target}</strong>
            </div>
            <p>{row.reason}</p>
            <em>{row.alternative}</em>
            <SignalPills signals={row.receipts} />
          </article>
        ))}
      </div>
    </article>
  );
}

function MarketAnomalyPanel({ anomalies }: { anomalies: AIMarketAnomalyRead[] }) {
  return (
    <article className="autopilot-edge-card autopilot-market-anomaly-card">
      <div className="autopilot-edge-card-head">
        <span>Market anomaly scan</span>
        <strong>{anomalies.length ? `${anomalies.length} flagged` : 'Quiet'}</strong>
      </div>
      <p>
        {anomalies.length
          ? 'These are the players where market movement, roster status, and evidence do not fully agree.'
          : 'No market mismatch is strong enough to interrupt the verdict.'}
      </p>
      <div className="autopilot-edge-list">
        {anomalies.slice(0, 4).map((row) => (
          <article key={row.id} className={cn('autopilot-edge-row', `autopilot-tone-${row.tone}`)}>
            <div>
              <span>{row.label}</span>
              <strong>{row.player}</strong>
            </div>
            <p>{row.summary}</p>
            <em>{row.suggestedAction}</em>
            <ConfidenceMeter value={row.confidence} label={row.position} tone={row.tone} compact />
          </article>
        ))}
      </div>
    </article>
  );
}

function AIEdgeReview({
  reportCard,
  rejections,
  marketAnomalies,
}: {
  reportCard?: AIReportCardRead;
  rejections: AIRejectionRead[];
  marketAnomalies: AIMarketAnomalyRead[];
}) {
  if (!reportCard && !rejections.length && !marketAnomalies.length) return null;

  return (
    <div className="autopilot-edge-review">
      <AIReportCardPanel reportCard={reportCard} />
      <BadIdeaPanel rejections={rejections} />
      <MarketAnomalyPanel anomalies={marketAnomalies} />
    </div>
  );
}

function FuturePickTrajectoryCard({ trajectory }: { trajectory?: FuturePickTrajectory }) {
  if (!trajectory) return null;
  const maxValue = Math.max(...trajectory.points.map((point) => point.value), 1);

  return (
    <div className="autopilot-pick-trajectory">
      <div className="autopilot-pick-trajectory-summary">
        <span>{trajectory.manager} pick market</span>
        <strong>{trajectory.currentRank ? `Pick value rank #${trajectory.currentRank}` : 'Pick value tracking'}</strong>
        <p>{trajectory.note}</p>
      </div>
      <div className="autopilot-pick-chart" aria-label="Future pick value trajectory">
        {trajectory.points.map((point) => (
          <span key={point.label}>
            <i style={{ height: `${Math.max(10, (point.value / maxValue) * 100)}%` }} />
            <em>{point.label}</em>
            <strong>{point.value.toLocaleString()}</strong>
          </span>
        ))}
      </div>
      <div className="autopilot-pick-tier-read">
        <span>Likely rookie range</span>
        <strong>{trajectory.likelyRookieRange}</strong>
      </div>
      {trajectory.picks.length > 0 && (
        <div className="autopilot-pick-list">
          {trajectory.picks.map((pick) => (
            <article key={pick.label}>
              <div>
                <strong>{pick.label}</strong>
                <span>{pick.projectedBand} slot</span>
              </div>
              <p>{pick.rookieTier}</p>
              <em>{pick.value.toLocaleString()}</em>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectionRow({ projection }: { projection: PlayerProjection }) {
  const tone = getDirectionTone(projection.direction);
  const Icon = projection.direction === 'Rising' ? TrendingUp : projection.direction === 'Falling' ? TrendingDown : Activity;
  return (
    <article className={cn('autopilot-projection-row', `autopilot-tone-${tone}`)}>
      <div className="autopilot-projection-player">
        <span>{projection.position}</span>
        <strong>{projection.player}</strong>
      </div>
      <div className="autopilot-projection-status">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{projection.direction}</span>
        <strong>{projection.projectedMove}</strong>
      </div>
      <div className="autopilot-projection-value">
        <span>Current</span>
        <strong>{projection.currentValue}</strong>
      </div>
      <ConfidenceMeter value={projection.confidence} tone={tone} compact />
      <SignalPills signals={projection.signals} />
    </article>
  );
}

function PowerRow({ row }: { row: LeaguePowerRow }) {
  return (
    <article className={cn('autopilot-power-row', `autopilot-tone-${row.tone}`)}>
      <span className="autopilot-power-rank">#{row.rank}</span>
      <div>
        <strong>{row.team}</strong>
        <span>{row.direction}</span>
      </div>
      <ConfidenceMeter value={row.score} label="Power" tone={row.tone} compact />
      <p>{row.note}</p>
    </article>
  );
}

function ModeButton({
  mode,
  active,
  children,
  onClick,
}: {
  mode: AutopilotMode;
  active: boolean;
  children: ReactNode;
  onClick: (mode: AutopilotMode) => void;
}) {
  return (
    <button
      type="button"
      className={cn('autopilot-mode-button', active && 'is-active')}
      aria-pressed={active}
      onClick={() => onClick(mode)}
    >
      {children}
    </button>
  );
}

function renderBreakableHeadlineToken(value: string) {
  if (value.length <= 16) return value;
  const chunks = value.match(/.{1,12}/g) || [value];
  return chunks.map((chunk, index) => (
    <span key={`${chunk}-${index}`}>
      {chunk}
      {index < chunks.length - 1 ? <wbr /> : null}
    </span>
  ));
}

function renderAutopilotHeadline(headline: string, manager?: string | null) {
  const normalizedManager = manager?.trim();
  if (
    !normalizedManager ||
    !headline.toLowerCase().startsWith(normalizedManager.toLowerCase())
  ) {
    return headline;
  }

  const rest = headline.slice(normalizedManager.length);
  return (
    <>
      <span className="autopilot-headline-manager">
        {renderBreakableHeadlineToken(normalizedManager)}
      </span>
      {rest}
    </>
  );
}

export default function AITeamAutopilot({
  reportData,
  leagueId,
  leagueName,
  leagueFormat,
  leagueValueMode,
}: {
  reportData?: ReportData;
  leagueId?: string | null;
  leagueName?: string;
  leagueFormat?: string;
  leagueValueMode?: LeagueValueMode;
}) {
  const initialMode = leagueValueMode === 'redraft' ? 'redraft' : 'dynasty';
  const [mode, setMode] = useState<AutopilotMode>(initialMode);
  const isRedraftLocked = leagueValueMode === 'redraft';

  useEffect(() => {
    if (isRedraftLocked && mode !== 'redraft') {
      setMode('redraft');
    }
  }, [isRedraftLocked, mode]);

  const data = useMemo(() => {
    const fallback = AUTOPILOT_MOCK_DATA[mode];
    try {
      return normalizeAutopilotData(
        buildAutopilotData({ reportData, mode, fallback, leagueId }),
        fallback,
        mode,
      );
    } catch (error) {
      console.error('AI Autopilot failed to build report data.', error);
      return fallback;
    }
  }, [mode, reportData]);

  return (
    <section className="autopilot-dashboard" data-mode={mode}>
      <div className="autopilot-hero">
        <div className="autopilot-hero-copy">
          <span className="autopilot-system-badge">
            <BrainCircuit className="h-4 w-4" aria-hidden="true" />
            AI Team Autopilot
          </span>
          <h2>{renderAutopilotHeadline(data.headline, data.focusManager)}</h2>
          <p>{data.focusManager ? `${data.focusManager} read` : leagueName || 'Selected league'}{leagueFormat ? ` · ${leagueFormat}` : ''}</p>
        </div>
        {!isRedraftLocked && (
          <div className="autopilot-mode-toggle" aria-label="Autopilot league mode">
            <ModeButton mode="dynasty" active={mode === 'dynasty'} onClick={setMode}>Dynasty</ModeButton>
            <ModeButton mode="redraft" active={mode === 'redraft'} onClick={setMode}>Redraft</ModeButton>
          </div>
        )}
      </div>

      <div className="autopilot-status-grid">
        {data.systemRead.map((score) => (
          <ScoreTile key={score.label} score={score} />
        ))}
      </div>

      <AIActionQueue
        items={data.actionQueue}
        title="Daily AI Verdict"
        subtitle="The one place where Autopilot decides: act, watch, hold, or block."
        memoryKey={`autopilot:${mode}:${data.focusManager || leagueName || 'league'}`}
        memoryContext={`AI Autopilot · ${data.focusManager || leagueName || 'League'}`}
      />

      <SectionShell eyebrow="AI Edge Review" title="Rejections, anomalies, and calibration" icon={ShieldAlert} className="autopilot-section-wide">
        <AIEdgeReview
          reportCard={data.reportCard}
          rejections={data.rejections}
          marketAnomalies={data.marketAnomalies}
        />
      </SectionShell>

      <section className="autopilot-direction-panel">
        <div className="autopilot-direction-read">
          <span>Team Direction</span>
          <h3>{data.direction.label}</h3>
          <p>{data.direction.summary}</p>
          <ConfidenceMeter value={data.direction.confidence} tone="good" />
        </div>
        <div className="autopilot-direction-scores">
          {data.direction.scores.map((score) => (
            <ScoreTile key={score.label} score={score} />
          ))}
        </div>
        <div className="autopilot-strategy-card">
          <span>Suggested strategy</span>
          <p>{data.direction.strategy}</p>
          <ul>
            {data.direction.actionPlan.map((item) => (
              <li key={item}>
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="autopilot-command-strip">
        <div>
          <span>Weekly plan</span>
          <strong>{data.weeklyPlan?.options?.length ? `${data.weeklyPlan.options.length} start-over options` : 'No forced swap'}</strong>
        </div>
        <div>
          <span>Action queue</span>
          <strong>{data.actionQueue.length ? `${data.actionQueue.length} ranked reads` : 'No forced action'}</strong>
        </div>
        <div>
          <span>Trade screenshots</span>
          <strong>{data.trades.length ? `${data.trades.length} offers ready` : 'No trade cards'}</strong>
        </div>
        <div>
          <span>Backend phase</span>
          <strong>{data.dataStatus || 'Live'}</strong>
        </div>
      </div>

      <div className="autopilot-main-grid">
        <SectionShell eyebrow="Weekly Action Plan" title="Start-over calls" icon={ListChecks}>
          <WeeklyActionPlanCard plan={data.weeklyPlan} />
          <WeeklyRecapCard recap={data.weeklyRecap} />
          <div className="autopilot-card-grid">
            {data.lineup.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
              />
            ))}
          </div>
        </SectionShell>

        {mode === 'dynasty' && data.futurePickTrajectory && (
          <SectionShell eyebrow="Future Pick Market" title="Pick value and rookie range" icon={LineChart}>
            <FuturePickTrajectoryCard trajectory={data.futurePickTrajectory} />
          </SectionShell>
        )}

        <SectionShell eyebrow="Waiver Wire Targets" title="Pickups, drops, and FAAB posture" icon={Zap}>
          <div className="autopilot-card-grid">
            {data.waivers.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
              />
            ))}
          </div>
        </SectionShell>

        <SectionShell eyebrow="Trade Finder" title={mode === 'dynasty' ? 'Buy future value, sell fragile windows' : 'Turn depth into weekly points'} icon={Repeat2}>
          <div className="autopilot-card-grid">
            {data.trades.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                allowTradeScreenshot
              />
            ))}
          </div>
        </SectionShell>

        <SectionShell eyebrow="Player Value Projection" title="Rising, falling, and stable profiles" icon={LineChart} className="autopilot-section-wide">
          <div className="autopilot-projection-list">
            {data.projections.map((projection) => (
              <ProjectionRow key={`${projection.player}-${projection.direction}`} projection={projection} />
            ))}
          </div>
        </SectionShell>

        <SectionShell eyebrow="League Power Analysis" title="Contenders, rebuilders, and trade partners" icon={Radar}>
          <div className="autopilot-power-list">
            {data.power.map((row) => (
              <PowerRow key={`${row.rank}-${row.team}`} row={row} />
            ))}
          </div>
        </SectionShell>

        {data.managerTendency && (
          <SectionShell eyebrow="Manager Tendency Model" title={data.managerTendency.label} icon={BrainCircuit}>
            <p className="autopilot-tendency-summary">{data.managerTendency.summary}</p>
            <div className="autopilot-tendency-scores">
              <ScoreTile score={{ label: 'History depth', value: data.managerTendency.historyDepthScore, tone: data.managerTendency.historyDepthScore >= 62 ? 'good' : 'warn' }} />
              <ScoreTile score={{ label: 'Trade activity', value: data.managerTendency.tradeActivityScore, tone: data.managerTendency.tradeActivityScore >= 70 ? 'good' : 'info' }} />
              <ScoreTile score={{ label: 'Waiver activity', value: data.managerTendency.waiverActivityScore, tone: data.managerTendency.waiverActivityScore >= 70 ? 'good' : 'info' }} />
              <ScoreTile score={{ label: 'Risk tolerance', value: data.managerTendency.riskToleranceScore, tone: data.managerTendency.riskToleranceScore >= 70 ? 'warn' : 'info' }} />
            </div>
            <SignalPills signals={data.managerTendency.signals} />
          </SectionShell>
        )}

        <SectionShell eyebrow="Matchup Planning" title="Schedule and SOS context" icon={CalendarClock}>
          <div className="autopilot-schedule-panel">
            <div className="autopilot-schedule-icon" aria-hidden="true">
              <Target className="h-7 w-7" />
            </div>
            <ul>
              {data.scheduleTodo.map((todo) => (
                <li key={todo}>
                  <Crosshair className="h-4 w-4" aria-hidden="true" />
                  {todo}
                </li>
              ))}
            </ul>
            <div className="autopilot-future-stack">
              <span>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Schedule signal
              </span>
              <strong>Strength of schedule</strong>
            </div>
          </div>
        </SectionShell>
      </div>

      <div className="autopilot-footer-read">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        <p>{reportData ? 'This Autopilot read is generated from the current report data: rosters, manager intel, power ranks, waiver signals, value movement, trade context, and any matchup previews available.' : 'Phase 1 uses structured mock recommendations. The component is shaped so later phases can replace this data with Sleeper rosters, ranking blends, usage feeds, long-term manager tendencies, and schedule strength.'}</p>
      </div>
    </section>
  );
}
