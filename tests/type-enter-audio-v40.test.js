import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Enter advances type study without browser default action',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.ok(app.includes("e.key==='Enter'&&typeRun.result){e.preventDefault();nextType();}"));
});

test('next type word is queued for speech before rerender',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  const start=app.indexOf('function nextType(){');
  const end=app.indexOf('function finishType(){',start);
  const body=app.slice(start,end);
  assert.ok(body.indexOf('speakTypeWord(nextWord.en)') < body.indexOf('renderTypeRun()'));
});

test('type-study word audio uses a brisk dedicated rate',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.ok(app.includes('function speakTypeWord(text) {'));
  assert.ok(app.includes("if (synth.speaking || synth.pending) synth.cancel();"));
  assert.ok(app.includes("document.getElementById('typeReplay').onclick=()=>speakTypeWord(w.en);"));
});


test('type speech prefers a local English voice and primes on entering type mode',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.ok(app.includes("v.localService && /^en-US$/i.test(v.lang)"));
  assert.ok(app.includes("if(next==='type')primeTypeSpeech();"));
});
