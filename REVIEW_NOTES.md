# Review Notes

## Addressed in this pass

- Verified `manifest.json` permissions are minimal for the current design: alarms, storage, notifications, `https://claude.ai/*`, and `http://localhost:8001/*`.
- Fixed failure-state persistence so auth/rate-limit errors update the existing popup `stats` object instead of writing unused dotted storage keys.
- Added rate-limit handling that stops the current run on HTTP 429, preserves the cursor state already collected, and lets the next alarm continue.

## Decisions to consider

1. Should the receiver URL be configurable in the popup?
   Keeping `http://localhost:8001` hardcoded minimizes Chrome host permissions. A configurable URL would help users who change the receiver port, but it would require either broader host permissions or a permission request flow.

2. Should `notifications` be optional?
   It is currently used only for session-expired alerts. Removing it would make permissions even smaller, but users would need to open the popup to discover auth expiry.
