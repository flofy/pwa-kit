# PWA Kit

Framework-agnostic TypeScript utilities for Progressive Web App install, update, fullscreen, and feedback flows, with small adapters for React and Svelte.

## Goals

- Provide a typed, browser-focused core for install prompts and app display mode detection.
- Provide an explicit service-worker update check without taking ownership of registration, applying updates, or reloading the page.
- Generate GitHub issue drafts for in-app feedback without exposing a GitHub token or requiring a backend.
- Keep framework adapters thin and optional.
- Avoid cache-name collisions between apps sharing an origin.

## Feedback issues

Use `createFeedbackIssueUrl()` to build a GitHub issue draft for a feature request, bug report, improvement, or general feedback. The helper returns a URL; it does not submit the issue. The user reviews and submits it on GitHub.

```ts
import { createFeedbackIssueUrl } from "@flofy/pwa-kit";

const issueUrl = createFeedbackIssueUrl(
  {
    repository: "flofy/my-app",
    appName: "My App",
    appVersion: "1.0.0",
    labels: {
      feature: ["enhancement", "feedback"],
      bug: ["bug", "feedback"],
    },
  },
  {
    category: "feature",
    title: "Add a team mode",
    description: "Explain what you would like to do and why.",
  },
);

window.location.assign(issueUrl);
```

Only include optional context such as the current page URL or diagnostics when the user has been told what will be shared. Labels are optional and should match labels configured in the target repository.

## Development

Requirements: Node.js 24 and pnpm.

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

See [docs/architecture.md](docs/architecture.md) for design constraints.
