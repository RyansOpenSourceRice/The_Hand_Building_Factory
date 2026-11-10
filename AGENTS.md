# AGENTS.md

Operating rules for AI agents working in this repository. Distilled from Ryan's agentic coding preferences; project-specific decisions below override the general skill where they differ.

## Identity and Git

- Commit author: `RyansOpenSourceRice <43384871+RyansOpenSourceRice@users.noreply.github.com>`. Never add `Co-Authored-By: AI` trailers.
- Branch model: protected `main`, integration branch `dev`. New work lands in `dev` first; merges to `main` happen via squash pull requests. Prefer linear history.
- Pushes are manual and operator-triggered, only after a diff review. Never force-push, never rewrite published history.
- Versioning: CalVer `YYYY.MM.DD.N` in `package.json`, `CHANGELOG.md`, and `CITATION.cff` (Keep a Changelog format, updated as part of each change). CI fails when the `CITATION.cff` version drifts from `package.json`.

## Engine and stack

- Babylon.js + TypeScript only. Vite builds. No React or other DOM frameworks, no other bundlers, no JavaScript files in `src/`.
- npm is the package manager. `.npmrc` must keep `ignore-scripts=true`, `save-exact=true`, `min-release-age=7`. Never loosen supply-chain hardening.
- Code style follows Google's TypeScript style via `eslint-config-google`. Lint runs in CI; developer discretion is not a substitute.
- Follow engine APIs. Never hand-write code that an existing library import already provides (e.g. spatial audio, physics, loaders).
- No comments unless a block is genuinely non-obvious. No AI-fingerprint comments, no leftover debug prints, no dead code.

## Asset policy (jam-critical)

- Default: **no third-party assets**. Everything visual or audible is generated in code by this project.
- Approved third-party assets only:
  - Atkinson Hyperlegible font (OFL 1.1) in `public/fonts/`.
  - yeah-hand STL-derived meshes (CERN-OHL-S-2.0) for hand parts, planned for a later milestone.
- Any new third-party asset requires Ryan's explicit approval before use.
- npm packages are tooling, not assets, but still follow the supply-chain rules above.

## VR rules (Meta Quest 3 / WebXR)

- Controllers only. Hand tracking is never required; no feature may depend on it.
- No locomotion. The experience is stationary (standing or seated).
- Comfort: interactions stay within the 2-7 ft reach envelope; support height adaptation and seated play; no forced camera motion.
- Target Quest 3 at 90 Hz. Instance repeated geometry (crowd). Avoid heavy post-processing.
- No featureless voids: give the player something to look at, somewhere to stand, and a sense of place.
- Haptic feedback on interactions. Calm, peaceful backdrop behind pause menus.
- Test on the actual headset early and continuously. Never accumulate long stretches of unverified-on-device work.

## Definition of done (all four gates, non-negotiable)

1. Builds and runs without errors.
2. Lint passes in CI (`npm run lint`).
3. Tests pass: unit tests (vitest, Babylon NullEngine) and E2E smoke (Playwright, Firefox).
4. The change can be described in plain language, with no dead code, leftover debug output, or AI-fingerprint comments.

## Conduct

- No secrets or tokens in any committed file. Secret scanning (gitleaks) runs in pre-commit.
- No disparaging language anywhere. Neutral, non-promotional voice in docs, commits, and release notes.
- User-facing copy at a grade-8 reading level. WCAG 2.1 AA contrast. Respect `prefers-reduced-motion`.
- No dark patterns: no fake timers, fake scarcity, fake activity, autoplaying sound, or pop-ups without approval.
- Docs stay true: architecture changes update the affected markdown files in the same change.
- When rules conflict or a consequential choice arises, ask Ryan with the relevant sections quoted.
