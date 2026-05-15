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

  it("throws a clear error for disallowed live provider URLs", () => {
    expect(() => assertUserLoadAllowedLiveProviderUrl("https://api.opticodds.com/api/v3/fixtures/odds", "report load")).toThrow(
      "Blocked non-Sleeper live provider call during report load"
    );
  });
});
