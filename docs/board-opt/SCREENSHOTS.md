# BUILD-3 原生截圖

三張 PNG 均由隔離 `HERDR_APP_HOME` 的 `herdr-app shot` 產生，zoom=1；不是模擬圖。根寬由原生 `on_size_change((size,cx)=>...)` 回呼取得，測試驅動在畫面底部顯示其 `size.width`，不是以 PNG 像素推算。

| 圖 | 實測邏輯根寬 | 排列 |
|---|---:|---|
| [narrow.png](narrow.png) | 193px | 一列一欄，整板可垂直捲動 |
| [medium.png](medium.png) | 613px | 一列兩欄 |
| [wide.png](wide.png) | 1213px | 一列四欄，最右完整可見 |

假資料為 [native-state.json](native-state.json)，包含長標題、長模型、多模型退回及四欄。三個測試分頁都只有一個 mod 窗格，見 `native-*-ls.json`、`native-*-status.json`；完整操作與退出碼在 `native-commands.json`。每次以本任務新 space 開啟，拍完以 space.close 關閉該 space（連同分頁與初始測試 shell），再退出專用視窗。沒有在 herdr ops space 開看板；正式設定與流程未修改。

透明限制：為自動選擇「全部」並顯示根寬，原生驗收載入 `board-capture` 測試驅動，內部子目錄 `candidate/` 是候選 `mods/herdr-board/` 的實體逐檔拷貝，驅動繼承候選 View，僅設定歸檔篩選、關閉測試視窗新手導覽並顯示根寬。正式候選仍預設未歸檔。驅動存於 `native-capture-driver.js`（不安裝、不由產品引用）；候選與拷貝 SHA-256 見 `native-hashes.json`。因此圖片驗證候選原生渲染；預設篩選及所有 UI 事件由 runtime 測試另行驗證。

首次嘗試揭露跨 mod 匯入限制、line_clamp 不支援及欄內捲動零高度。已修正且重新產圖，最後 status errors 為空。測試驅動屬驗收設定，並非一般使用者開啟命令；正式獲准後依 README 使用 `--mod herdr-board`。
