/* ============================================================================
 * AEM-Lab · Módulo 05: MP3 / Áudio → Visualizações & Filtros Fourier ao Vivo
 * ============================================================================ */
window.AEM = window.AEM || {};
AEM.Modules = AEM.Modules || {};

AEM.Modules.mp3 = (() => {
  'use strict';

  const $ = id => document.getElementById(id);
  let initialized = false;
  let mp3VizCv, mp3OverviewCv;
  let mp3AudioBuffer = null;
  let mp3Source = null, mp3Analyser = null, mp3Filter = null, mp3Gain = null;
  let mp3MicStream = null, mp3MicSource = null;
  let mp3Playing = false, mp3StartTime = 0, mp3Offset = 0, mp3StopFn = null;
  let mp3FreqBins = null, mp3TimeBins = null;
  let spectrogramImgData = null;

  function cutoffSliderToHz(val) {
    return Math.round(80 * Math.pow(200, val / 100));
  }

  function formatMMSS(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60), r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function updateFilterParams() {
    const hz = cutoffSliderToHz(+$('mp3Cutoff').value);
    const q = +$('mp3Q').value;
    $('mp3CutoffOut').textContent = hz + ' Hz';
    $('mp3QOut').textContent = q.toFixed(1);
    const ctxA = AEM.Audio.currentCtx();
    if (mp3Filter && ctxA) {
      const fType = $('mp3FilterType').value;
      if (fType === 'none') {
        mp3Filter.type = 'allpass';
      } else {
        mp3Filter.type = fType;
        mp3Filter.frequency.setTargetAtTime(hz, ctxA.currentTime, 0.02);
        mp3Filter.Q.setTargetAtTime(q, ctxA.currentTime, 0.02);
      }
    }
  }

  function coffeeBarColor(val, dark) {
    if (dark) {
      const r = Math.round(130 + val * 100);
      const g = Math.round(108 + val * 18);
      const b = Math.round(88 - val * 10);
      return `rgb(${r},${g},${b})`;
    }
    const r = Math.round(170 - val * 31);
    const g = Math.round(146 - val * 109);
    const b = Math.round(115 - val * 115);
    return `rgb(${r},${g},${b})`;
  }

  function coffeeSpectrogramRGB(val, dark) {
    const v = Math.max(0, Math.min(1, val));
    if (dark) {
      if (v < 0.45) {
        const t = v / 0.45;
        return [Math.round(26 + t * 113), Math.round(20 + t * 17), Math.round(16 - t * 16)];
      } else if (v < 0.8) {
        const t = (v - 0.45) / 0.35;
        return [Math.round(139 + t * 73), Math.round(37 + t * 131), Math.round(t * 67)];
      }
      const t = (v - 0.8) / 0.2;
      return [Math.round(212 + t * 33), Math.round(168 + t * 72), Math.round(67 + t * 165)];
    }
    if (v < 0.45) {
      const t = v / 0.45;
      return [Math.round(237 - t * 53), Math.round(231 - t * 97), Math.round(217 - t * 206)];
    } else if (v < 0.8) {
      const t = (v - 0.45) / 0.35;
      return [Math.round(184 - t * 45), Math.round(134 - t * 97), Math.round(11 - t * 11)];
    }
    const t = (v - 0.8) / 0.2;
    return [Math.round(139 - t * 113), Math.round(37 - t * 17), Math.round(t * 16)];
  }

  function drawOverview() {
    if (!mp3OverviewCv) return;
    const { setupCanvas, css, FONT_MONO } = AEM.Canvas;
    const { ctx: c, w, h } = setupCanvas(mp3OverviewCv);
    c.clearRect(0, 0, w, h);
    if (!mp3AudioBuffer) {
      c.fillStyle = css('--muted'); c.font = '11px ' + FONT_MONO;
      c.fillText('Forma de onda completa aparecerá aqui após carregar ou escolher uma faixa…', 12, h / 2 + 4);
      return;
    }
    const data = mp3AudioBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / w));
    const mid = h / 2;
    c.fillStyle = css('--accent-2');
    for (let x = 0; x < w; x++) {
      let minV = 1, maxV = -1;
      const start = x * step;
      for (let j = 0; j < step && start + j < data.length; j += Math.max(1, Math.floor(step / 16))) {
        const v = data[start + j];
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
      const yTop = mid - maxV * (mid - 4);
      const yBot = mid - minV * (mid - 4);
      c.fillRect(x, yTop, 1, Math.max(1.5, yBot - yTop));
    }
    const ctxA = AEM.Audio.currentCtx();
    const curSec = mp3Playing && ctxA ? (ctxA.currentTime - mp3StartTime) : mp3Offset;
    const pct = Math.max(0, Math.min(1, curSec / mp3AudioBuffer.duration));
    const cx = pct * w;
    c.fillStyle = css('--trace'); c.globalAlpha = 0.14;
    c.fillRect(0, 0, cx, h);
    c.globalAlpha = 1;
    c.strokeStyle = css('--trace'); c.lineWidth = 2;
    c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx, h); c.stroke();
  }

  function stopPlayback(resetOffset = true) {
    if (mp3Source) { try { mp3Source.stop(); } catch (_) {} mp3Source = null; }
    if (mp3MicSource) { try { mp3MicSource.disconnect(); } catch (_) {} mp3MicSource = null; }
    if (mp3MicStream) { mp3MicStream.getTracks().forEach(t => t.stop()); mp3MicStream = null; }
    mp3Playing = false;
    if (resetOffset) mp3Offset = 0;
    if (mp3StopFn) { mp3StopFn(); mp3StopFn = null; }
    $('mp3PlayBtn').textContent = '▶ Tocar';
    $('mp3PlayBtn').classList.remove('playing-pulse');
    $('mp3MicBtn').classList.remove('playing-pulse');
    if (mp3AudioBuffer) {
      $('mp3TimeDisplay').textContent = `${formatMMSS(mp3Offset)} / ${formatMMSS(mp3AudioBuffer.duration)}`;
    }
    drawOverview();
  }

  function startPlayback(fromOffset = mp3Offset) {
    if (!mp3AudioBuffer) return;
    AEM.Audio.stopAll();
    const ctxA = AEM.Audio.getContext();
    const src = ctxA.createBufferSource();
    src.buffer = mp3AudioBuffer;

    const filter = ctxA.createBiquadFilter();
    const gain = ctxA.createGain();
    gain.gain.value = +$('mp3Vol').value;
    const analyser = ctxA.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.78;

    src.connect(filter).connect(gain).connect(analyser).connect(ctxA.destination);
    mp3Source = src; mp3Filter = filter; mp3Gain = gain; mp3Analyser = analyser;
    mp3FreqBins = new Uint8Array(analyser.frequencyBinCount);
    mp3TimeBins = new Uint8Array(analyser.fftSize);
    updateFilterParams();

    mp3Offset = Math.max(0, Math.min(mp3AudioBuffer.duration - 0.01, fromOffset));
    mp3StartTime = ctxA.currentTime - mp3Offset;
    mp3Playing = true;
    src.start(0, mp3Offset);
    mp3StopFn = AEM.Audio.registerStop(() => stopPlayback(false));

    $('mp3PlayBtn').textContent = '❚❚ Pausar';
    $('mp3PlayBtn').classList.add('playing-pulse');
    src.onended = () => {
      if (mp3Source === src && mp3Playing) {
        if (ctxA.currentTime - mp3StartTime >= mp3AudioBuffer.duration - 0.08) {
          stopPlayback(true);
        }
      }
    };
  }

  function loadDecodedAudioBuffer(buffer, label) {
    stopPlayback(true);
    mp3AudioBuffer = buffer;
    $('mp3FileInfo').textContent = `Carregado: ${label} · ${buffer.duration.toFixed(1)}s · ${buffer.sampleRate} Hz · ${buffer.numberOfChannels} canal(is)`;
    $('mp3PlayBtn').disabled = false;
    $('mp3StopBtn').disabled = false;
    $('mp3AnalyzeBtn').disabled = false;
    $('mp3TimeDisplay').textContent = `00:00 / ${formatMMSS(buffer.duration)}`;
    spectrogramImgData = null;
    drawOverview();
    startPlayback(0);
  }

  async function handleAudioFile(file) {
    if (!file) return;
    $('mp3FileInfo').textContent = `Decodificando "${file.name}"…`;
    try {
      const ctxA = AEM.Audio.getContext();
      const arr = await file.arrayBuffer();
      const decoded = await ctxA.decodeAudioData(arr);
      loadDecodedAudioBuffer(decoded, file.name);
    } catch (err) {
      $('mp3FileInfo').textContent = `Erro ao decodificar arquivo: ${err.message || err}`;
    }
  }

  function drawFrame() {
    if (!initialized || !mp3VizCv) return;
    const { setupCanvas, css, FONT_MONO } = AEM.Canvas;
    const { ctx: c, w, h } = setupCanvas(mp3VizCv);
    const mode = $('mp3VizMode').value;
    const dark = AEM.Theme.isDark();

    if (!mp3Analyser || !mp3Playing) {
      c.clearRect(0, 0, w, h);
      if (mp3AudioBuffer && !mp3MicStream) {
        const ch = mp3AudioBuffer.getChannelData(0);
        const sr = mp3AudioBuffer.sampleRate;
        const nyq = sr / 2;
        const N = 2048;
        const startIdx = Math.min(Math.max(0, Math.floor(mp3Offset * sr)), Math.max(0, ch.length - N));
        const re = new Float64Array(N), im = new Float64Array(N);
        for (let i = 0; i < N && startIdx + i < ch.length; i++) {
          const win = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
          re[i] = ch[startIdx + i] * win;
        }
        AEM.Math.fftRadix2(re, im, false);
        const logMode = $('mp3LogFreq').checked;
        let peakK = 1, peakMag = 0;
        const bins = new Float64Array(N / 2);
        for (let k = 1; k < N / 2; k++) {
          const mag = Math.hypot(re[k], im[k]);
          if (mag > peakMag) { peakMag = mag; peakK = k; }
          bins[k] = Math.max(0, Math.min(1, (20 * Math.log10(mag / (N * 0.25) + 1e-6) + 72) / 72));
        }
        $('mp3PeakNote').textContent = peakMag > 1e-4 ? AEM.Math.freqToNote((peakK * sr) / N) : 'Silêncio';

        const topH = h * 0.44;
        c.fillStyle = css('--paper'); c.fillRect(0, 0, w, topH - 4);
        c.strokeStyle = css('--line'); c.strokeRect(0, 0, w, topH - 4);
        c.beginPath();
        for (let i = 0; i < N; i += 2) {
          const x = (i / N) * w;
          const v = startIdx + i < ch.length ? ch[startIdx + i] : 0;
          const y = (topH - 4) / 2 - v * ((topH - 4) * 0.42);
          c[i === 0 ? 'moveTo' : 'lineTo'](x, y);
        }
        c.strokeStyle = css('--trace'); c.lineWidth = 2; c.stroke();
        c.fillStyle = css('--muted'); c.font = '10.5px ' + FONT_MONO;
        c.fillText(`Forma de Onda Estática em ${formatMMSS(mp3Offset)}`, 10, 16);

        const sy = topH + 4, sh = h - sy - 26;
        c.fillStyle = css('--paper'); c.fillRect(0, sy, w, sh);
        c.strokeStyle = css('--line'); c.strokeRect(0, sy, w, sh);
        const bars = 96;
        for (let b = 0; b < bars; b++) {
          const u0 = b / bars, u1 = (b + 1) / bars;
          const f0 = logMode ? 25 * Math.pow(nyq / 25, u0) : u0 * nyq;
          const f1 = logMode ? 25 * Math.pow(nyq / 25, u1) : u1 * nyq;
          const i0 = Math.max(1, Math.floor((f0 / nyq) * bins.length));
          const i1 = Math.min(bins.length - 1, Math.ceil((f1 / nyq) * bins.length));
          let sum = 0, cnt = 0;
          for (let k = i0; k <= i1; k++) { sum += bins[k]; cnt++; }
          const val = cnt ? sum / cnt : 0;
          const bh = val * (sh - 24);
          const bx = u0 * w;
          c.fillStyle = coffeeBarColor(val, dark);
          c.fillRect(bx + 1, sy + sh - 18 - bh, Math.max(2, w / bars - 2), bh);
        }
        c.fillStyle = css('--muted'); c.font = '10.5px ' + FONT_MONO;
        c.fillText('Espectro FFT Instantâneo (Pausado)', 10, sy + 16);
        c.fillText(`Pausado em ${formatMMSS(mp3Offset)} — clique na barra acima para navegar ou ▶ Tocar para tempo real.`, 10, h - 7);
      } else {
        c.fillStyle = css('--muted'); c.font = '12.5px ' + FONT_MONO;
        c.fillText('Carregue um MP3 ou escolha uma Demo acima para visualizar o Fourier em tempo real.', 24, h / 2);
      }
      return;
    }

    mp3Analyser.getByteFrequencyData(mp3FreqBins);
    mp3Analyser.getByteTimeDomainData(mp3TimeBins);

    const ctxA = AEM.Audio.currentCtx();
    if (mp3AudioBuffer && !mp3MicStream && ctxA) {
      const curSec = ctxA.currentTime - mp3StartTime;
      $('mp3TimeDisplay').textContent = `${formatMMSS(curSec)} / ${formatMMSS(mp3AudioBuffer.duration)}`;
      drawOverview();
    }

    const sr = ctxA ? ctxA.sampleRate : 44100;
    const nyq = sr / 2;
    let peakIdx = 1, peakVal = 0;
    for (let i = 1; i < mp3FreqBins.length; i++) {
      if (mp3FreqBins[i] > peakVal) { peakVal = mp3FreqBins[i]; peakIdx = i; }
    }
    const peakHz = (peakIdx / mp3FreqBins.length) * nyq;
    $('mp3PeakNote').textContent = peakVal > 18 ? AEM.Math.freqToNote(peakHz) : 'Silêncio';

    const logMode = $('mp3LogFreq').checked;
    const freqToX = (hz, totalW, x0 = 0) => {
      if (!logMode) return x0 + (hz / nyq) * totalW;
      const frac = Math.log10(Math.max(25, hz) / 25) / Math.log10(nyq / 25);
      return x0 + Math.max(0, Math.min(1, frac)) * totalW;
    };

    const drawSpectrumInRect = (rx, ry, rw, rh) => {
      c.fillStyle = css('--paper'); c.fillRect(rx, ry, rw, rh);
      c.strokeStyle = css('--line'); c.strokeRect(rx, ry, rw, rh);
      const bars = 96;
      for (let b = 0; b < bars; b++) {
        const u0 = b / bars, u1 = (b + 1) / bars;
        const f0 = logMode ? 25 * Math.pow(nyq / 25, u0) : u0 * nyq;
        const f1 = logMode ? 25 * Math.pow(nyq / 25, u1) : u1 * nyq;
        const i0 = Math.max(1, Math.floor((f0 / nyq) * mp3FreqBins.length));
        const i1 = Math.min(mp3FreqBins.length - 1, Math.ceil((f1 / nyq) * mp3FreqBins.length));
        let sum = 0, cnt = 0;
        for (let k = i0; k <= i1; k++) { sum += mp3FreqBins[k]; cnt++; }
        const val = (cnt ? sum / cnt : 0) / 255;
        const bh = val * (rh - 24);
        const bx = rx + u0 * rw;
        c.fillStyle = coffeeBarColor(val, dark);
        c.fillRect(bx + 1, ry + rh - 18 - bh, Math.max(2, rw / bars - 2), bh);
      }
      if ($('mp3FilterType').value !== 'none') {
        const cutHz = cutoffSliderToHz(+$('mp3Cutoff').value);
        const cx = freqToX(cutHz, rw, rx);
        c.strokeStyle = css('--accent-2'); c.lineWidth = 2; c.setLineDash([5, 4]);
        c.beginPath(); c.moveTo(cx, ry); c.lineTo(cx, ry + rh); c.stroke();
        c.setLineDash([]);
        c.fillStyle = css('--accent-2'); c.font = '10.5px ' + FONT_MONO;
        c.fillText(`Corte ${cutHz} Hz`, Math.min(rx + rw - 92, cx + 5), ry + 16);
      }
      c.fillStyle = css('--muted'); c.font = '10px ' + FONT_MONO;
      [50, 100, 250, 500, 1000, 2500, 5000, 10000].forEach(hz => {
        if (hz < nyq) c.fillText(hz >= 1000 ? (hz / 1000) + 'k' : hz + '', freqToX(hz, rw, rx) - 6, ry + rh - 4);
      });
    };

    const drawWaveformInRect = (rx, ry, rw, rh) => {
      c.fillStyle = css('--paper'); c.fillRect(rx, ry, rw, rh);
      c.strokeStyle = css('--line'); c.strokeRect(rx, ry, rw, rh);
      c.beginPath();
      for (let i = 0; i < mp3TimeBins.length; i += 2) {
        const x = rx + (i / mp3TimeBins.length) * rw;
        const v = (mp3TimeBins[i] - 128) / 128;
        const y = ry + rh / 2 + v * (rh * 0.42);
        c[i === 0 ? 'moveTo' : 'lineTo'](x, y);
      }
      c.strokeStyle = css('--trace'); c.lineWidth = 2; c.stroke();
      c.fillStyle = css('--muted'); c.font = '10.5px ' + FONT_MONO;
      c.fillText('Domínio do Tempo (Osciloscópio ao Vivo)', rx + 10, ry + 16);
    };

    const drawSpectrogramInRect = (rx, ry, rw, rh) => {
      const iw = Math.max(10, Math.floor(rw)), ih = Math.max(10, Math.floor(rh));
      if (!spectrogramImgData || spectrogramImgData.width !== iw || spectrogramImgData.height !== ih) {
        spectrogramImgData = c.createImageData(iw, ih);
        const bgRGB = coffeeSpectrogramRGB(0, dark);
        for (let i = 0; i < spectrogramImgData.data.length; i += 4) {
          spectrogramImgData.data[i] = bgRGB[0];
          spectrogramImgData.data[i + 1] = bgRGB[1];
          spectrogramImgData.data[i + 2] = bgRGB[2];
          spectrogramImgData.data[i + 3] = 255;
        }
      }
      const d = spectrogramImgData.data;
      const shift = 2;
      for (let y = 0; y < ih; y++) {
        const rowOff = y * iw * 4;
        d.copyWithin(rowOff, rowOff + shift * 4, rowOff + iw * 4);
        const fracY = 1 - y / ih;
        const f = logMode ? 25 * Math.pow(nyq / 25, fracY) : fracY * nyq;
        const bin = Math.min(mp3FreqBins.length - 1, Math.max(0, Math.floor((f / nyq) * mp3FreqBins.length)));
        const val = mp3FreqBins[bin] / 255;
        const [rC, gC, bC] = coffeeSpectrogramRGB(val, dark);
        for (let s = 0; s < shift; s++) {
          const p = rowOff + (iw - 1 - s) * 4;
          d[p] = rC; d[p + 1] = gC; d[p + 2] = bC; d[p + 3] = 255;
        }
      }
      if (!drawSpectrogramInRect._off) drawSpectrogramInRect._off = document.createElement('canvas');
      const off = drawSpectrogramInRect._off;
      if (off.width !== iw || off.height !== ih) { off.width = iw; off.height = ih; }
      off.getContext('2d').putImageData(spectrogramImgData, 0, 0);
      c.drawImage(off, rx, ry, rw, rh);
      c.strokeStyle = css('--line'); c.strokeRect(rx, ry, rw, rh);
      c.fillStyle = css('--paper');
      c.globalAlpha = 0.85;
      c.fillRect(rx + 6, ry + 5, 290, 18);
      c.globalAlpha = 1;
      c.fillStyle = css('--ink'); c.font = '10.5px ' + FONT_MONO;
      c.fillText('Espectrograma (Tempo → · Frequência ↑)', rx + 10, ry + 17);
    };

    if (mode === 'dashboard') {
      c.clearRect(0, 0, w, h);
      const topH = h * 0.42;
      drawWaveformInRect(0, 0, w * 0.46 - 4, topH - 4);
      drawSpectrumInRect(w * 0.46 + 4, 0, w * 0.54 - 4, topH - 4);
      drawSpectrogramInRect(0, topH + 4, w, h - topH - 4);
    } else if (mode === 'bars') {
      c.clearRect(0, 0, w, h);
      drawSpectrumInRect(0, 0, w, h);
    } else if (mode === 'spectrogram') {
      c.clearRect(0, 0, w, h);
      drawSpectrogramInRect(0, 0, w, h);
    } else if (mode === 'polar') {
      c.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, baseR = Math.min(w, h) * 0.22;
      const nRays = 96;
      c.beginPath();
      for (let i = 0; i <= nRays; i++) {
        const idx = i % nRays;
        const bin = Math.floor((idx / nRays) * (mp3FreqBins.length * 0.55));
        const val = mp3FreqBins[bin] / 255;
        const ang = (idx / nRays) * 2 * Math.PI - Math.PI / 2;
        const rad = baseR + val * baseR * 1.15;
        const x = cx + rad * Math.cos(ang), y = cy + rad * Math.sin(ang);
        c[i === 0 ? 'moveTo' : 'lineTo'](x, y);
      }
      c.closePath();
      c.strokeStyle = css('--trace'); c.lineWidth = 2.4; c.stroke();
      c.fillStyle = css('--trace'); c.globalAlpha = 0.1; c.fill(); c.globalAlpha = 1;

      const avgBand = (a, b) => {
        let s = 0; for (let k = a; k < b; k++) s += mp3FreqBins[k];
        return s / Math.max(1, (b - a) * 255);
      };
      const eBass = avgBand(1, 14), eMid = avgBand(14, 70), eHigh = avgBand(70, 240);
      const tNow = performance.now() * 0.002;
      const vecs = [
        { r: baseR * (0.25 + 0.55 * eBass), spd: 1, col: css('--trace') },
        { r: baseR * (0.15 + 0.45 * eMid), spd: -3, col: css('--accent-2') },
        { r: baseR * (0.10 + 0.35 * eHigh), spd: 5, col: css('--accent-4') }
      ];
      let ex = cx, ey = cy;
      vecs.forEach(v => {
        const nx = ex + v.r * Math.cos(tNow * v.spd), ny = ey + v.r * Math.sin(tNow * v.spd);
        c.beginPath(); c.arc(ex, ey, v.r, 0, 2 * Math.PI);
        c.strokeStyle = v.col; c.globalAlpha = 0.4; c.lineWidth = 1.2; c.stroke();
        c.beginPath(); c.moveTo(ex, ey); c.lineTo(nx, ny);
        c.globalAlpha = 0.9; c.lineWidth = 2; c.stroke();
        c.globalAlpha = 1;
        ex = nx; ey = ny;
      });
      c.beginPath(); c.arc(ex, ey, 5, 0, 2 * Math.PI); c.fillStyle = css('--trace'); c.fill();
    }
  }

  function init() {
    if (initialized) return;
    mp3VizCv = $('mp3VizCv');
    mp3OverviewCv = $('mp3OverviewCv');
    if (!mp3VizCv || !mp3OverviewCv) return;
    initialized = true;

    $('mp3Cutoff').addEventListener('input', updateFilterParams);
    $('mp3Q').addEventListener('input', updateFilterParams);
    $('mp3FilterType').addEventListener('change', updateFilterParams);
    $('mp3Vol').addEventListener('input', e => { if (mp3Gain) mp3Gain.gain.value = +e.target.value; });

    mp3OverviewCv.addEventListener('click', e => {
      if (!mp3AudioBuffer) return;
      const r = mp3OverviewCv.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      const targetSec = frac * mp3AudioBuffer.duration;
      if (mp3Playing) {
        stopPlayback(false);
        startPlayback(targetSec);
      } else {
        mp3Offset = targetSec;
        $('mp3TimeDisplay').textContent = `${formatMMSS(mp3Offset)} / ${formatMMSS(mp3AudioBuffer.duration)}`;
        drawOverview();
        drawFrame();
      }
    });

    $('mp3PickBtn').addEventListener('click', () => $('mp3Input').click());
    $('mp3Input').addEventListener('change', e => { if (e.target.files[0]) handleAudioFile(e.target.files[0]); });

    const dz = $('mp3Dropzone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('dragover');
      if (e.dataTransfer.files[0]) handleAudioFile(e.dataTransfer.files[0]);
    });

    document.querySelectorAll('.mp3-demo').forEach(btn => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.demo;
        const ctxA = AEM.Audio.getContext();
        const sr = ctxA.sampleRate;
        const dur = 8.0;
        const buf = ctxA.createBuffer(1, Math.floor(sr * dur), sr);
        const ch = buf.getChannelData(0);
        if (kind === 'arpeggio') {
          const notes = [220, 277.18, 329.63, 440, 554.37, 659.25, 554.37, 440];
          for (let i = 0; i < ch.length; i++) {
            const t = i / sr;
            const idx = Math.floor(t * 2) % notes.length;
            const lt = (t * 2) % 1;
            const f = notes[idx];
            const env = Math.min(1, lt * 18) * Math.exp(-3.2 * lt);
            ch[i] = env * (0.55 * Math.sin(2*Math.PI*f*t) + 0.25 * Math.sin(2*Math.PI*2*f*t) + 0.12 * Math.sin(2*Math.PI*3*f*t))
                  + 0.22 * Math.sin(2*Math.PI*110*t);
          }
          loadDecodedAudioBuffer(buf, 'Demo: Acorde & Arpejo Harmônico');
        } else if (kind === 'beat') {
          for (let i = 0; i < ch.length; i++) {
            const t = i / sr;
            const beat = (t * 2) % 1;
            const kick = Math.exp(-beat * 14) * Math.sin(2 * Math.PI * (140 * Math.exp(-beat * 12) + 45) * beat);
            const hihat = ((t * 4) % 1 < 0.08) ? (Math.random() * 2 - 1) * Math.exp(-((t * 4) % 1) * 45) * 0.35 : 0;
            const bassF = [55, 55, 73.4, 82.4][Math.floor(t) % 4];
            const bass = 0.38 * Math.sin(2*Math.PI*bassF*t) + 0.18 * Math.sin(2*Math.PI*bassF*2*t);
            ch[i] = Math.max(-0.95, Math.min(0.95, kick * 0.65 + hihat + bass));
          }
          loadDecodedAudioBuffer(buf, 'Demo: Batida Eletrônica + Baixo');
        } else {
          for (let i = 0; i < ch.length; i++) {
            const t = i / sr;
            const f0 = 150 + 25 * Math.sin(2 * Math.PI * 1.2 * t);
            let sig = 0;
            for (let h = 1; h <= 14; h++) {
              const fh = h * f0;
              const g1 = Math.exp(-Math.pow((fh - 720) / 220, 2));
              const g2 = 0.6 * Math.exp(-Math.pow((fh - 1450) / 300, 2));
              sig += (g1 + g2 + 0.1 / h) * Math.sin(2 * Math.PI * fh * t);
            }
            const highWhistle = 0.08 * Math.sin(2 * Math.PI * 4800 * t) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.8 * t));
            ch[i] = 0.28 * sig + highWhistle;
          }
          loadDecodedAudioBuffer(buf, 'Demo: Formantes de Voz + Tom 4.8 kHz');
        }
      });
    });

    $('mp3PlayBtn').addEventListener('click', () => {
      if (!mp3AudioBuffer) return;
      const ctxA = AEM.Audio.currentCtx();
      if (mp3Playing && ctxA) {
        mp3Offset = ctxA.currentTime - mp3StartTime;
        stopPlayback(false);
      } else {
        startPlayback(mp3Offset);
      }
    });
    $('mp3StopBtn').addEventListener('click', () => stopPlayback(true));

    $('mp3MicBtn').addEventListener('click', async () => {
      if (mp3MicStream) { stopPlayback(true); return; }
      AEM.Audio.stopAll();
      try {
        const ctxA = AEM.Audio.getContext();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const src = ctxA.createMediaStreamSource(stream);
        const analyser = ctxA.createAnalyser();
        analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.78;
        src.connect(analyser);
        mp3MicStream = stream; mp3MicSource = src; mp3Analyser = analyser;
        mp3FreqBins = new Uint8Array(analyser.frequencyBinCount);
        mp3TimeBins = new Uint8Array(analyser.fftSize);
        mp3Playing = true;
        mp3StopFn = AEM.Audio.registerStop(() => stopPlayback(true));
        $('mp3MicBtn').classList.add('playing-pulse');
        $('mp3FileInfo').textContent = 'Microfone ativo ao vivo. Cante ou fale para observar o espectro de Fourier.';
      } catch (err) {
        $('mp3FileInfo').textContent = 'Microfone indisponível ou permissão negada: ' + err.message;
      }
    });

    $('mp3AnalyzeBtn').addEventListener('click', () => {
      if (!mp3AudioBuffer) return;
      const ch = mp3AudioBuffer.getChannelData(0);
      const sr = mp3AudioBuffer.sampleRate;
      const ctxA = AEM.Audio.currentCtx();
      const curSec = mp3Playing && ctxA ? (ctxA.currentTime - mp3StartTime) : mp3Offset;
      const startIdx = Math.min(Math.max(0, Math.floor(curSec * sr)), Math.max(0, ch.length - 4096));
      const N = 4096;
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N && startIdx + i < ch.length; i++) {
        const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
        re[i] = ch[startIdx + i] * w;
      }
      AEM.Math.fftRadix2(re, im, false);
      const mags = [];
      let totalE = 0;
      for (let k = 1; k < N / 2; k++) {
        const e = re[k] * re[k] + im[k] * im[k];
        totalE += e;
        mags.push({ k, freq: (k * sr) / N, e, amp: Math.sqrt(e) });
      }
      mags.sort((a, b) => b.e - a.e);
      let acc = 0, need95 = 0;
      for (let i = 0; i < mags.length; i++) {
        acc += mags[i].e; need95++;
        if (acc >= 0.95 * totalE) break;
      }
      const topStr = mags.slice(0, 3).map(m => AEM.Math.freqToNote(m.freq)).join(' · ');
      $('mp3FileInfo').textContent = `Análise FFT (${N} amostras em ${formatMMSS(curSec)}): Picos = ${topStr} | ${need95} de ${N/2} bins (${(100*need95/(N/2)).toFixed(1)}%) retêm 95% da energia.`;
    });

    AEM.Theme.onChange(() => {
      spectrogramImgData = null;
      drawOverview();
      drawFrame();
    });

    resize();
  }

  function resize() {
    if (!initialized) return;
    AEM.Canvas.setupCanvas(mp3VizCv);
    drawOverview();
  }

  function tick() {
    drawFrame();
  }

  return { init, resize, tick };
})();

