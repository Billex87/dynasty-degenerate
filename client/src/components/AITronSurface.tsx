import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

export type AITronTheme = 'cyan' | 'green' | 'amber' | 'red' | 'blue';
export type AITronDensity = 'small' | 'medium' | 'large';

interface AITronSurfaceProps {
  theme?: AITronTheme;
  density?: AITronDensity;
}

type PacketConfig = {
  axis: 'x' | 'y';
  start: [number, number, number];
  distance: number;
  duration: number;
  delay: number;
  color: string;
  dash: boolean;
};

type NodeConfig = {
  position: [number, number, number];
  duration: number;
  delay: number;
  color: string;
};

const GRID_STEP = 0.24;
const PACKET_TIMINGS = [4.8, 6.2, 7.5, 9.1, 11.4];
const PACKET_DELAYS = [-1.2, -3.8, -5.1, -7.4, -9.6];

const THEME_COLORS: Record<AITronTheme, { packet: string; trace: string; accent: string }> = {
  cyan: { packet: '#73f0ff', trace: '#56dcff', accent: '#ffab48' },
  green: { packet: '#8cffcf', trace: '#45e6a5', accent: '#73f0ff' },
  amber: { packet: '#73f0ff', trace: '#56dcff', accent: '#ffab48' },
  red: { packet: '#7dd3fc', trace: '#56dcff', accent: '#ff6b7a' },
  blue: { packet: '#8fd8ff', trace: '#60a5fa', accent: '#73f0ff' },
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return reduced;
}

function snapToGrid(value: number) {
  return Math.round(value / GRID_STEP) * GRID_STEP;
}

function buildGridGeometry(width: number, height: number) {
  const points: number[] = [];
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  for (let x = snapToGrid(-halfWidth); x <= halfWidth + GRID_STEP; x += GRID_STEP) {
    points.push(x, -halfHeight, -0.03, x, halfHeight, -0.03);
  }

  for (let y = snapToGrid(-halfHeight); y <= halfHeight + GRID_STEP; y += GRID_STEP) {
    points.push(-halfWidth, y, -0.03, halfWidth, y, -0.03);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function buildTraceGeometry(width: number, height: number) {
  const points: number[] = [];
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const traces = [
    [-0.38, 0.28, 0.34, 0],
    [0.08, -0.14, 0.46, 0],
    [-0.08, -0.36, 0, 0.46],
    [0.42, 0.08, 0, -0.38],
    [-0.64, -0.06, 0.28, 0],
    [0.62, -0.3, -0.32, 0],
  ];

  traces.forEach(([nx, ny, dx, dy], index) => {
    const x1 = snapToGrid(nx * halfWidth);
    const y1 = snapToGrid(ny * halfHeight);
    const x2 = snapToGrid(x1 + dx);
    const y2 = snapToGrid(y1 + dy);
    points.push(x1, y1, -0.02, x2, y2, -0.02);

    if (index % 2 === 0) {
      const cornerX = snapToGrid(x2);
      const cornerY = snapToGrid(y2 + (dy === 0 ? GRID_STEP : 0));
      points.push(x2, y2, -0.02, cornerX, cornerY, -0.02);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function buildPackets(width: number, height: number, density: AITronDensity, theme: AITronTheme): PacketConfig[] {
  const colors = THEME_COLORS[theme];
  const count = density === 'small' ? 3 : density === 'large' ? 8 : 5;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const rows = [-0.36, -0.12, 0.12, 0.34, 0.48].map((value) => snapToGrid(value * halfHeight));
  const columns = [-0.42, -0.18, 0.16, 0.38, 0.58].map((value) => snapToGrid(value * halfWidth));

  return Array.from({ length: count }, (_, index) => {
    const axis = index % 3 === 1 ? 'y' : 'x';
    const amber = theme === 'amber' || index === count - 1;
    const direction = index % 4 === 2 ? -1 : 1;
    const distance = direction * (0.42 + (index % 4) * 0.17);

    if (axis === 'x') {
      const startX = snapToGrid((-0.42 + index * 0.13) * halfWidth);
      const y = rows[index % rows.length];
      return {
        axis,
        start: [startX, y, 0],
        distance,
        duration: PACKET_TIMINGS[index % PACKET_TIMINGS.length],
        delay: PACKET_DELAYS[index % PACKET_DELAYS.length],
        color: amber ? colors.accent : colors.packet,
        dash: index % 2 === 0,
      };
    }

    const x = columns[index % columns.length];
    const startY = snapToGrid((-0.38 + index * 0.12) * halfHeight);
    return {
      axis,
      start: [x, startY, 0],
      distance,
      duration: PACKET_TIMINGS[index % PACKET_TIMINGS.length],
      delay: PACKET_DELAYS[index % PACKET_DELAYS.length],
      color: amber ? colors.accent : colors.packet,
      dash: index % 2 === 0,
    };
  });
}

function buildNodes(width: number, height: number, density: AITronDensity, theme: AITronTheme): NodeConfig[] {
  const colors = THEME_COLORS[theme];
  const count = density === 'small' ? 3 : density === 'large' ? 9 : 5;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return Array.from({ length: count }, (_, index) => ({
    position: [
      snapToGrid((-0.45 + (index % 5) * 0.22) * halfWidth),
      snapToGrid((-0.32 + Math.floor(index / 2) * 0.18) * halfHeight),
      0.01,
    ],
    duration: 5.6 + (index % 4) * 1.7,
    delay: -index * 1.35,
    color: theme === 'amber' && index % 4 === 0 ? colors.accent : colors.packet,
  }));
}

function packetProgress(elapsed: number, duration: number, delay: number) {
  const raw = ((elapsed + Math.abs(delay)) % duration) / duration;
  const opacity = raw < 0.08
    ? raw / 0.08
    : raw > 0.72
      ? Math.max(0, 1 - (raw - 0.72) / 0.28)
      : 1;
  return { travel: Math.min(raw / 0.72, 1), opacity };
}

function AITronScene({ theme, density, reducedMotion }: Required<AITronSurfaceProps> & { reducedMotion: boolean }) {
  const { viewport } = useThree();
  const packetRefs = useRef<Array<THREE.Mesh | null>>([]);
  const nodeRefs = useRef<Array<THREE.Mesh | null>>([]);
  const elapsedRef = useRef(0);
  const colors = THEME_COLORS[theme];
  const width = Math.max(viewport.width, 1);
  const height = Math.max(viewport.height, 1);

  const gridGeometry = useMemo(() => buildGridGeometry(width, height), [width, height]);
  const traceGeometry = useMemo(() => buildTraceGeometry(width, height), [width, height]);
  const packets = useMemo(() => buildPackets(width, height, density, theme), [width, height, density, theme]);
  const nodes = useMemo(() => buildNodes(width, height, density, theme), [width, height, density, theme]);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    elapsedRef.current += delta;
    const elapsed = elapsedRef.current;

    packets.forEach((packet, index) => {
      const mesh = packetRefs.current[index];
      if (!mesh) return;
      const { travel, opacity } = packetProgress(elapsed, packet.duration, packet.delay);
      mesh.position.set(
        packet.start[0] + (packet.axis === 'x' ? packet.distance * travel : 0),
        packet.start[1] + (packet.axis === 'y' ? packet.distance * travel : 0),
        packet.start[2],
      );
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = opacity * (packet.dash ? 0.76 : 0.88);
    });

    nodes.forEach((node, index) => {
      const mesh = nodeRefs.current[index];
      if (!mesh) return;
      const cycle = ((elapsed + Math.abs(node.delay)) % node.duration) / node.duration;
      const pulse = cycle > 0.42 && cycle < 0.55 ? Math.sin(((cycle - 0.42) / 0.13) * Math.PI) : 0;
      mesh.scale.setScalar(0.75 + pulse * 0.45);
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = 0.14 + pulse * 0.54;
    });
  });

  return (
    <>
      <lineSegments geometry={gridGeometry}>
        <lineBasicMaterial color={colors.trace} transparent opacity={0.075} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={traceGeometry}>
        <lineBasicMaterial color={colors.trace} transparent opacity={0.22} depthWrite={false} />
      </lineSegments>
      {nodes.map((node, index) => (
        <mesh
          key={`node-${index}-${node.position.join('-')}`}
          ref={(mesh) => {
            nodeRefs.current[index] = mesh;
          }}
          position={node.position}
        >
          <circleGeometry args={[0.012, 12]} />
          <meshBasicMaterial
            color={node.color}
            transparent
            opacity={reducedMotion ? 0.22 : 0.14}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
      {packets.map((packet, index) => (
        <mesh
          key={`packet-${index}-${packet.start.join('-')}`}
          ref={(mesh) => {
            packetRefs.current[index] = mesh;
          }}
          position={packet.start}
          rotation={[0, 0, packet.axis === 'y' ? Math.PI / 2 : 0]}
        >
          {packet.dash ? <planeGeometry args={[0.12, 0.018]} /> : <circleGeometry args={[0.018, 14]} />}
          <meshBasicMaterial
            color={packet.color}
            transparent
            opacity={reducedMotion ? 0.25 : 0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

export function AITronSurface({ theme = 'cyan', density = 'medium' }: AITronSurfaceProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="ai-tron-surface" aria-hidden="true">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 5], zoom: 100 }}
        gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
        dpr={[1, 1.5]}
      >
        <AITronScene theme={theme} density={density} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
