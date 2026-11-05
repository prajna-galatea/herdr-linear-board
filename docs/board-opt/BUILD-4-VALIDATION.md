# BUILD-4 驗證

- cwd：/Users/pauuul/Documents/PJ/herdr-linear-board；分支 herdr/t-board-1。
- base：b532c4db76f17614de16cdba30e4230afe772f97；程式候選 e3d466bf27626bd6985c2b975178a39996f06959。
- `git clone --no-local --no-hardlinks` 乾淨副本：路徑、HEAD 與 main/state/open 及測試雜湊見 build4-pinned.json。
- `TZ=Asia/Taipei node --test`、`TZ=UTC node --test`：各 exit 0，54 pass、0 fail、0 skip，完整輸出見 build4-taipei.txt／build4-utc.txt。
- 隔離副本撤回 stale 判斷：exit 1，1 fail；失敗是空快照消失後沒有「未更新」，非匯入或語法錯誤。見 build4-revert.txt／json。輸出僅去除行尾空白。
- `gitleaks dir <隔離副本> --no-banner`：exit 0，無洩漏，見 build4-secret-scan.txt；不讀正式金鑰與 .env。
- `rg -n "split|pane.new|live.?workspace" mods/herdr-board`：exit 1，零命中。三點差異非空、路徑均在白名單，見 build4-paths.txt。
- `herdr-app check mods/herdr-board`：40 秒未完成，逾時終止；未計為通過。
- 前版三張截圖及五類撤回保留，未重跑；截圖驅動改寫尺寸回呼，不能當成本輪未修改候選的原生尺寸證據。必要證據尚缺，整體任務未完成。

## 必答題

Q1：state.js 的 projectTaskDetail 投影、main.js 的 detailView 顯示全部既有 history、模型別次數、results 與任務資料夾入口；open.js 驗證並開啟。逐次退回原因查結果報告，未記錄事件不可還原。
Q2：有未歸檔／已歸檔／全部，預設未歸檔；純顯示篩選，重新開案由原流程處理。
Q3：main.js 的 loadConfig 唯讀設定，reload 唯讀 state；state.js 無 I/O；open.js 僅明確點擊後呼叫平台開啟器。本輪只新增 hasSnapshot 成功旗標，不新增 I/O。完整呼叫清單見 io-audit.txt（舊行號，本輪 main.js 後續行號增加 3）。
