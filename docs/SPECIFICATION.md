# Specification

What HANDS ON! does, milestone by milestone.

## Current behavior (milestone 1)

- A stage scene loads: floor, lit pedestal, spot light, curtain backdrop.
- A red part rests on the pedestal. A translucent blue outline floats to its
  upper right, showing where the part belongs.
- Any browser that exposes `navigator.xr` (Quest browsers included) is
  treated as XR-capable: a large ENTER VR button appears bottom-center.
  Pressing it starts an immersive-vr session with a local-floor reference
  space; the button hides while in VR and returns on exit. If the session
  fails to start, the status line says why and the stage stays usable.
  The support pre-check is deliberately skipped because Quest Browser has
  been observed reporting no support even in-headset.
- When `navigator.xr` is missing, the page says so in the status line. On
  browsers that identify as Quest, the message asks the player to reload or
  open a private window. The `#live-status` element carries machine-readable
  `data-ready`, `data-xr`, `data-ua-quest`, and `data-secure` attributes for
  remote diagnosis.
- Quest 3: point at the part with a controller and hold the trigger to grab
  it. The part follows the controller. Release the trigger with the part
  inside the outline and the part locks in place, the outline disappears, and
  the controller pulses. Grip squeeze resets the demo.
- The HUD buttons (UNDO, REDO, RESET) work on desktop and are also pressable
  in-headset via the controller pointer rays, so VR players get menu-based
  undo and redo without extra controller bindings. Triggers stay reserved for
  moving items.
- UNDO and REDO step back and forward through every committed part move,
  snap, and reset (stack capped at 50 entries). Desktop players can also use
  Ctrl+Z, Ctrl+Shift+Z, and Ctrl+Y. Carrying the part blocks undo and redo
  until the move finishes.
- RESET always returns the part to its starting spot on the pedestal, even
  before the first snap.
- Desktop: click and drag the part across the floor plane at its height.
  Release inside the outline to complete; the RESET button always restores
  it to the pedestal.
- When WebXR is not available, the scene still renders with a desktop
  preview notice. HUD status text mirrors into a hidden live region for
  screen readers and automated tests.

## Milestone 2: CI/CD E2E of the whole thing

- GitHub Actions runs lint, typecheck, unit tests, E2E smoke tests against
  the production build on Firefox (desktop path) and headless Chromium (XR
  detection path), and the production build itself.
- The production build deploys to GitHub Pages from `main`, giving an HTTPS
  URL for on-device Quest testing outside the itch iframe.

## Milestone 3: import the real hand

- Hand part meshes derived from the yeah-hand release STLs replace the red
  box placeholder, converted under CERN-OHL-S-2.0 with credit and notices.
- Conversion pipeline: timeboxed Blender headless test on Qubes (CPU only);
  fallback is Babylon's STL loader plus built-in mesh decimation.
- The snap service generalizes from one part to a list of parts so the hand
  assembles socket by socket.

## Milestone 4: audience

- An instanced crowd fills tiered seating around the stage: varied heights
  (5 ft to 6 ft 4 in), varied palettes, adult figures only.
- Crowd animation and cheer intensity scale with assembly progress.
- Audio replaces the silent loop (Ryan supplies OpenRouter audio generation
  direction at this milestone). No autoplaying sound before interaction.
- Completion triggers a hand gesture routine and a celebration that respects
  `prefers-reduced-motion`.

## Milestone 5: fine tuning

- Frame budget pass targeting Quest 3 at 90 Hz; crowd geometry instanced.
- Seated mode support and bench height adaptation to player height.
- Calming pause menu; stage mirror showing the player's controller hands.
- Final docs, itch.io HTML5 upload (fullscreen iframe embed, VR support
  enabled so the iframe grants `xr-spatial-tracking`), on-device
  validation of the itch page, and jam ratings for other entries.

## Non-goals

- Hand tracking support (controllers only).
- Locomotion of any kind.
- Multiplayer.
- Mobile or native desktop targets.
