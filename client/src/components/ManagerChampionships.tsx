import { createContext, useContext, type ReactNode } from 'react';
import { Crown } from 'lucide-react';
import type { ReportData } from '@shared/types';

type ManagerChampionships = NonNullable<ReportData['managerChampionships']>;

const ManagerChampionshipContext = createContext<ManagerChampionships>({});

export function ManagerChampionshipProvider({
  championships,
  children,
}: {
  championships?: ManagerChampionships;
  children: ReactNode;
}) {
  return (
    <ManagerChampionshipContext.Provider value={championships || {}}>
      {children}
    </ManagerChampionshipContext.Provider>
  );
}

export function useManagerChampionshipSeasons(managerName?: string | null) {
  const championships = useContext(ManagerChampionshipContext);
  if (!managerName) return [];
  return sortSeasonsDesc(championships[managerName]?.seasons || []);
}

export function useManagerAccolades(managerName?: string | null) {
  const championships = useContext(ManagerChampionshipContext);
  const latestCompletedSeason = getLatestCompletedSeason(championships);
  if (!managerName) {
    return {
      championSeasons: [],
      runnerUpSeasons: [],
      lastPlaceSeasons: [],
    };
  }

  const managerFinishes = championships[managerName];
  return {
    championSeasons: sortSeasonsDesc(managerFinishes?.seasons || []),
    runnerUpSeasons: filterLatestSecondarySeasons(managerFinishes?.runnerUpSeasons || [], latestCompletedSeason),
    lastPlaceSeasons: filterLatestSecondarySeasons(managerFinishes?.lastPlaceSeasons || [], latestCompletedSeason),
  };
}

export function ManagerChampionshipPills({
  managerName,
  className = '',
}: {
  managerName?: string | null;
  className?: string;
}) {
  const { championSeasons, runnerUpSeasons, lastPlaceSeasons } = useManagerAccolades(managerName);
  if (championSeasons.length === 0 && runnerUpSeasons.length === 0 && lastPlaceSeasons.length === 0) return null;

  return (
    <span className={`manager-championship-pills ${className}`}>
      {championSeasons.map((season) => (
        <span key={`champ-${season}`} className="manager-championship-pill manager-championship-pill-champ">
          {season} Champ
        </span>
      ))}
      {runnerUpSeasons.map((season) => (
        <span key={`runner-up-${season}`} className="manager-championship-pill manager-championship-pill-runner-up">
          {season} Silver
        </span>
      ))}
      {lastPlaceSeasons.map((season) => (
        <span key={`sacko-${season}`} className="manager-championship-pill manager-championship-pill-sacko">
          {season} Sacko
        </span>
      ))}
    </span>
  );
}

function sortSeasonsDesc(seasons: string[]) {
  return Array.from(new Set(seasons)).sort((a, b) => {
    const numericDelta = Number(b) - Number(a);
    if (Number.isFinite(numericDelta) && numericDelta !== 0) return numericDelta;
    return b.localeCompare(a);
  });
}

function getLatestCompletedSeason(championships: ManagerChampionships): string | null {
  const seasons = Object.values(championships).flatMap((finish) => [
    ...(finish.seasons || []),
    ...(finish.runnerUpSeasons || []),
    ...(finish.lastPlaceSeasons || []),
  ]);
  return sortSeasonsDesc(seasons)[0] || null;
}

function filterLatestSecondarySeasons(seasons: string[], latestCompletedSeason: string | null) {
  if (!latestCompletedSeason) return [];
  return sortSeasonsDesc(seasons).filter((season) => season === latestCompletedSeason);
}

function getSeasonShortLabel(season?: string | null) {
  if (!season) return null;
  const digits = season.match(/\d{2}$/)?.[0];
  return digits || season.slice(-2);
}

export function ChampionAvatarFrame({
  managerName,
  children,
  className = '',
  showAccolades = true,
}: {
  managerName?: string | null;
  children: ReactNode;
  className?: string;
  showAccolades?: boolean;
}) {
  const { championSeasons, runnerUpSeasons, lastPlaceSeasons } = useManagerAccolades(managerName);
  const runnerUpTitle = runnerUpSeasons.length
    ? `${managerName} finished second in ${runnerUpSeasons.join(', ')}`
    : undefined;
  const lastPlaceTitle = lastPlaceSeasons.length
    ? `${managerName} got the Sacko in ${lastPlaceSeasons.join(', ')}`
    : undefined;
  const hasAccolade = showAccolades && (championSeasons.length > 0 || runnerUpSeasons.length > 0 || lastPlaceSeasons.length > 0);
  const runnerUpSeasonLabel = getSeasonShortLabel(runnerUpSeasons[0]);
  const lastPlaceSeasonLabel = getSeasonShortLabel(lastPlaceSeasons[0]);

  return (
    <span
      className={[
        'manager-champion-avatar',
        championSeasons.length ? 'manager-champion-avatar-winner' : '',
        runnerUpSeasons.length ? 'manager-champion-avatar-runner-up' : '',
        lastPlaceSeasons.length ? 'manager-champion-avatar-last-place' : '',
        hasAccolade ? 'manager-champion-avatar-accolade' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
      {showAccolades && championSeasons.map((season, index) => {
        const seasonTitle = `${managerName} won ${season}`;
        const seasonLabel = getSeasonShortLabel(season);
        return (
          <span
            key={`avatar-champ-${season}`}
            className="manager-accolade-crown manager-accolade-crown-champ"
            aria-label={seasonTitle}
            role="img"
            title={seasonTitle}
            style={{
              right: `${-0.32 + index * 0.72}rem`,
              zIndex: 8 + championSeasons.length - index,
            }}
          >
            <Crown className="manager-champion-crown" aria-hidden="true" />
            {seasonLabel && <span className="manager-accolade-year">{seasonLabel}</span>}
          </span>
        );
      })}
      {showAccolades && runnerUpSeasons.length > 0 && (
        <span className="manager-accolade-crown manager-accolade-crown-runner-up" aria-label={runnerUpTitle} role="img" title={runnerUpTitle}>
          <Crown className="manager-runner-up-crown" aria-hidden="true" />
          {runnerUpSeasonLabel && <span className="manager-accolade-year">{runnerUpSeasonLabel}</span>}
        </span>
      )}
      {showAccolades && lastPlaceSeasons.length > 0 && (
        <span className="manager-sacko-dunce" aria-label={lastPlaceTitle} title={lastPlaceTitle}>
          <span className="manager-sacko-dunce-cone" aria-hidden="true" />
          <span className="manager-sacko-dunce-band" aria-hidden="true">{lastPlaceSeasonLabel}</span>
        </span>
      )}
    </span>
  );
}
