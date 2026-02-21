/**
 * Validators — Robust JSON extraction and validation
 *
 * Handles cases where AI models add extra text, markdown fences,
 * or explanatory content around JSON output.
 */

import type { Question, QuestionDimension } from '../stores/useAppStore';

/**
 * Extract the first JSON object from text
 * Handles markdown fences, extra text, nested structures, etc.
 */
export function extractFirstJsonObject(text: string): string | null {
  // Remove markdown code fences if present
  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  // Find the first opening brace
  const start = text.indexOf('{');
  if (start === -1) return null;

  // Count braces to find the matching closing brace
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    // Handle string escaping
    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === '\\') {
      escaping = true;
      continue;
    }

    // Track if we're inside a string
    if (char === '"') {
      inString = !inString;
      continue;
    }

    // Only count braces outside of strings
    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          // Found the matching closing brace
          return text.substring(start, i + 1);
        }
      }
    }
  }

  return null;
}

/**
 * Extract the first JSON array from text
 * Handles markdown fences, extra text, etc.
 */
export function extractFirstJsonArray(text: string): string | null {
  // Try to find first [...] region
  const match = text.match(/\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/);
  return match ? match[0] : null;
}

/**
 * Safe JSON parse with error handling
 * Returns null if parsing fails
 */
export function safeJsonParse<T = any>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Validate a single question object
 * Returns array of error messages (empty if valid)
 */
export function validateQuestionObject(
  q: any,
  askedDimensions: QuestionDimension[]
): string[] {
  const errors: string[] = [];

  // Check required fields
  if (!q.id || typeof q.id !== 'string') {
    errors.push('Question must have a valid id (string)');
  }

  if (!q.question || typeof q.question !== 'string') {
    errors.push('Question must have a valid question text (string)');
  }

  if (!q.dimension || typeof q.dimension !== 'string') {
    errors.push('Question must have a valid dimension (string)');
  }

  if (!q.type || !['text', 'radio', 'checkbox', 'scale'].includes(q.type)) {
    errors.push('Question type must be: text, radio, checkbox, or scale');
  }

  // Check dimension is valid
  const validDimensions: QuestionDimension[] = [
    'deliverable',
    'audience',
    'inputs',
    'constraints',
    'style_tone',
  ];
  if (q.dimension && !validDimensions.includes(q.dimension)) {
    errors.push(`Invalid dimension "${q.dimension}". Must be one of: ${validDimensions.join(', ')}`);
  }

  // Check for duplicate dimension
  if (q.dimension && askedDimensions.includes(q.dimension)) {
    errors.push(`Dimension "${q.dimension}" has already been asked`);
  }

  // Check radio/checkbox have options
  if ((q.type === 'radio' || q.type === 'checkbox')) {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      errors.push(`Question type "${q.type}" must have options array with at least 2 items`);
    }
  }

  // Check text/scale don't have options
  if ((q.type === 'text' || q.type === 'scale') && q.options) {
    errors.push(`Question type "${q.type}" should not have options`);
  }

  return errors;
}

/**
 * Validate "next question" response (adaptive format)
 * Returns array of error messages (empty if valid)
 *
 * Expected formats:
 * A) { done: false, question: {...} }
 * B) { done: true, reason: "..." }
 */
export function validateNextQuestionResponse(
  obj: any,
  askedQuestions: Question[],
  minQ: number,
  maxQ: number
): string[] {
  const errors: string[] = [];

  // Check done field exists and is boolean
  if (typeof obj.done !== 'boolean') {
    errors.push('Response must have a "done" field (boolean)');
    return errors; // Can't continue validation without this
  }

  if (obj.done === false) {
    // Format A: Must have question object
    if (!obj.question || typeof obj.question !== 'object') {
      errors.push('When done=false, response must include a "question" object');
      return errors;
    }

    // Validate the question object
    const askedDimensions = askedQuestions.map(q => q.dimension);
    const questionErrors = validateQuestionObject(obj.question, askedDimensions);
    errors.push(...questionErrors);

  } else {
    // Format B: Should have reason
    if (!obj.reason || typeof obj.reason !== 'string') {
      errors.push('When done=true, response should include a "reason" string');
    }

    // Check if stopping makes sense
    if (askedQuestions.length < minQ) {
      errors.push(`Cannot stop with only ${askedQuestions.length} questions (min is ${minQ})`);
    }
  }

  return errors;
}

/**
 * Validate mega-prompt output
 * Basic checks for quality and length
 */
export function validateMegaPromptText(text: string): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check length
  if (text.length < 50) {
    issues.push('Mega-prompt is too short (less than 50 characters)');
  }

  if (text.length > 5000) {
    issues.push('Mega-prompt is too long (over 5000 characters)');
  }

  // Check for CO-STAR sections
  const hasContext = /context:/i.test(text);
  const hasObjective = /objective:/i.test(text);

  if (!hasContext && !hasObjective) {
    issues.push('Mega-prompt missing CO-STAR structure (no Context or Objective found)');
  }

  // Check for placeholder text (model didn't fill in)
  if (text.includes('...') && text.split('...').length > 3) {
    issues.push('Mega-prompt contains too many placeholders (...)');
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
