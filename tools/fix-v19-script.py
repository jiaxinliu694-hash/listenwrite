from pathlib import Path
import json
import re

p = Path('tools/apply-v19.mjs')
s = p.read_text()

# Repair the sentence-problem import patch so the helper script itself stays valid JS.
new_import = "function importSentenceProblems(tokens,targetName,sentence){const target=String(targetName||'句子错题本').trim()||'句子错题本';registerErrorBook(target);let missing=0;for(const token of tokens){const en=String(token.normalized||token.surface||'').toLowerCase();const existing=state.words.find(w=>w.en===en);const w=upsertWord({en,zh:existing?.zh||'',source:target,example:token.sentence||sentence,reviewHint:true});if(w&&!w.zh){w.needsMeaning=true;missing++;}}persist();toast(`已加入「${target}」${missing?` · ${missing} 个待批量补释义`:''}`);}" 
import_replacement = (
    "const importStart=app.indexOf('function importSentenceProblems(');\n"
    "const importEnd=app.indexOf('\\nfunction finishSentenceRun',importStart);\n"
    f"const newImport={json.dumps(new_import, ensure_ascii=False)};\n"
    "if(importStart<0||importEnd<0) throw new Error('sentence import function not found');\n"
    "app=app.slice(0,importStart)+newImport+app.slice(importEnd);"
)
pat = re.compile(r"const oldImport=.*?app=app\.replace\(oldImport,newImport\);", re.S)
s, n = pat.subn(lambda m: import_replacement, s, count=1)
if n != 1:
    raise SystemExit(f'could not patch import helper, replacements={n}')

# Repair the pending-meaning UI insertion. Keep the inserted app source in a JSON string
# so nested template literals never break tools/apply-v19.mjs parsing.
pending_code = """function pendingMeaningHtml(){const words=state.words.filter(w=>w.needsMeaning&&!w.zh);if(!words.length)return'';return `<section class=\"card\"><div class=\"space\"><div><h2 class=\"section-title\">待补释义</h2><div class=\"small\">句子错词先无打断导入，这里一次批量补。共 ${words.length} 个。</div></div></div><div class=\"error-compact\" style=\"margin-top:10px\">${words.slice(0,80).map(w=>`<div class=\"error-row\"><span class=\"en\">${esc(w.en)}</span><input data-pending-meaning=\"${w.id}\" placeholder=\"中文核心义\" value=\"\"></div>`).join('')}</div><div class=\"row\" style=\"margin-top:10px\"><button id=\"savePendingMeanings\" class=\"primary\">保存已填写释义</button></div></section>`;}\nfunction bindPendingMeanings(){const b=document.getElementById('savePendingMeanings');if(!b)return;b.onclick=()=>{let n=0;document.querySelectorAll('[data-pending-meaning]').forEach(el=>{const zh=el.value.trim();if(!zh)return;const w=wordById(el.dataset.pendingMeaning);if(w){w.zh=zh;w.needsMeaning=false;n++;}});persist();toast(`已补 ${n} 个释义`);renderLibrary();};}\n"""
pending_replacement = (
    "// Add a compact pending-meaning batch section to library shell.\n"
    f"const pendingMeaningCode={json.dumps(pending_code, ensure_ascii=False)};\n"
    "if(!app.includes('function wordEditorHtml(){')) throw new Error('word editor insertion point not found');\n"
    "app=app.replace('function wordEditorHtml(){',pendingMeaningCode+'function wordEditorHtml(){');\n"
    "if(!app.includes('${wordEditorHtml()}')) throw new Error('library word editor template not found');\n"
    "app=app.replace('${wordEditorHtml()}','${pendingMeaningHtml()}${wordEditorHtml()}');\n"
    "if(!app.includes('bindWordEditor();')) throw new Error('word editor binding not found');\n"
    "app=app.replace('bindWordEditor();','bindPendingMeanings();bindWordEditor();');"
)
start = s.find('// Add a compact pending-meaning batch section')
end = s.find("write('src/app.js',app);", start)
if start < 0 or end < 0:
    raise SystemExit('could not locate pending meaning helper block')
s = s[:start] + pending_replacement + '\n' + s[end:]

p.write_text(s)
# v19e
