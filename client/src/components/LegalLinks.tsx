import { Link } from "wouter";

export const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/data-disclosures", label: "Data Sources" },
  { href: "/services", label: "Services" },
  { href: "/support", label: "Support" },
] as const;

// The single consolidated link lands on the first legal section; the tab bar
// at the top of the legal page handles switching between sections from there.
const LEGAL_LANDING_HREF = LEGAL_LINKS[0].href;

type LegalFooterLinkProps = {
  className?: string;
};

/** One small footer link that replaces the old row of five legal links. */
export function LegalFooterLink({ className = "" }: LegalFooterLinkProps) {
  return (
    <nav
      aria-label="Legal and product policies"
      className={`flex items-center justify-center text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400 ${className}`.trim()}
    >
      <Link
        href={LEGAL_LANDING_HREF}
        className="transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        Legal &amp; Support
      </Link>
    </nav>
  );
}

type LegalTabsProps = {
  /** The active section href, e.g. "/terms". */
  active: string;
  className?: string;
};

/** Tab-style navigation across the legal sections, shown at the top of the legal page. */
export function LegalTabs({ active, className = "" }: LegalTabsProps) {
  return (
    <nav
      aria-label="Legal sections"
      className={`flex flex-wrap items-center gap-1 border-b border-slate-800 pb-2 ${className}`.trim()}
    >
      {LEGAL_LINKS.map((link) => {
        const isActive = link.href === active;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-t-md px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
              isActive
                ? "bg-cyan-400/10 text-cyan-100 shadow-[inset_0_-2px_0_0_rgba(34,211,238,0.85)]"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-cyan-200"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
