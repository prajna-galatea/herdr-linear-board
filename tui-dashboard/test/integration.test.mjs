import { test } from "node:test";
import assert from "node:assert/strict";
import cp from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectBoard } from "../src/board.mjs";

const fixturePath = fileURLToPath(new URL("../fixtures/state.anonymized.json", import.meta.url));
const FIXED_NOW = Date.parse("2026-11-04T08:00:00.000Z");

test("unknown column with needs_pol and string rejects maps to todo with warnings", () => {
  const payload = JSON.stringify({
    version: 1,
    tasks: [
      {
        id: "EDGE-1",
        title: "edge",
        column: "mystery",
        needs_pol: true,
        reject_counts: { a: "3", b: true },
        updated_at: "2026-11-04T07:00:00.000Z",
      },
    ],
  });
  const board = projectBoard(payload, FIXED_NOW).board;
  const hit = board.columns.find((c) => c.id === "todo")?.cards.find((c) => c.id === "EDGE-1");
  assert.ok(hit);
  assert.equal(hit.rejectionCount, 0);
  assert.match(board.warnings.join(" "), /未知欄位/);
});

test("I/O guard positive controls run in an isolated subprocess", () => {
  const result = cp.spawnSync(process.execPath, [fileURLToPath(new URL("../support/guard-controls.mjs", import.meta.url))], {encoding:"utf8", timeout:10000});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).controls, 13);
});

test("read loop sees file replace with same byte length", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "tui-board-"));
  t.after(() => rm(dir,{recursive:true,force:true}));
  const statePath = path.join(dir, "state.json");
  const base = JSON.stringify({
    version: 1,
    tasks: [{ id: "A", title: "one", column: "todo", updated_at: "2026-11-04T07:00:00.000Z" }],
  });
  await writeFile(statePath, base, "utf8");
  const { readStateFile } = await import("../src/read-loop.mjs");
  const first = await readStateFile(statePath, FIXED_NOW);
  assert.equal(first.board.columns[0].cards[0].title, "one");

  const sameLen = JSON.stringify({
    version: 1,
    tasks: [{ id: "A", title: "two", column: "todo", updated_at: "2026-11-04T07:00:00.000Z" }],
  });
  assert.equal(Buffer.byteLength(sameLen), Buffer.byteLength(base));
  await writeFile(statePath, sameLen, "utf8");
  const second = await readStateFile(statePath, FIXED_NOW);
  assert.equal(second.board.columns[0].cards[0].title, "two");
});
