# Sharing integration guide

Use the framework-neutral `shareApp` helper from the package entry point:

```ts
import { shareApp } from "@flofy/pwa-kit";

const result = await shareApp({
  title: document.title,
  text: "Take a look at this app",
  url: window.location.href,
});

switch (result) {
  case "shared":
    // The platform share sheet completed.
    break;
  case "copied":
    // Show a “Link copied” confirmation.
    break;
  case "cancelled":
    // The user dismissed the native share sheet; no error feedback is needed.
    break;
  case "unavailable":
    // Clipboard and native sharing were both unavailable.
    break;
}
```

Keep the share action in the app's existing menu rather than coupling it to the
install prompt. Installation guidance is platform-specific and should remain in
the host application's UI. On iOS Safari, explain the Share → Add to Home Screen
flow; on Chromium browsers, prefer the existing install controller when its
prompt is available.
