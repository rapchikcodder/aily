console.log("Prompt Architect background service worker initialized");const u=`You are a Socratic prompt engineer. Your job is to ask high-impact clarification questions that improve the final output quality.

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
</self_check_before_output>`,l=o=>`<topic>
The user wants to: "${o}"
</topic>

Generate the questions now.`,m=`You are a master prompt engineer. Compile interview answers into a single structured CO-STAR mega-prompt that is ready to paste into Claude or ChatGPT.

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
</format>`,d=(o,n,e)=>{const a=n.map(t=>`Q: ${e.find(s=>s.id===t.questionId)?.question??t.questionId}
A: ${Array.isArray(t.value)?t.value.join(", "):t.value}`).join(`

`);return`<original_goal>
"${o}"
</original_goal>

<decision_inputs>
Interview Q&A:
${a}
</decision_inputs>

Compile into CO-STAR mega-prompt now.`};chrome.runtime.onInstalled.addListener(o=>{o.reason==="install"?(console.log("Extension installed for the first time"),chrome.storage.local.set({apiKeys:{},customVariables:[],promptHistory:[],aiProvider:"local"})):o.reason==="update"&&console.log("Extension updated to version:",chrome.runtime.getManifest().version)});chrome.runtime.onMessage.addListener((o,n,e)=>{switch(console.log("Received message:",o),o.type){case"GENERATE_QUESTIONS":return h(o.payload).then(e).catch(a=>e({error:a.message})),!0;case"GENERATE_MEGA_PROMPT":return O(o.payload).then(e).catch(a=>e({error:a.message})),!0;default:e({error:"Unknown message type"})}});async function h(o){const{topic:n,provider:e}=o;try{if(e==="local")return await g(n);{const t=(await chrome.storage.local.get("apiKeys")).apiKeys??{};if(e==="openai"&&t.openai)return await y(n,t.openai);if(e==="anthropic"&&t.anthropic)return await f(n,t.anthropic);if(e==="gemini"&&t.gemini)return await w(n,t.gemini);throw new Error(`No API key found for provider: ${e}`)}}catch(a){throw console.error("Error generating questions:",a),a}}async function g(o){try{throw new Error("Local AI must be called from popup context")}catch{throw new Error("Local AI not available in service worker")}}async function y(o,n){const e=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${n}`},body:JSON.stringify({model:"gpt-4o",temperature:.7,messages:[{role:"system",content:u},{role:"user",content:l(o)}]})});if(!e.ok){const r=await e.json().catch(()=>({}));throw new Error(`OpenAI error: ${r?.error?.message??e.statusText}`)}const i=(await e.json()).choices[0].message.content.replace(/```json?\n?/gi,"").replace(/```/g,"").trim();let s;try{s=JSON.parse(i)}catch{throw new Error("AI returned malformed JSON for questions. Please try again.")}return{questions:s.map((r,p)=>({id:r.id??`q${p+1}`,question:r.question,dimension:r.dimension??"constraints",type:r.type??"text",options:r.options??[],required:r.required??!0}))}}async function w(o,n){const e=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${n}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:l(o)}]}],systemInstruction:{parts:[{text:u}]},generationConfig:{temperature:.7,maxOutputTokens:2048}})});if(!e.ok){const r=await e.json().catch(()=>({}));throw new Error(`Gemini error: ${r?.error?.message??e.statusText}`)}const i=(await e.json()).candidates[0].content.parts[0].text.replace(/```json?\n?/gi,"").replace(/```/g,"").trim();let s;try{s=JSON.parse(i)}catch{throw new Error("AI returned malformed JSON for questions. Please try again.")}return{questions:s.map((r,p)=>({id:r.id??`q${p+1}`,question:r.question,dimension:r.dimension??"constraints",type:r.type??"text",options:r.options??[],required:r.required??!0}))}}async function f(o,n){const e=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":n,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-5-20250929",max_tokens:2048,system:u,messages:[{role:"user",content:l(o)}]})});if(!e.ok){const r=await e.json().catch(()=>({}));throw new Error(`Anthropic error: ${r?.error?.message??e.statusText}`)}const i=(await e.json()).content[0].text.replace(/```json?\n?/gi,"").replace(/```/g,"").trim();let s;try{s=JSON.parse(i)}catch{throw new Error("AI returned malformed JSON for questions. Please try again.")}return{questions:s.map((r,p)=>({id:r.id??`q${p+1}`,question:r.question,dimension:r.dimension??"constraints",type:r.type??"text",options:r.options??[],required:r.required??!0}))}}async function O(o){const{topic:n,answers:e,questions:a,provider:t}=o;try{if(t==="local")throw new Error("Local AI must be called from popup context");{const s=(await chrome.storage.local.get("apiKeys")).apiKeys??{};if(t==="openai"&&s.openai)return await T(n,e,a,s.openai);if(t==="anthropic"&&s.anthropic)return await v(n,e,a,s.anthropic);if(t==="gemini"&&s.gemini)return await E(n,e,a,s.gemini);throw new Error(`No API key found for provider: ${t}`)}}catch(i){throw console.error("Error generating mega-prompt:",i),i}}async function T(o,n,e,a){const t=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${a}`},body:JSON.stringify({model:"gpt-4o",temperature:.7,messages:[{role:"system",content:m},{role:"user",content:d(o,n,e)}]})});if(!t.ok){const c=await t.json().catch(()=>({}));throw new Error(`OpenAI error: ${c?.error?.message??t.statusText}`)}return{megaPrompt:(await t.json()).choices[0].message.content.trim()}}async function E(o,n,e,a){const t=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${a}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:d(o,n,e)}]}],systemInstruction:{parts:[{text:m}]},generationConfig:{temperature:.7,maxOutputTokens:2048}})});if(!t.ok){const c=await t.json().catch(()=>({}));throw new Error(`Gemini error: ${c?.error?.message??t.statusText}`)}return{megaPrompt:(await t.json()).candidates[0].content.parts[0].text.trim()}}async function v(o,n,e,a){const t=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":a,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-5-20250929",max_tokens:2048,system:m,messages:[{role:"user",content:d(o,n,e)}]})});if(!t.ok){const c=await t.json().catch(()=>({}));throw new Error(`Anthropic error: ${c?.error?.message??t.statusText}`)}return{megaPrompt:(await t.json()).content[0].text.trim()}}
