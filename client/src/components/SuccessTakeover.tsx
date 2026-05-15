/* Fullscreen cinematic takeover for the Report Generated moment.
   Replaces the small modal: extruded 3D DD logo on a reflective stage,
   rect area lights, HDR environment, depth of field, bloom.
   League HTML text + kicker pill sit on top via z-index. */

import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import {
  Bloom,
  DepthOfField,
  EffectComposer,
} from '@react-three/postprocessing';
import {
  Environment,
  Float,
  MeshReflectorMaterial,
} from '@react-three/drei';
import { CheckCircle2 } from 'lucide-react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

const LOGO_SRC = '/brand/dd-mark-white.svg';

let rectAreaInited = false;
function ensureRectAreaInit() {
  if (rectAreaInited) return;
  RectAreaLightUniformsLib.init();
  rectAreaInited = true;
}

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
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    ensureRectAreaInit();
  }, []);

  return (
    <div
      className="dd-success-takeover"
      data-exit={exit ? 'true' : 'false'}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 50%, #050a0e 0%, #02050a 70%)',
      }}
    >
      <Canvas
        camera={{ position: [0, 1.4, 6.2], fov: 36 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        shadows
        style={{ position: 'absolute', inset: 0 }}
      >
        <Suspense fallback={null}>
          <Scene exit={exit} reduced={reduced} />
        </Suspense>
        <EffectComposer multisampling={0}>
          <Bloom intensity={1.6} luminanceThreshold={0.32} luminanceSmoothing={0.78} mipmapBlur />
          <DepthOfField focusDistance={0.012} focalLength={0.05} bokehScale={2.2} />
        </EffectComposer>
      </Canvas>

      {/* HTML text overlay */}
      <div
        className="dd-success-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 'clamp(3rem, 10vh, 8rem)',
          pointerEvents: 'none',
        }}
      >
        <p className="dd-success-kicker">
          <CheckCircle2 size={16} aria-hidden="true" />
          Report Generated
        </p>
        <h2 className="dd-success-league">
          {leagueName || 'League report'}
        </h2>
        {leagueFormat ? (
          <p className="dd-success-format">{leagueFormat}</p>
        ) : null}
        <div className="dd-success-bar" aria-hidden="true" />
      </div>

      {/* Optional small league badge in the corner (uses the logo if provided) */}
      {leagueLogo ? (
        <img
          src={leagueLogo}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '4vh',
            right: '4vw',
            width: '4rem',
            height: '4rem',
            objectFit: 'cover',
            borderRadius: '12px',
            border: '1px solid rgba(0, 212, 219, 0.35)',
            opacity: 0,
            animation: 'dd-takeover-league-badge 0.8s cubic-bezier(0.22,1,0.36,1) 1.2s forwards',
            filter: 'drop-shadow(0 0 18px rgba(0, 212, 219, 0.32))',
          }}
        />
      ) : null}
    </div>
  );
}

function Scene({ exit, reduced }: { exit: boolean; reduced: boolean }) {
  return (
    <>
      <color attach="background" args={['#04080c']} />
      <fog attach="fog" args={['#04080c', 6, 18]} />
      <ambientLight intensity={0.12} />

      <CameraRig reduced={reduced} />
      <Environment preset="warehouse" environmentIntensity={0.45} />

      <BroadcastLights exit={exit} reduced={reduced} />

      {/* Soft accent fills */}
      <pointLight position={[0, 2.5, 4.2]} intensity={0.6} color="#9be8ff" distance={10} decay={2.2} />
      <pointLight position={[-3.4, 1.2, 3.4]} intensity={0.9} color="#00D4DB" distance={8} decay={2.6} />
      <pointLight position={[3.4, 1.2, 3.4]} intensity={0.7} color="#FF7A14" distance={8} decay={2.6} />

      <Floor />

      <Float speed={1.2} rotationIntensity={0.18} floatIntensity={0.32}>
        <DDLogo3D reduced={reduced} />
      </Float>
    </>
  );
}

function CameraRig({ reduced }: { reduced: boolean }) {
  const startedAt = useRef(performance.now());
  useFrame(({ camera, pointer }) => {
    if (reduced) {
      camera.position.set(0, 1.2, 5.2);
      camera.lookAt(0, 1.0, 0);
      return;
    }
    const elapsed = (performance.now() - startedAt.current) / 1000;
    // Settle from far (z=7.4) to close (z=5.4) over 1.2s ease-out
    const t = Math.min(1, elapsed / 1.2);
    const eased = 1 - Math.pow(1 - t, 3);
    const baseZ = 7.4 - 2.0 * eased;
    // Subtle mouse parallax after settled
    const drift = elapsed > 1.2 ? Math.sin(elapsed * 0.35) * 0.08 : 0;
    camera.position.x = pointer.x * 0.25;
    camera.position.y = 1.2 + pointer.y * -0.12 + drift;
    camera.position.z = baseZ;
    camera.lookAt(0, 1.0, 0);
  });
  return null;
}

function BroadcastLights({ exit, reduced }: { exit: boolean; reduced: boolean }) {
  const topRef = useRef<THREE.RectAreaLight>(null);
  const bottomRef = useRef<THREE.RectAreaLight>(null);
  const leftRef = useRef<THREE.RectAreaLight>(null);
  const rightRef = useRef<THREE.RectAreaLight>(null);

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

  // CRT-style power-on flicker (3 spikes over 380ms then steady)
  const flicker = (t: number) => {
    if (t < 0) return 0;
    if (t > 0.38) return 1;
    const k: [number, number][] = [
      [0.00, 0.0],
      [0.04, 1.6],
      [0.08, 0.18],
      [0.12, 1.32],
      [0.16, 0.45],
      [0.20, 1.18],
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
    const breathe = reduced || elapsed < 0.45
      ? 1
      : 0.94 + Math.sin(clock.elapsedTime * 1.4) * 0.06;

    const m = turnOn * exitMul * breathe;

    if (topRef.current) topRef.current.intensity = 38 * m;
    if (bottomRef.current) bottomRef.current.intensity = 32 * m;
    if (leftRef.current) leftRef.current.intensity = 18 * m;
    if (rightRef.current) rightRef.current.intensity = 14 * m;

    // Bar scale-in
    const barScale = reduced ? 1 : Math.min(1, Math.max(0, (elapsed - 0.04) / 0.28));
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
      {/* CYAN top bar — wide horizontal stage light above the logo */}
      <rectAreaLight
        ref={topRef}
        color={'#00D4DB'}
        intensity={0}
        width={8}
        height={0.6}
        position={[0, 3.4, 0.6]}
        rotation={[-Math.PI / 1.05, 0, 0]}
      />
      <mesh ref={topBarRef} position={[0, 3.4, 0.2]}>
        <planeGeometry args={[7.2, 0.12]} />
        <meshBasicMaterial color={'#a0fbff'} transparent opacity={1} toneMapped={false} />
      </mesh>

      {/* ORANGE bottom bar — under the floor catches the reflection */}
      <rectAreaLight
        ref={bottomRef}
        color={'#FF7A14'}
        intensity={0}
        width={7}
        height={0.5}
        position={[0, -0.6, 0.6]}
        rotation={[Math.PI / 1.08, 0, 0]}
      />
      <mesh ref={bottomBarRef} position={[0, -0.5, 0.2]}>
        <planeGeometry args={[6.4, 0.1]} />
        <meshBasicMaterial color={'#ffb46a'} transparent opacity={1} toneMapped={false} />
      </mesh>

      {/* Side rim rect lights for chamfer pop on the logo */}
      <rectAreaLight
        ref={leftRef}
        color={'#00D4DB'}
        intensity={0}
        width={1.2}
        height={3}
        position={[-3.2, 1.2, 1.5]}
        rotation={[0, Math.PI / 2.4, 0]}
      />
      <rectAreaLight
        ref={rightRef}
        color={'#FFC03D'}
        intensity={0}
        width={1.2}
        height={3}
        position={[3.2, 1.2, 1.5]}
        rotation={[0, -Math.PI / 2.4, 0]}
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
        color={'#0a141a'}
        metalness={0.4}
        mirror={0.4}
      />
    </mesh>
  );
}

function DDLogo3D({ reduced }: { reduced: boolean }) {
  const svg = useLoader(SVGLoader, LOGO_SRC);
  const meshRef = useRef<THREE.Group>(null);
  const startedAt = useRef(performance.now());

  // Build extruded geometry from the SVG paths once.
  const { geometries, bounds } = useMemo(() => {
    const geoms: THREE.ExtrudeGeometry[] = [];
    const all = new THREE.Box3();

    svg.paths.forEach((path) => {
      const shapes = SVGLoader.createShapes(path);
      shapes.forEach((shape) => {
        const geom = new THREE.ExtrudeGeometry(shape, {
          depth: 12,
          bevelEnabled: true,
          bevelThickness: 1.5,
          bevelSize: 1.4,
          bevelOffset: 0,
          bevelSegments: 4,
          curveSegments: 12,
        });
        geom.computeBoundingBox();
        if (geom.boundingBox) all.expandByPoint(geom.boundingBox.min).expandByPoint(geom.boundingBox.max);
        geoms.push(geom);
      });
    });

    return { geometries: geoms, bounds: all };
  }, [svg]);

  // Compute center + scale to fit a ~2.5 unit target height
  const { center, scale } = useMemo(() => {
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const c = new THREE.Vector3();
    bounds.getCenter(c);
    const targetH = 2.6;
    const s = targetH / Math.max(size.y, 0.001);
    return { center: c, scale: s };
  }, [bounds]);

  useFrame(({ clock, pointer }) => {
    if (!meshRef.current) return;
    if (reduced) {
      meshRef.current.rotation.y = 0;
      meshRef.current.scale.setScalar(scale);
      return;
    }
    const elapsed = (performance.now() - startedAt.current) / 1000;
    // Reveal: scale up + opacity in over 0.7s starting at 0.2s
    const reveal = Math.min(1, Math.max(0, (elapsed - 0.2) / 0.7));
    const eased = 1 - Math.pow(1 - reveal, 3);
    meshRef.current.scale.setScalar(scale * (0.6 + eased * 0.4));

    // Slow rotation around Y for reflection drift
    meshRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.18) * 0.22 + pointer.x * 0.15;
    meshRef.current.rotation.x = pointer.y * -0.06;
  });

  return (
    <group
      ref={meshRef}
      position={[0, 1.2, 0]}
      rotation={[0, 0, 0]}
      scale={[scale, scale, scale]}
    >
      <group position={[-center.x, -center.y, -center.z]} scale={[1, -1, 1]}>
        {geometries.map((geom, i) => (
          <mesh key={i} geometry={geom} castShadow receiveShadow>
            <meshStandardMaterial
              color={'#FFB347'}
              metalness={0.78}
              roughness={0.18}
              emissive={'#221408'}
              emissiveIntensity={0.4}
              envMapIntensity={1.4}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
