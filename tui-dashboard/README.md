# Herdr 看板 TUI 原型（線二）

正式流程不含看板，啟用需 Pol哥 同意。

本目錄是 **唯讀**、**離線**、**手動在獨立分頁執行** 的最小終端看板，不建立 Herdr 分頁或窗格，不呼叫 `hc`／`herdr-app`、不開 herdr TUI server。

## 安裝（僅限本子目錄，勿全域安裝）

從 repo 根目錄：

```sh
npm --prefix tui-dashboard ci --ignore-scripts --no-audit --no-fund --cache tui-dashboard/.npm-cache
```

需要 Node ≥22、Python 3（PTY 測試僅用標準庫，無 Python 套件）。首次安裝需網路；**執行看板與 `node --test` 不需網路**。

## 執行

```sh
node tui-dashboard/src/cli.mjs --state tui-dashboard/fixtures/state.anonymized.json
node tui-dashboard/src/cli.mjs
```

路徑優先序：`--state` > 環境變數 `HERDR_BOARD_STATE` > `~/herdr-ops/board/state.json`（支援 `~/`）。

啟動後立即讀一次，之後每 5 秒重讀同一檔案（整檔 `readFile`，不用 mtime 略過）。

非 TTY 或無法取得終端尺寸時印簡短錯誤並以 exit code 2 結束。

## 測試

```sh
TZ=Asia/Taipei node --test
TZ=UTC node --test
```

完整輸出見 `docs/test-asia-taipei.txt`、`docs/test-utc.txt`。突變驗收（映射改壞後測試必須失敗）見 `docs/mutation-fail-output.txt`。

## 四欄映射

| 原始 column | 顯示欄 |
| --- | --- |
| todo | 待辦 |
| spec / build / review | 進行中（角色＋模型） |
| decide / pr / merge | 等把關 |
| merged / closed | 已結案 |

終態先歸已結案；未知 column 先歸待辦並警告；其餘已知狀態 `needs_pol === true` → 等把關。

## 卡片欄位

任務號、標題、角色／模型、停留時間（依任務 `updated_at` 近似，**非精確狀態進入時間**）、退回總數（`reject_counts` 有效非負整數加總，不含 `spec_rewrites`）。

## 必答題

**Q1：** 推薦 Ink v8；第二名 Textual。Ink 可沿用 Node 測試与 alternate screen 滿版；代價是 React/Yoga 相依與自行排版四欄。Textual 元件更完整但需 Python venv 與第二套測試。

**Q2：** 相對線一 mod，本原型做得到：四欄、精簡卡、唯讀輪詢、滿版／窄終端捲動、結案卡顯示。做不到：滑鼠詳情、results 開檔、完整退回歷史 UI、歸檔篩選、清範例卡、代理即時狀態／窗格跳轉、mod 內整合。

**Q3：** 業務寫入為零。讀取點如下。

| 檔案 | 行為 |
| --- | --- |
| `src/read-loop.mjs` | 唯一業務讀檔：`readFile(statePath, 'utf8')` |
| `src/cli.mjs` | 讀 argv、`HERDR_BOARD_STATE`、`HOME`；`--help` 不讀 state |
| `src/board.mjs` | 純記憶體解析 JSON，無 I/O |
| `src/app.mjs` / `src/terminal.mjs` | stdin 鍵盤、stdout/stderr 終端渲染（Ink alternate screen） |
| 依賴 Ink | 載入模組、終端尺寸；入口已要求有效 TTY 尺寸 |

業務程式外部指令呼叫點為零。依賴入口與動態驗證的範圍、限制詳見下表及 docs/io-audit.md。

## 參考

- 框架調查：`SURVEY.md`
- 假資料 Ink 終端輸出（ANSI 已剝除）：`docs/terminal-screens.txt`
- PR 草稿摘要：`docs/PR-draft.md`

## 操作與退出

120 欄以上四欄並排且欄頭固定；較窄時依序顯示四區，共用上下鍵、PageUp／PageDown 捲動。resize 會重排並限制捲動位置。q=0、Ctrl+C／SIGINT=130、SIGTERM=143、致命錯誤=1、無效參數或 TTY=2。每輪讀取完成後等待 5 秒，最多一筆在途讀取；首次錯誤顯示 unavailable，後續錯誤保留資料並顯示 stale，修復後 ready。

## Q3 實際 I/O 位置

| 位置（相對本目錄） | I/O 與用途 |
| --- | --- |
| src/cli.mjs:7、16、26、30–31、39 | argv／路徑環境變數；help、參數與致命錯誤寫終端 |
| src/read-loop.mjs:14 | 唯一業務檔案 I/O：readFile 指定 state；每輪重新開路徑 |
| src/app.mjs:3–10、34、40、47–56 | TTY 尺寸／動態載入程式；讀取迴圈；終端；signal 監聽與清除 |
| src/terminal.mjs:7–12、17–24 | stdout 尺寸與 resize、stdin 鍵盤；其餘為純投影 |
| src/board.mjs、src/layout.mjs | 無檔案、程序或網路 I/O |
| node_modules/ink/build/ink.js:307–328、411–433 | 終端尺寸、resize、alternate screen 與 stdout；App.js:145、265、334 處理 raw mode |
| node_modules/ink/build/utils.js:16–25、terminal-size/index.js:81–165 | 有效 TTY 尺寸走直接回傳；fallback 可讀 /dev/tty、/proc 或 execFileSync(tput/resize)，本入口拒絕無尺寸並以真 PTY guard 驗證未到達 |
| node_modules/ink/build/reconciler.js:10–25、102–119 | DEV=true 時可載入選配 devtools 與讀 package.json；本鎖檔未安裝 devtools。測試明設 DEV=false |
| node_modules/ink/build/components/ErrorOverview.js:1 | 發生呈現錯誤時可讀堆疊對應的程式來源；限程式資源，未掃描業務資料目錄 |
| node_modules/yoga-layout/dist/binaries/yoga-wasm-base64-esm.js:15 | fetch 內嵌 data:application/octet-stream;base64 WASM，無 socket；guard 僅放行此 data URI |
| support/、test/ | 測試工具可建立隔離假檔、啟動子程序與擷取證據；不屬於原型 runtime，writer 與受測 CLI 分開 |

攔截在獨立 CLI 子程序載入 Ink 前生效，並同步 ESM builtin 引用；13 項陽性控制涵蓋 sync／callback／promises／FileHandle 寫入、可寫 open、程序及網路。真實 PTY 均核對 guard 零違規、state bytes／mtime／隔離目錄內容、退出限時及 termios。Node 26 另以權限模式交叉驗證，並用三項拒絕控制確認檔案／程序／網路限制有效；這不是完整 OS 沙箱，也不改 Node 22 門檻。此環境未安裝 Node 22，因此沒有宣稱已在 Node 22 實跑。

固定程式、測試與 lockfile 的候選 SHA 與雙時區總數見 docs/acceptance.md；PTY ANSI 原始連續輸出見 docs/pty-*.json，headless terminal 解析後逐畫面文字見 docs/terminal-*.txt。可用 `TUI_CAPTURE_EVIDENCE=1 TZ=Asia/Taipei node --test` 重建，測試證據會寫入本子目錄 docs，原型本身不寫檔。
