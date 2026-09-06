# v45 final verification

Verified runtime/build commit: `e5286862f30d0440079ad8f00fbee846ac983182`.

GitHub Actions run `34014541387`, job `101435946306`, completed successfully. The full suite passed **171/171 tests, zero failed, zero skipped**, both before and after the production browser build. `git diff --check` passed. The final build and cache-busted index were committed by the verification job.

New regression coverage includes:
- Daily historical errors remain visible after later successful answers.
- Historical book snapshots and explicitly labelled fallback for old events.
- Book subtotals count only errors attributed to that book, including same-day membership changes.
- Filtered counts distinguish listening, Chinese self-rated typing and English spelling.
- Selecting across days deduplicates original word IDs without resetting retired status.
- Repeating a completed review and retrying only this round's mistakes.
- Each free-listening answer is saved to an independent practice log.
- Existing formal events, FSRS cards and daily plan references remain unchanged by selected review.
- Practice events survive JSON normalization, backups and ID-based cloud merge.
- Invalid log records, duplicate submissions, HTML escaping and CSV formula-character safety.

The integration test drives the actual app module in JSDOM with fake IndexedDB and a mocked speech API. This verifies the UI workflow, persisted data and text sent to speech; it is not a physical-device voice-quality test.

No production database schema or user vocabulary data was modified to install this feature. Temporary source segments and one-time verification workflow have been removed from the final tree; all regression tests remain in the standard test suite.
