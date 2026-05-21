Implement the AI Fantasy Football loading modal from the supplied files.

Goal:
- Add a polished full-screen loading modal for a fantasy football website.
- It should feel like an AI scouting / draft-brain interface.
- Use React, Three.js, React Three Fiber, and Drei.
- Keep the loader as a reusable component.

Install dependencies if missing:

npm install three @react-three/fiber @react-three/drei

Add these files:
- src/components/AiFantasyLoader.jsx
- src/components/AiFantasyLoader.css

Then import and render the component at the app root. If the app already has real loading state, pass:

<AiFantasyLoader visible={isLoading} progress={loadingProgress} />

If the app uses React Three Fiber assets with Suspense, the component can use Drei's useProgress automatically. In that case, render:

<AiFantasyLoader />

For local testing, pass forceVisible={true} or use the App.example.jsx pattern included in this kit.

Requirements:
- Preserve accessibility: role="status", aria-live="polite".
- Preserve reduced-motion support.
- Keep class names namespaced with aff-loader to avoid colliding with existing CSS.
- Do not add hardcoded CDN script tags. Use npm imports.
- Do not break existing app routing or layout.
- If the project uses TypeScript, convert the component to TSX with typed props.
