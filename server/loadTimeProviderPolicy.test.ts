import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearApiProviderTelemetryForTests,
  getApiProviderTelemetrySnapshot,
} from "./apiProviderTelemetry";
import {
  assertUserLoadAllowedLiveProviderUrl,
  fetchUserLoadJson,
  fetchUserLoadResponse,
  getUserLoadSnapshotOptions,
  isUserLoadAllowedLiveProviderUrl,
} from "./loadTimeProviderPolicy";

describe("load-time provider policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearApiProviderTelemetryForTests();
  });

  it("uses snapshot mode for non-Sleeper provider reads during user loads", () => {
    expect(getUserLoadSnapshotOptions()).toEqual({ sourceMode: "snapshot" });
  });

  it("allows only Sleeper live provider URLs during user loads", () => {
    expect(isUserLoadAllowedLiveProviderUrl("https://api.sleeper.app/v1/league/123")).toBe(true);
    expect(isUserLoadAllowedLiveProviderUrl("https://api.sleeper.com/players/nfl/research/regular/2026")).toBe(true);
    expect(isUserLoadAllowedLiveProviderUrl(new URL("https://api.sleeper.app/v1/state/nfl"))).toBe(true);
    expect(isUserLoadAllowedLiveProviderUrl("https://sleepercdn.com/avatars/thumbs/avatar-id")).toBe(false);
    expect(isUserLoadAllowedLiveProviderUrl("https://api.fantasypros.com/public/v2/json/NFL/2026/consensus-rankings")).toBe(false);
    expect(isUserLoadAllowedLiveProviderUrl("https://api.opticodds.com/api/v3/fixtures/odds")).toBe(false);
    expect(isUserLoadAllowedLiveProviderUrl("not a url")).toBe(false);
  });

  it("blocks non-Sleeper fetches before the network call is made", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchUserLoadJson("https://api.fantasypros.com/public/v2/json/NFL/2026/player-points")).rejects.toThrow(
      "Blocked non-Sleeper live provider call"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows Sleeper fetches through the policy wrapper", async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ league_id: "123456789012" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchUserLoadJson("https://api.sleeper.app/v1/league/123456789012")).resolves.toEqual({
      league_id: "123456789012",
    });
    expect(fetchMock).toHaveBeenCalledWith("https://api.sleeper.app/v1/league/123456789012", undefined);
  });

  it("blocks invalid Sleeper league IDs before the network call is made", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchUserLoadResponse("https://api.sleeper.app/v1/league/0/users", "invalid league load");
    const snapshot = getApiProviderTelemetrySnapshot({ lookbackMs: 60_000 });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(snapshot.recentEvents[0]).toMatchObject({
      provider: "Sleeper",
      endpoint: "api.sleeper.app/v1/league/:id/users",
      ok: false,
      status: 400,
      message: "Blocked invalid Sleeper league ID",
      scope: "user-load",
    });
    expect(JSON.stringify(snapshot)).not.toContain("/league/0/users");
  });

  it("records sanitized user-load telemetry for Sleeper calls", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ league_id: "123456789012" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchUserLoadResponse("https://api.sleeper.app/v1/league/123456789012/users", "league users load");
    const snapshot = getApiProviderTelemetrySnapshot({ lookbackMs: 60_000 });

    expect(snapshot.totals.userLoadCalls).toBe(1);
    expect(snapshot.totals.userLoadNetworkCalls).toBe(1);
    expect(snapshot.byScope[0]).toMatchObject({
      label: "user-load",
      calls: 1,
      networkCalls: 1,
    });
    expect(snapshot.recentEvents[0]).toMatchObject({
      provider: "Sleeper",
      endpoint: "api.sleeper.app/v1/league/:id/users",
      job: "league users load",
      scope: "user-load",
    });
    expect(JSON.stringify(snapshot)).not.toContain("123456789012");
  });

  it("sanitizes UUID-like Sleeper endpoint segments in telemetry", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchUserLoadResponse("https://api.sleeper.app/v1/resource/550e8400-e29b-41d4-a716-446655440000/detail", "uuid load");
    const snapshot = getApiProviderTelemetrySnapshot({ lookbackMs: 60_000 });

    expect(snapshot.recentEvents[0]).toMatchObject({
      endpoint: "api.sleeper.app/v1/resource/:id/detail",
      job: "uuid load",
      scope: "user-load",
    });
    expect(JSON.stringify(snapshot)).not.toContain("550e8400");
  });

  it("records failed Sleeper user-load telemetry without leaking raw ids", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: "unavailable" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchUserLoadResponse("https://api.sleeper.app/v1/league/123456789012/rosters", "league rosters load");
    const snapshot = getApiProviderTelemetrySnapshot({ lookbackMs: 60_000 });

    expect(response.status).toBe(503);
    expect(snapshot.recentEvents[0]).toMatchObject({
      provider: "Sleeper",
      endpoint: "api.sleeper.app/v1/league/:id/rosters",
      ok: false,
      status: 503,
      message: "Sleeper 503",
    });
    expect(JSON.stringify(snapshot)).not.toContain("123456789012");
  });

  it("throws a clear error for disallowed live provider URLs", () => {
    expect(() => assertUserLoadAllowedLiveProviderUrl("https://api.opticodds.com/api/v3/fixtures/odds", "report load")).toThrow(
      "Blocked non-Sleeper live provider call during report load"
    );
  });
});
