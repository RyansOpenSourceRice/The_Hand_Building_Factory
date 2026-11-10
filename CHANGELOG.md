# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [CalVer](https://calver.org/) versioning
(`YYYY.MM.DD.N`).

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
