import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,text){fs.writeFileSync(path,text);}
function replace(path,before,after){const text=read(path);if(!text.includes(before))throw new Error(`pattern not found: ${path}`);write(path,text.replace(before,after));}

let app=read('src/app.js');
app=app.replace("let saveFailureShown = false;", "let saveFailureShown = false;\nlet todayPlanPanelOpen = false;\nlet typeFilterPanelOpen = false;");

app=app.replace(
`<details class="details"><summary>调整今天的计划与词书</summary>`,
`<details id="todayPlanDetails" class="details" ${'${todayPlanPanelOpen ? \'open\' : \'\'}'}><summary>调整今天的计划与词书</summary>`
);

app=app.replace(
`<details class="details"><summary>词书范围与高级筛选</summary>`,
`<details id="typeFilterDetails" class="details" ${'${typeFilterPanelOpen ? \'open\' : \'\'}'}><summary>词书范围与高级筛选</summary>`
);

app=app.replace(
`  bindBookChips('today', () => {`,
`  const todayPlanDetails=document.getElementById('todayPlanDetails');\n  if(todayPlanDetails) todayPlanDetails.ontoggle=()=>{todayPlanPanelOpen=todayPlanDetails.open;};\n  bindBookChips('today', () => {\n    todayPlanPanelOpen = true;`
);

app=app.replace(
`  bindBookChips('type', renderType); document.getElementById('typeStartAuto').onclick`,
`  const typeFilterDetails=document.getElementById('typeFilterDetails'); if(typeFilterDetails) typeFilterDetails.ontoggle=()=>{typeFilterPanelOpen=typeFilterDetails.open;}; bindBookChips('type', ()=>{typeFilterPanelOpen=true;renderType();}); document.getElementById('typeStartAuto').onclick`
);

write('src/app.js',app);

let css=read('styles.css');
css += `\n/* v21: larger, easier wordbook controls on touch screens */\n.chips{gap:10px}\n.chip{min-height:42px;padding:10px 15px;font-size:14px;touch-action:manipulation}\n.details>summary{min-height:42px;display:flex;align-items:center;padding:6px 2px}\n@media(max-width:620px){.chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.chip{width:100%;min-height:48px;padding:12px 10px;font-size:14px}.details>summary{min-height:48px;font-size:14px}.details[open]>summary{margin-bottom:4px}}\n`;
write('styles.css',css);

write('tests/v21.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst app=fs.readFileSync(new URL('../src/app.js', import.meta.url),'utf8');\nconst css=fs.readFileSync(new URL('../styles.css', import.meta.url),'utf8');\n\ntest('today wordbook panel persists open state across chip-triggered rerenders',()=>{\n  assert.match(app,/let todayPlanPanelOpen = false/);\n  assert.match(app,/id="todayPlanDetails" class="details" \\${todayPlanPanelOpen \? 'open' : ''}/);\n  assert.match(app,/todayPlanPanelOpen = true;[\\s\\S]*renderToday\\(\\)/);\n});\n\ntest('type wordbook filter also preserves its open state',()=>{\n  assert.match(app,/let typeFilterPanelOpen = false/);\n  assert.match(app,/typeFilterPanelOpen=true;renderType\\(\\)/);\n});\n\ntest('wordbook chips have larger mobile touch targets',()=>{\n  assert.match(css,/\\.chip\\{min-height:42px/);\n  assert.match(css,/@media\\(max-width:620px\\)[\\s\\S]*\\.chip\\{width:100%;min-height:48px/);\n});\n`);
