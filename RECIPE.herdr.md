# Herdr 新任務流程（唯讀看板）

本機看板。四欄檢視，任務來自 `state.json`，不連網、不寫入狀態、不派工。

**正式流程不含看板，啟用需 Pol哥 同意。**

## What you see

滿版單一 mod 分頁（`mod.json` 無 overlay）。由上到下：

- 標題列：任務數、搜尋、未歸檔／已歸檔／全部、Refresh
- 模型篩選列
- 四欄：待辦、進行中、等把關、已結案（空欄保留）
- 卡面：編號、標題（最多三行）、角色·模型、在此狀態多久、退回總數
- 點卡片 → 同窗格詳情（歷史、結果入口、`.herdr` 資料夾）；返回保留篩選

響應式：根寬 &lt;480px 一欄一列；480–959px 一列兩欄；≥960px 一列四欄。

## How it behaves

- 狀態：`~/herdr-ops/board/state.json` 或 `herdr-board.json` 的 `state`；`props.state` 可覆寫（測試用）
- 每 5 秒與 Refresh 重讀；不憑 mtime 略過
- 歸檔：`merged`/`closed`、`example === true` 與範例 `T-001`～`T-003` 預設隱藏；切「已歸檔」可見；不寫 `archived_at`
- 時間：來自 `_d.history` 最後一筆 `{at,col,note}` 紀錄；`col` 須等於目前 `column`，時間須含時區且有效、不在未來，不用 `updated_at`
- 結果：詳情內點擊才 `open`/`xdg-open`/`explorer`；`openablePath` 拒絕 URL 與相對路徑

## Built from

- `mods/herdr-board/main.js` — View，唯讀載入與渲染
- `mods/herdr-board/state.js` — `parseState`、`projectBoard`、`projectTaskDetail`、`layoutForWidth`、歸檔與四欄映射
- `mods/herdr-board/open.js` — 本機開檔
- `mods/herdr-board/mod.json` — `{ "place": "none", "title": "Herdr 新任務流程" }`

`mods/herdr-board-agent/` 仍在上游目錄，但本版看板不引用。

## Done when

- `TZ=Asia/Taipei node --test` 與 `TZ=UTC node --test` 全綠
- `herdr-app check mods/herdr-board` 通過
- `rg -n "split|pane.new|live.?workspace" mods/herdr-board` 零命中
- gitleaks 無 secrets

## 四欄映射（README 同步）

| 原始 column | 顯示欄 |
|---|---|
| todo | 待辦 |
| spec, build, review | 進行中 |
| decide, pr, merge | 等把關 |
| merged, closed | 已結案 |

唯讀邊界：main.js 僅讀選定 state 與必要時的 appHome()/herdr-board.json；state.js 無 I/O；open.js 僅在明確點擊有效本機路徑後呼叫系統開啟器。沒有 requests/gates、hc、排版或網路操作。

退回次數只計非負整數 number（含退回 0）；詳情的狀態歷史不等於完整退回歷史，逐次退回原因請見結果報告與 .herdr 任務資料夾。無效來源設定會報錯，不回退正式來源；同來源讀取失敗保留舊快照並標示未更新。關閉取消本 View 工作與輪詢。
