// Octonics x KNX reel (v3). Every frame is a pure function of its index (no clocks, seeded randomness).
// All layout in a 1080x1920 world; S scales to preview size.
const W = 1080, H = 1920, FPS = 30;
const C = {
  bg0: '#0B0A09', ink: '#120E0B', ivory: '#F5EFE6', white: '#F5EFE6',
  gold: ['#F6E3BC', '#E2B577', '#C0834A'], copper: '#B8763E', goldMid: '#E2B577',
  warm: [255, 196, 128], cool: [206, 214, 222],
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
function font(c, w, px, fam = 'Satoshi') { c.font = `${w} ${px}px ${fam}`; }
function goldGrad(c, x0, y0, x1, y1) { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, C.gold[0]); g.addColorStop(0.55, C.gold[1]); g.addColorStop(1, C.gold[2]); return g; }

// ---------- scene timing (absolute output seconds, anchored to spoken words) ----------
let M, CUE;
function buildCues() {
  M = TL.marks;
  CUE = {
    inserts: [
      { k: 'lamp', a: M.lighting1 - 0.06, b: M.climate1 - 0.04, from: 1, to: 0.4 },
      { k: 'dial', a: M.climate1 - 0.04, b: M.curtains1 - 0.06 },
      { k: 'curtain', a: M.curtains1 - 0.06, b: M.curtains1 + 1.0 },
      { k: 'bus', a: M.knx_wiring - 0.12, b: M.what_are - 0.08 },
      { k: 'house', a: M.intelligent - 0.12, b: M.knx3 - 0.1 },
      { k: 'plan', a: M.wiring5 - 0.4, b: M.knx5 + 1.25 },
      { k: 'lamp', a: M.smarter - 0.25, b: M.easy - 0.08, from: 0.25, to: 1 },
      { k: 'curtain', a: M.comfortable - 0.3, b: M.plan - 0.2 },
    ],
    noCaps: [[M.twenty - 0.05, M.warm_end]],
  };
}
const inR = (t, r) => t >= r[0] && t < r[1];
function insertAt(t) { return CUE.inserts.find(s => t >= s.a && t < s.b) || null; }

// ---------- room (code-drawn architectural set) ----------
const CITY = (() => { const r = rng(7); return Array.from({ length: 140 }, () => ({ x: r(), y: r(), s: r(), w: r() < 0.55 })); })();
function drawRoom(c, p) {
  // p: {zoom, px, py, light 0..1, warm 0..1, curtain 0..1 (open), t}
  const L = p.light, warmC = mix(C.cool, C.warm, p.warm);
  c.save();
  c.fillStyle = '#090706'; c.fillRect(0, 0, W, H);
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
    g.addColorStop(0, '#15110E'); g.addColorStop(0.62, '#211A15'); g.addColorStop(1, '#2A2019');
    c.fillStyle = g; c.fillRect(wx0 - 60, wy0, wx1 - wx0 + 120, wy1 - wy0);
    for (const d of CITY) {
      const x = wx0 - 40 + d.x * (wx1 - wx0 + 80), y = wy0 + 520 + d.y * 520, r = 2 + d.s * 5;
      const g2 = c.createRadialGradient(x, y, 0, x, y, r * 3);
      const col = d.w ? [255, 196, 120] : [214, 196, 176];
      g2.addColorStop(0, rgba(col, 0.55)); g2.addColorStop(1, rgba(col, 0));
      c.fillStyle = g2; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    }
    c.fillStyle = 'rgba(8,6,5,0.85)'; // distant skyline silhouettes
    const r2 = rng(11); let x = wx0 - 60;
    while (x < wx1 + 60) { const bw = 40 + r2() * 70, bh = 120 + r2() * 260; c.fillRect(x, wy1 - 300 - bh * 0.4, bw, bh); x += bw + 6; }
  });
  // mid: walls, ceiling, window frame, curtains
  layer(0.7, () => {
    // ceiling
    c.fillStyle = '#0E0B09'; c.fillRect(-200, -400, W + 400, wy0 - 20 + 400);
    // back wall
    const wg = c.createLinearGradient(0, wy0, 0, wy1);
    wg.addColorStop(0, '#1A1612'); wg.addColorStop(1, '#110E0B');
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
    ag.addColorStop(0, '#2A1E15'); ag.addColorStop(0.55, '#4A3322'); ag.addColorStop(1, rgba(mix([60, 40, 30], C.warm, 0.4), 1));
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
      g.addColorStop(0, rgba(warmC, a * (0.6 + 0.6 * L))); g.addColorStop(1, rgba([225, 210, 190], a * 0.6));
      c.fillStyle = g; c.fillRect(fx, wy0 - 10, fw, wy1 - wy0 + 20);
    }
    c.fillStyle = '#04060A'; c.fillRect(wx0 - 30, wy0 - 22, wx1 - wx0 + 100, 14); // curtain track
  });
  // near: floor, sofa, pendant
  layer(1.0, () => {
    const fy = 1520;
    const fg = c.createLinearGradient(0, fy, 0, H + 300);
    fg.addColorStop(0, '#100D0A'); fg.addColorStop(1, '#070605');
    c.fillStyle = fg; c.fillRect(-200, fy, W + 400, H + 400 - fy);
    // floor reflection of window + warm glow
    const rg = c.createLinearGradient(0, fy, 0, fy + 380);
    rg.addColorStop(0, 'rgba(150,110,70,0.16)'); rg.addColorStop(1, 'rgba(150,110,70,0)');
    c.fillStyle = rg; c.fillRect(wx0, fy, wx1 - wx0, 380);
    // sofa
    c.fillStyle = '#1B1713'; rr(c, 30, 1300, 640, 230, 26); c.fill();
    c.fillStyle = '#211C17'; rr(c, 30, 1240, 640, 110, 30); c.fill();
    c.fillStyle = rgba(warmC, 0.12 * L); rr(c, 40, 1242, 620, 8, 4); c.fill();
    for (const x of [70, 270, 470]) { c.fillStyle = '#262019'; rr(c, x, 1270, 180, 120, 22); c.fill(); }
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
  c.fillStyle = `rgba(6,5,4,${0.45 * (1 - L)})`; c.fillRect(0, 0, W, H);
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


// ---------- cards & icons ----------
function card(c, x, y, w, h, r, a = 1, o = {}) {
  if (a <= 0) return;
  c.save(); c.globalAlpha *= a;
  c.save(); c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 36 * S; c.shadowOffsetY = 14 * S;
  rr(c, x, y, w, h, r); c.fillStyle = o.light ? '#FFFFFF' : 'rgba(17,13,10,0.86)'; c.fill(); c.restore();
  if (!o.light) {
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(246,227,188,0.07)'); g.addColorStop(1, 'rgba(246,227,188,0)');
    rr(c, x, y, w, h, r); c.fillStyle = g; c.fill();
    rr(c, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r); c.strokeStyle = 'rgba(246,227,188,0.22)'; c.lineWidth = 1.5; c.stroke();
  }
  c.restore();
}
function icon(c, kind, x, y, s, col, a = 1) {
  c.save(); c.translate(x, y); c.scale(s / 48, s / 48); c.globalAlpha *= a;
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath();
  if (kind === 'bulb') { c.arc(24, 19, 12, Math.PI * 0.8, Math.PI * 2.2); c.lineTo(30, 34); c.lineTo(18, 34); c.closePath(); c.moveTo(19, 39); c.lineTo(29, 39); c.moveTo(21, 44); c.lineTo(27, 44); }
  if (kind === 'climate') { c.moveTo(24, 6); c.lineTo(24, 42); c.moveTo(8, 15); c.lineTo(40, 33); c.moveTo(8, 33); c.lineTo(40, 15); c.moveTo(19, 9); c.lineTo(24, 14); c.lineTo(29, 9); c.moveTo(19, 39); c.lineTo(24, 34); c.lineTo(29, 39); }
  if (kind === 'curtain') { c.moveTo(4, 6); c.lineTo(44, 6); for (const xx of [8, 14, 20]) { c.moveTo(xx, 6); c.quadraticCurveTo(xx + 3, 26, xx - 2, 44); } for (const xx of [40, 34, 28]) { c.moveTo(xx, 6); c.quadraticCurveTo(xx - 3, 26, xx + 2, 44); } }
  if (kind === 'home') { c.moveTo(6, 22); c.lineTo(24, 7); c.lineTo(42, 22); c.moveTo(11, 19); c.lineTo(11, 42); c.lineTo(37, 42); c.lineTo(37, 19); c.moveTo(20, 42); c.lineTo(20, 30); c.lineTo(28, 30); c.lineTo(28, 42); }
  if (kind === 'mic') { c.roundRect(17, 5, 14, 24, 7); c.moveTo(10, 22); c.quadraticCurveTo(10, 36, 24, 36); c.quadraticCurveTo(38, 36, 38, 22); c.moveTo(24, 36); c.lineTo(24, 44); }
  if (kind === 'keypad') { c.roundRect(10, 6, 28, 36, 5); for (const yy of [16, 24, 32]) { c.moveTo(17, yy); c.lineTo(31, yy); } }
  if (kind === 'shield') { c.moveTo(24, 5); c.lineTo(40, 11); c.lineTo(38, 28); c.quadraticCurveTo(34, 38, 24, 44); c.quadraticCurveTo(14, 38, 10, 28); c.lineTo(8, 11); c.closePath(); }
  c.stroke(); c.restore();
}
function toggle(c, x, y, on, a = 1) {
  c.save(); c.globalAlpha *= a;
  rr(c, x, y, 60, 34, 17); c.fillStyle = on ? goldGrad(c, x, y, x + 60, y) : 'rgba(245,239,230,0.16)'; c.fill();
  c.beginPath(); c.arc(x + (on ? 43 : 17), y + 17, 12, 0, Math.PI * 2); c.fillStyle = on ? '#1A130C' : '#F5EFE6'; c.fill(); c.restore();
}
function meter(c, x, y, w, lvl) {
  rr(c, x, y, w, 8, 4); c.fillStyle = 'rgba(245,239,230,0.13)'; c.fill();
  rr(c, x, y, Math.max(8, w * lvl), 8, 4); c.fillStyle = goldGrad(c, x, y, x + w, y); c.fill();
}

// ---------- face-aware placement ----------
const PLACE = {};
function faceUnion(t0, t1) {
  let b = null;
  for (let i = Math.max(0, Math.floor(t0 * FPS)); i <= Math.min(TL.n - 1, Math.ceil(t1 * FPS)); i++) {
    const f = TL.frames[i].fbox; if (!f) continue;
    b = b ? [Math.min(b[0], f[0]), Math.min(b[1], f[1]), Math.max(b[2], f[2]), Math.max(b[3], f[3])] : f.slice();
  }
  return b || [340, 300, 740, 1000];
}
const overlaps = (r, b, m = 26) => r.x < b[2] + m && r.x + r.w > b[0] - m && r.y < b[3] + m && r.y + r.h > b[1] - m;
function place(key, w, h, t0, t1, cands, maxY = 1290) {
  if (PLACE[key]) return PLACE[key];
  const b = faceUnion(t0, t1);
  for (const cf of cands) {
    const [x, y] = cf(b), r = { x, y, w, h };
    if (y < 230 || y + h > maxY || x < 30 || x + w > 1050) continue;
    if (!overlaps(r, b)) return (PLACE[key] = r);
  }
  console.error('place fallback', key, JSON.stringify(b));
  return (PLACE[key] = { x: W / 2 - w / 2, y: Math.min(b[3] + 30, maxY - h), w, h });
}
const below = (w, gap = 30) => b => [W / 2 - w / 2, b[3] + gap];
const aboveC = (w, h, gap = 26) => b => [W / 2 - w / 2, b[1] - h - gap];
const rightOf = (gap = 26, y = 360) => b => [b[2] + gap, y];
const leftOf = (w, gap = 26, y = 360) => b => [b[0] - gap - w, y];
function sideColumn(key, t0, t1, h, y = 380) {
  if (PLACE[key]) return PLACE[key];
  const b = faceUnion(t0, t1), m = 24;
  let x = b[2] + m, w = Math.min(300, 1048 - x);
  if (w < 230) { w = Math.min(300, b[0] - m - 30); x = b[0] - m - w; }
  if (w < 230) { console.error('column fallback', key); w = 250; x = 1048 - w; }
  return (PLACE[key] = { x, y, w, h });
}

// ---------- captions: Satoshi Black + Instrument Serif Italic accents ----------
const KEY = new Set(['dream', 'home?', 'smart', 'light', 'knx', 'lighting', 'climate', 'curtains', 'umbrella', 'octonics', 'project', 'wiring',
  'truly', 'phone', 'advanced', 'single', 'simple', 'application', 'intelligent', 'experience', 'electrical', 'planning', 'smarter', 'comfortable', 'one']);
const SANS = 64, SERIF = 110;
const clean = s => s.replace(/[.,]+$/, '').replace(/^Ocktronix/, 'Octonics');
let CAPS = null;
function prepCaptions(c) {
  CAPS = TL.captions.map(g => {
    const words = g.words.map(w => {
      const txt = clean(w.w), k = KEY.has(txt.toLowerCase());
      c.font = k ? `italic 400 ${SERIF}px "Instrument Serif"` : `900 ${SANS}px Satoshi`;
      c.letterSpacing = k ? '0px' : '-1.5px';
      return { ...w, txt, k, wd: c.measureText(txt).width };
    });
    const sp = 30, maxW = 900;
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
    const L = lines.map(l => ({ words: l, w: l.reduce((s, w) => s + w.wd, 0) + sp * (l.length - 1), h: l.some(w => w.k) ? SERIF * 0.9 : SANS * 1.04 }));
    const blockH = L.reduce((s, l) => s + l.h, 0) + 6 * (L.length - 1);
    return { ...g, lines: L, blockH, fit: Math.min(1, 940 / Math.max(...L.map(l => l.w))), sp };
  });
}
function captions(c, t) {
  for (const r of CUE.noCaps) if (t >= r[0] && t < r[1]) return;
  const g = CAPS.find(g => t >= g.t0 - 0.05 && t < g.t1 + 0.3); if (!g) return;
  const gs = TL.segments.find(s => s.id === g.words[0].seg); if (t >= gs.out[1]) return;
  const out = 1 - eOut(prog(t, g.t1 + 0.16, g.t1 + 0.3));
  const ins = insertAt(t);
  const b = ins ? [0, 0, 0, 1180] : faceUnion(g.t0, g.t1 + 0.3);
  let sc = g.fit; const bottom = 1488;
  const room = bottom - (b[3] + 20); if (g.blockH * sc > room) sc = Math.max(0.62, room / g.blockH);
  const top = bottom - g.blockH * sc;
  c.save(); c.textBaseline = 'alphabetic';
  c.save(); c.globalAlpha = 0.6 * out * clamp(prog(t, g.t0 - 0.05, g.t0 + 0.1));
  const bg = c.createRadialGradient(W / 2, top + g.blockH * sc / 2, 10, W / 2, top + g.blockH * sc / 2, 560);
  bg.addColorStop(0, 'rgba(8,6,5,0.72)'); bg.addColorStop(1, 'rgba(8,6,5,0)'); c.fillStyle = bg; c.fillRect(0, top - 160, W, g.blockH * sc + 320); c.restore();
  let y = top;
  for (const line of g.lines) {
    y += line.h * sc; let x = W / 2 - line.w * sc / 2;
    for (const w of line.words) {
      const u = prog(t, w.t0 - 0.05, w.t0 + 0.2);
      if (u > 0) {
        const active = t >= w.t0 - 0.02 && t < w.t1 + 0.06 && !w.k;
        c.save(); c.globalAlpha = out * clamp(u * 1.6);
        if (w.k) {
          const e = eOutExpo(u);
          c.translate(x + w.wd * sc / 2, y + (1 - e) * 34 * sc); c.scale(sc, sc); c.filter = blur((1 - e) * 9);
          c.font = `italic 400 ${SERIF}px "Instrument Serif"`; c.letterSpacing = '0px'; c.textAlign = 'center';
          c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 18 * S; c.shadowOffsetY = 4 * S;
          c.fillStyle = goldGrad(c, 0, -SERIF * 0.78, 0, SERIF * 0.05); c.fillText(w.txt, 0, 0);
        } else {
          const e = eBack(clamp(u * 1.15));
          c.translate(x + w.wd * sc / 2, y - SANS * 0.35 * sc); c.scale(sc * lerp(0.62, 1, e), sc * lerp(0.62, 1, e)); c.translate(0, SANS * 0.35);
          c.filter = blur((1 - clamp(u * 1.3)) * 7);
          c.font = `900 ${SANS}px Satoshi`; c.letterSpacing = '-1.5px'; c.textAlign = 'center';
          if (active) {
            const pa = eOut(prog(t, w.t0 - 0.02, w.t0 + 0.08));
            c.save(); c.globalAlpha *= pa; rr(c, -w.wd / 2 - 14, -SANS * 0.84, w.wd + 28, SANS * 1.08, 14); c.fillStyle = goldGrad(c, -w.wd / 2, 0, w.wd / 2, 0); c.fill(); c.restore();
            c.fillStyle = '#1A130C';
          } else {
            c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 14 * S; c.shadowOffsetY = 3 * S; c.fillStyle = C.ivory;
          }
          c.fillText(w.txt, 0, 0);
        }
        c.restore();
      }
      x += (w.wd + g.sp) * sc;
    }
    y += 6 * sc;
  }
  c.restore();
}

// ---------- UI moments over the presenter (always clear of the face) ----------
function alexa(c, t) {
  const t0 = M.hey_alexa - 0.1, t1 = M.twenty - 0.25, a = win(t, t0, t1, 0.3, 0.15);
  if (a > 0) {
    const r = place('alexa', 280, 96, t0, t1, [aboveC(280, 96), below(280), leftOf(280, 24, 300), rightOf(24, 300)]);
    card(c, r.x, r.y, r.w, r.h, 48, a);
    c.save(); c.globalAlpha = a; const cx = r.x + 56, cy = r.y + r.h / 2;
    for (let i = 0; i < 3; i++) { const ph = ((t * 1.1 + i / 3) % 1); c.beginPath(); c.arc(cx, cy, 24 + ph * 22, 0, Math.PI * 2); c.strokeStyle = `rgba(226,181,119,${0.55 * (1 - ph)})`; c.lineWidth = 1.6; c.stroke(); }
    c.beginPath(); c.arc(cx, cy, 24, 0, Math.PI * 2); c.fillStyle = goldGrad(c, cx - 24, cy - 24, cx + 24, cy + 24); c.fill();
    icon(c, 'mic', cx - 16, cy - 16, 32, '#1A130C');
    for (let i = 0; i < 11; i++) { const hh = 6 + 30 * Math.abs(Math.sin(t * 8.5 + i * 1.3)) * (t < M.light + 0.3 ? 1 : 0.15); rr(c, r.x + 104 + i * 14, cy - hh / 2, 5, hh, 2.5); c.fillStyle = i % 3 ? 'rgba(245,239,230,0.85)' : C.goldMid; c.fill(); }
    c.restore();
  }
  const d0 = M.twenty - 0.12, d1 = M.warm_end - 0.05, d = win(t, d0, d1, 0.3, 0.25);
  if (d > 0) {
    const r = place('dimmer', 460, 220, d0, d1, [below(460), aboveC(460, 220), leftOf(460), rightOf()], 1500);
    const lv = lerp(1, 0.2, eInOut(prog(t, M.twenty, M.twenty + 0.75)));
    c.save(); c.translate(r.x + r.w / 2, r.y + r.h / 2); const sc = lerp(0.9, 1, eBack(prog(t, d0, M.twenty + 0.25))); c.scale(sc, sc); c.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    card(c, r.x, r.y, r.w, r.h, 30, d);
    c.globalAlpha = d;
    icon(c, 'bulb', r.x + 26, r.y + 24, 38, C.goldMid);
    font(c, 700, 22); c.letterSpacing = '2px'; c.fillStyle = 'rgba(245,239,230,0.7)'; c.fillText('LIVING ROOM', r.x + 76, r.y + 52);
    font(c, 900, 112); c.letterSpacing = '-4px'; c.fillStyle = C.ivory; c.fillText(`${Math.round(lv * 100)}%`, r.x + 24, r.y + 168);
    meter(c, r.x + 26, r.y + 190, r.w - 52, lv);
    const lk = eBack(prog(t, M.twenty + 0.78, M.twenty + 1.05));
    if (lk > 0) { c.save(); c.translate(r.x + r.w - 52, r.y + 50); c.scale(lk, lk); c.beginPath(); c.arc(0, 0, 22, 0, Math.PI * 2); c.fillStyle = goldGrad(c, -22, -22, 22, 22); c.fill(); c.strokeStyle = '#1A130C'; c.lineWidth = 4.5; c.beginPath(); c.moveTo(-9, 1); c.lineTo(-3, 7); c.lineTo(10, -7); c.stroke(); c.restore(); }
    c.restore();
  }
}
function logoChip(c, t, key, t0, t1, img, light) {
  const a = win(t, t0, t1, 0.3, 0.15); if (a <= 0 || !img) return;
  const w = light ? 340 : 400, h = light ? 128 : 124;
  const r = place(key, w, h, t0, t1, [below(w, 26), aboveC(w, h), leftOf(w, 24, 300), rightOf(24, 300)]);
  const u = eOutExpo(prog(t, t0, t0 + 0.55));
  c.save(); c.translate(r.x + r.w / 2, r.y + r.h / 2 + (1 - u) * 28); c.scale(lerp(0.94, 1, u), lerp(0.94, 1, u));
  card(c, -w / 2, -h / 2, w, h, 26, a, { light });
  c.globalAlpha = a;
  const lw = w - (light ? 90 : 100), lh = lw * img.naturalHeight / img.naturalWidth;
  c.drawImage(img, -lw / 2, -lh / 2, lw, lh);
  if (!light) { // soft sheen pass across the wordmark
    const sx = lerp(-w, w, prog(t, t0 + 0.2, t0 + 1.1));
    c.save(); rr(c, -w / 2, -h / 2, w, h, 26); c.clip(); c.globalCompositeOperation = 'screen';
    const g = c.createLinearGradient(sx - 60, 0, sx + 60, 0); g.addColorStop(0, 'rgba(246,227,188,0)'); g.addColorStop(0.5, 'rgba(246,227,188,0.28)'); g.addColorStop(1, 'rgba(246,227,188,0)');
    c.fillStyle = g; c.fillRect(-w / 2, -h / 2, w, h); c.restore();
  }
  c.restore();
}
function unify(c, t) { // three systems converge into one
  const t0 = M.umbrella - 0.55, t1 = M.talk_octonics - 0.15, a = win(t, t0, t1, 0.25, 0.2); if (a <= 0) return;
  const r = place('unify', 300, 300, t0, t1, [rightOf(26, 380), leftOf(300, 26, 380), below(300)]);
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, m = eInOut(prog(t, M.umbrella - 0.1, M.system1 + 0.1));
  c.save(); c.globalAlpha = a;
  const ring = eOut(prog(t, M.system1 - 0.1, M.system1 + 0.45));
  c.beginPath(); c.arc(cx, cy, 120, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ring); c.strokeStyle = goldGrad(c, cx - 120, cy, cx + 120, cy); c.lineWidth = 3; c.stroke();
  ['bulb', 'climate', 'curtain'].forEach((k, i) => {
    const ang = -Math.PI / 2 + i * (Math.PI * 2 / 3), R = lerp(120, 0, m) + 0;
    const x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R, s = lerp(1, 0.0, prog(m, 0.8, 1));
    const pa = eBack(prog(t, t0 + i * 0.08, t0 + 0.3 + i * 0.08));
    if (s <= 0) return;
    c.save(); c.translate(x, y); c.scale(pa * s, pa * s);
    c.beginPath(); c.arc(0, 0, 44, 0, Math.PI * 2); c.fillStyle = 'rgba(17,13,10,0.9)'; c.fill(); c.strokeStyle = 'rgba(246,227,188,0.35)'; c.lineWidth = 1.5; c.stroke();
    icon(c, k, -20, -20, 40, C.ivory); c.restore();
  });
  const hub = eBack(prog(m, 0.85, 1));
  if (hub > 0) { c.save(); c.translate(cx, cy); c.scale(hub, hub); c.beginPath(); c.arc(0, 0, 62, 0, Math.PI * 2); c.fillStyle = goldGrad(c, -62, -62, 62, 62); c.fill(); icon(c, 'home', -28, -30, 56, '#1A130C'); c.restore(); }
  c.restore();
}
function phoneUI(c, t) {
  const t0 = M.not_just - 0.1, t1 = M.application + 0.62, a = win(t, t0, t1, 0.4, 0.25); if (a <= 0) return;
  const r = place('phone', 270, 560, t0, t1, [rightOf(26, 330), leftOf(290, 26, 330), rightOf(26, 260)]);
  const u = eOutExpo(prog(t, t0, t0 + 0.7)), s = r.w / 360;
  c.save(); c.translate(r.x + r.w / 2 + (1 - u) * 220, r.y + r.h / 2); c.rotate(-0.05 * (1 - u)); c.translate(-r.w / 2, -r.h / 2);
  card(c, 0, 0, r.w, r.h, 46, a);
  c.globalAlpha = a; c.scale(s, s);
  rr(c, 130, 24, 100, 20, 10); c.fillStyle = '#000'; c.fill();
  font(c, 900, 32); c.letterSpacing = '-0.5px'; c.fillStyle = C.ivory; c.fillText('Home', 36, 102);
  font(c, 500, 21); c.letterSpacing = '0px'; c.fillStyle = 'rgba(245,239,230,0.55)'; c.fillText('Living room', 36, 134);
  const rows = [['bulb', 'Lighting', M.lighting2], ['climate', 'Climate', M.ac], ['curtain', 'Curtains', M.curtains2], ['keypad', 'Scenes', M.every]];
  rows.forEach(([k, n, on], i) => {
    const ry = 168 + i * 116, ra = eOut(prog(t, t0 + 0.35 + i * 0.08, t0 + 0.7 + i * 0.08)), isOn = t >= on;
    c.save(); c.globalAlpha = a * ra; rr(c, 24, ry, 312, 100, 22); c.fillStyle = isOn ? 'rgba(226,181,119,0.12)' : 'rgba(245,239,230,0.05)'; c.fill();
    if (isOn) { c.strokeStyle = 'rgba(226,181,119,0.5)'; c.lineWidth = 1.5; c.stroke(); }
    icon(c, k, 42, ry + 28, 42, isOn ? C.goldMid : C.ivory); font(c, 700, 27); c.fillStyle = C.ivory; c.fillText(n, 102, ry + 60);
    toggle(c, 254, ry + 33, isOn); c.restore();
  });
  const one = eOut(prog(t, M.single - 0.1, M.single + 0.35));
  if (one > 0) { c.save(); c.globalAlpha = a * one; rr(c, 24, 640, 312, 70, 35); c.fillStyle = goldGrad(c, 24, 0, 336, 0); c.fill();
    font(c, 900, 26); c.fillStyle = '#1A130C'; c.textAlign = 'center'; c.fillText('All in one app', 180, 684); c.restore(); }
  c.restore();
}

// ---------- line-art inserts (architectural motion graphics) ----------
function inkBg(c, lt) {
  c.fillStyle = '#0C0A08'; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W / 2, 880, 40, W / 2, 880, 900); g.addColorStop(0, 'rgba(226,181,119,0.10)'); g.addColorStop(1, 'rgba(226,181,119,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(245,239,230,0.045)'; c.lineWidth = 1;
  for (let x = 60; x < W; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 40; y < H; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
}
// draw a list of polylines progressively (p 0..1 over their total length)
function draw(c, polys, p, col = C.ivory, lw = 3) {
  const lens = polys.map(pl => pl.reduce((s, pt, i) => i ? s + Math.hypot(pt[0] - pl[i - 1][0], pt[1] - pl[i - 1][1]) : 0, 0));
  let rem = lens.reduce((a, b) => a + b, 0) * clamp(p);
  c.save(); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
  polys.forEach((pl, k) => {
    if (rem <= 0) return; c.beginPath(); c.moveTo(pl[0][0], pl[0][1]);
    for (let i = 1; i < pl.length; i++) {
      const seg = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
      if (rem >= seg) { c.lineTo(pl[i][0], pl[i][1]); rem -= seg; }
      else { const u = rem / seg; c.lineTo(lerp(pl[i - 1][0], pl[i][0], u), lerp(pl[i - 1][1], pl[i][1], u)); rem = 0; break; }
    }
    c.stroke();
  });
  c.restore();
}
const arcPts = (cx, cy, r, a0, a1, n = 48) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(lerp(a0, a1, i / n)) * r, cy + Math.sin(lerp(a0, a1, i / n)) * r]);
function glow(c, x, y, r, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,206,140,${a})`); g.addColorStop(1, 'rgba(255,206,140,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); }

function insLamp(c, t, s) {
  const lt = t - s.a, d = s.b - s.a, p = eOut(prog(lt, 0, 0.45));
  const lv = lerp(s.from, s.to, eInOut(prog(lt, 0.15, d - 0.1)));
  // light cone + glow under the drawing
  c.save(); c.globalAlpha = p;
  const cone = c.createLinearGradient(0, 840, 0, 1190); cone.addColorStop(0, `rgba(255,206,140,${0.45 * lv})`); cone.addColorStop(1, 'rgba(255,206,140,0)');
  c.beginPath(); c.moveTo(450, 842); c.lineTo(630, 842); c.lineTo(800, 1190); c.lineTo(280, 1190); c.closePath(); c.fillStyle = cone; c.fill();
  glow(c, 540, 830, 260 * (0.6 + lv * 0.6), 0.55 * lv); c.restore();
  draw(c, [[[150, 520], [930, 520]], [[540, 520], [540, 760]], [[480, 760], [600, 760], [640, 842], [440, 842], [480, 760]],
    [[150, 1190], [930, 1190]], [[220, 1190], [220, 1080], [520, 1080], [520, 1190]], [[240, 1080], [240, 1020], [500, 1020], [500, 1080]],
    [[700, 1190], [700, 1110], [830, 1110], [830, 1190]], [[765, 1110], [765, 1060]]], p);
  const ca = eOut(prog(lt, 0.25, 0.5));
  if (ca > 0) { card(c, 640, 600, 250, 110, 22, ca); c.save(); c.globalAlpha = ca; icon(c, 'bulb', 660, 632, 40, C.goldMid);
    font(c, 900, 46); c.letterSpacing = '-1px'; c.fillStyle = C.ivory; c.fillText(`${Math.round(lv * 100)}%`, 716, 672); c.restore(); }
}
function insDial(c, t, s) {
  const lt = t - s.a, d = s.b - s.a, p = eOut(prog(lt, 0, 0.5)), cx = 540, cy = 860, R = 230;
  const temp = lerp(25, 22, eInOut(prog(lt, 0.2, d - 0.05)));
  draw(c, [arcPts(cx, cy, R, Math.PI * 0.75, Math.PI * 2.25, 64)], p, 'rgba(245,239,230,0.35)', 3);
  c.save(); c.globalAlpha = p;
  for (let i = 0; i <= 30; i++) { const an = lerp(Math.PI * 0.75, Math.PI * 2.25, i / 30), r1 = R - 26, r2 = R - (i % 5 ? 40 : 52);
    c.beginPath(); c.moveTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); c.lineTo(cx + Math.cos(an) * r2, cy + Math.sin(an) * r2); c.strokeStyle = 'rgba(245,239,230,0.3)'; c.lineWidth = 2; c.stroke(); }
  const fr = prog(temp, 16, 30), aEnd = lerp(Math.PI * 0.75, Math.PI * 2.25, fr);
  c.beginPath(); c.arc(cx, cy, R, Math.PI * 0.75, aEnd); c.strokeStyle = goldGrad(c, cx - R, cy, cx + R, cy); c.lineWidth = 8; c.lineCap = 'round'; c.stroke();
  c.beginPath(); c.arc(cx + Math.cos(aEnd) * R, cy + Math.sin(aEnd) * R, 14, 0, Math.PI * 2); c.fillStyle = C.gold[0]; c.fill();
  font(c, 900, 190); c.letterSpacing = '-8px'; c.textAlign = 'center'; c.fillStyle = C.ivory; c.fillText(`${Math.round(temp)}°`, cx + 18, cy + 64);
  icon(c, 'climate', cx - 22, cy + 110, 44, C.goldMid); c.restore();
}
function insCurtain(c, t, s) {
  const lt = t - s.a, d = s.b - s.a, p = eOut(prog(lt, 0, 0.4)), open = eInOut(prog(lt, 0.2, d - 0.05));
  const x0 = 290, x1 = 790, y0 = 560, y1 = 1180;
  // view: dusk horizon + low sun
  c.save(); c.globalAlpha = p; c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
  const sky = c.createLinearGradient(0, y0, 0, y1); sky.addColorStop(0, '#1A1410'); sky.addColorStop(0.7, '#3A2618'); sky.addColorStop(1, '#5A3520');
  c.fillStyle = sky; c.fillRect(x0, y0, x1 - x0, y1 - y0); glow(c, 600, 980, 260, 0.6 * (0.4 + open * 0.6));
  c.beginPath(); c.arc(600, 990, 46, 0, Math.PI * 2); c.fillStyle = `rgba(255,214,160,${0.5 + 0.4 * open})`; c.fill();
  c.fillStyle = '#0E0B09'; const r2 = rng(5); let x = x0; while (x < x1) { const bw = 30 + r2() * 50, bh = 40 + r2() * 120; c.fillRect(x, 1060 - bh, bw, bh + 140); x += bw + 4; }
  c.restore();
  draw(c, [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], [[540, y0], [540, y1]], [[x0, 870], [x1, 870]], [[x0 - 70, y0 - 30], [x1 + 70, y0 - 30]], [[x0 - 90, y1 + 2], [x1 + 90, y1 + 2]]], p);
  // curtain panels slide to the sides
  const half = (x1 - x0 + 120) / 2, pw = lerp(half, 70, open);
  for (const side of [-1, 1]) {
    const ex = side < 0 ? x0 - 60 : x1 + 60, sx = ex - side * pw;
    c.save(); c.globalAlpha = p;
    const g = c.createLinearGradient(Math.min(sx, ex), 0, Math.max(sx, ex), 0); g.addColorStop(0, 'rgba(36,28,22,0.96)'); g.addColorStop(1, 'rgba(56,43,33,0.96)');
    c.fillStyle = g; c.fillRect(Math.min(sx, ex), y0 - 26, Math.abs(ex - sx), y1 - y0 + 26);
    const folds = 7; for (let i = 0; i <= folds; i++) { const fx = lerp(sx, ex, i / folds); c.beginPath(); c.moveTo(fx, y0 - 26); c.quadraticCurveTo(fx + side * 6, (y0 + y1) / 2, fx, y1); c.strokeStyle = 'rgba(245,239,230,0.35)'; c.lineWidth = 2; c.stroke(); }
    c.restore();
  }
  const ca = eOut(prog(lt, 0.2, 0.45));
  if (ca > 0) { card(c, 655, 430, 250, 100, 22, ca); c.save(); c.globalAlpha = ca; icon(c, 'curtain', 674, 456, 40, C.goldMid);
    font(c, 900, 40); c.fillStyle = C.ivory; c.fillText(`${Math.round(open * 100)}%`, 730, 494); c.restore(); }
}
function insBus(c, t, s) {
  const lt = t - s.a, p = eOut(prog(lt, 0, 0.6)), y = 880, xs = [180, 360, 540, 720, 900];
  const kinds = ['bulb', 'climate', 'curtain', 'keypad', 'shield'];
  draw(c, [[[90, y], [990, y]]], p, 'rgba(245,239,230,0.55)', 3);
  xs.forEach((x, i) => {
    draw(c, [[[x, y], [x, y - 120]]], prog(lt, 0.3 + i * 0.08, 0.6 + i * 0.08), 'rgba(245,239,230,0.4)', 2);
    const a = eBack(prog(lt, 0.45 + i * 0.1, 0.8 + i * 0.1)); if (a <= 0) return;
    const lit = ((lt * 0.9) % 1.4) * 900 + 90 > x - 30;
    c.save(); c.translate(x, y - 170); c.scale(a, a);
    if (lit && lt > 1) glow(c, 0, 0, 110, 0.35);
    c.beginPath(); c.arc(0, 0, 52, 0, Math.PI * 2); c.fillStyle = '#15100C'; c.fill(); c.strokeStyle = lit && lt > 1 ? C.goldMid : 'rgba(245,239,230,0.4)'; c.lineWidth = 2; c.stroke();
    icon(c, kinds[i], -22, -22, 44, lit && lt > 1 ? C.goldMid : C.ivory); c.restore();
  });
  // data pulse travelling along the single cable
  if (lt > 0.9) { const px = 90 + ((lt - 0.9) * 0.9 % 1) * 900; glow(c, px, y, 70, 0.7); c.beginPath(); c.arc(px, y, 7, 0, Math.PI * 2); c.fillStyle = C.gold[0]; c.fill(); }
}
function insHouse(c, t, s) {
  const lt = t - s.a, p = eOut(prog(lt, 0, 0.55));
  const wins = [[300, 860, 170, 220], [490, 860, 170, 220], [680, 860, 140, 300], [420, 640, 200, 130], [640, 640, 230, 130]];
  wins.forEach(([x, y, w, h], i) => { const on = eOut(prog(lt, 0.45 + i * 0.12, 0.7 + i * 0.12)); if (on <= 0) return;
    c.save(); c.globalAlpha = on; const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,214,160,0.85)'); g.addColorStop(1, 'rgba(226,150,80,0.6)');
    c.fillStyle = g; c.fillRect(x, y, w, h); glow(c, x + w / 2, y + h / 2, w, 0.25); c.restore(); });
  draw(c, [[[120, 1180], [960, 1180]], [[240, 1180], [240, 800], [880, 800], [880, 1180]], [[360, 800], [360, 600], [940, 600], [940, 800]],
    [[220, 800], [900, 800]], [[340, 600], [960, 600]], ...wins.map(([x, y, w, h]) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]),
    [[150, 1180], [150, 1060]], ...arcPts(150, 1010, 50, 0, Math.PI * 2, 24).map((pt, i, a) => i ? [a[i - 1], pt] : null).filter(Boolean)], p);
}
function insPlan(c, t, s) {
  const lt = t - s.a, d = s.b - s.a;
  const z = lerp(1.0, 1.06, prog(lt, 0, d));
  c.save(); c.translate(W / 2, 880); c.scale(z, z); c.translate(-W / 2, -880);
  const walls = [[[160, 560], [920, 560], [920, 1200], [160, 1200], [160, 560]], [[560, 560], [560, 850]], [[560, 940], [560, 1200]], [[160, 880], [420, 880]], [[560, 880], [920, 880]]];
  draw(c, walls, eOut(prog(lt, 0.05, 1.2)), C.ivory, 4);
  c.save(); c.globalAlpha = prog(lt, 0.9, 1.3); font(c, 700, 20); c.letterSpacing = '4px'; c.fillStyle = 'rgba(245,239,230,0.45)';
  c.fillText('BEDROOM', 190, 610); c.fillText('KITCHEN', 590, 610); c.fillText('STUDY', 190, 1170); c.fillText('LIVING', 590, 1170); c.restore();
  const pts = [[330, 700, 'bulb'], [470, 800, 'climate'], [760, 700, 'climate'], [700, 1050, 'bulb'], [860, 1120, 'curtain'], [300, 1040, 'bulb'], [600, 900, 'keypad']];
  const bl = prog(lt, 1.9, 2.7);
  if (bl > 0) { c.save(); c.strokeStyle = C.goldMid; c.lineWidth = 2.5; c.setLineDash([12, 9]); c.lineDashOffset = -lt * 40; c.beginPath();
    const order = [0, 1, 6, 2, 3, 4, 5]; order.forEach((k, i) => { const q = pts[k]; if (i === 0) c.moveTo(q[0], q[1]); else if (i / (order.length - 1) <= bl) c.lineTo(q[0], q[1]); }); c.stroke(); c.restore(); }
  pts.forEach(([x, y, k], i) => { const u = eBack(prog(lt, 1.2 + i * 0.12, 1.5 + i * 0.12)); if (u <= 0) return;
    c.save(); c.translate(x, y); c.scale(u, u); glow(c, 0, 0, 70, 0.35); c.beginPath(); c.arc(0, 0, 27, 0, Math.PI * 2); c.fillStyle = goldGrad(c, -27, -27, 27, 27); c.fill();
    icon(c, k, -15, -15, 30, '#1A130C'); c.restore(); });
  c.save(); c.globalAlpha = prog(lt, 0.3, 0.7); font(c, 700, 18); c.letterSpacing = '4px'; c.fillStyle = 'rgba(245,239,230,0.4)'; c.fillText('ILLUSTRATIVE LAYOUT', 160, 530); c.restore();
  c.restore();
}
const INS = { lamp: insLamp, dial: insDial, curtain: insCurtain, bus: insBus, house: insHouse, plan: insPlan };
function drawInsert(c, t, s) {
  const lt = t - s.a, zin = lerp(1.06, 1, eOutExpo(prog(lt, 0, 0.35)));
  c.save(); c.translate(W / 2, 880); c.scale(zin, zin); c.translate(-W / 2, -880);
  inkBg(c, lt); INS[s.k](c, t, s); c.restore();
  // quick warm flash on entry
  const f = 1 - prog(lt, 0, 0.12); if (f > 0) { c.fillStyle = `rgba(255,226,180,${0.18 * f})`; c.fillRect(0, 0, W, H); }
}

function endCard(c, t) {
  const lt = t - M.end;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0C0A08'); g.addColorStop(0.55, '#16110D'); g.addColorStop(1, '#090706');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const sx = lerp(-500, W + 500, prog(lt, 0, 2.6));
  c.save(); c.globalCompositeOperation = 'screen'; c.translate(sx, H / 2); c.rotate(-0.35);
  const sg = c.createLinearGradient(-240, 0, 240, 0); sg.addColorStop(0, 'rgba(226,181,119,0)'); sg.addColorStop(0.5, 'rgba(226,181,119,0.14)'); sg.addColorStop(1, 'rgba(226,181,119,0)');
  c.fillStyle = sg; c.fillRect(-240, -1400, 480, 2800); c.restore();
  c.strokeStyle = 'rgba(245,239,230,0.035)'; c.lineWidth = 1; for (let x = 60; x < W; x += 120) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  const u = eOutExpo(prog(lt, 0.05, 0.9));
  if (IMG.wordmark) { const lw = 780, lh = lw * IMG.wordmark.naturalHeight / IMG.wordmark.naturalWidth;
    c.save(); c.globalAlpha = u; c.filter = blur((1 - u) * 14); c.translate(W / 2, 880); c.scale(lerp(1.06, 1, u), lerp(1.06, 1, u)); c.drawImage(IMG.wordmark, -lw / 2, -lh / 2, lw, lh); c.restore(); }
  const u2 = eOut(prog(lt, 0.55, 1.1));
  c.save(); c.globalAlpha = u2; c.strokeStyle = goldGrad(c, W / 2 - 120, 0, W / 2 + 120, 0); c.lineWidth = 2;
  c.beginPath(); c.moveTo(W / 2 - 120 * u2, 1080); c.lineTo(W / 2 + 120 * u2, 1080); c.stroke(); c.restore();
  if (IMG.knx) { const kw = 230, kh = kw * IMG.knx.naturalHeight / IMG.knx.naturalWidth, cx = W / 2 - (kw + 56) / 2, cy = 1150;
    c.save(); c.globalAlpha = u2; rr(c, cx, cy, kw + 56, kh + 40, 20); c.fillStyle = '#FFFFFF'; c.fill(); c.drawImage(IMG.knx, W / 2 - kw / 2, cy + 20, kw, kh); c.restore(); }
}
function finish(c, t, frame) {
  if (frame.mode !== 'card') {
    const bg = c.createLinearGradient(0, 1380, 0, H); bg.addColorStop(0, 'rgba(9,7,5,0)'); bg.addColorStop(1, 'rgba(9,7,5,0.92)');
    c.fillStyle = bg; c.fillRect(0, 1380, W, H - 1380);
  }
  const v = c.createRadialGradient(W / 2, H * 0.42, H * 0.3, W / 2, H * 0.5, H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.42)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  const n = noise[frame.idx % noise.length];
  c.save(); c.globalAlpha = 0.08; c.globalCompositeOperation = 'overlay';
  c.fillStyle = c.createPattern(n, 'repeat'); c.setTransform(S * 2, 0, 0, S * 2, 0, 0); c.fillRect(0, 0, W / 2, H / 2); c.restore();
}
function roomState(t) {
  return { zoom: 1.12 + 0.03 * Math.sin(t * 0.15), px: 20 * Math.sin(t * 0.21), py: 10 * Math.cos(t * 0.17), light: 0.8, warm: 0.85, curtain: 0.25, t };
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
  IMG.logo = await loadImg('/assets/logos/trim/octonics_logo_reverse.png');
  IMG.knx = await loadImg('/assets/logos/KNX_logo.svg');
  for (const [fam, file, style, weight] of [['Satoshi', 'Satoshi-Black.ttf', 'normal', '900'], ['Satoshi', 'Satoshi-Bold.ttf', 'normal', '700'],
    ['Satoshi', 'Satoshi-Medium.ttf', 'normal', '500'], ['Instrument Serif', 'InstrumentSerif-Italic.ttf', 'italic', '400']])
    document.fonts.add(await new FontFace(fam, `url(/assets/fonts/${file})`, { style, weight }).load());
  await document.fonts.ready;
  prepCaptions(canvas.getContext('2d'));
  return { n: TL.n, fps: TL.fps };
}
export async function drawFrame(idx) {
  const t = idx / FPS, fr = { ...TL.frames[idx], idx };
  const c = ctx; c.setTransform(S, 0, 0, S, 0, 0); c.filter = 'none'; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = C.bg0; c.fillRect(0, 0, W, H);
  if (fr.mode === 'card') { endCard(c, t); finish(c, t, fr); return; }
  const ins = insertAt(t);
  if (ins) { drawInsert(c, t, ins); }
  else {
    const img = await loadImg(`/cache/fg/f_${String(idx).padStart(5, '0')}.png`);
    const seg = TL.segments.find(s => s.id === fr.seg);
    const since = t - seg.out[0], punch = idx === 0 ? lerp(1.12, 1, eOutExpo(prog(t, 0, 0.45))) : lerp(1.03, 1, eOut(prog(since, 0, 0.28)));
    c.save(); c.translate(W / 2, H * 0.4); c.scale(punch, punch); c.translate(-W / 2, -H * 0.4);
    if (fr.mode === 'matte') {
      drawRoom(roomX, roomState(t));
      c.save(); c.filter = blur(10); c.drawImage(roomC, 0, 0); c.restore();
      c.fillStyle = 'rgba(9,7,5,0.32)'; c.fillRect(0, 0, W, H);
    }
    drawPresenter(c, img, fr.mode, t, seg);
    if (fr.mode === 'real') { // pull the bright real room toward the film's darker, warmer world without hiding the light change
      const v = c.createRadialGradient(W / 2, H * 0.4, H * 0.22, W / 2, H * 0.45, H * 0.7);
      v.addColorStop(0, 'rgba(20,12,6,0)'); v.addColorStop(1, 'rgba(20,12,6,0.55)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
    }
    c.restore();
    alexa(c, t);
    logoChip(c, t, 'knx1', M.knx1 - 0.35, M.lighting1 - 0.08, IMG.knx, true);
    unify(c, t);
    logoChip(c, t, 'oct1', M.talk_octonics - 0.3, M.knx_wiring - 0.2, IMG.wordmark, false);
    phoneUI(c, t);
    logoChip(c, t, 'oct2', M.connect_octonics - 0.35, M.knx4 - 0.25, IMG.wordmark, false);
    logoChip(c, t, 'knx4', M.knx4 - 0.3, M.before - 0.15, IMG.knx, true);
  }
  captions(c, t);
  finish(c, t, fr);
  if (DEBUG && fr.fbox && !ins) { c.strokeStyle = '#ff3b3b'; c.lineWidth = 4; const f = fr.fbox; c.strokeRect(f[0], f[1], f[2] - f[0], f[3] - f[1]); }
}
