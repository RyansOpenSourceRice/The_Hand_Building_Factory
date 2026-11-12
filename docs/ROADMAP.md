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
6. [x] Desktop comfort pass: strafe fix, level start camera, brighter
       daylight warehouse (bay lights, skylights, AI concrete and metal
       roof textures), filament color menu, detailed printer and
       conveyor. (2026.11.10.6)
7. [x] VR reflections round: thumbstick axis fix, comfort height raise
       (thumbstick click), low-poly controller hands, visible safety
       barrier ring, distinct station tables, supply conveyor from a
       floor pit with a 90-degree curve and roof hatch, grand factory
       hall (robot arms, racks, forklifts, stage, ~155-person instanced
       audience, walkers), four generated detail textures.
       (2026.11.10.7)
8. [x] Test on the actual Quest 3 via the Pages staging URL.
       (2026.11.11.3 and 2026.11.12.2, with feedback below.)
9. [x] Cheer swell plus a pre-rendered narrator that names each part and
       where it goes. (2026.11.12.3)
10. [ ] Fine tuning (90 Hz budget, seated/height adaptation, pause menu,
        mirror, itch upload, on-device validation, rate other entries).
11. [x] On-device feedback round: fist-shaped controller hands, magnetic
        screwdriver parented to the hand, working Pages audio, palette
        that recolors the printed hand, 12-person audience, low-poly
        screws, yellow screw arrows, render-loop error guard and perf
        readout. (2026.11.12.3)

12. [x] Second on-device feedback round: grouped phase narration with
        host names, interrupt/watchdog voice playback, a three-line
        in-world status board, a soft host glow while placing, x-ray
        guide arrows on the part and its destination, and screws
        anchored to the printed surfaces. (2026.11.12.4)

Definition of done for every item: the four gates in AGENTS.md.
