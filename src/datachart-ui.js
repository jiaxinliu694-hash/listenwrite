import {
  dataChartSections,
  dataChartSectionById,
  dataChartItemById,
  dataChartItemProgress,
  dataChartItemLabel,
  dataChartSectionProgress,
  dataChartWeakItemIds,
  dataChartLearnedSectionIds,
  nextDataChartLearningSection,
  dataChartDailySummary,
  chooseDataChartReviewSections,
  createDataChartSession,
  gradeDataChartSession,
  dataChartSessionProgress,
  clearDataChartSession,
} from './datachart.js';
import { DATA_CHART_SEED } from './datachart-seed.js';

export function createDataChartUI(deps) {
  const {
    getState,
    root,
    shell,
    persist,
    toast,
    esc,
    speak,
    startActivity,
    touchActivity,
    finishActivity,
    activityMinutes,
    mountStudyTimer,
    currentDayKey,
  } = deps;

  let browseHome = true;
  let reveal = false;
  let pickerOpen = false;
  let pickedSections = new Set();

  const dc = () => getState().dataChart;
  const sections = () => dataChartSections(DATA_CHART_SEED);

  function activeActivityId() {
    const session = dc()?.session;
    return session && !session.completedAt ? session.activityId || null : null;
  }

  function sessionTitle(session) {
    if (session?.label) return session.label;
    if (session?.mode === 'learn') return '小节学习';
    if (session?.mode === 'weak') return '强化中';
    if (session?.mode === 'mix') return '已学范围混排';
    return '小节复习';
  }

  function formatSectionLabel(section) {
    return `${section.code} ${section.title}`;
  }

  function ttsText(item) {
    if (item.example) return item.example;
    return String(item.answer || '')
      .replace(/\s*\/\s*/g, ', ')
      .replace(/\s*\+\s*[A-Z][A-Z _/-]*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function startSession(options) {
    const current = dc().session;
    if (current && !current.completedAt) {
      const ok = confirm('当前还有一轮没有做完。开始新一轮会结束当前会话，但已经点过的“会 / 不会”记录都会保留。继续吗？');
      if (!ok) return;
      if (current.activityId) finishActivity(current.activityId);
      clearDataChartSession(dc());
    }
    const session = createDataChartSession(dc(), DATA_CHART_SEED, {
      ...options,
      date: currentDayKey(),
      now: Date.now(),
    });
    if (!session.itemIds.length || !session.currentId) {
      clearDataChartSession(dc());
      persist();
      toast(options.mode === 'weak' ? '当前没有强化中的条目' : '这组没有需要练的条目');
      return;
    }
    session.activityId = startActivity('datachart', options.label || '数据图', []);
    reveal = false;
    browseHome = false;
    persist();
    renderSession();
  }

  function startLearnSection(sectionId) {
    const section = dataChartSectionById(DATA_CHART_SEED, sectionId);
    if (!section) return;
    const meta = dataChartSectionProgress(dc(), section);
    if (meta.completedAt && meta.unseen === 0) {
      startSession({ mode: 'review', sectionIds: [sectionId], label: `${formatSectionLabel(section)} · 复习` });
    } else {
      startSession({ mode: 'learn', sectionIds: [sectionId], label: `${formatSectionLabel(section)} · ${meta.completedAt ? '补学' : '学习'}` });
    }
  }

  function startNextLearning() {
    const section = nextDataChartLearningSection(dc(), DATA_CHART_SEED);
    if (!section) return toast('所有小节都已经学过了');
    startLearnSection(section.id);
  }

  function startDailyReview() {
    const day = dataChartDailySummary(dc(), currentDayKey());
    const target = Math.max(0, Number(dc().settings.dailyReviewSections) || 0);
    const remaining = Math.max(0, target - day.reviewed);
    if (!remaining) return toast('今天的复习小节目标已经完成，可以用“按小节复习”继续加练');
    const chosen = chooseDataChartReviewSections(dc(), DATA_CHART_SEED, remaining, currentDayKey());
    if (!chosen.length) return toast('还没有已经学过、可安排复习的小节');
    startSession({ mode: 'review', sectionIds: chosen, label: `今日复习 · ${chosen.length} 节` });
  }

  function startWeak() {
    const ids = dataChartWeakItemIds(dc(), DATA_CHART_SEED);
    if (!ids.length) return toast('当前没有强化中的条目');
    startSession({ mode: 'weak', itemIds: ids, label: `强化中 · ${ids.length} 条` });
  }

  function startMixed() {
    const learned = dataChartLearnedSectionIds(dc(), DATA_CHART_SEED);
    if (!learned.length) return toast('先完成至少一个小节');
    const limit = Number(dc().settings.mixedLimit) || 0;
    startSession({ mode: 'mix', sectionIds: learned, limit, label: `已学范围混排${limit ? ` · ${limit} 条` : ''}` });
  }

  function startPickedReview() {
    const learned = new Set(dataChartLearnedSectionIds(dc(), DATA_CHART_SEED));
    const ids = [...pickedSections].filter(id => learned.has(id));
    if (!ids.length) return toast('先选择至少一个已经学过的小节');
    startSession({ mode: 'review', sectionIds: ids, label: `自选小节复习 · ${ids.length} 节` });
  }

  function pickerHtml() {
    if (!pickerOpen) return '';
    const learned = new Set(dataChartLearnedSectionIds(dc(), DATA_CHART_SEED));
    const rows = sections().filter(section => learned.has(section.id));
    return `<section class="card dc-picker"><div class="space"><div><h2 class="section-title">按小节复习</h2><div class="small">选中的小节会合在一起随机出现。</div></div><button id="dcClosePicker" class="ghost">收起</button></div><div class="dc-checklist">${rows.map(section => `<label><input type="checkbox" data-dc-pick="${esc(section.id)}" ${pickedSections.has(section.id) ? 'checked' : ''}> <span>${esc(formatSectionLabel(section))}</span></label>`).join('') || '<div class="empty">还没有学过的小节。</div>'}</div><div class="row" style="margin-top:12px"><button id="dcStartPicked" class="primary" ${rows.length ? '' : 'disabled'}>开始混排 · ${pickedSections.size} 节</button><button id="dcPickAll" class="soft" ${rows.length ? '' : 'disabled'}>全选已学</button><button id="dcPickNone" class="ghost">清空</button></div></section>`;
  }

  function sectionListHtml() {
    return (DATA_CHART_SEED.chapters || []).map(chapter => {
      const rows = (chapter.sections || []).map(section => {
        const p = dataChartSectionProgress(dc(), section);
        const learned = Boolean(p.completedAt);
        const status = learned
          ? (p.unseen ? `已学 · 新增 ${p.unseen} 条未学${p.reinforcing ? ` · 强化 ${p.reinforcing}` : ''}` : (p.reinforcing ? `已学 · 强化 ${p.reinforcing}` : '已学'))
          : p.mastered || p.reinforcing ? `学习中 · ${p.mastered}/${p.total}` : '未学';
        const action = learned ? (p.unseen ? '补学' : '复习') : (p.mastered || p.reinforcing ? '继续' : '学习');
        return `<div class="dc-section-row"><div class="dc-section-main"><b>${esc(formatSectionLabel(section))}</b><span class="small">${status}${p.reinforcing ? ` · ${p.reinforcing} 条 3/3` : ''}</span><div class="progressline"><i style="width:${p.total ? (p.mastered * 100 / p.total) : 0}%"></i></div></div><button class="soft" data-dc-section="${esc(section.id)}">${action}</button></div>`;
      }).join('');
      return `<details class="dc-chapter" ${chapter.num === '01' ? 'open' : ''}><summary><b>${esc(chapter.num)} ${esc(chapter.title)}</b><span class="small">${chapter.sections.length} 小节</span></summary><div class="dc-section-list">${rows}</div></details>`;
    }).join('');
  }

  function renderHome() {
    browseHome = true;
    const date = currentDayKey();
    const day = dataChartDailySummary(dc(), date);
    const all = sections();
    const learned = dataChartLearnedSectionIds(dc(), DATA_CHART_SEED);
    const weak = dataChartWeakItemIds(dc(), DATA_CHART_SEED);
    const next = nextDataChartLearningSection(dc(), DATA_CHART_SEED);
    const session = dc().session;
    const learnTarget = Math.max(0, Number(dc().settings.dailyLearnSections) || 0);
    const reviewTarget = Math.max(0, Number(dc().settings.dailyReviewSections) || 0);
    const sessionCard = session && !session.completedAt
      ? `<section class="card dc-resume"><div class="space"><div><b>本轮还没做完</b><div class="small">${esc(sessionTitle(session))} · 进度会一直保留</div></div><button id="dcResume" class="primary">继续本轮</button></div></section>`
      : session?.completedAt
        ? `<section class="card dc-resume"><div class="space"><div><b>上一轮已经完成</b><div class="small">${esc(sessionTitle(session))}</div></div><button id="dcViewFinish" class="soft">查看结果</button></div></section>`
        : '';
    shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>数据图</h2><p>按原资料小节背表达：看中文 → 自己回忆 → 揭晓 → 会 / 不会。第一次会就通过；点过不会后要连续会 3 次。</p></div><span class="tag">${all.length} 小节</span></div><div class="grid4 dc-summary" style="margin-top:14px"><div class="statbox"><b>${day.learned} / ${learnTarget}</b><span>今日新学小节</span></div><div class="statbox"><b>${day.reviewed} / ${reviewTarget}</b><span>今日复习小节</span></div><div class="statbox"><b>${learned.length} / ${all.length}</b><span>已学小节</span></div><div class="statbox"><b class="${weak.length ? 'bad' : ''}">${weak.length}</b><span>强化中条目</span></div></div><div class="small" style="margin-top:10px">今日数据图 ${activityMinutes('datachart', date)} 分钟 · 教材版本 ${esc(DATA_CHART_SEED.contentVersion || '内置')}</div><div class="row" style="margin-top:14px"><button id="dcContinueLearn" class="primary">${next ? `继续学习 · ${esc(next.code)}` : '全部小节已学'}</button><button id="dcDailyReview" class="soft">继续今日复习</button></div></section>${sessionCard}<section class="card"><h2 class="section-title">复习入口</h2><div class="quick" style="margin-top:12px"><button id="dcBySection"><span class="num">${learned.length}</span><b>按小节复习</b><span class="small">自己选多个已学小节，合并打乱</span></button><button id="dcWeak"><span class="num">${weak.length}</span><b>强化中</b><span class="small">只刷 0/3、1/3、2/3</span></button><button id="dcMixed"><span class="num">${dc().settings.mixedLimit || '全'}</span><b>已学范围混排</b><span class="small">从所有已学小节随机抽一轮</span></button></div></section>${pickerHtml()}<section class="card"><details class="details"><summary>每日目标与混排数量</summary><div class="grid3" style="margin-top:12px"><div class="field"><label>每天新学小节</label><input id="dcLearnTarget" type="number" min="0" max="10" value="${dc().settings.dailyLearnSections}"></div><div class="field"><label>每天复习小节</label><input id="dcReviewTarget" type="number" min="0" max="20" value="${dc().settings.dailyReviewSections}"></div><div class="field"><label>已学混排每轮</label><select id="dcMixedLimit"><option value="20" ${dc().settings.mixedLimit===20?'selected':''}>20 条</option><option value="40" ${dc().settings.mixedLimit===40?'selected':''}>40 条</option><option value="60" ${dc().settings.mixedLimit===60?'selected':''}>60 条</option><option value="0" ${dc().settings.mixedLimit===0?'selected':''}>全部</option></select></div></div><div class="small" style="margin-top:9px">目标只是每天的绩效参考，不会锁住你继续学。教材文字和学习进度分开保存；以后改英文答案，只要同一条目的 ID 不变，原来的会/不会和 3/3 进度都会保留。</div></details></section><section class="card"><div class="space"><div><h2 class="section-title">全部小节</h2><div class="small">学习按资料顺序推进，也可以自由点开任意小节。</div></div></div><div class="dc-curriculum" style="margin-top:12px">${sectionListHtml()}</div></section></div>`);

    const learnBtn = document.getElementById('dcContinueLearn');
    learnBtn.disabled = !next;
    learnBtn.onclick = startNextLearning;
    document.getElementById('dcDailyReview').onclick = startDailyReview;
    document.getElementById('dcBySection').onclick = () => { pickerOpen = !pickerOpen; renderHome(); };
    document.getElementById('dcWeak').onclick = startWeak;
    document.getElementById('dcMixed').onclick = startMixed;
    if (document.getElementById('dcResume')) document.getElementById('dcResume').onclick = () => { browseHome = false; reveal = false; renderSession(); };
    if (document.getElementById('dcViewFinish')) document.getElementById('dcViewFinish').onclick = () => { browseHome = false; renderFinish(); };
    if (document.getElementById('dcClosePicker')) document.getElementById('dcClosePicker').onclick = () => { pickerOpen = false; renderHome(); };
    document.querySelectorAll('[data-dc-pick]').forEach(input => input.onchange = () => {
      input.checked ? pickedSections.add(input.dataset.dcPick) : pickedSections.delete(input.dataset.dcPick);
      const b = document.getElementById('dcStartPicked'); if (b) b.textContent = `开始混排 · ${pickedSections.size} 节`;
    });
    if (document.getElementById('dcStartPicked')) document.getElementById('dcStartPicked').onclick = startPickedReview;
    if (document.getElementById('dcPickAll')) document.getElementById('dcPickAll').onclick = () => { pickedSections = new Set(learned); renderHome(); };
    if (document.getElementById('dcPickNone')) document.getElementById('dcPickNone').onclick = () => { pickedSections.clear(); renderHome(); };
    document.querySelectorAll('[data-dc-section]').forEach(button => button.onclick = () => startLearnSection(button.dataset.dcSection));
    document.getElementById('dcLearnTarget').onchange = e => { dc().settings.dailyLearnSections = Math.min(10, Math.max(0, Number(e.target.value) || 0)); persist(); renderHome(); };
    document.getElementById('dcReviewTarget').onchange = e => { dc().settings.dailyReviewSections = Math.min(20, Math.max(0, Number(e.target.value) || 0)); persist(); renderHome(); };
    document.getElementById('dcMixedLimit').onchange = e => { dc().settings.mixedLimit = Number(e.target.value) || 0; persist(); renderHome(); };
  }

  function renderSession() {
    const session = dc().session;
    if (!session) { browseHome = true; return renderHome(); }
    if (session.completedAt) return renderFinish();
    const ref = dataChartItemById(DATA_CHART_SEED, session.currentId);
    if (!ref) { toast('当前条目已从教材中移除，已跳过'); browseHome = true; return renderHome(); }
    const { item, section } = ref;
    const p = dataChartSessionProgress(dc());
    const itemState = dataChartItemProgress(dc(), item.id);
    const stateLabel = itemState.status === 'reinforcing' ? dataChartItemLabel(dc(), item.id) : '';
    const detail = reveal
      ? `<div class="dc-answer">${esc(item.answer || '')}</div>${item.kind === 'adjadv' && (item.adj || item.adv) ? `<div class="dc-pairs">${item.adj ? `<span>形容词 · ${esc(item.adj)}</span>` : ''}${item.adv ? `<span>副词 · ${esc(item.adv === '—' ? '无' : item.adv)}</span>` : ''}</div>` : ''}${item.note ? `<div class="dc-note">${esc(item.note)}</div>` : ''}${item.example ? `<div class="example">${esc(item.example)}</div>` : ''}<div class="row dc-audio-row"><button id="dcSpeak" class="soft">🔊 ${item.example ? '听极短例' : '听答案'}</button></div><div class="judges"><button id="dcGood" class="goodbtn">1　会</button><button id="dcBad" class="badbtn">2　不会</button></div>`
      : `<div class="dc-cue">${esc(item.cue || '')}</div><button id="dcReveal" class="primary dc-reveal">揭晓答案</button><div class="small">先自己调出英文；不需要输入整串答案。</div>`;
    root.innerHTML = `<main class="immersive"><div class="studytop"><button id="dcBack" class="back">‹</button><div class="studyprogress">${esc(sessionTitle(session))}<br><span class="small">已见 ${p.seen} / ${p.total}${p.reinforcing ? ` · 强化 ${p.reinforcing}` : ''}</span></div></div><div class="studybody dc-studybody"><div class="source-tags"><span class="tag">${esc(formatSectionLabel(section))}</span>${item.tag ? `<span class="tag">${esc(item.tag)}</span>` : ''}${stateLabel ? `<span class="tag dc-reinforce">${esc(stateLabel)}</span>` : ''}</div>${detail}</div></main>`;
    mountStudyTimer(session.activityId);
    document.getElementById('dcBack').onclick = () => { touchActivity(session.activityId); persist(); browseHome = true; reveal = false; renderHome(); };
    if (!reveal) document.getElementById('dcReveal').onclick = () => { reveal = true; touchActivity(session.activityId); renderSession(); };
    else {
      document.getElementById('dcSpeak').onclick = () => { speak(ttsText(item)); touchActivity(session.activityId); };
      document.getElementById('dcGood').onclick = () => grade('good');
      document.getElementById('dcBad').onclick = () => grade('bad');
    }
  }

  function grade(result) {
    const session = dc().session;
    if (!session || !reveal) return;
    gradeDataChartSession(dc(), DATA_CHART_SEED, result, { date: currentDayKey(), ts: Date.now() });
    touchActivity(session.activityId);
    persist();
    reveal = false;
    if (session.completedAt) {
      finishActivity(session.activityId);
      persist();
      renderFinish();
    } else renderSession();
  }

  function renderFinish() {
    const session = dc().session;
    if (!session) { browseHome = true; return renderHome(); }
    const p = dataChartSessionProgress(dc());
    root.innerHTML = `<main class="immersive"><div class="studybody"><div class="finish dc-finish"><div class="small">本轮完成</div><h2>${esc(sessionTitle(session))}</h2><div class="grid3" style="margin:18px 0"><div class="statbox"><b>${p.total}</b><span>本轮条目</span></div><div class="statbox"><b class="good">${p.good}</b><span>点“会”</span></div><div class="statbox"><b class="bad">${p.bad}</b><span>点“不会”</span></div></div><div class="small">点过“不会”的条目只有连续 3 次“会”才会退出强化。</div><button id="dcFinishBack" class="primary" style="margin-top:18px">返回数据图</button></div></div></main>`;
    document.getElementById('dcFinishBack').onclick = () => { clearDataChartSession(dc()); persist(); browseHome = true; reveal = false; renderHome(); };
  }

  function handleKeydown(e) {
    if (browseHome || !dc().session || dc().session.completedAt) return false;
    if (!reveal && e.key === 'Enter') { e.preventDefault(); reveal = true; touchActivity(dc().session.activityId); renderSession(); return true; }
    if (reveal && e.key === '1') { e.preventDefault(); grade('good'); return true; }
    if (reveal && e.key === '2') { e.preventDefault(); grade('bad'); return true; }
    return false;
  }

  function render() {
    if (browseHome) return renderHome();
    const session = dc().session;
    if (!session) { browseHome = true; return renderHome(); }
    return session.completedAt ? renderFinish() : renderSession();
  }

  function resetToHome() {
    browseHome = true;
    reveal = false;
  }

  return { render, renderHome, activeActivityId, handleKeydown, resetToHome };
}
