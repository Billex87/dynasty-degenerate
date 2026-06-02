import { LegalLinks } from "@/components/LegalLinks";
import { Button } from "@/components/ui/button";
import { HomeFooterChrome } from "@/features/home/components/HomeChrome";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

type LegalSectionKey = "terms" | "privacy" | "refunds" | "data-disclosures" | "support";

type LegalSection = {
  eyebrow: string;
  title: string;
  intro: string;
  rows: Array<{
    heading: string;
    body: string[];
  }>;
};

const UPDATED_AT = "June 2, 2026";

const SECTIONS: Record<LegalSectionKey, LegalSection> = {
  terms: {
    eyebrow: "Terms of Use",
    title: "Dynasty Degenerates Terms",
    intro:
      "Dynasty Degenerates provides fantasy football analysis, projections, and decision support for informational and entertainment purposes. It is not financial, betting, legal, or professional advice.",
    rows: [
      {
        heading: "Use of the product",
        body: [
          "You are responsible for how you use any roster, waiver, trade, draft, or lineup recommendation. Fantasy football outcomes depend on league settings, source freshness, injuries, transactions, and manager behavior that can change quickly.",
          "Do not use the app to abuse provider APIs, scrape restricted services, bypass league rules, harass other managers, or submit information you do not have permission to use.",
        ],
      },
      {
        heading: "Accounts and admin access",
        body: [
          "Public report generation currently uses Sleeper usernames and public or user-selected league identifiers. Admin and diagnostic surfaces are protected and are not intended for normal users.",
          "If user accounts or paid plans are enabled later, account access, billing status, usage limits, and entitlements must be enforced server-side before access is granted.",
        ],
      },
      {
        heading: "No affiliation",
        body: [
          "Dynasty Degenerates is an independent fantasy football tool. It is not affiliated with, endorsed by, or sponsored by Sleeper, the NFL, NFL teams, FantasyPros, KeepTradeCut, FantasyCalc, Dynasty Nerds, DraftSharks, or other data providers unless a provider agreement says otherwise.",
        ],
      },
      {
        heading: "Availability and changes",
        body: [
          "The app may change, pause, remove, or limit features when data sources are stale, unavailable, rate limited, or legally restricted.",
          "Reports can contain mistakes. Always verify live roster, lineup, transaction, injury, and source status inside your league platform before acting.",
        ],
      },
    ],
  },
  privacy: {
    eyebrow: "Privacy Policy",
    title: "Privacy and Data Handling",
    intro:
      "This policy explains the main categories of data used by Dynasty Degenerates and the product boundaries that should stay in place before broader launch.",
    rows: [
      {
        heading: "Data used for reports",
        body: [
          "The app may process Sleeper usernames, league IDs, roster data, draft data, public transaction data, league settings, cached report payloads, feedback form submissions, and admin diagnostics needed to generate or debug reports.",
          "The app should not request private league credentials from normal users. Any future account-linking flow should use approved provider paths and server-side session protections.",
        ],
      },
      {
        heading: "Analytics and diagnostics",
        body: [
          "Production builds may use Vercel Analytics and Speed Insights for aggregate traffic and performance telemetry.",
          "Operational diagnostics should avoid raw secrets, tokens, private credentials, and unnecessary raw payload logging. Provider keys and webhook URLs must stay server-side.",
        ],
      },
      {
        heading: "Retention and deletion",
        body: [
          "Reports and diagnostics may be cached to improve performance, reduce provider calls, and support admin troubleshooting. Cached data should be pruned or refreshed when it is stale or no longer needed.",
          "A formal account deletion and export process should be added before normal user accounts, saved leagues, billing, or long-term personal preferences launch.",
        ],
      },
      {
        heading: "Payments",
        body: [
          "No paid self-serve product is currently launched. If payments are added, payment details should be handled by Stripe or another payment processor, with webhook signature verification and server-side entitlement checks before paid access is granted.",
        ],
      },
    ],
  },
  refunds: {
    eyebrow: "Refund and Cancellation Policy",
    title: "Refunds, Cancellations, and Paid Access",
    intro:
      "Dynasty Degenerates does not currently sell a self-serve paid subscription, league pass, or one-time digital product. This page sets the launch boundary for future paid access.",
    rows: [
      {
        heading: "Current status",
        body: [
          "There is currently no active checkout, subscription, customer portal, or paid entitlement workflow for normal users.",
          "Do not market paid access or charge users until Stripe checkout, webhook verification, customer portal support, usage limits, and backend entitlement checks are implemented and tested.",
        ],
      },
      {
        heading: "Future subscriptions",
        body: [
          "When subscriptions launch, users should be able to cancel through a customer portal or support path. Cancellation should stop future renewal charges while preserving access through the paid period unless the plan terms state otherwise.",
          "Failed payment, renewal, cancellation, and plan-change webhook events must update server-side entitlements before the frontend presents access as active.",
        ],
      },
      {
        heading: "Future one-time digital products",
        body: [
          "One-time products such as draft kits, league passes, or generated report bundles should display refund terms at checkout before purchase.",
          "Any refund exception, support review, or reversal should update the user's entitlement record server-side.",
        ],
      },
      {
        heading: "Support",
        body: [
          "Until a formal support inbox is configured, product support should be routed through the in-app feedback path or the support contact configured for launch.",
        ],
      },
    ],
  },
  "data-disclosures": {
    eyebrow: "Data Source Disclosures",
    title: "Fantasy Data Source and Confidence Disclosures",
    intro:
      "Dynasty Degenerates blends stored snapshots, public league data, provider values, schedule context, and internal heuristics. These disclosures define what users should understand before acting.",
    rows: [
      {
        heading: "Source freshness",
        body: [
          "Recommendations can be downgraded, hidden, or labeled as watch/hold when source rows are stale, missing, limited, or below confidence thresholds.",
          "Users should verify live roster, lineup, waiver, transaction, injury, and league-format status in Sleeper or the relevant league platform before acting.",
        ],
      },
      {
        heading: "Provider boundaries",
        body: [
          "Provider names may appear to identify source categories or stored snapshots, but provider data availability, licensing, freshness, and redistribution rights can differ by package and endpoint.",
          "The app should not imply that unavailable provider projections, rankings, news, or premium data are present when a source-health row says missing, stale, research, or blocked.",
        ],
      },
      {
        heading: "AI read limitations",
        body: [
          "AI readouts are decision support. They can be wrong, incomplete, stale, or overconfident if source evidence changes after a report is generated.",
          "Action reads should include what to do, why, confidence, what could change the read, and where to verify. If a read lacks those receipts, treat it as support context rather than a final action.",
        ],
      },
      {
        heading: "No betting use",
        body: [
          "Dynasty Degenerates is built for fantasy football roster decisions. It is not a sportsbook, betting model, odds product, or gambling advice service.",
        ],
      },
    ],
  },
  support: {
    eyebrow: "Support",
    title: "Support and Contact",
    intro:
      "Use this page to route product questions, feedback, data-source concerns, and billing issues once paid access launches.",
    rows: [
      {
        heading: "Current support path",
        body: [
          "The in-app feedback button is the current product support path. Include the Sleeper username, league name, league ID if available, browser/device, and the report section involved so the issue can be reproduced.",
          "If you include an email address in the feedback form, it can be used for follow-up. Do not submit passwords, API keys, payment card details, or private league credentials.",
        ],
      },
      {
        heading: "Billing and account questions",
        body: [
          "No self-serve paid subscription is currently active. If a paid product launches, checkout, cancellation, refund, and plan-change support should be backed by Stripe customer portal support and server-side entitlement records.",
          "If you believe you were charged in error after paid access launches, contact support with the email used at checkout and the approximate charge date. Do not send full card numbers.",
        ],
      },
      {
        heading: "Data-source or recommendation concerns",
        body: [
          "Report stale rankings, missing players, wrong league format, incorrect roster data, or overconfident AI reads through the feedback form so the source-health and recommendation receipts can be reviewed.",
          "Fantasy-football decisions remain time-sensitive. Verify live roster, injury, transaction, and lineup status in the league platform before acting.",
        ],
      },
      {
        heading: "Response expectations",
        body: [
          "Dynasty Degenerates is not an emergency support service and does not guarantee response times while the product is pre-launch.",
          "High-risk issues such as exposed secrets, unsafe admin access, billing mistakes, or incorrect paid entitlements should be prioritized over general feature requests.",
        ],
      },
    ],
  },
};

export default function LegalPage({ section }: { section: LegalSectionKey }) {
  const content = SECTIONS[section];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Button asChild variant="ghost" className="text-slate-200 hover:bg-slate-900 hover:text-cyan-100">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back to Dynasty Degens
            </Link>
          </Button>
        </div>

        <header className="mb-8 border-b border-cyan-400/20 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">{content.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black uppercase tracking-wide text-white sm:text-5xl">
            {content.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{content.intro}</p>
          <p className="mt-4 text-sm font-semibold text-slate-400">Last updated: {UPDATED_AT}</p>
        </header>

        <LegalLinks className="mb-8 justify-start text-slate-300" />

        <div className="grid gap-5">
          {content.rows.map((row) => (
            <section key={row.heading} className="rounded border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-lg font-black uppercase tracking-wide text-cyan-100">{row.heading}</h2>
              <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">
                {row.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <footer className="home-footer px-4 py-1">
        <HomeFooterChrome />
      </footer>
    </div>
  );
}
