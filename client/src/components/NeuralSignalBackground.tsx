type NeuralSignalBackgroundProps = {
  variant?: 'home' | 'report';
};

type NeuralRoute = {
  id: string;
  d: string;
  emphasis?: boolean;
};

type NeuralPulse = {
  route: string;
  duration: string;
  delay: string;
  halo: number;
  reverse?: boolean;
};

const ROUTES: readonly NeuralRoute[] = [
  {
    id: 'northline',
    d: 'M -7 17 C 8 16 12 27 25 27 L 37 27 C 49 27 50 13 62 14 C 75 15 78 31 92 31 L 108 31',
    emphasis: true,
  },
  {
    id: 'upperfold',
    d: 'M -8 42 C 10 37 18 49 31 45 C 43 41 47 31 58 34 C 69 37 69 50 80 52 C 90 54 96 46 108 48',
  },
  {
    id: 'midline',
    d: 'M -6 61 L 14 61 C 26 61 25 49 38 49 L 52 49 C 64 49 64 63 76 63 L 108 63',
    emphasis: true,
  },
  {
    id: 'southline',
    d: 'M -8 83 C 8 75 17 78 28 76 C 42 73 45 86 58 83 C 71 80 73 69 86 71 C 96 72 99 82 108 79',
  },
  {
    id: 'leftbranch',
    d: 'M 18 -7 C 19 8 24 14 25 27 C 26 40 18 48 22 61 C 25 70 28 72 28 107',
  },
  {
    id: 'corebranch',
    d: 'M 55 -6 C 54 11 62 17 58 34 C 55 45 51 47 52 49 C 57 61 59 72 58 83 C 57 92 53 98 52 107',
    emphasis: true,
  },
  {
    id: 'rightbranch',
    d: 'M 84 -6 C 87 10 82 20 92 31 C 99 39 79 44 80 52 C 81 62 87 62 86 71 C 85 84 92 92 93 107',
  },
] as const;

const NODES = [
  [25, 27],
  [62, 14],
  [92, 31],
  [31, 45],
  [58, 34],
  [80, 52],
  [22, 61],
  [52, 49],
  [76, 63],
  [28, 76],
  [58, 83],
  [86, 71],
] as const;

const PULSES: readonly NeuralPulse[] = [
  { route: 'northline', duration: '10.8s', delay: '-2.4s', halo: 4.8 },
  { route: 'northline', duration: '15.6s', delay: '-9.8s', reverse: true, halo: 3.9 },
  { route: 'upperfold', duration: '13.2s', delay: '-5.2s', reverse: true, halo: 4.5 },
  { route: 'upperfold', duration: '18.4s', delay: '-13.7s', halo: 3.7 },
  { route: 'midline', duration: '11.6s', delay: '-7.1s', halo: 5.1 },
  { route: 'southline', duration: '16.8s', delay: '-3.6s', reverse: true, halo: 4.3 },
  { route: 'leftbranch', duration: '14.5s', delay: '-11.1s', halo: 4.1 },
  { route: 'corebranch', duration: '12.4s', delay: '-6.4s', reverse: true, halo: 5.3 },
  { route: 'rightbranch', duration: '17.2s', delay: '-1.7s', halo: 4.4 },
] as const;

export function NeuralSignalBackground({ variant = 'report' }: NeuralSignalBackgroundProps) {
  const idPrefix = `neural-signal-${variant}`;

  return (
    <div className={`neural-signal-background neural-signal-background-${variant}`} aria-hidden="true">
      <svg
        className="neural-signal-background__svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <filter id={`${idPrefix}-glow`} x="-180%" y="-180%" width="460%" height="460%">
            <feGaussianBlur stdDeviation="1.65" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0 0 0 0 0.36 0 0 0 0 0.92 0 0 0 0 1 0 0 0 0.92 0"
              result="glow"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {ROUTES.map((route) => (
            <path key={route.id} id={`${idPrefix}-${route.id}`} d={route.d} />
          ))}
        </defs>

        <g className="neural-signal-background__routes">
          {ROUTES.map((route) => (
            <path
              key={route.id}
              className={`neural-signal-background__route${route.emphasis ? ' neural-signal-background__route-emphasis' : ''}`}
              d={route.d}
            />
          ))}
        </g>

        <g className="neural-signal-background__nodes">
          {NODES.map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} className="neural-signal-background__node" cx={cx} cy={cy} r="0.42" />
          ))}
        </g>

        <g className="neural-signal-background__pulses" filter={`url(#${idPrefix}-glow)`}>
          {PULSES.map((pulse, index) => (
            <g key={`${pulse.route}-${index}`} className="neural-signal-background__pulse">
              <ellipse className="neural-signal-background__pulse-trail" cx="-2.35" cy="0" rx="3.35" ry="0.72" />
              <circle className="neural-signal-background__pulse-halo" r={pulse.halo} />
              <circle className="neural-signal-background__pulse-core" r="0.58" />
              <animateMotion
                dur={pulse.duration}
                begin={pulse.delay}
                repeatCount="indefinite"
                rotate="auto"
                keyPoints={pulse.reverse ? '1;0' : undefined}
                keyTimes={pulse.reverse ? '0;1' : undefined}
                calcMode={pulse.reverse ? 'linear' : undefined}
              >
                <mpath href={`#${idPrefix}-${pulse.route}`} />
              </animateMotion>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
