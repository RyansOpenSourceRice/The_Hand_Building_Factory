# Roadmap

Jam window: 2026-11-08 to 2026-11-15 (02:10 UTC).

1. [x] Running scene with core interactivity: move 1 red box into 1
       see-through blue box; the blue box disappears leaving the completed
       part. Proof the core game works.
       - [ ] Test on the actual Quest 3 via the Pages staging URL and in an
             itch-style iframe (pending Ryan pushing `dev`/`main`).
2. [ ] CI/CD E2E testing of the whole thing (GitHub Actions: lint,
       typecheck, unit, E2E, build, Pages deploy).
3. [ ] Import the real hand (yeah-hand STLs; Blender-on-Qubes timebox first,
       in-engine loader plus decimation fallback; pipeline debate as agreed).
4. [ ] Add an audience (instanced crowd, cheer swell, audio from OpenRouter
       generation direction to be provided by Ryan).
5. [ ] Fine tuning (90 Hz budget, seated/height adaptation, pause menu,
       mirror, itch upload, on-device validation, rate other entries).

Definition of done for every item: the four gates in AGENTS.md.
