# BUILD-3 驗收紀錄

- cwd：`/Users/pauuul/Documents/PJ/herdr-linear-board-tui`
- 分支：`herdr/t-board-2-tui`；base `herdr-local-board`：`b532c4db76f17614de16cdba30e4230afe772f97`
- 受測候選：`5c15729d65289e2cc484e991ad8f10ae7be01f3a`。後續提交只補 README／SURVEY 與 docs；18 個程式、測試、fixture 與依賴清單的 SHA-256 見 candidate-files.sha256，均保持一致。最終提交 SHA 寫於指定 BUILD-3.md（避免提交內容自我雜湊）。
- 環境：macOS、Node v26.7.0、npm 11.19.0、Python 3.14.7。Node 22 未實跑，未提高 runtime 的 Node ≥22 門檻。
- fixture SHA-256：`955bea3f96956b37199ac58328c7ada21a7467abd4eed02ae895bf2fb5fc8dbc`
- lockfile SHA-256：`c89813f840c8990d0f76dd1c3ae1890efbd7ba7af536b9aaa0673851c9e8a598`

| 指令 | exit | 通過／失敗／取消／跳過 | 完整輸出 |
| --- | --- | --- | --- |
| `node --test tests/*.test.mjs` | 0 | 38／0／0／0 | baseline-38.txt |
| `TUI_CAPTURE_EVIDENCE=1 TZ=Asia/Taipei node --test` | 0 | 62／0／0／0 | test-asia-taipei.txt |
| `TZ=UTC node --test` | 0 | 62／0／0／0 | test-utc.txt |
| `node tui-dashboard/support/guard-controls.mjs` | 0 | 13 個禁止操作均攔截 | io-positive-controls.txt |
| `node --permission --allow-fs-read='*' tui-dashboard/support/permission-controls.mjs` | 0 | 3 類權限均拒絕 | permission-controls.txt |
| `gitleaks dir tui-dashboard --redact --no-banner` | 0 | no leaks found | gitleaks.txt |

新增 24 項，原有 38 項完整保留。PTY case 在 Python 標準庫的真實 pseudo-terminal 中執行真 CLI，不用 mock TTY。120×40、80×24、59×24 及 resize 都經 @xterm/headless 重播，核對欄頭／末卡／頁尾位置；q、Ctrl+C、SIGINT、SIGTERM 對應 0／130／130／143，termios 還原且程序限時退出。每個 case 的 guard 為空且檔案快照一致。

真入口使用正式 5 秒週期；外部 writer 驗證同 byte 長度且同 mtime、原子替換、invalid JSON／schema、unreadable／missing、空陣列恢復。原始 ANSI 與連續畫面為 pty-screens.json／pty-poll.json／pty-permission.json；可讀文字為 terminal-screens.txt／terminal-poll.txt／terminal-permission.txt。

## 突變

在 `/private/tmp` 隔離副本只將 active bucket 改成 todo，沿用 board.test.mjs：18 項中 16 通過、2 失敗、exit 1。其中合格映射斷言明確失敗：`DEMO-SPEC` 未出現在「進行中（角色＋模型）」；另一項因預期 active 卡不存在而出現 TypeError，不將該項作為額外映射證據。這不是語法或載入錯誤。

還原後同 18 項全過、exit 0；前後 board.mjs SHA-256 同為 `a707b3107df72843e6e5349075d2df035869ca83876c63e983ae1b5e790b88e4`，並與工作區候選 bytes 比對相同。diff、退出碼與雜湊在 mutation.diff／mutation-record.json；完整失敗輸出保存在 mutation-fail-raw.json，mutation-fail-output.txt 僅移除行尾空白供 diff hygiene；還原輸出為 mutation-restored-output.txt。

## 邊界與交付

沒有啟用看板、server、背景服務、正式流程或 Herdr 分頁。未執行 hc send、未推送、未合併、未建立遠端 PR。遠端交件仍由獲授權者使用本機分支與 PR-draft.md 完成：`herdr/t-board-2-tui → herdr-local-board`。
