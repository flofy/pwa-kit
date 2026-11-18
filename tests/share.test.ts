import { describe, expect, it, vi } from "vitest";
import { shareApp } from "../src/index.js";

describe("shareApp", () => {
  it("uses the native share sheet when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();

    await expect(shareApp({ title: "My app", url: "https://example.com" }, { share, clipboard: { writeText } })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "My app", url: "https://example.com" });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the URL when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(shareApp({ url: "https://example.com" }, { clipboard: { writeText } })).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://example.com");
  });

  it("copies the URL when native sharing fails", async () => {
    const share = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(shareApp({ url: "https://example.com" }, { share, clipboard: { writeText } })).resolves.toBe("copied");
  });

  it("does not copy when the user cancels native sharing", async () => {
    const error = new Error("Cancelled");
    error.name = "AbortError";
    const share = vi.fn().mockRejectedValue(error);
    const writeText = vi.fn();

    await expect(shareApp({ url: "https://example.com" }, { share, clipboard: { writeText } })).resolves.toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("returns unavailable when neither sharing nor clipboard can be used", async () => {
    await expect(shareApp({ url: "https://example.com" }, {})).resolves.toBe("unavailable");
    await expect(shareApp({}, { clipboard: { writeText: vi.fn() } })).resolves.toBe("unavailable");
  });

  it("returns unavailable when clipboard access fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Denied"));
    await expect(shareApp({ url: "https://example.com" }, { clipboard: { writeText } })).resolves.toBe("unavailable");
  });
});
