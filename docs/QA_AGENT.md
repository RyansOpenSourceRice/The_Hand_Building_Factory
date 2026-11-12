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
| `read_state`  | none      | Game state snapshot: status text, active part, camera, pointer poses, pointer rotations, active part center, screw sites, driver tip and center, raw mock controller state. |
| `screenshot`  | none      | PNG capture of the game view, base64 encoded. |
| `wait_ms`     | `ms`      | Sleep up to 5000 ms. Use after squeezes to let drops settle. |
| `pose`        | `side` (`left`/`right`), `pos` `[x,y,z]`, `yaw`, `pitch` | Move a controller in world space. |
| `stick`       | `side`, `x`, `y` | Push a thumbstick (locomotion / turn snap). |
| `trigger`     | `side`, `value` | Squeeze a trigger (grab / drive screws). |
| `squeeze`     | `side`    | Full grip squeeze (drops a held item only). |
| `a_button`    | `side`, `value` | Press the menu button (A right / X left). Toggles the in-headset menu panel. |
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

- `data-part` on a mesh does not update after a mount. Trust the status
  text in `read_state` (`statusText`) instead.
- The tool takes trigger priority: pressing trigger while holding the
  screwdriver drives screws, it never grabs parts. Carry parts with the
  **left** hand while the right hand holds the driver.
- Gripping (`squeeze`) only drops a held item. Squeezing empty hands
  does nothing — reset lives in the menu, not on the grip. Drops still
  settle; wait ~1.5 s before reading state.
- Screws need the tip inside the screw site, within a few centimeters.
  Announcements report progress per screw.

## Example session

A full pass lives in the repository history and follows this shape:

1. `read_state` — confirm boot, XR ready, palm at the printer.
2. Empty trigger on the left — nothing should move.
3. `pose` right hand to the bench tool slot, `trigger` right, `wait_ms`.
4. Carry the palm with the left hand to its socket, release with trigger.
5. `squeeze` right to drop the tool, `wait_ms`, `read_state` — the
   mounted part must stay mounted.
6. `a_button` right press + release to open the menu, `screenshot`,
   press again to close. The menu exposes reset, undo and redo with
   step counts, movement settings, and the filament palette.
6. `page_errors` — should be empty at every step.
