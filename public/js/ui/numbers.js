/**
 * Bengali digit localization for visible UI text.
 * Underlying form values, IDs, URLs and numeric attributes stay unchanged.
 */
(function (root) {
  const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const SKIP_TEXT_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG', 'TEXTAREA', 'INPUT']);
  const SKIP_ATTRIBUTE_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG']);
  const TEXT_ATTRIBUTES = ['title', 'aria-label', 'placeholder'];

  function toBengaliDigits(value) {
    return String(value ?? '').replace(/[0-9]/g, (digit) => BN_DIGITS[Number(digit)]);
  }

  // Musical note names (C4, A#3) must stay in Latin digits — Bengali ৮/৪ can
  // be misread as 8/4 and confuses learners. Elements opt out with this
  // attribute (and their whole subtree is skipped).
  function isProtected(el) {
    while (el) {
      if (el.nodeType === 1 && el.hasAttribute && el.hasAttribute('data-no-bn-digits')) return true;
      el = el.parentElement;
    }
    return false;
  }

  function shouldSkip(node) {
    let el = node.nodeType === 1 ? node : node.parentElement;
    if (isProtected(el)) return true;
    while (el) {
      if (SKIP_TEXT_TAGS.has(el.tagName)) return true;
      el = el.parentElement;
    }
    return false;
  }

  function localizeTextNode(node) {
    if (!node || node.nodeType !== 3 || shouldSkip(node)) return;
    const next = toBengaliDigits(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  function localizeElementAttributes(el) {
    if (!el || el.nodeType !== 1 || SKIP_ATTRIBUTE_TAGS.has(el.tagName) || isProtected(el)) return;
    for (const name of TEXT_ATTRIBUTES) {
      if (!el.hasAttribute(name)) continue;
      const next = toBengaliDigits(el.getAttribute(name));
      if (next !== el.getAttribute(name)) el.setAttribute(name, next);
    }
  }

  function localizeTree(rootNode) {
    if (!rootNode) return;
    if (rootNode.nodeType === 3) {
      localizeTextNode(rootNode);
      return;
    }
    if (rootNode.nodeType !== 1 && rootNode.nodeType !== 9) return;
    localizeElementAttributes(rootNode);
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (node.nodeType === 3) return shouldSkip(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        // Traverse native controls too. Values and numeric attributes stay
        // ASCII; only user-visible text is localized.
        if (SKIP_ATTRIBUTE_TAGS.has(node.tagName) || isProtected(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let current = walker.currentNode;
    while ((current = walker.nextNode())) {
      if (current.nodeType === 3) localizeTextNode(current);
      else localizeElementAttributes(current);
      if (current.nodeType === 1 && current.tagName === 'SELECT') {
        for (const option of current.options) {
          if (option.firstChild?.nodeType === 3) localizeTextNode(option.firstChild);
        }
      }
    }
  }

  function refreshControllerScript() {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = '/numbers-repair.js?' + Date.now();
      script.async = false;
      const finish = () => {
        root.__gansiNumbersControllerLoaded = true;
        script.remove();
        resolve(true);
      };
      script.onerror = () => {
        script.remove();
        resolve(false);
      };
      script.addEventListener('load', finish, { once: true });
      document.head.appendChild(script);
    });
  }

  function requestAppShellRefresh(reason) {
    if (root.__gansiAppShellRefreshPending) return true;
    root.__gansiAppShellRefreshPending = true;
    const script = document.createElement('script');
    script.src = '/js/ui/numbers.js?' + encodeURIComponent(reason || 'refresh');
    script.async = false;
    const finish = () => {
      script.remove();
      root.__gansiAppShellRefreshPending = false;
    };
    script.onerror = finish;
    document.head.appendChild(script);
    script.addEventListener('load', finish, { once: true });
    return true;
  }

  function start() {
    if (!document.body) return;
    const missingScript = !root.GanSiNumbers;
    localizeTree(document.body);
    if (!root.__gansiNumberObserver) {
      const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.type === 'characterData') localizeTextNode(mutation.target);
          if (mutation.type === 'attributes') localizeElementAttributes(mutation.target);
          for (const node of mutation.addedNodes) localizeTree(node);
        }
      });
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: TEXT_ATTRIBUTES
      });
      root.__gansiNumberObserver = observer;
    }

    if (typeof document === 'undefined') return;
    if (missingScript) requestAppShellRefresh('numbers-refresh');
    if (document.readyState === 'loading') {
      const controller = new AbortController();
      root.__gansiNumbersControllerLoaded = false;
      const retry = setTimeout(() => {
        if (document.readyState === 'loading') return;
        start();
        controller.abort();
        if (!root.__gansiNumbersControllerLoaded) refreshControllerScript();
      }, 1500);
      const onReady = () => {
        start();
        // Cached HTML may omit this initial repair script too. Ensure the
        // app's DOMContentLoaded listeners always have an active observer.
        if (!root.__gansiNumbersControllerLoaded) refreshControllerScript();
      };
      document.addEventListener('DOMContentLoaded', onReady, { once: true });
      controller.signal.addEventListener('abort', () => {
        clearTimeout(retry);
        document.removeEventListener('DOMContentLoaded', onReady);
      }, { once: true });
    } else {
      if (missingScript && !root.__gansiNumbersControllerLoaded) refreshControllerScript();
    }
  }

  const api = { toBengaliDigits, localizeTree, start, requestAppShellRefresh };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GanSiNumbers = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
})(typeof window !== 'undefined' ? window : globalThis);
