// FR-001.2, FR-001.3, FR-003: AI Engine — Dual-Core (Local + Cloud)
// Handles question generation and mega-prompt compilation

import type { Question, Answer } from '../stores/useAppStore';
import { getMatchingRules, compileInjections } from './variableInjector';
import type { InjectionRule } from './variableInjector';

// ---------- Types ----------
export type AIProvider = 'local' | 'openai' | 'anthropic' | 'gemini';

export interface AIEngineConfig {
  provider: AIProvider;
  apiKey?: string;
  customVariables?: InjectionRule[];
}

// ---------- Prompts ----------
const QUESTION_GENERATION_SYSTEM = `You are a Socratic prompt engineer. Your job is to identify critical missing context from a user's vague idea, then craft specific, insightful questions to fill those gaps.

Rules:
1. Generate exactly 3 to 5 questions — no more, no less
2. Each question must target a DIFFERENT dimension of missing context
3. Be specific, not generic (never ask "tell me more")
4. Return ONLY valid JSON — no markdown fences, no explanation`;

const QUESTION_GENERATION_USER = (topic: string) =>
  `The user wants to: "${topic}"

Identify the most critical missing context. Return a JSON array:
[
  {
    "id": "q1",
    "question": "Specific question text?",
    "type": "radio" | "checkbox" | "text" | "scale",
    "options": ["Option A", "Option B"],  // required for radio/checkbox
    "required": true | false
  }
]

Question type guide:
- radio: choose ONE from options (e.g., experience level)
- checkbox: choose MULTIPLE (e.g., tech stack)
- text: open-ended free text
- scale: numeric 1-10 rating (omit options field)`;

const MEGA_PROMPT_SYSTEM = `You are a master prompt engineer. You compile interview answers into a single, structured CO-STAR mega-prompt ready to paste into ChatGPT or Claude.

The CO-STAR framework:
- Context: Background and relevant information
- Objective: The precise goal
- Style: Writing or output style
- Tone: Communication tone
- Audience: Who receives this output
- Response: Exact format and structure expected

Output the mega-prompt in clear markdown. Make it comprehensive but not bloated.`;

const MEGA_PROMPT_USER = (
  topic: string,
  answers: Answer[],
  questions: Question[],
  injectionBlocks: string
) => {
  const qaText = answers
    .map((a) => {
      const q = questions.find((q) => q.id === a.questionId);
      return `Q: ${q?.question ?? a.questionId}\nA: ${Array.isArray(a.value) ? a.value.join(', ') : a.value}`;
    })
    .join('\n\n');

  return `Original goal: "${topic}"

Interview Q&A:
${qaText}
${injectionBlocks}

Compile the above into a structured CO-STAR mega-prompt. The final output should be ready to paste directly into ChatGPT or Claude.`;
};

// ---------- Local AI (Gemini Nano via window.ai) ----------
async function generateWithLocalAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const win = window as any;
  if (!win.ai?.languageModel) {
    throw new Error('Local AI (window.ai) is not available');
  }

  const session = await win.ai.languageModel.create({
    systemPrompt,
  });

  const result = await session.prompt(userPrompt);
  session.destroy();
  return result;
}

// ---------- OpenAI ----------
async function generateWithOpenAI(
  system: string,
  user: string,
  apiKey: string
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.7,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI error: ${err?.error?.message ?? res.statusText}`);
  }

  const data = await res.json();
  return data.choices[0].message.content as string;
}

// ---------- Anthropic ----------
async function generateWithAnthropic(
  system: string,
  user: string,
  apiKey: string
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Anthropic error: ${err?.error?.message ?? res.statusText}`);
  }

  const data = await res.json();
  return data.content[0].text as string;
}

// ---------- Gemini ----------
async function generateWithGemini(
  system: string,
  user: string,
  apiKey: string
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: user }]
        }],
        systemInstruction: {
          parts: [{ text: system }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini error: ${err?.error?.message ?? res.statusText}`);
  }

  const data = await res.json();
  return data.candidates[0].content.parts[0].text as string;
}

// ---------- Router ----------
async function generate(
  system: string,
  user: string,
  config: AIEngineConfig
): Promise<string> {
  switch (config.provider) {
    case 'local':
      return generateWithLocalAI(system, user);
    case 'openai':
      if (!config.apiKey) throw new Error('OpenAI API key not configured');
      return generateWithOpenAI(system, user, config.apiKey);
    case 'anthropic':
      if (!config.apiKey) throw new Error('Anthropic API key not configured');
      return generateWithAnthropic(system, user, config.apiKey);
    case 'gemini':
      if (!config.apiKey) throw new Error('Gemini API key not configured');
      return generateWithGemini(system, user, config.apiKey);
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}

// ---------- Public API ----------

/**
 * FR-001.2 + FR-001.3
 * Analyze the topic and generate 3-5 Socratic questions.
 */
export async function generateQuestions(
  topic: string,
  config: AIEngineConfig
): Promise<Question[]> {
  const raw = await generate(
    QUESTION_GENERATION_SYSTEM,
    QUESTION_GENERATION_USER(topic),
    config
  );

  // Strip markdown fences if the model wrapped the JSON anyway
  const cleaned = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();

  let parsed: any[];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned malformed JSON for questions. Please try again.');
  }

  // Validate and normalise
  return parsed.map((q: any, i: number) => ({
    id: q.id ?? `q${i + 1}`,
    question: q.question,
    type: q.type ?? 'text',
    options: q.options ?? [],
    required: q.required ?? true,
  }));
}

/**
 * FR-003.1
 * Compile answers + injected variables into a CO-STAR mega-prompt.
 */
export async function compileMegaPrompt(
  topic: string,
  questions: Question[],
  answers: Answer[],
  config: AIEngineConfig
): Promise<string> {
  // FR-002.1: Match answers against variable injection rules
  const matchedRules = getMatchingRules(answers, config.customVariables ?? []);
  const injectionBlocks = compileInjections(matchedRules);

  const raw = await generate(
    MEGA_PROMPT_SYSTEM,
    MEGA_PROMPT_USER(topic, answers, questions, injectionBlocks),
    config
  );

  return raw.trim();
}

/**
 * FR-001.1: Capability check for local AI.
 * Must be called from content script / popup context (not service worker).
 */
export async function checkLocalAICapability(): Promise<boolean> {
  try {
    const win = window as any;
    if (!('ai' in win) || !('languageModel' in win.ai)) return false;
    const caps = await win.ai.languageModel.capabilities();
    return caps.available === 'readily';
  } catch {
    return false;
  }
}
