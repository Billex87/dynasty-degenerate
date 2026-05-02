import { createContext, useContext, type ReactNode } from 'react';
import { BadgeX, Crown } from 'lucide-react';
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
  return championships[managerName]?.seasons || [];
}

export function useManagerAccolades(managerName?: string | null) {
  const championships = useContext(ManagerChampionshipContext);
  if (!managerName) {
    return {
      championSeasons: [],
      runnerUpSeasons: [],
      lastPlaceSeasons: [],
    };
  }

  const managerFinishes = championships[managerName];
  return {
    championSeasons: managerFinishes?.seasons || [],
    runnerUpSeasons: managerFinishes?.runnerUpSeasons || [],
    lastPlaceSeasons: managerFinishes?.lastPlaceSeasons || [],
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

export function ChampionAvatarFrame({
  managerName,
  children,
  className = '',
}: {
  managerName?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const { championSeasons, runnerUpSeasons, lastPlaceSeasons } = useManagerAccolades(managerName);
  const title = championSeasons.length
    ? `${managerName} won ${championSeasons.join(', ')}`
    : undefined;
  const runnerUpTitle = runnerUpSeasons.length
    ? `${managerName} finished second in ${runnerUpSeasons.join(', ')}`
    : undefined;
  const lastPlaceTitle = lastPlaceSeasons.length
    ? `${managerName} got the Sacko in ${lastPlaceSeasons.join(', ')}`
    : undefined;
  const hasAccolade = championSeasons.length > 0 || runnerUpSeasons.length > 0 || lastPlaceSeasons.length > 0;

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
      {championSeasons.length > 0 && (
        <Crown className="manager-champion-crown" aria-label={title}>
          <title>{title}</title>
        </Crown>
      )}
      {runnerUpSeasons.length > 0 && (
        <Crown className="manager-runner-up-crown" aria-label={runnerUpTitle}>
          <title>{runnerUpTitle}</title>
        </Crown>
      )}
      {lastPlaceSeasons.length > 0 && (
        <BadgeX className="manager-last-place-icon" aria-label={lastPlaceTitle}>
          <title>{lastPlaceTitle}</title>
        </BadgeX>
      )}
    </span>
  );
}
