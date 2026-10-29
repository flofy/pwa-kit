export type FeedbackCategory = "feature" | "bug" | "improvement" | "other";

export interface FeedbackIssueConfig {
  /** GitHub repository in owner/name format. */
  readonly repository: string;
  /** Human-readable name of the app collecting feedback. */
  readonly appName: string;
  readonly appVersion?: string;
  /** Optional labels that already exist in the target repository. */
  readonly labels?: Partial<Record<FeedbackCategory, readonly string[]>>;
}

export interface FeedbackIssueInput {
  readonly category: FeedbackCategory;
  readonly title: string;
  readonly description: string;
  /** Include only when the user has agreed to share the current page URL. */
  readonly pageUrl?: string;
  /** Optional, explicitly collected diagnostics. Do not populate without user consent. */
  readonly diagnostics?: Readonly<Record<string, string>>;
}

const CATEGORY_TITLES: Record<FeedbackCategory, string> = {
  feature: "[Feature]",
  bug: "[Bug]",
  improvement: "[Improvement]",
  other: "[Feedback]",
};

const VALID_CATEGORIES = new Set<FeedbackCategory>(["feature", "bug", "improvement", "other"]);

/**
 * Builds a GitHub "new issue" URL with the feedback prefilled.
 *
 * No issue is created automatically and no GitHub token is needed: the user
 * reviews the draft and submits it on GitHub. Apps should only pass optional
 * context (such as pageUrl or diagnostics) after telling the user what is shared.
 */
export function createFeedbackIssueUrl(
  config: FeedbackIssueConfig,
  input: FeedbackIssueInput,
): string {
  const repository = config.repository.trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new TypeError('Feedback repository must use the "owner/name" format.');
  }
  if (!config.appName.trim()) throw new TypeError("Feedback appName must not be empty.");
  if (!VALID_CATEGORIES.has(input.category)) throw new TypeError("Unsupported feedback category.");

  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) throw new TypeError("Feedback title must not be empty.");
  if (!description) throw new TypeError("Feedback description must not be empty.");

  const issueTitle = `${CATEGORY_TITLES[input.category]} ${title}`;
  const sections = [
    "## Description",
    description,
    "",
    "## Context",
    `- Application: ${config.appName.trim()}`,
    ...(config.appVersion?.trim() ? [`- Version: ${config.appVersion.trim()}`] : []),
    ...(input.pageUrl?.trim() ? [`- Page: ${input.pageUrl.trim()}`] : []),
    "",
    "---",
    "_Submitted from the in-app feedback form._",
  ];

  const diagnostics = input.diagnostics
    ? Object.entries(input.diagnostics).filter(([key, value]) => key.trim() && value.trim())
    : [];
  if (diagnostics.length > 0) {
    const contextIndex = sections.indexOf("---");
    sections.splice(contextIndex, 0, "", "## Diagnostics", ...diagnostics.map(([key, value]) => `- ${key}: ${value}`));
  }

  const params = new URLSearchParams({ title: issueTitle, body: sections.join("\n") });
  const labels = config.labels?.[input.category]?.filter((label) => label.trim()) ?? [];
  if (labels.length > 0) params.set("labels", labels.join(","));

  return `https://github.com/${repository}/issues/new?${params.toString()}`;
}
