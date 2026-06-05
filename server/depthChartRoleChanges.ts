export type DepthChartRoleChangeKind =
  | 'promoted-to-starter'
  | 'demoted-from-starter'
  | 'rank-improved'
  | 'rank-declined'
  | 'newly-listed'
  | 'removed'
  | 'slot-changed';

export type DepthChartRoleChangeDirection = 'boost' | 'risk' | 'neutral';

export type DepthChartRoleSnapshotRow = {
  playerId?: string | null;
  gsisId?: string | null;
  sleeperId?: string | null;
  name: string;
  team: string;
  position: string;
  rank?: number | string | null;
  slot?: string | null;
  week?: number | string | null;
  snapshotAt?: string | null;
  source?: string | null;
  sourceReliable?: boolean | null;
};

export type DepthChartRoleChangeSignal = {
  playerKey: string;
  playerName: string;
  team: string;
  position: string;
  kind: DepthChartRoleChangeKind;
  direction: DepthChartRoleChangeDirection;
  previousRank: number | null;
  currentRank: number | null;
  previousSlot: string | null;
  currentSlot: string | null;
  previousWeek: number | null;
  currentWeek: number | null;
  confidence: number;
  confidenceCapReason: string | null;
  missingEvidence: string[];
  sourceEvidence: string[];
  note: string;
};

type NormalizedDepthChartRow = {
  original: DepthChartRoleSnapshotRow;
  playerKey: string;
  matchQuality: 'provider-id' | 'name-team-position';
  playerName: string;
  team: string;
  position: string;
  rank: number | null;
  slot: string | null;
  week: number | null;
  snapshotAt: string | null;
  source: string | null;
  sourceReliable: boolean;
};

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function keyText(value: unknown): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeRank(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

function normalizeWeek(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isStarter(rank: number | null): boolean {
  return rank !== null && rank <= 1;
}

function roleLabel(slot: string | null, rank: number | null): string {
  if (slot) return `${slot}${rank ? ` rank ${rank}` : ''}`;
  if (rank) return `rank ${rank}`;
  return 'unranked';
}

function playerKey(row: DepthChartRoleSnapshotRow): { key: string; matchQuality: NormalizedDepthChartRow['matchQuality'] } | null {
  const providerId = cleanText(row.playerId) || cleanText(row.gsisId) || cleanText(row.sleeperId);
  const team = keyText(row.team);
  const position = keyText(row.position);
  if (providerId && team && position) {
    return { key: `id:${providerId}:${team}:${position}`, matchQuality: 'provider-id' };
  }

  const name = keyText(row.name);
  if (!name || !team || !position) return null;
  return { key: `name:${name}:${team}:${position}`, matchQuality: 'name-team-position' };
}

function normalizeRow(row: DepthChartRoleSnapshotRow): NormalizedDepthChartRow | null {
  const key = playerKey(row);
  const playerName = cleanText(row.name);
  const team = cleanText(row.team).toUpperCase();
  const position = cleanText(row.position).toUpperCase();
  if (!key || !playerName || !team || !position) return null;

  return {
    original: row,
    playerKey: key.key,
    matchQuality: key.matchQuality,
    playerName,
    team,
    position,
    rank: normalizeRank(row.rank),
    slot: cleanText(row.slot) || null,
    week: normalizeWeek(row.week),
    snapshotAt: cleanText(row.snapshotAt) || null,
    source: cleanText(row.source) || null,
    sourceReliable: row.sourceReliable === true,
  };
}

function indexRows(rows: DepthChartRoleSnapshotRow[]): Map<string, NormalizedDepthChartRow> {
  const indexed = new Map<string, NormalizedDepthChartRow>();
  for (const row of rows) {
    const normalized = normalizeRow(row);
    if (!normalized) continue;
    const existing = indexed.get(normalized.playerKey);
    if (!existing || (normalized.rank ?? 99) < (existing.rank ?? 99)) {
      indexed.set(normalized.playerKey, normalized);
    }
  }
  return indexed;
}

function getMissingEvidence(previous: NormalizedDepthChartRow | null, current: NormalizedDepthChartRow | null): string[] {
  const missing: string[] = [];
  if (!previous?.sourceReliable && !current?.sourceReliable) missing.push('reliable depth-chart source approval');
  if (!previous) missing.push('previous depth-chart row');
  if (!current) missing.push('current depth-chart row');
  if (previous && previous.rank === null) missing.push('previous depth-chart rank');
  if (current && current.rank === null) missing.push('current depth-chart rank');
  if ((previous || current)?.matchQuality === 'name-team-position') missing.push('provider player id');
  return missing;
}

function sourceEvidence(previous: NormalizedDepthChartRow | null, current: NormalizedDepthChartRow | null): string[] {
  return Array.from(new Set([
    previous?.source ? `previous:${previous.source}` : null,
    current?.source ? `current:${current.source}` : null,
    previous?.snapshotAt ? `previousAt:${previous.snapshotAt}` : null,
    current?.snapshotAt ? `currentAt:${current.snapshotAt}` : null,
  ].filter((item): item is string => Boolean(item))));
}

function confidenceFor(input: {
  kind: DepthChartRoleChangeKind;
  previous: NormalizedDepthChartRow | null;
  current: NormalizedDepthChartRow | null;
  missingEvidence: string[];
}): { confidence: number; confidenceCapReason: string | null } {
  const baseByKind: Record<DepthChartRoleChangeKind, number> = {
    'promoted-to-starter': 82,
    'demoted-from-starter': 82,
    'rank-improved': 74,
    'rank-declined': 74,
    'newly-listed': 64,
    removed: 64,
    'slot-changed': 58,
  };
  const nameMatchPenalty = (input.previous || input.current)?.matchQuality === 'name-team-position' ? 8 : 0;
  const reliable = input.previous?.sourceReliable || input.current?.sourceReliable;
  const rankMissing = input.missingEvidence.some((item) => /rank/.test(item));
  const cap = reliable
    ? rankMissing ? 66 : 86
    : 58;
  const confidence = clamp(baseByKind[input.kind] - nameMatchPenalty - input.missingEvidence.length * 3, 25, cap);
  const confidenceCapReason = reliable
    ? rankMissing ? 'Depth-chart rank evidence is incomplete.' : null
    : 'Reliable depth-chart source approval is missing.';
  return { confidence, confidenceCapReason };
}

function buildSignal(input: {
  kind: DepthChartRoleChangeKind;
  direction: DepthChartRoleChangeDirection;
  previous: NormalizedDepthChartRow | null;
  current: NormalizedDepthChartRow | null;
}): DepthChartRoleChangeSignal {
  const row = input.current || input.previous;
  if (!row) throw new Error('Depth-chart role-change signal requires at least one row.');
  const missingEvidence = getMissingEvidence(input.previous, input.current);
  const confidence = confidenceFor({ ...input, missingEvidence });
  const previousRole = roleLabel(input.previous?.slot ?? null, input.previous?.rank ?? null);
  const currentRole = roleLabel(input.current?.slot ?? null, input.current?.rank ?? null);

  return {
    playerKey: row.playerKey,
    playerName: row.playerName,
    team: row.team,
    position: row.position,
    kind: input.kind,
    direction: input.direction,
    previousRank: input.previous?.rank ?? null,
    currentRank: input.current?.rank ?? null,
    previousSlot: input.previous?.slot ?? null,
    currentSlot: input.current?.slot ?? null,
    previousWeek: input.previous?.week ?? null,
    currentWeek: input.current?.week ?? null,
    confidence: confidence.confidence,
    confidenceCapReason: confidence.confidenceCapReason,
    missingEvidence,
    sourceEvidence: sourceEvidence(input.previous, input.current),
    note: `${row.playerName} moved from ${previousRole} to ${currentRole}.`,
  };
}

function classifyMatched(previous: NormalizedDepthChartRow, current: NormalizedDepthChartRow): DepthChartRoleChangeSignal | null {
  if (previous.rank !== null && current.rank !== null) {
    if (!isStarter(previous.rank) && isStarter(current.rank)) {
      return buildSignal({ kind: 'promoted-to-starter', direction: 'boost', previous, current });
    }
    if (isStarter(previous.rank) && !isStarter(current.rank)) {
      return buildSignal({ kind: 'demoted-from-starter', direction: 'risk', previous, current });
    }
    if (current.rank < previous.rank) {
      return buildSignal({ kind: 'rank-improved', direction: 'boost', previous, current });
    }
    if (current.rank > previous.rank) {
      return buildSignal({ kind: 'rank-declined', direction: 'risk', previous, current });
    }
  }

  if ((previous.slot || '') !== (current.slot || '')) {
    return buildSignal({ kind: 'slot-changed', direction: 'neutral', previous, current });
  }

  return null;
}

export function buildDepthChartRoleChangeSignals(input: {
  previousRows: DepthChartRoleSnapshotRow[];
  currentRows: DepthChartRoleSnapshotRow[];
  includeNeutralSlotChanges?: boolean;
}): DepthChartRoleChangeSignal[] {
  const previous = indexRows(input.previousRows);
  const current = indexRows(input.currentRows);
  const signals: DepthChartRoleChangeSignal[] = [];

  for (const [key, currentRow] of Array.from(current.entries())) {
    const previousRow = previous.get(key) || null;
    if (!previousRow) {
      signals.push(buildSignal({ kind: 'newly-listed', direction: isStarter(currentRow.rank) ? 'boost' : 'neutral', previous: null, current: currentRow }));
      continue;
    }
    const signal = classifyMatched(previousRow, currentRow);
    if (signal && (signal.kind !== 'slot-changed' || input.includeNeutralSlotChanges)) signals.push(signal);
  }

  for (const [key, previousRow] of Array.from(previous.entries())) {
    if (current.has(key)) continue;
    signals.push(buildSignal({ kind: 'removed', direction: isStarter(previousRow.rank) ? 'risk' : 'neutral', previous: previousRow, current: null }));
  }

  return signals.sort((a, b) => b.confidence - a.confidence || a.playerName.localeCompare(b.playerName));
}
