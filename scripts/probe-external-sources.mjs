import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ override: false, quiet: true });

const timeoutMs =
  Number.parseInt(process.env.SOURCE_PROBE_TIMEOUT_MS || "12000", 10) || 12000;

function configured(name) {
  return Boolean(String(process.env[name] || "").trim());
}

function getCredential(name) {
  return String(process.env[name] || "").trim();
}

function summarizeJson(value) {
  if (!value || typeof value !== "object") return { rows: null, shape: null };
  if (Array.isArray(value)) return { rows: value.length, shape: "array" };

  for (const key of [
    "data",
    "events",
    "players",
    "sportsbooks",
    "results",
    "items",
  ]) {
    if (Array.isArray(value[key]))
      return { rows: value[key].length, shape: key };
  }

  return { rows: null, shape: "object" };
}

function matchTerms(text, terms = []) {
  const normalized = text.toLowerCase();
  return terms.filter(term => normalized.includes(term.toLowerCase()));
}

function classifyResponse(probe, response) {
  if (response.ok) return "reachable";
  if (
    (response.status === 401 || response.status === 403) &&
    probe.authExpected
  ) {
    return configured(probe.credentialEnv)
      ? "credential-rejected"
      : "credentials-required";
  }
  if (response.status === 404 && probe.notPublicOk) return "not-public";
  if (response.status === 405 && probe.notPublicOk) return "not-public";
  return "http-error";
}

async function runProbe(probe) {
  if (probe.skip) {
    return {
      source: probe.source,
      target: probe.target,
      status: "not-public",
      http: "-",
      bytes: 0,
      rows: "-",
      shape: "-",
      durationMs: 0,
      coverage: probe.coverage || [],
      note: probe.note,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const headers = {
      accept:
        probe.accept || "application/json, text/plain;q=0.9, text/html;q=0.8",
      ...(probe.headers || {}),
    };
    const credential = probe.credentialEnv
      ? getCredential(probe.credentialEnv)
      : "";
    if (credential && probe.credentialHeader)
      headers[probe.credentialHeader] = probe.credentialPrefix
        ? `${probe.credentialPrefix}${credential}`
        : credential;

    const response = await fetch(probe.url, {
      method: probe.method || "GET",
      headers,
      body: probe.body ? JSON.stringify(probe.body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    let rows = null;
    let shape = null;

    try {
      const parsed = JSON.parse(text);
      const summary = summarizeJson(parsed);
      rows = summary.rows;
      shape = summary.shape;
    } catch {
      shape = response.headers.get("content-type")?.split(";")[0] || "text";
    }

    const coverage = matchTerms(text, probe.coverageTerms);
    return {
      source: probe.source,
      target: probe.target,
      status: classifyResponse(probe, response),
      http: response.status,
      bytes: Buffer.byteLength(text),
      rows: rows ?? "-",
      shape: shape || "-",
      durationMs: Date.now() - startedAt,
      coverage,
      note: probe.note || "",
    };
  } catch (error) {
    return {
      source: probe.source,
      target: probe.target,
      status: error?.name === "AbortError" ? "timeout" : "network-error",
      http: "-",
      bytes: 0,
      rows: "-",
      shape: "-",
      durationMs: Date.now() - startedAt,
      coverage: [],
      note: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

const probes = [
  {
    source: "Yahoo Fantasy",
    target: "Official developer portal",
    url: "https://sports.yahoo.com/developer/",
    coverageTerms: ["OAuth", "Fantasy Sports API", "application review"],
    note: "Official, approval-gated platform API.",
  },
  {
    source: "Yahoo Fantasy",
    target: "Fantasy game API",
    url: "https://fantasysports.yahooapis.com/fantasy/v2/game/nfl?format=json",
    authExpected: true,
    credentialEnv: "YAHOO_ACCESS_TOKEN",
    credentialHeader: "authorization",
    credentialPrefix: "Bearer ",
    coverageTerms: ["game_key", "nfl"],
    note: "Use YAHOO_ACCESS_TOKEN after OAuth approval to test real data.",
  },
  {
    source: "Sleeper Fantasy",
    target: "Official NFL state",
    url: "https://api.sleeper.app/v1/state/nfl",
    coverageTerms: ["season", "week", "league_create_season"],
    note: "Official read-only fantasy API; keep live use limited to league/current-state checks.",
  },
  {
    source: "Sleeper Picks",
    target: "Official public props API",
    skip: true,
    coverage: ["OpticOdds sportsbook id: sleeper", "ParlayAPI docs: Sleeper"],
    note: "No official public Sleeper Picks developer API confirmed; use licensed props aggregators.",
  },
  {
    source: "OpticOdds",
    target: "Sportsbooks API",
    url: "https://api.opticodds.com/api/v3/sportsbooks",
    authExpected: true,
    credentialEnv: "OPTICODDS_API_KEY",
    credentialHeader: "X-Api-Key",
    coverageTerms: ["sleeper", "bet365", "underdog"],
    note: "Licensed odds aggregator candidate.",
  },
  {
    source: "OpticOdds",
    target: "Sportsbook docs",
    url: "https://developer.opticodds.com/docs/sportsbooks",
    coverageTerms: ["sleeper", "bet365", "underdog_fantasy"],
    note: "Docs coverage check for target books.",
  },
  {
    source: "SportsGameOdds",
    target: "NFL events API",
    url: "https://api.sportsgameodds.com/v2/events?leagueID=NFL&oddsAvailable=true&limit=1",
    authExpected: true,
    credentialEnv: "SPORTSGAMEODDS_API_KEY",
    credentialHeader: "x-api-key",
    coverageTerms: ["NFL", "odds", "byBookmaker"],
    note: "Licensed odds aggregator candidate.",
  },
  {
    source: "SportsGameOdds",
    target: "API docs",
    url: "https://sportsgameodds.com/docs/basics/cheat-sheet",
    coverageTerms: ["player props", "byBookmaker", "leagueID"],
    note: "Docs coverage check for events and odds shape.",
  },
  {
    source: "ParlayAPI",
    target: "NFL props API",
    url: "https://parlay-api.com/v1/sports/americanfootball_nfl/props?limit=1&bookmakers=sleeper,bet365,underdog_fantasy_2_pick_",
    authExpected: true,
    credentialEnv: "PARLAY_API_KEY",
    credentialHeader: "X-API-Key",
    coverageTerms: ["bookmaker", "player", "line"],
    note: "Props-focused aggregator candidate.",
  },
  {
    source: "ParlayAPI",
    target: "Props docs",
    url: "https://parlay-api.com/docs",
    coverageTerms: ["Sleeper", "Underdog", "Player Props", "DFS apps"],
    note: "Docs coverage check for target books and DFS apps.",
  },
  {
    source: "Underdog Fantasy",
    target: "Official public props API",
    skip: true,
    coverage: ["OpticOdds sportsbook ids", "ParlayAPI props feed"],
    note: "No official public developer API confirmed; avoid direct internal endpoint scraping.",
  },
  {
    source: "Underdog Fantasy",
    target: "Aggregator docs",
    url: "https://sharpapi.io/sportsbooks/underdog-odds-api",
    coverageTerms: [
      "no public Underdog Fantasy API",
      "player prop lines",
      "REST API",
    ],
    note: "Third-party evidence that aggregator access is the supportable route.",
  },
  {
    source: "bet365",
    target: "Direct official API",
    skip: true,
    coverage: ["OpticOdds sportsbook id: bet365"],
    note: "No public direct bet365 odds API confirmed; use licensed odds aggregators.",
  },
  {
    source: "FFPC",
    target: "API help page",
    url: "https://api.myffpc.com/Help",
    coverageTerms: [
      "ProjectedFantasyPoints",
      "GetPlayerCard",
      "GetLeagueTransactions",
    ],
    note: "Exposed ASP.NET API help exists, but most endpoints are undocumented and may require auth.",
  },
  {
    source: "FFPC",
    target: "Projected points endpoint",
    url: "https://api.myffpc.com/api/Team/GetProjectedFantasyPointsForAllLeagueTeams?nflWeek=1",
    notPublicOk: true,
    coverageTerms: ["projected", "fantasy"],
    note: "Unauthenticated lightweight probe of a documented GET route.",
  },
  {
    source: "Fantrax",
    target: "Unofficial API docs",
    url: "https://fantraxapi.metamanager.wiki/en/stable/",
    coverageTerms: ["unofficial", "cookie", "League"],
    note: "Do not use cookie-auth/private endpoints without Fantrax approval.",
  },
  {
    source: "Fantrax",
    target: "Public app API surface",
    url: "https://www.fantrax.com/fxpa/req",
    method: "POST",
    body: [],
    notPublicOk: true,
    coverageTerms: ["Unauthorized", "NotLoggedIn"],
    note: "No cookies or credentials sent; useful only to confirm the surface is not a supported public API.",
  },
];

const results = [];
for (const probe of probes) {
  results.push(await runProbe(probe));
}

console.table(
  results.map(result => ({
    source: result.source,
    target: result.target,
    status: result.status,
    http: result.http,
    rows: result.rows,
    shape: result.shape,
    bytes: result.bytes,
    ms: result.durationMs,
    coverage: result.coverage.join(", ") || "-",
  }))
);

console.log("\nCredential state:");
console.table([
  { env: "YAHOO_ACCESS_TOKEN", configured: configured("YAHOO_ACCESS_TOKEN") },
  { env: "OPTICODDS_API_KEY", configured: configured("OPTICODDS_API_KEY") },
  {
    env: "SPORTSGAMEODDS_API_KEY",
    configured: configured("SPORTSGAMEODDS_API_KEY"),
  },
  { env: "PARLAY_API_KEY", configured: configured("PARLAY_API_KEY") },
]);

console.log("\nNotes:");
for (const result of results) {
  if (result.note)
    console.log(`- ${result.source} / ${result.target}: ${result.note}`);
}
