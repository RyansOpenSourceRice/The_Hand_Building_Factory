# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [CalVer](https://calver.org/) versioning
(`YYYY.MM.DD.N`).

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
