/* ============================================================================
 * AEM-Lab · Módulo 01: Contornos por Linguagem Natural & Fronteiras
 * Converte frases em português/inglês para contornos fechados (SVG local,
 * busca pública de silhuetas Iconify e fronteiras geográficas OpenStreetMap)
 * e anima os epiciclos da série de Fourier começando com M = 1 círculo.
 * ============================================================================ */
window.AEM = window.AEM || {};
AEM.Modules = AEM.Modules || {};

AEM.Modules.contornos = (() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const N_PTS = 720;
  const MAX_SLIDER = 1000;

  let initialized = false;
  let coeffs = [], outline = [], trace = [], tPhase = 0, W = 0, H = 0, viewScale = 1;
  let M = 1, maxM = 300, speed = 1;
  let cv, ctx;

  // Biblioteca vetorial local (100% offline, contornos fechados de traço único)
  const LOCAL_SVGS = {
    gato: {
      label: 'Gato',
      aliases: ['gato', 'gatinho', 'gata', 'felino', 'cat', 'kitten'],
      d: 'M24,84 L20,62 L24,38 L22,14 L36,27 C45,24 55,24 64,27 L78,14 L76,38 L82,58 C84,70 78,80 72,84 L79,78 C88,70 92,55 88,43 C86,38 91,35 94,40 C98,52 94,72 82,83 C74,90 60,91 50,91 C36,91 27,89 24,84 Z'
    },
    cachorro: {
      label: 'Cachorro',
      aliases: ['cachorro', 'cao', 'cachorrinho', 'dog', 'puppy'],
      d: 'M18,78 L22,52 L28,44 L22,30 L27,16 L39,26 L53,24 L65,16 L71,28 C78,30 85,34 88,41 L82,48 L72,49 L68,58 L70,80 L61,80 L59,64 L40,64 L36,80 L27,80 L28,62 L18,68 Z'
    },
    cafe: {
      label: 'Xícara de Café',
      aliases: ['cafe', 'xicara', 'caneca', 'coffee', 'cup', 'mug', 'expresso'],
      d: 'M18,34 L68,34 L66,68 C65,78 56,84 43,84 C30,84 21,78 20,68 Z M68,40 C82,40 88,48 87,58 C86,67 78,72 67,71',
      // Contorno externo unificado da xícara + asa para epiciclo contínuo sem salto
      singleD: 'M18,34 L68,34 L68,41 C81,41 88,48 87,58 C86,67 78,72 66,72 C62,80 54,84 43,84 C29,84 21,77 20,66 Z'
    },
    guitarra: {
      label: 'Guitarra',
      aliases: ['guitarra', 'violao', 'guitar', 'baixo'],
      d: 'M32,88 C18,86 14,72 22,60 C27,53 26,48 22,42 C18,36 24,28 33,31 C40,34 44,32 50,26 L73,10 L81,16 L58,34 C54,40 53,45 58,52 C63,60 58,72 48,78 C43,85 38,89 32,88 Z'
    },
    coracao: {
      label: 'Coração',
      aliases: ['coracao', 'amor', 'heart', 'love'],
      d: 'M50,86 C25,68 12,50 12,33 C12,20 22,12 34,12 C42,12 47,17 50,23 C53,17 58,12 66,12 C78,12 88,20 88,33 C88,50 75,68 50,86 Z'
    },
    estrela: {
      label: 'Estrela',
      aliases: ['estrela', 'star'],
      d: 'M50,8 L61,36 L91,37 L67,56 L76,86 L50,69 L24,86 L33,56 L9,37 L39,36 Z'
    },
    borboleta: {
      label: 'Borboleta',
      aliases: ['borboleta', 'butterfly', 'mariposa'],
      d: 'M50,36 C38,14 10,12 12,34 C14,47 26,52 36,54 C22,58 18,74 28,83 C37,90 46,78 49,64 L50,82 L51,64 C54,78 63,90 72,83 C82,74 78,58 64,54 C74,52 86,47 88,34 C90,12 62,14 50,36 Z'
    },
    foguete: {
      label: 'Foguete',
      aliases: ['foguete', 'nave', 'espaco', 'rocket', 'spaceship'],
      d: 'M50,8 C63,24 67,44 64,65 L78,76 L72,84 L58,76 L54,84 L50,78 L46,84 L42,76 L28,84 L22,76 L36,65 C33,44 37,24 50,8 Z'
    },
    nota: {
      label: 'Nota Musical',
      aliases: ['nota', 'musica', 'som', 'melodia', 'music', 'note'],
      d: 'M42,20 L82,12 L82,66 C82,76 74,83 64,83 C56,83 51,77 52,70 C53,63 61,58 70,59 L72,59 L72,28 L46,34 L46,72 C46,82 38,89 28,89 C20,89 15,83 16,76 C17,69 25,64 34,65 L36,65 Z'
    },
    peixe: {
      label: 'Peixe',
      aliases: ['peixe', 'baleia', 'tubarao', 'fish', 'whale'],
      d: 'M12,50 C25,26 52,24 72,42 L89,27 L84,50 L89,73 L72,58 C52,76 25,74 12,50 Z'
    },
    passaro: {
      label: 'Pássaro',
      aliases: ['passaro', 'ave', 'pomba', 'aguia', 'bird', 'dove'],
      d: 'M14,56 C24,48 30,42 34,30 C40,18 52,18 56,28 L66,26 L58,35 C68,36 80,26 88,18 C82,36 74,48 64,56 C70,66 78,72 86,78 C68,74 56,68 46,62 C36,68 24,68 14,56 Z'
    },
    aviao: {
      label: 'Avião',
      aliases: ['aviao', 'jato', 'voo', 'plane', 'airplane'],
      d: 'M50,10 C55,10 57,16 57,26 L88,52 L88,61 L57,49 L57,72 L70,83 L70,89 L50,83 L30,89 L30,83 L43,72 L43,49 L12,61 L12,52 L43,26 C43,16 45,10 50,10 Z'
    },
    arvore: {
      label: 'Árvore',
      aliases: ['arvore', 'pinheiro', 'floresta', 'tree'],
      d: 'M50,10 L70,38 L58,38 L78,62 L62,62 L84,82 L56,82 L56,92 L44,92 L44,82 L16,82 L38,62 L22,62 L42,38 L30,38 Z'
    },
    flor: {
      label: 'Flor',
      aliases: ['flor', 'petala', 'rosa', 'flower'],
      d: 'M50,14 C58,14 63,24 58,34 C69,30 80,35 79,45 C78,54 67,56 60,54 C69,62 67,75 58,78 C51,80 48,72 48,66 L48,90 L44,90 L44,66 C44,72 41,80 34,78 C25,75 23,62 32,54 C25,56 14,54 13,45 C12,35 23,30 34,34 C29,24 34,14 50,14 Z'
    },
    lua: {
      label: 'Lua Crescente',
      aliases: ['lua', 'crescente', 'noite', 'moon'],
      d: 'M62,14 C36,16 18,38 22,62 C26,82 46,92 68,84 C52,82 40,68 40,50 C40,32 50,19 62,14 Z'
    },
    coroa: {
      label: 'Coroa',
      aliases: ['coroa', 'rei', 'rainha', 'crown'],
      d: 'M14,76 L10,32 L32,50 L50,20 L68,50 L90,32 L86,76 Z'
    },
    casa: {
      label: 'Casa',
      aliases: ['casa', 'lar', 'moradia', 'house', 'home'],
      d: 'M50,14 L88,46 L76,46 L76,84 L57,84 L57,60 L43,60 L43,84 L24,84 L24,46 L12,46 Z'
    },
    carro: {
      label: 'Carro',
      aliases: ['carro', 'automovel', 'car', 'fusca'],
      d: 'M12,66 L14,50 L28,46 L38,28 L66,28 L78,46 L90,50 L90,68 L79,68 C78,76 70,78 65,70 L37,70 C32,78 24,76 23,68 Z'
    },
    infinito: {
      label: 'Símbolo do Infinito',
      aliases: ['infinito', 'infinity', 'laco', 'lemniscata'],
      d: 'M28,34 C14,34 8,42 8,50 C8,58 14,66 28,66 C42,66 58,34 72,34 C86,34 92,42 92,50 C92,58 86,66 72,66 C58,66 42,34 28,34 Z'
    }
  };

  // Dicionário PT-BR -> termos de busca em inglês para consulta pública de SVG (Iconify)
  const PT_EN = {
    coruja: 'owl', dinossauro: 'dinosaur', dragao: 'dragon', lobo: 'wolf', leao: 'lion',
    aguia: 'eagle', elefante: 'elephant', girafa: 'giraffe', cavalo: 'horse', urso: 'bear',
    tartaruga: 'turtle', polvo: 'octopus', abelha: 'bee', aranha: 'spider', cobra: 'snake',
    pinguim: 'penguin', golfinho: 'dolphin', tubarao: 'shark', morcego: 'bat', coelho: 'rabbit',
    raposa: 'fox', cervo: 'deer', veado: 'deer', corvo: 'crow', cisne: 'swan', pato: 'duck',
    cerebro: 'brain', ancora: 'anchor', bussola: 'compass', microscopio: 'microscope',
    telescopio: 'telescope', planeta: 'planet', saturno: 'saturn', atomo: 'atom',
    robo: 'robot', castelo: 'castle', navio: 'ship', barco: 'boat', bicicleta: 'bicycle',
    moto: 'motorcycle', trem: 'train', helicoptero: 'helicopter', balao: 'balloon',
    camera: 'camera', livro: 'book', lampada: 'lightbulb', ampulheta: 'hourglass',
    relogio: 'clock', violino: 'violin', piano: 'piano', trompete: 'trumpet',
    microfone: 'microphone', fone: 'headphones', espada: 'sword', escudo: 'shield',
    chave: 'key', cadeado: 'lock', oculos: 'glasses', chapeu: 'hat', guarda: 'umbrella',
    sol: 'sun', nuvem: 'cloud', raio: 'lightning', fogo: 'fire', chama: 'flame',
    montanha: 'mountain', onda: 'wave', gota: 'droplet', folha: 'leaf', cacto: 'cactus',
    cogumelo: 'mushroom', maca: 'apple', banana: 'banana', abacaxi: 'pineapple',
    cereja: 'cherry', morango: 'strawberry', pizza: 'pizza', hamburguer: 'burger',
    sorvete: 'ice-cream', bolo: 'cake', taca: 'wine', garrafa: 'bottle',
    caveira: 'skull', fantasma: 'ghost', diamante: 'diamond', trofeu: 'trophy',
    trovao: 'bolt', engrenagem: 'gear', iman: 'magnet', raio_x: 'dna', dna: 'dna'
  };

  const PT_STOPWORDS = new Set([
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
    'em', 'no', 'na', 'nos', 'nas', 'para', 'pra', 'por', 'com', 'sem', 'sobre',
    'desenhe', 'desenha', 'desenho', 'contorno', 'contornos', 'silhueta', 'forma',
    'faca', 'faz', 'quero', 'ver', 'mostrar', 'mostre', 'gere', 'gerar', 'criar',
    'mapa', 'fronteira', 'estilo', 'grande', 'pequeno', 'simples', 'bonito'
  ]);

  const OFFLINE_BRAZIL = [
    [-60.2, 5.2], [-51.5, 4.1], [-49.8, 0.2], [-44.5, -2.3], [-38.5, -3.7],
    [-34.8, -6.9], [-35.8, -9.8], [-38.5, -13.0], [-40.3, -20.3], [-42.0, -22.9],
    [-46.3, -23.9], [-48.5, -27.6], [-50.2, -30.1], [-53.4, -33.7], [-57.6, -30.2],
    [-54.6, -25.6], [-57.7, -21.0], [-58.1, -17.6], [-62.0, -16.3], [-65.3, -10.9],
    [-70.5, -11.0], [-73.8, -7.4], [-70.0, -4.2], [-66.8, 1.2], [-64.5, 4.0], [-60.2, 5.2]
  ];

  // ---- Curva suave do controle deslizante de círculos:
  // 0..0.50 cobre linearmente 1..30 (ajuste fino 1 a 1);
  // 0.50..1.00 acelera suavemente (C¹) até maxM.
  function sliderToM(rawVal) {
    const u = Math.max(0, Math.min(1, rawVal / MAX_SLIDER));
    if (maxM <= 60) return Math.max(1, Math.round(1 + (maxM - 1) * u));
    if (u <= 0.5) return Math.max(1, Math.min(30, Math.round(1 + 58 * u)));
    const s = (u - 0.5) * 2;
    return Math.min(maxM, Math.round(30 + 29 * s + (maxM - 59) * Math.pow(s, 2.2)));
  }

  function mToSlider(targetM) {
    const m = Math.max(1, Math.min(maxM, targetM));
    if (maxM <= 60) return Math.round(((m - 1) / Math.max(1, maxM - 1)) * MAX_SLIDER);
    if (m <= 30) return Math.round(((m - 1) / 58) * MAX_SLIDER);
    let lo = 0.5, hi = 1.0;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) * 0.5;
      const s = (mid - 0.5) * 2;
      const val = 30 + 29 * s + (maxM - 59) * Math.pow(s, 2.2);
      if (val < m) lo = mid; else hi = mid;
    }
    return Math.round(((lo + hi) * 0.5) * MAX_SLIDER);
  }

  function normalizeText(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractKeywords(prompt) {
    const clean = normalizeText(prompt);
    const words = clean.split(' ').filter(w => w.length > 1 && !PT_STOPWORDS.has(w));
    return { clean, words };
  }

  function resize() {
    if (!cv) return;
    const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    if (r.width < 10 || r.height < 10) return;
    W = r.width; H = r.height;
    cv.width = W * d; cv.height = H * d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    viewScale = 0.42 * Math.min(W, H);
  }

  // ---- Extrator de contorno a partir de SVG real via DOM SVGGeometryElement
  function sampleSvgString(svgMarkup) {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:200px;height:200px;visibility:hidden;pointer-events:none;';
    host.innerHTML = svgMarkup;
    document.body.appendChild(host);

    try {
      const svgEl = host.querySelector('svg');
      if (!svgEl) return null;
      const shapes = Array.from(svgEl.querySelectorAll('path, circle, rect, ellipse, polygon, polyline'));
      if (!shapes.length) return null;

      const subContours = [];
      for (const sh of shapes) {
        if (typeof sh.getTotalLength !== 'function') continue;
        const total = sh.getTotalLength();
        if (!Number.isFinite(total) || total < 2) continue;

        const samples = Math.min(1200, Math.max(120, Math.round(total * 3)));
        const raw = [];
        for (let i = 0; i <= samples; i++) {
          const pt = sh.getPointAtLength((i / samples) * total);
          if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
            raw.push({ x: pt.x, y: pt.y });
          }
        }
        if (raw.length < 4) continue;

        const steps = [];
        for (let i = 1; i < raw.length; i++) {
          steps.push(Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y));
        }
        const sortedSteps = steps.slice().sort((a, b) => a - b);
        const medianStep = sortedSteps[Math.floor(sortedSteps.length * 0.5)] || 1;
        const jumpThreshold = Math.max(medianStep * 6, total * 0.04);

        let cur = [raw[0]];
        for (let i = 1; i < raw.length; i++) {
          if (steps[i - 1] > jumpThreshold) {
            if (cur.length >= 6) subContours.push(cur);
            cur = [raw[i]];
          } else {
            cur.push(raw[i]);
          }
        }
        if (cur.length >= 6) subContours.push(cur);
      }

      if (!subContours.length) return null;

      // Escolhe o subcontorno de maior extensão espacial (silhueta principal externa)
      let best = subContours[0], bestScore = -1;
      for (const c of subContours) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, len = 0;
        for (let i = 0; i < c.length; i++) {
          if (c[i].x < minX) minX = c[i].x;
          if (c[i].x > maxX) maxX = c[i].x;
          if (c[i].y < minY) minY = c[i].y;
          if (c[i].y > maxY) maxY = c[i].y;
          if (i > 0) len += Math.hypot(c[i].x - c[i - 1].x, c[i].y - c[i - 1].y);
        }
        const areaDiag = Math.hypot(maxX - minX, maxY - minY);
        const score = areaDiag * 4 + len;
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }

      if (best.length < 6) return null;
      // Garante fechamento suave para DFT periódica
      const first = best[0], last = best[best.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) > 0.5) {
        best = best.concat([{ x: first.x, y: first.y }]);
      }
      return best;
    } finally {
      document.body.removeChild(host);
    }
  }

  function findLocalShape(prompt) {
    const { clean, words } = extractKeywords(prompt);
    // Busca exata ou parcial por palavras-chave
    for (const key of Object.keys(LOCAL_SVGS)) {
      const entry = LOCAL_SVGS[key];
      for (const alias of entry.aliases) {
        if (clean === alias || words.includes(alias)) {
          return entry;
        }
      }
    }
    return null;
  }

  async function searchIconifyContour(prompt) {
    const { clean, words } = extractKeywords(prompt);
    const searchTerms = [];

    for (const w of words) {
      if (PT_EN[w]) searchTerms.push(PT_EN[w]);
    }
    if (words.length) searchTerms.push(words.join(' '));
    if (clean && !searchTerms.includes(clean)) searchTerms.push(clean);

    // Conjuntos priorizados por silhuetas contínuas
    const prefixes = 'game-icons,fa6-solid,mdi,bi,tabler,ph';
    for (const term of searchTerms) {
      const url = `https://api.iconify.design/search?query=${encodeURIComponent(term)}&limit=8&prefixes=${prefixes}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.icons || !data.icons.length) continue;

      // Testa os 3 primeiros ícones até achar um com contorno vetorial robusto
      for (const iconId of data.icons.slice(0, 3)) {
        const [prefix, name] = iconId.split(':');
        if (!prefix || !name) continue;
        const svgRes = await fetch(`https://api.iconify.design/${prefix}/${name}.svg`);
        if (!svgRes.ok) continue;
        const svgText = await svgRes.text();
        const pts = sampleSvgString(svgText);
        if (pts && pts.length >= 12) {
          return { pts, source: `Silhueta SVG (${iconId})` };
        }
      }
    }
    return null;
  }

  // ---- Busca geográfica fallback (OpenStreetMap Nominatim)
  function ringArea(r) {
    let a = 0;
    for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
    return Math.abs(a / 2);
  }

  function largestRing(geo) {
    const rings = geo.type === 'Polygon' ? [geo.coordinates[0]] : geo.coordinates.map(p => p[0]);
    return rings.reduce((a, b) => ringArea(b) > ringArea(a) ? b : a);
  }

  function geoToPlane(ring) {
    const lon = [ring[0][0]];
    for (let i = 1; i < ring.length; i++) {
      let d = ring[i][0] - ring[i - 1][0];
      if (d > 180) d -= 360; else if (d < -180) d += 360;
      lon.push(lon[i - 1] + d);
    }
    const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const k = Math.cos(lat0 * Math.PI / 180);
    return ring.map((p, i) => ({ x: lon[i] * k, y: -p[1] }));
  }

  async function fetchGeographicBoundary(query) {
    const { clean, words } = extractKeywords(query);
    const candidates = [query.trim()];
    const stripped = words.join(' ');
    if (stripped && stripped !== clean) candidates.push(stripped);

    for (const qText of candidates) {
      const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&polygon_geojson=1&accept-language=pt-BR&q=' + encodeURIComponent(qText);
      const res = await fetch(url);
      if (!res.ok) continue;
      const list = await res.json();
      const hit = list.find(r => r.geojson && /Polygon/.test(r.geojson.type));
      if (hit) {
        return {
          pts: geoToPlane(largestRing(hit.geojson)),
          source: `Fronteira OpenStreetMap · ${hit.display_name}`
        };
      }
    }
    return null;
  }

  function applyContourPoints(rawPts, label, sourceText) {
    const pts = AEM.Math.normalizePts(AEM.Math.resamplePath(rawPts, N_PTS));
    outline = pts;
    coeffs = AEM.Math.dftComplex(pts);
    tPhase = 0;
    trace = [];
    maxM = Math.min(360, coeffs.length);
    M = Math.max(1, Math.min(M, maxM));
    $('m').value = mToSlider(M);
    $('mo').textContent = M;
    $('statusText').textContent = `“${label}” — ${sourceText} (${N_PTS} amostras fechadas · arraste Círculos a partir de 1).`;
  }

  async function resolveNaturalContour(prompt) {
    const text = (prompt || '').trim();
    if (!text) return;

    const st = $('statusText'), btn = $('go');
    $('contourFallbackWrap').innerHTML = '';
    btn.disabled = true;
    st.textContent = `Interpretando “${text}” em contorno vetorial…`;

    try {
      // 1) Se mencionar país/mapa explicitamente e for o Brasil offline fallback
      const { clean, words } = extractKeywords(text);
      const looksGeo = /\b(brasil|italia|japao|franca|chile|islandia|texas|rio de janeiro|sao paulo|mapa|pais|estado|cidade|continente|europa|africa|america)\b/.test(clean);

      // 2) Biblioteca local SVG (instantânea e offline)
      if (!looksGeo) {
        const local = findLocalShape(text);
        if (local) {
          const dStr = local.singleD || local.d;
          const pts = sampleSvgString(`<svg viewBox="0 0 100 100"><path d="${dStr}"/></svg>`);
          if (pts) {
            applyContourPoints(pts, local.label, 'Silhueta vetorial integrada');
            return;
          }
        }
      }

      // 3) Se parecer geográfico, tenta OpenStreetMap antes; caso contrário tenta Iconify SVG e depois OSM
      if (looksGeo) {
        st.textContent = `Buscando contorno geográfico para “${text}”…`;
        const geo = await fetchGeographicBoundary(text).catch(() => null);
        if (geo) {
          applyContourPoints(geo.pts, text, geo.source);
          return;
        }
      }

      st.textContent = `Buscando silhueta vetorial para “${text}”…`;
      const svgHit = await searchIconifyContour(text).catch(() => null);
      if (svgHit) {
        applyContourPoints(svgHit.pts, text, svgHit.source);
        return;
      }

      if (!looksGeo) {
        const geoFallback = await fetchGeographicBoundary(text).catch(() => null);
        if (geoFallback) {
          applyContourPoints(geoFallback.pts, text, geoFallback.source);
          return;
        }
      }

      // Se nenhuma API respondeu e existir Brasil como termo
      if (words.includes('brasil') || clean.includes('brasil')) {
        applyContourPoints(geoToPlane(OFFLINE_BRAZIL), 'Brasil', 'Contorno local offline');
        return;
      }

      throw new Error(`Não encontrei silhueta para “${text}”. Tente um substantivo simples (ex.: "um gato", "guitarra", "coruja", "Brasil").`);
    } catch (e) {
      st.textContent = e.message + ' ';
      const fb = document.createElement('button');
      fb.type = 'button';
      fb.className = 'btn surf btn-sm';
      fb.textContent = 'Carregar Gato (Offline)';
      fb.onclick = () => {
        $('q').value = 'Um gato sentado';
        const pts = sampleSvgString(`<svg viewBox="0 0 100 100"><path d="${LOCAL_SVGS.gato.d}"/></svg>`);
        if (pts) applyContourPoints(pts, 'Gato', 'Silhueta vetorial integrada');
      };
      $('contourFallbackWrap').appendChild(fb);
    } finally {
      btn.disabled = false;
    }
  }

  function init() {
    if (initialized) return;
    cv = $('cv');
    if (!cv) return;
    ctx = cv.getContext('2d');
    initialized = true;

    const sliderM = $('m');
    sliderM.min = 0;
    sliderM.max = MAX_SLIDER;
    sliderM.step = 1;
    sliderM.value = 0;
    M = 1;
    $('mo').textContent = '1';
    $('ol').checked = false;

    $('contourForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('q').value.trim();
      if (v) resolveNaturalContour(v);
    });

    sliderM.addEventListener('input', e => {
      const nextM = sliderToM(+e.target.value);
      if (nextM !== M) {
        M = nextM;
        trace = [];
      }
      $('mo').textContent = M;
    });

    $('sp').addEventListener('input', e => {
      speed = +e.target.value;
      $('spo').textContent = speed + 'x';
      trace = [];
    });

    const PRESETS = [
      'Borboleta',
      'Foguete espacial',
      'Coração',
      'Brasil',
      'Japão'
    ];
    PRESETS.forEach(text => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = text;
      b.onclick = () => { $('q').value = text; resolveNaturalContour(text); };
      $('chips').appendChild(b);
    });

    resize();
    resolveNaturalContour($('q').value || 'Borboleta');
  }

  function tick() {
    if (!initialized || !coeffs.length || W < 10) return;
    const { css, drawEpicycleScene } = AEM.Canvas;
    drawEpicycleScene(ctx, W, H, outline, coeffs, M, tPhase, trace, viewScale, $('ol').checked, $('ci').checked);

    const step = speed / 1200, maxLen = Math.ceil(1 / step);
    while (trace.length > maxLen) trace.shift();
    ctx.beginPath();
    trace.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y));
    ctx.strokeStyle = css('--trace');
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    if (trace.length) {
      const head = trace[trace.length - 1];
      ctx.beginPath();
      ctx.arc(head.x, head.y, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = css('--trace');
      ctx.fill();
    }
    tPhase = (tPhase + step) % 1;
  }

  return { init, resize, tick };
})();
