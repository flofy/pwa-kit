import { describe, expect, it } from "vitest";
import { createFeedbackIssueUrl } from "../src/feedback.js";

describe("createFeedbackIssueUrl", () => {
  it("builds a feature issue draft with app context and configured labels", () => {
    const url = new URL(createFeedbackIssueUrl(
      { repository: "flofy/astra-duel", appName: "Astra-Duel", appVersion: "1.2.3", labels: { feature: ["enhancement", "feedback"] } },
      { category: "feature", title: "Add team mode", description: "Let friends play in teams." },
    ));

    expect(url.pathname).toBe("/flofy/astra-duel/issues/new");
    expect(url.searchParams.get("title")).toBe("[Feature] Add team mode");
    expect(url.searchParams.get("labels")).toBe("enhancement,feedback");
    expect(url.searchParams.get("body")).toContain("- Application: Astra-Duel");
    expect(url.searchParams.get("body")).toContain("- Version: 1.2.3");
    expect(url.searchParams.get("body")).toContain("Let friends play in teams.");
  });

  it("includes page and diagnostics only when explicitly provided", () => {
    const withoutContext = new URL(createFeedbackIssueUrl(
      { repository: "flofy/demo", appName: "Demo" },
      { category: "bug", title: "Broken button", description: "The save button does nothing." },
    ));
    expect(withoutContext.searchParams.get("body")).not.toContain("Page:");
    expect(withoutContext.searchParams.get("body")).not.toContain("Diagnostics");

    const withContext = new URL(createFeedbackIssueUrl(
      { repository: "flofy/demo", appName: "Demo" },
      { category: "bug", title: "Broken button", description: "The save button does nothing.", pageUrl: "https://demo.example/settings", diagnostics: { browser: "Firefox" } },
    ));
    expect(withContext.searchParams.get("body")).toContain("- Page: https://demo.example/settings");
    expect(withContext.searchParams.get("body")).toContain("- browser: Firefox");
  });

  it("uses the configured category title for improvements and other feedback", () => {
    const makeUrl = (category: "improvement" | "other") => new URL(createFeedbackIssueUrl(
      { repository: "flofy/demo", appName: "Demo" },
      { category, title: "Small change", description: "A useful detail." },
    ));
    expect(makeUrl("improvement").searchParams.get("title")).toBe("[Improvement] Small change");
    expect(makeUrl("other").searchParams.get("title")).toBe("[Feedback] Small change");
  });

  it("rejects invalid repositories and empty required fields", () => {
    const input = { category: "feature" as const, title: "Title", description: "Description" };
    expect(() => createFeedbackIssueUrl({ repository: "not-a-repo", appName: "Demo" }, input)).toThrow(/owner\/name/);
    expect(() => createFeedbackIssueUrl({ repository: "flofy/demo", appName: "Demo" }, { ...input, title: " " })).toThrow(/title/);
    expect(() => createFeedbackIssueUrl({ repository: "flofy/demo", appName: "Demo" }, { ...input, description: " " })).toThrow(/description/);
  });
});
