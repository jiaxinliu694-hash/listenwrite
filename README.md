# listenwrite

Personal listening-vocabulary trainer with FSRS scheduling, fixed daily new/review plans, same-day relearning, hand-writing reinforcement, persistent text listening, and statistics.

## v6

- Persistent sentence dictation books with familiar / unfamiliar / unknown labels
- One-click problem-word import into a named regular wordbook
- TSV problem-word export and re-import with source sentence
- Mixed multi-book study or sequential per-book new/review quotas
- Duplicate words count only once across sequential books
- Resume hint for an unjudged word when leaving a listening session
- Asia/Shanghai study-day logic: normal midnight rollover, unfinished plan grace period until 02:00

Core logic lives under `src/` and regression tests under `tests/`.
