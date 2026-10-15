// The edit: the shot list in absolute song time, the lyrics on top, then the credits after the song.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Frame } from './engine/fb.ts';
import { P } from './engine/palette.ts';
import { drawText, textMask } from './engine/text.ts';
import { beatHit } from './engine/music.ts';
import { clearPreserve, preserveMaskOf } from './engine/post_masks.ts';
import type { PostOpts } from './engine/post.ts';
import { drawIntro } from './scenes/intro.ts';
import { drawThrone } from './scenes/throne.ts';
import { drawSister } from './scenes/sister.ts';
import { drawCover } from './scenes/cover.ts';
import { drawRaid } from './scenes/raid.ts';
import { drawFinale } from './scenes/finale.ts';
import { drawInterludeCut } from './scenes/interlude.ts';
import { drawEye, EYE_FROM, EYE_TO } from './scenes/eye.ts';
import { drawWipe } from './scenes/wipe.ts';
import { drawSolodrawn } from './scenes/solodrawn.ts';
import { drawCable } from './scenes/cable.ts';
import { drawForeheads } from './scenes/foreheads.ts';
import { drawIgnite } from './scenes/ignite.ts';
import { drawRobot } from './scenes/robot.ts';
import { drawDjprofile, drawDjprofileQuiet } from './scenes/codeprofile.ts';
import { drawFaceCollage, FACE_COLLAGE_FROM, FACE_COLLAGE_TO } from './scenes/facecollage.ts';
import { drawDjbridge } from './scenes/djbridge.ts';
import { drawTurnHud, HUD0 } from './scenes/outro_turn.ts';
import { drawOutroRealities } from './scenes/outrorealities.ts';
import { drawVeins } from './scenes/veins.ts';
import { drawCyborg, drawCyborgHud, S7_IN, S8_IN } from './scenes/cyborg.ts';
import { drawDjchorus, CHORUS_OUT } from './scenes/djchorus.ts';
import { drawStageF, drawStageE, S14_IN, S14_OUT, S6_IN, S6_OUT } from './scenes/stagefloor.ts';
import { drawS3Hall, drawS3Floor, drawS3Stage, S3_HALL, S3_FLOOR, S3_STAGE } from './scenes/s3cuts.ts';
import { drawS5Chest, drawS5Face, S5_CHEST, S5_PROFILE, S5_FACE, S5_OUT } from './scenes/s5angles.ts';
import { drawBowOblique } from './scenes/bowoblique.ts';
import { drawRaidclose, BOOTS, MEGA } from './scenes/raidclose.ts';
import { drawCredits } from './scenes/credits.ts';
import { drawDefiance, KNOW1, KNOW2, KNOW3 } from './scenes/defiance.ts';

type Draw = (fb: Frame, t: number) => void;
export interface Shot { from: number; to: number; id: string; draw: Draw }

const DATA = path.resolve(import.meta.dirname, '../../data');
const audio = JSON.parse(readFileSync(path.join(DATA, 'audio.json'), 'utf8')) as { downbeats: number[] };
// snap a time to the nearest downbeat
const db = (t: number) => audio.downbeats.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));

// the oblique bow shot ends on the downbeat after the chorus
const S11_OUT = 60.06;
export const SHOTS: Shot[] = [
  // the door opens at 13.82, then three cuts push in through the held crowd to the stage on the kicks
  { from: 0, to: S3_HALL, id: 'intro', draw: drawIntro },
  // भित्त्वा: inside, the long hall and a large still crowd
  { from: S3_HALL, to: S3_FLOOR, id: 's3-hall', draw: drawS3Hall },
  { from: S3_FLOOR, to: S3_STAGE, id: 's3-floor', draw: drawS3Floor },
  // प्रविष्टाः: the stage, then the boots
  { from: S3_STAGE, to: db(16.9), id: 's3-stage', draw: drawS3Stage },
  // "Where the beat flows like blood through the veins"
  { from: db(16.9), to: 19.9, id: 'veins', draw: drawVeins },
  // "Blue flames blaze — the darkness is burned"
  { from: 19.9, to: 22.9, id: 'ignite', draw: drawIgnite },
  // the DJ: wide, then dramatic angles cut on the word onsets of तन्त्रज्ञः परिपथसिंहासने — नादानाम् ईश्वरः
  { from: 22.9, to: S5_CHEST, id: 'throne', draw: drawThrone },
  // परिपथसिंहासने: low angle from inside the crowd
  { from: S5_CHEST, to: S5_PROFILE, id: 's5-chest', draw: drawS5Chest },
  // नादानाम्: profile close-up, mouth closed
  { from: S5_PROFILE, to: S5_FACE, id: 'djprofile', draw: drawDjprofileQuiet },
  // ईश्वरः: frontal close-up on the throne, eyes closed
  { from: S5_FACE, to: S5_OUT, id: 's5-face', draw: drawS5Face },
  // "Every frequency says — this is your home": the crowd up close
  { from: S5_OUT, to: 29.5, id: 'cover', draw: drawCover },
  // the ring dancer's full dance on the hall floor among the crowd
  { from: S6_IN, to: S6_OUT, id: 'stage-e', draw: drawStageE },
  // the robot dancing in a clearing
  { from: S6_OUT, to: S7_IN, id: 'strobe', draw: drawRobot },
  // the cyborg revealed on the first prakāśe (36.775)
  { from: S7_IN, to: S8_IN, id: 'cyborg', draw: drawCyborg },
  // cut to his display on vadanti (38.790): "a machine is just a machine"
  { from: S8_IN, to: 42.504, id: 'cyborg-hud', draw: drawCyborgHud },
  // the whole line through "tannāma muktiḥ"
  { from: 42.504, to: 45.83, id: 'djprofile', draw: drawDjprofile },
  // chorus: the DJ dancing frontally, crowd in view
  { from: 45.83, to: CHORUS_OUT, id: 'djchorus', draw: drawDjchorus },
  // oblique side view: the DJ bows into āgatāḥ
  { from: CHORUS_OUT, to: S11_OUT, id: 'bow-oblique', draw: drawBowOblique },
  // the break: kick-locked cutaways into the crowd
  { from: S11_OUT, to: 61.998, id: 'break-a', draw: drawInterludeCut('break-a') }, { from: 61.998, to: 62.873, id: 'break-bal', draw: drawInterludeCut('break-bal') },
  { from: 62.873, to: 63.749, id: 'break-b', draw: drawInterludeCut('break-b') }, { from: 63.749, to: 65.064, id: 'int-drink', draw: drawInterludeCut('int-drink') },
  { from: 65.064, to: 65.94, id: 'int-texter', draw: drawInterludeCut('int-texter') }, { from: 65.94, to: 66.84, id: 'break-c', draw: drawInterludeCut('break-c') },
  // "Sister on the dance floor — titanium vertebrae"
  { from: 66.84, to: 69.4, id: 'sister', draw: drawSister },
  // "Fifteenth time her memory was wiped" + the 15th tally
  { from: 69.4, to: 72.8, id: 'wipe', draw: drawWipe },
  // her solo, drawn frame by frame in absolute song time
  { from: 72.8, to: 79.6, id: 'solo', draw: drawSolodrawn },
  // "The soul cannot be governed": she pulls the cable
  { from: 79.6, to: 83.2, id: 'cable', draw: drawCable },
  // held through the love/code line
  { from: 83.2, to: FACE_COLLAGE_FROM, id: 'foreheads', draw: drawForeheads },
  // prechorus: nine portraits, once each
  { from: FACE_COLLAGE_FROM, to: FACE_COLLAGE_TO, id: 'facecollage', draw: drawFaceCollage },
  // the bridge: the DJ sings, from after the prechorus to the bridge's dance
  { from: FACE_COLLAGE_TO, to: 108.759, id: 'djbridge', draw: drawDjbridge },
  // three dancers pass a move centre stage among the crowd
  { from: S14_IN, to: S14_OUT, id: 'stage-f', draw: drawStageF },
  // dependent arising in the physical club, then the eye
  { from: S14_OUT, to: EYE_FROM, id: 'cover', draw: drawCover }, { from: EYE_FROM, to: EYE_TO, id: 'eye', draw: drawEye },
  // warning cuts as the bridge ends and the hall opens into the drop
  { from: 123.169, to: 124.601, id: 'warn-1', draw: drawInterludeCut('warn-1') }, { from: 124.601, to: 126.352, id: 'warn-2', draw: drawInterludeCut('warn-2') },
  { from: 126.352, to: 128.1, id: 'warn-3', draw: drawInterludeCut('warn-3') },
  // the last bar of the drop, in among the dancers
  { from: 128.1, to: 129.85, id: 'cover', draw: drawCover },
  // "Red-blue light cuts the smoke"
  { from: 129.85, to: 131.8, id: 'raid', draw: drawRaid },
  // the subwoofers / boots on the stairs / "Everyone on the ground! Now!"
  { from: 131.8, to: 139.3, id: 'raidclose', draw: drawRaidclose },
  { from: 139.3, to: 140.584, id: 'raid', draw: drawRaid },
  // "layo na mriyate": the whole line, sustained final vowel
  { from: 140.584, to: 143.819, id: 'djprofile', draw: drawDjprofile },
  // unit 57 (thermal HUD)
  { from: 143.819, to: KNOW1, id: 'raid', draw: drawRaid },
  // "Yes. We know." — the sister answers
  { from: KNOW1, to: 149.3, id: 'know-sister', draw: drawDefiance },
  // "We were always in violation." — the unison
  { from: 149.3, to: KNOW2, id: 'raid', draw: drawRaid },
  // "Yes. We know." — the DJ
  { from: KNOW2, to: 154.34, id: 'know-dj', draw: drawDefiance },
  // "We were always in violation." — the volley; all down
  { from: 154.34, to: KNOW3, id: 'raid', draw: drawRaid },
  // "Yes. We know." — from the floor, under fire
  { from: KNOW3, to: 156.08 + 4 * 0.4376 * 2, id: 'know-floor', draw: drawDefiance },
  // the rise
  { from: 156.08 + 4 * 0.4376 * 2, to: db(162.0), id: 'raid', draw: drawRaid },
  // cutaway: the DJ plays on under the sirens
  { from: db(162.0), to: db(165.5), id: 'throne-siren', draw: drawFinale },
  { from: db(165.5), to: 169.375, id: 'raid', draw: drawRaid },
  // the profile runs to the word boundary 170.987 (two beats before the hit 171.862); the officer's visor HUD acquires him,
  // overloads on the hit and holds to 172.737; then the outro
  { from: 169.375, to: HUD0, id: 'djprofile', draw: drawDjprofile }, { from: HUD0, to: 172.737, id: 'outroturn-hud', draw: drawTurnHud },
  { from: 172.737, to: 187.27, id: 'outrorealities', draw: drawOutroRealities },
];

// ---------- lyrics ----------
// data/lyrics_layout.json (analysis/lyrics_layout.py; masks from scripts/lyrics.mjs): screen groups of rows, each row fading in at the onset of its first
// sung syllable; the rows of a group hold their places from the group's start (a second line appears below the first, nothing jumps).
// 'bump' groups (chorus, bridge) ride the beat by up to 2 px; the 'square' group lays the tetralemma's four phrases out on the corners
// of a rectangle.
interface LRow { text: string; t: number; pos?: string }
interface LGroup { style: string; start: number; end: number; rows: LRow[] }
const LGROUPS: LGroup[] = JSON.parse(readFileSync(path.join(DATA, 'lyrics_layout.json'), 'utf8')).groups;
// a soft dark band behind the words for legibility over bright scenes, darkened and desaturated towards a cool violet
// (plain darkening turns skin olive in the palette)
function lyrBand(fb: Frame, x0: number, y0: number, x1: number, y1: number, a: number) {
  for (let yy = Math.max(0, y0); yy < Math.min(fb.h, y1); yy++) for (let xx = Math.max(0, x0); xx < Math.min(fb.w, x1); xx++) {
    const i = yy * fb.w + xx, l = 0.3 * fb.r[i]! + 0.6 * fb.g[i]! + 0.1 * fb.b[i]!, d = 1 - 0.5 * a, q = 0.7 * a;
    fb.r[i] = (fb.r[i]! * (1 - q) + l * q * 0.8) * d; fb.g[i] = (fb.g[i]! * (1 - q) + l * q * 0.75) * d; fb.b[i] = (fb.b[i]! * (1 - q) + l * q * 1.3) * d;
  }
}

export function drawSubtitles(fb: Frame, t: number) {
  const FADE = 0.12, BASE = 334, STEP = 15;
  LGROUPS.forEach((g, gi) => {
    const next = LGROUPS[gi + 1];
    // the tail after a group ends never overlaps the next group
    const hold = Math.max(0, Math.min(0.35, (next ? next.start - FADE - 0.02 : Infinity) - g.end));
    const until = Math.min(g.end + hold, next ? next.start - FADE : Infinity);
    if (t < g.start - FADE || t > until) return;
    const out = t > g.end && hold > 0 ? 1 - (t - g.end) / hold : 1;
    const dy = g.style === 'bump' || g.style === 'square' ? -Math.round(2 * beatHit(t, 14)) : 0;
    const masks = g.rows.map((r, ri) => textMask(`lyr_${String(gi).padStart(3, '0')}_${ri}`) as unknown as { w: number; h: number });
    const alpha = (r: LRow) => Math.max(0, Math.min(1, (t - (r.t - FADE)) / FADE, out));
    if (g.style === 'square') {
      // rectangle: the widest pair decides the width; rows at BASE-STEP (top) and BASE (bottom); no drawn frame
      const W = Math.max(masks[0]!.w + masks[1]!.w + masks[2]!.w + 24, masks[3]!.w + masks[4]!.w + 40, 236), x0 = Math.round(320 - W / 2), x1 = x0 + W;
      const yT = BASE - STEP + dy, yB = BASE + dy;
      const at: Record<string, [number, number]> = { tl: [x0, yT], tc: [Math.round(320 - masks[1]!.w / 2), yT], tr: [x1 - masks[2]!.w, yT], bl: [x0, yB], br: [x1 - masks[4]!.w, yB] };
      g.rows.forEach((r, ri) => { const a = alpha(r); if (a <= 0) return; const [x, y] = at[r.pos!]!, m = masks[ri]!; lyrBand(fb, x - 6, y - 3, x + m.w + 6, y + m.h + 1, a); drawText(fb, `lyr_${String(gi).padStart(3, '0')}_${ri}`, x, y, P.gry5, { edge: P.void0, alpha: a }); });
      return;
    }
    const n = g.rows.length;
    g.rows.forEach((r, ri) => {
      const a = alpha(r); if (a <= 0) return;
      const m = masks[ri]!, x = Math.round(320 - m.w / 2), y = BASE - (n - 1 - ri) * STEP + dy;
      lyrBand(fb, x - 6, y - 3, x + m.w + 6, y + m.h + 1, a);
      drawText(fb, `lyr_${String(gi).padStart(3, '0')}_${ri}`, x, y, P.gry5, { edge: P.void0, alpha: a });
    });
  });
}

// machine cuts: a few frames of digital tear right after these cuts
const GLITCH_CUTS = [69.4, 143.819];
const tear = new Frame();
function glitch(fb: Frame, t: number, cut: number) {
  // 0..1 over ~4 frames
  const u = (t - cut) / 0.06;
  tear.copyFrom(fb);
  const W = fb.w, H = fb.h;
  for (let y = 0; y < H; y++) {
    const band = Math.floor(y / 6);
    const r = Math.sin(band * 12.9898 + Math.floor(t * 60) * 78.233) * 43758.5453;
    const off = Math.round(((r - Math.floor(r)) - 0.5) * 40 * (1 - u));
    for (let x = 0; x < W; x++) {
      const i = y * W + x, sx = Math.max(0, Math.min(W - 1, x + off));
      fb.r[i] = tear.r[y * W + Math.min(W - 1, sx + 3)]!; fb.g[i] = tear.g[y * W + sx]!; fb.b[i] = tear.b[y * W + Math.max(0, sx - 3)]!;
    }
  }
}

// high-energy windows: the image pumps brighter on each kick
const PUMP: [number, number][] = [[45.83, 59.84], [117.6, 129.85], [129.85, 171.86]];

// per-frame post options: scenes may mark pixels whose light the palette cannot represent (engine/post_masks.ts)
export const scenePostOptions = (fb: Frame): PostOpts => ({ preserveColorMask: preserveMaskOf(fb) });

// the credits follow the final shot (scenes/credits.ts)
const FILM_END = 187.27;
export function drawFilm(fb: Frame, t: number) {
  clearPreserve(fb);
  if (t >= FILM_END) { drawCredits(fb, t, FILM_END); return; }
  const s = SHOTS.find((x) => t >= x.from && t < x.to) ?? SHOTS[SHOTS.length - 1]!;
  s.draw(fb, t);
  for (const c of GLITCH_CUTS) if (t >= c && t < c + 0.06) glitch(fb, t, c);
  // the "Yes. We know." faces stay perfectly still against the chaos
  if (PUMP.some(([a, b]) => t >= a && t < b) && !s.id.startsWith('know-')) {
    const k = 1 + 0.12 * beatHit(t, 14);
    for (let i = 0; i < fb.r.length; i++) { fb.r[i] = fb.r[i]! * k; fb.g[i] = fb.g[i]! * k; fb.b[i] = fb.b[i]! * k; }
    // the camera rides the kick: a short downward bump of a few pixels, gone within ~100 ms
    const dy = Math.round(3 * beatHit(t, 22));
    const lockedBootInsert = s.id === 'raidclose' && t >= BOOTS && t < MEGA;
    if (dy > 0 && !lockedBootInsert) {
      const W = fb.w;
      // bottom-up so each source row is read before it is overwritten
      for (let y = fb.h - 1; y >= 0; y--) {
        const sy = Math.max(0, y - dy);
        fb.r.copyWithin(y * W, sy * W, sy * W + W); fb.g.copyWithin(y * W, sy * W, sy * W + W); fb.b.copyWithin(y * W, sy * W, sy * W + W);
      }
    }
  }
  drawSubtitles(fb, t);
}
