# Codex prompt: add Dynasty Degens animated header lights

We want to enhance the Dynasty Degens dashboard header/nav area with subtle cyan/orange/gold animated light blooms, similar to the tiny colored lights in the logo/header screenshot.

Do not rewrite dashboard logic, Sleeper logic, routes, tabs, or page layout. This is a visual enhancement only.

## Assets / files to add

Add:

- `components/HeaderLightFx.tsx`
- `styles/header-light-fx.css`

Optional fallback:

- `components/HeaderCssLights.tsx`

## Implementation goals

1. Wrap the existing top header/nav with a relative container class:
   `dd-header-shell`

2. Put the existing header contents inside:
   `dd-header-content`

3. Add the animated overlay behind the content:
   `<HeaderLightFx intensity="nav" />`

4. Import:
   `import HeaderLightFx from './components/HeaderLightFx';`
   `import './styles/header-light-fx.css';`

5. Make sure the Three.js canvas:
   - is absolutely positioned inside the header
   - has `pointer-events: none`
   - sits behind nav/logo/buttons
   - does not affect layout height
   - respects `prefers-reduced-motion`

6. If this project does not already have `three`, install/use the existing package. Do not add `@react-three/fiber`; this component uses plain `three`.

7. Keep the animation subtle:
   - cyan near the logo/left
   - orange/gold near right league badges
   - small random pulses across nav
   - no large distracting particles
   - no floating dots over text that hurt readability

8. Run build/lint if available.

## Example header structure

```tsx
<header className="dd-header-shell">
  <HeaderLightFx intensity="nav" />
  <div className="dd-header-content">
    ...existing header...
  </div>
</header>
```

## Fallback

If WebGL causes issues on low-powered devices, use `HeaderCssLights` instead of `HeaderLightFx` for mobile or globally.