from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        if new in text:
            return
        raise SystemExit(f'expected marker not found in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, 1))


# Storage layer: expose the active local-storage container context and a conservative
# test for whether restoring a backup would overwrite meaningful user data.
storage = Path('src/storage.js')
st = storage.read_text()
insert_marker = "export function defaultState() {"
helper = """export function storageContext(env = {}) {
  const standalone = env.standalone ?? (
    typeof window !== 'undefined' && (
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator?.standalone === true
    )
  );
  return {
    mode: standalone ? 'standalone' : 'browser',
    label: standalone ? '主屏幕 App 本地数据' : '浏览器本地数据',
  };
}

export function hasUserData(state) {
  if (!state || typeof state !== 'object') return false;
  if ((state.texts || []).length) return true;
  if ((state.events || []).length) return true;
  if ((state.activities || []).length) return true;
  if ((state.simpleWords || []).length || (state.errorBooks || []).length) return true;
  if (Object.keys(state.dailyPlans || {}).length) return true;
  if ((state.sentenceBooks || []).some((book) => (book?.entries || []).length)) return true;
  if ((state.words || []).some((word) => !String(word?.id || '').startsWith('sample_'))) return true;
  const chart = state.dataChart;
  if (chart && typeof chart === 'object') {
    const stack = [chart];
    const seen = new Set();
    while (stack.length) {
      const value = stack.pop();
      if (!value || typeof value !== 'object' || seen.has(value)) continue;
      seen.add(value);
      if (Array.isArray(value)) {
        if (value.length) return true;
        continue;
      }
      for (const child of Object.values(value)) {
        if (Array.isArray(child) && child.length) return true;
        if (child && typeof child === 'object') stack.push(child);
      }
    }
  }
  return false;
}

"""
if helper not in st:
    if insert_marker not in st:
        raise SystemExit('storage helper insertion marker missing')
    st = st.replace(insert_marker, helper + insert_marker, 1)
    storage.write_text(st)

# App layer: restore is global, current container is visible, and empty text state
# explains browser-vs-home-screen isolation instead of looking like data vanished.
replace_once(
    'src/app.js',
    "import { loadState, saveState, replaceState, exportState } from './storage.js';",
    "import { loadState, saveState, replaceState, exportState, storageContext, hasUserData } from './storage.js';",
)

replace_once(
    'src/app.js',
    "function shell(content) {\n  const [ey, title] = labels[view] || ['', ''];\n  root.innerHTML = `<main class=\"shell\"><header class=\"topbar\"><div><div class=\"eyebrow\">${ey}</div><h1>${title}</h1></div><button id=\"backupTop\" class=\"soft\">备份</button></header>${content}</main>${navHtml()}`;\n  document.querySelectorAll('[data-nav]').forEach((b) => b.onclick = () => go(b.dataset.nav));\n  document.getElementById('backupTop').onclick = backup;\n}",
    "function shell(content) {\n  const [ey, title] = labels[view] || ['', ''];\n  const storage=storageContext();\n  root.innerHTML = `<main class=\"shell\"><header class=\"topbar\"><div><div class=\"eyebrow\">${ey}</div><h1>${title}</h1><div class=\"small\">${esc(storage.label)}</div></div><div class=\"toolbar\"><button id=\"restoreTop\" class=\"soft\">恢复</button><button id=\"backupTop\" class=\"soft\">备份</button></div></header>${content}</main>${navHtml()}`;\n  document.querySelectorAll('[data-nav]').forEach((b) => b.onclick = () => go(b.dataset.nav));\n  document.getElementById('restoreTop').onclick = requestRestore;\n  document.getElementById('backupTop').onclick = backup;\n}",
)

# Insert a single restore launcher near backup().
replace_once(
    'src/app.js',
    "function backup(){download(`listenwrite-backup-${currentDayKey()}.json`,exportState(state));}\n",
    "function requestRestore(){restoreInput.click();}\nfunction backup(){download(`listenwrite-backup-${currentDayKey()}.json`,exportState(state));}\n",
)

app = Path('src/app.js')
a = app.read_text()
old_home = """function renderTextLibraryHome(){
  ensureSentenceBooks(state);ensureSimpleWords(state);
  const groups=textCollectionSummaries(state);
  shell(`<div class=\"stack\"><section class=\"card hero\"><div class=\"space\"><div><h2>文本库</h2><p>先按文本库找文章；句子和单词学习记录只在对应文章里面显示。</p></div><button id=\"newText\" class=\"primary\">新建文本</button></div></section><section class=\"card\"><div class=\"space\"><div><h2 class=\"section-title\">我的文本库</h2><div class=\"small\">${state.texts.length} 篇文本 · ${groups.length} 个库</div></div></div><div class=\"list\" style=\"margin-top:12px\">${groups.length?groups.map(g=>`<button class=\"entry\" data-text-collection=\"${esc(g.name)}\"><div><b>${esc(g.name)}</b><div class=\"small\" style=\"margin-top:6px\">${g.textCount} 篇 · 已听 ${g.practicedSentenceCount} 句 · 听过 ${g.wordCount} 词${g.weakCount?` · ${g.weakCount} 个不熟悉`:''}</div></div><span>进入文本库 ›</span></button>`).join(''):'<div class=\"empty\">还没有文本。先新建一篇。</div>'}</div></section><section class=\"card\"><div class=\"space\"><div><h2 class=\"section-title\">独立句子工具</h2><div class=\"small\">临时句子、全局句子库和错词检索放在这里，不再铺在文本主页。</div></div><button id=\"openSentenceTools\" class=\"soft\">进入</button></div></section></div>`);
  document.getElementById('newText').onclick=()=>{textToolsOpen=true;textFormOpen=true;textEditId=null;renderText();};
  document.getElementById('openSentenceTools').onclick=()=>{textToolsOpen=true;renderText();};
  document.querySelectorAll('[data-text-collection]').forEach(b=>b.onclick=()=>{textLibraryCollection=b.dataset.textCollection;textLibraryDetailId=null;renderText();});
}"""
new_home = """function renderTextLibraryHome(){
  ensureSentenceBooks(state);ensureSimpleWords(state);
  const groups=textCollectionSummaries(state),storage=storageContext();
  const emptyTextNotice=!groups.length?`<div class=\"empty\"><div>当前这套本地数据里还没有文本。</div><div class=\"small\" style=\"margin-top:8px\">你现在看到的是「${esc(storage.label)}」。iPhone 上浏览器页面和添加到主屏幕的 App 可能各自保存一份本地数据；如果记录在另一个入口，请先在那里点「备份」，再回这里点「恢复」。</div><button id=\"restoreEmptyText\" class=\"soft\" style=\"margin-top:12px\">恢复已有备份</button></div>`:'';
  shell(`<div class=\"stack\"><section class=\"card hero\"><div class=\"space\"><div><h2>文本库</h2><p>先按文本库找文章；句子和单词学习记录只在对应文章里面显示。</p></div><button id=\"newText\" class=\"primary\">新建文本</button></div></section><section class=\"card\"><div class=\"space\"><div><h2 class=\"section-title\">我的文本库</h2><div class=\"small\">${state.texts.length} 篇文本 · ${groups.length} 个库</div></div></div><div class=\"list\" style=\"margin-top:12px\">${groups.length?groups.map(g=>`<button class=\"entry\" data-text-collection=\"${esc(g.name)}\"><div><b>${esc(g.name)}</b><div class=\"small\" style=\"margin-top:6px\">${g.textCount} 篇 · 已听 ${g.practicedSentenceCount} 句 · 听过 ${g.wordCount} 词${g.weakCount?` · ${g.weakCount} 个不熟悉`:''}</div></div><span>进入文本库 ›</span></button>`).join(''):emptyTextNotice}</div></section><section class=\"card\"><div class=\"space\"><div><h2 class=\"section-title\">独立句子工具</h2><div class=\"small\">临时句子、全局句子库和错词检索放在这里，不再铺在文本主页。</div></div><button id=\"openSentenceTools\" class=\"soft\">进入</button></div></section></div>`);
  document.getElementById('newText').onclick=()=>{textToolsOpen=true;textFormOpen=true;textEditId=null;renderText();};
  if(document.getElementById('restoreEmptyText'))document.getElementById('restoreEmptyText').onclick=requestRestore;
  document.getElementById('openSentenceTools').onclick=()=>{textToolsOpen=true;renderText();};
  document.querySelectorAll('[data-text-collection]').forEach(b=>b.onclick=()=>{textLibraryCollection=b.dataset.textCollection;textLibraryDetailId=null;renderText();});
}"""
if old_home not in a:
    if new_home not in a:
        raise SystemExit('renderTextLibraryHome marker missing')
else:
    a = a.replace(old_home, new_home, 1)
app.write_text(a)

# Restore now guards against overwriting an already-populated local container.
replace_once(
    'src/app.js',
    "restoreInput.onchange=async()=>{const f=restoreInput.files?.[0];if(!f)return;try{state=await replaceState(JSON.parse(await f.text()));reconcileDataChartContent(state.dataChart,DATA_CHART_SEED);persist();dataChartUI=null;toast('备份已恢复');view='home';render();}catch{toast('备份文件无法读取');}restoreInput.value='';};",
    "restoreInput.onchange=async()=>{const f=restoreInput.files?.[0];if(!f)return;try{if(hasUserData(state)&&!confirm('恢复备份会覆盖当前这套本地数据，继续吗？')){restoreInput.value='';return;}state=await replaceState(JSON.parse(await f.text()));reconcileDataChartContent(state.dataChart,DATA_CHART_SEED);persist();dataChartUI=null;toast('备份已恢复');view='home';render();}catch{toast('备份文件无法读取');}restoreInput.value='';};",
)

# Cache bust + tests.
replace_once('index.html', 'app.bundle.js?v=32-edit-text-status', 'app.bundle.js?v=33-ios-data-recovery')
for test_path in ['tests/v23_1.test.js', 'tests/v24.test.js']:
    p = Path(test_path)
    t = p.read_text().replace("app.bundle.js?v=32", "app.bundle.js?v=33")
    p.write_text(t)

Path('tests/v33.test.js').write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { storageContext, hasUserData } from '../src/storage.js';

test('storage context distinguishes browser from home-screen app containers',()=>{
  assert.deepEqual(storageContext({standalone:false}),{mode:'browser',label:'浏览器本地数据'});
  assert.deepEqual(storageContext({standalone:true}),{mode:'standalone',label:'主屏幕 App 本地数据'});
});

test('restore overwrite guard ignores bundled sample words but detects real study data',()=>{
  assert.equal(hasUserData({words:[{id:'sample_1'}],texts:[],events:[],activities:[],simpleWords:[],errorBooks:[],dailyPlans:{},sentenceBooks:[],dataChart:{items:[]}}),false);
  assert.equal(hasUserData({words:[{id:'real_1'}]}),true);
  assert.equal(hasUserData({texts:[{id:'t1'}]}),true);
  assert.equal(hasUserData({sentenceBooks:[{entries:[{id:'e1'}]}]}),true);
});

test('global shell exposes restore and empty text library explains local-container isolation',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.ok(app.includes('id=\\"restoreTop\\"'));
  assert.ok(app.includes('restoreEmptyText'));
  assert.ok(app.includes('主屏幕的 App 可能各自保存一份本地数据'));
  assert.ok(app.includes("hasUserData(state)&&!confirm"));
});

test('v33 browser bundle is cache busted',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.includes('app.bundle.js?v=33'));
});
""")
