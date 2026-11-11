# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [CalVer](https://calver.org/) versioning
(`YYYY.MM.DD.N`).

## [2026.11.10.7] - 2026-11-10

### Added

- In VR, pressing either thumbstick raises the rig through three
  comfort heights (0, +0.4, +0.8 m) with a soft haptic tick, for
  seated or shorter players. The lift glides and snaps instantly
  under reduced motion.
- Low-poly controller hands: each controller carries a semi-
  transparent hand tinted with the theme's primary filament color.
- A visible yellow safety barrier ring with a hazard-striped top
  rail marks the 1.25 m locomotion boundary, and dropped parts now
  bounce off it.
- Distinct stations: a circular polished pedestal with an emissive
  ring, a printer bench with steel top, shelf, and pegboard to the
  west, and the conveyor on the east.
- A supply conveyor that starts in a floor pit, runs level, turns
  ninety degrees, and climbs a supported slope into the receiving
  belt, under an opened roof hatch with a soft light shaft. New
  parts ride this path into reach.
- A grand factory hall beyond the workshop's north sill: painted
  floor lanes, pallet racks, pallet stacks, a parked and a patrolling
  forklift, five giant yellow robot arms, a demo stage with screens
  and podium, an audience of about 155 seated and standing figures,
  aisle walkers, hanging tube fixtures, and garage doors on the south
  wall.
- Four generated detail textures: pegboard, brushed steel, rack
  boxes, and garage door (see `docs/AI_USAGE.md`).

### Fixed

- Thumbstick movement no longer feels inverted on Quest controllers;
  stick direction now matches the desktop controls on both sticks.

### Changed

- The workshop's north wall is now a low sill overlooking the hall;
  the ground plane and its collider cover the whole venue.

### Added

- A filament color menu: the COLORS button opens three rows (primary,
  secondary, tertiary) of eight calm colors. Choices apply to the hand
  parts only, persist between visits, and re-tint the build live.
- Concrete floor and corrugated metal roof surfaces, generated with an
  AI image model (see `docs/AI_USAGE.md`), with procedural placeholder
  fallbacks in `scripts/gen-placeholder-textures.mjs`.
- Roof detail: steel purlins and six frosted skylight diffusers.
- High-bay light fixtures with hanging cords, two additional bay lights,
  and a brighter, bluer fog for a calm daytime warehouse.
- Printer detail: a full body shell with side panels, a glass window, a
  PRINTING control screen, an LED strip, a warning plate, vents, feet,
  and two filament spools on top. The print bed moved up to sit on the
  shell. The conveyor gained side rails, mid rollers, and a hazard
  stripe band.

### Fixed

- A and D (and strafe input) no longer feel inverted on desktop; the
  start camera no longer leans to one side.

### Changed

- The lint setup strips rules that ESLint 10 removed from the Google
  config and gives the Node scripts their own globals.

## [2026.11.10.5] - 2026-11-10

### Added

- The full yeah-hand assembly: a 13-part build queue (palm, servo base,
  four finger servos, thumb base, four fingers, thumb segments, upper
  cover), one part at a time, with a socket outline that follows the
  player's view.
- A 3D printer and a conveyor belt as spawn machines: printed parts drop
  onto the printer bed, servos slide in on the conveyor, and every part
  rests flat on its source machine. RESET returns parts to their machines.
  Spawn animations respect `prefers-reduced-motion`.
- Havok physics: dropped parts fall and land, and a watchdog returns
  anything that ends up off the stage.
- A screw-driving phase: pick up the orange screwdriver, point the tip at
  a screw, and hold the trigger to drive it. Ratchet ticks and gentle
  controller pulses play while driving, and the screw seats with a click.
  The palm takes 4 screws, the upper cover takes 2, and every other part
  takes 1. Screws can never be carried.
- Turn settings: TURN swaps snap and smooth turning, ANGLE cycles the snap
  angle (30, 45, 90 degrees), and both persist between visits. Smooth
  turning rides the left thumbstick at 90 degrees per second.
- Desktop movement: WASD or arrow keys move within a 1.25 m stage radius;
  arrow keys also turn the camera.
- Warehouse dressing: three-story walls, steel beams, a catwalk railing,
  pendant lights, and crates, all generated in code.

### Changed

- UNDO and REDO now also revert screw drives, and RESET returns the part
  to its own spawn machine instead of the pedestal.
- Hand parts are the yeah-hand meshes (`public/models/hand/`), scaled into
  game units in code, under CERN-OHL-S-2.0 with notices.

## [2026.11.10.4] - 2026-11-10

### Added

- Undo and redo for every committed part move, snap, and reset: UNDO and
  REDO buttons in the HUD (pressable in VR through the controller pointer
  rays), Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y on desktop, and unit tests for the
  history stack.
- XR self-diagnostics: when `navigator.xr` is missing, the status line says
  so, with a Quest-specific message on Quest-identifying browsers, plus
  `data-xr`, `data-ua-quest`, and `data-secure` attributes for remote
  diagnosis.
- E2E coverage of the XR path in headless Chromium: detection, ENTER VR
  rendering, and graceful failure without a device. Firefox E2E now covers
  the RESET and UNDO buttons.

### Changed

- RESET always returns the part to the pedestal, even before the first snap.
- The snap target outline now disappears the moment the part locks in,
  instead of after its fade-out animation.

## [2026.11.10.3] - 2026-11-10

### Changed

- Assume VR when a browser exposes `navigator.xr`: the unreliable
  `isSessionSupported` pre-check is gone, and a large ENTER VR button now
  starts the session from its own click (which also satisfies the WebXR
  user-gesture requirement). The button hides in VR and returns on exit.
- When a session fails to start, the status line reports the reason and the
  stage stays usable instead of treating it as fatal.

## [2026.11.10.2] - 2026-11-10

### Added

- `CITATION.cff` with citation metadata (author Ryan Glascock, CalVer
  version, Apache-2.0, repository URL). CI now fails when the citation
  version drifts from `package.json`.
- Visible boot screen in plain HTML so the page is never blank, and a
  detailed error screen (type, detail, explanation, next steps) when the
  scene fails to start.
- `docs/AI_USAGE.md` recording the development-time AI tools and models.

### Fixed

- Production build now uses relative asset paths, so GitHub Pages serves
  it from the repository subpath (previously a blank page).
- CI E2E runs under a virtual display with software GL, fixing the
  headless Firefox "WebGL not supported" failure.
- Pages deploy now also runs for manual workflow_dispatch runs on main.

## [2026.11.10.1] - 2026-11-10

### Added

- Project scaffold: Vite + TypeScript + Babylon.js with hardened `.npmrc`.
- Core interaction demo: grab the red part (Quest controller trigger or mouse
  drag) and release it inside the translucent blue outline to complete the
  part. Ghost outline fades on success, haptic pulse fires on Quest
  controllers, and the part can be reset with grip squeeze or the RESET button.
- Standing stage environment: lit pedestal, spot light, procedural floor
  pattern, curtain backdrop (no external assets).
- Accessibility: hidden live region mirroring HUD status for screen readers;
  graceful desktop preview when WebXR is unavailable.
- Unit tests for snap logic (vitest, Babylon NullEngine) and a Playwright
  Firefox smoke test.
- CI workflow: lint, typecheck, unit tests, E2E, build, and GitHub Pages
  deploy from `main`.
- Repository standards: AGENTS.md rules, DESIGN/SPECIFICATION/ROADMAP docs,
  third-party notices, pre-commit config (gitleaks, codespell, hygiene hooks).
