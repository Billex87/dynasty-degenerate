/* 3D backdrop for the Report Generated success card.
   Renders a real 3D scene with two rectangular area lights painting the
   chamfered card surface, plus bloom postprocessing and dust particles.
   The existing HTML text/icons sit on top of this canvas via z-index. */

import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

let rectAreaInited = false;
function ensureRectAreaInit() {
  if (rectAreaInited) return;
  RectAreaLightUniformsLib.init();
  rectAreaInited = true;
}

interface SuccessCard3DProps {
  /** when true the lights snap off (exit / kick phase) */
  exit?: boolean;
  className?: string;
}

export default function SuccessCard3D({ exit = false, className }: SuccessCard3DProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    ensureRectAreaInit();
  }, []);

  return (
    <div
      className={className}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 38 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
      <Scene exit={exit} reducedMotion={reducedMotion} />
        </Suspense>
        <EffectComposer multisampling={0}>
          <Bloom intensity={1.8} luminanceThreshold={0.28} luminanceSmoothing={0.75} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

function Scene({ exit, reducedMotion }: { exit: boolean; reducedMotion: boolean }) {
  return (
    <>
      <color attach="background" args={['#04090d']} />
      <ambientLight intensity={0.08} />

      <BroadcastLights exit={exit} reducedMotion={reducedMotion} />

      {/* Front key fill so the card middle is visible — slightly warm */}
      <pointLight position={[0, 0, 2.4]} intensity={0.9} color="#3a5a68" distance={5} decay={2.0} />
      {/* Side rim lights for chamfer definition */}
      <pointLight position={[-1.6, 0, 1.4]} intensity={0.6} color="#00D4DB" distance={3.6} decay={2.4} />
      <pointLight position={[1.6, 0, 1.4]} intensity={0.4} color="#FF7A14" distance={3.6} decay={2.4} />

      <CardSurface reducedMotion={reducedMotion} />
      <SurfaceScanline reducedMotion={reducedMotion} />
      <DustParticles reducedMotion={reducedMotion} />
    </>
  );
}

function BroadcastLights({ exit, reducedMotion }: { exit: boolean; reducedMotion: boolean }) {
  const topRef = useRef<THREE.RectAreaLight>(null);
  const bottomRef = useRef<THREE.RectAreaLight>(null);

  // Visible bar meshes for the lights themselves — these are what bloom
  // picks up and what the user sees as cyan/orange strips.
  const topBarRef = useRef<THREE.Mesh>(null);
  const bottomBarRef = useRef<THREE.Mesh>(null);

  const startedAt = useRef(performance.now());

  useFrame(({ clock }) => {
    const elapsed = (performance.now() - startedAt.current) / 1000;
    // Snap-on at ~0ms, full intensity by 250ms
    const turnOn = reducedMotion ? 1 : Math.min(1, elapsed / 0.25);
    // Exit: fade to 0 over 350ms
    const exitMul = exit ? Math.max(0, 1 - elapsed / 0.35) : 1;
    // Idle breathing pulse (very subtle)
    const breathe = reducedMotion ? 1 : 0.94 + Math.sin(clock.elapsedTime * 1.5) * 0.06;

    const finalMul = turnOn * exitMul * breathe;

    if (topRef.current) topRef.current.intensity = 22 * finalMul;
    if (bottomRef.current) bottomRef.current.intensity = 18 * finalMul;

    if (topBarRef.current) {
      (topBarRef.current.material as THREE.MeshBasicMaterial).opacity = 1 * finalMul;
    }
    if (bottomBarRef.current) {
      (bottomBarRef.current.material as THREE.MeshBasicMaterial).opacity = 1 * finalMul;
    }
  });

  return (
    <>
      {/* CYAN top rect area light — sits BEHIND the card edge, paints surface */}
      <rectAreaLight
        ref={topRef}
        color={'#00D4DB'}
        intensity={0}
        width={3.4}
        height={0.4}
        position={[0, 0.92, 0.05]}
        rotation={[-Math.PI, 0, 0]}
      />
      {/* visible cyan bezel strip at the very top edge */}
      <mesh ref={topBarRef} position={[0, 0.78, 0.08]}>
        <planeGeometry args={[2.6, 0.05]} />
        <meshBasicMaterial color={'#a0fbff'} transparent opacity={1} toneMapped={false} />
      </mesh>

      {/* ORANGE bottom rect area light */}
      <rectAreaLight
        ref={bottomRef}
        color={'#FF7A14'}
        intensity={0}
        width={3.0}
        height={0.32}
        position={[0, -0.92, 0.05]}
        rotation={[Math.PI, 0, 0]}
      />
      <mesh ref={bottomBarRef} position={[0, -0.78, 0.08]}>
        <planeGeometry args={[2.4, 0.04]} />
        <meshBasicMaterial color={'#ffb46a'} transparent opacity={1} toneMapped={false} />
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
        color={'#14272f'}
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
      <meshBasicMaterial color={'#7df7ff'} transparent opacity={0} toneMapped={false} />
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
      const yMag = v < 0.5 ? -1 + Math.random() * 0.3 : 0.7 + Math.random() * 0.3;
      positions[i * 3 + 1] = i % 3 === 0 ? (Math.random() - 0.5) * 1.8 : yMag;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.4 + 0.3;
      sizes[i] = 0.012 + Math.random() * 0.02;
    }
    return { positions, sizes };
  }, []);

  useFrame((_, dt) => {
    if (!ref.current) return;
    if (reducedMotion) return;
    const posAttr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
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
        color={'#bff0ff'}
        transparent
        opacity={0.42}
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
