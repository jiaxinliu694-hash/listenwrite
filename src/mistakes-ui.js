import { addStudyDays } from './studyday.js';
import { spellingMatches } from './tokenizer.js';
import {
  buildMistakeIndex, filterMistakeRows, groupMistakeRows, mistakeSummary, latestMistakeDay,
  selectedMistakeWords, mistakesToCSV, recordVocabularyPractice, editVocabularyPractice, MISTAKE_MODE_LABELS,
} from './mistakes.js';

const UI_KEY = 'listenwrite-mistakes-view-v1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const time = ts => Number(ts) > 0 ? new Date(Number(ts)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—';
const options = (items, selected) => items.map(([value, label]) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`).join('');

export function createMistakesUI(host) {
  let filters = null, selected = new Map(), limit = 80, run = null;
  function remember() {
    try { localStorage.setItem(UI_KEY, JSON.stringify({ filters, selected: [...selected] })); } catch {}
  }
  function initialize(rows) {
    if (filters) return;
    const today = host.today(), date = latestMistakeDay(rows, today, true) || latestMistakeDay(rows, today) || today;
    filters = { from: date, to: date, book: '', mode: '', status: '', query: '' };
    try {
      const saved = JSON.parse(localStorage.getItem(UI_KEY) || 'null');
      if (saved?.filters && typeof saved.filters === 'object') for (const key of Object.keys(filters)) {
        if (typeof saved.filters[key] === 'string') filters[key] = saved.filters[key];
      }
      if (Array.isArray(saved?.selected)) selected = new Map(saved.selected.filter(pair => Array.isArray(pair)
        && typeof pair[0] === 'string' && pair[1] && typeof pair[1] === 'object'));
    } catch {}
  }
  const currentWord = () => (host.state().words || []).find(word => word.id === run?.ids[run.index]);
  function selectRows(rows) {
    for (const row of rows.filter(row => row.selectable)) {
      const previous = selected.get(row.wordId);
      selected.set(row.wordId, { dates: [...new Set([...(previous?.dates || []), row.date])], books: [...new Set([...(previous?.books || []), ...row.books])] });
    }
    remember();
  }
  function updateSelection() {
    document.querySelectorAll('[data-mistake-word]').forEach(box => { box.checked = selected.has(box.dataset.mistakeWord); });
    const panel = document.getElementById('mistakes-page');
    if (panel) panel.dataset.cloudEditing = selected.size ? 'true' : 'false';
    const label = document.getElementById('mistakeSelectedCount');
    if (label) label.textContent = `已选 ${selected.size} 个词（跨日期去重，切换筛选保留选择）`;
    for (const id of ['mistakeListen', 'mistakeSpelling']) {
      const button = document.getElementById(id); if (button) button.disabled = !selected.size;
    }
  }
  function setFilters(patch) { Object.assign(filters, patch); limit = 80; remember(); render(); }
  function render() {
    if (run) return renderRun();
    const state = host.state(), { rows } = buildMistakeIndex(state);
    initialize(rows);
    const existing = new Set((state.words || []).map(word => word.id));
    for (const id of selected.keys()) if (!existing.has(id)) selected.delete(id);
    const filtered = filterMistakeRows(rows, filters), summary = mistakeSummary(filtered);
    const books = [...new Set(rows.flatMap(row => row.books))].sort((a, b) => a.localeCompare(b));
    const byBook = groupMistakeRows(filterMistakeRows(rows, { ...filters, book: '' }), 'book');
    const byDay = groupMistakeRows(filterMistakeRows(rows, { ...filters, from: '', to: '' }), 'date');
    const list = groupMistakeRows(filtered.slice(0, limit), 'date').map(group => `<section class="card mistake-day"><div class="space"><h2 class="section-title">${esc(group.key)}</h2><button class="soft" data-select-day="${esc(group.key)}">勾选这天的筛选结果</button></div>${group.rows.map(row => `<article class="mistake-row"><label class="mistake-word"><input type="checkbox" data-mistake-word="${esc(row.wordId)}" data-mistake-date="${esc(row.date)}" ${selected.has(row.wordId) ? 'checked' : ''} ${row.selectable ? '' : 'disabled'}><span><b>${esc(row.en)}</b><span class="mistake-meaning">${esc(row.zh || '暂无中文')}</span></span></label><div class="row"><span class="tag bad">当天错 ${row.badCount} 次</span><span class="tag ${row.resolved ? 'good' : 'bad'}">${row.resolved ? '最近已答对' : '最近仍错／待复习'}</span>${!row.selectable ? '<span class="tag">原词已删除，不可复习</span>' : ''}</div><div class="small">所属词书：${row.books.map(esc).join('；')}</div>${row.studyBooks.length ? `<div class="small">当时练习：${row.studyBooks.map(esc).join('；')}</div>` : ''}<div class="small">${row.modes.map(mode => MISTAKE_MODE_LABELS[mode]).map(esc).join(' · ')} · 最近判断 ${esc(time(row.latest?.ts))}</div>${row.inferredBooks ? '<div class="small">旧记录未保存当时归属，此处按当前词库补充。</div>' : ''}${row.answers.length ? `<div class="small">曾写成：${row.answers.map(esc).join('；')}</div>` : ''}<details class="details"><summary>查看当天错误记录</summary>${row.failures.map(event => `<div class="small">${esc(time(event.ts))} · ${esc(MISTAKE_MODE_LABELS[event.mode])}${event.input ? ` · 输入：${esc(event.input)}` : ''}</div>`).join('')}</details></article>`).join('')}</section>`).join('');
    host.shell(`<div class="stack" id="mistakes-page"><section class="card hero"><h2>按天、按词书整理错词</h2><p>错过就保留在原日期清单里，后来答对不会抹掉历史。“最近已答对”仅表示相关题型的最新结果，不等于长期掌握。</p><div class="row"><button class="soft" data-mistake-range="today">今天</button><button class="soft" data-mistake-range="yesterday">昨天</button><button class="soft" data-mistake-range="previous">上次错词</button><button class="soft" data-mistake-range="week">近 7 天</button><button class="soft" data-mistake-range="all">全部历史</button></div><div class="filtergrid" style="margin-top:12px"><label class="field">开始日期<input id="mistakeFrom" type="date" value="${esc(filters.from)}"></label><label class="field">结束日期<input id="mistakeTo" type="date" value="${esc(filters.to)}"></label><label class="field">所属词书<select id="mistakeBook">${options([['', '全部词书'], ...books.map(book => [book, book])], filters.book)}</select></label><label class="field">错误来源<select id="mistakeMode">${options([['', '所有模式'], ['listen', '正式听词'], ['type', '中文手打'], ['free', '自由听'], ['review', '错词复习']], filters.mode)}</select></label><label class="field">最近状态<select id="mistakeStatus">${options([['', '全部，包括后来答对的'], ['pending', '最近仍错／待复习'], ['answered', '最近已答对']], filters.status)}</select></label><form id="mistakeSearchForm" class="field"><label for="mistakeQuery">搜索英文或中文</label><div class="row"><input id="mistakeQuery" value="${esc(filters.query)}" placeholder="如 leader / 领导者"><button class="soft" type="submit">搜索</button></div></form></div>${filters.from && filters.to && filters.from > filters.to ? '<p class="bad">开始日期不能晚于结束日期。</p>' : ''}<div class="grid4" style="margin-top:12px"><div class="statbox"><b>${summary.words}</b><span>筛选内去重错词</span></div><div class="statbox"><b>${summary.errors}</b><span>错误次数</span></div><div class="statbox"><b>${summary.days}</b><span>有错词的天数</span></div><div class="statbox"><b>${summary.pending}</b><span>最近仍错词数</span></div></div><details class="details"><summary>统计口径与旧记录说明</summary><p class="small">正式听词和中文手打从已有逐词事件整理。新版开始保存自由听的每次熟悉／不熟悉；旧版自由听没有落盘的错词无法补回。这里统计独立词库，不把整句听写或数据图混算成单词错误。新记录保存作答时的词书归属。一个词可属于多本书，所以各本小计可能重叠，顶部总数和勾选按单词 ID 去重。绿色特别注意仍是附加归属，不强制拆成新单词。</p></details></section><section class="card"><details class="details" open><summary>按词书统计（点击筛选）</summary><div class="row mistake-groups">${byBook.map(group => `<button class="chip ${filters.book === group.key ? 'on' : ''}" data-mistake-book="${esc(group.key)}">${esc(group.key)} · ${group.words} 词 / ${group.errors} 次</button>`).join('') || '<span class="small">当前范围没有错词</span>'}</div></details><details class="details"><summary>按日期统计（最近 30 个错误日；更早可用日期筛选）</summary><div class="row mistake-groups">${byDay.slice(0, 30).map(group => `<button class="chip" data-mistake-day="${esc(group.key)}">${esc(group.key)} · ${group.words} 词 / ${group.errors} 次</button>`).join('')}</div></details></section><section class="card mistake-selection"><b id="mistakeSelectedCount" aria-live="polite"></b><div class="row" style="margin-top:10px"><button id="mistakeSelectAll" class="soft">全选本筛选 · ${summary.words} 词</button><button id="mistakeClear" class="ghost">清空选择</button><button id="mistakeExport" class="soft" ${filtered.length ? '' : 'disabled'}>导出本筛选 CSV</button></div><div class="row" style="margin-top:10px"><button id="mistakeListen" class="primary">听音复习已选</button><button id="mistakeSpelling" class="soft">拼写复习已选</button></div><div class="small">选中后可重复练，不受“今天已通过”限制；不修改 FSRS，不占今日计划名额。刷新会保留筛选和勾选，已提交的复习结果随完整备份和云同步保存。</div></section>${list || '<section class="card empty">这组筛选没有错词。可以选择其他日期或“全部历史”。</section>'}${filtered.length > limit ? `<button id="mistakeMore" class="soft">继续显示 · 剩余 ${filtered.length - limit} 条日期记录</button>` : ''}</div>`);
    for (const [id, key] of [['mistakeFrom','from'], ['mistakeTo','to'], ['mistakeBook','book'], ['mistakeMode','mode'], ['mistakeStatus','status']]) document.getElementById(id).onchange = e => setFilters({ [key]: e.target.value });
    document.getElementById('mistakeSearchForm').onsubmit = e => { e.preventDefault(); setFilters({ query: document.getElementById('mistakeQuery').value.trim() }); };
    document.querySelectorAll('[data-mistake-range]').forEach(button => button.onclick = () => {
      const today = host.today(), range = button.dataset.mistakeRange;
      const previous = latestMistakeDay(filterMistakeRows(rows, { book: filters.book, mode: filters.mode }), today, true)
        || latestMistakeDay(rows, today) || today;
      const from = range === 'today' ? today : range === 'yesterday' ? addStudyDays(today, -1) : range === 'previous' ? previous : range === 'week' ? addStudyDays(today, -6) : '';
      setFilters({ from, to: range === 'all' ? '' : range === 'week' ? today : from });
    });
    document.querySelectorAll('[data-mistake-book]').forEach(button => button.onclick = () => setFilters({ book: button.dataset.mistakeBook }));
    document.querySelectorAll('[data-mistake-day]').forEach(button => button.onclick = () => setFilters({ from: button.dataset.mistakeDay, to: button.dataset.mistakeDay }));
    document.querySelectorAll('[data-select-day]').forEach(button => button.onclick = () => { selectRows(filtered.filter(row => row.date === button.dataset.selectDay)); updateSelection(); });
    document.querySelectorAll('[data-mistake-word]').forEach(box => box.onchange = () => {
      if (box.checked) selectRows(filtered.filter(row => row.wordId === box.dataset.mistakeWord));
      else { selected.delete(box.dataset.mistakeWord); remember(); }
      updateSelection();
    });
    document.getElementById('mistakeSelectAll').onclick = () => { selectRows(filtered); updateSelection(); };
    document.getElementById('mistakeClear').onclick = () => { selected.clear(); remember(); updateSelection(); };
    document.getElementById('mistakeExport').onclick = () => host.download(`listenwrite-mistakes-${filters.from || 'all'}-${filters.to || 'all'}.csv`, mistakesToCSV(filtered), 'text/csv;charset=utf-8');
    document.getElementById('mistakeListen').onclick = () => startReview('review-listen');
    document.getElementById('mistakeSpelling').onclick = () => startReview('review-spelling');
    const more = document.getElementById('mistakeMore'); if (more) more.onclick = () => { limit += 80; render(); };
    updateSelection();
  }
  function startReview(mode, ids = [...selected.keys()]) {
    const words = selectedMistakeWords(host.state(), ids);
    if (!words.length) return host.toast('先勾选需要复习的词');
    run = { mode, ids: words.map(word => word.id), index: 0, input: '', event: null, outcomes: new Map(), skipped: 0,
      sessionId: `mr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
      activityId: host.startActivity('mistake', mode === 'review-listen' ? '错词听音复习' : '错词拼写复习', []) };
    renderRun(); host.speak(words[0].en);
  }
  function judge(result) {
    const word = currentWord(); if (!word || run.done) return;
    if (run.event) editVocabularyPractice(host.state(), run.event.id, result);
    else run.event = recordVocabularyPractice(host.state(), word, run.mode, result, {
      date: host.today(), input: run.input, sessionId: run.sessionId, sourceDates: selected.get(word.id)?.dates || [],
    });
    run.outcomes.set(word.id, result);
    host.touchActivity(run.activityId); host.persist(); renderRun();
  }
  function next(skip = false) {
    if (!run || run.done || (!run.event && !skip)) return;
    if (skip && !run.event) run.skipped++;
    run.index++; run.event = null; run.input = '';
    if (run.index >= run.ids.length) { run.done = true; host.finishActivity(run.activityId); }
    renderRun(); const word = currentWord(); if (word && !run.done) host.speak(word.en);
  }
  function exit() {
    if (run && !run.done) host.finishActivity(run.activityId);
    run = null; host.stopSpeech(); render();
  }
  function renderRun() {
    if (!run) return render();
    if (run.done) {
      const wrong = [...run.outcomes].filter(([, result]) => result === 'bad').map(([id]) => id);
      host.root.innerHTML = `<main class="immersive"><div class="studybody"><div class="finish"><h2>这轮错词复习完成</h2><p>答对 ${run.outcomes.size - wrong.length} · 仍错 ${wrong.length} · 跳过 ${run.skipped}</p><p class="small">每次判断已保存；原来日期的错词清单仍在，不改 FSRS 或今日计划。</p><div class="row"><button id="mistakeRunBack" class="primary">返回错词清单</button>${wrong.length ? '<button id="mistakeRetry" class="soft">再练本轮错词</button>' : ''}</div></div></div></main>`;
      document.getElementById('mistakeRunBack').onclick = exit;
      const retry = document.getElementById('mistakeRetry'); if (retry) retry.onclick = () => startReview(run.mode, wrong);
      return;
    }
    const word = currentWord(); if (!word) return next(true);
    const spelling = run.mode === 'review-spelling', revealed = Boolean(run.event);
    host.root.innerHTML = `<main class="immersive"><div class="studytop"><button id="mistakeRunBack" class="back" aria-label="返回错词清单">‹</button><div class="studyprogress">${spelling ? '错词拼写' : '错词听音'} · ${run.index + 1}/${run.ids.length}</div></div><div class="studybody"><div class="small">只练已选错词，不影响 FSRS 和今日名额</div><button id="mistakeSpeak" class="speaker" aria-label="重听">◖))</button>${revealed ? `<div class="word ${run.event.result === 'good' ? 'good' : 'bad'}">${esc(word.en)}</div><div class="meaning">${esc(word.zh || '暂无中文')}</div>${spelling ? `<div class="typed"><b>你的输入</b><div>${esc(run.input || '（空白）')}</div></div>` : ''}<div class="source-tags">${(word.sources || []).map(book => `<span class="tag">${esc(book)}</span>`).join('')}</div><div class="row" style="margin-top:16px"><button id="mistakeRejudge" class="soft">${run.event.result === 'good' ? '改判错误' : '改判正确'}</button><button id="mistakeNext" class="primary">下一词</button></div>` : spelling ? `<form id="mistakeAnswerForm" class="mistake-answer"><label for="mistakeAnswer">输入听到的英文单词或词组</label><input id="mistakeAnswer" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(run.input)}"><button class="primary" type="submit">检查拼写</button></form>` : '<p>听到声音，意思能直接出来吗？</p><div class="judges"><button id="mistakeGood" class="goodbtn">熟悉</button><button id="mistakeBad" class="badbtn">不熟悉</button></div>'}${!revealed ? '<button id="mistakeSkip" class="ghost">跳过，不计错误</button>' : ''}</div></main>`;
    host.mountTimer(run.activityId);
    document.getElementById('mistakeRunBack').onclick = exit;
    document.getElementById('mistakeSpeak').onclick = () => host.speak(word.en);
    if (revealed) {
      document.getElementById('mistakeRejudge').onclick = () => judge(run.event.result === 'good' ? 'bad' : 'good');
      document.getElementById('mistakeNext').onclick = () => next();
    } else {
      document.getElementById('mistakeSkip').onclick = () => next(true);
      if (spelling) {
        const input = document.getElementById('mistakeAnswer'); input.oninput = () => { run.input = input.value; };
        document.getElementById('mistakeAnswerForm').onsubmit = e => { e.preventDefault(); run.input = input.value; judge(spellingMatches(run.input, word.en) ? 'good' : 'bad'); };
        input.focus();
      } else {
        document.getElementById('mistakeGood').onclick = () => judge('good');
        document.getElementById('mistakeBad').onclick = () => judge('bad');
      }
    }
  }
  function handleKeydown(event) {
    if (!run || run.done || event.isComposing || event.repeat || ['INPUT','TEXTAREA'].includes(event.target?.tagName)) return;
    if (event.key === 'Enter' && run.event) { event.preventDefault(); next(); }
    else if (run.mode === 'review-listen' && ['1','2'].includes(event.key)) { event.preventDefault(); judge(event.key === '1' ? 'good' : 'bad'); }
  }
  return { render, handleKeydown, isActive: () => Boolean(run), activeActivityId: () => run && !run.done ? run.activityId : null,
    reset() { run = null; filters = null; selected = new Map(); } };
}
