from pathlib import Path

p = Path('tests/browser-smoke.test.js')
s = p.read_text()
s = s.replace("assert.match(document.getElementById('dictateSentence').textContent, /拆词听写本句/);", "assert.match(document.getElementById('dictateSentence').textContent, /拆词听写/);\n  assert.ok(document.querySelector('#dictateWholeSentence'), 'text sentence should also offer true whole-sentence dictation');")
p.write_text(s)
