# listenwrite

Personal listening-vocabulary trainer with FSRS scheduling, fixed daily new/review plans, same-day relearning, hand-writing reinforcement, persistent text listening, sentence dictation, and statistics.

## v7

- Sentence dictation preserves duplicate word occurrences; optional per-run de-duplication remains available.
- Words marked as simple are skipped automatically in normal study, hand reinforcement, and sentence dictation. The old “退出循环” UI is now “标记简单”.
- Sentence-only records do not enter FSRS. A sentence problem word participates in formal scheduling only after it is imported into a regular wordbook.
- Saved/imported texts can launch word-by-word dictation for the current sentence while preserving text title, collection, sentence number, and token position.
- Sentence problem words can be located by sentence book, article title, sentence text, or word, then retrained for one sentence or for the entire current filter.
- Problem-word export/import keeps the source sentence; importing a word never removes the original sentence record.
- Home is intentionally lean: entry points plus today’s completed new-word and review counts.
- Mixed multi-book study and sequential per-book quotas remain available; duplicate formal words count only once across sequential books.
- Asia/Shanghai study-day logic remains: normal midnight rollover, with an unfinished-plan grace period up to 02:00.

Core logic lives under `src/` and regression tests under `tests/`.
