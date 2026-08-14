from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: target not found')
    return text.replace(old, new, 1)


def sub_once(text, pattern, repl, label):
    out, n = re.subn(pattern, lambda m: repl, text, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f'{label}: matched {n}')
    return out

# ---------- storage ----------
p = Path('src/storage.js')
s = p.read_text()
if 'errorBooks: []' not in s:
    s = replace_once(s, 'version: 7,\n    words: [],', 'version: 8,\n    words: [],', 'storage version default')
    s = replace_once(s, 'sentenceBooks: [],\n    simpleWords: [],', 'sentenceBooks: [],\n    simpleWords: [],\n    errorBooks: [],', 'errorBooks default')
    s = replace_once(
        s,
        "state.simpleWords = Array.isArray(input?.simpleWords) ? [...new Set(input.simpleWords.map(normalizeLexeme).filter(Boolean))] : [];\n  ensureSimpleWords(state);",
        "state.simpleWords = Array.isArray(input?.simpleWords) ? [...new Set(input.simpleWords.map(normalizeLexeme).filter(Boolean))] : [];\n  ensureSimpleWords(state);\n  const inferredErrorBooks = new Set(Array.isArray(input?.errorBooks) ? input.errorBooks.map(String).filter(Boolean) : []);\n  for (const word of state.words) for (const source of word.sources || []) if (/错题|错词|error/i.test(source)) inferredErrorBooks.add(source);\n  state.errorBooks = [...inferredErrorBooks];",
        'normalize errorBooks',
    )
    s = s.replace('state.version = 7;', 'state.version = 8;')
p.write_text(s)

# ---------- styles ----------
p = Path('styles.css')
s = p.read_text()
if '.study-sheet{' not in s:
    s += '''\n.study-actions{position:absolute;right:0;top:8px;display:flex;gap:5px;align-items:center}.study-actions button{border:0;background:transparent;color:var(--muted);font-size:12px;padding:7px 6px}.study-sheet{position:fixed;z-index:30;left:12px;right:12px;top:max(70px,calc(env(safe-area-inset-top) + 64px));bottom:16px;max-width:720px;margin:auto;background:var(--paper);border:1px solid var(--line);border-radius:20px;box-shadow:0 18px 60px rgba(40,35,28,.16);padding:16px;overflow:auto}.study-sheet-head{position:sticky;top:-16px;background:var(--paper);padding:5px 0 10px;display:flex;justify-content:space-between;align-items:center;z-index:2}.study-list{display:grid;gap:12px}.study-list-group{border:1px solid rgba(90,80,65,.1);border-radius:15px;overflow:hidden}.study-list-title{padding:9px 11px;background:#f8f4ec;font-size:12px;color:var(--muted);display:flex;justify-content:space-between}.study-word-row{display:grid;grid-template-columns:minmax(100px,1.3fr) minmax(78px,.8fr) minmax(64px,.65fr) minmax(70px,.8fr);gap:8px;align-items:center;padding:8px 11px;border-top:1px solid rgba(90,80,65,.07);font-size:12px}.study-word-row:first-child{border-top:0}.study-word-row.current{background:#f3efe6}.study-word-row .en{font-size:14px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis}.study-word-row .zh{color:var(--muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mark-pending{color:var(--muted)}.mark-good{color:var(--green);font-weight:650}.mark-bad{color:var(--red);font-weight:650}.mark-simple{color:#8a7653;font-weight:650}.error-books{display:grid;gap:8px;margin-top:12px}.error-book{border:1px solid rgba(90,80,65,.1);border-radius:15px;background:#fffdfa;padding:0 12px}.error-book summary{padding:11px 0;cursor:pointer;display:flex;justify-content:space-between;gap:10px;align-items:center}.error-compact{max-height:310px;overflow:auto;border-top:1px solid rgba(90,80,65,.08)}.error-row{display:grid;grid-template-columns:minmax(105px,.9fr) minmax(120px,1.4fr) auto;gap:9px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(90,80,65,.06);font-size:12px}.error-row .en{font-weight:700;font-size:13px}.error-row .zh{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.compact-word{padding:10px 12px}.compact-word .word-main{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.compact-word .word-main b{font-size:15px}.compact-word .word-meaning{font-size:13px;color:#55574f}.compact-word .source-tags{margin-top:6px}.type-kind{display:inline-block;margin-bottom:10px;font-size:11px;border:1px solid var(--line);border-radius:999px;padding:4px 8px;color:var(--muted);background:#fffdfa}\n@media(max-width:620px){.study-actions{right:-4px}.study-actions button{padding:7px 4px;font-size:11px}.studyprogress{max-width:60%}.study-word-row{grid-template-columns:1fr .65fr .7fr}.study-word-row .zh{display:none}.error-row{grid-template-columns:.8fr 1.2fr}.error-row .tag{display:none}}\n'''
p.write_text(s)

# ---------- app ----------
p = Path('src/app.js')
s = p.read_text()
if 'function planChecklistHtml(' not in s:
    helper = r'''
function planWordKind(plan,id){return plan?.newIds?.includes(id)?'新词':plan?.reviewIds?.includes(id)?'复习':'其他';}
function planWordBook(plan,id){if(plan?.mode!=='sequential')return'';const seg=(plan.bookSegments||[]).find(x=>(x.newIds||[]).includes(id)||(x.reviewIds||[]).includes(id));return seg?.book||'';}
function planWordMark(plan,id){const w=wordById(id);if(!w)return{label:'已移除',cls:'mark-pending'};if(w.retired||isSimpleLexeme(state,w.en))return{label:'简单',cls:'mark-simple'};const last=latestEventOnDay(state,id,plan.date,'listen');if(!last)return{label:'未开始',cls:'mark-pending'};return last.result==='good'?{label:'已熟悉',cls:'mark-good'}:{label:'待巩固',cls:'mark-bad'};}
function planChecklistHtml(plan,currentId=null){
  const group=(title,ids)=>{const rows=(ids||[]).map((id,index)=>{const w=wordById(id);if(!w)return'';const mark=planWordMark(plan,id),book=planWordBook(plan,id);return`<div class="study-word-row ${id===currentId?'current':''}"><span class="en">${index+1}. ${esc(w.en)}</span><span class="zh">${esc(w.zh||'—')}</span><span class="${mark.cls}">${mark.label}</span><span class="small">${book?esc(book):planWordKind(plan,id)}</span></div>`;}).join('');const done=(ids||[]).filter(id=>['已熟悉','简单'].includes(planWordMark(plan,id).label)).length;return`<div class="study-list-group"><div class="study-list-title"><b>${title}</b><span>${done} / ${(ids||[]).length}</span></div>${rows||'<div class="empty">这一类没有词。</div>'}</div>`;};
  return `<div class="study-list">${group('新词',plan?.newIds||[])}${group('复习词',plan?.reviewIds||[])}</div>`;
}
function typeWordKind(id,date=currentDayKey()){const plan=state.dailyPlans?.[date];if(plan?.newIds?.includes(id))return'新词';if(plan?.reviewIds?.includes(id))return'复习词';return state.events.some(e=>e.wordId===id&&e.date<date)?'复习词':'新词';}
function registerErrorBook(name){const clean=String(name||'').trim();if(!clean)return;state.errorBooks=Array.isArray(state.errorBooks)?state.errorBooks:[];if(!state.errorBooks.includes(clean))state.errorBooks.push(clean);}
function errorBookNames(){const names=new Set(Array.isArray(state.errorBooks)?state.errorBooks:[]);for(const w of state.words)for(const source of w.sources||[])if(/错题|错词|error/i.test(source))names.add(source);return[...names].filter(Boolean).sort((a,b)=>a.localeCompare(b));}
function errorBookSectionHtml(){const books=errorBookNames();if(!books.length)return`<section class="card"><h2 class="section-title">错题本</h2><div class="empty">还没有错题本。句子听写结束后可以把不熟/不认识的词一键加入。</div></section>`;return`<section class="card"><div class="space"><div><h2 class="section-title">错题本</h2><div class="small">默认折叠，只显示名称和词数；展开后用紧凑列表查看。</div></div></div><div class="error-books">${books.map(book=>{const words=state.words.filter(w=>(w.sources||[]).includes(book));const preview=words.slice(0,60).map(w=>`<div class="error-row"><span class="en">${esc(w.en)}</span><span class="zh">${esc(w.zh||'')}</span>${w.retired?'<span class="tag">简单</span>':'<span></span>'}</div>`).join('');return`<details class="error-book"><summary><b>${esc(book)}</b><span class="small">${words.length} 词</span></summary><div class="error-compact">${preview||'<div class="empty">暂无单词</div>'}</div>${words.length>60?`<div class="small" style="padding:8px 0">这里只预览前 60 个；点下面查看全部。</div>`:''}<div class="row" style="padding:9px 0"><button class="soft" data-open-error-book="${esc(book)}">在词库中查看全部</button></div></details>`;}).join('')}</div></section>`;}
'''
    s = replace_once(s, 'function dueCount() { return state.words.filter((w) => !w.retired && (w.card?.reps || 0) && Number(w.card.due) <= Date.now()).length; }\n', 'function dueCount() { return state.words.filter((w) => !w.retired && (w.card?.reps || 0) && Number(w.card.due) <= Date.now()).length; }\n'+helper, 'app helpers')

# Today page: add collapsed full list before settings.
if '<summary>本轮单词清单' not in s:
    needle = "</div>${currentSeg ? `<div class=\"small\" style=\"margin-top:10px\">当前词书：<b>${esc(currentSeg.book)}</b>，完成后自动继续下一本。</div>` : ''}<div class=\"row\" style=\"margin-top:16px\"><button id=\"startListen\""
    repl = "</div>${currentSeg ? `<div class=\"small\" style=\"margin-top:10px\">当前词书：<b>${esc(currentSeg.book)}</b>，完成后自动继续下一本。</div>` : ''}<div class=\"row\" style=\"margin-top:16px\"><button id=\"startListen\""
    if needle not in s:
        raise SystemExit('today anchor not found')
    # insert the list after the start row, using a safer downstream anchor
    anchor = "</span></div><details class=\"details\"><summary>调整今天的计划与词书</summary>"
    s = replace_once(s, anchor, "</span></div><details class=\"details\"><summary>本轮单词清单 · ${prog.newTotal+prog.reviewTotal}</summary><div style=\"margin-top:10px\">${planChecklistHtml(plan)}</div></details><details class=\"details\"><summary>调整今天的计划与词书</summary>", 'today checklist')

# Listening session gets a list toggle and drawer.
s = replace_once(s,
    "listen = { plan, sessionPlan, session, currentEventId: null, result: null, answer: false, activityId: activityId || startActivity('listen', '今日听音', plan.books), historyView: null, segmentBook: sessionPlan.segmentBook || null };",
    "listen = { plan, sessionPlan, session, currentEventId: null, result: null, answer: false, showList: false, activityId: activityId || startActivity('listen', '今日听音', plan.books), historyView: null, segmentBook: sessionPlan.segmentBook || null };",
    'listen session showList')

old_render_listen = re.search(r'function renderListen\(\) \{.*?\n\}\nfunction judgeListen', s, re.S)
if not old_render_listen:
    raise SystemExit('renderListen block not found')
new_render_listen = r'''function renderListen() {
  const w = listenCurrentWord(); if (!w) { listen = null; view = 'today'; renderToday(); return; }
  const p = sessionProgress(state, listen.plan, listen.session); const reviewing = Boolean(listen.historyView); const result = reviewing ? listen.historyView.result : listen.result; const answer = reviewing || listen.answer; const currentId=w.id;
  root.innerHTML = `<main class="immersive"><div class="studytop"><button id="listenBack" class="back">‹</button><div class="studyprogress">${listen.segmentBook ? `${esc(listen.segmentBook)} · ` : ''}新词 ${p.newDone} / ${p.newTotal}　复习 ${p.reviewDone} / ${p.reviewTotal}${p.retry ? `　待巩固 ${p.retry}` : ''}</div><div class="study-actions"><button id="studyListButton">${listen.showList?'收起清单':'本轮清单'}</button>${!reviewing ? '<button id="retireWord">标记简单</button>' : ''}</div></div>${listen.showList?`<section class="study-sheet"><div class="study-sheet-head"><div><b>本轮单词</b><div class="small">新词、复习和每个词当前标记</div></div><button id="closeStudyList" class="soft">关闭</button></div>${planChecklistHtml(listen.plan,currentId)}</section>`:''}<div class="studybody"><div class="type-kind">${planWordKind(listen.plan,w.id)}${planWordBook(listen.plan,w.id)?` · ${esc(planWordBook(listen.plan,w.id))}`:''}</div><button id="speakWord" class="speaker">◖))</button>${answer ? `<div class="word ${result === 'good' ? 'good' : result === 'bad' ? 'bad' : ''}">${esc(w.en)}</div><div class="meaning">${esc(w.zh || '暂无中文释义')}</div>${w.pos || w.def ? `<div class="meta">${esc(w.pos)}${w.def ? ` · ${esc(w.def)}` : ''}</div>` : ''}${w.examples?.length ? `<div class="example">${esc(w.examples[w.examples.length - 1])}</div>` : ''}<div class="source-tags">${(w.sources || []).map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div>` : '<div class="small">听到以后，意思能不能直接出来？</div>'}<div class="judges"><button id="judgeGood" class="goodbtn">1　熟悉</button><button id="judgeBad" class="badbtn">2　不熟悉</button></div>${answer ? `<div class="move"><button id="prevWord" class="soft" ${listen.session.history.length ? '' : 'disabled'}>上一词</button><button id="nextWord" class="primary">${reviewing ? '回到当前词' : '下一词'}</button></div>` : ''}<div class="statusline">${reviewing ? '修改历史判断后会重新计算当天队列和 FSRS 状态。' : '只播放但没判断的词不产生学习记录；退出后会尽量从它继续。'}</div></div></main>`;
  document.getElementById('listenBack').onclick = () => { touchActivity(listen.activityId); persist(); listen = null; view = 'today'; renderToday(); };
  document.getElementById('studyListButton').onclick=()=>{listen.showList=!listen.showList;renderListen();};
  if(document.getElementById('closeStudyList'))document.getElementById('closeStudyList').onclick=()=>{listen.showList=false;renderListen();};
  document.getElementById('speakWord').onclick = () => { speak(w.en); if (!reviewing) touchActivity(listen.activityId); };
  if (!reviewing) document.getElementById('retireWord').onclick = () => { markSimpleLexeme(state, w.en, true); persist(); finishCurrent(listen.session, 'good'); listen.currentEventId = null; listen.result = null; listen.answer = false; advanceListen(); };
  document.getElementById('judgeGood').onclick = () => judgeListen('good'); document.getElementById('judgeBad').onclick = () => judgeListen('bad');
  if (answer) { document.getElementById('prevWord').onclick = () => showPreviousListen(); document.getElementById('nextWord').onclick = () => reviewing ? returnFromHistory() : nextListen(); }
}
function judgeListen'''
s = s[:old_render_listen.start()] + new_render_listen + s[old_render_listen.end():]

# Hand writing: add new/review pools based only on words already heard today.
old_type_preset = re.search(r'function typePreset\(kind\) \{.*?\n\}\nfunction renderType', s, re.S)
if not old_type_preset:
    raise SystemExit('typePreset block not found')
new_type_preset = r'''function typePreset(kind) {
  const candidates = typeCandidates(); const allowed = new Set(candidates.map(w => w.id)); const today = currentDayKey(); const plan=state.dailyPlans?.[today];
  const heard=(ids)=>[...new Set((ids||[]).filter(id=>allowed.has(id)&&latestEventOnDay(state,id,today,'listen')))];
  if (kind === 'todayNew') return heard(plan?.newIds || []);
  if (kind === 'todayReview') return heard(plan?.reviewIds || []);
  if (kind === 'todayListen') return [...new Set(state.events.filter(e => e.date === today && e.mode === 'listen' && e.result === 'bad' && allowed.has(e.wordId)).map(e => e.wordId))];
  if (kind === 'todayType') return [...new Set(state.events.filter(e => e.date === today && e.mode === 'type' && e.result === 'bad' && allowed.has(e.wordId)).map(e => e.wordId))];
  if (kind === 'repeat7') { const bad = eventsSince(7).filter(e => e.result === 'bad' && allowed.has(e.wordId)); return candidates.map(w => ({ id: w.id, ev: bad.filter(e => e.wordId === w.id) })).filter(x => x.ev.length >= 2 || new Set(x.ev.map(e => e.date)).size >= 2).sort((a,b) => b.ev.length-a.ev.length).map(x => x.id); }
  const scored = candidates.map(w => { const ev = state.events.filter(e => e.wordId === w.id); const coldBad = ev.filter(e => e.cold && e.result === 'bad').length; const bad = ev.filter(e => e.result === 'bad').length; const recent = eventsSince(7).filter(e => e.wordId === w.id && e.result === 'bad').length; const r = retrievability(w.card, Date.now(), state.settings.retention); return { id: w.id, score: coldBad * 5 + bad + recent * 1.5 + (w.card?.reps ? (1-r) * 2 : 0) }; }).filter(x => x.score > 0).sort((a,b) => b.score-a.score); return scored.map(x => x.id);
}
function renderType'''
s = s[:old_type_preset.start()] + new_type_preset + s[old_type_preset.end():]

old_render_type = re.search(r'function renderType\(\) \{.*?\n\}\nfunction customTypeIds', s, re.S)
if not old_render_type:
    raise SystemExit('renderType block not found')
new_render_type = r'''function renderType() {
  const books = state.settings.typeBooks || []; const auto = typePreset('auto'), n=typePreset('todayNew'), rv=typePreset('todayReview'), l = typePreset('todayListen'), t = typePreset('todayType'), r = typePreset('repeat7'); const typedToday = new Set(state.events.filter(e => e.date === currentDayKey() && e.mode === 'type').map(e => e.wordId)).size;
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>手打强化</h2><p>新词和复习词分开看；只把今天已经听过的词放进“今日新词/复习”，不会提前泄露还没冷启动的新词。</p></div><span class="tag">${books.length ? `${books.length} 本词书` : '全部词书'}</span></div><div class="grid4" style="margin-top:13px"><div class="statbox"><b>${n.length}</b><span>今日新词可手打</span></div><div class="statbox"><b>${rv.length}</b><span>今日复习可手打</span></div><div class="statbox"><b>${auto.length}</b><span>建议强化</span></div><div class="statbox"><b>${typedToday}</b><span>今日已手打</span></div></div><div class="small" style="margin-top:9px">手打用时 ${activityMinutes('type')} 分钟</div><div class="row" style="margin-top:15px"><button id="typeStartAuto" class="primary">开始建议强化${auto.length ? ` · ${Math.min(30, auto.length)}` : ''}</button></div><details class="details"><summary>词书范围与高级筛选</summary><div style="margin-top:12px">${bookChips(books, 'type')}<div class="filtergrid" style="margin-top:12px"><div class="field"><label>指定日期</label><input id="typeDate" type="date" value="${currentDayKey()}"></div><div class="field"><label>失败来源</label><select id="typeMode"><option value="all">听音 + 手打</option><option value="listen">只看听音</option><option value="type">只看手打</option></select></div><div class="field"><label>至少不熟次数</label><select id="typeMin"><option>1</option><option>2</option><option>3</option><option>5</option></select></div><div class="field"><label>本轮数量</label><select id="typeLimit"><option>20</option><option selected>50</option><option>100</option><option value="0">全部</option></select></div></div><div id="customTypePreview" style="margin-top:12px"></div></div></details></section><section class="card"><h2 class="section-title">按新词 / 复习进入</h2><div class="quick" style="margin-top:12px"><button data-type-preset="todayNew"><span class="num">${n.length}</span><b>今日新词</b><span class="small">今天已经听过的新词</span></button><button data-type-preset="todayReview"><span class="num">${rv.length}</span><b>今日复习词</b><span class="small">今天已经听过的复习词</span></button></div></section><section class="card"><h2 class="section-title">困难词快捷入口</h2><div class="quick" style="margin-top:12px"><button data-type-preset="todayListen"><span class="num">${l.length}</span><b>今日听音不熟</b><span class="small">今天听音阶段暴露出来的词</span></button><button data-type-preset="todayType"><span class="num">${t.length}</span><b>今日手打不熟</b><span class="small">今天手打后仍然卡住</span></button><button data-type-preset="repeat7"><span class="num">${r.length}</span><b>近 7 天反复不熟</b><span class="small">近期重复失败的词</span></button><button data-type-preset="auto"><span class="num">${auto.length}</span><b>全部困难词</b><span class="small">按跨天失败与可提取率排序</span></button></div></section></div>`);
  bindBookChips('type', renderType); document.getElementById('typeStartAuto').onclick = () => startType(auto.slice(0,30), '建议强化'); document.querySelectorAll('[data-type-preset]').forEach(b => b.onclick = () => startType(typePreset(b.dataset.typePreset).slice(0,50), b.dataset.typePreset==='todayNew'?'今日新词':b.dataset.typePreset==='todayReview'?'今日复习词':b.textContent.trim().replace(/\d+/,'').slice(0,20)));
  const inputs = ['typeDate','typeMode','typeMin','typeLimit']; inputs.forEach(id => document.getElementById(id).onchange = renderTypeCustom); renderTypeCustom();
}
function customTypeIds'''
s = s[:old_render_type.start()] + new_render_type + s[old_render_type.end():]

# Add kind to hand-writing card header.
s = replace_once(s, "function renderTypeRun() { const id = typeRun.session.current?.wordId; const w = wordById(id); if (!w) return finishType(); const p = typeProgress(); root.innerHTML =", "function renderTypeRun() { const id = typeRun.session.current?.wordId; const w = wordById(id); if (!w) return finishType(); const p = typeProgress(); const kind=typeWordKind(id); root.innerHTML =", 'type card kind variable')
s = replace_once(s, "${p.done} / ${p.total}${p.bad ? `　待巩固 ${p.bad}` : ''} · ${esc(typeRun.label)}", "${p.done} / ${p.total}${p.bad ? `　待巩固 ${p.bad}` : ''} · ${kind} · ${esc(typeRun.label)}", 'type card kind label')

# Register sentence-generated error books.
s = replace_once(s,
    "function importSentenceProblems(tokens,targetName,sentence){const target=String(targetName||'句子错题本').trim()||'句子错题本';for(const token of tokens)upsertWord({en:token.normalized||token.surface,source:target,example:token.sentence||sentence});persist();toast(`已把 ${tokens.length} 个词加入「${target}」`);}",
    "function importSentenceProblems(tokens,targetName,sentence){const target=String(targetName||'句子错题本').trim()||'句子错题本';registerErrorBook(target);for(const token of tokens)upsertWord({en:token.normalized||token.surface,source:target,example:token.sentence||sentence});persist();toast(`已把 ${tokens.length} 个词加入「${target}」`);}",
    'register sentence error book')

# Library: dedicated foldable error books + compact list.
old_library = re.search(r'function renderLibrary\(\)\{.*?\nfunction drawWordList\(\)\{.*?\nfunction parseWordFile', s, re.S)
if not old_library:
    raise SystemExit('library block not found')
new_library = r'''function renderLibrary(){const books=allBooks(state);shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>词库</h2><p>单词只保存一份；一本词可以同时属于多个词书。</p></div><span class="tag">${state.words.length} 词</span></div><div class="toolbar" style="margin-top:14px"><button id="importWords" class="primary">导入 CSV / TXT</button><button id="backupWords" class="soft">完整备份</button><button id="restoreWords" class="soft">恢复备份</button></div><details class="details"><summary>复习与朗读设置</summary><div class="grid2" style="margin-top:12px"><div class="field"><label>FSRS 期望记忆保持率</label><input id="retention" type="number" min="0.75" max="0.97" step="0.01" value="${state.settings.retention}"></div><div class="field"><label>朗读语速</label><input id="speechRate" type="number" min="0.5" max="1.5" step="0.05" value="${state.settings.speechRate}"></div></div><div class="small" style="margin-top:8px">调度核心：${FSRS_VERSION}。修改保持率会按历史首轮记录重新计算卡片状态。</div></details></section>${errorBookSectionHtml()}<section class="card"><div class="space"><div><h2 class="section-title">全部词库</h2><div class="small">普通列表也改成紧凑显示，避免词多时一屏只能看到几个。</div></div></div><div class="grid2" style="margin-top:12px"><input id="wordSearch" placeholder="搜索单词或释义"><select id="wordBook"><option value="">全部词书</option>${books.map(b=>`<option>${esc(b)}</option>`).join('')}</select></div><div id="wordList" class="list" style="margin-top:12px"></div></section></div>`);document.getElementById('importWords').onclick=()=>importInput.click();document.getElementById('backupWords').onclick=backup;document.getElementById('restoreWords').onclick=()=>restoreInput.click();document.getElementById('wordSearch').oninput=drawWordList;document.getElementById('wordBook').onchange=drawWordList;document.querySelectorAll('[data-open-error-book]').forEach(button=>button.onclick=()=>{document.getElementById('wordBook').value=button.dataset.openErrorBook;drawWordList();document.getElementById('wordList').scrollIntoView({behavior:'smooth',block:'start'});});document.getElementById('retention').onchange=e=>{state.settings.retention=Math.min(.97,Math.max(.75,Number(e.target.value)||.9));rebuildAllCards(state);persist();toast('已按历史记录重新计算 FSRS');renderLibrary();};document.getElementById('speechRate').onchange=e=>{state.settings.speechRate=Math.min(1.5,Math.max(.5,Number(e.target.value)||.92));persist();};drawWordList();}
function drawWordList(){const box=document.getElementById('wordList');if(!box)return;const q=document.getElementById('wordSearch').value.trim().toLowerCase(),book=document.getElementById('wordBook').value;const list=state.words.filter(w=>(!book||w.sources.includes(book))&&(!q||`${w.en} ${w.zh}`.toLowerCase().includes(q))).slice(0,200);box.innerHTML=list.length?list.map(w=>`<div class="listitem compact-word"><div class="space"><div style="min-width:0"><div class="word-main"><b>${esc(w.en)}</b>${w.retired?'<span class="tag">简单</span>':''}<span class="word-meaning">${esc(w.zh||'')}</span></div><div class="source-tags" style="justify-content:flex-start">${w.sources.map(s=>`<span class="tag">${esc(s)}</span>`).join('')}</div></div><button class="soft" data-retire="${w.id}">${w.retired?'恢复':'简单'}</button></div></div>`).join(''):'<div class="empty">没有匹配的词。</div>';document.querySelectorAll('[data-retire]').forEach(b=>b.onclick=()=>{const w=wordById(b.dataset.retire);markSimpleLexeme(state,w.en,!w.retired);persist();drawWordList();});}
function parseWordFile'''
s = s[:old_library.start()] + new_library + s[old_library.end():]

# Imported files with obvious error-book names should show in the dedicated section immediately.
s = replace_once(s, "const [en,zh,pos,def,rowSource,example]=parts;if(!en)continue;upsertWord({en,zh,pos,def,source:rowSource||fileSource,example:example||''});count++;", "const [en,zh,pos,def,rowSource,example]=parts;if(!en)continue;const source=rowSource||fileSource;if(/错题|错词|error/i.test(source))registerErrorBook(source);upsertWord({en,zh,pos,def,source,example:example||''});count++;", 'import error book inference')

p.write_text(s)
print('applied v8 study overview, hand categories and error-book browsing')
