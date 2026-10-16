// Octonics x KNX reel. Every frame is a pure function of its index (no clocks, seeded randomness).
// All layout in a 1080x1920 world; S scales to preview size.
const W = 1080, H = 1920, FPS = 30;
const C = {
  bg0: '#0A0E14', bg1: '#101A27', white: '#F4F7FA', brand: '#0072BC', acc: '#4FA8E8',
  warm: [255, 184, 107], cool: [214, 228, 246],
};
let S = 1, TL = null, IMG = {}, canvas, ctx, roomC, roomX, tmpC, tmpX, fgC, fgX, noise = [];

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
    noCaps: [[0, 1.95], [4.7, 10.3], [12.2, 12.8], [34.2, 37]],
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
  if (mode === 'matte') {
    // cool rim from upper right: silhouette minus offset silhouette
    fgX.clearRect(0, 0, W, H); fgX.drawImage(img, 0, 0, W, H);
    fgX.globalCompositeOperation = 'source-in'; fgX.fillStyle = 'rgb(190,215,255)'; fgX.fillRect(0, 0, W, H);
    fgX.globalCompositeOperation = 'destination-out'; fgX.drawImage(img, -7, 5, W, H);
    fgX.globalCompositeOperation = 'source-over';
    c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.32; c.filter = blur(2); c.drawImage(fgC, 0, 0); c.restore();
  }
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
  glass(c, 0, 0, w, h, 28, { alpha: a });
  c.globalAlpha = a;
  rr(c, 24, 24, 64, 64, 18); c.fillStyle = 'rgba(0,114,188,0.35)'; c.fill();
  icon(c, kind, 32, 32, 48, C.white);
  font(c, 600, 26); c.fillStyle = 'rgba(244,247,250,0.72)'; c.fillText(title, 108, 50);
  font(c, 800, 40); c.fillStyle = C.white; c.fillText(value, 108, 92);
  if (level != null) {
    rr(c, 24, h - 38, w - 48, 10, 5); c.fillStyle = 'rgba(255,255,255,0.14)'; c.fill();
    rr(c, 24, h - 38, Math.max(10, (w - 48) * level), 10, 5);
    const g = c.createLinearGradient(24, 0, w - 24, 0); g.addColorStop(0, C.brand); g.addColorStop(1, C.acc);
    c.fillStyle = g; c.fill();
  }
  c.restore();
}

// ---------- typography ----------
function title(c, text, cx, cy, size, t, t0, t1, o = {}) {
  const a = win(t, t0, t1, 0.35, 0.22); if (a <= 0) return;
  const u = eOutExpo(prog(t, t0, t0 + 0.45));
  c.save(); font(c, o.weight || 800, size); c.letterSpacing = `${(o.track ?? -0.01) * size}px`;
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  // mask reveal from baseline
  const tw = c.measureText(text).width;
  c.beginPath(); c.rect(cx - tw / 2 - 40, cy - size * 1.05, tw + 80, size * 1.3); c.clip();
  c.translate(0, (1 - u) * size * 0.9);
  c.globalAlpha = a;
  c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 24 * S; c.shadowOffsetY = 6 * S;
  if (o.parts) { // colored parts: [[text,color],...]
    let x = cx - tw / 2; c.textAlign = 'left';
    for (const [s, col] of o.parts) { c.fillStyle = col; c.fillText(s, x, cy); x += c.measureText(s).width; }
  } else { c.fillStyle = o.color || C.white; c.fillText(text, cx, cy); }
  c.restore();
}
const KEY = new Set(['dream', 'home?', 'smart', 'knx', 'knx.', 'intelligent', 'truly', 'phone.', 'advanced', 'lighting,', 'ac', 'curtains,', 'single', 'simple', 'application.', 'wiring,', 'planning', 'day', 'one', 'smarter,', 'easy', 'comfortable.', 'octonics.', 'system.', 'automation']);
function captions(c, t) {
  for (const r of CUE.noCaps) if (t >= r[0] && t < r[1]) return;
  const g = TL.captions.find(g => t >= g.t0 - 0.05 && t < g.t1 + 0.3); if (!g) return;
  const gs = TL.segments.find(s => s.id === g.words[0].seg); if (t >= gs.out[1]) return;
  const out = 1 - prog(t, g.t1 + 0.15, g.t1 + 0.3);
  const size = 66, y = 1360;
  c.save(); font(c, 800, size); c.letterSpacing = '-0.5px'; c.textBaseline = 'alphabetic';
  const words = g.words.map(w => ({ ...w, wd: c.measureText(w.w + ' ').width }));
  const total = words.reduce((s, w) => s + w.wd, 0) - c.measureText(' ').width;
  // soft backing for legibility
  c.save(); c.globalAlpha = 0.5 * out; const bg = c.createRadialGradient(W / 2, y - 22, 10, W / 2, y - 22, total * 0.7 + 60);
  bg.addColorStop(0, 'rgba(6,9,14,0.75)'); bg.addColorStop(1, 'rgba(6,9,14,0)'); c.fillStyle = bg;
  c.fillRect(W / 2 - total, y - 140, total * 2, 220); c.restore();
  let x = W / 2 - total / 2;
  for (const w of words) {
    const u = eOut(prog(t, w.t0 - 0.06, w.t0 + 0.16));
    if (u > 0) {
      c.save(); c.globalAlpha = u * out;
      c.filter = blur((1 - u) * 10);
      const k = KEY.has(w.w.toLowerCase());
      c.fillStyle = k ? C.acc : C.white;
      c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 16 * S; c.shadowOffsetY = 4 * S;
      c.translate(0, (1 - u) * 18);
      c.fillText(w.w, x, y); c.restore();
    }
    x += w.wd;
  }
  c.restore();
}

// ---------- scene pieces ----------
function hook(c, t) {
  // headline behind subject is drawn in behindText(); supporting line here
  if (t >= 1.95) return;
  title(c, 'BUILDING YOUR', W / 2, 340, 84, t, 0.3, 1.95, { track: -0.02 });
  title(c, 'DREAM HOME?', W / 2, 466, 124, t, 0.42, 1.95, { parts: [['DREAM ', C.acc], ['HOME?', C.white]], track: -0.02 });
  title(c, 'PLAN YOUR SMART HOME BEFORE THE WIRING.', W / 2, 540, 32, t, 0.95, 1.95, { weight: 600, track: 0.06, color: 'rgba(244,247,250,0.9)' });
}
function behindText(c, t) {}
function alexa(c, t) {
  const a = win(t, M.hey_alexa - 0.1, 7.53, 0.3, 0.15);
  if (a > 0) {
    const pw = 520, ph = 112, px = W / 2 - pw / 2, py = 300;
    glass(c, px, py, pw, ph, 56, { alpha: a, dark: true });
    c.save(); c.globalAlpha = a;
    // listening rings
    for (let i = 0; i < 3; i++) {
      const ph2 = ((t * 1.2 + i / 3) % 1);
      c.beginPath(); c.arc(px + 58, py + 56, 26 + ph2 * 26, 0, Math.PI * 2);
      c.strokeStyle = `rgba(79,168,232,${0.5 * (1 - ph2)})`; c.lineWidth = 2; c.stroke();
    }
    c.beginPath(); c.arc(px + 58, py + 56, 26, 0, Math.PI * 2); c.fillStyle = C.brand; c.fill();
    icon(c, 'mic', px + 40, py + 38, 36, '#fff');
    const s2 = prog(t, M.dim - 0.05, M.dim + 0.2);
    font(c, 800, 40); c.letterSpacing = '1px'; c.textBaseline = 'middle';
    c.globalAlpha = a * (1 - s2); c.fillStyle = C.white; c.fillText('HEY, ALEXA', px + 112, py + 58);
    c.globalAlpha = a * s2; c.fillText('DIM THE LIGHT', px + 112, py + 58);
    // tiny waveform
    c.globalAlpha = a * 0.9;
    for (let i = 0; i < 9; i++) { const hh = 6 + 18 * Math.abs(Math.sin(t * 9 + i * 1.3)) * (t < M.light + 0.3 ? 1 : 0.2); c.fillStyle = C.acc; rr(c, px + pw - 120 + i * 11, py + 56 - hh / 2, 5, hh, 2.5); c.fill(); }
    c.restore();
  }
  // dimmer: 100 -> 20 on "twenty", locks, holds through slow-mo
  const d = win(t, M.twenty - 0.12, 10.25, 0.3, 0.25);
  if (d > 0) {
    const lv = lerp(1, 0.2, eInOut(prog(t, M.twenty, M.twenty + 0.75)));
    const cw = 600, chh = 300, cx = W / 2 - cw / 2, cy = 250;
    c.save(); c.translate(W / 2, cy + chh / 2); const sc = lerp(0.92, 1, eBack(prog(t, M.twenty - 0.12, M.twenty + 0.25))); c.scale(sc, sc); c.translate(-W / 2, -(cy + chh / 2));
    glass(c, cx, cy, cw, chh, 36, { alpha: d, dark: true });
    c.globalAlpha = d;
    icon(c, 'bulb', cx + 34, cy + 34, 44, mix([214, 228, 246], C.warm, prog(t, 8.5, 10)).reduce((s, v, i) => s + (i ? ',' : '') + v, 'rgb(') + ')');
    font(c, 600, 28); c.fillStyle = 'rgba(244,247,250,0.75)'; c.fillText('LIVING ROOM LIGHTS', cx + 96, cy + 66);
    font(c, 800, 150); c.fillStyle = C.white; c.letterSpacing = '-4px';
    c.fillText(`${Math.round(lv * 100)}%`, cx + 34, cy + 222);
    rr(c, cx + 34, cy + 252, cw - 68, 14, 7); c.fillStyle = 'rgba(255,255,255,0.14)'; c.fill();
    rr(c, cx + 34, cy + 252, (cw - 68) * lv, 14, 7); const g = c.createLinearGradient(cx, 0, cx + cw, 0);
    g.addColorStop(0, rgba(C.warm, 1)); g.addColorStop(1, '#FFE2B8'); c.fillStyle = g; c.fill();
    // lock tick
    const lk = eBack(prog(t, M.twenty + 0.78, M.twenty + 1.05));
    if (lk > 0) { c.save(); c.translate(cx + cw - 70, cy + 70); c.scale(lk, lk); c.beginPath(); c.arc(0, 0, 26, 0, Math.PI * 2); c.fillStyle = C.brand; c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.moveTo(-11, 1); c.lineTo(-3, 9); c.lineTo(12, -8); c.stroke(); c.restore(); }
    c.restore();
  }
}
function knxLockup(c, t) {
  const t0 = M.knx - 0.45, t1 = 12.8;
  const a = win(t, t0, t1, 0.35, 0.12); if (a <= 0 || !IMG.knx) return;
  const u = eOutExpo(prog(t, t0, t0 + 0.6));
  const cw = 520, ch = 230, cx = W / 2 - cw / 2, cy = 270 + (1 - u) * 40;
  glass(c, cx, cy, cw, ch, 34, { alpha: a, light: true });
  const lw = 380, lh = lw * IMG.knx.naturalHeight / IMG.knx.naturalWidth;
  c.save(); c.globalAlpha = a; c.drawImage(IMG.knx, W / 2 - lw / 2, cy + ch / 2 - lh / 2, lw, lh); c.restore();
  title(c, 'SMART HOME AUTOMATION', W / 2, cy + ch + 74, 44, t, t0 + 0.15, t1, { track: 0.08, weight: 700 });
}
function phoneUI(c, t) {
  const t0 = M.not_just - 0.1, t1 = 16.84;
  const a = win(t, t0, t1, 0.4, 0.25); if (a <= 0) return;
  const u = eOutExpo(prog(t, t0, t0 + 0.7));
  const pw = 360, ph = 720, px = 650 + (1 - u) * 260, py = 520;
  c.save(); c.translate(px + pw / 2, py + ph / 2); c.transform(1, -0.05, 0, 1, 0, 0); c.rotate(-0.06 * (1 - u) + 0.03); c.translate(-pw / 2, -ph / 2);
  glass(c, 0, 0, pw, ph, 54, { alpha: a });
  c.globalAlpha = a;
  rr(c, 14, 14, pw - 28, ph - 28, 42); c.fillStyle = 'rgba(8,12,18,0.72)'; c.fill();
  rr(c, pw / 2 - 50, 26, 100, 22, 11); c.fillStyle = '#000'; c.fill();
  font(c, 700, 30); c.fillStyle = C.white; c.fillText('Home', 40, 104);
  font(c, 500, 20); c.fillStyle = 'rgba(244,247,250,0.6)'; c.fillText('Living room', 40, 134);
  const rows = [['bulb', 'Lights', true], ['climate', 'Climate', true], ['curtain', 'Curtains', false], ['home', 'Scenes', true]];
  rows.forEach(([k, n, on], i) => {
    const ry = 170 + i * 118, ra = eOut(prog(t, t0 + 0.35 + i * 0.08, t0 + 0.7 + i * 0.08));
    c.save(); c.globalAlpha = a * ra; rr(c, 30, ry, pw - 60, 100, 22); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fill();
    icon(c, k, 48, ry + 28, 44, C.white); font(c, 600, 26); c.fillStyle = C.white; c.fillText(n, 112, ry + 60);
    toggle(c, pw - 120, ry + 32, on); c.restore();
  });
  c.restore();
  title(c, 'MORE THAN PHONE CONTROL', W / 2, 330, 60, t, t0 + 0.3, t1, { track: 0.01 });
}
function featureCards(c, t) {
  const t1 = M.single - 0.85;      // cards leave for curtain insert
  const conv0 = M.single - 0.85, conv1 = M.single + 0.2; // then converge into one panel
  const cards = [
    { k: 'bulb', n: 'LIGHTING', v: 'Warm 40%', lvl: 0.4, t0: M.ac - 0.05 },
    { k: 'climate', n: 'CLIMATE', v: '22°C  Cool', lvl: 0.55, t0: M.ac + 0.05 },
    { k: 'curtain', n: 'CURTAINS', v: 'Open 100%', lvl: 1, t0: M.curtains - 0.05 },
  ];
  if (t >= cards[0].t0 && t < CUE.curtainInsert[0]) {
    title(c, 'CLIMATE. CURTAINS. LIGHTING.', W / 2, 330, 56, t, M.ac, CUE.curtainInsert[0], { track: 0.01 });
    cards.forEach((cd, i) => {
      const u = eBack(prog(t, cd.t0, cd.t0 + 0.4)), a = clamp(prog(t, cd.t0, cd.t0 + 0.2)) * (1 - prog(t, CUE.curtainInsert[0] - 0.12, CUE.curtainInsert[0]));
      featureCard(c, 610, 470 + i * 196, 420, 170, cd.k, cd.n, cd.v, cd.lvl, a, lerp(0.85, 1, u));
    });
  }
  // unified panel
  const ua = win(t, CUE.curtainInsert[1], 23.57, 0.3, 0.12);
  if (ua > 0) {
    const u = eOutExpo(prog(t, CUE.curtainInsert[1], conv1 + 0.2));
    const pw = 450, ph = 500, px = 600, py = 470;
    // cards fly from the right stack into the panel
    glass(c, px, py, pw, ph, 40, { alpha: ua * u });
    c.save(); c.globalAlpha = ua;
    cards.forEach((cd, i) => {
      const sx = 610, sy = 470 + i * 196, ex = px + 30, ey = py + 120 + i * 128;
      const uu = eInOut(prog(t, CUE.curtainInsert[1] + i * 0.06, conv1 + i * 0.06));
      const x = lerp(sx, ex, uu), y = lerp(sy, ey, uu), w = lerp(420, pw - 60, uu), h = lerp(170, 108, uu);
      rr(c, x, y, w, h, 22); c.fillStyle = `rgba(255,255,255,${lerp(0.10, 0.07, uu)})`; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1.2; c.stroke();
      icon(c, cd.k, x + 22, y + h / 2 - 22, 44, C.white);
      font(c, 700, 25); c.fillStyle = C.white; c.textBaseline = 'middle'; c.fillText(cd.n, x + 80, y + h / 2);
      font(c, 500, 21); c.fillStyle = 'rgba(244,247,250,0.7)'; c.textAlign = 'right'; c.fillText(cd.v, x + w - 26, y + h / 2); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    });
    const ha = eOut(prog(t, conv1 - 0.1, conv1 + 0.3));
    c.globalAlpha = ua * ha; icon(c, 'home', px + 30, py + 34, 46, C.acc);
    font(c, 800, 34); c.fillStyle = C.white; c.fillText('ONE APP', px + 92, py + 70);
    font(c, 500, 22); c.fillStyle = 'rgba(244,247,250,0.6)'; c.textAlign = 'right'; c.fillText('All systems', px + pw - 30, py + 68); c.textAlign = 'left';
    c.restore();
    title(c, 'ONE CONNECTED EXPERIENCE', W / 2, 330, 58, t, conv1 - 0.1, 23.57, { track: 0.01 });
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
  c.save(); c.globalAlpha = a * prog(lt, 0.2, 0.6); font(c, 600, 22); c.letterSpacing = '4px'; c.fillStyle = 'rgba(244,247,250,0.5)';
  c.textAlign = 'center'; c.fillText('CONCEPT ILLUSTRATION', W / 2, 1450); c.restore();
}
function finalSlams(c, t) {
  const lines = [['PLAN SMART.', M.plan], ['BUILD SMART.', M.build], ['CHOOSE OCTONICS.', M.choose]];
  lines.forEach(([s, t0], i) => {
    const a = win(t, t0 - 0.06, 36.8, 0.18, 0.1); if (a <= 0) return;
    const u = eOutExpo(prog(t, t0 - 0.06, t0 + 0.3));
    c.save(); font(c, 800, i === 2 ? 86 : 72); c.letterSpacing = '-1px'; c.textAlign = 'center';
    c.globalAlpha = a; c.translate(W / 2, 300 + i * 100); c.scale(lerp(1.25, 1, u), lerp(1.25, 1, u)); c.filter = blur((1 - u) * 12);
    c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 24 * S;
    if (i === 2) { const w1 = c.measureText('CHOOSE ').width, w2 = c.measureText('OCTONICS.').width, x0 = -(w1 + w2) / 2; c.textAlign = 'left';
      c.fillStyle = C.white; c.fillText('CHOOSE ', x0, 0); c.fillStyle = C.acc; c.fillText('OCTONICS.', x0 + w1, 0); }
    else { c.fillStyle = C.white; c.fillText(s, 0, 0); }
    c.restore();
  });
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
export async function init(scale) {
  S = scale;
  TL = await (await fetch('/cache/timeline.json')).json(); buildCues();
  canvas = document.getElementById('c'); canvas.width = Math.round(W * S); canvas.height = Math.round(H * S);
  ctx = canvas.getContext('2d');
  const mk = () => { const cc = document.createElement('canvas'); cc.width = W; cc.height = H; return [cc, cc.getContext('2d')]; };
  [roomC, roomX] = mk(); [fgC, fgX] = mk(); [tmpC, tmpX] = mk();
  for (let k = 0; k < 6; k++) { const n = document.createElement('canvas'); n.width = n.height = 256; const nx = n.getContext('2d'); const d = nx.createImageData(256, 256); const r = rng(100 + k);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - 0.5) * 200; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } nx.putImageData(d, 0, 0); noise.push(n); }
  IMG.wordmark = await loadImg('/assets/logos/trim/octonics_wordmark_reverse.png');
  IMG.knx = await loadImg('/assets/logos/KNX_logo.svg');
  await document.fonts.load('800 64px Inter'); await document.fonts.load('600 32px Inter'); await document.fonts.load('500 32px Inter');
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
    behindText(c, t);
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
    title(c, 'PLAN BEFORE YOU WIRE', W / 2, 330, 72, t, CUE.planFull[0] + 0.15, 28.3, { parts: [['PLAN BEFORE YOU ', C.white], ['WIRE', C.acc]] });
  }
  if (ins === 'lightInsert') { title(c, 'INTELLIGENT LIGHTING', W / 2, 330, 62, t, CUE.lightInsert[0], CUE.lightInsert[1]); featureCard(c, W / 2 - 230, 1500, 460, 170, 'bulb', 'LIVING ROOM', `Warm ${Math.round(lerp(100, 40, prog(t, ...CUE.lightInsert)))}%`, lerp(1, 0.4, prog(t, ...CUE.lightInsert)), eOut(prog(t, CUE.lightInsert[0], CUE.lightInsert[0] + 0.2))); }
  if (ins === 'curtainInsert') { featureCard(c, W / 2 - 230, 1500, 460, 170, 'curtain', 'CURTAINS', `Open ${Math.round(100 * eInOut(prog(t, ...CUE.curtainInsert)))}%`, eInOut(prog(t, ...CUE.curtainInsert)), eOut(prog(t, CUE.curtainInsert[0], CUE.curtainInsert[0] + 0.2))); }
  // overlays
  hook(c, t); alexa(c, t); knxLockup(c, t); phoneUI(c, t); featureCards(c, t); finalSlams(c, t);
  captions(c, t);
  finish(c, t, fr);
}
