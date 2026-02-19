// Background Service Worker for Prompt Architect
// Handles: API calls, storage management, and cross-component communication

console.log('Prompt Architect background service worker initialized');

// ─── Prompts (synchronized with aiEngine.ts) ───────────────────────────────
const QUESTION_GENERATION_SYSTEM = `You are a Socratic prompt engineer. Your job is to ask high-impact clarification questions that improve the final output quality.

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
  answers: any[],
  questions: any[]
) => {
  const qaText = answers
    .map((a: any) => {
      const q = questions.find((q: any) => q.id === a.questionId);
      return `Q: ${q?.question ?? a.questionId}\nA: ${Array.isArray(a.value) ? a.value.join(', ') : a.value}`;
    })
    .join('\n\n');

  return `<original_goal>
"${topic}"
</original_goal>

<decision_inputs>
Interview Q&A:
${qaText}
</decision_inputs>

Compile into CO-STAR mega-prompt now.`;
};

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed for the first time');

    // Initialize default settings
    chrome.storage.local.set({
      apiKeys: {},
      customVariables: [],
      promptHistory: [],
      aiProvider: 'local',
    });

    // Open onboarding page (future feature)
    // chrome.tabs.create({ url: 'onboarding.html' });
  } else if (details.reason === 'update') {
    console.log('Extension updated to version:', chrome.runtime.getManifest().version);
  }
});

// Listen for messages from popup/options
chrome.runtime.onMessage.addListener((
  message: { type: string; payload: any },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) => {
  console.log('Received message:', message);

  switch (message.type) {
    case 'GENERATE_QUESTIONS':
      handleGenerateQuestions(message.payload)
        .then(sendResponse)
        .catch((error) => sendResponse({ error: error.message }));
      return true; // Keep channel open for async response

    case 'GENERATE_MEGA_PROMPT':
      handleGenerateMegaPrompt(message.payload)
        .then(sendResponse)
        .catch((error) => sendResponse({ error: error.message }));
      return true;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

// Handle question generation
async function handleGenerateQuestions(payload: { topic: string; provider: string }) {
  const { topic, provider } = payload;

  try {
    if (provider === 'local') {
      return await generateQuestionsLocal(topic);
    } else {
      // Get API keys from storage
      const result = await chrome.storage.local.get('apiKeys');
      const apiKeys = (result.apiKeys ?? {}) as Record<string, string>;

      if (provider === 'openai' && apiKeys['openai']) {
        return await generateQuestionsOpenAI(topic, apiKeys['openai']);
      } else if (provider === 'anthropic' && apiKeys['anthropic']) {
        return await generateQuestionsAnthropic(topic, apiKeys['anthropic']);
      } else if (provider === 'gemini' && apiKeys['gemini']) {
        return await generateQuestionsGemini(topic, apiKeys['gemini']);
      } else {
        throw new Error(`No API key found for provider: ${provider}`);
      }
    }
  } catch (error) {
    console.error('Error generating questions:', error);
    throw error;
  }
}

// Generate questions using local AI
async function generateQuestionsLocal(_topic: string) {
  try {
    // Check if window.ai is available (note: service workers don't have window)
    // This will need to be called from the popup context
    throw new Error('Local AI must be called from popup context');
  } catch (error) {
    throw new Error('Local AI not available in service worker');
  }
}

// Generate questions using OpenAI
async function generateQuestionsOpenAI(topic: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.7,
      messages: [
        { role: 'system', content: QUESTION_GENERATION_SYSTEM },
        { role: 'user', content: QUESTION_GENERATION_USER(topic) },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI error: ${err?.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  const raw = data.choices[0].message.content as string;

  // Strip markdown fences if the model wrapped the JSON anyway
  const cleaned = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();

  let parsed: any[];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned malformed JSON for questions. Please try again.');
  }

  // Validate and normalise
  const questions = parsed.map((q: any, i: number) => ({
    id: q.id ?? `q${i + 1}`,
    question: q.question,
    dimension: q.dimension ?? 'constraints',
    type: q.type ?? 'text',
    options: q.options ?? [],
    required: q.required ?? true,
  }));

  return { questions };
}

// Generate questions using Gemini
async function generateQuestionsGemini(topic: string, apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: QUESTION_GENERATION_USER(topic) }]
        }],
        systemInstruction: {
          parts: [{ text: QUESTION_GENERATION_SYSTEM }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gemini error: ${err?.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  const raw = data.candidates[0].content.parts[0].text as string;

  // Strip markdown fences if the model wrapped the JSON anyway
  const cleaned = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();

  let parsed: any[];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned malformed JSON for questions. Please try again.');
  }

  // Validate and normalise
  const questions = parsed.map((q: any, i: number) => ({
    id: q.id ?? `q${i + 1}`,
    question: q.question,
    dimension: q.dimension ?? 'constraints',
    type: q.type ?? 'text',
    options: q.options ?? [],
    required: q.required ?? true,
  }));

  return { questions };
}

// Generate questions using Anthropic
async function generateQuestionsAnthropic(topic: string, apiKey: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
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
      system: QUESTION_GENERATION_SYSTEM,
      messages: [{ role: 'user', content: QUESTION_GENERATION_USER(topic) }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Anthropic error: ${err?.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  const raw = data.content[0].text as string;

  // Strip markdown fences if the model wrapped the JSON anyway
  const cleaned = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();

  let parsed: any[];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned malformed JSON for questions. Please try again.');
  }

  // Validate and normalise
  const questions = parsed.map((q: any, i: number) => ({
    id: q.id ?? `q${i + 1}`,
    question: q.question,
    dimension: q.dimension ?? 'constraints',
    type: q.type ?? 'text',
    options: q.options ?? [],
    required: q.required ?? true,
  }));

  return { questions };
}

// Handle mega-prompt generation
async function handleGenerateMegaPrompt(payload: {
  topic: string;
  answers: any[];
  questions: any[];
  provider: string;
}) {
  const { topic, answers, questions, provider } = payload;

  try {
    if (provider === 'local') {
      throw new Error('Local AI must be called from popup context');
    } else {
      const result = await chrome.storage.local.get('apiKeys');
      const apiKeys = (result.apiKeys ?? {}) as Record<string, string>;

      if (provider === 'openai' && apiKeys['openai']) {
        return await generateMegaPromptOpenAI(topic, answers, questions, apiKeys['openai']);
      } else if (provider === 'anthropic' && apiKeys['anthropic']) {
        return await generateMegaPromptAnthropic(topic, answers, questions, apiKeys['anthropic']);
      } else if (provider === 'gemini' && apiKeys['gemini']) {
        return await generateMegaPromptGemini(topic, answers, questions, apiKeys['gemini']);
      } else {
        throw new Error(`No API key found for provider: ${provider}`);
      }
    }
  } catch (error) {
    console.error('Error generating mega-prompt:', error);
    throw error;
  }
}

// Generate mega-prompt using OpenAI
async function generateMegaPromptOpenAI(topic: string, answers: any[], questions: any[], apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.7,
      messages: [
        { role: 'system', content: MEGA_PROMPT_SYSTEM },
        { role: 'user', content: MEGA_PROMPT_USER(topic, answers, questions) },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI error: ${err?.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  const megaPrompt = (data.choices[0].message.content as string).trim();
  return { megaPrompt };
}

// Generate mega-prompt using Gemini
async function generateMegaPromptGemini(topic: string, answers: any[], questions: any[], apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: MEGA_PROMPT_USER(topic, answers, questions) }]
        }],
        systemInstruction: {
          parts: [{ text: MEGA_PROMPT_SYSTEM }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gemini error: ${err?.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  const megaPrompt = data.candidates[0].content.parts[0].text.trim();
  return { megaPrompt };
}

// Generate mega-prompt using Anthropic
async function generateMegaPromptAnthropic(topic: string, answers: any[], questions: any[], apiKey: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
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
      system: MEGA_PROMPT_SYSTEM,
      messages: [{ role: 'user', content: MEGA_PROMPT_USER(topic, answers, questions) }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Anthropic error: ${err?.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  const megaPrompt = (data.content[0].text as string).trim();
  return { megaPrompt };
}

export {};
