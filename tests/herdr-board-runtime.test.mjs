import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as helpers from '../mods/herdr-board/state.js';

function node() {
  const data = { nodes: [], styles: {}, events: {} };
  const proxy = new Proxy(data, { get(o, k) {
    if (k in o) return o[k];
    return (...args) => {
      if (k === 'child') o.nodes.push(args[0]);
      else if (k === 'children') o.nodes.push(...args[0]);
      else if (k.startsWith('on_')) o.events[k] = args[0];
      else o.styles[k] = args;
      return proxy;
    };
  }});
  return proxy;
}
function all(n) { return typeof n === 'object' && n ? [n, ...n.nodes.flatMap(all)] : []; }
function texts(n) { return typeof n === 'object' && n ? n.nodes.flatMap(texts) : [String(n)]; }
const byId = (n, id) => all(n).find(n => n.styles.id?.[0] === id);
async function load(file, bindings) {
  let source = await readFile(new URL(`../mods/herdr-board/${file}`, import.meta.url), 'utf8');
  source = source.replace(/import\s+([\s\S]*?)\s+from\s+"([^"]+)";/g, (_, names, path) => `const ${names} = globalThis.__runtime[${JSON.stringify(path)}];`);
  globalThis.__runtime = bindings;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Math.random()}`);
}
async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'T-board-events-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'state.json');
  for (const dir of ['requests', 'gates']) { await mkdir(join(root, dir)); await writeFile(join(root, dir, 'sentinel'), 'unchanged'); }
  const hooks = {};
  const operations = [], jobs = [], timers = [], inputs = [];
  let notifications = 0;
  const cx = { notify() { notifications++; }, stop_propagation() {}, spawn(fn) { const job = { fn, cancel() { this.cancelled = true; } }; jobs.push(job); return job; }, timer: { every(ms, fn) { const timer = { fn, cancel() { this.cancelled = true; } }; timers.push(timer); return timer; } } };
  const herdr = new Proxy({ home: () => root, appHome: () => join(root, 'app'), props: () => options.props ?? {state: path}, theme: () => ({}), window: () => ({platform:'macos'}),
    readTextFile: async p => { if(hooks.read) return hooks.read(p); operations.push(['read', p]); assert.ok([path, join(root,'app/herdr-board.json'), join(root,'other.json')].includes(p), p); try { return await readFile(p,'utf8'); } catch(e) { if(e.code === 'ENOENT') return null; throw e; } },
    exec: async (...args) => { operations.push(['exec', ...args]); assert.equal(args[0], 'open'); return {code:0}; },
  }, {get(o,k) { if(k in o) return o[k]; return (...args) => { operations.push(['forbidden',k,...args]); throw Error(`forbidden ${k}`); }; }});
  const ui = { View: class {}, div: node, svg: node, v_flex: node, h_flex: node, InputState: {new() { const input = {text:'', on(name,fn) {this.change=fn;}, value() {return this.text;}}; inputs.push(input); return input; }}, Input:{new:node} };
  const opener = await load('open.js', {'herdr':herdr,'./state.js':helpers});
  const {default:Board} = await load('main.js', {'herdr':herdr,'./state.js':helpers,'./open.js':opener,'gpui-kit':ui,'gpui-base':ui});
  const board = new Board(); board.init({},cx);
  const drain = async () => { while(jobs.length) await jobs.shift().fn(cx); };
  const click = id => { const n = byId(board.render(),id); assert.ok(n, id); n.events.on_click({},cx); };
  const save = tasks => writeFile(path, JSON.stringify({version:1,tasks}));
  return {root,path,board,cx,operations,jobs,timers,inputs,drain,click,save,herdr,hooks, notifications:()=>notifications};
}
const task = (id,column,extra={}) => ({id,title:`title ${id}`,column,model:'m1',pane:'build-a',reject_counts:{a:2,b:1},results:{build:'/tmp/report.md'},repo:'/tmp/repo',_d:{history:[{at:'2026-11-04T00:00:00Z',col:column,note:'reason'}]},...extra});

test('actual search/model/archive/card/back/refresh/timer events preserve state, requests and gates', async t => {
  const f = await fixture(t); await f.save([task('T-live','build'),task('T-done','merged'),task('T-001','todo')]); await f.drain();
  const before = await readFile(f.path);
  f.inputs[0].text='T-live'; f.inputs[0].change({},f.cx); f.click('model-chip-0');
  let tree=f.board.render(); const card=byId(tree,'card-T-live');
  assert.deepEqual(texts(card).slice(0,3),['T-live','title T-live','施工手 · m1']);
  assert.equal(texts(card).length,5); assert.ok(texts(card).includes('退回 3'));
  f.click('card-T-live'); tree=f.board.render(); assert.ok(texts(tree).some(s=>s.includes('"note":"reason"')));
  const back=all(tree).find(n=>texts(n).join('')==='← 返回' && n.events.on_click); back.events.on_click({},f.cx);
  assert.ok(byId(f.board.render(),'card-T-live')); assert.equal(byId(f.board.render(),'card-T-done'),undefined);
  f.inputs[0].text=''; f.inputs[0].change({},f.cx); f.click('model-all'); f.click('archive-archived');
  assert.ok(byId(f.board.render(),'card-T-done')); assert.ok(byId(f.board.render(),'card-T-001'));
  f.click('archive-all'); f.click('refresh'); await f.drain(); f.timers[0].fn(f.cx); await f.drain();
  assert.deepEqual(await readFile(f.path),before);
  for(const dir of ['requests','gates']) {assert.deepEqual(await readdir(join(f.root,dir)),['sentinel']);assert.equal(await readFile(join(f.root,dir,'sentinel'),'utf8'),'unchanged');}
  assert.ok(f.operations.every(([op])=>op==='read'),JSON.stringify(f.operations));
});
test('real opener only runs after valid detail click',async t=>{
  const f=await fixture(t);await f.save([task('T-x','build',{results:{build:'https://invalid/a',review:'/tmp/good.md'}})]);await f.drain();f.click('card-T-x');
  for(const label of ['build 結果','review 結果','.herdr 資料夾']) {const n=all(f.board.render()).find(n=>n.events.on_click&&texts(n).join('')===label);n.events.on_click({},f.cx);}
  assert.deepEqual(f.operations.filter(([op])=>op==='exec'),[['exec','open',['--','/tmp/good.md']],['exec','open',['--','/tmp/repo/.herdr/T-x']]]);
});
test('actual two-argument resize events rearrange visible lanes at every boundary',async t=>{
  const f=await fixture(t);await f.save([task('a','todo'),task('b','build'),task('c','pr'),task('d','closed')]);await f.drain();f.click('archive-all');
  for(const [width,counts] of [[479,[1,1,1,1]],[480,[2,2]],[959,[2,2]],[960,[4]],[320,[1,1,1,1]]]) {
    f.board.render().events.on_size_change({width,height:600},f.cx);
    const rows=byId(f.board.render(),'board').nodes;
    assert.deepEqual(rows.map(r=>r.nodes.length),counts);
    for(const row of rows)assert.ok(row.nodes.reduce((s,c)=>s+c.styles.w[0],0)+12*(row.nodes.length-1)+24<=width);
    assert.ok(byId(f.board.render(),'lane-closed'));
  }
});
test('same-size same-mtime reload, deletion, broken JSON and recovery',async t=>{
  const f=await fixture(t);await f.save([task('a','todo')]);await utimes(f.path,1000,1000);await f.drain();
  await f.save([task('b','todo')]);await utimes(f.path,1000,1000);f.click('refresh');await f.drain();assert.ok(byId(f.board.render(),'card-b'));
  for(const broken of ['missing','json']) {if(broken==='missing')await rm(f.path);else await writeFile(f.path,'{');f.click('refresh');await f.drain();assert.ok(byId(f.board.render(),'card-b'));assert.equal(f.board.stale,true);}
  await f.save([task('b','merged')]);f.click('refresh');await f.drain();assert.equal(f.board.stale,false);assert.equal(byId(f.board.render(),'card-b'),undefined);
  await f.save([task('b','todo')]);f.click('refresh');await f.drain();assert.ok(byId(f.board.render(),'card-b'));
});
test('empty successful snapshot remains visibly stale on disappearance or damage and recovers',async t=>{
  const f=await fixture(t);await f.save([]);await f.drain();
  assert.doesNotMatch(texts(f.board.render()).join(''),/未更新/);
  for(const broken of ['missing','json']) {
    if(broken==='missing')await rm(f.path);else await writeFile(f.path,'{');
    f.click('refresh');await f.drain();
    assert.match(texts(f.board.render()).join(''),/未更新/);
    for(const id of ['todo','active','gate','closed'])assert.ok(byId(f.board.render(),`lane-${id}`));
    await f.save([]);f.click('refresh');await f.drain();
    assert.doesNotMatch(texts(f.board.render()).join(''),/未更新/);
  }
});
test('detail shows stale snapshot warning for missing, damaged and unreadable source and clears it on recovery',async t=>{
  const f=await fixture(t);await f.save([task('T-detail','build')]);await f.drain();f.click('card-T-detail');
  let title='title T-detail';
  for(const broken of ['missing','json','read-error']) {
    if(broken==='missing')await rm(f.path);
    else if(broken==='json')await writeFile(f.path,'{');
    else f.hooks.read=async()=>{throw Error('test source unreadable');};
    f.timers[0].fn(f.cx);await f.drain();
    let tree=f.board.render();assert.ok(byId(tree,'herdr-board-detail'));
    assert.match(texts(tree).join(''),/未更新/);
    assert.ok(texts(tree).includes(title));
    title=`recovered ${broken}`;
    f.hooks.read=null;await f.save([task('T-detail','build',{title})]);
    f.timers[0].fn(f.cx);await f.drain();tree=f.board.render();
    assert.ok(byId(tree,'herdr-board-detail'));assert.doesNotMatch(texts(tree).join(''),/未更新/);
    assert.ok(texts(tree).includes(title));
  }
  assert.ok(f.operations.every(([op])=>op==='read'));
});
test('repeated initial missing is empty rather than a stale successful snapshot',async t=>{
  const f=await fixture(t);await f.drain();f.click('refresh');await f.drain();
  assert.match(texts(f.board.render()).join(''),/尚無任務/);
  assert.doesNotMatch(texts(f.board.render()).join(''),/未更新/);
});
test('close cancels owned tasks and late callbacks do no work',async t=>{
  const f=await fixture(t);await f.save([task('a','todo')]);const job=f.jobs[0];f.board.close();const before=f.operations.length,n=f.notifications();await f.drain();f.timers[0].fn(f.cx);assert.equal(job.cancelled,true);assert.equal(f.timers[0].cancelled,true);assert.equal(f.operations.length,before);assert.equal(f.notifications(),n);
});
test('explicit invalid state does not read config or production source',async t=>{
 const f=await fixture(t,{props:{state:''}});await f.drain();assert.deepEqual(f.operations,[]);assert.match(f.board.error,/路徑/);
});
test('initial missing retains empty four lanes without creating file',async t=>{
 const f=await fixture(t);await f.drain();assert.match(texts(f.board.render()).join(''),/尚無任務/);for(const id of ['todo','active','gate','closed'])assert.ok(byId(f.board.render(),`lane-${id}`));await assert.rejects(readFile(f.path),{code:'ENOENT'});
});

test('source change clears old snapshot and queued refresh converges',async t=>{
 const f=await fixture(t,{props:{}});await mkdir(join(f.root,'app'));await writeFile(join(f.root,'app/herdr-board.json'),JSON.stringify({state:f.path}));await f.save([task('old','todo')]);await f.drain();
 await writeFile(join(f.root,'app/herdr-board.json'),JSON.stringify({state:join(f.root,'other.json')}));f.click('refresh');f.click('refresh');await f.drain();assert.equal(byId(f.board.render(),'card-old'),undefined);assert.match(texts(f.board.render()).join(''),/尚無任務/);
 await writeFile(join(f.root,'other.json'),JSON.stringify({tasks:[task('new','todo')]}));f.click('refresh');await f.drain();assert.ok(byId(f.board.render(),'card-new'));
});
test('closing during an in-flight read ignores late completion',async t=>{
 const f=await fixture(t);await f.save([task('late','todo')]);
 const herdr=f.herdr,original=herdr.readTextFile;let release;f.hooks.read=()=>new Promise(resolve=>{release=resolve;});
 const job=f.jobs.shift().fn(f.cx);await Promise.resolve();assert.ok(release);const n=f.notifications();f.board.close();release(JSON.stringify({tasks:[task('late','todo')]}));await job;assert.equal(f.notifications(),n);assert.equal(f.board.snapshot.tasks.length,0);herdr.readTextFile=original;
});
