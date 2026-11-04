# 新增滿版唯讀 TUI 看板與五框架調查

交件目標：fork 的 `herdr/t-board-2-tui → herdr-local-board`。此檔是草稿，尚未建立遠端 PR。

原型只讀指定 state.json，以 Ink 8 呈現待辦／進行中／等把關／已結案。120 欄以上四欄並排且固定欄頭，窄版可捲動；每次讀完等待 5 秒重讀，錯誤時保留舊資料並顯示 stale，修復後恢復。修正前輪尺寸 context、終端生命週期、唯讀攔截缺口與第五個完整調查項目；交付內容已納入本機分支。另修正長路徑遮住警告、null version 與 null 退回數判定，補上模型與真 PTY 回歸斷言。

- Q1：推薦 Ink，第二名 Textual。Ink 沿用 Node 與 JS 測試，代價是 React／Yoga 與自製排版；Textual 元件完整但另需 Python venv 與應用測試。唯讀由應用與實測證明。五個官方候選（Ink／Textual／Ratatui／Bubble Tea／WTF）的授權、精確星數、正式發版日期與 macOS 需求見 [SURVEY](../SURVEY.md)。
- Q2：具備四欄、角色／模型、單一退回數、近似時間、唯讀輪詢與終端瀏覽；不含 mod 詳情、results 開檔、退回歷史、歸檔篩選、範例清理、即時代理資訊與窗格整合。
- Q3：唯一業務讀檔是 src/read-loop.mjs:14；CLI 只讀參數與路徑環境，Ink 只操作終端及必要 runtime 資源，應用外部指令呼叫點為零。依賴可達 I/O、fallback 與 guard 覆蓋限制見 [README](../README.md) 及 [I/O 證據](io-audit.md)。

驗證：Asia/Taipei 與 UTC 各 64 通過、0 失敗／取消／跳過，含原有 38 項。隔離映射突變產生有效映射斷言失敗，還原後通過且 hash 相同。13 個 I/O 陽性控制、真 PTY 零 violations、Node 26 權限模式與三類拒絕控制均通過；gitleaks 無洩漏。完整命令、候選 SHA 與雜湊見 [驗收紀錄](acceptance.md)，測試全文見 [Taipei](test-asia-taipei.txt)／[UTC](test-utc.txt)。

[真實終端逐畫面文字](terminal-screens.txt) 包含 120×40 四欄、80／59 欄捲動與 resize；[原始 ANSI](pty-screens.json) 可重播。[輪詢證據](terminal-poll.txt) 覆蓋同長度同 mtime、原子替換、失敗與修復。

正式流程不含看板，啟用需 Pol哥 同意。只供手動在獨立分頁執行；未啟用、未開 server、未推送或合併。需求方仍須獨立核對與安排規定模型審查。
