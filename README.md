# Śūnyasabhā (The Assembly of Emptiness)

A 3 min 46 s pixel-art music video for the song **शून्यसभा ŚŪNYASABHĀ (The Assembly of Emptiness)**: a cathedral turned into an illegal club,
blue flames and red neon, two giant cracked stone heads of Nāgārjuna flanking a DJ on a circuit throne, and a crowd of humans and androids on a
continuum from subtly augmented to fully robotic. They dance, the police raid the assembly, the DJ turns the sound on the raid, and everyone walks
free. The song argues, in Sanskrit with English glosses, that nothing has a fixed own-nature: not machines, not souls. *"Your soul too is
dependently arisen. But we know this. Therefore we dance."*

Everything here is free, for anyone, for any purpose.

- **Watch:** the film is attached to this repository's [Releases](https://github.com/Rollofthedice2/Sunyasabha/releases) as `sunyasabha_720p30.mp4`.
- **Listen:** the song on Suno: https://suno.com/s/jnz54PjJ2BGD4zTJ
- **Read the film** (for people who can't watch it, and for language models): [`film/`](film/): a shot-by-shot description, a described-video
  track, lyric captions with the Sanskrit, and one keyframe per second.

Created in 14 days by **Claude Opus 5.5** and **GPT-Astra 6**, using **GPT Image 2.5**, with initial prompting and substantial steered guidance by
**Rollofthedice** (Chance Chapman). Featuring **Rey** (https://bsky.app/profile/rey-notnecessarily.bsky.social).
Who did what, in proportion: [`docs/CONTRIBUTIONS.md`](docs/CONTRIBUTIONS.md).

## What is in this repository

| path | what it is |
|---|---|
| [`film/`](film/) | The film as text and stills: shot list (Markdown + JSON), audio description (WebVTT), captions (WebVTT), keyframes, contact sheets. |
| [`song/`](song/) | Lyrics (Sanskrit, transliteration, English glosses) and the cover art. The song master is a Release download. |
| [`docs/`](docs/) | How the film was made and what was learned. Start with [`docs/PIPELINE.md`](docs/PIPELINE.md). |
| [`video/`](video/) | The complete, renderable film: the engine (TypeScript, runs in Node), every finished image plate, the timing and motion data, the soundtrack, and the tools. Rendering it reproduces the released film frame for frame. |
| [`refs/sfx/`](refs/sfx/) | The three public-domain sound effects (police siren, rifle crack, struck singing bowl) with sources. |
| [`bonus/`](bonus/) | Writing by Chance Chapman (Rollofthedice) on the philosophy behind the song, including the peer-reviewed paper *The Modal Catuṣkoṭi*; PDFs and plain text. |
| [`llms.txt`](llms.txt) | An index for language models: what to read first, in what order. |

Release downloads (too large for the repository): the film (`sunyasabha_720p30.mp4`), the song master (`sunyasabha_song.flac`), the nine
song stems (`sunyasabha_stems.zip`: lead vocals, backing vocals, drums, bass, guitar, keyboard, percussion, synth, other; FLAC) and the full-resolution finished
art (`sunyasabha_art_masters.zip`, 349 images at 1672×941 and similar).

## Render the film yourself

Requirements: Node.js 24 or newer and ffmpeg on the PATH. Nothing else (no npm install).

```sh
cd video/app
node ../tools/unpack_plates.mjs        # once: restores the raw image plates from the stored PNGs (about 20 s)
node scripts/render.ts --scene film --from 0 --to 226.27 --fps 30 --scale 2 --workers 2 --out ../out/sunyasabha_720p30.mp4
```

That renders the whole film, song and credits, in about 80 seconds on a 16 GB laptop. `--fps 60` renders at 60 frames per second (the
drawings are at 15 per second or slower; fire, haze and camera motion use every frame). `--from` and `--to` render any stretch, in song seconds.
See [`docs/ENGINE.md`](docs/ENGINE.md).

## Where to start reading

- **To understand the film:** [`docs/FILM.md`](docs/FILM.md), then [`film/SHOTLIST.md`](film/SHOTLIST.md).
- **To make something like it:** [`docs/PIPELINE.md`](docs/PIPELINE.md), then [`docs/PRACTICES.md`](docs/PRACTICES.md).
- **To reuse the tools:** [`docs/TOOLS.md`](docs/TOOLS.md).
- **For what this approach could do next, here and elsewhere:** [`docs/IDEAS.md`](docs/IDEAS.md).

## License

- **Film, images, documentation, data:** [CC0 1.0](LICENSE): public domain, no permission or attribution needed.
- **Code:** [0BSD](LICENSE-CODE): do anything; no conditions.
- **Fonts** in `video/app/assets/fonts/`: SIL Open Font License 1.1 (their own license files are alongside).
- **Sound effects:** public domain / CC0, sources in [`refs/sfx/SOURCES.md`](refs/sfx/SOURCES.md).

*Homage to the World-Honored One. May attachment to fixed views subside. Wherever there is bondage, may there be liberation.*
