import { afterEach, describe, expect, it, vi } from "vitest";
import { checkForServiceWorkerUpdate } from "../src/index.js";

const registrations: ServiceWorkerRegistration[] = [];

function makeRegistration(update: () => Promise<void> = async () => undefined) {
  const registration = Object.assign(new EventTarget(), {
    waiting: null as ServiceWorker | null,
    installing: null as ServiceWorker | null,
    update: vi.fn(update),
  }) as unknown as ServiceWorkerRegistration;
  registrations.push(registration);
  return registration;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkForServiceWorkerUpdate", () => {
  it("reports unsupported when there is no registration", async () => {
    await expect(checkForServiceWorkerUpdate(undefined)).resolves.toEqual({ status: "unsupported" });
  });

  it("reports an update that is already waiting without checking again", async () => {
    const registration = makeRegistration();
    Object.defineProperty(registration, "waiting", { value: {} as ServiceWorker });

    await expect(checkForServiceWorkerUpdate(registration)).resolves.toEqual({ status: "available" });
    expect(registration.update).not.toHaveBeenCalled();
  });

  it("reports no update when the browser finds nothing new", async () => {
    await expect(checkForServiceWorkerUpdate(makeRegistration())).resolves.toEqual({ status: "none" });
  });

  it("reports a newly installed worker without applying or reloading it", async () => {
    const worker = Object.assign(new EventTarget(), { state: "installing" }) as unknown as ServiceWorker;
    const registration = makeRegistration(async () => {
      Object.defineProperty(registration, "installing", { value: worker, configurable: true });
      registration.dispatchEvent(new Event("updatefound"));
      Object.defineProperty(worker, "state", { value: "installed", configurable: true });
      worker.dispatchEvent(new Event("statechange"));
    });

    await expect(checkForServiceWorkerUpdate(registration)).resolves.toEqual({ status: "available" });
  });

  it("returns browser update errors as a result", async () => {
    const error = new Error("offline");
    await expect(checkForServiceWorkerUpdate(makeRegistration(() => Promise.reject(error)))).resolves.toEqual({
      status: "error",
      error,
    });
  });

  it("times out if the browser update check does not settle", async () => {
    const registration = makeRegistration(() => new Promise(() => undefined));
    await expect(checkForServiceWorkerUpdate(registration, { timeoutMs: 1 })).resolves.toEqual({ status: "timeout" });
  });
});
