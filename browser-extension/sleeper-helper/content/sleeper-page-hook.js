(() => {
  if (window.__DYNASTY_DEGENS_SLEEPER_HELPER_HOOKED__) return;
  window.__DYNASTY_DEGENS_SLEEPER_HELPER_HOOKED__ = true;

  const PAGE_SOURCE = "dynasty-degens-sleeper-page-hook";
  const CAPTURE_TYPE = "SLEEPER_TRADE_CENTER_CAPTURED";
  const ALLOWED_TYPES = new Set(["trade", "waiver"]);
  const ALLOWED_PENDING_STATUSES = new Set(["pending", "proposed"]);
  const ALLOWED_PAGE_SLUGS = new Set(["trades", "players", "waivers", "transactions"]);
  const CURRENT_PENDING_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

  function getLeagueContextFromLocation() {
    const match = window.location.pathname.match(/\/leagues\/(\d{8,24})(?:\/([^/?#]+))?/);
    if (!match) return null;
    const pageSlug = String(match[2] || "").toLowerCase();
    if (!ALLOWED_PAGE_SLUGS.has(pageSlug)) return null;
    return { leagueId: match[1], pageSlug };
  }

  function getLeagueIdFromLocation() {
    return getLeagueContextFromLocation()?.leagueId || null;
  }

  function isLeagueActivityPage() {
    return Boolean(getLeagueContextFromLocation());
  }

  function getTransactionTimestampMs(transaction) {
    const rawValue = transaction?.status_updated ?? transaction?.created;
    const timestamp = Number(rawValue);
    if (Number.isFinite(timestamp) && timestamp > 0) return timestamp;
    const parsed = Date.parse(String(rawValue || ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function isCurrentPendingTransaction(transaction) {
    const timestamp = getTransactionTimestampMs(transaction);
    if (!timestamp) return true;
    return Date.now() - timestamp <= CURRENT_PENDING_MAX_AGE_MS;
  }

  function normalizeScalar(value) {
    if (typeof value === "string") return value.slice(0, 64);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    return null;
  }

  function sanitizeIdMap(map) {
    if (!map || typeof map !== "object" || Array.isArray(map)) return null;
    const output = {};
    Object.entries(map).slice(0, 200).forEach(([key, value]) => {
      const safeKey = String(key || "").trim().slice(0, 64);
      if (!safeKey) return;
      output[safeKey] = normalizeScalar(value);
    });
    return Object.keys(output).length ? output : null;
  }

  function sanitizeIdArray(values) {
    if (!Array.isArray(values)) return [];
    return Array.from(new Set(values.map(normalizeScalar).filter((value) => value !== null))).slice(0, 24);
  }

  function sanitizeDraftPick(pick) {
    if (!pick || typeof pick !== "object") return null;
    const sanitized = {
      season: normalizeScalar(pick.season),
      round: Number.isFinite(Number(pick.round)) ? Number(pick.round) : null,
      roster_id: normalizeScalar(pick.roster_id),
      previous_owner_id: normalizeScalar(pick.previous_owner_id),
      owner_id: normalizeScalar(pick.owner_id)
    };
    return Object.values(sanitized).some((value) => value !== null) ? sanitized : null;
  }

  function sanitizeWaiverBudget(value) {
    if (!Array.isArray(value)) return null;
    const sanitized = value.slice(0, 24).map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      return {
        sender: normalizeScalar(entry.sender),
        receiver: normalizeScalar(entry.receiver),
        amount: normalizeScalar(entry.amount)
      };
    }).filter(Boolean);
    return sanitized.length ? sanitized : null;
  }

  function sanitizeTransaction(transaction, leagueId) {
    if (!transaction || typeof transaction !== "object") return null;
    const type = String(transaction.type || "").toLowerCase();
    const status = String(transaction.status || "").toLowerCase();
    const transactionLeagueId = transaction.league_id ? String(transaction.league_id) : leagueId;
    if (
      !ALLOWED_TYPES.has(type) ||
      !ALLOWED_PENDING_STATUSES.has(status) ||
      transactionLeagueId !== leagueId ||
      !isCurrentPendingTransaction(transaction)
    ) {
      return null;
    }

    return {
      league_id: transactionLeagueId,
      transaction_id: normalizeScalar(transaction.transaction_id),
      type,
      status,
      created: normalizeScalar(transaction.created),
      status_updated: normalizeScalar(transaction.status_updated),
      roster_ids: sanitizeIdArray(transaction.roster_ids),
      consenter_ids: sanitizeIdArray(transaction.consenter_ids),
      creator: normalizeScalar(transaction.creator),
      adds: sanitizeIdMap(transaction.adds),
      drops: sanitizeIdMap(transaction.drops),
      draft_picks: Array.isArray(transaction.draft_picks)
        ? transaction.draft_picks.slice(0, 80).map(sanitizeDraftPick).filter(Boolean)
        : [],
      settings: transaction.settings && typeof transaction.settings === "object"
        ? { waiver_bid: normalizeScalar(transaction.settings.waiver_bid) }
        : null,
      waiver_budget: sanitizeWaiverBudget(transaction.waiver_budget),
      player_map: sanitizeIdMap(transaction.player_map)
    };
  }

  function inspectGraphqlPayload(payload) {
    if (!isLeagueActivityPage() || !payload || typeof payload !== "object") return;
    const transactions = payload?.data?.league_transactions_filtered;
    if (!Array.isArray(transactions)) return;

    const leagueId = getLeagueIdFromLocation();
    if (!leagueId) return;

    const sanitizedTransactions = transactions
      .map((transaction) => sanitizeTransaction(transaction, leagueId))
      .filter(Boolean);

    window.postMessage({
      source: PAGE_SOURCE,
      type: CAPTURE_TYPE,
      payload: {
        source: "chrome-extension",
        leagueId,
        capturedAt: Date.now(),
        transactions: sanitizedTransactions
      }
    }, window.location.origin);
  }

  const originalFetch = window.fetch;
  window.fetch = async function dynastyDegensSleeperFetch(input, init) {
    const response = await originalFetch.apply(this, arguments);
    try {
      const url = typeof input === "string" ? input : input?.url || "";
      if (isLeagueActivityPage() && String(url).includes("/graphql")) {
        response.clone().json().then(inspectGraphqlPayload).catch(() => {});
      }
    } catch {
      // Deliberately ignore capture failures so Sleeper behavior is unchanged.
    }
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function dynastyDegensSleeperOpen(method, url) {
    this.__dynastyDegensSleeperUrl = String(url || "");
    return originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function dynastyDegensSleeperSend() {
    try {
      this.addEventListener("loadend", function dynastyDegensSleeperXhrLoadEnd() {
        try {
          if (!isLeagueActivityPage() || !String(this.__dynastyDegensSleeperUrl || "").includes("/graphql")) return;
          inspectGraphqlPayload(JSON.parse(this.responseText || "null"));
        } catch {
          // Deliberately ignore capture failures so Sleeper behavior is unchanged.
        }
      });
    } catch {
      // Deliberately ignore capture failures so Sleeper behavior is unchanged.
    }
    return originalSend.apply(this, arguments);
  };
})();
