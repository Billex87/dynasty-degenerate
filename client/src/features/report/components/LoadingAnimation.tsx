import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CheckCircle2, Sparkles, Zap } from 'lucide-react';
import type { LoaderManagerAnchor } from './LoaderKitBackdrop';

const LoaderKitBackdrop = lazy(() => import('./LoaderKitBackdrop'));
const SuccessCard3D = lazy(() => import('@/features/report/components/SuccessCard3D'));

function LoadingLetterbox({ isComplete }: { isComplete: boolean }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="dd-loading-letterbox"
      data-state={isComplete ? 'exit' : 'enter'}
      aria-hidden="true"
    />,
    document.body
  );
}

function LoadingSceneBackdrop({
  isActive,
  phase,
  managerAnchors,
}: {
  isActive: boolean;
  phase: LoadingAnimationPhase;
  managerAnchors?: LoaderManagerAnchor[];
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`dd-loading-scene-backdrop dd-loading-scene-backdrop--${phase}`}
      data-state={isActive ? 'enter' : 'exit'}
      aria-hidden="true"
    >
      <Suspense fallback={<div className="analysis-loading-loader-kit-fallback" />}>
        <LoaderKitBackdrop variant="ambient" managerAnchors={managerAnchors} />
      </Suspense>
    </div>,
    document.body
  );
}

interface LoadingStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'complete';
}

const initialLoadingSteps: LoadingStep[] = [
  { id: 'sleeper', label: 'Connect league', status: 'loading' },
  { id: 'league', label: 'Load rosters', status: 'pending' },
  { id: 'ktc', label: 'Match values', status: 'pending' },
  { id: 'dynasty', label: 'Build market read', status: 'pending' },
  { id: 'csv', label: 'Prepare manager insights', status: 'pending' },
  { id: 'final', label: 'Final check', status: 'pending' },
];

const loadingStepScanLabels: Record<string, string> = {
  sleeper: 'League tunnel opening',
  league: 'Manager map locking',
  ktc: 'Value board syncing',
  dynasty: 'Market board scanning',
  csv: 'Private report staging',
  final: 'War room finalizing',
};

function createInitialLoadingSteps() {
  return initialLoadingSteps.map((step) => ({ ...step }));
}

type LoadingAnimationPhase = 'loading' | 'success' | 'reveal' | 'kick' | 'done';

export function LoadingAnimation({
  isComplete = false,
  phase = 'loading',
  leagueName,
  leagueFormat,
  leagueLogo,
  managerAnchors,
}: {
  isComplete?: boolean;
  phase?: LoadingAnimationPhase;
  leagueName?: string | null;
  leagueFormat?: string | null;
  leagueLogo?: string | null;
  managerAnchors?: LoaderManagerAnchor[];
}) {
  const [steps, setSteps] = useState<LoadingStep[]>(() => createInitialLoadingSteps());
  const [isFlashing, setIsFlashing] = useState(false);
  const prevCompletedRef = useRef(0);
  const isLoadingResolved = isComplete || phase !== 'loading';
  const shouldShowSceneBackdrop = phase === 'loading' || phase === 'success';
  const activeStep = steps.find(step => step.status === 'loading') || steps[steps.length - 1];
  const activeStepLabel = activeStep?.id === 'final'
    ? 'Final check'
    : activeStep?.label || '';
  const isCompactFinalizing = activeStep?.id === 'final';
  const completedCount = steps.filter(s => s.status === 'complete').length;
  const managerCount = managerAnchors?.length || 0;
  const activeScanLabel = loadingStepScanLabels[activeStep?.id || 'sleeper'] || 'League scan live';
  const managerCountLabel = managerCount > 0
    ? `${managerCount} manager${managerCount === 1 ? '' : 's'} locked`
    : 'Manager map live';

  useEffect(() => {
    if (completedCount > prevCompletedRef.current && completedCount > 0) {
      setIsFlashing(true);
      const t = setTimeout(() => setIsFlashing(false), 700);
      prevCompletedRef.current = completedCount;
      return () => clearTimeout(t);
    }
    prevCompletedRef.current = completedCount;
  }, [completedCount]);

  useEffect(() => {
    if (isLoadingResolved) {
      setSteps((currentSteps) => currentSteps.map((step) => ({ ...step, status: 'complete' })));
      return;
    }

    setSteps(createInitialLoadingSteps());

    const timings = [1500, 3000, 4500, 6000, 7500];
    const timers = timings.map((timing, timerIndex) => {
      return setTimeout(() => {
        setSteps(prev => {
          const newSteps = [...prev];
          const index = timerIndex + 1;
          newSteps[index - 1] = { ...newSteps[index - 1], status: 'complete' };
          newSteps[index] = { ...newSteps[index], status: 'loading' };
          return newSteps;
        });
      }, timing);
    });

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [isLoadingResolved]);

  return (
    <div className={`loading-panel analysis-loading-panel${isFlashing ? ' loading-panel-flash' : ''}`}>
      <LoadingLetterbox isComplete={isLoadingResolved} />
      <LoadingSceneBackdrop
        isActive={shouldShowSceneBackdrop}
        phase={phase}
        managerAnchors={managerAnchors}
      />
      <div className="loading-tron-backdrop analysis-loading-tron analysis-loading-loader-kit" aria-hidden="true" />
      {isLoadingResolved ? (
        <Suspense fallback={null}>
          <SuccessCard3D
            exit={phase === 'kick' || phase === 'done'}
            className="loading-success-card-3d"
          />
        </Suspense>
      ) : null}


      <div className="loading-modal-header">
        <div className="loading-premium-kicker">
          <span>{isLoadingResolved ? 'Private report' : 'League war room'}</span>
          <span className="loading-premium-kicker-manager-count">{managerCountLabel}</span>
        </div>
        {isLoadingResolved && (
          <div className="loading-modal-success-stamp">
            <CheckCircle2 aria-hidden="true" />
            <span>Report Generated</span>
          </div>
        )}
        <div className={`loading-modal-bolt${isLoadingResolved ? ' loading-modal-bolt--success' : ''}`}>
          {leagueLogo ? (
            <img src={leagueLogo} alt="" className="loading-modal-league-icon" />
          ) : (
            <Zap className="loading-modal-bolt-svg" />
          )}
        </div>
        <div className="loading-modal-league-copy">
          <h2 className="loading-league-name loading-gradient-text">
            {leagueName || 'Your League'}
          </h2>
          {leagueFormat ? <p className="loading-subtitle">{leagueFormat}</p> : null}
        </div>
      </div>

      {!isLoadingResolved && activeStep ? (
        <div
          key={activeStep.id}
          className={`loading-mobile-status${isCompactFinalizing ? ' loading-mobile-status-finalizing' : ''}`}
          role="status"
          aria-live="polite"
        >
          <span className="loading-mobile-status-meta">{activeScanLabel}</span>
          <span className="loading-mobile-status-copy">{activeStepLabel}</span>
          <span className="loading-mobile-progress-track" aria-hidden="true">
            <span className="loading-finalizing-beam" />
            <span className="loading-finalizing-node loading-finalizing-node-a" />
            <span className="loading-finalizing-node loading-finalizing-node-b" />
            <span className="loading-finalizing-node loading-finalizing-node-c" />
          </span>
        </div>
      ) : null}

      {!isLoadingResolved && (
        <div className="loading-step-list">
          <div className="loading-scan-readout" aria-hidden="true">
            <span>{activeScanLabel}</span>
            <span>{managerCountLabel}</span>
          </div>
          {steps.map((step) => {
            const isFinalizing = step.id === 'final' && step.status === 'loading';

            return (
              <div
                key={step.id}
                className={`loading-step flex items-center gap-4 loading-step-${step.status}${isFinalizing ? ' loading-step-finalizing' : ''}`}
              >
                <div className="loading-step-dot flex-shrink-0 w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center relative">
                  {step.status === 'complete' ? (
                    <div className="loading-step-complete w-full h-full rounded-full flex items-center justify-center">
                      <Check className="w-6 h-6 text-white" />
                      <Sparkles className="loading-step-spark loading-step-spark-a" aria-hidden="true" />
                      <Sparkles className="loading-step-spark loading-step-spark-b" aria-hidden="true" />
                    </div>
                  ) : isFinalizing ? (
                    <div className="loading-finalizing-core" aria-hidden="true">
                      <span className="loading-finalizing-core-ring loading-finalizing-core-ring-a" />
                      <span className="loading-finalizing-core-ring loading-finalizing-core-ring-b" />
                      <span className="loading-finalizing-core-node" />
                    </div>
                  ) : step.status === 'loading' ? (
                    <>
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 to-cyan-400 opacity-0 animate-spin" />
                      <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-cyan-300 animate-spin" />
                      </div>
                    </>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                  )}
                </div>

                <div className="flex-1">
                  <p className={`loading-step-label text-sm font-medium transition-colors ${
                    step.status === 'complete' ? 'text-cyan-300' :
                    step.status === 'loading' ? 'text-orange-300' :
                    'text-slate-500'
                  }`}>
                    {step.label}
                  </p>
                </div>

                {step.status === 'complete' && (
                  <div className="loading-step-status loading-step-status-complete text-cyan-300 text-sm font-medium">
                    Done
                  </div>
                )}
                {step.status === 'loading' && (
                  <div className="loading-finalizing-track" aria-hidden="true">
                    <span className="loading-finalizing-beam" />
                    <span className="loading-finalizing-node loading-finalizing-node-a" />
                    <span className="loading-finalizing-node loading-finalizing-node-b" />
                    <span className="loading-finalizing-node loading-finalizing-node-c" />
                  </div>
                )}
              </div>
            );
          })}

          <div className="loading-progress-bar-wrap" aria-hidden="true">
            <div
              className="loading-progress-fill"
              style={{
                width: `${(steps.filter(s => s.status === 'complete').length / steps.length) * 100}%`
              }}
            >
              <span className="loading-progress-shimmer" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
