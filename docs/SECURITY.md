# Security policy

## Reporting

Contact Ryan via the repository (open an issue) rather than disclosing
publicly.

## Scope

This is a client-side WebXR game with no backend, no accounts, and no data
collection. There is nothing here worth attacking except the jam deadline.

## Practices in this repo

- `.npmrc` keeps `ignore-scripts=true`, `save-exact=true`, and
  `min-release-age=7` so install scripts never run and freshly published
  packages cannot slip in.
- Pre-commit runs gitleaks secret scanning; CI runs lint and tests on every
  push.
- No secrets, tokens, or keys are committed. Ever.
