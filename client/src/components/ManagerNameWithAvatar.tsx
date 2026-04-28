interface ManagerNameWithAvatarProps {
  avatarUrl?: string | null;
  managerName: string;
}

export function ManagerNameWithAvatar({
  avatarUrl,
  managerName,
}: ManagerNameWithAvatarProps) {
  const initial = managerName.trim()[0]?.toUpperCase() || '?';

  return (
    <div className="manager-chip flex min-w-0 items-center gap-2">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={managerName}
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
      <span className="min-w-0 truncate">{managerName}</span>
    </div>
  );
}
