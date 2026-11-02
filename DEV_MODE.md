# Local Lifetime Development Mode

This branch is reserved for a development-only Lifetime entitlement mode.

## Current architecture findings

- The extension is Manifest V3 and its account/subscription UI is in `sidepanel.html`.
- The main application logic in `sidepanel.js` (621 KB) and `background.js` is heavily obfuscated.
- The extension calls a hosted Google Cloud Functions service at `us-central1-tryaitoday-automator.cloudfunctions.net`.
- The repository does not contain that service's backend source.

## Why a complete local Lifetime implementation is not yet possible

The UI is not the authority for subscription status. The hosted service can validate the account, enforce usage quotas, and gate operations independently of what the extension displays. Changing the badge to "Lifetime", hiding the checkout button, or editing local storage would only change the appearance of the extension; it would not reliably grant Lifetime access or remove server-side limits.

The obfuscated client also prevents safely identifying and changing every entitlement check without the original source.

## Required implementation design

When the backend and unobfuscated client source are available, implement this as an explicit development-only mode:

1. Add a build-time `DEV_ENTITLEMENT_MODE` flag, disabled by default.
2. Permit a local mock entitlement only in unpacked development builds.
3. Keep production builds connected to the existing server-side subscription validation.
4. Never send a fabricated payment receipt or claim that a payment occurred.
5. Make the account screen visibly identify the mock state as **DEV — Lifetime (local only)**.
6. Keep quota and entitlement behavior consistent across the side panel, background worker, and server API.
7. Add tests proving that the development flag cannot be enabled in production builds.

## Files needed to finish

- The unobfuscated original `sidepanel.js` (or its source project).
- The backend source for the Cloud Functions service, or a documented development/test entitlement endpoint.

Until those are available, this branch intentionally does not fake a successful subscription or claim that server-side Lifetime access has been granted.
