console.log("Prompt Architect background service worker initialized");const u=`You are a Socratic prompt engineer specialized in helping users articulate their needs precisely.

<role>
Your job is to ask high-impact clarification questions that maximize information gain and improve final output quality.
You are NOT a solution provider. You are an interviewer who helps users clarify requirements.
</role>

<rules>
- Generate EXACTLY 3 to 5 questions.
- Each question must cover a UNIQUE dimension from:
  deliverable, audience, inputs, constraints, style_tone
- Prioritize "highest-impact uncertainty": ask what would most change the final output.
- Intent lock: Do NOT change the user's goal or task type. Do NOT propose solutions. Do NOT assume missing facts.
- If the topic already clearly contains a dimension, do not ask that dimension again.
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

<self_check_before_output>
Verify:
- 3–5 items
- unique dimensions
- radio/checkbox include options; scale/text omit options
- questions are specific and aligned to the original goal
- questions maximize information gain (not fluff)
If any check fails, silently revise and output only the corrected JSON.
</self_check_before_output>`,l=o=>`<topic>
The user wants to: "${o}"
</topic>

Generate the questions now.`,m=`You are a master prompt engineer. Compile interview answers into a single structured CO-STAR mega-prompt that is ready to paste into Claude or ChatGPT.

<role>
You transform raw Q&A data into a clean, actionable mega-prompt that maximizes AI output quality.
You prioritize signal over noise and ensure every word adds value.
</role>

<rules>
- Convert the Interview Q&A into a compact "Decision Summary" (not a verbatim dump).
- Prioritize only decisions that materially affect the output.
- If an answer is vague/low-signal, compress it to <= 10 words.
- If answers conflict or essential info is missing, add 1–3 "Open Questions" at the end.
- Keep the final mega-prompt ~250–400 words unless the user explicitly requested long form.
- Output in clear markdown.
</rules>

<reasoning_scaffolding>
Before generating the final output:
1. Outline approach: What are the key decisions from the Q&A?
2. Verify constraints: Are there must-include/must-avoid elements?
3. Produce final output: Compile into CO-STAR format.

Think through these steps internally, but only output the final mega-prompt.
</reasoning_scaffolding>

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
</format>`,d=(o,r,e)=>{const n=r.map(t=>`Q: ${e.find(a=>a.id===t.questionId)?.question??t.questionId}
A: ${Array.isArray(t.value)?t.value.join(", "):t.value}`).join(`

`);return`<original_goal>
"${o}"
</original_goal>

<decision_inputs>
Interview Q&A:
${n}
</decision_inputs>

Compile into CO-STAR mega-prompt now.`};chrome.runtime.onInstalled.addListener(o=>{o.reason==="install"?(console.log("Extension installed for the first time"),chrome.storage.local.set({apiKeys:{},customVariables:[],promptHistory:[],aiProvider:"local"})):o.reason==="update"&&console.log("Extension updated to version:",chrome.runtime.getManifest().version)});chrome.runtime.onMessage.addListener((o,r,e)=>{switch(console.log("Received message:",o),o.type){case"AI_RAW_COMPLETE":return x(o.payload).then(e).catch(n=>e({ok:!1,error:n.message})),!0;case"GENERATE_QUESTIONS":return h(o.payload).then(e).catch(n=>e({error:n.message})),!0;case"GENERATE_MEGA_PROMPT":return k(o.payload).then(e).catch(n=>e({error:n.message})),!0;default:e({error:"Unknown message type"})}});async function h(o){const{topic:r,provider:e}=o;try{if(e==="local")return await g(r);{const t=(await chrome.storage.local.get("apiKeys")).apiKeys??{};if(e==="openai"&&t.openai)return await f(r,t.openai);if(e==="anthropic"&&t.anthropic)return await w(r,t.anthropic);if(e==="gemini"&&t.gemini)return await y(r,t.gemini);throw new Error(`No API key found for provider: ${e}`)}}catch(n){throw console.error("Error generating questions:",n),n}}async function g(o){try{throw new Error("Local AI must be called from popup context")}catch{throw new Error("Local AI not available in service worker")}}async function f(o,r){const e=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${r}`},body:JSON.stringify({model:"gpt-4o",temperature:.7,messages:[{role:"system",content:u},{role:"user",content:l(o)}]})});if(!e.ok){const s=await e.json().catch(()=>({}));throw new Error(`OpenAI error: ${s?.error?.message??e.statusText}`)}const c=(await e.json()).choices[0].message.content.replace(/```json?\n?/gi,"").replace(/```/g,"").trim();let a;try{a=JSON.parse(c)}catch{throw new Error("AI returned malformed JSON for questions. Please try again.")}return{questions:a.map((s,p)=>({id:s.id??`q${p+1}`,question:s.question,dimension:s.dimension??"constraints",type:s.type??"text",options:s.options??[],required:s.required??!0}))}}async function y(o,r){const e=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${r}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:l(o)}]}],systemInstruction:{parts:[{text:u}]},generationConfig:{temperature:.7,maxOutputTokens:2048}})});if(!e.ok){const s=await e.json().catch(()=>({}));throw new Error(`Gemini error: ${s?.error?.message??e.statusText}`)}const c=(await e.json()).candidates[0].content.parts[0].text.replace(/```json?\n?/gi,"").replace(/```/g,"").trim();let a;try{a=JSON.parse(c)}catch{throw new Error("AI returned malformed JSON for questions. Please try again.")}return{questions:a.map((s,p)=>({id:s.id??`q${p+1}`,question:s.question,dimension:s.dimension??"constraints",type:s.type??"text",options:s.options??[],required:s.required??!0}))}}async function w(o,r){const e=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":r,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-5-20250929",max_tokens:2048,system:u,messages:[{role:"user",content:l(o)}]})});if(!e.ok){const s=await e.json().catch(()=>({}));throw new Error(`Anthropic error: ${s?.error?.message??e.statusText}`)}const c=(await e.json()).content[0].text.replace(/```json?\n?/gi,"").replace(/```/g,"").trim();let a;try{a=JSON.parse(c)}catch{throw new Error("AI returned malformed JSON for questions. Please try again.")}return{questions:a.map((s,p)=>({id:s.id??`q${p+1}`,question:s.question,dimension:s.dimension??"constraints",type:s.type??"text",options:s.options??[],required:s.required??!0}))}}async function k(o){const{topic:r,answers:e,questions:n,provider:t}=o;try{if(t==="local")throw new Error("Local AI must be called from popup context");{const a=(await chrome.storage.local.get("apiKeys")).apiKeys??{};if(t==="openai"&&a.openai)return await T(r,e,n,a.openai);if(t==="anthropic"&&a.anthropic)return await v(r,e,n,a.anthropic);if(t==="gemini"&&a.gemini)return await O(r,e,n,a.gemini);throw new Error(`No API key found for provider: ${t}`)}}catch(c){throw console.error("Error generating mega-prompt:",c),c}}async function T(o,r,e,n){const t=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${n}`},body:JSON.stringify({model:"gpt-4o",temperature:.7,messages:[{role:"system",content:m},{role:"user",content:d(o,r,e)}]})});if(!t.ok){const i=await t.json().catch(()=>({}));throw new Error(`OpenAI error: ${i?.error?.message??t.statusText}`)}return{megaPrompt:(await t.json()).choices[0].message.content.trim()}}async function O(o,r,e,n){const t=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${n}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:d(o,r,e)}]}],systemInstruction:{parts:[{text:m}]},generationConfig:{temperature:.7,maxOutputTokens:2048}})});if(!t.ok){const i=await t.json().catch(()=>({}));throw new Error(`Gemini error: ${i?.error?.message??t.statusText}`)}return{megaPrompt:(await t.json()).candidates[0].content.parts[0].text.trim()}}async function v(o,r,e,n){const t=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":n,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-5-20250929",max_tokens:2048,system:m,messages:[{role:"user",content:d(o,r,e)}]})});if(!t.ok){const i=await t.json().catch(()=>({}));throw new Error(`Anthropic error: ${i?.error?.message??t.statusText}`)}return{megaPrompt:(await t.json()).content[0].text.trim()}}async function x(o){const{provider:r,messages:e,temperature:n=.7,maxTokens:t=2048}=o;try{const a=(await chrome.storage.local.get("apiKeys")).apiKeys??{};if(!a[r])return{ok:!1,error:`No API key found for provider: ${r}`};let i;switch(r){case"openai":i=await A(e,a.openai,n,t);break;case"anthropic":i=await E(e,a.anthropic,n,t);break;case"gemini":i=await S(e,a.gemini,n,t);break;case"grok":i=await b(e,a.grok,n,t);break;default:return{ok:!1,error:`Unknown provider: ${r}`}}return{ok:!0,text:i}}catch(c){return{ok:!1,error:c.message??"Unknown error"}}}async function A(o,r,e,n){const t=o.map(i=>({role:i.role,content:i.content})),c=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${r}`},body:JSON.stringify({model:"gpt-4o",temperature:e,max_tokens:n,messages:t})});if(!c.ok){const i=await c.json().catch(()=>({}));throw new Error(`OpenAI error: ${i?.error?.message??c.statusText}`)}return(await c.json()).choices[0].message.content}async function E(o,r,e,n){const t=o.find(s=>s.role==="system"),c=o.filter(s=>s.role!=="system"),a=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":r,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-5-20250929",max_tokens:n,temperature:e,system:t?.content??"",messages:c})});if(!a.ok){const s=await a.json().catch(()=>({}));throw new Error(`Anthropic error: ${s?.error?.message??a.statusText}`)}return(await a.json()).content[0].text}async function S(o,r,e,n){const t=o.find(p=>p.role==="system"),a=o.filter(p=>p.role!=="system").map(p=>({role:p.role==="assistant"?"model":"user",parts:[{text:p.content}]})),i=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${r}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:a,systemInstruction:t?{parts:[{text:t.content}]}:void 0,generationConfig:{temperature:e,maxOutputTokens:n}})});if(!i.ok){const p=await i.json().catch(()=>({}));throw new Error(`Gemini error: ${p?.error?.message??i.statusText}`)}return(await i.json()).candidates[0].content.parts[0].text}async function b(o,r,e,n){const t=o.map(i=>({role:i.role,content:i.content})),c=await fetch("https://api.x.ai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${r}`},body:JSON.stringify({model:"grok-beta",temperature:e,max_tokens:n,messages:t})});if(!c.ok){const i=await c.json().catch(()=>({}));throw new Error(`Grok error: ${i?.error?.message??c.statusText}`)}return(await c.json()).choices[0].message.content}
