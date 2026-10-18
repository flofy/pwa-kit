# Reusable application workflows

Applications can call these workflows from their own thin trigger workflows to keep CI behavior consistent across repositories.

## Quality checks

```yaml
name: Quality Checks
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  quality:
    uses: flofy/pwa-kit/.github/workflows/quality-checks.yml@main
    with:
      pnpm-version: "10.15.1"
      checks-command: |
        pnpm run knip
        pnpm run test:coverage
```

Use the same Node and package-manager versions as the application lockfile. The caller can keep a small paths-filter job and gate the reusable job if not every change should run application checks.

## Auto-format

```yaml
name: Auto-format
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]
permissions:
  contents: write
jobs:
  format:
    uses: flofy/pwa-kit/.github/workflows/auto-format.yml@main
    with:
      pnpm-version: "10.15.1"
      format-command: pnpm run format
```

This workflow only pushes formatting changes for pull requests from the same repository. Fork pull requests are skipped because they cannot safely receive write credentials.

## GitHub Pages

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    uses: flofy/pwa-kit/.github/workflows/deploy-pages.yml@main
    with:
      pnpm-version: "10.15.1"
      build-command: pnpm run build
      artifact-path: dist
```

The caller should keep app-specific path filters and trigger rules. The reusable workflow owns the common install/build/upload/deploy steps; the repository remains responsible for enabling GitHub Pages with GitHub Actions as its source.

For production use, pin reusable workflow references to a reviewed commit SHA or release tag rather than `main`.
