# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [CalVer](https://calver.org/) versioning
(`YYYY.MM.DD.N`).

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
