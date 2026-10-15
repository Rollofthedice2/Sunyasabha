# Śūnyasabhā: accessible film files

This folder lets you follow the music video **"शून्यसभा ŚŪNYASABHĀ (The Assembly of Emptiness)"** in text and stills. It is for blind and low-vision viewers, for anyone who wants the lyrics and their Sanskrit side by side, and for language models.

The film runs 3:46 (226.27 s). The song plays from 0:00 to 3:07.3, and the credits run from 3:07.3 to 3:46.3. All times below refer to the film file at 720p, 30 frames per second.

## The files

| File | What it is |
|---|---|
| `SHOTLIST.md` | Every shot in order (77 in all), grouped by song section. For each shot: start and end time (m:ss.s), what is on screen (setting, who, action, camera), the characters, and the lyric lines visible during it. Each lyric line is given in English as shown in the film, then in IAST transliteration and Devanagari. |
| `shotlist.json` | The same shot list as structured data. It is a list of objects: `{start, end, start_tc, end_tc, section, shot_id, description, characters[], lyrics[{t, text, sanskrit, iast}]}`. `start`, `end` and `t` are in seconds. `section` is one of `intro, verse1, pre1, chorus, break, verse2, pre2, bridge, drop, verse3, outro, tail, credits`. |
| `audio_description.vtt` | A described-video track in WebVTT (`kind="descriptions"`), paced to be spoken over the film: 49 cues, one per musical phrase or scene beat, from the first frame to the end of the credits. Each cue says who is on screen, where, and what happens, at no more than 2.5 words per second of its time. The credits cues read the credit text. |
| `captions.vtt` | WebVTT lyric captions: the English lyric rows exactly as they appear on screen, at the times they appear, with the Sanskrit original in IAST on a second line. In the film the rows of one group stack and stay up together. Here each row is its own cue, ending when the next row appears. |
| `captions_sdh.vtt` | Captions for deaf and hard-of-hearing viewers: every sung line (English, then the Sanskrit in IAST) plus the sounds that carry the story: the opening instruments, the police siren, the three rifle shots, the burst of sound when the DJ turns the music on the police, the credits music and the singing bowl. Plain WebVTT, 66 cues, ready to attach to an upload (for example as the English captions on Bluesky). |
| `keyframes/` | One still per second, `t000.jpg` to `t226.jpg` (640x360 JPEG). `tNNN.jpg` is the frame at NNN seconds. |
| `contact_sheets/` | Grids of the keyframes, 30 seconds per sheet (6 across, 5 down), each still labelled with its timecode: `sheet_000-030.jpg`, `sheet_030-060.jpg`, ... `sheet_210-226.jpg`. |

## How to use them

**In a video player.** Load the `.vtt` files as tracks beside the film.

- VLC: *Subtitle > Add Subtitle File...* and pick `captions.vtt` or `audio_description.vtt`.
- On a web page:

  ```html
  <video controls src="sunyasabha_720p30.mp4">
    <track kind="captions" src="film/captions.vtt" srclang="en" label="Lyrics (English + Sanskrit)" default>
    <track kind="descriptions" src="film/audio_description.vtt" srclang="en" label="Audio description">
  </video>
  ```

**Reading instead of watching.** Read `SHOTLIST.md` from top to bottom. It tells the whole story shot by shot, with the lyrics in place. `audio_description.vtt` tells the same story at the pace of the film.

**For a language model.** Give it `SHOTLIST.md` (or `shotlist.json`) and `captions.vtt`. Together they describe every shot, the action and the lyrics against one timeline. If the model can read images, add `contact_sheets/` for an overview of the whole film at a glance, or the `keyframes/` for any given second.

## The story in brief

On a rainy night a line of people waits outside a steel door under a red neon sign. Inside is a gothic cathedral turned into an illegal club, lit by red neon and blue flames. A DJ plays on a circuit-board throne between two giant cracked stone heads. The crowd ranges from humans with small implants to full robots: a dancer with a chrome arm, a dancing robot, and a young man with a screen over one eye.

Verse 2 follows a woman with a titanium spine. Her memory is wiped for the fifteenth time, and she dances anyway. She pulls the control cable out of her spine and kisses the person she loves. In the bridge the DJ sits cross-legged between the stone heads, and three dancers take the floor.

Outside, a smoker sees police lights and runs in to warn everyone. Riot police raid the club and force the crowd to the floor. The titanium woman and the DJ answer them: "Yes. We know. We were always in violation." The police fire into the air and force her to her knees. The DJ turns the sound on them, and their visors overload. While the police reel, everyone runs up the stairs and out into the rain. The film ends on the empty hall, with the decks abandoned.
