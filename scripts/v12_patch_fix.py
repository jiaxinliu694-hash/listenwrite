from pathlib import Path

p = Path('src/app.js')
s = p.read_text()
s = s.replace('\\n\\nfunction', '\n\nfunction')
s = s.replace('\\nfunction', '\nfunction')
p.write_text(s)
