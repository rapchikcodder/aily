Below is a **much more detailed, “delete old → build new → fix old issues”** implementation plan, written exactly in the style you can paste into **Claude Code** to refactor your repo cleanly.

I’m going to:

1. tell you **what to delete / deprecate**
2. tell you **what to build new** (files + functions + message types)
3. tell you **what to fix** (your current pain points: duplication, inconsistent injection, brittle JSON, static questions)
4. give you **a single master Claude Code prompt** that instructs it to do all of it safely

---

## What to delete / deprecate (old flow)

### Delete / deprecate these behaviors

1. **Static Stage-1 “generate 3–5 questions at once” as the default**

   * Keep it only as a fallback helper (optional), but **the main flow becomes adaptive**:
   * Ask Q1 → user answers → generate Q2 based on Q/A → …

2. **Prompt duplication between `background.ts` and `aiEngine.ts`**

   * Remove prompt strings from background entirely.
   * Background should only do **network fetch**. No prompt logic.

3. **“Fence stripping + JSON.parse + hope” without a strict validator**

   * Replace with:
   * strict parsing + validation + one repair attempt

4. **Inconsistent injection across local vs cloud**

   * Make injection happen in one place (aiEngine) and pass it to background when needed.

---

## What to build new (clean v2 architecture)

### New core building blocks (files)

Create these files:

1. `src/lib/prompts/index.ts`

   * sole source of truth for all prompt templates:

     * `buildNextQuestionSystemPrompt()`
     * `buildNextQuestionUserPrompt({...})`
     * `buildMegaPromptSystemPrompt()`
     * `buildMegaPromptUserPrompt({...})`
     * `buildRepairJsonSystemPrompt()` + `buildRepairJsonUserPrompt({...})`

2. `src/lib/validators.ts`

   * `extractFirstJsonObject(text: string): string | null`
   * `safeJsonParse(text: string): unknown`
   * `validateQuestion(q, askedDims): string[]`
   * `validateNextQuestionResponse(obj, askedQuestions, minQ, maxQ): string[]`
   * `validateMegaPrompt(text): { ok: boolean; issues: string[] }`

3. `src/lib/intent.ts`

   * `inferIntent(topic: string, asked: Question[], answers: Answer[])`
   * returns:

     * `taskFamily`
     * `deliverableHint`
     * `knownDimensions`
     * `missingDimensionsRanked`
     * `mustAskNext` (e.g. inputs missing for coding, deliverable missing for writing)

4. `src/lib/interviewPolicy.ts`

   * deterministic stop conditions:

     * `shouldStopInterview({asked, answers, minQ, maxQ, remainingDims}): { stop: boolean; reason?: string }`
   * ranking policy:

     * `rankDimensions({intent, remainingDims}): Dimension[]`

### New AI methods (aiEngine)

Add:

* `generateNextQuestion(topic, asked, answers, config, minQ=3, maxQ=5)`
* `repairNextQuestionResponse(rawText, validationErrors, context, config)`
* `repairQuestionsJson(rawText, validationErrors, config)` (reusable)
* `maybeTightenMegaPrompt(rawMega, issues, config)`

### New background message types

Add these message handlers:

* `AI_RAW_COMPLETE` (generic completion)

  * Background receives: `provider, messages, temperature, maxTokens`
  * Background returns: `{ text: string }`
  * **That’s it.**
  * It doesn’t know about “questions” or “mega prompts”.

This is how you delete all duplication.

---

## What to fix (old issues you mentioned + I observed earlier)

### Fix 1 — Adaptive questioning (your request)

**UI no longer preloads 3–5 questions.**
Instead it loops:

* ask 1 question
* user answers
* model decides next best question based on Q/A + remaining dimensions
* stop at 3–5 or when policy says done

### Fix 2 — “Local vs cloud output mismatch”

* Always build prompts in `aiEngine.ts`
* Always run `variableInjector` inside aiEngine
* When calling cloud, pass injection blocks inside the user prompt
* Background is just a dumb fetcher

### Fix 3 — JSON brittleness

* Add `extractFirstJsonObject()` (or array) and parse only that region
* Validate strongly
* If invalid → one repair attempt with a repair prompt

### Fix 4 — Duplicate prompt definitions / drift

* Move every prompt string into `src/lib/prompts/index.ts`
* Background imports nothing prompt-related (or just uses raw messages it receives)

### Fix 5 — “Out of context questions”

* Use intent inference + dimension ranking:

  * coding: prioritize `inputs` (error / repro), `constraints` (env), then deliverable
  * writing: deliverable + audience + must-include points
* Use “remaining dimensions” computed in code and passed to the model:

  * model is only allowed to pick from remaining dims

---

# EXACT code-level changes by file (what you’ll tell Claude Code)

## 1) `src/background.ts` — simplify to a generic completion worker

### Before:

* `GENERATE_QUESTIONS`
* `GENERATE_MEGA_PROMPT`
* provider logic + prompt strings + parsing

### After:

* Keep provider logic
* Replace with **one** message type:

```ts
type AIRawCompleteMessage = {
  type: 'AI_RAW_COMPLETE';
  payload: {
    provider: 'openai'|'anthropic'|'gemini';
    messages: Array<{ role: 'system'|'user'|'assistant'; content: string }>;
    temperature?: number;
    maxTokens?: number;
  };
};
```

Background returns:

```ts
{ ok: true, text: string } | { ok: false, error: string }
```

**Delete** the “question generation” and “mega prompt” handlers.

This alone removes 70% of drift.

---

## 2) `src/lib/aiEngine.ts` — becomes the brain

### New functions to add

#### `completeWithProvider(...)`

* If local provider: use `window.ai.languageModel`
* If cloud provider: send `AI_RAW_COMPLETE` to background

This consolidates all “call model” paths into one.

#### `generateNextQuestion(...)` (core)

Steps:

1. `intent = inferIntent(topic, asked, answers)`
2. `remainingDims = remainingDims(asked)`
3. `policyStop = shouldStopInterview(...)`

   * if stop → return `{ done:true, reason }` without calling model (saves cost)
4. build prompts from prompt pack:

   * systemPrompt = `buildNextQuestionSystemPrompt()`
   * userPrompt = `buildNextQuestionUserPrompt({topic, asked, answers, intent, remainingDims, minQ, maxQ})`
5. call `completeWithProvider`
6. parse → validate
7. if invalid → repair once → parse → validate
8. return `{ done, question?, reason? }`

---

## 3) `src/components/InterviewOverlay.tsx` — change UI state machine

### Current behavior:

* on mount generate all questions
* step through them
* compile at end

### New behavior:

* on mount call `generateNextQuestion` once
* append question and show it
* on Next from last question:

  * if not enough questions → generate next
  * else ask `generateNextQuestion` and:

    * if done → compile mega prompt
    * else append and continue

### Must include:

* disable Next button while generating
* error handling: if next question fails twice, fallback to compile with current answers (never hard-block user)

---

## 4) `src/lib/variableInjector.ts` — fix hair-trigger matching

Change `.includes(trigger)` to:

* word boundary match OR
* match only on selected question IDs (best)

This reduces accidental injection.

---

# The best “NEXT QUESTION” prompt (drop-in prompt pack)

### `buildNextQuestionSystemPrompt()`

Make it strict and model-agnostic:

```text
You are an adaptive Socratic interviewer.

Rules:
- Ask ONE best next question only, OR decide the interview is done.
- Do NOT change the user's goal.
- Do NOT propose solutions.
- Do NOT assume facts.
- The next question must choose a dimension ONLY from the provided RemainingDimensions list.
- Do NOT repeat a dimension that was already asked.
- Prefer highest information gain: what answer would most change the final result.

Output must be valid JSON only with one of these forms:

A) Ask next question:
{
  "done": false,
  "question": {
    "id": "qN",
    "dimension": "deliverable|audience|inputs|constraints|style_tone",
    "question": "…",
    "type": "radio|checkbox|text|scale",
    "options": ["..."]  // required only for radio/checkbox
    "required": true
  }
}

B) Done:
{ "done": true, "reason": "..." }

Constraints:
- dimension must be one of RemainingDimensions
- radio/checkbox must include options with >= 2 items
- text/scale must not include options
- scale must clearly define 1 and 10 endpoints in the question text
```

### `buildNextQuestionUserPrompt(...)`

```text
Topic:
{{TOPIC}}

Already asked questions:
{{ASKED_QUESTIONS_LIST}}

Answers so far:
{{QA_TEXT}}

Interview bounds:
- MinQuestions: {{MINQ}}
- MaxQuestions: {{MAXQ}}

RemainingDimensions (must pick from these only):
{{REMAINING_DIMS_JSON_ARRAY}}

Intent hints (do not contradict):
{{INTENT_HINTS_JSON}}

Task:
Return the single best next question (JSON form A), or return done=true (JSON form B) if we already have enough information to produce a high-quality final output.
```

---

# ONE master Claude Code prompt (very detailed, delete old, build new)

Copy/paste this into Claude Code:

```text
You are refactoring the repo https://github.com/rapchikcodder/aily.

Goal:
Replace the static “generate 3–5 questions once” interview with an adaptive interview that generates one question at a time after each user answer. Also remove duplicated prompt logic, add strict validation+repair, unify injection, and fix old fragility.

Must-do outcomes:
1) Adaptive questioning loop:
   - generate Q1
   - after user answers, generate next question based on Q/A so far
   - stop when done or after 3–5 questions
2) Background is network-only:
   - remove prompt strings and task-specific handlers from background.ts
   - implement a single generic handler AI_RAW_COMPLETE that takes {provider, messages, temperature, maxTokens} and returns {text}
3) aiEngine becomes the brain:
   - builds prompts via prompt pack
   - calls local window.ai or background AI_RAW_COMPLETE
   - parses, validates, repairs once if needed
4) Strict schemas + validators:
   - validateNextQuestionResponse, validateQuestionObject
   - extract JSON safely even if model adds junk
5) Fix old issues:
   - remove prompt duplication (create src/lib/prompts/index.ts)
   - unify variable injection across local/cloud (injection built in aiEngine and appended to Stage-2 user prompt)
   - reduce injection false-positives (word boundary or ID-based triggers)

Steps (do these in order):

A) Create new modules:

1) src/lib/prompts/index.ts
Export:
- buildNextQuestionSystemPrompt()
- buildNextQuestionUserPrompt(args)
- buildMegaPromptSystemPrompt()
- buildMegaPromptUserPrompt(args)
- buildRepairJsonSystemPrompt()
- buildRepairJsonUserPrompt({rawText, errors, expectedContract})

2) src/lib/validators.ts
Implement:
- extractFirstJsonObject(text): string|null  (find first {...} region)
- extractFirstJsonArray(text): string|null   (find first [...] region)
- safeJsonParse(text): unknown
- validateQuestionObject(q, askedQuestions): string[]
- validateNextQuestionResponse(obj, askedQuestions, minQ, maxQ): string[]
- validateMegaPromptText(text): { ok: boolean; issues: string[] }
Also include helper enums:
Dimension = 'deliverable'|'audience'|'inputs'|'constraints'|'style_tone'

3) src/lib/intent.ts
Implement:
- inferIntent(topic, askedQuestions, answers):
  returns {
    taskFamily: 'writing'|'coding'|'marketing'|'design'|'analysis',
    deliverableHint: { kind: string, confidence: number },
    knownDimensions: Record<Dimension, boolean>,
    missingCritical: Dimension[]
  }
Use simple deterministic heuristics + reuse existing taskClassifier if present.

4) src/lib/interviewPolicy.ts
Implement:
- remainingDimensions(askedQuestions): Dimension[]
- shouldStopInterview({asked, answers, minQ, maxQ, remainingDims}): { stop: boolean; reason?: string }
Rules:
- if asked.length >= maxQ => stop true
- if asked.length < minQ => stop false
- else stop if remainingDims only contains style_tone AND user already gave enough detail (non-empty answers for deliverable + audience or inputs + constraints depending on task family)

B) Refactor background.ts:

- Remove handlers: GENERATE_QUESTIONS, GENERATE_MEGA_PROMPT (delete old code)
- Add handler: AI_RAW_COMPLETE
Payload:
{
  provider: 'openai'|'anthropic'|'gemini',
  messages: [{role:'system'|'user'|'assistant', content:string}] ,
  temperature?: number,
  maxTokens?: number
}
Return:
{ ok:true, text:string } or { ok:false, error:string }

Background must not import prompts or parse JSON. It only calls providers and returns raw text.

C) Refactor aiEngine.ts:

- Remove duplicated prompt strings if any remain.
- Add:
  async function completeWithProvider(config, messages, temperature, maxTokens): returns string
  - if provider === 'local' => window.ai.languageModel
  - else => send AI_RAW_COMPLETE to background

- Add:
  async function generateNextQuestion(topic, asked, answers, config, minQ=3, maxQ=5):
    1) intent = inferIntent(...)
    2) remainingDims = remainingDimensions(asked)
    3) policy = shouldStopInterview(...)
       if policy.stop => return {done:true, reason:policy.reason}
    4) system = buildNextQuestionSystemPrompt()
       user = buildNextQuestionUserPrompt({topic, asked, answers, intent, remainingDims, minQ, maxQ})
    5) raw = completeWithProvider(...)
    6) parse JSON object (extractFirstJsonObject → safeJsonParse)
    7) validateNextQuestionResponse
    8) if invalid => run repair once using repair prompts and validation errors, then re-parse and re-validate
    9) return parsed {done, question?, reason?}

- Update compileMegaPrompt(...) to:
  1) build injectionBlocks using variableInjector ALWAYS
  2) build system/user prompts via prompt pack
  3) call completeWithProvider
  4) validateMegaPromptText; if too long or generic => optional tighten pass using repairMegaPrompt prompts (one pass)
  5) return mega prompt

Keep generateQuestions(...) optionally, but mark it deprecated; InterviewOverlay should no longer use it.

D) Update InterviewOverlay.tsx:

- On mount:
  - call generateNextQuestion(topic, [], [], config, 3, 5)
  - if done true immediately (unlikely) => compileMegaPrompt with no Qs
  - else set questions=[question], currentIndex=0

- On Next click:
  - save current answer as already done
  - if currentIndex < questions.length-1: currentIndex++
  - else (at last question):
    - call generateNextQuestion(topic, questions, answers, config, 3, 5)
    - if done true => compileMegaPrompt(...) and go to result
    - else append question to questions and set currentIndex++

- Add UI protections:
  - disable Next while waiting for AI
  - show spinner “Thinking…”
  - allow Retry on error, but also allow “Continue to result” using existing answers if AI fails twice

E) Fix variableInjector.ts:

- Replace substring matching with word-boundary regex OR match only on specific question IDs (prefer ID-based).
- Ensure it never injects giant blocks due to one accidental word in a free-text answer.

F) Provide final notes:
- List files changed/added/removed
- Explain how adaptive questioning works
- Explain how validation+repair prevents JSON failures
- Confirm background no longer contains prompt strings or parsing

Do the full refactor now and output code changes and summary.
```

---

## Quick sanity checklist after you implement

* ✅ After answer 1, the next question changes depending on answer
* ✅ Questions never repeat a dimension
* ✅ Interview stops at 3–5 questions
* ✅ Cloud and local behave the same (same prompt pack, same injection)
* ✅ JSON issues don’t break the flow (repair happens once)
* ✅ Background is now “dumb pipe” (only network)

If you want, I can also give you:

* a ready-made `validators.ts` implementation outline (actual TS code skeleton)
* the exact `InterviewOverlay` logic patch (pseudo-diff style)
* a minimal “repair JSON” prompt that works well across Claude/Gemini/OpenAI
