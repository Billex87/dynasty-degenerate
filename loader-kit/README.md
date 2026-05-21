# AI Fantasy Football Loader Codex Kit

This kit contains a React implementation of the standalone AI Fantasy Football loading modal preview.

## Files

- `src/components/AiFantasyLoader.jsx`
- `src/components/AiFantasyLoader.css`
- `src/App.example.jsx`
- `package-install.txt`
- `CODEX_PROMPT.md`

## Install

```bash
npm install three @react-three/fiber @react-three/drei
```

## Basic use

```jsx
import AiFantasyLoader from "./components/AiFantasyLoader";

export default function App() {
  return <AiFantasyLoader visible={isLoading} progress={loadingProgress} />;
}
```

## R3F/Suspense use

If your site loads GLTF models/textures through React Three Fiber and Drei, render the loader and let `useProgress()` do the tracking:

```jsx
<AiFantasyLoader />
```

Use `forceVisible` for quick visual testing.
