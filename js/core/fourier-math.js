/* ============================================================================
 * AEM-Lab · Núcleo Matemático de Fourier
 * DFT complexa, FFT 1D Radix-2, FFT 2D, reamostragem, Parseval e codificação WAV.
 * ============================================================================ */
window.AEM = window.AEM || {};

AEM.Math = (() => {
  'use strict';

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function dftComplex(pts) {
    const n = pts.length;
    const cos = new Float64Array(n);
    const sin = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      cos[i] = Math.cos(a);
      sin[i] = Math.sin(a);
    }
    const out = [];
    const half = Math.floor(n / 2);
    for (let k = -half; k < n - half; k++) {
      let re = 0, im = 0;
      for (let j = 0; j < n; j++) {
        const idx = (((k * j) % n) + n) % n;
        const c = cos[idx], s = -sin[idx];
        re += pts[j].x * c - pts[j].y * s;
        im += pts[j].x * s + pts[j].y * c;
      }
      re /= n;
      im /= n;
      out.push({ k, re, im, amp: Math.hypot(re, im), phase: Math.atan2(im, re) });
    }
    return out.sort((a, b) => b.amp - a.amp);
  }

  function fftRadix2(re, im, inverse = false) {
    const n = re.length;
    if (n <= 1) return;
    let j = 0;
    for (let i = 1; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
        tmp = im[i]; im[i] = im[j]; im[j] = tmp;
      }
    }
    const sign = inverse ? 1 : -1;
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const ang = (sign * 2 * Math.PI) / len;
      const wLenR = Math.cos(ang), wLenI = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let wR = 1, wI = 0;
        for (let k = 0; k < half; k++) {
          const uR = re[i + k], uI = im[i + k];
          const vR = re[i + k + half] * wR - im[i + k + half] * wI;
          const vI = re[i + k + half] * wI + im[i + k + half] * wR;
          re[i + k] = uR + vR; im[i + k] = uI + vI;
          re[i + k + half] = uR - vR; im[i + k + half] = uI - vI;
          const nextWR = wR * wLenR - wI * wLenI;
          wI = wR * wLenI + wI * wLenR;
          wR = nextWR;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    }
  }

  function fft2D(reGrid, imGrid, size, inverse = false) {
    const rowR = new Float64Array(size), rowI = new Float64Array(size);
    for (let y = 0; y < size; y++) {
      const off = y * size;
      for (let x = 0; x < size; x++) { rowR[x] = reGrid[off + x]; rowI[x] = imGrid[off + x]; }
      fftRadix2(rowR, rowI, inverse);
      for (let x = 0; x < size; x++) { reGrid[off + x] = rowR[x]; imGrid[off + x] = rowI[x]; }
    }
    const colR = new Float64Array(size), colI = new Float64Array(size);
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) { colR[y] = reGrid[y * size + x]; colI[y] = imGrid[y * size + x]; }
      fftRadix2(colR, colI, inverse);
      for (let y = 0; y < size; y++) { reGrid[y * size + x] = colR[y]; imGrid[y * size + x] = colI[y]; }
    }
  }

  function resamplePath(pts, n) {
    if (pts.length < 2) return pts.slice();
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    const total = cum[cum.length - 1] || 1;
    const out = [];
    let j = 1;
    for (let i = 0; i < n; i++) {
      const s = (total * i) / n;
      while (j < cum.length - 1 && cum[j] < s) j++;
      const seg = cum[j] - cum[j - 1] || 1;
      const u = (s - cum[j - 1]) / seg;
      out.push({
        x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * u,
        y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * u
      });
    }
    return out;
  }

  function normalizePts(pts) {
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    let m = 0;
    const out = pts.map(p => {
      const nx = p.x - cx, ny = p.y - cy;
      m = Math.max(m, Math.abs(nx), Math.abs(ny));
      return { x: nx, y: ny };
    });
    m = m || 1;
    out.forEach(p => { p.x /= m; p.y /= m; });
    return out;
  }

  function parsevalEnergyRatio(coeffs, M) {
    let total = 0, kept = 0;
    const limit = Math.min(M, coeffs.length);
    for (let i = 0; i < coeffs.length; i++) {
      const e = coeffs[i].amp * coeffs[i].amp;
      total += e;
      if (i < limit) kept += e;
    }
    return total > 0 ? (kept / total) * 100 : 100;
  }

  function freqToNote(hz) {
    if (!hz || hz < 20) return '—';
    const midi = Math.round(69 + 12 * Math.log2(hz / 440));
    const note = NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
    return `${hz.toFixed(1)} Hz (${note})`;
  }

  function encodeWAV(left, right = null, sampleRate = 44100) {
    const numCh = right ? 2 : 1;
    const len = left.length;
    const buf = new ArrayBuffer(44 + len * numCh * 2);
    const view = new DataView(buf);
    const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + len * numCh * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numCh * 2, true);
    view.setUint16(32, numCh * 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, len * numCh * 2, true);
    let offset = 44;
    for (let i = 0; i < len; i++) {
      const sL = Math.max(-1, Math.min(1, left[i]));
      view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7FFF, true);
      offset += 2;
      if (right) {
        const sR = Math.max(-1, Math.min(1, right[i]));
        view.setInt16(offset, sR < 0 ? sR * 0x8000 : sR * 0x7FFF, true);
        offset += 2;
      }
    }
    return new Blob([buf], { type: 'audio/wav' });
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  return {
    dftComplex,
    fftRadix2,
    fft2D,
    resamplePath,
    normalizePts,
    parsevalEnergyRatio,
    freqToNote,
    encodeWAV,
    downloadBlob
  };
})();

