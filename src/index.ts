export type DisplayMode = "browser" | "standalone" | "minimal-ui" | "fullscreen" | "window-controls-overlay";

export interface InstallPromptChoice {
  readonly outcome: "accepted" | "dismissed";
  readonly platform: string;
}

export interface InstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  userChoice: Promise<InstallPromptChoice>;
}

export interface InstallSnapshot {
  readonly canPromptInstall: boolean;
  readonly isInstalled: boolean;
  readonly displayMode: DisplayMode;
}

export interface InstallController {
  getSnapshot(): InstallSnapshot;
  subscribe(listener: (snapshot: InstallSnapshot) => void): () => void;
  promptInstall(): Promise<InstallPromptChoice | null>;
  destroy(): void;
}

const DISPLAY_MODES: readonly DisplayMode[] = [
  "fullscreen",
  "standalone",
  "minimal-ui",
  "window-controls-overlay",
];

function detectDisplayMode(win: Window): DisplayMode {
  for (const mode of DISPLAY_MODES) {
    if (win.matchMedia(`(display-mode: ${mode})`).matches) return mode;
  }
  // iOS Safari exposes this legacy flag instead of display-mode consistently.
  const navigatorWithStandalone = win.navigator as Navigator & { standalone?: boolean };
  return navigatorWithStandalone.standalone ? "standalone" : "browser";
}

/**
 * Creates a small observable controller for browser installation UX.
 * It does not register a service worker or persist state.
 */
export function createInstallController(win: Window = window): InstallController {
  let deferredPrompt: InstallPromptEvent | null = null;
  let destroyed = false;
  const listeners = new Set<(snapshot: InstallSnapshot) => void>();

  const snapshot = (): InstallSnapshot => ({
    canPromptInstall: deferredPrompt !== null,
    isInstalled: detectDisplayMode(win) !== "browser",
    displayMode: detectDisplayMode(win),
  });

  const emit = () => {
    if (destroyed) return;
    const current = snapshot();
    listeners.forEach((listener) => listener(current));
  };

  const onBeforeInstallPrompt = (event: Event) => {
    // Chromium-specific, non-standard event. Prevent the browser's automatic prompt
    // so the app can offer an explicit install action.
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    emit();
  };
  const onAppInstalled = () => {
    deferredPrompt = null;
    emit();
  };
  const onDisplayModeChange = () => emit();

  win.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  win.addEventListener("appinstalled", onAppInstalled);
  const mediaQueries = DISPLAY_MODES.map((mode) => win.matchMedia(`(display-mode: ${mode})`));
  mediaQueries.forEach((query) => query.addEventListener?.("change", onDisplayModeChange));

  return {
    getSnapshot: snapshot,
    subscribe(listener) {
      if (destroyed) return () => undefined;
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    async promptInstall() {
      if (destroyed || !deferredPrompt) return null;
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      emit();
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      emit();
      return choice;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      win.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      win.removeEventListener("appinstalled", onAppInstalled);
      mediaQueries.forEach((query) => query.removeEventListener?.("change", onDisplayModeChange));
      listeners.clear();
      deferredPrompt = null;
    },
  };
}

export type UpdateState = "idle" | "available" | "applying" | "error";

export interface UpdateController {
  getState(): UpdateState;
  subscribe(listener: (state: UpdateState) => void): () => void;
  notifyUpdateAvailable(): void;
  applyUpdate(apply: () => void | Promise<void>): Promise<void>;
}

/**
 * State helper for apps that already use vite-plugin-pwa, Workbox, or a custom
 * service worker. The caller owns registration and supplies the update callback.
 */
export function createUpdateController(): UpdateController {
  let state: UpdateState = "idle";
  const listeners = new Set<(state: UpdateState) => void>();
  const setState = (next: UpdateState) => {
    state = next;
    listeners.forEach((listener) => listener(state));
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    notifyUpdateAvailable() {
      if (state !== "applying") setState("available");
    },
    async applyUpdate(apply) {
      if (state !== "available") return;
      setState("applying");
      try {
        await apply();
        // Reloading is intentionally the integration's responsibility.
        setState("idle");
      } catch (error) {
        setState("error");
        throw error;
      }
    },
  };
}
