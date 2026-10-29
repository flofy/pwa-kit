# Architecture

## Scope

PWA Kit is a small set of typed helpers, not a replacement for a service-worker toolchain. It should integrate with existing Vite PWA / Workbox registrations and custom workers without taking over registration or cache strategy.

## Install flow

`createInstallController()` observes the browser's `beforeinstallprompt` and `appinstalled` events, exposes a snapshot and lets UI code trigger the deferred prompt. The event is not supported by every browser. When `canPromptInstall` is false, apps should provide platform-specific guidance where appropriate (for example, manual Add to Home Screen instructions on iOS).

Display-mode detection uses `matchMedia` and falls back to iOS Safari's legacy `navigator.standalone` flag.

## Update flow

`checkForServiceWorkerUpdate(registration)` performs an explicit, bounded check against an existing registration and returns a typed result (`available`, `none`, `unsupported`, `timeout`, or `error`). It never applies an update or reloads the page. The app should map an `available` result to `createUpdateController().notifyUpdateAvailable()` and let the user decide when to apply it.

`createUpdateController()` remains registration-agnostic: the app forwards update-available signals to `notifyUpdateAvailable()` and passes its existing update action to `applyUpdate()`. Each app owns confirmation, session preservation, and reload behavior.

## Feedback flow

`createFeedbackIssueUrl(config, input)` builds a prefilled GitHub new-issue URL. It is framework-agnostic and does not create an issue, require a token, or make a network request. The application owns the form UI, validation presentation, navigation, and success/failure messaging.

The target repository and app name are required. App version, page URL, diagnostics, and labels are optional. Applications must only provide page or diagnostic context after explaining it to the user and obtaining any required consent. Never put a GitHub token in client-side code. A future server-backed submission flow should be a separate adapter with server-side credentials and abuse controls.

## Cache isolation

Cache Storage is scoped to an origin, not to a single app path. Apps sharing an origin must only delete cache names they own, preferably with a stable app-specific prefix. Never delete every cache that does not match the current worker's one cache name.

## Compatibility principles

- Framework-neutral core; framework adapters remain separate entry points/packages.
- No automatic service-worker registration.
- No assumptions about a particular bundler.
- Avoid automatic page reloads and hidden persistence.
- Browser APIs are only accessed when a controller is created, not at module import time.
