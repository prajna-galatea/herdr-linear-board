# 唯讀滿版四欄看板、精簡卡片與可逆歸檔

目標：同一 fork `prajna-galatea/herdr-linear-board`，`herdr/t-board-1` → `herdr-local-board`；本次僅本機 commit 與 PR 材料，不 push、開遠端 PR、合併、部署或啟用。

看板由派工工具改為唯讀投影：固定四欄，卡片只顯示任務號、標題、角色／模型、目前狀態經過時間與單一退回總數；點擊在同窗格查閱完整既有歷史與結果入口。merged／closed 與範例預設歸檔，切篩選即可查回，來源資料不變。根寬 <480／480–959／≥960px 分別一／二／四欄，整板垂直捲動。

正式流程不含看板，啟用需 Pol哥 同意。

## 驗證

- `TZ=Asia/Taipei node --test`、`TZ=UTC node --test`：各 52 tests、52 pass、0 fail、0 skip；完整工作樹輸出見 `test-output-*.txt`，指定候選乾淨副本結果見 `CANDIDATE.md`。
- `herdr-app check`：exit 0，見 `native-check.txt`。
- 原生截圖： [窄](narrow.png)、[中](medium.png)、[寬](wide.png)；量測與測試驅動限制見 [SCREENSHOTS.md](SCREENSHOTS.md)，候選拷貝逐檔雜湊一致。每張都是單一 mod 分頁，測試 space 與視窗已關閉。
- 五類撤回修正各自實跑並失敗，見 [REVERT-EVIDENCE.md](REVERT-EVIDENCE.md)、`mutation-results.json`、各 `.patch.gz` 和原始 TAP 輸出。唯讀、四欄、卡面、尺寸、歸檔分別由對應行為斷言偵測。
- 秘密掃描、白名單與 diff check 見 `CANDIDATE.md`；掃描使用隔離檔案副本，不讀正式金鑰或 .env。
- 原 38 項中的派工衝突案例替換對照見 [TEST-MIGRATION.md](TEST-MIGRATION.md)。

## Q1：完整退回歷史在哪裡？

`state.js:280` 詳情投影、`main.js:146` 起詳情畫面保留 `_d.history` 全部紀錄與欄位、模型別次數、重寫次數、results 及 `.herdr/<任務號>/` 資料夾入口。`open.js:5` 驗證路徑後開啟。狀態歷史不等於完整退回歷史；逐次原因與各輪報告請見結果報告及任務資料夾，來源沒有的事件不能還原。

## Q2：是否有已歸檔檢視？

有「未歸檔／已歸檔／全部」，預設未歸檔，可與搜尋、模型篩選共用。僅變更本 View 顯示，不寫 archived_at、不刪或搬資料。一般卡由原流程重新開案，下次刷新回到主畫面。

## Q3：如何確定只讀？

所有產品 I/O／程序呼叫清單見 `io-audit.txt`：`main.js:53` 必要時讀 appHome()/herdr-board.json、`:75` 讀選定 state；`state.js` 無 I/O；`open.js:9–11` 僅明確點擊有效本機入口後以分離參數呼叫 explorer／xdg-open／open。沒有 hc、run、requests/gates 掃描或寫入、網路與持久化操作。

runtime 測試載入實際 main/state/open，以保留畫面樹與事件的 UI 邊界執行搜尋 change、模型與歸檔 click、卡片、返回、Refresh、timer、size change；比較 state 完整位元組與 requests/gates 哨兵目錄及內容，記錄並拒絕清單外 I/O。實際 opener 只替換外部 exec；非開檔互動不得有任何程序。關閉後的 timer、未啟動工作及待決讀取均不再讀檔或更新畫面。唯讀撤回證明恢復真實寫入呼叫會被偵測。

## 邊界

未改 `tui-dashboard/`、上游 Linear 模組或代理對話框；未改正式設定與 ~/herdr-ops、未讀正式 state 或結果報告。只保留既有上游署名與授權。獨立審查與 PR 遞交由既有流程辦理，本報告不代替不同模型的審查。
