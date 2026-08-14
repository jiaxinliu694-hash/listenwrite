import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,text){fs.writeFileSync(path,text);}
function replace(path,before,after){const text=read(path);if(!text.includes(before))throw new Error(`pattern not found: ${path}`);write(path,text.replace(before,after));}

// Preserve already-earned real-card spacing when a session is closed/reopened.
replace('src/queue.js', `export function createRetrySession(state, plan, mode = 'listen', explicitIds = null) {\n  const planIds = [...new Set(explicitIds || [...plan.reviewIds, ...plan.newIds])];`, `function persistedInterveningTurns(state, wordId, date, mode, afterTs = 0) {\n  return (state.events || []).filter((e) =>\n    e.date === date &&\n    e.mode === mode &&\n    e.wordId !== wordId &&\n    Number(e.ts || 0) > Number(afterTs || 0)\n  ).length;\n}\n\nexport function createRetrySession(state, plan, mode = 'listen', explicitIds = null) {\n  const planIds = [...new Set(explicitIds || [...plan.reviewIds, ...plan.newIds])];`);
replace('src/queue.js', `    else if (reinforce.passed) completedIds.push(id);\n    else retry.push({ wordId:id, attempt:events.length, eligibleTurn:reinforcementGapWords(events), addedTurn:0 });`, `    else if (reinforce.passed) completedIds.push(id);\n    else {\n      const requiredGap = reinforcementGapWords(events);\n      const earnedGap = persistedInterveningTurns(state, id, plan.date, mode, reinforce.last?.ts);\n      retry.push({\n        wordId:id,\n        attempt:events.length,\n        eligibleTurn:Math.max(0, requiredGap - earnedGap),\n        addedTurn:0,\n      });\n    }`);

// Make unavoidable short-tail retries visibly different from a fully spaced retry.
let app=read('src/app.js');
const listenNeedle = '  const p = sessionProgress(state, listen.plan, listen.session); const reviewing = Boolean(listen.historyView); const result = reviewing ? listen.historyView.result : listen.result; const answer = reviewing || listen.answer; const currentId=w.id;\n  root.innerHTML = `<main class="immersive">';
const listenReplace = '  const p = sessionProgress(state, listen.plan, listen.session); const reviewing = Boolean(listen.historyView); const result = reviewing ? listen.historyView.result : listen.result; const answer = reviewing || listen.answer; const currentId=w.id;\n  const gapShortfall=!reviewing?Number(listen.session.current?.gapShortfall||0):0;\n  const gapNotice=gapShortfall?\'<div class="statusline">队列已到尾部，可用间隔词不足，还差约 \'+gapShortfall+\' 个；这次仍要你重新判断，不会自动算通过。</div>\':\'\';\n  root.innerHTML = `<main class="immersive">';
if(!app.includes(listenNeedle))throw new Error('listen render insertion not found');
app=app.replace(listenNeedle,listenReplace);
const listenStatus = '<div class="statusline">${reviewing ? \'修改历史判断后会重新计算当天队列和 FSRS 状态。\' : \'只播放但没判断的词不产生学习记录；退出后会尽量从它继续。\'}</div></div></main>`;';
if(!app.includes(listenStatus))throw new Error('listen status insertion not found');
app=app.replace(listenStatus, '${gapNotice}'+listenStatus);

const typeNeedle='function renderTypeRun() { const id = typeRun.session.current?.wordId; const w = wordById(id); if (!w) return finishType(); const p = typeProgress(); const kind=typeWordKind(id);';
const typeReplace='function renderTypeRun() { const id = typeRun.session.current?.wordId; const w = wordById(id); if (!w) return finishType(); const p = typeProgress(); const kind=typeWordKind(id); const gapShortfall=Number(typeRun.session.current?.gapShortfall||0);';
if(!app.includes(typeNeedle))throw new Error('type render insertion not found');
app=app.replace(typeNeedle,typeReplace);
const typeStatus='<div class="statusline">不自动判中文同义词对错；熟悉/不熟悉仍然作用于同一个单词历史。</div>';
if(!app.includes(typeStatus))throw new Error('type status insertion not found');
app=app.replace(typeStatus, '${gapShortfall?`<div class="statusline">队列已到尾部，可用间隔词不足，还差约 ${gapShortfall} 个；仍需重新判断，不会自动算通过。</div>`:\'\'}'+typeStatus);
write('src/app.js',app);

// Regression: reopening must credit real judgments already completed after the latest target attempt.
let t=read('tests/v19.test.js');
t += `\n\ntest('reopening preserves already-earned intervening-word credit',()=>{\n  const s=state();\n  add(s,'a','bad','listen',1);\n  for(let i=0;i<4;i++) add(s,['b','c','d','e'][i],'good','listen',2+i);\n  const p={date:'2026-08-14',newIds:['a','b','c','d','e','f','g'],reviewIds:[]};\n  const q=createRetrySession(s,p,'listen');\n  assert.equal(nextRetryGap(q),1);\n  assert.equal(pickNext(q),'f');\n  add(s,'f','good','listen',10);\n  finishCurrent(q,'good',s);\n  assert.equal(pickNext(q),'a');\n});\n\ntest('five persisted intervening judgments make a retry immediately eligible after reopen',()=>{\n  const s=state();\n  add(s,'a','bad','type',1);\n  for(let i=0;i<5;i++) add(s,['b','c','d','e','f'][i],'good','type',2+i);\n  const p={date:'2026-08-14',newIds:['a','b','c','d','e','f','g'],reviewIds:[]};\n  const q=createRetrySession(s,p,'type',['a','b','c','d','e','f','g']);\n  assert.equal(nextRetryGap(q),0);\n  assert.equal(pickNext(q),'a');\n});\n`;
write('tests/v19.test.js',t);
