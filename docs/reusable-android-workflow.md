# Reusable Android APK workflow

Use `.github/workflows/android-apk.yml` from another workflow to standardize Android SDK setup, Gradle execution, APK artifact upload, SHA-256 calculation, and optional attachment to an existing GitHub Release.

## Example

```yaml
jobs:
  android:
    uses: flofy/pwa-kit/.github/workflows/android-apk.yml@feat/reusable-android-workflows
    with:
      android-directory: app/android
      gradle-task: assembleRelease
      apk-path: app/build/outputs/apk/release/app-release.apk
      artifact-name: my-app-android
      release-tag: ${{ inputs.version }}
      release-asset-name: MyApp-${{ inputs.version }}.apk
    secrets: inherit
```

Replace the branch ref with a reviewed, immutable release tag after this workflow is merged and versioned. The example assumes the caller has already prepared the native Android project and that its Gradle configuration can produce the requested APK.

## Signing

The workflow exposes optional secrets named `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`, and makes the corresponding values available to Gradle. The application must explicitly configure its Android Gradle signing config to consume these environment variables; the workflow does not silently alter application Gradle files or make an unsigned APK a signed release.

Keep the keystore and passwords in GitHub Actions secrets or an appropriate protected environment. Never commit signing material.

## Important boundaries

- The caller owns the web build, Capacitor sync/project generation, app-specific assets, package ID, versionCode/versionName, and Gradle signing configuration.
- Use `assembleDebug` for previews only. For a public release, use a release task and verify the resulting APK is signed with the stable application key.
- If `release-tag` is empty, the workflow only uploads an Actions artifact. If set, the tag must already have a GitHub Release.
- The workflow uploads the APK and a SHA-256 sidecar to the release. It does not create tags or releases.
- F-Droid builds and signs from source through its own process; do not treat this workflow's signed APK as the F-Droid distribution artifact.
