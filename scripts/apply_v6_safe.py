from pathlib import Path

app = Path('src/app.js').read_text()
if "from './sentencebooks.js'" in app and 'function planForTodayOptions' in app and 'function sentenceRunData' in app:
    print('v6 app changes already applied')
    raise SystemExit(0)

exec(compile(Path('scripts/apply_v6.py').read_text(), 'scripts/apply_v6.py', 'exec'))
