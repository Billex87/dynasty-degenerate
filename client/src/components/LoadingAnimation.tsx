import { useEffect, useState } from 'react';
import { Check, Zap } from 'lucide-react';

const DYNASTY_LOGO_SRC = '/assets/dynasty-logo-cropped.png?v=20260428-cyan-lines';

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

export function LoadingAnimation({ isComplete = false }: { isComplete?: boolean }) {
  const [steps, setSteps] = useState<LoadingStep[]>([
    ...initialLoadingSteps,
  ]);

  useEffect(() => {
    if (isComplete) {
      setSteps((currentSteps) => currentSteps.map((step) => ({ ...step, status: 'complete' })));
      return;
    }

    const timings = [1200, 2400, 3600, 4800, 6000, 7200];
    const timers = initialLoadingSteps.map((_step, index) => {
      return setTimeout(() => {
        setSteps(prev => {
          const newSteps = [...prev];
          if (index > 0) {
            newSteps[index - 1] = { ...newSteps[index - 1], status: 'complete' };
          }
          if (index < newSteps.length) {
            newSteps[index] = { ...newSteps[index], status: 'loading' };
          }
          return newSteps;
        });
      }, timings[index]);
    });

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [isComplete]);

  return (
    <div className="loading-panel flex flex-col items-center justify-start h-auto px-4 pt-1 pb-4 sm:pt-2 sm:pb-8">
      {/* Logo Section - Top */}
      <div className="flex flex-col items-center gap-0">
        <div className="loading-logo-wrap flex justify-center h-48 sm:h-72 w-full max-w-2xl">
          <img 
            src={DYNASTY_LOGO_SRC} 
            alt="Dynasty Degenerates Logo" 
            className="w-auto h-full object-contain scale-120"
          />
        </div>
        <p className="loading-title text-slate-400 text-lg sm:text-2xl font-semibold -mt-1 sm:-mt-2 pb-2 sm:pb-4">
          {isComplete ? 'Report locked and loaded.' : 'Analyzing your league...'}
        </p>
      </div>

      {/* Loading Steps - Center */}
      <div className="w-full max-w-2xl space-y-0.5 sm:space-y-1 flex-1 flex flex-col justify-start mt-0">
        {steps.map((step, index) => (
          <div key={step.id} className="loading-step flex items-center gap-4">
            {/* Step Indicator */}
            <div className="loading-step-dot flex-shrink-0 w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center relative">
              {step.status === 'complete' ? (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center animate-pulse">
                  <Check className="w-6 h-6 text-white" />
                </div>
              ) : step.status === 'loading' ? (
                <>
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 opacity-0 animate-spin" />
                  <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-amber-300 animate-spin" />
                  </div>
                </>
              ) : (
                <div className="w-2 h-2 rounded-full bg-slate-600" />
              )}
            </div>

            {/* Step Label */}
            <div className="flex-1">
              <p className={`text-sm font-medium transition-colors ${
                step.status === 'complete' ? 'text-emerald-400' :
                step.status === 'loading' ? 'text-amber-400' :
                'text-slate-500'
              }`}>
                {step.label}
              </p>
              {step.status === 'loading' && (
                <div className="mt-1 h-1 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full animate-pulse" />
              )}
            </div>

            {/* Completion Status */}
            {step.status === 'complete' && (
              <div className="text-emerald-400 text-sm font-medium">Done</div>
            )}
          </div>
        ))}
        
        {/* Progress Counter - Right Under Steps */}
        <p className="text-slate-500 text-xs mt-1 text-center">
          {steps.filter(s => s.status === 'complete').length} of {steps.length} steps complete
        </p>
        
        {/* Progress Bar - Right Under Counter */}
        <div className="w-full mt-1">
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{
                width: `${(steps.filter(s => s.status === 'complete').length / steps.length) * 100}%`
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
