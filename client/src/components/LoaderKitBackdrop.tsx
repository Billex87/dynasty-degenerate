import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import "@/styles/loader-kit-backdrop.css";

type SignalSpark = {
  angle: number;
  radius: number;
  speed: number;
  lift: number;
};

export type LoaderManagerAnchor = {
  id: string;
  avatarUrl?: string | null;
};

type LoaderKitBackdropProps = {
  variant?: "panel" | "ambient";
  managerAnchors?: LoaderManagerAnchor[];
};

const managerAnchorSlots = [
  { position: [-2.6, 1.34, 0.72], tone: "cyan" },
  { position: [2.08, 1.22, -0.76], tone: "orange" },
  { position: [-2.8, -0.12, -0.44], tone: "orange" },
  { position: [2.72, -0.18, 0.58], tone: "cyan" },
  { position: [-1.88, -1.45, 0.36], tone: "cyan" },
  { position: [1.82, -1.48, -0.62], tone: "orange" },
  { position: [-0.8, 1.76, -0.52], tone: "cyan" },
  { position: [0.98, -1.82, 0.48], tone: "orange" },
] as const;

function ManagerAnchors({
  anchors,
  anchorRefs,
}: {
  anchors?: LoaderManagerAnchor[];
  anchorRefs: MutableRefObject<Array<HTMLSpanElement | null>>;
}) {
  useEffect(() => {
    anchorRefs.current.length = anchors?.length || 0;
  }, [anchorRefs, anchors?.length]);

  if (!anchors?.length) return null;

  return (
    <div className="loader-kit-backdrop__manager-anchors" aria-hidden="true">
      {anchors.slice(0, managerAnchorSlots.length).map((anchor, index) => {
        const slot = managerAnchorSlots[index] || managerAnchorSlots[0];

        return (
          <span
            key={anchor.id}
            className={`loader-kit-backdrop__manager-anchor loader-kit-backdrop__manager-anchor--${slot.tone}`}
            ref={(node) => {
              anchorRefs.current[index] = node;
            }}
          >
            <span className="loader-kit-backdrop__manager-node" />
            <span className="loader-kit-backdrop__manager-orbit" />
            <span className="loader-kit-backdrop__manager-avatar">
              {anchor.avatarUrl ? <img src={anchor.avatarUrl} alt="" /> : <span aria-hidden="true" />}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function LoaderKitFallback() {
  return (
    <div className="loader-kit-backdrop__fallback" aria-hidden="true">
      <span className="loader-kit-backdrop__fallback-core" />
      <span className="loader-kit-backdrop__fallback-ring loader-kit-backdrop__fallback-ring-a" />
      <span className="loader-kit-backdrop__fallback-ring loader-kit-backdrop__fallback-ring-b" />
    </div>
  );
}

function SignalCloud({ count = 320 }) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  const { pointPositions, pointColors, linePositions } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color(0x24f5ff),
      new THREE.Color(0xff8a2a),
      new THREE.Color(0xffb45a),
      new THREE.Color(0x0f6f86),
    ];

    for (let index = 0; index < count; index += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 1.55 + Math.random() * 2.65;

      positions.set(
        [
          radius * Math.sin(phi) * Math.cos(theta) * 1.28,
          radius * Math.sin(phi) * Math.sin(theta) * 0.72,
          radius * Math.cos(phi) * 0.94,
        ],
        index * 3
      );

      const color = palette[index % palette.length].clone().lerp(new THREE.Color(0xffffff), Math.random() * 0.08);
      colors.set([color.r, color.g, color.b], index * 3);
    }

    const pairs: number[] = [];
    for (let index = 0; index < count; index += 2) {
      const ax = positions[index * 3];
      const ay = positions[index * 3 + 1];
      const az = positions[index * 3 + 2];
      let best = -1;
      let bestDist = Infinity;

      for (let nextIndex = 0; nextIndex < count; nextIndex += 4) {
        if (index === nextIndex) continue;
        const bx = positions[nextIndex * 3];
        const by = positions[nextIndex * 3 + 1];
        const bz = positions[nextIndex * 3 + 2];
        const dist = (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = nextIndex;
        }
      }

      if (best !== -1 && bestDist < 0.72) {
        pairs.push(index, best);
      }
    }

    const lineData = new Float32Array(pairs.length * 3);
    pairs.forEach((index, positionIndex) => {
      lineData[positionIndex * 3] = positions[index * 3];
      lineData[positionIndex * 3 + 1] = positions[index * 3 + 1];
      lineData[positionIndex * 3 + 2] = positions[index * 3 + 2];
    });

    return {
      pointPositions: positions,
      pointColors: colors,
      linePositions: lineData,
    };
  }, [count]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (pointsRef.current) {
      pointsRef.current.rotation.y = -time * 0.045;
      pointsRef.current.rotation.z = Math.sin(time * 0.14) * 0.035;
    }
    if (linesRef.current) {
      linesRef.current.rotation.y = -time * 0.045;
      linesRef.current.rotation.z = Math.sin(time * 0.14) * 0.035;
    }
  });

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[pointPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[pointColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.033}
          vertexColors
          transparent
          opacity={0.84}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#24f5ff" transparent opacity={0.1} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
}

function LoaderKitCore({
  variant,
  managerAnchorCount,
  managerAnchorRefs,
}: {
  variant: "panel" | "ambient";
  managerAnchorCount: number;
  managerAnchorRefs: MutableRefObject<Array<HTMLSpanElement | null>>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const footballSpinRef = useRef<THREE.Group>(null);
  const managerAnchorNodeGroupRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<Array<THREE.Mesh | null>>([]);
  const sparksRef = useRef<Array<THREE.Mesh | null>>([]);
  const pointerRef = useRef({ x: 0, y: 0 });
  const projectedManagerPositionRef = useRef(new THREE.Vector3());

  const managerAnchorPositions = useMemo(
    () => managerAnchorSlots.map((slot) => new THREE.Vector3(...slot.position)),
    []
  );

  const sparks = useMemo<SignalSpark[]>(
    () =>
      Array.from({ length: 22 }, () => ({
        angle: Math.random() * Math.PI * 2,
        radius: 1.8 + Math.random() * 1.4,
        speed: 0.35 + Math.random() * 0.95,
        lift: Math.random() * Math.PI,
      })),
    []
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      pointerRef.current.x = (event.clientX / window.innerWidth - 0.5) * 0.42;
      pointerRef.current.y = (event.clientY / window.innerHeight - 0.5) * 0.26;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  useFrame(({ clock, camera, size }) => {
    const time = clock.getElapsedTime();
    const { x, y } = pointerRef.current;

    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.1 + x;
      groupRef.current.rotation.x = Math.sin(time * 0.2) * 0.07 + y;
    }

    if (footballSpinRef.current) {
      if (variant === "ambient") {
        footballSpinRef.current.position.x = 3.16 + Math.sin(time * 0.58) * 0.24;
        footballSpinRef.current.position.y = -0.06 + Math.sin(time * 0.82) * 0.42;
        footballSpinRef.current.position.z = Math.cos(time * 0.58) * 0.28;
        footballSpinRef.current.scale.setScalar(0.58);
      } else {
        footballSpinRef.current.position.set(0, 0, 0);
        footballSpinRef.current.scale.setScalar(1);
      }

      footballSpinRef.current.rotation.y = time * 0.64;
      footballSpinRef.current.rotation.x = Math.sin(time * 0.46) * 0.045;
      footballSpinRef.current.rotation.z = Math.sin(time * 0.33) * 0.08;
    }

    if (managerAnchorNodeGroupRef.current) {
      managerAnchorNodeGroupRef.current.rotation.y = -time * 0.28;
      managerAnchorNodeGroupRef.current.rotation.x = Math.sin(time * 0.18) * 0.05;
      managerAnchorNodeGroupRef.current.rotation.z = Math.sin(time * 0.14) * 0.035;
    }

    ringsRef.current.forEach((ring, index) => {
      if (!ring) return;
      ring.rotation.z += 0.0028 * (index + 1);
      ring.rotation.x += 0.0012 * (index % 2 ? -1 : 1);
    });

    sparksRef.current.forEach((spark, index) => {
      if (!spark) return;
      const seed = sparks[index];
      const angle = time * seed.speed + seed.angle;
      spark.position.set(
        Math.cos(angle) * seed.radius,
        Math.sin(angle * 1.22 + seed.lift) * 0.7,
        Math.sin(angle) * seed.radius
      );
      spark.scale.setScalar(0.55 + Math.sin(time * 4 + index) * 0.18 + 0.54);
    });

    camera.position.x += (x * 0.62 - camera.position.x) * 0.025;
    camera.position.y += (-y * 0.38 + 0.35 - camera.position.y) * 0.025;
    camera.lookAt(0, 0, 0);

    if (groupRef.current && managerAnchorCount > 0) {
      groupRef.current.updateMatrixWorld();
      managerAnchorNodeGroupRef.current?.updateMatrixWorld();
      const managerAnchorMatrix =
        managerAnchorNodeGroupRef.current?.matrixWorld || groupRef.current.matrixWorld;

      for (let index = 0; index < managerAnchorCount; index += 1) {
        const anchorElement = managerAnchorRefs.current[index];
        const anchorPosition = managerAnchorPositions[index];
        if (!anchorElement || !anchorPosition) continue;

        const projected = projectedManagerPositionRef.current
          .copy(anchorPosition)
          .applyMatrix4(managerAnchorMatrix)
          .project(camera);
        const anchorX = (projected.x * 0.5 + 0.5) * size.width;
        const anchorY = (-projected.y * 0.5 + 0.5) * size.height;
        const stageScale = variant === "panel" ? 1.22 : 1.06;
        const scaledAnchorX = size.width / 2 + (anchorX - size.width / 2) * stageScale;
        const scaledAnchorY = size.height / 2 + (anchorY - size.height / 2) * stageScale;
        const depth = THREE.MathUtils.clamp((projected.z + 1) / 2, 0, 1);
        const opacity = projected.z > -1 && projected.z < 1 ? 0.95 - depth * 0.34 : 0;

        anchorElement.style.setProperty("--anchor-x", `${scaledAnchorX}px`);
        anchorElement.style.setProperty("--anchor-y", `${scaledAnchorY}px`);
        anchorElement.style.setProperty("--anchor-scale", `${0.84 + (1 - depth) * 0.22}`);
        anchorElement.style.setProperty("--anchor-opacity", `${opacity}`);
      }
    }
  });

  return (
    <group ref={groupRef} scale={0.92}>
      <group ref={footballSpinRef}>
        <mesh scale={[1.86, 0.82, 0.82]}>
          <sphereGeometry args={[0.82, 44, 22]} />
          <meshBasicMaterial color="#8b4a24" wireframe transparent opacity={0.72} />
        </mesh>

        <mesh scale={[1.84, 0.8, 0.8]}>
          <sphereGeometry args={[0.8, 36, 18]} />
          <meshBasicMaterial color="#5b2d18" transparent opacity={0.16} depthWrite={false} />
        </mesh>

        <group>
          <mesh position={[0, 0.69, 0.02]}>
            <boxGeometry args={[0.78, 0.018, 0.018]} />
            <meshBasicMaterial color="#fff8e7" transparent opacity={0.76} />
          </mesh>
          {[-2, -1, 0, 1, 2].map((index) => (
            <mesh key={index} position={[index * 0.145, 0.7, 0.02]}>
              <boxGeometry args={[0.026, 0.018, 0.24]} />
              <meshBasicMaterial color="#fff8e7" transparent opacity={0.76} />
            </mesh>
          ))}
        </group>

        {[-1, 1].map((side) => (
          <group key={side}>
            {[
              [1.06, 0.51, "#fff8e7", 0.66],
              [1.26, 0.36, "#ffb45a", 0.48],
            ].map(([offset, radius, color, opacity]) => (
              <mesh key={`${side}-${offset}`} position={[side * Number(offset), 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[Number(radius), 0.01, 10, 72]} />
                <meshBasicMaterial color={String(color)} transparent opacity={Number(opacity)} />
              </mesh>
            ))}

            {[-0.24, 0, 0.24].map((yOffset, index) => (
              <mesh
                key={`${side}-spin-${index}`}
                position={[side * 1.36, yOffset, 0.18]}
                rotation={[0, side * 0.22, side * 0.12]}
              >
                <boxGeometry args={[0.02, 0.22, 0.018]} />
                <meshBasicMaterial color="#fff8e7" transparent opacity={0.58} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {[
        [2.04, 0.007, 1.1, 0.15, 0.25, "#ff8a2a", 0.56],
        [2.48, 0.005, -0.92, 0.5, 1.14, "#24f5ff", 0.26],
        [2.88, 0.004, 0.18, 1.0, -0.55, "#ffb45a", 0.36],
      ].map(([radius, tube, x, y, z, color, opacity], index) => (
        <mesh
          key={`${radius}-${index}`}
          ref={(node) => {
            ringsRef.current[index] = node;
          }}
          rotation={[Number(x), Number(y), Number(z)]}
        >
          <torusGeometry args={[Number(radius), Number(tube), 16, 180]} />
          <meshBasicMaterial color={String(color)} transparent opacity={Number(opacity)} />
        </mesh>
      ))}

      {sparks.map((_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            sparksRef.current[index] = node;
          }}
        >
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshBasicMaterial color={index % 3 === 0 ? "#ff8a2a" : "#24f5ff"} transparent opacity={0.76} />
        </mesh>
      ))}

      <group ref={managerAnchorNodeGroupRef}>
        {managerAnchorPositions.slice(0, managerAnchorCount).map((position, index) => {
          const slot = managerAnchorSlots[index] || managerAnchorSlots[0];
          const color = slot.tone === "orange" ? "#ff8a2a" : "#24f5ff";

          return (
            <group key={`manager-node-${index}`} position={position}>
              <mesh>
                <sphereGeometry args={[0.058, 12, 12]} />
                <meshBasicMaterial color={color} transparent opacity={0.94} blending={THREE.AdditiveBlending} />
              </mesh>
              <mesh scale={2.6}>
                <sphereGeometry args={[0.058, 12, 12]} />
                <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} />
              </mesh>
            </group>
          );
        })}
      </group>

      <SignalCloud />
    </group>
  );
}

export default function LoaderKitBackdrop({ variant = "panel", managerAnchors }: LoaderKitBackdropProps) {
  const managerAnchorRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const visibleManagerAnchors = managerAnchors?.slice(0, managerAnchorSlots.length) || [];

  return (
    <div className={`loader-kit-backdrop loader-kit-backdrop--${variant}`} aria-hidden="true">
      <div className="loader-kit-backdrop__stage">
        <Canvas
          className="loader-kit-backdrop__canvas"
          camera={{ position: [0, 0.35, 6.8], fov: 48 }}
          dpr={[1, 1.7]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          fallback={<LoaderKitFallback />}
        >
          <fog attach="fog" args={["#020712", 8, 18]} />
          <LoaderKitCore
            variant={variant}
            managerAnchorCount={visibleManagerAnchors.length}
            managerAnchorRefs={managerAnchorRefs}
          />
        </Canvas>
      </div>
      <ManagerAnchors anchors={visibleManagerAnchors} anchorRefs={managerAnchorRefs} />
      <div className="loader-kit-backdrop__matrix" />
      <div className="loader-kit-backdrop__scanline" />
      <div className="loader-kit-backdrop__vignette" />
    </div>
  );
}
