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

13. [x] Assembly correctness round: one shared 3x STL frame, a connected
        left hand on the pedestal, hobby-servo models with tabs, horn,
        wires, brushed-metal parts, an exclusive audio channel that waits
        for unlock, and a formal hand audit plus audio trace in the
        start-to-finish E2E. (2026.11.12.5)

14. [x] Cold-load audio follow-up: start the music loop only after its
        clip is ready, and require the music channel to be live at the
        end of the full E2E. (2026.11.12.6)

15. [x] Feedback round 2: five-digit box controller hands, finger screw
        alignment, forward screwdriver with 12 mm head contact, 21-part
        assembly with wrist plate and hinge pins, 256x256 tile library
        with PLA UVs, clear barrier crates, segmented hazard rail,
        counterbalance forklift on a clear forward/reverse lane, straight
        covered conveyor, thumb hinge boss and pins, texture/frame audits,
        and post-completion liveness coverage. (2026.11.13.1)

16. [x] Feedback round 3: 25-part assembly with four front knuckle
        caps, finger screws seated on the actual finger surface, servo
        and cap screws seated on their hosts, and forklift wall-clearance
        audits using the rotated model footprint. (2026.11.13.2)

17. [x] Blender-authored assets: the five printed meshes are rebuilt in
        Blender from the upstream Yeah Hand v1.3 STLs (25,514 to 5,262
        triangles, real UVs), screw anchors are derived from mesh facets
        and exported in `parts.json`, `npm run qa:geometry` validates
        them headlessly, and the glTF handedness root is detached so
        parts can be grabbed again. (2026.11.13.4)

18. [x] Full Blender pivot: the servo, wrist plate, knuckle pin, thumb
        pin, hinge boss and knuckle cap are modelled in the same script,
        so all 25 parts load from eleven Blender meshes and no hand
        geometry is built in TypeScript any more. (2026.11.13.5)

Definition of done for every item: the four gates in AGENTS.md.
