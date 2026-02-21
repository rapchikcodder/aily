// FR-001.4: Typeform-style individual question display
import { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { StepIndicator } from './ui/StepIndicator';
import type { Question, Answer } from '../stores/useAppStore';

interface QuestionCardProps {
  question: Question;
  currentIndex: number;
  total: number;
  existingAnswer?: Answer;
  onAnswer: (answer: Answer) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  isDark: boolean;
}

export function QuestionCard({
  question,
  currentIndex,
  total,
  existingAnswer,
  onAnswer,
  onNext,
  onBack,
  onSkip,
  isDark,
}: QuestionCardProps) {
  const [value, setValue] = useState<string | string[] | number>(() => {
    return existingAnswer?.value ?? (question.type === 'checkbox' ? [] : question.type === 'scale' ? 5 : '');
  });

  // Track custom "Other" input for radio and checkbox types
  const [customText, setCustomText] = useState<string>(() => {
    // For radio type: extract custom text if value starts with "Other: "
    if (question.type === 'radio' && typeof existingAnswer?.value === 'string' && existingAnswer.value.startsWith('Other: ')) {
      return existingAnswer.value.replace('Other: ', '');
    }

    // For checkbox type: extract custom text from array
    if (question.type === 'checkbox' && Array.isArray(existingAnswer?.value)) {
      const customEntry = existingAnswer.value.find(v => typeof v === 'string' && v.startsWith('Other: '));
      return customEntry ? customEntry.replace('Other: ', '') : '';
    }

    return '';
  });

  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus on mount / question change
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [question.id]);

  const handleCommit = () => {
    let finalValue = value;

    // For radio type: include custom text if "Other" is selected
    if (question.type === 'radio' && value === 'Other') {
      if (customText.trim()) {
        finalValue = `Other: ${customText.trim()}`;
      } else {
        // "Other" selected but no custom text - keep just "Other"
        finalValue = 'Other';
      }
    }

    // For checkbox type: include custom text if "Other" is selected
    if (question.type === 'checkbox' && Array.isArray(value)) {
      const hasOther = value.includes('Other');
      const filteredValue = value.filter(v => v !== 'Other');

      if (hasOther && customText.trim()) {
        finalValue = [...filteredValue, `Other: ${customText.trim()}`];
      } else if (hasOther) {
        // "Other" selected but no custom text - keep just "Other"
        finalValue = [...filteredValue, 'Other'];
      } else {
        finalValue = filteredValue;
      }
    }

    const isEmpty = Array.isArray(finalValue) ? finalValue.length === 0 : finalValue === '' || finalValue === null;
    if (isEmpty && question.required) return;
    onAnswer({ questionId: question.id, value: finalValue });
    onNext();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommit();
    }
  };

  const hasValue = Array.isArray(value) ? value.length > 0 : value !== '' && value !== null;

  return (
    <div className="h-full flex flex-col card-clean">
      {/* Step indicator instead of progress bar */}
      <StepIndicator currentStep={currentIndex + 1} totalSteps={total} isDark={isDark} />

      {/* Question + Input */}
      <div className="flex-1 flex flex-col justify-center px-6 py-4 gap-6 overflow-y-auto">
        {/* Question text with background card */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center leading-tight">
            {question.question}
          </h2>
        </div>

        {/* Text input with clean styling */}
        {question.type === 'text' && (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value as string}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            rows={4}
            className="input-clean resize-none text-sm"
          />
        )}

        {/* Radio (single choice) with clean selection */}
        {question.type === 'radio' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {question.options?.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setValue(opt)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all duration-200',
                    value === opt
                      ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 bg-white dark:bg-gray-800'
                  )}
                >
                  {opt}
                </button>
              ))}

              {/* "Other" option */}
              <button
                onClick={() => setValue('Other')}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all duration-200',
                  value === 'Other'
                    ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 bg-white dark:bg-gray-800'
                )}
              >
                Other (please specify)
              </button>
            </div>

            {/* Custom text input for "Other" */}
            {value === 'Other' && (
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Please specify..."
                autoFocus
                className="input-clean text-sm"
              />
            )}
          </div>
        )}

        {/* Checkbox (multi choice) with clean selection */}
        {question.type === 'checkbox' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {question.options?.map((opt) => {
                const selected = (value as string[]).includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      const current = value as string[];
                      setValue(
                        selected ? current.filter((v) => v !== opt) : [...current, opt]
                      );
                    }}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all duration-200 flex items-center gap-3',
                      selected
                        ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 bg-white dark:bg-gray-800'
                    )}
                  >
                    <span
                      className={cn(
                        'w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center',
                        selected ? 'border-white bg-transparent' : 'border-current'
                      )}
                    >
                      {selected && (
                        <svg viewBox="0 0 10 8" className="w-3 h-3 fill-current">
                          <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}

              {/* "Other" option */}
              <button
                onClick={() => {
                  const current = value as string[];
                  const hasOther = current.includes('Other');
                  setValue(
                    hasOther ? current.filter((v) => v !== 'Other') : [...current, 'Other']
                  );
                }}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all duration-200 flex items-center gap-3',
                  (value as string[]).includes('Other')
                    ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 bg-white dark:bg-gray-800'
                )}
              >
                <span
                  className={cn(
                    'w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center',
                    (value as string[]).includes('Other') ? 'border-white bg-transparent' : 'border-current'
                  )}
                >
                  {(value as string[]).includes('Other') && (
                    <svg viewBox="0 0 10 8" className="w-3 h-3 fill-current">
                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span>Other (please specify)</span>
              </button>
            </div>

            {/* Custom text input for "Other" */}
            {(value as string[]).includes('Other') && (
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Please specify..."
                className="input-clean text-sm"
              />
            )}
          </div>
        )}

        {/* Scale slider */}
        {question.type === 'scale' && (
          <div className="flex flex-col gap-3">
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="range"
              min={1}
              max={10}
              value={value as number}
              onChange={(e) => setValue(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs opacity-60">
              <span>1</span>
              <span className="text-base font-bold opacity-100">{value}</span>
              <span>10</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          {currentIndex > 0 && (
            <button
              onClick={onBack}
              className="btn-secondary"
            >
              ← Back
            </button>
          )}
          {!question.required && (
            <button onClick={onSkip} className="text-sm opacity-50 hover:opacity-80 transition-opacity underline">
              Skip
            </button>
          )}
        </div>
        <button
          onClick={handleCommit}
          disabled={!hasValue && question.required}
          className={cn(
            'btn-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {currentIndex === total - 1 ? 'Finish' : 'Next'} →
        </button>
      </div>
    </div>
  );
}
