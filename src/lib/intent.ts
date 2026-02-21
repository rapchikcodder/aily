/**
 * Intent Inference — Analyze user's goal and guide question prioritization
 *
 * Uses task classification and answer analysis to determine:
 * - What type of task this is (writing, coding, marketing, etc.)
 * - What deliverable they want (email, code, plan, etc.)
 * - Which dimensions are already known vs. missing
 * - Which missing dimensions are critical for this task type
 */

import type { Question, Answer, QuestionDimension } from '../stores/useAppStore';
import { classifyTaskFamily, guessDeliverable, type TaskFamily, type DeliverableType } from './taskClassifier';

export interface IntentAnalysis {
  taskFamily: TaskFamily;
  deliverableHint: {
    kind: DeliverableType;
    confidence: number;  // 0-1 score
  };
  knownDimensions: Record<QuestionDimension, boolean>;
  missingCritical: QuestionDimension[];  // Dimensions we MUST ask
}

/**
 * Infer user intent from topic and Q&A history
 */
export function inferIntent(
  topic: string,
  askedQuestions: Question[],
  answers: Answer[]
): IntentAnalysis {
  // Step 1: Classify task and deliverable from topic
  const taskFamily = classifyTaskFamily(topic);
  const deliverableType = guessDeliverable(topic);

  // Step 2: Analyze which dimensions are already known
  const knownDimensions: Record<QuestionDimension, boolean> = {
    deliverable: false,
    audience: false,
    inputs: false,
    constraints: false,
    style_tone: false,
  };

  // Mark dimensions as known if they've been asked
  for (const q of askedQuestions) {
    if (q.dimension) {
      knownDimensions[q.dimension] = true;
    }
  }

  // Step 3: Determine critical missing dimensions based on task family
  const missingCritical: QuestionDimension[] = [];

  switch (taskFamily) {
    case 'coding':
      // For coding: inputs (error messages, code) is critical
      if (!knownDimensions.inputs) missingCritical.push('inputs');
      if (!knownDimensions.constraints) missingCritical.push('constraints');
      if (!knownDimensions.deliverable) missingCritical.push('deliverable');
      break;

    case 'writing':
      // For writing: deliverable + audience is critical
      if (!knownDimensions.deliverable) missingCritical.push('deliverable');
      if (!knownDimensions.audience) missingCritical.push('audience');
      if (!knownDimensions.constraints) missingCritical.push('constraints');
      break;

    case 'marketing':
      // For marketing: deliverable + audience + constraints is critical
      if (!knownDimensions.deliverable) missingCritical.push('deliverable');
      if (!knownDimensions.audience) missingCritical.push('audience');
      if (!knownDimensions.constraints) missingCritical.push('constraints');
      break;

    case 'design':
      // For design: deliverable + constraints is critical
      if (!knownDimensions.deliverable) missingCritical.push('deliverable');
      if (!knownDimensions.constraints) missingCritical.push('constraints');
      if (!knownDimensions.audience) missingCritical.push('audience');
      break;

    case 'analysis':
      // For analysis: inputs + deliverable is critical
      if (!knownDimensions.inputs) missingCritical.push('inputs');
      if (!knownDimensions.deliverable) missingCritical.push('deliverable');
      if (!knownDimensions.constraints) missingCritical.push('constraints');
      break;
  }

  // Step 4: Calculate confidence for deliverable hint
  // Higher confidence if topic explicitly mentions it
  let confidence = 0.5;  // Base confidence
  if (deliverableType !== 'other') {
    confidence = 0.7;  // Topic had matching keywords
  }

  // Increase confidence if deliverable dimension already asked and answered
  if (knownDimensions.deliverable) {
    const deliverableAnswer = answers.find(a => {
      const q = askedQuestions.find(q => q.id === a.questionId);
      return q?.dimension === 'deliverable';
    });

    if (deliverableAnswer) {
      confidence = 0.9;  // User explicitly told us the deliverable
    }
  }

  return {
    taskFamily,
    deliverableHint: {
      kind: deliverableType,
      confidence,
    },
    knownDimensions,
    missingCritical,
  };
}
