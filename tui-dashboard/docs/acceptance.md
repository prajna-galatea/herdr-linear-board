# BUILD-4 驗收紀錄

- cwd：`/Users/pauuul/Documents/PJ/herdr-linear-board-tui`
- 分支：`herdr/t-board-2-tui`；base `herdr-local-board`：`b532c4db76f17614de16cdba30e4230afe772f97`
- 受測候選：`d085d8a2d94a45c8cedf7292bf347e5ee1011c7b`。後續提交只補 docs；18 個程式、測試、fixture 與依賴清單的 SHA-256 見 candidate-files.sha256，均保持一致。最終提交 SHA 寫於指定 BUILD-4.md（避免提交內容自我雜湊）。
- 環境：macOS、Node v26.7.0、npm 11.19.0、Python 3.14.7。Node 22 未實跑，未提高 runtime 的 Node ≥22 門檻。
- fixture SHA-256：`955bea3f96956b37199ac58328c7ada21a7467abd4eed02ae895bf2fb5fc8dbc`
- lockfile SHA-256：`c89813f840c8990d0f76dd1c3ae1890efbd7ba7af536b9aaa0673851c9e8a598`

| 指令 | exit | 通過／失敗／取消／跳過 | 完整輸出 |
| --- | --- | --- | --- |
| `node --test tests/*.test.mjs` | 0 | 38／0／0／0 | baseline-38.txt |
| `TUI_CAPTURE_EVIDENCE=1 TZ=Asia/Taipei node --test` | 0 | 64／0／0／0 | test-asia-taipei.txt |
| `TZ=UTC node --test` | 0 | 64／0／0／0 | test-utc.txt |
| `node tui-dashboard/support/guard-controls.mjs` | 0 | 13 個禁止操作均攔截 | io-positive-controls.txt |
| `node --permission --allow-fs-read='*' tui-dashboard/support/permission-controls.mjs` | 0 | 3 類權限均拒絕 | permission-controls.txt |
| `gitleaks dir tui-dashboard --redact --no-banner` | 0 | no leaks found | gitleaks.txt |

新增 26 項，原有 38 項完整保留。PTY case 在 Python 標準庫的真實 pseudo-terminal 中執行真 CLI，不用 mock TTY。120×40、80×24、59×24 及 resize 都經 @xterm/headless 重播，核對欄頭／末卡／頁尾位置；q、Ctrl+C、SIGINT、SIGTERM 對應 0／130／130／143，termios 還原且程序限時退出。每個 case 的 guard 為空且檔案快照一致。

真入口使用正式 5 秒週期；外部 writer 驗證同 byte 長度且同 mtime、原子替換、invalid JSON／schema、unreadable／missing、空陣列恢復。原始 ANSI 與連續畫面為 pty-screens.json／pty-poll.json／pty-permission.json；可讀文字為 terminal-screens.txt／terminal-poll.txt／terminal-permission.txt。

## 突變

在 `/private/tmp` 隔離副本只將 active bucket 改成 todo，沿用 board.test.mjs：20 項中 18 通過、2 失敗、exit 1。其中合格映射斷言明確失敗：`DEMO-SPEC` 未出現在「進行中（角色＋模型）」；另一項因預期 active 卡不存在而出現 TypeError，不將該項作為額外映射證據。這不是語法或載入錯誤。

還原後同 20 項全過、exit 0；前後 board.mjs SHA-256 同為 `e20b66b631e984eb67b7faf3d73a18b2f4cfaa065cdd6b864ca45144dbfdd87d`，並與工作區候選 bytes 比對相同。diff、退出碼與雜湊在 mutation.diff／mutation-record.json；完整失敗輸出保存在 mutation-fail-raw.json，mutation-fail-output.txt 僅移除行尾空白供 diff hygiene；還原輸出為 mutation-restored-output.txt。

## 邊界與交付

沒有啟用看板、server、背景服務、正式流程或 Herdr 分頁。未執行 hc send、未推送、未合併、未建立遠端 PR。遠端交件仍由獲授權者使用本機分支與 PR-draft.md 完成：`herdr/t-board-2-tui → herdr-local-board`。

## REVIEW-3 修正與重現

`build4-before.txt` 保存修正前同一批模型測試：20 項中 18 通過、2 失敗（exit 1），分別是 null version 被回傳 valid，以及 null 退回數未產生警告。修正後透過真正 readStateFile 驗證 null version 為 invalid，初次 unavailable，後續 stale 且保留同一份成功快照；省略 version 與 version 1 仍有效。

狀態列改為先顯示狀態種類、警告總數及警告內容，再放更新時間與路徑。長路徑超過 120 字元的合成 PTY 資料另加入 null 退回數；120／80／59 欄及 resize 均斷言倒數第二列可見 ready、非零警告數及未知欄位警告，最後一列保留退出提示。窄版僅保留可容納的警告前綴與總數，詳細文字可能裁切。基礎 fixture 未改，PTY 補充資料明確為 synthetic。

本輪未重新查詢 SURVEY 的歷史星數與發版資料；研究內容沿用已提交紀錄，不把它聲稱為本輪即時查詢。依賴保持不變；本輪程式只修 REVIEW-3 三項退回問題。
