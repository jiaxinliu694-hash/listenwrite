import { wordTextReviewRows, wordTextDuplicateGroups } from './wordtext.js';

export function importCleaningHtml(rows, esc) {
  const cleaned = rows.filter(row => row.cleaned);
  const rejected = rows.filter(row => !row.valid);
  if (!cleaned.length && !rejected.length) return '';
  return `<details class="details" open><summary>词条清洗：${cleaned.length} 行已清理 · ${rejected.length} 行不导入</summary><div class="small">只清理英文边界杂字符，中文释义、词性、来源和例句不做字符删改。无法可靠判断的行会跳过。</div><div class="list">${[...cleaned, ...rejected].slice(0, 80).map(row => `<div class="listitem"><code>${esc(row.originalEn || '（空）')}</code> → ${row.valid ? `<b>${esc(row.en)}</b>` : `<span class="bad">跳过：${esc(row.issue)}</span>`}</div>`).join('')}</div>${cleaned.length + rejected.length > 80 ? '<div class="small">这里只显示前 80 行，清洗规则会应用到全部导入行。</div>' : ''}</details>`;
}

export function wordTextRepairHtml(state, esc) {
  const repaired = Object.values(state.wordTextRepairs || {}).filter(row => row && typeof row === 'object');
  const review = wordTextReviewRows(state);
  const duplicates = wordTextDuplicateGroups(state);
  if (!repaired.length && !review.length) return '';
  return `<section class="card"><h2 class="section-title">词条杂字符修复</h2><p class="small">已清理 ${repaired.length} 项。单词 ID、学习记录、复习卡片和词书归属保持不变；重名词保留各自记录，不自动合并或删除。</p>${repaired.length ? `<details class="details"><summary>查看修改前后</summary><div class="list">${repaired.slice(0, 80).map(row => `<div class="listitem"><code>${esc(row.before)}</code> → <b>${esc(row.after)}</b></div>`).join('')}</div><button id="exportWordTextRepairs" class="soft">导出完整修复记录</button></details>` : ''}${review.length ? `<details class="details"><summary>仍需检查 ${review.length} 项</summary><div class="small">这些原词条没有删除。可在下方词库搜索后处理。</div>${review.slice(0, 40).map(({ word, check }) => `<div class="listitem">${esc(word.en)} · ${esc(check.issue)}</div>`).join('')}</details>` : ''}${duplicates.length ? `<div class="small">清洗后有 ${duplicates.length} 组同名词，已保留全部 ID 和历史，未自动合并。</div>` : ''}</section>`;
}

export function bindWordTextRepair(state, download) {
  const button = document.getElementById('exportWordTextRepairs');
  if (button) button.onclick = () => download('listenwrite-word-text-repairs.json', JSON.stringify(state.wordTextRepairs || {}, null, 2));
}
