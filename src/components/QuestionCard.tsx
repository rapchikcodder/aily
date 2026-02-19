// FR-001.4: Typeform-style individual question display
import { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
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
  const progress = ((currentIndex + 1) / total) * 100;

  const base = isDark
    ? 'bg-gray-900 text-gray-100 border-gray-700'
    : 'bg-white text-gray-900 border-gray-200';

  const inputBase = isDark
    ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500 focus:border-blue-400'
    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500';

  const primaryBtn = 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed';
  const secondaryBtn = isDark
    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-700';

  return (
    <div className={cn('flex flex-col h-full', base)}>
      {/* Progress bar */}
      <div className={cn('h-1 w-full', isDark ? 'bg-gray-700' : 'bg-gray-100')}>
        <div
          className="h-full bg-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Progress text */}
      <div className="px-6 pt-4 pb-2 text-sm text-center opacity-60">
        Question {currentIndex + 1} of {total}
      </div>

      {/* Question + Input */}
      <div className="flex-1 flex flex-col justify-center px-6 py-4 gap-6 overflow-y-auto">
        <p className="text-lg font-semibold leading-snug text-center">
          {question.question}
        </p>

        {/* Text input */}
        {question.type === 'text' && (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value as string}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            rows={4}
            className={cn(
              'w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-colors',
              inputBase
            )}
          />
        )}

        {/* Radio (single choice) */}
        {question.type === 'radio' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {question.options?.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setValue(opt)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all',
                    value === opt
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : isDark
                      ? 'border-gray-600 bg-gray-800 text-gray-200 hover:border-blue-400'
                      : 'border-gray-300 bg-white text-gray-800 hover:border-blue-400'
                  )}
                >
                  {opt}
                </button>
              ))}

              {/* "Other" option */}
              <button
                onClick={() => setValue('Other')}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all',
                  value === 'Other'
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : isDark
                    ? 'border-gray-600 bg-gray-800 text-gray-200 hover:border-blue-400'
                    : 'border-gray-300 bg-white text-gray-800 hover:border-blue-400'
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
                className={cn(
                  'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors',
                  inputBase
                )}
              />
            )}
          </div>
        )}

        {/* Checkbox (multi choice) */}
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
                      'w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all flex items-center gap-3',
                      selected
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : isDark
                        ? 'border-gray-600 bg-gray-800 text-gray-200 hover:border-blue-400'
                        : 'border-gray-300 bg-white text-gray-800 hover:border-blue-400'
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
                    {opt}
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
                  'w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all flex items-center gap-3',
                  (value as string[]).includes('Other')
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : isDark
                    ? 'border-gray-600 bg-gray-800 text-gray-200 hover:border-blue-400'
                    : 'border-gray-300 bg-white text-gray-800 hover:border-blue-400'
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
                Other (please specify)
              </button>
            </div>

            {/* Custom text input for "Other" */}
            {(value as string[]).includes('Other') && (
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Please specify..."
                className={cn(
                  'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors',
                  inputBase
                )}
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
      <div className={cn('flex items-center justify-between px-6 py-4 border-t', isDark ? 'border-gray-700' : 'border-gray-100')}>
        <div className="flex items-center gap-3">
          {currentIndex > 0 && (
            <button onClick={onBack} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', secondaryBtn)}>
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
          className={cn('px-5 py-2 rounded-lg text-sm font-semibold transition-all', primaryBtn)}
        >
          {currentIndex === total - 1 ? 'Finish →' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
