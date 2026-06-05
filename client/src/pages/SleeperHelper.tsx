const repoUrl = "https://github.com/Billex87/dynasty-degenerate/tree/main/browser-extension/sleeper-helper";

const steps = [
  {
    label: "Install the helper",
    body: "Open Chrome Extensions, enable Developer mode, choose Load unpacked, and select browser-extension/sleeper-helper."
  },
  {
    label: "Open your report",
    body: "Go to a Dynasty Degens league report, open the Trades tab, and click Import Pending Transactions."
  },
  {
    label: "Let it capture",
    body: "The helper opens Sleeper trade and player pages, waits for Sleeper's own pending transaction responses, sanitizes the data, and sends the snapshot back."
  },
  {
    label: "Use Trade War Room",
    body: "Pending trades and waiver claims appear as cards with a View in Trade War Room button."
  }
];

const boundaries = [
  "Read-only in Phase 1.",
  "No Sleeper Authorization headers are displayed, stored, or transmitted.",
  "No Sleeper cookies are displayed, stored, or transmitted.",
  "No lineup, waiver, trade, accept, reject, or cancel action is submitted.",
  "Captured data is stripped to transaction IDs, league ID, roster IDs, player IDs, draft picks, statuses, timestamps, and waiver bid fields.",
  "Temporary captures live in Chrome session storage and clear with the browser session."
];

const troubleshooting = [
  {
    issue: "Dynasty Degens says the helper is not detected.",
    fix: "Reload the extension in chrome://extensions, then reload Dynasty Degens."
  },
  {
    issue: "Sleeper did not return a snapshot.",
    fix: "Make sure this Chrome profile is signed into Sleeper and retry from the Dynasty Degens Trades tab."
  },
  {
    issue: "No pending items import.",
    fix: "Sleeper responded, but no current pending trades or waiver claims were visible on the refreshed pages."
  },
  {
    issue: "The popup cannot send manually.",
    fix: "Open Dynasty Degens first. The Trades tab one-click flow is the primary path."
  }
];

function SleeperHelperPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050914] text-slate-100">
      <section className="relative isolate px-5 py-10 sm:px-8 lg:px-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_5%,rgba(249,115,22,0.32),transparent_32%),radial-gradient(circle_at_90%_12%,rgba(34,211,238,0.22),transparent_30%),linear-gradient(135deg,#050914,#071625_55%,#120915)]" />
        <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-orange-300/60 to-transparent" />

        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <a
            href="/"
            className="w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-300/10"
          >
            Back to Dynasty Degens
          </a>

          <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div>
              <p className="mb-4 w-fit rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-emerald-200">
                Transaction Sync
              </p>
              <h1 className="max-w-4xl text-4xl font-black uppercase leading-[0.9] tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
                Import pending Sleeper trades without copying tokens.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                The helper watches Sleeper pages you are already logged into, captures only pending trade and waiver transaction responses, strips them down to safe roster/player data, and sends that snapshot into Dynasty Degens.
              </p>
            </div>

            <div className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-5 shadow-[0_0_80px_rgba(34,211,238,0.14)]">
              <div className="rounded-[1.45rem] border border-orange-300/25 bg-gradient-to-br from-orange-500/15 via-slate-900 to-cyan-500/15 p-5">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">Transaction Sync status</p>
                <h2 className="mt-3 text-2xl font-black text-white">Local unpacked MVP, production-domain ready.</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Use this route for installation, privacy review, and troubleshooting until the Chrome Web Store listing is approved.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <a
                    href={repoUrl}
                    rel="noreferrer"
                    target="_blank"
                    className="rounded-2xl bg-cyan-300 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-cyan-200"
                  >
                    View helper files
                  </a>
                  <a
                    href="#install"
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/15"
                  >
                    Install steps
                  </a>
                </div>
              </div>
            </div>
          </div>

          <section id="install" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <article key={step.label} className="rounded-3xl border border-white/10 bg-white/[0.055] p-5">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Step {index + 1}</p>
                <h2 className="mt-3 text-xl font-black text-white">{step.label}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{step.body}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-[2rem] border border-emerald-300/20 bg-emerald-300/10 p-6">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Privacy boundary</p>
              <h2 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em] text-white">What it will not do</h2>
              <p className="mt-3 text-sm leading-6 text-emerald-50/80">
                This helper is intentionally narrower than a full Sleeper integration. It imports visibility, not control.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {boundaries.map((boundary) => (
                <div key={boundary} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm font-bold leading-6 text-slate-200">
                  {boundary}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-orange-300/20 bg-slate-950/65 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">Troubleshooting</p>
                <h2 className="mt-2 text-3xl font-black uppercase tracking-[-0.04em] text-white">If the import does not fire</h2>
              </div>
              <code className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-cyan-100">
                chrome://extensions
              </code>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {troubleshooting.map((item) => (
                <article key={item.issue} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <h3 className="font-black text-white">{item.issue}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.fix}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-cyan-300/20 bg-cyan-300/10 p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100">Chrome Web Store readiness</p>
            <h2 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em] text-white">Prepared for packaging, not yet submitted.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-cyan-50/80">
              The repo includes icons, permission notes, privacy copy, store-listing draft, and a package script. The final manual work is creating the Chrome Web Store developer listing, uploading the zip, adding screenshots, and waiting for review.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

export default SleeperHelperPage;
