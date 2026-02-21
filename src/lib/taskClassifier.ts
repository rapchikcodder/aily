// Task family classifier for few-shot example selection
// Based on keyword matching - simple but effective

export type TaskFamily = 'writing' | 'coding' | 'marketing' | 'design' | 'analysis';

export type DeliverableType =
  | 'email'
  | 'document'
  | 'plan'
  | 'code'
  | 'prompt'
  | 'strategy'
  | 'script'
  | 'other';

const TASK_PATTERNS: Record<TaskFamily, string[]> = {
  writing: [
    'write', 'draft', 'email', 'letter', 'message', 'article', 'blog', 'essay',
    'document', 'report', 'memo', 'note', 'respond', 'reply', 'communicate'
  ],
  coding: [
    'code', 'program', 'develop', 'build', 'implement', 'fix', 'debug', 'refactor',
    'function', 'app', 'website', 'api', 'script', 'bug', 'error', 'test'
  ],
  marketing: [
    'marketing', 'campaign', 'strategy', 'launch', 'promote', 'brand', 'audience',
    'advertising', 'content', 'social', 'seo', 'growth', 'engagement', 'conversion'
  ],
  design: [
    'design', 'ui', 'ux', 'interface', 'layout', 'mockup', 'prototype', 'wireframe',
    'visual', 'graphic', 'logo', 'branding', 'style', 'aesthetic'
  ],
  analysis: [
    'analyze', 'research', 'plan', 'strategy', 'evaluate', 'assess', 'review',
    'compare', 'investigate', 'study', 'examine', 'understand', 'explore'
  ]
};

/**
 * Classify a topic into a task family for few-shot example selection
 */
export function classifyTaskFamily(topic: string): TaskFamily {
  const normalized = topic.toLowerCase();

  // Count matches for each family
  const scores: Record<TaskFamily, number> = {
    writing: 0,
    coding: 0,
    marketing: 0,
    design: 0,
    analysis: 0
  };

  for (const [family, patterns] of Object.entries(TASK_PATTERNS)) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern)) {
        scores[family as TaskFamily]++;
      }
    }
  }

  // Return family with highest score, default to writing
  const entries = Object.entries(scores) as [TaskFamily, number][];
  entries.sort((a, b) => b[1] - a[1]);

  return entries[0][1] > 0 ? entries[0][0] : 'writing';
}

/**
 * Deliverable type patterns
 */
const DELIVERABLE_PATTERNS: Record<DeliverableType, string[]> = {
  email: ['email', 'message', 'letter', 'reply', 'respond', 'mail'],
  document: ['document', 'doc', 'report', 'memo', 'article', 'blog', 'essay', 'write'],
  plan: ['plan', 'roadmap', 'timeline', 'schedule', 'outline', 'strategy'],
  code: ['code', 'function', 'script', 'program', 'app', 'implement', 'build', 'debug', 'fix'],
  prompt: ['prompt', 'instruction', 'template', 'guideline'],
  strategy: ['strategy', 'campaign', 'approach', 'framework', 'methodology'],
  script: ['script', 'automation', 'workflow', 'pipeline'],
  other: [],
};

/**
 * Guess the deliverable type from the topic
 */
export function guessDeliverable(topic: string): DeliverableType {
  const normalized = topic.toLowerCase();

  // Count matches for each deliverable type
  const scores: Record<DeliverableType, number> = {
    email: 0,
    document: 0,
    plan: 0,
    code: 0,
    prompt: 0,
    strategy: 0,
    script: 0,
    other: 0,
  };

  for (const [deliverable, patterns] of Object.entries(DELIVERABLE_PATTERNS)) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern)) {
        scores[deliverable as DeliverableType]++;
      }
    }
  }

  // Return deliverable with highest score, default to 'other'
  const entries = Object.entries(scores) as [DeliverableType, number][];
  entries.sort((a, b) => b[1] - a[1]);

  return entries[0][1] > 0 ? entries[0][0] : 'other';
}

/**
 * Get few-shot example for a task family
 */
/**
 * Detect if the topic is self-describing (deliverable type is already clear)
 * Examples: "tell me a story", "write a poem", "create a marketing email"
 */
export function isDeliverableObvious(topic: string): boolean {
  const normalized = topic.toLowerCase();

  const obviousPatterns = [
    // Creative writing
    /\b(story|stories|tale|narrative|fiction)\b/,
    /\b(poem|poetry|verse|haiku|sonnet)\b/,
    /\b(song|lyrics|ballad)\b/,
    /\b(joke|jokes|pun|riddle)\b/,

    // Business documents (already explicit)
    /\b(email|message|letter)\s+(to|for|about)/,
    /\b(report|document|memo|proposal)\s+(on|about|for)/,
    /\b(blog\s+post|article|essay)\s+(about|on)/,
    /\b(presentation|deck|slides)\s+(for|about)/,

    // Code (already explicit)
    /\b(function|class|component|script|code)\s+(to|for|that)/,
    /\b(app|application|website|tool)\s+(to|for|that)/,

    // Plans/strategies (already explicit)
    /\b(plan|roadmap|strategy|outline)\s+(for|to)/,
  ];

  return obviousPatterns.some(pattern => pattern.test(normalized));
}

export function getFewShotExample(family: TaskFamily): string {
  switch (family) {
    case 'writing':
      return `<example>
Topic: "write an email to a client about delayed delivery"

Good output questions:
- deliverable (radio): "What type of message is this?" options: ["Apology + new ETA", "Status update", "Compensation offer", "Request more time"]
- audience (radio): "Who is the recipient?" options: ["New client", "Existing client", "Enterprise stakeholder", "Internal team"]
- constraints (checkbox): "Any constraints to follow?" options: ["Must be under 120 words", "Must include new ETA date", "Avoid admitting fault", "Include escalation contact"]
- inputs (text): "What order/project details must be referenced (order ID, product, promised date)?"
</example>`;

    case 'coding':
      return `<example>
Topic: "fix a bug in my React app"

Good output questions:
- inputs (checkbox): "What can you share?" options: ["Error message", "Relevant code snippet", "Steps to reproduce", "Expected vs actual behavior"]
- constraints (radio): "Where should the fix be applied?" options: ["Minimal change", "Refactor ok", "Performance priority", "Stability priority"]
- deliverable (radio): "What output do you want?" options: ["Patch diff", "Explanation + fix", "Step-by-step debug plan", "Refactor proposal"]
- environment (constraints, text): "React version, bundler (Vite/Next), and where it runs (dev/prod)?"
</example>`;

    case 'marketing':
      return `<example>
Topic: "make a campaign plan for a new skincare launch"

Good output questions:
- deliverable (radio): "What do you need?" options: ["One-page strategy", "Channel plan", "Creative angles", "Full deck outline"]
- audience (radio): "Who is this for?" options: ["Brand manager", "Agency team", "Leadership", "Sales enablement"]
- constraints (checkbox): "Key constraints?" options: ["Budget range", "Timeline", "Geos", "Must include benchmarks/citations", "Regulatory limits"]
- inputs (text): "Product RTBs, target persona, and any prior performance data?"
- style_tone (scale): "1=corporate formal, 10=Gen Z punchy"
</example>`;

    case 'design':
      return `<example>
Topic: "design a mobile app login screen"

Good output questions:
- deliverable (radio): "What do you need?" options: ["Figma mockup", "Design brief", "Component specs", "Interactive prototype"]
- audience (radio): "Who will use this app?" options: ["Consumers", "Enterprise users", "Internal team", "Multi-tenant"]
- constraints (checkbox): "Design requirements?" options: ["Must support social login", "Biometric auth", "WCAG AA compliance", "Match existing brand"]
- inputs (text): "Link to brand guidelines, existing UI kit, or reference designs?"
</example>`;

    case 'analysis':
      return `<example>
Topic: "analyze competitor pricing strategy"

Good output questions:
- deliverable (radio): "What output format?" options: ["Executive summary", "Detailed report", "Comparison matrix", "Action recommendations"]
- audience (radio): "Who is this for?" options: ["CEO/leadership", "Product team", "Sales enablement", "Investor deck"]
- inputs (checkbox): "What data can you provide?" options: ["Competitor names", "Price points", "Feature comparisons", "Market segment"]
- constraints (text): "Timeline, geographic scope, or must-include/must-avoid elements?"
</example>`;

    default:
      return getFewShotExample('writing');
  }
}
