import fs from 'node:fs';
import fsp from 'node:fs/promises';
import cp from 'node:child_process';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import dgram from 'node:dgram';
import dns from 'node:dns';
import dnsp from 'node:dns/promises';
import {syncBuiltinESMExports} from 'node:module';

const handle = await fsp.open(new URL(import.meta.url), 'r');
const handlePrototype = Object.getPrototypeOf(handle);
await handle.close();
const violations = [];
let installed = false;
export const getViolations = () => [...violations];
export const resetViolations = () => { violations.length = 0; };
function blocked(kind) {
  violations.push({kind});
  throw new Error(`IO guard blocked ${kind}`);
}
function block(object, name, label) {
  if (typeof object[name] === 'function') object[name] = () => blocked(`${label}.${name}`);
}
function writable(flags) {
  return typeof flags === 'number' ? Boolean(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND)) : /[wa+]/.test(flags || 'r');
}
export function installIoGuard() {
  if (installed) return;
  installed = true;
  const mutations = ['writeFile','appendFile','rename','unlink','mkdir','rmdir','rm','truncate','copyFile','cp','chmod','chown','lchmod','lchown','utimes','lutimes','link','symlink','mkdtemp','ftruncate','fchmod','fchown','futimes'];
  for (const name of mutations) {
    block(fs, name, 'fs'); block(fs, name + 'Sync', 'fs'); block(fsp, name, 'fsp');
  }
  for (const name of ['write','writev','writeSync','writevSync','createWriteStream']) {
    const original = fs[name];
    if (typeof original !== 'function') continue;
    fs[name] = (...args) => {
      if (typeof args[0] === 'number' && [1,2].includes(args[0]) && name !== 'createWriteStream') return original(...args);
      return blocked(`fs.${name}`);
    };
  }
  for (const [object,name] of [[fs,'open'],[fs,'openSync'],[fsp,'open']]) {
    const original = object[name];
    object[name] = (...args) => { if (writable(args[1])) return blocked(`fs.${name}(write)`); return original(...args); };
  }
  for (const name of ['write','writev','writeFile','appendFile','truncate','chmod','chown','utimes','createWriteStream']) block(handlePrototype,name,'FileHandle');
  for (const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']) block(cp,name,'child_process');
  for (const name of ['connect','createConnection','createServer']) block(net,name,'net');
  block(net.Socket.prototype,'connect','Socket'); block(net.Server.prototype,'listen','Server');
  block(tls,'connect','tls'); block(dgram,'createSocket','dgram'); block(http2,'connect','http2');
  for (const [object,label] of [[http,'http'],[https,'https']]) for (const name of ['request','get']) block(object,name,label);
  for (const [object,label] of [[dns,'dns'],[dnsp,'dns.promises']]) {
    for (const name of Object.keys(object)) if (/^(lookup|resolve|reverse)/.test(name)) block(object,name,label);
    if (object.Resolver) for (const name of Object.getOwnPropertyNames(object.Resolver.prototype)) if (/^(resolve|reverse)/.test(name)) block(object.Resolver.prototype,name,label+'.Resolver');
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, ...args) => {
    // Yoga loads its bundled WASM from a data URI; this performs no network I/O.
    if (typeof url === 'string' && url.startsWith('data:application/octet-stream;base64,')) return originalFetch(url, ...args);
    return blocked('fetch');
  };
  if (typeof globalThis.WebSocket === 'function') globalThis.WebSocket = function() { return blocked('WebSocket'); };
  syncBuiltinESMExports();
}
