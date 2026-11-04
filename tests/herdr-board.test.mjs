import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  columnWidthPx, emptyMessage, expandHome, filterTasks, formatDurationInState, herdrFolderPath, isArchived, laneForColumn,
  layoutForWidth, modelsOf, openablePath, parseConfig, parseState, projectBoard, projectTaskDetail,
  rejectTotal, roleLabel, stateEnteredAt, LANES,
} from "../mods/herdr-board/state.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("parseState reads tasks with history and rejects broken JSON", () => {
  const parsed = parseState(JSON.stringify({
    version: 1,
    tasks: [{
      id: "T-010",
      title: "寫看板",
      column: "build",
      pane: "build-grok",
      model: "grok-4.7",
      reject_counts: { "grok-4.7": 1, bad: -1 },
      _d: { history: [{ col: "spec", at: "2026-11-01T10:00:00.000Z" }, { col: "build", at: "2026-11-02T12:00:00.000Z" }] },
    }],
  }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.state.tasks[0].reject_counts["grok-4.7"], 1);
  assert.equal(parsed.state.tasks[0]._d.history.length, 2);
  assert.equal(parseState("{").ok, false);
  assert.equal(parseState("[]").ok, false);
});

test("four lanes map columns independently of expected table", () => {
  const expect = {
    todo: "todo",
    spec: "active",
    build: "active",
    review: "active",
    decide: "gate",
    pr: "gate",
    merge: "gate",
    merged: "closed",
    closed: "closed",
    unknown: "todo",
  };
  for (const [column, lane] of Object.entries(expect)) {
    assert.equal(laneForColumn(column), lane, column);
  }
  const board = projectBoard({
    tasks: [
      { id: "a", column: "todo", title: "t", reject_counts: {} },
      { id: "b", column: "spec", title: "t", reject_counts: {} },
      { id: "c", column: "decide", title: "t", reject_counts: {} },
      { id: "d", column: "merged", title: "t", reject_counts: {} },
      { id: "e", column: "nope", title: "t", reject_counts: {} },
    ],
  }, { archive: "all" });
  assert.deepEqual(board.lanes.map((lane) => lane.id), LANES.map((lane) => lane.id));
  assert.equal(board.lanes[0].cards[0].id, "a");
  assert.equal(board.lanes[0].cards[1].id, "e");
  assert.equal(board.lanes[1].cards[0].id, "b");
  assert.equal(board.lanes[2].cards[0].id, "c");
  assert.equal(board.lanes[3].cards[0].id, "d");
  assert.match(board.warnings[0], /未知欄位「nope」/);
});

test("card surface shows one reject total and detail holds history", () => {
  const task = {
    id: "T-020",
    title: "卡",
    column: "review",
    pane: "review",
    model: "m1",
    reject_counts: { a: 2, b: 1 },
    spec_rewrites: 3,
    _d: { history: [{ col: "review", at: "2026-11-02T00:00:00.000Z" }] },
    results: { review: "/tmp/r.md" },
    repo: "/tmp/repo",
  };
  const now = Date.parse("2026-11-02T01:00:00.000Z");
  const board = projectBoard({ tasks: [task] }, {}, now);
  const card = board.lanes[1].cards[0];
  assert.equal(card.rejectTotal, 3);
  assert.equal(card.roleLabel, "審查手");
  assert.equal(card.durationLabel, "1 小時");
  const detail = projectTaskDetail(task, now, "/Users/p");
  assert.equal(detail.rejectLines.length, 2);
  assert.equal(detail.specRewrites, 3);
  assert.equal(detail.history.length, 1);
  assert.equal(detail.resultLinks[0].path, "/tmp/r.md");
});

test("duration uses history not updated_at and handles invalid times", () => {
  const task = { id: "T-1", column: "todo", updated_at: "2026-11-05T00:00:00.000Z", _d: { history: [{ col: "todo", at: "2026-11-02T00:00:00.000Z" }] }, reject_counts: {} };
  const now = Date.parse("2026-11-02T00:00:30.000Z");
  assert.equal(formatDurationInState(task, now), "不到 1 分鐘");
  assert.equal(formatDurationInState({ id: "T-2", column: "todo", reject_counts: {}, _d: {} }, now), "時間未知");
  assert.equal(formatDurationInState({ id: "T-3", column: "todo", reject_counts: {}, _d: { history: [{ col: "todo", at: "2099-01-01T00:00:00.000Z" }] } }, now), "時間未知");
});

test("archive filter hides merged and example T-001..T-003 by default", () => {
  const tasks = [
    { id: "T-001", column: "todo", example: true, reject_counts: {} },
    { id: "T-100", column: "merged", reject_counts: {} },
    { id: "T-200", column: "build", reject_counts: {} },
    { id: "T-004", column: "todo", example: true, reject_counts: {} },
  ];
  assert.equal(isArchived(tasks[0]), true);
  assert.equal(isArchived(tasks[3]), true);
  const active = projectBoard({ tasks }, { archive: "active" });
  assert.deepEqual(active.lanes.flatMap((lane) => lane.cards.map((c) => c.id)).sort(), ["T-200"]);
  const archived = projectBoard({ tasks }, { archive: "archived" });
  assert.deepEqual(archived.lanes.flatMap((lane) => lane.cards.map((c) => c.id)).sort(), ["T-001", "T-004", "T-100"]);
});

test("reject counts ignore non-integers and missing column warns", () => {
  const parsed = parseState(JSON.stringify({
    version: 1,
    tasks: [
      { id: "T-x", title: "no col", reject_counts: { a: 1.5, b: "2", c: 2 } },
    ],
  }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.state.tasks[0].reject_counts.a, undefined);
  assert.equal(parsed.state.tasks[0].reject_counts.b, undefined);
  assert.equal(parsed.state.tasks[0].reject_counts.c, 2);
  assert.equal(rejectTotal(parsed.state.tasks[0]), 2);
  const board = projectBoard({ tasks: parsed.state.tasks }, { archive: "all" });
  assert.match(board.warnings[0], /缺少 column/);
});

test("contradictory history yields unknown duration", () => {
  const task = {
    id: "T-c",
    column: "build",
    reject_counts: {},
    _d: {
      history: [
        { col: "spec", at: "2026-11-01T00:00:00.000Z" },
        { col: "review", at: "2026-11-02T00:00:00.000Z" },
        { col: "build", at: "2026-11-03T00:00:00.000Z" },
      ],
    },
  };
  assert.equal(stateEnteredAt(task), "2026-11-03T00:00:00.000Z");
  const bad = { ...task, _d: { history: [{ col: "spec", at: "2026-11-01T00:00:00.000Z" }, { col: "review", at: "2026-11-02T00:00:00.000Z" }] } };
  assert.equal(stateEnteredAt(bad), null);
  const now = Date.parse("2026-11-05T00:00:00.000Z");
  assert.equal(formatDurationInState(bad, now), "時間未知");
});

test("herdr folder path rejects traversal in task id", () => {
  assert.equal(herdrFolderPath({ id: "../outside", repo: "/tmp/repo" }, "/tmp"), null);
  assert.equal(herdrFolderPath({ id: "T-1", repo: "/tmp/repo" }, "/tmp"), "/tmp/repo/.herdr/T-1");
});

test("layout breakpoints at 479/480/959/960 logical pixels", () => {
  assert.equal(layoutForWidth(479).columnsPerRow, 1);
  assert.equal(layoutForWidth(480).columnsPerRow, 2);
  assert.equal(layoutForWidth(959).columnsPerRow, 2);
  assert.equal(layoutForWidth(960).columnsPerRow, 4);
  const w = columnWidthPx(960, 4, 12, 24);
  assert.ok(w >= 120);
  assert.ok(w * 4 + 12 * 3 + 24 <= 960);
});

test("config expands ~ for state path only", () => {
  const config = parseConfig('{ "state": "~/ops/state.json", "roles": { "x": ["y"] } }', "/Users/p");
  assert.equal(config.state, "/Users/p/ops/state.json");
  assert.equal(emptyMessage("/Users/p/herdr-ops/board/state.json", "/Users/p"), "尚無任務：~/herdr-ops/board/state.json");
});

test("openable paths refuse URLs and relative paths", () => {
  assert.equal(openablePath("https://example.invalid/a", "/Users/p"), null);
  assert.equal(openablePath("notes.md", "/Users/p"), null);
  assert.equal(openablePath("/tmp/build.md", "/Users/p"), "/tmp/build.md");
  assert.equal(openablePath("~/ops/a.md", "/Users/p"), "/Users/p/ops/a.md");
});

test("main board source has no hc writes or pane splits", () => {
  const board = read("../mods/herdr-board/main.js");
  const state = read("../mods/herdr-board/state.js");
  const open = read("../mods/herdr-board/open.js");
  assert.doesNotMatch(board, /\bhc\s*\(/);
  assert.doesNotMatch(board, /import\s*\{[^}]*\bhc\b/);
  assert.doesNotMatch(board, /writeTextFile/);
  assert.doesNotMatch(board, /openOverlay/);
  assert.doesNotMatch(board, /\brun\s*\(/);
  for (const source of [board, state, open]) {
    assert.doesNotMatch(source, /\bgit\b/);
    assert.doesNotMatch(source, /claude/);
    assert.doesNotMatch(source, /Linear/);
  }
});

test("rejectTotal sums non-negative counts only", () => {
  assert.equal(rejectTotal({ reject_counts: { a: 1, b: 0, c: -3, d: 2 } }), 3);
});

test("roleLabel maps pane prefixes", () => {
  assert.equal(roleLabel(""), "未指派");
  assert.equal(roleLabel("spec"), "規格師");
  assert.equal(roleLabel("build-grok"), "施工手");
  assert.equal(roleLabel("custom-pane"), "custom-pane");
});

test("stateEnteredAt picks last matching column entry", () => {
  const task = {
    column: "build",
    _d: {
      history: [
        { col: "spec", at: "2026-11-01T00:00:00.000Z" },
        { col: "build", at: "2026-11-02T00:00:00.000Z" },
        { col: "build", at: "2026-11-03T00:00:00.000Z" },
      ],
    },
  };
  assert.equal(stateEnteredAt(task), "2026-11-03T00:00:00.000Z");
});

test("filter and model chips respect archive mode", () => {
  const tasks = [
    { id: "T-1", title: "alpha", model: "m1", column: "todo", reject_counts: {} },
    { id: "T-2", title: "beta", model: "m1", column: "merged", reject_counts: {} },
  ];
  assert.deepEqual(filterTasks(tasks, "alpha", null, "active").map((t) => t.id), ["T-1"]);
  assert.equal(modelsOf(tasks, "active").length, 1);
  assert.equal(modelsOf(tasks, "all").length, 1);
});

test('v2 producer history, strict counts, roles and timezone rules', () => {
  const task = parseState(JSON.stringify({tasks:[{id:'T-real',column:'build',pane:'spec-sol',example:'true',reject_counts:{a:2,b:'3',c:1.2,d:-1,e:true},_d:{history:[{col:'build',at:'2026-11-04T08:00:00+08:00',note:'keep'}]}}]})).state.tasks[0];
  assert.equal(rejectTotal(task),2);assert.equal(isArchived(task),false);assert.equal(roleLabel(task.pane),'規格師');
  assert.equal(formatDurationInState(task,Date.parse('2026-11-04T01:00:00Z')),'1 小時');
  for(const tail of [null,{col:'review',at:'2026-11-04T00:00:00Z'},{col:'build',at:'2026-11-04T00:00:00'},{col:'build',at:'invalid'}]) {
    assert.equal(formatDurationInState({...task,_d:{history:[...task._d.history,tail]}},Date.parse('2026-11-04T01:00:00Z')),'時間未知');
  }
});
test('invalid config and unsafe local paths fail explicitly',()=>{
 for(const value of ['{','[]','{"state":"relative"}','{"state":"https://invalid"}'])assert.throws(()=>parseConfig(value,'/tmp/home'));
 for(const path of ['//server/share','/tmp/a\nfile','../x'])assert.equal(openablePath(path,'/tmp/home'),null);
 assert.equal(herdrFolderPath({id:'.',repo:'/tmp/repo'},'/tmp'),null);
});
test('source path controls remain invalid after parsing',()=>{
 const t=parseState(JSON.stringify({tasks:[{id:'T-safe',column:'build',results:{build:'/tmp/report\n'},_d:{root:'/tmp/repo\n'}}]})).state.tasks[0];
 assert.equal(openablePath(t.results.build,'/tmp'),null);assert.equal(herdrFolderPath(t,'/tmp'),null);
});
