// FR-UX: Step Progress Indicator
// Visual progress display for interview flow

import { cn } from '../../lib/utils';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  isDark: boolean;
}

export function StepIndicator({ currentStep, totalSteps, isDark }: StepIndicatorProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {steps.map((step) => {
        const isComplete = step < currentStep;
        const isCurrent = step === currentStep;

        return (
          <div
            key={step}
            className={cn(
              'relative flex items-center justify-center transition-all duration-200',
              isCurrent && 'scale-110'
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200',
                isComplete && 'bg-green-500 text-white',
                isCurrent && 'bg-blue-500 text-white',
                !isComplete && !isCurrent && (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
              )}
            >
              {step}
            </div>

            {/* Connector line */}
            {step < totalSteps && (
              <div
                className={cn(
                  'absolute left-full w-8 h-0.5 transition-all duration-200',
                  step < currentStep
                    ? 'bg-green-500'
                    : isDark ? 'bg-gray-700' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
