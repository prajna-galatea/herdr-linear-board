import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, utimes, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as helpers from "../mods/herdr-board/state.js";

const runFile = promisify(execFile);
const source = await readFile(new URL("../mods/herdr-board/main.js", import.meta.url), "utf8");
let script = source.replace(/import\s+([\s\S]*?)\s+from\s+"([^"]+)";/g, (_, names, path) => {
  const binding = path === "./state.js" ? "helpers" : path === "herdr" ? "herdr" : path === "./open.js" ? "open" : "ui";
  return `const ${names} = globalThis.__boardTest.${binding};`;
});
script = script.replace('export default globalThis.__herdrBoard.view;', 'export default HerdrBoard;');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "herdr-board-test-"));
  const statePath = join(root, "herdr-ops/board/state.json");
  await mkdir(join(root, "herdr-ops/board"), { recursive: true });
  const calls = [];
  globalThis.__boardTest = {
    helpers, ui: { View: class {} }, open: {},
    herdr: {
      exec: async (command, args) => {
        calls.push([command, ...args]);
        if (command === "stat") return { code: 0, stdout: "123\n" };
        try { const out = await runFile(command, args); return { code: 0, ...out }; }
        catch (error) { return { code: error.code || 1, stdout: error.stdout || "", stderr: error.stderr || "" }; }
      },
      readTextFile: async (path) => { try { return await readFile(path, "utf8"); } catch { return null; } },
      writeTextFile: async (path, text, expected) => {
        assert.equal(await readFile(path, "utf8"), expected);
        await writeFile(path, text);
      },
      appHome: () => join(root, "config"),
    },
  };
  const { default: Board } = await import(`data:text/javascript;base64,${Buffer.from(script).toString("base64")}#${Math.random()}`);
  const board = new Board();
  Object.assign(board, { homeDir: root, statePath, roles: {}, pending: new Set(), snapshot: { tasks: [] }, reading: false, reloadQueued: false, loaded: false });
  const jobs = [];
  const cx = { spawn: (fn) => jobs.push(fn(cx)), notify() {} };
  return { root, statePath, board, calls, cx, jobs };
}

test("poll reloads changed content despite identical modification time", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  const state = (title) => JSON.stringify({ version: 1, tasks: [{ id: "T-1", title, column: "todo" }] });
  await writeFile(f.statePath, state("before"));
  await utimes(f.statePath, 1000000000, 1000000000);
  f.board.reload(false, f.cx);
  await f.jobs.shift();
  assert.equal(f.board.snapshot.tasks[0].title, "before");
  await writeFile(f.statePath, state("after!"));
  await utimes(f.statePath, 1000000000, 1000000000);
  f.board.reload(false, f.cx);
  await f.jobs.shift();
  assert.equal(f.board.snapshot.tasks[0].title, "after!");
});

test("dispatch and gate write unique request files without touching state.json", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  const original = JSON.stringify({ version: 1, tasks: [{ id: "T-9", title: "task", column: "unknown" }] });
  await writeFile(f.statePath, original);
  const task = { id: "T-9", column: "unknown" };
  const timestamp = "2026-11-02T00:00:00.000Z";
  await f.board.writeRequest(helpers.makeRequest("dispatch", task, "spec", "test", timestamp));
  await f.board.writeRequest(helpers.makeRequest("gate", task, "lead", "", timestamp));
  const directory = join(f.root, "herdr-ops/board/requests");
  const names = await readdir(directory);
  assert.equal(names.length, 2);
  assert.ok(names.every((name) => /^2026-11-02T00-00-00-000Z-T-9-[a-zA-Z0-9]+\.json$/.test(name)));
  const records = await Promise.all(names.map(async (name) => JSON.parse(await readFile(join(directory, name), "utf8"))));
  assert.equal(records.find((request) => request.kind === "dispatch").column_hint, "todo");
  assert.equal(records.find((request) => request.kind === "gate").pane, "lead");
  assert.equal(await readFile(f.statePath, "utf8"), original);
  assert.equal(f.calls.some(([command, ...args]) => ["mv", "mkdir", "mktemp"].includes(command) && args.includes(f.statePath)), false);
  f.board.pending.clear();
  await f.board.loadRequests();
  assert.equal(f.board.pending.has("T-9"), true);
});
