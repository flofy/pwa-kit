import { describe, expect, it, vi } from "vitest";
import { createUpdateController } from "../src/index.js";

describe("createUpdateController", () => {
  it("notifies subscribers of current and changed state", () => {
    const controller = createUpdateController();
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.notifyUpdateAvailable();

    expect(listener.mock.calls.map(([state]) => state)).toEqual(["idle", "available"]);
  });

  it("applies an available update and returns to idle", async () => {
    const controller = createUpdateController();
    const apply = vi.fn();
    controller.notifyUpdateAvailable();

    await controller.applyUpdate(apply);

    expect(apply).toHaveBeenCalledOnce();
    expect(controller.getState()).toBe("idle");
  });

  it("does not apply when no update is available", async () => {
    const controller = createUpdateController();
    const apply = vi.fn();

    await controller.applyUpdate(apply);

    expect(apply).not.toHaveBeenCalled();
    expect(controller.getState()).toBe("idle");
  });

  it("exposes failures and moves to error state", async () => {
    const controller = createUpdateController();
    const failure = new Error("update failed");
    controller.notifyUpdateAvailable();

    await expect(controller.applyUpdate(() => { throw failure; })).rejects.toThrow(failure);
    expect(controller.getState()).toBe("error");
  });
});
