# Third-party notices

Assets and code not authored in this repository.

## Atkinson Hyperlegible font

- Files: `public/fonts/atkinson-hyperlegible-*.woff2`
- Copyright: 2020 Braille Institute of America, Inc.
  (https://github.com/googlefonts/atkinson-hyperlegible)
- License: SIL Open Font License 1.1 (see `public/fonts/OFL.txt`)
- Used for: all user-facing UI text (approved by Ryan for accessibility).

## Yeah Hand

- Files: the five STL-derived meshes in `public/models/hand/`
  (`palm.stl`, `finger.stl`, `thumb-base.stl`, `thumb-segments.stl`,
  `upper-cover.stl`) with the upstream `LICENSE.txt` alongside them. The
  eight printed hand parts derive from these five meshes through code
  transforms (scaling, merging, repositioning). The five servos, wrist
  plate, thumb hinge boss, four knuckle pins, and two thumb pins are
  built in code.
- Source: the STL releases of the Yeah Hand project
  (https://github.com/opsobot/yeah-hand).
- License: CERN Open Hardware Licence Version 2 - Strongly Reciprocal
  (CERN-OHL-S-2.0). Derived mesh assets in this repository are provided under
  CERN-OHL-S-2.0 with the Yeah Hand project as the source location. Game code
  remains Apache-2.0.
- Naming: this project says it is "based on the Yeah Hand" as permitted by the
  Yeah Hand TRADEMARK.md. It is not affiliated with or endorsed by OPSOBOT.

## Narrator voice clips

- Files: `public/audio/voice/*.ogg`
- Generated for this project with Speechify Simba 3.5
  (`speechify/simba-3.5`, voice `geffen_32`) through OpenRouter, at
  Ryan's request. They are committed as static audio; the game makes no
  runtime service calls. Generated output is used under the Speechify
  API terms applicable to this project.
- Used for: short spoken part names, destinations, and event cues.

## Packages

Runtime dependencies are npm tooling and libraries, not assets:
`@babylonjs/core`, `@babylonjs/gui`, `@babylonjs/havok`. Their licenses ship
inside the installed packages and the built bundle retains license comments
where present.
