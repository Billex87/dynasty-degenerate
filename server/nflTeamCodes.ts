export const NFL_TEAM_CODES = [
  'ARI',
  'ATL',
  'BAL',
  'BUF',
  'CAR',
  'CHI',
  'CIN',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GB',
  'HOU',
  'IND',
  'JAX',
  'KC',
  'LAC',
  'LAR',
  'LV',
  'MIA',
  'MIN',
  'NE',
  'NO',
  'NYG',
  'NYJ',
  'PHI',
  'PIT',
  'SEA',
  'SF',
  'TB',
  'TEN',
  'WAS',
] as const;

export type NflTeamCode = typeof NFL_TEAM_CODES[number];

const NFL_TEAM_CODE_SET = new Set<string>(NFL_TEAM_CODES);

const TEAM_ALIASES: Record<string, NflTeamCode> = {
  ARZ: 'ARI',
  ARI: 'ARI',
  ATL: 'ATL',
  BAL: 'BAL',
  BLT: 'BAL',
  BUF: 'BUF',
  CAR: 'CAR',
  CHI: 'CHI',
  CIN: 'CIN',
  CLE: 'CLE',
  CLV: 'CLE',
  DAL: 'DAL',
  DEN: 'DEN',
  DET: 'DET',
  GB: 'GB',
  GBP: 'GB',
  GNB: 'GB',
  HOU: 'HOU',
  HST: 'HOU',
  IND: 'IND',
  JAC: 'JAX',
  JAX: 'JAX',
  KC: 'KC',
  KAN: 'KC',
  LAC: 'LAC',
  LAR: 'LAR',
  LA: 'LAR',
  LV: 'LV',
  LVR: 'LV',
  OAK: 'LV',
  MIA: 'MIA',
  MIN: 'MIN',
  NE: 'NE',
  NEP: 'NE',
  NWE: 'NE',
  NO: 'NO',
  NOR: 'NO',
  NYG: 'NYG',
  NYJ: 'NYJ',
  PHI: 'PHI',
  PIT: 'PIT',
  SD: 'LAC',
  SEA: 'SEA',
  SF: 'SF',
  SFO: 'SF',
  STL: 'LAR',
  TB: 'TB',
  TAM: 'TB',
  TEN: 'TEN',
  WAS: 'WAS',
  WSH: 'WAS',
  WFT: 'WAS',
};

const TEAM_NAME_ALIASES: Record<string, NflTeamCode> = {
  arizonacardinals: 'ARI',
  atlantafalcons: 'ATL',
  baltimoreravens: 'BAL',
  buffalobills: 'BUF',
  carolinapanthers: 'CAR',
  chicagobears: 'CHI',
  cincinnatibengals: 'CIN',
  clevelandbrowns: 'CLE',
  dallascowboys: 'DAL',
  denverbroncos: 'DEN',
  detroitlions: 'DET',
  greenbaypackers: 'GB',
  houstontexans: 'HOU',
  indianapoliscolts: 'IND',
  jacksonvillejaguars: 'JAX',
  kansascitychiefs: 'KC',
  losangeleschargers: 'LAC',
  lachargers: 'LAC',
  losangelesrams: 'LAR',
  larams: 'LAR',
  lasvegasraiders: 'LV',
  oaklandraiders: 'LV',
  miamidolphins: 'MIA',
  minnesotavikings: 'MIN',
  newenglandpatriots: 'NE',
  neworleanssaints: 'NO',
  newyorkgiants: 'NYG',
  newyorkjets: 'NYJ',
  philadelphiaeagles: 'PHI',
  pittsburghsteelers: 'PIT',
  sandiegochargers: 'LAC',
  seattleseahawks: 'SEA',
  sanfrancisco49ers: 'SF',
  tampaabaybuccaneers: 'TB',
  tampabaybuccaneers: 'TB',
  tennesseetitans: 'TEN',
  washingtoncommanders: 'WAS',
  washingtonfootballteam: 'WAS',
  washingtonredskins: 'WAS',
};

function compactTeamName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizeNflTeamCode(team?: unknown): NflTeamCode | null {
  const raw = String(team || '').trim();
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!upper || upper === 'FA' || upper === 'FREEAGENT') return null;
  const code = TEAM_ALIASES[upper];
  if (code) return code;
  if (NFL_TEAM_CODE_SET.has(upper)) return upper as NflTeamCode;
  return TEAM_NAME_ALIASES[compactTeamName(raw)] || null;
}

export function isKnownNflTeamCode(team?: unknown): team is NflTeamCode {
  return Boolean(normalizeNflTeamCode(team));
}
