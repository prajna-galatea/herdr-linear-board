import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import xterm from '@xterm/headless';
const {Terminal} = xterm;
const probe = fileURLToPath(new URL('./pty-probe.py',import.meta.url));
export function drive(mode) {
  const result=spawnSync('python3',[probe,process.execPath,mode],{encoding:'utf8',timeout:100000,maxBuffer:8*1024*1024});
  assert.equal(result.status,0,result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}
export async function replay(c) {
  const first=c.events[0];
  const term=new Terminal({cols:first.width,rows:first.height,allowProposedApi:true});
  const screens={};
  for (const e of c.events) {
    term.resize(e.width,e.height);
    await new Promise(resolve=>term.write(e.data,resolve));
    screens[e.label]=Array.from({length:e.height},(_,i)=>term.buffer.active.getLine(i)?.translateToString(true)||'');
  }
  term.dispose();
  return screens;
}

export async function saveEvidence(name,cases) {
  if (process.env.TUI_CAPTURE_EVIDENCE !== '1') return;
  const dir=new URL('../docs/',import.meta.url);
  writeFileSync(new URL(`pty-${name}.json`,dir),JSON.stringify(cases,null,2)+'\n');
  const text=[];
  for (const c of cases) {
    const screens=await replay(c);
    text.push(`CASE ${c.name}; exit=${c.exitCode}; modeRestored=${c.modeRestored}; sameFiles=${c.sameFiles}`);
    for (const e of c.events.filter(e=>e.label!=='exit')) text.push(`--- ${e.label} ${e.width}x${e.height} ---`,...screens[e.label]);
  }
  writeFileSync(new URL(`terminal-${name}.txt`,dir),text.join('\n')+'\n');
}
