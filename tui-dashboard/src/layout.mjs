import { sanitizeText } from "./board.mjs";

/** Approximate terminal display width (wide East Asian chars count as 2). */
export function displayWidth(text) {
  let width = 0;
  for (const ch of sanitizeText(text)) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0x1100 && code <= 0x115f)
      || (code >= 0x2e80 && code <= 0xa4cf)
      || (code >= 0xac00 && code <= 0xd7a3)
      || (code >= 0xf900 && code <= 0xfaff)
      || (code >= 0xfe10 && code <= 0xfe19)
      || (code >= 0xfe30 && code <= 0xfe6f)
      || (code >= 0xff00 && code <= 0xff60)
      || (code >= 0xffe0 && code <= 0xffe6)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

export function wrapText(text, maxWidth) {
  const clean = sanitizeText(text);
  if (maxWidth < 1) return [clean];
  const lines = [];
  let line = "";
  let lineWidth = 0;
  for (const ch of clean) {
    const w = displayWidth(ch);
    if (lineWidth + w > maxWidth && line) {
      lines.push(line);
      line = ch;
      lineWidth = w;
    } else {
      line += ch;
      lineWidth += w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** The runtime and terminal tests share this single viewport layout. */
export function layoutBoard(board, {width, height}, scrollOffset = 0) {
  const wide = width >= 120;
  const bodyHeight = Math.max(1, height - 2);
  const columnWidth = wide ? Math.floor(width / 4) : width;
  const cardRows = card => [card.id, card.title, `${card.roleLabel} · ${card.modelLabel}`,
    card.elapsedLabel, `退回 ${card.rejectionCount}`, "─"].flatMap(s => wrapText(s, columnWidth));
  const columns = board.columns.map(c => ({title: c.title,
    rows: c.cards.length ? c.cards.flatMap(cardRows) : ["(空)"]}));
  const body = wide ? columns : [{rows: columns.flatMap(c => [c.title, ...c.rows, ""])}];
  const contentHeight = wide ? bodyHeight - 1 : bodyHeight;
  const maxOffset = Math.max(0, ...body.map(c => c.rows.length - contentHeight));
  const offset = Math.max(0, Math.min(scrollOffset, maxOffset));
  const pad = s => s + " ".repeat(Math.max(0, columnWidth - displayWidth(s)));
  const lines = Array.from({length: bodyHeight}, (_, i) => {
    if (!wide) return body[0].rows[offset + i] || "";
    return columns.map(c => pad(i === 0 ? wrapText(c.title, columnWidth)[0] : c.rows[offset + i - 1] || "")).join("");
  });
  return {lines, offset, maxOffset, bodyHeight};
}

export function pageSize(height) { return Math.max(1, height - 1); }
