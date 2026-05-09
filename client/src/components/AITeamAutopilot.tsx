import { useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BadgeCheck,
  BrainCircuit,
  CalendarClock,
  ChevronRight,
  Crosshair,
  LineChart,
  ListChecks,
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
import type { LeagueValueMode } from '@/lib/leagueValueMode';
import { buildAutopilotData, clampPercent, getDirectionTone, getRiskTone } from '@/lib/autopilot/buildAutopilotData';
import { AUTOPILOT_MOCK_DATA } from '@/lib/autopilot/mockData';
import type { AutopilotMode, AutopilotRecommendation, AutopilotScore, AutopilotTone, LeaguePowerRow, PlayerProjection } from '@/lib/autopilot/types';
import type { ReportData } from '@shared/types';

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
  queued,
  onToggleQueue,
}: {
  recommendation: AutopilotRecommendation;
  queued: boolean;
  onToggleQueue: (id: string) => void;
}) {
  return (
    <article className={cn('autopilot-recommendation-card', `autopilot-tone-${recommendation.tone}`)}>
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
      <button
        type="button"
        className={cn('autopilot-action-button', queued && 'is-queued')}
        aria-pressed={queued}
        onClick={() => onToggleQueue(recommendation.id)}
      >
        {queued ? 'Queued' : 'Queue action'}
      </button>
    </article>
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

export default function AITeamAutopilot({
  reportData,
  leagueName,
  leagueFormat,
  leagueValueMode,
}: {
  reportData?: ReportData;
  leagueName?: string;
  leagueFormat?: string;
  leagueValueMode?: LeagueValueMode;
}) {
  const initialMode = leagueValueMode === 'redraft' ? 'redraft' : 'dynasty';
  const [mode, setMode] = useState<AutopilotMode>(initialMode);
  const [queuedIds, setQueuedIds] = useState<Set<string>>(() => new Set());
  const data = useMemo(
    () => buildAutopilotData({ reportData, mode, fallback: AUTOPILOT_MOCK_DATA[mode] }),
    [mode, reportData]
  );
  const queuedCount = queuedIds.size;
  const allRecommendations = useMemo(
    () => [...data.lineup, ...data.waivers, ...data.trades],
    [data]
  );

  const toggleQueue = (id: string) => {
    setQueuedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section className="autopilot-dashboard" data-mode={mode}>
      <div className="autopilot-hero">
        <div className="autopilot-hero-copy">
          <span className="autopilot-system-badge">
            <BrainCircuit className="h-4 w-4" aria-hidden="true" />
            AI Team Autopilot
          </span>
          <h2>{data.headline}</h2>
          <p>{data.focusManager ? `${data.focusManager} read` : leagueName || 'Selected league'}{leagueFormat ? ` · ${leagueFormat}` : ''}</p>
        </div>
        <div className="autopilot-mode-toggle" aria-label="Autopilot league mode">
          <ModeButton mode="dynasty" active={mode === 'dynasty'} onClick={setMode}>Dynasty</ModeButton>
          <ModeButton mode="redraft" active={mode === 'redraft'} onClick={setMode}>Redraft</ModeButton>
        </div>
      </div>

      <div className="autopilot-status-grid">
        {data.systemRead.map((score) => (
          <ScoreTile key={score.label} score={score} />
        ))}
      </div>

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
          <span>Action plan</span>
          <strong>{queuedCount ? `${queuedCount} queued` : 'Nothing queued'}</strong>
        </div>
        <div>
          <span>Recommendation set</span>
          <strong>{allRecommendations.length} cards</strong>
        </div>
        <div>
          <span>Backend phase</span>
          <strong>{data.dataStatus || 'Mock data'}</strong>
        </div>
      </div>

      <div className="autopilot-main-grid">
        <SectionShell eyebrow="Weekly Lineup Assistant" title="Start, bench, and flex calls" icon={ListChecks}>
          <div className="autopilot-card-grid">
            {data.lineup.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                queued={queuedIds.has(recommendation.id)}
                onToggleQueue={toggleQueue}
              />
            ))}
          </div>
        </SectionShell>

        <SectionShell eyebrow="Waiver Wire Targets" title="Pickups, drops, and FAAB posture" icon={Zap}>
          <div className="autopilot-card-grid">
            {data.waivers.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                queued={queuedIds.has(recommendation.id)}
                onToggleQueue={toggleQueue}
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
                queued={queuedIds.has(recommendation.id)}
                onToggleQueue={toggleQueue}
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

        <SectionShell eyebrow="Future Schedule/SOS TODO" title="Matchups come next" icon={CalendarClock}>
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
                Phase 5 input
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
