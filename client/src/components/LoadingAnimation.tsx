import { useEffect, useState } from 'react';
import { Check, Sparkles, Zap } from 'lucide-react';

interface LoadingStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'complete';
}

const initialLoadingSteps: LoadingStep[] = [
  { id: 'sleeper', label: 'Hacking into Sleeper servers...', status: 'loading' },
  { id: 'league', label: 'Stealing league data & trade secrets', status: 'pending' },
  { id: 'ktc', label: 'Blending market values from multiple sources', status: 'pending' },
  { id: 'dynasty', label: 'Interrogating the dynasty market', status: 'pending' },
  { id: 'csv', label: 'Generating your illegal advantage', status: 'pending' },
  { id: 'final', label: 'Covering our tracks...', status: 'pending' },
];

function createInitialLoadingSteps() {
  return initialLoadingSteps.map((step) => ({ ...step }));
}

export function LoadingAnimation({
  isComplete = false,
  leagueName,
  leagueFormat,
  leagueLogo,
}: {
  isComplete?: boolean;
  leagueName?: string | null;
  leagueFormat?: string | null;
  leagueLogo?: string | null;
}) {
  const [steps, setSteps] = useState<LoadingStep[]>(() => createInitialLoadingSteps());

  useEffect(() => {
    if (isComplete) {
      setSteps((currentSteps) => currentSteps.map((step) => ({ ...step, status: 'complete' })));
      return;
    }

    setSteps(createInitialLoadingSteps());

    const timings = [420, 840, 1260, 1680, 2100];
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
  }, [isComplete]);

  return (
    <div className="loading-panel analysis-loading-panel">
      <div className="loading-modal-header">
        <span className="loading-modal-bolt" aria-hidden="true">
          {leagueLogo ? (
            <img src={leagueLogo} alt="" className="loading-modal-league-icon" />
          ) : (
            <Zap />
          )}
        </span>
        <div>
          <p className="loading-title">
            {isComplete ? (
              'Report locked and loaded.'
            ) : (
              <>
                <span>Analyzing </span>
                <span className="loading-title-league">{leagueName || 'your league'}</span>
                <span>...</span>
              </>
            )}
          </p>
          {leagueFormat ? <p className="loading-subtitle">{leagueFormat}</p> : null}
        </div>
      </div>

      <div className="loading-step-list">
        {steps.map((step) => (
          <div key={step.id} className={`loading-step flex items-center gap-4 loading-step-${step.status}`}>
            <div className="loading-step-dot flex-shrink-0 w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center relative">
              {step.status === 'complete' ? (
                <div className="loading-step-complete w-full h-full rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 text-white" />
                  <Sparkles className="loading-step-spark loading-step-spark-a" aria-hidden="true" />
                  <Sparkles className="loading-step-spark loading-step-spark-b" aria-hidden="true" />
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
              <p className={`text-sm font-medium transition-colors ${
                step.status === 'complete' ? 'text-cyan-300' :
                step.status === 'loading' ? 'text-orange-300' :
                'text-slate-500'
              }`}>
                {step.label}
              </p>
            </div>

            {step.status === 'complete' && (
              <div className="text-cyan-300 text-sm font-medium">Done</div>
            )}
            {step.status === 'loading' && (
              <div className="loading-football-track" aria-hidden="true">
                <span className="loading-football-arc" />
                <span className="loading-football-shadow" />
                <span className="loading-football" />
              </div>
            )}
          </div>
        ))}

        {!isComplete && (
          <>
            <p className="text-slate-500 text-xs mt-1 text-center">
              {steps.filter(s => s.status === 'complete').length} of {steps.length} steps complete
            </p>

            <div className="w-full mt-1">
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-cyan-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${(steps.filter(s => s.status === 'complete').length / steps.length) * 100}%`
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
