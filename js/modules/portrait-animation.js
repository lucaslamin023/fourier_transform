/* ============================================================================
 * AEM-Lab · Animação do Retrato de Joseph Fourier por Epiciclos
 * Reconstrói Joseph_Fourier.jpg via DFT complexa e revela a gravura original.
 * ============================================================================ */
window.AEM = window.AEM || {};

AEM.PortraitAnim = (() => {
  'use strict';

  function init() {
    const cv = document.getElementById('portraitCanvas');
    const imgEl = document.getElementById('portraitEngraving');
    const sliderM = document.getElementById('portraitM');
    const outM = document.getElementById('portraitMOut');
    const toggleCircles = document.getElementById('portraitCircles');
    const toggleEngraving = document.getElementById('portraitShowImg');
    const btnRestart = document.getElementById('portraitRestart');
    const statusEl = document.getElementById('portraitProgress');

    if (!cv || !AEM.PortraitData || !AEM.Math || !AEM.Canvas) return;

    const { setupCanvas, drawEpicycleScene, css } = AEM.Canvas;
    const rawPts = AEM.PortraitData.points.map(([x, y]) => ({ x: x - 0.5, y: y - 0.5 }));
    const coeffs = AEM.Math.dftComplex(rawPts);
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let M = sliderM ? Math.min(+sliderM.value, coeffs.length) : 220;
    if (sliderM) {
      sliderM.max = Math.min(420, coeffs.length);
      sliderM.value = M;
      if (outM) outM.textContent = M;
    }

    let t = 0;
    let trace = [];
    let completedOnce = false;
    let w = 0, h = 0;
    const STEP_PER_SEC = 0.085; // ~11.7s por ciclo completo

    function resize() {
      const s = setupCanvas(cv);
      w = s.w;
      h = s.h;
      if (reduceMotion) renderStatic();
    }

    function resetTrace() {
      t = 0;
      trace = [];
      completedOnce = false;
      updateEngravingOpacity(0);
    }

    function updateEngravingOpacity(progress) {
      if (!imgEl) return;
      if (toggleEngraving && !toggleEngraving.checked) {
        imgEl.style.opacity = '0';
        return;
      }
      // Revela gradualmente a gravura conforme os epiciclos completam o traço
      const target = completedOnce ? 0.55 : Math.max(0.05, Math.min(0.55, progress * 0.55));
      imgEl.style.opacity = target.toFixed(2);
    }

    function computeFullReconstructed() {
      const n = rawPts.length;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const ti = i / n;
        let x = 0, y = 0;
        for (let j = 0; j < Math.min(M, coeffs.length); j++) {
          const c = coeffs[j];
          const ang = 2 * Math.PI * c.k * ti + c.phase;
          x += c.amp * Math.cos(ang);
          y += c.amp * Math.sin(ang);
        }
        pts.push({ x: w / 2 + x * w, y: h / 2 + y * h });
      }
      return pts;
    }

    function renderStatic() {
      const { ctx } = setupCanvas(cv);
      ctx.clearRect(0, 0, w, h);
      const pts = computeFullReconstructed();
      ctx.beginPath();
      pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y));
      ctx.closePath();
      ctx.strokeStyle = css('--trace');
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
      completedOnce = true;
      updateEngravingOpacity(1);
      if (statusEl) statusEl.textContent = `100% · ${M} epiciclos`;
    }

    function frame(dt) {
      if (w < 10 || h < 10) return;
      const { ctx } = setupCanvas(cv);
      const showCi = toggleCircles ? toggleCircles.checked : true;

      drawEpicycleScene(ctx, w, h, [], coeffs, M, t, trace, w, false, showCi, {
        scaleX: w,
        scaleY: h,
        maxCircles: 90,
        circleAlpha: 0.28,
        armAlpha: 0.65
      });

      const maxLen = 780;
      while (trace.length > maxLen) trace.shift();

      if (trace.length > 1) {
        ctx.beginPath();
        trace.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y));
        ctx.strokeStyle = css('--trace');
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        const head = trace[trace.length - 1];
        ctx.beginPath();
        ctx.arc(head.x, head.y, 3.8, 0, 2 * Math.PI);
        ctx.fillStyle = css('--trace');
        ctx.fill();
      }

      const nextT = t + dt * STEP_PER_SEC;
      if (nextT >= 1) {
        completedOnce = true;
        trace = [];
      }
      t = nextT % 1;

      updateEngravingOpacity(t);
      if (statusEl) {
        const pct = completedOnce ? 100 : Math.round(t * 100);
        statusEl.textContent = `${pct}% · ${M} epiciclos`;
      }
    }

    if (sliderM) {
      sliderM.addEventListener('input', e => {
        M = +e.target.value;
        if (outM) outM.textContent = M;
        trace = [];
        if (reduceMotion) renderStatic();
      });
    }
    if (toggleEngraving) {
      toggleEngraving.addEventListener('change', () => updateEngravingOpacity(t));
    }
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        resetTrace();
        if (reduceMotion) renderStatic();
      });
    }

    resize();
    window.addEventListener('resize', resize);

    if (!reduceMotion) {
      let last = performance.now();
      function loop(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        frame(dt);
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    }
  }

  return { init };
})();

