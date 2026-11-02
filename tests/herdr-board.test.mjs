import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyPatch, boardColumns, COLUMNS, commandFor, currentPlace, DEFAULT_ROLES, dispatchPatch,
  emptyMessage, filterTasks, hcArgv, mergeAction, parseConfig, parseState, taskAgent, taskLine,
} from "../mods/herdr-board/state.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("parseState reads a task and rejects broken JSON without inventing a board", () => {
  const parsed = parseState(JSON.stringify({
    version: 1,
    updated_at: "2026-11-02T00:00:00.000Z",
    tasks: [{ id: "T-001", title: "寫看板", column: "build", pane: "build-grok", model: "grok-4.7", reject_counts: { "grok-4.7": 1 }, spec_rewrites: 2, results: { build: "/tmp/build.md" }, needs_pol: false, example: true }],
  }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.state.tasks[0].pane, "build-grok");
  assert.equal(parsed.state.tasks[0].reject_counts["grok-4.7"], 1);
  assert.equal(parsed.state.tasks[0].results.build, "/tmp/build.md");
  const broken = parseState("{");
  assert.equal(broken.ok, false);
  assert.match(broken.error, /JSON/);
  assert.equal(parseState("[]").ok, false);
  assert.equal(parseState(JSON.stringify({ version: 2, tasks: [] })).ok, false);
});

test("unknown columns land in 待辦 and every column stays, in order", () => {
  const { columns, warnings } = boardColumns([
    { id: "T-1", column: "merged" },
    { id: "T-2", column: "nope" },
    { id: "T-3", column: "todo" },
  ]);
  assert.deepEqual(columns.map((column) => column.id), COLUMNS.map((column) => column.id));
  assert.deepEqual(columns[0].tasks.map((task) => task.id), ["T-2", "T-3"]);
  assert.equal(columns[1].tasks.length, 0);
  assert.equal(columns.at(-1).tasks[0].id, "T-1");
  assert.match(warnings[0], /未知欄位「nope」的 T-2 已放進待辦/);
});

test("taskLine is one line, keeps the id, title and result paths, and strips controls", () => {
  const line = taskLine({
    id: "T-001",
    title: "壞掉\n的\u0003標題",
    repo: "~/repo",
    results: { spec: "/tmp/a\nb", build: "", review: "/tmp/c" },
  }, "請\n看");
  assert.equal(line.includes("\n"), false);
  assert.equal(line.includes("\u0003"), false);
  assert.match(line, /Task T-001: 壞掉 的 標題/);
  assert.match(line, /Repo: ~\/repo/);
  assert.match(line, /spec=\/tmp\/a b/);
  assert.match(line, /review=\/tmp\/c/);
  assert.doesNotMatch(line, /build=/);
  assert.match(line, /Instructions: 請 看/);
  assert.match(line, /Use only herdr-app and hc/);
  assert.match(line, /Do not merge, push or deploy/);
});

test("merge action moves the task to decide and never mentions git", () => {
  const plan = mergeAction({ id: "T-009\n" }, { leadExists: true });
  assert.deepEqual(plan.patch, { column: "decide", needs_pol: true });
  assert.deepEqual(plan.hc, ["send", "--if", "idle", "lead", "task T-009 請示 Pol哥 是否合併"]);
  assert.equal(JSON.stringify(plan).includes("git"), false);
  assert.equal(plan.hc.includes("merge"), false);
  assert.equal(mergeAction({ id: "T-001" }, { leadExists: false }).hc, null);

  const board = read("../mods/herdr-board/main.js");
  const dialog = read("../mods/herdr-board-agent/main.js");
  const state = read("../mods/herdr-board/state.js");
  const open = read("../mods/herdr-board/open.js");
  for (const source of [board, dialog, open]) assert.doesNotMatch(source, /\bgit\b/);
  for (const source of [board, dialog, state, open]) {
    assert.doesNotMatch(source, /claude/);
    assert.doesNotMatch(source, /Linear/);
  }
});

test("the example file has one example task in every column", () => {
  const parsed = parseState(read("../examples/state.example.json"));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.state.tasks.map((task) => task.column), COLUMNS.map((column) => column.id));
  for (const task of parsed.state.tasks) {
    assert.equal(task.example, true);
    assert.match(task.title, /^\[範例\]/);
  }
});

test("dispatch from 待辦 sets the column, and an existing pane is an idle send", () => {
  assert.deepEqual(dispatchPatch({ column: "todo" }, "build-grok"), { pane: "build-grok", column: "build" });
  assert.deepEqual(dispatchPatch({ column: "todo" }, "spec"), { pane: "spec", column: "spec" });
  assert.deepEqual(dispatchPatch({ column: "todo" }, "review-2"), { pane: "review-2", column: "review" });
  assert.deepEqual(dispatchPatch({ column: "build" }, "build-grok"), { pane: "build-grok" });
  assert.deepEqual(commandFor("build-grok"), ["grok", "-m", "grok-4.7"]);
  assert.deepEqual(commandFor("review"), ["codex", "--no-daemon"]);
  assert.deepEqual(hcArgv({
    exists: false, pane: "build-grok", command: DEFAULT_ROLES["build-grok"], task: "Task T-001", space: "s1", tab: "t1",
  }), [
    "run", "--bg", "--name", "build-grok", "--keep",
    "--label", "herdr.space=s1", "--label", "herdr.tab=t1",
    "--", "grok", "-m", "grok-4.7", "Task T-001",
  ]);
  assert.deepEqual(hcArgv({ exists: true, pane: "review", command: ["codex"], task: "Task T-002", space: "s1", tab: "t1" }),
    ["send", "--if", "idle", "review", "Task T-002"]);
});

test("config expands ~ and a patch touches only the one task", () => {
  const config = parseConfig('{ "state": "~/ops/state.json", "roles": { "build-grok": ["grok", "-m", "grok-4.6"] } }', "/Users/p");
  assert.equal(config.state, "/Users/p/ops/state.json");
  assert.deepEqual(config.roles["build-grok"], ["grok", "-m", "grok-4.6"]);
  assert.deepEqual(config.roles.review, ["codex", "--no-daemon"]);
  assert.equal(emptyMessage("/Users/p/herdr-ops/board/state.json", "/Users/p"), "尚無任務：~/herdr-ops/board/state.json");
  assert.equal(parseConfig("not json", "/h").state, "/h/herdr-ops/board/state.json");

  const state = parseState(JSON.stringify({ version: 1, tasks: [{ id: "T-001", title: "a", column: "todo" }, { id: "T-002", title: "b", column: "build" }] })).state;
  const next = applyPatch(state, "T-001", { pane: "spec", column: "spec", title: "nope" }, "2026-11-02T00:00:00.000Z");
  assert.equal(next.ok, true);
  assert.equal(next.state.tasks[0].column, "spec");
  assert.equal(next.state.tasks[0].title, "a");
  assert.equal(next.state.tasks[1].column, "build");
  assert.equal(next.state.updated_at, "2026-11-02T00:00:00.000Z");
});

test("filter matches id or title, and an agent matches the pane name then the task id", () => {
  const tasks = [{ id: "T-001", title: "寫看板", model: "grok-4.7" }, { id: "T-002", title: "別的", model: "" }];
  assert.deepEqual(filterTasks(tasks, "看板").map((task) => task.id), ["T-001"]);
  assert.deepEqual(filterTasks(tasks, "t-002").map((task) => task.id), ["T-002"]);
  const agents = [
    { address: "t9", pane: "p9", tab_name: "T-002 notes", space_name: "ops", status: "idle" },
    { address: "box/t1m", pane: "p1", tab_name: "other", space_name: "ops", status: "working" },
  ];
  const terminals = [{ name: "build-grok", address: "t1m" }];
  assert.equal(taskAgent({ id: "T-004", pane: "build-grok" }, agents, terminals).address, "box/t1m");
  assert.equal(taskAgent({ id: "T-002", pane: "" }, agents, terminals).tab_name, "T-002 notes");
  assert.deepEqual(currentPlace(null, [{ id: "mac/s1", active: true, tabs: [{ id: "mac/tab2", active: true }] }]), { space: "s1", tab: "tab2" });
});
