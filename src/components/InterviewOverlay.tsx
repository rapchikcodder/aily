// FR-001.4, FR-005.3-5.5: Main overlay orchestrator
// Manages the full interview lifecycle: Loading → Questions → Result

import { useState, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import { QuestionCard } from './QuestionCard';
import { ResultScreen } from './ResultScreen';
import { checkLocalAICapability, generateQuestions, compileMegaPrompt } from '../lib/aiEngine';
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
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return { provider: 'local' };
  }
  const result = await chrome.storage.local.get(['apiKeys', 'aiProvider']);
  const provider: AIProvider = (result.aiProvider as AIProvider | undefined) ?? 'local';
  const keys = (result.apiKeys ?? {}) as Record<string, string>;
  return {
    provider,
    apiKey: provider === 'openai' ? keys['openai'] :
            provider === 'anthropic' ? keys['anthropic'] :
            provider === 'gemini' ? keys['gemini'] : undefined,
  };
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

  // Generate questions on mount — also re-runs when runKey changes (Retry)
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const config = await loadAIConfig();
        // Auto-downgrade to gemini/openai/anthropic if local AI unavailable
        if (config.provider === 'local') {
          const localOK = await checkLocalAICapability();
          if (!localOK) {
            // Check if cloud keys exist (prioritize free Gemini)
            const storageResult = typeof chrome !== 'undefined'
              ? await chrome.storage.local.get(['apiKeys'])
              : { apiKeys: {} };
            const keys = (storageResult.apiKeys ?? {}) as Record<string, string>;
            if (keys['gemini']) { config.provider = 'gemini'; config.apiKey = keys['gemini']; }
            else if (keys['openai']) { config.provider = 'openai'; config.apiKey = keys['openai']; }
            else if (keys['anthropic']) { config.provider = 'anthropic'; config.apiKey = keys['anthropic']; }
            else {
              setErrorMsg('No AI provider available. Please add an API key in Settings.');
              setStage('error');
              return;
            }
          }
        }

        // Generate questions: use local AI directly, or background worker for cloud APIs (avoids CORS)
        let questions: Question[];
        if (config.provider === 'local') {
          try {
            // Call local AI directly from content script context (window.ai available here)
            questions = await generateQuestions(topic, config);
          } catch (localError: any) {
            // Local AI failed - auto-fallback to cloud providers
            const storageResult = typeof chrome !== 'undefined'
              ? await chrome.storage.local.get(['apiKeys'])
              : { apiKeys: {} };
            const keys = (storageResult.apiKeys ?? {}) as Record<string, string>;

            if (keys['gemini']) { config.provider = 'gemini'; config.apiKey = keys['gemini']; }
            else if (keys['openai']) { config.provider = 'openai'; config.apiKey = keys['openai']; }
            else if (keys['anthropic']) { config.provider = 'anthropic'; config.apiKey = keys['anthropic']; }
            else {
              throw new Error('Local AI is not available. Please add a cloud API key in Settings (Gemini is free!)');
            }

            // Retry with cloud provider
            const response = await chrome.runtime.sendMessage({
              type: 'GENERATE_QUESTIONS',
              payload: { topic, provider: config.provider }
            });
            if (cancelled) return;
            if (response.error) throw new Error(response.error);
            questions = response.questions;
          }
        } else {
          // Use background worker for cloud APIs to avoid CORS
          const response = await chrome.runtime.sendMessage({
            type: 'GENERATE_QUESTIONS',
            payload: { topic, provider: config.provider }
          });
          if (cancelled) return;
          if (response.error) throw new Error(response.error);
          questions = response.questions;
        }

        if (cancelled) return;
        setQuestions(questions);
        setStage('interview');
      } catch (e: any) {
        if (!cancelled) {
          setErrorMsg(e.message ?? 'Failed to generate questions. Please try again.');
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
      setCurrentIndex((i) => i + 1);
      return;
    }
    // Last question — compile mega-prompt
    setStage('compiling');
    try {
      const config = await loadAIConfig();

      // Compile mega-prompt: use local AI directly, or background worker for cloud APIs
      let megaPromptText: string;
      if (config.provider === 'local') {
        try {
          // Call local AI directly from content script context (window.ai available here)
          megaPromptText = await compileMegaPrompt(topic, questions, answers, config);
        } catch (localError: any) {
          // Local AI failed - auto-fallback to cloud providers
          const storageResult = typeof chrome !== 'undefined'
            ? await chrome.storage.local.get(['apiKeys'])
            : { apiKeys: {} };
          const keys = (storageResult.apiKeys ?? {}) as Record<string, string>;

          if (keys['gemini']) { config.provider = 'gemini'; config.apiKey = keys['gemini']; }
          else if (keys['openai']) { config.provider = 'openai'; config.apiKey = keys['openai']; }
          else if (keys['anthropic']) { config.provider = 'anthropic'; config.apiKey = keys['anthropic']; }
          else {
            throw new Error('Local AI is not available. Please add a cloud API key in Settings (Gemini is free!)');
          }

          // Retry with cloud provider
          const response = await chrome.runtime.sendMessage({
            type: 'GENERATE_MEGA_PROMPT',
            payload: { topic, answers, questions, provider: config.provider }
          });
          if (response.error) throw new Error(response.error);
          megaPromptText = response.megaPrompt;
        }
      } else {
        // Use background worker for cloud APIs to avoid CORS
        const response = await chrome.runtime.sendMessage({
          type: 'GENERATE_MEGA_PROMPT',
          payload: { topic, answers, questions, provider: config.provider }
        });
        if (response.error) throw new Error(response.error);
        megaPromptText = response.megaPrompt;
      }

      setMegaPrompt(megaPromptText);
      setStage('result');
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Failed to compile prompt. Please try again.');
      setStage('error');
    }
  }, [currentIndex, questions, answers, topic]);

  const handleBack = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleSkip = useCallback(() => {
    handleNext();
  }, [handleNext]);

  // Styles
  const overlayBg = isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';

  return (
    /* Backdrop — position:absolute fills the full-viewport shadow host.
       Using absolute (not fixed) avoids edge-cases with position:fixed inside Shadow DOM.
       The host itself is position:fixed covering 100% of the viewport. */
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        backgroundColor: 'rgba(0,0,0,0.5)',
        pointerEvents: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Card */}
      <div
        className={cn(
          'relative rounded-2xl shadow-2xl flex flex-col overflow-hidden',
          'animate-in slide-in-from-bottom-4 fade-in duration-200',
          overlayBg
        )}
        style={{ width: 480, maxHeight: 500, minHeight: 380 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header close button (visible when not inside QuestionCard/ResultScreen) */}
        {(stage === 'loading' || stage === 'compiling' || stage === 'error') && (
          <button
            onClick={onClose}
            className={cn(
              'absolute top-3 right-4 w-7 h-7 rounded-full flex items-center justify-center text-lg transition-colors z-10',
              isDark ? 'hover:bg-red-600 text-gray-400' : 'hover:bg-red-500 hover:text-white text-gray-400'
            )}
          >
            ×
          </button>
        )}

        {/* ── Loading ── */}
        {stage === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10">
            <div className="w-10 h-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
            <p className={cn('text-sm', mutedText)}>Analyzing your topic...</p>
          </div>
        )}

        {/* ── Interview ── */}
        {stage === 'interview' && questions[currentIndex] && (
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
        )}

        {/* ── Compiling ── */}
        {stage === 'compiling' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10">
            <div className="w-10 h-10 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
            <p className={cn('text-sm', mutedText)}>Building your Mega-Prompt...</p>
          </div>
        )}

        {/* ── Result ── */}
        {stage === 'result' && (
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
        )}

        {/* ── Error ── */}
        {stage === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-10 text-center">
            <div className="text-4xl">⚠️</div>
            <p className="text-sm font-medium">{errorMsg}</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setAnswers([]); setCurrentIndex(0); setRunKey((k) => k + 1); setStage('loading'); }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                Retry
              </button>
              <button
                onClick={onClose}
                className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                )}
              >
                Close
              </button>
            </div>
            {errorMsg.includes('API key') && (
              <p className={cn('text-xs', mutedText)}>
                Open the extension popup → Settings to add your API key.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
