/* ============================================================================
 * AEM-Lab · Módulo 02: Ondas & Síntese Sonora
 * ============================================================================ */
window.AEM = window.AEM || {};
AEM.Modules = AEM.Modules || {};

AEM.Modules.ondas = (() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const H_COUNT = 8;
  const waveAmps = new Float64Array(H_COUNT);
  const wavePhases = new Float64Array(H_COUNT);
  waveAmps[0] = 1.0;

  let initialized = false;
  let wavePresetMode = 'sine';
  let waveExtraHarmonics = 1;
  let waveOsc = null, waveAudioStopFn = null;
  let waveAnimPhase = 0;
  let waveHoverHarm = -1;

  const getHarmColor = idx => AEM.Canvas.css('--h' + (idx % 8)) || AEM.Canvas.css('--trace');

  function syncHarmonicsUI() {
    document.querySelectorAll('.h-amp').forEach(el => { el.value = waveAmps[+el.dataset.h].toFixed(2); });
    document.querySelectorAll('.h-ph').forEach(el => { el.value = wavePhases[+el.dataset.h].toFixed(2); });
    document.querySelectorAll('.h-cd').forEach(el => {
      const h = +el.dataset.h;
      const a = waveAmps[h], ph = wavePhases[h];
      const c = a * Math.cos(ph), d = a * Math.sin(ph);
      el.textContent = `${c.toFixed(2)}, ${d.toFixed(2)}`;
    });
    const f0 = +$('waveFreq').value;
    $('waveFormulaInfo').textContent = `f₀ = ${f0} Hz · Harmônicos = ${wavePresetMode === 'custom' ? H_COUNT : waveExtraHarmonics}`;
  }

  function getWaveCoeffsFull() {
    const maxN = (wavePresetMode === 'square' || wavePresetMode === 'saw' || wavePresetMode === 'tri')
      ? Math.max(H_COUNT, waveExtraHarmonics) : H_COUNT;
    const list = [];
    for (let n = 1; n <= maxN; n++) {
      let a = 0, ph = 0;
      if (n <= H_COUNT) {
        a = waveAmps[n - 1]; ph = wavePhases[n - 1];
      } else if (n <= waveExtraHarmonics) {
        if (wavePresetMode === 'square' && n % 2 === 1) { a = 1 / n; ph = Math.PI / 2; }
        else if (wavePresetMode === 'saw') { a = 1 / n; ph = Math.PI / 2; }
        else if (wavePresetMode === 'tri' && n % 2 === 1) { a = 1 / (n * n); ph = ((n - 1) / 2) % 2 === 0 ? 0 : Math.PI; }
      }
      if (a > 0.001) list.push({ n, amp: a, phase: ph, c: a * Math.cos(ph), d: a * Math.sin(ph) });
    }
    return list;
  }

  function buildPeriodicWave(ctxA) {
    const list = getWaveCoeffsFull();
    const maxN = Math.max(2, list.reduce((m, x) => Math.max(m, x.n), 1));
    const real = new Float32Array(maxN + 1);
    const imag = new Float32Array(maxN + 1);
    list.forEach(item => { real[item.n] = item.c; imag[item.n] = item.d; });
    return ctxA.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  function updateLiveWaveAudio() {
    const ctxA = AEM.Audio.currentCtx();
    if (!waveOsc || !ctxA) return;
    waveOsc.frequency.setTargetAtTime(+$('waveFreq').value, ctxA.currentTime, 0.02);
    waveOsc.setPeriodicWave(buildPeriodicWave(ctxA));
  }

  function stopWaveAudio() {
    if (waveOsc) { try { waveOsc.stop(); } catch (_) {} waveOsc = null; }
    if (waveAudioStopFn) { waveAudioStopFn(); waveAudioStopFn = null; }
    $('wavePlayBtn').classList.remove('playing-pulse');
    $('wavePlayBtn').textContent = '▶ Tocar Som';
  }

  function applyWavePreset(preset, nMax) {
    wavePresetMode = preset;
    waveExtraHarmonics = nMax;
    waveAmps.fill(0); wavePhases.fill(0);
    for (let n = 1; n <= H_COUNT; n++) {
      if (n > nMax && preset !== 'sine' && preset !== 'voice' && preset !== 'chord') continue;
      if (preset === 'sine' && n === 1) waveAmps[0] = 1;
      else if (preset === 'square' && n % 2 === 1) { waveAmps[n - 1] = 1 / n; wavePhases[n - 1] = Math.PI / 2; }
      else if (preset === 'saw') { waveAmps[n - 1] = 1 / n; wavePhases[n - 1] = Math.PI / 2; }
      else if (preset === 'tri' && n % 2 === 1) {
        waveAmps[n - 1] = 1 / (n * n);
        wavePhases[n - 1] = ((n - 1) / 2) % 2 === 0 ? 0 : Math.PI;
      } else if (preset === 'voice') {
        if (n === 1) waveAmps[0] = 1.0;
        if (n === 2) waveAmps[1] = 0.52;
        if (n === 3) waveAmps[2] = 0.45;
        if (n === 5) waveAmps[4] = 0.18;
      } else if (preset === 'chord') {
        if (n === 2) waveAmps[1] = 0.85;
        if (n === 3) waveAmps[2] = 0.65;
        if (n === 4) waveAmps[3] = 0.55;
      } else if (preset === 'random') {
        waveAmps[n - 1] = +(Math.random() * (1 / Math.sqrt(n))).toFixed(2);
        wavePhases[n - 1] = +(Math.random() * 2 * Math.PI - Math.PI).toFixed(2);
      }
    }
    syncHarmonicsUI();
    updateLiveWaveAudio();
    draw();
  }

  function buildHarmonicsUI() {
    const box = $('harmonicsList');
    box.innerHTML = '';
    for (let i = 0; i < H_COUNT; i++) {
      const row = document.createElement('div');
      row.className = 'harm-row';
      row.innerHTML = `
        <span class="badge" style="color:var(--h${i})" title="Clique para ouvir apenas o harmônico ${i+1}" data-h="${i}">n=${i+1} ♪</span>
        <input type="range" class="h-amp" data-h="${i}" min="0" max="1" step="0.01" value="${waveAmps[i]}">
        <input type="range" class="h-ph" data-h="${i}" min="${-Math.PI.toFixed(3)}" max="${Math.PI.toFixed(3)}" step="0.02" value="${wavePhases[i]}">
        <span class="h-cd" data-h="${i}" style="font-variant-numeric:tabular-nums;color:var(--muted);">—</span>
      `;
      box.appendChild(row);
    }
    box.querySelectorAll('.h-amp').forEach(el => el.addEventListener('input', e => {
      const h = +e.target.dataset.h;
      waveAmps[h] = +e.target.value;
      wavePresetMode = 'custom';
      waveExtraHarmonics = H_COUNT;
      syncHarmonicsUI();
      updateLiveWaveAudio();
    }));
    box.querySelectorAll('.h-ph').forEach(el => el.addEventListener('input', e => {
      const h = +e.target.dataset.h;
      wavePhases[h] = +e.target.value;
      syncHarmonicsUI();
      updateLiveWaveAudio();
    }));
    box.querySelectorAll('.badge').forEach(el => el.addEventListener('click', e => {
      const h = +e.target.dataset.h;
      AEM.Audio.playPureTone((h + 1) * +$('waveFreq').value, 0.55);
    }));
    syncHarmonicsUI();
  }

  function draw() {
    if (!initialized) return;
    const timeCv = $('waveTimeCv'), specCv = $('waveSpecCv');
    if (!timeCv || !specCv) return;
    const { setupCanvas, css, FONT_MONO } = AEM.Canvas;
    const tSetup = setupCanvas(timeCv);
    const sSetup = setupCanvas(specCv);
    const list = getWaveCoeffsFull();

    // Canvas 1: Círculo Giratório + Onda no Tempo
    {
      const { ctx: c, w, h } = tSetup;
      c.clearRect(0, 0, w, h);
      const cy = h / 2;
      const circleCx = Math.min(82, w * 0.16);
      const waveX0 = circleCx + 72;
      const waveW = Math.max(80, w - waveX0 - 16);
      const ampScale = Math.min(48, h * 0.24);

      c.strokeStyle = css('--line');
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(waveX0, cy); c.lineTo(w - 14, cy); c.stroke();

      if ($('waveShowComponents').checked) {
        list.slice(0, 8).forEach((item, idx) => {
          c.beginPath();
          for (let px = 0; px <= waveW; px += 2) {
            const th = (px / waveW) * 2 * Math.PI * 2 + waveAnimPhase;
            const y = cy - item.amp * ampScale * Math.cos(item.n * th - item.phase);
            c[px === 0 ? 'moveTo' : 'lineTo'](waveX0 + px, y);
          }
          c.strokeStyle = getHarmColor(idx);
          c.globalAlpha = (waveHoverHarm === item.n) ? 0.95 : 0.35;
          c.lineWidth = (waveHoverHarm === item.n) ? 2.2 : 1.2;
          c.stroke();
        });
        c.globalAlpha = 1;
      }

      c.beginPath();
      let startY = cy;
      for (let px = 0; px <= waveW; px += 2) {
        const th = (px / waveW) * 2 * Math.PI * 2 + waveAnimPhase;
        let sum = 0;
        for (let i = 0; i < list.length; i++) {
          sum += list[i].amp * Math.cos(list[i].n * th - list[i].phase);
        }
        const y = cy - sum * ampScale;
        if (px === 0) startY = y;
        c[px === 0 ? 'moveTo' : 'lineTo'](waveX0 + px, y);
      }
      c.strokeStyle = css('--trace');
      c.lineWidth = 2.6;
      c.stroke();

      let rx = circleCx, ry = cy;
      list.slice(0, 8).forEach((item, idx) => {
        const ang = item.n * waveAnimPhase - item.phase;
        const r = item.amp * ampScale;
        const nx = rx + r * Math.sin(ang);
        const ny = ry - r * Math.cos(ang);
        c.beginPath(); c.arc(rx, ry, r, 0, 2 * Math.PI);
        c.strokeStyle = css('--ring'); c.globalAlpha = 0.32; c.lineWidth = 1; c.stroke();
        c.beginPath(); c.moveTo(rx, ry); c.lineTo(nx, ny);
        c.strokeStyle = getHarmColor(idx); c.globalAlpha = 0.85; c.lineWidth = 1.5; c.stroke();
        rx = nx; ry = ny;
      });
      c.globalAlpha = 1;
      c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(rx, ry); c.lineTo(waveX0, startY);
      c.strokeStyle = css('--trace'); c.lineWidth = 1.2; c.stroke();
      c.setLineDash([]);
      c.beginPath(); c.arc(rx, ry, 4, 0, 2 * Math.PI); c.fillStyle = css('--trace'); c.fill();
    }

    // Canvas 2: Espectro de Amplitude + Fase
    {
      const { ctx: c, w, h } = sSetup;
      c.clearRect(0, 0, w, h);
      const midX = w * 0.56;
      const padL = 32, padB = 28, padT = 22;
      const barsN = Math.max(8, list.reduce((m, x) => Math.max(m, x.n), 8));
      const bw = (midX - padL - 16) / barsN;

      c.fillStyle = css('--muted');
      c.font = '10.5px ' + FONT_MONO;
      c.fillText('Espectro de Amplitude (Aₙ) — clique p/ ouvir', padL, 14);
      c.fillText('Espectro de Fase (θ\'ₙ)', midX + 12, 14);

      c.strokeStyle = css('--line'); c.lineWidth = 1;
      c.beginPath();
      c.moveTo(padL, h - padB); c.lineTo(midX - 10, h - padB);
      c.moveTo(midX + 12, (h - padB + padT) / 2); c.lineTo(w - 14, (h - padB + padT) / 2);
      c.stroke();

      const ampMap = new Map(list.map(x => [x.n, x]));
      for (let n = 1; n <= barsN; n++) {
        const item = ampMap.get(n);
        const a = item ? item.amp : 0;
        const ph = item ? item.phase : 0;
        const x = padL + (n - 1) * bw + 2;
        const maxH = h - padB - padT - 4;
        const bh = Math.min(maxH, a * maxH);
        const col = getHarmColor(n - 1);

        c.fillStyle = col;
        c.globalAlpha = a > 0.001 ? 0.9 : 0.15;
        c.fillRect(x, h - padB - Math.max(2, bh), Math.max(3, bw - 4), Math.max(2, bh));
        c.globalAlpha = 1;
        if (barsN <= 16 || n % 2 === 1) {
          c.fillStyle = css('--muted');
          c.fillText(n + 'f', x, h - 10);
        }

        const px = midX + 16 + ((n - 1) / Math.max(1, barsN - 1)) * (w - midX - 36);
        const py0 = (h - padB + padT) / 2;
        const py = py0 - (ph / Math.PI) * (maxH * 0.45);
        c.strokeStyle = col;
        c.globalAlpha = a > 0.001 ? 0.85 : 0.2;
        c.beginPath(); c.moveTo(px, py0); c.lineTo(px, py); c.stroke();
        c.beginPath(); c.arc(px, py, a > 0.001 ? 3.5 : 2, 0, 2 * Math.PI);
        c.fillStyle = col; c.fill();
        c.globalAlpha = 1;
      }
    }
  }

  function init() {
    if (initialized) return;
    if (!$('waveTimeCv') || !$('harmonicsList')) return;
    initialized = true;

    buildHarmonicsUI();

    $('wavePlayBtn').addEventListener('click', () => {
      if (waveOsc) { stopWaveAudio(); return; }
      AEM.Audio.stopAll();
      const ctxA = AEM.Audio.getContext();
      const osc = ctxA.createOscillator();
      const g = ctxA.createGain();
      g.gain.value = 0.28;
      osc.frequency.value = +$('waveFreq').value;
      osc.setPeriodicWave(buildPeriodicWave(ctxA));
      osc.connect(g).connect(ctxA.destination);
      osc.start();
      waveOsc = osc;
      waveAudioStopFn = AEM.Audio.registerStop(stopWaveAudio);
      $('wavePlayBtn').classList.add('playing-pulse');
      $('wavePlayBtn').textContent = '■ Parar Som';
    });

    document.querySelectorAll('.wave-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.wave-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const p = btn.dataset.preset;
        const nDef = p === 'sine' ? 1 : (p === 'square' || p === 'saw' || p === 'tri') ? 9 : 8;
        $('waveNHarm').value = nDef; $('waveNHarmOut').textContent = nDef;
        applyWavePreset(p, nDef);
      });
    });

    $('waveFreq').addEventListener('input', e => {
      $('waveFreqOut').textContent = e.target.value + ' Hz';
      syncHarmonicsUI();
      updateLiveWaveAudio();
    });
    $('waveNHarm').addEventListener('input', e => {
      const val = +e.target.value;
      $('waveNHarmOut').textContent = val;
      if (wavePresetMode === 'custom') wavePresetMode = 'square';
      applyWavePreset(wavePresetMode, val);
    });
    $('waveShufflePhaseBtn').addEventListener('click', () => {
      for (let i = 0; i < H_COUNT; i++) wavePhases[i] = +(Math.random() * 2 * Math.PI - Math.PI).toFixed(2);
      syncHarmonicsUI(); updateLiveWaveAudio(); draw();
    });
    $('waveZeroPhaseBtn').addEventListener('click', () => {
      wavePhases.fill(0);
      syncHarmonicsUI(); updateLiveWaveAudio(); draw();
    });

    $('waveSpecCv').addEventListener('click', e => {
      const r = $('waveSpecCv').getBoundingClientRect();
      const x = e.clientX - r.left;
      const midX = r.width * 0.56, padL = 32;
      if (x >= padL && x <= midX - 10) {
        const list = getWaveCoeffsFull();
        const barsN = Math.max(8, list.reduce((m, it) => Math.max(m, it.n), 8));
        const bw = (midX - padL - 16) / barsN;
        const n = Math.floor((x - padL) / bw) + 1;
        if (n >= 1 && n <= barsN) AEM.Audio.playPureTone(n * +$('waveFreq').value, 0.45);
      }
    });

    AEM.Theme.onChange(draw);
    draw();
  }

  function resize() { draw(); }

  function tick(dt) {
    if (!initialized) return;
    waveAnimPhase += dt * 2.2;
    draw();
  }

  return { init, resize, tick };
})();

