import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,text){fs.writeFileSync(path,text);}

let app=read('src/app.js');
app=app.replace("let saveFailureShown = false;", "let saveFailureShown = false;\nlet todayPlanPanelOpen = false;\nlet typeFilterPanelOpen = false;");

app=app.replace(
  '<details class="details"><summary>调整今天的计划与词书</summary>',
  '<details id="todayPlanDetails" class="details" ${todayPlanPanelOpen ? \'open\' : \'\'}><summary>调整今天的计划与词书</summary>'
);
app=app.replace(
  '<details class="details"><summary>词书范围与高级筛选</summary>',
  '<details id="typeFilterDetails" class="details" ${typeFilterPanelOpen ? \'open\' : \'\'}><summary>词书范围与高级筛选</summary>'
);
app=app.replace(
  "  bindBookChips('today', () => {",
  "  const todayPlanDetails=document.getElementById('todayPlanDetails');\n  if(todayPlanDetails) todayPlanDetails.ontoggle=()=>{todayPlanPanelOpen=todayPlanDetails.open;};\n  bindBookChips('today', () => {\n    todayPlanPanelOpen = true;"
);
app=app.replace(
  "  bindBookChips('type', renderType); document.getElementById('typeStartAuto').onclick",
  "  const typeFilterDetails=document.getElementById('typeFilterDetails'); if(typeFilterDetails) typeFilterDetails.ontoggle=()=>{typeFilterPanelOpen=typeFilterDetails.open;}; bindBookChips('type', ()=>{typeFilterPanelOpen=true;renderType();}); document.getElementById('typeStartAuto').onclick"
);
if(!app.includes('id="todayPlanDetails"') || !app.includes('todayPlanPanelOpen = true;')) throw new Error('today picker patch failed');
if(!app.includes('id="typeFilterDetails"') || !app.includes('typeFilterPanelOpen=true;')) throw new Error('type picker patch failed');
write('src/app.js',app);

let css=read('styles.css');
css += '\n/* v21: larger, easier wordbook controls on touch screens */\n.chips{gap:10px}\n.chip{min-height:42px;padding:10px 15px;font-size:14px;touch-action:manipulation}\n.details>summary{min-height:42px;display:flex;align-items:center;padding:6px 2px}\n@media(max-width:620px){.chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.chip{width:100%;min-height:48px;padding:12px 10px;font-size:14px}.details>summary{min-height:48px;font-size:14px}.details[open]>summary{margin-bottom:4px}}\n';
write('styles.css',css);

const testText = [
  "import test from 'node:test';",
  "import assert from 'node:assert/strict';",
  "import fs from 'node:fs';",
  "",
  "const app=fs.readFileSync(new URL('../src/app.js', import.meta.url),'utf8');",
  "const css=fs.readFileSync(new URL('../styles.css', import.meta.url),'utf8');",
  "",
  "test('today wordbook panel persists open state across chip-triggered rerenders',()=>{",
  "  assert.ok(app.includes('let todayPlanPanelOpen = false;'));",
  "  assert.ok(app.includes('id=\"todayPlanDetails\" class=\"details\" ${todayPlanPanelOpen ? \'open\' : \'\'}'));",
  "  assert.ok(app.includes('todayPlanPanelOpen = true;'));",
  "});",
  "",
  "test('type wordbook filter also preserves its open state',()=>{",
  "  assert.ok(app.includes('let typeFilterPanelOpen = false;'));",
  "  assert.ok(app.includes('typeFilterPanelOpen=true;renderType();'));",
  "});",
  "",
  "test('wordbook chips have larger mobile touch targets',()=>{",
  "  assert.ok(css.includes('.chip{min-height:42px'));",
  "  assert.ok(css.includes('.chip{width:100%;min-height:48px'));",
  "});",
  ""
].join('\n');
write('tests/v21.test.js', testText);
