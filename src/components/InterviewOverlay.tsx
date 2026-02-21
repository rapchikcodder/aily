// FR-001.4, FR-005.3-5.5: Main overlay orchestrator
// Manages the full interview lifecycle: Loading → Questions → Result

import { useState, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import { QuestionCard } from './QuestionCard';
import { ResultScreen } from './ResultScreen';
import { QuestionSkeleton } from './ui/SkeletonLoader';
import { PageTransition } from './ui/PageTransition';
import { checkLocalAICapability, generateNextQuestion, compileMegaPrompt } from '../lib/aiEngine';
import type { AIProvider } from '../lib/aiEngine';
import type { Question, Answer } from '../stores/useAppStore';

export type OverlayStage = 'loading' | 'interview' | 'compiling' | 'result' | 'error';

interface InterviewOverlayProps {
  topic: string;
  isDark: boolean;
  onClose: () => void;
  onReplaceText: (text: string) => void;
  onAppendText: (text: string) => void;
}

// Load AI config from chrome.storage
async function loadAIConfig(): Promise<{ provider: AIProvider; apiKey?: string }> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      console.warn('[InterviewOverlay] Chrome storage not available, using local provider');
      return { provider: 'local' };
    }
    const result = await chrome.storage.local.get(['apiKeys', 'aiProvider']);
    const provider: AIProvider = (result.aiProvider as AIProvider | undefined) ?? 'local';
    const keys = (result.apiKeys ?? {}) as Record<string, string>;
    return {
      provider,
      apiKey: provider === 'openai' ? keys['openai'] :
              provider === 'anthropic' ? keys['anthropic'] :
              provider === 'gemini' ? keys['gemini'] :
              provider === 'grok' ? keys['grok'] : undefined,
    };
  } catch (error) {
    console.error('[InterviewOverlay] Error loading AI config:', error);
    return { provider: 'local' };
  }
}

export function InterviewOverlay({
  topic,
  isDark,
  onClose,
  onReplaceText,
  onAppendText,
}: InterviewOverlayProps) {
  const [stage, setStage] = useState<OverlayStage>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [megaPrompt, setMegaPrompt] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  // Incrementing this forces the init useEffect to re-run (used by Retry button)
  const [runKey, setRunKey] = useState(0);
  // Adaptive questioning state
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [canContinueWithPartial, setCanContinueWithPartial] = useState(false);

  // Generate first question on mount — also re-runs when runKey changes (Retry)
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const config = await loadAIConfig();
        // Auto-downgrade to gemini/grok/openai/anthropic if local AI unavailable
        if (config.provider === 'local') {
          const localOK = await checkLocalAICapability();
          if (!localOK) {
            // Check if cloud keys exist (prioritize free Gemini)
            const storageResult = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)
              ? await chrome.storage.local.get(['apiKeys'])
              : { apiKeys: {} };
            const keys = (storageResult.apiKeys ?? {}) as Record<string, string>;
            if (keys['gemini']) { config.provider = 'gemini'; config.apiKey = keys['gemini']; }
            else if (keys['grok']) { config.provider = 'grok'; config.apiKey = keys['grok']; }
            else if (keys['openai']) { config.provider = 'openai'; config.apiKey = keys['openai']; }
            else if (keys['anthropic']) { config.provider = 'anthropic'; config.apiKey = keys['anthropic']; }
            else {
              setErrorMsg('No AI provider available. Please add an API key in Settings.');
              setStage('error');
              return;
            }
          }
        }

        // Generate first question adaptively
        const result = await generateNextQuestion(topic, [], [], config, 3, 5);

        if (cancelled) return;

        if (result.done) {
          // Unlikely but possible - topic is so clear no questions needed
          setStage('compiling');
          // Compile with zero questions
          const megaPromptText = await compileMegaPrompt(topic, [], [], config);
          if (cancelled) return;
          setMegaPrompt(megaPromptText);
          setStage('result');
        } else {
          setQuestions([result.question!]);
          setCurrentIndex(0);
          setStage('interview');
        }
      } catch (e: any) {
        if (!cancelled) {
          setErrorMsg(e.message ?? 'Failed to generate first question. Please try again.');
          setStage('error');
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [topic, runKey]);

  // Keyboard: Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleAnswer = useCallback((answer: Answer) => {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === answer.questionId);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = answer;
        return next;
      }
      return [...prev, answer];
    });
  }, []);

  const handleNext = useCallback(async () => {
    if (currentIndex < questions.length - 1) {
      // Still have questions in the queue - just advance
      setCurrentIndex((i) => i + 1);
      return;
    }

    // At last question - need to generate next OR compile
    setIsGeneratingNext(true);
    setGenerateError('');

    try {
      const config = await loadAIConfig();
      const result = await generateNextQuestion(
        topic,
        questions,
        answers,
        config,
        3,
        5
      );

      if (result.done) {
        // Interview complete - compile mega-prompt
        setIsGeneratingNext(false);
        setStage('compiling');

        const megaPromptText = await compileMegaPrompt(topic, questions, answers, config);
        setMegaPrompt(megaPromptText);
        setStage('result');
      } else {
        // Append new question and advance
        setQuestions((prev) => [...prev, result.question!]);
        setCurrentIndex((i) => i + 1);
        setRetryCount(0);
        setIsGeneratingNext(false);
      }
    } catch (e: any) {
      setGenerateError(e.message ?? 'Failed to generate next question');
      setRetryCount((rc) => rc + 1);
      setIsGeneratingNext(false);

      if (retryCount >= 1) {
        // Failed twice - offer to continue with what we have
        setCanContinueWithPartial(true);
      }
    }
  }, [currentIndex, questions, answers, topic, retryCount]);

  const handleBack = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleSkip = useCallback(() => {
    handleNext();
  }, [handleNext]);

  const handleContinueWithPartial = useCallback(async () => {
    setIsGeneratingNext(false);
    setGenerateError('');
    setCanContinueWithPartial(false);
    setStage('compiling');

    try {
      const config = await loadAIConfig();
      const megaPromptText = await compileMegaPrompt(topic, questions, answers, config);
      setMegaPrompt(megaPromptText);
      setStage('result');
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Failed to compile prompt. Please try again.');
      setStage('error');
    }
  }, [topic, questions, answers]);

  return (
    /* Clean backdrop */
    <div
      className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-300 bg-black/50"
      style={{ pointerEvents: 'auto' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Main card */}
      <div
        className="w-[520px] max-h-[600px] overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-500"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-full flex flex-col relative card-clean">
          {/* Header close button (visible when not inside QuestionCard/ResultScreen) */}
          {(stage === 'loading' || stage === 'compiling' || stage === 'error') && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-xl transition-all duration-300 hover:bg-red-500 hover:text-white text-gray-400 hover:scale-110 z-20"
            >
              ×
            </button>
          )}

          {/* ── Loading with Skeleton ── */}
          {stage === 'loading' && (
            <PageTransition direction="down">
              <QuestionSkeleton isDark={isDark} />
            </PageTransition>
          )}

          {/* ── Interview with Page Transitions ── */}
          {stage === 'interview' && questions[currentIndex] && (
            <>
              <PageTransition key={currentIndex} direction="right">
                <QuestionCard
                  question={questions[currentIndex]}
                  currentIndex={currentIndex}
                  total={questions.length}
                  existingAnswer={answers.find((a) => a.questionId === questions[currentIndex].id)}
                  onAnswer={handleAnswer}
                  onNext={handleNext}
                  onBack={handleBack}
                  onSkip={handleSkip}
                  isDark={isDark}
                />
              </PageTransition>

              {/* Loading Next Question */}
              {isGeneratingNext && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                  <div className="p-6 flex flex-col items-center gap-3 card-clean">
                    <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Thinking of next question...
                    </p>
                  </div>
                </div>
              )}

              {/* Error Recovery */}
              {generateError && !isGeneratingNext && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                  <div className="p-6 max-w-sm text-center card-clean">
                    {/* Error message with background */}
                    <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 rounded-lg p-4 shadow-sm mb-4">
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">{generateError}</p>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => {
                          setGenerateError('');
                          handleNext();
                        }}
                        className="btn-primary"
                      >
                        Retry
                      </button>
                      {canContinueWithPartial && (
                        <button
                          onClick={handleContinueWithPartial}
                          className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          Continue with Current Answers
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Compiling with Clean Spinner ── */}
          {stage === 'compiling' && (
            <PageTransition direction="up">
              <div className="flex-1 flex flex-col items-center justify-center gap-6 p-12">
                <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin" />
                {/* Status text with background card */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-6 shadow-sm text-center max-w-md">
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Crafting your mega-prompt...
                  </p>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    This usually takes 3-5 seconds
                  </div>
                </div>
              </div>
            </PageTransition>
          )}

          {/* ── Result with Success Checkmark ── */}
          {stage === 'result' && (
            <PageTransition direction="up">
              {/* Success checkmark */}
              <div className="absolute top-4 right-4 w-12 h-12 z-20">
                <div className="w-full h-full rounded-full bg-green-500 flex items-center justify-center text-white text-2xl animate-in zoom-in duration-500 shadow-md">
                  ✓
                </div>
              </div>
              <ResultScreen
                megaPrompt={megaPrompt}
                originalTopic={topic}
                isDark={isDark}
                onReplace={() => { onReplaceText(megaPrompt); onClose(); }}
                onAppend={() => { onAppendText(megaPrompt); onClose(); }}
                onCopy={() => {}}
                onStartOver={() => { setStage('loading'); setAnswers([]); setCurrentIndex(0); }}
                onClose={onClose}
              />
            </PageTransition>
          )}

          {/* ── Error State ── */}
          {stage === 'error' && (
            <PageTransition direction="down">
              <div className="flex-1 flex flex-col items-center justify-center gap-5 p-10 text-center">
                {/* Error message with background card */}
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 rounded-lg p-6 shadow-sm max-w-md">
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">{errorMsg}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setAnswers([]); setCurrentIndex(0); setRunKey((k) => k + 1); setStage('loading'); }}
                    className="btn-primary"
                  >
                    Retry
                  </button>
                  <button
                    onClick={onClose}
                    className="btn-secondary"
                  >
                    Close
                  </button>
                </div>
                {errorMsg.includes('API key') && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Open the extension popup → Settings to add your API key.
                  </p>
                )}
              </div>
            </PageTransition>
          )}
        </div>
      </div>
    </div>
  );
}
