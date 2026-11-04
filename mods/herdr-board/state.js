// Pure helpers for the read-only Herdr board. No Herdr imports — `node --test` loads this file.

export const DEFAULT_STATE = "~/herdr-ops/board/state.json";

export const LANES = [
  { id: "todo", name: "待辦" },
  { id: "active", name: "進行中" },
  { id: "gate", name: "等把關" },
  { id: "closed", name: "已結案" },
];

/** @typedef {"active" | "archived" | "all"} ArchiveFilter */

const GATE_COLUMNS = new Set(["decide", "pr", "merge"]);
const ACTIVE_COLUMNS = new Set(["spec", "build", "review"]);
const CLOSED_COLUMNS = new Set(["merged", "closed"]);
const EXAMPLE_ARCHIVE_IDS = new Set(["T-001", "T-002", "T-003"]);
const RESULT_KEYS = ["spec", "build", "review"];
const ROLE_LABELS = {
  lead: "Lead",
  dispatch: "派工",
  spec: "規格師",
  build: "施工手",
  review: "審查手",
  merge: "合併手",
};

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

export function parseConfig(text, homeDir) {
  const raw = text == null ? {} : JSON.parse(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("設定格式無效");
  const state = openablePath(raw.state === undefined ? DEFAULT_STATE : raw.state, homeDir);
  if (!state) throw new Error("狀態路徑無效");
  return { state };
}

function asTask(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) return null;
  const reject = {};
  if (raw.reject_counts && typeof raw.reject_counts === "object") {
    for (const [key, value] of Object.entries(raw.reject_counts)) {
      const count = value;
      if (Number.isInteger(count) && count >= 0) reject[key] = count;
    }
  }
  const results = {};
  if (raw.results && typeof raw.results === "object") {
    for (const key of RESULT_KEYS) {
      if (typeof raw.results[key] === "string" && raw.results[key].trim()) results[key] = raw.results[key];
    }
  }
  const meta = raw._d && typeof raw._d === "object" && !Array.isArray(raw._d) ? raw._d : {};
  const rawColumn = typeof raw.column === "string" ? raw.column : "";
  const column = rawColumn ? rawColumn : "todo";
  return {
    id,
    title: typeof raw.title === "string" ? raw.title : "",
    column,
    columnMissing: !rawColumn,
    pane: typeof raw.pane === "string" ? raw.pane : "",
    model: typeof raw.model === "string" ? raw.model : "",
    repo: typeof raw.repo === "string" ? raw.repo : "",
    reject_counts: reject,
    spec_rewrites: Number.isFinite(Number(raw.spec_rewrites)) ? Number(raw.spec_rewrites) : 0,
    results,
    needs_pol: Boolean(raw.needs_pol),
    example: raw.example === true,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : "",
    _d: meta,
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

export function laneForColumn(column) {
  const col = String(column ?? "todo");
  if (col === "todo") return "todo";
  if (ACTIVE_COLUMNS.has(col)) return "active";
  if (GATE_COLUMNS.has(col)) return "gate";
  if (CLOSED_COLUMNS.has(col)) return "closed";
  return "todo";
}

export function isArchived(task) {
  if (!task) return false;
  if (CLOSED_COLUMNS.has(task.column)) return true;
  if (task.example) return true;
  if (EXAMPLE_ARCHIVE_IDS.has(task.id)) return true;
  return false;
}

export function rejectTotal(task) {
  let sum = 0;
  for (const value of Object.values(task?.reject_counts ?? {})) {
    const n = value;
    if (Number.isInteger(n) && n >= 0) sum += n;
  }
  return sum;
}

export function roleLabel(pane) {
  const name = String(pane ?? "").trim();
  if (!name) return "未指派";
  if (ROLE_LABELS[name]) return ROLE_LABELS[name];
  if (name.startsWith("spec-")) return "規格師";
  if (name.startsWith("build-")) return "施工手";
  if (name.startsWith("review-")) return "審查手";
  return name;
}

function historyEntries(task) {
  const list = task?._d?.history;
  return Array.isArray(list) ? list : [];
}

export function stateEnteredAt(task) {
  const tail = historyEntries(task).at(-1);
  if (!tail || tail.col !== task?.column || typeof tail.at !== "string") return null;
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(tail.at) || !Number.isFinite(Date.parse(tail.at))) return null;
  return tail.at;
}

export function formatDurationInState(task, nowMs = Date.now()) {
  const at = stateEnteredAt(task);
  if (!at) return "時間未知";
  const start = Date.parse(at);
  if (Number.isNaN(start) || start > nowMs) return "時間未知";
  const diffMs = nowMs - start;
  if (diffMs < 60_000) return "不到 1 分鐘";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時`;
  const days = Math.floor(hours / 24);
  return `${days} 天`;
}

export function filterTasks(tasks, text, model = null, archive = "active") {
  const needle = String(text ?? "").trim().toLowerCase();
  const found = [];
  for (const task of tasks ?? []) {
    if (archive === "active" && isArchived(task)) continue;
    if (archive === "archived" && !isArchived(task)) continue;
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

export function modelsOf(tasks, archive = "active") {
  const counts = new Map();
  for (const task of tasks ?? []) {
    if (archive === "active" && isArchived(task)) continue;
    if (archive === "archived" && !isArchived(task)) continue;
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

function cardViewModel(task, nowMs) {
  return {
    id: task.id,
    title: task.title,
    roleLabel: roleLabel(task.pane),
    modelLabel: task.model ? task.model : "未標模型",
    durationLabel: formatDurationInState(task, nowMs),
    rejectTotal: rejectTotal(task),
  };
}

export function projectBoard(state, filters = {}, nowMs = Date.now()) {
  const archive = filters.archive ?? "active";
  const text = filters.text ?? "";
  const model = filters.model ?? null;
  const tasks = state?.tasks ?? [];
  const filtered = filterTasks(tasks, text, model, archive);
  const warnings = [];
  const buckets = new Map(LANES.map((lane) => [lane.id, []]));
  for (const task of filtered) {
    const lane = laneForColumn(task.column);
    if (task.columnMissing) warnings.push(`缺少 column 的 ${task.id} 已放進待辦`);
    else if (lane === "todo" && task.column !== "todo" && !ACTIVE_COLUMNS.has(task.column) && !GATE_COLUMNS.has(task.column) && !CLOSED_COLUMNS.has(task.column)) {
      warnings.push(`未知欄位「${task.column}」的 ${task.id} 已放進待辦`);
    }
    buckets.get(lane).push(cardViewModel(task, nowMs));
  }
  const lanes = LANES.map((lane) => ({ id: lane.id, name: lane.name, cards: buckets.get(lane.id) }));
  return { lanes, warnings, taskCount: tasks.length, visibleCount: filtered.length };
}

export function taskById(state, id) {
  for (const task of state?.tasks ?? []) if (task.id === id) return task;
  return null;
}

export function resultPath(task) {
  const results = task?.results ?? {};
  if ((task?.column === "spec" || task?.column === "build" || task?.column === "review") && results[task.column]) return results[task.column];
  return results.review || results.build || results.spec || null;
}

function safeTaskId(id) {
  const text = String(id ?? "");
  if (!text || /[\u0000-\u001f\u007f]/.test(text)) return null;
  if (text.includes("/") || text.includes("\\") || [".", ".."].includes(text)) return null;
  return text;
}

export function herdrFolderPath(task, homeDir) {
  const id = safeTaskId(task?.id);
  if (!id) return null;
  const root = typeof task?._d?.root === "string" && task._d.root.trim() ? task._d.root : (task?.repo ?? "");
  const base = expandHome(root, homeDir);
  if (!openablePath(base, homeDir)) return null;
  return `${base}/.herdr/${id}`;
}

export function openablePath(path, homeDir) {
  if (typeof path !== "string" || /[\u0000-\u001f\u007f]/.test(path)) return null;
  const text = path.trim();
  if (!text) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return null;
  let absolute = null;
  if (text === "~" || text.startsWith("~/")) absolute = expandHome(text, homeDir);
  else if (text.startsWith("/") && !text.startsWith("//")) absolute = text;
  if (!absolute || !absolute.startsWith("/") || absolute.startsWith("//")) return null;
  return absolute;
}

export function projectTaskDetail(task, nowMs = Date.now(), homeDir = "") {
  if (!task) return null;
  const rejectLines = [];
  for (const [key, value] of Object.entries(task.reject_counts ?? {})) {
    const count = value;
    if (Number.isInteger(count) && count > 0) rejectLines.push({ model: key, count });
  }
  const resultLinks = [];
  for (const key of RESULT_KEYS) {
    if (task.results[key]) resultLinks.push({ kind: key, path: task.results[key] });
  }
  const folder = herdrFolderPath(task, homeDir);
  return {
    id: task.id,
    title: task.title,
    rawColumn: task.column,
    lane: laneForColumn(task.column),
    roleLabel: roleLabel(task.pane),
    pane: task.pane,
    model: task.model || "未標模型",
    durationLabel: formatDurationInState(task, nowMs),
    stateEnteredAt: stateEnteredAt(task) || "",
    rejectTotal: rejectTotal(task),
    rejectLines,
    specRewrites: task.spec_rewrites,
    needsPol: task.needs_pol,
    history: historyEntries(task),
    resultLinks,
    herdrFolder: folder,
    rejectHistoryNote: "逐次退回原因請見結果報告",
  };
}

/** Layout columns from root width in logical pixels (8px per terminal column). */
export function layoutForWidth(widthPx) {
  const w = Math.max(0, Number(widthPx) || 0);
  let columnsPerRow = 4;
  if (w < 480) columnsPerRow = 1;
  else if (w < 960) columnsPerRow = 2;
  return { columnsPerRow, minWidthPx: 480, breakpoints: { narrow: 480, wide: 960 } };
}

export function columnWidthPx(rootWidthPx, columnsPerRow, gapPx = 12, paddingPx = 24) {
  const usable = Math.max(0, rootWidthPx - paddingPx - gapPx * (columnsPerRow - 1));
  return Math.floor(usable / columnsPerRow);
}
