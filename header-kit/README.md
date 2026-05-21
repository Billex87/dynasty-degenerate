# Dynasty Degens Header Light FX Kit

This kit adds subtle animated cyan/orange/gold light blooms behind the Dynasty Degens header/nav.

It is meant to match the tiny blue/orange glows coming out of the logo area in your screenshot, without turning the nav into a casino lobby. Barely a miracle.

## Files

- `components/HeaderLightFx.tsx`
  - Plain Three.js transparent canvas overlay.
  - No `@react-three/fiber` required.
  - Uses sprite glows that pulse at different sizes, positions, brightness, and timing.

- `components/HeaderCssLights.tsx`
  - CSS-only fallback if you want no WebGL.

- `styles/header-light-fx.css`
  - Header shell styling, canvas positioning, CSS fallback animation.

- `examples/DashboardHeader.example.tsx`
  - Example of how to wire into your existing header.

- `codex-prompts/CODEX_HEADER_LIGHTS_PROMPT.md`
  - Prompt to hand to Codex.

## Install note

This component expects `three` to be available.

```bash
npm install three
npm install -D @types/three
```

If your app already has Three.js, do not install again. Humanity has enough duplicate dependencies.

## Basic usage

```tsx
import HeaderLightFx from './components/HeaderLightFx';
import './styles/header-light-fx.css';

export function Header() {
  return (
    <header className="dd-header-shell">
      <HeaderLightFx intensity="nav" />

      <div className="dd-header-content">
        Your existing logo/nav/pills here
      </div>
    </header>
  );
}
```

## Recommended behavior

Desktop:
- Use `HeaderLightFx intensity="nav"`.

Mobile:
- Use `HeaderLightFx intensity="subtle"` or CSS fallback if you want fewer GPU effects.

Reduced motion:
- The CSS and component respect `prefers-reduced-motion`.