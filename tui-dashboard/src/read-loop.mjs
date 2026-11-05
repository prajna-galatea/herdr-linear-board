import { readFile } from "node:fs/promises";
import { projectBoard } from "./board.mjs";

export const POLL_MS = 5000;

/**
 * @param {string} statePath
 * @param {number} nowMs
 * @returns {Promise<import('./board.mjs').ReadOutcome>}
 */
export async function readStateFile(statePath, nowMs) {
  let text;
  try {
    text = await readFile(statePath, "utf8");
  } catch (err) {
    const code = /** @type {NodeJS.ErrnoException} */ (err).code;
    if (code === "ENOENT") return { kind: "failed", reason: "missing", message: "找不到狀態檔" };
    return { kind: "failed", reason: "unreadable", message: "無法讀取狀態檔" };
  }
  return projectBoard(text, nowMs);
}

/** @typedef {{ kind: 'loading' }} LoadingState */
/** @typedef {{ kind: 'ready', board: import('./board.mjs').Board, readAt: number }} ReadyState */
/** @typedef {{ kind: 'unavailable', reason: string, message: string }} UnavailableState */
/** @typedef {{ kind: 'stale', board: import('./board.mjs').Board, lastReadAt: number, reason: string, message: string }} StaleState */
/** @typedef {LoadingState|ReadyState|UnavailableState|StaleState} DisplayState */

/**
 * @param {DisplayState|null} previous
 * @param {import('./board.mjs').ReadOutcome} outcome
 * @returns {DisplayState}
 */
export function nextDisplayState(previous, outcome) {
  if (outcome.kind === "valid") {
    return { kind: "ready", board: outcome.board, readAt: outcome.readAt };
  }
  const message = outcome.message;
  const reason = outcome.reason;
  if (previous && (previous.kind === "ready" || previous.kind === "stale")) {
    const board = previous.board;
    const lastReadAt = previous.kind === "ready" ? previous.readAt : previous.lastReadAt;
    return { kind: "stale", board, lastReadAt, reason, message };
  }
  return { kind: "unavailable", reason, message };
}
