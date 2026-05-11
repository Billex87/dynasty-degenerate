import { ChampionAvatarFrame, ManagerChampionshipPills } from './ManagerChampionships';

interface ManagerNameWithAvatarProps {
  avatarUrl?: string | null;
  managerName: string;
  displayName?: string;
  showAccoladePills?: boolean;
}

export function ManagerNameWithAvatar({
  avatarUrl,
  managerName,
  displayName,
  showAccoladePills = false,
}: ManagerNameWithAvatarProps) {
  const visibleName = displayName || managerName;
  const initial = visibleName.trim()[0]?.toUpperCase() || '?';

  return (
    <div className="interactive-identity manager-chip flex min-w-0 items-center gap-2">
      <ChampionAvatarFrame managerName={managerName} className="interactive-identity-avatar">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={visibleName}
            className="h-7 w-7 flex-shrink-0 rounded-full border border-cyan-300/30 object-cover shadow-sm shadow-black/30"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-slate-800 text-[11px] font-bold text-orange-300"
          >
            {initial}
          </span>
        )}
      </ChampionAvatarFrame>
      <span className="interactive-identity-name min-w-0">{visibleName}</span>
      {showAccoladePills && <ManagerChampionshipPills managerName={managerName} />}
    </div>
  );
}
