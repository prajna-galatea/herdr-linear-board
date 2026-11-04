import fs from 'node:fs';
import cp from 'node:child_process';
import net from 'node:net';
import assert from 'node:assert/strict';
const denied = fn => assert.throws(fn, {code:'ERR_ACCESS_DENIED'});
denied(()=>fs.writeFileSync('/tmp/tui-permission-forbidden','x'));
denied(()=>cp.spawn(process.execPath,['--version']));
await new Promise((resolve,reject) => {
  const socket=net.connect(80,'localhost');
  socket.once('error',error => {try {assert.equal(error.code,'ERR_ACCESS_DENIED'); resolve();} catch(e) {reject(e);} finally {socket.destroy();}});
  socket.once('connect',()=>{socket.destroy();reject(new Error('network unexpectedly allowed'));});
});
console.log('permission positive controls: 3 denied (fs, child_process, network)');
