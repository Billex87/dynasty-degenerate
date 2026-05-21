'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type HeaderLightFxProps = {
  /**
   * Use "nav" for the top dashboard/header bar.
   * Use "subtle" for calmer pages.
   * Use "hero" if you want it slightly louder.
   */
  intensity?: 'subtle' | 'nav' | 'hero';
  /**
   * Optional className for positioning overrides.
   */
  className?: string;
};

type Spark = {
  mesh: THREE.Sprite;
  baseScale: number;
  phase: number;
  speed: number;
  driftX: number;
  driftY: number;
  startX: number;
  startY: number;
};

const CYAN = new THREE.Color('#00C8E8');
const ORANGE = new THREE.Color('#E85A10');
const GOLD = new THREE.Color('#F4A020');

function createGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not create canvas context for header glow texture.');
  }

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );

  gradient.addColorStop(0.0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.12, 'rgba(255,255,255,0.92)');
  gradient.addColorStop(0.28, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.12)');
  gradient.addColorStop(1.0, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function pickColor(index: number): THREE.Color {
  if (index % 7 === 0) return GOLD;
  return index % 2 === 0 ? CYAN : ORANGE;
}

/**
 * Transparent Three.js light overlay for the Dynasty Degens header.
 *
 * Intended placement:
 * <header className="dd-header-shell">
 *   <HeaderLightFx />
 *   <div className="dd-header-content">...</div>
 * </header>
 *
 * The canvas is pointer-events:none and renders small cyan/orange/gold light blooms,
 * not UI. It should sit behind nav content.
 */
export default function HeaderLightFx({
  intensity = 'nav',
  className = '',
}: HeaderLightFxProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    )?.matches;

    if (prefersReducedMotion) {
      return;
    }

    let width = mount.clientWidth || window.innerWidth;
    let height = mount.clientHeight || 96;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      width / -2,
      width / 2,
      height / 2,
      height / -2,
      1,
      1000
    );
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'dd-header-light-canvas';
    mount.appendChild(renderer.domElement);

    const texture = createGlowTexture();

    const loudness = intensity === 'hero' ? 1.35 : intensity === 'subtle' ? 0.65 : 1;
    const sparkCount = Math.round((width < 700 ? 18 : 34) * loudness);
    const sparks: Spark[] = [];

    // Anchor zones match your screenshot: logo-left, nav-center, league/right badges.
    const anchors = [
      { x: 0.06, y: 0.40, weight: 4.0 }, // logo glow
      { x: 0.18, y: 0.34, weight: 1.6 }, // logo trail
      { x: 0.48, y: 0.42, weight: 1.2 }, // nav center
      { x: 0.72, y: 0.38, weight: 1.0 }, // nav right
      { x: 0.90, y: 0.32, weight: 2.2 }, // league pills/avatar
      { x: 0.97, y: 0.26, weight: 1.4 }, // far-right orange glint
    ];

    const weightedAnchors = anchors.flatMap((anchor) =>
      Array.from({ length: Math.round(anchor.weight * 4) }, () => anchor)
    );

    for (let i = 0; i < sparkCount; i += 1) {
      const anchor = weightedAnchors[i % weightedAnchors.length];

      const color = pickColor(i);
      const material = new THREE.SpriteMaterial({
        map: texture,
        color,
        transparent: true,
        opacity: 0.12 + Math.random() * 0.32,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });

      const sprite = new THREE.Sprite(material);

      const startX =
        (anchor.x - 0.5) * width +
        (Math.random() - 0.5) * width * (anchor.x < 0.12 ? 0.22 : 0.12);

      const startY =
        (0.5 - anchor.y) * height +
        (Math.random() - 0.5) * height * 0.60;

      const baseScale =
        (8 + Math.random() * 36) *
        loudness *
        (anchor.x < 0.12 || anchor.x > 0.88 ? 1.2 : 0.8);

      sprite.position.set(startX, startY, 0);
      sprite.scale.set(baseScale, baseScale, 1);
      scene.add(sprite);

      sparks.push({
        mesh: sprite,
        baseScale,
        phase: Math.random() * Math.PI * 2,
        speed: 0.34 + Math.random() * 1.25,
        driftX: (Math.random() - 0.5) * 8,
        driftY: (Math.random() - 0.5) * 4,
        startX,
        startY,
      });
    }

    // Soft horizontal streaks behind the logo/nav, still subtle.
    const streakGroup = new THREE.Group();
    scene.add(streakGroup);

    const makeStreak = (
      x: number,
      y: number,
      w: number,
      h: number,
      color: THREE.Color,
      opacity: number
    ) => {
      const geometry = new THREE.PlaneGeometry(w, h);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, -1);
      streakGroup.add(mesh);
      return mesh;
    };

    const streaks = [
      makeStreak(-width * 0.38, height * 0.20, width * 0.32, 1.5, CYAN, 0.18),
      makeStreak(-width * 0.34, height * 0.04, width * 0.22, 1.2, ORANGE, 0.14),
      makeStreak(width * 0.33, height * 0.18, width * 0.18, 1.1, CYAN, 0.10),
      makeStreak(width * 0.46, height * 0.05, width * 0.16, 1.2, ORANGE, 0.12),
    ];

    let raf = 0;
    const start = performance.now();

    const animate = () => {
      const elapsed = (performance.now() - start) / 1000;

      for (const spark of sparks) {
        const pulse =
          0.55 +
          0.45 * Math.sin(elapsed * spark.speed + spark.phase) +
          0.18 * Math.sin(elapsed * spark.speed * 2.7 + spark.phase * 1.7);

        const scale = spark.baseScale * (0.75 + Math.max(0, pulse) * 0.58);
        spark.mesh.scale.set(scale, scale, 1);
        spark.mesh.position.x =
          spark.startX + Math.sin(elapsed * 0.45 + spark.phase) * spark.driftX;
        spark.mesh.position.y =
          spark.startY + Math.cos(elapsed * 0.38 + spark.phase) * spark.driftY;

        const mat = spark.mesh.material as THREE.SpriteMaterial;
        mat.opacity = 0.06 + Math.max(0, pulse) * 0.28 * loudness;
      }

      streaks.forEach((streak, index) => {
        const material = streak.material as THREE.MeshBasicMaterial;
        material.opacity =
          (index % 2 === 0 ? 0.10 : 0.07) +
          Math.max(0, Math.sin(elapsed * 0.7 + index * 1.9)) * 0.10;
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      width = mount.clientWidth || window.innerWidth;
      height = mount.clientHeight || 96;

      camera.left = width / -2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = height / -2;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);

      scene.traverse((object) => {
        if (object instanceof THREE.Sprite || object instanceof THREE.Mesh) {
          object.geometry?.dispose?.();

          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((m) => m.dispose());
          } else {
            material?.dispose?.();
          }
        }
      });

      texture.dispose();
      renderer.dispose();

      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [intensity]);

  return (
    <div
      ref={mountRef}
      className={`dd-header-light-fx ${className}`}
      aria-hidden="true"
    />
  );
}