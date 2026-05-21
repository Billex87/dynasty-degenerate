import { Canvas, useFrame } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import "./AiFantasyLoader.css";

const PHASES = [
  {
    at: 0,
    label: "Booting model",
    copy:
      "Loading neural projections, volatility curves, matchup pressure, and the data goblin responsible for your bench points.",
  },
  {
    at: 18,
    label: "Parsing draft board",
    copy: "Finding value pockets before your league mates remember running backs exist.",
  },
  {
    at: 38,
    label: "Simulating matchups",
    copy: "Cross-checking defensive pressure, implied totals, and hope, the worst metric.",
  },
  {
    at: 58,
    label: "Ranking waiver targets",
    copy: "Calculating who will be the number one add everyone drops by Thursday.",
  },
  {
    at: 76,
    label: "Optimizing lineup",
    copy: "Balancing floor, ceiling, and the ancient curse of Thursday night football.",
  },
  {
    at: 94,
    label: "Finalizing edge",
    copy: "Compressing chaos into a confidence score, because humans demand numbers.",
  },
  {
    at: 100,
    label: "Ready to dominate",
    copy: "Model ready. Your roster is now armed with mathematics and mild arrogance.",
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPhase(progress) {
  return PHASES.reduce((current, phase) => (progress >= phase.at ? phase : current), PHASES[0]);
}

function WebGLFallback() {
  return (
    <div className="aff-webgl-fallback" aria-hidden="true">
      <div className="aff-webgl-fallback__orb" />
      <div className="aff-webgl-fallback__ring aff-webgl-fallback__ring--one" />
      <div className="aff-webgl-fallback__ring aff-webgl-fallback__ring--two" />
    </div>
  );
}

function ParticleCloud({ count = 460 }) {
  const pointsRef = useRef(null);
  const linesRef = useRef(null);

  const { pointPositions, pointColors, linePositions } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color(0x67e8f9),
      new THREE.Color(0x22c55e),
      new THREE.Color(0xa78bfa),
      new THREE.Color(0x38bdf8),
    ];

    for (let i = 0; i < count; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 1.45 + Math.random() * 2.25;

      positions.set(
        [
          radius * Math.sin(phi) * Math.cos(theta) * 1.18,
          radius * Math.sin(phi) * Math.sin(theta) * 0.84,
          radius * Math.cos(phi) * 0.9,
        ],
        i * 3
      );

      const color = palette[i % palette.length]
        .clone()
        .lerp(new THREE.Color(0xffffff), Math.random() * 0.12);
      colors.set([color.r, color.g, color.b], i * 3);
    }

    const pairs = [];
    for (let i = 0; i < count; i += 2) {
      const ax = positions[i * 3];
      const ay = positions[i * 3 + 1];
      const az = positions[i * 3 + 2];
      let best = -1;
      let bestDist = Infinity;

      for (let j = 0; j < count; j += 3) {
        if (i === j) continue;
        const bx = positions[j * 3];
        const by = positions[j * 3 + 1];
        const bz = positions[j * 3 + 2];
        const dist = (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = j;
        }
      }

      if (best !== -1 && bestDist < 0.82) pairs.push(i, best);
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
    const t = clock.getElapsedTime();
    if (pointsRef.current) pointsRef.current.rotation.y = -t * 0.045;
    if (linesRef.current) linesRef.current.rotation.y = -t * 0.045;
  });

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[pointPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[pointColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.034}
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color="#67e8f9"
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}

function FootballCore() {
  const groupRef = useRef(null);
  const footballRef = useRef(null);
  const laceRef = useRef(null);
  const ringsRef = useRef([]);
  const sparksRef = useRef([]);
  const mouseRef = useRef({ x: 0, y: 0 });

  const sparks = useMemo(
    () =>
      Array.from({ length: 20 }, () => ({
        angle: Math.random() * Math.PI * 2,
        radius: 1.7 + Math.random() * 1.2,
        speed: 0.4 + Math.random() * 0.9,
        tilt: Math.random() * Math.PI,
      })),
    []
  );

  useEffect(() => {
    const handlePointerMove = (event) => {
      mouseRef.current.x = (event.clientX / window.innerWidth - 0.5) * 0.55;
      mouseRef.current.y = (event.clientY / window.innerHeight - 0.5) * 0.35;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    const { x, y } = mouseRef.current;

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.12 + x;
      groupRef.current.rotation.x = Math.sin(t * 0.24) * 0.08 + y;
    }

    if (footballRef.current) {
      footballRef.current.rotation.y = t * 0.36;
      footballRef.current.rotation.z = Math.sin(t * 0.3) * 0.08;
    }

    if (laceRef.current && footballRef.current) {
      laceRef.current.rotation.y = footballRef.current.rotation.y;
      laceRef.current.rotation.z = footballRef.current.rotation.z;
    }

    ringsRef.current.forEach((ring, index) => {
      if (!ring) return;
      ring.rotation.z += 0.0025 * (index + 1);
      ring.rotation.x += 0.0013 * (index % 2 ? -1 : 1);
    });

    sparksRef.current.forEach((spark, index) => {
      if (!spark) return;
      const seed = sparks[index];
      const angle = t * seed.speed + seed.angle;
      spark.position.set(
        Math.cos(angle) * seed.radius,
        Math.sin(angle * 1.37 + seed.tilt) * 0.75,
        Math.sin(angle) * seed.radius
      );
      spark.scale.setScalar(0.65 + Math.sin(t * 4 + index) * 0.28 + 0.6);
    });

    camera.position.x += (x * 0.8 - camera.position.x) * 0.025;
    camera.position.y += (-y * 0.5 + 0.35 - camera.position.y) * 0.025;
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={groupRef}>
      <mesh ref={footballRef} scale={[1.72, 0.78, 0.78]}>
        <sphereGeometry args={[0.8, 36, 18]} />
        <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.38} />
      </mesh>

      <group ref={laceRef}>
        <mesh position={[0, 0.66, 0.01]}>
          <boxGeometry args={[0.72, 0.018, 0.018]} />
          <meshBasicMaterial color="#e0f2fe" transparent opacity={0.86} />
        </mesh>
        {[-2, -1, 0, 1, 2].map((i) => (
          <mesh key={i} position={[i * 0.14, 0.67, 0.01]}>
            <boxGeometry args={[0.025, 0.018, 0.23]} />
            <meshBasicMaterial color="#e0f2fe" transparent opacity={0.86} />
          </mesh>
        ))}
      </group>

      {[
        [2.08, 0.008, 1.2, 0.1, 0.2, "#22c55e", 0.78],
        [2.44, 0.006, -0.9, 0.5, 1.1, "#a78bfa", 0.48],
        [2.82, 0.004, 0.2, 1.0, -0.5, "#22c55e", 0.78],
      ].map(([radius, tube, x, y, z, color, opacity], index) => (
        <mesh
          key={`${radius}-${index}`}
          ref={(node) => {
            ringsRef.current[index] = node;
          }}
          rotation={[x, y, z]}
        >
          <torusGeometry args={[radius, tube, 16, 180]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} />
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
          <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
        </mesh>
      ))}

      <ParticleCloud />
    </group>
  );
}

function LoaderScene() {
  return (
    <Canvas
      className="aff-canvas"
      camera={{ position: [0, 0.35, 6.8], fov: 48 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      fallback={<WebGLFallback />}
    >
      <fog attach="fog" args={["#020617", 8, 18]} />
      <FootballCore />
    </Canvas>
  );
}

export default function AiFantasyLoader({
  visible,
  forceVisible = false,
  progress,
  label = "fantasy intelligence engine",
  title = "Draft Brain",
  chips = ["injury volatility", "ADP drift", "boom/bust", "weather tax", "waiver edge"],
  onReplay,
}) {
  const { active, progress: dreiProgress } = useProgress();
  const realProgress = typeof progress === "number" ? progress : dreiProgress;
  const clampedProgress = clamp(realProgress || 0, 0, 100);
  const phase = getPhase(clampedProgress);
  const shouldShow = forceVisible || (typeof visible === "boolean" ? visible : active);
  const [rendered, setRendered] = useState(shouldShow);

  useEffect(() => {
    if (shouldShow) {
      setRendered(true);
      return undefined;
    }

    const timeout = window.setTimeout(() => setRendered(false), 520);
    return () => window.clearTimeout(timeout);
  }, [shouldShow]);

  if (!rendered) return null;

  return (
    <div
      className={`aff-loader ${shouldShow ? "" : "aff-loader--hidden"}`}
      role="status"
      aria-live="polite"
      aria-label={`${phase.label}, ${Math.round(clampedProgress)} percent loaded`}
      style={{ "--aff-progress": `${clampedProgress}%` }}
    >
      <div className="aff-loader__stage" aria-hidden="true">
        <LoaderScene />
      </div>
      <div className="aff-loader__starfield" aria-hidden="true" />
      <div className="aff-loader__scanline" aria-hidden="true" />
      <div className="aff-loader__vignette" aria-hidden="true" />

      <main className="aff-loader__wrap">
        <section className="aff-loader__modal" aria-label="AI fantasy football loading modal">
          <div className="aff-loader__top-row">
            <div className="aff-loader__badge">
              <span className="aff-loader__badge-dot" />
              {label}
            </div>

            {onReplay ? (
              <button className="aff-loader__replay" type="button" onClick={onReplay}>
                Replay loader
              </button>
            ) : null}
          </div>

          <h1 className="aff-loader__title">
            <span className="aff-loader__glitch" data-text={title}>
              {title}
            </span>
          </h1>

          <p className="aff-loader__subtitle">{phase.copy}</p>

          <div className="aff-loader__hud-grid" aria-hidden="true">
            <div className="aff-loader__hud-card">
              <div className="aff-loader__hud-label">Lineup EV</div>
              <div className="aff-loader__hud-value aff-loader__hud-value--green">
                +{(clampedProgress / 18).toFixed(2)}
              </div>
            </div>
            <div className="aff-loader__hud-card">
              <div className="aff-loader__hud-label">Waiver Signal</div>
              <div className="aff-loader__hud-value">
                {clampedProgress > 84 ? "Locked" : clampedProgress > 46 ? "Hot" : "Scanning"}
              </div>
            </div>
            <div className="aff-loader__hud-card">
              <div className="aff-loader__hud-label">Chaos Index</div>
              <div className="aff-loader__hud-value aff-loader__hud-value--purple">
                {Math.round(16 + Math.sin(clampedProgress / 9) * 9 + clampedProgress * 0.58)}%
              </div>
            </div>
          </div>

          <div className="aff-loader__progress-area">
            <div className="aff-loader__progress-top">
              <span>{phase.label}</span>
              <span>{Math.round(clampedProgress)}%</span>
            </div>
            <div className="aff-loader__bar" aria-hidden="true">
              <div className="aff-loader__bar-fill" />
            </div>
          </div>

          <div className="aff-loader__ticker" aria-hidden="true">
            {chips.map((chip) => (
              <span className="aff-loader__chip" key={chip}>
                {chip}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
