import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  previewLeagueLogo,
  previewManagerAnchors,
} from "@/pages/LoaderKitPreview";
import "@/styles/football-loader-prototype.css";

// PROTOTYPE - Four football-themed loading animation directions, switchable via ?variant=.

type VariantKey = "route-tree" | "hail-mary" | "goal-line" | "slingshot";

type PrototypeStyle = CSSProperties & Record<`--${string}`, string | number>;

type VariantConfig = {
  key: VariantKey;
  label: string;
  tempo: string;
  motion: string;
  state: string;
};

const variants: VariantConfig[] = [
  {
    key: "route-tree",
    label: "A - Route Tree",
    tempo: "Fast snap",
    motion: "Managers break into pass routes while the ball scans the route tree.",
    state: "Loading playbook, rosters, rankings, and market routes.",
  },
  {
    key: "hail-mary",
    label: "B - Hail Mary",
    tempo: "Cinematic",
    motion: "Managers launch in high arcs like thrown helmets under stadium lights.",
    state: "Pulling every manager into one deep-ball report lane.",
  },
  {
    key: "goal-line",
    label: "C - Goal Line",
    tempo: "Impact",
    motion: "Manager icons collide at the line, then the ball punches through.",
    state: "Compressing league pressure into a final report push.",
  },
  {
    key: "slingshot",
    label: "D - Slingshot",
    tempo: "Premium orbit",
    motion: "Managers orbit a football portal, then sling downfield one by one.",
    state: "Converting raw league gravity into the finished board.",
  },
];

const managerNames = [
  "Bill",
  "AwwQQ",
  "Stefan",
  "Purple",
  "Dicky",
  "Green",
  "Beaston",
  "ryangj",
  "OnlyFans",
  "Simon",
  "Sleeper",
  "Waiver",
  "Trade",
  "Rookie",
];

function getVariantFromUrl(): VariantKey {
  if (typeof window === "undefined") return variants[0].key;
  const value = new URLSearchParams(window.location.search).get("variant");
  const match = variants.find((variant) => variant.key === value);
  return match?.key || variants[0].key;
}

function setVariantInUrl(next: VariantKey) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("variant", next);
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new CustomEvent("football-loader-prototype-variant"));
}

function useVariant(): [VariantConfig, (direction: 1 | -1) => void] {
  const [currentKey, setCurrentKey] = useState<VariantKey>(() => getVariantFromUrl());
  const currentIndex = Math.max(0, variants.findIndex((variant) => variant.key === currentKey));
  const current = variants[currentIndex] || variants[0];

  const cycle = (direction: 1 | -1) => {
    const next = variants[(currentIndex + direction + variants.length) % variants.length];
    setVariantInUrl(next.key);
  };

  useEffect(() => {
    const updateFromUrl = () => setCurrentKey(getVariantFromUrl());
    window.addEventListener("football-loader-prototype-variant", updateFromUrl);
    window.addEventListener("popstate", updateFromUrl);
    return () => {
      window.removeEventListener("football-loader-prototype-variant", updateFromUrl);
      window.removeEventListener("popstate", updateFromUrl);
    };
  }, []);

  return [current, cycle];
}

function PrototypeSwitcher({
  current,
  onCycle,
}: {
  current: VariantConfig;
  onCycle: (direction: 1 | -1) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") onCycle(-1);
      if (event.key === "ArrowRight") onCycle(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCycle]);

  if (import.meta.env.PROD) return null;

  return (
    <div className="flp-switcher" aria-label="Prototype variant switcher">
      <button type="button" onClick={() => onCycle(-1)} aria-label="Previous prototype">
        <ChevronLeft aria-hidden="true" />
      </button>
      <span>{current.label}</span>
      <button type="button" onClick={() => onCycle(1)} aria-label="Next prototype">
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}

function Football({
  className = "",
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span className={`flp-football ${className}`} aria-hidden="true">
      <span className="flp-football__lace" />
      {children}
    </span>
  );
}

function ManagerIcon({
  index,
  className = "",
  style,
}: {
  index: number;
  className?: string;
  style?: PrototypeStyle;
}) {
  const anchor = previewManagerAnchors[index % previewManagerAnchors.length];
  return (
    <span className={`flp-manager ${className}`} style={style}>
      <img src={anchor.avatarUrl || ""} alt="" />
      <em>{managerNames[index % managerNames.length]}</em>
    </span>
  );
}

function PrototypeShell({
  current,
  children,
}: {
  current: VariantConfig;
  children: ReactNode;
}) {
  return (
    <main className={`flp flp-${current.key}`}>
      <div className="flp-stadium" aria-hidden="true" />
      <section className="flp-board" aria-label={`${current.label} football loading animation prototype`}>
        <header className="flp-header">
          <span className="flp-prototype-label">Prototype</span>
          <img src={previewLeagueLogo} alt="" />
          <div>
            <p>Dynasty Degenerate Loader</p>
            <h1>{current.label}</h1>
          </div>
        </header>
        <div className="flp-stage">{children}</div>
        <aside className="flp-state" aria-label="Prototype state">
          <span>{current.tempo}</span>
          <strong>{current.motion}</strong>
          <p>{current.state}</p>
          <dl>
            <div>
              <dt>Managers</dt>
              <dd>{previewManagerAnchors.length}</dd>
            </div>
            <div>
              <dt>Variant</dt>
              <dd>{current.key}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  );
}

function RouteTreeVariant({ current }: { current: VariantConfig }) {
  const lanes = previewManagerAnchors.slice(0, 10);

  return (
    <PrototypeShell current={current}>
      <div className="flp-field flp-field-route" aria-hidden="true">
        <span className="flp-line flp-line-scrimmage" />
        <span className="flp-line flp-line-endzone" />
        <Football className="flp-route-ball" />
        <span className="flp-route flp-route-post" />
        <span className="flp-route flp-route-wheel" />
        <span className="flp-route flp-route-dig" />
        {lanes.map((_, index) => {
          const column = index % 5;
          const row = Math.floor(index / 5);
          return (
            <ManagerIcon
              key={`route-${index}`}
              index={index}
              className="flp-route-runner"
              style={{
                "--sx": `${11 + column * 18}%`,
                "--sy": `${78 + row * 8}%`,
                "--mx": `${17 + column * 15 + (row ? 10 : 0)}%`,
                "--my": `${44 - row * 10}%`,
                "--ex": `${10 + ((column * 23 + row * 9) % 78)}%`,
                "--ey": `${14 + row * 8}%`,
                "--delay": `${index * -0.22}s`,
              }}
            />
          );
        })}
      </div>
    </PrototypeShell>
  );
}

function HailMaryVariant({ current }: { current: VariantConfig }) {
  const launchers = previewManagerAnchors.slice(0, 12);

  return (
    <PrototypeShell current={current}>
      <div className="flp-field flp-field-hail" aria-hidden="true">
        <div className="flp-light flp-light-left" />
        <div className="flp-light flp-light-right" />
        <Football className="flp-hail-ball" />
        <span className="flp-hail-arc flp-hail-arc-a" />
        <span className="flp-hail-arc flp-hail-arc-b" />
        <span className="flp-hail-arc flp-hail-arc-c" />
        {launchers.map((_, index) => (
          <ManagerIcon
            key={`hail-${index}`}
            index={index}
            className="flp-hail-manager"
            style={{
              "--x0": `${6 + (index % 4) * 8}%`,
              "--y0": `${78 + Math.floor(index / 4) * 5}%`,
              "--x1": `${42 + (index % 5) * 8}%`,
              "--y1": `${10 + (index % 3) * 8}%`,
              "--x2": `${70 + (index % 4) * 6}%`,
              "--y2": `${42 + (index % 3) * 11}%`,
              "--delay": `${index * -0.28}s`,
              "--scale": `${index % 3 === 0 ? 1.08 : index % 3 === 1 ? 0.92 : 0.78}`,
              "--scale-start": `${index % 3 === 0 ? 0.84 : index % 3 === 1 ? 0.72 : 0.62}`,
              "--scale-end": `${index % 3 === 0 ? 0.86 : index % 3 === 1 ? 0.72 : 0.62}`,
            }}
          />
        ))}
      </div>
    </PrototypeShell>
  );
}

function GoalLineVariant({ current }: { current: VariantConfig }) {
  const offense = previewManagerAnchors.slice(0, 7);
  const defense = previewManagerAnchors.slice(7, 14);

  return (
    <PrototypeShell current={current}>
      <div className="flp-field flp-field-goal" aria-hidden="true">
        <span className="flp-goal-post" />
        <span className="flp-collision-core" />
        <Football className="flp-goal-ball" />
        {offense.map((_, index) => (
          <ManagerIcon
            key={`offense-${index}`}
            index={index}
            className="flp-trench-manager flp-trench-offense"
            style={{
              "--lane": index,
              "--start": `${8 + index * 4}%`,
              "--top": `${18 + index * 9}%`,
              "--delay": `${index * -0.16}s`,
            }}
          />
        ))}
        {defense.map((_, index) => (
          <ManagerIcon
            key={`defense-${index}`}
            index={index + 7}
            className="flp-trench-manager flp-trench-defense"
            style={{
              "--lane": index,
              "--start": `${84 - index * 4}%`,
              "--top": `${20 + index * 9}%`,
              "--delay": `${index * -0.14}s`,
            }}
          />
        ))}
      </div>
    </PrototypeShell>
  );
}

function SlingshotVariant({ current }: { current: VariantConfig }) {
  const orbiters = previewManagerAnchors.slice(0, 14);

  return (
    <PrototypeShell current={current}>
      <div className="flp-field flp-field-sling" aria-hidden="true">
        <span className="flp-portal flp-portal-outer" />
        <span className="flp-portal flp-portal-inner" />
        <Football className="flp-sling-ball" />
        <span className="flp-sling-lane" />
        {orbiters.map((_, index) => (
          <ManagerIcon
            key={`sling-${index}`}
            index={index}
            className="flp-sling-manager"
            style={{
              "--angle": `${index * 25.7}deg`,
              "--counter-angle": `${index * -25.7}deg`,
              "--radius": index % 3 === 0
                ? "clamp(5.2rem, 12vw, 10rem)"
                : index % 3 === 1
                  ? "clamp(7.2rem, 17vw, 14rem)"
                  : "clamp(9rem, 22vw, 18rem)",
              "--delay": `${index * -0.21}s`,
              "--scale": `${index > 10 ? 0.78 : index > 6 ? 0.9 : 1}`,
              "--scale-start": `${index > 10 ? 0.62 : index > 6 ? 0.72 : 0.82}`,
              "--scale-end": `${index > 10 ? 0.5 : index > 6 ? 0.62 : 0.72}`,
            }}
          />
        ))}
      </div>
    </PrototypeShell>
  );
}

export default function FootballLoaderPrototype() {
  const [current, cycle] = useVariant();

  return (
    <>
      {current.key === "route-tree" && <RouteTreeVariant current={current} />}
      {current.key === "hail-mary" && <HailMaryVariant current={current} />}
      {current.key === "goal-line" && <GoalLineVariant current={current} />}
      {current.key === "slingshot" && <SlingshotVariant current={current} />}
      <PrototypeSwitcher current={current} onCycle={cycle} />
    </>
  );
}
