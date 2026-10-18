# Reusable Capacitor Android workflows

PWA Kit provides two reusable GitHub Actions workflows:

- `.github/workflows/android-apk.yml` builds an APK and uploads it as an Actions artifact. It is intended for PR previews and does not require write access to repository contents.
- `.github/workflows/android-release.yml` calls the build workflow, requires stable Android signing and version metadata, then publishes the APK and SHA-256 sidecar to a GitHub Release.

Use a reviewed, immutable commit SHA or release tag in the `uses:` reference. The feature branch reference below is only for validating these PRs together.

## Preview build example

```yaml
jobs:
  android-preview:
    permissions:
      contents: read
      pull-requests: write
    uses: flofy/pwa-kit/.github/workflows/android-apk.yml@5d0232e177994532c19b312e7209557b646e95d4
    with:
      checkout-ref: ${{ github.sha }}
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
      artifact-name: my-app-android-preview
      comment-pr-artifact: true
```

The app-specific asset preparation command is optional. The workflow generates the Android project with `npx cap add android` if it is absent, then runs `npx cap sync android`.

## Signed release example

```yaml
jobs:
  android-release:
    permissions:
      contents: write
      pull-requests: write
    uses: flofy/pwa-kit/.github/workflows/android-release.yml@5d0232e177994532c19b312e7209557b646e95d4
    with:
      checkout-ref: ${{ inputs.version }}
      capacitor-directory: capacitor
      android-directory: capacitor/android
      install-command: pnpm install --frozen-lockfile
      web-build-command: pnpm run build
      gradle-task: assembleRelease
      android-version-code: ${{ github.run_number }}
      android-version-name: ${{ inputs.version }}
      apk-path: app/build/outputs/apk/release/app-release.apk
      artifact-name: my-app-android-release
      release-tag: ${{ inputs.version }}
      release-asset-name: MyApp-${{ inputs.version }}.apk
    secrets: inherit
```

The release workflow requires these repository or environment secrets:

- `ANDROID_KEYSTORE_BASE64`: Base64-encoded Android signing keystore.
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The workflow decodes the keystore to the runner's temporary directory and applies an ephemeral Gradle init script to sign the release variant. It also sets `versionCode` and `versionName` in the generated Android project. `android-version-code` must be positive and monotonically increasing across releases. A release fails if signing secrets or version metadata are missing.

Keep the same keystore for every release so existing installations can update in place. Never commit signing material. The release workflow creates a GitHub Release for the supplied existing Git tag if needed, then uploads the APK and checksum. It does not create Git tags.

## Important boundaries

- The caller owns app-specific web build behavior, native asset preparation, package ID, and version policy.
- Use `assembleDebug` for previews only. Public releases must use a release task and the same stable signing key every time.
- F-Droid builds and signs from source through its own process; these workflow artifacts are not the F-Droid distribution artifact.
