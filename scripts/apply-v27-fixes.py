from pathlib import Path

for path in ['tests/v23_1.test.js', 'tests/v24.test.js']:
    p=Path(path)
    text=p.read_text().replace("app.bundle.js?v=26", "app.bundle.js?v=27")
    p.write_text(text)

p=Path('tests/browser-smoke.test.js')
text=p.read_text()
text=text.replace("reject(new Error('Timed out waiting for app render'))", "reject(new Error('Timed out waiting for app render: '+String(check)))")
p.write_text(text)
