The 5 changes you’re implementing

Dimension-based questions (taxonomy + uniqueness)

Intent-lock + “highest-impact uncertainty”

Few-shot examples per task family

Self-check + revise before output

Stage-2 “Decision Summary” instead of raw Q&A dump (plus hard length control)

Why these are the “best 5”: they directly match Anthropic’s guidance on structured prompting and specificity , plus proven few-shot steering .

A. Implementation plan (step-by-step)
Step 1 — Add a dimension taxonomy to Stage 1
Goal

Every question must map to a different dimension. This is the single biggest way to prevent “generic / repetitive / off-context” questions.

Dimensions (keep these fixed)

deliverable (what output is needed)

audience (who it’s for)

inputs (what materials exist / needed)

constraints (length, format, must/avoid, deadlines, citations)

style_tone (optional)

Code changes

Stage 1 JSON schema: add "dimension" field with enum above.

Validate: no duplicates, 3–5 questions total, correct type/options.

Why this is best practice

It operationalizes “different dimension” (which is otherwise subjective and fails under pressure).

Step 2 — Replace “missing context” with “highest-impact uncertainty”
Goal

Questions should focus on what would most change the final output (not “nice-to-know”).

Code changes

Update Stage 1 system prompt: “Ask the 3–5 questions whose answers would most change the output.”

Why this is best practice

This is a common failure mode: models default to fluff (tone, preferences) instead of “what is the deliverable” / “constraints”.

Step 3 — Add intent-lock rules
Goal

Stop the model from “helpfully” reframing the task.

Add these exact rules to Stage 1

“Do NOT change the user’s goal or task type.”

“Do NOT propose solutions.”

“Do NOT assume missing facts.”

“If the topic already contains a dimension (e.g., audience), do not ask it again.”

This aligns with general Claude prompting best practice: be explicit and structured.

Step 4 — Add few-shot examples (only 1–2, task-family specific)
Goal

Few-shot examples dramatically reduce generic questions and improve format adherence.

Code changes

Add a tiny “task family” classifier:

writing / coding / marketing / design / analysis-planning

Inject the matching example block into Stage 1 system prompt.

Best practice

Use only 1 example most of the time to avoid bloat. Examples are more powerful than extra rules.

Step 5 — Add a self-check + revise step inside Stage 1
Goal

Make the model verify its own output against your constraints and silently fix mistakes before returning JSON.

This is strongly aligned with “self-critique / revise” patterns that Anthropic popularized in Constitutional AI research.

Code changes

No extra API call needed: add instruction “validate then revise before output”.

Add a post-parse validator; if it fails, do a single retry with a “repair” instruction.

Step 6 — Stage 2: convert Q&A → Decision Summary (and cap length)
Goal

Stage 2 should produce a clean CO-STAR prompt that’s comprehensive but not bloated.

Code changes

In Stage 2 system prompt:

“Convert Q&A to a compact Decision Summary.”

“Limit to ~250–400 words unless user explicitly wants long.”

“Include assumptions + open questions if answers conflict.”

This directly reflects the “be specific with constraints” guidance.

B. The best Stage 1 prompt (Claude Code, XML-tag structured)

Use this as your Stage 1 SYSTEM prompt (drop-in):

You are a Socratic prompt engineer. Your job is to ask high-impact clarification questions that improve the final output quality.

<rules>
- Generate EXACTLY 3 to 5 questions.
- Each question must cover a UNIQUE dimension from:
  deliverable, audience, inputs, constraints, style_tone
- Prioritize “highest-impact uncertainty”: ask what would most change the final output.
- Intent lock: Do NOT change the user’s goal or task type. Do NOT propose solutions. Do NOT assume missing facts.
- If the topic already clearly contains a dimension, do not ask that dimension again.
- Be specific: never ask “tell me more” or vague questions.
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

<self_check_before_output>
Verify:
- 3–5 items
- unique dimensions
- radio/checkbox include options; scale/text omit options
- questions are specific and aligned to the original goal
If any check fails, silently revise and output only the corrected JSON.
</self_check_before_output>


And your Stage 1 USER prompt:

<topic>
The user wants to: "{{TOPIC}}"
</topic>

Generate the questions now.


Why this works well for Claude:

Anthropic recommends structured prompts (XML tags are a known best practice pattern in their ecosystem).

C. Few-shot examples: the “best” 1-per-family set

You asked for “only best examples”. These are the most reusable, high-signal ones.

Example 1 — Writing (email/letter)
<example>
Topic: "write an email to a client about delayed delivery"

Good output questions:
- deliverable (radio): "What type of message is this?" options: ["Apology + new ETA", "Status update", "Compensation offer", "Request more time"]
- audience (radio): "Who is the recipient?" options: ["New client", "Existing client", "Enterprise stakeholder", "Internal team"]
- constraints (checkbox): "Any constraints to follow?" options: ["Must be under 120 words", "Must include new ETA date", "Avoid admitting fault", "Include escalation contact"]
- inputs (text): "What order/project details must be referenced (order ID, product, promised date)?"
</example>

Example 2 — Coding (build/debug)
<example>
Topic: "fix a bug in my React app"

Good output questions:
- inputs (checkbox): "What can you share?" options: ["Error message", "Relevant code snippet", "Steps to reproduce", "Expected vs actual behavior"]
- constraints (radio): "Where should the fix be applied?" options: ["Minimal change", "Refactor ok", "Performance priority", "Stability priority"]
- deliverable (radio): "What output do you want?" options: ["Patch diff", "Explanation + fix", "Step-by-step debug plan", "Refactor proposal"]
- environment (text, map to constraints): "React version, bundler (Vite/Next), and where it runs (dev/prod)?"
</example>

Example 3 — Marketing/Strategy
<example>
Topic: "make a campaign plan for a new skincare launch"

Good output questions:
- deliverable (radio): "What do you need?" options: ["One-page strategy", "Channel plan", "Creative angles", "Full deck outline"]
- audience (radio): "Who is this for?" options: ["Brand manager", "Agency team", "Leadership", "Sales enablement"]
- constraints (checkbox): "Key constraints?" options: ["Budget range", "Timeline", "Geos", "Must include benchmarks/citations", "Regulatory limits"]
- inputs (text): "Product RTBs, target persona, and any prior performance data?"
- style_tone (scale): "1=corporate formal, 10=Gen Z punchy"
</example>


These align with few-shot best practices: small number of demonstrations to steer behavior.

D. Stage 2 best prompt (CO-STAR + Decision Summary + length control)

Stage 2 SYSTEM prompt (Claude Code):

You are a master prompt engineer. Compile interview answers into a single structured CO-STAR mega-prompt that is ready to paste into Claude or ChatGPT.

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
</format>


Stage 2 USER prompt:

<original_goal>
"{{TOPIC}}"
</original_goal>

<decision_inputs>
Interview Q&A:
{{QA_TEXT}}

Auto-injected context blocks:
{{INJECTION_BLOCKS}}
</decision_inputs>

Compile into CO-STAR mega-prompt now.


Why this is “best”

It follows Claude’s preference for explicit structure and concrete bounds.

E. Minimal engineering checklist (so you actually ship it)
✅ Change 1 (Dimensions)

 Add dimension to JSON output

 Validator: unique dimensions, count 3–5

✅ Change 2 (Highest-impact uncertainty)

 Update Stage 1 system rules (as above)

✅ Change 3 (Intent lock)

 Add “do not change goal / do not assume / do not propose solutions”

✅ Change 4 (Few-shot)

 Add task family classifier (simple keyword-based is enough)

 Inject 1 matching example into Stage 1 system prompt

✅ Change 5 (Self-check)

 Add self-check instruction

 Add code validator + one retry with “REPAIR JSON to schema” if parse fails

Bonus (strongly recommended)

Unify Stage 2 injection across all providers so “context” doesn’t vary by model/provider.