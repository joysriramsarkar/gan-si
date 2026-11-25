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
    // Every ASCII digit in visible text localizes, including inside tokens
    // like note names (A4 -> A৪): the note letter stays Latin, the digit is
    // read by Bengali users as a number.
    return String(value ?? '').replace(/[0-9]/g, (digit) => BN_DIGITS[Number(digit)]);
  }

  function shouldSkip(node) {
    let el = node.nodeType === 1 ? node : node.parentElement;
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
    if (!el || el.nodeType !== 1 || SKIP_ATTRIBUTE_TAGS.has(el.tagName)) return;
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
        return SKIP_TEXT_TAGS.has(node.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let current = walker.currentNode;
    while ((current = walker.nextNode())) {
      if (current.nodeType === 3) localizeTextNode(current);
      else localizeElementAttributes(current);
    }
  }

  function start() {
    if (!document.body || root.__gansiNumberObserver) return;
    localizeTree(document.body);
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

  const api = { toBengaliDigits, localizeTree, start };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GanSiNumbers = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
})(typeof window !== 'undefined' ? window : globalThis);
