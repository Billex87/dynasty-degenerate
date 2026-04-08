import { useEffect, useState } from 'react';
import { Check, Zap } from 'lucide-react';

interface LoadingStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'complete';
}

export function LoadingAnimation() {
  const [steps, setSteps] = useState<LoadingStep[]>([
    { id: 'sleeper', label: 'Hacking into Sleeper servers...', status: 'loading' },
    { id: 'league', label: 'Stealing league data & trade secrets', status: 'pending' },
    { id: 'ktc', label: 'Scraping KTC (they hate this)', status: 'pending' },
    { id: 'dynasty', label: 'Destroying FlockFantasy\'s data fortress', status: 'pending' },
    { id: 'csv', label: 'Generating your illegal advantage', status: 'pending' },
    { id: 'final', label: 'Covering our tracks...', status: 'pending' },
  ]);

  useEffect(() => {
    const timings = [1200, 2400, 3600, 4800, 6000, 7200];
    const timers = steps.map((step, index) => {
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
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="flex justify-center h-56 w-full max-w-md">
          <img 
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663529938437/NTiUsmvqK3XxXPP4p7F4CA/dynasty_degenerates_logo_blue_orange-removebg-preview_7bd1d2a6.png" 
            alt="Dynasty Degenerates Logo" 
            className="w-auto h-full object-contain"
          />
        </div>
        <p className="text-slate-400 text-sm">Analyzing your league...</p>
      </div>

      {/* Loading Steps */}
      <div className="w-full max-w-2xl space-y-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-4">
            {/* Step Indicator */}
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center relative">
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
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-2xl mt-12">
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{
              width: `${(steps.filter(s => s.status === 'complete').length / steps.length) * 100}%`
            }}
          />
        </div>
        <p className="text-slate-500 text-xs mt-3 text-center">
          {steps.filter(s => s.status === 'complete').length} of {steps.length} steps complete
        </p>
      </div>
    </div>
  );
}
