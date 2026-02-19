import { create } from 'zustand';

// Types matching SRS Section 3.3.1
export interface Question {
  id: string;
  question: string;
  type: 'text' | 'radio' | 'checkbox' | 'scale';
  options?: string[];
  required: boolean;
}

export interface Answer {
  questionId: string;
  value: string | string[] | number;
}

export interface Variable {
  trigger: string;
  injectedText: string;
  category: string;
}

export interface GeneratedPrompt {
  id: string;
  timestamp: string;
  originalInput: string;
  megaPrompt: string;
  context: {
    audience?: string;
    tone?: string;
    techStack?: string[];
    constraints?: Record<string, any>;
    objectives?: string;
  };
}

export type AIProvider = 'local' | 'openai' | 'anthropic' | 'gemini';

interface AppState {
  // Interview state
  currentTopic: string;
  questions: Question[];
  answers: Answer[];
  currentQuestionIndex: number;

  // AI state
  aiProvider: AIProvider;
  isLocalAIAvailable: boolean;
  localAIStatus: 'unknown' | 'ready' | 'downloading' | 'unavailable';

  // Settings
  apiKeys: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
  };
  customVariables: Variable[];

  // History
  promptHistory: GeneratedPrompt[];

  // Actions
  setTopic: (topic: string) => void;
  setQuestions: (questions: Question[]) => void;
  answerQuestion: (answer: Answer) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  resetInterview: () => void;

  checkLocalAI: () => Promise<void>;
  setAIProvider: (provider: AIProvider) => void;

  setAPIKey: (provider: 'openai' | 'anthropic' | 'gemini', key: string) => void;
  addCustomVariable: (variable: Variable) => void;
  removeCustomVariable: (trigger: string) => void;

  saveToHistory: (prompt: GeneratedPrompt) => void;
  clearHistory: () => void;

  // Load from storage
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  currentTopic: '',
  questions: [],
  answers: [],
  currentQuestionIndex: 0,

  aiProvider: 'local',
  isLocalAIAvailable: false,
  localAIStatus: 'unknown' as const,

  apiKeys: {},
  customVariables: [],

  promptHistory: [],

  // Actions
  setTopic: (topic) => set({ currentTopic: topic }),

  setQuestions: (questions) => set({ questions, currentQuestionIndex: 0 }),

  answerQuestion: (answer) => {
    const { answers } = get();
    const existingIndex = answers.findIndex(a => a.questionId === answer.questionId);

    if (existingIndex >= 0) {
      const newAnswers = [...answers];
      newAnswers[existingIndex] = answer;
      set({ answers: newAnswers });
    } else {
      set({ answers: [...answers, answer] });
    }
  },

  nextQuestion: () => {
    const { currentQuestionIndex, questions } = get();
    if (currentQuestionIndex < questions.length - 1) {
      set({ currentQuestionIndex: currentQuestionIndex + 1 });
    }
  },

  previousQuestion: () => {
    const { currentQuestionIndex } = get();
    if (currentQuestionIndex > 0) {
      set({ currentQuestionIndex: currentQuestionIndex - 1 });
    }
  },

  resetInterview: () => set({
    currentTopic: '',
    questions: [],
    answers: [],
    currentQuestionIndex: 0,
  }),

  checkLocalAI: async () => {
    // FR-001.2: Check if window.ai / Gemini Nano is available
    try {
      const win = window as any;
      if (!('ai' in win) || !('languageModel' in win.ai)) {
        set({ isLocalAIAvailable: false, localAIStatus: 'unavailable' });
        return;
      }
      const caps = await win.ai.languageModel.capabilities();
      if (caps.available === 'readily') {
        // Model is downloaded and ready
        set({ isLocalAIAvailable: true, localAIStatus: 'ready', aiProvider: 'local' });
      } else if (caps.available === 'after-download') {
        // Flags enabled but model not downloaded yet.
        // Chrome downloads it automatically in the background — just show status.
        // Do NOT call create() here: Chrome throws "An unknown error occurred when
        // fetching the script" which shows as a persistent extension error.
        set({ isLocalAIAvailable: false, localAIStatus: 'downloading' });
      } else {
        set({ isLocalAIAvailable: false, localAIStatus: 'unavailable' });
      }
    } catch (error) {
      console.error('Error checking local AI:', error);
      set({ isLocalAIAvailable: false, localAIStatus: 'unavailable' });
    }
  },

  setAIProvider: (provider) => set({ aiProvider: provider }),

  setAPIKey: (provider, key) => {
    const { apiKeys } = get();
    set({ apiKeys: { ...apiKeys, [provider]: key } });
    get().saveToStorage();
  },

  addCustomVariable: (variable) => {
    const { customVariables } = get();
    set({ customVariables: [...customVariables, variable] });
    get().saveToStorage();
  },

  removeCustomVariable: (trigger) => {
    const { customVariables } = get();
    set({ customVariables: customVariables.filter(v => v.trigger !== trigger) });
    get().saveToStorage();
  },

  saveToHistory: (prompt) => {
    const { promptHistory } = get();
    const newHistory = [prompt, ...promptHistory].slice(0, 100); // Keep last 100
    set({ promptHistory: newHistory });
    get().saveToStorage();
  },

  clearHistory: () => {
    set({ promptHistory: [] });
    get().saveToStorage();
  },

  loadFromStorage: async () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get([
          'apiKeys',
          'customVariables',
          'promptHistory',
          'aiProvider'
        ]);

        const stored = result as {
          apiKeys?: { openai?: string; anthropic?: string };
          customVariables?: Variable[];
          promptHistory?: GeneratedPrompt[];
          aiProvider?: AIProvider;
        };
        set({
          apiKeys: stored.apiKeys || {},
          customVariables: stored.customVariables || [],
          promptHistory: stored.promptHistory || [],
          aiProvider: stored.aiProvider || 'local',
        });
      } catch (error) {
        console.error('Error loading from storage:', error);
      }
    }
  },

  saveToStorage: async () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const { apiKeys, customVariables, promptHistory, aiProvider } = get();
        await chrome.storage.local.set({
          apiKeys,
          customVariables,
          promptHistory,
          aiProvider,
        });
      } catch (error) {
        console.error('Error saving to storage:', error);
      }
    }
  },
}));
