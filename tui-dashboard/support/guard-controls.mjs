import fs from 'node:fs';
import fsp from 'node:fs/promises';
import cp from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import dns from 'node:dns';
import assert from 'node:assert/strict';
// Acquire a read-only FileHandle before installing the guard to prove its prototype is covered.
const handle = await fsp.open(new URL(import.meta.url), 'r');
const {installIoGuard,getViolations} = await import('./io-guard.mjs');
installIoGuard();
for (const action of [
  () => fs.openSync('/tmp/forbidden','w'), () => fs.writeSync(9,'probe'),
  () => fs.writeFile('/tmp/forbidden','probe',()=>{}),
  () => fsp.writeFile('/tmp/forbidden','probe'), () => handle.write('probe'),
  () => fs.createWriteStream('/tmp/forbidden'), () => fs.renameSync('a','b'),
  () => cp.spawn('echo',['probe']), () => net.connect(80,'localhost'),
  () => http.get('http://localhost'), () => dns.lookup('localhost',()=>{}),
  () => fetch('http://localhost'), () => new WebSocket('ws://localhost'),
]) { assert.throws(action, /IO guard blocked/); }
await handle.close();
assert.equal(getViolations().length,13);
process.stdout.write(JSON.stringify({controls:13,violations:getViolations()})+'\n');
