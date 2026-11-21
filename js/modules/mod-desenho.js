/* ============================================================================
 * AEM-Lab · Módulo 04: Desenho Livre → Epiciclos & Som
 * ============================================================================ */
window.AEM = window.AEM || {};
AEM.Modules = AEM.Modules || {};

AEM.Modules.desenho = (() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const N_DRAW = 256;
  let initialized = false;
  let drawCv, drawCtx, drawAudioCv;
  let drawW = 0, drawH = 0, drawScale = 1;
  let isDrawing = false, rawStroke = [], drawOrigPts = [], drawCoeffs = [], drawTrace = [], drawT = 0;
  let drawM = 60, drawSpeed = 1;
  let drawAudioNode = null, drawAudioStopFn = null;

  function resize() {
    if (!drawCv) return;
    const r = drawCv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    if (r.width < 10 || r.height < 10) return;
    drawW = r.width; drawH = r.height;
    drawCv.width = drawW * d; drawCv.height = drawH * d;
    drawCtx.setTransform(d, 0, 0, d, 0, 0);
    drawScale = 0.40 * Math.min(drawW, drawH);
    renderAudioPreview();
  }

  function renderAudioPreview() {
    if (!drawCoeffs.length || !drawAudioCv) return;
    const { setupCanvas, css, FONT_MONO } = AEM.Canvas;
    const { ctx: c, w, h } = setupCanvas(drawAudioCv);
    c.clearRect(0, 0, w, h);
    const halfY = h * 0.52;
    const used = drawCoeffs.slice(0, Math.min(drawM, drawCoeffs.length)).filter(x => x.k !== 0);

    const waveW = w * 0.52 - 12;
    c.strokeStyle = css('--line');
    c.beginPath(); c.moveTo(8, halfY * 0.55); c.lineTo(waveW, halfY * 0.55); c.stroke();

    const ptsX = [], ptsY = [];
    let maxV = 0.001;
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      let sx = 0, sy = 0;
      used.forEach(item => {
        const a = 2 * Math.PI * item.k * t + item.phase;
        sx += item.amp * Math.cos(a); sy += item.amp * Math.sin(a);
      });
      ptsX.push(sx); ptsY.push(sy);
      maxV = Math.max(maxV, Math.abs(sx), Math.abs(sy));
    }
    const drawWaveLine = (arr, col) => {
      c.beginPath();
      arr.forEach((v, idx) => {
        const px = 8 + (idx / 100) * (waveW - 12);
        const py = halfY * 0.55 - (v / maxV) * (halfY * 0.42);
        c[idx === 0 ? 'moveTo' : 'lineTo'](px, py);
      });
      c.strokeStyle = col; c.lineWidth = 1.8; c.stroke();
    };
    drawWaveLine(ptsX, css('--trace'));
    drawWaveLine(ptsY, css('--accent-2'));

    const specX0 = w * 0.56;
    const specW = w - specX0 - 10;
    const top = used.slice(0, 18);
    const maxA = top[0] ? top[0].amp : 1;
    const bw = specW / Math.max(1, top.length);
    top.forEach((item, idx) => {
      const bh = Math.max(3, (item.amp / maxA) * (h - 32));
      c.fillStyle = item.k > 0 ? css('--trace') : css('--accent-2');
      c.fillRect(specX0 + idx * bw, h - 18 - bh, Math.max(2, bw - 2), bh);
    });

    c.fillStyle = css('--muted'); c.font = '10px ' + FONT_MONO;
    c.fillText('Onda X(t) [acento] / Y(t) [azul]', 8, h - 4);
    c.fillText('Raios (|cₖ|)', specX0, h - 4);
  }

  function applyDrawPoints(raw) {
    if (raw.length < 6) return;
    const resampled = AEM.Math.resamplePath(raw, N_DRAW);
    const norm = AEM.Math.normalizePts(resampled);
    drawOrigPts = norm;
    drawCoeffs = AEM.Math.dftComplex(norm);
    drawT = 0; drawTrace = [];
    $('drawM').max = drawCoeffs.length;
    drawM = Math.min(drawM, drawCoeffs.length);
    $('drawM').value = drawM; $('drawMOut').textContent = drawM;
    $('drawEnergyOut').textContent = AEM.Math.parsevalEnergyRatio(drawCoeffs, drawM).toFixed(1) + '%';
    renderAudioPreview();
    if (drawAudioNode) { stopDrawSound(); startDrawSound(); }
  }

  function makeShapePreset(name) {
    const pts = [];
    const Mpts = 200;
    for (let i = 0; i < Mpts; i++) {
      const a = (i / Mpts) * 2 * Math.PI;
      if (name === 'star') {
        const rStar = 0.68 + 0.32 * Math.cos(5 * a);
        pts.push({ x: rStar * Math.cos(a), y: rStar * Math.sin(a) });
      } else if (name === 'heart') {
        const x = 16 * Math.pow(Math.sin(a), 3);
        const y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
        pts.push({ x, y });
      } else if (name === 'square') {
        const s = Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
        pts.push({ x: Math.cos(a) / s, y: Math.sin(a) / s });
      } else if (name === 'spiral') {
        const u = i / (Mpts - 1);
        const ang = u * 4 * Math.PI;
        pts.push({ x: u * Math.cos(ang), y: u * Math.sin(ang) });
      } else if (name === 'wave') {
        const u = i / (Mpts - 1);
        const x = -1 + 2 * u;
        const y = 0.55 * Math.sin(3 * 2 * Math.PI * u) + 0.25 * Math.cos(7 * 2 * Math.PI * u);
        pts.push({ x, y });
      } else if (name === 'note') {
        const t = i / Mpts;
        if (t < 0.4) {
          const ang = (t / 0.4) * 2 * Math.PI;
          pts.push({ x: -0.35 + 0.35 * Math.cos(ang), y: 0.55 + 0.25 * Math.sin(ang) });
        } else if (t < 0.7) {
          const u = (t - 0.4) / 0.3;
          pts.push({ x: 0.0, y: 0.55 - 1.35 * u });
        } else {
          const u = (t - 0.7) / 0.3;
          pts.push({ x: 0.55 * Math.sin(u * Math.PI), y: -0.8 + 0.55 * u });
        }
      }
    }
    applyDrawPoints(pts);
  }

  function stopDrawSound() {
    if (drawAudioNode) { try { drawAudioNode.stop(); } catch (_) {} drawAudioNode = null; }
    if (drawAudioStopFn) { drawAudioStopFn(); drawAudioStopFn = null; }
    $('drawPlayBtn').classList.remove('playing-pulse');
    $('drawPlayBtn').textContent = '▶ Ouvir Desenho';
  }

  function startDrawSound() {
    if (!drawCoeffs.length) return;
    AEM.Audio.stopAll();
    const ctxA = AEM.Audio.getContext();
    const mode = $('drawSoundMode').value;
    const f0 = +$('drawBaseFreq').value;
    const { left, right, sr } = AEM.Audio.synthesizeEpicycleAudioBuffers(drawCoeffs, drawM, mode, f0, 3.2, ctxA.sampleRate);
    const buf = ctxA.createBuffer(right ? 2 : 1, left.length, sr);
    buf.getChannelData(0).set(left);
    if (right) buf.getChannelData(1).set(right);
    const src = ctxA.createBufferSource();
    src.buffer = buf;
    src.loop = mode !== 'arpeggio';
    src.connect(ctxA.destination);
    src.start();
    drawAudioNode = src;
    drawAudioStopFn = AEM.Audio.registerStop(stopDrawSound);
    $('drawPlayBtn').classList.add('playing-pulse');
    $('drawPlayBtn').textContent = '■ Parar Som';
    src.onended = () => { if (drawAudioNode === src) stopDrawSound(); };
  }

  function init() {
    if (initialized) return;
    drawCv = $('drawCv');
    drawAudioCv = $('drawAudioCv');
    if (!drawCv || !drawAudioCv) return;
    drawCtx = drawCv.getContext('2d');
    initialized = true;

    drawCv.addEventListener('pointerdown', e => {
      isDrawing = true;
      rawStroke = [];
      drawTrace = [];
      const r = drawCv.getBoundingClientRect();
      rawStroke.push({ x: e.clientX - r.left, y: e.clientY - r.top });
      drawCv.setPointerCapture(e.pointerId);
      $('drawBadge').textContent = 'Desenhando… solte para calcular a Transformada de Fourier.';
    });
    drawCv.addEventListener('pointermove', e => {
      if (!isDrawing) return;
      const r = drawCv.getBoundingClientRect();
      rawStroke.push({ x: e.clientX - r.left, y: e.clientY - r.top });
    });
    drawCv.addEventListener('pointerup', () => {
      if (!isDrawing) return;
      isDrawing = false;
      if (rawStroke.length > 8) {
        applyDrawPoints(rawStroke);
        $('drawBadge').textContent = `Calculado: ${drawCoeffs.length} frequências extraídas — clique em "▶ Ouvir Desenho".`;
      }
    });

    document.querySelectorAll('.draw-preset').forEach(b => {
      b.addEventListener('click', () => {
        makeShapePreset(b.dataset.shape);
        $('drawBadge').textContent = `Forma "${b.textContent.trim()}" transformada — ajuste "Círculos" ou ouça o som.`;
      });
    });
    $('drawClearBtn').addEventListener('click', () => {
      drawOrigPts = []; drawCoeffs = []; drawTrace = []; rawStroke = [];
      stopDrawSound();
      drawCtx.clearRect(0, 0, drawW, drawH);
      $('drawBadge').textContent = 'Tela limpa. Clique e arraste para desenhar qualquer contorno fechado.';
    });

    $('drawM').addEventListener('input', e => {
      drawM = +e.target.value; $('drawMOut').textContent = drawM; drawTrace = [];
      $('drawEnergyOut').textContent = AEM.Math.parsevalEnergyRatio(drawCoeffs, drawM).toFixed(1) + '%';
      renderAudioPreview();
      if (drawAudioNode) { stopDrawSound(); startDrawSound(); }
    });
    $('drawSpeed').addEventListener('input', e => { drawSpeed = +e.target.value; $('drawSpeedOut').textContent = drawSpeed.toFixed(1) + 'x'; drawTrace = []; });
    $('drawBaseFreq').addEventListener('input', e => {
      $('drawBaseFreqOut').textContent = e.target.value + ' Hz';
      if (drawAudioNode) { stopDrawSound(); startDrawSound(); }
    });

    $('drawPlayBtn').addEventListener('click', () => {
      if (drawAudioNode) stopDrawSound(); else startDrawSound();
    });
    $('drawSoundMode').addEventListener('change', () => {
      if (drawAudioNode) { stopDrawSound(); startDrawSound(); }
    });

    AEM.Theme.onChange(renderAudioPreview);
    makeShapePreset('star');
    resize();
  }

  function tick() {
    if (!initialized || drawW < 10) return;
    const { css, drawEpicycleScene } = AEM.Canvas;
    if (isDrawing && rawStroke.length > 1) {
      drawCtx.clearRect(0, 0, drawW, drawH);
      drawCtx.beginPath();
      rawStroke.forEach((p, i) => drawCtx[i ? 'lineTo' : 'moveTo'](p.x, p.y));
      drawCtx.strokeStyle = css('--trace'); drawCtx.lineWidth = 3; drawCtx.lineJoin = 'round'; drawCtx.stroke();
    } else if (drawCoeffs.length) {
      drawEpicycleScene(drawCtx, drawW, drawH, drawOrigPts, drawCoeffs, drawM, drawT, drawTrace, drawScale, $('drawShowOrig').checked, $('drawShowCircles').checked);
      const step = drawSpeed / 650, maxLen = Math.ceil(1 / step);
      while (drawTrace.length > maxLen) drawTrace.shift();
      drawCtx.beginPath();
      drawTrace.forEach((p, i) => drawCtx[i ? 'lineTo' : 'moveTo'](p.x, p.y));
      drawCtx.strokeStyle = css('--trace'); drawCtx.lineWidth = 2.8; drawCtx.lineJoin = 'round'; drawCtx.stroke();
      if (drawTrace.length) {
        const head = drawTrace[drawTrace.length - 1];
        drawCtx.beginPath(); drawCtx.arc(head.x, head.y, 4, 0, 2 * Math.PI); drawCtx.fillStyle = css('--trace'); drawCtx.fill();
      }
      drawT = (drawT + step) % 1;
    }
  }

  return { init, resize, tick };
})();

