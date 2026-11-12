# Embodied QA with the `hands-on-qa` MCP server

This project ships a small Model Context Protocol (MCP) server that lets an
AI agent play the game like a player: spawn the page in headless Chromium
with the XR mock, hold virtual controllers, press triggers, and read what
the game says. It answers the question "does the game actually work in a
headset?" without a headset.

## Prerequisites

The server serves the built game with `vite preview` on port 4174. Build
first, and rebuild after every source change:

```sh
npm run build
```

## Setup

Add this to your MCP client config (for example `.mcp.json`):

```json
{
  "mcpServers": {
    "hands-on-qa": {
      "command": "node",
      "args": ["scripts/qa-mcp-server.mjs"]
    }
  }
}
```

The server starts `vite preview` itself. If the port is busy it exits with
an error instead of guessing.

## Tools

| Tool          | Arguments | What it does |
|---------------|-----------|--------------|
| `read_state`  | none      | Game state snapshot: status text, active part, camera, pointer poses, pointer rotations, active part center, screw sites, driver tip and center, tool parent, guide arrow count, audience count, audio and render stats, the last runtime error, and raw mock controller state. |
| `screenshot`  | none      | PNG capture of the game view, base64 encoded. |
| `wait_ms`     | `ms`      | Sleep up to 5000 ms. Use after squeezes to let drops settle. |
| `pose`        | `side` (`left`/`right`), `pos` `[x,y,z]`, `yaw`, `pitch` | Move a controller in world space. |
| `stick`       | `side`, `x`, `y` | Push a thumbstick (locomotion / turn snap). |
| `trigger`     | `side`, `value` | Squeeze a trigger. Grabs the active part; screws drive themselves when the tip touches them. |
| `squeeze`     | `side`    | Full grip squeeze. Drops a held part or stows the screwdriver. |
| `a_button`    | `side`, `value` | Press the menu button (A right / X left). While a credits splash is up this skips it (only after its 4 second hold); otherwise it toggles the in-headset menu panel. |
| `b_button`    | `side`, `value` | Press the tool button (B right / Y left). Summons the screwdriver into that hand, or stows it. |
| `page_errors` | none      | Console errors and uncaught page errors since the session started. |

A session starts on `tool` launch, loads the page, waits for XR readiness,
and enters VR automatically. If the game fails to boot, tools return an
error that includes the boot log.

## Coordinates

The world follows Babylon.js conventions: **+x right, +y up, +z toward the
player**. The player stands near the origin, roughly 1.4-1.7 m high.

- `pose` takes world space. The server converts to the mock controller
  space for you.
- `pointer` and `pointerRot` in `read_state` share the same world space as
  `activePartCenter`, `driverTip`, and `driverCenter`.
- `rawMock` shows the unconverted mock controller state (its z axis is
  negated). Use `pointer` instead unless you are debugging the mock itself.

## Gotchas

- A credits splash covers the view right after boot for at least 4
  seconds; A/X before that does nothing, after that it dismisses. The
  in-headset menu stays locked until the splash is dismissed.
- `data-part` on a mesh does not update after a mount. Trust the status
  text in `read_state` (`statusText`) instead.
- The screwdriver never drops. It appears in the hand that pressed
  `b_button` and disappears on the next press or on squeeze. Summon it
  with `b_button`, not by picking it up off a surface.
- The screwdriver tip is magnetic: when it comes within a few centimeters
  of a screw site the screw drives itself. No trigger needed. The trigger
  still grabs and releases parts.
- Carry parts with the **left** hand while the right hand holds the
  screwdriver; both can be held at once.
- Gripping (`squeeze`) drops a held part. Squeezing empty hands does
  nothing — reset lives in the menu, not on the grip. Drop physics still
  settle; wait ~1.5 s before reading state.
- Confirm the audience: look over the barrier and check for **two rows
  of six** yellow mannequins in blue hard hats on grey chairs, facing
  you. `read_state.audienceCount` must be 12.
- The yellow guide arrows are part of the game, not decoration. One
  bobs over each undriven screw, and one bobs over the next part at its
  printer or conveyor until it is grabbed. `arrowCount` should equal the
  remaining screws, plus one while a part is waiting to be picked up.
- The five blue blocks are the motors: wrist, index, middle, ring, and
  little. Their status labels say "motor".
- Audio is fixed to the deployment base path. `read_state.audio` must
  report `base: "./"` on Pages, `musicReady: true`, and (after a click
  or controller press) `state: "running"`. Every `/audio/` response
  must be 200; voice clips live under `audio/voice/`.
- `?handDebug=1` on desktop draws a fixed fist + screwdriver with a
  controller proxy and points the camera at it; use it to judge the
  grip. `?perf=1` shows fps, active meshes, mesh count, and material
  count in the top right. If the scene ever freezes again, ask for
  `read_state.perf` and `lastError`.
- The screwdriver's parent should be `handRep-right` or `handRep-left`,
  never a pointer ray. `read_state.toolParent` exposes it.

## Example session

A full pass lives in the repository history and follows this shape:

1. `read_state` — confirm boot, XR ready, credits splash up. Wait out
   the 4 second hold, then `a_button` to dismiss it. The splash must
   list the Yeah Hand credit lines and the build version.
2. `screenshot` — look over the barrier and check for tiered rows of
   yellow mannequins in blue hard hats on grey chairs, facing you.
3. Empty trigger on the left — nothing should move.
4. `b_button` right — `read_state` reports `toolEquipped: true`, and
   `b_button` again reports false. Summon it once more for the build.
5. Carry the palm with the left hand to its socket, release with trigger.
6. `pose` the right hand so the tip touches a screw site and `wait_ms`;
   the screw drives with no trigger press. Repeat until the queue moves.
7. Check `read_state.arrowCount` after the mount: 4 arrows for the palm,
   2 for the upper cover, 1 for single-screw parts. Check
   `read_state.audienceCount` is 12 and `read_state.audio.musicReady` is
   true.
8. The narrator should name the palm, its printer pickup, and its
   landing spot; music ducks while it speaks. Mute with SOUND and confirm
   both voice and effects stop.
9. `a_button` right press + release to open the menu, `screenshot`,
   press again to close. The menu exposes reset, undo and redo with
   step counts, movement settings, the filament palette, and the
   controls footer. Hovering each button with a pointer ray must
   brighten it.
10. If a full build was completed, wait for the completion splash with
   REBUILD, hold out its gate, press REBUILD with the pointer ray and
   trigger, and confirm the queue restarts at the palm.
11. `page_errors` — should be empty at every step.
