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
    <div className="flex min-w-0 items-center gap-2">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={managerName}
          className="h-6 w-6 flex-shrink-0 rounded-full border border-orange-400/30 object-cover md:h-7 md:w-7"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-orange-400/30 bg-slate-800 text-[10px] font-bold text-orange-300 md:h-7 md:w-7 md:text-[11px]"
        >
          {initial}
        </span>
      )}
      <span className="min-w-0 truncate">{managerName}</span>
    </div>
  );
}
