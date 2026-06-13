import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react';

export type AITronTheme = 'cyan' | 'green' | 'amber' | 'red' | 'blue';
export type AITronDensity = 'small' | 'medium' | 'large';

interface AITronSurfaceProps {
  theme?: AITronTheme;
  density?: AITronDensity;
  routeKey?: string;
}

type CircuitPoint = {
  x: number;
  y: number;
};

type CircuitPath = {
  id: string;
  d: string;
  color: string;
  opacity: number;
  width: number;
  duration: number;
  delay: number;
  pulse: number;
  dash: string;
  reverse?: boolean;
  isHero?: boolean;
  isBus?: boolean;
  nodes: CircuitPoint[];
};

type JunctionFlare = CircuitPoint & {
  id: string;
  color: string;
  delay: number;
  radius: number;
  opacity: number;
  hero?: boolean;
};

const THEME_COLORS: Record<AITronTheme, { packet: string; trace: string; accent: string }> = {
  cyan: { packet: '#7df7ff', trace: '#35dfff', accent: '#ffb45a' },
  green: { packet: '#7df7ff', trace: '#35dfff', accent: '#ffb45a' },
  amber: { packet: '#7df7ff', trace: '#35dfff', accent: '#ffb45a' },
  red: { packet: '#8fd8ff', trace: '#38d7ff', accent: '#ff6b7a' },
  blue: { packet: '#7df7ff', trace: '#35dfff', accent: '#ffb45a' },
};

const BOARD_CORNER_RADIUS = 0.82;
const HAIRLINE_CORNER_RADIUS = 0.56;

function hashSeed(value: string): number {
  return value.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0, 2166136261);
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);

    return () => media.removeEventListener('change', update);
  }, []);

  return reducedMotion;
}

function formatCircuitCoord(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/\.?0+$/, '');
}

function formatCircuitPoint(point: CircuitPoint) {
  return `${formatCircuitCoord(point.x)} ${formatCircuitCoord(point.y)}`;
}

function isSameCircuitPoint(a: CircuitPoint, b: CircuitPoint) {
  return a.x === b.x && a.y === b.y;
}

function normalizeCircuitNodes(points: CircuitPoint[]) {
  if (points.length < 2) return points;

  const routed: CircuitPoint[] = [points[0]];

  points.slice(1).forEach((point) => {
    const previous = routed[routed.length - 1];
    if (isSameCircuitPoint(previous, point)) return;

    if (previous.x !== point.x && previous.y !== point.y) {
      const beforePrevious = routed[routed.length - 2];
      const verticalFirst = beforePrevious
        ? beforePrevious.y === previous.y
        : Math.abs(point.y - previous.y) > Math.abs(point.x - previous.x);
      const elbow = verticalFirst
        ? { x: previous.x, y: point.y }
        : { x: point.x, y: previous.y };

      if (!isSameCircuitPoint(previous, elbow)) {
        routed.push(elbow);
      }
    }

    if (!isSameCircuitPoint(routed[routed.length - 1], point)) {
      routed.push(point);
    }
  });

  return routed;
}

function isCircuitBend(previous: CircuitPoint, point: CircuitPoint, next: CircuitPoint) {
  return !(
    (previous.x === point.x && point.x === next.x) ||
    (previous.y === point.y && point.y === next.y)
  );
}

function segmentLength(a: CircuitPoint, b: CircuitPoint) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function moveToward(from: CircuitPoint, to: CircuitPoint, distance: number): CircuitPoint {
  if (from.x === to.x) {
    return { x: from.x, y: from.y + Math.sign(to.y - from.y) * distance };
  }

  return { x: from.x + Math.sign(to.x - from.x) * distance, y: from.y };
}

function pathFromPoints(points: CircuitPoint[], cornerRadius = BOARD_CORNER_RADIUS) {
  const routed = normalizeCircuitNodes(points);
  if (!routed.length) return '';

  const commands = [`M ${formatCircuitPoint(routed[0])}`];

  for (let index = 1; index < routed.length; index += 1) {
    const point = routed[index];
    const previous = routed[index - 1];
    const next = routed[index + 1];

    if (!next || !isCircuitBend(previous, point, next)) {
      commands.push(`L ${formatCircuitPoint(point)}`);
      continue;
    }

    const radius = Math.min(cornerRadius, segmentLength(previous, point) / 2, segmentLength(point, next) / 2);
    if (radius <= 0) {
      commands.push(`L ${formatCircuitPoint(point)}`);
      continue;
    }

    const beforeBend = moveToward(point, previous, radius);
    const afterBend = moveToward(point, next, radius);
    commands.push(`L ${formatCircuitPoint(beforeBend)}`);
    commands.push(`Q ${formatCircuitPoint(point)} ${formatCircuitPoint(afterBend)}`);
  }

  return commands.join(' ');
}

function pickCircuitValue<T>(rand: () => number, values: T[]) {
  return values[Math.floor(rand() * values.length)];
}

function getActiveCount(density: AITronDensity) {
  if (density === 'small') return 2;
  if (density === 'large') return 5;
  return 4;
}

function getParticleCount(density: AITronDensity) {
  if (density === 'small') return 14;
  if (density === 'large') return 44;
  return 28;
}

type ParticleTrail = {
  id: string;
  left: number;
  top: number;
  length: number;
  duration: number;
  delay: number;
  opacity: number;
  scale: number;
  reverse: boolean;
  color: string;
};

function buildParticleTrails(seedKey: string, count: number, direction: 1 | -1, color: string): ParticleTrail[] {
  const rand = seededRandom(hashSeed(seedKey));
  const lanes = [9, 14, 21, 28, 36, 44, 53, 62, 72, 83, 91];
  const reverse = direction === -1;

  return Array.from({ length: count }, (_, index) => {
    const lane = lanes[Math.floor(rand() * lanes.length)];
    return {
      id: `${seedKey}-trail-${index}`,
      left: reverse ? 102 + rand() * 32 : -34 + rand() * 32,
      top: lane + (rand() - 0.5) * 3.2,
      length: 18 + rand() * 54,
      duration: 4.2 + rand() * 5.4,
      delay: -(rand() * 9.5),
      opacity: 0.09 + rand() * 0.2,
      scale: 0.62 + rand() * 0.68,
      reverse,
      color,
    };
  });
}

function AITronParticleField({
  colors,
  density,
  prefix,
}: {
  colors: { packet: string; accent: string };
  density: AITronDensity;
  prefix: string;
}) {
  const particleCount = getParticleCount(density);
  const trails = useMemo(
    () => [
      ...buildParticleTrails(`${prefix}-cyan-current`, particleCount, 1, colors.packet),
      ...buildParticleTrails(`${prefix}-amber-current`, Math.max(12, Math.floor(particleCount * 0.48)), -1, colors.accent),
    ],
    [colors.accent, colors.packet, particleCount, prefix],
  );

  return (
    <div className="ai-tron-particle-field">
      {trails.map(trail => (
        <span
          key={trail.id}
          className={`ai-tron-particle-trail${trail.reverse ? ' ai-tron-particle-trail-reverse' : ''}`}
          style={{
            '--trail-color': trail.color,
            '--trail-left': `${trail.left}%`,
            '--trail-top': `${trail.top}%`,
            '--trail-length': `${trail.length}px`,
            '--trail-duration': `${trail.duration}s`,
            '--trail-delay': `${trail.delay}s`,
            '--trail-opacity': trail.opacity,
            '--trail-scale': trail.scale,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

function makeBoardRoute(index: number, theme: AITronTheme, prefix: string, seed: number): CircuitPath {
  const colors = THEME_COLORS[theme];
  const rand = seededRandom((seed + index * 0x9e3779b9) >>> 0);
  const variant = (index + Math.floor(rand() * 6)) % 6;
  let nodes: CircuitPoint[];

  if (variant === 0) {
    const y = pickCircuitValue(rand, [78, 82, 86, 90]);
    const a = pickCircuitValue(rand, [14, 18, 22]);
    const b = pickCircuitValue(rand, [38, 44, 50]);
    const c = pickCircuitValue(rand, [66, 72, 78]);
    const y2 = y - pickCircuitValue(rand, [8, 11, 14]);
    const y3 = y2 - pickCircuitValue(rand, [6, 9, 12]);
    const y4 = y3 - pickCircuitValue(rand, [3, 6, 9]);
    nodes = [
      { x: 2, y },
      { x: a, y },
      { x: a, y: y2 },
      { x: b, y: y2 },
      { x: b + 8, y: y3 },
      { x: c, y: y3 },
      { x: c + 8, y: y4 },
      { x: 98, y: y4 },
    ];
  } else if (variant === 1) {
    const x = pickCircuitValue(rand, [78, 82, 86, 90]);
    const yA = pickCircuitValue(rand, [12, 16, 20]);
    const yB = pickCircuitValue(rand, [34, 40, 46]);
    const yC = pickCircuitValue(rand, [62, 68, 74]);
    const x2 = x + pickCircuitValue(rand, [6, 9, 12]);
    const x3 = x - pickCircuitValue(rand, [5, 8, 11]);
    nodes = [
      { x: pickCircuitValue(rand, [52, 58, 64]), y: 2 },
      { x, y: 2 },
      { x, y: yA },
      { x: x2, y: yA },
      { x: x2, y: yB },
      { x: 98, y: yB },
      { x: 98, y: yC },
      { x: x3, y: yC },
    ];
  } else if (variant === 2) {
    const y = pickCircuitValue(rand, [9, 12, 15, 18]);
    const a = pickCircuitValue(rand, [30, 36, 42]);
    const b = pickCircuitValue(rand, [56, 62, 68]);
    const y2 = y + pickCircuitValue(rand, [8, 11, 14]);
    const y3 = y2 + pickCircuitValue(rand, [7, 10, 13]);
    const end = pickCircuitValue(rand, [82, 88, 94]);
    nodes = [
      { x: pickCircuitValue(rand, [6, 10, 14]), y },
      { x: a, y },
      { x: a + 7, y: y2 },
      { x: b, y: y2 },
      { x: b, y: y3 },
      { x: end, y: y3 },
      { x: 98, y: y3 },
    ];
  } else if (variant === 3) {
    const y = pickCircuitValue(rand, [50, 56, 62, 68]);
    const a = pickCircuitValue(rand, [18, 24, 30]);
    const b = pickCircuitValue(rand, [44, 50, 56]);
    const c = pickCircuitValue(rand, [70, 76, 82]);
    const y2 = y - pickCircuitValue(rand, [8, 11, 14]);
    const y3 = y - pickCircuitValue(rand, [16, 19, 22]);
    const y4 = y - pickCircuitValue(rand, [3, 6, 9]);
    nodes = [
      { x: 3, y },
      { x: a, y },
      { x: a, y: y2 },
      { x: b, y: y2 },
      { x: b + 9, y: y3 },
      { x: c, y: y3 },
      { x: c, y: y4 },
      { x: 97, y: y4 },
    ];
  } else if (variant === 4) {
    const x = pickCircuitValue(rand, [7, 10, 13]);
    const yA = pickCircuitValue(rand, [22, 28, 34]);
    const yB = pickCircuitValue(rand, [48, 54, 60]);
    const b = pickCircuitValue(rand, [44, 50, 56]);
    const x2 = x + pickCircuitValue(rand, [8, 11, 14]);
    const yC = yB - pickCircuitValue(rand, [7, 10, 13]);
    nodes = [
      { x, y: 5 },
      { x, y: yA },
      { x: x2, y: yA },
      { x: x2, y: yB },
      { x: b, y: yB },
      { x: b + 9, y: yC },
      { x: 94, y: yC },
    ];
  } else {
    const y = pickCircuitValue(rand, [88, 92, 96]);
    const a = pickCircuitValue(rand, [24, 30, 36]);
    const b = pickCircuitValue(rand, [54, 60, 66]);
    const c = pickCircuitValue(rand, [74, 80, 86]);
    const y2 = y - pickCircuitValue(rand, [8, 11, 14]);
    const y3 = y - pickCircuitValue(rand, [18, 21, 24]);
    const y4 = pickCircuitValue(rand, [54, 60, 66]);
    nodes = [
      { x: 4, y },
      { x: a, y },
      { x: a, y: y2 },
      { x: b, y: y2 },
      { x: b + 10, y: y3 },
      { x: c, y: y3 },
      { x: c, y: y4 },
      { x: 98, y: y4 },
    ];
  }

  const isAccent = variant === 1 || variant === 5 || ((seed >>> (index % 16)) & 3) === 0;
  const routedNodes = normalizeCircuitNodes(nodes);

  return {
    id: `${prefix}-board-route-${index}`,
    d: pathFromPoints(routedNodes),
    color: isAccent ? colors.accent : colors.packet,
    opacity: isAccent ? 0.52 : 0.62,
    width: isAccent ? 0.42 : 0.48,
    duration: isAccent ? 7.4 + rand() * 2.4 : 6.2 + rand() * 2.8,
    delay: -(0.4 + index * 0.72 + rand() * 1.1),
    pulse: isAccent ? 0.74 : 0.8,
    dash: isAccent ? '6 260' : '7 240',
    reverse: rand() > 0.5,
    isHero: index < 3,
    isBus: true,
    nodes: routedNodes,
  };
}

function makeHairlineRoute(index: number, theme: AITronTheme, prefix: string, seed: number): CircuitPath {
  const colors = THEME_COLORS[theme];
  const rand = seededRandom((seed ^ (index + 17) * 0x85ebca6b) >>> 0);
  const y = pickCircuitValue(rand, [18, 24, 31, 39, 47, 58, 73, 82]);
  const start = pickCircuitValue(rand, [5, 8, 12, 16, 30, 42, 50]);
  const bend = pickCircuitValue(rand, [-9, -6, -4, 4, 6, 9]);
  const mid = start + pickCircuitValue(rand, [12, 16, 20]);
  const end = Math.min(start + pickCircuitValue(rand, [42, 50, 58]), 98);
  const nodes = [
    { x: start, y },
    { x: mid, y },
    { x: mid, y: y + bend },
    { x: end, y: y + bend },
  ];
  const routedNodes = normalizeCircuitNodes(nodes);

  return {
    id: `${prefix}-hairline-${index}`,
    d: pathFromPoints(routedNodes, HAIRLINE_CORNER_RADIUS),
    color: rand() > 0.76 ? colors.accent : colors.packet,
    opacity: rand() > 0.72 ? 0.18 : 0.1,
    width: 0.14,
    duration: 7.2 + rand() * 3.6,
    delay: -(rand() * 8),
    pulse: 0.18,
    dash: '3 240',
    reverse: rand() > 0.66,
    nodes: routedNodes,
  };
}

function makePadRoute(index: number, theme: AITronTheme, prefix: string, seed: number): CircuitPath {
  const colors = THEME_COLORS[theme];
  const rand = seededRandom((seed ^ (index + 53) * 0xc2b2ae35) >>> 0);
  const leftPadX = pickCircuitValue(rand, [14, 18, 22]);
  const leftPadY = pickCircuitValue(rand, [76, 80, 84]);
  const leftPadEnd = pickCircuitValue(rand, [28, 34, 40]);
  const topPadStart = pickCircuitValue(rand, [72, 78, 84]);
  const topPadX = pickCircuitValue(rand, [86, 90, 94]);
  const topPadY = pickCircuitValue(rand, [22, 28, 34]);
  const rightPadY = pickCircuitValue(rand, [68, 74, 80]);
  const rightPadX = pickCircuitValue(rand, [78, 84, 90]);
  const sidePadY = pickCircuitValue(rand, [30, 36, 42]);
  const sidePadX = pickCircuitValue(rand, [20, 26, 32]);
  const sidePadDrop = pickCircuitValue(rand, [48, 54, 60]);
  const padRoutes: CircuitPoint[][] = [
    [{ x: leftPadX, y: 94 }, { x: leftPadX, y: leftPadY }, { x: leftPadEnd, y: leftPadY }],
    [{ x: topPadStart, y: 8 }, { x: topPadX, y: 8 }, { x: topPadX, y: topPadY }],
    [{ x: 94, y: rightPadY }, { x: rightPadX, y: rightPadY }, { x: rightPadX, y: 94 }],
    [{ x: 6, y: sidePadY }, { x: sidePadX, y: sidePadY }, { x: sidePadX, y: sidePadDrop }],
  ];
  const nodes = padRoutes[index % padRoutes.length];
  const routedNodes = normalizeCircuitNodes(nodes);

  return {
    id: `${prefix}-pad-route-${index}`,
    d: pathFromPoints(routedNodes, HAIRLINE_CORNER_RADIUS),
    color: rand() > 0.5 ? colors.packet : colors.accent,
    opacity: 0.26,
    width: 0.18,
    duration: 8.5 + rand() * 3.5,
    delay: -(rand() * 7),
    pulse: 0.22,
    dash: '4 170',
    reverse: rand() > 0.5,
    nodes: routedNodes,
  };
}

function getAnimateValues(path: CircuitPath) {
  return path.reverse ? { from: '0', to: '220' } : { from: '220', to: '0' };
}

function getHeroFlares(paths: CircuitPath[]): JunctionFlare[] {
  return paths
    .filter((path) => path.isHero || path.isBus)
    .flatMap((path, pathIndex) => {
      const lastIndex = path.nodes.length - 1;

      return path.nodes
        .filter((_, nodeIndex) => (
          path.isHero ||
          nodeIndex === 0 ||
          nodeIndex === lastIndex ||
          nodeIndex % 3 === 0
        ))
        .map((node, nodeIndex) => ({
          id: `${path.id}-flare-${nodeIndex}`,
          x: node.x,
          y: node.y,
          color: path.color,
          delay: -(pathIndex * 0.8 + nodeIndex * 0.42),
          radius: path.isHero ? 0.92 : 0.48,
          opacity: path.isHero ? 0.82 : 0.5,
          hero: path.isHero,
        }));
    });
}

export function AITronSurface({ theme = 'cyan', density = 'medium', routeKey }: AITronSurfaceProps) {
  const colors = THEME_COLORS[theme];
  const reactId = useId().replace(/:/g, '');
  const prefix = useMemo(() => `ai-tron-${reactId}`, [reactId]);
  const layoutSeed = useMemo(() => hashSeed(`${routeKey || prefix}-${theme}-${density}`), [density, prefix, routeKey, theme]);
  const reducedMotion = usePrefersReducedMotion();

  const paths = useMemo(() => {
    const board = Array.from({ length: density === 'small' ? 3 : 6 }, (_, index) => makeBoardRoute(index, theme, prefix, layoutSeed));
    const hairlines = Array.from({ length: density === 'large' ? 5 : density === 'small' ? 2 : 3 }, (_, index) => makeHairlineRoute(index, theme, prefix, layoutSeed));
    const pads = Array.from({ length: density === 'small' ? 1 : 2 }, (_, index) => makePadRoute(index, theme, prefix, layoutSeed));

    return [...board, ...pads, ...hairlines];
  }, [density, layoutSeed, prefix, theme]);

  const activePaths = useMemo(() => {
    const busPaths = paths.filter((path) => path.isBus);
    const accentPaths = paths.filter((path) => !path.isBus && path.color === colors.accent).slice(0, 1);
    const supportingPaths = paths.filter((path) => !path.isBus && path.color !== colors.accent);

    return [...busPaths, ...accentPaths, ...supportingPaths].slice(0, getActiveCount(density));
  }, [colors.accent, density, paths]);

  const nodes = useMemo(
    () => paths
      .flatMap((path) => {
        const lastIndex = path.nodes.length - 1;

        return path.nodes.map((node, index) => ({
          ...node,
          key: `${path.id}-node-${index}`,
          color: path.color,
          isBus: path.isBus,
          isHero: path.isHero,
          isTerminal: index === 0 || index === lastIndex,
        }));
      })
      .filter((node) => node.isBus || node.isTerminal || hashSeed(node.key) % 13 === 0),
    [paths],
  );

  const flares = useMemo(() => getHeroFlares(paths), [paths]);

  return (
    <div className="ai-tron-surface ai-tron-surface-mounted" aria-hidden="true">
      {!reducedMotion && (
        <AITronParticleField colors={colors} density={density} prefix={prefix} />
      )}

      <svg className="ai-tron-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <filter id={`${prefix}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id={`${prefix}-flare-glow`} x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="0.95" result="flareBlur" />
            <feMerge>
              <feMergeNode in="flareBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="ai-tron-static-traces">
          {paths.map((path) => (
            <path
              key={path.id}
              id={path.id}
              d={path.d}
              fill="none"
              stroke={path.color}
              strokeWidth={path.width}
              strokeOpacity={path.isBus ? Math.min(path.opacity + 0.06, 0.7) : path.opacity}
              strokeLinecap="square"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        <g className="ai-tron-static-nodes" filter={`url(#${prefix}-flare-glow)`}>
          {nodes.map((node) => {
            const haloRadius = node.isBus ? (node.isHero ? 0.82 : 0.64) : 0.42;
            const coreRadius = node.isBus ? (node.isHero ? 0.34 : 0.28) : 0.18;
            const hotRadius = node.isBus ? (node.isHero ? 0.1 : 0.08) : 0.05;
            const coreOpacity = node.isBus ? (node.isHero ? 0.8 : 0.66) : 0.38;

            return (
              <g key={node.key}>
                <circle cx={node.x} cy={node.y} r={haloRadius} fill={node.color} opacity={node.isBus ? 0.16 : 0.08} />
                <circle cx={node.x} cy={node.y} r={coreRadius} fill={node.color} opacity={coreOpacity} />
                <circle cx={node.x} cy={node.y} r={hotRadius} fill="#ffffff" opacity={node.isBus ? 0.72 : 0.38} />
              </g>
            );
          })}
        </g>

        <g className="ai-tron-junction-flares" filter={`url(#${prefix}-flare-glow)`}>
          {flares.map((flare) => (
            <g key={flare.id}>
              <circle cx={flare.x} cy={flare.y} r={flare.radius * 1.55} fill={flare.color} opacity={flare.opacity * 0.16}>
                <animate attributeName="opacity" values={`${flare.opacity * 0.06};${flare.opacity * 0.16};${flare.opacity * 0.06}`} dur={flare.hero ? '5.4s' : '7.2s'} begin={`${flare.delay}s`} repeatCount="indefinite" />
              </circle>
              <circle cx={flare.x} cy={flare.y} r={flare.radius} fill={flare.color} opacity={flare.opacity}>
                <animate attributeName="opacity" values={`${flare.opacity * 0.28};${flare.opacity};${flare.opacity * 0.28}`} dur={flare.hero ? '5.4s' : '7.2s'} begin={`${flare.delay}s`} repeatCount="indefinite" />
              </circle>
              <circle cx={flare.x} cy={flare.y} r={flare.hero ? '0.18' : '0.1'} fill="#ffffff" opacity={flare.hero ? '0.74' : '0.46'}>
                <animate attributeName="opacity" values="0.22;0.86;0.22" dur={flare.hero ? '5.4s' : '7.2s'} begin={`${flare.delay}s`} repeatCount="indefinite" />
              </circle>
            </g>
          ))}
        </g>

        <g className="ai-tron-signals" filter={`url(#${prefix}-glow)`}>
          {activePaths.map((path, index) => {
            const animate = getAnimateValues(path);

            return (
              <g key={`${path.id}-signal`}>
                <path
                  d={path.d}
                  fill="none"
                  stroke={path.color}
                  strokeWidth={path.isBus ? path.width * 1.95 : path.width * 1.1}
                  strokeOpacity={path.isBus ? '0.62' : '0.14'}
                  strokeLinecap="square"
                  strokeLinejoin="round"
                  strokeDasharray={path.dash}
                  vectorEffect="non-scaling-stroke"
                >
                  <animate attributeName="stroke-dashoffset" from={animate.from} to={animate.to} dur={`${path.duration * 1.18}s`} begin={`${path.delay + index * 0.12}s`} repeatCount="indefinite" />
                </path>

                <ellipse rx={path.isBus ? '0.72' : '0.24'} ry={path.isBus ? '0.09' : '0.045'} fill={path.color} opacity={path.pulse}>
                  <animateMotion dur={`${path.duration}s`} begin={`${path.delay}s`} repeatCount="indefinite" rotate="auto" keyPoints={path.reverse ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear">
                    <mpath href={`#${path.id}`} />
                  </animateMotion>
                </ellipse>

                <circle r={path.isBus ? '0.07' : '0.03'} fill="#ffffff" opacity={path.isBus ? '0.36' : '0.18'}>
                  <animateMotion dur={`${path.duration}s`} begin={`${path.delay}s`} repeatCount="indefinite" rotate="auto" keyPoints={path.reverse ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear">
                    <mpath href={`#${path.id}`} />
                  </animateMotion>
                </circle>
              </g>
            );
          })}
        </g>

        <g className="ai-tron-corner-pulses">
          <circle cx="8" cy="12" r="0.12" fill={colors.packet} opacity="0.28" />
          <circle cx="90" cy="11" r="0.12" fill={colors.accent} opacity="0.3" />
          <circle cx="92" cy="88" r="0.12" fill={colors.packet} opacity="0.28" />
        </g>
      </svg>
    </div>
  );
}
