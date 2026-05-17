const SUFFIX_PATTERN = /\b(?:jr|sr|ii|iii|iv|v)\b$/i;

const CANONICAL_ALIASES = new Map([
  ['kenwalker', 'kennethwalker'],
  ['dontethorton', 'dontethornton'],
]);

export function cleanIdentityKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

export function stripNameSuffix(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(SUFFIX_PATTERN, '')
    .trim();
}

export function getCanonicalPlayerKey(nameOrKey) {
  const withoutSuffix = stripNameSuffix(nameOrKey);
  const clean = cleanIdentityKey(withoutSuffix);
  return CANONICAL_ALIASES.get(clean) || clean;
}

export function getIdentityPositionGroup(position) {
  const normalized = String(position || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!normalized) return null;
  if (['DST', 'D', 'DEFENSE'].includes(normalized)) return 'DEF';
  if (normalized === 'PK') return 'K';
  return normalized;
}

export function hasNameSuffix(value) {
  return SUFFIX_PATTERN.test(String(value || '').trim());
}
