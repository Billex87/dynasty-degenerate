interface KTCValues {
  [key: string]: {
    name: string;
    ktc_value: number;
    redraft_value?: number;
    true_value?: number;
    dynasty_value?: number;
    market_value_ktc?: number;
    expert_value_flock?: number;
    expert_value_dynastynerds?: number;
    expert_value_fantasynerds?: number;
    benchmark_value_dynastydealer?: number;
    value_sources?: string[];
    benchmark_sources?: string[];
  };
}

type KtcValue = KTCValues[string];
type ValueField = 'ktc_value' | 'redraft_value' | 'true_value' | 'dynasty_value' | 'market_value_ktc';
type ValueFieldLookup = Map<string, { value: KtcValue; score: number }>;

interface Player {
  [key: string]: {
    first_name?: string;
    last_name?: string;
    position?: string;
    age?: number;
  };
}

const valueFieldLookupCache = new WeakMap<KTCValues, Partial<Record<ValueField, ValueFieldLookup>>>();
const PLAYER_NAME_ALIAS_GROUPS = [
  ['chigoziemokonkwo', 'chigokonkwo'],
  ['zonovanknight', 'bamknight'],
  ['gabrieldavis', 'gabedavis'],
  ['marquisebrown', 'hollywoodbrown'],
  ['nicholassingleton', 'nicksingleton'],
] as const;
const PLAYER_NAME_CANONICAL_ALIAS_BY_KEY: Map<string, string> = new Map(
  PLAYER_NAME_ALIAS_GROUPS.flatMap((group) => group.map((key) => [key, group[0]] as const))
);
const PLAYER_NAME_ALIASES_BY_KEY: Map<string, readonly string[]> = new Map(
  PLAYER_NAME_ALIAS_GROUPS.flatMap((group) => group.map((key) => [key, group] as const))
);

export function cleanName(name: string): string {
  return name
    .replace(/\(\s*duplicate\s*\)/gi, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

export function stripPlayerNameSuffixKey(key: string): string {
  return key.replace(/(jr|sr|ii|iii|iv|v)$/i, '');
}

export function canonicalPlayerNameKey(name: string): string {
  const suffixlessKey = stripPlayerNameSuffixKey(cleanName(name));
  return PLAYER_NAME_CANONICAL_ALIAS_BY_KEY.get(suffixlessKey) || suffixlessKey;
}

export function playerNameKeyVariants(name: string): string[] {
  const key = cleanName(name);
  const canonicalKey = stripPlayerNameSuffixKey(key);
  const aliasKeys = PLAYER_NAME_ALIASES_BY_KEY.get(canonicalKey) || [];
  return Array.from(new Set([key, canonicalKey, canonicalPlayerNameKey(name), ...aliasKeys].filter(Boolean)));
}

export function playerNameKeysMatch(left: string, right: string): boolean {
  const leftVariants = playerNameKeyVariants(left).map(cleanName).filter(Boolean);
  const rightVariants = playerNameKeyVariants(right).map(cleanName).filter(Boolean);
  return leftVariants.some((variant) => rightVariants.includes(variant));
}

function getValueFieldLookup(ktcValues: KTCValues, field: ValueField): ValueFieldLookup {
  let fieldLookups = valueFieldLookupCache.get(ktcValues);
  if (!fieldLookups) {
    fieldLookups = {};
    valueFieldLookupCache.set(ktcValues, fieldLookups);
  }

  const cached = fieldLookups[field];
  if (cached) return cached;

  const lookup: ValueFieldLookup = new Map();
  for (const [candidateKey, candidateValue] of Object.entries(ktcValues)) {
    const sourceScore = (candidateValue.value_sources?.length || 0) * 100000;
    const fieldValue = Number(candidateValue[field] || 0);
    const score = sourceScore + fieldValue;

    for (const variant of playerNameKeyVariants(candidateKey).map(cleanName).filter(Boolean)) {
      const current = lookup.get(variant);
      if (!current || score > current.score) {
        lookup.set(variant, { value: candidateValue, score });
      }
    }
  }

  fieldLookups[field] = lookup;
  return lookup;
}

export function getPlayerName(pid: string, allPlayers: Player): string {
  const p = allPlayers[pid];
  if (!p) return `Unknown (${pid})`;
  return `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

export function getPlayerValue(
  pid: string,
  allPlayers: Player,
  ktcValues: KTCValues
): number {
  return getPlayerValueField(pid, allPlayers, ktcValues, 'ktc_value');
}

export function getPlayerKtcMarketValue(
  pid: string,
  allPlayers: Player,
  ktcValues: KTCValues
): number {
  return getPlayerValueField(pid, allPlayers, ktcValues, 'market_value_ktc') || getPlayerValue(pid, allPlayers, ktcValues);
}

export function getPlayerRedraftValue(
  pid: string,
  allPlayers: Player,
  ktcValues: KTCValues
): number {
  return getPlayerValueField(pid, allPlayers, ktcValues, 'redraft_value') || getPlayerValue(pid, allPlayers, ktcValues);
}

export function getPlayerRedraftOnlyValue(
  pid: string,
  allPlayers: Player,
  ktcValues: KTCValues
): number {
  return getPlayerValueField(pid, allPlayers, ktcValues, 'redraft_value');
}

export function getPlayerTrueValue(
  pid: string,
  allPlayers: Player,
  ktcValues: KTCValues
): number {
  return getPlayerValueField(pid, allPlayers, ktcValues, 'true_value') || getPlayerValue(pid, allPlayers, ktcValues);
}

function getPlayerValueField(
  pid: string,
  allPlayers: Player,
  ktcValues: KTCValues,
  field: ValueField
): number {
  const p = allPlayers[pid];
  if (!p) return 0;

  const fullName = `${p.first_name || ''}${p.last_name || ''}`;
  const key = cleanName(fullName);
  const variants = Array.from(new Set(playerNameKeyVariants(key)));

  for (const variant of variants) {
    const exactValue = ktcValues[variant]?.[field];
    if (exactValue) return exactValue;
  }

  const lookup = getValueFieldLookup(ktcValues, field);
  const match = variants
    .map((variant) => lookup.get(cleanName(variant)))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => b.score - a.score)[0];

  return match?.value?.[field] || 0; // Return 0 if not found (will be filtered out in weekly momentum)
}

export function getPickValue(
  season: number,
  roundNum: number,
  ktcValues: KTCValues,
  draftSlot?: number,
  totalTeams?: number
): number {
  const suffix =
    roundNum === 1 ? 'st' : roundNum === 2 ? 'nd' : roundNum === 3 ? 'rd' : 'th';
  const bucket = getPickValueBucket(draftSlot, totalTeams);
  const key = cleanName(`${season}${bucket}${roundNum}${suffix}`);
  let val = ktcValues[key]?.ktc_value || 0;

  if (val === 0) {
    const baseVals: Record<string, Record<number, number>> = {
      early: {
        1: 5800,
        2: 3300,
        3: 2350,
        4: 1800,
        5: 100,
      },
      mid: {
        1: 4500,
        2: 1800,
        3: 600,
        4: 250,
        5: 100,
      },
      late: {
        1: 3900,
        2: 1600,
        3: 500,
        4: 200,
        5: 100,
      },
    };
    return baseVals[bucket]?.[roundNum] || baseVals.mid[roundNum] || 50;
  }

  return val;
}

function getPickValueBucket(draftSlot?: number, totalTeams?: number): 'early' | 'mid' | 'late' {
  if (!draftSlot || !totalTeams || totalTeams < 3) return 'mid';

  const earlyMax = Math.floor(totalTeams / 3);
  const midMax = Math.floor((totalTeams * 2) / 3);

  if (draftSlot <= earlyMax) return 'early';
  if (draftSlot <= midMax) return 'mid';
  return 'late';
}

export function projectValue(
  currentVal: number,
  pos: string,
  age: number | null,
  yearsOut: number
): number {
  if (!age) return currentVal;

  const futureAge = age + yearsOut;
  let multiplier = 1.0;

  if (pos === 'RB') {
    if (futureAge >= 26) {
      multiplier = Math.pow(0.7, futureAge - 25);
    } else if (age <= 23) {
      multiplier = Math.pow(1.2, yearsOut);
    }
  } else if (pos === 'WR') {
    if (futureAge >= 30) {
      multiplier = Math.pow(0.8, futureAge - 29);
    } else if (age <= 23) {
      multiplier = Math.pow(1.15, yearsOut);
    }
  } else if (pos === 'QB') {
    if (futureAge >= 35) {
      multiplier = Math.pow(0.85, futureAge - 34);
    } else if (age <= 24) {
      multiplier = Math.pow(1.1, yearsOut);
    }
  } else if (pos === 'TE') {
    if (futureAge >= 32) {
      multiplier = Math.pow(0.8, futureAge - 31);
    } else if (age <= 24) {
      multiplier = Math.pow(1.1, yearsOut);
    }
  }

  return Math.floor(currentVal * multiplier);
}

export function calculateValueAdjustment(
  sideValues: number[],
  otherSideValues: number[]
): number {
  if (!sideValues.length || !otherSideValues.length) return 0;

  const allVals = [...sideValues, ...otherSideValues];
  const bestPlayerVal = Math.max(...allVals);

  if (
    sideValues.includes(bestPlayerVal) &&
    sideValues.length < otherSideValues.length
  ) {
    const diff = otherSideValues.length - sideValues.length;
    const avgPkgVal =
      otherSideValues.reduce((a, b) => a + b, 0) / otherSideValues.length;
    return Math.floor(avgPkgVal * 0.25 * diff);
  }

  return 0;
}
