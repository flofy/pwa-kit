# Architecture

## Scope

PWA Kit is a small set of typed helpers, not a replacement for a service-worker toolchain. It should integrate with existing Vite PWA / Workbox registrations and custom workers without taking over registration or cache strategy.

## Install flow

`createInstallController()` observes the browser's `beforeinstallprompt` and `appinstalled` events, exposes a snapshot and lets UI code trigger the deferred prompt. The event is not supported by every browser. When `canPromptInstall` is false, apps should provide platform-specific guidance where appropriate (for example, manual Add to Home Screen instructions on iOS).

Display-mode detection uses `matchMedia` and falls back to iOS Safari's legacy `navigator.standalone` flag.

## Update flow

`createUpdateController()` is intentionally registration-agnostic. The app forwards its service-worker tool's "update available" event to `notifyUpdateAvailable()` and passes the existing update action to `applyUpdate()`. The helper does not reload the page; each app can coordinate user confirmation, save state, and reload behavior.

## Cache isolation

Cache Storage is scoped to an origin, not to a single app path. Apps sharing an origin must only delete cache names they own, preferably with a stable app-specific prefix. Never delete every cache that does not match the current worker's one cache name.

## Compatibility principles

- Framework-neutral core; framework adapters remain separate entry points/packages.
- No automatic service-worker registration.
- No assumptions about a particular bundler.
- Avoid automatic page reloads and hidden persistence.
- Browser APIs are only accessed when a controller is created, not at module import time.
