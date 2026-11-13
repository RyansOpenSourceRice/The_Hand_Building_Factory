# HANDS ON!

[![CI](https://img.shields.io/github/actions/workflow/status/RyansOpenSourceRice/The_Hand_Building_Factory/ci.yml?branch=main&style=flat-square)](https://github.com/RyansOpenSourceRice/The_Hand_Building_Factory/actions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square)](LICENSE)

Assemble a robotic hand on stage while the crowd cheers. Grab each part with your
controller, slot it into the glowing outline, and drive its screws. A Meta
Quest 3 WebXR game built for the
[Super Free AI Game Jam #2](https://itch.io/jam/super-free-ai-game-jam-2).

## Play

- Put on your Meta Quest 3, open the browser, and load the itch.io page
  (link added when the submission goes live).
- Point at the waiting part, hold the trigger to grab it, and release it
  inside the blue outline.
- Press B or Y to summon the screwdriver, then touch its tip to each screw.
- No walking around needed. You can play standing or seated.

## Development

```sh
npm install
npm run dev      # live-reload dev server
npm run build    # typecheck + production build to dist/
npm test         # unit tests (vitest)
npm run test:e2e # Playwright E2E (Firefox + Chromium, needs build first)
npm run lint     # eslint (Google TypeScript style)
```

Engine: [Babylon.js](https://www.babylonjs.com/) + TypeScript, no framework.
See [AGENTS.md](AGENTS.md) for the rules any agent must follow when working
here, [docs/DESIGN.md](docs/DESIGN.md) for why the game is built this way, and
[docs/SPECIFICATION.md](docs/SPECIFICATION.md) for what it does.

## License

Code: [Apache-2.0](LICENSE). Third-party notices: [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).

The hand design is based on the open source
[Yeah Hand](https://github.com/opsobot/yeah-hand) project. HANDS ON! is not
affiliated with the Yeah Hand project or OPSOBOT.
