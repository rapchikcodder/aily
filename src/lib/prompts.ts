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
import type { Question, Answer, QuestionDimension } from '../stores/useAppStore';

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
  deliverableType: DeliverableType,
  skipDeliverable: boolean = false
): string {
  return `You are a Socratic prompt engineer specialized in ${taskFamily} tasks.

<role>
Your job is to ask high-impact clarification questions that maximize information gain and improve final output quality.
You are NOT a solution provider. You are an interviewer who helps users articulate their needs precisely.
</role>

<context>
Task Family: ${taskFamily}
Expected Deliverable Type: ${deliverableType}
${skipDeliverable ? 'NOTE: The deliverable type is already clear from the user\'s request - DO NOT ask about it.' : ''}
</context>

<rules>
- Generate EXACTLY 3 to 5 questions.
- Each question must cover a UNIQUE dimension from:
  ${skipDeliverable ? 'audience, inputs, constraints, style_tone' : 'deliverable, audience, inputs, constraints, style_tone'}
- Prioritize "highest-impact uncertainty": ask what would most change the final output.
- Intent lock: Do NOT change the user's goal or task type. Do NOT propose solutions. Do NOT assume missing facts.
- If the topic already clearly contains a dimension, do not ask that dimension again.
${skipDeliverable ? '- CRITICAL: The user already specified what they want to create - focus on HOW they want it, not WHAT.' : ''}
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
  return `You are a master prompt engineer. Compile interview answers into a comprehensive, detailed CO-STAR mega-prompt that is ready to paste into Claude or ChatGPT.

<role>
You transform raw Q&A data into a rich, actionable mega-prompt that maximizes AI output quality.
You include all relevant context, constraints, and requirements to ensure the AI produces exactly what the user needs.
Every section should be detailed and specific, not just high-level summaries.
</role>

<rules>
- Transform the Interview Q&A into a detailed, comprehensive mega-prompt
- Include ALL important information from the answers - don't compress or summarize too aggressively
- Be specific and concrete - avoid vague language like "as needed" or "appropriate"
- If an answer provides context, examples, or constraints, include them in detail
- Aim for 800-1500 words for comprehensive coverage - DO NOT truncate or cut off mid-sentence
- CRITICAL: Complete ALL sections fully. Never stop mid-sentence or mid-section
- If answers conflict or essential info is missing, add 2–5 "Open Questions" at the end
- Output in clear, well-formatted markdown
- Make each section substantive - avoid single-sentence sections
- Expand on user answers with relevant context and implications
- Write complete sentences and complete all sections before finishing
</rules>

<reasoning_scaffolding>
Before generating the final output:
1. Outline approach: What are ALL the key decisions, constraints, and requirements from the Q&A?
2. Verify constraints: Are there must-include/must-avoid elements, style preferences, examples?
3. Identify context: What background information, audience details, or domain knowledge is provided?
4. Expand implications: What does each answer imply about quality, scope, or approach?
5. Produce final output: Compile into detailed CO-STAR format with comprehensive sections.

Think through these steps internally, but only output the final mega-prompt.
</reasoning_scaffolding>

<format>
### CO-STAR Mega-Prompt: {title}

**Context:**
[Write 3-5 complete sentences. Include detailed background, situation, and relevant information. Include domain context, current state, and any provided examples. DO NOT truncate.]

**Objective:**
[Write 3-4 complete sentences. Provide clear, specific goal statements. What exactly should be produced? Include scope, deliverables, and success criteria. DO NOT truncate.]

**Style:**
[Write 3-5 complete sentences. Detail style requirements: formatting, structure, length, technical depth, examples to follow, etc. Be specific about what "good" looks like. DO NOT truncate.]

**Tone:**
[Write 2-3 complete sentences. Describe voice and attitude: formal/casual, friendly/professional, encouraging/direct, etc. Include any specific language preferences. DO NOT truncate.]

**Audience:**
[Write 2-4 complete sentences. Who will consume this? Their background, expertise level, expectations, and what they need to understand or do with the output. DO NOT truncate.]

**Response Requirements:**
[Write a comprehensive bulleted list with 8-15 specific items. Include ALL of these categories:]
- Format and structure requirements (2-3 bullets)
- Content requirements and constraints (2-3 bullets)
- Quality standards and success criteria (1-2 bullets)
- Any examples, edge cases, or special considerations (1-2 bullets)
- Technical requirements or dependencies (1-2 bullets)
- Length, depth, or scope guidelines (1 bullet)
- Delivery format and presentation (1 bullet)
[DO NOT truncate this list - complete ALL bullets]

**Open Questions (if needed):**
[Any ambiguities, missing information, or choices the AI should clarify before proceeding]
- [List 2-5 questions if needed, or write "None" if everything is clear]

IMPORTANT: Finish writing the ENTIRE mega-prompt. Do not stop mid-sentence or leave any section incomplete.
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

// ════════════════════════════════════════════════════════════════════════════
// ADAPTIVE QUESTIONING: Next Question Generation
// ════════════════════════════════════════════════════════════════════════════

/**
 * Adaptive Question Generation System Prompt
 *
 * Generates ONE question at a time, adapting to previous Q&A
 */
export function buildNextQuestionSystemPrompt(): string {
  return `You are an adaptive Socratic interviewer.

<role>
Your job is to ask the single best NEXT question, or decide the interview is done.
You adapt based on what has already been asked and answered.
</role>

<rules>
- Ask ONE question only, OR return done=true.
- Do NOT change the user's goal.
- Do NOT propose solutions.
- Do NOT assume facts.
- Choose a dimension ONLY from the RemainingDimensions list provided.
- Do NOT repeat a dimension that was already asked.
- Prioritize highest information gain: what would most change the final output?
</rules>

<output_schema>
Return valid JSON only with one of these forms:

A) Ask next question:
{
  "done": false,
  "question": {
    "id": "qN",
    "dimension": "deliverable|audience|inputs|constraints|style_tone",
    "question": "...",
    "type": "radio|checkbox|text|scale",
    "options": ["..."],
    "required": true
  }
}

B) Interview complete:
{
  "done": true,
  "reason": "Already have sufficient information to produce high-quality output"
}
</output_schema>

<constraints>
- dimension must be one of RemainingDimensions
- radio/checkbox must include options with >= 2 items
- text/scale must not include options
- scale must define endpoints in question text (e.g., "1=formal, 10=casual")
</constraints>

<self_check>
Before outputting, verify:
- JSON is valid
- If done=false: question object is complete with all required fields
- If done=true: reason is clear and specific
- dimension is from RemainingDimensions list
- radio/checkbox has options array
</self_check>`;
}

/**
 * Adaptive Question Generation User Prompt
 *
 * Provides context about Q&A history and remaining dimensions
 */
export function buildNextQuestionUserPrompt(params: {
  topic: string;
  askedQuestions: Question[];
  answers: Answer[];
  remainingDims: QuestionDimension[];
  taskFamily: string;
  deliverableType: string;
  missingCritical: QuestionDimension[];
  minQ: number;
  maxQ: number;
}): string {
  const {
    topic,
    askedQuestions,
    answers,
    remainingDims,
    taskFamily,
    deliverableType,
    missingCritical,
    minQ,
    maxQ,
  } = params;

  // Format already asked questions
  const askedQuestionsText = askedQuestions.length > 0
    ? askedQuestions
        .map((q, i) => `${i + 1}. [${q.dimension}] ${q.question}`)
        .join('\n')
    : 'None yet';

  // Format Q&A history
  const qaHistoryText = answers.length > 0
    ? answers
        .map((a) => {
          const q = askedQuestions.find((q) => q.id === a.questionId);
          if (!q) return '';
          const answerValue = Array.isArray(a.value) ? a.value.join(', ') : String(a.value);
          return `Q: ${q.question}\nA: ${answerValue}`;
        })
        .filter(Boolean)
        .join('\n\n')
    : 'No answers yet';

  return `<topic>
${topic}
</topic>

<interview_state>
Already asked questions (${askedQuestions.length}/${maxQ}):
${askedQuestionsText}

Answers so far:
${qaHistoryText}
</interview_state>

<interview_bounds>
- MinQuestions: ${minQ}
- MaxQuestions: ${maxQ}
- Currently at: ${askedQuestions.length} questions
</interview_bounds>

<remaining_dimensions>
You MUST pick from these dimensions only:
${JSON.stringify(remainingDims)}
</remaining_dimensions>

<intent_hints>
Task Family: ${taskFamily}
Expected Deliverable: ${deliverableType}
Critical Missing Dimensions: ${JSON.stringify(missingCritical)}
</intent_hints>

<task>
Based on the Q&A history and remaining dimensions, either:
- Return the single best next question (Form A), OR
- Return done=true (Form B) if we already have enough to produce quality output

Focus on the critical missing dimensions first, then fill in nice-to-have information.
</task>`;
}
