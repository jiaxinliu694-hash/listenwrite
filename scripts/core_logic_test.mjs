import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('index.html','utf8');
const match=html.match(/<script>([\s\S]*)<\/script>/);
if(!match) throw new Error('inline script not found');
let js=match[1];
const end='load();nav();home();})();';
if(!js.includes(end)) throw new Error('app end marker not found');
js=js.replace(end,`globalThis.__LW_TEST__={
  getS:()=>S,setS:(x)=>{S=x},getSess:()=>sess,setSess:(x)=>{sess=x},getTs:()=>ts,setTs:(x)=>{ts=x},
  day,start,judge,next,cw,todayScopeData,dailyPlanStatus,getDailyPlan,extendDailyPlan,ensureActivities,typeJudge
};${end}`);

class FakeEl{
  constructor(id=''){this.id=id;this.innerHTML='';this.textContent='';this.value='';this.style={};this.dataset={};this.files=[];this.tagName='DIV';this.selectionStart=0;this.selectionEnd=0;this.disabled=false;this.classList={add(){},remove(){},contains(){return false}}}
  focus(){}
  click(){if(typeof this.onclick==='function')this.onclick()}
}
const els=new Map();
const document={
  body:new FakeEl('body'),
  activeElement:{tagName:'BODY'},
  getElementById(id){if(!els.has(id))els.set(id,new FakeEl(id));return els.get(id)},
  querySelectorAll(){return[]},
  createElement(){return new FakeEl()},
};
const store=new Map();
const localStorage={getItem(k){return store.has(k)?store.get(k):null},setItem(k,v){store.set(k,String(v))},removeItem(k){store.delete(k)}};
const context={console,document,localStorage,confirm:()=>true,setTimeout:()=>0,clearTimeout:()=>{},speechSynthesis:{cancel(){},speak(){}},SpeechSynthesisUtterance:function(t){this.text=t},URL:{createObjectURL(){return'blob:test'}},Blob:globalThis.Blob};
context.window=context;
context.window.addEventListener=()=>{};
context.window.getSelection=()=>({toString:()=>''});
vm.createContext(context);
vm.runInContext(js,context,{filename:'listenwrite-inline.js'});
const app=context.__LW_TEST__;
if(!app)throw new Error('test API not exposed');

function assert(cond,msg){if(!cond)throw new Error(msg)}
function word(id,en=id){return{id,en,zh:'义',pos:'',def:'',src:['Book'],ex:[],ret:false,next:0,int:0,diff:0}}
function baseState(words,set={}){return{words,events:[],activities:[],dailyPlans:{},texts:[],set:{newN:2,reviewN:1,rate:.92,todayBooks:[],typeBooks:[],...set}}}
function dateOffset(n){const d=new Date();d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function reset(S){app.setS(S);app.setSess(null);app.setTs(null);app.ensureActivities()}

// 1) Fixed plan denominators + isolated retry pool: repeated failures never create extra tasks.
{
  const r=word('r','review'),n1=word('n1','alpha'),n2=word('n2','beta');
  const S=baseState([r,n1,n2]);
  S.events.push({id:'old',wordId:'r',date:dateOffset(-1),ts:Date.now()-86400000,mode:'listen',res:'good',cold:true});
  r.next=0;
  reset(S);app.start();
  let ss=app.getSess();
  assert(ss.totals.new===2&&ss.totals.review===1,'initial new/review denominators wrong');
  assert(ss.q.length===3,'base plan must contain exactly 3 unique tasks');
  assert(app.cw().id==='r','due review should be first');
  app.judge('bad');ss=app.getSess();
  assert(ss.retry.length===1&&ss.q.length===3,'first failure must enter retry pool without extending base plan');
  app.next(false);
  app.judge('good');app.next(false);
  app.judge('good');app.next(false);
  ss=app.getSess();
  assert(ss.inRetry&&app.cw().id==='r','failed review must return only after base plan');
  assert(ss.totals.new===2&&ss.totals.review===1&&ss.q.length===3,'denominators/base plan changed during retries');
  app.judge('bad');app.next(false);
  assert(app.getSess().retry.length===1&&app.getSess().q.length===3,'second failure must rotate retry pool only');
  app.judge('good');app.next(false);
  ss=app.getSess();
  assert(ss.done.new===2&&ss.done.review===1,'completion counts must advance only after final familiar');
  assert(ss.totals.new===2&&ss.totals.review===1,'final denominators changed');
  const todayR=app.getS().events.filter(e=>e.wordId==='r'&&e.date===app.day());
  assert(todayR.length===3,'retry attempts should be historical events, not extra tasks');
}

// 2) Exiting/re-entering today must resume the same assigned words instead of drawing new words.
{
  const a=word('a','alpha'),b=word('b','beta'),c=word('c','gamma');
  reset(baseState([a,b,c],{newN:2,reviewN:0}));
  app.start();
  let ss=app.getSess();
  const assigned=[...app.getS().dailyPlans[ss.planKey].newIds];
  assert(assigned.length===2,'daily plan should assign exactly target new words');
  app.judge('good');app.next(false);
  app.setSess(null);
  app.start();ss=app.getSess();
  const assigned2=[...app.getS().dailyPlans[ss.planKey].newIds];
  assert(JSON.stringify(assigned2)===JSON.stringify(assigned),'re-entry changed the assigned daily plan');
  assert(ss.totals.new===2,'re-entry changed the daily denominator');
  assert(ss.q.length===1,'re-entry should contain only the one unfinished base word');
  assert(!assigned2.includes('c')||assigned.includes('c'),'re-entry pulled an extra fresh word');
}

// 3) Hand-writing events must not contaminate Today listening counts or completion.
{
  const w=word('w','word');
  const S=baseState([w],{newN:1,reviewN:0});
  const d=dateOffset(0),now=Date.now();
  S.events.push({id:'listen-good',wordId:'w',date:d,ts:now-1000,mode:'listen',res:'good',cold:true});
  S.events.push({id:'type-bad',wordId:'w',date:d,ts:now,mode:'type',res:'bad',cold:false});
  S.dailyPlans[d+'::__all__']={date:d,books:[],newIds:['w'],reviewIds:[]};
  reset(S);
  const td=app.todayScopeData([]);
  assert(td.newIds.length===1&&td.firstGood===1&&td.firstBad===0,'Today stats mixed hand-writing event into listening data');
  const ps=app.dailyPlanStatus(app.getS().dailyPlans[d+'::__all__']);
  assert(ps.done.length===1&&ps.retry.length===0,'later hand-writing bad incorrectly reopened a completed listening task');
}

// 4) Editing a base-plan judgment must synchronize retry membership immediately.
{
  const w=word('w','word');reset(baseState([w],{newN:1,reviewN:0}));app.start();
  app.judge('bad');
  assert(app.getSess().retry.length===1,'bad judgment did not add retry');
  app.judge('good');
  assert(app.getSess().retry.length===0,'changing bad to good left a ghost retry');
  assert(app.getSess().done.new===1,'changing bad to good did not restore completion');
  app.judge('bad');
  assert(app.getSess().retry.length===1&&app.getSess().done.new===0,'changing good back to bad did not reopen task');
}

// 5) Hand-writing edit must modify the exact attempt, not some later event for the same word.
{
  const w=word('w','word');reset(baseState([w],{newN:0,reviewN:0}));
  app.setTs({active:true,q:[w],i:0,show:true,res:null,input:'x',label:'test',done:[],skipped:0,books:[],fixedTotal:1,completed:{},meta:{},inputByIndex:{}});
  app.typeJudge('bad');
  let ts=app.getTs();const exactId=ts.meta[0].eventId;
  app.getS().events.push({id:'unrelated-later',wordId:'w',date:app.day(),ts:Date.now()+1,mode:'type',res:'bad',cold:false});
  app.typeJudge('good');
  const exact=app.getS().events.find(e=>e.id===exactId),later=app.getS().events.find(e=>e.id==='unrelated-later');
  assert(exact.res==='good','exact hand-writing attempt was not edited');
  assert(later.res==='bad','hand-writing edit modified an unrelated later event');
}

console.log('CORE LOGIC TESTS PASSED');
console.log('5 scenarios: fixed denominators/retry pool, resume same plan, mode separation, retry edit sync, exact hand-attempt editing.');
