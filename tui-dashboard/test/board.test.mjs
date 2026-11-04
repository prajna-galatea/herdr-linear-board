import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  boardToPlainText,
  formatElapsed,
  projectBoard,
  resolveStatePath,
  sanitizeText,
  sumRejectCounts,
} from "../src/board.mjs";
import { main } from "../src/cli.mjs";
import { nextDisplayState, readStateFile } from "../src/read-loop.mjs";
import { displayWidth, wrapText } from "../src/layout.mjs";

const fixturePath = fileURLToPath(new URL("../fixtures/state.anonymized.json", import.meta.url));
const fixtureText = readFileSync(fixturePath, "utf8");
const FIXED_NOW = Date.parse("2026-11-04T08:00:00.000Z");

function cardsInColumn(board, title) {
  const col = board.columns.find((c) => c.title === title);
  assert.ok(col, title);
  return col.cards;
}

function findCard(board, id) {
  for (const col of board.columns) {
    const hit = col.cards.find((c) => c.id === id);
    if (hit) return { column: col.title, card: hit };
  }
  return null;
}

test("projectBoard maps fixture tasks into four columns", () => {
  const outcome = projectBoard(fixtureText, FIXED_NOW);
  assert.equal(outcome.kind, "valid");
  const board = outcome.board;
  assert.equal(board.columns.length, 4);
  assert.deepEqual(board.columns.map((c) => c.title), [
    "待辦",
    "進行中（角色＋模型）",
    "等把關",
    "已結案",
  ]);
  assert.ok(cardsInColumn(board, "待辦").some((c) => c.id === "DEMO-TODO"));
  assert.ok(cardsInColumn(board, "進行中（角色＋模型）").some((c) => c.id === "DEMO-SPEC"));
  assert.ok(cardsInColumn(board, "等把關").some((c) => c.id === "DEMO-DECIDE"));
  assert.ok(cardsInColumn(board, "已結案").some((c) => c.id === "DEMO-MERGED"));
});

test("needs_pol and unknown column priority", () => {
  const board = projectBoard(fixtureText, FIXED_NOW).board;
  assert.equal(findCard(board, "DEMO-POL-BUILD")?.column, "等把關");
  assert.equal(findCard(board, "DEMO-POL-MERGED")?.column, "已結案");
  const unknown = findCard(board, "DEMO-UNKNOWN");
  assert.equal(unknown?.column, "待辦");
  assert.match(board.warnings.join(" "), /未知欄位/);
});

test("card fields follow T-board-1 simplified card contract", () => {
  const board = projectBoard(fixtureText, FIXED_NOW).board;
  const build = findCard(board, "DEMO-BUILD")?.card;
  assert.ok(build);
  assert.equal(build.roleLabel, "施工手");
  assert.equal(build.modelLabel, "demo-build-model");
  assert.equal(build.rejectionCount, 1);
  assert.match(build.elapsedLabel, /此狀態約/);
  const plain = boardToPlainText(board);
  assert.match(plain, /DEMO-BUILD/);
  assert.doesNotMatch(plain, /herdr-ops/);
});

test("reject sum ignores invalid entries", () => {
  const warnings = [];
  assert.equal(sumRejectCounts({ a: 2, b: 1, bad: "x", neg: -1, str: "3" }, warnings), 3);
  assert.ok(warnings.length >= 2);
});

test("formatElapsed boundary seconds", () => {
  const base = Date.parse("2026-11-04T08:00:00.000Z");
  const mk = (sec) => formatElapsed(new Date(base - sec * 1000).toISOString(), base, []);
  assert.match(mk(59), /不足 1 分/);
  assert.match(mk(60), /1 分/);
  assert.match(mk(3599), /59 分/);
  assert.match(mk(3600), /1 小時/);
  assert.match(mk(86399), /23 小時/);
  assert.match(mk(86400), /1 天/);
});

test("formatElapsed rejects missing timezone and future times", () => {
  const warnings = [];
  assert.equal(formatElapsed("2026-11-04T08:00:00", FIXED_NOW, warnings), "時間未知");
  assert.equal(formatElapsed("2026-11-04T09:00:00.000Z", FIXED_NOW, warnings), "此狀態約 不足 1 分（依更新時間）");
  assert.ok(warnings.some((w) => w.includes("未來") || w.includes("時區")));
});

test("sanitizeText strips control sequences", () => {
  assert.equal(sanitizeText("a\u001b[31mb\u0007c"), "abc");
});

test("displayWidth treats CJK wider than ASCII", () => {
  assert.ok(displayWidth("中文") > displayWidth("ab"));
});

test("wrapText respects display width", () => {
  const lines = wrapText("abcdefghij", 5);
  assert.ok(lines.length >= 2);
});

test("resolveStatePath precedence and home expansion", () => {
  assert.equal(
    resolveStatePath({ argvState: "/tmp/a.json", envState: "/tmp/b.json", homeDir: "/Users/x" }),
    "/tmp/a.json",
  );
  assert.equal(
    resolveStatePath({ argvState: "", envState: "~/s.json", homeDir: "/Users/x" }),
    "/Users/x/s.json",
  );
});

test("cli --help exits 0 without reading state", async () => {
  const code = await main(["--help"], { HOME: "/tmp/fake-home" });
  assert.equal(code, 0);
});

test("readStateFile and display state transitions", async () => {
  const ok = await readStateFile(fixturePath, FIXED_NOW);
  assert.equal(ok.kind, "valid");
  const ready = nextDisplayState(null, ok);
  assert.equal(ready.kind, "ready");
  const stale = nextDisplayState(ready, { kind: "failed", reason: "missing", message: "找不到狀態檔" });
  assert.equal(stale.kind, "stale");
  const unavailable = nextDisplayState(null, { kind: "failed", reason: "invalid", message: "bad json" });
  assert.equal(unavailable.kind, "unavailable");
});

test("invalid version fails whole board", () => {
  const outcome = projectBoard('{"version":2,"tasks":[]}', FIXED_NOW);
  assert.equal(outcome.kind, "failed");
});

test("empty tasks still yields four visible columns", () => {
  const outcome = projectBoard('{"version":1,"tasks":[]}', FIXED_NOW);
  assert.equal(outcome.kind, "valid");
  assert.equal(outcome.board.columns.every((c) => Array.isArray(c.cards)), true);
});

test("timezone invariance for elapsed label", () => {
  const iso = "2026-11-04T07:00:00.000Z";
  const now = Date.parse("2026-11-04T08:00:00.000Z");
  const a = formatElapsed(iso, now, []);
  const b = formatElapsed(iso, now, []);
  assert.equal(a, b);
  assert.match(a, /1 小時/);
});

test('all states preserve order and strict needs_pol priority', () => {
  const stages=['todo','spec','build','review','decide','pr','merge','merged','closed','unknown'];
  const board=projectBoard(JSON.stringify({tasks:stages.map(column=>({id:column,column,needs_pol:true}))}),FIXED_NOW).board;
  assert.deepEqual(board.columns.map(c=>c.cards.map(x=>x.id)),[
    ['unknown'],[],['todo','spec','build','review','decide','pr','merge'],['merged','closed']]);
  const falseFlag=projectBoard(JSON.stringify({tasks:[{id:'x',column:'build',needs_pol:'true'}]}),FIXED_NOW).board;
  assert.equal(falseFlag.columns[1].cards[0].id,'x');
});
for (const item of [null, 12, 'bad', true, [], {}, {id:12}, {id:' '}, {id:'\x1b[31m'}]) {
  test(`invalid task ${JSON.stringify(item)} is omitted with its own warning`, () => {
    const out = projectBoard(JSON.stringify({tasks:[item]}), FIXED_NOW);
    assert.equal(out.kind, 'valid');
    assert.deepEqual(out.board.columns.map(c => c.cards), [[], [], [], []]);
    assert.deepEqual(out.board.warnings, ['略過缺少 id 的任務']);
  });
}
test('missing fields and terminal data are handled without hidden content', () => {
  const out=projectBoard(JSON.stringify({tasks:[{id:'A',column:'todo',title:'\x1b]8;;https://invalid\x07title\x1b]8;;\x07'}]}),FIXED_NOW);
  assert.equal(out.board.columns[0].cards.length,1);
  assert.equal(out.board.columns[0].cards[0].title,'title');
  assert.equal(out.board.columns[0].cards[0].modelLabel,'未指定');
  assert.deepEqual(out.board.warnings, []);
  assert.equal(projectBoard('{"tasks":{}}',FIXED_NOW).kind,'failed');
  assert.equal(formatElapsed('badZ',FIXED_NOW,[]),'時間未知');
});
test('CLI rejects unknown or incomplete options and non-TTY', async () => {
  assert.equal(await main(['--unknown']),2);
  assert.equal(await main(['--state']),2);
  assert.equal(await main(['--state','--unknown']),2);
  assert.equal(await main(['--state','/nonexistent']),2);
});

test('invalid version values fail through file read, preserve the snapshot and recover', async () => {
  const {mkdtemp, writeFile, rm} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const dir = await mkdtemp(path.join(tmpdir(), 'tui-version-'));
  const file = path.join(dir, 'state.json');
  try {
    for (const payload of [{tasks:[]}, {version:1,tasks:[]}]) {
      await writeFile(file, JSON.stringify(payload));
      assert.equal((await readStateFile(file, FIXED_NOW)).kind, 'valid');
    }
    const ready = nextDisplayState(null, projectBoard(fixtureText, FIXED_NOW));
    for (const version of [null, 2, '1', false, [], {}, {toString:null}]) {
      await writeFile(file, JSON.stringify({version,tasks:[]}));
      const invalid = await readStateFile(file, FIXED_NOW);
      assert.equal(invalid.kind, 'failed', JSON.stringify(version));
      assert.equal(invalid.reason, 'invalid');
      assert.equal(nextDisplayState(null, invalid).kind, 'unavailable');
      const stale = nextDisplayState(ready, invalid);
      assert.equal(stale.kind, 'stale');
      assert.equal(stale.board, ready.board);
      assert.equal(stale.lastReadAt, ready.readAt);
      await writeFile(file, fixtureText);
      const recovered = nextDisplayState(stale, await readStateFile(file, FIXED_NOW));
      assert.equal(recovered.kind, 'ready');
      assert.deepEqual(recovered.board, ready.board);
    }
  } finally { await rm(dir, {recursive:true,force:true}); }
});
test('null reject count is ignored with a warning on the projected card', () => {
  const out = projectBoard(JSON.stringify({tasks:[{id:'A',column:'todo',reject_counts:{spec:null,build:2}}]}), FIXED_NOW);
  assert.equal(out.board.columns[0].cards[0].rejectionCount, 2);
  assert.ok(out.board.warnings.includes('退回次數「spec」無效，已忽略'));
});
