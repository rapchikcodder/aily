// FR-002: Variable Injector
// Built-in trigger → context-block library + custom rule support

export interface InjectionRule {
  trigger: string;        // Keyword/phrase to match (case-insensitive)
  category: string;       // UI grouping label
  injectedText: string;   // Block of context to append to the mega-prompt
  custom?: boolean;       // true = user-created rule
}

// ---------- Built-in Library (FR-002.3) ----------
export const BUILT_IN_RULES: InjectionRule[] = [
  // Programming Languages
  {
    trigger: 'python',
    category: 'Programming Language',
    injectedText: `**Python Best Practices:**
- Follow PEP 8 style guide (4-space indentation, snake_case naming)
- Use type hints (e.g., def greet(name: str) -> str:)
- Prefer f-strings for formatting
- Use virtual environments (venv or conda)
- Handle exceptions with specific except clauses
- Write docstrings for public functions and classes`,
  },
  {
    trigger: 'javascript',
    category: 'Programming Language',
    injectedText: `**JavaScript Best Practices:**
- Use const/let (never var)
- Prefer async/await over raw Promises
- Use strict equality (===)
- Handle errors with try/catch in async functions
- Follow ESLint + Prettier for code style
- Use ES2020+ features where supported`,
  },
  {
    trigger: 'typescript',
    category: 'Programming Language',
    injectedText: `**TypeScript Best Practices:**
- Enable strict mode in tsconfig.json
- Avoid using 'any' — use 'unknown' for truly unknown types
- Define explicit return types for public functions
- Use interface for object shapes, type for unions/aliases
- Leverage discriminated unions for state modeling
- Use Zod or similar for runtime validation`,
  },
  {
    trigger: 'react',
    category: 'Framework',
    injectedText: `**React Best Practices:**
- Use functional components + hooks (never class components for new code)
- Keep components small and single-responsibility
- Lift state only as high as necessary
- Memoize expensive calculations with useMemo
- Use useCallback for stable function references passed to children
- Prefer composition over prop-drilling; use Context sparingly`,
  },
  {
    trigger: 'next.js',
    category: 'Framework',
    injectedText: `**Next.js Best Practices:**
- Use the App Router (app/ directory) for new projects
- Prefer Server Components; use 'use client' only when needed
- Use Server Actions for form handling and mutations
- Leverage ISR or dynamic rendering based on data freshness needs
- Use next/image for all images (automatic optimization)
- Store secrets in .env.local (never commit to git)`,
  },
  {
    trigger: 'django',
    category: 'Framework',
    injectedText: `**Django Best Practices:**
- Follow the Fat Models, Thin Views pattern
- Use Django REST Framework for APIs
- Keep settings split: base.py, development.py, production.py
- Use select_related / prefetch_related to avoid N+1 queries
- Write model-level validation, not just form-level
- Use Django's built-in auth system; extend AbstractUser if needed`,
  },

  // Industries
  {
    trigger: 'healthcare',
    category: 'Industry',
    injectedText: `**Healthcare Compliance Context:**
- HIPAA compliance is mandatory for any PHI (Protected Health Information)
- Data encryption required at rest and in transit
- Audit trails must be maintained for all PHI access
- Minimum necessary principle: only access data required for the task
- Business Associate Agreements (BAA) required with third-party vendors
- Consider HL7 FHIR standards for health data interoperability`,
  },
  {
    trigger: 'finance',
    category: 'Industry',
    injectedText: `**Financial Compliance Context:**
- PCI-DSS compliance required for payment card data
- SOX compliance for publicly traded companies (audit trails, internal controls)
- GDPR / CCPA considerations for customer financial data
- Data residency requirements may restrict where data is stored
- Immutable transaction logs are a regulatory requirement
- Consider FINRA regulations for investment-related features`,
  },
  {
    trigger: 'education',
    category: 'Industry',
    injectedText: `**Education Context:**
- FERPA compliance required for student educational records (US)
- COPPA compliance if serving users under 13
- Accessibility (WCAG 2.1 AA) is both a legal and ethical requirement
- Consider diverse learning styles: visual, auditory, kinesthetic
- Design for varying tech literacy levels (students, teachers, admins)
- Offline-first approach benefits low-connectivity environments`,
  },

  // Writing Styles
  {
    trigger: 'academic',
    category: 'Writing Style',
    injectedText: `**Academic Writing Standards:**
- Use formal, objective tone — avoid first person unless specified
- Support all claims with citations (APA, MLA, or Chicago style)
- Define technical terms before first use
- Use passive voice judiciously (active generally preferred now)
- Structure: Introduction → Literature Review → Methodology → Results → Discussion → Conclusion
- Avoid contractions and colloquialisms`,
  },
  {
    trigger: 'beginner',
    category: 'Audience Level',
    injectedText: `**Beginner Audience Guidelines:**
- Avoid jargon; when technical terms are unavoidable, define them immediately
- Use analogies to familiar, everyday concepts
- Short paragraphs and sentences (max 20 words per sentence as a guide)
- Include step-by-step instructions with numbered lists
- Anticipate confusion points and address them proactively
- Use encouraging, supportive tone`,
  },
  {
    trigger: 'expert',
    category: 'Audience Level',
    injectedText: `**Expert Audience Guidelines:**
- Assume deep domain knowledge — skip introductory context
- Use precise technical terminology without definition
- Focus on nuance, edge cases, and advanced patterns
- Reference relevant standards, papers, or established best practices
- Be concise — experts value density of information
- Welcome debate and alternative approaches`,
  },
];

// ---------- Matching Logic ----------
/**
 * Scan collected answers for trigger keywords and return
 * all matching injection rules (built-in + custom combined).
 */
export function getMatchingRules(
  answers: Array<{ value: string | string[] | number }>,
  customRules: InjectionRule[] = []
): InjectionRule[] {
  const allRules = [...BUILT_IN_RULES, ...customRules];
  const matched: InjectionRule[] = [];
  const seen = new Set<string>();

  // Flatten all answer text into one searchable string
  const answerText = answers
    .flatMap((a) => (Array.isArray(a.value) ? a.value : [String(a.value)]))
    .join(' ')
    .toLowerCase();

  for (const rule of allRules) {
    if (seen.has(rule.trigger)) continue;
    if (answerText.includes(rule.trigger.toLowerCase())) {
      matched.push(rule);
      seen.add(rule.trigger);
    }
  }

  return matched;
}

/**
 * Compile all matched injection blocks into a single
 * "Additional Context" section to append to the mega-prompt.
 */
export function compileInjections(rules: InjectionRule[]): string {
  if (rules.length === 0) return '';

  const blocks = rules
    .map((r) => r.injectedText)
    .join('\n\n');

  return `\n\n---\n## Additional Context (Auto-Injected)\n\n${blocks}`;
}
