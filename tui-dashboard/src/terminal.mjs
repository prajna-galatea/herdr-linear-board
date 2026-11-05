import React, {useEffect, useState} from "react";
import {Box, Text, useInput, useStdout} from "ink";
import {emptyBoard, sanitizeText} from "./board.mjs";
import {layoutBoard, pageSize, wrapText} from "./layout.mjs";

export function BoardView({displayState, scrollOffset, setScrollOffset, onExit, statePath}) {
  const {stdout} = useStdout();
  const [size, setSize] = useState(() => ({width: stdout.columns, height: stdout.rows}));
  useEffect(() => {
    const resize = () => setSize({width: stdout.columns, height: stdout.rows});
    stdout.on("resize", resize);
    return () => stdout.off("resize", resize);
  }, [stdout]);
  const board = displayState.board || emptyBoard();
  const frame = layoutBoard(board, size, scrollOffset);
  useEffect(() => { if (scrollOffset !== frame.offset) setScrollOffset(frame.offset); }, [frame.offset, scrollOffset]);
  useInput((input, key) => {
    if (input === "q") return onExit(0);
    if (key.ctrl && input === "c") return onExit(130);
    if (key.upArrow) setScrollOffset(v => Math.max(0, v - 1));
    if (key.downArrow) setScrollOffset(v => Math.min(frame.maxOffset, v + 1));
    if (key.pageUp) setScrollOffset(v => Math.max(0, v - pageSize(frame.bodyHeight)));
    if (key.pageDown) setScrollOffset(v => Math.min(frame.maxOffset, v + pageSize(frame.bodyHeight)));
  });
  const status = displayState.kind === "ready" ? `ready 已更新 ${new Date(displayState.readAt).toISOString()} · ${statePath}`
    : displayState.kind === "stale" ? `stale 顯示舊資料：${displayState.message}`
    : displayState.kind === "unavailable" ? `unavailable 無法載入：${displayState.message}` : "loading 讀取中";
  const footer = wrapText(sanitizeText((board.warnings.length ? `${displayState.kind} · 警告 ${board.warnings.length}：${board.warnings.join("；")} · ` : "") + status), size.width)[0];
  return React.createElement(Box, {flexDirection:"column", width:size.width, height:size.height},
    [...frame.lines, footer, "↑↓ 捲動 · PgUp/PgDn 換頁 · q 離開"].map((s, i) =>
      React.createElement(Text, {key:i, wrap:"truncate-end"}, s || " ")));
}
