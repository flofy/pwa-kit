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


export type ServiceWorkerUpdateCheckResult =
  | { readonly status: "available" }
  | { readonly status: "none" }
  | { readonly status: "unsupported" }
  | { readonly status: "timeout" }
  | { readonly status: "error"; readonly error: unknown };

export interface ServiceWorkerUpdateCheckOptions {
  /** Maximum time to wait for the browser's update check, in milliseconds. Defaults to 10 seconds. */
  readonly timeoutMs?: number;
}

/**
 * Checks for a service-worker update without applying it or reloading the page.
 * The caller remains responsible for surfacing the result and applying any update.
 */
export async function checkForServiceWorkerUpdate(
  registration: ServiceWorkerRegistration | null | undefined,
  options: ServiceWorkerUpdateCheckOptions = {},
): Promise<ServiceWorkerUpdateCheckResult> {
  if (!registration || typeof registration.update !== "function") {
    return { status: "unsupported" };
  }

  if (registration.waiting) return { status: "available" };

  const timeoutMs = options.timeoutMs ?? 10_000;
  return new Promise<ServiceWorkerUpdateCheckResult>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let installingWorker: ServiceWorker | null = null;

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      registration.removeEventListener("updatefound", onUpdateFound);
      installingWorker?.removeEventListener("statechange", onWorkerStateChange);
    };

    const finish = (result: ServiceWorkerUpdateCheckResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onWorkerStateChange = () => {
      if (installingWorker?.state === "installed") {
        finish({ status: "available" });
      } else if (installingWorker?.state === "redundant") {
        finish({ status: "none" });
      }
    };

    const onUpdateFound = () => {
      installingWorker?.removeEventListener("statechange", onWorkerStateChange);
      installingWorker = registration.installing;
      if (!installingWorker) return;
      installingWorker.addEventListener("statechange", onWorkerStateChange);
      onWorkerStateChange();
    };

    registration.addEventListener("updatefound", onUpdateFound);
    timer = setTimeout(() => finish({ status: "timeout" }), Math.max(0, timeoutMs));

    void registration.update().then(
      () => {
        if (registration.waiting || installingWorker?.state === "installed") {
          finish({ status: "available" });
        } else if (!installingWorker) {
          finish({ status: "none" });
        }
      },
      (error: unknown) => finish({ status: "error", error }),
    );
  });
}


export type FullscreenMode = "none" | "native" | "layout";

export interface FullscreenSnapshot {
  readonly isFullscreen: boolean;
  readonly mode: FullscreenMode;
}

export interface FullscreenController {
  getSnapshot(): FullscreenSnapshot;
  subscribe(listener: (snapshot: FullscreenSnapshot) => void): () => void;
  enter(): Promise<void>;
  exit(): Promise<void>;
  toggle(): Promise<void>;
  destroy(): void;
}

/**
 * Controls browser fullscreen where supported, with a layout-fullscreen fallback
 * for browsers and webviews that do not expose the Fullscreen API.
 * It never reloads the page and tracks exits initiated by the browser (Escape).
 */
export function createFullscreenController(
  doc: Document = document,
  target: HTMLElement = doc.documentElement,
): FullscreenController {
  let mode: FullscreenMode = "none";
  let destroyed = false;
  const listeners = new Set<(snapshot: FullscreenSnapshot) => void>();

  const snapshot = (): FullscreenSnapshot => ({
    isFullscreen: mode !== "none",
    mode,
  });
  const emit = () => {
    if (destroyed) return;
    const current = snapshot();
    listeners.forEach((listener) => listener(current));
  };
  const onFullscreenChange = () => {
    if (doc.fullscreenElement) mode = "native";
    else if (mode === "native") mode = "none";
    emit();
  };

  doc.addEventListener("fullscreenchange", onFullscreenChange);

  return {
    getSnapshot: snapshot,
    subscribe(listener) {
      if (destroyed) return () => undefined;
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    async enter() {
      if (destroyed || mode !== "none") return;
      if (typeof target.requestFullscreen === "function") {
        try {
          await target.requestFullscreen();
          if (doc.fullscreenElement) {
            mode = "native";
            emit();
            return;
          }
        } catch {
          // A denied native request falls back to app-controlled layout fullscreen.
        }
      }
      mode = "layout";
      emit();
    },
    async exit() {
      if (destroyed || mode === "none") return;
      if (mode === "native" && doc.fullscreenElement && typeof doc.exitFullscreen === "function") {
        try {
          await doc.exitFullscreen();
        } finally {
          if (!doc.fullscreenElement) mode = "none";
          emit();
        }
        return;
      }
      mode = "none";
      emit();
    },
    async toggle() {
      if (mode === "none") await this.enter();
      else await this.exit();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      doc.removeEventListener("fullscreenchange", onFullscreenChange);
      listeners.clear();
    },
  };
}

export interface FullscreenExitControlOptions {
  /** A stable localStorage key used to remember the button position. */
  readonly storageKey?: string;
  /** Button size in pixels. Defaults to the 34px control used in KeepScore. */
  readonly size?: number;
  /** Edge spacing in pixels. Defaults to 8. */
  readonly margin?: number;
  readonly label?: string;
}

/**
 * Mounts the small draggable fullscreen exit control used by KeepScore.
 * The control is visible only while fullscreen, stays within the viewport, and
 * remembers its position. A short tap exits fullscreen; dragging only repositions it.
 */
export function createFullscreenExitControl(
  controller: FullscreenController,
  doc: Document = document,
  options: FullscreenExitControlOptions = {},
): { element: HTMLButtonElement; destroy(): void } {
  const win = doc.defaultView ?? window;
  const size = options.size ?? 34;
  const margin = options.margin ?? 8;
  const storageKey = options.storageKey ?? "pwa-kit-fullscreen-exit-control-position";
  const label = options.label ?? "Quitter le plein écran";
  type Position = { x: number; y: number };
  type Drag = { id: number; offsetX: number; offsetY: number; startX: number; startY: number; startedAt: number };
  let drag: Drag | null = null;

  const clamp = (position: Position): Position => ({
    x: Math.max(margin, Math.min(position.x, win.innerWidth - size - margin)),
    y: Math.max(margin, Math.min(position.y, win.innerHeight - size - margin)),
  });
  const readPosition = (): Position => {
    try {
      const value = JSON.parse(win.localStorage.getItem(storageKey) ?? "null") as Position | null;
      if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) return clamp(value);
    } catch {
      // Storage may be unavailable in private browsing or sandboxed contexts.
    }
    return clamp({ x: win.innerWidth - size - margin, y: win.innerHeight - size - margin });
  };
  let position = readPosition();
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "pwa-kit-fullscreen-exit-control";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
  Object.assign(button.style, {
    position: "fixed",
    zIndex: "2147483000",
    width: `${size}px`,
    height: `${size}px`,
    padding: "7px",
    border: "0",
    borderRadius: "50%",
    background: "rgba(16,16,20,.82)",
    color: "#fff",
    boxShadow: "0 2px 10px rgba(0,0,0,.35)",
    backdropFilter: "blur(8px)",
    touchAction: "none",
    cursor: "move",
    display: "none",
    left: `${position.x}px`,
    top: `${position.y}px`,
  });
  const svg = button.querySelector("svg");
  if (svg) Object.assign(svg.style, { width: "100%", height: "100%", display: "block" });
  doc.body.append(button);

  const applyPosition = (next: Position) => {
    position = clamp(next);
    button.style.left = `${position.x}px`;
    button.style.top = `${position.y}px`;
    try { win.localStorage.setItem(storageKey, JSON.stringify(position)); } catch {}
  };
  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, offsetX: event.clientX - position.x, offsetY: event.clientY - position.y, startX: event.clientX, startY: event.clientY, startedAt: performance.now() };
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    applyPosition({ x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY });
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    const elapsed = performance.now() - drag.startedAt;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    drag = null;
    if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    if (elapsed <= 300 && distance <= 8) void controller.exit();
  };
  const onPointerCancel = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
  };
  button.addEventListener("pointerdown", onPointerDown);
  button.addEventListener("pointermove", onPointerMove);
  button.addEventListener("pointerup", onPointerUp);
  button.addEventListener("pointercancel", onPointerCancel);
  const unsubscribe = controller.subscribe(({ isFullscreen }) => {
    button.style.display = isFullscreen ? "block" : "none";
  });
  const onResize = () => applyPosition(position);

  win.addEventListener("resize", onResize);
  return {
    element: button,
    destroy() {
      unsubscribe();
      win.removeEventListener("resize", onResize);
      button.removeEventListener("pointerdown", onPointerDown);
      button.removeEventListener("pointermove", onPointerMove);
      button.removeEventListener("pointerup", onPointerUp);
      button.removeEventListener("pointercancel", onPointerCancel);
      button.remove();
    },
  };
}
