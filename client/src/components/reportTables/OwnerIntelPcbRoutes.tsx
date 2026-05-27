export function OwnerIntelPcbRoutes() {
  return (
    <svg
      className="owner-intel-pcb-routes"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id="owner-intel-pcb-glow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="0.58" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="owner-intel-pcb-route-bed" fill="none" filter="url(#owner-intel-pcb-glow)">
        <path d="M4 18 H18 L22 24 H43 L47 30 H62 L67 24 H82 L87 18 H96" />
        <path d="M5 47 H21 L26 42 H44 L49 47 H63 L68 42 H80 L85 47 H96" />
        <path d="M6 76 H18 L23 70 H35 L40 76 H58 L63 70 H77 L82 76 H95" />
        <path d="M14 10 V23 M36 7 V31 M64 7 V31 M87 10 V23" />
        <path d="M15 51 V68 M38 44 V78 M62 44 V78 M85 51 V68" />
      </g>
      <g className="owner-intel-pcb-route-current" fill="none" filter="url(#owner-intel-pcb-glow)">
        <path
          className="owner-intel-pcb-route owner-intel-pcb-route-cyan"
          d="M4 18 H18 L22 24 H43 L47 30 H62 L67 24 H82 L87 18 H96"
        />
        <path
          className="owner-intel-pcb-route owner-intel-pcb-route-cyan owner-intel-pcb-route-alt"
          d="M5 47 H21 L26 42 H44 L49 47 H63 L68 42 H80 L85 47 H96"
        />
        <path
          className="owner-intel-pcb-route owner-intel-pcb-route-amber"
          d="M6 76 H18 L23 70 H35 L40 76 H58 L63 70 H77 L82 76 H95"
        />
      </g>
      <g className="owner-intel-pcb-route-nodes" filter="url(#owner-intel-pcb-glow)">
        {[
          [22, 24, "cyan"],
          [47, 30, "amber"],
          [67, 24, "cyan"],
          [87, 18, "amber"],
          [26, 42, "cyan"],
          [49, 47, "amber"],
          [68, 42, "cyan"],
          [85, 47, "amber"],
          [23, 70, "amber"],
          [40, 76, "cyan"],
          [63, 70, "amber"],
          [82, 76, "cyan"],
        ].map(([cx, cy, tone]) => (
          <circle
            key={`${cx}-${cy}-${tone}`}
            className={`owner-intel-pcb-node owner-intel-pcb-node-${tone}`}
            cx={cx}
            cy={cy}
            r="0.74"
          />
        ))}
      </g>
    </svg>
  );
}
