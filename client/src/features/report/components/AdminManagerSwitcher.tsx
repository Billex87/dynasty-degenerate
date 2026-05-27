import { ChevronDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReportData } from "@shared/types";

const LEAGUE_VIEW_MANAGER_VALUE = "__league__";

function getManagerFallbackInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "DD";
}

export function AdminManagerSwitcher({
  managers,
  activeManager,
  managerAvatars,
  onSelect,
}: {
  managers: string[];
  activeManager: string | null;
  managerAvatars?: ReportData["managerAvatars"];
  onSelect: (manager: string | null) => void;
}) {
  if (managers.length < 2) return null;

  const selectedManagerLabel = activeManager || "League View";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="report-header-action report-footer-primary-action !w-auto min-w-0 flex-1 justify-between gap-1.5 px-2.5 sm:!w-auto sm:min-w-[14rem] sm:max-w-[18rem]"
          aria-label={`View as ${selectedManagerLabel}`}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate text-cyan-50/85">
              {selectedManagerLabel}
            </span>
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 opacity-80"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        className="w-72 border-orange-400/20 bg-slate-950/95 text-slate-100 shadow-2xl shadow-orange-950/20"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
          View As Manager
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-800/80" />
        <DropdownMenuRadioGroup
          value={activeManager || LEAGUE_VIEW_MANAGER_VALUE}
          onValueChange={value =>
            onSelect(value === LEAGUE_VIEW_MANAGER_VALUE ? null : value)
          }
        >
          <DropdownMenuRadioItem
            value={LEAGUE_VIEW_MANAGER_VALUE}
            className="gap-3 py-2 pr-3 pl-8"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-400/25 bg-slate-900 text-[10px] font-bold text-orange-300">
                LV
              </span>
              <span className="truncate">League View</span>
            </span>
          </DropdownMenuRadioItem>
          {managers.map(manager => {
            const avatarUrl = managerAvatars?.[manager] || null;
            return (
              <DropdownMenuRadioItem
                key={manager}
                value={manager}
                className="gap-3 py-2 pr-3 pl-8"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      aria-hidden="true"
                      className="h-6 w-6 shrink-0 rounded-full border border-cyan-300/25 object-cover"
                    />
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-300/25 bg-slate-900 text-[10px] font-bold text-orange-300">
                      {getManagerFallbackInitials(manager)}
                    </span>
                  )}
                  <span className="truncate">{manager}</span>
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
