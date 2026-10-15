# Tools

Everything here ran in the production. Python tools live in `video/analysis/` and use paths relative to `video/` (they work from that layout;
copy and edit the path constants to use them elsewhere). Python 3.12+ with numpy, scipy, Pillow, plus librosa and matplotlib for the music analysis. Blender 4.x for the 3D tools (on the PATH as
`blender`, or set `BLENDER`). Node 24 for the engine. The lyric-mask scripts (`subs.mjs`, `textmask.mjs`, `lyrics.mjs`) also need
`playwright-core` and a Chromium browser; the film itself renders without them.

## Generic: useful beyond this film

| tool | what it does | use it for |
|---|---|---|
| `video/analysis/blender/hall_blockout.py` | A parametric 3D blockout of a Gothic hall (nave, arcades, arches, stage, stairs, door, faces, braziers) rendered from any camera given as a few numbers; can draw floor marks and standing-height bars. | Consistent backgrounds across many shots: render a grey geometry guide per camera and have an image model paint over it. Adapt the geometry for any set. Example parameter files: `blender/examples/`. |
| `video/analysis/blender/char_body.py` + `specs/` | Builds a stylised mannequin from a JSON body spec (proportions in metres, clothing type, hair) and poses it from per-frame 3D joint positions, rendering one guide image per pose. | Pose guides for generated character animation; quick motion previews ("does this dance read?") before any drawing. |
| `video/analysis/raid_floor_layout.py` | Places characters and a crowd on a floor plan in metres and renders the set from several cameras (a wide and its reverse angle). | Planning blocking so different camera angles of the same moment agree. |
| `video/analysis/raid_floor_guide.py` | Projects the floor plan through the same camera onto any plate as outlines at true height for each spot, plus contact lines. | Size-by-depth guides for crowd and character generation; checking a returned image against the plan. |
| `video/analysis/analyze.py` | Tempo, beat grid, downbeats, per-stem energy envelopes, vocal phrases (librosa). Reads the song and the nine stems from the Release download, converted to WAV in `Stems/` at the repository root as `0 Lead Vocals.wav`, `1 Backing Vocals.wav`, `2 Drums.wav`, `3 Bass.wav`, `4 Guitar.wav`, `5 Keyboard.wav`, `6 Percussion.wav`, `7 Synth.wav`, `8 Other.wav`. | Driving cuts, light pulses and motion from the music. |
| `video/sync/` (`build.py`, `template.html`) | A browser tool for tapping sung syllables against the song; builds a timing file. | Lyric and lip timing where speech recognition fails (singing, non-English, Sanskrit). |
| `video/analysis/lead_voiced.py` | Per-frame "is the voice sounding" from the vocal stem, gain-normalised locally. | Closing mouths over breaths and stop consonants. |
| `video/analysis/sfx_mix.py` + `video/data/sfx_cues.json` | Mixes sound effects at levels relative to the song's local loudness, with crossfaded loops, gain envelopes and a simple room tail. | Adding effects to a track so they sit inside the music. |
| `video/analysis/credits.py`, `credits_audio.py` | Pixel-exact credit screens from pixel fonts at their native grid; a credits soundtrack from instrumental stems with a natural fade, silence and a bell. | End credits for pixel-art video. |
| `video/analysis/review_gate.py` | Static contact strips sampling a whole clip and a flicker scan, with a confirm step that records what was checked against the file's hash. | A consistent look-before-sharing step for any video work. |
| `video/tools/unpack_plates.mjs` | Dependency-free PNG decoder (Node zlib) that writes raw RGBA next to each PNG (skips plates already unpacked). | Storing raw image data compactly in git. |

## Pipeline-specific: how this film's parts are made

| tool | what it does |
|---|---|
| `video/analysis/e_compose.py` | Composites placed character drawings over a plate with contact shadows and wet-floor reflections. |
| `video/analysis/f3_engine_plates.py` | Turns a composited frame sequence into engine plates and an index. |
| `video/analysis/lyrics_layout.py`, `video/app/scripts/lyrics.mjs`, `textmask.mjs`, `subs.mjs` | Lyric rows timed to the first syllable, rasterised to 1-bit masks with a real font in headless Chromium (`playwright-core`). |
| `video/analysis/cast.py`, `request_lint.py` | The casting-continuum text attached to every request that shows people, and a linter that checks a request queue (`python request_lint.py QUEUE.json`). |
| `video/analysis/edit_check.py` | A quick static check for edited Python scripts. |

## The image request format

Each image request was a JSON record like this (abridged):

```json
{
  "id": "opus_bp_RAIDFLOOR_WIDE_EMPTY_A02",
  "kind": "environment_plate",
  "mode": "REDRAW",
  "prompt": "Paint an EMPTY gothic club hall from EXACTLY the camera of IMAGE 1 ... The foot of the straight central staircase is at about three-quarters of the picture's height ...",
  "references_with_roles": [
    {"path": "guides/raidfloor_geometry_WIDE.png", "role": "IMAGE 1: 3D blockout from THIS camera - the ONLY authority for camera, framing, positions and sizes", "sha256": "..."},
    {"path": "guides/look_pillars_crop.png", "role": "IMAGE 2: material sample crop (pillars, candelabras, wet floor) - not a camera", "sha256": "..."}
  ],
  "acceptance_checks": ["stair foot at ~75% height", "near pillars at both edges", "nobody in the picture"],
  "desired_output_path": "refs/generated/big_picture/RAIDFLOOR_WIDE_EMPTY_A02.png",
  "status": "pending"
}
```

Frozen references (hashed), one stated role per reference, numeric framing targets and explicit acceptance checks made two agents able to
share one queue and review each other's output.
