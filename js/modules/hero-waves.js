/* ============================================================================
 * AEM-Lab · Fundo Animado de Ondas e Epiciclos de Fourier no Hero
 * ============================================================================ */
window.AEM = window.AEM || {};

AEM.HeroWaves = (() => {
  'use strict';

  function init() {
    const cv = document.getElementById('heroCanvas');
    if (!cv || !AEM.Canvas) return;

    const { setupCanvas, css } = AEM.Canvas;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, phase = 0;

    function resize() {
      const s = setupCanvas(cv);
      w = s.w;
      h = s.h;
    }

    function sumWave(u) {
      return (
        Math.sin(u) +
        0.42 * Math.sin(3 * u + phase * 0.45) +
        0.24 * Math.sin(5 * u - phase * 0.35) +
        0.14 * Math.sin(7 * u + phase * 0.25)
      );
    }

    function draw() {
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      if (w < 20 || h < 20) return;

      const borderCol = css('--border');
      const accentCol = css('--accent-text');
      const mutedCol = css('--muted');
      const cy = h * 0.52;
      const amp = Math.min(86, h * 0.20);
      const wide = w >= 860;
      const epiX = wide ? w * 0.77 : w * 0.80;
      const waveStartX = wide ? w * 0.0 : 0;

      // Eixo de equilíbrio e marcações verticais sutis
      ctx.save();
      ctx.strokeStyle = borderCol;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(w, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Ondas harmônicas componentes (n = 1, 3, 5, 7) com cores da paleta harmônica
      const harmonics = [
        { n: 1, a: 1.00, spd: 1.00, shift: 0,    col: css('--h1'), alpha: 0.34, lw: 1.3 },
        { n: 3, a: 0.42, spd: 1.45, shift: 0.45, col: css('--h2'), alpha: 0.36, lw: 1.2 },
        { n: 5, a: 0.24, spd: 0.65, shift: -0.35, col: css('--h3'), alpha: 0.36, lw: 1.1 },
        { n: 7, a: 0.14, spd: 1.25, shift: 0.25, col: css('--h5'), alpha: 0.32, lw: 1.0 }
      ];

      harmonics.forEach(hm => {
        ctx.beginPath();
        for (let x = waveStartX; x <= w; x += 5) {
          const u = (x / Math.max(600, w)) * Math.PI * 5 + phase;
          const y = cy + Math.sin(hm.n * u + phase * hm.shift) * amp * hm.a;
          ctx[x === waveStartX ? 'moveTo' : 'lineTo'](x, y);
        }
        ctx.strokeStyle = hm.col;
        ctx.globalAlpha = hm.alpha;
        ctx.lineWidth = hm.lw;
        ctx.stroke();
      });

      // Envelope de destaque suave sob a curva resultante
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const u = (x / Math.max(600, w)) * Math.PI * 5 + phase;
        const y = cy + sumWave(u) * amp * 0.9;
        ctx[x === 0 ? 'moveTo' : 'lineTo'](x, y);
      }
      ctx.strokeStyle = accentCol;
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = 7;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Onda resultante de Fourier destacada
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const u = (x / Math.max(600, w)) * Math.PI * 5 + phase;
        const y = cy + sumWave(u) * amp * 0.9;
        ctx[x === 0 ? 'moveTo' : 'lineTo'](x, y);
      }
      ctx.strokeStyle = accentCol;
      ctx.globalAlpha = 0.78;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Epiciclos giratórios no lado direito sincronizados com a onda no ponto epiX
      const uAtEpi = (epiX / Math.max(600, w)) * Math.PI * 5 + phase;
      const circleBaseX = wide ? epiX - 110 : w * 0.78;
      const terms = [
        { n: 1, a: 1.00 * amp * 0.9, s: 0,    col: css('--h1') },
        { n: 3, a: 0.42 * amp * 0.9, s: 0.45, col: css('--h2') },
        { n: 5, a: 0.24 * amp * 0.9, s: -0.35, col: css('--h3') },
        { n: 7, a: 0.14 * amp * 0.9, s: 0.25, col: css('--h5') }
      ];

      let px = circleBaseX, py = cy;
      terms.forEach(t => {
        const ang = t.n * uAtEpi + phase * t.s;
        const nx = px + t.a * Math.cos(ang);
        const ny = py + t.a * Math.sin(ang);

        ctx.beginPath();
        ctx.arc(px, py, t.a, 0, Math.PI * 2);
        ctx.strokeStyle = t.col;
        ctx.globalAlpha = wide ? 0.42 : 0.22;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = mutedCol;
        ctx.globalAlpha = wide ? 0.65 : 0.30;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(nx, ny, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = t.col;
        ctx.globalAlpha = wide ? 0.85 : 0.40;
        ctx.fill();

        px = nx;
        py = ny;
      });

      // Haste horizontal ligando a ponta dos epiciclos diretamente à onda resultante
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(epiX, py);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = accentCol;
      ctx.globalAlpha = wide ? 0.72 : 0.30;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(epiX, py, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = accentCol;
      ctx.globalAlpha = wide ? 0.95 : 0.45;
      ctx.fill();

      ctx.globalAlpha = 1;
    }

    resize();
    window.addEventListener('resize', () => { resize(); draw(); });

    if (reduceMotion) {
      draw();
      return;
    }

    let last = performance.now();
    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      phase += dt * 0.72;
      draw();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  return { init };
})();
