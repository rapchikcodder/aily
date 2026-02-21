/**
 * Interview Policy — Deterministic stop conditions and dimension ranking
 *
 * Implements rules for:
 * - When to stop the interview (avoiding unnecessary AI calls)
 * - Which dimensions to prioritize based on task family
 * - Which dimensions remain to be asked
 */

import type { Question, Answer, QuestionDimension } from '../stores/useAppStore';
import type { IntentAnalysis } from './intent';

export interface StopDecision {
  stop: boolean;
  reason?: string;
}

/**
 * Get remaining dimensions that haven't been asked yet
 */
export function remainingDimensions(
  askedQuestions: Question[]
): QuestionDimension[] {
  const allDimensions: QuestionDimension[] = [
    'deliverable',
    'audience',
    'inputs',
    'constraints',
    'style_tone',
  ];

  const askedDims = new Set(askedQuestions.map(q => q.dimension));

  return allDimensions.filter(dim => !askedDims.has(dim));
}

/**
 * Decide whether to stop the interview
 *
 * Stop Conditions:
 * 1. Hit max questions → stop
 * 2. Below min questions → continue
 * 3. In range (minQ-maxQ):
 *    - All critical dimensions covered → stop
 *    - Only style_tone remains + have deliverable + audience → stop
 *    - Otherwise → continue
 */
export function shouldStopInterview(params: {
  asked: Question[];
  answers: Answer[];
  minQ: number;
  maxQ: number;
  remainingDims: QuestionDimension[];
  intent: IntentAnalysis;
}): StopDecision {
  const { asked, minQ, maxQ, remainingDims, intent } = params;

  // Rule 1: Hit max questions → stop
  if (asked.length >= maxQ) {
    return {
      stop: true,
      reason: `Reached maximum questions (${maxQ})`,
    };
  }

  // Rule 2: Below min questions → continue
  if (asked.length < minQ) {
    return {
      stop: false,
    };
  }

  // Rule 3: In range (minQ-maxQ) - check quality
  // If all critical dimensions are covered, we can stop
  const allCriticalCovered = intent.missingCritical.every(
    criticalDim => !remainingDims.includes(criticalDim)
  );

  if (allCriticalCovered) {
    return {
      stop: true,
      reason: 'All critical dimensions covered',
    };
  }

  // If only style_tone remains AND we have deliverable + audience, stop
  // (style_tone is optional in most cases)
  if (
    remainingDims.length === 1 &&
    remainingDims[0] === 'style_tone' &&
    intent.knownDimensions.deliverable &&
    intent.knownDimensions.audience
  ) {
    return {
      stop: true,
      reason: 'Only optional style_tone dimension remains',
    };
  }

  // If no remaining dimensions, stop
  if (remainingDims.length === 0) {
    return {
      stop: true,
      reason: 'No remaining dimensions to ask',
    };
  }

  // Otherwise, continue
  return {
    stop: false,
  };
}

/**
 * Rank dimensions by priority for the given task family
 *
 * Returns dimensions in order of importance (highest priority first)
 */
export function rankDimensions(params: {
  intent: IntentAnalysis;
  remainingDims: QuestionDimension[];
}): QuestionDimension[] {
  const { intent, remainingDims } = params;

  // Define priority order based on task family
  let priorityOrder: QuestionDimension[];

  switch (intent.taskFamily) {
    case 'coding':
      // coding: inputs > constraints > deliverable > audience > style_tone
      priorityOrder = ['inputs', 'constraints', 'deliverable', 'audience', 'style_tone'];
      break;

    case 'writing':
      // writing: deliverable > audience > constraints > inputs > style_tone
      priorityOrder = ['deliverable', 'audience', 'constraints', 'inputs', 'style_tone'];
      break;

    case 'marketing':
      // marketing: deliverable > audience > constraints > inputs > style_tone
      priorityOrder = ['deliverable', 'audience', 'constraints', 'inputs', 'style_tone'];
      break;

    case 'design':
      // design: deliverable > constraints > audience > inputs > style_tone
      priorityOrder = ['deliverable', 'constraints', 'audience', 'inputs', 'style_tone'];
      break;

    case 'analysis':
      // analysis: inputs > deliverable > constraints > audience > style_tone
      priorityOrder = ['inputs', 'deliverable', 'constraints', 'audience', 'style_tone'];
      break;

    default:
      // Default fallback
      priorityOrder = ['deliverable', 'audience', 'inputs', 'constraints', 'style_tone'];
  }

  // Filter to only include remaining dimensions, in priority order
  return priorityOrder.filter(dim => remainingDims.includes(dim));
}
