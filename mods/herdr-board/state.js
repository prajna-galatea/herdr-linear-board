// Pure helpers for the local Herdr board. No Herdr imports, so `node --test` can load this file.

export const COLUMNS = [
  { id: "todo", name: "待辦" },
  { id: "decide", name: "等Pol哥決定" },
  { id: "spec", name: "規格師" },
  { id: "build", name: "施工手" },
  { id: "review", name: "審查手" },
  { id: "merge", name: "合併手" },
  { id: "merged", name: "已合併" },
];

export const DEFAULT_STATE = "~/herdr-ops/board/state.json";

// Commands used when herdr-board.json does not name the pane. No network and no git.
export const DEFAULT_ROLES = {
  lead: ["grok"],
  spec: ["grok"],
  dispatch: ["grok"],
  build: ["grok"],
  "build-grok": ["grok", "-m", "grok-4.7"],
  "build-deepseek": ["grok"],
  "build-glm": ["grok"],
  review: ["codex", "--no-daemon"],
  merge: ["grok"],
};

// Panes the dispatch dialog offers before any extra names in config.
export const PICK_PANES = ["spec", "build", "build-grok", "build-deepseek", "build-glm", "review", "merge"];

const PANE_NAME = /^[a-z0-9_-]{1,32}$/;
const RESULT_KEYS = ["spec", "build", "review"];
const PATCH_KEYS = ["column", "pane", "needs_pol"];
const AGENT_RANK = { blocked: 3, done: 2, working: 1, idle: 0 };

export function expandHome(path, homeDir) {
  const text = String(path ?? "");
  if (text === "~") return homeDir || text;
  if (text.startsWith("~/")) return `${homeDir || ""}${text.slice(1)}`;
  return text;
}

export function displayPath(path, homeDir) {
  const text = String(path ?? "");
  if (homeDir && (text === homeDir || text.startsWith(`${homeDir}/`))) return `~${text.slice(homeDir.length)}`;
  return text;
}

export function emptyMessage(statePath, homeDir) {
  return `尚無任務：${displayPath(statePath, homeDir)}`;
}

function roleTable(overrides) {
  const roles = {};
  for (const [key, value] of Object.entries(DEFAULT_ROLES)) roles[key] = value.slice();
  if (!overrides || typeof overrides !== "object") return roles;
  for (const [key, value] of Object.entries(overrides)) {
    if (!Array.isArray(value) || !value.length) continue;
    const args = [];
    let ok = true;
    for (const part of value) {
      if (typeof part !== "string" || !part) { ok = false; break; }
      args.push(part);
    }
    if (ok) roles[key] = args;
  }
  return roles;
}

export function parseConfig(text, homeDir) {
  let raw = {};
  if (text && String(text).trim()) {
    try { raw = JSON.parse(text); } catch { raw = {}; }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) raw = {};
  const state = expandHome(typeof raw.state === "string" && raw.state.trim() ? raw.state.trim() : DEFAULT_STATE, homeDir);
  return { state, roles: roleTable(raw.roles) };
}

function asTask(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) return null;
  const reject = {};
  if (raw.reject_counts && typeof raw.reject_counts === "object") {
    for (const [key, value] of Object.entries(raw.reject_counts)) {
      const count = Number(value);
      if (Number.isFinite(count) && count > 0) reject[key] = count;
    }
  }
  const results = {};
  if (raw.results && typeof raw.results === "object") {
    for (const key of RESULT_KEYS) {
      if (typeof raw.results[key] === "string" && raw.results[key].trim()) results[key] = raw.results[key].trim();
    }
  }
  return {
    id,
    title: typeof raw.title === "string" ? raw.title : "",
    column: typeof raw.column === "string" && raw.column ? raw.column : "todo",
    pane: typeof raw.pane === "string" ? raw.pane : "",
    model: typeof raw.model === "string" ? raw.model : "",
    repo: typeof raw.repo === "string" ? raw.repo : "",
    reject_counts: reject,
    spec_rewrites: Number.isFinite(Number(raw.spec_rewrites)) ? Number(raw.spec_rewrites) : 0,
    results,
    needs_pol: Boolean(raw.needs_pol),
    example: Boolean(raw.example),
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : "",
  };
}

export function parseState(text) {
  let raw;
  try { raw = JSON.parse(text); }
  catch { return { ok: false, error: "狀態檔不是合法的 JSON" }; }
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.tasks)) return { ok: false, error: "狀態檔缺少 tasks" };
  if (raw.version != null && raw.version !== 1) return { ok: false, error: `不支援的 version ${raw.version}` };
  const tasks = [];
  for (const item of raw.tasks) {
    const task = asTask(item);
    if (task) tasks.push(task);
  }
  return {
    ok: true,
    state: { version: 1, updated_at: typeof raw.updated_at === "string" ? raw.updated_at : "", tasks },
  };
}

export function boardColumns(tasks) {
  const buckets = new Map();
  for (const column of COLUMNS) buckets.set(column.id, []);
  const warnings = [];
  for (const task of tasks ?? []) {
    if (buckets.has(task.column)) buckets.get(task.column).push(task);
    else {
      buckets.get("todo").push(task);
      warnings.push(`未知欄位「${task.column}」的 ${task.id} 已放進待辦`);
    }
  }
  const columns = [];
  for (const column of COLUMNS) columns.push({ id: column.id, name: column.name, tasks: buckets.get(column.id) });
  return { columns, warnings };
}

export function filterTasks(tasks, text, model = null) {
  const needle = String(text ?? "").trim().toLowerCase();
  const found = [];
  for (const task of tasks ?? []) {
    if (model != null && (task.model || "") !== model) continue;
    if (needle && !`${task.id} ${task.title}`.toLowerCase().includes(needle)) continue;
    found.push(task);
  }
  return found;
}

function modelAfter(a, b) {
  if (!a.name && b.name) return true;
  if (a.name && !b.name) return false;
  if (a.count !== b.count) return a.count < b.count;
  return a.name > b.name;
}

export function modelsOf(tasks) {
  const counts = new Map();
  for (const task of tasks ?? []) {
    const name = task.model || "";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const models = [];
  for (const [name, count] of counts) models.push({ name, count });
  for (let i = 1; i < models.length; i++) {
    const item = models[i];
    let j = i - 1;
    for (; j >= 0 && modelAfter(models[j], item); j--) models[j + 1] = models[j];
    models[j + 1] = item;
  }
  return models;
}

export function resultPath(task) {
  const results = task?.results ?? {};
  if ((task?.column === "spec" || task?.column === "build" || task?.column === "review") && results[task.column]) return results[task.column];
  return results.review || results.build || results.spec || null;
}

export function openablePath(path, homeDir) {
  const text = String(path ?? "").trim();
  if (!text || text.startsWith("-") || /[\u0000-\u001f\u007f]/.test(text)) return null;
  return expandHome(text, homeDir);
}

function sameAddress(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.slice(a.lastIndexOf("/") + 1) === b.slice(b.lastIndexOf("/") + 1);
}

export function taskAgent(task, agentList, terminalList) {
  const agents = agentList ?? [];
  const terminals = terminalList ?? [];
  if (task?.pane) {
    for (const term of terminals) {
      if (term?.name !== task.pane) continue;
      for (const agent of agents) {
        if (sameAddress(agent.address, term.address)) return agent;
      }
    }
  }
  const id = task?.id;
  if (!id) return null;
  let best = null;
  for (const agent of agents) {
    const hay = `${agent.tab_name ?? ""} ${agent.space_name ?? ""}`;
    if (!hay.includes(id)) continue;
    if (!best || (AGENT_RANK[agent.status] ?? -1) > (AGENT_RANK[best.status] ?? -1)) best = agent;
  }
  return best;
}

// One line for a terminal: control characters and runs of whitespace become a single space.
export function plain(text) {
  return String(text ?? "").replace(/[\u0000-\u001f\u007f-\u009f\s]+/g, " ").trim();
}

export function taskLine(task, instructions = "") {
  const results = task?.results ?? {};
  const paths = [];
  for (const key of RESULT_KEYS) if (results[key]) paths.push(`${key}=${plain(results[key])}`);
  const extra = plain(instructions);
  return plain([
    `Task ${plain(task?.id)}: ${plain(task?.title)}.`,
    task?.repo ? `Repo: ${plain(task.repo)}.` : "",
    paths.length ? `Results: ${paths.join(" ")}.` : "",
    extra ? `Instructions: ${extra}.` : "",
    "Use only herdr-app and hc.",
    "Do not merge, push or deploy.",
  ].filter(Boolean).join(" "));
}

export function defaultPane(column) {
  if (column === "build") return "build-grok";
  if (column === "review") return "review";
  if (column === "merge") return "merge";
  return "spec";
}

export function paneChoices(roles) {
  const list = [];
  const seen = new Set();
  const add = (name) => {
    if (!PANE_NAME.test(name) || seen.has(name) || name === "lead" || name === "dispatch") return;
    seen.add(name);
    list.push(name);
  };
  for (const name of PICK_PANES) add(name);
  for (const name of Object.keys(roles ?? {})) add(name);
  return list;
}

export function columnForPane(pane) {
  if (pane === "spec") return "spec";
  if (pane === "merge") return "merge";
  if (pane === "review" || String(pane).startsWith("review-")) return "review";
  if (pane === "build" || String(pane).startsWith("build-")) return "build";
  return null;
}

// From 待辦, the task moves into the column of the pane that was chosen. Other columns keep their place.
export function dispatchPatch(task, pane) {
  const patch = { pane };
  if (task?.column === "todo") {
    const column = columnForPane(pane);
    if (column) patch.column = column;
  }
  return patch;
}

export function commandFor(pane, roles = DEFAULT_ROLES) {
  const listed = roles?.[pane];
  if (Array.isArray(listed) && listed.length) return listed.slice();
  if (pane === "review" || String(pane).startsWith("review-")) return (roles?.review ?? DEFAULT_ROLES.review).slice();
  if (pane === "build" || String(pane).startsWith("build-")) return (roles?.["build-grok"] ?? DEFAULT_ROLES["build-grok"]).slice();
  return ["grok"];
}

export function hcArgv({ exists, pane, command, task, space, tab, cwd }) {
  const line = plain(task);
  if (exists) return ["send", "--if", "idle", pane, line];
  const args = ["run", "--bg", "--name", pane, "--keep"];
  if (space) args.push("--label", `herdr.space=${space}`);
  if (tab) args.push("--label", `herdr.tab=${tab}`);
  if (cwd) args.push("--cwd", cwd);
  args.push("--");
  for (const part of command ?? []) args.push(part);
  args.push(line);
  return args;
}

// The merge column asks Pol. It never runs git, and it never merges.
export function mergeAction(task, { leadExists = false } = {}) {
  return {
    patch: { column: "decide", needs_pol: true },
    hc: leadExists ? ["send", "--if", "idle", "lead", `task ${plain(task?.id)} 請示 Pol哥 是否合併`] : null,
  };
}

export function applyPatch(state, id, fields, now) {
  const allowed = {};
  for (const key of PATCH_KEYS) if (fields?.[key] !== undefined) allowed[key] = fields[key];
  let found = false;
  const tasks = [];
  for (const task of state?.tasks ?? []) {
    if (task.id !== id) { tasks.push(task); continue; }
    found = true;
    tasks.push({ ...task, ...allowed, updated_at: now });
  }
  if (!found) return { ok: false, error: `找不到任務 ${id}` };
  return { ok: true, state: { ...state, version: 1, updated_at: now, tasks } };
}

const MONTHS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
export function shortDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${MONTHS[date.getMonth()]}月${date.getDate()}日`;
}

export function localId(id) {
  const text = String(id ?? "");
  const slash = text.indexOf("/");
  return slash === -1 ? text : text.slice(slash + 1);
}

export function currentPlace(focus, spaceList) {
  if (focus?.space && focus?.tab) return { space: localId(focus.space), tab: localId(focus.tab) };
  let active = null;
  for (const space of spaceList ?? []) if (space.active) active = space;
  if (!active) return { space: "", tab: "" };
  let tab = "";
  for (const item of active.tabs ?? []) if (item.active) tab = item.id;
  if (!tab && active.tabs?.length) tab = active.tabs[0].id;
  return { space: localId(active.id), tab: localId(tab) };
}
