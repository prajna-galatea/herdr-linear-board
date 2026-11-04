已讀技能：principle-laziness-protocol、principle-prove-it-works、principle-fix-root-causes、tdd

# BUILD-5 驗收紀錄

- 依據：正式任務單 T-board-2.md、SPEC-v2.md、REVIEW-4.md；本輪只修正兩項退回及其回歸證據。
- cwd：`/Users/pauuul/Documents/PJ/herdr-linear-board-tui`
- 分支：`herdr/t-board-2-tui`；base `herdr-local-board`：`b532c4db76f17614de16cdba30e4230afe772f97`
- 受測提交：`62ab4f6c3dcb9f44b13162deaba5ed308dbbe162`。後續提交只更新 docs；18 個程式、測試、fixture 與依賴清單的 SHA-256 見 candidate-files.sha256。最終提交 SHA 寫於指定 BUILD-5.md，避免提交內容自我雜湊。
- 環境：macOS、Node v26.7.0、npm 11.19.0、Python 3.14.7。Node 22 未實跑，保留 Node ≥22 門檻。
- fixture SHA-256：`955bea3f96956b37199ac58328c7ada21a7467abd4eed02ae895bf2fb5fc8dbc`
- lockfile SHA-256：`c89813f840c8990d0f76dd1c3ae1890efbd7ba7af536b9aaa0673851c9e8a598`
- 修改前備份：`/private/tmp/t-board-build5-backup-d1t2obvf`，hashes.json 記錄原始雜湊；不提交備份。

| 指令 | exit | 通過／失敗／取消／跳過 | 完整輸出 |
| --- | --- | --- | --- |
| `node --test tests/*.test.mjs` | 0 | 38／0／0／0 | baseline-38.txt |
| `node --test tui-dashboard/test/board.test.mjs`（修正前） | 1 | 24／5／0／0 | build5-before.txt、build5-before-raw.json |
| `node --test --test-name-pattern='real CLI polling' tui-dashboard/test/terminal.test.mjs`（修正前） | 1 | 0／1／0／0 | build5-pty-before.txt、build5-pty-before-raw.json |
| `node --test tui-dashboard/test/board.test.mjs`（修正後） | 0 | 29／0／0／0 | build5-after.txt |
| `TUI_CAPTURE_EVIDENCE=1 TZ=Asia/Taipei node --test` | 0 | 73／0／0／0 | test-asia-taipei.txt |
| `TZ=UTC node --test` | 0 | 73／0／0／0 | test-utc.txt |
| `node tui-dashboard/support/guard-controls.mjs` | 0 | 13 個禁止操作均攔截 | io-positive-controls.txt |
| `node --permission --allow-fs-read='*' tui-dashboard/support/permission-controls.mjs` | 0 | 3 類權限均拒絕 | permission-controls.txt |

全套含原有 38 項及原型 35 項。兩個時區依序執行；UTC 明設 TUI_CAPTURE_EVIDENCE=0，保留 Taipei 擷取的連續畫面。外層全套 deadline 150 秒、模型測試 30 秒、修正前 PTY 90 秒；內層 PTY、CLI 與 finally 維持既有 timeout／程序群組回收。雙時區全套各約 80 秒結束。

## REVIEW-4 修正與直接證據

1. 非物件任務原本在 id 驗證前靜默 continue；現集中到同一略過並警告分支。null、12、字串、布林、陣列、空物件及無效 id 共九個獨立案例，不再依賴另一個項目的警告。修正前四項實際得到 `[]`，預期為 `['略過缺少 id 的任務']`；修正後皆通過。
2. 不支援的 version 原本直接插入模板字串，`{"version":{"toString":null},"tasks":[]}` 在錯誤訊息產生時拋出 TypeError。現以固定診斷文字回傳 invalid，不再轉換未驗證的值；沒有用 catch 隱藏解析故障。readStateFile 覆蓋 null、數字、字串、布林、陣列與物件，確認首次 unavailable、後續 stale、保留相同 snapshot 與 readAt、修復後 ready；省略 version 或 version 1 仍有效。

修正前真 CLI 輪詢輸出包含 `看板錯誤：Cannot convert object to primitive value`，程序 exit 1，斷言 `1 !== 0`。修正後真 PTY 的 `stale-object-version` 畫面保留 tri 卡片並顯示 `stale 顯示舊資料：不支援的 version（僅接受 1 或省略）`；`recovered-version` 顯示 ready 與 tri。這些是外部 writer 改假檔、正式五秒輪詢及 headless terminal 重播所得，非 formatter 模擬。

PTY 證據亦涵蓋 120×40／80×24／59×24、捲動、120→59→120 resize、同長度且相同 mtime、原子替換、JSON／schema／unreadable／missing 與空陣列復原。q／Ctrl+C／SIGINT／SIGTERM 對應 0／130／130／143；所有 case 核對 termios 還原、檔案快照一致及 guard 空 violations。逐畫面文字為 terminal-*.txt；ANSI 原始連續輸出為 pty-*.json。

## 突變

在 `/private/tmp` 隔離候選副本僅將 active bucket 改成 todo，沿用同一份 board.test.mjs：29 項中 27 通過、2 失敗、exit 1。其中一項有效映射斷言明確失敗：DEMO-SPEC 未出現在進行中（actual false、expected true）。另一項因預期的 active 卡不存在而出現 TypeError，不列為額外映射證據；有效證據不是語法或載入失敗。

還原後 29 項全過、exit 0；board.mjs 前後 SHA-256 同為 `a611de276e647c9d923ada27df5a815fcd7fd4a749c240669758b1f75fdb3005`，與候選 bytes 相同，隔離副本已清除。diff、退出碼與雜湊在 mutation.diff／mutation-record.json；完整 stdout／stderr 在 mutation-fail-raw.json，還原輸出為 mutation-restored-output.txt。含失敗 diff 的 .txt 只移除行尾空白；*-raw.json 保留原始輸出。

## 唯讀、秘密掃描與交付

業務檔案讀取仍只有 src/read-loop.mjs:14。應用外部指令呼叫點為零，沒有新增 I/O；13 項 I/O guard 控制與 Node 26 三類權限拒絕均重新執行。唯讀證據涵蓋鎖定依賴及測試情境，不是完整 OS 沙箱。秘密掃描命令、範圍與結果見 gitleaks.txt，diff hygiene 與候選雜湊另於最終交件核對。

五框架調查、README Q1–Q3 與 fixture 來源沿用已提交紀錄，本輪未重新連網查核星數、發版或現行 state，沒有將既有擷取聲稱為本輪即時查詢。PR 草稿更新為最終行為與 73 項驗證。

沒有啟用看板、server、背景服務、正式流程或 Herdr 分頁，未執行 hc send、未推送、未合併、未建立遠端 PR。遠端交件由獲授權者處理 `herdr/t-board-2-tui → herdr-local-board`；本機提交與草稿不等於遠端 PR。
