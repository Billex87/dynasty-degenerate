import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import {
  BarChart3,
  Box,
  BrainCircuit,
  Filter,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AITronSurface, type AITronDensity, type AITronTheme } from '@/components/AITronSurface';
import { buildAIReadDecision, type AIReadDecision } from '@/lib/aiReadDecision';
import {
  getVoicedAIConfidenceLabel,
  getVoicedAIReadDecision,
} from '@/lib/aiVoice';
import { cn } from '@/lib/utils';
import type { AIEvidenceResult } from '@shared/aiEvidenceEngine';

export type AIReadSeverity = 'neutral' | 'good' | 'info' | 'warn' | 'danger';
export type AIReadBackgroundVariant =
  | 'blueprint'
  | 'roster'
  | 'trade'
  | 'market'
  | 'draft'
  | 'lineup'
  | 'waiver'
  | 'league'
  | 'monthly';

export type AIReadChip =
  | string
  | {
      label: string;
      tone?: AIReadSeverity;
    };

export type AIReadAction = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
};

export interface AIReadPanelProps {
  title: string;
  subtitle?: string;
  readType?: string;
  confidence?: number | null;
  confidenceNote?: string | null;
  decision?: string | AIReadDecision | null;
  evidenceRead?: AIEvidenceResult | null;
  hideDecision?: boolean;
  traceLabel?: string;
  traceItems?: string[];
  severity?: AIReadSeverity;
  chips?: AIReadChip[];
  body: ReactNode;
  actions?: AIReadAction[];
  compact?: boolean;
  mobileDefaultOpen?: boolean;
  quietMode?: boolean;
  backgroundVariant?: AIReadBackgroundVariant;
  className?: string;
}

function normalizeConfidence(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getConfidenceLabel(value: number): string {
  return getVoicedAIConfidenceLabel(value);
}

function getDefaultConfidenceNote(value: number): string {
  if (value >= 78) return 'Strong source mix.';
  if (value >= 62) return 'Usable source mix.';
  if (value >= 46) return 'Directional read.';
  return 'Verify before acting.';
}

function renderChip(chip: AIReadChip, index: number) {
  const label = typeof chip === 'string' ? chip : chip.label;
  const tone = typeof chip === 'string' ? 'neutral' : chip.tone || 'neutral';

  return (
    <span key={`${label}-${tone}-${index}`} className={cn('ai-read-chip', `ai-read-chip-${tone}`)}>
      {label}
    </span>
  );
}

function getVisibleTraceItems(traceItems?: string[]) {
  return (traceItems || [])
    .map(item => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 4);
}

function getVerificationTraceItems(evidenceRead?: AIEvidenceResult | null) {
  if (!evidenceRead) return [];
  const sourceItems = evidenceRead.sourceTrace.map(trace =>
    [
      trace.label,
      trace.status ? `(${trace.status})` : null,
      trace.detail,
    ]
      .filter(Boolean)
      .join(' ')
  );
  const blockerItems = evidenceRead.hardBlockers.map(item => `Blocked: ${item}`);
  const missingItems = evidenceRead.missingEvidence.map(item => `Missing: ${item}`);
  const capItem = evidenceRead.confidenceCapReason
    ? `Confidence cap: ${evidenceRead.confidenceCap}% from ${evidenceRead.confidenceCapReason}`
    : null;
  const items = [...sourceItems, ...blockerItems, ...missingItems, capItem]
    .map(item => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const uniqueItems = Array.from(new Set(items));
  if (uniqueItems.length) return uniqueItems.slice(0, 4);
  return ['Verify current roster, availability, league format, and source freshness before acting.'];
}

function getVisibleDecisionForPanel({
  props,
  severity,
  visibleTraceItems,
}: {
  props: AIReadPanelProps;
  severity: AIReadSeverity;
  visibleTraceItems: string[];
}): AIReadDecision | null {
  if (props.hideDecision) return null;
  const normalizedConfidence = normalizeConfidence(props.confidence);
  const displayedConfidenceNote =
    normalizedConfidence === null ? null : props.confidenceNote || getDefaultConfidenceNote(normalizedConfidence);

  return buildAIReadDecision({
    decision: props.decision,
    evidenceRead: props.evidenceRead,
    confidence: normalizedConfidence,
    confidenceNote: displayedConfidenceNote,
    severity,
    hasEnabledAction: Boolean(props.actions?.some(action => action.onClick && !action.disabled)),
    hasEvidenceHints: Boolean(visibleTraceItems.length || props.chips?.length),
  });
}

function hasUsefulQuietEvidence({
  props,
  visibleTraceItems,
}: {
  props: AIReadPanelProps;
  visibleTraceItems: string[];
}): boolean {
  const evidence = props.evidenceRead;
  const hasWarnChip = Boolean(props.chips?.some(chip => typeof chip !== 'string' && (chip.tone === 'warn' || chip.tone === 'danger')));
  const hasBadTrace = Boolean(evidence?.sourceTrace?.some(trace =>
    trace.status === 'missing' ||
    trace.status === 'stale' ||
    trace.status === 'error' ||
    trace.status === 'limited'
  ));

  return Boolean(
    visibleTraceItems.length ||
      evidence?.hardBlockers?.length ||
      evidence?.missingEvidence?.length ||
      evidence?.confidenceCapReason ||
      hasBadTrace ||
      hasWarnChip ||
      props.actions?.some(action => action.onClick && !action.disabled)
  );
}

function shouldRenderAIReadPanel({
  props,
  severity,
}: {
  props: AIReadPanelProps;
  severity: AIReadSeverity;
}): boolean {
  if (props.quietMode === false) return true;

  const visibleTraceItems = getVisibleTraceItems(props.traceItems);
  const decision = getVisibleDecisionForPanel({ props, severity, visibleTraceItems });
  const label = decision?.label.toLowerCase() || '';
  const isBinaryDecision =
    label.includes('do this') ||
    label.includes('do not') ||
    label.includes("don't") ||
    label.includes('insufficient') ||
    label.includes('no move') ||
    label.includes('blocked');
  if (isBinaryDecision) return true;

  if (decision?.tone === 'go' || decision?.tone === 'stop' || decision?.tone === 'thin') return true;
  return hasUsefulQuietEvidence({ props, visibleTraceItems });
}

function getAITronTheme(variant: AIReadBackgroundVariant, severity: AIReadSeverity): AITronTheme {
  if (severity === 'danger') return 'red';
  if (severity === 'good') return 'green';
  if (severity === 'warn') return 'amber';

  switch (variant) {
    case 'roster':
    case 'lineup':
      return 'green';
    case 'market':
    case 'draft':
    case 'monthly':
      return 'amber';
    case 'trade':
      return 'blue';
    case 'waiver':
      return 'cyan';
    case 'league':
      return 'blue';
    case 'blueprint':
    default:
      return 'cyan';
  }
}

function getAIReadIcon(title: string, variant: AIReadBackgroundVariant) {
  const key = `${variant} ${title}`.toLowerCase();

  if (key.includes('roster')) return Users;
  if (key.includes('market') || key.includes('pick')) return BarChart3;
  if (key.includes('trade')) return Box;
  if (key.includes('guardrail') || key.includes('protection')) return ShieldCheck;
  if (key.includes('leverage') || key.includes('target')) return Target;
  if (key.includes('churn')) return RefreshCw;
  if (key.includes('offer') || key.includes('filter')) return Filter;
  if (key.includes('risk')) return LockKeyhole;
  if (key.includes('upside') || key.includes('signal')) return TrendingUp;

  return BrainCircuit;
}

function hashCircuitKey(value: string): number {
  return value.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0, 2166136261);
}

function buildCircuitLayout(routeKey: string) {
  const hash = hashCircuitKey(routeKey);
  const pick = (slot: number, values: number[]) => {
    const rotated = hash >>> ((slot * 5) % 24);
    return values[(rotated + slot) % values.length];
  };
  const lowerY = pick(0, [82, 84, 86, 88, 90]);
  const lowerRise = pick(1, [8, 10, 12, 14]);
  const lowerA = pick(2, [16, 20, 24, 28]);
  const lowerB = pick(3, [38, 42, 46, 52]);
  const lowerC = pick(4, [61, 66, 70, 74]);
  const lowerEndY = Math.max(48, lowerY - lowerRise - pick(5, [6, 10, 14, 18]));
  const rightTopX = pick(6, [76, 80, 84, 88]);
  const rightMidY = pick(7, [28, 34, 40, 48]);
  const rightLowY = pick(8, [58, 64, 70, 76]);
  const topY = pick(9, [10, 13, 16, 19, 22]);
  const topBreak = pick(10, [42, 48, 54, 60]);
  const topEndY = topY + pick(11, [6, 8, 10, 12]);
  const extraY = pick(12, [32, 38, 44, 52, 58]);
  const orangeBottomY = pick(13, [91, 93, 95, 97]);
  const cyanDuration = pick(14, [5.2, 5.8, 6.4, 7.1]);
  const orangeDuration = pick(15, [5.9, 6.6, 7.5, 8.2]);
  const topDuration = pick(16, [6.8, 7.7, 8.6, 9.4]);

  const lower = `M 3 ${lowerY} H ${lowerA} V ${lowerY - lowerRise} H ${lowerB} L ${lowerB + 8} ${lowerY - lowerRise - 7} H ${lowerC} L ${lowerC + 9} ${lowerEndY} H 96`;
  const top = `M ${pick(17, [8, 11, 14])} ${topY} H ${topBreak} L ${topBreak + 8} ${topEndY} H ${pick(18, [76, 82, 88])} V ${topEndY + pick(19, [6, 9, 12])} H 96`;
  const amberMode = (hash >>> 13) % 4;
  const amberSideX = pick(22, [88, 91, 94]);
  const amberStepY = rightLowY + pick(23, [10, 13, 16]);
  const rightDropA = pick(20, [12, 16, 20]);
  const rightStepX = pick(21, [88, 91, 94]);
  let right = `M 94 4 H ${rightTopX} V ${rightDropA} H ${rightStepX} V ${rightMidY} H 98 V ${rightLowY} H ${amberSideX} V ${amberStepY} H 98`;
  let amberNodes = [
    { x: 98, y: rightMidY },
    { x: amberSideX, y: rightLowY },
    { x: 98, y: amberStepY },
  ];

  if (amberMode === 1) {
    const edgeX = pick(33, [92, 95, 97]);
    const topEdgeY = pick(34, [7, 10, 13]);
    const midEdgeY = pick(35, [28, 34, 40]);
    const lowEdgeY = pick(36, [60, 66, 72]);
    const innerX = pick(37, [76, 82, 88]);
    const notchY = lowEdgeY + pick(38, [9, 12, 15]);
    right = `M ${innerX} ${topEdgeY} H ${edgeX} V ${midEdgeY} H 98 V ${lowEdgeY} H ${innerX} V ${notchY} H 98`;
    amberNodes = [
      { x: edgeX, y: midEdgeY },
      { x: 98, y: lowEdgeY },
      { x: innerX, y: notchY },
    ];
  } else if (amberMode === 2) {
    const topAmberY = pick(40, [6, 9, 12]);
    const topAmberStart = pick(41, [58, 64, 70]);
    const topAmberB = pick(42, [80, 86, 92]);
    const topAmberDrop = topAmberY + pick(43, [12, 15, 18]);
    const topAmberLow = topAmberDrop + pick(46, [24, 30, 36]);
    right = `M ${topAmberStart} ${topAmberY} H ${topAmberB} V ${topAmberDrop} H 98 V ${topAmberLow} H ${pick(44, [86, 90, 94])} V ${topAmberLow + pick(45, [10, 13, 16])} H 98`;
    amberNodes = [
      { x: topAmberB, y: topAmberY },
      { x: 98, y: topAmberDrop },
      { x: pick(44, [86, 90, 94]), y: topAmberLow },
    ];
  } else if (amberMode === 3) {
    const spineX = pick(47, [72, 78, 84]);
    const spineTopY = pick(48, [7, 10, 13]);
    const spineA = pick(49, [78, 84, 90]);
    const spineMidY = pick(50, [34, 40, 46]);
    const spineB = pick(51, [84, 90, 96]);
    const spineLowY = pick(52, [58, 64, 70]);
    right = `M ${spineX} 4 V ${spineTopY} H ${spineA} V ${spineMidY} H ${spineB} V ${spineLowY} H 96`;
    amberNodes = [
      { x: spineX, y: spineTopY },
      { x: spineA, y: spineMidY },
      { x: spineB, y: spineLowY },
    ];
  }
  const orangeReturn = `M ${pick(24, [8, 12, 16])} ${orangeBottomY} H ${pick(25, [28, 34, 40])} V ${orangeBottomY - pick(26, [6, 8, 10])} H ${pick(27, [58, 64, 70])} V ${orangeBottomY} H 94`;
  const interiorA = `M ${pick(28, [12, 16, 20])} ${extraY} H ${pick(29, [32, 38, 44])} V ${extraY - pick(30, [5, 7, 9])} H ${pick(31, [58, 64, 70])} V ${extraY} H ${pick(0, [78, 84, 90])}`;
  const interiorB = `M ${pick(1, [18, 22, 26])} ${pick(2, [55, 61, 67])} H ${pick(3, [34, 42, 50])} V ${pick(4, [49, 55, 61])} H ${pick(5, [58, 66, 74])}`;
  const interiorC = `M ${pick(6, [64, 68, 72])} ${pick(7, [7, 10, 13])} H ${pick(8, [76, 82, 88])} V ${pick(9, [18, 22, 26])} H ${pick(10, [86, 91, 96])}`;

  return {
    lower,
    top,
    right,
    orangeReturn,
    interiorA,
    interiorB,
    interiorC,
    cyanNodes: [
      { x: lowerA, y: lowerY },
      { x: lowerB + 8, y: lowerY - lowerRise - 7 },
      { x: lowerC + 9, y: lowerEndY },
      { x: 96, y: lowerEndY },
      { x: topBreak + 8, y: topEndY },
    ],
    amberNodes: [
      ...amberNodes,
      { x: pick(27, [58, 64, 70]), y: orangeBottomY },
    ],
    timing: {
      cyan: cyanDuration,
      orange: orangeDuration,
      top: topDuration,
      cyanDelay: `-${(1 + (hash % 24) / 10).toFixed(1)}s`,
      orangeDelay: `-${(1.4 + ((hash >> 5) % 30) / 10).toFixed(1)}s`,
      topDelay: `-${(2 + ((hash >> 9) % 38) / 10).toFixed(1)}s`,
    },
  };
}

function AIReadPanelContent({
  title,
  subtitle,
  readType,
  confidence,
  confidenceNote,
  decision,
  evidenceRead,
  hideDecision = false,
  traceLabel = 'Why',
  traceItems,
  severity = 'info',
  chips,
  body,
  actions,
  backgroundVariant = 'blueprint',
}: Omit<AIReadPanelProps, 'compact' | 'className'>) {
  const normalizedConfidence = normalizeConfidence(confidence);
  const displayedConfidenceNote =
    normalizedConfidence === null ? null : confidenceNote || getDefaultConfidenceNote(normalizedConfidence);
  const visibleTraceItems = getVisibleTraceItems(traceItems);
  const verificationTraceItems = getVerificationTraceItems(evidenceRead);
  const visibleDecision = getVisibleDecisionForPanel({
    props: {
      title,
      subtitle,
      readType,
      confidence,
      confidenceNote,
      decision,
      evidenceRead,
      hideDecision,
      traceLabel,
      traceItems,
      severity,
      chips,
      body,
      actions,
      backgroundVariant,
    },
    severity,
    visibleTraceItems,
  });
  const voicedDecision = visibleDecision
    ? getVoicedAIReadDecision(visibleDecision)
    : null;

  const ReadIcon = getAIReadIcon(title, backgroundVariant);

  return (
    <>
      <span className="ai-read-status-rail" aria-hidden="true" />
      <div className="ai-read-panel-head">
        <div className="ai-read-panel-title-lockup">
          <div className="ai-read-title-row">
            <span className="ai-read-title-icon" aria-hidden="true">
              <ReadIcon className="h-5 w-5" />
            </span>
            <h4>{title}</h4>
          </div>

          {(readType || subtitle) && (
            <div className="ai-read-label-row ai-read-label-row-under-title">
              {readType && <span className={cn('ai-read-type', `ai-read-type-${severity}`)}>{readType}</span>}
              {subtitle && <span className="ai-read-subtitle-inline">{subtitle}</span>}
            </div>
          )}
        </div>

        {normalizedConfidence !== null && (
          <div
            className="ai-read-confidence"
            aria-label={`AI confidence ${normalizedConfidence}%`}
            title={displayedConfidenceNote || undefined}
          >
            <span>{getConfidenceLabel(normalizedConfidence)}</span>
            <strong>{normalizedConfidence}%</strong>
            <em>
              <i style={{ width: `${normalizedConfidence}%` }} />
            </em>
          </div>
        )}
      </div>

      {voicedDecision && (
        <div className={cn('ai-read-decision', `ai-read-decision-${voicedDecision.tone || 'watch'}`)}>
          <span>{voicedDecision.status || 'Decision'}</span>
          <strong>{voicedDecision.label}</strong>
          {voicedDecision.detail && <em>{voicedDecision.detail}</em>}
        </div>
      )}

      {chips?.length ? <div className="ai-read-chip-row">{chips.map(renderChip)}</div> : null}

      <div className="ai-read-body">{typeof body === 'string' ? <p>{body}</p> : body}</div>

      {visibleTraceItems.length ? (
        <AIReadTrace label={traceLabel} items={visibleTraceItems} />
      ) : null}

      {verificationTraceItems.length ? (
        <AIReadTrace label="Where to verify" items={verificationTraceItems} />
      ) : null}

      {actions?.length ? (
        <div className="ai-read-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled || !action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

function AIReadTrace({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className="ai-read-trace"
      open={isOpen}
      onToggle={event => setIsOpen(event.currentTarget.open)}
    >
      <summary className="ai-read-trace-kicker">
        {label} <span>{items.length} signals</span>
      </summary>
      {isOpen && (
        <ul className="ai-read-trace-list">
          {items.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </details>
  );
}

function AIReadChrome({ primary = false, routeKey }: { primary?: boolean; routeKey: string }) {
  const reactId = useId().replace(/:/g, '');
  const layout = buildCircuitLayout(routeKey);
  const lowerRouteId = `ai-panel-lower-route-${reactId}`;
  const rightRouteId = `ai-panel-right-route-${reactId}`;
  const topRouteId = `ai-panel-top-route-${reactId}`;
  const returnRouteId = `ai-panel-return-route-${reactId}`;
  const railOpacity = primary ? 0.9 : 0.66;
  const quietOpacity = primary ? 0.34 : 0.22;
  const nodeOpacity = primary ? 0.96 : 0.74;
  const cyanNodeRadius = primary ? 0.82 : 0.64;
  const amberNodeRadius = primary ? 0.92 : 0.7;

  const chromeStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 4,
    pointerEvents: 'none',
    borderRadius: 'inherit',
    mixBlendMode: 'screen',
  };

  const svgStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    overflow: 'visible',
    opacity: primary ? 1 : 0.82,
    filter: primary
      ? 'drop-shadow(0 0 11px rgba(96, 245, 255, 0.32)) drop-shadow(0 0 20px rgba(255, 174, 76, 0.16))'
      : 'drop-shadow(0 0 8px rgba(96, 245, 255, 0.2))',
  };

  return (
    <div className="ai-panel-svg-chrome" aria-hidden="true" style={chromeStyle}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={svgStyle}>
        <defs>
          <filter id={`ai-panel-flow-glow-${reactId}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="0.55" result="flowBlur" />
            <feMerge>
              <feMergeNode in="flowBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`ai-panel-node-glow-${reactId}`} x="-110%" y="-110%" width="320%" height="320%">
            <feGaussianBlur stdDeviation="1.05" result="nodeBlur" />
            <feMerge>
              <feMergeNode in="nodeBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="ai-panel-routed-traces" fill="none" strokeLinecap="square" strokeLinejoin="miter" vectorEffect="non-scaling-stroke">
          <path
            id={lowerRouteId}
            d={layout.lower}
            stroke="rgba(96,245,255,0.9)"
            strokeWidth={primary ? 0.62 : 0.42}
            strokeOpacity={railOpacity}
          />

          <path
            id={topRouteId}
            d={layout.top}
            stroke="rgba(96,245,255,0.32)"
            strokeWidth={primary ? 0.34 : 0.24}
            strokeOpacity={quietOpacity}
          />

          <path
            id={rightRouteId}
            d={layout.right}
            stroke="rgba(255,174,76,0.82)"
            strokeWidth={primary ? 0.58 : 0.4}
            strokeOpacity={primary ? 0.9 : 0.58}
          />

          <path
            id={returnRouteId}
            d={layout.orangeReturn}
            stroke="rgba(255,174,76,0.62)"
            strokeWidth={primary ? 0.38 : 0.26}
            strokeOpacity={primary ? 0.62 : 0.34}
          />

          <path
            d={layout.interiorA}
            stroke="rgba(96,245,255,0.18)"
            strokeWidth="0.18"
            strokeOpacity={quietOpacity * 0.8}
          />
          <path
            d={layout.interiorB}
            stroke="rgba(96,245,255,0.16)"
            strokeWidth="0.14"
            strokeOpacity={quietOpacity * 0.72}
          />
          <path
            d={layout.interiorC}
            stroke="rgba(255,174,76,0.42)"
            strokeWidth="0.18"
            strokeOpacity={quietOpacity}
          />
        </g>

        <g className="ai-panel-flow-traces" fill="none" strokeLinecap="round" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" filter={`url(#ai-panel-flow-glow-${reactId})`}>
          <path className="ai-panel-flow-trace ai-panel-flow-trace-cyan" d={layout.lower}>
            <animate attributeName="stroke-dashoffset" from="180" to="0" dur={`${layout.timing.cyan}s`} begin={layout.timing.cyanDelay} repeatCount="indefinite" />
          </path>
          <path className="ai-panel-flow-trace ai-panel-flow-trace-orange" d={layout.right}>
            <animate attributeName="stroke-dashoffset" from="0" to="-170" dur={`${layout.timing.orange}s`} begin={layout.timing.orangeDelay} repeatCount="indefinite" />
          </path>
          <path className="ai-panel-flow-trace ai-panel-flow-trace-cyan ai-panel-flow-trace-soft" d={layout.top}>
            <animate attributeName="stroke-dashoffset" from="155" to="0" dur={`${layout.timing.top}s`} begin={layout.timing.topDelay} repeatCount="indefinite" />
          </path>
          <path className="ai-panel-flow-trace ai-panel-flow-trace-orange ai-panel-flow-trace-soft" d={layout.orangeReturn}>
            <animate attributeName="stroke-dashoffset" from="150" to="0" dur={`${layout.timing.orange + 1.15}s`} begin={layout.timing.topDelay} repeatCount="indefinite" />
          </path>
        </g>

        <g className="ai-panel-flow-packets" filter={`url(#ai-panel-flow-glow-${reactId})`}>
          <ellipse className="ai-panel-flow-packet ai-panel-flow-packet-cyan" rx={primary ? '1.1' : '0.78'} ry="0.22">
            <animateMotion dur={`${layout.timing.cyan}s`} begin={layout.timing.cyanDelay} repeatCount="indefinite" rotate="auto">
              <mpath href={`#${lowerRouteId}`} />
            </animateMotion>
          </ellipse>
          <ellipse className="ai-panel-flow-packet ai-panel-flow-packet-orange" rx={primary ? '1.02' : '0.72'} ry="0.22">
            <animateMotion dur={`${layout.timing.orange}s`} begin={layout.timing.orangeDelay} repeatCount="indefinite" rotate="auto">
              <mpath href={`#${rightRouteId}`} />
            </animateMotion>
          </ellipse>
          <ellipse className="ai-panel-flow-packet ai-panel-flow-packet-cyan ai-panel-flow-packet-soft" rx={primary ? '0.74' : '0.52'} ry="0.14">
            <animateMotion dur={`${layout.timing.top}s`} begin={layout.timing.topDelay} repeatCount="indefinite" rotate="auto">
              <mpath href={`#${topRouteId}`} />
            </animateMotion>
          </ellipse>
          <ellipse className="ai-panel-flow-packet ai-panel-flow-packet-orange ai-panel-flow-packet-soft" rx={primary ? '0.8' : '0.56'} ry="0.16">
            <animateMotion dur={`${layout.timing.orange + 1.15}s`} begin={layout.timing.topDelay} repeatCount="indefinite" rotate="auto">
              <mpath href={`#${returnRouteId}`} />
            </animateMotion>
          </ellipse>
        </g>

        <g className="ai-panel-flow-nodes" filter={`url(#ai-panel-node-glow-${reactId})`}>
          {layout.cyanNodes.map((node, index) => (
            <circle
              key={`cyan-node-${index}`}
              cx={node.x}
              cy={node.y}
              r={index === 2 ? cyanNodeRadius * 1.08 : index === 4 ? cyanNodeRadius * 0.48 : cyanNodeRadius * 0.82}
              fill="rgba(96,245,255,0.95)"
              opacity={index === 4 ? nodeOpacity * 0.56 : nodeOpacity * 0.84}
            />
          ))}
          {layout.amberNodes.map((node, index) => (
            <circle
              key={`amber-node-${index}`}
              cx={node.x}
              cy={node.y}
              r={index === 0 ? amberNodeRadius * 1.04 : amberNodeRadius * 0.78}
              fill="rgba(255,174,76,0.94)"
              opacity={index === 0 ? nodeOpacity : nodeOpacity * 0.74}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

export function AIReadPanel({
  compact = false,
  backgroundVariant = 'blueprint',
  severity = 'info',
  className,
  ...props
}: AIReadPanelProps) {
  if (!shouldRenderAIReadPanel({ props: { ...props, compact, backgroundVariant, severity, className }, severity })) {
    return null;
  }

  const tronTheme = getAITronTheme(backgroundVariant, severity);
  const tronDensity: AITronDensity = compact ? 'small' : 'medium';
  const primaryChrome =
    backgroundVariant === 'roster' ||
    backgroundVariant === 'market' ||
    backgroundVariant === 'trade' ||
    backgroundVariant === 'monthly';
  const circuitKey = `${props.title}-${backgroundVariant}-${severity}`;

  const rootClassName = cn(
    'ai-read-panel',
    'ai-surface-r3f',
    'ai-read-panel-r3f',
    compact && 'ai-read-panel-compact',
    `ai-read-panel-${backgroundVariant}`,
    `ai-read-panel-severity-${severity}`,
    className,
  );

  if (compact) {
    return (
      <details className={rootClassName}>
        <AIReadChrome primary={primaryChrome} routeKey={circuitKey} />
        <AITronSurface theme={tronTheme} density={tronDensity} routeKey={circuitKey} />

        <summary className="ai-read-compact-summary">
          <span className="ai-read-badge">
            <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />
            AI Read
          </span>
          <span>{props.title}</span>
        </summary>

        <AIReadPanelContent {...props} severity={severity} backgroundVariant={backgroundVariant} />
      </details>
    );
  }

  return (
    <article className={cn(rootClassName, 'ai-read-panel-desktop', 'ai-read-panel-responsive')}>
      <AIReadChrome primary={primaryChrome} routeKey={circuitKey} />
      <AITronSurface theme={tronTheme} density={tronDensity} routeKey={circuitKey} />
      <AIReadPanelContent {...props} severity={severity} backgroundVariant={backgroundVariant} />
    </article>
  );
}
