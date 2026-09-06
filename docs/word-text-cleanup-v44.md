# Vocabulary text repair v44

## What changes

Vocabulary imports, existing local vocabulary, backup restores and cloud-state normalization now share the same conservative English-word cleaner. For example, `&leader`, `=leader`, `&amp;leader`, `**leader**` and fullwidth `＝Ｌｅａｄｅｒ` are normalized before they are shown or spoken. Common whitespace, list markers and known HTML entities are handled. This is not a translation or spelling-correction service.

Meaningful internal punctuation is retained, including `AT&T`, `C++`, `C#`, `can't` and `well-being`. Numbers, currencies, time notation and suffixes such as `-ing` are not stripped indiscriminately. Unrecognized entities, symbol-only rows, HTML fragments and formula-like values are flagged rather than executed or silently reinterpreted.

## Existing records

The first successful IndexedDB migration writes an original-state snapshot at `word-text-backup-v1` and the repaired state in one transaction. A failed migration write returns the in-memory repaired state without replacing the original data with a sample library. Original spellings are also retained in `wordTextRepairs`, with stable keys so repeated loading does not add duplicate repair records.

Word IDs, word order, meanings, examples, sources, review cards, events and daily-plan references are not merged or reset by the text repair. Existing duplicate IDs that become the same spelling are retained and reported. Newly imported equivalent spellings reuse an existing word instead of creating another entry. Existing invalid records remain available for review; new invalid import rows are skipped with an explanation.

The library screen includes “词条杂字符修复” with before/after records and JSON export. Import preview shows cleaned and skipped rows before confirmation. Partial CSV headers no longer map missing fields onto unrelated columns.

## Updating the app

Finish the current study session, export a local backup, and reload the same browser or home-screen app once the new bundle is deployed. No deletion, reimport or clearing of website storage is needed. A cloud snapshot is not necessarily the latest state on a device; do not use an entire-cloud overwrite to perform this text repair.

## Verification

GitHub Actions run 34012152127 installed the locked dependencies, passed all 159 tests both before and after building, and generated the Safari 16-targeted browser bundle in commit 0792ca8e2939c4236c06801341697f6c799139f4. Coverage includes the reported `&leader` display and speech text, original-ID reuse during reimport, immutable migration, retained learning records, atomic local backup, repeat loading and IndexedDB-unavailable fallback.

The browser-flow test uses JSDOM, fake IndexedDB and a mocked speech API. It verifies the text sent to speech, not voice quality or physical-device audio. The one-time integration script and workflow were removed after their verified output was committed; normal repository tests remain.
