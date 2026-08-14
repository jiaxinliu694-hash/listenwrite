import fs from 'node:fs';

function patch(path, from, to) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(from)) throw new Error(`Missing pattern in ${path}: ${from.slice(0,120)}`);
  s = s.replace(from, to);
  fs.writeFileSync(path, s);
}

patch('src/app.js',
  "import { updateWordFields, deleteWordEverywhere } from './wordadmin.js';",
  "import { updateWordFields, deleteWordEverywhere, deleteWordbook } from './wordadmin.js';"
);

patch('src/app.js',
  'function renderLibrary(){',
  `function wordbookManageHtml(books){return \`<section class="card"><div class="space"><div><h2 class="section-title">词书管理</h2><div class="small">删除词书时可以只移除词书归属，也可以同时彻底删除只属于这本书的单词和学习记录；共享词不会误删。</div></div></div><div class="error-compact" style="margin-top:10px">\${books.map(book=>{const words=state.words.filter(w=>(w.sources||[]).includes(book));const exclusive=words.filter(w=>(w.sources||[]).length===1).length;const shared=words.length-exclusive;return \`<div class="error-row"><span><b>\${esc(book)}</b><div class="small">\${words.length} 词 · 独占 \${exclusive} · 共享 \${shared}</div></span><span></span><button class="danger" data-delete-book="\${esc(book)}">删除词书</button></div>\`;}).join('')||'<div class="empty">还没有词书。</div>'}</div></section>\`;}
function bindWordbookManage(){document.querySelectorAll('[data-delete-book]').forEach(button=>button.onclick=()=>{const book=button.dataset.deleteBook;const words=state.words.filter(w=>(w.sources||[]).includes(book));const exclusive=words.filter(w=>(w.sources||[]).length===1).length;const shared=words.length-exclusive;const purge=confirm(\`删除词书「\${book}」？\\n\\n确定：删除词书，并彻底删除其中 \${exclusive} 个独占单词及其学习记录。\\n取消：下一步可选择仅移除词书并保留全部学习数据。\\n\\n共享词 \${shared} 个只会移除这本书的归属，不会删除其他词书中的单词和历史。\`);if(!purge){if(!confirm(\`仅移除词书「\${book}」，保留单词和全部学习数据？\`))return;}const result=deleteWordbook(state,book,{purgeExclusive:purge});persist();toast(purge?\`已删除词书：彻底删除 \${result.removedWords} 个独占词\`:'已移除词书，学习数据已保留');renderLibrary();});}
function renderLibrary(){`
);

patch('src/app.js',
  '${freeListenSetupHtml(books)}${errorBookSectionHtml()}',
  '${wordbookManageHtml(books)}${freeListenSetupHtml(books)}${errorBookSectionHtml()}'
);

patch('src/app.js',
  'bindFreeListenSetup();drawWordList();bindWordEditor();bindImportPreview();}',
  'bindWordbookManage();bindFreeListenSetup();drawWordList();bindWordEditor();bindImportPreview();}'
);

console.log('v17 patches applied');
