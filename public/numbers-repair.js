// Cache-repair bootstrap for a page whose cached HTML predates number support.
// This file is loaded by numbers.js after DOMContentLoaded so the global
// MutationObserver starts before the rest of the app mutates the DOM.
(function (root) {
  function start() {
    root.__gansiNumbersControllerLoaded = true;
    if (!root.GanSiNumbers) return;
    root.GanSiNumbers.start();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})(window);
