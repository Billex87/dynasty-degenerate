/* 3D backdrop for the Report Generated success card.
   Renders the physical stage behind the existing HTML text so the copy stays
   crisp while the generated-report moment gets real depth and motion. */

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

interface SuccessCard3DProps {
  /** when true the lights snap off (exit / kick phase) */
  exit?: boolean;
  className?: string;
}

export default function SuccessCard3D({
  exit = false,
  className,
}: SuccessCard3DProps) {
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

  const shouldUseFallback =
    !sceneSupport.ready ||
    sceneSupport.reducedMotion ||
    !sceneSupport.canUseWebGL ||
    canvasFailed;
  const preserveDrawingBuffer =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "success";

  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
      data-testid="success-card-3d-scene"
    >
      {shouldUseFallback ? (
        <SuccessCardFallback exit={exit} />
      ) : (
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 38 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer,
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
          <Scene exit={exit} reducedMotion={false} />
        </Suspense>
      </Canvas>
      )}
    </div>
  );
}

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context =
      canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!context) return false;
    const loseContext = context.getExtension("WEBGL_lose_context");
    loseContext?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function SuccessCardFallback({ exit }: { exit: boolean }) {
  return (
    <div
      className={`success-card-3d-fallback${exit ? " success-card-3d-fallback-exit" : ""}`}
      aria-hidden="true"
    >
      <span className="success-card-3d-fallback-panel" />
      <span className="success-card-3d-fallback-rail success-card-3d-fallback-rail-top" />
      <span className="success-card-3d-fallback-rail success-card-3d-fallback-rail-bottom" />
      <span className="success-card-3d-fallback-ring success-card-3d-fallback-ring-a" />
      <span className="success-card-3d-fallback-ring success-card-3d-fallback-ring-b" />
      <span className="success-card-3d-fallback-medallion" />
      <span className="success-card-3d-fallback-football" />
      <span className="success-card-3d-fallback-scan" />
    </div>
  );
}

function Scene({
  exit,
  reducedMotion,
}: {
  exit: boolean;
  reducedMotion: boolean;
}) {
  return (
    <>
      <color attach="background" args={["#04090d"]} />
      <ambientLight intensity={0.08} />

      <CameraRig reducedMotion={reducedMotion} />

      <BroadcastLights exit={exit} reducedMotion={reducedMotion} />
      <FieldDepthGrid exit={exit} reducedMotion={reducedMotion} />
      <FootballFlyBy exit={exit} reducedMotion={reducedMotion} />
      <StampShockwaves exit={exit} reducedMotion={reducedMotion} />

      {/* Front key fill so the card middle is visible — slightly warm */}
      <pointLight
        position={[0, 0, 2.4]}
        intensity={0.9}
        color="#3a5a68"
        distance={5}
        decay={2.0}
      />
      {/* Side rim lights for chamfer definition — punched up */}
      <pointLight
        position={[-1.6, 0, 1.4]}
        intensity={1.1}
        color="#00D4DB"
        distance={3.6}
        decay={2.4}
      />
      <pointLight
        position={[1.6, 0, 1.4]}
        intensity={0.7}
        color="#FF7A14"
        distance={3.6}
        decay={2.4}
      />

      <CardSurface reducedMotion={reducedMotion} />
      <MedallionCore exit={exit} reducedMotion={reducedMotion} />
      <SurfaceScanline reducedMotion={reducedMotion} />
      <DustParticles reducedMotion={reducedMotion} />
    </>
  );
}

function FieldDepthGrid({
  exit,
  reducedMotion,
}: {
  exit: boolean;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const lines = useMemo(() => {
    const nextLines: Array<{
      points: [THREE.Vector3, THREE.Vector3];
      color: string;
      opacity: number;
    }> = [];

    for (let row = 0; row < 7; row += 1) {
      const y = -0.92 + row * 0.31;
      const z = -0.82 - row * 0.05;
      nextLines.push({
        points: [
          new THREE.Vector3(-1.85, y, z),
          new THREE.Vector3(1.85, y, z),
        ],
        color: row % 2 ? "#ff8a24" : "#00d4db",
        opacity: row % 2 ? 0.16 : 0.2,
      });
    }

    for (let col = 0; col < 9; col += 1) {
      const x = -1.8 + col * 0.45;
      nextLines.push({
        points: [
          new THREE.Vector3(x, -1.05, -0.84),
          new THREE.Vector3(x * 0.58, 1.05, -1.2),
        ],
        color: col % 2 ? "#ff8a24" : "#00d4db",
        opacity: col % 2 ? 0.12 : 0.16,
      });
    }

    return nextLines;
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const exitOpacity = exit ? 0.18 : 1;
    groupRef.current.children.forEach((child, index) => {
      const line = child as THREE.LineSegments;
      const material = line.material as THREE.LineBasicMaterial;
      const pulse = reducedMotion
        ? 1
        : 0.72 + Math.sin(clock.elapsedTime * 1.7 + index * 0.55) * 0.28;
      material.opacity =
        Number(line.userData.baseOpacity || 0.14) * pulse * exitOpacity;
    });
    if (!reducedMotion) {
      groupRef.current.rotation.x =
        -0.2 + Math.sin(clock.elapsedTime * 0.45) * 0.012;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.02, 0]} rotation={[-0.2, 0, 0]}>
      {lines.map((line, index) => (
        <lineSegments
          key={`success-field-line-${index}`}
          userData={{ baseOpacity: line.opacity }}
        >
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  line.points[0].x,
                  line.points[0].y,
                  line.points[0].z,
                  line.points[1].x,
                  line.points[1].y,
                  line.points[1].z,
                ]),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={line.color}
            transparent
            opacity={line.opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </lineSegments>
      ))}
    </group>
  );
}

function FootballFlyBy({
  exit,
  reducedMotion,
}: {
  exit: boolean;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const startedAt = useRef(performance.now());

  useFrame(() => {
    if (!groupRef.current) return;
    if (reducedMotion) {
      groupRef.current.visible = false;
      return;
    }

    const elapsed = (performance.now() - startedAt.current) / 1000;
    const duration = 2.15;
    const loop = ((elapsed + 0.18) % duration) / duration;
    const arc = Math.sin(loop * Math.PI);
    const x = -1.72 + loop * 3.44;
    const y = -0.7 + arc * 1.45 - loop * 0.08;
    const z = 1.04 - loop * 1.16;
    const intro = Math.min(1, elapsed / 0.42);
    const edgeFade = Math.min(1, loop * 9, (1 - loop) * 8);
    const opacity = intro * edgeFade * (exit ? 0.08 : 1);

    groupRef.current.visible = true;
    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.set(
      -0.18 + arc * 0.34,
      loop * Math.PI * 3.5,
      -0.38 + loop * 0.62
    );
    groupRef.current.scale.setScalar(0.78 + arc * 0.26);
    groupRef.current.children.forEach(child => {
      const mesh = child as THREE.Mesh;
      const material = mesh.material as THREE.Material & { opacity?: number };
      if ("opacity" in material) material.opacity = opacity;
    });
  });

  return (
    <group ref={groupRef} position={[-1.7, -0.7, 1]} scale={0.8}>
      <mesh scale={[1.46, 0.78, 0.78]}>
        <sphereGeometry args={[0.12, 32, 16]} />
        <meshStandardMaterial
          color="#b65a1a"
          emissive="#f97316"
          emissiveIntensity={0.18}
          roughness={0.38}
          metalness={0.18}
          transparent
          opacity={0}
        />
      </mesh>
      <mesh position={[0, 0.002, 0.092]} scale={[0.72, 0.06, 0.018]}>
        <boxGeometry args={[0.24, 0.02, 0.02]} />
        <meshBasicMaterial
          color="#ffe8c7"
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
      {[-0.055, 0, 0.055].map(x => (
        <mesh
          key={`success-football-lace-${x}`}
          position={[x, 0.003, 0.111]}
          scale={[0.07, 0.12, 0.014]}
        >
          <boxGeometry args={[0.04, 0.018, 0.018]} />
          <meshBasicMaterial
            color="#fff5df"
            transparent
            opacity={0}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function StampShockwaves({
  exit,
  reducedMotion,
}: {
  exit: boolean;
  reducedMotion: boolean;
}) {
  return (
    <>
      <ShockwaveRing
        delay={0.28}
        color="#7df7ff"
        exit={exit}
        reducedMotion={reducedMotion}
      />
      <ShockwaveRing
        delay={0.48}
        color="#ffb46a"
        exit={exit}
        reducedMotion={reducedMotion}
      />
      <ShockwaveRing
        delay={0.68}
        color="#fff2b3"
        exit={exit}
        reducedMotion={reducedMotion}
      />
    </>
  );
}

function ShockwaveRing({
  delay,
  color,
  exit,
  reducedMotion,
}: {
  delay: number;
  color: string;
  exit: boolean;
  reducedMotion: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const startedAt = useRef(performance.now());

  useFrame(() => {
    if (!ref.current) return;
    if (reducedMotion) {
      ref.current.visible = false;
      return;
    }

    const elapsed = (performance.now() - startedAt.current) / 1000 - delay;
    if (elapsed < 0) {
      ref.current.visible = false;
      return;
    }

    ref.current.visible = true;
    const duration = 1.05;
    const t = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    ref.current.scale.set(0.28 + eased * 1.9, 0.12 + eased * 0.75, 1);
    const material = ref.current.material as THREE.MeshBasicMaterial;
    material.opacity = (1 - t) * (exit ? 0.12 : 0.46);
  });

  return (
    <mesh ref={ref} position={[0, -0.02, 0.16]}>
      <torusGeometry args={[0.56, 0.008, 8, 96]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function MedallionCore({
  exit,
  reducedMotion,
}: {
  exit: boolean;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const startedAt = useRef(performance.now());

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const elapsed = (performance.now() - startedAt.current) / 1000;
    const reveal = reducedMotion
      ? 1
      : Math.min(1, Math.max(0, (elapsed - 0.2) / 0.72));
    const exitFade = exit ? 0.2 : 1;
    groupRef.current.scale.setScalar(0.74 + reveal * 0.26);
    groupRef.current.position.z = -0.05 + reveal * 0.12;
    if (!reducedMotion) {
      groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.65) * 0.035;
      groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.48) * 0.08;
    }
    groupRef.current.children.forEach(child => {
      const mesh = child as THREE.Mesh;
      const material = mesh.material as THREE.Material & { opacity?: number };
      if ("opacity" in material) {
        material.opacity = reveal * exitFade * Number(mesh.userData.opacity || 1);
      }
    });
  });

  return (
    <group
      ref={groupRef}
      position={[0, 0, 0.02]}
      rotation={[Math.PI / 2, 0, 0]}
      scale={0.74}
    >
      <mesh userData={{ opacity: 0.5 }}>
        <cylinderGeometry args={[0.43, 0.43, 0.045, 72]} />
        <meshStandardMaterial
          color="#112f38"
          emissive="#00d4db"
          emissiveIntensity={0.12}
          metalness={0.8}
          roughness={0.18}
          transparent
          opacity={0}
        />
      </mesh>
      <mesh userData={{ opacity: 0.74 }}>
        <torusGeometry args={[0.47, 0.014, 8, 96]} />
        <meshBasicMaterial
          color="#7df7ff"
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
      <mesh userData={{ opacity: 0.58 }} rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[0.33, 0.006, 8, 64]} />
        <meshBasicMaterial
          color="#ffb46a"
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const startedAt = useRef(performance.now());
  useFrame(({ camera }) => {
    if (reducedMotion) {
      camera.position.z = 3.2;
      camera.updateProjectionMatrix();
      return;
    }
    const elapsed = (performance.now() - startedAt.current) / 1000;
    // Settle from far (z=4.4) to close (z=3.2) over 0.95s with ease-out cubic
    const t = Math.min(1, elapsed / 0.95);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.z = 4.4 - 1.2 * eased;
    // Very subtle continued drift after settle for liveliness
    if (elapsed > 0.95) {
      const driftT = (elapsed - 0.95) % 6;
      camera.position.z = 3.2 - Math.sin((driftT / 6) * Math.PI * 2) * 0.015;
    }
  });
  return null;
}

function BroadcastLights({
  exit,
  reducedMotion,
}: {
  exit: boolean;
  reducedMotion: boolean;
}) {
  const topRef = useRef<THREE.PointLight>(null);
  const bottomRef = useRef<THREE.PointLight>(null);

  // Visible bar meshes for the lights themselves — these are what bloom
  // picks up and what the user sees as cyan/orange strips.
  const topBarRef = useRef<THREE.Mesh>(null);
  const bottomBarRef = useRef<THREE.Mesh>(null);

  const startedAt = useRef(performance.now());

  // CRT power-on flicker curve. Returns 0..1.5 intensity multiplier
  // over the first 360ms — three stutter spikes settling to 1.0.
  // After 360ms returns 1.0.
  const powerOnFlicker = (t: number): number => {
    if (t < 0) return 0;
    if (t > 0.36) return 1;
    // discrete keyframes interpolated linearly
    const k: [number, number][] = [
      [0.0, 0.0],
      [0.04, 1.6],
      [0.07, 0.15],
      [0.11, 1.35],
      [0.15, 0.4],
      [0.19, 1.2],
      [0.24, 0.7],
      [0.3, 1.08],
      [0.36, 1.0],
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
    // Power-on stutter for the first 360ms, then steady 1.0
    const turnOn = reducedMotion ? 1 : powerOnFlicker(elapsed);
    // Exit: fade to 0 over 350ms
    const exitMul = exit ? Math.max(0, 1 - elapsed / 0.35) : 1;
    // Idle breathing pulse (very subtle, only after flicker settles)
    const breathe =
      reducedMotion || elapsed < 0.4
        ? 1
        : 0.94 + Math.sin(clock.elapsedTime * 1.5) * 0.06;

    const finalMul = turnOn * exitMul * breathe;

    if (topRef.current) topRef.current.intensity = 22 * finalMul;
    if (bottomRef.current) bottomRef.current.intensity = 18 * finalMul;

    // Light bar entrance: scale from 0 width to full over first 220ms,
    // synced with the brightest flicker spike (anchors the eye)
    const barScale = reducedMotion
      ? 1
      : Math.min(1, Math.max(0, (elapsed - 0.02) / 0.22));
    const easedBarScale = 1 - Math.pow(1 - barScale, 3); // ease-out cubic

    if (topBarRef.current) {
      topBarRef.current.scale.x = easedBarScale;
      (topBarRef.current.material as THREE.MeshBasicMaterial).opacity =
        1 * finalMul;
    }
    if (bottomBarRef.current) {
      bottomBarRef.current.scale.x = easedBarScale;
      (bottomBarRef.current.material as THREE.MeshBasicMaterial).opacity =
        1 * finalMul;
    }
  });

  return (
    <>
      {/* CYAN top glow — sits behind the card edge and paints the surface */}
      <pointLight
        ref={topRef}
        color={"#00D4DB"}
        intensity={0}
        position={[0, 0.92, 0.75]}
        distance={3.8}
        decay={2.1}
      />
      {/* visible cyan bezel strip at the very top edge */}
      <mesh ref={topBarRef} position={[0, 0.78, 0.08]}>
        <planeGeometry args={[2.6, 0.05]} />
        <meshBasicMaterial
          color={"#a0fbff"}
          transparent
          opacity={1}
          toneMapped={false}
        />
      </mesh>

      {/* ORANGE bottom glow */}
      <pointLight
        ref={bottomRef}
        color={"#FF7A14"}
        intensity={0}
        position={[0, -0.92, 0.75]}
        distance={3.4}
        decay={2.1}
      />
      <mesh ref={bottomBarRef} position={[0, -0.78, 0.08]}>
        <planeGeometry args={[2.4, 0.04]} />
        <meshBasicMaterial
          color={"#ffb46a"}
          transparent
          opacity={1}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

function CardSurface({ reducedMotion }: { reducedMotion: boolean }) {
  // Build a chamfered card as a flat extruded shape with bevel.
  const cardGeom = useMemo(() => {
    const w = 2.7;
    const h = 1.7;
    const c = 0.16; // chamfer length
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
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.03,
      bevelOffset: 0,
      bevelSegments: 4,
    });
    geom.center();
    return geom;
  }, []);

  const meshRef = useRef<THREE.Mesh>(null);
  const startedAt = useRef(performance.now());

  useFrame(({ pointer, clock }) => {
    if (!meshRef.current) return;
    if (reducedMotion) {
      meshRef.current.rotation.set(0, 0, 0);
      meshRef.current.position.z = 0;
      (meshRef.current.material as THREE.MeshStandardMaterial).opacity = 1;
      return;
    }
    const elapsed = (performance.now() - startedAt.current) / 1000;
    const reveal = Math.min(1, Math.max(0, (elapsed - 0.18) / 0.7));
    meshRef.current.position.z = -0.2 + reveal * 0.2;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = reveal;
    // Parallax with pointer
    meshRef.current.rotation.y = pointer.x * 0.08;
    meshRef.current.rotation.x = -pointer.y * 0.05;
    // Subtle breathing
    const breathe = Math.sin(clock.elapsedTime * 1.2) * 0.004;
    meshRef.current.position.y = breathe;
  });

  return (
    <mesh ref={meshRef} geometry={cardGeom} position={[0, 0, -0.2]}>
      <meshStandardMaterial
        color={"#14272f"}
        metalness={0.9}
        roughness={0.12}
        transparent
        opacity={0}
        envMapIntensity={1.0}
      />
    </mesh>
  );
}

function SurfaceScanline({ reducedMotion }: { reducedMotion: boolean }) {
  // Animated cyan scan line that sweeps vertically across the card surface
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (reducedMotion) {
      ref.current.visible = false;
      return;
    }
    const period = 2.8;
    const t = (clock.elapsedTime % period) / period;
    // Map t (0..1) to y position (0.75 down to -0.75) — sweeps top to bottom
    ref.current.position.y = 0.75 - t * 1.5;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    // Fade out near edges, full opacity in middle
    mat.opacity = Math.sin(t * Math.PI) * 0.9;
  });
  return (
    <mesh ref={ref} position={[0, 0.75, -0.12]}>
      <planeGeometry args={[2.55, 0.018]} />
      <meshBasicMaterial
        color={"#7df7ff"}
        transparent
        opacity={0}
        toneMapped={false}
      />
    </mesh>
  );
}

function DustParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const count = 90;

  const { positions, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 3.6;
      // Bias particles toward the top/bottom light strips for volumetric effect
      const v = Math.random();
      const yMag =
        v < 0.5 ? -1 + Math.random() * 0.3 : 0.7 + Math.random() * 0.3;
      positions[i * 3 + 1] = i % 3 === 0 ? (Math.random() - 0.5) * 1.8 : yMag;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.4 + 0.3;
      sizes[i] = 0.012 + Math.random() * 0.02;
    }
    return { positions, sizes };
  }, []);

  useFrame((_, dt) => {
    if (!ref.current) return;
    if (reducedMotion) return;
    const posAttr = ref.current.geometry.attributes
      .position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < count; i += 1) {
      arr[i * 3 + 1] += dt * (0.04 + (i % 5) * 0.01);
      if (arr[i * 3 + 1] > 1.2) arr[i * 3 + 1] = -1.2;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color={"#bff0ff"}
        transparent
        opacity={0.42}
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
