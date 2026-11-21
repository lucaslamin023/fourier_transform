/* ============================================================================
 * AEM-Lab · Gerenciamento de Tema Claro / Escuro (Paleta Coffee)
 * ============================================================================ */
window.AEM = window.AEM || {};

AEM.Theme = (() => {
  'use strict';

  const THEME_KEY = 'aem-coffee-theme';
  const listeners = new Set();

  function applySaved() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  }

  function isDark() {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function toggle() {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    listeners.forEach(fn => {
      try { fn(next); } catch (_) {}
    });
    return next;
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function bindButton(buttonId) {
    const btn = document.getElementById(buttonId);
    if (btn) btn.addEventListener('click', toggle);
  }

  applySaved();

  return { isDark, toggle, onChange, bindButton };
})();

