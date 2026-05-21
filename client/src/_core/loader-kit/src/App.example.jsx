import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import AiFantasyLoader from "./components/AiFantasyLoader";

function YourSceneOrApp() {
  return null;
}

export default function App() {
  // Demo-only state. In your real app, you can remove progress/forceVisible
  // and let Drei useProgress track GLTF/textures loaded inside Suspense.
  const [demoProgress, setDemoProgress] = useState(0);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    if (!showLoader) return undefined;
    setDemoProgress(0);
    const startedAt = performance.now();
    let frameId;

    const tick = (now) => {
      const elapsed = now - startedAt;
      const value = 100 * (1 - Math.pow(1 - Math.min(elapsed / 7600, 1), 2.3));
      setDemoProgress(value);
      if (value < 100) frameId = requestAnimationFrame(tick);
      else window.setTimeout(() => setShowLoader(false), 700);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [showLoader]);

  return (
    <>
      <Canvas>
        <Suspense fallback={null}>
          <YourSceneOrApp />
        </Suspense>
      </Canvas>

      <AiFantasyLoader
        visible={showLoader}
        progress={demoProgress}
        onReplay={() => setShowLoader(true)}
      />
    </>
  );
}
