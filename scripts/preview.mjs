// Fast preview loop: node scripts/preview.mjs <from> <to> [--fps 8] [--scale 0.25] [--cols 6]
// Renders the range small and tiles every frame into renders/previews/sheet_<from>-<to>.jpg with timestamps.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const [from, to] = process.argv.slice(2, 4).map(Number);
const opt = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const fps = opt('fps') || 8, scale = opt('scale') || 0.25, cols = opt('cols') || 6;
const dir = `cache/prev_${from}-${to}`; fs.rmSync(dir, { recursive: true, force: true });
execFileSync('node', ['src/render.js', '--from', from, '--to', to, '--fps', fps, '--scale', scale, '--out', dir, '--jpg'], { stdio: 'inherit' });
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).sort();
const labelled = files.flatMap(f => ['-label', (parseInt(f.slice(2, 7)) / 30).toFixed(2) + 's', `${dir}/${f}`]);
const out = `renders/previews/sheet_${from}-${to}.jpg`;
execFileSync('montage', [...labelled, '-tile', `${cols}x`, '-geometry', '+3+3', '-background', '#1b1b1b', '-fill', '#ffd84a', '-pointsize', '14', out]);
console.log(out);
