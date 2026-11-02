import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  boardColumns, cardAction, COLUMNS, commandFor, currentPlace, DEFAULT_ROLES,
  emptyMessage, filterTasks, hcArgv, hcDelivery, makeRequest, mergeAction, openablePath, pendingTasks, PANE_NAME,
  paneChoices, parseConfig, parseState, taskAgent, taskLine,
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

test("gate action requests a lead notification and never mentions git", () => {
  const plan = mergeAction({ id: "T-009\n" }, { leadExists: true });
  assert.deepEqual(plan.hc, ["send", "--if", "idle", "--", "lead", "task T-009 待 herdr cto 把關"]);
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

test("dispatch uses configured commands and an existing pane is an idle send", () => {
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
    ["send", "--if", "idle", "--", "review", "Task T-002"]);
  assert.equal(hcArgv({ exists: true, pane: "--help", command: ["grok"], task: "Task T-001", space: "s1", tab: "t1" }), null);
  assert.equal(PANE_NAME.test("--help"), false);
  assert.equal(PANE_NAME.test("-lead"), false);
  assert.equal(PANE_NAME.test("build-grok"), true);
  const choices = paneChoices({ "--help": ["grok"], "review-2": ["codex"] });
  assert.equal(choices.includes("--help"), false);
  assert.equal(choices.includes("review-2"), true);
});

test("config expands ~ and validates roles", () => {
  const config = parseConfig('{ "state": "~/ops/state.json", "roles": { "build-grok": ["grok", "-m", "grok-4.6"] } }', "/Users/p");
  assert.equal(config.state, "/Users/p/ops/state.json");
  assert.deepEqual(config.roles["build-grok"], ["grok", "-m", "grok-4.6"]);
  assert.deepEqual(config.roles.review, ["codex", "--no-daemon"]);
  assert.equal(emptyMessage("/Users/p/herdr-ops/board/state.json", "/Users/p"), "尚無任務：~/herdr-ops/board/state.json");
  assert.equal(parseConfig("not json", "/h").state, "/h/herdr-ops/board/state.json");

  const configRoles = parseConfig('{ "roles": { "--help": ["grok"], "review-2": ["codex"] } }', "/h");
  assert.equal(configRoles.roles["--help"], undefined);
  assert.deepEqual(configRoles.roles["review-2"], ["codex"]);
});

test("requests carry unknown column hints and pending files are associated with tasks", () => {
  const now = "2026-11-02T00:00:00.000Z";
  const unknown = makeRequest("dispatch", { id: "T-9", column: "unknown" }, "spec", "hello", now);
  assert.deepEqual(unknown, { version: 1, kind: "dispatch", task: "T-9", pane: "spec", instructions: "hello", created_at: now, from: "herdr-board", column_hint: "todo" });
  assert.equal(makeRequest("dispatch", { id: "T-1", column: "todo" }, "spec", "", now).column_hint, undefined);
  const gate = makeRequest("gate", { id: "T-2", column: "merge" }, "lead", "", now);
  assert.deepEqual([...pendingTasks([JSON.stringify(unknown), JSON.stringify(gate), "invalid"])], ["T-9", "T-2"]);
});

test("a launch that did not deliver the first message is not success", () => {
  assert.deepEqual(hcDelivery({ code: 0, stdout: JSON.stringify({ first_message: { sent: false } }) }),
    { ok: false, error: "代理沒有收到第一句任務" });
  assert.equal(hcDelivery({ code: 0, stdout: JSON.stringify({ first_message: { sent: true } }) }).ok, true);
  assert.equal(hcDelivery({ code: 0, stdout: JSON.stringify({ ok: true }) }).ok, true);
  assert.equal(hcDelivery({ code: 3, stderr: JSON.stringify({ error: { message: "no terminal" } }) }).ok, false);
});

test("only a local absolute path or a home path can be opened", () => {
  assert.equal(openablePath("https://example.invalid/a", "/Users/p"), null);
  assert.equal(openablePath("file:///etc/passwd", "/Users/p"), null);
  assert.equal(openablePath("notes.md", "/Users/p"), null);
  assert.equal(openablePath("//share/a", "/Users/p"), null);
  assert.equal(openablePath("/tmp/build.md", "/Users/p"), "/tmp/build.md");
  assert.equal(openablePath("~/ops/a.md", "/Users/p"), "/Users/p/ops/a.md");
});

test("an unknown column is drawn in 待辦 and still offers 派工", () => {
  assert.equal(cardAction("todo"), "dispatch");
  assert.equal(cardAction("spec"), "dispatch");
  assert.equal(cardAction("build"), "dispatch");
  assert.equal(cardAction("review"), "dispatch");
  assert.equal(cardAction("nope"), "dispatch");
  assert.equal(cardAction("merge"), "pol");
  assert.equal(cardAction("decide"), null);
  assert.equal(cardAction("merged"), null);
  const { columns } = boardColumns([{ id: "T-9", column: "nope" }, { id: "T-1", column: "todo" }]);
  assert.deepEqual(columns[0].tasks.map((task) => task.id), ["T-9", "T-1"]);
  assert.equal(cardAction(columns[0].tasks[0].column), "dispatch");
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
