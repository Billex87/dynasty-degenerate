import { useEffect, useRef } from 'react';

export type PremiumFxVariant =
  | 'home-hero'
  | 'report-shell'
  | 'loading-stamp'
  | 'loading-pass'
  | 'player-modal'
  | 'trade-flow'
  | 'waiver-radar'
  | 'rankings-grid'
  | 'autopilot-orbit';

type PremiumFxLayerProps = {
  variant: PremiumFxVariant;
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
};

type ThreeModule = typeof import('three');

function shouldDisableFx() {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

function getIntensityScale(intensity: PremiumFxLayerProps['intensity']) {
  if (intensity === 'high') return 1.25;
  if (intensity === 'low') return 0.72;
  return 1;
}

function usesViewportSizing(variant: PremiumFxVariant) {
  return variant === 'report-shell'
    || variant === 'trade-flow'
    || variant === 'waiver-radar'
    || variant === 'rankings-grid'
    || variant === 'autopilot-orbit';
}

function getVariantConfig(variant: PremiumFxVariant) {
  switch (variant) {
    case 'loading-pass':
      return { accent: 0xfb923c, secondary: 0x67e8f9, particleCount: 10, cameraZ: 6.15, gridDepth: 4, speed: 1.08 };
    case 'loading-stamp':
      return { accent: 0xfb923c, secondary: 0x67e8f9, particleCount: 92, cameraZ: 8.2, gridDepth: 8, speed: 1.18 };
    case 'home-hero':
      return { accent: 0xfb923c, secondary: 0x22d3ee, particleCount: 86, cameraZ: 10.4, gridDepth: 13, speed: 0.54 };
    case 'player-modal':
      return { accent: 0xfdba74, secondary: 0x22d3ee, particleCount: 52, cameraZ: 9.4, gridDepth: 8, speed: 0.48 };
    case 'trade-flow':
      return { accent: 0xfb923c, secondary: 0x67e8f9, particleCount: 78, cameraZ: 10.8, gridDepth: 11, speed: 0.72 };
    case 'waiver-radar':
      return { accent: 0x22d3ee, secondary: 0xfb923c, particleCount: 74, cameraZ: 10.2, gridDepth: 10, speed: 0.68 };
    case 'rankings-grid':
      return { accent: 0x67e8f9, secondary: 0xfb923c, particleCount: 68, cameraZ: 10.6, gridDepth: 12, speed: 0.44 };
    case 'autopilot-orbit':
      return { accent: 0x67e8f9, secondary: 0xfdba74, particleCount: 72, cameraZ: 10.6, gridDepth: 10, speed: 0.76 };
    case 'report-shell':
    default:
      return { accent: 0x22d3ee, secondary: 0xfb923c, particleCount: 72, cameraZ: 11, gridDepth: 12, speed: 0.48 };
  }
}

function createLine(
  THREE: ThreeModule,
  points: import('three').Vector3[],
  color: number,
  opacity: number
) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Line(geometry, material);
}

function createGridGroup(THREE: ThreeModule, variant: PremiumFxVariant, accent: number, secondary: number, depth: number) {
  const group = new THREE.Group();
  const width = variant === 'loading-stamp' ? 8.2 : 15.5;
  const rowCount = variant === 'loading-stamp' ? 7 : 12;
  const columnCount = variant === 'loading-stamp' ? 9 : 14;
  const y = variant === 'loading-stamp' ? -1.45 : -2.7;
  const zStart = variant === 'loading-stamp' ? -1.6 : -2.4;
  const zEnd = -depth;

  for (let row = 0; row <= rowCount; row += 1) {
    const t = row / rowCount;
    const z = zStart + (zEnd - zStart) * t;
    const line = createLine(
      THREE,
      [new THREE.Vector3(-width / 2, y, z), new THREE.Vector3(width / 2, y, z)],
      row % 3 === 0 ? secondary : accent,
      row % 3 === 0 ? 0.16 : 0.09
    );
    group.add(line);
  }

  for (let column = 0; column <= columnCount; column += 1) {
    const x = -width / 2 + width * (column / columnCount);
    const line = createLine(
      THREE,
      [new THREE.Vector3(x, y, zStart), new THREE.Vector3(x * 0.28, y, zEnd)],
      column % 4 === 0 ? secondary : accent,
      column % 4 === 0 ? 0.13 : 0.08
    );
    group.add(line);
  }

  group.rotation.x = variant === 'loading-stamp' ? -0.44 : -0.56;
  return group;
}

function createBeamGroup(THREE: ThreeModule, variant: PremiumFxVariant, accent: number, secondary: number) {
  const group = new THREE.Group();
  const beamCount = variant === 'loading-stamp' ? 5 : 9;
  const span = variant === 'loading-stamp' ? 6.2 : 12.5;

  for (let index = 0; index < beamCount; index += 1) {
    const x = -span / 2 + span * (index / Math.max(1, beamCount - 1));
    const color = index % 2 === 0 ? secondary : accent;
    const line = createLine(
      THREE,
      [
        new THREE.Vector3(x, -2.4, -2.1),
        new THREE.Vector3(x * 0.52, 2.4, -7.6),
      ],
      color,
      variant === 'loading-stamp' ? 0.12 : 0.09
    );
    line.userData.phase = index * 0.61;
    group.add(line);
  }

  return group;
}

function createParticleField(THREE: ThreeModule, count: number, accent: number, secondary: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const colorA = new THREE.Color(accent);
  const colorB = new THREE.Color(secondary);

  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 13;
    positions[index * 3 + 1] = (Math.random() - 0.46) * 6;
    positions[index * 3 + 2] = -2 - Math.random() * 9;
    const mixed = colorA.clone().lerp(colorB, index % 3 === 0 ? 0.78 : 0.22);
    colors[index * 3] = mixed.r;
    colors[index * 3 + 1] = mixed.g;
    colors[index * 3 + 2] = mixed.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.035,
    transparent: true,
    opacity: 0.66,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

function createStampGroup(THREE: ThreeModule, accent: number, secondary: number) {
  const group = new THREE.Group();

  const plateGeometry = new THREE.BoxGeometry(5.35, 1.34, 0.24, 3, 1, 1);
  const plateMaterial = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const plate = new THREE.Mesh(plateGeometry, plateMaterial);
  plate.position.set(0, 1.3, -4.4);
  plate.rotation.z = -0.035;
  group.add(plate);

  const borderGeometry = new THREE.EdgesGeometry(plateGeometry);
  const borderMaterial = new THREE.LineBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const border = new THREE.LineSegments(borderGeometry, borderMaterial);
  border.position.copy(plate.position);
  border.rotation.copy(plate.rotation);
  group.add(border);

  const ringGeometry = new THREE.RingGeometry(1.2, 1.28, 112);
  const rings = [0, 1, 2, 3].map((index) => {
    const material = new THREE.MeshBasicMaterial({
      color: index === 1 ? secondary : accent,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeometry, material);
    ring.position.set(0, -0.16, -4.8 - index * 0.15);
    ring.scale.setScalar(0.34 + index * 0.22);
    ring.userData.phase = index * 0.28;
    group.add(ring);
    return ring;
  });

  group.userData.plate = plate;
  group.userData.border = border;
  group.userData.rings = rings;
  return group;
}

function createFootballPassGroup(THREE: ThreeModule, accent: number, secondary: number) {
  const group = new THREE.Group();

  const flightPoints = Array.from({ length: 58 }, (_, index) => {
    const t = index / 57;
    return new THREE.Vector3(
      -3.9 + 7.8 * t,
      -1.42 + Math.sin(t * Math.PI) * 1.9,
      -4.68
    );
  });

  const arcLines = [
    { color: secondary, opacity: 0.52, yOffset: 0, zOffset: 0 },
    { color: accent, opacity: 0.34, yOffset: -0.1, zOffset: 0.04 },
    { color: 0xffffff, opacity: 0.18, yOffset: 0.08, zOffset: -0.04 },
  ].map((lineConfig) => {
    const material = new THREE.LineBasicMaterial({
      color: lineConfig.color,
      transparent: true,
      opacity: lineConfig.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        flightPoints.map((point) => point.clone().add(new THREE.Vector3(0, lineConfig.yOffset, lineConfig.zOffset)))
      ),
      material
    );
    line.userData.baseOpacity = lineConfig.opacity;
    group.add(line);
    return line;
  });

  const pulseMaterial = new THREE.MeshBasicMaterial({
    color: secondary,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const releasePulse = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 64), pulseMaterial.clone());
  releasePulse.position.set(-3.9, -1.42, -4.62);
  const catchPulse = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 64), pulseMaterial.clone());
  catchPulse.position.set(3.9, -1.42, -4.62);
  group.add(releasePulse, catchPulse);

  const sparkGeometry = new THREE.SphereGeometry(0.045, 12, 8);
  const sparks = Array.from({ length: 12 }, (_, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: index % 2 === 0 ? accent : secondary,
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const spark = new THREE.Mesh(sparkGeometry, material);
    spark.userData.phase = index / 12;
    group.add(spark);
    return spark;
  });

  const ballGeometry = new THREE.SphereGeometry(0.5, 42, 20);
  const ballMaterial = new THREE.MeshBasicMaterial({
    color: 0xb45309,
    transparent: true,
    opacity: 1,
  });
  const ball = new THREE.Mesh(ballGeometry, ballMaterial);
  ball.scale.set(2.45, 0.94, 0.94);
  ball.rotation.set(0.18, 0.2, -0.38);
  group.add(ball);

  const laceMaterial = new THREE.LineBasicMaterial({
    color: 0xfff7ed,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const laceGroup = new THREE.Group();
  const laceMeshMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff7ed,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const laceSpine = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.5, 0.028), laceMeshMaterial);
  laceSpine.position.set(0, 0.08, 0.5);
  laceGroup.add(laceSpine);
  [-0.14, 0, 0.14].forEach((y) => {
    const stitch = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.03), laceMeshMaterial.clone());
    stitch.position.set(0, y + 0.08, 0.52);
    laceGroup.add(stitch);
  });
  const topSeam = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.46, 0.28, 0.42),
      new THREE.Vector3(0.46, 0.28, 0.42),
    ]),
    laceMaterial.clone()
  );
  const bottomSeam = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.46, -0.28, 0.42),
      new THREE.Vector3(0.46, -0.28, 0.42),
    ]),
    laceMaterial.clone()
  );
  laceGroup.add(topSeam, bottomSeam);
  ball.add(laceGroup);

  const shadowGeometry = new THREE.CircleGeometry(0.58, 32);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x020617,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.scale.set(2.55, 0.42, 1);
  shadow.position.set(-3.9, -1.64, -4.55);
  group.add(shadow);

  group.userData.ball = ball;
  group.userData.shadow = shadow;
  group.userData.arcLines = arcLines;
  group.userData.releasePulse = releasePulse;
  group.userData.catchPulse = catchPulse;
  group.userData.sparks = sparks;
  return group;
}

export function PremiumFxLayer({ variant, className = '', intensity = 'medium' }: PremiumFxLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (shouldDisableFx()) return;
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    let disposed = false;
    let frameId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let handleResize: (() => void) | null = null;
    let renderer: import('three').WebGLRenderer | null = null;
    let scene: import('three').Scene | null = null;

    void import('three').then((THREE) => {
      if (disposed) return;

      const config = getVariantConfig(variant);
      const intensityScale = getIntensityScale(intensity);
      const viewportSized = usesViewportSizing(variant);
      const webglRenderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer = webglRenderer;
      webglRenderer.setClearColor(0x000000, 0);
      webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

      const currentScene = new THREE.Scene();
      scene = currentScene;
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0.1, config.cameraZ);

      const pass = variant === 'loading-pass' ? createFootballPassGroup(THREE, config.accent, config.secondary) : null;
      const grid = pass ? null : createGridGroup(THREE, variant, config.accent, config.secondary, config.gridDepth);
      const beams = pass ? null : createBeamGroup(THREE, variant, config.accent, config.secondary);
      const particles = pass ? null : createParticleField(THREE, Math.round(config.particleCount * intensityScale), config.accent, config.secondary);
      if (pass) {
        currentScene.add(pass);
      } else if (grid && beams && particles) {
        currentScene.add(grid, beams, particles);
      }

      const stamp = variant === 'loading-stamp' ? createStampGroup(THREE, config.accent, config.secondary) : null;
      if (stamp) currentScene.add(stamp);

      const setSize = () => {
        const rect = viewportSized
          ? { width: window.innerWidth, height: window.innerHeight }
          : parent.getBoundingClientRect();
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        webglRenderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };

      if (!viewportSized) {
        resizeObserver = new ResizeObserver(setSize);
        resizeObserver.observe(parent);
      }
      handleResize = setSize;
      window.addEventListener('resize', setSize);
      setSize();

      const startedAt = performance.now();
      const animate = (now: number) => {
        if (disposed) return;
        const elapsed = ((now - startedAt) / 1000) * config.speed;

        if (grid) {
          grid.position.z = (elapsed % 1) * 0.55;
          grid.rotation.z = Math.sin(elapsed * 0.52) * 0.008;
        }
        beams?.children.forEach((beam, index) => {
          const material = (beam as import('three').Line).material as import('three').LineBasicMaterial;
          material.opacity = (0.045 + Math.max(0, Math.sin(elapsed * 2.4 + (beam.userData.phase || index))) * 0.13) * intensityScale;
        });
        if (particles) {
          particles.rotation.y = elapsed * 0.035;
          particles.rotation.z = Math.sin(elapsed * 0.42) * 0.015;
        }

        if (pass) {
          const cycle = elapsed % 1;
          const eased = cycle < 0.5
            ? 2 * cycle * cycle
            : 1 - ((-2 * cycle + 2) ** 2) / 2;
          const x = -3.9 + 7.8 * eased;
          const y = -1.42 + Math.sin(eased * Math.PI) * 1.9;
          const ball = pass.userData.ball as import('three').Mesh | undefined;
          const shadow = pass.userData.shadow as import('three').Mesh | undefined;
          const releasePulse = pass.userData.releasePulse as import('three').Mesh | undefined;
          const catchPulse = pass.userData.catchPulse as import('three').Mesh | undefined;
          const arcLines = pass.userData.arcLines as import('three').Line[] | undefined;
          const sparks = pass.userData.sparks as import('three').Mesh[] | undefined;

          arcLines?.forEach((line, index) => {
            const material = line.material as import('three').LineBasicMaterial;
            material.opacity = (line.userData.baseOpacity || 0.3) * (0.72 + Math.sin(elapsed * 5.1 + index) * 0.18);
          });
          sparks?.forEach((spark, index) => {
            const sparkPhase = (cycle + (spark.userData.phase || 0)) % 1;
            const sparkX = -3.9 + 7.8 * sparkPhase;
            const sparkY = -1.42 + Math.sin(sparkPhase * Math.PI) * 1.9;
            spark.position.set(sparkX, sparkY - 0.07 + Math.sin(elapsed * 9 + index) * 0.035, -4.76);
            spark.scale.setScalar(0.68 + Math.sin(elapsed * 8 + index) * 0.24);
            const material = spark.material as import('three').MeshBasicMaterial;
            material.opacity = Math.max(0.06, 0.5 * (1 - Math.abs(sparkPhase - cycle) * 1.35));
          });
          [releasePulse, catchPulse].forEach((pulse, index) => {
            if (!pulse) return;
            const localPhase = index === 0 ? cycle : (cycle + 0.5) % 1;
            const pulseProgress = Math.min(1, localPhase * 2.2);
            pulse.scale.setScalar(0.8 + pulseProgress * 2.8);
            const material = pulse.material as import('three').MeshBasicMaterial;
            material.opacity = Math.max(0, 0.52 * (1 - pulseProgress));
          });
          if (ball) {
            ball.position.set(x, y, -4.18);
            ball.rotation.z = -0.2 + Math.sin(elapsed * 8.2) * 0.16;
            ball.rotation.y = 0.08 + Math.sin(elapsed * 5.6) * 0.08;
            ball.rotation.x = 0.06 + Math.sin(elapsed * 7.2) * 0.05;
          }
          if (shadow) {
            shadow.position.set(x, -1.66, -4.55);
            shadow.scale.set(2.8 - y * 0.36, 0.48 - y * 0.06, 1);
            const material = shadow.material as import('three').MeshBasicMaterial;
            material.opacity = 0.44 - Math.max(0, y) * 0.13;
          }
        }

        if (stamp) {
          const impact = Math.min(1, elapsed * 1.45);
          const thud = Math.sin(Math.min(Math.PI, impact * Math.PI));
          stamp.rotation.x = -0.22 + thud * 0.3;
          stamp.rotation.z = -0.045 + Math.sin(elapsed * 3.4) * 0.018;
          stamp.position.y = 0.36 - thud * 0.28;
          stamp.scale.setScalar(0.82 + thud * 0.16);

          const plate = stamp.userData.plate as import('three').Mesh | undefined;
          const border = stamp.userData.border as import('three').LineSegments | undefined;
          if (plate) {
            const material = plate.material as import('three').MeshBasicMaterial;
            material.opacity = 0.12 + thud * 0.34;
          }
          if (border) {
            const material = border.material as import('three').LineBasicMaterial;
            material.opacity = 0.34 + thud * 0.58;
          }
          (stamp.userData.rings as import('three').Mesh[] | undefined)?.forEach((ring, index) => {
            const phase = (elapsed * 0.9 + index * 0.22) % 1;
            ring.scale.setScalar(0.28 + phase * 3.25);
            const material = ring.material as import('three').MeshBasicMaterial;
            material.opacity = Math.max(0, 0.38 * (1 - phase));
          });
        }

        webglRenderer.render(currentScene, camera);
        frameId = window.requestAnimationFrame(animate);
      };

      frameId = window.requestAnimationFrame(animate);

      return undefined;
    });

    return () => {
      disposed = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      if (handleResize) window.removeEventListener('resize', handleResize);
      scene?.traverse((object) => {
        const disposableObject = object as import('three').Object3D & {
          geometry?: { dispose: () => void };
          material?: import('three').Material | import('three').Material[];
        };
        disposableObject.geometry?.dispose();
        const materials = Array.isArray(disposableObject.material)
          ? disposableObject.material
          : disposableObject.material
            ? [disposableObject.material]
            : [];
        materials.forEach((material) => material.dispose());
      });
      scene?.clear();
      renderer?.dispose();
    };
  }, [intensity, variant]);

  return (
    <canvas
      ref={canvasRef}
      className={`premium-fx-layer premium-fx-layer-${variant} ${className}`}
      aria-hidden="true"
    />
  );
}

export default PremiumFxLayer;
