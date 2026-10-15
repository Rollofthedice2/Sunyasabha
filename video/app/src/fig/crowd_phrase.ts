// Crowd people as complete drawn dance loops ("phrases" e/f/g/h and cop), one drawing size per depth, played at one
// fixed rate against the beat and placed by a fixed stage anchor. Drawings are never warped or rescaled.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Frame, type RGB } from '../engine/fb.ts';
import { loadAnim, type Anim } from '../engine/anim.ts';
import { drawPlate, type Plate } from '../engine/plate.ts';
import { beatPos } from '../engine/music.ts';
import { crowdPlate } from './crowd.ts';
import { crowdVariant, drawPlateVariant, WAIST } from './crowd_variant.ts';

export type CrowdDepth = 'distant' | 'far' | 'mid' | 'near' | 'close';
export const CIVILIAN_PHRASES = ['e','f','g','h'] as const;
export type CrowdPhraseId = typeof CIVILIAN_PHRASES[number] | 'cop';
export interface CrowdActor {
  id: string; phrase: CrowdPhraseId; x: number; y: number; depth: CrowdDepth;
  phaseBeats: number; flipX?: boolean; tint?: RGB;
  // seed of the material-aware recolour (civilians only; see crowd_variant.ts)
  variant?: number;
}
interface PhraseEntry {
  beats: number; loopApproved: boolean;
  sizes: Partial<Record<CrowdDepth, string>>;
}
interface Library { schema: 'crowd-phrase-library/v1'; phrases: Partial<Record<CrowdPhraseId, PhraseEntry>> }
const DIR = path.resolve(import.meta.dirname, '../../assets/plates');
const FILE = path.join(DIR, 'crowd_phrase_library.json');
const heights: Record<CrowdDepth, number> = { distant:40, far:72, mid:112, near:160, close:224 };
let library: Library | undefined;
const animations = new Map<string, Anim>();

function getLibrary(): Library {
  if (!library) {
    library = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) as Library : { schema: 'crowd-phrase-library/v1', phrases: {} };
    if (library.schema !== 'crowd-phrase-library/v1') throw new Error('Unknown crowd phrase library schema');
  }
  return library;
}

// Checks that a loop is cyclic, keeps one canvas and stage anchor, and has valid frame times.
export function validateCrowdAnimation(a: Anim, label = 'crowd phrase') {
  if (a.frames.length < 2 || a.songTimes) throw new Error(`${label}: expected a cyclic drawing sequence`);
  const first = a.frames[0]!;
  if (!first.anchor) throw new Error(`${label}: fixed stage anchor required`);
  for (const p of a.frames) {
    if (p.w !== first.w || p.h !== first.h || !p.anchor || p.anchor[0] !== first.anchor[0] || p.anchor[1] !== first.anchor[1])
      throw new Error(`${label}: all drawings must retain one canvas and one stage anchor`);
  }
  if (a.times && (a.times.length !== a.frames.length || a.times[0] !== 0 || a.times.some((u,i) => !Number.isFinite(u) || u < 0 || u >= 1 || (i > 0 && u <= a.times![i-1]!))))
    throw new Error(`${label}: invalid phrase frame times`);
}

export function crowdFrameIndex(a: Anim, beat: number, beats: number, phaseBeats: number, allowLoop: boolean) {
  if (!Number.isFinite(beats) || beats <= 0) throw new Error('Crowd phrase duration must be positive');
  // A loop not marked as approved plays only when the caller allows it; otherwise its first drawing holds.
  if (!allowLoop) return 0;
  const u = (((beat + phaseBeats) / beats) % 1 + 1) % 1;
  if (!a.times) return Math.min(a.frames.length - 1, Math.floor((u + 1e-10) * a.frames.length));
  let i = 0;
  while (i + 1 < a.times.length && a.times[i + 1]! <= u + 1e-10) i++;
  return i;
}

// Reflection is around the authored stage anchor, not the varying opaque box.
export function crowdOrigin(p: Plate, x: number, y: number, flipX = false): [number, number] {
  if (!p.anchor) throw new Error('Crowd phrase plate lacks a stage anchor');
  return [Math.round(x - (flipX ? p.w - 1 - p.anchor[0] : p.anchor[0])), Math.round(y - p.anchor[1])];
}

function getAnimation(name: string) {
  let a = animations.get(name);
  if (!a) { a = loadAnim(name); validateCrowdAnimation(a, name); animations.set(name, a); }
  return a;
}

export function crowdPhraseReadiness() {
  const lib = getLibrary();
  return ([...CIVILIAN_PHRASES,'cop'] as const).map(id => {
    const entry = lib.phrases[id];
    return { id, loopApproved: entry?.loopApproved === true, availableDepths: (['far','mid','near'] as const).filter(d => !!entry?.sizes[d]), provisional: !entry || !entry.loopApproved };
  });
}

export function crowdDepthForHeight(height:number):CrowdDepth {
  return (Object.keys(heights) as CrowdDepth[]).reduce((a,b)=>Math.abs(Math.log(heights[a]/height))<=Math.abs(Math.log(heights[b]/height))?a:b);
}

// One person at a scene placement, sized by height. Facing and phrase offset belong to the person and do not change
// over time.
export function drawCrowdPerson(fb:Frame,t:number,who:number,x:number,y:number,height:number,opts:{phaseBeats?:number;flipX?:boolean;light?:RGB;tint?:RGB;phrase?:CrowdPhraseId;variant?:number|null}={}) {
  const phrase=opts.phrase??CIVILIAN_PHRASES[((who|0)%CIVILIAN_PHRASES.length+CIVILIAN_PHRASES.length)%CIVILIAN_PHRASES.length]!;
  drawCrowdPhrases(fb,t,[{id:`person-${who}`,phrase,x,y,depth:crowdDepthForHeight(height),phaseBeats:opts.phaseBeats??((who*.731)%4+4)%4,flipX:opts.flipX,tint:opts.tint,variant:opts.variant===null?undefined:(opts.variant??who)}],{light:opts.light,previewUnreviewedLoops:true});
}

export function drawCrowdPhrases(fb: Frame, t: number, actors: readonly CrowdActor[], opts: { light?: RGB; previewUnreviewedLoops?: boolean } = {}) {
  const beat = beatPos(t), lib = getLibrary();
  for (const actor of [...actors].sort((a,b) => a.y - b.y || a.x - b.x)) {
    const entry = lib.phrases[actor.phrase], name = entry?.sizes[actor.depth];
    let p: Plate | null;
    if (name) {
      const a = getAnimation(name);
      p = a.frames[crowdFrameIndex(a, beat, entry!.beats, actor.phaseBeats, entry!.loopApproved || opts.previewUnreviewedLoops === true)]!;
    } else {
      // no drawn phrase at this depth: civilians fall back to a static crowd sprite, cops are not drawn
      p = actor.phrase === 'cop' ? null : crowdPlate(actor.phrase === 'e' ? 0 : actor.phrase === 'f' ? 1 : 2, heights[actor.depth]);
    }
    if (!p) continue;
    const light = opts.light ?? [1,1,1], tint = actor.tint ?? [1,1,1];
    const mul: RGB = [light[0]*tint[0],light[1]*tint[1],light[2]*tint[2]];
    const origin = p.anchor ? crowdOrigin(p,actor.x,actor.y,actor.flipX) : [Math.round(actor.x-(p.bbox[0]+p.bbox[2])/2),Math.round(actor.y-p.bbox[3])];
    // the recolour changes materials; tint stays a light multiplier (scenes use it for depth and flashes)
    if (actor.variant !== undefined && actor.phrase !== 'cop' && p.anchor) drawPlateVariant(fb,p,origin[0]!,origin[1]!,crowdVariant(actor.variant),{flipX:actor.flipX,mul,waist:WAIST[actor.phrase]});
    else drawPlate(fb,p,origin[0]!,origin[1]!,{flipX:actor.flipX,mul});
  }
}
