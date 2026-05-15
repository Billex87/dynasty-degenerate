import {
  findLatestProviderDataSnapshot,
  upsertProviderDataSnapshot,
} from "./db";
import {
  getProviderSnapshotDateKey,
  parseProviderSnapshotPayload,
} from "./providerDataSnapshots";

export type PlayerPropSnapshotStatus =
  | "disabled"
  | "missing_config"
  | "loaded"
  | "empty"
  | "error";

export type PlayerPropOutcome = {
  label: string;
  side: "over" | "under" | "other";
  priceAmerican: number | null;
  priceDecimal: number | null;
  impliedProbability: number | null;
  sportsbookId: string | null;
  sportsbookName: string | null;
  lastUpdated: string | null;
};

export type PlayerPropLine = {
  source: "OpticOdds";
  league: string;
  sport: string;
  fixtureId: string | null;
  eventName: string | null;
  startTime: string | null;
  playerId: string | null;
  playerName: string;
  team: string | null;
  market: string;
  marketLabel: string | null;
  line: number | null;
  outcomes: PlayerPropOutcome[];
};

export type PlayerPropSnapshot = {
  status: PlayerPropSnapshotStatus;
  source: "OpticOdds Player Props";
  generatedAt: string | null;
  snapshotKey: string | null;
  lines: PlayerPropLine[];
  message?: string | null;
};

type PlayerPropSnapshotPayload = {
  schemaVersion: 1;
  generatedAt: string;
  snapshotKey: string;
  snapshot: PlayerPropSnapshot;
};

type PlayerPropSnapshotOptions = {
  fetchImpl?: typeof fetch;
  forceRefresh?: boolean;
  persistSnapshot?: boolean;
  sourceMode?: "live" | "snapshot";
  now?: Date;
};

const SOURCE_KEY = "player-props-opticodds-v1";
const SOURCE_NAME = "OpticOdds Player Props";
const CACHE_TTL_MS = 15 * 60 * 1000;
const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const DEFAULT_SPORTSBOOKS = ["sleeper", "bet365", "underdog_fantasy_2_pick_"];
const DEFAULT_MARKETS = [
  "player_passing_yards",
  "player_rushing_yards",
  "player_receiving_yards",
  "player_receptions",
  "player_anytime_touchdown",
];

let cachedSnapshot: { expiresAt: number; value: PlayerPropSnapshot } | null =
  null;

function isEnabled() {
  return ENABLED_VALUES.has(
    String(process.env.ENABLE_OPTICODDS_PLAYER_PROPS || "")
      .trim()
      .toLowerCase()
  );
}

function stringList(value: unknown, fallback: string[]): string[] {
  const values = String(value || "")
    .split(/[,\s]+/)
    .map(item => item.trim())
    .filter(Boolean);
  return values.length ? Array.from(new Set(values)) : fallback;
}

function stringField(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function numberField(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function recordField(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "")
      return row[key];
  }
  return null;
}

function objectField(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function arrayRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object" && !Array.isArray(item))
      )
    : [];
}

function sideFromLabel(value: unknown): "over" | "under" | "other" {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized.includes("over")) return "over";
  if (normalized.includes("under")) return "under";
  return "other";
}

function safeDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function sportsbookIdFrom(value: unknown): string | null {
  if (typeof value === "string") return stringField(value);
  const row = objectField(value);
  return row
    ? stringField(recordField(row, ["id", "key", "slug", "name"]))
    : null;
}

function sportsbookNameFrom(value: unknown): string | null {
  if (typeof value === "string") return stringField(value);
  const row = objectField(value);
  return row
    ? stringField(
        recordField(row, ["name", "display_name", "displayName", "id"])
      )
    : null;
}

function playerNameFrom(row: Record<string, unknown>): string | null {
  const player = objectField(
    recordField(row, ["player", "participant", "competitor"])
  );
  return (
    stringField(
      recordField(row, [
        "player_name",
        "playerName",
        "participant_name",
        "participantName",
      ])
    ) ||
    (player
      ? stringField(
          recordField(player, [
            "name",
            "full_name",
            "fullName",
            "display_name",
            "displayName",
          ])
        )
      : null)
  );
}

function playerIdFrom(row: Record<string, unknown>): string | null {
  const player = objectField(
    recordField(row, ["player", "participant", "competitor"])
  );
  return (
    stringField(
      recordField(row, [
        "player_id",
        "playerId",
        "participant_id",
        "participantId",
      ])
    ) ||
    (player
      ? stringField(recordField(player, ["id", "player_id", "playerId"]))
      : null)
  );
}

function eventNameFrom(fixture: Record<string, unknown>): string | null {
  const explicit = stringField(
    recordField(fixture, ["name", "event_name", "eventName"])
  );
  if (explicit) return explicit;
  const home =
    objectField(recordField(fixture, ["home_competitor", "homeCompetitor"])) ||
    arrayRows(recordField(fixture, ["home_competitors", "homeCompetitors"]))[0];
  const away =
    objectField(recordField(fixture, ["away_competitor", "awayCompetitor"])) ||
    arrayRows(recordField(fixture, ["away_competitors", "awayCompetitors"]))[0];
  const homeName = home
    ? stringField(recordField(home, ["name", "abbreviation"]))
    : null;
  const awayName = away
    ? stringField(recordField(away, ["name", "abbreviation"]))
    : null;
  return homeName && awayName ? `${awayName} at ${homeName}` : null;
}

function normalizeOneOutcome(
  row: Record<string, unknown>,
  fixture: Record<string, unknown>
): PlayerPropLine | null {
  const market = stringField(
    recordField(row, [
      "market",
      "market_id",
      "marketId",
      "market_name",
      "marketName",
    ])
  );
  const playerName = playerNameFrom(row);
  if (!market || !playerName) return null;

  const sportsbook = recordField(row, ["sportsbook", "book", "bookmaker"]);
  const label =
    stringField(recordField(row, ["name", "label", "selection", "side"])) ||
    "unknown";
  const line = numberField(
    recordField(row, ["points", "line", "handicap", "threshold"])
  );

  return {
    source: "OpticOdds",
    league: stringField(recordField(fixture, ["league"])) || "nfl",
    sport: stringField(recordField(fixture, ["sport"])) || "football",
    fixtureId: stringField(
      recordField(fixture, [
        "id",
        "fixture_id",
        "fixtureId",
        "event_id",
        "eventId",
      ])
    ),
    eventName: eventNameFrom(fixture),
    startTime: safeDate(
      recordField(fixture, [
        "start_date",
        "startDate",
        "commence_time",
        "commenceTime",
      ])
    ),
    playerId: playerIdFrom(row),
    playerName,
    team: stringField(
      recordField(row, [
        "team",
        "team_id",
        "teamId",
        "team_abbreviation",
        "teamAbbreviation",
      ])
    ),
    market,
    marketLabel: stringField(
      recordField(row, [
        "market_display_name",
        "marketDisplayName",
        "market_label",
        "marketLabel",
      ])
    ),
    line,
    outcomes: [
      {
        label,
        side: sideFromLabel(label),
        priceAmerican: numberField(
          recordField(row, ["price", "american_odds", "americanOdds", "odds"])
        ),
        priceDecimal: numberField(
          recordField(row, [
            "decimal_price",
            "decimalPrice",
            "decimal_odds",
            "decimalOdds",
          ])
        ),
        impliedProbability: numberField(
          recordField(row, [
            "probability",
            "implied_probability",
            "impliedProbability",
          ])
        ),
        sportsbookId:
          sportsbookIdFrom(sportsbook) ||
          stringField(recordField(row, ["sportsbook_id", "sportsbookId"])),
        sportsbookName:
          sportsbookNameFrom(sportsbook) ||
          stringField(recordField(row, ["sportsbook_name", "sportsbookName"])),
        lastUpdated: safeDate(
          recordField(row, [
            "last_updated",
            "lastUpdated",
            "updated_at",
            "updatedAt",
          ])
        ),
      },
    ],
  };
}

function mergeLines(lines: PlayerPropLine[]): PlayerPropLine[] {
  const merged = new Map<string, PlayerPropLine>();
  for (const line of lines) {
    const key = [
      line.fixtureId || "",
      line.playerId || line.playerName.toLowerCase(),
      line.market,
      line.line ?? "",
      line.outcomes[0]?.sportsbookId || line.outcomes[0]?.sportsbookName || "",
    ].join("|");
    const existing = merged.get(key);
    if (existing) {
      existing.outcomes.push(...line.outcomes);
    } else {
      merged.set(key, { ...line, outcomes: [...line.outcomes] });
    }
  }
  return Array.from(merged.values()).sort(
    (a, b) =>
      a.playerName.localeCompare(b.playerName) ||
      a.market.localeCompare(b.market)
  );
}

function fixtureRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return arrayRows(payload);
  const root = objectField(payload);
  if (!root) return [];
  for (const key of ["data", "fixtures", "events", "results"]) {
    const rows = arrayRows(root[key]);
    if (rows.length) return rows;
  }
  return [];
}

export function normalizeOpticOddsPlayerProps(
  payload: unknown
): PlayerPropLine[] {
  const lines: PlayerPropLine[] = [];
  for (const fixture of fixtureRows(payload)) {
    const oddsRows = [
      ...arrayRows(recordField(fixture, ["odds", "markets", "lines"])),
      ...arrayRows(recordField(fixture, ["data"])),
    ];
    const rows = oddsRows.length ? oddsRows : [fixture];
    for (const row of rows) {
      const line = normalizeOneOutcome(row, fixture);
      if (line) lines.push(line);
    }
  }
  return mergeLines(lines);
}

function parseSnapshotPayload(
  payload?: string | null
): PlayerPropSnapshot | null {
  const parsed =
    parseProviderSnapshotPayload<Partial<PlayerPropSnapshotPayload>>(payload);
  if (
    parsed?.schemaVersion !== 1 ||
    !parsed.snapshot ||
    !Array.isArray(parsed.snapshot.lines)
  ) {
    return null;
  }
  return parsed.snapshot as PlayerPropSnapshot;
}

async function loadStoredSnapshot(): Promise<PlayerPropSnapshot> {
  const stored = await findLatestProviderDataSnapshot(SOURCE_KEY);
  const snapshot = parseSnapshotPayload(stored?.payload);
  if (!snapshot) {
    return {
      status: "empty",
      source: SOURCE_NAME,
      generatedAt: null,
      snapshotKey: null,
      lines: [],
      message: "No stored player props snapshot is available.",
    };
  }
  cachedSnapshot = { expiresAt: Date.now() + CACHE_TTL_MS, value: snapshot };
  return snapshot;
}

async function persistSnapshot(snapshot: PlayerPropSnapshot, now = new Date()) {
  if (snapshot.status !== "loaded") return false;
  const snapshotKey = snapshot.snapshotKey || getProviderSnapshotDateKey(now);
  const payload: PlayerPropSnapshotPayload = {
    schemaVersion: 1,
    generatedAt: snapshot.generatedAt || now.toISOString(),
    snapshotKey,
    snapshot: {
      ...snapshot,
      snapshotKey,
    },
  };
  return upsertProviderDataSnapshot({
    sourceKey: SOURCE_KEY,
    snapshotKey,
    payload: JSON.stringify(payload),
  });
}

function buildOpticOddsUrl(
  path: string,
  params: Record<string, string | string[] | undefined>
) {
  const url = new URL(`https://api.opticodds.com/api/v3${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach(item => url.searchParams.append(key, item));
    } else if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function fetchJson(fetchImpl: typeof fetch, url: string, apiKey: string) {
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/json",
      "X-Api-Key": apiKey,
    },
  });
  if (!response.ok)
    throw new Error(`OpticOdds player props ${response.status}`);
  return response.json();
}

async function fetchLiveOpticOddsSnapshot(
  options: PlayerPropSnapshotOptions
): Promise<PlayerPropSnapshot> {
  if (!isEnabled()) {
    return {
      status: "disabled",
      source: SOURCE_NAME,
      generatedAt: null,
      snapshotKey: null,
      lines: [],
      message: "OpticOdds player props are disabled.",
    };
  }

  const apiKey = String(process.env.OPTICODDS_API_KEY || "").trim();
  if (!apiKey) {
    return {
      status: "missing_config",
      source: SOURCE_NAME,
      generatedAt: null,
      snapshotKey: null,
      lines: [],
      message: "OpticOdds player props require OPTICODDS_API_KEY.",
    };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const fixtureLimit = Math.max(
    1,
    Math.min(25, Number(process.env.OPTICODDS_FIXTURE_LIMIT || 8) || 8)
  );
  const sportsbooks = stringList(
    process.env.OPTICODDS_SPORTSBOOKS,
    DEFAULT_SPORTSBOOKS
  ).slice(0, 5);
  const markets = stringList(
    process.env.OPTICODDS_PROP_MARKETS,
    DEFAULT_MARKETS
  );
  const now = options.now || new Date();

  const activeFixtures = await fetchJson(
    fetchImpl,
    buildOpticOddsUrl("/fixtures/active", {
      sport: "football",
      league: "nfl",
    }),
    apiKey
  );
  const fixtureIds = fixtureRows(activeFixtures)
    .map(fixture =>
      stringField(recordField(fixture, ["id", "fixture_id", "fixtureId"]))
    )
    .filter((id): id is string => Boolean(id))
    .slice(0, fixtureLimit);

  const lines: PlayerPropLine[] = [];
  for (const fixtureId of fixtureIds) {
    const odds = await fetchJson(
      fetchImpl,
      buildOpticOddsUrl("/fixtures/odds", {
        fixture_id: fixtureId,
        sportsbook: sportsbooks,
        market: markets,
        odds_format: "AMERICAN",
      }),
      apiKey
    );
    lines.push(...normalizeOpticOddsPlayerProps(odds));
  }

  const snapshotKey = getProviderSnapshotDateKey(now);
  const normalized = mergeLines(lines);
  return {
    status: normalized.length ? "loaded" : "empty",
    source: SOURCE_NAME,
    generatedAt: now.toISOString(),
    snapshotKey,
    lines: normalized,
    message: normalized.length
      ? null
      : "OpticOdds returned no player prop rows for the configured fixtures/markets.",
  };
}

export async function loadPlayerPropSnapshot(
  options: PlayerPropSnapshotOptions = {}
): Promise<PlayerPropSnapshot> {
  if (options.sourceMode === "snapshot") return loadStoredSnapshot();
  if (
    !options.forceRefresh &&
    cachedSnapshot &&
    cachedSnapshot.expiresAt > Date.now()
  ) {
    if (options.persistSnapshot)
      await persistSnapshot(cachedSnapshot.value, options.now);
    return cachedSnapshot.value;
  }

  const snapshot = await fetchLiveOpticOddsSnapshot(options);
  cachedSnapshot = { expiresAt: Date.now() + CACHE_TTL_MS, value: snapshot };
  if (options.persistSnapshot) await persistSnapshot(snapshot, options.now);
  return snapshot;
}

export async function refreshPlayerPropSnapshots(
  options: PlayerPropSnapshotOptions = {}
) {
  try {
    const snapshot = await loadPlayerPropSnapshot({
      ...options,
      forceRefresh: true,
      persistSnapshot: true,
    });
    return {
      status: snapshot.status,
      source: snapshot.source,
      snapshotKey: snapshot.snapshotKey,
      lineCount: snapshot.lines.length,
      message: snapshot.message || null,
    };
  } catch (error) {
    return {
      status: "error" as const,
      source: SOURCE_NAME,
      snapshotKey: null,
      lineCount: 0,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function clearPlayerPropSnapshotCacheForTests() {
  cachedSnapshot = null;
}
