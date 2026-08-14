from pathlib import Path
import re

p = Path('src/app.js')
s = p.read_text()

s = s.replace(
"import { allBooks, matchesBooks, ensureDailyPlan, planStatus, todayListeningStats, createRetrySession, pickNext, finishCurrent, sessionProgress, dueForecast } from './queue.js';",
"import { allBooks, matchesBooks, ensureDailyPlan, configureSequentialPlan, convertPlanToMixed, currentSequentialSegment, segmentStatus, planStatus, todayListeningStats, createRetrySession, pickNext, finishCurrent, sessionProgress, dueForecast } from './queue.js';"
)
s = s.replace(
"import { tokenizeEnglish, spellingMatches } from './tokenizer.js';",
"import { tokenizeEnglish, spellingMatches } from './tokenizer.js';\nimport { ensureSentenceBooks, addSentenceEntry, getSentenceEntry, recordSentenceToken, setSentenceTokenStatus, sentenceProblemTokens, allSentenceProblemTokens, problemTokensToTSV } from './sentencebooks.js';"
)

render_today = r'''function renderToday() {
  const date = currentDayKey();
  const books = state.settings.todayBooks || [];
  let plan = ensureDailyPlan(state, planForTodayOptions(date, books));
  if (plan.mode === 'sequential') {
    const existing = new Map((plan.bookSegments || []).map(x => [x.book, x]));
    const chosen = books.map(book => ({ book, newTarget: existing.get(book)?.newTarget ?? 0, reviewTarget: existing.get(book)?.reviewTarget ?? 0 }));
    configureSequentialPlan(state, plan, chosen);
  }
  persist();
  const prog = sessionProgress(state, plan, null);
  const td = todayListeningStats(state, books, date);
  const mins = activityMinutes('listen', date);
  const selectedText = books.length ? books.join('、') : '全部词书';
  const currentSeg = currentSequentialSegment(state, plan);
  const sequentialRows = plan.mode === 'sequential' ? (plan.bookSegments || []).map((seg, i) => {
    const st = segmentStatus(state, plan, seg);
    const nd = st.new.done, rd = st.review.done;
    return `<div class="bookrow" style="grid-template-columns:minmax(90px,1.4fr) 1fr 1fr"><b>${i + 1}. ${esc(seg.book)}${currentSeg?.book === seg.book ? ' · 当前' : ''}</b><label class="small">新词 <input data-seq-new="${i}" type="number" min="0" value="${seg.newTarget}" style="width:78px"> <span>${nd}/${seg.newIds.length}</span></label><label class="small">复习 <input data-seq-review="${i}" type="number" min="0" value="${seg.reviewTarget}" style="width:78px"> <span>${rd}/${seg.reviewIds.length}</span></label></div>`;
  }).join('') : '';
  const bookRows = (books.length ? books : allBooks(state)).map((b) => {
    const x = todayListeningStats(state, [b], date);
    return `<div class="bookrow"><b>${esc(b)}</b><span>${x.newCount} 新</span><span>${x.reviewCount} 复习</span><span class="mobilehide good">${x.firstGood} 熟悉</span><span class="mobilehide bad">${x.firstBad} 不熟</span></div>`;
  }).join('');
  const planControls = plan.mode === 'sequential'
    ? `<div class="small" style="margin:10px 0">按下面顺序一本一本学完。重复词只归前面第一本，不会重复占名额。</div>${sequentialRows || '<div class="empty">先选择至少一本具体词书。</div>'}`
    : `<div class="grid2" style="margin-top:12px"><div class="field"><label>今天新词目标</label><input id="todayNewTarget" type="number" min="0" value="${plan.newTarget}"></div><div class="field"><label>今天复习目标</label><input id="todayReviewTarget" type="number" min="0" value="${plan.reviewTarget}"></div></div>`;
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>今天先完成这一组</h2><div class="small">${esc(selectedText)} · ${studyDayLabel()}</div></div><span class="tag">${plan.mode === 'sequential' ? '分本依次' : '混合'} · FSRS</span></div><div class="plan" style="margin-top:15px"><div class="statbox"><b>${prog.newDone} / ${prog.newTotal}</b><span>新词</span><div class="progressline"><i style="width:${prog.newTotal ? prog.newDone * 100 / prog.newTotal : 0}%"></i></div></div><div class="statbox"><b>${prog.reviewDone} / ${prog.reviewTotal}</b><span>复习</span><div class="progressline"><i style="width:${prog.reviewTotal ? prog.reviewDone * 100 / prog.reviewTotal : 0}%"></i></div></div><div class="statbox"><b class="${prog.retry ? 'bad' : ''}">${prog.retry}</b><span>待巩固</span><div class="small">不增加新词/复习分母</div></div></div>${currentSeg ? `<div class="small" style="margin-top:10px">当前词书：<b>${esc(currentSeg.book)}</b>，完成后自动继续下一本。</div>` : ''}<div class="row" style="margin-top:16px"><button id="startListen" class="primary">${prog.remaining ? '继续今日听音' : '今日已完成'}</button><span class="small">听音 ${mins} 分钟 · 首轮熟悉 ${pct(td.firstGood, td.firstGood + td.firstBad)}</span></div><details class="details"><summary>调整今天的计划与词书</summary><div style="margin-top:12px"><div class="field"><label>学习方式</label><select id="todayPlanMode"><option value="mixed" ${plan.mode === 'mixed' ? 'selected' : ''}>混合学习：多本词书共用一个总量</option><option value="sequential" ${plan.mode === 'sequential' ? 'selected' : ''}>分本依次：一本学完再下一本</option></select></div><div class="small" style="margin:10px 0">降低目标时只裁掉完全没碰过的词；已经听过的词不会被删除。</div>${bookChips(books, 'today')}${planControls}</div></details><details class="details"><summary>以后每天的默认目标</summary><div class="grid2" style="margin-top:12px"><div class="field"><label>以后默认新词</label><input id="defaultNewTarget" type="number" min="0" value="${state.settings.defaultNewTarget}"></div><div class="field"><label>以后默认复习</label><input id="defaultReviewTarget" type="number" min="0" value="${state.settings.defaultReviewTarget}"></div></div><div class="small" style="margin-top:8px">只影响之后新生成的混合计划；分本模式每本单独设置。</div></details></section><section class="card"><h2 class="section-title">今日听音数据</h2><div class="grid4" style="margin-top:13px"><div class="statbox"><b>${td.newCount}</b><span>听音新词</span></div><div class="statbox"><b>${td.reviewCount}</b><span>听音复习</span></div><div class="statbox"><b class="good">${td.firstGood}</b><span>首轮熟悉</span></div><div class="statbox"><b class="bad">${td.firstBad}</b><span>首轮不熟</span></div></div></section><section class="card"><h2 class="section-title">各词书今天的情况</h2><div class="small">只统计听音，不混入手打。</div><div style="margin-top:8px">${bookRows || '<div class="empty">还没有词书。</div>'}</div></section></div>`);

  bindBookChips('today', () => {
    if (plan.mode === 'sequential') {
      const existing = new Map((plan.bookSegments || []).map(x => [x.book, x]));
      configureSequentialPlan(state, plan, (state.settings.todayBooks || []).map(book => ({ book, newTarget: existing.get(book)?.newTarget ?? 0, reviewTarget: existing.get(book)?.reviewTarget ?? 0 })));
      persist();
    }
    renderToday();
  });
  document.getElementById('todayPlanMode').onchange = (e) => {
    if (e.target.value === 'sequential') {
      if (!books.length) { toast('分本依次学习需要先选具体词书'); e.target.value = 'mixed'; return; }
      state.settings.todayPlanMode = 'sequential';
      configureSequentialPlan(state, plan, books.map(book => ({ book, newTarget: 0, reviewTarget: 0 })));
    } else {
      state.settings.todayPlanMode = 'mixed';
      convertPlanToMixed(state, plan, books);
    }
    persist(); renderToday();
  };
  if (plan.mode === 'mixed') {
    document.getElementById('todayNewTarget').onchange = (e) => { const requested = Math.max(0, Number(e.target.value) || 0); const updated = ensureDailyPlan(state, { date, newTarget: requested }); persist(); if (updated.newTarget !== requested) toast(`今天已经做过 ${updated.newTarget} 个新词，目标不能再降`); renderToday(); };
    document.getElementById('todayReviewTarget').onchange = (e) => { const requested = Math.max(0, Number(e.target.value) || 0); const updated = ensureDailyPlan(state, { date, reviewTarget: requested }); persist(); if (updated.reviewTarget !== requested) toast(`今天已经做过 ${updated.reviewTarget} 个复习词，目标不能再降`); renderToday(); };
  } else {
    const saveSegments = () => {
      const configs = (plan.bookSegments || []).map((seg, i) => ({ book: seg.book, newTarget: Math.max(0, Number(document.querySelector(`[data-seq-new="${i}"]`)?.value) || 0), reviewTarget: Math.max(0, Number(document.querySelector(`[data-seq-review="${i}"]`)?.value) || 0) }));
      configureSequentialPlan(state, plan, configs); persist(); renderToday();
    };
    document.querySelectorAll('[data-seq-new],[data-seq-review]').forEach(el => el.onchange = saveSegments);
  }
  document.getElementById('defaultNewTarget').onchange = (e) => { state.settings.defaultNewTarget = Math.max(0, Number(e.target.value) || 0); persist(); toast('已修改以后每天的新词默认值'); };
  document.getElementById('defaultReviewTarget').onchange = (e) => { state.settings.defaultReviewTarget = Math.max(0, Number(e.target.value) || 0); persist(); toast('已修改以后每天的复习默认值'); };
  document.getElementById('startListen').onclick = () => { if (!prog.remaining) return toast('今天这一组已经完成'); startListen(plan); };
}

function planForTodayOptions(date, books) {
  const existing = state.dailyPlans[date];
  if (existing?.mode === 'sequential') return { date };
  return { date, books };
}'''

s, n = re.subn(r"function renderToday\(\) \{.*?\n\}\n\nfunction startListen", lambda m: render_today + "\n\nfunction startListen", s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('renderToday replacement failed')

listen_block = r'''function makeListenPlan(plan) {
  if (plan.mode !== 'sequential') return plan;
  const segment = currentSequentialSegment(state, plan);
  if (!segment) return null;
  return { ...plan, newIds: [...segment.newIds], reviewIds: [...segment.reviewIds], resumeWordId: plan.resumeWordId, segmentBook: segment.book };
}
function startListen(plan, activityId = null) {
  const sessionPlan = makeListenPlan(plan);
  if (!sessionPlan) return toast('今天这一组已经完成');
  const session = createRetrySession(state, sessionPlan, 'listen');
  const id = pickNext(session);
  if (!id) return toast('当前词书已经完成');
  plan.resumeWordId = id; persist();
  listen = { plan, sessionPlan, session, currentEventId: null, result: null, answer: false, activityId: activityId || startActivity('listen', '今日听音', plan.books), historyView: null, segmentBook: sessionPlan.segmentBook || null };
  renderListen(); speak(wordById(id).en);
}
function listenCurrentWord() { const id = listen?.historyView?.wordId || listen?.session.current?.wordId; return wordById(id); }
function renderListen() {
  const w = listenCurrentWord(); if (!w) { listen = null; view = 'today'; renderToday(); return; }
  const p = sessionProgress(state, listen.plan, listen.session); const reviewing = Boolean(listen.historyView); const result = reviewing ? listen.historyView.result : listen.result; const answer = reviewing || listen.answer;
  root.innerHTML = `<main class="immersive"><div class="studytop"><button id="listenBack" class="back">‹</button><div class="studyprogress">${listen.segmentBook ? `${esc(listen.segmentBook)} · ` : ''}新词 ${p.newDone} / ${p.newTotal}　复习 ${p.reviewDone} / ${p.reviewTotal}${p.retry ? `　待巩固 ${p.retry}` : ''}</div>${!reviewing ? '<button id="retireWord" class="retire">退出循环</button>' : ''}</div><div class="studybody"><button id="speakWord" class="speaker">◖))</button>${answer ? `<div class="word ${result === 'good' ? 'good' : result === 'bad' ? 'bad' : ''}">${esc(w.en)}</div><div class="meaning">${esc(w.zh || '暂无中文释义')}</div>${w.pos || w.def ? `<div class="meta">${esc(w.pos)}${w.def ? ` · ${esc(w.def)}` : ''}</div>` : ''}${w.examples?.length ? `<div class="example">${esc(w.examples[w.examples.length - 1])}</div>` : ''}<div class="source-tags">${(w.sources || []).map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div>` : '<div class="small">听到以后，意思能不能直接出来？</div>'}<div class="judges"><button id="judgeGood" class="goodbtn">1　熟悉</button><button id="judgeBad" class="badbtn">2　不熟悉</button></div>${answer ? `<div class="move"><button id="prevWord" class="soft" ${listen.session.history.length ? '' : 'disabled'}>上一词</button><button id="nextWord" class="primary">${reviewing ? '回到当前词' : '下一词'}</button></div>` : ''}<div class="statusline">${reviewing ? '修改历史判断后会重新计算当天队列和 FSRS 状态。' : '只播放但没判断的词不产生学习记录；退出后会尽量从它继续。'}</div></div></main>`;
  document.getElementById('listenBack').onclick = () => { touchActivity(listen.activityId); persist(); listen = null; view = 'today'; renderToday(); };
  document.getElementById('speakWord').onclick = () => { speak(w.en); if (!reviewing) touchActivity(listen.activityId); };
  if (!reviewing) document.getElementById('retireWord').onclick = () => { w.retired = true; persist(); finishCurrent(listen.session, 'good'); listen.currentEventId = null; listen.result = null; listen.answer = false; advanceListen(); };
  document.getElementById('judgeGood').onclick = () => judgeListen('good'); document.getElementById('judgeBad').onclick = () => judgeListen('bad');
  if (answer) { document.getElementById('prevWord').onclick = () => showPreviousListen(); document.getElementById('nextWord').onclick = () => reviewing ? returnFromHistory() : nextListen(); }
}
function judgeListen(result) {
  const w = listenCurrentWord(); if (listen.historyView) { editAttempt(state, listen.historyView.eventId, result); listen.historyView.result = result; persist(); renderListen(); return; }
  if (!listen.currentEventId) { const ev = recordAttempt(state, w, 'listen', result, { date: listen.plan.date }); listen.currentEventId = ev.id; listen.session.current.eventId = ev.id; }
  else editAttempt(state, listen.currentEventId, result);
  listen.result = result; listen.answer = true; touchActivity(listen.activityId); persist(); renderListen();
}
function nextListen() {
  if (!listen.result) return;
  finishCurrent(listen.session, listen.result); listen.currentEventId = null; listen.result = null; listen.answer = false; touchActivity(listen.activityId); advanceListen();
}
function advanceListen() {
  let id = pickNext(listen.session);
  if (id) { listen.plan.resumeWordId = id; persist(); renderListen(); speak(wordById(id).en); return; }
  if (listen.plan.mode === 'sequential' && currentSequentialSegment(state, listen.plan)) {
    const activityId = listen.activityId; const plan = listen.plan; listen = null; startListen(plan, activityId); return;
  }
  listen.plan.resumeWordId = null; persist();
  const p = sessionProgress(state, listen.plan, listen.session);
  root.innerHTML = `<main class="immersive"><div class="studybody"><div class="finish"><div class="small">本轮完成</div><h2>今日听音完成</h2><div class="grid3" style="margin:18px 0"><div class="statbox"><b>${p.newDone}/${p.newTotal}</b><span>新词</span></div><div class="statbox"><b>${p.reviewDone}/${p.reviewTotal}</b><span>复习</span></div><div class="statbox"><b>${p.retry}</b><span>待巩固</span></div></div><button id="finishListen" class="primary">回到今日</button></div></div></main>`;
  document.getElementById('finishListen').onclick = () => { listen = null; view = 'today'; renderToday(); };
}
function showPreviousListen() { const h = listen.session.history[listen.session.history.length - 1]; if (!h?.eventId) return; listen.historyView = { wordId: h.wordId, eventId: h.eventId, result: state.events.find(e => e.id === h.eventId)?.result || h.result }; renderListen(); }
function returnFromHistory() { const plan = ensureDailyPlan(state, { date: listen.plan.date }); const activityId = listen.activityId; listen = null; startListen(plan, activityId); }'''

s, n = re.subn(r"function startListen\(plan\) \{.*?function returnFromHistory\(\) \{.*?\}\n\nfunction typeCandidates", lambda m: listen_block + "\n\nfunction typeCandidates", s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('listen block replacement failed')

text_block = r'''function renderText(){
  if(textReaderId)return renderTextReader();
  ensureSentenceBooks(state);
  const cols=[...new Set(state.texts.map(t=>t.collection||'未分类'))].sort(); const editing=textEditId?state.texts.find(t=>t.id===textEditId):null;
  const sentenceBookNames=state.sentenceBooks.map(b=>b.name);
  const sentenceBookRows=state.sentenceBooks.map(book=>{const problems=allSentenceProblemTokens(book).length;return `<div class="bookrow"><b>${esc(book.name)}</b><span>${book.entries?.length||0} 句</span><span class="bad">${problems} 个错词</span><span class="small">独立于正式词库</span></div>`;}).join('');
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>文本库</h2><p>保存 transcript、文章和句子听写。句子听写先放独立句子词库，不会自动污染正式词库。</p></div><button id="newText" class="primary">${textFormOpen||editing?'收起':'新建文本'}</button></div><div class="grid3" style="margin-top:13px"><div class="statbox"><b>${state.texts.length}</b><span>篇文本</span></div><div class="statbox"><b>${state.sentenceBooks.length}</b><span>个句子词库</span></div><div class="statbox"><b>${state.texts.reduce((n,t)=>n+(t.body.match(/[A-Za-z]+/g)?.length||0),0)}</b><span>英文词量</span></div></div></section><section class="card"><h2 class="section-title">句子拆词听写</h2><div class="small">句子和每个词的熟悉 / 不熟悉 / 不认识标记都会保存到独立句子词库。之后可一键把错词转进普通词书，或导出 TSV。</div><div class="field" style="margin-top:10px"><label>保存到句子词库</label><input id="sentenceBookName" list="sentenceBookNames" value="${esc(sentenceBookNames[0]||'句子词库')}" placeholder="例如：剑18句子"><datalist id="sentenceBookNames">${sentenceBookNames.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></div><textarea id="sentenceDictationText" style="min-height:105px;margin-top:10px" placeholder="The farmers are working in rural areas."></textarea><div class="row" style="margin-top:10px"><label class="small"><input id="sentenceUnique" type="checkbox" style="width:auto"> 去重后听写</label><button id="startSentenceDictation" class="primary">保存并开始听写</button></div><div id="sentencePreview" class="source-tags" style="justify-content:flex-start;margin-top:10px"></div></section>${state.sentenceBooks.length?`<section class="card"><h2 class="section-title">我的句子词库</h2><div class="small">这里保存句子和拆词标记；正式单词库仍保持干净。</div><div style="margin-top:10px">${sentenceBookRows}</div></section>`:''}${textFormOpen||editing?`<section class="card"><h2 class="section-title">${editing?'编辑文本':'新建文本'}</h2><div class="grid2" style="margin-top:12px"><div class="field"><label>标题</label><input id="textTitle" value="${esc(editing?.title||'')}" placeholder="Test 3 Part 4"></div><div class="field"><label>所属文本库</label><input id="textCollection" value="${esc(editing?.collection||'')}" placeholder="剑18"></div></div><textarea id="textBody" style="margin-top:10px" placeholder="粘贴 transcript / 文章正文…">${esc(editing?.body||'')}</textarea><div class="row" style="margin-top:10px"><button id="saveText" class="primary">保存</button><button id="importTextFile" class="soft">导入 TXT</button></div></section>`:''}<section class="card"><div class="space"><div><h2 class="section-title">我的文本</h2><div class="small">按库筛选或搜索标题/正文。</div></div></div><div class="grid2" style="margin-top:12px"><input id="textSearch" placeholder="搜索文本"><select id="textFilter"><option value="">全部文本库</option>${cols.map(c=>`<option>${esc(c)}</option>`).join('')}</select></div><div id="textList" class="list" style="margin-top:12px"></div></section></div>`);
  document.getElementById('newText').onclick=()=>{textFormOpen=!textFormOpen;if(!textFormOpen)textEditId=null;renderText();};
  if(textFormOpen||editing){document.getElementById('saveText').onclick=saveTextItem;document.getElementById('importTextFile').onclick=()=>textInput.click();}
  const sentenceBox=document.getElementById('sentenceDictationText'),unique=document.getElementById('sentenceUnique'),preview=document.getElementById('sentencePreview');
  const drawSentencePreview=()=>{const tokens=tokenizeEnglish(sentenceBox.value,{unique:unique.checked});preview.innerHTML=tokens.slice(0,30).map(x=>`<span class="tag">${esc(x)}</span>`).join('')+(tokens.length>30?`<span class="tag">… 共 ${tokens.length} 个</span>`:'');};
  sentenceBox.oninput=drawSentencePreview; unique.onchange=drawSentencePreview; document.getElementById('startSentenceDictation').onclick=()=>startSentenceDictation(sentenceBox.value,unique.checked,document.getElementById('sentenceBookName').value);
  document.getElementById('textSearch').oninput=drawTextList;document.getElementById('textFilter').onchange=drawTextList;drawTextList();
}
function startSentenceDictation(text,unique,bookName){const tokens=tokenizeEnglish(text,{unique});if(!tokens.length)return toast('这句话里没有识别到英文单词');const saved=addSentenceEntry(state,{bookName:bookName||'句子词库',text,tokens});persist();sentenceRun={bookId:saved.book.id,entryId:saved.entry.id,index:0,input:'',result:null,revealed:false,lookups:0,correct:0};renderSentenceRun();speak(tokens[0]);}
function sentenceRunData(){return getSentenceEntry(state,sentenceRun.bookId,sentenceRun.entryId);}
function renderSentenceRun(){const {book,entry}=sentenceRunData();const token=entry?.tokens?.[sentenceRun.index];if(!book||!entry||!token)return finishSentenceRun();const status=token.status;root.innerHTML=`<main class="immersive"><div class="studytop"><button id="sentenceBack" class="back">‹</button><div class="studyprogress">${sentenceRun.index+1} / ${entry.tokens.length} · ${esc(book.name)}</div></div><div class="studybody"><button id="sentenceSpeak" class="speaker">◖))</button>${!sentenceRun.revealed?`<div class="small">听单词，写出英文拼写。</div><div style="width:100%;max-width:560px;margin-top:18px"><input id="sentenceAnswer" style="font-size:21px;text-align:center" placeholder="输入英文拼写…" autocomplete="off" autocapitalize="off"><div class="grid2" style="margin-top:10px"><button id="sentenceSubmit" class="primary">提交</button><button id="sentenceReveal" class="soft">看答案</button></div></div>`:`<div class="word ${sentenceRun.result==='good'?'good':'bad'}">${esc(token.surface)}</div><div class="typed"><b>你写的是</b><div>${esc(sentenceRun.input||'（直接看答案）')}</div></div><div class="statusline">${sentenceRun.result==='good'?'拼写正确':'已显示正确拼写'} · 再标记你对这个词的真实熟悉度</div><div class="judges" style="grid-template-columns:repeat(3,1fr)"><button id="sentenceFamiliar" class="${status==='familiar'?'goodbtn':'soft'}">熟悉</button><button id="sentenceUnfamiliar" class="${status==='unfamiliar'?'badbtn':'soft'}">不熟悉</button><button id="sentenceUnknown" class="${status==='unknown'?'badbtn':'soft'}">不认识</button></div><div class="move"><button id="sentenceReplay" class="soft">重听</button><button id="sentenceNext" class="primary">下一词</button></div>`}</div></main>`;document.getElementById('sentenceBack').onclick=()=>{persist();sentenceRun=null;view='text';renderText();};document.getElementById('sentenceSpeak').onclick=()=>speak(token.surface);if(!sentenceRun.revealed){const input=document.getElementById('sentenceAnswer');input.value=sentenceRun.input;input.focus();const reveal=(peek)=>{sentenceRun.input=input.value.trim();sentenceRun.result=!peek&&spellingMatches(sentenceRun.input,token.surface)?'good':'bad';if(sentenceRun.result==='good')sentenceRun.correct++;else sentenceRun.lookups++;const defaultStatus=sentenceRun.result==='good'?'familiar':peek?'unknown':'unfamiliar';recordSentenceToken(entry,sentenceRun.index,{input:sentenceRun.input,spellingResult:sentenceRun.result,status:defaultStatus});sentenceRun.revealed=true;persist();renderSentenceRun();};document.getElementById('sentenceSubmit').onclick=()=>{if(!input.value.trim())return toast('没写的话可以点「看答案」');reveal(false);};document.getElementById('sentenceReveal').onclick=()=>reveal(true);input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.value.trim()?reveal(false):reveal(true);}};}else{const mark=(x)=>{setSentenceTokenStatus(entry,sentenceRun.index,x);persist();renderSentenceRun();};document.getElementById('sentenceFamiliar').onclick=()=>mark('familiar');document.getElementById('sentenceUnfamiliar').onclick=()=>mark('unfamiliar');document.getElementById('sentenceUnknown').onclick=()=>mark('unknown');document.getElementById('sentenceReplay').onclick=()=>speak(token.surface);document.getElementById('sentenceNext').onclick=()=>{sentenceRun.index++;sentenceRun.input='';sentenceRun.result=null;sentenceRun.revealed=false;if(sentenceRun.index>=entry.tokens.length)finishSentenceRun();else{renderSentenceRun();speak(entry.tokens[sentenceRun.index].surface);}};}}
function importSentenceProblems(tokens,targetName,sentence){const target=String(targetName||'句子错题本').trim()||'句子错题本';for(const token of tokens)upsertWord({en:token.normalized||token.surface,source:target,example:token.sentence||sentence});persist();toast(`已把 ${tokens.length} 个词加入「${target}」`);}
function finishSentenceRun(){const run=sentenceRun;const {book,entry}=sentenceRunData();const problems=sentenceProblemTokens(entry);root.innerHTML=`<main class="immersive"><div class="studybody"><div class="finish" style="max-width:700px"><div class="small">本轮完成 · 已保存到 ${esc(book?.name||'句子词库')}</div><h2>句子拆词听写</h2><div class="grid3" style="margin:18px 0"><div class="statbox"><b>${entry?.tokens?.length||0}</b><span>单词数</span></div><div class="statbox"><b class="good">${run.correct}</b><span>一次拼对</span></div><div class="statbox"><b class="bad">${problems.length}</b><span>不熟/不认识</span></div></div><div class="field" style="text-align:left"><label>错词转入哪个普通词书</label><input id="sentenceErrorBook" value="句子错题本" placeholder="例如：剑18句子错题本"></div><div class="row" style="justify-content:center;margin-top:12px"><button id="importSentenceBad" class="primary" ${problems.length?'':'disabled'}>一键加入错题本 · ${problems.length}</button><button id="exportSentenceBad" class="soft" ${problems.length?'':'disabled'}>导出 TSV</button><button id="finishSentence" class="soft">返回文本</button></div></div></div></main>`;document.getElementById('importSentenceBad').onclick=()=>importSentenceProblems(problems,document.getElementById('sentenceErrorBook').value,entry.text);document.getElementById('exportSentenceBad').onclick=()=>{const name=document.getElementById('sentenceErrorBook').value.trim()||'句子错题本';download(`${name}-${currentDayKey()}.tsv`,problemTokensToTSV(problems,{source:name,sentence:entry.text}),'text/tab-separated-values;charset=utf-8');};document.getElementById('finishSentence').onclick=()=>{sentenceRun=null;view='text';renderText();};}'''

s, n = re.subn(r"function renderText\(\)\{.*?function finishSentenceRun\(\)\{.*?\}\nfunction drawTextList", lambda m: text_block + "\nfunction drawTextList", s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('text block replacement failed')

old_parse = r"function parseWordFile\(text,name\)\{.*?\}\nfunction backup"
new_parse = r'''function parseWordFile(text,name){const lines=String(text).replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);const fileSource=name.replace(/\.(csv|txt|tsv)$/i,'')||'导入词库';let count=0;for(let i=0;i<lines.length;i++){const sep=lines[i].includes('\t')?'\t':',';const parts=lines[i].split(sep).map(x=>x.trim().replace(/^"|"$/g,''));if(i===0&&/^(en|english|word|单词)$/i.test(parts[0]))continue;const [en,zh,pos,def,rowSource,example]=parts;if(!en)continue;upsertWord({en,zh,pos,def,source:rowSource||fileSource,example:example||''});count++;}persist();toast(`已导入 ${count} 行`);renderLibrary();}
function backup'''
s, n = re.subn(old_parse, lambda m: new_parse, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('parseWordFile replacement failed')

p.write_text(s)
print('applied v6 app changes')
