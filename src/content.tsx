/**
 * FR-005: Content Script — The Grammarly-style injector
 * Fixes applied:
 *   - No top-level throw (crashed the module silently)
 *   - Full Tailwind CSS injected into every Shadow DOM via ?inline import
 *   - Extensive console logging for debugging
 *   - More robust textarea selectors with retry logic
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { RefineButton } from './components/RefineButton';
import { InterviewOverlay } from './components/InterviewOverlay';
import { detectSite, getAdapter, findTextArea, findContainer } from './lib/siteAdapters';
// Import full Tailwind CSS as a string — injected into every Shadow DOM
import contentStyles from './content-styles.css?inline';

const LOG = '[PromptArchitect]';
console.log(`${LOG} Content script loaded on`, window.location.hostname);

// ─── 1. Identify the site ──────────────────────────────────────────────────
const siteId = detectSite();
if (!siteId) {
  // Not a supported site — exit gracefully, no throw
  console.warn(`${LOG} Unsupported site, exiting.`);
} else {
  console.log(`${LOG} Site detected:`, siteId);
  main();
}

function main() {
  const adapter = getAdapter(siteId!);

  // ─── State ──────────────────────────────────────────────────────────────
  let refineButtonRoot: ReactDOM.Root | null = null;
  let refineButtonContainer: HTMLElement | null = null;
  let overlayRoot: ReactDOM.Root | null = null;
  let overlayHostEl: HTMLElement | null = null;   // direct reference — never re-query by ID
  let watchedTextArea: Element | null = null;
  let _originalText = '';

  // ─── Shadow DOM factory with FULL Tailwind CSS ──────────────────────────
  function makeShadow(host: HTMLElement): ShadowRoot {
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = contentStyles;
    shadow.appendChild(style);
    return shadow;
  }

  // ─── Render helpers ─────────────────────────────────────────────────────
  function renderRefineButton(hasText: boolean) {
    if (!refineButtonRoot) return;
    const isDark = adapter.detectDarkMode();
    refineButtonRoot.render(
      <React.StrictMode>
        <RefineButton onClick={openOverlay} isDark={isDark} hasText={hasText} />
      </React.StrictMode>
    );
  }

  function renderOverlay(topic: string) {
    if (!overlayRoot) return;
    const isDark = adapter.detectDarkMode();
    console.log(`${LOG} Rendering overlay for topic:`, topic || '(empty)');
    overlayRoot.render(
      <React.StrictMode>
        <InterviewOverlay
          topic={topic}
          isDark={isDark}
          onClose={closeOverlay}
          onReplaceText={handleReplaceText}
          onAppendText={handleAppendText}
        />
      </React.StrictMode>
    );
  }

  // ─── Text area helpers ───────────────────────────────────────────────────
  function getCurrentText(): string {
    if (!watchedTextArea) return '';
    return adapter.getTextAreaValue(watchedTextArea);
  }

  function handleReplaceText(megaPrompt: string) {
    if (!watchedTextArea) return;
    _originalText = getCurrentText();
    adapter.setTextAreaValue(watchedTextArea, megaPrompt);
    (watchedTextArea as HTMLElement).focus?.();
  }

  function handleAppendText(megaPrompt: string) {
    if (!watchedTextArea) return;
    const current = getCurrentText();
    const sep = current.trim() ? '\n\n---\n\n' : '';
    adapter.setTextAreaValue(watchedTextArea, current + sep + megaPrompt);
    (watchedTextArea as HTMLElement).focus?.();
  }

  // Returns the overlay host, re-attaching to <html> if the SPA removed it from the DOM
  function getOverlayHost(): HTMLElement | null {
    if (!overlayHostEl) return null;
    if (!document.documentElement.contains(overlayHostEl)) {
      // ChatGPT/Claude SPA re-rendered and removed our node — reattach to <html>
      console.log(`${LOG} ⚠️ Overlay host detached — re-attaching to <html>`);
      document.documentElement.appendChild(overlayHostEl);
    }
    return overlayHostEl;
  }

  function openOverlay() {
    const topic = getCurrentText().trim();
    const host = getOverlayHost();
    if (host) {
      host.style.display = 'block';
      host.style.pointerEvents = 'auto';
      console.log(`${LOG} 🔓 Overlay host shown`);
    } else {
      console.warn(`${LOG} openOverlay: host not found`);
    }
    renderOverlay(topic);
  }

  function closeOverlay() {
    const host = getOverlayHost();
    if (host) {
      host.style.display = 'none';
      host.style.pointerEvents = 'none';
    }
    if (overlayRoot) overlayRoot.render(<></>);
  }

  // ─── Inject Refine Button ────────────────────────────────────────────────
  // Uses position:fixed + getBoundingClientRect so overflow:hidden can never clip it.
  function positionButton() {
    if (!refineButtonContainer || !watchedTextArea) return;
    const rect = watchedTextArea.getBoundingClientRect();
    if (rect.width === 0) return; // element not visible yet
    Object.assign(refineButtonContainer.style, {
      top:  `${rect.top + 8}px`,
      left: `${rect.right - 48}px`,
    });
  }

  function injectRefineButton(textArea: Element) {
    if (refineButtonContainer && document.documentElement.contains(refineButtonContainer)) {
      console.log(`${LOG} Button already injected, skipping.`);
      return;
    }

    console.log(`${LOG} Injecting Refine button (fixed position)`);

    // Fixed-position host appended to <html> — SPAs manage body, never <html>
    refineButtonContainer = document.createElement('div');
    refineButtonContainer.id = 'prompt-architect-refine-btn';
    Object.assign(refineButtonContainer.style, {
      position: 'fixed',
      zIndex: '2147483647',
      pointerEvents: 'all',
      width: '40px',
      height: '40px',
    });
    document.documentElement.appendChild(refineButtonContainer);

    // Shadow DOM with full Tailwind CSS
    const shadow = makeShadow(refineButtonContainer);
    const mount = document.createElement('div');
    shadow.appendChild(mount);

    refineButtonRoot = ReactDOM.createRoot(mount);
    watchedTextArea = textArea;

    positionButton();
    renderRefineButton(getCurrentText().trim().length > 0);

    // Re-position on scroll / resize
    window.addEventListener('scroll', positionButton, { passive: true });
    window.addEventListener('resize', positionButton, { passive: true });

    textArea.addEventListener('input', () => {
      renderRefineButton(getCurrentText().trim().length > 0);
    });

    console.log(`${LOG} ✅ Refine button mounted`);
  }

  // ─── Overlay host ────────────────────────────────────────────────────────
  // Production pattern (Grammarly-style):
  //   • Host is always position:fixed covering full viewport
  //   • Hidden with display:none (not empty React render) — zero paint cost
  //   • Mount div is position:relative + full size so backdrop uses position:absolute
  //   • This avoids position:fixed inside Shadow DOM which has browser edge cases
  function initOverlayHost() {
    if (overlayRoot) return;

    const host = document.createElement('div');
    host.id = 'prompt-architect-overlay-host';
    // Inline styles beat any :host CSS rule — these persist through Shadow DOM insertion
    Object.assign(host.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483647',
      pointerEvents: 'none',
      display: 'none',        // hidden until overlay is opened
    });
    // Append to <html> not <body> — SPAs (ChatGPT/Claude) manage body children
    // and may remove foreign elements on re-render. <html> is never touched by SPAs.
    document.documentElement.appendChild(host);
    overlayHostEl = host;     // store direct ref — used by getOverlayHost()

    const shadow = makeShadow(host);

    // Mount div: position:relative + full size → backdrop can use position:absolute
    const mount = document.createElement('div');
    mount.id = 'prompt-architect-overlay-mount';
    mount.style.cssText = 'position:relative;width:100%;height:100%;pointer-events:none;';
    shadow.appendChild(mount);

    overlayRoot = ReactDOM.createRoot(mount);
    console.log(`${LOG} ✅ Overlay host mounted`);
  }

  // ─── MutationObserver ────────────────────────────────────────────────────
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function checkAndInject() {
    const el = findTextArea(adapter);
    if (!el) {
      console.log(`${LOG} No textarea found yet, waiting...`);
      return;
    }
    if (el === watchedTextArea && refineButtonContainer && document.documentElement.contains(refineButtonContainer)) {
      positionButton(); // keep position fresh on every DOM tick
      return;
    }
    console.log(`${LOG} Textarea found:`, el.tagName, (el as HTMLElement).id || el.className?.slice?.(0, 40));
    injectRefineButton(el);
  }

  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkAndInject, 500);
  });

  // ─── Boot ────────────────────────────────────────────────────────────────
  function boot() {
    console.log(`${LOG} 🚀 Booting...`);
    initOverlayHost();
    checkAndInject();
    observer.observe(document.body, { childList: true, subtree: true });
    console.log(`${LOG} MutationObserver active`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
