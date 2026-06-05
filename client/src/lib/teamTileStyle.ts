import type { CSSProperties } from 'react';
import teamBackgrounds from './nfl_modal_backgrounds/meta.json';

export type NflTeamColors = { primary: string; secondary: string; accent: string };

type NflTeamCode = keyof typeof teamBackgrounds.teams;
type NflTeamMeta = (typeof teamBackgrounds.teams)[NflTeamCode];

const NFL_TEAM_CODE_ALIASES = teamBackgrounds.aliases as Record<string, NflTeamCode | undefined>;
const NFL_FALLBACK_GRADIENT = teamBackgrounds.fallback.gradient;
const NFL_FALLBACK_CODES = new Set(
  [teamBackgrounds.fallback.code, ...(teamBackgrounds.fallback.aliases || [])].map((code) => code.trim().toUpperCase())
);

function isNflTeamCode(code: string): code is NflTeamCode {
  return Object.prototype.hasOwnProperty.call(teamBackgrounds.teams, code);
}

function getKnownNflTeamCode(team?: string | null): NflTeamCode | null {
  const normalized = normalizeNflTeamAbbr(team);
  return normalized && isNflTeamCode(normalized) ? normalized : null;
}

function getNflTeamMetadata(team?: string | null): NflTeamMeta | null {
  const teamCode = getKnownNflTeamCode(team);
  return teamCode ? teamBackgrounds.teams[teamCode] : null;
}

function buildTeamColorsFromGradient(gradient: readonly string[]): NflTeamColors {
  const primary = gradient[0] || NFL_FALLBACK_GRADIENT[0];
  const secondary = gradient[1] || primary;
  const accent = gradient[2] || gradient[1] || primary;
  return { primary, secondary, accent };
}

export const NFL_TEAM_COLORS: Record<string, NflTeamColors> = Object.fromEntries(
  Object.entries(teamBackgrounds.teams).map(([teamCode, team]) => [
    teamCode,
    buildTeamColorsFromGradient(team.gradient),
  ])
);

export function getNflTeamColors(team?: string | null): NflTeamColors | null {
  const teamCode = getKnownNflTeamCode(team);
  return teamCode ? NFL_TEAM_COLORS[teamCode] : null;
}

export function getNflFallbackTeamColors(): NflTeamColors {
  return buildTeamColorsFromGradient(NFL_FALLBACK_GRADIENT);
}

export function getNflTeamColorsWithFallback(team?: string | null): NflTeamColors {
  return getNflTeamColors(team) || getNflFallbackTeamColors();
}

export function getNflTeamGradientStops(team?: string | null): string[] {
  const teamMeta = getNflTeamMetadata(team);
  return [...(teamMeta?.gradient || NFL_FALLBACK_GRADIENT)];
}

export function getNflTeamHeaderGradient(team?: string | null): string {
  const colors = getNflTeamGradientStops(team);
  const angle = teamBackgrounds.gradientAngle || '135deg';
  return `linear-gradient(${angle}, ${colors.join(', ')})`;
}

const NFL_TEAM_NAME_ALIASES: Record<string, string> = {
  'ARIZONA CARDINALS': 'ARI',
  'ATLANTA FALCONS': 'ATL',
  'BALTIMORE RAVENS': 'BAL',
  'BUFFALO BILLS': 'BUF',
  'CAROLINA PANTHERS': 'CAR',
  'CHICAGO BEARS': 'CHI',
  'CINCINNATI BENGALS': 'CIN',
  'CLEVELAND BROWNS': 'CLE',
  'DALLAS COWBOYS': 'DAL',
  'DENVER BRONCOS': 'DEN',
  'DETROIT LIONS': 'DET',
  'GREEN BAY PACKERS': 'GB',
  'HOUSTON TEXANS': 'HOU',
  'INDIANAPOLIS COLTS': 'IND',
  'JACKSONVILLE JAGUARS': 'JAX',
  'KANSAS CITY CHIEFS': 'KC',
  'LAS VEGAS RAIDERS': 'LV',
  'LOS ANGELES CHARGERS': 'LAC',
  'LOS ANGELES RAMS': 'LAR',
  'LA CHARGERS': 'LAC',
  'LA RAMS': 'LAR',
  'MIAMI DOLPHINS': 'MIA',
  'MINNESOTA VIKINGS': 'MIN',
  'NEW ENGLAND PATRIOTS': 'NE',
  'NEW ORLEANS SAINTS': 'NO',
  'NEW YORK GIANTS': 'NYG',
  'NEW YORK JETS': 'NYJ',
  'PHILADELPHIA EAGLES': 'PHI',
  'PITTSBURGH STEELERS': 'PIT',
  'SAN FRANCISCO 49ERS': 'SF',
  'SEATTLE SEAHAWKS': 'SEA',
  'TAMPA BAY BUCCANEERS': 'TB',
  'TENNESSEE TITANS': 'TEN',
  'WASHINGTON COMMANDERS': 'WAS',
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

const COLLEGE_NFL_DRAFT_BUZZ_LOGO_SLUGS: Record<string, string> = {
  ALABAMA: 'alabama-crimson-tide',
  'ARIZONA STATE': 'arizona-state-sun-devils',
  CALIFORNIA: 'california-golden-bears',
  CLEMSON: 'clemson-tigers',
  FLORIDA: 'florida-gators',
  GEORGIA: 'georgia-bulldogs',
  INDIANA: 'indiana-hoosiers',
  LOUISVILLE: 'louisville-cardinals',
  LSU: 'lsu-tigers',
  MIAMI: 'miami-hurricanes',
  MICHIGAN: 'michigan-wolverines',
  MISSISSIPPI: 'ole-miss-rebels',
  MISSOURI: 'missouri-tigers',
  'OHIO STATE': 'ohio-state-buckeyes',
  TENNESSEE: 'tennessee-volunteers',
  TEXAS: 'texas-longhorns',
  'TEXAS A&M': 'texas-aandm-aggies',
  'TEXAS TECH': 'texas-tech-red-raiders',
};

const COLLEGE_ESPN_LOGO_IDS: Record<string, string> = {
  ALABAMA: '333',
  ARIZONA: '12',
  'ARIZONA STATE': '9',
  ARKANSAS: '8',
  AUBURN: '2',
  BAYLOR: '239',
  'BOISE STATE': '68',
  'BOSTON COLLEGE': '103',
  'BOWLING GREEN': '189',
  BYU: '252',
  CALIFORNIA: '25',
  CINCINNATI: '2132',
  'COASTAL CAROLINA': '324',
  'COLORADO STATE': '36',
  CLEMSON: '228',
  COLORADO: '38',
  CONNECTICUT: '41',
  DUKE: '150',
  'EAST CAROLINA': '151',
  'FLORIDA ATLANTIC': '2226',
  'FLORIDA INTERNATIONAL': '2229',
  FLORIDA: '57',
  'FLORIDA STATE': '52',
  'FRESNO STATE': '278',
  GEORGIA: '61',
  'GEORGIA STATE': '2247',
  'GEORGIA TECH': '59',
  HOUSTON: '248',
  ILLINOIS: '356',
  INDIANA: '84',
  IOWA: '2294',
  'IOWA STATE': '66',
  KANSAS: '2305',
  'KANSAS STATE': '2306',
  KENTUCKY: '96',
  LIBERTY: '2335',
  LSU: '99',
  LOUISVILLE: '97',
  MARYLAND: '120',
  MEMPHIS: '235',
  MIAMI: '2390',
  MICHIGAN: '130',
  'MICHIGAN STATE': '127',
  MINNESOTA: '135',
  MISSISSIPPI: '145',
  'MISSISSIPPI STATE': '344',
  MISSOURI: '142',
  NEBRASKA: '158',
  NEVADA: '2440',
  'NORTH CAROLINA': '153',
  'NORTH CAROLINA STATE': '152',
  'NORTH DAKOTA STATE': '2449',
  'NORTH TEXAS': '249',
  'NOTRE DAME': '87',
  'OHIO STATE': '194',
  OKLAHOMA: '201',
  'OKLAHOMA STATE': '197',
  OREGON: '2483',
  'PENN STATE': '213',
  PITTSBURGH: '221',
  PURDUE: '2509',
  RICE: '242',
  RUTGERS: '164',
  'SAN DIEGO STATE': '21',
  'SAN JOSE STATE': '23',
  SMU: '2567',
  'SOUTH DAKOTA STATE': '2571',
  'SOUTH CAROLINA': '2579',
  STANFORD: '24',
  SYRACUSE: '183',
  TCU: '2628',
  TENNESSEE: '2633',
  TEXAS: '251',
  'TEXAS A&M': '245',
  'TEXAS TECH': '2641',
  TROY: '2653',
  TULANE: '2655',
  UCLA: '26',
  UCF: '2116',
  UCONN: '41',
  USC: '30',
  UTAH: '254',
  'UTAH STATE': '328',
  UTEP: '2638',
  UTSA: '2636',
  VANDERBILT: '238',
  VIRGINIA: '258',
  'VIRGINIA TECH': '259',
  'WAKE FOREST': '154',
  WASHINGTON: '264',
  'WASHINGTON STATE': '265',
  'WEST VIRGINIA': '277',
  WISCONSIN: '275',
  WYOMING: '2751',
};

const DRAFT_BUZZ_ASSET_BASE = '/assets/draftbuzz-cache';
const MISSING_CACHED_DRAFT_BUZZ_ASSETS = new Set([
  'player-headshots/Andrew-Ogletree-TE-YoungstownState.png',
  'player-headshots/Aqeel-Glass-QB-AlabamaAANDM.png',
  'player-headshots/Briley-Moore-TE-KansasState.png',
  'player-headshots/Calvin-Turner-RB-Hawai-i.png',
  'player-headshots/Carson-Beck-QB-Georgia.png',
  'player-headshots/Changa-Hodge-WR-VirginiaTech.png',
  'player-headshots/Charlie-Becker-WR-Indiana.png',
  'player-headshots/Chris-BrazzellII-WR-Tulane.png',
  'player-headshots/Da-Quan-Felton-WR-NorfolkState.png',
  'player-headshots/Dai-Jean-Dixon-WR-Nicholls.png',
  'player-headshots/Daniel-Smith-QB-Villanova.png',
  'player-headshots/Davis-Cheek-QB-Elon.png',
  'player-headshots/Demond-Claiborne-RB-WakeForest.png',
  'player-headshots/Devin-Wynn-RB-Furman.png',
  'player-headshots/Drew-Allar-QB-PennState.png',
  'player-headshots/Ej-Jenkins-WR-StFrancis-PA-.png',
  'player-headshots/Eli-Heidenreich-WR-Navy.png',
  'player-headshots/Emmett-Johnson-RB-Nebraska.png',
  'player-headshots/Felix-Harper-QB-AlcornState.png',
  'player-headshots/Isaiah-Weston-WR-NorthernIowa.png',
  'player-headshots/JKoby-Williams-RB-TexasTech.png',
  'player-headshots/Jadakis-Bonds-WR-Hampton.png',
  'player-headshots/Jah-Maine-Martin-RB-NorthCarolinaAANDT.png',
  'player-headshots/Jalen-Brooks-WR-SouthCarolina.png',
  'player-headshots/Jequez-Ezzard-WR-SamHoustonState.png',
  'player-headshots/Kaytron-Allen-RB-PennState.png',
  'player-headshots/Khalan-Laborn-RB-FloridaState.png',
  'player-headshots/Kyron-Drones-QB-Baylor.png',
  'player-headshots/Max-Klare-TE-Purdue.png',
  'player-headshots/Oscar-Delp-TE-Georgia.png',
  'player-headshots/Quentin-Harrison-WR-CalPoly.png',
  'player-headshots/Shaquan-Davis-WR-SouthCarolinaState.png',
  'player-headshots/Sincere-McCormick-RB-UTSA.png',
  'player-headshots/Tanner-Conner-WR-IdahoState.png',
  'player-headshots/Tyshaun-James-WR-CentralConnecticut.png',
  'player-headshots/Zerrick-Cooper-QB-JacksonvilleState.png',
]);

function sanitizeCachedAssetFileName(value?: string | null): string | null {
  const sanitized = String(value || '')
    .replace(/%20/g, '-')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitized || null;
}

function decodeAssetHtmlEntities(value?: string | null): string {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function fileNameFromAssetUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(decodeAssetHtmlEntities(url));
    return sanitizeCachedAssetFileName(decodeURIComponent(parsed.pathname.split('/').pop() || ''));
  } catch {
    return null;
  }
}

export function getCachedDraftBuzzImageUrl(url?: string | null): string | null {
  const trimmed = decodeAssetHtmlEntities(url).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(DRAFT_BUZZ_ASSET_BASE)) return trimmed;

  const fileName = fileNameFromAssetUrl(trimmed);
  if (!fileName) return trimmed;

  if (/\/Content\/PlayerHeadShots(?:Small)?\//i.test(trimmed)) {
    const localPath = `player-headshots/${fileName}`;
    return MISSING_CACHED_DRAFT_BUZZ_ASSETS.has(localPath) ? null : `${DRAFT_BUZZ_ASSET_BASE}/${localPath}`;
  }
  if (/\/Content\/collmascots\//i.test(trimmed)) {
    return `${DRAFT_BUZZ_ASSET_BASE}/college-logos/${fileName}`;
  }
  if (/\/Content\/NFLLogos\//i.test(trimmed)) {
    return `${DRAFT_BUZZ_ASSET_BASE}/nfl-logos/${fileName.toLowerCase()}`;
  }

  const espnCollegeId = trimmed.match(/\/i\/teamlogos\/ncaa\/500\/(\d+)\.png/i)?.[1];
  if (espnCollegeId) return `${DRAFT_BUZZ_ASSET_BASE}/college-logos/espn-${espnCollegeId}.png`;

  const sleeperTeam = trimmed.match(/sleepercdn\.com\/images\/team_logos\/nfl\/([a-z]{2,3})\.png/i)?.[1];
  if (sleeperTeam) return `${DRAFT_BUZZ_ASSET_BASE}/nfl-logos/${sleeperTeam.toLowerCase()}.png`;

  return trimmed;
}

export function getTeamTileStyle(team?: string | null): CSSProperties | undefined {
  const teamColors = getNflTeamColors(team);
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
  if (!normalized || NFL_FALLBACK_CODES.has(normalized)) return null;
  if (NFL_TEAM_NAME_ALIASES[normalized]) return NFL_TEAM_NAME_ALIASES[normalized];
  return NFL_TEAM_CODE_ALIASES[normalized] || normalized;
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
    'MIAMI (FL)': 'MIAMI',
    'MIAMI FL': 'MIAMI',
    MIAMI_FL: 'MIAMI',
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
    'NC STATE': 'NORTH CAROLINA STATE',
    NC_STATE: 'NORTH CAROLINA STATE',
    NCSU: 'NORTH CAROLINA STATE',
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
    UCONN: 'UCONN',
    UCF: 'UCF',
    'CENTRAL FLORIDA': 'UCF',
    CENTRAL_FLORIDA: 'UCF',
    FIU: 'FLORIDA INTERNATIONAL',
    FAU: 'FLORIDA ATLANTIC',
    WASH: 'WASHINGTON',
    WISC: 'WISCONSIN',
  };

  const compactAliasKey = normalized.replace(/&/g, 'AND').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return aliases[normalized] || aliases[compactAliasKey] || normalized;
}

export function getCollegeInitials(college?: string | null): string {
  const words = String(college || '')
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return initials || 'C';
}

export function getCollegeLogoUrl(college?: string | null, preferredLogoUrl?: string | null): string | null {
  const preferred = preferredLogoUrl?.trim();
  if (preferred && !/\/NFLLogos\//i.test(preferred)) return getCachedDraftBuzzImageUrl(preferred);

  const normalized = normalizeCollegeName(college);
  if (!normalized) return null;

  const draftBuzzSlug = COLLEGE_NFL_DRAFT_BUZZ_LOGO_SLUGS[normalized];
  if (draftBuzzSlug) {
    return `${DRAFT_BUZZ_ASSET_BASE}/college-logos/${sanitizeCachedAssetFileName(`${draftBuzzSlug}.png`)}`;
  }

  const espnId = COLLEGE_ESPN_LOGO_IDS[normalized];
  return espnId ? `${DRAFT_BUZZ_ASSET_BASE}/college-logos/espn-${espnId}.png` : null;
}

export function getNflTeamLogoUrl(team?: string | null): string | null {
  const normalized = normalizeNflTeamAbbr(team);
  if (!normalized) return null;
  const assetAbbr = normalized === 'WAS' ? 'wsh' : normalized.toLowerCase();
  return `${DRAFT_BUZZ_ASSET_BASE}/nfl-logos/${assetAbbr}.png`;
}
