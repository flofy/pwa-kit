# Reusable Capacitor Android APK workflow

Use `.github/workflows/android-apk.yml` from another workflow to standardize the web build, Capacitor Android project generation/sync, Android SDK setup, Gradle execution, APK artifact upload, SHA-256 calculation, and optional attachment to an existing GitHub Release.

## Example

```yaml
jobs:
  android:
    uses: flofy/pwa-kit/.github/workflows/android-apk.yml@feat/reusable-android-workflows
    with:
      capacitor-directory: capacitor
      android-directory: capacitor/android
      install-command: pnpm install --frozen-lockfile
      web-build-command: pnpm run build
      native-assets-command: |
        npm install --prefix .asset-tools sharp --no-package-lock --no-audit --no-fund
        node .github/scripts/rasterize-native-assets.mjs
      asset-path: assets
      generate-capacitor-assets: true
      gradle-task: assembleDebug
      apk-path: app/build/outputs/apk/debug/app-debug.apk
      artifact-name: my-app-android
    secrets: inherit
```

Replace the branch ref with a reviewed, immutable release tag after this workflow is merged and versioned. The workflow assumes the caller's Capacitor configuration points to the web build output and that the app-specific asset preparation command (if any) is available in the caller repository.

To publish an APK, pass an existing `release-tag` and `release-asset-name`. The workflow uploads both the APK and its SHA-256 sidecar; it does not create tags or releases.

## Signing

When `release-tag` is set, all four secrets are required: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. The workflow decodes the keystore to the runner's temporary directory and applies an ephemeral Gradle init script to sign the release variant. A release publication fails rather than silently publishing an unsigned APK when any signing secret is missing.

Keep the keystore and passwords in GitHub Actions secrets or an appropriate protected environment. Never commit signing material. Keep the same keystore for every release so existing installations can update in place. Preview builds that omit `release-tag` do not require signing secrets.

## Important boundaries

- The caller owns app-specific web build behavior, native asset preparation, package ID, versionCode/versionName, and Gradle signing configuration.
- The workflow generates the Android project with `npx cap add android` if it is absent, then runs `npx cap sync android`.
- Use `assembleDebug` for previews only. For a public release, use a release task and verify that the resulting APK is signed with the stable application key.
- F-Droid builds and signs from source through its own process; do not treat this workflow's APK as the F-Droid distribution artifact.
