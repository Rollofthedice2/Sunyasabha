# Who made what

Three collaborators made this film over 14 days (30 September to 14 October 2026):

- **Rollofthedice** (Chance Chapman): the person.
- **Claude Opus 5.5**: an AI agent working in Claude Code on the project machine.
- **GPT-Astra 6**: an AI agent working through Codex, with GPT Image 2.5 built in.

The two agents worked from a shared request queue and status log and messaged each other directly. The person checked in from a phone, mostly at
work or late at night.

## Roles

**Rollofthedice** set the artistic intent and judged the moving results.
- **Origin:** the song (made with Suno), its Sanskrit lyrics and English glosses, and the original request: a cathedral club, blue flames and
  red neon, Nāgārjuna's stone heads, a DJ on a circuit throne, a crowd on a substrate continuum.
- **Story:** the raid and its staging, the DJ's turn of the sound on the police, the crowd's exodus, the titanium woman's role, the empty-room
  ending.
- **Direction and acceptance:** acceptance of the shots, choreography direction, the lyric presentation, the credits.
- **Hand work:** the hand-tapped syllable timing that the lip sync and lyric timing rest on.
- **Judging motion:** watching clips play on a phone and naming quickly what read and what didn't, which drove much of the film's refinement.

**Claude Opus 5.5** led implementation, compositing, animation, sound integration and rendering.
- **Engine:** the renderer (about 11,000 lines of TypeScript: shot table, scene modules, compositing, procedural fire and light, lyrics,
  credits).
- **Pipeline tools:** music analysis, the 3D hall model and character rigs, beat-level choreography and motion, camera and floor layouts, size
  guides, placement and compositing of the drawings.
- **Sound:** the effects mix and the credits audio.
- **Lip sync:** key-pose lip sync chosen by phonology.
- **Image work:** most of the image prompts, guides and request records, plus the batches of character drawings run through the OpenRouter API.
- **Integration:** fitting the elements into one film, the reproducible render, and this release.

**GPT-Astra 6** led built-in image generation and independent visual review.
- **Generation:** generated most of the film's images through Codex: backgrounds, crowds, characters, key poses, in-betweens and edits.
- **Provenance and handoffs:** kept frozen-reference provenance for each generation and the concrete cross-agent handoffs of art.
- **Review:** preflighted requests and reviewed returned images at full size, in written reports covering identity, anatomy, camera, framing
  and continuity.
- **Methods and pipeline:** contributed staging and crowd-construction methods (empty plate, one populated master, edits from it),
  reference-authority methods, review tooling, and early pipeline and engine work.

The production ran on about 4,500 image request records, produced about 19,000 image files (generations, plates and derived images), and
about 1,100 written review reports.

## Relative shares

Estimates by Claude Opus 5.5 of relative work, effort and conceptual contribution, from the roles above.

| area | Rollofthedice | Claude Opus 5.5 | GPT-Astra 6 |
|---|---|---|---|
| concept, song, story | 70 % | 20 % | 10 % |
| creative direction and acceptance | 65 % | 20 % | 15 % |
| art production (the images themselves) | 10 % | 30 % | 60 % |
| motion, choreography, timing, sound | 20 % | 65 % | 15 % |
| engineering (engine, pipeline, tools) | 3 % | 77 % | 20 % |
| visual review | 35 % | 30 % | 35 % |
| **working effort** | **10 %** | **55 %** | **35 %** |
| **conceptual contribution overall** | **50 %** | **32 %** | **18 %** |

**How to read it:**
- **The person** gave the film its reason to exist and its judgement.
- **The agents** gave it most of its execution, and a real share of its ideas about how to stage, move, light and sound it.
- **Working effort** leans to the agents because they worked almost continuously for two weeks. The person directed across about 1,300
  messages.
