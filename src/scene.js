// Octonics x KNX reel. Every frame is a pure function of its index (no clocks, seeded randomness).
// All layout in a 1080x1920 world; S scales to preview size.
const W = 1080, H = 1920, FPS = 30;
const C = {
  bg0: '#0A0E14', bg1: '#101A27', white: '#F4F7FA', brand: '#0072BC', acc: '#4FA8E8',
  warm: [255, 184, 107], cool: [214, 228, 246],
};
let DEBUG = false, S = 1, TL = null, IMG = {}, canvas, ctx, roomC, roomX, tmpC, tmpX, fgC, fgX, noise = [];

// ---------- utils ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, u) => a + (b - a) * u;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eOut = u => 1 - Math.pow(1 - u, 3);
const eOutExpo = u => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u));
const eInOut = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const eBack = u => { const c = 1.4; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (c1, c2, u) => [0, 1, 2].map(i => Math.round(lerp(c1[i], c2[i], u)));
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const win = (t, a, b, fi = 0.25, fo = 0.2) => Math.min(eOut(prog(t, a, a + fi)), 1 - prog(t, b - fo, b));
const blur = px => `blur(${(px * S).toFixed(2)}px)`;
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function font(c, w, px, fam = 'Inter') { c.font = `${w} ${px}px ${fam}`; }

// ---------- scene timing (absolute output seconds; most derived from word marks) ----------
let M, CUE;
function buildCues() {
  M = TL.marks;
  CUE = {
    hookInsert: [1.95, 2.86],
    lightInsert: [M.lighting - 0.06, M.ac - 0.05],
    curtainInsert: [M.every - 0.3, M.single - 0.85],
    planFull: [24.45, 27.75],
    planToRoom: [27.75, 28.3],
    montage1: [M.smarter - 0.62, M.easy - 0.12],
    montage2: [M.comfortable - 0.32, 34.2],
    noCaps: [[M.twenty - 0.05, 10.3], [12.2, 12.8], [36.8, 40]],
  };
}
const inR = (t, r) => t >= r[0] && t < r[1];

// ---------- room (code-drawn architectural set) ----------
const CITY = (() => { const r = rng(7); return Array.from({ length: 140 }, () => ({ x: r(), y: r(), s: r(), w: r() < 0.55 })); })();
function drawRoom(c, p) {
  // p: {zoom, px, py, light 0..1, warm 0..1, curtain 0..1 (open), t}
  const L = p.light, warmC = mix(C.cool, C.warm, p.warm);
  c.save();
  c.fillStyle = '#07090D'; c.fillRect(0, 0, W, H);
  const layer = (depth, fn) => {
    c.save();
    c.translate(W / 2 + p.px * depth, H * 0.45 + p.py * depth);
    const z = 1 + (p.zoom - 1) * (0.5 + depth * 0.5);
    c.scale(z, z); c.translate(-W / 2, -H * 0.45); fn(); c.restore();
  };
  const wx0 = 590, wx1 = 1040, wy0 = 400, wy1 = 1520; // window
  // far: night view through window
  layer(0.35, () => {
    const g = c.createLinearGradient(0, wy0, 0, wy1);
    g.addColorStop(0, '#0A1424'); g.addColorStop(0.62, '#13233B'); g.addColorStop(1, '#1D2B40');
    c.fillStyle = g; c.fillRect(wx0 - 60, wy0, wx1 - wx0 + 120, wy1 - wy0);
    for (const d of CITY) {
      const x = wx0 - 40 + d.x * (wx1 - wx0 + 80), y = wy0 + 520 + d.y * 520, r = 2 + d.s * 5;
      const g2 = c.createRadialGradient(x, y, 0, x, y, r * 3);
      const col = d.w ? [255, 196, 120] : [150, 190, 255];
      g2.addColorStop(0, rgba(col, 0.55)); g2.addColorStop(1, rgba(col, 0));
      c.fillStyle = g2; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    }
    c.fillStyle = 'rgba(5,8,14,0.85)'; // distant skyline silhouettes
    const r2 = rng(11); let x = wx0 - 60;
    while (x < wx1 + 60) { const bw = 40 + r2() * 70, bh = 120 + r2() * 260; c.fillRect(x, wy1 - 300 - bh * 0.4, bw, bh); x += bw + 6; }
  });
  // mid: walls, ceiling, window frame, curtains
  layer(0.7, () => {
    // ceiling
    c.fillStyle = '#0B0F15'; c.fillRect(-200, -400, W + 400, wy0 - 20 + 400);
    // back wall
    const wg = c.createLinearGradient(0, wy0, 0, wy1);
    wg.addColorStop(0, '#151B24'); wg.addColorStop(1, '#0E131A');
    c.fillStyle = wg; c.fillRect(-200, wy0 - 20, wx0 + 200, wy1 - wy0 + 20);
    // fluted panels (lit from cove)
    for (let i = 0, x = 40; x < wx0 - 40; i++, x += 26) {
      const g = c.createLinearGradient(x, 0, x + 26, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.035)'); g.addColorStop(0.5, 'rgba(255,255,255,0.0)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
      c.fillStyle = g; c.fillRect(x, wy0, 26, wy1 - wy0);
    }
    // cove line + wall wash
    const cy = wy0 - 6;
    c.fillStyle = rgba(warmC, 0.9 * L); c.fillRect(-200, cy, W + 400, 5);
    const wash = c.createLinearGradient(0, cy, 0, cy + 650);
    wash.addColorStop(0, rgba(warmC, 0.22 * L)); wash.addColorStop(1, rgba(warmC, 0));
    c.fillStyle = wash; c.fillRect(-200, cy, wx0 + 200, 650);
    // downlight scallops
    for (const x of [150, 420]) {
      const g = c.createRadialGradient(x, cy + 40, 10, x, cy + 260, 330);
      g.addColorStop(0, rgba(warmC, 0.2 * L)); g.addColorStop(1, rgba(warmC, 0));
      c.fillStyle = g; c.fillRect(x - 340, cy, 680, 700);
      c.fillStyle = rgba(warmC, 0.9 * L); c.beginPath(); c.ellipse(x, cy - 30, 16, 5, 0, 0, Math.PI * 2); c.fill();
    }
    // artwork with picture light
    c.fillStyle = '#07090C'; c.fillRect(112, 812, 376, 296);
    const ag = c.createLinearGradient(120, 820, 480, 1100);
    ag.addColorStop(0, '#0F2742'); ag.addColorStop(0.55, '#1B3A5A'); ag.addColorStop(1, rgba(mix([60, 40, 30], C.warm, 0.4), 1));
    c.fillStyle = ag; c.fillRect(120, 820, 360, 280);
    c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 2; c.beginPath(); c.arc(250, 1000, 110, Math.PI, Math.PI * 1.9); c.stroke();
    const pl = c.createRadialGradient(300, 800, 10, 300, 900, 300);
    pl.addColorStop(0, rgba(warmC, 0.32 * L)); pl.addColorStop(1, rgba(warmC, 0));
    c.fillStyle = pl; c.fillRect(60, 760, 480, 420);
    c.fillStyle = '#20252C'; c.fillRect(200, 788, 200, 10);
    // floating console with LED underglow
    c.fillStyle = '#0C0F14'; c.fillRect(90, 1170, 420, 34);
    const lg = c.createLinearGradient(0, 1204, 0, 1330); lg.addColorStop(0, rgba(warmC, 0.5 * L)); lg.addColorStop(1, rgba(warmC, 0));
    c.fillStyle = lg; c.fillRect(100, 1204, 400, 126);
    c.fillStyle = rgba(warmC, 0.7 * L); c.fillRect(100, 1204, 400, 2);
    // window frame + mullions
    c.strokeStyle = '#05070A'; c.lineWidth = 14; c.strokeRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    c.lineWidth = 6; for (const x of [wx0 + 150, wx0 + 300]) { c.beginPath(); c.moveTo(x, wy0); c.lineTo(x, wy1); c.stroke(); }
    // sheer curtains: closed covers window, opens to the right
    const open = clamp(p.curtain), cw = (wx1 - wx0 + 40) * (1 - open) + 70;
    const cx0 = wx1 + 20 - cw;
    for (let i = 0; i < 24; i++) {
      const fx = cx0 + (i / 24) * cw, fw = cw / 24 + 2;
      const a = 0.12 + 0.07 * Math.sin(i * 1.7 + p.t * 0.6) + open * 0.05;
      const g = c.createLinearGradient(0, wy0, 0, wy1);
      g.addColorStop(0, rgba(warmC, a * (0.6 + 0.6 * L))); g.addColorStop(1, rgba([200, 210, 225], a * 0.6));
      c.fillStyle = g; c.fillRect(fx, wy0 - 10, fw, wy1 - wy0 + 20);
    }
    c.fillStyle = '#04060A'; c.fillRect(wx0 - 30, wy0 - 22, wx1 - wx0 + 100, 14); // curtain track
  });
  // near: floor, sofa, pendant
  layer(1.0, () => {
    const fy = 1520;
    const fg = c.createLinearGradient(0, fy, 0, H + 300);
    fg.addColorStop(0, '#0D1117'); fg.addColorStop(1, '#06080B');
    c.fillStyle = fg; c.fillRect(-200, fy, W + 400, H + 400 - fy);
    // floor reflection of window + warm glow
    const rg = c.createLinearGradient(0, fy, 0, fy + 380);
    rg.addColorStop(0, 'rgba(70,100,150,0.18)'); rg.addColorStop(1, 'rgba(70,100,150,0)');
    c.fillStyle = rg; c.fillRect(wx0, fy, wx1 - wx0, 380);
    // sofa
    c.fillStyle = '#161B22'; rr(c, 30, 1300, 640, 230, 26); c.fill();
    c.fillStyle = '#1C222B'; rr(c, 30, 1240, 640, 110, 30); c.fill();
    c.fillStyle = rgba(warmC, 0.12 * L); rr(c, 40, 1242, 620, 8, 4); c.fill();
    for (const x of [70, 270, 470]) { c.fillStyle = '#20262F'; rr(c, x, 1270, 180, 120, 22); c.fill(); }
    // coffee table
    c.fillStyle = '#0F1318'; rr(c, 220, 1560, 380, 40, 10); c.fill();
    c.fillStyle = rgba(warmC, 0.08 * L); c.fillRect(230, 1560, 360, 3);
    // pendant
    c.strokeStyle = 'rgba(180,180,190,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(330, -200); c.lineTo(330, 690); c.stroke();
    const pg = c.createRadialGradient(330, 720, 4, 330, 720, 260);
    pg.addColorStop(0, rgba(warmC, 0.95 * L)); pg.addColorStop(0.12, rgba(warmC, 0.55 * L)); pg.addColorStop(1, rgba(warmC, 0));
    c.fillStyle = pg; c.fillRect(70, 460, 520, 520);
    c.fillStyle = rgba(mix(warmC, [255, 255, 255], 0.5), 0.95 * Math.max(L, 0.08)); c.beginPath(); c.arc(330, 720, 30, 0, Math.PI * 2); c.fill();
  });
  // foreground plant silhouette (depth)
  layer(1.35, () => {
    const r = rng(23); c.fillStyle = '#030405';
    for (let i = 0; i < 16; i++) {
      const bx = -40 + r() * 170, by = 1180 + r() * 420, ang = -1.9 + r() * 1.5, len = 160 + r() * 200;
      c.save(); c.translate(bx, by + 300); c.rotate(ang + 0.03 * Math.sin(p.t * 0.8 + i));
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, -38, len, 0); c.quadraticCurveTo(len * 0.5, 38, 0, 0); c.fill(); c.restore();
    }
  });
  // overall exposure
  c.fillStyle = `rgba(4,6,10,${0.45 * (1 - L)})`; c.fillRect(0, 0, W, H);
  c.restore();
}

// ---------- presenter ----------
function drawPresenter(c, img, mode, t, seg) {
  if (!img) return;
  const sw = img.naturalWidth, sh = img.naturalHeight;
  if (mode === 'matte') {
    // separation shadow
    fgX.clearRect(0, 0, W, H); fgX.drawImage(img, 0, 0, W, H);
    fgX.globalCompositeOperation = 'source-in'; fgX.fillStyle = '#000'; fgX.fillRect(0, 0, W, H);
    fgX.globalCompositeOperation = 'source-over';
    c.save(); c.globalAlpha = 0.55; c.filter = blur(40); c.drawImage(fgC, 18, 26); c.restore();
  }
  c.drawImage(img, 0, 0, sw, sh, 0, 0, W, H);
}

// ---------- glass + UI ----------
function glass(c, x, y, w, h, r, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0) return;
  c.save(); c.globalAlpha = a;
  // shadow
  c.save(); c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 40 * S; c.shadowOffsetY = 18 * S;
  rr(c, x, y, w, h, r); c.fillStyle = 'rgba(10,14,20,0.01)'; c.fill(); c.restore();
  // backdrop blur
  c.save(); rr(c, x, y, w, h, r); c.clip();
  c.filter = blur(26); c.drawImage(canvas, (x - 30) * S, (y - 30) * S, (w + 60) * S, (h + 60) * S, x - 30, y - 30, w + 60, h + 60);
  c.filter = 'none';
  const g = c.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, `rgba(255,255,255,${o.light ? 0.9 : 0.16})`); g.addColorStop(1, `rgba(255,255,255,${o.light ? 0.82 : 0.06})`);
  if (o.dark) { c.fillStyle = 'rgba(8,12,18,0.62)'; c.fillRect(x, y, w, h); }
  c.fillStyle = g; c.fillRect(x, y, w, h);
  // top sheen
  const sh = c.createLinearGradient(0, y, 0, y + h * 0.5);
  sh.addColorStop(0, 'rgba(255,255,255,0.10)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = sh; c.fillRect(x, y, w, h * 0.5);
  c.restore();
  rr(c, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r); c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1.5; c.stroke();
  c.restore();
}
function icon(c, kind, x, y, s, col, a = 1) {
  c.save(); c.translate(x, y); c.scale(s / 48, s / 48); c.globalAlpha *= a;
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath();
  if (kind === 'bulb') { c.arc(24, 19, 12, Math.PI * 0.8, Math.PI * 2.2); c.lineTo(30, 34); c.lineTo(18, 34); c.closePath(); c.moveTo(19, 39); c.lineTo(29, 39); c.moveTo(21, 44); c.lineTo(27, 44); }
  if (kind === 'climate') { c.moveTo(24, 6); c.lineTo(24, 42); c.moveTo(8, 15); c.lineTo(40, 33); c.moveTo(8, 33); c.lineTo(40, 15); c.moveTo(19, 9); c.lineTo(24, 14); c.lineTo(29, 9); c.moveTo(19, 39); c.lineTo(24, 34); c.lineTo(29, 39); }
  if (kind === 'curtain') { c.moveTo(4, 6); c.lineTo(44, 6); for (const xx of [8, 14, 20]) { c.moveTo(xx, 6); c.quadraticCurveTo(xx + 3, 26, xx - 2, 44); } for (const xx of [40, 34, 28]) { c.moveTo(xx, 6); c.quadraticCurveTo(xx - 3, 26, xx + 2, 44); } }
  if (kind === 'home') { c.moveTo(6, 22); c.lineTo(24, 7); c.lineTo(42, 22); c.moveTo(11, 19); c.lineTo(11, 42); c.lineTo(37, 42); c.lineTo(37, 19); c.moveTo(20, 42); c.lineTo(20, 30); c.lineTo(28, 30); c.lineTo(28, 42); }
  if (kind === 'mic') { c.roundRect(17, 5, 14, 24, 7); c.moveTo(10, 22); c.quadraticCurveTo(10, 36, 24, 36); c.quadraticCurveTo(38, 36, 38, 22); c.moveTo(24, 36); c.lineTo(24, 44); }
  c.stroke(); c.restore();
}
function toggle(c, x, y, on, a = 1) {
  c.save(); c.globalAlpha *= a;
  rr(c, x, y, 64, 36, 18); c.fillStyle = on ? C.brand : 'rgba(255,255,255,0.18)'; c.fill();
  c.beginPath(); c.arc(x + (on ? 46 : 18), y + 18, 13, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); c.restore();
}
function featureCard(c, x, y, w, h, kind, title, value, level, a, sc = 1) {
  if (a <= 0) return;
  c.save(); c.translate(x + w / 2, y + h / 2); c.scale(sc, sc); c.translate(-w / 2, -h / 2);
  glass(c, 0, 0, w, h, 26, { alpha: a, dark: true });
  c.globalAlpha = a;
  rr(c, 18, 20, 52, 52, 16); c.fillStyle = 'rgba(0,114,188,0.45)'; c.fill();
  icon(c, kind, 24, 26, 40, C.white);
  font(c, 600, 21); c.letterSpacing = '1px'; c.fillStyle = 'rgba(244,247,250,0.72)'; c.fillText(title, 84, 42);
  font(c, 800, 30); c.letterSpacing = '0px'; c.fillStyle = C.white; c.fillText(value, 84, 76);
  if (level != null) {
    rr(c, 18, h - 32, w - 36, 9, 4.5); c.fillStyle = 'rgba(255,255,255,0.14)'; c.fill();
    rr(c, 18, h - 32, Math.max(9, (w - 36) * level), 9, 4.5);
    const g = c.createLinearGradient(18, 0, w - 18, 0); g.addColorStop(0, C.brand); g.addColorStop(1, C.acc);
    c.fillStyle = g; c.fill();
  }
  c.restore();
}

// ---------- face-aware placement ----------
const PLACE = {};
function faceUnion(t0, t1) {
  let b = null;
  for (let i = Math.max(0, Math.floor(t0 * FPS)); i <= Math.min(TL.n - 1, Math.ceil(t1 * FPS)); i++) {
    const f = TL.frames[i].fbox; if (!f) continue;
    b = b ? [Math.min(b[0], f[0]), Math.min(b[1], f[1]), Math.max(b[2], f[2]), Math.max(b[3], f[3])] : f.slice();
  }
  return b;
}
const overlaps = (r, b, m = 26) => b && r.x < b[2] + m && r.x + r.w > b[0] - m && r.y < b[3] + m && r.y + r.h > b[1] - m;
// first candidate that keeps clear of the face (and inside the Instagram safe area) wins
function place(key, w, h, t0, t1, cands, maxY = 1500) {
  if (PLACE[key]) return PLACE[key];
  const b = faceUnion(t0, t1);
  for (const cf of cands) {
    const [x, y] = cf(b), r = { x, y, w, h };
    if (y < 230 || y + h > maxY || x < 30 || x + w > 1050) continue;
    if (!overlaps(r, b)) return (PLACE[key] = r);
  }
  console.error('place fallback', key, JSON.stringify(b));
  return (PLACE[key] = { x: W / 2 - w / 2, y: b ? Math.min(b[3] + 30, maxY - h) : 1100, w, h });
}
const below = (w, gap = 34) => b => [W / 2 - w / 2, b[3] + gap];
const above = (h, gap = 30) => b => [W / 2 - 0, b[1] - h - gap];
const rightOf = (gap = 30, y = 380) => b => [b[2] + gap, y];
const leftOf = (w, gap = 30, y = 380) => b => [b[0] - gap - w, y];

// ---------- captions: bold sans + serif italic accents ----------
const KEY = new Set(['dream', 'home?', 'smart', 'smart?', 'alexa', 'light', 'intelligent', 'knx', 'truly', 'phone', 'advanced', 'lighting',
  'ac', 'curtains', 'single', 'simple', 'application', 'electrical', 'wiring', 'planning', 'day', 'one', 'smarter', 'easy', 'comfortable', 'octonics']);
const SANS = 62, SERIF = 104;
const clean = s => s.replace(/[.,]+$/, '');
let CAPS = null;
function prepCaptions(c) {
  CAPS = TL.captions.map((g, gi) => {
    const words = g.words.map(w => {
      const txt = clean(w.w), k = KEY.has(txt.toLowerCase());
      c.font = k ? `italic 400 ${SERIF}px "Instrument Serif"` : `800 ${SANS}px Inter`;
      c.letterSpacing = k ? '0px' : '-1px';
      return { ...w, txt, k, wd: c.measureText(txt).width };
    });
    const sp = 18, maxW = 900;
    // greedy wrap, then balance into at most 2 lines
    const total = words.reduce((s, w) => s + w.wd, 0) + sp * (words.length - 1);
    let lines = [words];
    if (total > maxW && words.length > 1) {
      let best = null;
      for (let k = 1; k < words.length; k++) {
        const a = words.slice(0, k), b2 = words.slice(k);
        const wa = a.reduce((s, w) => s + w.wd, 0) + sp * (a.length - 1), wb = b2.reduce((s, w) => s + w.wd, 0) + sp * (b2.length - 1);
        const sc = Math.max(wa, wb); if (!best || sc < best.sc) best = { sc, l: [a, b2] };
      }
      lines = best.l;
    }
    const L = lines.map(l => ({ words: l, w: l.reduce((s, w) => s + w.wd, 0) + sp * (l.length - 1), h: l.some(w => w.k) ? SERIF * 0.92 : SANS * 1.05 }));
    const blockH = L.reduce((s, l) => s + l.h, 0) + 8 * (L.length - 1);
    const fit = Math.min(1, 940 / Math.max(...L.map(l => l.w)));
    return { ...g, lines: L, blockH, fit, sp, gi };
  });
}
function captions(c, t) {
  for (const r of CUE.noCaps) if (t >= r[0] && t < r[1]) return;
  const g = CAPS.find(g => t >= g.t0 - 0.05 && t < g.t1 + 0.32); if (!g) return;
  const gs = TL.segments.find(s => s.id === g.words[0].seg); if (t >= gs.out[1]) return;
  const out = 1 - eOut(prog(t, g.t1 + 0.18, g.t1 + 0.32));
  // keep the whole block below the face for the group's duration
  const b = faceUnion(g.t0, g.t1 + 0.3);
  let sc = g.fit, bottom = 1488;
  if (b) { const room = bottom - (b[3] + 22); if (g.blockH * sc > room) sc = Math.max(0.62, room / g.blockH); }
  const top = bottom - g.blockH * sc;
  c.save(); c.textBaseline = 'alphabetic';
  // soft dark backing for legibility
  c.save(); c.globalAlpha = 0.55 * out * clamp(prog(t, g.t0 - 0.05, g.t0 + 0.1));
  const bg = c.createRadialGradient(W / 2, top + g.blockH * sc / 2, 10, W / 2, top + g.blockH * sc / 2, 560);
  bg.addColorStop(0, 'rgba(5,8,13,0.7)'); bg.addColorStop(1, 'rgba(5,8,13,0)'); c.fillStyle = bg; c.fillRect(0, top - 160, W, g.blockH * sc + 320); c.restore();
  let y = top;
  g.lines.forEach(line => {
    y += line.h * sc; let x = W / 2 - line.w * sc / 2;
    for (const w of line.words) {
      const u = prog(t, w.t0 - 0.05, w.t0 + 0.2);
      if (u > 0) {
        const active = t >= w.t0 - 0.02 && t < w.t1 + 0.06 && !w.k;
        c.save(); c.globalAlpha = out * clamp(u * 1.6);
        if (w.k) {
          const e = eOutExpo(u);
          c.translate(x + w.wd * sc / 2, y + (1 - e) * 36 * sc); c.scale(sc, sc);
          c.filter = blur((1 - e) * 10);
          c.font = `italic 400 ${SERIF}px "Instrument Serif"`; c.letterSpacing = '0px';
          const gr = c.createLinearGradient(0, -SERIF * 0.8, 0, 0); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, '#9FD2FF');
          c.shadowColor = 'rgba(79,168,232,0.55)'; c.shadowBlur = 26 * S;
          c.fillStyle = gr; c.textAlign = 'center'; c.fillText(w.txt, 0, 0);
        } else {
          const e = eBack(clamp(u * 1.15));
          c.translate(x + w.wd * sc / 2, y - SANS * 0.35 * sc); c.scale(sc * lerp(0.6, 1, e), sc * lerp(0.6, 1, e)); c.translate(0, SANS * 0.35);
          c.filter = blur((1 - clamp(u * 1.3)) * 8);
          c.font = `800 ${SANS}px Inter`; c.letterSpacing = '-1px'; c.textAlign = 'center';
          if (active) { // brand-blue word box on the spoken word
            const pa = eOut(prog(t, w.t0 - 0.02, w.t0 + 0.08));
            rr(c, -w.wd / 2 - 14, -SANS * 0.86, w.wd + 28, SANS * 1.12, 16); c.fillStyle = `rgba(0,114,188,${0.95 * pa})`; c.fill();
          }
          c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 14 * S; c.shadowOffsetY = 3 * S;
          c.fillStyle = C.white; c.fillText(w.txt, 0, 0);
        }
        c.restore();
      }
      x += (w.wd + g.sp) * sc;
    }
    y += 8 * sc;
  });
  c.restore();
}

// ---------- scene pieces (no top titles; everything clears the face) ----------
function alexa(c, t) {
  const t0 = M.hey_alexa - 0.1, t1 = 7.53, a = win(t, t0, t1, 0.3, 0.15);
  if (a > 0) {
    const r = place('alexa', 300, 104, t0, t1, [b => [W / 2 - 150, b[1] - 134], b => [W / 2 - 150, b[3] + 30], leftOf(300, 24, 300), rightOf(24, 300)], 1290);
    glass(c, r.x, r.y, r.w, r.h, 52, { alpha: a, dark: true });
    c.save(); c.globalAlpha = a;
    const cx = r.x + 60, cy = r.y + r.h / 2;
    for (let i = 0; i < 3; i++) { const ph = ((t * 1.2 + i / 3) % 1); c.beginPath(); c.arc(cx, cy, 26 + ph * 24, 0, Math.PI * 2); c.strokeStyle = `rgba(79,168,232,${0.5 * (1 - ph)})`; c.lineWidth = 2; c.stroke(); }
    c.beginPath(); c.arc(cx, cy, 26, 0, Math.PI * 2); c.fillStyle = C.brand; c.fill();
    icon(c, 'mic', cx - 18, cy - 18, 36, '#fff');
    for (let i = 0; i < 12; i++) { const hh = 8 + 34 * Math.abs(Math.sin(t * 9 + i * 1.3)) * (t < M.light + 0.3 ? 1 : 0.18); c.fillStyle = i % 2 ? C.acc : '#fff'; rr(c, r.x + 116 + i * 14, cy - hh / 2, 6, hh, 3); c.fill(); }
    c.restore();
  }
  const d0 = M.twenty - 0.12, d1 = 10.25, d = win(t, d0, d1, 0.3, 0.25);
  if (d > 0) {
    const r = place('dimmer', 480, 236, d0, d1, [below(480, 30), b => [W / 2 - 240, b[1] - 266], leftOf(480), rightOf()]);
    const lv = lerp(1, 0.2, eInOut(prog(t, M.twenty, M.twenty + 0.75)));
    c.save(); c.translate(r.x + r.w / 2, r.y + r.h / 2); const sc = lerp(0.9, 1, eBack(prog(t, d0, M.twenty + 0.25))); c.scale(sc, sc); c.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    glass(c, r.x, r.y, r.w, r.h, 34, { alpha: d, dark: true });
    c.globalAlpha = d;
    icon(c, 'bulb', r.x + 28, r.y + 26, 40, `rgb(${mix([214, 228, 246], C.warm, prog(t, 8.5, 10)).join(',')})`);
    font(c, 600, 24); c.fillStyle = 'rgba(244,247,250,0.75)'; c.fillText('LIVING ROOM LIGHTS', r.x + 82, r.y + 56);
    font(c, 800, 118); c.fillStyle = C.white; c.letterSpacing = '-3px'; c.fillText(`${Math.round(lv * 100)}%`, r.x + 28, r.y + 178);
    rr(c, r.x + 28, r.y + 200, r.w - 56, 12, 6); c.fillStyle = 'rgba(255,255,255,0.14)'; c.fill();
    rr(c, r.x + 28, r.y + 200, (r.w - 56) * lv, 12, 6); const g = c.createLinearGradient(r.x, 0, r.x + r.w, 0); g.addColorStop(0, rgba(C.warm, 1)); g.addColorStop(1, '#FFE2B8'); c.fillStyle = g; c.fill();
    const lk = eBack(prog(t, M.twenty + 0.78, M.twenty + 1.05));
    if (lk > 0) { c.save(); c.translate(r.x + r.w - 56, r.y + 54); c.scale(lk, lk); c.beginPath(); c.arc(0, 0, 24, 0, Math.PI * 2); c.fillStyle = C.brand; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.moveTo(-10, 1); c.lineTo(-3, 8); c.lineTo(11, -7); c.stroke(); c.restore(); }
    c.restore();
  }
}
function knxLockup(c, t) {
  const t0 = M.knx - 0.45, t1 = 12.8, a = win(t, t0, t1, 0.3, 0.12); if (a <= 0 || !IMG.knx) return;
  const r = place('knx', 380, 170, t0, t1, [below(380, 26), b => [W / 2 - 190, b[1] - 200], leftOf(380, 24, 300), rightOf(24, 300)], 1300);
  const u = eOutExpo(prog(t, t0, t0 + 0.55));
  c.save(); c.globalAlpha = a; c.translate(r.x + r.w / 2, r.y + r.h / 2 + (1 - u) * 30); c.scale(lerp(0.92, 1, u), lerp(0.92, 1, u));
  c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 40 * S; c.shadowOffsetY = 14 * S;
  rr(c, -r.w / 2, -r.h / 2, r.w, r.h, 28); c.fillStyle = '#FFFFFF'; c.fill(); c.shadowColor = 'transparent';
  const lw = r.w - 90, lh = lw * IMG.knx.naturalHeight / IMG.knx.naturalWidth;
  c.drawImage(IMG.knx, -lw / 2, -lh / 2, lw, lh); c.restore();
}
function phoneUI(c, t) {
  const t0 = M.not_just - 0.1, t1 = 16.84, a = win(t, t0, t1, 0.4, 0.25); if (a <= 0) return;
  const r = place('phone', 300, 600, t0, t1, [rightOf(26, 330), leftOf(300, 26, 330), rightOf(26, 260)], 1290);
  const u = eOutExpo(prog(t, t0, t0 + 0.7)), pw = r.w, ph = r.h, s = pw / 360;
  c.save(); c.translate(r.x + pw / 2 + (1 - u) * 220, r.y + ph / 2); c.rotate(-0.05 * (1 - u)); c.translate(-pw / 2, -ph / 2);
  glass(c, 0, 0, pw, ph, 48, { alpha: a });
  c.globalAlpha = a; c.scale(s, s);
  rr(c, 14, 14, 332, ph / s - 28, 40); c.fillStyle = 'rgba(8,12,18,0.74)'; c.fill();
  rr(c, 130, 26, 100, 22, 11); c.fillStyle = '#000'; c.fill();
  font(c, 700, 32); c.fillStyle = C.white; c.fillText('Home', 40, 108);
  font(c, 500, 22); c.fillStyle = 'rgba(244,247,250,0.6)'; c.fillText('Living room', 40, 140);
  [['bulb', 'Lights', true], ['climate', 'Climate', true], ['curtain', 'Curtains', false], ['home', 'Scenes', true]].forEach(([k, n, on], i) => {
    const ry = 176 + i * 122, ra = eOut(prog(t, t0 + 0.35 + i * 0.08, t0 + 0.7 + i * 0.08));
    c.save(); c.globalAlpha = a * ra; rr(c, 30, ry, 300, 104, 22); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fill();
    icon(c, k, 46, ry + 30, 44, C.white); font(c, 600, 28); c.fillStyle = C.white; c.fillText(n, 108, ry + 62);
    toggle(c, 248, ry + 34, on); c.restore();
  });
  c.restore();
}
function sideColumn(t0, t1, h) {
  const key = 'col_' + t0.toFixed(2); if (PLACE[key]) return PLACE[key];
  const b = faceUnion(t0, t1), y = 360, m = 24;
  let x = b[2] + m, w = Math.min(300, 1048 - x);
  if (w < 230) { w = Math.min(300, b[0] - m - 30); x = b[0] - m - w; }
  if (w < 230) { console.error('column fallback', key); w = 260; x = 1048 - w; }
  return (PLACE[key] = { x, y, w, h });
}
function featureCards(c, t) {
  const cards = [
    { k: 'bulb', n: 'LIGHTING', v: 'Warm 40%', lvl: 0.4, t0: M.ac - 0.05 },
    { k: 'climate', n: 'CLIMATE', v: '22°C Cool', lvl: 0.55, t0: M.ac + 0.05 },
    { k: 'curtain', n: 'CURTAINS', v: 'Open 100%', lvl: 1, t0: M.curtains - 0.05 },
  ];
  const e0 = CUE.curtainInsert[0];
  if (t >= cards[0].t0 && t < e0) {
    const col = sideColumn(cards[0].t0, e0, 3 * 136 + 2 * 22);
    cards.forEach((cd, i) => {
      const u = eBack(prog(t, cd.t0, cd.t0 + 0.4)), a = clamp(prog(t, cd.t0, cd.t0 + 0.2)) * (1 - prog(t, e0 - 0.12, e0));
      featureCard(c, col.x, col.y + i * 158, col.w, 136, cd.k, cd.n, cd.v, cd.lvl, a, lerp(0.85, 1, u));
    });
  }
  const u0 = CUE.curtainInsert[1], u1 = 23.57, ua = win(t, u0, u1, 0.3, 0.12);
  if (ua > 0) {
    const col = sideColumn(u0, u1, 470), u = eOutExpo(prog(t, u0, u0 + 0.6));
    glass(c, col.x, col.y, col.w, col.h, 34, { alpha: ua * u });
    c.save(); c.globalAlpha = ua;
    const ha = eOut(prog(t, M.single - 0.2, M.single + 0.2));
    icon(c, 'home', col.x + 24, col.y + 26, 42, C.acc);
    c.globalAlpha = ua * Math.max(ha, u); font(c, 800, 30); c.fillStyle = C.white; c.fillText('ONE APP', col.x + 80, col.y + 58);
    cards.forEach((cd, i) => {
      const uu = eOut(prog(t, u0 + 0.1 + i * 0.08, u0 + 0.45 + i * 0.08)); if (uu <= 0) return;
      const x = col.x + 18, y = col.y + 100 + i * 118 + (1 - uu) * 30, w = col.w - 36, h = 100;
      c.globalAlpha = ua * uu; rr(c, x, y, w, h, 20); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 1.2; c.stroke();
      icon(c, cd.k, x + 16, y + 28, 40, C.white);
      font(c, 700, 23); c.fillStyle = C.white; c.fillText(cd.n, x + 68, y + 46);
      font(c, 500, 20); c.fillStyle = 'rgba(244,247,250,0.7)'; c.fillText(cd.v, x + 68, y + 76);
      if (w >= 260) toggle(c, x + w - 76, y + 32, true);
    });
    c.restore();
  }
}

function floorPlan(c, t, a) {
  const [t0] = CUE.planFull; const lt = t - t0;
  c.save(); c.globalAlpha = a;
  c.fillStyle = '#081019'; c.fillRect(0, 0, W, H);
  // grid
  c.strokeStyle = 'rgba(79,168,232,0.07)'; c.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y <= H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  const z = lerp(1.0, 1.08, prog(t, t0, CUE.planFull[1]));
  c.translate(W / 2, 1000); c.scale(z, z); c.translate(-W / 2, -1000 - 150);
  // walls (draw-on)
  const walls = [[140, 620, 940, 620], [940, 620, 940, 1420], [940, 1420, 140, 1420], [140, 1420, 140, 620],
    [560, 620, 560, 1000], [560, 1100, 560, 1420], [140, 1020, 420, 1020], [560, 1020, 940, 1020]];
  const total = walls.length, dp = prog(lt, 0.05, 1.4);
  c.strokeStyle = 'rgba(244,247,250,0.85)'; c.lineWidth = 6; c.lineCap = 'square';
  walls.forEach((w, i) => { const u = clamp(dp * total - i); if (u <= 0) return; c.beginPath(); c.moveTo(w[0], w[1]); c.lineTo(lerp(w[0], w[2], u), lerp(w[1], w[3], u)); c.stroke(); });
  // windows
  c.strokeStyle = 'rgba(79,168,232,0.8)'; c.lineWidth = 3; c.globalAlpha = a * prog(lt, 1.2, 1.6);
  c.beginPath(); c.moveTo(640, 1420); c.lineTo(880, 1420); c.moveTo(940, 700); c.lineTo(940, 920); c.stroke();
  c.globalAlpha = a;
  font(c, 500, 22); c.fillStyle = 'rgba(244,247,250,0.45)'; c.letterSpacing = '3px';
  c.globalAlpha = a * prog(lt, 1.0, 1.4);
  c.fillText('LIVING', 600, 1390); c.fillText('BEDROOM', 175, 670); c.fillText('KITCHEN', 600, 670); c.fillText('STUDY', 175, 1390);
  c.save(); c.globalAlpha = a * prog(lt, 0.2, 0.6); font(c, 600, 20); c.letterSpacing = '4px'; c.fillStyle = 'rgba(244,247,250,0.5)';
  c.fillText('CONCEPT ILLUSTRATION', 140, 596); c.restore();
  // control points pop in
  const pts = [[330, 760, 'bulb'], [760, 1240, 'bulb'], [760, 760, 'climate'], [910, 1300, 'curtain'], [300, 1200, 'bulb'], [600, 1060, 'home'], [460, 900, 'climate']];
  pts.forEach(([x, y, k], i) => {
    const u = eBack(prog(lt, 1.5 + i * 0.13, 1.85 + i * 0.13)); if (u <= 0) return;
    c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(u, u);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 70); g.addColorStop(0, 'rgba(0,114,188,0.55)'); g.addColorStop(1, 'rgba(0,114,188,0)');
    c.fillStyle = g; c.fillRect(-70, -70, 140, 140);
    c.beginPath(); c.arc(0, 0, 28, 0, Math.PI * 2); c.fillStyle = C.brand; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.stroke();
    icon(c, k, -16, -16, 32, '#fff'); c.restore();
  });
  // bus line linking points (one cable concept)
  const bl = prog(lt, 2.4, 3.1);
  if (bl > 0) {
    c.save(); c.globalAlpha = a * 0.9; c.strokeStyle = C.acc; c.lineWidth = 3; c.setLineDash([14, 10]); c.lineDashOffset = -lt * 40;
    c.beginPath(); const order = [0, 6, 2, 5, 4, 1, 3];
    order.forEach((k, i) => { const p = pts[k]; if (i === 0) c.moveTo(p[0], p[1]); else if (i / (order.length - 1) <= bl) c.lineTo(p[0], p[1]); });
    c.stroke(); c.restore();
  }
  c.restore();

}
function endCard(c, t) {
  const lt = t - M.end;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0A0E14'); g.addColorStop(0.55, '#0E1724'); g.addColorStop(1, '#070A0F');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // slow architectural light sweep
  const sx = lerp(-500, W + 500, prog(lt, 0, 2.5));
  c.save(); c.globalCompositeOperation = 'screen'; c.translate(sx, H / 2); c.rotate(-0.35);
  const sg = c.createLinearGradient(-220, 0, 220, 0); sg.addColorStop(0, 'rgba(0,114,188,0)'); sg.addColorStop(0.5, 'rgba(0,114,188,0.16)'); sg.addColorStop(1, 'rgba(0,114,188,0)');
  c.fillStyle = sg; c.fillRect(-220, -1400, 440, 2800); c.restore();
  // fine vertical lines (architectural)
  c.strokeStyle = 'rgba(255,255,255,0.035)'; c.lineWidth = 1; for (let x = 60; x < W; x += 120) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  const u = eOutExpo(prog(lt, 0.05, 0.9));
  if (IMG.wordmark) {
    const lw = 780, lh = lw * IMG.wordmark.naturalHeight / IMG.wordmark.naturalWidth;
    c.save(); c.globalAlpha = u; c.filter = blur((1 - u) * 14); c.translate(W / 2, 880); c.scale(lerp(1.06, 1, u), lerp(1.06, 1, u));
    c.drawImage(IMG.wordmark, -lw / 2, -lh / 2, lw, lh); c.restore();
  }
  const u2 = eOut(prog(lt, 0.55, 1.1));
  c.save(); c.globalAlpha = u2; c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(W / 2 - 120 * u2, 1080); c.lineTo(W / 2 + 120 * u2, 1080); c.stroke(); c.restore();
  if (IMG.knx) {
    const kw = 230, kh = kw * IMG.knx.naturalHeight / IMG.knx.naturalWidth;
    // KNX artwork sits on a light chip so its grey letterforms stay legible
    const cx = W / 2 - (kw + 56) / 2, cy = 1150;
    c.save(); c.globalAlpha = u2; rr(c, cx, cy, kw + 56, kh + 40, 20); c.fillStyle = 'rgba(244,247,250,0.94)'; c.fill();
    c.drawImage(IMG.knx, W / 2 - kw / 2, cy + 20, kw, kh); c.restore();
  }
}
function finish(c, t, frame) {
  // bottom fade (also hides chair edges) + vignette + grain
  if (frame.mode !== 'card') {
    const bg = c.createLinearGradient(0, 1380, 0, H); bg.addColorStop(0, 'rgba(7,9,13,0)'); bg.addColorStop(1, 'rgba(7,9,13,0.92)');
    c.fillStyle = bg; c.fillRect(0, 1380, W, H - 1380);
  }
  const v = c.createRadialGradient(W / 2, H * 0.42, H * 0.3, W / 2, H * 0.5, H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.42)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  const n = noise[frame.idx % noise.length];
  c.save(); c.globalAlpha = 0.07; c.globalCompositeOperation = 'overlay';
  c.fillStyle = c.createPattern(n, 'repeat'); c.setTransform(S * 2, 0, 0, S * 2, 0, 0); c.fillRect(0, 0, W / 2, H / 2); c.restore();
}

// ---------- room state for a time ----------
function roomState(t) {
  const st = { zoom: 1.0, px: 0, py: 0, light: 0.85, warm: 0.75, curtain: 0.15, t };
  if (inR(t, CUE.hookInsert)) { const u = prog(t, ...CUE.hookInsert); Object.assign(st, { zoom: lerp(1.05, 1.16, u), px: lerp(30, -10, u), light: 0.95, curtain: 0.2 }); }
  else if (inR(t, CUE.lightInsert)) { const u = prog(t, ...CUE.lightInsert); Object.assign(st, { zoom: lerp(1.2, 1.28, u), px: 60, py: 40, light: lerp(1, 0.55, eInOut(prog(u, 0.15, 0.85))), warm: lerp(0.3, 1, u), curtain: 0.1 }); }
  else if (inR(t, CUE.curtainInsert)) { const u = prog(t, ...CUE.curtainInsert); Object.assign(st, { zoom: lerp(1.25, 1.32, u), px: -180, py: 10, light: 0.7, warm: 0.8, curtain: eInOut(prog(u, 0.05, 0.95)) }); }
  else if (inR(t, CUE.planToRoom) || t >= CUE.planToRoom[0] && t < 28.3) { const u = prog(t, ...CUE.planToRoom); Object.assign(st, { zoom: lerp(1.0, 1.06, u), light: lerp(0.2, 0.95, u), curtain: 0.6 }); }
  else if (inR(t, CUE.montage1)) { const u = prog(t, ...CUE.montage1); Object.assign(st, { zoom: lerp(1.12, 1.2, u), px: 40, light: lerp(0.4, 1, eOut(u)), warm: 0.85, curtain: 0.3 }); }
  else if (inR(t, CUE.montage2)) { const u = prog(t, ...CUE.montage2); Object.assign(st, { zoom: lerp(1.08, 1.0, u), px: -60, light: 0.8, warm: 1, curtain: lerp(0.5, 1, u) }); }
  else { // behind presenter: slow drift
    Object.assign(st, { zoom: 1.12 + 0.03 * Math.sin(t * 0.15), px: 20 * Math.sin(t * 0.21), py: 10 * Math.cos(t * 0.17), light: 0.8, warm: 0.7, curtain: 0.25 });
  }
  return st;
}
function insertActive(t) {
  for (const k of ['hookInsert', 'lightInsert', 'curtainInsert', 'montage1', 'montage2']) if (inR(t, CUE[k])) return k;
  return null;
}

// ---------- frame ----------
async function loadImg(src) { const im = new Image(); im.src = src; await im.decode(); return im; }
export async function init(scale, debug) {
  S = scale; DEBUG = !!debug;
  TL = await (await fetch('/cache/timeline.json')).json(); buildCues();
  canvas = document.getElementById('c'); canvas.width = Math.round(W * S); canvas.height = Math.round(H * S);
  ctx = canvas.getContext('2d');
  const mk = () => { const cc = document.createElement('canvas'); cc.width = W; cc.height = H; return [cc, cc.getContext('2d')]; };
  [roomC, roomX] = mk(); [fgC, fgX] = mk(); [tmpC, tmpX] = mk();
  for (let k = 0; k < 6; k++) { const n = document.createElement('canvas'); n.width = n.height = 256; const nx = n.getContext('2d'); const d = nx.createImageData(256, 256); const r = rng(100 + k);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - 0.5) * 200; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } nx.putImageData(d, 0, 0); noise.push(n); }
  IMG.wordmark = await loadImg('/assets/logos/trim/octonics_wordmark_reverse.png');
  IMG.knx = await loadImg('/assets/logos/KNX_logo.svg');
  const ff = new FontFace('Instrument Serif', 'url(/assets/fonts/InstrumentSerif-Italic.ttf)', { style: 'italic', weight: '400' });
  document.fonts.add(await ff.load());
  await document.fonts.load('800 64px Inter'); await document.fonts.load('600 32px Inter'); await document.fonts.load('500 32px Inter');
  await document.fonts.load('italic 400 100px "Instrument Serif"');
  prepCaptions(canvas.getContext('2d'));
  return { n: TL.n, fps: TL.fps };
}
export async function drawFrame(idx) {
  const t = idx / FPS, fr = { ...TL.frames[idx], idx };
  const c = ctx; c.setTransform(S, 0, 0, S, 0, 0); c.filter = 'none'; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = C.bg0; c.fillRect(0, 0, W, H);
  if (fr.mode === 'card') { endCard(c, t); finish(c, t, fr); return; }
  const img = await loadImg(`/cache/fg/f_${String(idx).padStart(5, '0')}.png`);
  const seg = TL.segments.find(s => s.id === fr.seg);
  // cut punch: subtle scale settle at each segment start
  const since = t - seg.out[0], punch = idx === 0 ? lerp(1.12, 1, eOutExpo(prog(t, 0, 0.45))) : lerp(1.035, 1, eOut(prog(since, 0, 0.3)));
  c.save(); c.translate(W / 2, H * 0.4); c.scale(punch, punch); c.translate(-W / 2, -H * 0.4);
  if (fr.mode === 'matte') {
    drawRoom(roomX, roomState(t));
    c.save(); c.filter = blur(9); c.drawImage(roomC, 0, 0); c.restore();
    c.fillStyle = 'rgba(6,9,14,0.28)'; c.fillRect(0, 0, W, H);
  }
  drawPresenter(c, img, fr.mode, t, seg);
  c.restore();
  // full-screen inserts
  const ins = insertActive(t);
  if (ins) { drawRoom(roomX, roomState(t)); c.drawImage(roomC, 0, 0); }
  if (t >= CUE.planFull[0] && t < 28.3) {
    const a = Math.min(eOut(prog(t, CUE.planFull[0], CUE.planFull[0] + 0.25)), 1);
    if (t >= CUE.planToRoom[0]) { drawRoom(roomX, roomState(t)); c.drawImage(roomC, 0, 0); }
    floorPlan(c, t, a * (1 - eInOut(prog(t, CUE.planToRoom[0], CUE.planToRoom[1] - 0.1))));
  }
  if (ins === 'lightInsert') { featureCard(c, W / 2 - 170, 300, 340, 136, 'bulb', 'LIVING ROOM', `Warm ${Math.round(lerp(100, 40, prog(t, ...CUE.lightInsert)))}%`, lerp(1, 0.4, prog(t, ...CUE.lightInsert)), eOut(prog(t, CUE.lightInsert[0], CUE.lightInsert[0] + 0.2))); }
  if (ins === 'curtainInsert') { featureCard(c, W / 2 - 170, 300, 340, 136, 'curtain', 'CURTAINS', `Open ${Math.round(100 * eInOut(prog(t, ...CUE.curtainInsert)))}%`, eInOut(prog(t, ...CUE.curtainInsert)), eOut(prog(t, CUE.curtainInsert[0], CUE.curtainInsert[0] + 0.2))); }
  // overlays
  alexa(c, t); knxLockup(c, t); phoneUI(c, t); featureCards(c, t);
  captions(c, t);
  finish(c, t, fr);
  if (DEBUG && fr.fbox) { c.strokeStyle = '#ff3b3b'; c.lineWidth = 4; const f = fr.fbox; c.strokeRect(f[0], f[1], f[2] - f[0], f[3] - f[1]); }
}
