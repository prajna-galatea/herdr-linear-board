import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {drive,replay,saveEvidence} from '../support/terminal-evidence.mjs';
function invariant(c,code) {
  assert.equal(c.exitCode,code,c.raw);
  assert.equal(c.modeRestored,true,c.name+' input mode');
  assert.equal(c.sameFiles,true,c.name+' files');
  assert.match(c.raw, /@@GUARD@@\[\]/);
  assert.match(c.raw,/\x1b\[\?1049h/);
  assert.match(c.raw,/\x1b\[\?1049l/);
  assert.match(c.raw,/\x1b\[\?25h/);
}
test('real PTY: four columns, 80/59 widths, scrolling, resize and exit restoration', {timeout:40000},async()=>{
  const cases=drive('all');
  for (const c of cases) {
    invariant(c,c.name==='ctrl-c'||c.name==='int'?130:c.name==='term'?143:0);
    const s=await replay(c);
    const initial=s.initial;
    assert.match(initial.at(-1),/q 離開/,c.name+' footer');
    assert.match(initial.at(-2),/ready.*警告 [1-9]/,c.name+' visible warning count');
    assert.match(initial.at(-2),/未知欄位/,c.name+' visible warning detail');
    if (['wide','resize','ctrl-c','term','int'].includes(c.name)) {
      assert.match(initial[0],/待辦.*進行中.*等把關.*已結案/);
      assert.match(initial.join('\n'),/DEMO-SPEC/);
    }
    if (['small','medium','resize'].includes(c.name)) assert.match(s['last-card'].join('\n'),/DEMO-POL-MERGED/);
    if (c.name==='resize') {
      assert.match(s.narrow[0],/待辦/);
      assert.match(s['wide-again'][0],/待辦.*進行中.*等把關.*已結案/);
      assert.match(s['wide-again'].at(-1),/q 離開/);
    }
  }
  await saveEvidence('screens',cases);
});
test('real CLI polling: unavailable, same length/mtime, atomic replace, stale and recovery', {timeout:70000},async()=>{
  const c=drive('poll')[0]; invariant(c,0);
  const s=await replay(c);
  assert.match(s.initial.join('\n'),/unavailable/);
  for (const [key,value] of [['ready-one','one'],['same-length-mtime-two','two'],['atomic-tri','tri']]) {
    assert.match(s[key].join('\n'),new RegExp(value)); assert.match(s[key].join('\n'),/ready/);
  }
  for (const key of ['stale-json','stale-schema','stale-object-version','stale-unreadable','stale-missing']) {
    assert.match(s[key].join('\n'),/stale/); assert.match(s[key].join('\n'),/tri/);
  }
  assert.match(s['stale-object-version'].join('\n'), /不支援的 version/);
  assert.match(s['recovered-version'].join('\n'), /ready/);
  assert.match(s['recovered-version'].join('\n'), /tri/);
  assert.doesNotMatch(s['recovered-version'].join('\n'), /stale/);
  assert.match(s['recovered-empty'].join('\n'),/ready/);
  assert.doesNotMatch(s['recovered-empty'].join('\n'),/POLL|tri|stale/);
  await saveEvidence('poll',[c]);
});
test('Node 26 permission mode cross-check forbids file writes, child processes and network', {timeout:15000},async()=>{
  // Additional check; Node 22 retains the same runtime and PTY suite contract.
  if (Number(process.versions.node.split('.')[0])<26) return;
  const controls=spawnSync(process.execPath,['--permission','--allow-fs-read=*',fileURLToPath(new URL('../support/permission-controls.mjs',import.meta.url))],{encoding:'utf8',timeout:5000});
  assert.equal(controls.status,0,controls.stderr);
  assert.match(controls.stdout,/3 denied/);
  const c=drive('permission')[0]; invariant(c,0);
  assert.match((await replay(c)).initial[0],/待辦.*進行中.*等把關.*已結案/);
  await saveEvidence('permission',[c]);
});
