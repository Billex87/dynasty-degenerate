import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DraftPick } from '@shared/types';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface PlayerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pick: DraftPick | null;
}

export function PlayerDetailModal({
  isOpen,
  onClose,
  pick,
}: PlayerDetailModalProps) {
  const [headshot, setHeadshot] = useState<string | null>(null);
  const { data: headshotData } = trpc.images.playerHeadshot.useQuery(
    { playerId: pick?.player_id || '' },
    { enabled: !!pick?.player_id && isOpen }
  );

  useEffect(() => {
    if (headshotData?.success && headshotData?.data) {
      setHeadshot(`data:${headshotData.contentType};base64,${headshotData.data}`);
    }
  }, [headshotData]);

  if (!pick) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-orange-400">
            {pick.playerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Headshot */}
          {headshot && (
            <div className="flex justify-center mb-4">
              <img
                src={headshot}
                alt={pick.playerName}
                className="w-24 h-24 rounded-lg object-cover border-2 border-orange-400/30"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Position */}
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-slate-400">Position</span>
            <span className="font-semibold text-slate-100">{pick.playerPos}</span>
          </div>

          {/* Draft Info */}
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-slate-400">Round</span>
            <span className="font-semibold text-slate-100">{pick.round}</span>
          </div>

          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-slate-400">Pick #</span>
            <span className="font-semibold text-slate-100">{pick.pick}</span>
          </div>

          {/* Manager */}
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-slate-400">Manager</span>
            <span className="font-semibold text-slate-100">{pick.manager}</span>
          </div>

          {/* Drafted Rank */}
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-slate-400">Drafted Rank</span>
            <span className="font-semibold text-slate-100">{pick.positionRankMay2025}</span>
          </div>

          {/* Current Rank */}
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-slate-400">Current Rank</span>
            <span className="font-semibold text-slate-100">{pick.currentPositionRank}</span>
          </div>

          {/* Position Change */}
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-slate-400">Position Change</span>
            {pick.positionRankChange ? (
              <span
                className={`font-semibold ${
                  pick.positionRankChange.startsWith('+')
                    ? 'text-green-400'
                    : pick.positionRankChange.startsWith('-')
                      ? 'text-red-400'
                      : 'text-slate-300'
                }`}
              >
                {pick.positionRankChange}
                {pick.positionRankChange.startsWith('+') && (
                  <TrendingUp className="inline ml-1 w-4 h-4" />
                )}
                {pick.positionRankChange.startsWith('-') && (
                  <TrendingDown className="inline ml-1 w-4 h-4" />
                )}
              </span>
            ) : (
              <span className="text-slate-400">-</span>
            )}
          </div>

          {/* Draft Value */}
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-slate-400">Draft Value</span>
            <span className="font-semibold text-slate-100">
              {pick.ktcValue ? pick.ktcValue.toLocaleString() : '-'}
            </span>
          </div>

          {/* Current Value */}
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-slate-400">Current Value</span>
            <span className="font-semibold text-slate-100">
              {pick.currentKtcValue ? pick.currentKtcValue.toLocaleString() : '-'}
            </span>
          </div>

          {/* Value Change */}
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Value Change</span>
            {pick.valueGain ? (
              <span
                className={`font-semibold ${
                  pick.valueGain > 0
                    ? 'text-green-400'
                    : pick.valueGain < 0
                      ? 'text-red-400'
                      : 'text-slate-300'
                }`}
              >
                {pick.valueGain > 0 ? '+' : ''}
                {pick.valueGain.toLocaleString()}
                {pick.valueGain > 0 && <TrendingUp className="inline ml-1 w-4 h-4" />}
                {pick.valueGain < 0 && <TrendingDown className="inline ml-1 w-4 h-4" />}
              </span>
            ) : (
              <span className="text-slate-400">-</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
