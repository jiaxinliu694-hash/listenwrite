import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,text){fs.writeFileSync(path,text);}
function replace(path,before,after){const text=read(path);if(!text.includes(before))throw new Error(`pattern not found: ${path}`);write(path,text.replace(before,after));}

// Mix new and review cards into one deterministic daily study order.
replace('src/queue.js',
`export function createRetrySession(state, plan, mode = 'listen', explicitIds = null) {\n  const planIds = [...new Set(explicitIds || [...plan.reviewIds, ...plan.newIds])];`,
`function mixedStudyOrder(ids, plan, mode = 'listen') {\n  const books = (plan.books || []).slice().sort().join('|');\n  const seed = \`${'${plan.date}'}|${'${mode}'}|${'${Number(plan.drawNonce) || 0}'}|${'${books}'}|mixed-study\`;\n  return [...new Set(ids)].sort((a,b) => randomRank(a, seed) - randomRank(b, seed) || String(a).localeCompare(String(b)));\n}\n\nexport function createRetrySession(state, plan, mode = 'listen', explicitIds = null) {\n  const orderedIds = explicitIds ? [...explicitIds] : mixedStudyOrder([...(plan.newIds || []), ...(plan.reviewIds || [])], plan, mode);\n  const planIds = [...new Set(orderedIds)];`);

let app=read('src/app.js');
const beforeApp=app;
app=app.replace('混合学习：多本词书共用一个总量','混合学习：新词和复习词打乱出现，多本词书共用一个总量');
app=app.replace('分本依次：一本学完再下一本','分本依次：一本学完再下一本，本内新词/复习打乱');
app=app.replace(/<div class="type-kind">[^<]*?<\/div><button id="speakWord"/, '<button id="speakWord"');
app=app.replace(' const kind=typeWordKind(id);','');
app=app.replace(' · ${kind} · ${esc(typeRun.label)}',' · ${esc(typeRun.label)}');
if(app===beforeApp) throw new Error('app.js was not changed');
if(app.includes('<div class="type-kind">${planWordKind(listen.plan,w.id)}')) throw new Error('listen card kind label still present');
write('src/app.js',app);

write('tests/v20.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { createRetrySession } from '../src/queue.js';\n\nfunction stateFor(ids){\n  return { words: ids.map(id=>({id,en:id,zh:'',sources:['A'],retired:false,card:null})), events:[], settings:{retention:0.9} };\n}\n\ntest('formal study mixes new and review cards in one stable daily order',()=>{\n  const newIds=Array.from({length:10},(_,i)=>\`n\${i+1}\`);\n  const reviewIds=Array.from({length:10},(_,i)=>\`r\${i+1}\`);\n  const s=stateFor([...newIds,...reviewIds]);\n  const plan={date:'2026-08-14',books:['A'],drawNonce:2,newIds,reviewIds,resumeWordId:null};\n  const a=createRetrySession(s,plan,'listen');\n  const b=createRetrySession(s,plan,'listen');\n  assert.deepEqual(a.fixedIds,b.fixedIds);\n  assert.deepEqual(new Set(a.fixedIds),new Set([...newIds,...reviewIds]));\n  assert.notDeepEqual(a.fixedIds,[...reviewIds,...newIds]);\n  const firstSix=a.fixedIds.slice(0,6);\n  assert.ok(firstSix.some(id=>id.startsWith('n')));\n  assert.ok(firstSix.some(id=>id.startsWith('r')));\n});\n\ntest('resume hint still wins over mixed base order while due retries keep priority',()=>{\n  const ids=['n1','n2','r1','r2'];\n  const s=stateFor(ids);\n  const plan={date:'2026-08-14',books:['A'],drawNonce:1,newIds:['n1','n2'],reviewIds:['r1','r2'],resumeWordId:'n2'};\n  const q=createRetrySession(s,plan,'listen');\n  assert.equal(q.pendingBase[0],'n2');\n});\n`);
