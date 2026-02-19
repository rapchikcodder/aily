# Software Requirements Specification (SRS)
## Prompt Architect - Chrome Extension

**Document Version:** 1.1
**Last Updated:** 2026-02-18 (Updated with Content Script Architecture)
**Project Status:** Development Phase

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and technical requirements for **Prompt Architect**, a Chrome Extension that transforms vague user ideas into structured, comprehensive prompts through an AI-powered Socratic interviewing process.

### 1.2 Scope
Prompt Architect replaces "lazy prompting" with "World Building" by:
- Conducting intelligent interviews to extract missing context
- Automatically injecting domain-specific best practices
- Generating structured "Mega-Prompts" using proven frameworks (CO-STAR, etc.)

### 1.3 Definitions & Acronyms
- **SRS:** Software Requirements Specification
- **BYOK:** Bring Your Own Key (user-provided API keys)
- **CO-STAR:** Context, Objective, Style, Tone, Audience, Response format
- **Mega-Prompt:** Final compiled, structured prompt ready for AI consumption
- **Variable Injector:** System component that inserts pre-written context blocks
- **Content Script:** JavaScript that runs in the context of web pages (chatgpt.com, claude.ai)
- **Overlay:** In-page modal UI that appears on top of the website (not a popup window)
- **Refine Button:** The floating icon injected next to text areas (similar to Grammarly's indicator)
- **MutationObserver:** DOM API for detecting dynamic changes in Single Page Applications

---

## 2. Functional Requirements

### 2.1 The Interview Loop (FR-001)

#### FR-001.1 Content Script Injection & Detection
- **ID:** FR-001.1
- **Priority:** CRITICAL
- **Description:** Extension detects when user is on chatgpt.com or claude.ai and injects the "Refine" button near the text input area
- **Target Websites:**
  - `https://chatgpt.com/*`
  - `https://claude.ai/*`
- **Detection Logic:**
  - Use MutationObserver to watch for text area/contenteditable elements
  - Identify the main prompt input field (handle dynamic SPA rendering)
  - Inject a floating "Refine" button/icon near the input field
- **Button Behavior:**
  - Appears only when text area has focus or contains text
  - Non-intrusive positioning (similar to Grammarly's indicator)
  - Inherits site theme (light/dark mode detection)
  - Smooth fade-in animation

#### FR-001.1a Initial Input Capture (Overlay Trigger)
- **ID:** FR-001.1a
- **Priority:** CRITICAL
- **Description:** User clicks the "Refine" button to trigger the interview overlay
- **Input Source:** The text currently in the ChatGPT/Claude text area is automatically captured as the initial topic
- **Fallback:** If text area is empty, show input field in overlay
- **Examples:**
  - User types "Make a fitness app" in ChatGPT → Clicks Refine → Interview starts with that topic
  - User types "Write a blog about climate change" → Clicks Refine → Context questions generated

#### FR-001.2 Context Analysis
- **ID:** FR-001.2
- **Priority:** CRITICAL
- **Description:** AI analyzes the input to identify missing critical context
- **Process:**
  1. Parse user input for domain/topic identification
  2. Cross-reference against "Context Templates" database
  3. Identify 3-5 missing critical dimensions
- **Missing Context Categories:**
  - Target Audience (age, expertise level, demographics)
  - Technical Constraints (tech stack, platforms, budget)
  - Tone & Style (formal, casual, technical, persuasive)
  - Objectives & Success Metrics
  - Constraints (time, resources, compliance requirements)
  - Output Format (essay, code, presentation, etc.)

#### FR-001.3 Question Generation
- **ID:** FR-001.3
- **Priority:** CRITICAL
- **Description:** System generates specific, contextual questions
- **Requirements:**
  - Generate 3-5 questions per interview loop
  - Questions must be specific, not generic
  - Questions should be prioritized by impact on final output
  - Support multiple question types:
    - Single-choice (radio buttons)
    - Multiple-choice (checkboxes)
    - Free-text
    - Scale/slider (e.g., formality level 1-10)

#### FR-001.4 Interactive Interview Overlay UI
- **ID:** FR-001.4
- **Priority:** HIGH
- **Description:** Display questions in a Typeform-style progressive interface as an overlay on top of the current website
- **Overlay Specifications:**
  - **Positioning:** Centered modal overlay with semi-transparent backdrop (backdrop-blur effect)
  - **Dimensions:** 500px width, max 600px height, responsive on smaller screens
  - **Z-Index:** High enough to appear above site content (z-index: 999999)
  - **Theme Matching:** Automatically detect and match host site's theme (light/dark mode)
  - **Animation:** Smooth slide-up entrance, fade-out exit
  - **Isolation:** Rendered in Shadow DOM to prevent CSS conflicts with host site
- **UX Requirements:**
  - One question per screen
  - Smooth transitions between questions (slide animations)
  - Progress indicator (e.g., "Question 2 of 5")
  - "Back" button to revise previous answers
  - "Skip" option for non-critical questions
  - Real-time answer validation
  - "Close" button (X) to dismiss overlay and return to site
  - Keyboard navigation: Esc to close, Enter to submit answer

#### FR-001.5 Answer Compilation
- **ID:** FR-001.5
- **Priority:** CRITICAL
- **Description:** Aggregate user responses into a structured data object
- **Output Schema:**
```json
{
  "original_input": "string",
  "timestamp": "ISO-8601",
  "context": {
    "audience": "string",
    "tone": "string",
    "tech_stack": ["array"],
    "constraints": {},
    "objectives": "string"
  },
  "raw_answers": []
}
```

### 2.2 The Variable Injector (FR-002)

#### FR-002.1 Context Injection Rules
- **ID:** FR-002.1
- **Priority:** HIGH
- **Description:** Automatically inject pre-written context blocks based on user answers
- **Examples:**
  - If user selects "Python" → Inject "Python Best Practices (PEP 8, type hints, virtual environments)"
  - If user selects "Healthcare" → Inject "HIPAA Compliance Requirements"
  - If user selects "Beginner Audience" → Inject "Avoid jargon, use analogies"

#### FR-002.2 Custom Variable Management
- **ID:** FR-002.2
- **Priority:** MEDIUM
- **Description:** Allow users to create custom injection rules in Settings
- **UI Requirements:**
  - Form to add new rules: Trigger Keyword → Injected Text
  - Edit/delete existing rules
  - Import/export rules as JSON
  - Preview how rules affect output

#### FR-002.3 Built-in Variable Library
- **ID:** FR-002.3
- **Priority:** MEDIUM
- **Description:** Ship with pre-configured variable injection templates
- **Categories:**
  - Programming Languages (Python, JavaScript, Rust, etc.)
  - Frameworks (React, Django, Next.js, etc.)
  - Industries (Healthcare, Finance, Education, etc.)
  - Writing Styles (Academic, Business, Creative, etc.)

### 2.3 Mega-Prompt Generation (FR-003)

#### FR-003.1 Prompt Framework Application
- **ID:** FR-003.1
- **Priority:** CRITICAL
- **Description:** Compile all gathered context into a structured prompt using CO-STAR or similar framework
- **Template Structure:**
```
# Context
[Background information + Injected Variables]

# Objective
[User's original goal, refined]

# Style & Tone
[Determined from interview]

# Audience
[Target user/reader profile]

# Constraints
[Technical, time, resource limitations]

# Response Format
[Expected output structure]

---
FINAL PROMPT:
[Compiled mega-prompt ready to paste into ChatGPT/Claude]
```

#### FR-003.2 Output Actions
- **ID:** FR-003.2
- **Priority:** HIGH
- **Description:** Provide multiple ways to use the generated prompt
- **Actions:**
  - **Copy to Clipboard** (primary CTA)
  - **Save to History** (local storage)
  - **Edit Before Copy** (inline editor)
  - **Regenerate** (re-run interview with same topic)

### 2.4 History & Persistence (FR-004)

#### FR-004.1 Prompt History
- **ID:** FR-004.1
- **Priority:** MEDIUM
- **Description:** Store generated prompts locally
- **Features:**
  - List view of past prompts (title, date, preview)
  - Search/filter by keyword or date
  - Re-use/edit old prompts
  - Delete individual or batch delete

### 2.5 Content Script Architecture (FR-005) - THE GRAMMARLY EXPERIENCE

#### FR-005.1 DOM Injection & Text Area Detection
- **ID:** FR-005.1
- **Priority:** CRITICAL
- **Description:** Intelligently detect and inject UI elements into ChatGPT and Claude web interfaces
- **Implementation Requirements:**
  1. **MutationObserver Setup:**
     - Watch for dynamically added text areas (SPAs render content asynchronously)
     - Observe `body` element with `{ childList: true, subtree: true }`
     - Debounce observer callbacks (max 1 check per 500ms to avoid performance issues)
  2. **Text Area Selectors (Site-Specific):**
     - **ChatGPT:** `textarea[id="prompt-textarea"]` or `div[contenteditable="true"]`
     - **Claude.ai:** `div[contenteditable="true"].ProseMirror` or similar
     - Maintain selector fallback chain (sites may update their DOM structure)
  3. **Injection Logic:**
     - Once text area detected, inject "Refine" button as a sibling element
     - Position: Absolute, aligned to top-right of text area container
     - Only inject once per text area (prevent duplicate buttons)

#### FR-005.2 Refine Button UI/UX
- **ID:** FR-005.2
- **Priority:** HIGH
- **Description:** The floating "Refine" button that triggers the interview overlay
- **Visual Design:**
  - **Icon:** Sparkle/magic wand icon (suggests enhancement/improvement)
  - **Size:** 32px × 32px circular button
  - **Colors:**
    - Light mode: `bg-blue-500 hover:bg-blue-600 text-white`
    - Dark mode: `bg-blue-600 hover:bg-blue-700 text-white`
  - **Shadow:** Subtle shadow for depth (`shadow-lg`)
  - **Animation:** Gentle pulse animation on first appearance (draw attention)
- **Interaction States:**
  - **Default:** 60% opacity when text area empty
  - **Active:** 100% opacity when text present
  - **Hover:** Scale 1.05, increase shadow
  - **Click:** Brief scale-down animation (0.95) before opening overlay
- **Tooltip:** "Refine this prompt" on hover (appears after 500ms)

#### FR-005.3 Theme Detection & Matching
- **ID:** FR-005.3
- **Priority:** HIGH
- **Description:** Automatically detect host site's theme and match overlay styling
- **Detection Strategy:**
  1. **ChatGPT Theme Detection:**
     - Check `html` element for `class="dark"` or data attribute
     - Fallback: Compute background color of body element
  2. **Claude.ai Theme Detection:**
     - Check for dark mode class or data attributes
     - Fallback: Parse CSS variables (--background, --foreground)
  3. **System Preference Fallback:**
     - Use `window.matchMedia('(prefers-color-scheme: dark)')`
- **Theme Application:**
  - Pass theme to overlay component as prop
  - Use Tailwind's `dark:` classes for conditional styling
  - Re-detect theme on visibility change (user might switch mid-session)

#### FR-005.4 Shadow DOM Isolation
- **ID:** FR-005.4
- **Priority:** HIGH
- **Description:** Render overlay in Shadow DOM to prevent CSS conflicts
- **Rationale:**
  - ChatGPT and Claude have extensive global CSS that could conflict with extension styles
  - Shadow DOM provides style encapsulation
  - Prevents host site's styles from breaking overlay UI
- **Implementation:**
  - Create Shadow Root: `element.attachShadow({ mode: 'open' })`
  - Inject Tailwind CSS into Shadow DOM (isolated stylesheet)
  - Render React overlay inside Shadow Root using `ReactDOM.createRoot()`
- **Considerations:**
  - Event handling works normally across shadow boundary
  - Use `:host` selector for shadow root styling
  - Load web fonts inside shadow DOM if needed

#### FR-005.5 Overlay Lifecycle Management
- **ID:** FR-005.5
- **Priority:** MEDIUM
- **Description:** Manage overlay creation, display, and cleanup
- **States:**
  1. **Hidden:** Overlay element exists but `display: none`
  2. **Opening:** Animation in progress (slide-up + fade-in, 200ms duration)
  3. **Active:** Fully visible, accepting user input
  4. **Closing:** Animation out progress (slide-down + fade-out, 150ms duration)
  5. **Destroyed:** Removed from DOM (on extension disable or site navigation)
- **Trigger Events:**
  - **Open:** User clicks "Refine" button
  - **Close:** User clicks X, presses Esc, or clicks outside overlay (on backdrop)
- **State Persistence:**
  - If user closes overlay mid-interview, save progress to `chrome.storage.session`
  - Option to "Resume Interview" if they re-open within same session

#### FR-005.6 Text Area Integration
- **ID:** FR-005.6
- **Priority:** HIGH
- **Description:** Seamless integration between overlay and host site's text area
- **Auto-Populate Behavior:**
  - When "Refine" clicked, capture current text area content as initial topic
  - Display captured text in overlay header ("Refining: [topic preview...]")
- **Mega-Prompt Injection:**
  - After interview completion, offer two actions:
    1. **Replace:** Clear text area and paste mega-prompt (primary action)
    2. **Append:** Add mega-prompt below existing text (secondary action)
  - Use programmatic text insertion (not clipboard, to avoid focus loss)
  - Handle both `textarea` and `contenteditable` elements
- **Undo Support:**
  - Store original text area content before replacement
  - Show "Undo" button for 5 seconds after injection
  - Restore original text if clicked

---

## 3. Technical Architecture

### 3.1 Technology Stack

#### 3.1.1 Frontend
- **Framework:** React 18+ with TypeScript
- **Build Tool:** Vite 5+
- **Chrome Extension Adapter:** CRXJS (@crxjs/vite-plugin)
- **Styling:** TailwindCSS 3+ + Shadcn/UI components
- **State Management:** Zustand (lightweight, simple API)
- **Routing:** React Router (for multi-page extension UI)

#### 3.1.2 Chrome Extension Architecture
- **Manifest Version:** V3
- **Required Permissions:**
  - `storage` (for API keys, settings, history)
  - `scripting` (for programmatic content script injection)
  - `activeTab` (for accessing current tab's DOM)
  - Host permissions for content scripts:
    - `https://chatgpt.com/*`
    - `https://claude.ai/*`
  - Host permissions for API calls:
    - `https://api.openai.com/*`
    - `https://api.anthropic.com/*`
- **Components:**
  - **Content Script:** Injected into ChatGPT/Claude.ai (primary user interface)
    - Detects text areas using MutationObserver
    - Renders "Refine" button and overlay
    - Handles text area content extraction and mega-prompt injection
  - **Popup:** Extension toolbar popup (minimal, opens settings or history)
  - **Options Page:** Settings & custom variable management
  - **Background Service Worker:** Handle API calls, state persistence, cross-component messaging

### 3.2 AI Engine: The Dual-Core System

#### 3.2.1 Tier 1: Local AI (Default/Free)
- **ID:** TECH-AI-001
- **Priority:** CRITICAL
- **Technology:** Chrome Built-in AI (`window.ai` / Gemini Nano)
- **Implementation:**
  1. **Capability Detection:**
     ```javascript
     async function checkLocalAI() {
       if ('ai' in window && 'languageModel' in window.ai) {
         const capabilities = await window.ai.languageModel.capabilities();
         return capabilities.available === 'readily';
       }
       return false;
     }
     ```
  2. **Fallback Mechanism:** If unavailable, show onboarding to enable at `chrome://flags/#optimization-guide-on-device-model`
  3. **Prompt Engineering:** Optimize for Gemini Nano's context window and capabilities

#### 3.2.2 Tier 2: Cloud AI (BYOK)
- **ID:** TECH-AI-002
- **Priority:** HIGH
- **Supported Providers:**
  - OpenAI (GPT-4, GPT-4-turbo)
  - Anthropic (Claude 3.5 Sonnet)
  - Future: Google Gemini API, local Ollama
- **API Key Management:**
  - Store in `chrome.storage.local` (encrypted if possible)
  - Never log or transmit keys except to official API endpoints
  - Validate key format before saving
  - Clear warning: "Keys are stored locally. We never see them."

#### 3.2.3 AI Prompt Strategy
- **Question Generation Prompt:**
  ```
  You are a Socratic interviewer. The user wants to: "{user_input}".
  Identify 3-5 critical missing pieces of context. For each, generate ONE specific question.
  Format: JSON array of {question, type, options?}
  ```
- **Mega-Prompt Compilation Prompt:**
  ```
  Compile the following into a structured CO-STAR prompt:
  - Original Goal: {input}
  - Context: {answers}
  - Injected Variables: {variables}
  Output a single, copy-paste ready prompt.
  ```

### 3.3 State Management Architecture

#### 3.3.1 Zustand Store Structure
```typescript
interface AppState {
  // Interview state
  currentTopic: string;
  questions: Question[];
  answers: Answer[];
  currentQuestionIndex: number;

  // AI state
  aiProvider: 'local' | 'openai' | 'anthropic';
  isLocalAIAvailable: boolean;

  // Settings
  apiKeys: {
    openai?: string;
    anthropic?: string;
  };
  customVariables: Variable[];

  // History
  promptHistory: GeneratedPrompt[];

  // Actions
  setTopic: (topic: string) => void;
  answerQuestion: (answer: Answer) => void;
  generateMegaPrompt: () => Promise<string>;
  saveToHistory: (prompt: GeneratedPrompt) => void;
}
```

### 3.4 Data Persistence
- **Storage:** `chrome.storage.local` (10MB quota)
- **Schema:**
  - `apiKeys`: Encrypted object
  - `customVariables`: Array of injection rules
  - `promptHistory`: Array (max 100 entries, FIFO)
  - `settings`: User preferences

---

## 4. User Interface & User Experience (Content Script Overlay Paradigm)

### 4.1 In-Page Overlay Interface (Primary User Flow)

#### 4.1.1 Refine Button (Entry Point)
- **Visibility:**
  - Appears automatically when user is on chatgpt.com or claude.ai
  - Positioned near the main prompt text area (top-right corner)
  - Only visible when text area is focused or contains text
- **Visual Design:**
  - Circular button with sparkle/magic wand icon
  - Theme-aware colors (matches site's light/dark mode)
  - Subtle pulse animation on first appearance
  - Tooltip: "Refine this prompt" (appears after 500ms hover)
- **Interaction:**
  - Click → Opens overlay interview
  - Captures current text area content as initial topic
  - Smooth fade-in animation (200ms)

#### 4.1.2 Overlay Interview Screen
- **Container:**
  - **Dimensions:** 500px width, max 600px height, centered on screen
  - **Backdrop:** Semi-transparent dark overlay (rgba(0,0,0,0.5)) with backdrop-blur
  - **Card:** Rounded corners (12px), shadow-2xl, theme-aware background
  - **Z-Index:** 999999 (above all site content)
  - **Shadow DOM:** Isolated from host site CSS
- **Header:**
  - **Close Button:** X icon (top-right corner, hover:bg-red-500)
  - **Topic Preview:** "Refining: [first 50 chars of captured text]..." (truncated with ellipsis)
  - **Progress Bar:** Linear, full-width, shows current question number
  - **Progress Text:** "Question 2 of 5" (centered, small font)
- **Body (Interview Question):**
  - **Layout:** Padding 24px, min-height 300px
  - **Question Text:** Large, readable font (text-lg font-medium), centered
  - **Input Area:** Contextual based on question type:
    - **Text:** Full-width textarea with border, rounded corners
    - **Radio:** Vertical list of options with custom radio buttons
    - **Checkbox:** Vertical list with custom checkboxes
    - **Scale:** Slider with labels (1-10 scale visualization)
  - **Auto-focus:** Input automatically focused for keyboard entry
- **Footer:**
  - **Layout:** Flex row, justify-between, border-top, padding 16px
  - **Left:** "Back" button (secondary styling, visible only if currentQuestionIndex > 0)
  - **Right:** "Next" button (primary styling, disabled if no answer provided)
  - **Skip:** Small "Skip" link (text-sm, text-muted, only for optional questions)
- **Interactions:**
  - **Keyboard Navigation:**
    - Enter key → Submit answer and go to next question
    - Esc key → Close overlay (confirm if interview is incomplete)
    - Tab → Navigate between elements
  - **Mouse:**
    - Click outside overlay (on backdrop) → Close overlay (with confirmation)
  - **Animations:**
    - Question transitions: Slide-left exit, slide-right enter (300ms ease-in-out)

#### 4.1.3 Result Screen (Mega-Prompt Ready)
- **Header:**
  - **Title:** "Your Mega-Prompt is Ready!" (text-2xl font-bold, text-green-600)
  - **Subtitle:** "Enhanced from: [original topic preview]"
  - **Close Button:** Still present (top-right)
- **Body:**
  - **Mega-Prompt Display:**
    - Code block with syntax highlighting (Monaco Editor or simple pre tag)
    - Max-height 400px with scroll
    - Line numbers (optional)
  - **CO-STAR Breakdown (Collapsible Sections):**
    - Accordion UI showing each CO-STAR component
    - Collapsed by default (only mega-prompt visible)
    - Expand icon (chevron down/up)
- **Actions (Footer):**
  - **Primary Action:** "Replace Prompt" button (green, bold)
    - Replaces text area content with mega-prompt
    - Closes overlay after 300ms delay
    - Shows brief success toast: "Prompt replaced!"
  - **Secondary Actions:**
    - "Append Instead" button (secondary styling)
      - Adds mega-prompt below existing text (with separator)
    - "Copy Only" button (secondary styling)
      - Copies to clipboard without modifying text area
      - Shows toast: "Copied to clipboard!"
    - "Edit First" button (secondary styling)
      - Opens inline editor (contenteditable version of mega-prompt)
  - **Tertiary Actions:**
    - "Save to History" link (small, text-muted)
    - "Start Over" link (small, text-muted, reopens interview with same topic)
- **Undo Mechanism:**
  - After "Replace Prompt", show floating "Undo" button for 5 seconds
  - Restores original text if clicked

### 4.2 Extension Toolbar Popup (Secondary Interface)

#### 4.2.1 Purpose & Scope
- **Role:** The popup is now a secondary interface (not the primary user entry point)
- **Access:** Click extension icon in Chrome toolbar
- **Use Cases:**
  - Quick access to prompt history
  - Jump to settings
  - View extension status (AI provider, recent usage)
  - Emergency access if content script fails on a page

#### 4.2.2 Popup Layout
- **Dimensions:** 350px width, 500px height
- **Header:**
  - Logo + "Prompt Architect" title
  - Settings gear icon (top-right)
- **Body:**
  - **Status Card:**
    - AI Provider: Local AI / OpenAI / Anthropic (with icon)
    - Status indicator (green dot = ready, yellow = needs API key)
  - **Quick Actions:**
    - "Open Settings" button
    - "View Full History" button
  - **Recent Prompts (Last 3):**
    - Card list showing title, date, preview
    - Click to expand and copy
- **Footer:**
  - "Works on chatgpt.com and claude.ai" (small text, muted)
  - Version number

### 4.3 Settings Page

#### 4.3.1 API Key Management
- **Section:** "AI Provider Settings"
- **Local AI Status:** Green checkmark if available, else "Enable Local AI" link to onboarding
- **BYOK Fields:**
  - OpenAI API Key (password input, show/hide toggle)
  - Anthropic API Key
  - "Test Connection" button (validates key)

#### 4.3.2 Custom Variables
- **Section:** "Custom Injection Rules"
- **Table:** Trigger | Injected Text | Actions (Edit, Delete)
- **Add New:** Form modal with validation

#### 4.3.3 General Settings
- Default AI provider (Local, OpenAI, Anthropic)
- Theme preference (Light, Dark, System) - applies to overlay
- Max history entries
- Overlay animation speed (Normal, Fast, Reduced Motion)

### 4.4 Onboarding Flow

#### 4.4.1 First-Time User Experience
- **Step 1:** Welcome screen explaining the concept
- **Step 2:** AI Diagnostic
  - Check `window.ai` availability
  - If unavailable: Show visual guide to enable `chrome://flags`
  - If available: "All set! Let's build your first prompt."
- **Step 3:** Quick tutorial (optional, can skip)

---

## 5. Non-Functional Requirements

### 5.1 Performance
- **NFR-001:** Content script injection < 100ms after page load
- **NFR-002:** Overlay open animation < 200ms (perceived as instant)
- **NFR-003:** Question generation < 3 seconds (local AI) or < 5 seconds (cloud AI)
- **NFR-004:** Smooth transitions (60 FPS animations for all overlay interactions)
- **NFR-005:** MutationObserver callbacks debounced to max 1 execution per 500ms
- **NFR-006:** Shadow DOM creation < 50ms
- **NFR-007:** No visible page layout shift when refine button injected

### 5.2 Security
- **NFR-008:** API keys stored with Web Crypto API encryption where possible
- **NFR-009:** No telemetry or data collection without explicit consent
- **NFR-010:** Content Security Policy compliant with Manifest V3
- **NFR-011:** Content script never reads sensitive data from host page (passwords, credit cards, PII)
- **NFR-012:** Content script only captures text from explicit user-selected text areas
- **NFR-013:** Shadow DOM prevents host site JavaScript from accessing extension internals
- **NFR-014:** No eval() or inline scripts in content script (CSP compliance)

### 5.3 Reliability
- **NFR-015:** Graceful degradation if AI provider fails (show error message with retry option)
- **NFR-016:** Offline capability for history viewing (via extension popup)
- **NFR-017:** Auto-save interview progress to session storage (recover on overlay close/crash)
- **NFR-018:** Content script handles site DOM changes gracefully (re-inject button if removed)
- **NFR-019:** Fallback selectors for text area detection (handle site redesigns)
- **NFR-020:** Overlay persists across page navigations within SPA (with user confirmation)

### 5.4 Accessibility
- **NFR-010:** WCAG 2.1 AA compliant
- **NFR-011:** Full keyboard navigation support
- **NFR-012:** Screen reader compatible

---

## 6. Project Constraints

### 6.1 Technical Constraints
- Must run entirely client-side (except cloud API calls)
- Chrome 120+ required for `window.ai` support
- Maximum extension package size: 20MB

### 6.2 Business Constraints
- Zero-cost operation for users with local AI
- No recurring infrastructure costs
- Open-source friendly (future consideration)

---

## 7. Future Enhancements (Out of Scope for V1)

- **Multi-language support** (i18n)
- **Prompt templates marketplace** (community-contributed)
- **Firefox/Edge extension ports**
- **Integration with ChatGPT/Claude web UIs** (auto-paste)
- **Voice input for interview questions**
- **Collaborative prompt building** (share interview links)

---

## 8. Acceptance Criteria

### 8.1 Definition of Done
A feature is considered complete when:
1. Code passes TypeScript type checking
2. UI matches Figma designs (if applicable) or adheres to Shadcn/UI standards
3. Tested in Chrome (latest stable + 1 version back)
4. Documented in `WORK_LOG.md`
5. No console errors or warnings

### 8.2 MVP Release Criteria
Version 1.0 is ready for release when:
- [ ] **FR-001.1:** Content script injection working on chatgpt.com and claude.ai
- [ ] **FR-001.1a:** Refine button appears and captures text area content
- [ ] **FR-001.2-1.3:** AI analyzes topic and generates contextual questions
- [ ] **FR-001.4:** Overlay interview UI fully functional with theme matching
- [ ] **FR-001.5:** Answer compilation into structured data
- [ ] **FR-002.1:** Basic variable injection working
- [ ] **FR-003.x:** Mega-Prompt generation with CO-STAR framework
- [ ] **FR-005.x:** All content script architecture requirements (MutationObserver, Shadow DOM, theme detection)
- [ ] **TECH-AI-001:** Local AI support (with graceful fallback)
- [ ] **TECH-AI-002:** BYOK for OpenAI and Anthropic
- [ ] All CRITICAL priority items complete
- [ ] Tested on both chatgpt.com and claude.ai (light and dark modes)
- [ ] No conflicts with host site functionality
- [ ] Overlay works on different screen sizes (responsive)

---

## 9. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| `window.ai` API changes | Medium | High | Maintain adapter layer, version detection |
| Low local AI adoption | High | Medium | Excellent BYOK UX, pre-populate with demo |
| Prompt quality issues | Medium | High | Extensive testing, user feedback loop |
| Chrome Web Store rejection | Low | High | Thorough Manifest V3 compliance review |

---

## 10. Appendices

### 10.1 References
- [Chrome Built-in AI Documentation](https://developer.chrome.com/docs/ai/built-in)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [CO-STAR Prompt Framework](https://www.linkedin.com/pulse/co-star-framework-crafting-effective-prompts-ai-models-santosh-katari/)

### 10.2 Glossary
- **Socratic Method:** Teaching/interviewing technique using questions to extract knowledge
- **World Building:** The process of creating a rich, detailed context for a creative work
- **Lazy Prompting:** Writing vague, low-effort prompts that produce poor AI outputs

---

**End of Document**
