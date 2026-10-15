# How the film was made

The film is generated pixel art moved by a small custom renderer. Every drawing is a whole image painted by an image model (GPT Image 2.5). Everything
that decides *what* is drawn — the timing, the staging, the poses, the sizes, the camera — is computed first, from the music and from a 3D model of
the set. The renderer then places the finished drawings over time, adds the light that has to move every frame (fire, haze, sirens, the kick
pulse), and writes the video in sync with the soundtrack.

```
song + stems ──► music analysis ──► beat grid, energy, onsets, sections
lyrics ────────► syllable timing (hand-tapped in a browser tool) ──► lyric rows, mouth shapes
                         │
                         ▼
        choreography / staging per beat (what each body does, where, when)
                         │
                         ▼
   3D: Blender hall blockout (cameras, floor plan)  +  Blender character rigs (motion, 15 poses/s)
                         │
                         ▼
   guides: geometry renders, projected size/position outlines, pose mannequins
                         │
                         ▼
   image model: empty plates → populated master → variants as edits; character drawings one per pose
                         │
                         ▼
   placement + compositing (one size rule on the floor, contact shadows, reflections, colour)
                         │
                         ▼
   engine (TypeScript): plates on a 640×360 frame buffer, per-frame light, lyrics, cuts  ──► ffmpeg ──► film
                         ▲
   sound: song + sirens + rifle cracks + bowl, mixed relative to the song's local loudness
```

## 1. Music first

Everything is timed from the song itself, never by ear alone.

- **Analysis** (`video/analysis/analyze.py`, librosa): tempo (137.1 BPM), beat grid and downbeats, per-stem energy envelopes from the nine stems
  Suno provides (lead vocal, backing vocal, drums, bass, guitar, keys, percussion, synth, other), vocal phrases, and a coarse section map. Output:
  `video/data/audio.json`, `envelopes.json`, `sections.json`. The engine reads these to pulse light on kicks and cut on beats.
- **Syllable timing** (`video/sync/`): a small browser tool that plays the song and lets a person tap the onset of every sung syllable. Automatic
  speech recognition is unreliable on sung Sanskrit; human taps are the authority. Output: `lyrics_timing.json`, `syllable_annotations_user.json`.
- **Lyric presentation** (`video/analysis/lyrics_layout.py`, `video/app/scripts/lyrics.mjs`): each lyric line becomes a row that fades in
  on its first sung syllable, as a 1-bit text mask the engine draws.

## 2. Choreography and staging, per beat

Before any drawing, each shot gets a written plan on the beat grid: who is in the scene, where they are, what they know at that instant, what
they do on which beat, and where the camera is. Dances are designed from the music — weight drops on kicks, hits on accents, holds on sustained
notes, claps on the song's own handclaps — and checked as a moving rig with the song before anything is drawn.

## 3. 3D layout of the set

One parametric Blender model of the hall (`video/analysis/blender/hall_blockout.py`): nave, arcades of clustered pillars and pointed arches,
the stage with steps, decks, the blue ring, the two stone heads, braziers, and the entrance end with its central staircase, door and second pair
of heads. Any shot's camera is a few numbers (position, yaw, pitch, field of view). From it come:

- **geometry guides**: a plain grey render of the empty hall from the shot's camera, the image model's authority for where every pillar, arch,
  stair and face goes;
- **floor plans**: characters and crowd placed in metres (`raid_floor_layout.py`), rendered from every camera so a wide shot and its reverse
  angle agree;
- **projected size guides** (`raid_floor_guide.py`): outlines of people at true height for their spot on the floor, drawn through the same
  camera onto the plate, so every figure has the right size for its distance.

## 4. Character motion in 3D

Each dancer has a simple Blender body built from a JSON spec of their proportions (`video/analysis/blender/char_body.py`, specs in
`blender/specs/`). Motion is authored as joint positions at 15 poses per second with fixed bone lengths, then rendered as mannequin guides: one
image per pose, from the shot's camera. The rig is reviewed playing with the song before drawings are commissioned — the cheapest point to fix
motion.

## 5. Generating the images

All images were painted by GPT Image 2.5, through two routes: Codex's built-in image generation, run by GPT-Astra 6 from a shared request queue;
and the OpenRouter API for batches of character drawings. Each request is a frozen JSON record: prompt, every reference image with a stated role
and its hash, acceptance checks, and the output path. GPT-Astra 6 preflights each request, generates, and reviews every output at full size
before handing it back.

- **Backgrounds** are built in stages: an empty plate from the geometry guide, then ONE crowd-fill edit of that plate with the staging guide,
  then every later moment of the same scene as an edit of that populated master, so the same people stay in the same places.
- **Characters** are painted one whole figure per pose, from the rig's pose guide plus a neutral identity reference, on a flat green background.
- **Casting** text is attached to every request that shows people: a continuum of humans, subtly augmented people, cyborgs, androids and the
  occasional robot, in varied, ordinary club clothes (`video/analysis/cast.py`).
- **Lip sync for close-ups** uses whole key-pose drawings — the head, neck, shoulders and face change together — chosen per syllable from the
  phonology: open vowels open the jaw, long vowels hold, stops close, emphasis leans the body.

## 6. Placement and compositing

Drawings are placed by measuring them: scale from the body (several cues agreeing, not one), feet pinned to their contact point on the floor plan,
one size rule for everyone at a given depth. Then a soft contact shadow under whatever touches the floor, a faint flipped reflection on the wet
floor, and a colour match to the scene (`video/analysis/e_compose.py`). Composited frames become the engine's plates
(`video/analysis/f3_engine_plates.py`).

## 7. The engine

A TypeScript renderer running in Node (`video/app/`): a 640×360 linear-light frame buffer, a shot table keyed to song seconds, scenes that draw
plates and procedural light, lyric rows, beat-locked cuts and glitch transitions, a palette pass that leaves finished art in its true colour, and
nearest-neighbour upscaling. Frames stream to ffmpeg; the soundtrack is muxed in the same pass so sound and picture share one timeline. Details:
[`ENGINE.md`](ENGINE.md).

## 8. Sound

The song plus three public-domain effects (`video/analysis/sfx_mix.py`, cues in `video/data/sfx_cues.json`): a distant American police wail
that rises with the raid and fades as the police enter, three rifle cracks timed to the muzzle flashes, and a single struck singing bowl for the
last credit screen. Every effect level is set relative to the song's own loudness at that moment, so effects sit inside the music.

## 9. Credits

Four centred screens in a pixel typeface on near-black, one small blue ring each (`video/analysis/credits.py`), with the chorus and break
playing quietly underneath without vocals, a long fade, a breath of silence, and the bowl ringing as the last page settles
(`credits_audio.py`, `video/app/src/scenes/credits.ts`).

## 10. Review

Before a clip goes to a person, the review gate (`video/analysis/review_gate.py`) builds static evidence: contact strips sampling the whole clip
and a flicker scan. Someone opens the sheets and confirms what they checked. The judgement of motion is a person watching the clip play.
