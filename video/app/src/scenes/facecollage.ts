// Prechorus portraits: nine identities, one occurrence each, cut on sung syllables (data/face_collage.json).
// Each portrait plays its one-motion drawing set collage2_<id>_G00..Gnn spread evenly over its slot (the last drawing holds
// into the cut), under the same beat light for every identity. Absolute song time.
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {Frame,type RGB} from '../engine/fb.ts';
import {drawPlate,loadPlate} from '../engine/plate.ts';
import {beatPos} from '../engine/music.ts';
import {preserveColor} from '../engine/post_masks.ts';

export interface CollagePortrait {id:string;plate:string;from:number;to:number}
const score=JSON.parse(readFileSync(path.resolve(import.meta.dirname,'../../../data/face_collage.json'),'utf8')) as {
  from:number;to:number;portraits:CollagePortrait[];
};
export const FACE_COLLAGE_FROM=score.from,FACE_COLLAGE_TO=score.to;
export const FACE_COLLAGE_PORTRAITS=score.portraits;
export const FACE_COLLAGE_HOLD=(score.to-score.from)/9;
if(score.portraits.length!==9||new Set(score.portraits.map(p=>p.id)).size!==9||
   score.portraits.some((p,i)=>!Number.isFinite(p.from)||p.to<=p.from||(i>0&&p.from!==score.portraits[i-1]!.to))||
   score.portraits[0]!.from!==score.from||score.portraits.at(-1)!.to!==score.to)
  throw new Error('Invalid bounded prechorus portrait schedule');

export function collagePortraitAt(t:number):CollagePortrait {
  if(t<score.from)return score.portraits[0]!;
  return score.portraits.find(p=>t>=p.from&&t<p.to)??score.portraits.at(-1)!;
}
export function collageLightAtBeat(beat:number):RGB {
  const phase=beat-Math.floor(beat);
  // All identities receive this same light function and the same screen time.
  // Complete colored faces remain visible between beats; no spotlight or zoom.
  const gain=.84+.16*Math.exp(-phase*6);
  return [gain*1.02,gain,gain*.99];
}
// number of drawings in each portrait's set
const setSize=new Map<string,number>();
const drawingsOf=(id:string)=>{
  if(!setSize.has(id)){let n=0;while(existsSync(path.resolve(import.meta.dirname,`../../assets/plates/collage2_${id}_G${String(n).padStart(2,'0')}.json`)))n++;setSize.set(id,n);}
  return setSize.get(id)!;
};
export function drawFaceCollage(fb:Frame,t=FACE_COLLAGE_FROM) {
  const face=collagePortraitAt(t);
  const n=drawingsOf(face.id),span=face.to-face.from,i=Math.min(n-1,Math.floor((t-face.from)/span*n));
  drawPlate(fb,loadPlate(`collage2_${face.id}_G${String(i).padStart(2,'0')}`),0,0,{mul:collageLightAtBeat(beatPos(t))});
  // the portraits are finished pixel art: keep their true colour through the output palette snap
  preserveColor(fb).fill(1);
}
