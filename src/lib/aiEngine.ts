// FR-001.2, FR-001.3, FR-003: AI Engine — Dual-Core (Local + Cloud)
// Handles question generation and mega-prompt compilation

import type { Question, Answer } from '../stores/useAppStore';
import { getMatchingRules, compileInjections } from './variableInjector';
import type { InjectionRule } from './variableInjector';
import { classifyTaskFamily, getFewShotExample } from './taskClassifier';

// ---------- Types ----------
export type AIProvider = 'local' | 'openai' | 'anthropic' | 'gemini';

export interface AIEngineConfig {
  provider: AIProvider;
  apiKey?: string;
  customVariables?: InjectionRule[];
}

// ---------- Prompts ----------
const QUESTION_GENERATION_SYSTEM = (fewShotExample: string) => `You are a Socratic prompt engineer. Your job is to ask high-impact clarification questions that improve the final output quality.

<rules>
- Generate EXACTLY 3 to 5 questions.
- Each question must cover a UNIQUE dimension from:
  deliverable, audience, inputs, constraints, style_tone
- Prioritize "highest-impact uncertainty": ask what would most change the final output.
- Intent lock: Do NOT change the user's goal or task type. Do NOT propose solutions. Do NOT assume missing facts.
- If the topic already clearly contains a dimension, do not ask that dimension again.
- Be specific: never ask "tell me more" or vague questions.
- Output MUST be valid JSON only (no markdown, no commentary).
</rules>

<output_schema>
Return a JSON array of objects with:
{
  "id": "q1" | "q2" | "q3" | "q4" | "q5",
  "dimension": "deliverable" | "audience" | "inputs" | "constraints" | "style_tone",
  "question": "string",
  "type": "radio" | "checkbox" | "text" | "scale",
  "options": ["..."] (required for radio/checkbox; omit otherwise),
  "required": true | false
}
</output_schema>

${fewShotExample}

<self_check_before_output>
Verify:
- 3–5 items
- unique dimensions
- radio/checkbox include options; scale/text omit options
- questions are specific and aligned to the original goal
If any check fails, silently revise and output only the corrected JSON.
</self_check_before_output>`;

const QUESTION_GENERATION_USER = (topic: string) =>
  `<topic>
The user wants to: "${topic}"
</topic>

Generate the questions now.`;

const MEGA_PROMPT_SYSTEM = `You are a master prompt engineer. Compile interview answers into a single structured CO-STAR mega-prompt that is ready to paste into Claude or ChatGPT.

<rules>
- Convert the Interview Q&A into a compact "Decision Summary" (not a verbatim dump).
- Prioritize only decisions that materially affect the output.
- If an answer is vague/low-signal, compress it to <= 10 words.
- If answers conflict or essential info is missing, add 1–3 "Open Questions" at the end.
- Keep the final mega-prompt ~250–400 words unless the user explicitly requested long form.
- Output in clear markdown.
</rules>

<format>
### CO-STAR Mega-Prompt: {title}

**Context:**
...

**Objective:**
...

**Style:**
...

**Tone:**
...

**Audience:**
...

**Response Requirements:**
- bullets...

**Open Questions (if needed):**
- ...
</format>`;

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

  return `<original_goal>
"${topic}"
</original_goal>

<decision_inputs>
Interview Q&A:
${qaText}

Auto-injected context blocks:
${injectionBlocks}
</decision_inputs>

Compile into CO-STAR mega-prompt now.`;
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
 * Now with dimension taxonomy, few-shot examples, and self-check validation.
 */
export async function generateQuestions(
  topic: string,
  config: AIEngineConfig
): Promise<Question[]> {
  // Step 1: Classify task family and get few-shot example
  const taskFamily = classifyTaskFamily(topic);
  const fewShotExample = getFewShotExample(taskFamily);

  // Step 2: Generate questions with task-specific example
  let raw = await generate(
    QUESTION_GENERATION_SYSTEM(fewShotExample),
    QUESTION_GENERATION_USER(topic),
    config
  );

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
        console.warn('Question validation failed, retrying...', validationError);
        raw = await generate(
          `${QUESTION_GENERATION_SYSTEM(fewShotExample)}\n\n<repair>Previous output had error: ${validationError}. Fix it and return valid JSON.</repair>`,
          QUESTION_GENERATION_USER(topic),
          config
        );
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
