# PWA Kit

Framework-agnostic TypeScript utilities for Progressive Web App install and update flows, with small adapters for React and Svelte.

## Goals

- Provide a typed, browser-focused core for install prompts and app display mode detection.
- Model service-worker update state without taking ownership of service-worker registration.
- Keep framework adapters thin and optional.
- Avoid cache-name collisions between apps sharing an origin.

## Status

Initial scaffold in progress. APIs are intentionally small and will evolve with tests and real integrations.

## Development

Requirements: Node.js 24 and pnpm.

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

See [docs/architecture.md](docs/architecture.md) for design constraints.
