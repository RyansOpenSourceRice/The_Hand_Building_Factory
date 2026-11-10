# Roadmap

Jam window: 2026-11-08 to 2026-11-15 (02:10 UTC).

1. [x] Running scene with core interactivity: move 1 red box into 1
       see-through blue box; the blue box disappears leaving the completed
       part. Proof the core game works. (2026.11.10.1)
2. [x] CI/CD E2E testing of the whole thing (GitHub Actions: lint,
       typecheck, unit, E2E, build, Pages deploy). (2026.11.10.2)
3. [x] Import the real hand (yeah-hand STLs loaded in-engine, scaled and
       assembled socket by socket). (2026.11.10.5)
4. [x] Assembly depth: Havok physics, printer and conveyor spawn machines,
       screw driving with the screwdriver. (2026.11.10.5)
5. [x] Warehouse dressing (walls, beams, railing, lights, crates).
       (2026.11.10.5)
6. [ ] Test on the actual Quest 3 via the Pages staging URL and in an
       itch-style iframe (pending Ryan pushing `dev`/`main`).
7. [ ] Add an audience (instanced crowd, cheer swell, audio from OpenRouter
       generation direction to be provided by Ryan).
8. [ ] Fine tuning (90 Hz budget, seated/height adaptation, pause menu,
       mirror, itch upload, on-device validation, rate other entries).

Definition of done for every item: the four gates in AGENTS.md.
