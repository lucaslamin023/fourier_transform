/* ============================================================================
 * AEM-Lab · Motor Central de Áudio (Web Audio API)
 * ============================================================================ */
window.AEM = window.AEM || {};

AEM.Audio = (() => {
  'use strict';

  let audioCtx = null;
  const activeStopHooks = new Set();
  let stopButtonId = 'btnStopAllAudio';

  function getContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function currentCtx() {
    return audioCtx;
  }

  function updateGlobalIndicator() {
    const btn = document.getElementById(stopButtonId);
    if (!btn) return;
    if (activeStopHooks.size > 0) {
      btn.classList.add('playing-pulse');
      btn.textContent = '■ Silenciar Som';
    } else {
      btn.classList.remove('playing-pulse');
      btn.textContent = '■ Silenciar';
    }
  }

  function registerStop(fn) {
    activeStopHooks.add(fn);
    updateGlobalIndicator();
    return () => {
      activeStopHooks.delete(fn);
      updateGlobalIndicator();
    };
  }

  function stopAll() {
    [...activeStopHooks].forEach(fn => { try { fn(); } catch (_) {} });
    activeStopHooks.clear();
    updateGlobalIndicator();
  }

  function bindStopAllButton(id = 'btnStopAllAudio') {
    stopButtonId = id;
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', stopAll);
  }

  function playPureTone(freq, dur = 0.5) {
    const ctxA = getContext();
    const osc = ctxA.createOscillator();
    const g = ctxA.createGain();
    osc.frequency.value = Math.min(freq, 6000);
    g.gain.setValueAtTime(0.001, ctxA.currentTime);
    g.gain.linearRampToValueAtTime(0.24, ctxA.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctxA.currentTime + dur);
    osc.connect(g).connect(ctxA.destination);
    osc.start();
    osc.stop(ctxA.currentTime + dur + 0.02);
  }

  function synthesizeEpicycleAudioBuffers(coeffs, M, mode, baseFreq, durationSec = 3.0, sr = 44100) {
    const used = coeffs.slice(0, Math.min(M, coeffs.length)).filter(c => c.k !== 0);
    const nSamples = Math.floor(sr * durationSec);
    const left = new Float32Array(nSamples);
    const right = mode === 'stereo' ? new Float32Array(nSamples) : null;
    if (!used.length) return { left, right, sr };

    if (mode === 'wavetable' || mode === 'stereo') {
      const cycleLen = 2048;
      const tblL = new Float32Array(cycleLen);
      const tblR = new Float32Array(cycleLen);
      for (let j = 0; j < cycleLen; j++) {
        const t = j / cycleLen;
        let sx = 0, sy = 0;
        for (let i = 0; i < used.length; i++) {
          const c = used[i];
          const ang = 2 * Math.PI * c.k * t + c.phase;
          sx += c.amp * Math.cos(ang);
          sy += c.amp * Math.sin(ang);
        }
        tblL[j] = sx;
        tblR[j] = sy;
      }
      let maxV = 0.0001;
      for (let j = 0; j < cycleLen; j++) {
        maxV = Math.max(maxV, Math.abs(tblL[j]), Math.abs(tblR[j]));
      }
      for (let i = 0; i < nSamples; i++) {
        const phase = ((i * baseFreq / sr) % 1 + 1) % 1;
        const idx = phase * cycleLen;
        const i0 = Math.floor(idx) % cycleLen;
        const i1 = (i0 + 1) % cycleLen;
        const frac = idx - Math.floor(idx);
        const valL = (tblL[i0] * (1 - frac) + tblL[i1] * frac) / maxV;
        const valR = (tblR[i0] * (1 - frac) + tblR[i1] * frac) / maxV;
        const env = Math.min(1, i / (sr * 0.02), (nSamples - 1 - i) / (sr * 0.02));
        if (mode === 'wavetable') {
          left[i] = 0.65 * (0.7 * valL + 0.3 * valR) * env;
        } else {
          left[i] = 0.65 * valL * env;
          right[i] = 0.65 * valR * env;
        }
      }
    } else if (mode === 'arpeggio') {
      const scaleRatios = [1, 9/8, 5/4, 3/2, 5/3, 2, 9/4, 5/2, 3, 10/3, 4, 9/2];
      const top = used.slice(0, 12);
      const maxAmp = top[0] ? top[0].amp : 1;
      const noteDur = durationSec / top.length;
      for (let idx = 0; idx < top.length; idx++) {
        const c = top[idx];
        const kNorm = (Math.abs(c.k) - 1) % scaleRatios.length;
        const freq = baseFreq * scaleRatios[kNorm];
        const amp = 0.55 * (c.amp / maxAmp);
        const start = Math.floor(idx * noteDur * sr);
        const end = Math.min(nSamples, Math.floor((idx + 1.45) * noteDur * sr));
        for (let i = start; i < end; i++) {
          const lt = (i - start) / sr;
          const tot = (end - start) / sr;
          const env = Math.min(1, lt / 0.015) * Math.exp(-3.2 * lt / tot);
          left[i] += amp * env * Math.sin(2 * Math.PI * freq * lt + c.phase);
        }
      }
      let peak = 0.001;
      for (let i = 0; i < nSamples; i++) peak = Math.max(peak, Math.abs(left[i]));
      if (peak > 0.85) for (let i = 0; i < nSamples; i++) left[i] *= 0.85 / peak;
    }
    return { left, right, sr };
  }

  return {
    getContext,
    currentCtx,
    registerStop,
    stopAll,
    bindStopAllButton,
    playPureTone,
    synthesizeEpicycleAudioBuffers
  };
})();

