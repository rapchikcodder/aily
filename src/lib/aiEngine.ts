// FR-001.2, FR-001.3, FR-003: AI Engine — Dual-Core (Local + Cloud)
// Handles question generation and mega-prompt compilation

import type { Question, Answer } from '../stores/useAppStore';
import { getMatchingRules, compileInjections } from './variableInjector';
import type { InjectionRule } from './variableInjector';
import { classifyTaskFamily, guessDeliverable, getFewShotExample } from './taskClassifier';
import {
  getQuestionGenerationSystemPrompt,
  getQuestionGenerationUserPrompt,
  getQuestionRepairPrompt,
  getMegaPromptSystemPrompt,
  getMegaPromptUserPrompt,
  shouldRunCritic,
  getCriticSystemPrompt,
  getCriticUserPrompt,
} from './prompts';

// ---------- Types ----------
export type AIProvider = 'local' | 'openai' | 'anthropic' | 'gemini';

export interface AIEngineConfig {
  provider: AIProvider;
  apiKey?: string;
  customVariables?: InjectionRule[];
}

// ---------- Prompts ----------
// All prompts now centralized in src/lib/prompts.ts

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
 * Now with:
 * - Task family classification
 * - Deliverable type detection
 * - Few-shot examples
 * - Dimension taxonomy
 * - Self-check validation
 * - Repair loop
 */
export async function generateQuestions(
  topic: string,
  config: AIEngineConfig
): Promise<Question[]> {
  // Step 1: Classify task and deliverable
  const taskFamily = classifyTaskFamily(topic);
  const deliverableType = guessDeliverable(topic);
  const fewShotExample = getFewShotExample(taskFamily);

  console.log(`[AI Engine] Task: ${taskFamily}, Deliverable: ${deliverableType}`);

  // Step 2: Generate questions with world context
  const systemPrompt = getQuestionGenerationSystemPrompt(fewShotExample, taskFamily, deliverableType);
  const userPrompt = getQuestionGenerationUserPrompt(topic);

  let raw = await generate(systemPrompt, userPrompt, config);

  // Strip markdown fences if the model wrapped the JSON anyway
  let cleaned = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();

  // Step 3: Try to parse and validate
  let parsed: any[];
  let retryCount = 0;
  const maxRetries = 1;

  while (retryCount <= maxRetries) {
    try {
      parsed = JSON.parse(cleaned);

      // Validate schema
      const validationError = validateQuestions(parsed);
      if (validationError && retryCount < maxRetries) {
        // Retry with repair instruction
        console.warn('[AI Engine] Question validation failed, retrying...', validationError);
        const repairPrompt = getQuestionRepairPrompt(systemPrompt, validationError);
        raw = await generate(repairPrompt, userPrompt, config);
        cleaned = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
        retryCount++;
        continue;
      } else if (validationError) {
        throw new Error(validationError);
      }

      // Success!
      break;
    } catch (e: any) {
      if (retryCount >= maxRetries) {
        throw new Error('AI returned malformed JSON for questions. Please try again.');
      }
      retryCount++;
    }
  }

  // Normalize and return
  return parsed!.map((q: any, i: number) => ({
    id: q.id ?? `q${i + 1}`,
    question: q.question,
    dimension: q.dimension ?? 'constraints',
    type: q.type ?? 'text',
    options: q.options ?? [],
    required: q.required ?? true,
  }));
}

/**
 * Validate question array structure and uniqueness constraints
 */
function validateQuestions(questions: any[]): string | null {
  // Check count
  if (!Array.isArray(questions)) return 'Output must be an array';
  if (questions.length < 3 || questions.length > 5) {
    return `Must have 3-5 questions, got ${questions.length}`;
  }

  // Check dimensions are unique
  const dimensions = questions.map(q => q.dimension).filter(Boolean);
  const uniqueDimensions = new Set(dimensions);
  if (dimensions.length !== uniqueDimensions.size) {
    return 'Dimensions must be unique (no duplicates)';
  }

  // Check radio/checkbox have options
  for (const q of questions) {
    if ((q.type === 'radio' || q.type === 'checkbox') && (!q.options || q.options.length === 0)) {
      return `Question "${q.question}" is ${q.type} type but has no options`;
    }
  }

  return null; // Valid
}

/**
 * FR-003.1
 * Compile answers + injected variables into a CO-STAR mega-prompt.
 * Now with:
 * - Reasoning scaffolding
 * - Decision Summary approach
 * - Optional critic step for quality validation
 */
export async function compileMegaPrompt(
  topic: string,
  questions: Question[],
  answers: Answer[],
  config: AIEngineConfig
): Promise<string> {
  // Step 1: Match answers against variable injection rules
  const matchedRules = getMatchingRules(answers, config.customVariables ?? []);
  const injectionBlocks = compileInjections(matchedRules);

  // Step 2: Generate initial mega-prompt with reasoning scaffolding
  const systemPrompt = getMegaPromptSystemPrompt();
  const userPrompt = getMegaPromptUserPrompt(topic, answers, questions, injectionBlocks);

  let megaPrompt = await generate(systemPrompt, userPrompt, config);
  megaPrompt = megaPrompt.trim();

  // Step 3: Check if critic review is needed
  const { needsCritic, reason } = shouldRunCritic(answers, questions);

  if (needsCritic && reason) {
    console.log(`[AI Engine] Running critic step: ${reason}`);

    try {
      const criticSystemPrompt = getCriticSystemPrompt();
      const criticUserPrompt = getCriticUserPrompt(megaPrompt, reason);

      const improvedMegaPrompt = await generate(criticSystemPrompt, criticUserPrompt, config);
      megaPrompt = improvedMegaPrompt.trim();

      console.log('[AI Engine] Critic step completed successfully');
    } catch (error) {
      console.warn('[AI Engine] Critic step failed, using original mega-prompt', error);
      // Fall back to original mega-prompt if critic fails
    }
  } else {
    console.log('[AI Engine] Skipping critic step (not needed)');
  }

  return megaPrompt;
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
