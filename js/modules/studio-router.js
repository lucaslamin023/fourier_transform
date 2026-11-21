/* ============================================================================
 * AEM-Lab · Roteador de Estúdio (Modo Multi-Abas ou Página Individual)
 * ============================================================================ */
window.AEM = window.AEM || {};

AEM.StudioRouter = (() => {
  'use strict';

  function start() {
    AEM.Theme.bindButton('btnTheme');
    AEM.Audio.bindStopAllButton('btnStopAllAudio');

    const singleMod = document.body.dataset.singleModule;
    if (singleMod && AEM.Modules && AEM.Modules[singleMod]) {
      const mod = AEM.Modules[singleMod];
      mod.init();
      window.addEventListener('resize', () => mod.resize && mod.resize());

      let lastTs = performance.now();
      function loopSingle(ts) {
        const dt = Math.min(0.05, (ts - lastTs) / 1000);
        lastTs = ts;
        if (mod.tick) mod.tick(dt);
        requestAnimationFrame(loopSingle);
      }
      requestAnimationFrame(loopSingle);
      return;
    }

    // Modo Multi-Abas (caso usado)
    const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
    const VALID_TABS = new Set(['contornos', 'ondas', 'helice', 'desenho', 'mp3']);
    let activeTab = 'contornos';

    function switchTab(tabId, updateHash = true) {
      if (!VALID_TABS.has(tabId)) tabId = 'contornos';
      activeTab = tabId;
      if (updateHash && location.hash !== '#' + tabId) {
        history.replaceState(null, '', '#' + tabId);
      }
      tabButtons.forEach(b => {
        const on = b.dataset.tab === tabId;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === 'tab-' + tabId);
      });
      requestAnimationFrame(() => {
        const mod = AEM.Modules && AEM.Modules[tabId];
        if (mod) {
          mod.init();
          if (mod.resize) mod.resize();
        }
      });
    }

    tabButtons.forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab, true)));
    window.addEventListener('hashchange', () => {
      const h = location.hash.replace('#', '');
      if (VALID_TABS.has(h)) switchTab(h, false);
    });
    window.addEventListener('resize', () => {
      const mod = AEM.Modules && AEM.Modules[activeTab];
      if (mod && mod.resize) mod.resize();
    });

    const initialHash = location.hash.replace('#', '');
    switchTab(VALID_TABS.has(initialHash) ? initialHash : 'contornos', false);

    let lastTs = performance.now();
    function loopMulti(ts) {
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      const mod = AEM.Modules && AEM.Modules[activeTab];
      if (mod && mod.tick) mod.tick(dt);
      requestAnimationFrame(loopMulti);
    }
    requestAnimationFrame(loopMulti);
  }

  return { start };
})();

