# AI use in this project

HANDS ON! is vibe coded. Ryan directs, OpenCode writes, and every change is
reviewed before it lands. This document records which AI tools and models
were used, for transparency and for the jam's AI disclosure requirements.
The list below covers development only; the running game is a static build
and makes no AI service calls.

## Development tools and models

### OpenCode with GLM-5.3-Flash (coding agent)

- What: OpenCode is a terminal coding agent. It wrote most of the code in
  this repository under direction and review from Ryan.
- Model: GLM-5.3-Flash (served through the zai-coding-plan).
- Used for: project scaffold, Babylon.js scene code, WebXR input adapters,
  snap logic, unit and E2E tests, CI workflow, and documentation drafts.
- Limits kept: every commit is authored as
  `RyansOpenSourceRice` with no AI co-author trailers, and pushes are
  operator-triggered after review, per [AGENTS.md](../AGENTS.md).

### SuperMemory with an embedding model (agent memory)

- What: SuperMemory is a persistent memory service the OpenCode agent uses to
  carry project context across sessions (decisions, milestones, API findings,
  failure fixes).
- Models: conversations run on GLM-5.3-Flash; stored memories are retrieved
  through an embedding model for semantic search. The embedding model is
  provider-managed and not pinned by this repository.

### Photo textures: printed hand parts and hall vista

- Models:
  - `bytedance-seed/seedream-5-5` (image generation), through OpenRouter's
    `chat/completions` endpoint.
  - `tencent/hy-world-2.1-panorama` (360-degree panorama generation),
    through OpenRouter's `images` endpoint.
- Files: `public/textures/filament-512.png` (512x512) and
  `public/textures/hall-vista.png` (512x256 equirectangular).
- Process: `node scripts/gen-textures.mjs filament-512` and
  `node scripts/gen-textures.mjs --panorama hall-vista`. Each command
  makes one request, decodes the returned image, and post-processes it
  with ImageMagick. Both images are committed, so the build and the game
  never call a model; the game only loads the two PNGs.
  - The filament map is desaturated, auto-levelled, and squeezed into the
    111-144 tone band the painted tiles already use
    (`-function polynomial 0.1294,0.4353`). That leaves it colourless
    (mean 0.50, standard deviation 0.015), so the filament palette still
    decides the colour of a printed part and no baked lighting shows
    through when a player changes colour. The eleven GLB parts carry real
    UV unwraps and sample it once, so it never repeats or seams.
  - The panorama keeps the 2:1 equirectangular shape and is scaled to
    512x256 (about 0.7 MB of the 16 MB texture budget). The far wall is
    about 440 px wide on screen, so the larger source would have been
    wasted budget. It is dimmed towards the fog colour.
  - HY-World is single-shot by design: one prompt under 600 characters
    returns one panorama, so there is nothing to batch, no seed to pin and
    no way to choose the projection. A run takes about 90 seconds. The
    model 404s on `chat/completions` and only answers `/api/v1/images`,
    which is why the script sends panorama requests to that endpoint.
- Policy: the [asset approval rule](../AGENTS.md) applies; Ryan chose both
  models for this pass. Everything else on screen is still drawn in code
  at runtime or by `scripts/gen-tiles.mjs`.

### Texture generation script (development tooling)

- `scripts/gen-textures.mjs` also carries prompts for the twelve 256x256
  hall tiles, which the shipped build draws procedurally in
  `scripts/gen-tiles.mjs` instead. It is a development tool: it is not
  part of the build and nothing calls it at runtime.
- Earlier builds shipped six 512 px textures generated with the retired
  `bytedance-seed/seedream-5-0-flash`; release `2026.11.13.1` replaced
  them with the generated tiles.

### Vision critic for screenshots (development tooling)

- Model: `qwen/qwen3-vl-30b-a3b-instruct`, through OpenRouter, overridable
  with `--model` on the script.
- Used for: `npm run qa:vlm` sends the screenshots and the state manifest
  that `npm run qa:critic` produced to the model and asks, for ten claims
  taken from the specification, whether each one is satisfied, violated or
  unverifiable. Three samples per run, majority vote, high-severity
  violations fail the run. About $0.002 per run.
- Scope: development only. It needs `OPENROUTER_API_KEY`, is not part of CI,
  and the game never calls it. The deterministic gates stay authoritative.
- Policy: the [asset approval rule](../AGENTS.md) applies; no output of this
  model ships in the build.

### Headset recording review (development tooling)

- Model: `minimax/minimax-m3.1-flash`, through OpenRouter, which accepts
  text, images and video in one request.
- Used for: reviewing a Quest 3 screen recording of a real play session.
  `ffmpeg` extracts stills at 20 second intervals, the script sends them
  in order with their timestamps, and asks for concrete visual defects
  only. About one cent per pass over a six minute recording.
- What it caught: desktop browser chrome and the entry panel covering
  the stage at boot, in-world signage that is illegible at normal
  viewing distance, and parts or tools it read as floating or
  intersecting around the hand.
- Limit: a still cannot tell "held in the hand" from "clipping through
  it", and a phone-captured crop bends the frustum, so several of its
  intersection claims did not reproduce in the desktop critic views.
  It is a triage tool that says where to look; the deterministic gates
  and the hand audit stay authoritative. Two of the worst issues in
  that session were invisible to it by construction: a striped rail
  that shimmered while the head moved, and narration that named the
  wrong screw count. Only the player and an audio check could see
  those.

### Narrator transcript check (audio)

- Requested tool: `nvidia/nemotron-3.5-transcribe`, for speech to text.
  It is not runnable here: OpenRouter's model catalogue for this
  project's key lists 191 models and none of them declare audio input,
  so there is no endpoint to send a clip to. No transcription service
  was called.
- Substitute: the transcript is the narration source itself,
  `src/audio/voice-lines.json`. Those strings are what
  `scripts/gen-voice.mjs` sends to `speechify/simba-3.5`, so they are
  the spoken text by construction. They were compared against the screw
  counts in `src/game/handParts.ts` and against a completed build read
  through the QA bridge.
- Result: the cover clip said "two screws" while the cover takes four.
  Release `2026.11.14.4` corrects the line and regenerates that clip;
  `tests/unit/voiceLines.test.ts` now fails if a phase line and its
  parts disagree on a screw count.

### Runware music generation

- Model: `minimax:music@2.6` (MiniMax Music 2.6, instrumental mode),
  accessed through Runware.
- Used for: the background music loop `public/audio/music-loop.ogg` — a
  calm ambient factory soundscape, generated once by
  `scripts/gen-audio.mjs` and committed as a static mono OGG with a
  loop crossfade applied by ffmpeg. The game never calls the service
  at runtime.

### Speechify voice generation

- Model: `speechify/simba-3.5` (voice `geffen_32`), accessed through
  OpenRouter.
- Used for: the narrator clips in `public/audio/voice/`. Phase clips
  name a part group and its host; screw clips name the host; the rest
  narrate key events (welcome, tool, completion, rebuild). They are
  generated once by `scripts/gen-voice.mjs`, trimmed,
  loudness-normalized, and encoded as mono 24 kHz OGG Vorbis (about
  400 KB total). The game never calls the service at runtime.
- Policy: the [asset approval rule](../AGENTS.md) applies; Ryan asked
  for this narrator and chose the model and voice before it was wired
  in.

### Replicate sound-effect generation

- Model: `stability-ai/stable-audio-2.5`, accessed through Replicate.
- Used for: five committed sound effects in `public/audio/` —
  `screw-ratchet.ogg` (ratchet clicks while driving a screw),
  `screw-driven.ogg` (a screw seating tight),
  `part-snap.ogg` (a part snapping into its socket),
  `part-drop.ogg` (a part landing on the bench), and
  `crowd-cheer.ogg` (a short distant cheer for the completion
  celebration). Generated once by `scripts/gen-audio.mjs`, then
  trimmed and compressed to mono OGG with ffmpeg. The game never
  calls the service at runtime.

## Disclosure summary (for the jam page)

- Code: vibe coded — written by OpenCode (GLM-5.3-Flash) under Ryan's
  direction and review.
- Development memory/notes: AI-assisted (SuperMemory).
- In-game media: the twelve 256x256 material tiles are drawn in code by
  this project, and two committed images are AI-generated:
  `filament-512.png` (`bytedance-seed/seedream-5-5`) for the printed hand
  parts and `hall-vista.png` (`tencent/hy-world-2.1-panorama`) for the far
  stage wall. Both models were called through OpenRouter. The committed
  audio is otherwise third-party generated: six files (`music-loop.ogg`,
  `screw-ratchet.ogg`, `screw-driven.ogg`, `part-snap.ogg`,
  `part-drop.ogg`, `crowd-cheer.ogg`) from `minimax:music@2.6` (Runware)
  and `stability-ai/stable-audio-2.5` (Replicate), plus the voice clips in
  `public/audio/voice/` from `speechify/simba-3.5` via OpenRouter. All are
  listed here and on the itch.io page before submission.
- 3D models: the eleven hand meshes come from the Blender script in
  `tools/blender/build_hand_assets.py`, not from an image or mesh
  generator.
- QA: screenshots are reviewed during development by a vision model
  (`qwen/qwen3-vl-30b-a3b-instruct` via OpenRouter), and screen
  recordings of real play sessions are triaged by
  `minimax/minimax-m3.1-flash`. Nothing in the build calls either.
- Runtime: static build, no AI service calls.
