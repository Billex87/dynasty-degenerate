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
  length: number;
};

type NodePulseConfig = {
  position: [number, number, number];
  duration: number;
  delay: number;
  color: string;
};

type PacketRenderRefs = {
  head: THREE.Mesh | null;
  trail: THREE.Mesh | null;
  glow: THREE.Mesh | null;
  carrier: THREE.Mesh | null;
  node: THREE.Mesh | null;
};

const GRID_STEP = 0.22;
const PACKET_TIMINGS = [7.4, 9.8, 12.6, 15.8, 19.4];
const PACKET_DELAYS = [-1.2, -3.9, -7.8, -11.6, -15.1, -18.7];

const THEME_COLORS: Record<AITronTheme, { packet: string; trace: string; accent: string }> = {
  cyan: { packet: '#25e7ff', trace: '#1bb8d8', accent: '#ffab48' },
  green: { packet: '#8cffcf', trace: '#45e6a5', accent: '#73f0ff' },
  amber: { packet: '#73f0ff', trace: '#38d7ff', accent: '#ffab48' },
  red: { packet: '#8fd8ff', trace: '#38d7ff', accent: '#ff6b7a' },
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
    points.push(x, -halfHeight, -0.045, x, halfHeight, -0.045);
  }

  for (let y = snapToGrid(-halfHeight); y <= halfHeight + GRID_STEP; y += GRID_STEP) {
    points.push(-halfWidth, y, -0.045, halfWidth, y, -0.045);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function buildIntersectionGeometry(width: number, height: number) {
  const points: number[] = [];
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  for (let x = snapToGrid(-halfWidth); x <= halfWidth + GRID_STEP; x += GRID_STEP) {
    for (let y = snapToGrid(-halfHeight); y <= halfHeight + GRID_STEP; y += GRID_STEP) {
      points.push(x, y, -0.035);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function addTrace(points: number[], x: number, y: number, dx: number, dy: number) {
  const x1 = snapToGrid(x);
  const y1 = snapToGrid(y);
  const x2 = snapToGrid(x + dx);
  const y2 = snapToGrid(y + dy);
  points.push(x1, y1, -0.025, x2, y2, -0.025);
}

function buildTraceGeometry(width: number, height: number, amber = false) {
  const points: number[] = [];
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const traceSeeds = amber
    ? [
        [0.36, 0.28, 0.16, 0],
        [-0.18, -0.34, 0, -0.18],
      ]
    : [
        [-0.44, 0.36, 0.34, 0],
        [-0.1, 0.22, 0.28, 0],
        [0.18, 0.1, 0.22, 0],
        [0.44, -0.2, -0.32, 0],
        [-0.58, -0.38, 0.28, 0],
        [-0.12, -0.18, 0, 0.3],
        [0.22, -0.38, 0, 0.34],
        [0.62, 0.34, 0, -0.3],
      ];

  traceSeeds.forEach(([nx, ny, dx, dy], index) => {
    const startX = nx * halfWidth;
    const startY = ny * halfHeight;
    addTrace(points, startX, startY, dx, dy);

    if (!amber && index % 2 === 0) {
      addTrace(points, startX + dx, startY + dy, 0, index % 4 === 0 ? GRID_STEP * 1.6 : -GRID_STEP * 1.4);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function getPacketCount(density: AITronDensity) {
  if (density === 'small') return 3;
  if (density === 'large') return 8;
  return 5;
}

function buildPackets(width: number, height: number, density: AITronDensity, theme: AITronTheme): PacketConfig[] {
  const colors = THEME_COLORS[theme];
  const count = getPacketCount(density);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const rows = [-0.46, -0.34, -0.22, -0.08, 0.08, 0.22, 0.34, 0.46].map((value) => snapToGrid(value * halfHeight));
  const columns = [-0.58, -0.44, -0.28, -0.12, 0.08, 0.24, 0.42, 0.58].map((value) => snapToGrid(value * halfWidth));

  return Array.from({ length: count }, (_, index) => {
    const axis = index % 3 === 1 ? 'y' : 'x';
    const direction = index % 4 === 2 ? -1 : 1;
    const distance = direction * (0.34 + (index % 4) * 0.12);
    const isAccent = index === count - 1 || (theme === 'amber' && index % 4 === 0);
    const color = isAccent ? colors.accent : colors.packet;

    if (axis === 'x') {
      return {
        axis,
        start: [snapToGrid((-0.56 + index * 0.11) * halfWidth), rows[index % rows.length], 0.02],
        distance,
        duration: PACKET_TIMINGS[index % PACKET_TIMINGS.length],
        delay: PACKET_DELAYS[index % PACKET_DELAYS.length],
        color,
        length: 0.08 + (index % 3) * 0.025,
      };
    }

    return {
      axis,
      start: [columns[index % columns.length], snapToGrid((-0.48 + index * 0.13) * halfHeight), 0.02],
      distance,
      duration: PACKET_TIMINGS[index % PACKET_TIMINGS.length],
      delay: PACKET_DELAYS[index % PACKET_DELAYS.length],
      color,
      length: 0.08 + (index % 3) * 0.025,
    };
  });
}

function buildPulseNodes(width: number, height: number, density: AITronDensity, theme: AITronTheme): NodePulseConfig[] {
  const colors = THEME_COLORS[theme];
  const count = density === 'small' ? 3 : density === 'large' ? 8 : 5;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return Array.from({ length: count }, (_, index) => ({
    position: [
      snapToGrid((-0.48 + (index % 6) * 0.19) * halfWidth),
      snapToGrid((-0.38 + Math.floor(index / 2) * 0.18) * halfHeight),
      0.035,
    ],
    duration: 8.4 + (index % 5) * 2.2,
    delay: -index * 2.7,
    color: theme === 'amber' && index % 5 === 0 ? colors.accent : colors.packet,
  }));
}

function packetProgress(elapsed: number, duration: number, delay: number) {
  const raw = ((elapsed + Math.abs(delay)) % duration) / duration;
  const opacity = raw < 0.05
    ? raw / 0.05
    : raw > 0.34 && raw < 0.48
      ? Math.max(0, 1 - (raw - 0.34) / 0.14)
      : raw >= 0.48
        ? 0
        : 1;
  return { travel: Math.min(raw / 0.34, 1), opacity };
}

function setMaterialOpacity(mesh: THREE.Mesh | null, opacity: number) {
  if (!mesh) return;
  const material = mesh.material as THREE.MeshBasicMaterial;
  material.opacity = opacity;
}

function AITronScene({ theme, density, reducedMotion }: Required<AITronSurfaceProps> & { reducedMotion: boolean }) {
  const { viewport } = useThree();
  const packetRefs = useRef<PacketRenderRefs[]>([]);
  const pulseRefs = useRef<Array<THREE.Mesh | null>>([]);
  const elapsedRef = useRef(0);
  const colors = THEME_COLORS[theme];
  const width = Math.max(viewport.width, 1);
  const height = Math.max(viewport.height, 1);

  const gridGeometry = useMemo(() => buildGridGeometry(width, height), [width, height]);
  const intersectionGeometry = useMemo(() => buildIntersectionGeometry(width, height), [width, height]);
  const traceGeometry = useMemo(() => buildTraceGeometry(width, height), [width, height]);
  const amberTraceGeometry = useMemo(() => buildTraceGeometry(width, height, true), [width, height]);
  const packets = useMemo(() => buildPackets(width, height, density, theme), [width, height, density, theme]);
  const pulseNodes = useMemo(() => buildPulseNodes(width, height, density, theme), [width, height, density, theme]);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    elapsedRef.current += delta;
    const elapsed = elapsedRef.current;

    packets.forEach((packet, index) => {
      const refs = packetRefs.current[index];
      if (!refs) return;
      const { travel, opacity } = packetProgress(elapsed, packet.duration, packet.delay);
      const x = packet.start[0] + (packet.axis === 'x' ? packet.distance * travel : 0);
      const y = packet.start[1] + (packet.axis === 'y' ? packet.distance * travel : 0);
      const trailingOffset = packet.axis === 'x'
        ? [packet.distance > 0 ? -packet.length * 0.62 : packet.length * 0.62, 0, 0]
        : [0, packet.distance > 0 ? -packet.length * 0.62 : packet.length * 0.62, 0];

      refs.head?.position.set(x, y, packet.start[2]);
      refs.trail?.position.set(x + trailingOffset[0], y + trailingOffset[1], packet.start[2] - 0.002);
      refs.glow?.position.set(x, y, packet.start[2] - 0.004);
      refs.carrier?.position.set(x, y, packet.start[2] - 0.006);
      refs.node?.position.set(
        snapToGrid(x + (packet.axis === 'x' ? trailingOffset[0] * 0.25 : 0)),
        snapToGrid(y + (packet.axis === 'y' ? trailingOffset[1] * 0.25 : 0)),
        packet.start[2] + 0.004,
      );
      setMaterialOpacity(refs.head, opacity * 0.72);
      setMaterialOpacity(refs.trail, opacity * 0.34);
      setMaterialOpacity(refs.glow, opacity * 0.08);
      setMaterialOpacity(refs.carrier, opacity * 0.32);
      setMaterialOpacity(refs.node, opacity * 0.42);
    });

    pulseNodes.forEach((node, index) => {
      const mesh = pulseRefs.current[index];
      if (!mesh) return;
      const cycle = ((elapsed + Math.abs(node.delay)) % node.duration) / node.duration;
      const pulse = cycle > 0.34 && cycle < 0.44 ? Math.sin(((cycle - 0.34) / 0.1) * Math.PI) : 0;
      mesh.scale.setScalar(0.75 + pulse * 0.42);
      setMaterialOpacity(mesh, 0.07 + pulse * 0.38);
    });
  });

  return (
    <>
      <lineSegments geometry={gridGeometry}>
        <lineBasicMaterial color={colors.trace} transparent opacity={0.1} depthWrite={false} depthTest={false} toneMapped={false} />
      </lineSegments>
      <points geometry={intersectionGeometry}>
        <pointsMaterial color={colors.trace} transparent opacity={0.24} size={0.013} sizeAttenuation depthWrite={false} depthTest={false} toneMapped={false} />
      </points>
      <lineSegments geometry={traceGeometry}>
        <lineBasicMaterial color={colors.trace} transparent opacity={0.3} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </lineSegments>
      <lineSegments geometry={amberTraceGeometry}>
        <lineBasicMaterial color={colors.accent} transparent opacity={0.16} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </lineSegments>
      {pulseNodes.map((node, index) => (
        <mesh
          key={`node-${index}-${node.position.join('-')}`}
          ref={(mesh) => {
            pulseRefs.current[index] = mesh;
          }}
          position={node.position}
        >
          <circleGeometry args={[0.012, 12]} />
          <meshBasicMaterial
            color={node.color}
            transparent
            opacity={reducedMotion ? 0.28 : 0.12}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      {packets.map((packet, index) => {
        const rotation = packet.axis === 'y' ? Math.PI / 2 : 0;
        return (
          <group key={`packet-${index}-${packet.start.join('-')}`}>
            <mesh
              ref={(mesh) => {
                packetRefs.current[index] = { ...(packetRefs.current[index] || {}), glow: mesh };
              }}
              position={packet.start}
            >
              <circleGeometry args={[0.026, 12]} />
              <meshBasicMaterial color={packet.color} transparent opacity={reducedMotion ? 0.08 : 0} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false} />
            </mesh>
            <mesh
              ref={(mesh) => {
                packetRefs.current[index] = { ...(packetRefs.current[index] || {}), carrier: mesh };
              }}
              position={packet.start}
              rotation={[0, 0, rotation]}
            >
              <planeGeometry args={[packet.length * 1.25, 0.009]} />
              <meshBasicMaterial color={packet.color} transparent opacity={reducedMotion ? 0.08 : 0} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false} />
            </mesh>
            <mesh
              ref={(mesh) => {
                packetRefs.current[index] = { ...(packetRefs.current[index] || {}), node: mesh };
              }}
              position={packet.start}
            >
              <circleGeometry args={[0.015, 12]} />
              <meshBasicMaterial color={packet.color} transparent opacity={reducedMotion ? 0.08 : 0} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false} />
            </mesh>
            <mesh
              ref={(mesh) => {
                packetRefs.current[index] = { ...(packetRefs.current[index] || {}), trail: mesh };
              }}
              position={packet.start}
              rotation={[0, 0, rotation]}
            >
              <planeGeometry args={[packet.length, 0.014]} />
              <meshBasicMaterial color={packet.color} transparent opacity={reducedMotion ? 0.1 : 0} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false} />
            </mesh>
            <mesh
              ref={(mesh) => {
                packetRefs.current[index] = { ...(packetRefs.current[index] || {}), head: mesh };
              }}
              position={packet.start}
              rotation={[0, 0, rotation]}
            >
              <planeGeometry args={[Math.max(0.036, packet.length * 0.48), 0.02]} />
              <meshBasicMaterial color={packet.color} transparent opacity={reducedMotion ? 0.14 : 0} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

export function AITronSurface({ theme = 'cyan', density = 'medium' }: AITronSurfaceProps) {
  const reducedMotion = usePrefersReducedMotion();
  const fallbackPackets = density === 'small' ? [1, 4, 5] : density === 'large' ? [1, 2, 3, 4, 5, 6] : [1, 2, 4, 5];

  return (
    <div className="ai-tron-surface" aria-hidden="true">
      {fallbackPackets.map((packet) => (
        <span key={packet} className={`ai-tron-css-packet ai-tron-css-packet-${packet}`} />
      ))}
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
