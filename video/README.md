# video/: the renderable film

Everything the final film reads, and nothing else:

- `app/`: the TypeScript engine (runs in Node 24, no dependencies) and its assets (`assets/plates/` images as PNG + JSON, `assets/text/` lyric
  masks, `assets/fonts/`).
- `data/`: timing and schedules.
- `audio/soundtrack.flac`: song + effects + credits audio.
- `tools/unpack_plates.mjs`: run once after cloning.
- `analysis/`: the production tools (see `../docs/TOOLS.md`).
- `sync/`: the syllable-tapping tool.

Render: see `../docs/ENGINE.md`. Rendering reproduces the released `sunyasabha_720p30.mp4` frame for frame.
