// The instrumental tail after the turn (174.392-187.27), cut on the measured two-beat grid (0.876 s):
//   174.392 the crowd books it past the stunned officers: legs on the floor, then a foot on the stairs
//   176.144 headphones left on the abandoned decks
//   177.017 a high angle by the door as the crowd streams out, the last one in the doorway, then the doorway empty
//   181.393 the empty trashed room to the end
// Still plates; only light and a slow push-in move.
import { AFTER0, drawTurnWide } from './outro_turn.ts';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Frame } from '../engine/fb.ts';
import { drawPlate, loadPlate, type Plate } from '../engine/plate.ts';
import { beatPos, env } from '../engine/music.ts';
import { preserveColor } from '../engine/post_masks.ts';
import { crowdPhraseReadiness, type CrowdActor } from '../fig/crowd_phrase.ts';

export const OUTRO_START = 172.225;
export const OUTRO_END = 187.27;
// A reality map of the tail on the half-bar grid (0.8756 s from 178.8633), with optional reframes. drawOutroRealities does not use it.
export type OutroReality = 'dance' | 'aftermath' | 'together' | 'empty';
const HB = 0.87558, R0 = 178.8633;
const rc = (k: number) => +(R0 + k * HB).toFixed(4);
export const OUTRO_REALITIES: readonly { start: number; end: number; reality: OutroReality; plate?: string; cameraCrop?: readonly [number,number,number,number] }[] = [
  { start: OUTRO_START, end: 175.3625, reality: 'dance' },
  { start: 175.3625, end: R0, reality: 'aftermath', plate: 'outro_aftermath_a' },
  { start: R0, end: rc(1), reality: 'together' },
  { start: rc(1), end: rc(2), reality: 'together', cameraCrop: [192, 140, 512, 320] },
  { start: rc(2), end: rc(3), reality: 'aftermath', plate: 'outro_aftermath_a' },
  { start: rc(3), end: 182.3641, reality: 'together', cameraCrop: [320, 170, 640, 350] },
  { start: 182.3641, end: rc(5), reality: 'aftermath', plate: 'outro_aftermath_b' },
  { start: rc(5), end: 184.1145, reality: 'together', cameraCrop: [155, 120, 475, 300] },
  { start: 184.1145, end: rc(7), reality: 'together' },
  { start: rc(7), end: 185.8648, reality: 'together', cameraCrop: [80, 45, 640, 360] },
  { start: 185.8648, end: OUTRO_END, reality: 'empty' },
];
export function outroRealityAt(t: number) {
  return OUTRO_REALITIES.find(s => t >= s.start && t < s.end) ?? (t < OUTRO_START ? OUTRO_REALITIES[0]! : OUTRO_REALITIES.at(-1)!);
}

// Crowd actors for a procedural floor shot: fixed floor positions and phrase phases, feet visible. drawOutroRealities does not use them.
export const OUTRO_CIVILIANS: readonly CrowdActor[] = [
  {id:'back-e',phrase:'e',x:47,y:268,depth:'far',phaseBeats:.2},
  {id:'back-f',phrase:'f',x:173,y:273,depth:'far',phaseBeats:1.4,flipX:true},
  {id:'back-g',phrase:'g',x:430,y:265,depth:'far',phaseBeats:2.65},
  {id:'back-h',phrase:'h',x:555,y:277,depth:'far',phaseBeats:3.1,flipX:true},
  {id:'middle-f',phrase:'f',x:110,y:309,depth:'mid',phaseBeats:2.1},
  {id:'middle-h',phrase:'h',x:254,y:306,depth:'mid',phaseBeats:.9,flipX:true},
  {id:'middle-e',phrase:'e',x:457,y:305,depth:'mid',phaseBeats:1.7},
  {id:'front-h',phrase:'h',x:88,y:347,depth:'near',phaseBeats:3.5,flipX:true},
  {id:'front-e',phrase:'e',x:202,y:351,depth:'near',phaseBeats:.65,flipX:true},
  {id:'front-f',phrase:'f',x:395,y:349,depth:'near',phaseBeats:2.8},
  {id:'front-g',phrase:'g',x:580,y:346,depth:'near',phaseBeats:1.3,flipX:true},
];
// no flips: the cops' red/blue rim light is baked in
export const OUTRO_COPS: readonly CrowdActor[] = [
  {id:'cop-back',phrase:'cop',x:315,y:270,depth:'far',phaseBeats:1.1},
  {id:'cop-middle',phrase:'cop',x:352,y:306,depth:'mid',phaseBeats:2.4},
  {id:'cop-right',phrase:'cop',x:493,y:349,depth:'near',phaseBeats:.35},
];
const DIR = path.resolve(import.meta.dirname, '../../assets/plates');
export function outroReadiness() {
  const crowd = crowdPhraseReadiness();
  const aftermath = ['outro_aftermath_a','outro_aftermath_b'].map(name=>({name,available:existsSync(path.join(DIR,`${name}.json`))}));
  return { stage:'iteration', crowd, aftermath, assetsReady:crowd.every(p=>!p.provisional&&p.availableDepths.length===3)&&aftermath.every(p=>p.available), productionReady:false };
}

// the exodus: one camera per group; the push-in runs across the whole group, each drawing held from its start to the next
const EXODUS: { shots: [number, string][]; end: number }[] = [
  // legs on the floor
  { shots: [[174.392, 'outro_ex_E1a'], [174.830, 'outro_ex_E1b']], end: 175.268 },
  // a foot on the stairs
  { shots: [[175.268, 'outro_ex_E2a'], [175.706, 'outro_ex_E2b']], end: 176.144 },
  // high angle by the door: the crowd streams out, the last one in the doorway, then the doorway empty
  { shots: [[177.017, 'outro_ex_X1'], [177.892, 'outro_ex_X2'], [178.767, 'outro_ex_X4'], [179.642, 'outro_ex_X5'], [180.517, 'outro_ex_X5b']], end: 181.393 },
];
const DECKS = loadPlate('outro_decks_A01'), FINAL = loadPlate('outro_final_room');
// a held plate: one slow push-in of the whole image, 1.000 -> 1.035 over the shot about (320, 170), light pulsing on the kicks;
// nearest sampling keeps the pixel-art grain
function drawHeldPush(fb: Frame, plate: Plate, t: number, t0: number, dur: number) {
  const ph = beatPos(t), pulse = Math.exp(-(ph - Math.floor(ph)) * 4.0), z = 1 + 0.035 * Math.min(1, (t - t0) / dur), kL = 0.9 + 0.16 * pulse, fx = 320, fy = 170;
  for (let y = 0; y < fb.h; y++) { const sy = Math.min(plate.h - 1, Math.max(0, Math.round(fy + (y - fy) / z)));
    for (let x = 0; x < fb.w; x++) { const sx = Math.min(plate.w - 1, Math.max(0, Math.round(fx + (x - fx) / z))), si = sy * plate.w + sx, di = y * fb.w + x;
      fb.r[di] = plate.r[si]! * kL; fb.g[di] = plate.g[si]! * kL * 0.97; fb.b[di] = plate.b[si]! * kL * 1.04; } }
}
export function drawOutroRealities(fb: Frame, t: number) {
  // the turn (172.737-174.392)
  if (t < AFTER0) { drawTurnWide(fb, t); return; }
  const grp = EXODUS.find((g) => t >= g.shots[0]![0] && t < g.end);
  if (grp) {
    let nm = grp.shots[0]![1]; for (const [a, n] of grp.shots) if (a <= t) nm = n;
    drawHeldPush(fb, loadPlate(nm), t, grp.shots[0]![0], grp.end - grp.shots[0]![0]);
    return;
  }
  if (t < 181.393) {
    // the decks: the neon breathes with the bass envelope (the tail is not quiet: four-floor kicks, bass ~-22 dB)
    const bass = env('bass', t, -35, -15);
    drawPlate(fb, DECKS, 0, 0, { mul: [0.86 + 0.14 * bass, 0.86 + 0.08 * bass, 0.9 + 0.1 * bass] });
    return;
  }
  drawFinalRoom(fb, FINAL, t);
}

// The final empty room: wide, facing the stage, trashed. The room never moves; only restrained light and haze: the ring gutters on the
// kicks 186.209 and 186.646 and dies after the last kick 187.084; thin smoke rises from the two cold braziers; floor haze drifts.
const RING_C:[number,number]=[319.7,102.9], RING_R=25.5, BRAZIERS:[number,number][]=[[250,174],[384,174]];
function ringLevel(t:number){
  // dim, faintly unstable
  let k=0.55+0.05*Math.sin(t*23.0)*Math.sin(t*7.3);
  // gutter: flare, cut, recover
  for(const b of [186.209,186.646]){ const u=t-b; if(u>=0&&u<0.16) k=u<0.04?0.95:u<0.08?0.18:0.55*(u-0.08)/0.08+0.18; }
  // dies after the last kick
  if(t>=187.084) k*=Math.max(0,1-(t-187.084)/0.14);
  return k;
}
function drawFinalRoom(fb:Frame,p:Plate,t:number){
  drawPlate(fb,p,0,0);
  const k=ringLevel(t), keep=preserveColor(fb);
  for(let y=Math.floor(RING_C[1]-RING_R-10);y<=RING_C[1]+RING_R+10;y++)for(let x=Math.floor(RING_C[0]-RING_R-10);x<=RING_C[0]+RING_R+10;x++){
    const d=Math.hypot(x-RING_C[0],y-RING_C[1]); if(Math.abs(d-RING_R)>9)continue;
    // blue/cyan light only (the ring and its glow), kept in its true dimmed colour rather than palette-snapped to grey
    const i=y*fb.w+x, r=fb.r[i]!, g=fb.g[i]!, b=fb.b[i]!, w=Math.max(0,Math.min(1,(b-r*1.3)/0.18));
    const m=1-w*(1-k); fb.r[i]=r*m; fb.g[i]=g*m; fb.b[i]=b*m; if(w>0.05) keep[i]=1;
  }
  // thin cold smoke
  for(const [bx,by] of BRAZIERS)for(let n=0;n<26;n++){
    const life=((t*0.55+n*0.137+bx*0.01)%1), x=bx+Math.sin(n*2.1+t*1.3+life*4)*(2+6*life), y=by-life*46;
    fb.set(x,y,[0.30,0.30,0.36],0.10*(1-life)*Math.min(1,life*6));
  }
  // floor haze drifting slowly image-right
  for(let y=230;y<fb.h;y+=1)for(let x=0;x<fb.w;x+=1){
    const n=Math.sin(x*0.021-t*0.35+Math.sin(y*0.05)*2)*Math.sin(y*0.09+x*0.006+t*0.2);
    if(n>0.45)fb.add(x,y,[0.16,0.12,0.2],(n-0.45)*0.12*Math.min(1,(y-230)/40));
  }
}
