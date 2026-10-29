import { describe, expect, it } from "vitest";
import { createFullscreenController } from "../src/index.js";

function makeDocument(withNativeFullscreen: boolean) {
  const eventTarget = new EventTarget() as EventTarget & {
    fullscreenElement: Element | null;
    documentElement: HTMLElement;
    exitFullscreen: () => Promise<void>;
  };
  eventTarget.fullscreenElement = null;
  const target = {} as HTMLElement;

  if (withNativeFullscreen) {
    Object.assign(target, {
      requestFullscreen: async () => {
        eventTarget.fullscreenElement = target as unknown as Element;
        eventTarget.dispatchEvent(new Event("fullscreenchange"));
      },
    });
    eventTarget.exitFullscreen = async () => {
      eventTarget.fullscreenElement = null;
      eventTarget.dispatchEvent(new Event("fullscreenchange"));
    };
  } else {
    eventTarget.exitFullscreen = async () => undefined;
  }

  eventTarget.documentElement = target;
  return { doc: eventTarget as unknown as Document, target };
}

describe("createFullscreenController", () => {
  it("tracks native fullscreen entry and exit", async () => {
    const { doc, target } = makeDocument(true);
    const controller = createFullscreenController(doc, target);
    const states: string[] = [];
    controller.subscribe(({ mode }) => states.push(mode));

    await controller.enter();
    expect(controller.getSnapshot()).toEqual({ isFullscreen: true, mode: "native" });
    await controller.exit();
    expect(controller.getSnapshot()).toEqual({ isFullscreen: false, mode: "none" });
    expect(states).toEqual(["none", "native", "none"]);

    controller.destroy();
  });

  it("falls back to app-controlled fullscreen when the API is unavailable", async () => {
    const { doc, target } = makeDocument(false);
    const controller = createFullscreenController(doc, target);

    await controller.enter();
    expect(controller.getSnapshot()).toEqual({ isFullscreen: true, mode: "layout" });
    await controller.toggle();
    expect(controller.getSnapshot()).toEqual({ isFullscreen: false, mode: "none" });

    controller.destroy();
  });

  it("tracks an exit initiated by the browser", async () => {
    const { doc, target } = makeDocument(true);
    const controller = createFullscreenController(doc, target);
    await controller.enter();

    (doc as unknown as EventTarget & { fullscreenElement: Element | null }).fullscreenElement = null;
    doc.dispatchEvent(new Event("fullscreenchange"));

    expect(controller.getSnapshot()).toEqual({ isFullscreen: false, mode: "none" });
    controller.destroy();
  });
});
