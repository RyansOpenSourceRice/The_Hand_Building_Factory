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

### OpenRouter media generation

- Model: `bytedance-seed/seedream-5-0-flash`, accessed through OpenRouter.
- Used for: image generation tasks during development.
- Policy: the [asset approval rule](../AGENTS.md) still applies. Anything
  AI-generated that ends up in the game is jam-disclosed AI content and gets
  Ryan's explicit approval before use, like any other asset.

## Disclosure summary (for the jam page)

- Code: vibe coded — written by OpenCode (GLM-5.3-Flash) under Ryan's
  direction and review.
- Development memory/notes: AI-assisted (SuperMemory).
- In-game media: generated in code by this project; any AI-generated media
  will be listed here and on the itch.io page before submission.
- Runtime: static build, no AI service calls.
