/** @typedef {'todo'|'active'|'gate'|'closed'} Bucket */

/**
 * @typedef {Object} Card
 * @property {string} id
 * @property {string} title
 * @property {string} roleLabel
 * @property {string} modelLabel
 * @property {string} elapsedLabel
 * @property {number} rejectionCount
 */

/**
 * @typedef {Object} Board
 * @property {{ id: Bucket, title: string, cards: Card[] }[]} columns
 * @property {string[]} warnings
 */

/**
 * @typedef {{ kind: 'valid', board: Board, readAt: number }}
 * | {{ kind: 'failed', reason: 'missing'|'unreadable'|'invalid', message: string }} ReadOutcome
 */

export const COLUMN_DEFS = [
  { id: "todo", title: "待辦" },
  { id: "active", title: "進行中（角色＋模型）" },
  { id: "gate", title: "等把關" },
  { id: "closed", title: "已結案" },
];

const TERMINAL_COLUMNS = new Set(["merged", "closed"]);
const ACTIVE_COLUMNS = new Set(["spec", "build", "review"]);
const GATE_COLUMNS = new Set(["decide", "pr", "merge"]);
const KNOWN_COLUMNS = new Set(["todo", ...TERMINAL_COLUMNS, ...ACTIVE_COLUMNS, ...GATE_COLUMNS]);

const ROLE_BY_COLUMN = {
  todo: "待指派",
  spec: "規格師",
  build: "施工手",
  review: "審查手",
  decide: "把關",
  pr: "待 PR 把關",
  merge: "合併手",
  merged: "已結案",
  closed: "已結案",
};

const PANE_ROLE_PREFIX = {
  spec: "規格師",
  build: "施工手",
  review: "審查手",
  merge: "合併手",
};

/** Strip C0/C1 and ESC sequences from user-visible text. */
export function sanitizeText(text) {
  return String(text ?? "")
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
}

export function expandHome(path, homeDir) {
  const text = String(path ?? "");
  if (text === "~") return homeDir || text;
  if (text.startsWith("~/")) return `${homeDir || ""}${text.slice(1)}`;
  return text;
}

export function resolveStatePath({ argvState, envState, homeDir }) {
  const fromArg = typeof argvState === "string" && argvState.trim() ? argvState.trim() : "";
  const fromEnv = typeof envState === "string" && envState.trim() ? envState.trim() : "";
  const raw = fromArg || fromEnv || "~/herdr-ops/board/state.json";
  return expandHome(raw, homeDir);
}

/** @returns {number} */
export function sumRejectCounts(raw, warnings) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  let total = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
      total += value;
    } else {
      warnings.push(`退回次數「${sanitizeText(key)}」無效，已忽略`);
    }
  }
  return total;
}

/** @returns {string} */
export function roleFromPane(pane) {
  const name = sanitizeText(pane).trim();
  if (!name) return "";
  if (PANE_ROLE_PREFIX[name]) return PANE_ROLE_PREFIX[name];
  for (const [prefix, label] of Object.entries(PANE_ROLE_PREFIX)) {
    if (name === prefix || name.startsWith(`${prefix}-`)) return label;
  }
  return "";
}

/** @returns {{ bucket: Bucket, roleLabel: string }} */
export function classifyTask(raw, warnings) {
  const column = typeof raw.column === "string" ? raw.column.trim() : "";
  const needsPol = raw.needs_pol === true;

  if (TERMINAL_COLUMNS.has(column)) {
    return { bucket: "closed", roleLabel: ROLE_BY_COLUMN[column] ?? "已結案" };
  }

  if (!KNOWN_COLUMNS.has(column)) {
    if (!column) warnings.push("任務缺少 column，已放進待辦");
    else warnings.push(`未知欄位「${sanitizeText(column)}」的任務已放進待辦`);
    const paneRole = roleFromPane(raw.pane);
    return { bucket: "todo", roleLabel: "未知角色" };
  }

  if (needsPol) {
    const role = ROLE_BY_COLUMN[column] || roleFromPane(raw.pane) || "未知角色";
    return { bucket: "gate", roleLabel: role };
  }

  if (column === "todo") {
    return { bucket: "todo", roleLabel: "待指派" };
  }

  if (ACTIVE_COLUMNS.has(column)) {
    return { bucket: "active", roleLabel: ROLE_BY_COLUMN[column] };
  }

  if (GATE_COLUMNS.has(column)) {
    return { bucket: "gate", roleLabel: ROLE_BY_COLUMN[column] };
  }

  warnings.push(`未知欄位「${sanitizeText(column)}」的任務已放進待辦`);
  const paneRole = roleFromPane(raw.pane);
  return { bucket: "todo", roleLabel: "未知角色" };
}

/** @returns {string} */
export function formatElapsed(updatedAt, nowMs, warnings) {
  const text = typeof updatedAt === "string" ? updatedAt.trim() : "";
  if (!text) return "時間未知";
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(text);
  if (!hasTz) {
    warnings.push("任務 updated_at 缺少時區，無法計算停留時間");
    return "時間未知";
  }
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) {
    warnings.push("任務 updated_at 無法解析");
    return "時間未知";
  }
  let deltaSec = Math.floor((nowMs - ms) / 1000);
  if (deltaSec < 0) {
    warnings.push("任務 updated_at 在未來，停留時間歸零");
    deltaSec = 0;
  }
  if (deltaSec < 60) return "此狀態約 不足 1 分（依更新時間）";
  const minutes = Math.floor(deltaSec / 60);
  if (minutes < 60) return `此狀態約 ${minutes} 分（依更新時間）`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `此狀態約 ${hours} 小時（依更新時間）`;
  const days = Math.floor(hours / 24);
  return `此狀態約 ${days} 天（依更新時間）`;
}

/** @returns {Card|null} */
export function taskToCard(raw, nowMs, warnings) {
  const id = typeof raw.id === "string" ? sanitizeText(raw.id).trim() : "";
  if (!id) return null;
  const { bucket, roleLabel } = classifyTask(raw, warnings);
  const titleRaw = typeof raw.title === "string" ? raw.title : "";
  const title = sanitizeText(titleRaw).trim() || "（未命名）";
  const modelRaw = typeof raw.model === "string" ? sanitizeText(raw.model).trim() : "";
  const modelLabel = modelRaw || "未指定";
  const rejectionCount = sumRejectCounts(raw.reject_counts, warnings);
  const elapsedLabel = formatElapsed(raw.updated_at, nowMs, warnings);
  return { id, title, roleLabel, modelLabel, elapsedLabel, rejectionCount, _bucket: bucket };
}

/**
 * @param {string} text
 * @param {number} nowMs
 * @returns {ReadOutcome}
 */
export function projectBoard(text, nowMs) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: "failed", reason: "invalid", message: "狀態檔不是合法的 JSON" };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { kind: "failed", reason: "invalid", message: "狀態檔格式錯誤" };
  }
  if (Object.hasOwn(raw, "version") && raw.version !== 1) {
    return { kind: "failed", reason: "invalid", message: "不支援的 version（僅接受 1 或省略）" };
  }
  if (!Array.isArray(raw.tasks)) {
    return { kind: "failed", reason: "invalid", message: "狀態檔缺少 tasks 陣列" };
  }

  const warnings = [];
  const buckets = new Map(/** @type {Bucket[]} */ (COLUMN_DEFS.map((c) => c.id)).map((id) => [id, /** @type {Card[]} */ ([])]));
  for (const item of raw.tasks) {
    const card = item && typeof item === "object" ? taskToCard(item, nowMs, warnings) : null;
    if (!card) {
      warnings.push("略過缺少 id 的任務");
      continue;
    }
    const bucket = /** @type {Bucket} */ (card._bucket);
    delete card._bucket;
    buckets.get(bucket).push(card);
  }

  const columns = COLUMN_DEFS.map((def) => ({
    id: def.id,
    title: def.title,
    cards: buckets.get(def.id) ?? [],
  }));

  return {
    kind: "valid",
    board: { columns, warnings: [...new Set(warnings)] },
    readAt: nowMs,
  };
}

/** Plain-text snapshot for tests and docs (not used at runtime by Ink). */
export function boardToPlainText(board) {
  const lines = [];
  for (const column of board.columns) {
    lines.push(`## ${column.title}`);
    if (!column.cards.length) {
      lines.push("(空)");
      continue;
    }
    for (const card of column.cards) {
      lines.push(
        `- ${card.id} | ${card.title} | ${card.roleLabel} | ${card.modelLabel} | ${card.elapsedLabel} | 退回 ${card.rejectionCount}`,
      );
    }
  }
  if (board.warnings.length) {
    lines.push(`! warnings: ${board.warnings.join("; ")}`);
  }
  return lines.join("\n");
}

export function emptyBoard() {
  return {
    columns: COLUMN_DEFS.map((def) => ({ id: def.id, title: def.title, cards: [] })),
    warnings: [],
  };
}
