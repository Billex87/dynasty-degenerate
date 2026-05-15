/* Fullscreen cinematic takeover for the Report Generated moment.
   Uses a TEXTURED 3D plate for the logo (no SVGLoader) so it can't blow
   up a Suspense boundary and take the rest of the scene with it.
   Each fragile bit (texture, env HDR) has its own Suspense fallback. */

import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Environment, MeshReflectorMaterial } from "@react-three/drei";
import confetti from "canvas-confetti";
import { CheckCircle2 } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

interface SuccessTakeoverProps {
  leagueName?: string | null;
  leagueFormat?: string | null;
  leagueLogo?: string | null;
  /** true when the kick/exit phase has started — fade everything out */
  exit?: boolean;
}

export default function SuccessTakeover({
  leagueName,
  leagueFormat,
  leagueLogo,
  exit = false,
}: SuccessTakeoverProps) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);

  // Confetti bursts when the takeover appears — staggered for "hell yeah"
  // effect. Uses module-level guard so React StrictMode double-mounts
  // and HMR re-runs only fire the celebration ONCE per page session.
  const confettiFiredRef = useRef(false);
  useEffect(() => {
    if (exit) return;
    if (confettiFiredRef.current) return;
    if (typeof window === "undefined") return;
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    confettiFiredRef.current = true;

    const BRAND = ["#00D4DB", "#FF6A00", "#FFC03D", "#7df7ff", "#ff9a4a"];

    // Fire bursts directly (no setTimeout cancellation interference)
    window.setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { x: 0.5, y: 0.55 },
        startVelocity: 45,
        gravity: 0.85,
        decay: 0.92,
        scalar: 1,
        ticks: 240,
        colors: BRAND,
        zIndex: 200,
      });
    }, 350);

    window.setTimeout(() => {
      confetti({
        particleCount: 70,
        angle: 60,
        spread: 55,
        origin: { x: 0.1, y: 0.75 },
        startVelocity: 58,
        gravity: 0.9,
        scalar: 1,
        ticks: 260,
        colors: BRAND,
        zIndex: 200,
      });
      confetti({
        particleCount: 70,
        angle: 120,
        spread: 55,
        origin: { x: 0.9, y: 0.75 },
        startVelocity: 58,
        gravity: 0.9,
        scalar: 1,
        ticks: 260,
        colors: BRAND,
        zIndex: 200,
      });
    }, 600);

    window.setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 120,
        origin: { x: 0.5, y: 0.4 },
        startVelocity: 32,
        gravity: 0.7,
        scalar: 0.85,
        ticks: 280,
        colors: BRAND,
        zIndex: 200,
      });
    }, 1000);
  }, [exit]);

  return (
    <div
      className="dd-success-takeover"
      data-exit={exit ? "true" : "false"}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        pointerEvents: "none",
        background: "rgba(2, 6, 10, 0.78)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      {/* Centered modal card */}
      <div
        className="dd-success-card"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(42rem, 92vw)",
          height: "min(34rem, 86vh)",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow:
            "0 30px 80px rgba(0, 0, 0, 0.7), 0 0 64px rgba(0, 212, 219, 0.22), 0 0 46px rgba(255, 106, 0, 0.14)",
          border: "1px solid rgba(0, 212, 219, 0.32)",
          background:
            "radial-gradient(ellipse at 50% 50%, #050a0e 0%, #02050a 80%)",
        }}
      >
        <Canvas
          camera={{ position: [0, 1.4, 6.2], fov: 36 }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <StaticScene exit={exit} reduced={reduced} leagueName={leagueName} />

          <Suspense fallback={null}>
            <Environment preset="warehouse" environmentIntensity={0.45} />
          </Suspense>

          <EffectComposer multisampling={0}>
            <Bloom
              intensity={1.4}
              luminanceThreshold={0.4}
              luminanceSmoothing={0.78}
              mipmapBlur
            />
          </EffectComposer>
        </Canvas>

        {/* HTML content stacked top→middle→bottom, layered on top of the
            3D canvas. The whole modal card animates subtly so everything
            here moves together as one piece of glass. */}
        <div className="dd-success-plate-stack">
          <p className="dd-success-kicker">
            <CheckCircle2 size={14} aria-hidden="true" />
            Report Generated
          </p>
          <img
            src="/brand/dd-logo-transparent.png"
            alt=""
            aria-hidden="true"
            className="dd-success-plate-logo"
          />
          <h2 className="dd-success-league">{leagueName || "League report"}</h2>
        </div>

        {leagueLogo ? (
          <img
            src={leagueLogo}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              width: "2.6rem",
              height: "2.6rem",
              objectFit: "cover",
              borderRadius: "10px",
              border: "1px solid rgba(0, 212, 219, 0.35)",
              opacity: 0,
              animation:
                "dd-takeover-league-badge 0.8s cubic-bezier(0.22,1,0.36,1) 1.2s forwards",
              filter: "drop-shadow(0 0 18px rgba(0, 212, 219, 0.32))",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function StaticScene({
  exit,
  reduced,
  leagueName,
}: {
  exit: boolean;
  reduced: boolean;
  leagueName?: string | null;
}) {
  return (
    <>
      <color attach="background" args={["#04080c"]} />
      <fog attach="fog" args={["#04080c", 6, 18]} />
      <ambientLight intensity={0.18} />

      <CameraRig reduced={reduced} />

      <BroadcastLights exit={exit} reduced={reduced} />

      {/* Soft accent fills */}
      <pointLight
        position={[0, 2.5, 4.2]}
        intensity={0.7}
        color="#9be8ff"
        distance={10}
        decay={2.2}
      />
      <pointLight
        position={[-3.4, 1.2, 3.4]}
        intensity={1.1}
        color="#00D4DB"
        distance={8}
        decay={2.6}
      />
      <pointLight
        position={[3.4, 1.2, 3.4]}
        intensity={0.9}
        color="#FF7A14"
        distance={8}
        decay={2.6}
      />

      <Floor />
      <LogoPlateFrame reduced={reduced} leagueName={leagueName} />
    </>
  );
}

function CameraRig({ reduced }: { reduced: boolean }) {
  const startedAt = useRef(performance.now());
  useFrame(({ camera, pointer }) => {
    if (reduced) {
      camera.position.set(0, 1.2, 5.4);
      camera.lookAt(0, 1.0, 0);
      return;
    }
    const elapsed = (performance.now() - startedAt.current) / 1000;
    const t = Math.min(1, elapsed / 1.2);
    const eased = 1 - Math.pow(1 - t, 3);
    const baseZ = 7.4 - 2.0 * eased;
    const drift = elapsed > 1.2 ? Math.sin(elapsed * 0.35) * 0.08 : 0;
    camera.position.x = pointer.x * 0.25;
    camera.position.y = 1.2 + pointer.y * -0.12 + drift;
    camera.position.z = baseZ;
    camera.lookAt(0, 1.0, 0);
  });
  return null;
}

function BroadcastLights({
  exit,
  reduced,
}: {
  exit: boolean;
  reduced: boolean;
}) {
  const topRef = useRef<THREE.PointLight>(null);
  const bottomRef = useRef<THREE.PointLight>(null);
  const leftRef = useRef<THREE.PointLight>(null);
  const rightRef = useRef<THREE.PointLight>(null);

  const topBarRef = useRef<THREE.Mesh>(null);
  const bottomBarRef = useRef<THREE.Mesh>(null);

  const startedAt = useRef(performance.now());
  const exitStartedAt = useRef<number | null>(null);

  useEffect(() => {
    if (exit && exitStartedAt.current === null) {
      exitStartedAt.current = performance.now();
    } else if (!exit) {
      exitStartedAt.current = null;
    }
  }, [exit]);

  const flicker = (t: number) => {
    if (t < 0) return 0;
    if (t > 0.38) return 1;
    const k: [number, number][] = [
      [0.0, 0.0],
      [0.04, 1.6],
      [0.08, 0.18],
      [0.12, 1.32],
      [0.16, 0.45],
      [0.2, 1.18],
      [0.25, 0.7],
      [0.32, 1.06],
      [0.38, 1.0],
    ];
    for (let i = 0; i < k.length - 1; i += 1) {
      if (t <= k[i + 1][0]) {
        const span = k[i + 1][0] - k[i][0];
        const frac = (t - k[i][0]) / span;
        return k[i][1] + (k[i + 1][1] - k[i][1]) * frac;
      }
    }
    return 1;
  };

  useFrame(({ clock }) => {
    const elapsed = (performance.now() - startedAt.current) / 1000;
    const turnOn = reduced ? 1 : flicker(elapsed);
    let exitMul = 1;
    if (exit && exitStartedAt.current !== null) {
      const exitElapsed = (performance.now() - exitStartedAt.current) / 1000;
      exitMul = Math.max(0, 1 - exitElapsed / 0.45);
    }
    const breathe =
      reduced || elapsed < 0.45
        ? 1
        : 0.94 + Math.sin(clock.elapsedTime * 1.4) * 0.06;

    const m = turnOn * exitMul * breathe;

    if (topRef.current) topRef.current.intensity = 42 * m;
    if (bottomRef.current) bottomRef.current.intensity = 34 * m;
    if (leftRef.current) leftRef.current.intensity = 22 * m;
    if (rightRef.current) rightRef.current.intensity = 18 * m;

    const barScale = reduced
      ? 1
      : Math.min(1, Math.max(0, (elapsed - 0.04) / 0.28));
    const eased = 1 - Math.pow(1 - barScale, 3);

    if (topBarRef.current) {
      topBarRef.current.scale.x = eased;
      (topBarRef.current.material as THREE.MeshBasicMaterial).opacity = m;
    }
    if (bottomBarRef.current) {
      bottomBarRef.current.scale.x = eased;
      (bottomBarRef.current.material as THREE.MeshBasicMaterial).opacity = m;
    }
  });

  return (
    <>
      <pointLight
        ref={topRef}
        color={"#00D4DB"}
        intensity={0}
        position={[0, 3.4, 1.25]}
        distance={7}
        decay={2}
      />
      <mesh ref={topBarRef} position={[0, 3.4, 0.2]}>
        <planeGeometry args={[7.2, 0.14]} />
        <meshBasicMaterial
          color={"#a0fbff"}
          transparent
          opacity={1}
          toneMapped={false}
        />
      </mesh>

      <pointLight
        ref={bottomRef}
        color={"#FF7A14"}
        intensity={0}
        position={[0, -0.6, 1.2]}
        distance={6.5}
        decay={2}
      />
      <mesh ref={bottomBarRef} position={[0, -0.5, 0.2]}>
        <planeGeometry args={[6.4, 0.12]} />
        <meshBasicMaterial
          color={"#ffb46a"}
          transparent
          opacity={1}
          toneMapped={false}
        />
      </mesh>

      <pointLight
        ref={leftRef}
        color={"#00D4DB"}
        intensity={0}
        position={[-3.2, 1.2, 1.5]}
        distance={5}
        decay={2.2}
      />
      <pointLight
        ref={rightRef}
        color={"#FFC03D"}
        intensity={0}
        position={[3.2, 1.2, 1.5]}
        distance={5}
        decay={2.2}
      />
    </>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <MeshReflectorMaterial
        blur={[260, 90]}
        mixBlur={1.4}
        resolution={1024}
        mixStrength={1.2}
        roughness={0.78}
        depthScale={1.1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color={"#0a141a"}
        metalness={0.4}
        mirror={0.4}
      />
    </mesh>
  );
}

/** The chamfered metallic plate behind the logo — always renders even if
    the texture fails. Gives the rect lights something to paint. */
function LogoPlateFrame({
  reduced,
  leagueName,
}: {
  reduced: boolean;
  leagueName?: string | null;
}) {
  const cardGeom = useMemo(() => {
    const w = 3.4;
    const h = 3.3;
    const c = 0.22;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + c, -h / 2);
    shape.lineTo(w / 2 - c, -h / 2);
    shape.lineTo(w / 2, -h / 2 + c);
    shape.lineTo(w / 2, h / 2 - c);
    shape.lineTo(w / 2 - c, h / 2);
    shape.lineTo(-w / 2 + c, h / 2);
    shape.lineTo(-w / 2, h / 2 - c);
    shape.lineTo(-w / 2, -h / 2 + c);
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelOffset: 0,
      bevelSegments: 4,
      curveSegments: 12,
    });
    geom.center();
    return geom;
  }, []);

  const groupRef = useRef<THREE.Group>(null);
  const startedAt = useRef(performance.now());

  // Only animate the reveal (scale-in) on the plate. The IDLE motion
  // happens at the modal-card CSS level so the 3D plate + HTML overlay
  // move together as one piece of glass.
  useFrame(() => {
    if (!groupRef.current) return;
    if (reduced) {
      groupRef.current.scale.setScalar(1);
      return;
    }
    const elapsed = (performance.now() - startedAt.current) / 1000;
    const reveal = Math.min(1, Math.max(0, (elapsed - 0.2) / 0.7));
    const eased = 1 - Math.pow(1 - reveal, 3);
    const scale = 0.85 + eased * 0.15;
    groupRef.current.scale.setScalar(scale);
  });

  return (
    <group ref={groupRef} position={[0, 1.2, 0]}>
      <mesh geometry={cardGeom} castShadow receiveShadow>
        <meshStandardMaterial
          color={"#2a4a55"}
          metalness={0.85}
          roughness={0.28}
          emissive={"#0a1820"}
          emissiveIntensity={0.6}
          envMapIntensity={1.2}
        />
      </mesh>
    </group>
  );
}
