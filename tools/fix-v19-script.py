from pathlib import Path
import json
import re

p = Path('tools/apply-v19.mjs')
s = p.read_text()
new_fn = "function importSentenceProblems(tokens,targetName,sentence){const target=String(targetName||'句子错题本').trim()||'句子错题本';registerErrorBook(target);let missing=0;for(const token of tokens){const en=String(token.normalized||token.surface||'').toLowerCase();const existing=state.words.find(w=>w.en===en);const w=upsertWord({en,zh:existing?.zh||'',source:target,example:token.sentence||sentence,reviewHint:true});if(w&&!w.zh){w.needsMeaning=true;missing++;}}persist();toast(`已加入「${target}」${missing?` · ${missing} 个待批量补释义`:''}`);}" 
replacement = (
    "const importPattern = /function importSentenceProblems\\(tokens,targetName,sentence\\)\\{.*?\\}\\nfunction finishSentenceRun/s;\n"
    f"const newImport={json.dumps(new_fn, ensure_ascii=False)};\n"
    "if(!importPattern.test(app)) throw new Error('sentence import function not found');\n"
    "app=app.replace(importPattern,newImport+'\\nfunction finishSentenceRun');"
)
s2, n = re.subn(r"const oldImport=.*?app=app\.replace\(oldImport,newImport\);", replacement, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f'could not patch apply-v19.mjs, replacements={n}')
p.write_text(s2)
