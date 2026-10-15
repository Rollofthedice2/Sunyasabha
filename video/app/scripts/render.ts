// Offline render: draws frames in Node, quantizes, streams raw RGBA to ffmpeg (nearest-neighbour upscale).
// node scripts/render.ts --scene film --from 0 --to 30 [--fps 60] [--scale 3] [--crf 14] [--workers N] [--noaudio] [--out ../out/clip.mp4]
import { spawn, type ChildProcess } from 'node:child_process';
import { writeFileSync, rmSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { Frame, W, H } from '../src/engine/fb.ts';
import { post, type PostOpts } from '../src/engine/post.ts';
import { initMusic } from '../src/engine/music.ts';
import { cancelWorkers, waitForDrain, watchProcess } from './render-process.ts';

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1]! : d; };
const ROOT = path.resolve(import.meta.dirname, '../../..');
const DATA = path.resolve(import.meta.dirname, '../../data');
initMusic(JSON.parse(readFileSync(path.join(DATA, 'audio.json'), 'utf8')), JSON.parse(readFileSync(path.join(DATA, 'envelopes.json'), 'utf8')));

const scene = opt('scene', 'throne');
const from = +opt('from', '0'), to = +opt('to', '10'), fps = +opt('fps', '60'), scale = +opt('scale', '3');
const out = path.resolve(opt('out', path.join(ROOT, `video/out/${scene}_${from}-${to}.mp4`)));
mkdirSync(path.dirname(out), { recursive: true });
const flag = (k: string) => argv.includes(`--${k}`);
const workers = +opt('workers', '1');
// SOUNDTRACK=<path from the repository root> overrides the audio muxed into the video
const wav = path.resolve(ROOT, process.env.SOUNDTRACK || 'video/audio/soundtrack.flac');
// prefer a WinGet-installed ffmpeg on Windows, else the one on PATH
const FF = existsSync(path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft/WinGet/Links/ffmpeg.exe'))
  ? path.join(process.env.LOCALAPPDATA!, 'Microsoft/WinGet/Links/ffmpeg.exe') : 'ffmpeg';
if (workers > 1) {
  // split into segments on frame boundaries, render each in its own process, concat, then mux the audio
  const total = Math.round((to - from) * fps);
  const parts: string[] = [];
  const t0w = performance.now();
  const children: ChildProcess[] = [];
  try {
    const jobs = Array.from({ length: workers }, (_, w) => {
      const a = from + Math.round((total * w) / workers) / fps, b = from + Math.round((total * (w + 1)) / workers) / fps;
      const part = out.replace(/\.mp4$/, `.part${w}.mp4`);
      parts.push(part);
      const p = spawn(process.execPath, [import.meta.filename, '--scene', scene, '--from', String(a), '--to', String(b), '--fps', String(fps), '--scale', String(scale), '--crf', opt('crf', '14'), '--noaudio', '--out', part], { stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true, detached: process.platform !== 'win32' });
      children.push(p);
      return watchProcess(p, `worker ${w}`).done;
    });
    await Promise.all(jobs);
  } catch (error) {
    try { await cancelWorkers(children); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Render worker failed; cleanup was incomplete'); }
    throw error;
  }
  const list = out.replace(/\.mp4$/, '.parts.txt');
  writeFileSync(list, parts.map((p) => `file '${p.split(path.sep).join('/').replace(/'/g, "'\\''")}'`).join('\n'));
  const mux = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-ss', String(from), '-t', String(to - from), '-i', wav,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', `apad=whole_dur=${to - from},atrim=duration=${to - from}`,
    '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', out], { stdio: 'inherit', windowsHide: true });
  // Keep both the parts and concat list if FFmpeg cannot start or the mux fails.
  await watchProcess(mux, 'FFmpeg mux').done;
  for (const p of parts) rmSync(p, { force: true });
  rmSync(list, { force: true });
  console.log(`wrote ${out} with ${workers} workers in ${((performance.now() - t0w) / 1000).toFixed(1)} s`);
  process.exit(0);
}
const mod = await import(`../src/scenes/${scene}.ts`);
const draw = (mod[`draw${scene[0]!.toUpperCase()}${scene.slice(1)}`] ?? Object.values(mod).find((v) => typeof v === 'function')) as (fb: Frame, t: number) => void;
const scenePostOptions = typeof mod.scenePostOptions === 'function'
  ? mod.scenePostOptions as (fb: Frame, t: number) => PostOpts : undefined;

const args = ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', 'pipe:0',
  ...(flag('noaudio') ? [] : ['-ss', String(from), '-t', String(to - from), '-i', wav]),
  '-vf', `scale=${W * scale}:${H * scale}:flags=neighbor,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', opt('crf', '14'),
  '-tune', 'animation', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  // The soundtrack may end a few frames before the edit: pad only the missing tail and keep every rendered
  // frame (-shortest can drop buffered video frames when the audio ends during encoder reordering).
  ...(flag('noaudio') ? [] : ['-af', `apad=whole_dur=${to - from},atrim=duration=${to - from}`, '-c:a', 'aac', '-b:a', '320k']), '-movflags', '+faststart', out];
const ff = spawn(FF, args, { stdio: ['pipe', 'inherit', 'inherit'], windowsHide: true });
const encoder = watchProcess(ff, 'FFmpeg encoder');

const fb = new Frame();
const rgba = new Uint8Array(W * H * 4);
const n = Math.round((to - from) * fps);
const t0 = performance.now();
try {
  for (let i = 0; i < n; i++) {
    if (encoder.failure) throw encoder.failure;
    if (encoder.closed) throw new Error('FFmpeg encoder closed before all frames were written');
    const t = from + i / fps;
    draw(fb, t);
    post(fb, rgba, { dither: 0.6, ...scenePostOptions?.(fb,t) });
    if (!ff.stdin.write(Buffer.from(rgba))) await waitForDrain(encoder);
    if (i % 60 === 0 && !flag('noaudio')) process.stdout.write(`\r${i}/${n}  ${((performance.now() - t0) / (i + 1)).toFixed(0)} ms/frame   `);
  }
  ff.stdin.end();
  await encoder.done;
} catch (error) {
  // A drawing/input error must not leave this worker's encoder running.
  ff.stdin.destroy();
  ff.kill();
  await encoder.done.catch(() => {});
  throw error;
}
console.log(`\nwrote ${out} (${n} frames, ${((performance.now() - t0) / 1000).toFixed(1)} s)`);
