# The engine

`video/app/` is a small offline renderer written in TypeScript and run directly by Node 24 (no build step, no dependencies beyond Node and
ffmpeg). It draws the film one frame at a time from finished image plates plus procedural light, at a native 640×360, and streams the frames to
ffmpeg.

## Render

```sh
cd video/app
node ../tools/unpack_plates.mjs   # once after cloning
node scripts/render.ts --scene film --from 0 --to 226.27 --fps 30 --scale 2 --workers 2 --out ../out/film.mp4
```

| option | meaning |
|---|---|
| `--from`, `--to` | the stretch to render, in song seconds (the song ends at 187.27; the credits run to 226.27) |
| `--fps` | output frame rate (30 or 60; drawings change at 15/s or slower) |
| `--scale` | integer nearest-neighbour upscale (2 → 1280×720, 3 → 1920×1080, 6 → 3840×2160) |
| `--workers` | parallel render processes (each takes a stretch; the video is joined and the audio muxed once) |
| `--noaudio` | picture only |

The soundtrack is `video/audio/soundtrack.flac` (song, effects and credits audio); set `SOUNDTRACK` to a path from the repository root to
render with another. After replacing a plate's PNG, delete its `.rgba` and run `unpack_plates.mjs` again.

## Structure

| path | role |
|---|---|
| `app/scripts/render.ts` | frame loop, worker split, ffmpeg encode and audio mux |
| `app/src/film.ts` | the shot table: song-second ranges mapped to scene functions; beat-locked glitch cuts; the kick pulse; lyric rows |
| `app/src/scenes/*.ts` | one module per scene or shot family (intro, throne, chorus, stage floor dances, collage, bridge, raid, outro, credits …) |
| `app/src/fig/*.ts` | figures and overlays: crowds and their beat responses, procedural pixel fire, the HUD, mouth shapes |
| `app/src/engine/fb.ts` | the 640×360 frame buffer, in linear light (three Float32Array channels) |
| `app/src/engine/plate.ts` | loading and drawing plates (RGBA images with a JSON sidecar: size, opaque bounding box, optional anchor) |
| `app/src/engine/post.ts`, `post_masks.ts` | final pass: palette snap in OKLab with light ordered dither for procedural pixels; finished art is marked to keep its true colour |
| `app/src/engine/music.ts` | beat grid and stem envelopes from `data/audio.json` and `envelopes.json` (kick hits, energy) |
| `app/src/engine/text.ts` | 1-bit text masks drawn as pixel lettering |
| `app/src/fig/lipsync.ts` | mouth shape at any time from the hand-tapped syllables |
| `app/assets/plates/` | every image the film draws: `NAME.png` (stored) → `NAME.rgba` (unpacked), with `NAME.json` |
| `app/assets/text/` | rasterised lyric rows and HUD words |
| `data/` | timing and schedules: beat grid, lyric timing, raid shot sequence, dance timelines, crowd response schedules, credits timing |

## How a frame is made

1. `film.ts` finds the shot covering time *t* and calls its scene.
2. The scene draws plates (backgrounds, composited dance frames, crowd states, key poses) chosen by *t*, adds procedural light (fire, haze, siren
   glow, motes), and marks finished art to keep its colour.
3. `film.ts` adds the kick pulse in high-energy sections, glitch transitions on chosen cuts, and the lyric rows.
4. `post.ts` converts to sRGB, snapping only unmarked pixels to the palette.
5. `render.ts` upscales by `--scale` and pipes RGBA bytes to ffmpeg.

## Adding or changing a shot

- A new background or held drawing: add `NAME.png` + `NAME.json` to `assets/plates/` (run `unpack_plates.mjs`), then draw it from a scene with
  `drawPlate(fb, loadPlate('NAME'), 0, 0)`.
- A composited sequence (a dance rendered as frames): `video/analysis/f3_engine_plates.py FRAMES_DIR TAG T0` writes `f3_TAG_NNN` plates and an
  index; scenes play them by time (see `drawStageF` in `scenes/stagefloor.ts`).
- A held-stills sequence (the raid): edit the `[time, plate]` list in `data/raid_stills.json`.
- Retime a cut: edit the shot table in `film.ts`.

