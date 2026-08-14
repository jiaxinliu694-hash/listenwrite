from pathlib import Path
p = Path('src/app.js')
s = p.read_text()
s = s.replace("${staleSentenceLinks?`<button id=\"cleanupStaleSentences\" class=\"ghost\">清理失效旧句 · ${staleSentenceLinks}</button>`:}", "${staleSentenceLinks?`<button id=\"cleanupStaleSentences\" class=\"ghost\">清理失效旧句 · ${staleSentenceLinks}</button>`:''}")
p.write_text(s)
