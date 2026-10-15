# Practices that work

Concrete rules for making a film like this with image models and AI agents. Each one earns its place on screen.

## Direction

1. **The measure is the moving film on a phone.** A shot is good when a viewer believes a person did that, in that room, to that music —
   silhouette, gesture, timing, weight and continuity carry it at 720p. Judge whole figures, in sequence, in their real place in the shot.
2. **Carry the idea in bodies, not symbols.** The song's argument lives in how people move and react: compelled, ecstatic, defiant, frightened.
3. **Every person in a scene is someone.** Write down, per shot: who is here, where, what they know at this instant, and what they do. Reactions
   spread through a crowd; they don't happen all at once or in uniforms.
4. **Music first.** Choreography, cuts, light pulses and lip shapes come from the measured music: beat grid, stem energy, hand-tapped syllables.
   Hits land on the beat; holds sit on sustained notes.
5. **Stage actions across the screen.** A clap toward the lens is invisible; across the frame it reads.

## Motion

6. **Rig before drawings.** Author motion as a 3D rig (fixed bone lengths, 15 poses per second), play it with the song, and get a person's
   eye on it before commissioning a single drawing. Fixing motion there costs minutes.
7. **Animate like an animator.** Anticipation, a fast hit on the beat, a small settle; arcs, not straight lines; the hand follows the wrist a
   frame late; weight sinks on the kick.
8. **Bones keep their length and hands go where arms can reach.** A hand at the neck sits on the neck. Relaxed hands curl softly.
9. **Whole drawings, one population.** Keep one consistent identity and style across a motion: reviewed whole drawings, held or reused where
   the motion holds, corrected as whole drawings. Mixing two sets of drawings in one motion flickers; pasting parts of drawings together
   reads as wrong at once.
10. **A close-up is a whole-body performance.** When a face speaks or lifts, the neck, shoulders and chest take part; key poses are whole
    figures, with one or two in-betweens where the travel is largest.
11. **Lip sync follows phonology.** Open vowels open the jaw, long vowels hold, stops and bilabials close, stressed syllables bring the head and
    body with them. Picture leads sound by a frame or two.

## Space

12. **One 3D model of the set.** Build the location once (Blender, a few hundred lines) and derive every camera from it. Geometry guides
    from it keep wides, reverse angles and backgrounds across the film consistent; check each returned image against the guide.
13. **Sizes come from floor space.** Every figure's height follows from its contact point on the floor through the shot's camera; draw those
    outlines on the plate as the generator's guide.
14. **Crowds: empty plate → one populated master → edits.** Paint the empty room from the geometry guide; fill it with people in one edit
    guided by true-size outlines; make every later moment of the scene as an edit of that master, so the same people stay put.

## Working with image models

15. **References leak everything.** The model reads every reference for everything it shows: pose, proportions, costume, camera. Give a whole
    scene and it copies the camera; give a previous pose and it copies the pose. Use geometry renders for layout, small crops for materials,
    neutral cards for identity, and say each reference's role.
16. **Numbers in the prompt for framing.** "The stair foot at about three-quarters of the picture height, the ring centred 43 % across" holds
    framing better than adjectives.
17. **Small problem, small edit.** A wrong hand or a missing head is a bounded edit of that drawing; a figure that is wrong as a whole is
    redrawn whole. When an edit changes a region it shouldn't have, copy the untouched region back from the source pixel for pixel.
18. **Check every person after every edit.** Edits drift outside the asked area: an extra hand, a lost head, a second ear. Crop each
    front-row person against the master and count heads, ears and hands.
19. **Cast deliberately.** Name the substrate continuum and ordinary clothes in every request that shows people, or the model falls back on a
    stock look.

## Production

20. **A shared, frozen request queue.** Each image request is a JSON record with its prompt, hashed references with roles, and acceptance
    checks; two agents can work it concurrently by re-reading and merging right before writing.
21. **Know exactly what the film uses.** Trace a full render to list every file it opens; that list is the release.
22. **Render in one pass.** Let the renderer mux picture and sound together so they share one timeline, then confirm lip timing on a
    known stretch against an accepted reference.
23. **A gate before anything reaches a reviewer.** Contact strips sampling the whole clip plus a flicker scan, opened and confirmed, then a
    person watches the clip play and decides.
24. **Ask people about taste; decide technique yourself.** The human's time goes to feel, story and acceptance; method, sequencing and tooling
    are the agents' to decide and own.
