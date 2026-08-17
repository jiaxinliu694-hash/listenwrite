import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('study timer is mounted inline with the study progress header',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.ok(app.includes("progress.appendChild(badge)"));
  assert.ok(app.includes("study-timer-inline"));
  assert.ok(app.includes("今日听词"));
});

test('static assets are cache-busted for timer rollout',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.includes('styles.css?v=24'));
  assert.match(html,/app\.bundle\.js\?v=\d+/);
});
