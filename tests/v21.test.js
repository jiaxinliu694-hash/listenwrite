import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/app.js', import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../styles.css', import.meta.url),'utf8');

test('today wordbook panel persists open state across chip-triggered rerenders',()=>{
  assert.ok(app.includes('let todayPlanPanelOpen = false;'));
  assert.ok(app.includes('id="todayPlanDetails"'));
  assert.ok(app.includes('todayPlanPanelOpen = true;'));
});

test('type wordbook filter also preserves its open state',()=>{
  assert.ok(app.includes('let typeFilterPanelOpen = false;'));
  assert.ok(app.includes('id="typeFilterDetails"'));
  assert.ok(app.includes('typeFilterPanelOpen=true;renderType();'));
});

test('wordbook chips have larger mobile touch targets',()=>{
  assert.ok(css.includes('.chip{min-height:42px'));
  assert.ok(css.includes('.chip{width:100%;min-height:48px'));
});
