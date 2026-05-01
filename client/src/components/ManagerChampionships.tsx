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
  return championships[managerName]?.seasons || [];
}

export function ManagerChampionshipPills({
  managerName,
  className = '',
}: {
  managerName?: string | null;
  className?: string;
}) {
  const seasons = useManagerChampionshipSeasons(managerName);
  if (seasons.length === 0) return null;

  return (
    <span className={`manager-championship-pills ${className}`}>
      {seasons.map((season) => (
        <span key={season} className="manager-championship-pill">
          {season} Champ
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
  const seasons = useManagerChampionshipSeasons(managerName);
  const title = seasons.length
    ? `${managerName} won ${seasons.join(', ')}`
    : undefined;

  return (
    <span className={`manager-champion-avatar ${seasons.length ? 'manager-champion-avatar-winner' : ''} ${className}`}>
      {children}
      {seasons.length > 0 && (
        <Crown className="manager-champion-crown" aria-label={title}>
          <title>{title}</title>
        </Crown>
      )}
    </span>
  );
}
