// The queue outside the club in the intro: complete drawn figures on a clean wall plate, each playing its own small
// actions at fixed song times, with wet-ground reflections, contact shadows and vapour exhales. The layout is
// intro_queue.scene.json; loadIntroQueue returns null when that manifest is absent or disabled.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Frame } from '../engine/fb.ts';
import { drawAnimAt, frameAt, loadAnim, type Anim } from '../engine/anim.ts';
import { loadPlate, type Plate } from '../engine/plate.ts';

interface TrackSpec { animation: string; x: number; y: number; shadowOffsets?: number[] }
interface ExhaleSpec {
  animation: string;
  from: number;
  to: number;
  lifetime: number;
  // mouth position measured in the drawing, in pixels
  samples: { songTime: number; mouth: [number, number] }[];
}
interface QueueManifest { enabled: boolean; background: string; tracks: TrackSpec[]; reflections?: boolean; exhales?: ExhaleSpec[] }
export interface IntroQueue { background: Plate; tracks: (TrackSpec & { anim: Anim })[]; reflections: boolean; exhales: ExhaleSpec[] }
let queue: IntroQueue | null | undefined;
const MANIFEST = path.resolve(import.meta.dirname, '../../assets/plates/intro_queue.scene.json');

export function loadIntroQueue(): IntroQueue | null {
  if (queue !== undefined) return queue;
  if (!existsSync(MANIFEST)) return queue = null;
  const spec = JSON.parse(readFileSync(MANIFEST, 'utf8')) as QueueManifest;
  if (!spec.enabled) return queue = null;
  if (!spec.background || !Array.isArray(spec.tracks) || !spec.tracks.length)
    throw new Error('Enabled intro queue needs a clean background and complete figure tracks');
  const background = loadPlate(spec.background);
  if (background.w !== 640 || background.h !== 360)
    throw new Error('Intro queue background must preserve the 640x360 wall composition');
  const tracks = spec.tracks.map(track => {
    if (!Number.isFinite(track.x) || !Number.isFinite(track.y) || track.shadowOffsets?.some(x => !Number.isFinite(x)))
      throw new Error('Invalid queue placement');
    // a pair's <name>_pp drawings already pin each person's own feet in place, so the whole-drawing foot fixes below
    // are skipped for them
    const ppName = `${track.animation}_pp`, usePP = existsSync(path.resolve(import.meta.dirname, `../../assets/plates/${ppName}.anim.json`));
    const anim = loadAnim(usePP ? ppName : track.animation), first = anim.frames[0]; if (usePP) PERSON_PINNED.add(anim);
    if (!anim.songTimes || !first?.anchor) throw new Error(`${track.animation} needs absolute songTimes and a fixed stage anchor`);
    for (const frame of anim.frames)
      if (frame.w !== first.w || frame.h !== first.h || !frame.anchor ||
          frame.anchor[0] !== first.anchor[0] || frame.anchor[1] !== first.anchor[1])
        throw new Error(`${track.animation} changes its canvas/anchor between drawings`);
    return { ...track, anim };
  });
  const exhales = spec.exhales ?? [];
  for (const exhale of exhales) {
    if (!tracks.some(t => t.animation === exhale.animation) || !Number.isFinite(exhale.from) ||
        !Number.isFinite(exhale.to) || !(exhale.to > exhale.from) || !Number.isFinite(exhale.lifetime) ||
        !(exhale.lifetime > 0) || !exhale.samples?.length ||
        exhale.samples.some((s, i) => !Number.isFinite(s.songTime) || s.mouth.length !== 2 ||
          !s.mouth.every(Number.isFinite) || (i > 0 && s.songTime <= exhale.samples[i-1]!.songTime)))
      throw new Error('Queue exhale needs a valid track, interval and measured mouth coordinates');
  }
  return queue = { background, tracks, reflections: spec.reflections ?? false, exhales };
}

function drawExhales(fb: Frame, layer: IntroQueue, t: number, light: number) {
  for (const e of layer.exhales) {
    if (t < e.from || t > e.to + e.lifetime) continue;
    const track = layer.tracks.find(track => track.animation === e.animation)!;
    const anchor = track.anim.frames[0]!.anchor!;
    // each wisp keeps the position where it left the mouth; later head drawings do not drag it along
    const count = Math.ceil((e.to-e.from)*28);
    for (let k=0;k<count;k++) {
      const born=e.from+k/28, age=t-born;
      if(age<0 || age>=e.lifetime)continue;
      let sample=e.samples[0]!;
      for(const s of e.samples)if(s.songTime<=born+1e-7)sample=s;
      const u=age/e.lifetime, r=1.1+3.6*u;
      const cx=track.x-anchor[0]+sample.mouth[0]+13*age;
      const cy=track.y-anchor[1]+sample.mouth[1]-7*age+Math.sin(k*1.7+age*3)*1.1*u;
      const opacity=.065*Math.min(1,age/.06)*(1-u)**1.4;
      for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++)for(let x=Math.floor(cx-r*1.45);x<=Math.ceil(cx+r*1.45);x++) {
        const d=((x-cx)/(r*1.45))**2+((y-cy)/r)**2;
        if(d<1)fb.set(x,y,[.28*light,.30*light,.34*light],opacity*(1-d)**1.5);
      }
    }
  }
}

// The left pair, the hooded figure and the right pair replay their own drawings as occasional actions: forward, later
// in reverse (back to the start pose), later forward again, staggered across the intro. The talk/vape pair plays its
// single action once.
const ACTIONS: Record<string, [number, 'f' | 'r'][]> = {
  intro_queue_left_pair: [[0.4, 'f'], [5.2, 'r'], [9.4, 'f']],
  intro_queue_hood: [[3.6, 'f'], [7.6, 'r'], [11.4, 'f']],
  intro_queue_right_pair: [[2.1, 'f'], [7.4, 'r'], [11.8, 'f']],
};
export function queueTime(track: { animation: string; anim: { songTimes?: number[] } }, t: number) {
  const sch = ACTIONS[track.animation], st = track.anim.songTimes;
  if (!sch || !st) return t;
  const a0 = st[1]!, a1 = st[st.length - 1]!, D = a1 - a0;
  let ev: [number, 'f' | 'r'] | undefined;
  for (const e of sch) if (e[0] <= t) ev = e;
  // before the first action: the start pose
  if (!ev) return 0;
  const u = Math.min(t - ev[0], D);
  if (ev[1] === 'f') return a0 + u;
  // a reverse action ends back on the start pose
  const tau = a1 - u; return tau < a0 + 1e-6 ? 0 : tau;
}

// Planted feet must not slide: each drawing is translated rigidly so its feet (mean x of the bottom 6 opaque rows) sit
// where the first drawing's do.
const footShift = new WeakMap<Plate, number>(), footRef = new WeakMap<Anim, number>();
function feetX(p: Plate) {
  const [x0, , x1, y1] = p.bbox; let s = 0, n = 0;
  for (let y = y1 - 5; y <= y1; y++) for (let x = x0; x <= x1; x++) if (p.a[y * p.w + x]) { s += x; n++; }
  return n ? s / n : 0;
}
const PERSON_PINNED = new WeakSet<Anim>();
function glideFix(anim: Anim, plate: Plate) {
  if (PERSON_PINNED.has(anim)) return 0;
  if (!footRef.has(anim)) footRef.set(anim, feetX(anim.frames[0]!));
  if (!footShift.has(plate)) footShift.set(plate, Math.round(footRef.get(anim)! - feetX(plate)));
  return footShift.get(plate)!;
}
// The same rule vertically for the tracks with occasional actions: each drawing's lowest opaque row sits where the
// first drawing's does, so the soles do not hop between source-sheet rows.
function soleFix(track: { animation: string; anim: Anim }, plate: Plate) {
  if (!ACTIONS[track.animation] || PERSON_PINNED.has(track.anim)) return 0;
  return track.anim.frames[0]!.bbox[3] - plate.bbox[3];
}

export function drawIntroQueue(fb: Frame, layer: IntroQueue, t: number, light = 1) {
  // reflections: a dim, vertically squashed mirror of each whole figure on the wet ground
  if (layer.reflections) for (const track of layer.tracks) {
    const plate = frameAt(track.anim, queueTime(track, t)), anchor = plate.anchor!;
    const ox = Math.round(track.x-anchor[0]) + glideFix(track.anim, plate), oy = soleFix(track, plate), ground = track.y+1, squash = .28;
    const reflectionHeight = (anchor[1]-plate.bbox[1])*squash;
    for (let y=Math.ceil(ground);y<Math.min(fb.h,ground+reflectionHeight);y++) {
      const sy=Math.round(anchor[1]-oy-(y-ground)/squash);
      if(sy<0||sy>=plate.h)continue;
      const a=.14*(1-(y-ground)/Math.max(1,reflectionHeight))*(y%3===0?1:.38);
      for(let sx=plate.bbox[0];sx<=plate.bbox[2];sx++){
        const i=sy*plate.w+sx;if(!plate.a[i])continue;
        fb.set(ox+sx,y,[plate.r[i]!*light,plate.g[i]!*light,plate.b[i]!*light],a);
      }
    }
  }
  // contact shadows, then the figures; outside its action each figure holds its end drawing
  for (const track of layer.tracks) {
    for(const offset of track.shadowOffsets ?? [0])for(let dy=-2;dy<=3;dy++)for(let dx=-19;dx<=19;dx++){
      const d=(dx/19)**2+(dy/3)**2;
      if(d<1)fb.set(track.x+offset+dx,track.y+2+dy,[.003,.004,.008],.24*(1-d));
    }
    const pl = frameAt(track.anim, queueTime(track, t));
    drawAnimAt(fb, track.anim, queueTime(track, t), track.x + glideFix(track.anim, pl), track.y + soleFix(track, pl), { mul: [light, light, light] });
  }
  drawExhales(fb, layer, t, light);
}
