# Specification

What HANDS ON! does, milestone by milestone.

## Current behavior (release 2026.11.13.1)

- A warehouse workshop opens through a low north sill onto a grand
  factory hall, generated almost entirely in code. The workshop keeps the
  lit assembly pedestal, the 3D printer bench on the west, and the
  conveyor station on the east. The hall carries painted floor lanes,
  pallet racks with boxed loads, pallet stacks, a parked and a patrolling
  forklift, five giant yellow robot arms, a demo stage with screens,
  podium, and a branded band, and two tiers of grey chairs holding an
  audience of twelve golden-yellow mannequins in blue hard hats, seated
  in two rows of six and facing the player. Raised pendant lights,
  hanging tube fixtures, and garage doors sit on the south wall. The
  floor, roof, machines, crates, barriers, fabric, and printed parts use
  a shared library of twelve seamless 256x256 material tiles. The tiles
  repeat with per-surface UV tiling and mipmaps, so the scene keeps a
  small texture budget instead of one large atlas.
- A filament color menu: the COLORS button opens three rows of eight
  calm colors for the primary, secondary, and tertiary roles. The
  palette applies to hand parts and the controller hands, updates the
  build live, and persists between visits.
- Controllers wear clean low-poly box hands tinted with the theme's
  primary color, semi-transparent so the hardware stays visible. Each
  hand has one palm, four two-segment fingers, and one two-segment
  thumb: exactly five digits, with no extra knuckle bar. The palm is
  about half the hand length. The screwdriver shares the grip, with its
  handle in the fist and its tip pointing forward out of the hand.
- Printed parts and the controller hands use the filament palette plus
  a tileable PLA layer-line texture. A color change updates every
  mounted part and the controller hands immediately.
- A yellow safety barrier ring marks the 1.25 m locomotion boundary.
  Its hazard-striped top rail is split into short segments so the tile
  does not shimmer at grazing angles, and all warehouse crates sit
  outside the barrier clearance. Dropped parts bounce off the rails.
- Pressing either thumbstick in VR raises the rig through three comfort
  heights (0, +0.4, +0.8 m) with a soft haptic tick, gliding at a calm
  rate and snapping instantly under reduced motion.
- The game builds a 21-part yeah-hand robotic hand, one part at a time:
  palm, wrist plate, wrist motor, four finger motors, thumb base, thumb
  hinge boss, four fingers, four knuckle pins, thumb segments, two thumb
  hinge pins, and the upper cover. Pins are press-fit and need no
  screws. The current part shows a soft, pulsing translucent blue
  hologram at its socket.
- All printed parts are 3x human scale and share one assembly frame
  derived from the STL coordinates. The palm stands on the pedestal at
  1.07 m with its palm toward the player and fingers up; the wrist plate
  sits under the palm; the four fingers spread across the knuckles with
  one hinge pin each; the thumb base, hinge boss, segments, and pins
  chain from the side of the palm; the cover lands on the back. The
  current part is placed at that shared frame.
- The five servos are visible on the back of the palm until the upper
  cover goes on. Each has a black case, a brushed-metal output horn and
  arm, a shaft screw, mounting tabs with holes, a seam, and three
  colour-coded wires. Screws are anchored to the mesh surface and point
  into the stand, palm, knuckles, thumb, or cover as appropriate. Finger
  screws sit on each finger's own centre line.
- Metal surfaces (servo horn, tabs, shaft, screws, screwdriver shaft)
  use the generated brushed-steel texture with a bright specular
  response. Printed parts stay on the filament palette.
- Printed parts appear on the printer bed with a short drop-in
  animation. Motors ride one straight covered incline: they start under
  a floor trench, pass under a hood, climb a supported belt, and arrive
  on a receiving tray within reach. The belt surface scrolls and has
  cleats and side skirts. Every part spawns resting on its machine,
  sized for the 2-7 ft reach envelope. RESET returns the current part to
  its own machine.
- Havok physics runs the stage: dropped parts fall and land, and a
  watchdog quietly returns anything that ends up off the play area.
- Quest 3: point at the part with a controller and hold the trigger to
  grab it. Release the trigger with the part inside the outline and it
  locks in place with a chime and a controller pulse. Grip squeeze
  drops a held part or stows the screwdriver; squeezing empty hands
  does nothing.
- Pressing A (right controller) or X (left) toggles an in-headset menu
  about 0.75 m in front of the player. The MAIN tab holds reset, undo,
  and redo. Undo and redo apply an exact step count picked with a
  stepper; counts that are broken or too large clamp to the history
  that exists, and ALL replays everything available. The MOVE tab holds
  turn mode and snap angle. The LOOKS tab holds the 8-color filament
  palette. HUD buttons and menu buttons are pressable in-headset via
  the controller pointer rays. Hovering any HUD button, menu button,
  splash button, or color swatch with a pointer ray brightens it so the
  player always sees where the pointer is aimed. A controls footer in
  the menu names the trigger, grip, B/Y tool, and A/X menu bindings.
  While a splash is up, A and X skip the splash instead of toggling the
  menu.
- A compact in-world status board floats above the hand stand. Three
  lines show the current action, the source and destination, and
  progress (for example `PLACE THE MIDDLE MOTOR`,
  `CONVEYOR TO THE BACK OF THE HAND`, `MOTORS 2 OF 5`). The board hides
  during splashes and the in-headset menu.
- The game speaks grouped pre-rendered lines: a welcome, then one line
  per phase (palm, five motors, thumb base, four fingers, thumb
  segments, cover), and one screw line per phase that names the host
  ("Drive the four screws into the stand"). Switching the screwdriver
  on during a screw step repeats the host. A new line stops the previous
  one; a watchdog clears a line whose end event is lost. After 25 silent
  seconds the current line repeats once. Music ducks under speech. All
  narration is muted by the SOUND button with the sound effects, while
  the status board still shows the step. The player waits for the
  WebAudio context to unlock before calling `play()`, keeps only one
  pending line, stops every narration sound before starting another,
  and ignores stale ready callbacks, so two lines cannot overlap.
  Music starts once and only changes volume, never a second copy.
- A credits splash shows right after boot and again after the hand is
  complete. It lists the Yeah Hand model source, its CERN Open Hardware
  Licence 2 - Strongly Reciprocal licence, and the modification credit.
  The splash cannot be dismissed for its first four seconds; a countdown
  label shows when dismissal unlocks, and a build tag in the corner
  shows the running version. After the gate, CONTINUE (or A/X)
  dismisses it. The in-headset menu stays suppressed and the desktop
  HUD is hidden until the splash is gone, and the same press that
  dismisses a splash never also toggles the menu. The completion splash
  adds REBUILD, which drops anything held and starts the build over
  from the palm with an empty undo and redo history.
- Before a part is seated, the host it belongs to glows softly and a
  guide arrow marks the part and its blue destination. Both arrows keep
  one fixed size, draw through geometry, and follow the carried part.
  After a part snaps in, screws sit on its surface and a bobbing yellow
  arrow marks each screw that still needs driving.
  Press B (right) or Y (left) to summon the orange screwdriver into that
  hand; press again or squeeze to stow it. The screwdriver never falls,
  so it cannot be lost.
  Its tip must touch a screw head within 12 mm to drive it; hovering
  nearby does nothing, and only the nearest touched screw turns. A
  ratchet tick plays while driving and the controller pulses gently; the
  screw sinks in with a click and the tool stays in hand. The palm takes
  4 screws, the wrist plate 2, each servo 1, each finger 1, the thumb
  pieces 2, and the upper cover 4. The queue advances only once a part's
  screws are all driven. Screws can never be carried; the screwdriver or
  a part can.
- The render loop reports frame count, render time, last frame gap,
  texture count and budget, and the last runtime error. A completed hand
  keeps rendering so the headset never freezes on the last frame.
- UNDO and REDO step back and forward through every committed part move,
  snap, reset, and screw drive (stack capped at 50 entries). HUD buttons
  work on desktop and are also pressable in-headset via the controller
  pointer rays. Desktop players can also use Ctrl+Z, Ctrl+Shift+Z, and
  Ctrl+Y. Carrying anything blocks undo and redo until the move finishes.
- TURN switches between snap turn and smooth turn; ANGLE cycles the snap
  angle through 30, 45, and 90 degrees. Both persist between visits.
  Smooth turning uses the left thumbstick at a gentle 90 degrees per
  second; small clamped steps stay within 1.25 m of the stage.
- Desktop: click and drag parts; T or the TOOL button summons the
  screwdriver, then click and drag it (releasing returns it to its dock
  instead of dropping it). WASD or arrow keys move within the stage
  radius (A and D strafe relative to the view direction), arrow keys also
  turn the camera. The start camera looks level at the bench.
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
  additions (motor housings, screws, screwdriver).
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
