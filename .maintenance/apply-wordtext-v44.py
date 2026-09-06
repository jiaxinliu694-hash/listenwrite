from pathlib import Path
import subprocess

root=Path.cwd()
expected={'src/app.js':'ca14be1c4ed68078b1b13d824eea151727f5db6b','src/importwords.js':'4614172e8f54f0f64fee681cfd71d59d38f08578','src/sentencebooks.js':'e1d56d132e41d7834dbeb51c32f545d761cd6989','src/storage.js':'d178b464aa93de0c3260b6c53467125bcb9feb84'}
for name,sha in expected.items():
 actual=subprocess.check_output(['git','hash-object',name],text=True).strip()
 if actual!=sha: raise SystemExit(f'Baseline changed: {name}')

def edit(name,old,new):
 p=root/name;s=p.read_text();assert s.count(old)==1,(name,old[:80],s.count(old));p.write_text(s.replace(old,new,1))

p=root/'src/sentencebooks.js';s=p.read_text();p.write_text("import { normalizeWordLexeme } from './wordtext.js';\n\n"+s)
edit('src/sentencebooks.js', "return String(value || '').trim().toLowerCase();", "return normalizeWordLexeme(value);")
p=root/'src/importwords.js';s=p.read_text();p.write_text("import { inspectWordText } from './wordtext.js';\n\n"+s)
edit('src/importwords.js', '  let matches = 0;', '  let matches = 0;\n  const detected = {};')
edit('src/importwords.js', '      map[field] = index;', '      detected[field] = index;')
edit('src/importwords.js', '  return { map, hasHeader: matches > 0 };', "  return { map: matches ? Object.fromEntries(Object.keys(map).map(field => [field, detected[field] ?? -1])) : map, hasHeader: matches > 0 };")
edit('src/importwords.js', "    const en = value('en');", "    const originalEn = value('en');\n    const cleaning = inspectWordText(originalEn);\n    const en = cleaning.text;")
edit('src/importwords.js', '      valid: Boolean(en),', '      originalEn,\n      cleaned: cleaning.valid && cleaning.changed,\n      issue: cleaning.issue,\n      valid: cleaning.valid,')
p=root/'src/storage.js';s=p.read_text();p.write_text("import { repairWordTextState, hasWordTextRepairs } from './wordtext.js';\n"+s)
edit('src/storage.js', 'export function normalizeState(input) {', 'export function normalizeState(input) {\n  input = repairWordTextState(input);')
edit('src/storage.js', "    if (saved) return normalizeState(saved);", """    if (saved) {
      const normalized = normalizeState(saved);
      if (hasWordTextRepairs(saved)) {
        // Keep the exact original local state alongside the repaired state.
        // A failed migration write must never fall through to empty sample data.
        try {
          await queueWrite(() => dbSetMany([
            ['word-text-backup-v1', cloneForStorage(saved)],
            [STATE_KEY, normalized],
          ]));
        } catch (error) { console.warn('Word text repair remains in memory; original local data retained', error); }
      }
      return normalized;
    }""")
edit('src/storage.js', '  const snapshot = cloneForStorage(state);\n  return queueWrite(async () => {', '  const snapshot = cloneForStorage(repairWordTextState(state));\n  return queueWrite(async () => {')
p=root/'src/app.js';s=p.read_text();p.write_text("import { inspectWordText, normalizeWordLexeme } from './wordtext.js';\nimport { importCleaningHtml, wordTextRepairHtml, bindWordTextRepair } from './wordtext-ui.js';\n"+s)
edit('src/app.js', "en=String(en||'').trim().toLowerCase();if(!en)return null;let w=state.words.find(x=>x.en===en);", "const checked=inspectWordText(en);if(!checked.valid){toast(`未导入：${checked.issue}`);return null;}en=normalizeWordLexeme(checked.text);let w=state.words.find(x=>normalizeWordLexeme(x.en)===en);")
edit('src/app.js', 'w.en===String(row.en).trim().toLowerCase()', 'normalizeWordLexeme(w.en)===normalizeWordLexeme(row.en)')
edit('src/app.js', "${valid.length} 行可导入。先确认列映射，再写入词库。", "${valid.length} 行可导入。先确认列映射与清洗结果，再写入词库。")
edit('src/app.js', '<div class="filtergrid" style="margin-top:12px">${importFieldSelect', '${importCleaningHtml(rows,esc)}<div class="filtergrid" style="margin-top:12px">${importFieldSelect')
edit('src/app.js', '${wordbookManageHtml(books)}${freeListenSetupHtml(books)}', '${wordTextRepairHtml(state,esc)}${wordbookManageHtml(books)}${freeListenSetupHtml(books)}')
edit('src/app.js', 'bindWordEditor();bindImportPreview();}', 'bindWordEditor();bindImportPreview();bindWordTextRepair(state,download);}')
edit('src/app.js', 'upsertWord({en,zh,source,example:sentence});persist();', 'const added=upsertWord({en,zh,source,example:sentence});if(!added)return;persist();')
start=(root/'src/app.js').read_text();a=start.index('function parseWordFile(');b=start.index('\nfunction requestRestore',a)
edit('src/app.js',start[a:b], "function parseWordFile(text,name){importDraft=buildImportDraft(text,name);wordEditId=null;view='library';renderLibrary();}")
