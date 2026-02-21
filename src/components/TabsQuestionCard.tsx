// V3: Tabbed question display (shows all 3-4 questions simultaneously)
// Replaces V2's one-at-a-time QuestionCard

import { useState } from 'react';
import { cn } from '../lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs';
import type { Question, Answer } from '../stores/useAppStore';

interface TabsQuestionCardProps {
  questions: Question[];
  answers: Answer[];
  onAnswersChange: (answers: Answer[]) => void;
  onSubmit: () => void;
  isDark: boolean;
}

export function TabsQuestionCard({
  questions,
  answers,
  onAnswersChange,
  onSubmit,
  isDark,
}: TabsQuestionCardProps) {
  const getAnswer = (questionId: string): string => {
    const existing = answers.find((a) => a.questionId === questionId);
    return typeof existing?.value === 'string' ? existing.value : '';
  };

  const setAnswer = (questionId: string, value: string) => {
    const existing = answers.findIndex((a) => a.questionId === questionId);
    if (existing >= 0) {
      const newAnswers = [...answers];
      newAnswers[existing] = { questionId, value };
      onAnswersChange(newAnswers);
    } else {
      onAnswersChange([...answers, { questionId, value }]);
    }
  };

  const allAnswered = questions.every((q) => {
    const answer = getAnswer(q.id);
    return answer !== '';
  });

  return (
    <div className="h-full flex flex-col card-clean">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Context Questions
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Answer all {questions.length} questions to generate your mega-prompt
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={questions[0]?.id ?? 'q1'}>
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <TabsList className="w-full grid grid-cols-4 gap-2">
            {questions.map((q, i) => {
              const isAnswered = getAnswer(q.id) !== '';
              return (
                <TabsTrigger key={q.id} value={q.id} className="relative">
                  Q{i + 1}
                  {isAnswered && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Question Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {questions.map((q) => (
            <TabsContent key={q.id} value={q.id}>
              <QuestionForm
                question={q}
                value={getAnswer(q.id)}
                onChange={(value) => setAnswer(q.id, value)}
                isDark={isDark}
              />
            </TabsContent>
          ))}
        </div>
      </Tabs>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onSubmit}
          disabled={!allAnswered}
          className={cn('w-full btn-primary', 'disabled:opacity-50 disabled:cursor-not-allowed')}
        >
          Generate Mega-Prompt →
        </button>
        {!allAnswered && (
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
            Please answer all questions to continue
          </p>
        )}
      </div>
    </div>
  );
}

// Internal: Render single question
interface QuestionFormProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  isDark: boolean;
}

function QuestionForm({ question, value, onChange, isDark }: QuestionFormProps) {
  const [customText, setCustomText] = useState('');

  return (
    <div className="space-y-4">
      {/* Question Text */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {question.question}
        </h3>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {question.options?.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              'w-full text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all',
              value === opt
                ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 bg-white dark:bg-gray-800'
            )}
          >
            {opt}
          </button>
        ))}

        {/* Custom Option */}
        <div className="space-y-2">
          <button
            onClick={() => onChange('Custom')}
            className={cn(
              'w-full text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all',
              value.startsWith('Custom')
                ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 bg-white dark:bg-gray-800'
            )}
          >
            Custom (specify below)
          </button>

          {value.startsWith('Custom') && (
            <input
              type="text"
              value={customText}
              onChange={(e) => {
                setCustomText(e.target.value);
                onChange(`Custom: ${e.target.value}`);
              }}
              placeholder="Type your custom answer..."
              className="input-clean text-sm w-full"
              autoFocus
            />
          )}
        </div>
      </div>
    </div>
  );
}
