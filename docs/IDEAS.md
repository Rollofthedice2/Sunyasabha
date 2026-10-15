# Ideas: improving the process, and uses elsewhere

## Making the next film faster and better

1. **Write the beat sheet before any art.** For every shot, record who is in it, where they are, what they know, what they do on which beat, and
   the camera, as one table timed to the beat grid. Every downstream step reads from it.
2. **Build the 3D set on day one.** One Blender blockout of the location, with every camera saved as numbers. Paint all backgrounds from its
   geometry renders. Continuity across the whole film then comes for free.
3. **Make the rig preview the main review point.** A mannequin dancing with the song for a few seconds tells a person almost everything about
   the motion, for almost no cost. Get each dance accepted there before drawing.
4. **Generate the whole scene family from one master.** For each location, make one empty plate, then one populated master, then every moment
   as an edit of the master. Check each person in the front rows after every edit.
5. **Separate references by job.** Use geometry renders for layout, small crops for materials, neutral cards for identity and pose guides for
   pose, and give each one a stated role in the request.
6. **Automate the obvious checks:**
   - count heads, hands and ears per person after edits (face and hand detectors on crops);
   - compare figure sizes against the floor-plan projection;
   - match lip timing against an accepted reference by frame index.
   Keep the person for what only a person can judge: feel.
7. **One record of what is live.** Keep one table of every element with its version and status (live, pending or rejected), and render from
   it. Tracing a full render gives the exact list of files the film uses.
8. **Store sources, not only results.** Keep the full-resolution drawings, their placement numbers and the composite settings, so any shot can
   be re-composited at a higher resolution or into a new layout.

## Where the approach transfers

- **Any music video or short animation on a small budget.** Music analysis, beat-level choreography, a 3D blockout and rigs, image-model
  drawings and a tiny renderer reach a consistent, hand-made look without a studio.
- **Games and interactive pixel art.** The engine draws 640×360 plates and procedural light in real time, and could drive a game scene or a
  live visualiser from the same assets and the same beat data.
- **Live performance.** The beat-locked flame, haze and siren layers could run as reactive stage visuals for a DJ set from a live audio
  input.
- **Education.** The film is a worked example of Madhyamaka ideas (the tetralemma, dependent arising, emptiness of own-nature) carried in
  story and bodies rather than lecture. The shot list and captions can serve as a text for discussion.
- **Accessibility practice.** The `film/` folder holds a shot list, a described-video track, captions with the original language and
  per-second keyframes. It shows a way to make any film legible to blind and low-vision viewers, and to language models.
- **Human–AI collaboration.** The division of labour here is a usable pattern:
  - a person sets meaning and judges feel;
  - one agent builds and integrates;
  - a second agent generates and independently reviews;
  - they share frozen, hashed requests and a common log.
  It applies to illustration, comics, documentation, data visualisation and scientific figures.
- **Dataset and research use.** The production kept every image's prompt, references, review and placement. Published with the images,
  those records would make a small, fully documented case of controllable generation: consistency of identity, camera adherence,
  size-by-depth and edit locality.
