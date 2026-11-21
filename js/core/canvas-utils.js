/* ============================================================================
 * AEM-Lab · Utilitários de Canvas e Renderização de Epiciclos
 * ============================================================================ */
window.AEM = window.AEM || {};

AEM.Canvas = (() => {
  'use strict';

  const FONT_MONO = '"JetBrains Mono", "Courier New", monospace';

  function css(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  function setupCanvas(cv) {
    const r = cv.getBoundingClientRect();
    const d = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    if (cv.width !== Math.floor(w * d) || cv.height !== Math.floor(h * d)) {
      cv.width = Math.floor(w * d);
      cv.height = Math.floor(h * d);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    return { ctx, w, h };
  }

  function drawEpicycleScene(ctx2, w, h, ptsOrig, cList, mLim, tVal, trArr, scaleVal, showOl, showCi, options = {}) {
    ctx2.clearRect(0, 0, w, h);
    const cx = options.cx !== undefined ? options.cx : w / 2;
    const cy = options.cy !== undefined ? options.cy : h / 2;
    const scaleX = options.scaleX !== undefined ? options.scaleX : scaleVal;
    const scaleY = options.scaleY !== undefined ? options.scaleY : scaleVal;

    if (showOl && ptsOrig.length) {
      ctx2.beginPath();
      ptsOrig.forEach((p, i) => ctx2[i ? 'lineTo' : 'moveTo'](cx + p.x * scaleX, cy + p.y * scaleY));
      ctx2.closePath();
      ctx2.strokeStyle = css('--outline');
      ctx2.lineWidth = 1.4;
      ctx2.stroke();
    }

    if (cList.length) {
      let x = cx, y = cy;
      const maxDrawCircles = options.maxCircles || 150;
      for (let i = 0; i < Math.min(mLim, cList.length); i++) {
        const c = cList[i];
        const ang = 2 * Math.PI * c.k * tVal + c.phase;
        const rx = c.amp * scaleX;
        const ry = c.amp * scaleY;
        const nx = x + rx * Math.cos(ang);
        const ny = y + ry * Math.sin(ang);
        if (showCi && i < maxDrawCircles && Math.min(rx, ry) > 0.6) {
          ctx2.beginPath();
          ctx2.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
          ctx2.strokeStyle = css('--ring');
          ctx2.globalAlpha = options.circleAlpha !== undefined ? options.circleAlpha : 0.35;
          ctx2.lineWidth = 1;
          ctx2.stroke();

          ctx2.beginPath();
          ctx2.moveTo(x, y);
          ctx2.lineTo(nx, ny);
          ctx2.globalAlpha = options.armAlpha !== undefined ? options.armAlpha : 0.78;
          ctx2.stroke();
          ctx2.globalAlpha = 1;
        }
        x = nx;
        y = ny;
      }
      if (trArr) trArr.push({ x, y });
      return { x, y };
    }
    return null;
  }

  return {
    FONT_MONO,
    css,
    setupCanvas,
    drawEpicycleScene
  };
})();

