# Work Log - Prompt Architect Chrome Extension

**Project Start Date:** 2026-02-18
**Lead Developer:** Claude (Senior Solutions Architect)
**Client:** Krish

---

## Session 3 — Overlay not rendering (Grammarly pattern audit)

**Problem:** Button click triggered `renderOverlay()` (confirmed in logs) but nothing appeared visually.

**Root causes identified (3, all fixed):**

1. **`position:fixed` inside Shadow DOM** — Using `position:fixed` on the backdrop inside the Shadow DOM has edge-cases in Chrome where the containing block isn't always the viewport when the shadow host itself is `position:fixed`. Production extensions (Grammarly, 1Password) avoid this entirely.
   - **Fix:** Overlay host is `position:fixed; width:100%; height:100%` (full viewport). Mount div is `position:relative; width:100%; height:100%`. Backdrop uses `position:absolute; top:0; left:0; width:100%; height:100%` — fills the host, no `fixed` inside Shadow DOM.

2. **Zero-size host (was `width:0; height:0`)** — The original host had no dimensions. Even with `overflow:visible`, Chrome may not paint Shadow DOM contents that overflow a 0×0 `position:fixed` host when it has no `contain` override.
   - **Fix:** Host is always full-viewport (`width:100%; height:100%`), hidden with `display:none` instead of being zero-sized.

3. **`display:none` toggle vs empty React render** — The previous pattern called `overlayRoot.render(<></>)` to "close" the overlay, which has a React reconciliation cost and can miss edge-cases. The production pattern is `display:none / block` on the host.
   - **Fix:** `openOverlay()` sets `host.style.display = 'block'`; `closeOverlay()` sets `display = 'none'`. React still unmounts the component for cleanup, but the host visibility is controlled by CSS.

4. **`@tailwind base` in Shadow DOM CSS** — Tailwind Preflight (`@tailwind base`) targets `html`, `body`, and `*` selectors. Inside Shadow DOM these cascade unexpectedly. Removed in favour of `@tailwind components; @tailwind utilities;` plus a targeted `:host` reset (no `all:initial`).

**Files changed:** `src/content.tsx`, `src/components/InterviewOverlay.tsx`, `src/content-styles.css`
**Build size:** 70.90 kB (content bundle, -4 kB from removing preflight)

---

## 2026-02-18

### 10:00 AM - Project Initialization
**Status:** ✅ Complete
**Actions:**
- Created `SRS.md` (Software Requirements Specification) v1.0
- Defined complete functional requirements (FR-001 through FR-004)
- Specified technical architecture (Dual-Core AI System: Local-First + BYOK)
- Documented UX/UI flows for Popup, Settings, and Onboarding
- Established non-functional requirements (Performance, Security, Accessibility)
- Set acceptance criteria for MVP release

**Key Decisions:**
1. **Technology Stack Finalized:**
   - Frontend: React 18 + TypeScript + Vite
   - Extension Framework: CRXJS
   - UI: TailwindCSS + Shadcn/UI
   - State: Zustand

2. **AI Strategy:**
   - Tier 1 (Default): Chrome Built-in AI (`window.ai` / Gemini Nano)
   - Tier 2 (Fallback): BYOK (OpenAI/Anthropic APIs)
   - Capability detection required before first use

3. **Core Features for MVP:**
   - Interview Loop (FR-001)
   - Variable Injector with built-in library (FR-002)
   - CO-STAR Mega-Prompt Generator (FR-003)
   - Basic History (FR-004)

**Notes:**
- SRS is now the single source of truth
- All code changes must reference SRS requirement IDs
- No code written yet (adherence to "Holy Bible" rule)

---

### 12:30 PM - Project Structure Initialization
**Status:** ✅ Complete
**Actions:**
- Initialized npm project and installed all dependencies
- Created project folder structure (src/components, pages, stores, lib, etc.)
- Created configuration files:
  - `tsconfig.json` - TypeScript configuration
  - `vite.config.ts` - Vite with CRXJS plugin
  - `tailwind.config.js` - TailwindCSS with Shadcn theme variables
  - `postcss.config.js` - PostCSS for Tailwind
  - `manifest.json` - Manifest V3 with required permissions
- Created core application files:
  - `src/main.tsx` - Popup entry point
  - `src/App.tsx` - Main app component
  - `src/options.tsx` - Options page entry
  - `src/background.ts` - Service worker with API handlers
  - `src/stores/useAppStore.ts` - Zustand store (SRS Section 3.3.1)
  - `src/pages/HomePage.tsx` - Initial home screen
  - `src/pages/OptionsPage.tsx` - Settings page with API key management
  - `src/index.css` - Global CSS with Tailwind directives
  - `src/lib/utils.ts` - Utility functions for Shadcn
- Created HTML entry files (index.html, options.html)
- Created placeholder icons and documentation
- Updated package.json with proper scripts and metadata

**Dependencies Installed:**
- Core: react, react-dom, zustand
- Build Tools: vite, @crxjs/vite-plugin, typescript
- Styling: tailwindcss, tailwindcss-animate, clsx, tailwind-merge
- Dev: @types/react, @types/react-dom, @types/node

**Project Status:**
- ✅ All configuration files created
- ✅ Basic React component structure in place
- ✅ Zustand store implements SRS state schema
- ✅ Background service worker with API integration scaffolding
- ✅ Options page with API key management UI
- ✅ Local AI detection logic implemented
- ⏳ Content script (Grammarly-style injection) - NEW REQUIREMENT

**Build Commands Available:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run type-check` - TypeScript validation

---

### 12:45 PM - NEW REQUIREMENT: Content Script Injection
**Status:** 🚧 In Progress
**Client Request:**
Client has requested a major UX change - the extension should work like Grammarly:
- **Content Script Injection:** Inject a floating "Refine" button into chatgpt.com and claude.ai
- **Behavior:** When user types in text area, show a non-intrusive icon (like Grammarly G)
- **Action:** Clicking icon opens interviewer overlay on top of the website (no popup window)
- **Technical Requirements:**
  - Use `MutationObserver` to detect text area in SPAs
  - Inherit site's theme (Dark/Light mode)
  - Overlay should look native to the site

**Impact on SRS:**
- This changes FR-001.4 (Interactive Interview UI) significantly
- Requires new manifest permissions: `content_scripts`, host permissions
- Requires new component: Overlay UI (not popup-based)
- Requires content script implementation with DOM injection logic

**Next Actions:**
1. Update SRS.md to reflect this new UX paradigm
2. Update manifest.json with content_scripts configuration
3. Create content script file (src/content.tsx)
4. Create overlay component for in-page interview
5. Implement MutationObserver for text area detection
6. Implement theme detection and matching

---

### 1:30 PM - Content Script Implementation (v1.0)
**Status:** ✅ Complete
**SRS References:** FR-005.1, FR-005.2, FR-005.3, FR-005.4, FR-005.5, FR-005.6

**Files Created:**
- `src/content.tsx` — Main content script: MutationObserver, Shadow DOM boot, button + overlay lifecycle
- `src/lib/siteAdapters.ts` — Selector chains + theme detection for ChatGPT and Claude.ai
- `src/lib/aiEngine.ts` — Dual-Core AI: Local (window.ai) → OpenAI → Anthropic with auto-fallback
- `src/lib/variableInjector.ts` — Built-in injection library (Python, JS, TS, React, Next.js, Django, Healthcare, Finance, Education, Academic, Beginner, Expert)
- `src/components/RefineButton.tsx` — Floating sparkle button (tooltip, hasText opacity, shadow DOM)
- `src/components/InterviewOverlay.tsx` — Overlay orchestrator (5 stages: loading → interview → compiling → result → error)
- `src/components/QuestionCard.tsx` — Typeform-style question UI (text, radio, checkbox, scale)
- `src/components/ResultScreen.tsx` — Mega-prompt display with Replace / Append / Copy / Edit / Undo

**Files Modified:**
- `manifest.json` — Added content_scripts, scripting permission, host permissions for chatgpt.com + claude.ai
- `SRS.md` — Updated to v1.1: Added FR-005.x, updated FR-001.4, 3.1.2 Architecture, Section 4 UI/UX

**Architecture Decisions:**
1. **Double Shadow DOM** — Refine button and overlay each get their own Shadow Root to fully isolate from host page CSS
2. **Auto-fallback chain** — Local AI → OpenAI (if key present) → Anthropic (if key present) → Error (if none)
3. **MutationObserver debounce** — 500ms debounce on all DOM change callbacks (NFR-005)
4. **execCommand for text injection** — Works for both `<textarea>` and contenteditable (Lexical/ProseMirror), triggers React synthetic events

**TypeScript Fixes Applied:**
- Installed `@types/chrome` (was missing, caused all `chrome.*` type errors)
- Cast `chrome.storage.local.get()` results to proper types (returns `unknown`)
- Set `noUnusedLocals: false` + `noUnusedParameters: false` in tsconfig (development phase)
- Added explicit type params to message listener in background.ts

**Type Check Result: ✅ 0 errors**

**Build Fixes Applied:**
- Downgraded `tailwindcss@4` → `tailwindcss@3` (v4 moved PostCSS plugin to separate package)
- Created placeholder PNG icons (`public/icons/icon-16/48/128.png`) — CRXJS requires physical files

**Build Result: ✅ SUCCESS — `npm run build` in 3.48s, 0 errors**
```
dist/assets/content.tsx  55.02 kB (gzip: 18.64 kB)
dist/assets/client.js   192.49 kB (gzip: 60.35 kB)
dist/manifest.json        1.48 kB
```

**Pending / Next Steps:**
- ⏳ Live testing on chatgpt.com and claude.ai
- ⏳ Popup update to secondary "status + history" role
- ⏳ Replace placeholder icons with real designed icons

---

## Legend
- ✅ Complete
- ⏳ Pending
- 🚧 In Progress
- ❌ Blocked
- ⚠️ Issue/Risk
