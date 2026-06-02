import { Link } from "wouter";

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/data-disclosures", label: "Data Sources" },
  { href: "/support", label: "Support" },
];

type LegalLinksProps = {
  className?: string;
};

export function LegalLinks({ className = "" }: LegalLinksProps) {
  return (
    <nav
      aria-label="Legal and product policies"
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400 ${className}`.trim()}
    >
      {LEGAL_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
