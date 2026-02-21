// FR-001.2, FR-001.3, FR-003: AI Engine — Dual-Core (Local + Cloud)
// Handles question generation and mega-prompt compilation

import type { Question, Answer } from '../stores/useAppStore';
import { getMatchingRules, compileInjections } from './variableInjector';
import type { InjectionRule } from './variableInjector';
import { classifyTaskFamily, guessDeliverable, getFewShotExample, isDeliverableObvious } from './taskClassifier';
import {
  getQuestionGenerationSystemPrompt,
  getQuestionGenerationUserPrompt,
  getQuestionRepairPrompt,
  getMegaPromptSystemPrompt,
  getMegaPromptUserPrompt,
  shouldRunCritic,
  getCriticSystemPrompt,
  getCriticUserPrompt,
  buildNextQuestionSystemPrompt,
  buildNextQuestionUserPrompt,
  // V3 prompts
  getV3Stage1SystemPrompt,
  getV3Stage1UserPrompt,
  getV3Stage1JsonSchema,
  getV3Stage2SystemPrompt,
  getV3Stage2UserPrompt,
} from './prompts';
import { extractFirstJsonObject, safeJsonParse, validateNextQuestionResponse } from './validators';
import { inferIntent } from './intent';
import { remainingDimensions, shouldStopInterview } from './interviewPolicy';

// ---------- Types ----------
export type AIProvider = 'local' | 'openai' | 'anthropic' | 'gemini' | 'grok';

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

/**
 * Unified completion function (local or cloud via background)
 * Consolidates all "call model" paths into one function
 * Automatically falls back to cloud providers if local AI fails
 */
async function completeWithProvider(
  config: AIEngineConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  temperature: number = 0.7,
  maxTokens: number = 2048
): Promise<string> {
  if (config.provider === 'local') {
    // Local AI: use window.ai directly, with auto-fallback to cloud
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsg = messages.find(m => m.role === 'user');

    if (!systemMsg || !userMsg) {
      throw new Error('Invalid message format: must have system and user messages');
    }

    try {
      return await generateWithLocalAI(systemMsg.content, userMsg.content);
    } catch (localError: any) {
      // Local AI failed - auto-fallback to cloud providers
      console.warn('[AI Engine] Local AI failed, falling back to cloud provider:', localError.message);

      // Get available cloud API keys
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        throw new Error('Local AI is not available and Chrome storage is not accessible for cloud fallback');
      }

      const storageResult = await chrome.storage.local.get(['apiKeys']);
      const keys = (storageResult.apiKeys ?? {}) as Record<string, string>;

      // Try cloud providers in order: gemini (free) → grok → openai → anthropic
      let fallbackProvider: 'gemini' | 'grok' | 'openai' | 'anthropic' | null = null;
      if (keys['gemini']) fallbackProvider = 'gemini';
      else if (keys['grok']) fallbackProvider = 'grok';
      else if (keys['openai']) fallbackProvider = 'openai';
      else if (keys['anthropic']) fallbackProvider = 'anthropic';

      if (!fallbackProvider) {
        throw new Error('Local AI is not available. Please add a cloud API key in Settings (Gemini is free!)');
      }

      console.log(`[AI Engine] Falling back to ${fallbackProvider}`);

      // Retry with cloud provider
      const response = await chrome.runtime.sendMessage({
        type: 'AI_RAW_COMPLETE',
        payload: {
          provider: fallbackProvider,
          messages,
          temperature,
          maxTokens,
        },
      });

      if (!response.ok) {
        throw new Error(response.error || 'Cloud AI fallback failed');
      }

      return response.text;
    }
  } else {
    // Cloud AI: send to background via AI_RAW_COMPLETE
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      throw new Error('Chrome runtime not available');
    }

    const response = await chrome.runtime.sendMessage({
      type: 'AI_RAW_COMPLETE',
      payload: {
        provider: config.provider,
        messages,
        temperature,
        maxTokens,
      },
    });

    if (!response.ok) {
      throw new Error(response.error || 'AI completion failed');
    }

    return response.text;
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
 *
 * @deprecated Use generateNextQuestion() instead for adaptive questioning
 * This function is kept as a fallback for compatibility
 */
export async function generateQuestions(
  topic: string,
  config: AIEngineConfig
): Promise<Question[]> {
  // Step 1: Classify task and deliverable
  const taskFamily = classifyTaskFamily(topic);
  const deliverableType = guessDeliverable(topic);
  const fewShotExample = getFewShotExample(taskFamily);

  // Check if deliverable type is already obvious from the topic
  const skipDeliverable = isDeliverableObvious(topic);

  console.log(`[AI Engine] Task: ${taskFamily}, Deliverable: ${deliverableType}, Skip Deliverable: ${skipDeliverable}`);

  // Step 2: Generate questions with world context
  const systemPrompt = getQuestionGenerationSystemPrompt(fewShotExample, taskFamily, deliverableType, skipDeliverable);
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
 * ADAPTIVE QUESTIONING: Generate next question based on Q&A history
 *
 * Features:
 * - One question at a time (not all at once)
 * - Adapts to previous answers
 * - Stops early if enough info gathered
 * - Prioritizes critical dimensions
 *
 * Returns:
 * - { done: false, question: {...} } - Ask this question next
 * - { done: true, reason: "..." } - Interview complete
 */
export async function generateNextQuestion(
  topic: string,
  askedQuestions: Question[],
  answers: Answer[],
  config: AIEngineConfig,
  minQ: number = 3,
  maxQ: number = 5
): Promise<{
  done: boolean;
  question?: Question;
  reason?: string;
}> {
  // Step 1: Infer intent from topic and Q&A history
  const intent = inferIntent(topic, askedQuestions, answers);

  // Step 2: Calculate remaining dimensions
  const remainingDims = remainingDimensions(askedQuestions);

  console.log(`[AI Engine] Generating next question (${askedQuestions.length + 1}/${minQ}-${maxQ})`);
  console.log(`[Intent] Task: ${intent.taskFamily}, Deliverable: ${intent.deliverableHint.kind}`);
  console.log(`[Intent] Missing critical: ${JSON.stringify(intent.missingCritical)}`);

  // Step 3: Check policy stop conditions (avoids unnecessary AI call)
  const policyStop = shouldStopInterview({
    asked: askedQuestions,
    answers,
    minQ,
    maxQ,
    remainingDims,
    intent,
  });

  if (policyStop.stop) {
    console.log(`[Policy] Stop - ${policyStop.reason}`);
    return {
      done: true,
      reason: policyStop.reason,
    };
  }

  console.log(`[Policy] Continue - ${remainingDims.length} dimensions remaining`);

  // Step 4: Build adaptive prompts
  const systemPrompt = buildNextQuestionSystemPrompt();
  const userPrompt = buildNextQuestionUserPrompt({
    topic,
    askedQuestions,
    answers,
    remainingDims,
    taskFamily: intent.taskFamily,
    deliverableType: intent.deliverableHint.kind,
    missingCritical: intent.missingCritical,
    minQ,
    maxQ,
  });

  // Step 5: Call AI
  let raw = await completeWithProvider(
    config,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    0.7,
    2048
  );

  // Step 6: Parse and validate
  let retryCount = 0;
  const maxRetries = 1;

  while (retryCount <= maxRetries) {
    // Extract JSON
    const jsonStr = extractFirstJsonObject(raw);
    if (!jsonStr) {
      if (retryCount >= maxRetries) {
        throw new Error('AI did not return valid JSON object');
      }
      retryCount++;
      continue;
    }

    // Parse JSON
    const parsed = safeJsonParse(jsonStr);
    if (!parsed) {
      if (retryCount >= maxRetries) {
        throw new Error('AI returned malformed JSON');
      }
      retryCount++;
      continue;
    }

    // Validate
    const errors = validateNextQuestionResponse(parsed, askedQuestions, minQ, maxQ);

    if (errors.length > 0 && retryCount < maxRetries) {
      // Retry with repair instruction
      console.warn('[AI Engine] Validation failed, retrying...', errors);

      const repairPrompt = `${systemPrompt}

<repair>
Previous output had errors:
${errors.join('\n')}

Fix these errors and return valid JSON.
</repair>`;

      raw = await completeWithProvider(
        config,
        [
          { role: 'system', content: repairPrompt },
          { role: 'user', content: userPrompt },
        ],
        0.7,
        2048
      );

      retryCount++;
      continue;
    } else if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Success! Return parsed result
    if (parsed.done) {
      console.log('[AI Engine] Interview complete:', parsed.reason);
      return {
        done: true,
        reason: parsed.reason || 'AI decided we have enough information',
      };
    } else {
      console.log(`[AI Engine] Next question: [${parsed.question.dimension}] ${parsed.question.question.substring(0, 50)}...`);
      return {
        done: false,
        question: {
          id: parsed.question.id || `q${askedQuestions.length + 1}`,
          question: parsed.question.question,
          dimension: parsed.question.dimension,
          type: parsed.question.type || 'text',
          options: parsed.question.options || [],
          required: parsed.question.required !== false,
        },
      };
    }
  }

  throw new Error('Failed to generate next question after retries');
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

  let megaPrompt = await completeWithProvider(
    config,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    0.7,
    8192  // Increased to 8192 to ensure complete mega-prompts without truncation
  );
  megaPrompt = megaPrompt.trim();

  // Step 3: Check if critic review is needed
  const { needsCritic, reason } = shouldRunCritic(answers, questions);

  if (needsCritic && reason) {
    console.log(`[AI Engine] Running critic step: ${reason}`);

    try {
      const criticSystemPrompt = getCriticSystemPrompt();
      const criticUserPrompt = getCriticUserPrompt(megaPrompt, reason);

      const improvedMegaPrompt = await completeWithProvider(
        config,
        [
          { role: 'system', content: criticSystemPrompt },
          { role: 'user', content: criticUserPrompt },
        ],
        0.7,
        8192  // Increased to 8192 to ensure complete mega-prompts without truncation
      );
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

// ════════════════════════════════════════════════════════════════════════════
// V3: 2-API-CALL ARCHITECTURE (gpt-4o-mini + claude-3.5-sonnet)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Helper: Get API key for current provider
 * Used by V3 functions to support any provider (Gemini, OpenAI, Claude, Grok)
 */
async function getProviderKey(config: AIEngineConfig): Promise<{ provider: AIProvider; apiKey: string }> {
  // If config already has provider and key, use it
  if (config.apiKey && config.provider !== 'local') {
    return { provider: config.provider, apiKey: config.apiKey };
  }

  // Otherwise, get from storage
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    throw new Error('Chrome storage not available');
  }

  const result = await chrome.storage.local.get(['apiKeys', 'aiProvider']);
  const keys = (result.apiKeys ?? {}) as Record<string, string>;
  const savedProvider = result.aiProvider as AIProvider | undefined;

  // Priority: saved provider → first available key (Gemini → OpenAI → Anthropic → Grok)
  let provider: AIProvider;
  let apiKey: string;

  if (savedProvider && savedProvider !== 'local' && keys[savedProvider]) {
    provider = savedProvider;
    apiKey = keys[savedProvider];
  } else if (keys.gemini) {
    provider = 'gemini';
    apiKey = keys.gemini;
  } else if (keys.openai) {
    provider = 'openai';
    apiKey = keys.openai;
  } else if (keys.anthropic) {
    provider = 'anthropic';
    apiKey = keys.anthropic;
  } else if (keys.grok) {
    provider = 'grok';
    apiKey = keys.grok;
  } else {
    throw new Error('No API key found. Please add one in Settings.');
  }

  return { provider, apiKey };
}

/**
 * V3 Stage 1: Universal Context Extractor
 * Generates exactly 3-4 questions at once (using whatever provider user has)
 * Supports: OpenAI, Anthropic, Gemini, Grok
 */
export async function generateContextQuestions(
  topic: string,
  config: AIEngineConfig
): Promise<{
  genre: string;
  questions: Question[];
}> {
  console.log('[V3 Stage 1] Generating context questions...');

  // 1. Get provider and API key
  const { provider, apiKey } = await getProviderKey(config);
  console.log('[V3 Stage 1] Using provider:', provider);

  // 2. Build prompts
  const systemPrompt = getV3Stage1SystemPrompt();
  const userPrompt = getV3Stage1UserPrompt(topic);

  // 3. Call API based on provider
  let rawResponse: string;

  if (provider === 'openai') {
    // OpenAI with Structured Outputs (guaranteed valid JSON)
    const schema = getV3Stage1JsonSchema();
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'context_questions',
            strict: true,
            schema: schema,
          },
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenAI error: ${err?.error?.message ?? response.statusText}`);
    }

    const data = await response.json();
    rawResponse = data.choices[0].message.content;
  } else if (provider === 'anthropic') {
    // Anthropic Claude
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Anthropic error: ${err?.error?.message ?? response.statusText}`);
    }

    const data = await response.json();
    rawResponse = data.content[0].text;
  } else if (provider === 'gemini') {
    // Google Gemini 2.5 Flash (using v1beta API - required for generateContent)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Gemini error: ${err?.error?.message ?? response.statusText}`);
    }

    const data = await response.json();
    rawResponse = data.candidates[0].content.parts[0].text;
  } else if (provider === 'grok') {
    // xAI Grok
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-beta',
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Grok error: ${err?.error?.message ?? response.statusText}`);
    }

    const data = await response.json();
    rawResponse = data.choices[0].message.content;
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  // 4. Parse JSON response
  const jsonStr = extractFirstJsonObject(rawResponse);
  if (!jsonStr) {
    throw new Error('Failed to extract JSON from AI response');
  }

  const result = JSON.parse(jsonStr) as { genre: string; questions: any[] };

  console.log('[V3 Stage 1] Response:', result);

  // 5. Validate
  if (!result.genre || typeof result.genre !== 'string') {
    throw new Error('Invalid response: missing or invalid genre');
  }

  if (!Array.isArray(result.questions)) {
    throw new Error('Invalid response: questions must be array');
  }

  if (result.questions.length < 3 || result.questions.length > 4) {
    throw new Error(`Invalid response: expected 3-4 questions, got ${result.questions.length}`);
  }

  // 6. Normalize to Question[] format
  const questions: Question[] = result.questions.map((q: any, index: number) => ({
    id: q.id || `q${index + 1}`,
    question: q.question,
    type: 'radio' as const,
    dimension: (q.focus?.toLowerCase().replace(/\s+/g, '_') || 'constraints') as any,
    options: q.options || [],
    required: true,
  }));

  console.log('[V3 Stage 1] Generated', questions.length, 'questions');

  return {
    genre: result.genre,
    questions,
  };
}

/**
 * V3 Stage 2: Dynamic Mega-Prompt Compiler
 * Compiles Q&A into mega-prompt (using whatever provider user has)
 * Supports: OpenAI, Anthropic, Gemini, Grok
 */
export async function compileMegaPromptV3(
  topic: string,
  questions: Question[],
  answers: Answer[],
  config: AIEngineConfig
): Promise<string> {
  console.log('[V3 Stage 2] Compiling mega-prompt...');

  // 1. Get provider and API key
  const { provider, apiKey } = await getProviderKey(config);
  console.log('[V3 Stage 2] Using provider:', provider);

  // 2. Build prompts
  const systemPrompt = getV3Stage2SystemPrompt();
  const userPrompt = getV3Stage2UserPrompt(topic, answers, questions);

  // 3. Call API based on provider
  let megaPrompt: string;

  if (provider === 'openai') {
    // OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenAI error: ${err?.error?.message ?? response.statusText}`);
    }

    const data = await response.json();
    megaPrompt = data.choices[0].message.content;
  } else if (provider === 'anthropic') {
    // Anthropic Claude
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Anthropic error: ${err?.error?.message ?? response.statusText}`);
    }

    const data = await response.json();
    megaPrompt = data.content[0].text;
  } else if (provider === 'gemini') {
    // Google Gemini 2.5 Pro (using v1beta API - required for generateContent)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Gemini error: ${err?.error?.message ?? response.statusText}`);
    }

    const data = await response.json();
    megaPrompt = data.candidates[0].content.parts[0].text;
  } else if (provider === 'grok') {
    // xAI Grok
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-beta',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Grok error: ${err?.error?.message ?? response.statusText}`);
    }

    const data = await response.json();
    megaPrompt = data.choices[0].message.content;
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  // 4. Basic validation (no repair loop)
  if (!megaPrompt || megaPrompt.trim().length < 100) {
    throw new Error('Invalid mega-prompt: too short or empty');
  }

  console.log('[V3 Stage 2] Compiled mega-prompt:', megaPrompt.length, 'characters');

  return megaPrompt.trim();
}
