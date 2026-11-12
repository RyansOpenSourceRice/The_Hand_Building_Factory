# Specification

What HANDS ON! does, milestone by milestone.

## Current behavior (release 2026.11.10.7)

- A warehouse workshop opens through a low north sill onto a grand
  factory hall, generated almost entirely in code. The workshop keeps the
  lit assembly pedestal, the 3D printer bench on the west, and the
  conveyor station on the east. The hall carries painted floor lanes,
  pallet racks with boxed loads, pallet stacks, a parked and a patrolling
  forklift, five giant yellow robot arms, a demo stage with screens,
  podium, and a branded band, an audience of about 155 seated and
  standing figures with palette variations, aisle walkers, hanging tube
  fixtures, and garage doors on the south wall. The floor and roof are
  AI-generated surfaces (disclosed in `docs/AI_USAGE.md`), and the bench
  pegboard, steel top, rack loads, and garage doors use four more
  generated detail tiles.
- A filament color menu: the COLORS button opens three rows of eight
  calm colors for the primary, secondary, and tertiary roles. The
  palette applies to hand parts and the controller hands, updates the
  build live, and persists between visits.
- Controllers wear low-poly yeah-hand representations tinted with the
  theme's primary color, semi-transparent so the hardware stays visible.
- A yellow safety barrier ring with a hazard-striped top rail marks the
  1.25 m locomotion boundary; dropped parts bounce off its rails.
- Pressing either thumbstick in VR raises the rig through three comfort
  heights (0, +0.4, +0.8 m) with a soft haptic tick, gliding at a calm
  rate and snapping instantly under reduced motion.
- The game builds a yeah-hand robotic hand, one part at a time: palm,
  servo base, four finger servos, thumb base, four fingers, thumb
  segments, and the upper cover. The current part shows a translucent blue
  outline at its socket, and the outline follows the player's view so it
  stays in sight.
- Printed parts (palm, fingers, thumb pieces, upper cover) appear on the
  printer bed with a short drop-in animation. Servos ride the conveyor:
  they rise out of a floor pit past the workshop sill, run level, turn
  ninety degrees, climb a supported slope, and glide into reach on the
  receiving belt. The belt surface scrolls; a roof hatch with a soft
  light shaft opens above the pit. Every part spawns resting flat on its
  machine, sized for the 2-7 ft reach envelope. RESET returns the current
  part to its own machine.
- Havok physics runs the stage: dropped parts fall and land, and a
  watchdog quietly returns anything that ends up off the play area.
- Quest 3: point at the part with a controller and hold the trigger to
  grab it. Release the trigger with the part inside the outline and it
  locks in place with a chime and a controller pulse. Grip squeeze only
  drops a held item; squeezing empty hands does nothing.
- Pressing A (right controller) or X (left) toggles an in-headset menu
  about 0.75 m in front of the player. The MAIN tab holds reset, undo,
  and redo. Undo and redo apply an exact step count picked with a
  stepper; counts that are broken or too large clamp to the history
  that exists, and ALL replays everything available. The MOVE tab holds
  turn mode and snap angle. The LOOKS tab holds the 8-color filament
  palette. HUD buttons and menu buttons are pressable in-headset via
  the controller pointer rays. Hovering any HUD button, menu button,
  splash button, or color swatch with a pointer ray brightens it so the
  player always sees where the pointer is aimed; while a splash is up,
  A and X skip the splash instead of toggling the menu.
- A credits splash shows right after boot and again after the hand is
  complete. It lists the Yeah Hand model source, its CERN Open Hardware
  Licence 2 - Strongly Reciprocal licence, and the modification credit.
  The splash cannot be dismissed for its first four seconds; a countdown
  label shows when dismissal unlocks. After the gate, CONTINUE (or A/X)
  dismisses it. The in-headset menu stays suppressed and the desktop
  HUD is hidden until the splash is gone, and the same press that
  dismisses a splash never also toggles the menu. The completion splash
  adds REBUILD, which drops anything held and starts the build over
  from the palm with an empty undo and redo history.
- After a part snaps in, screws stick out of it. Grab the orange
  screwdriver from its holster beside the pedestal, point the tip at a
  screw, and hold the trigger to drive it. A ratchet tick plays while
  driving and the controller pulses gently; the screw sinks in with a
  click. The palm takes 4 screws, the upper cover takes 2, every other
  part takes 1. The queue advances only once a part's screws are all
  driven. Screws can never be carried; the screwdriver or a part can.
- UNDO and REDO step back and forward through every committed part move,
  snap, reset, and screw drive (stack capped at 50 entries). HUD buttons
  work on desktop and are also pressable in-headset via the controller
  pointer rays. Desktop players can also use Ctrl+Z, Ctrl+Shift+Z, and
  Ctrl+Y. Carrying anything blocks undo and redo until the move finishes.
- TURN switches between snap turn and smooth turn; ANGLE cycles the snap
  angle through 30, 45, and 90 degrees. Both persist between visits.
  Smooth turning uses the left thumbstick at a gentle 90 degrees per
  second; small clamped steps stay within 1.25 m of the stage.
- Desktop: click and drag parts and the screwdriver; WASD or arrow keys
  move within the stage radius (A and D strafe relative to the view
  direction), arrow keys also turn the camera. The start camera looks
  level at the bench.
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

- Hand part meshes derived from the yeah-hand release STLs
  (`public/models/hand/`, CERN-OHL-S-2.0 with credit and notices) replace
  the red box placeholder, scaled into game units in code.
- Conversion pipeline: Babylon's STL loader at runtime plus code-built
  additions (servo housings, screws, screwdriver).
- The snap service generalizes from one part to a list of parts so the hand
  assembles socket by socket.

## Milestone 4: audience

- An instanced crowd fills tiered seating around the stage: varied heights
  (5 ft to 6 ft 4 in), varied palettes, adult figures only.
- Crowd animation and cheer intensity scale with assembly progress.
- Audio: a calm ambient music loop (`minimax:music@2.6` via Runware) and
  committed sound effects (`stability-ai/stable-audio-2.5` via Replicate;
  see `docs/AI_USAGE.md`). Audio arms only after the first player
  interaction — no autoplaying sound — and a HUD toggle mutes everything.
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
- Free-roam locomotion beyond the small stage area.
- Multiplayer.
- Mobile or native desktop targets.
