import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ChampionAvatarFrame } from "./ManagerChampionships";

export interface LeagueGlobeNode {
  id: string;
  name: string;
  value: number | null;
  standingLabel?: string | null;
  standingSubLabel?: string | null;
  standingRank?: number | null;
  avatarUrl?: string | null;
  isViewer?: boolean;
  rank?: number | null;
}

export interface LeagueGlobeConnection {
  from: string;
  to: string;
  intensity?: number;
}

interface LeagueGlobe3DProps {
  nodes: LeagueGlobeNode[];
  connections: LeagueGlobeConnection[];
  className?: string;
}

interface LeagueGlobePanelAnchor {
  nodeX: number;
  nodeY: number;
  labelX: number;
  labelY: number;
  labelAlign?: "left" | "right";
}

const CYAN = "#00c8e8";
const ORANGE = "#f4a020";

const VIEWER_PANEL_ANCHOR: LeagueGlobePanelAnchor = {
  nodeX: 61.5,
  nodeY: 55.5,
  labelX: 62.8,
  labelY: 55.5,
  labelAlign: "right",
};

const GLOBE_PANEL_ANCHORS: LeagueGlobePanelAnchor[] = [
  { nodeX: 44.5, nodeY: 43.5, labelX: 45.8, labelY: 43.5, labelAlign: "right" },
  { nodeX: 52.5, nodeY: 35.5, labelX: 53.8, labelY: 35.5, labelAlign: "right" },
  { nodeX: 58.4, nodeY: 43.2, labelX: 59.7, labelY: 43.2, labelAlign: "right" },
  { nodeX: 64.8, nodeY: 29.5, labelX: 66.1, labelY: 29.5, labelAlign: "right" },
  { nodeX: 76.5, nodeY: 25.2, labelX: 77.8, labelY: 25.2, labelAlign: "right" },
  { nodeX: 84.2, nodeY: 38.5, labelX: 82.9, labelY: 38.5, labelAlign: "left" },
  { nodeX: 91.4, nodeY: 49.2, labelX: 90.1, labelY: 49.2, labelAlign: "left" },
  { nodeX: 78.6, nodeY: 53.5, labelX: 79.9, labelY: 53.5, labelAlign: "right" },
  { nodeX: 69.7, nodeY: 64.8, labelX: 71, labelY: 64.8, labelAlign: "right" },
  { nodeX: 55.4, nodeY: 64.8, labelX: 56.7, labelY: 64.8, labelAlign: "right" },
  { nodeX: 47.8, nodeY: 71.8, labelX: 49.1, labelY: 71.8, labelAlign: "right" },
  { nodeX: 83.6, nodeY: 71.6, labelX: 82.3, labelY: 71.6, labelAlign: "left" },
  { nodeX: 72.8, nodeY: 86.8, labelX: 74.1, labelY: 86.8, labelAlign: "right" },
];

export default function LeagueGlobe3D({
  nodes,
  connections,
  className,
}: LeagueGlobe3DProps) {
  const [sceneSupport, setSceneSupport] = useState({
    ready: false,
    reducedMotion: false,
    canUseWebGL: false,
  });
  const [canvasFailed, setCanvasFailed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      setSceneSupport({
        ready: true,
        reducedMotion: true,
        canUseWebGL: false,
      });
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setSceneSupport({
        ready: true,
        reducedMotion: motionQuery.matches,
        canUseWebGL: canUseWebGL(),
      });

    update();
    motionQuery.addEventListener("change", update);
    return () => motionQuery.removeEventListener("change", update);
  }, []);

  const fallback =
    !sceneSupport.ready ||
    sceneSupport.reducedMotion ||
    !sceneSupport.canUseWebGL ||
    canvasFailed;

  const panelAnchors = useMemo(
    () => buildPanelAnchors(nodes),
    [nodes]
  );
  const labelPositions = useMemo(
    () => buildLabelPositions(nodes, panelAnchors),
    [nodes, panelAnchors]
  );

  return (
    <div className={className} data-testid="league-globe-3d-scene">
      {fallback ? (
        <LeagueGlobeFallback nodes={nodes} connections={connections} />
      ) : (
        <Canvas
          camera={{ position: [0, 0.5, 5.6], fov: 42 }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener(
              "webglcontextlost",
              event => {
                event.preventDefault();
                setCanvasFailed(true);
              },
              { once: true }
            );
          }}
          onError={() => setCanvasFailed(true)}
          style={{ background: "transparent" }}
        >
          <Suspense fallback={null}>
            <LeagueGlobeScene
              nodes={nodes}
              connections={connections}
              panelAnchors={panelAnchors}
              reducedMotion={sceneSupport.reducedMotion}
            />
          </Suspense>
        </Canvas>
      )}
      <div className="league-globe-label-layer" aria-hidden="true">
        {nodes.map((node, index) => {
          const position = labelPositions.get(node.id);
          if (!position) return null;
          const displayRank = node.standingRank ?? node.rank ?? null;
          return (
            <span
              key={node.id}
              className={`league-globe-manager-label${node.isViewer ? " is-viewer" : ""}${displayRank && displayRank <= 3 ? " is-leader" : ""}${position.align === "left" ? " is-label-left" : ""}`}
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
              }}
              data-node-index={index}
            >
              <ChampionAvatarFrame
                managerName={node.name}
                className="league-globe-label-avatar"
              >
                <LeagueGlobeAvatar node={node} />
              </ChampionAvatarFrame>
              <span>
                <strong>{node.name}</strong>
                {node.standingLabel ? (
                  <em>
                    {node.standingLabel}
                    {node.standingSubLabel ? ` ${node.standingSubLabel}` : ""}
                  </em>
                ) : null}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!context) return false;
    const loseContext = context.getExtension("WEBGL_lose_context");
    loseContext?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function LeagueGlobeScene({
  nodes,
  connections,
  panelAnchors,
  reducedMotion,
}: {
  nodes: LeagueGlobeNode[];
  connections: LeagueGlobeConnection[];
  panelAnchors: Map<string, LeagueGlobePanelAnchor>;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const nodePositions = useMemo(
    () => buildNodePositions(nodes, panelAnchors),
    [nodes, panelAnchors]
  );
  const normalizedConnections = useMemo(
    () =>
      connections
        .map(connection => {
          const from = nodePositions.get(connection.from);
          const to = nodePositions.get(connection.to);
          return from && to ? { ...connection, fromPosition: from, toPosition: to } : null;
        })
        .filter(
          (
            connection
          ): connection is LeagueGlobeConnection & {
            fromPosition: THREE.Vector3;
            toPosition: THREE.Vector3;
          } => Boolean(connection)
        ),
    [connections, nodePositions]
  );

  useFrame(({ clock }) => {
    if (!groupRef.current || reducedMotion) return;
    groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.18) * 0.045;
    groupRef.current.rotation.x = -0.12 + Math.sin(clock.elapsedTime * 0.22) * 0.018;
  });

  return (
    <>
      <ambientLight intensity={0.18} />
      <pointLight position={[-2.8, 2.2, 2.4]} color={CYAN} intensity={1.2} distance={6} />
      <pointLight position={[2.5, 1.4, 2.6]} color={ORANGE} intensity={0.85} distance={6} />
      <group ref={groupRef} position={[0, -0.42, 0]} rotation={[-0.12, 0, 0]}>
        <ConnectionLayer connections={normalizedConnections} reducedMotion={reducedMotion} />
      </group>
    </>
  );
}

function buildPanelAnchors(nodes: LeagueGlobeNode[]) {
  const anchors = new Map<string, LeagueGlobePanelAnchor>();
  const viewerNode = nodes.find(node => node.isViewer) || nodes[0];
  let fallbackIndex = 0;

  nodes.forEach(node => {
    if (viewerNode && node.id === viewerNode.id) {
      anchors.set(node.id, VIEWER_PANEL_ANCHOR);
      return;
    }

    const anchor = GLOBE_PANEL_ANCHORS[fallbackIndex % GLOBE_PANEL_ANCHORS.length];
    anchors.set(node.id, anchor);
    fallbackIndex += 1;
  });

  return anchors;
}

function buildNodePositions(
  nodes: LeagueGlobeNode[],
  panelAnchors: Map<string, LeagueGlobePanelAnchor>
) {
  const positions = new Map<string, THREE.Vector3>();

  nodes.forEach((node, index) => {
    const anchor = panelAnchors.get(node.id) || VIEWER_PANEL_ANCHOR;
    const jitterX = node.isViewer ? 0 : seededUnit(`${node.id}:x`) * 0.16;
    const jitterY = node.isViewer ? 0 : seededUnit(`${node.id}:y`) * 0.12;
    const jitterZ = node.isViewer ? 0 : seededUnit(`${node.id}:z`) * 0.1;
    const valueLift = node.rank && node.rank <= 3 ? 0.16 : 0;
    positions.set(
      node.id,
      new THREE.Vector3(
        ((anchor.nodeX - 50) / 50) * 3.9 + jitterX,
        ((50 - anchor.nodeY) / 50) * 2.25 + valueLift + jitterY,
        0.44 + (node.isViewer ? 0.1 : 0) + jitterZ
      )
    );
  });

  return positions;
}

function buildLabelPositions(
  nodes: LeagueGlobeNode[],
  panelAnchors: Map<string, LeagueGlobePanelAnchor>
) {
  const positions = new Map<string, { x: number; y: number; align: "left" | "right" }>();

  nodes.forEach((node, index) => {
    const anchor = panelAnchors.get(node.id) || VIEWER_PANEL_ANCHOR;
    const xJitter = node.isViewer ? 0 : seededUnit(`${node.id}:label-x`) * 2.3;
    const yJitter = node.isViewer ? 0 : seededUnit(`${node.id}:label-y`) * 2.1;
    const x = anchor.labelX + xJitter;
    const y = anchor.labelY + yJitter;
    positions.set(node.id, {
      x: Math.max(34, Math.min(94, x)),
      y: Math.max(14, Math.min(86, y)),
      align: anchor.labelAlign || "right",
    });
  });

  return positions;
}

function LeagueGlobeAvatar({ node }: { node: LeagueGlobeNode }) {
  if (node.avatarUrl) {
    return <img src={node.avatarUrl} alt="" />;
  }

  return <b>{getManagerInitials(node.name)}</b>;
}

function getManagerInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
}

function seededUnit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967295 - 0.5) * 2;
}

function GlobeGrid() {
  const lines = useMemo(() => {
    const nextLines: Array<{ points: THREE.Vector3[]; color: string; opacity: number }> = [];
    const radius = 2.88;

    for (let lat = 0; lat < 8; lat += 1) {
      const y = -1.28 + lat * 0.27;
      const width = Math.sqrt(Math.max(radius * radius - (y + 0.34) ** 2, 0.1));
      const points = Array.from({ length: 72 }, (_, index) => {
        const theta = THREE.MathUtils.lerp(Math.PI, 0, index / 71);
        return new THREE.Vector3(Math.cos(theta) * width, y, Math.sin(theta) * 0.28 - 0.06);
      });
      nextLines.push({
        points,
        color: lat % 2 ? ORANGE : CYAN,
        opacity: lat % 2 ? 0.22 : 0.32,
      });
    }

    for (let meridian = 0; meridian < 13; meridian += 1) {
      const x = -2.75 + meridian * 0.46;
      const points = Array.from({ length: 58 }, (_, index) => {
        const y = THREE.MathUtils.lerp(-1.3, 0.82, index / 57);
        const bow = Math.sin((index / 57) * Math.PI);
        return new THREE.Vector3(x * (0.38 + bow * 0.62), y, -0.12 + bow * 0.34);
      });
      nextLines.push({
        points,
        color: meridian % 2 ? ORANGE : CYAN,
        opacity: meridian % 2 ? 0.14 : 0.22,
      });
    }

    return nextLines;
  }, []);

  return (
    <group position={[0, -0.36, 0]} scale={[1.12, 1.12, 1.12]}>
      {lines.map((line, index) => (
        <LineStrip
          key={`globe-grid-${index}`}
          points={line.points}
          color={line.color}
          opacity={line.opacity}
        />
      ))}
      <mesh position={[0, -0.86, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.9, 3.18, 128]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.075} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function ConnectionLayer({
  connections,
  reducedMotion,
}: {
  connections: Array<
    LeagueGlobeConnection & {
      fromPosition: THREE.Vector3;
      toPosition: THREE.Vector3;
    }
  >;
  reducedMotion: boolean;
}) {
  return (
    <group>
      {connections.slice(0, 18).map((connection, index) => (
        <ConnectionLine
          key={`${connection.from}-${connection.to}-${index}`}
          connection={connection}
          index={index}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}

function ConnectionLine({
  connection,
  index,
  reducedMotion,
}: {
  connection: LeagueGlobeConnection & {
    fromPosition: THREE.Vector3;
    toPosition: THREE.Vector3;
  };
  index: number;
  reducedMotion: boolean;
}) {
  const materialRef = useRef<THREE.LineBasicMaterial>(null);
  const points = useMemo(() => {
    const midpoint = connection.fromPosition
      .clone()
      .lerp(connection.toPosition, 0.5)
      .add(new THREE.Vector3(0, 0.34 + Math.min(connection.intensity || 1, 4) * 0.04, 0.36));
    return new THREE.QuadraticBezierCurve3(
      connection.fromPosition,
      midpoint,
      connection.toPosition
    ).getPoints(26);
  }, [connection.fromPosition, connection.toPosition, connection.intensity]);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    const base = 0.26 + Math.min(connection.intensity || 1, 4) * 0.035;
    materialRef.current.opacity = reducedMotion
      ? base
      : base + Math.sin(clock.elapsedTime * 1.7 + index * 0.7) * 0.14;
  });

  return (
    <LineStrip
      points={points}
      color={index % 2 ? ORANGE : CYAN}
      opacity={0.28}
      materialRef={materialRef}
    />
  );
}

function LineStrip({
  points,
  color,
  opacity,
  materialRef,
}: {
  points: THREE.Vector3[];
  color: string;
  opacity: number;
  materialRef?: React.Ref<THREE.LineBasicMaterial>;
}) {
  const positions = useMemo(() => {
    const buffer = new Float32Array(points.length * 3);
    points.forEach((point, index) => {
      buffer[index * 3] = point.x;
      buffer[index * 3 + 1] = point.y;
      buffer[index * 3 + 2] = point.z;
    });
    return buffer;
  }, [points]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </line>
  );
}

function LeagueGlobeFallback({
  nodes,
  connections,
}: {
  nodes: LeagueGlobeNode[];
  connections: LeagueGlobeConnection[];
}) {
  return (
    <div className="league-globe-fallback" aria-hidden="true">
      <span className="league-globe-fallback-arc league-globe-fallback-arc-a" />
      <span className="league-globe-fallback-arc league-globe-fallback-arc-b" />
      <span className="league-globe-fallback-arc league-globe-fallback-arc-c" />
      {connections.slice(0, 8).map((connection, index) => (
        <span
          key={`${connection.from}-${connection.to}-${index}`}
          className={`league-globe-fallback-link league-globe-fallback-link-${index + 1}`}
        />
      ))}
      {nodes.slice(0, 14).map((node, index) => (
        <span
          key={node.id}
          className={`league-globe-fallback-node league-globe-fallback-node-${index + 1}${node.isViewer ? " is-viewer" : ""}`}
        />
      ))}
    </div>
  );
}
