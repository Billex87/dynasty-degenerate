import type { PlayerDetails, ReportData } from '@shared/types';

export type LeagueValueMode = 'dynasty' | 'redraft';

export type ValueContext =
  | 'overview'
  | 'starter'
  | 'rankings'
  | 'trade'
  | 'draft'
  | 'waiver'
  | 'player-detail';

export type ValueField = 'dynasty' | 'season' | 'redraft' | 'draftDay' | 'current' | 'delta';

export type ValueDisplayConfig = {
  mode: LeagueValueMode;
  context: ValueContext;
  primaryField: ValueField;
  primaryLabel: string;
  secondaryField?: ValueField;
  secondaryLabel?: string;
  showDynastyValue: boolean;
  showSeasonValue: boolean;
  hideUnsupportedDynasty: boolean;
  title: string;
  description: string;
};

export function normalizeLeagueValueMode(mode?: ReportData['leagueValueMode'] | string | null): LeagueValueMode {
  return mode === 'redraft' ? 'redraft' : 'dynasty';
}

export function isRedraftMode(mode?: ReportData['leagueValueMode'] | string | null): boolean {
  return normalizeLeagueValueMode(mode) === 'redraft';
}

export function getValueDisplayConfig(
  modeInput: ReportData['leagueValueMode'] | string | null | undefined,
  context: ValueContext,
): ValueDisplayConfig {
  const mode = normalizeLeagueValueMode(modeInput);

  if (mode === 'redraft') {
    const redraftBase = {
      mode,
      context,
      showDynastyValue: false,
      showSeasonValue: true,
      hideUnsupportedDynasty: true,
    } satisfies Pick<ValueDisplayConfig, 'mode' | 'context' | 'showDynastyValue' | 'showSeasonValue' | 'hideUnsupportedDynasty'>;

    if (context === 'draft') {
      return {
        ...redraftBase,
        primaryField: 'current',
        primaryLabel: 'Current Value',
        secondaryField: 'draftDay',
        secondaryLabel: 'Draft-Day Value',
        title: 'Draft Recap',
        description: 'Draft-day value, current-season value, starter hit rate, bench value, and positional fit.',
      };
    }

    if (context === 'trade') {
      return {
        ...redraftBase,
        primaryField: 'season',
        primaryLabel: 'Current-Season Value',
        title: 'Trade History',
        description: 'Completed trades evaluated through current-season value and roster fit.',
      };
    }

    if (context === 'waiver') {
      return {
        ...redraftBase,
        primaryField: 'season',
        primaryLabel: 'Current Opportunity',
        title: 'Waiver Intelligence',
        description: 'Available players ranked by weekly usefulness, current opportunity, and positional need.',
      };
    }

    return {
      ...redraftBase,
      primaryField: 'season',
      primaryLabel: context === 'rankings' ? 'Redraft Value' : 'Season Value',
      secondaryField: context === 'player-detail' ? 'current' : undefined,
      secondaryLabel: context === 'player-detail' ? 'Current Rank' : undefined,
      title: context === 'rankings' ? 'Redraft Value Board' : 'Owner Reads',
      description: context === 'rankings'
        ? 'Current-season player values, roster strength, and positional context for this redraft league.'
        : 'Current-season roster strength, starter quality, bench depth, and position gaps.',
    };
  }

  if (context === 'starter' || context === 'waiver') {
    return {
      mode,
      context,
      primaryField: 'season',
      primaryLabel: context === 'waiver' ? 'Season Value' : 'Season Value',
      secondaryField: 'dynasty',
      secondaryLabel: 'Dynasty Value',
      showDynastyValue: true,
      showSeasonValue: true,
      hideUnsupportedDynasty: false,
      title: context === 'waiver' ? 'Waiver Intelligence' : 'Projected Roster Board',
      description: 'Current-season usefulness is primary here, with dynasty value clearly labeled when shown.',
    };
  }

  if (context === 'draft') {
    return {
      mode,
      context,
      primaryField: 'dynasty',
      primaryLabel: 'Current Dynasty Value',
      secondaryField: 'draftDay',
      secondaryLabel: 'Draft-Day Value',
      showDynastyValue: true,
      showSeasonValue: false,
      hideUnsupportedDynasty: false,
      title: 'Draft History',
      description: 'Rookie and startup draft-day value, current dynasty value, board decisions, and long-term value gained or lost.',
    };
  }

  return {
    mode,
    context,
    primaryField: 'dynasty',
    primaryLabel: context === 'trade' ? 'Dynasty Value' : 'Dynasty Value',
    secondaryField: context === 'player-detail' || context === 'overview' ? 'season' : undefined,
    secondaryLabel: context === 'player-detail' || context === 'overview' ? 'Season Value' : undefined,
    showDynastyValue: true,
    showSeasonValue: context === 'player-detail' || context === 'overview',
    hideUnsupportedDynasty: false,
    title: context === 'rankings' ? 'Dynasty Value Board' : 'Owner Intel Lab',
    description: context === 'rankings'
      ? 'Format-aware dynasty player and pick values matched to this league type.'
      : 'Long-term roster value, age curve, pick capital, and team direction.',
  };
}

export function getPrimaryValueLabel(mode: ReportData['leagueValueMode'] | string | null | undefined, context: ValueContext): string {
  return getValueDisplayConfig(mode, context).primaryLabel;
}

export function getSecondaryValueLabel(mode: ReportData['leagueValueMode'] | string | null | undefined, context: ValueContext): string | undefined {
  return getValueDisplayConfig(mode, context).secondaryLabel;
}

export function shouldShowDynastyValue(
  mode: ReportData['leagueValueMode'] | string | null | undefined,
  context: ValueContext,
  explicitOverride = false,
): boolean {
  const config = getValueDisplayConfig(mode, context);
  return explicitOverride || config.showDynastyValue;
}

export function shouldUseSeasonPrimary(mode: ReportData['leagueValueMode'] | string | null | undefined, context: ValueContext): boolean {
  const config = getValueDisplayConfig(mode, context);
  return config.primaryField === 'season' || config.primaryField === 'redraft' || config.primaryField === 'current';
}

export function getPlayerValueForMode({
  valueProfile,
  fallbackValue,
  mode,
  context,
}: {
  valueProfile?: PlayerDetails['valueProfile'];
  fallbackValue?: number | null;
  mode?: ReportData['leagueValueMode'] | string | null;
  context: ValueContext;
}): number | null {
  const config = getValueDisplayConfig(mode, context);

  if (config.primaryField === 'season' || config.primaryField === 'redraft' || config.primaryField === 'current') {
    return valueProfile?.seasonValue
      ?? valueProfile?.fantasyProsSeasonValue
      ?? valueProfile?.fantasyCalcRedraft
      ?? fallbackValue
      ?? null;
  }

  if (config.primaryField === 'draftDay') return fallbackValue ?? null;

  return valueProfile?.dynastyValue
    ?? valueProfile?.balancedValue
    ?? fallbackValue
    ?? null;
}

export function getPlayerRankForMode({
  valueProfile,
  fallbackRank,
  mode,
  context,
}: {
  valueProfile?: PlayerDetails['valueProfile'];
  fallbackRank?: string | null;
  mode?: ReportData['leagueValueMode'] | string | null;
  context: ValueContext;
}): string | null {
  const config = getValueDisplayConfig(mode, context);

  if (config.primaryField === 'season' || config.primaryField === 'redraft' || config.primaryField === 'current') {
    return valueProfile?.seasonPositionRank
      || valueProfile?.fantasyProsPositionRank
      || fallbackRank
      || null;
  }

  return valueProfile?.dynastyPositionRank
    || valueProfile?.balancedPositionRank
    || fallbackRank
    || null;
}

export function getLeagueModeCopy(modeInput: ReportData['leagueValueMode'] | string | null | undefined) {
  const mode = normalizeLeagueValueMode(modeInput);
  return mode === 'redraft'
    ? {
        ownerTitle: 'Owner Reads',
        ownerKicker: 'Current-season roster reads',
        rosterTitle: 'Projected Roster Board',
        rosterKicker: 'Starter strength and bench depth',
        rankingsTitle: 'Redraft Value Board',
        rankingsKicker: 'Current-season player values',
        rankingsDescription: 'Current-season player values, roster strength, and positional context for this redraft league.',
        tradeWarKicker: 'Current-season trade calculator',
        draftTitle: 'Draft Recap',
        draftKicker: 'Draft-day vs current value',
      }
    : {
        ownerTitle: 'Owner Intel Lab',
        ownerKicker: 'Dynasty owner reads',
        rosterTitle: 'Projected Roster Board',
        rosterKicker: 'Season starter room',
        rankingsTitle: 'Dynasty Value Board',
        rankingsKicker: 'League-matched values',
        rankingsDescription: 'Format-aware dynasty player and pick values matched to this league type. Use the selector to compare how the board shifts across SuperFlex, Standard, and TE-premium rooms.',
        tradeWarKicker: 'Context-aware calculator',
        draftTitle: 'Draft History',
        draftKicker: 'Startup, rookie, and board value',
      };
}
