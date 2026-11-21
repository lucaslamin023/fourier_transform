/* ============================================================================
 * AEM-Lab · Módulo 03: Hélice 3D, Fórmula de Euler & Epiciclos
 * ============================================================================ */
window.AEM = window.AEM || {};
AEM.Modules = AEM.Modules || {};

AEM.Modules.helice = (() => {
  'use strict';

  const $ = id => document.getElementById(id);
  let initialized = false;
  let helixCv, helixCtx;
  let hW = 0, hH = 0, helixAz = 0.55, helixEl = 0.38, helixT = 0;
  let helixDragging = false, lastMX = 0, lastMY = 0;
  let helixOsc = null, helixStopFn = null;

  function resize() {
    if (!helixCv) return;
    const s = AEM.Canvas.setupCanvas(helixCv);
    hW = s.w; hH = s.h;
  }

  function stopHelixAudio() {
    if (helixOsc) { try { helixOsc.stop(); } catch (_) {} helixOsc = null; }
    if (helixStopFn) { helixStopFn(); helixStopFn = null; }
    $('helixPlayBtn').classList.remove('playing-pulse');
    $('helixPlayBtn').textContent = '▶ Ouvir Hélice';
  }

  function project3D(x, y, z, scale3d) {
    const ca = Math.cos(helixAz), sa = Math.sin(helixAz);
    const ce = Math.cos(helixEl), se = Math.sin(helixEl);
    const x1 = x * ca - z * sa;
    const z1 = x * sa + z * ca;
    const y2 = y * ce - z1 * se;
    const z2 = y * se + z1 * ce;
    const persp = 4.2 / (4.2 + z2 * 0.35);
    return {
      sx: hW / 2 + x1 * scale3d * persp,
      sy: hH / 2 - y2 * scale3d * persp,
      depth: z2
    };
  }

  function init() {
    if (initialized) return;
    helixCv = $('helixCv');
    if (!helixCv) return;
    helixCtx = helixCv.getContext('2d');
    initialized = true;

    helixCv.addEventListener('pointerdown', e => {
      helixDragging = true; lastMX = e.clientX; lastMY = e.clientY;
      helixCv.setPointerCapture(e.pointerId);
    });
    helixCv.addEventListener('pointermove', e => {
      if (!helixDragging) return;
      helixAz += (e.clientX - lastMX) * 0.008;
      helixEl = Math.max(-1.55, Math.min(1.55, helixEl + (e.clientY - lastMY) * 0.008));
      lastMX = e.clientX; lastMY = e.clientY;
    });
    helixCv.addEventListener('pointerup', () => { helixDragging = false; });

    document.querySelectorAll('.helix-view').forEach(b => {
      b.addEventListener('click', () => {
        helixAz = +b.dataset.az;
        helixEl = +b.dataset.el;
      });
    });

    $('helixFreq').addEventListener('input', e => { $('helixFreqOut').textContent = (+e.target.value).toFixed(1); });
    $('helixSpeed').addEventListener('input', e => { $('helixSpeedOut').textContent = (+e.target.value).toFixed(1) + 'x'; });

    $('helixPlayBtn').addEventListener('click', () => {
      if (helixOsc) { stopHelixAudio(); return; }
      AEM.Audio.stopAll();
      const ctxA = AEM.Audio.getContext();
      const f = 110 * +$('helixFreq').value;
      const osc = ctxA.createOscillator();
      const g = ctxA.createGain();
      g.gain.value = 0.22;
      osc.frequency.value = f;
      osc.connect(g).connect(ctxA.destination);
      osc.start();
      helixOsc = osc;
      helixStopFn = AEM.Audio.registerStop(stopHelixAudio);
      $('helixPlayBtn').classList.add('playing-pulse');
      $('helixPlayBtn').textContent = '■ Parar Som';
    });

    resize();
  }

  function tick(dt) {
    if (!initialized || hW < 10) return;
    const { css, FONT_MONO } = AEM.Canvas;
    const c = helixCtx;
    c.clearRect(0, 0, hW, hH);
    const mode = $('helixMode').value;
    const freq = +$('helixFreq').value;
    const spd = +$('helixSpeed').value;
    helixT += dt * spd * 1.4;

    const ctxA = AEM.Audio.currentCtx();
    if (helixOsc && ctxA) {
      helixOsc.frequency.setTargetAtTime(110 * freq, ctxA.currentTime, 0.03);
    }

    const scale3d = Math.min(hW, hH) * 0.24;
    const zSpan = 2.4;

    const o = project3D(0, 0, -zSpan / 2, scale3d);
    const axRe = project3D(1.3, 0, -zSpan / 2, scale3d);
    const axIm = project3D(0, 1.3, -zSpan / 2, scale3d);
    const axZ = project3D(0, 0, zSpan / 2 + 0.3, scale3d);

    c.lineWidth = 1.2;
    c.strokeStyle = css('--line');
    [axRe, axIm, axZ].forEach(end => {
      c.beginPath(); c.moveTo(o.sx, o.sy); c.lineTo(end.sx, end.sy); c.stroke();
    });
    c.fillStyle = css('--muted'); c.font = '11px ' + FONT_MONO;
    c.fillText('Real (cos)', axRe.sx + 5, axRe.sy);
    c.fillText('Imag (i·sin)', axIm.sx + 5, axIm.sy - 4);
    c.fillText('Tempo t', axZ.sx + 6, axZ.sy);

    const steps = 180;
    const evalSpiral = (kSign, tNorm) => {
      const ang = kSign * 2 * Math.PI * freq * tNorm - helixT * kSign;
      return { x: Math.cos(ang), y: Math.sin(ang) };
    };

    const drawCurve = (pts3d, color, width = 2.4, alpha = 1) => {
      c.beginPath();
      pts3d.forEach((p, idx) => {
        const pr = project3D(p.x, p.y, p.z, scale3d);
        c[idx === 0 ? 'moveTo' : 'lineTo'](pr.sx, pr.sy);
      });
      c.strokeStyle = color; c.lineWidth = width; c.globalAlpha = alpha; c.stroke();
      c.globalAlpha = 1;
    };

    if (mode === 'ccw' || mode === 'cw') {
      const sgn = mode === 'ccw' ? 1 : -1;
      const pts = [], projRe = [], projIm = [];
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const z = -zSpan / 2 + u * zSpan;
        const v = evalSpiral(sgn, u);
        pts.push({ x: v.x, y: v.y, z });
        projRe.push({ x: v.x, y: -1.15, z });
        projIm.push({ x: -1.15, y: v.y, z });
      }
      if ($('helixProj').checked) {
        drawCurve(projRe, css('--accent-2'), 1.6, 0.72);
        drawCurve(projIm, css('--accent-4'), 1.6, 0.72);
      }
      drawCurve(pts, css('--trace'), 2.8, 1);

      if ($('helixVectors').checked) {
        const v0 = evalSpiral(sgn, 0);
        const p0 = project3D(0, 0, -zSpan / 2, scale3d);
        const p1 = project3D(v0.x, v0.y, -zSpan / 2, scale3d);
        c.beginPath(); c.moveTo(p0.sx, p0.sy); c.lineTo(p1.sx, p1.sy);
        c.strokeStyle = css('--trace'); c.lineWidth = 2.5; c.stroke();
        c.beginPath(); c.arc(p1.sx, p1.sy, 5, 0, 2 * Math.PI); c.fillStyle = css('--trace'); c.fill();
      }
      $('helixStatusInfo').textContent = mode === 'ccw'
        ? 'e^(+iωt) = cos(ωt) + i·sin(ωt)  [+ω]'
        : 'e^(-iωt) = cos(ωt) - i·sin(ωt)  [-ω]';
    } else if (mode === 'sum') {
      const pPlus = [], pMinus = [], pSum = [];
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const z = -zSpan / 2 + u * zSpan;
        const a = evalSpiral(1, u), b = evalSpiral(-1, u);
        pPlus.push({ x: a.x * 0.5, y: a.y * 0.5, z });
        pMinus.push({ x: b.x * 0.5, y: b.y * 0.5, z });
        pSum.push({ x: 0.5 * (a.x + b.x), y: 0.5 * (a.y + b.y), z });
      }
      drawCurve(pPlus, css('--accent-2'), 1.8, 0.75);
      drawCurve(pMinus, css('--accent-4'), 1.8, 0.75);
      drawCurve(pSum, css('--trace'), 3.0, 1);
      if ($('helixVectors').checked) {
        const a0 = evalSpiral(1, 0), b0 = evalSpiral(-1, 0);
        const org = project3D(0, 0, -zSpan / 2, scale3d);
        const pa = project3D(a0.x * 0.5, a0.y * 0.5, -zSpan / 2, scale3d);
        const pb = project3D(b0.x * 0.5, b0.y * 0.5, -zSpan / 2, scale3d);
        const ps = project3D(0.5 * (a0.x + b0.x), 0.5 * (a0.y + b0.y), -zSpan / 2, scale3d);
        c.lineWidth = 2;
        c.strokeStyle = css('--accent-2'); c.beginPath(); c.moveTo(org.sx, org.sy); c.lineTo(pa.sx, pa.sy); c.stroke();
        c.strokeStyle = css('--accent-4'); c.beginPath(); c.moveTo(org.sx, org.sy); c.lineTo(pb.sx, pb.sy); c.stroke();
        c.strokeStyle = css('--trace'); c.beginPath(); c.moveTo(org.sx, org.sy); c.lineTo(ps.sx, ps.sy); c.stroke();
        c.beginPath(); c.arc(ps.sx, ps.sy, 5, 0, 2 * Math.PI); c.fillStyle = css('--trace'); c.fill();
      }
      $('helixStatusInfo').textContent = '½ e^(+iωt) + ½ e^(-iωt) = cos(ωt)';
    } else if (mode === 'epicycle3d') {
      const comps = [
        { k: 1, r: 0.65, ph: 0 },
        { k: -2, r: 0.28, ph: 0.5 },
        { k: 3, r: 0.18, ph: -0.7 },
        { k: -5, r: 0.11, ph: 1.2 }
      ];
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const u = i / steps, z = -zSpan / 2 + u * zSpan;
        let x = 0, y = 0;
        comps.forEach(cp => {
          const ang = cp.k * (2 * Math.PI * u - helixT) + cp.ph;
          x += cp.r * Math.cos(ang); y += cp.r * Math.sin(ang);
        });
        pts.push({ x, y, z });
      }
      drawCurve(pts, css('--trace'), 2.8, 1);
      let cx3 = 0, cy3 = 0;
      comps.forEach((cp, idx) => {
        const ang = cp.k * (-helixT) + cp.ph;
        const nx = cx3 + cp.r * Math.cos(ang), ny = cy3 + cp.r * Math.sin(ang);
        const pA = project3D(cx3, cy3, -zSpan / 2, scale3d);
        const pB = project3D(nx, ny, -zSpan / 2, scale3d);
        c.beginPath(); c.moveTo(pA.sx, pA.sy); c.lineTo(pB.sx, pB.sy);
        c.strokeStyle = idx % 2 === 0 ? css('--accent-2') : css('--accent-4');
        c.lineWidth = 2; c.stroke();
        cx3 = nx; cy3 = ny;
      });
      const tip = project3D(cx3, cy3, -zSpan / 2, scale3d);
      c.beginPath(); c.arc(tip.sx, tip.sy, 5, 0, 2 * Math.PI); c.fillStyle = css('--trace'); c.fill();
      $('helixStatusInfo').textContent = 'Selecione "Frente (Argand)" para ver a hélice virar epiciclos 2D';
    }
  }

  return { init, resize, tick };
})();

