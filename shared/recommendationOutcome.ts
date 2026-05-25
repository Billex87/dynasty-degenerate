export type RecommendationOutcomeStatus =
  | "pending"
  | "observed_completed"
  | "observed_partially_completed"
  | "observed_ignored"
  | "observed_contradicted"
  | "expired"
  | "unknown";

export type RecommendationExpectedActionType =
  | "add_player"
  | "drop_player"
  | "start_player"
  | "bench_player"
  | "swap_starter"
  | "drop_for_add"
  | "waiver_add"
  | "stream_player"
  | "hold"
  | "trade"
  | "unknown";

export type RecommendationPlayerRef = {
  id?: string | null;
  name?: string | null;
  position?: string | null;
  team?: string | null;
};

export type RecommendationExpectedAction = {
  type: RecommendationExpectedActionType;
  playerIn?: RecommendationPlayerRef | null;
  playerOut?: RecommendationPlayerRef | null;
  playersInvolved?: RecommendationPlayerRef[];
  expectedRosterChange?: string | null;
  expectedLineupChange?: string | null;
  deadline?: string | null;
  source?: string | null;
  reason?: string | null;
};

export type RecommendationOutcomeEvidence = {
  reason: string;
  playerId?: string | null;
  playerName?: string | null;
  before?: string | null;
  after?: string | null;
  detectedFrom: "roster_sync" | "lineup_sync" | "transaction_history" | "expiration" | "insufficient_data";
  details?: Record<string, unknown>;
};

export type RecommendationObservedOutcome = {
  status: RecommendationOutcomeStatus;
  observedAt?: string | null;
  confidence: number;
  evidence: RecommendationOutcomeEvidence;
};

export type RecommendationStateSnapshot = {
  manager?: string | null;
  rosterPlayerIds?: string[];
  starterPlayerIds?: string[];
  benchPlayerIds?: string[];
};

export type RecommendationTransactionFact = {
  type: "add" | "drop" | "trade";
  playerId?: string | null;
  playerName?: string | null;
  manager?: string | null;
  occurredAt?: string | null;
};

export type RecommendationOutcomeEvaluationInput = {
  expectedAction?: RecommendationExpectedAction | null;
  previousRosterState?: RecommendationStateSnapshot | null;
  currentRosterState?: RecommendationStateSnapshot | null;
  previousLineupState?: RecommendationStateSnapshot | null;
  currentLineupState?: RecommendationStateSnapshot | null;
  transactionHistory?: RecommendationTransactionFact[];
  now?: string | Date | null;
  expiresAt?: string | Date | null;
};

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value: unknown): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toIsoDate(value?: string | Date | null): string | null {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function isExpired(input: RecommendationOutcomeEvaluationInput): boolean {
  const expiresAt = toIsoDate(input.expiresAt || input.expectedAction?.deadline || null);
  if (!expiresAt) return false;
  const now = input.now ? new Date(input.now) : new Date();
  return Number.isFinite(now.getTime()) && now.getTime() > new Date(expiresAt).getTime();
}

function playerKeys(player?: RecommendationPlayerRef | null): string[] {
  return [
    cleanText(player?.id),
    normalizeKey(player?.id),
    normalizeKey(player?.name),
  ].filter(Boolean);
}

function hasResolvablePlayer(player?: RecommendationPlayerRef | null): boolean {
  return playerKeys(player).length > 0;
}

function missingPlayerIdentity(
  input: RecommendationOutcomeEvaluationInput,
  actionLabel: string
): RecommendationObservedOutcome {
  return observed(input, "unknown", 20, evidence({
    reason: `Expected ${actionLabel} action did not include a usable player identity.`,
    detectedFrom: "insufficient_data",
  }));
}

function hasPlayer(
  ids: string[] | undefined,
  player?: RecommendationPlayerRef | null
): boolean | null {
  if (!ids) return null;
  const keys = new Set(ids.map((id) => cleanText(id)).filter(Boolean));
  const normalized = new Set(ids.map(normalizeKey).filter(Boolean));
  return playerKeys(player).some((key) => keys.has(key) || normalized.has(key));
}

function transactionMatches(
  transaction: RecommendationTransactionFact,
  type: RecommendationTransactionFact["type"],
  player?: RecommendationPlayerRef | null,
): boolean {
  if (transaction.type !== type) return false;
  const transactionKeys = new Set([
    cleanText(transaction.playerId),
    normalizeKey(transaction.playerId),
    normalizeKey(transaction.playerName),
  ].filter(Boolean));
  return playerKeys(player).some((key) => transactionKeys.has(key));
}

function findTransaction(
  transactions: RecommendationTransactionFact[] | undefined,
  type: RecommendationTransactionFact["type"],
  player?: RecommendationPlayerRef | null,
): RecommendationTransactionFact | null {
  return (transactions || []).find((transaction) =>
    transactionMatches(transaction, type, player)
  ) || null;
}

function findAlternateTransaction(
  transactions: RecommendationTransactionFact[] | undefined,
  type: RecommendationTransactionFact["type"],
  expectedPlayer?: RecommendationPlayerRef | null,
): RecommendationTransactionFact | null {
  return (transactions || []).find((transaction) =>
    transaction.type === type && !transactionMatches(transaction, type, expectedPlayer)
  ) || null;
}

function evidence(input: {
  reason: string;
  player?: RecommendationPlayerRef | null;
  before?: string | null;
  after?: string | null;
  detectedFrom: RecommendationOutcomeEvidence["detectedFrom"];
  details?: Record<string, unknown>;
}): RecommendationOutcomeEvidence {
  return {
    reason: input.reason,
    playerId: input.player?.id || null,
    playerName: input.player?.name || null,
    before: input.before || null,
    after: input.after || null,
    detectedFrom: input.detectedFrom,
    details: input.details,
  };
}

function observed(
  input: RecommendationOutcomeEvaluationInput,
  status: RecommendationOutcomeStatus,
  confidence: number,
  outcomeEvidence: RecommendationOutcomeEvidence
): RecommendationObservedOutcome {
  return {
    status,
    observedAt: toIsoDate(input.now) || new Date().toISOString(),
    confidence,
    evidence: outcomeEvidence,
  };
}

function pending(
  input: RecommendationOutcomeEvaluationInput,
  reason = "No matching roster, lineup, waiver, or transaction change was available yet."
): RecommendationObservedOutcome {
  return observed(input, "pending", 35, evidence({
    reason,
    detectedFrom: "insufficient_data",
  }));
}

function expiredOutcome(
  input: RecommendationOutcomeEvaluationInput,
  reason = "Recommendation expired before a matching observable change was detected."
): RecommendationObservedOutcome {
  return observed(input, "expired", 68, evidence({
    reason,
    detectedFrom: "expiration",
  }));
}

function rosterHasCurrent(
  input: RecommendationOutcomeEvaluationInput,
  player?: RecommendationPlayerRef | null
): boolean | null {
  return hasPlayer(input.currentRosterState?.rosterPlayerIds, player);
}

function rosterHadPrevious(
  input: RecommendationOutcomeEvaluationInput,
  player?: RecommendationPlayerRef | null
): boolean | null {
  return hasPlayer(input.previousRosterState?.rosterPlayerIds, player);
}

function starterHasCurrent(
  input: RecommendationOutcomeEvaluationInput,
  player?: RecommendationPlayerRef | null
): boolean | null {
  return hasPlayer(input.currentLineupState?.starterPlayerIds || input.currentRosterState?.starterPlayerIds, player);
}

function starterHadPrevious(
  input: RecommendationOutcomeEvaluationInput,
  player?: RecommendationPlayerRef | null
): boolean | null {
  return hasPlayer(input.previousLineupState?.starterPlayerIds || input.previousRosterState?.starterPlayerIds, player);
}

function evaluateAdd(
  input: RecommendationOutcomeEvaluationInput,
  player: RecommendationPlayerRef | null | undefined
): RecommendationObservedOutcome {
  if (!hasResolvablePlayer(player)) return missingPlayerIdentity(input, "add");

  const add = findTransaction(input.transactionHistory, "add", player);
  if (add) {
    return observed(input, "observed_completed", 92, evidence({
      reason: "Recommended player was added to roster",
      player,
      before: "not_on_roster",
      after: "on_roster",
      detectedFrom: "transaction_history",
      details: { occurredAt: add.occurredAt || null, manager: add.manager || null },
    }));
  }
  const drop = findTransaction(input.transactionHistory, "drop", player);
  if (drop) {
    return observed(input, "observed_contradicted", 88, evidence({
      reason: "Recommended player was dropped instead of added",
      player,
      before: "on_roster",
      after: "not_on_roster",
      detectedFrom: "transaction_history",
      details: { occurredAt: drop.occurredAt || null, manager: drop.manager || null },
    }));
  }

  const before = rosterHadPrevious(input, player);
  const after = rosterHasCurrent(input, player);
  if (before === false && after === true) {
    return observed(input, "observed_completed", 78, evidence({
      reason: "Recommended player appeared on roster after sync",
      player,
      before: "not_on_roster",
      after: "on_roster",
      detectedFrom: "roster_sync",
    }));
  }
  if (before === true && after === true) {
    return observed(input, "unknown", 36, evidence({
      reason: "Recommended add player was already on the roster before the observation window",
      player,
      before: "on_roster",
      after: "on_roster",
      detectedFrom: "roster_sync",
    }));
  }
  if (after === true) {
    return observed(input, "unknown", 40, evidence({
      reason: "Recommended player is on the current roster, but the prior roster snapshot was incomplete",
      player,
      before: "unknown",
      after: "on_roster",
      detectedFrom: "roster_sync",
    }));
  }
  if (before === true && after === false) {
    return observed(input, "observed_contradicted", 64, evidence({
      reason: "Recommended add player left the roster after sync",
      player,
      before: "on_roster",
      after: "not_on_roster",
      detectedFrom: "roster_sync",
    }));
  }

  if (isExpired(input)) {
    return observed(input, "observed_ignored", 72, evidence({
      reason: "Recommendation expired and the player was not added",
      player,
      before: before === true ? "on_roster" : before === false ? "not_on_roster" : "unknown",
      after: after === false ? "not_on_roster" : "unknown",
      detectedFrom: after === null ? "expiration" : "roster_sync",
    }));
  }

  return pending(input);
}

function evaluateDrop(
  input: RecommendationOutcomeEvaluationInput,
  player: RecommendationPlayerRef | null | undefined
): RecommendationObservedOutcome {
  if (!hasResolvablePlayer(player)) return missingPlayerIdentity(input, "drop");

  const drop = findTransaction(input.transactionHistory, "drop", player);
  if (drop) {
    return observed(input, "observed_completed", 92, evidence({
      reason: "Recommended drop player left the roster",
      player,
      before: "on_roster",
      after: "not_on_roster",
      detectedFrom: "transaction_history",
      details: { occurredAt: drop.occurredAt || null, manager: drop.manager || null },
    }));
  }
  const add = findTransaction(input.transactionHistory, "add", player);
  if (add) {
    return observed(input, "observed_contradicted", 88, evidence({
      reason: "Recommended drop player was added instead of removed",
      player,
      before: "not_on_roster",
      after: "on_roster",
      detectedFrom: "transaction_history",
      details: { occurredAt: add.occurredAt || null, manager: add.manager || null },
    }));
  }

  const before = rosterHadPrevious(input, player);
  const after = rosterHasCurrent(input, player);
  if (before === true && after === false) {
    return observed(input, "observed_completed", 78, evidence({
      reason: "Recommended drop player is no longer on the roster after sync",
      player,
      before: "on_roster",
      after: "not_on_roster",
      detectedFrom: "roster_sync",
    }));
  }
  if (before === false && after === false) {
    return observed(input, "unknown", 36, evidence({
      reason: "Recommended drop player was already off the roster before the observation window",
      player,
      before: "not_on_roster",
      after: "not_on_roster",
      detectedFrom: "roster_sync",
    }));
  }
  if (before === null && after === false) {
    return observed(input, "unknown", 40, evidence({
      reason: "Recommended drop player is absent from the current roster, but the prior roster snapshot was incomplete",
      player,
      before: "unknown",
      after: "not_on_roster",
      detectedFrom: "roster_sync",
    }));
  }
  if (before === false && after === true) {
    return observed(input, "observed_contradicted", 64, evidence({
      reason: "Recommended drop player appeared on roster after sync",
      player,
      before: "not_on_roster",
      after: "on_roster",
      detectedFrom: "roster_sync",
    }));
  }

  if (isExpired(input) && after === true) {
    return observed(input, "observed_ignored", 72, evidence({
      reason: "Recommendation expired and the drop player stayed on the roster",
      player,
      before: before === false ? "not_on_roster" : "on_roster",
      after: "on_roster",
      detectedFrom: "roster_sync",
    }));
  }

  return isExpired(input) ? expiredOutcome(input) : pending(input);
}

function evaluateStart(
  input: RecommendationOutcomeEvaluationInput,
  player: RecommendationPlayerRef | null | undefined
): RecommendationObservedOutcome {
  if (!hasResolvablePlayer(player)) return missingPlayerIdentity(input, "start");

  const before = starterHadPrevious(input, player);
  const after = starterHasCurrent(input, player);
  if (after === true) {
    const alreadyStarted = before === true;
    return observed(input, "observed_completed", alreadyStarted ? 58 : 86, evidence({
      reason: alreadyStarted
        ? "Recommended player was already in a starting lineup slot before the observation window"
        : "Recommended player is in a starting lineup slot",
      player,
      before: before === false ? "bench_or_not_started" : before === true ? "starter" : "unknown",
      after: "starter",
      detectedFrom: "lineup_sync",
    }));
  }

  if (isExpired(input) && after === false) {
    if (before === true) {
      return observed(input, "observed_contradicted", 72, evidence({
        reason: "Recommendation expired and the player moved out of the starting lineup",
        player,
        before: "starter",
        after: "bench_or_not_started",
        detectedFrom: "lineup_sync",
      }));
    }
    return observed(input, "observed_ignored", 76, evidence({
      reason: "Recommendation expired and the player was not started",
      player,
      before: before === false ? "bench_or_not_started" : "unknown",
      after: "bench_or_not_started",
      detectedFrom: "lineup_sync",
    }));
  }

  return isExpired(input) ? expiredOutcome(input) : pending(input);
}

function evaluateBench(
  input: RecommendationOutcomeEvaluationInput,
  player: RecommendationPlayerRef | null | undefined
): RecommendationObservedOutcome {
  if (!hasResolvablePlayer(player)) return missingPlayerIdentity(input, "bench");

  const before = starterHadPrevious(input, player);
  const after = starterHasCurrent(input, player);
  if (before === true && after === false) {
    return observed(input, "observed_completed", 86, evidence({
      reason: "Recommended bench player moved from starter to bench",
      player,
      before: "starter",
      after: "bench_or_not_started",
      detectedFrom: "lineup_sync",
    }));
  }
  if (after === false) {
    const alreadyBenched = before === false;
    return observed(input, "observed_completed", alreadyBenched ? 58 : 68, evidence({
      reason: alreadyBenched
        ? "Recommended bench player was already out of the starting lineup before the observation window"
        : "Recommended bench player is not in the current starting lineup",
      player,
      before: before === null ? "unknown" : "bench_or_not_started",
      after: "bench_or_not_started",
      detectedFrom: "lineup_sync",
    }));
  }
  if (isExpired(input) && after === true) {
    if (before === false) {
      return observed(input, "observed_contradicted", 72, evidence({
        reason: "Recommendation expired and the bench candidate moved into the starting lineup",
        player,
        before: "bench_or_not_started",
        after: "starter",
        detectedFrom: "lineup_sync",
      }));
    }
    return observed(input, "observed_ignored", 76, evidence({
      reason: "Recommendation expired and the player stayed in the starting lineup",
      player,
      before: before === true ? "starter" : "unknown",
      after: "starter",
      detectedFrom: "lineup_sync",
    }));
  }

  return isExpired(input) ? expiredOutcome(input) : pending(input);
}

function evaluateSwap(input: RecommendationOutcomeEvaluationInput): RecommendationObservedOutcome {
  const startPlayer = input.expectedAction?.playerIn;
  const benchPlayer = input.expectedAction?.playerOut;
  const startAfter = starterHasCurrent(input, startPlayer);
  const benchAfter = starterHasCurrent(input, benchPlayer);
  const started = startAfter === true;
  const benched = benchAfter === false;

  if (started && benched) {
    return observed(input, "observed_completed", 90, evidence({
      reason: "Recommended starter swap was fully reflected in the lineup",
      player: startPlayer,
      before: "swap_not_confirmed",
      after: "recommended_start_player_starting_and_bench_player_benched",
      detectedFrom: "lineup_sync",
      details: { benchedPlayerId: benchPlayer?.id || null, benchedPlayerName: benchPlayer?.name || null },
    }));
  }

  if (started || benched) {
    return observed(input, "observed_partially_completed", 74, evidence({
      reason: "Only one side of the recommended starter swap was observed",
      player: startPlayer,
      before: "swap_not_confirmed",
      after: started ? "start_player_starting_only" : "bench_player_benched_only",
      detectedFrom: "lineup_sync",
      details: { benchedPlayerId: benchPlayer?.id || null, benchedPlayerName: benchPlayer?.name || null },
    }));
  }

  if (isExpired(input) && startAfter === false && benchAfter === true) {
    return observed(input, "observed_ignored", 80, evidence({
      reason: "Recommendation expired and the previous starter stayed in over the recommended player",
      player: startPlayer,
      before: "recommended_swap",
      after: "original_starter_kept",
      detectedFrom: "lineup_sync",
      details: { keptStarterId: benchPlayer?.id || null, keptStarterName: benchPlayer?.name || null },
    }));
  }

  return isExpired(input) ? expiredOutcome(input) : pending(input);
}

function evaluateDropForAdd(input: RecommendationOutcomeEvaluationInput): RecommendationObservedOutcome {
  const add = evaluateAdd(input, input.expectedAction?.playerIn);
  const drop = evaluateDrop(input, input.expectedAction?.playerOut);
  const addDone = add.status === "observed_completed";
  const dropDone = drop.status === "observed_completed";

  if (addDone && dropDone) {
    return observed(input, "observed_completed", Math.min(add.confidence, drop.confidence), evidence({
      reason: "Recommended add and drop were both observed",
      player: input.expectedAction?.playerIn,
      before: "not_on_roster",
      after: "added_and_drop_completed",
      detectedFrom: add.evidence.detectedFrom === "transaction_history" || drop.evidence.detectedFrom === "transaction_history"
        ? "transaction_history"
        : "roster_sync",
      details: {
        droppedPlayerId: input.expectedAction?.playerOut?.id || null,
        droppedPlayerName: input.expectedAction?.playerOut?.name || null,
        addEvidence: add.evidence.reason,
        dropEvidence: drop.evidence.reason,
      },
    }));
  }

  if (addDone || dropDone) {
    const alternateAdd = !addDone
      ? findAlternateTransaction(input.transactionHistory, "add", input.expectedAction?.playerIn)
      : null;
    return observed(input, "observed_partially_completed", 76, evidence({
      reason: "Only part of the recommended add/drop move was observed",
      player: input.expectedAction?.playerIn,
      before: "partial_move_pending",
      after: addDone ? "recommended_add_completed_without_expected_drop" : "expected_drop_completed_without_recommended_add",
      detectedFrom: addDone ? add.evidence.detectedFrom : drop.evidence.detectedFrom,
      details: {
        droppedPlayerId: input.expectedAction?.playerOut?.id || null,
        droppedPlayerName: input.expectedAction?.playerOut?.name || null,
        addEvidence: add.evidence.reason,
        dropEvidence: drop.evidence.reason,
        alternateAddPlayerId: alternateAdd?.playerId || null,
        alternateAddPlayerName: alternateAdd?.playerName || null,
        alternateAddOccurredAt: alternateAdd?.occurredAt || null,
      },
    }));
  }

  if (isExpired(input)) {
    return observed(input, "observed_ignored", 70, evidence({
      reason: "Recommendation expired and neither the expected add nor expected drop was observed",
      player: input.expectedAction?.playerIn,
      before: "recommended_add_drop",
      after: "no_expected_move_detected",
      detectedFrom: "expiration",
      details: {
        droppedPlayerId: input.expectedAction?.playerOut?.id || null,
        droppedPlayerName: input.expectedAction?.playerOut?.name || null,
      },
    }));
  }

  return pending(input);
}

export function evaluateRecommendationOutcome(
  input: RecommendationOutcomeEvaluationInput
): RecommendationObservedOutcome {
  const action = input.expectedAction;
  if (!action) {
    return observed(input, "unknown", 20, evidence({
      reason: "No structured expected action was attached to this recommendation.",
      detectedFrom: "insufficient_data",
    }));
  }

  if (action.type === "add_player" || action.type === "waiver_add" || action.type === "stream_player") {
    return evaluateAdd(input, action.playerIn);
  }
  if (action.type === "drop_player") {
    return evaluateDrop(input, action.playerOut || action.playerIn);
  }
  if (action.type === "drop_for_add") {
    return evaluateDropForAdd(input);
  }
  if (action.type === "start_player") {
    return evaluateStart(input, action.playerIn);
  }
  if (action.type === "bench_player") {
    return evaluateBench(input, action.playerOut || action.playerIn);
  }
  if (action.type === "swap_starter") {
    return evaluateSwap(input);
  }

  return isExpired(input)
    ? expiredOutcome(input)
    : observed(input, "unknown", 25, evidence({
      reason: `No passive inference rule is available for ${action.type}.`,
      detectedFrom: "insufficient_data",
    }));
}
