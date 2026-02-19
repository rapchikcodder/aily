// FR-005.1: Site-specific selectors and text area handling
// Maintains fallback selector chains so DOM redesigns don't break the extension

export type SiteId = 'chatgpt' | 'claude';

export interface SiteAdapter {
  id: SiteId;
  name: string;
  /** Ordered list of selectors to try — first match wins */
  textAreaSelectors: string[];
  /** Selector for the container wrapping the text area (used to anchor Refine button) */
  containerSelectors: string[];
  /** How to detect dark mode on this site */
  detectDarkMode: () => boolean;
  /** Programmatically set text area value (handles both textarea & contenteditable) */
  setTextAreaValue: (el: Element, text: string) => void;
  /** Read current text area value */
  getTextAreaValue: (el: Element) => string;
}

// ---------- Helper: fire React synthetic events so the SPA picks up changes ----------
function triggerReactChange(el: HTMLElement) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLElement.prototype,
    'value'
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, (el as HTMLTextAreaElement).value);
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ---------- ChatGPT Adapter ----------
const chatGPTAdapter: SiteAdapter = {
  id: 'chatgpt',
  name: 'ChatGPT',

  textAreaSelectors: [
    '#prompt-textarea',
    'textarea[data-id="root"]',
    'textarea[placeholder*="Message"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div[contenteditable="true"]',
  ],

  containerSelectors: [
    'form.stretch',
    '.relative.flex.h-full',
    'div[class*="composer"]',
    'form',
  ],

  detectDarkMode() {
    // ChatGPT adds dark class to <html>
    if (document.documentElement.classList.contains('dark')) return true;
    // Fallback: check computed background color
    const bg = getComputedStyle(document.body).backgroundColor;
    const [r, g, b] = bg.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
    return (r + g + b) / 3 < 128;
  },

  getTextAreaValue(el) {
    if (el instanceof HTMLTextAreaElement) return el.value;
    return (el as HTMLElement).innerText ?? '';
  },

  setTextAreaValue(el, text) {
    if (el instanceof HTMLTextAreaElement) {
      el.value = text;
      triggerReactChange(el as HTMLTextAreaElement);
    } else {
      // contenteditable (Lexical editor)
      (el as HTMLElement).focus();
      document.execCommand('selectAll', false);
      document.execCommand('insertText', false, text);
    }
  },
};

// ---------- Claude Adapter ----------
const claudeAdapter: SiteAdapter = {
  id: 'claude',
  name: 'Claude',

  textAreaSelectors: [
    'div[contenteditable="true"].ProseMirror',
    'div[contenteditable="true"][data-placeholder]',
    'div[contenteditable="true"]',
    'textarea',
  ],

  containerSelectors: [
    'fieldset',
    'div[class*="input-area"]',
    'div[class*="composer"]',
    'form',
  ],

  detectDarkMode() {
    // Claude uses data-theme or dark class on html/body
    const html = document.documentElement;
    if (html.getAttribute('data-theme') === 'dark') return true;
    if (html.classList.contains('dark')) return true;
    if (document.body.classList.contains('dark')) return true;
    const bg = getComputedStyle(document.body).backgroundColor;
    const [r, g, b] = bg.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
    return (r + g + b) / 3 < 128;
  },

  getTextAreaValue(el) {
    return (el as HTMLElement).innerText ?? '';
  },

  setTextAreaValue(el, text) {
    (el as HTMLElement).focus();
    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  },
};

// ---------- Public API ----------
const adapters: Record<SiteId, SiteAdapter> = {
  chatgpt: chatGPTAdapter,
  claude: claudeAdapter,
};

export function detectSite(): SiteId | null {
  const host = window.location.hostname;
  if (host.includes('chatgpt.com')) return 'chatgpt';
  if (host.includes('claude.ai')) return 'claude';
  return null;
}

export function getAdapter(siteId: SiteId): SiteAdapter {
  return adapters[siteId];
}

/** Try selectors in order, return first match */
export function findTextArea(adapter: SiteAdapter): Element | null {
  for (const selector of adapter.textAreaSelectors) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

/** Find the best container to anchor the Refine button */
export function findContainer(adapter: SiteAdapter): Element | null {
  for (const selector of adapter.containerSelectors) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}
