# Integration guide for Flofy apps

This guide records the current integration boundaries before replacing any app-specific code. Integrations should be incremental: preserve each app's service-worker registration and update policy, and adopt the shared core only where it removes duplication without changing UX.

## Current application map

| App | Install flow | Update / worker flow | Integration notes |
| --- | --- | --- | --- |
| DualityOlaf | `apps/web/src/lib/pwaInstall.ts` captures the install event at module scope. | `vite-plugin-pwa` registration in `apps/web/src/main.ts`; update UI listens for `duality:pwa-update`. | Keep the existing event bridge initially; the module-scope capture avoids missing an early browser event. |
| KeepScore | `src/ui/installPrompt.ts` owns a module-level prompt and subscribers. | Custom worker in `public/sw.js`; disabled for Capacitor. | Preserve Capacitor behavior and subscriber semantics. Avoid duplicating standalone detection in UI components. |
| DuoGames | `src/lib/pwa.svelte.js` stores Svelte reactive install/update state. | Uses `virtual:pwa-register` from `vite-plugin-pwa`; skips PWA setup on native Capacitor and in development. | A Svelte adapter may bridge controller snapshots into `$state`, but must preserve the native-platform guard and offline-ready message. |
| Habit Quest | Install prompt and iOS guidance currently live in `src/App.svelte`. | Custom worker registered in `src/main.js` for production. | Extract install logic to a module first; keep iOS manual-install guidance and current UX. |
| GemWave | No shared install controller currently identified in the inspected layout. | `src/routes/+layout.svelte` registers custom `/sw.js`, displays update banner, and reloads on `controllerchange`. | Keep its explicit user-confirmed update and single-reload guard. Do not replace its custom worker with a Workbox registration. |

## Recommended adoption sequence

1. **Validate the core API in isolation.** Keep the install controller created at application bootstrap so its listeners are attached before the browser emits `beforeinstallprompt`.
2. **Add adapter packages only when justified.** React and Svelte wrappers should subscribe to the core controller; they must not register workers themselves.
3. **Pilot in KeepScore or DualityOlaf.** Both already have install abstractions, making behavior comparison and rollback straightforward.
4. **Move DuoGames and GemWave update UI only after parity tests.** Preserve Capacitor exclusions, user confirmation, and app-specific reload behavior.
5. **Extract Habit Quest's inline install logic last.** Retain its iOS guidance, which is intentionally different from Chromium's install prompt.

## Browser and lifecycle constraints

- `beforeinstallprompt` is not a cross-browser standard. A missing prompt is not necessarily an error.
- Create the controller early (for example, in the app entry module) and pass it to UI components. Creating it only after a delayed component mount can miss an earlier event.
- `appinstalled` is a browser event, not a universal confirmation mechanism on every platform.
- This package deliberately does not own service-worker registration, periodic update checks, reloads, offline-ready banners, or cache deletion.
- Cache Storage is shared by all apps on the same origin. Each service worker must delete only cache names belonging to its own app prefix.
