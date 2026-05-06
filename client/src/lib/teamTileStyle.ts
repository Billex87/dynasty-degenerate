import type { CSSProperties } from 'react';

export const NFL_TEAM_COLORS: Record<string, { primary: string; secondary: string; accent: string }> = {
  ARI: { primary: '#97233F', secondary: '#000000', accent: '#FFB612' },
  ATL: { primary: '#A71930', secondary: '#000000', accent: '#A5ACAF' },
  BAL: { primary: '#241773', secondary: '#000000', accent: '#9E7C0C' },
  BUF: { primary: '#00338D', secondary: '#C60C30', accent: '#FFFFFF' },
  CAR: { primary: '#0085CA', secondary: '#101820', accent: '#BFC0BF' },
  CHI: { primary: '#0B162A', secondary: '#C83803', accent: '#FFFFFF' },
  CIN: { primary: '#FB4F14', secondary: '#000000', accent: '#FFFFFF' },
  CLE: { primary: '#311D00', secondary: '#FF3C00', accent: '#FFFFFF' },
  DAL: { primary: '#003594', secondary: '#041E42', accent: '#869397' },
  DEN: { primary: '#FB4F14', secondary: '#002244', accent: '#FFFFFF' },
  DET: { primary: '#0076B6', secondary: '#B0B7BC', accent: '#7fd8ff' },
  GB: { primary: '#203731', secondary: '#FFB612', accent: '#FFFFFF' },
  HOU: { primary: '#03202F', secondary: '#A71930', accent: '#FFFFFF' },
  IND: { primary: '#002C5F', secondary: '#A2AAAD', accent: '#FFFFFF' },
  JAX: { primary: '#006778', secondary: '#101820', accent: '#D7A22A' },
  KC: { primary: '#E31837', secondary: '#FFB81C', accent: '#FFFFFF' },
  LAC: { primary: '#0080C6', secondary: '#FFC20E', accent: '#FFFFFF' },
  LAR: { primary: '#003594', secondary: '#FFA300', accent: '#FFFFFF' },
  LV: { primary: '#000000', secondary: '#A5ACAF', accent: '#FFFFFF' },
  MIA: { primary: '#008E97', secondary: '#FC4C02', accent: '#FFFFFF' },
  MIN: { primary: '#4F2683', secondary: '#FFC62F', accent: '#FFFFFF' },
  NE: { primary: '#002244', secondary: '#C60C30', accent: '#B0B7BC' },
  NO: { primary: '#101820', secondary: '#D3BC8D', accent: '#FFFFFF' },
  NYG: { primary: '#0B2265', secondary: '#A71930', accent: '#FFFFFF' },
  NYJ: { primary: '#125740', secondary: '#000000', accent: '#FFFFFF' },
  PHI: { primary: '#004C54', secondary: '#A5ACAF', accent: '#FFFFFF' },
  PIT: { primary: '#101820', secondary: '#FFB612', accent: '#FFFFFF' },
  SEA: { primary: '#002244', secondary: '#69BE28', accent: '#A5ACAF' },
  SF: { primary: '#AA0000', secondary: '#B3995D', accent: '#FFFFFF' },
  TB: { primary: '#D50A0A', secondary: '#34302B', accent: '#FF7900' },
  TEN: { primary: '#0C2340', secondary: '#4B92DB', accent: '#C8102E' },
  WAS: { primary: '#5A1414', secondary: '#FFB612', accent: '#FFFFFF' },
};

export const COLLEGE_TEAM_COLORS: Record<string, { primary: string; secondary: string; accent: string }> = {
  ALABAMA: { primary: '#9E1B32', secondary: '#0A0A0A', accent: '#FFFFFF' },
  ARIZONA: { primary: '#AB0520', secondary: '#0C234B', accent: '#FFFFFF' },
  'ARIZONA STATE': { primary: '#8C1D40', secondary: '#FFC627', accent: '#FFFFFF' },
  ARKANSAS: { primary: '#9D2235', secondary: '#000000', accent: '#FFFFFF' },
  AUBURN: { primary: '#0C2340', secondary: '#E87722', accent: '#FFFFFF' },
  BAYLOR: { primary: '#154734', secondary: '#FFB81C', accent: '#FFFFFF' },
  CLEMSON: { primary: '#F56600', secondary: '#522D80', accent: '#FFFFFF' },
  COLORADO: { primary: '#CFB87C', secondary: '#000000', accent: '#FFFFFF' },
  DUKE: { primary: '#003087', secondary: '#001A57', accent: '#FFFFFF' },
  FLORIDA: { primary: '#0021A5', secondary: '#FA4616', accent: '#FFFFFF' },
  'FLORIDA STATE': { primary: '#782F40', secondary: '#CEB888', accent: '#FFFFFF' },
  GEORGIA: { primary: '#BA0C2F', secondary: '#000000', accent: '#FFFFFF' },
  ILLINOIS: { primary: '#13294B', secondary: '#FF5F05', accent: '#FFFFFF' },
  INDIANA: { primary: '#990000', secondary: '#111111', accent: '#FFFFFF' },
  IOWA: { primary: '#FFCD00', secondary: '#000000', accent: '#FFFFFF' },
  KANSAS: { primary: '#0051BA', secondary: '#E8000D', accent: '#FFFFFF' },
  KENTUCKY: { primary: '#0033A0', secondary: '#111111', accent: '#FFFFFF' },
  LSU: { primary: '#461D7C', secondary: '#FDD023', accent: '#FFFFFF' },
  LOUISVILLE: { primary: '#AD0000', secondary: '#000000', accent: '#FFFFFF' },
  MIAMI: { primary: '#F47321', secondary: '#005030', accent: '#FFFFFF' },
  MICHIGAN: { primary: '#00274C', secondary: '#FFCB05', accent: '#FFFFFF' },
  'MICHIGAN STATE': { primary: '#18453B', secondary: '#0B0B0B', accent: '#FFFFFF' },
  MINNESOTA: { primary: '#7A0019', secondary: '#FFCC33', accent: '#FFFFFF' },
  MISSISSIPPI: { primary: '#CE1126', secondary: '#14213D', accent: '#FFFFFF' },
  'MISSISSIPPI STATE': { primary: '#660000', secondary: '#111111', accent: '#FFFFFF' },
  MISSOURI: { primary: '#000000', secondary: '#F1B82D', accent: '#FFFFFF' },
  NEBRASKA: { primary: '#E41C38', secondary: '#111111', accent: '#FFFFFF' },
  'NORTH CAROLINA': { primary: '#4B9CD3', secondary: '#13294B', accent: '#FFFFFF' },
  'NOTRE DAME': { primary: '#0C2340', secondary: '#C99700', accent: '#FFFFFF' },
  'OHIO STATE': { primary: '#BB0000', secondary: '#666666', accent: '#FFFFFF' },
  OKLAHOMA: { primary: '#841617', secondary: '#FDF9D8', accent: '#FFFFFF' },
  'OKLAHOMA STATE': { primary: '#FF7300', secondary: '#000000', accent: '#FFFFFF' },
  OREGON: { primary: '#154733', secondary: '#FEE123', accent: '#FFFFFF' },
  'PENN STATE': { primary: '#1E407C', secondary: '#0B1F3A', accent: '#FFFFFF' },
  PITTSBURGH: { primary: '#003594', secondary: '#FFB81C', accent: '#FFFFFF' },
  PURDUE: { primary: '#CFB991', secondary: '#000000', accent: '#FFFFFF' },
  RUTGERS: { primary: '#CC0033', secondary: '#111111', accent: '#FFFFFF' },
  'SOUTH CAROLINA': { primary: '#73000A', secondary: '#000000', accent: '#FFFFFF' },
  STANFORD: { primary: '#8C1515', secondary: '#2E2D29', accent: '#FFFFFF' },
  SYRACUSE: { primary: '#D44500', secondary: '#0B2545', accent: '#FFFFFF' },
  TCU: { primary: '#4D1979', secondary: '#111111', accent: '#FFFFFF' },
  TENNESSEE: { primary: '#FF8200', secondary: '#58595B', accent: '#FFFFFF' },
  TEXAS: { primary: '#BF5700', secondary: '#111111', accent: '#FFFFFF' },
  'TEXAS A&M': { primary: '#500000', secondary: '#111111', accent: '#FFFFFF' },
  'TEXAS TECH': { primary: '#CC0000', secondary: '#000000', accent: '#FFFFFF' },
  UCLA: { primary: '#2774AE', secondary: '#FFD100', accent: '#FFFFFF' },
  USC: { primary: '#990000', secondary: '#FFC72C', accent: '#FFFFFF' },
  UTAH: { primary: '#CC0000', secondary: '#111111', accent: '#FFFFFF' },
  WASHINGTON: { primary: '#4B2E83', secondary: '#B7A57A', accent: '#FFFFFF' },
  WISCONSIN: { primary: '#C5050C', secondary: '#111111', accent: '#FFFFFF' },
};

export function getTeamTileStyle(team?: string | null): CSSProperties | undefined {
  const teamColors = NFL_TEAM_COLORS[normalizeNflTeamAbbr(team) || ''];
  if (!teamColors) return undefined;

  return {
    '--team-primary': teamColors.primary,
    '--team-secondary': teamColors.secondary,
    '--team-accent': teamColors.accent,
  } as CSSProperties;
}

export function getCollegeTileStyle(college?: string | null): CSSProperties | undefined {
  const collegeColors = COLLEGE_TEAM_COLORS[normalizeCollegeName(college) || ''];
  if (!collegeColors) return undefined;

  return {
    '--team-primary': collegeColors.primary,
    '--team-secondary': collegeColors.secondary,
    '--team-accent': collegeColors.accent,
  } as CSSProperties;
}

export function normalizeNflTeamAbbr(team?: string | null): string | null {
  const normalized = (team || '').trim().toUpperCase();
  if (!normalized || normalized === 'FA') return null;
  if (normalized === 'JAC') return 'JAX';
  return normalized;
}

export function normalizeCollegeName(college?: string | null): string | null {
  const normalized = (college || '')
    .trim()
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');
  if (!normalized) return null;

  const aliases: Record<string, string> = {
    ALA: 'ALABAMA',
    BAMA: 'ALABAMA',
    ARIZONA_ST: 'ARIZONA STATE',
    ARIZONA_STATE: 'ARIZONA STATE',
    'ARIZONA ST': 'ARIZONA STATE',
    ASU: 'ARIZONA STATE',
    CLEM: 'CLEMSON',
    FLA: 'FLORIDA',
    'FLORIDA ST': 'FLORIDA STATE',
    FLORIDA_ST: 'FLORIDA STATE',
    FLORIDA_STATE: 'FLORIDA STATE',
    FSU: 'FLORIDA STATE',
    UGA: 'GEORGIA',
    LSU: 'LSU',
    MIA: 'MIAMI',
    MICH: 'MICHIGAN',
    'MICHIGAN ST': 'MICHIGAN STATE',
    MICHIGAN_ST: 'MICHIGAN STATE',
    MICHIGAN_STATE: 'MICHIGAN STATE',
    MSU: 'MICHIGAN STATE',
    MISS: 'MISSISSIPPI',
    'OLE MISS': 'MISSISSIPPI',
    OLE_MISS: 'MISSISSIPPI',
    'MISSISSIPPI ST': 'MISSISSIPPI STATE',
    MISSISSIPPI_ST: 'MISSISSIPPI STATE',
    MISSISSIPPI_STATE: 'MISSISSIPPI STATE',
    UNC: 'NORTH CAROLINA',
    ND: 'NOTRE DAME',
    'OHIO ST': 'OHIO STATE',
    OHIO_ST: 'OHIO STATE',
    OHIO_STATE: 'OHIO STATE',
    OSU: 'OHIO STATE',
    OKLA: 'OKLAHOMA',
    'OKLAHOMA ST': 'OKLAHOMA STATE',
    OKLAHOMA_ST: 'OKLAHOMA STATE',
    OKLAHOMA_STATE: 'OKLAHOMA STATE',
    ORE: 'OREGON',
    'PENN ST': 'PENN STATE',
    PENN_ST: 'PENN STATE',
    PENN_STATE: 'PENN STATE',
    PSU: 'PENN STATE',
    SCAR: 'SOUTH CAROLINA',
    TENN: 'TENNESSEE',
    'TEXAS AM': 'TEXAS A&M',
    'TEXAS A M': 'TEXAS A&M',
    TAMU: 'TEXAS A&M',
    A_AND_M: 'TEXAS A&M',
    TEXAS_A_M: 'TEXAS A&M',
    TEXAS_AM: 'TEXAS A&M',
    TEXAS_TECH: 'TEXAS TECH',
    TTU: 'TEXAS TECH',
    WASH: 'WASHINGTON',
    WISC: 'WISCONSIN',
  };

  const compactAliasKey = normalized.replace(/&/g, 'AND').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return aliases[normalized] || aliases[compactAliasKey] || normalized;
}

export function getNflTeamLogoUrl(team?: string | null): string | null {
  const normalized = normalizeNflTeamAbbr(team);
  if (!normalized) return null;
  return `https://sleepercdn.com/images/team_logos/nfl/${normalized.toLowerCase()}.png`;
}
