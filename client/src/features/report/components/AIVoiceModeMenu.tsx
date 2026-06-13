import { Bot, ChevronDown } from "lucide-react";

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
import {
  AI_VOICE_MODE_OPTIONS,
  getAIVoiceModeDescription,
  getAIVoiceModeLabel,
  normalizeAIVoiceMode,
  type AIVoiceMode,
} from "@/lib/aiVoice";

export function AIVoiceModeMenu({
  mode,
  onChange,
}: {
  mode: AIVoiceMode;
  onChange: (mode: AIVoiceMode) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="report-header-action report-footer-primary-action report-ai-voice-trigger dd-current !w-full max-w-[32rem] justify-between gap-2 sm:!w-auto sm:max-w-none"
          aria-label={`AI voice mode: ${getAIVoiceModeLabel(mode)}`}
          title={getAIVoiceModeDescription(mode)}
        >
          <span className="dd-current-line" aria-hidden="true" />
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <Bot className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="report-header-action-label min-w-0 truncate">
              AI Voice: {getAIVoiceModeLabel(mode)}
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
        className="w-72 border-cyan-400/20 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/20"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
          AI Voice
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-800/80" />
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={value => {
            const nextMode = normalizeAIVoiceMode(value);
            if (nextMode) onChange(nextMode);
          }}
        >
          {AI_VOICE_MODE_OPTIONS.map(option => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              className="gap-3 py-2 pr-3 pl-8"
            >
              <span className="grid min-w-0 gap-0.5">
                <span className="font-semibold text-cyan-50">
                  {getAIVoiceModeLabel(option)}
                </span>
                <span className="text-xs leading-snug text-slate-400">
                  {getAIVoiceModeDescription(option)}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
