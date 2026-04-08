interface KTCValues {
  [key: string]: { name: string; ktc_value: number };
}

interface Player {
  [key: string]: {
    first_name?: string;
    last_name?: string;
    position?: string;
    age?: number;
  };
}

export function cleanName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
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
  const p = allPlayers[pid];
  if (!p) return 0;

  const fullName = `${p.first_name || ''}${p.last_name || ''}`;
  const key = cleanName(fullName);
  let val = ktcValues[key]?.ktc_value || 0;

  if (val === 0) {
    // Fuzzy match
    for (const k in ktcValues) {
      if (key.includes(k) || k.includes(key)) {
        return ktcValues[k].ktc_value;
      }
    }
    return 0; // Return 0 if not found (will be filtered out in weekly momentum)
  }

  return val;
}

export function getPickValue(
  season: number,
  roundNum: number,
  ktcValues: KTCValues
): number {
  const suffix =
    roundNum === 1 ? 'st' : roundNum === 2 ? 'nd' : roundNum === 3 ? 'rd' : 'th';
  const key = cleanName(`${season}mid${roundNum}${suffix}`);
  let val = ktcValues[key]?.ktc_value || 0;

  if (val === 0) {
    const baseVals: Record<number, number> = {
      1: 4500,
      2: 1800,
      3: 600,
      4: 250,
      5: 100,
    };
    return baseVals[roundNum] || 50;
  }

  return val;
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
