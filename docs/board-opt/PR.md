# 唯讀滿版四欄看板、精簡卡片與可逆歸檔

既有看板的派工與分割能力改為單一滿版分頁中的唯讀 state.json 投影：四欄、五項卡面資訊、同窗格詳情及未歸檔／已歸檔／全部篩選。根寬 <480／480–959／≥960px 分別一／二／四欄；merged／closed 與範例預設隱藏，資料不刪除。來源失效時，看板及詳情都保留最後快照並提示「未更新」，恢復後清除。

正式流程不含看板，啟用需 Pol哥 同意。

交件目標：同一 fork `prajna-galatea/herdr-linear-board`，`herdr/t-board-1` → `herdr-local-board`。本機已提交，PR 由既有交件流程送出；未 push、開遠端 PR、合併、部署或正式啟用。

## 驗證

程式候選 `083991ca7e8d5e2176d395ea74e8d06bc82d080a`；base `b532c4db76f17614de16cdba30e4230afe772f97`。後續證據提交只改 docs/board-opt。

- 指定候選的乾淨 Git clone，以假 HOME／XDG／appHome 執行 `TZ=Asia/Taipei node --test`、`TZ=UTC node --test`：各 exit 0、55 pass、0 fail、0 skip；完整輸出 [Taipei](build5-taipei.txt)、[UTC](build5-utc.txt)，候選／測試雜湊及乾淨狀態 [build5-pinned.json](build5-pinned.json)。
- 同一候選 `herdr-app check mods/herdr-board` exit 0，見 [build5-mod-check.json](build5-mod-check.json)。
- 三張原生 `herdr-app shot`：[窄 433px](build5-narrow.png)、[中 733px](build5-medium.png)、[寬 1263px](build5-wide.png)。候選檔案逐檔雜湊一致，測試驅動僅選「全部」及附加量測文字，沒有覆寫尺寸回呼；根寬由候選原本尺寸事件取得。每張單一 mod 窗格、zoom=1，測試 space 與專用視窗已關。命令、清理、status、雜湊與量測方法見 [BUILD-5-VALIDATION.md](BUILD-5-VALIDATION.md)。
- 五類撤回修正各 exit 1，唯讀／四欄／卡面／尺寸／歸檔分別 13／1／1／1／3 fail；另撤回詳情警示為 1 fail。完整命令、變體差異及 TAP 見 [build5-mutations/](build5-mutations/)。
- 秘密掃描 exit 0、無洩漏；`rg -n "split|pane.new|live.?workspace" mods/herdr-board` 零命中；差異非空且完全符合白名單，見 `build5-secret-scan.txt`、`build5-secret-report.json`、`build5-pane-check.txt`、`build5-paths.txt`。
- 原 38 項中的派工衝突案例逐項替換對照見 [TEST-MIGRATION.md](TEST-MIGRATION.md)。完整本輪證據索引與限制見 [BUILD-5-VALIDATION.md](BUILD-5-VALIDATION.md)；舊版圖與測試僅保留歷史。

## Q1：完整退回歷史在哪裡？

`state.js:280` 詳情投影、`main.js:148` 詳情畫面、`open.js:5` 開啟器：保留全部既有 `_d.history` 欄位、模型別次數、規格重寫、results 及 `.herdr/<任務號>/` 入口。狀態歷史不等於逐次退回歷史；各輪原因須查結果報告，來源未記錄事件不能還原。

## Q2：是否有已歸檔檢視？

有未歸檔／已歸檔／全部，預設未歸檔，可與搜尋及模型篩選共用。僅改本次 View，不寫 archived_at、不刪搬資料；原流程重新開案後刷新即回主畫面。

## Q3：如何確定只讀？

完整外部操作只有 `main.js:54` 必要時唯讀設定、`:77` 唯讀選定 state，以及 `open.js:9–11` 明確點有效本機入口後的分離參數平台開啟器。`state.js` 無 I/O，沒有 hc、派工、requests／gates 存取、網路或寫入；[io-audit.txt](io-audit.txt) 附全部實際行號。

runtime 測試載入實際 main／state／open，經搜尋、模型／歸檔、卡片／返回、Refresh、timer、resize 等真實事件，前後比對 state 完整位元組及 requests／gates 哨兵檔名與內容，拒絕清單外操作；非開檔互動無程序呼叫，關閉後不讀檔或更新。唯讀撤回在實際操作路徑恢復寫入，得到預期 `forbidden writeTextFile`。
