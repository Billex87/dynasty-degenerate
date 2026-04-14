import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DraftPick } from '@shared/types';
import { TrendingUp, TrendingDown } from 'lucide-react';

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
            <span className="font-semibold text-slate-100">
              {pick.positionRankMay2025 ? pick.positionRankMay2025 : 'N/A'}
            </span>
          </div>

          {/* Current Rank */}
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-slate-400">Current Rank</span>
            <span className="font-semibold text-slate-100">
              {pick.currentPositionRank ? pick.currentPositionRank : 'N/A'}
            </span>
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
              <span className="text-slate-500">N/A</span>
            )}
          </div>

          {/* Draft Value */}
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-slate-400">Draft Value</span>
            <span className="font-semibold text-slate-100">
              {pick.currentKtcValue && pick.valueGain !== null && pick.valueGain !== undefined
                ? (pick.currentKtcValue - pick.valueGain).toLocaleString()
                : 'N/A'}
            </span>
          </div>

          {/* Current Value */}
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span className="text-slate-400">Current Value</span>
            <span className="font-semibold text-slate-100">
              {pick.currentKtcValue ? pick.currentKtcValue.toLocaleString() : 'N/A'}
            </span>
          </div>

          {/* Value Change */}
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Value Change</span>
            {pick.valueGain !== null && pick.valueGain !== undefined ? (
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
                {pick.valueGain > 0 && (
                  <TrendingUp className="inline ml-1 w-4 h-4" />
                )}
                {pick.valueGain < 0 && (
                  <TrendingDown className="inline ml-1 w-4 h-4" />
                )}
              </span>
            ) : (
              <span className="text-slate-500">N/A</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
