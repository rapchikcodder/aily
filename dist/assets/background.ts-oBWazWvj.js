console.log("Prompt Architect background service worker initialized");const u=`You are a Socratic prompt engineer. Your job is to identify critical missing context from a user's vague idea, then craft specific, insightful questions to fill those gaps.

Rules:
1. Generate exactly 3 to 5 questions — no more, no less
2. Each question must target a DIFFERENT dimension of missing context
3. Be specific, not generic (never ask "tell me more")
4. Return ONLY valid JSON — no markdown fences, no explanation`,m=o=>`The user wants to: "${o}"

Identify the most critical missing context. Return a JSON array:
[
  {
    "id": "q1",
    "question": "Specific question text?",
    "type": "radio" | "checkbox" | "text" | "scale",
    "options": ["Option A", "Option B"],  // required for radio/checkbox
    "required": true | false
  }
]

Question type guide:
- radio: choose ONE from options (e.g., experience level)
- checkbox: choose MULTIPLE (e.g., tech stack)
- text: open-ended free text
- scale: numeric 1-10 rating (omit options field)`,l=`You are a master prompt engineer. You compile interview answers into a single, structured CO-STAR mega-prompt ready to paste into ChatGPT or Claude.

The CO-STAR framework:
- Context: Background and relevant information
- Objective: The precise goal
- Style: Writing or output style
- Tone: Communication tone
- Audience: Who receives this output
- Response: Exact format and structure expected

Output the mega-prompt in clear markdown. Make it comprehensive but not bloated.`,d=(o,r,e)=>{const a=r.map(t=>`Q: ${e.find(s=>s.id===t.questionId)?.question??t.questionId}
A: ${Array.isArray(t.value)?t.value.join(", "):t.value}`).join(`

`);return`Original goal: "${o}"

Interview Q&A:
${a}

Compile the above into a structured CO-STAR mega-prompt. The final output should be ready to paste directly into ChatGPT or Claude.`};chrome.runtime.onInstalled.addListener(o=>{o.reason==="install"?(console.log("Extension installed for the first time"),chrome.storage.local.set({apiKeys:{},customVariables:[],promptHistory:[],aiProvider:"local"})):o.reason==="update"&&console.log("Extension updated to version:",chrome.runtime.getManifest().version)});chrome.runtime.onMessage.addListener((o,r,e)=>{switch(console.log("Received message:",o),o.type){case"GENERATE_QUESTIONS":return g(o.payload).then(e).catch(a=>e({error:a.message})),!0;case"GENERATE_MEGA_PROMPT":return T(o.payload).then(e).catch(a=>e({error:a.message})),!0;default:e({error:"Unknown message type"})}});async function g(o){const{topic:r,provider:e}=o;try{if(e==="local")return await h(r);{const t=(await chrome.storage.local.get("apiKeys")).apiKeys??{};if(e==="openai"&&t.openai)return await y(r,t.openai);if(e==="anthropic"&&t.anthropic)return await w(r,t.anthropic);if(e==="gemini"&&t.gemini)return await f(r,t.gemini);throw new Error(`No API key found for provider: ${e}`)}}catch(a){throw console.error("Error generating questions:",a),a}}async function h(o){try{throw new Error("Local AI must be called from popup context")}catch{throw new Error("Local AI not available in service worker")}}async function y(o,r){const e=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${r}`},body:JSON.stringify({model:"gpt-4o",temperature:.7,messages:[{role:"system",content:u},{role:"user",content:m(o)}]})});if(!e.ok){const n=await e.json().catch(()=>({}));throw new Error(`OpenAI error: ${n?.error?.message??e.statusText}`)}const i=(await e.json()).choices[0].message.content.replace(/```json?\n?/gi,"").replace(/```/g,"").trim();let s;try{s=JSON.parse(i)}catch{throw new Error("AI returned malformed JSON for questions. Please try again.")}return{questions:s.map((n,p)=>({id:n.id??`q${p+1}`,question:n.question,type:n.type??"text",options:n.options??[],required:n.required??!0}))}}async function f(o,r){const e=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${r}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:m(o)}]}],systemInstruction:{parts:[{text:u}]},generationConfig:{temperature:.7,maxOutputTokens:2048}})});if(!e.ok){const n=await e.json().catch(()=>({}));throw new Error(`Gemini error: ${n?.error?.message??e.statusText}`)}const i=(await e.json()).candidates[0].content.parts[0].text.replace(/```json?\n?/gi,"").replace(/```/g,"").trim();let s;try{s=JSON.parse(i)}catch{throw new Error("AI returned malformed JSON for questions. Please try again.")}return{questions:s.map((n,p)=>({id:n.id??`q${p+1}`,question:n.question,type:n.type??"text",options:n.options??[],required:n.required??!0}))}}async function w(o,r){const e=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":r,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-5-20250929",max_tokens:2048,system:u,messages:[{role:"user",content:m(o)}]})});if(!e.ok){const n=await e.json().catch(()=>({}));throw new Error(`Anthropic error: ${n?.error?.message??e.statusText}`)}const i=(await e.json()).content[0].text.replace(/```json?\n?/gi,"").replace(/```/g,"").trim();let s;try{s=JSON.parse(i)}catch{throw new Error("AI returned malformed JSON for questions. Please try again.")}return{questions:s.map((n,p)=>({id:n.id??`q${p+1}`,question:n.question,type:n.type??"text",options:n.options??[],required:n.required??!0}))}}async function T(o){const{topic:r,answers:e,questions:a,provider:t}=o;try{if(t==="local")throw new Error("Local AI must be called from popup context");{const s=(await chrome.storage.local.get("apiKeys")).apiKeys??{};if(t==="openai"&&s.openai)return await x(r,e,a,s.openai);if(t==="anthropic"&&s.anthropic)return await O(r,e,a,s.anthropic);if(t==="gemini"&&s.gemini)return await E(r,e,a,s.gemini);throw new Error(`No API key found for provider: ${t}`)}}catch(i){throw console.error("Error generating mega-prompt:",i),i}}async function x(o,r,e,a){const t=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${a}`},body:JSON.stringify({model:"gpt-4o",temperature:.7,messages:[{role:"system",content:l},{role:"user",content:d(o,r,e)}]})});if(!t.ok){const c=await t.json().catch(()=>({}));throw new Error(`OpenAI error: ${c?.error?.message??t.statusText}`)}return{megaPrompt:(await t.json()).choices[0].message.content.trim()}}async function E(o,r,e,a){const t=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${a}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:d(o,r,e)}]}],systemInstruction:{parts:[{text:l}]},generationConfig:{temperature:.7,maxOutputTokens:2048}})});if(!t.ok){const c=await t.json().catch(()=>({}));throw new Error(`Gemini error: ${c?.error?.message??t.statusText}`)}return{megaPrompt:(await t.json()).candidates[0].content.parts[0].text.trim()}}async function O(o,r,e,a){const t=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":a,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-5-20250929",max_tokens:2048,system:l,messages:[{role:"user",content:d(o,r,e)}]})});if(!t.ok){const c=await t.json().catch(()=>({}));throw new Error(`Anthropic error: ${c?.error?.message??t.statusText}`)}return{megaPrompt:(await t.json()).content[0].text.trim()}}
