// Deterministic frame renderer (headless Chromium) -> ffmpeg.
// node src/render.js --from <s> --to <s> [--fps 30] [--scale 1] --out <dir|file.mp4> [--jpg] [--audio cache/mix.wav]
//                    [--stills 1.2,5.0] [--sheet] [--cols 6] [--q 0.92]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return acc; }, []));
const fps = +(args.fps || 30), scale = +(args.scale || 1), q = +(args.q || 0.92);
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: Math.round(1080 * scale), height: Math.round(1920 * scale) } });
page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/src/index.html`);
await page.waitForFunction(() => window.__ready);
const info = await page.evaluate(s => window.__init(s), scale);
const outFps = 30; // timeline is 30 fps; --fps < 30 skips frames for previews
const f0 = Math.max(0, Math.round((+args.from || 0) * outFps));
const f1 = Math.min(info.n - 1, Math.round((args.to != null ? +args.to : info.n / outFps) * outFps) - 1);
const step = Math.max(1, Math.round(outFps / fps));
const frames = args.stills ? String(args.stills).split(',').map(s => Math.min(info.n - 1, Math.round(+s * outFps)))
  : Array.from({ length: Math.floor((f1 - f0) / step) + 1 }, (_, k) => f0 + k * step);

const grab = async i => Buffer.from((await page.evaluate(([i, q]) => window.__draw(i, q), [i, q])).split(',')[1], 'base64');
const t0 = Date.now();
if (args.stills || args.jpg) {
  const dir = path.resolve(ROOT, args.out || 'renders/previews/stills'); fs.mkdirSync(dir, { recursive: true });
  for (const i of frames) fs.writeFileSync(path.join(dir, `f_${String(i).padStart(5, '0')}.jpg`), await grab(i));
  console.log(`wrote ${frames.length} stills to ${dir}`);
} else {
  const out = path.resolve(ROOT, args.out); fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', String(fps), '-i', '-'];
  if (args.audio) ff.push('-ss', String(f0 / outFps), '-t', String(frames.length / fps), '-i', path.resolve(ROOT, args.audio));
  ff.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', String(args.crf || 18), '-preset', args.preset || 'medium', '-r', String(fps));
  if (args.audio) ff.push('-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest');
  ff.push('-movflags', '+faststart', out);
  const p = spawn('ffmpeg', ff, { stdio: ['pipe', 'inherit', 'inherit'] });
  for (const [k, i] of frames.entries()) {
    const buf = await grab(i);
    if (!p.stdin.write(buf)) await new Promise(r => p.stdin.once('drain', r));
    if (k % 60 === 0) console.log(`frame ${i} (${k + 1}/${frames.length}) ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  p.stdin.end(); await new Promise(r => p.on('close', r));
  console.log(`wrote ${out}`);
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await browser.close(); server.close();
