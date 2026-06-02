import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AI_VOICE_MODE_CHANGE_EVENT,
  getAIVoiceMode,
  getAIVoiceModeLabel,
  setAIVoiceMode as persistAIVoiceMode,
  type AIVoiceMode,
} from "@/lib/aiVoice";

export function useHomeAIVoiceMode() {
  const [aiVoiceMode, setAiVoiceMode] = useState<AIVoiceMode>(() =>
    getAIVoiceMode()
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncVoiceMode = () => setAiVoiceMode(getAIVoiceMode());
    window.addEventListener("storage", syncVoiceMode);
    window.addEventListener(AI_VOICE_MODE_CHANGE_EVENT, syncVoiceMode);
    return () => {
      window.removeEventListener("storage", syncVoiceMode);
      window.removeEventListener(AI_VOICE_MODE_CHANGE_EVENT, syncVoiceMode);
    };
  }, []);

  const handleAIVoiceModeChange = useCallback((mode: AIVoiceMode) => {
    const nextMode = persistAIVoiceMode(mode);
    setAiVoiceMode(nextMode);
    toast.success(`AI voice set to ${getAIVoiceModeLabel(nextMode)}.`);
  }, []);

  return {
    aiVoiceMode,
    handleAIVoiceModeChange,
  };
}
