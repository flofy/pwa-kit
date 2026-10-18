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

The workflow exposes optional secrets named `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`, and makes the corresponding values available to Gradle. The application must explicitly configure its Android Gradle signing config to consume these environment variables; the workflow does not silently alter application Gradle files or make an unsigned APK a signed release.

Keep the keystore and passwords in GitHub Actions secrets or an appropriate protected environment. Never commit signing material. A public release must use a stable signing key so existing installations can update in place.

## Important boundaries

- The caller owns app-specific web build behavior, native asset preparation, package ID, versionCode/versionName, and Gradle signing configuration.
- The workflow generates the Android project with `npx cap add android` if it is absent, then runs `npx cap sync android`.
- Use `assembleDebug` for previews only. For a public release, use a release task and verify that the resulting APK is signed with the stable application key.
- F-Droid builds and signs from source through its own process; do not treat this workflow's APK as the F-Droid distribution artifact.
