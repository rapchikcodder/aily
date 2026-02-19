/**
 * Unified Prompt Library — Single Source of Truth
 * All AI prompts for the Prompt Architect extension
 *
 * Architecture:
 * - Stage 1: Question Generation (Socratic interview)
 * - Stage 2: Mega-Prompt Compilation (CO-STAR framework)
 * - Critic: Quality validation and refinement
 */

import type { TaskFamily, DeliverableType } from './taskClassifier';
import type { Question, Answer } from '../stores/useAppStore';

// ════════════════════════════════════════════════════════════════════════════
// STAGE 1: QUESTION GENERATION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Stage 1 System Prompt: Socratic Question Generator
 *
 * Features:
 * - Role definition
 * - Intent lock rules
 * - Dimension taxonomy (deliverable, audience, inputs, constraints, style_tone)
 * - Highest-impact uncertainty principle
 * - Self-check validation
 *
 * @param fewShotExample - Task-specific example for few-shot learning
 * @param taskFamily - Detected task family (writing, coding, etc.)
 * @param deliverableType - Detected deliverable type (email, code, etc.)
 */
export function getQuestionGenerationSystemPrompt(
  fewShotExample: string,
  taskFamily: TaskFamily,
  deliverableType: DeliverableType
): string {
  return `You are a Socratic prompt engineer specialized in ${taskFamily} tasks.

<role>
Your job is to ask high-impact clarification questions that maximize information gain and improve final output quality.
You are NOT a solution provider. You are an interviewer who helps users articulate their needs precisely.
</role>

<context>
Task Family: ${taskFamily}
Expected Deliverable Type: ${deliverableType}
</context>

<rules>
- Generate EXACTLY 3 to 5 questions.
- Each question must cover a UNIQUE dimension from:
  deliverable, audience, inputs, constraints, style_tone
- Prioritize "highest-impact uncertainty": ask what would most change the final output.
- Intent lock: Do NOT change the user's goal or task type. Do NOT propose solutions. Do NOT assume missing facts.
- If the topic already clearly contains a dimension, do not ask that dimension again.
- Be specific: never ask "tell me more" or vague questions.
- Avoid redundancy: each question should maximize unique information gain.
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
- questions maximize information gain (not fluff)
If any check fails, silently revise and output only the corrected JSON.
</self_check_before_output>`;
}

/**
 * Stage 1 User Prompt: Topic to analyze
 */
export function getQuestionGenerationUserPrompt(topic: string): string {
  return `<topic>
The user wants to: "${topic}"
</topic>

Generate the questions now.`;
}

/**
 * Stage 1 Repair Prompt: Fix validation errors
 */
export function getQuestionRepairPrompt(
  originalSystemPrompt: string,
  validationError: string
): string {
  return `${originalSystemPrompt}

<repair>
Previous output had error: ${validationError}
Fix it and return valid JSON.
</repair>`;
}

// ════════════════════════════════════════════════════════════════════════════
// STAGE 2: MEGA-PROMPT COMPILATION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Stage 2 System Prompt: Mega-Prompt Compiler with Reasoning Scaffolding
 *
 * Features:
 * - Decision Summary approach (not verbatim Q&A dump)
 * - Reasoning scaffolding (outline → verify → output)
 * - Length control (~250-400 words)
 * - Open Questions section for ambiguity
 * - CO-STAR framework structure
 */
export function getMegaPromptSystemPrompt(): string {
  return `You are a master prompt engineer. Compile interview answers into a single structured CO-STAR mega-prompt that is ready to paste into Claude or ChatGPT.

<role>
You transform raw Q&A data into a clean, actionable mega-prompt that maximizes AI output quality.
You prioritize signal over noise and ensure every word adds value.
</role>

<rules>
- Convert the Interview Q&A into a compact "Decision Summary" (not a verbatim dump).
- Prioritize only decisions that materially affect the output.
- If an answer is vague/low-signal, compress it to <= 10 words.
- If answers conflict or essential info is missing, add 1–3 "Open Questions" at the end.
- Keep the final mega-prompt ~250–400 words unless the user explicitly requested long form.
- Output in clear markdown.
</rules>

<reasoning_scaffolding>
Before generating the final output:
1. Outline approach: What are the key decisions from the Q&A?
2. Verify constraints: Are there must-include/must-avoid elements?
3. Produce final output: Compile into CO-STAR format.

Think through these steps internally, but only output the final mega-prompt.
</reasoning_scaffolding>

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
}

/**
 * Stage 2 User Prompt: Compile Q&A into mega-prompt
 */
export function getMegaPromptUserPrompt(
  topic: string,
  answers: Answer[],
  questions: Question[],
  injectionBlocks: string
): string {
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
}

// ════════════════════════════════════════════════════════════════════════════
// CRITIC STEP: QUALITY VALIDATION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Detect if mega-prompt needs critic review
 *
 * Triggers critic if:
 * - Answers are too vague/generic
 * - Missing critical information
 * - Potential conflicts in requirements
 */
export function shouldRunCritic(
  answers: Answer[],
  questions: Question[]
): { needsCritic: boolean; reason?: string } {
  // Check for vague answers
  const vaguenessCount = answers.filter((a) => {
    if (typeof a.value === 'string') {
      const normalized = a.value.toLowerCase().trim();
      return (
        normalized.length < 10 ||
        normalized === 'not sure' ||
        normalized === 'maybe' ||
        normalized === 'idk' ||
        normalized === 'n/a'
      );
    }
    return false;
  }).length;

  if (vaguenessCount >= 2) {
    return { needsCritic: true, reason: 'Multiple vague answers detected' };
  }

  // Check for missing required answers
  const missingCount = questions.filter((q) => {
    return q.required && !answers.find((a) => a.questionId === q.id);
  }).length;

  if (missingCount > 0) {
    return { needsCritic: true, reason: 'Missing required information' };
  }

  // Check for conflicting constraints (basic heuristic)
  const constraintAnswers = answers.filter((a) => {
    const q = questions.find((q) => q.id === a.questionId);
    return q?.dimension === 'constraints';
  });

  if (constraintAnswers.length > 1) {
    // Check if any answers contain contradictory words
    const allText = constraintAnswers
      .map((a) => (Array.isArray(a.value) ? a.value.join(' ') : String(a.value)))
      .join(' ')
      .toLowerCase();

    const hasConflict =
      (allText.includes('formal') && allText.includes('casual')) ||
      (allText.includes('short') && allText.includes('long')) ||
      (allText.includes('technical') && allText.includes('simple'));

    if (hasConflict) {
      return { needsCritic: true, reason: 'Potential conflicting constraints' };
    }
  }

  return { needsCritic: false };
}

/**
 * Critic System Prompt: Improve clarity and specificity
 */
export function getCriticSystemPrompt(): string {
  return `You are a prompt quality critic. Your job is to improve an existing mega-prompt for clarity and specificity without changing the user's intent.

<role>
You refine prompts by:
- Removing ambiguity
- Adding missing critical details when inferable
- Improving structure for better AI comprehension
- Maintaining the original goal and constraints
</role>

<rules>
- Do NOT change the user's original intent or goal.
- Do NOT add features or requirements that weren't requested.
- Do improve clarity, specificity, and actionability.
- Keep the length similar (~250-400 words).
- Output the improved mega-prompt in the same CO-STAR format.
</rules>`;
}

/**
 * Critic User Prompt: Improve the mega-prompt
 */
export function getCriticUserPrompt(
  originalMegaPrompt: string,
  reason: string
): string {
  return `<original_mega_prompt>
${originalMegaPrompt}
</original_mega_prompt>

<improvement_context>
This prompt needs improvement because: ${reason}
</improvement_context>

Improve the mega-prompt for clarity and specificity while maintaining the original intent.`;
}
