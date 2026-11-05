已讀技能：principle-laziness-protocol、principle-prove-it-works、principle-fix-root-causes

# BUILD-5 驗證

REVIEW-4 的詳情失效警示已修正，候選原生三尺寸、完成的 mod check、雙時區、五類撤回及提交證據已補齊；僅完成本機交付，尚待既有流程獨立審查與送 PR。

- cwd：`/Users/pauuul/Documents/PJ/herdr-linear-board`；分支 `herdr/t-board-1`。
- base：`b532c4db76f17614de16cdba30e4230afe772f97`；程式候選：`083991ca7e8d5e2176d395ea74e8d06bc82d080a`。
- 依據：正式任務單 T-board-1、SPEC-v2、REVIEW-4 全文；本輪只修正詳情分支遺漏來源警示，沒有新增產品 I/O 或程序操作。
- 修改前備份程式、測試、既有文件、工作樹與暫存差異；備份路徑記於指定 BUILD-5 結果檔。

## 指定提交測試

`git clone --no-local --no-hardlinks --single-branch --branch herdr/t-board-1 <本機repo> <臨時副本>`，確定 HEAD 為上述程式候選、工作樹乾淨，使用臨時 HOME／XDG_CONFIG_HOME／HERDR_APP_HOME：

| 命令 | exit | pass | fail | skip | 完整輸出 |
|---|---:|---:|---:|---:|---|
| `TZ=Asia/Taipei node --test` | 0 | 55 | 0 | 0 | [build5-taipei.txt](build5-taipei.txt) |
| `TZ=UTC node --test` | 0 | 55 | 0 | 0 | [build5-utc.txt](build5-utc.txt) |
| `herdr-app check mods/herdr-board` | 0 | — | — | — | [build5-mod-check.json](build5-mod-check.json) |

副本、HEAD、乾淨狀態與程式／測試逐檔 SHA-256：[build5-pinned.json](build5-pinned.json)。mod check 在同一候選副本完成，使用隔離 app home；沙箱內首次嘗試出現圖形服務 Connection Invalid 並逾時，另存 [build5-mod-check-sandbox.json](build5-mod-check-sandbox.json)，其結果不計通過。

新增 `tests/herdr-board-runtime.test.mjs:106`，從實際卡片點擊進詳情，再觸發 timer，驗證缺檔、壞 JSON、讀取錯誤都保留詳情並顯示「未更新」，恢復後顯示新標題並清除警示。產品由 `main.js:204` 集中建立警示，詳情 `:213`、看板 `:267` 共用。

## 撤回修正

從程式候選複製 mods／tests 到各自臨時目錄，不破壞工作樹。執行候選中既有 `python3 docs/board-opt/verify-mutations.py`；每個變體的命令、exit、失敗數與案例見 [mutation-results.json](build5-mutations/mutation-results.json)，`.patch.gz` 與 `-raw.txt.gz` 保留完整差異及原始 TAP。

| 類別 | exit | 失敗數 | 對應行為失敗 |
|---|---:|---:|---|
| 恢復實際 request 寫入 | 1 | 13 | UI 初始化／互動拒絕 `forbidden writeTextFile` |
| 四欄映射錯誤 | 1 | 1 | decide 實得 active，應為 gate |
| 卡面退回總數錯誤 | 1 | 1 | 實際卡片缺少預期「退回 3」 |
| 忽略尺寸事件 | 1 | 1 | 窄版實得 `[4]`，應為 `[1,1,1,1]` |
| 取消結案自動歸檔 | 1 | 3 | 歸檔切換、預設隱藏與重新開案契約失敗 |
| 撤回本輪詳情警示 | 1 | 1 | 詳情文字不符合 `/未更新/` |

前五類命令為 `TZ=Asia/Taipei node --test --test-reporter=tap`；詳情撤回命令、exit 及差異另見 [detail.json](build5-mutations/detail.json)、[detail.patch](build5-mutations/detail.patch)、[detail.txt](build5-mutations/detail.txt)。失敗來自行為斷言或明確被阻擋的寫入嘗試，沒有語法或匯入失敗。

## 原生三尺寸

| 原生 shot | 邏輯根寬 | 排列 |
|---|---:|---|
| [build5-narrow.png](build5-narrow.png) | 433px | 一欄，整板垂直捲動 |
| [build5-medium.png](build5-medium.png) | 733px | 二欄，四狀態分兩列 |
| [build5-wide.png](build5-wide.png) | 1263px | 四欄，最右完整可見 |

每次以新臨時 HERDR_APP_HOME 啟動專用原生視窗，zoom=1；在明確指定的本任務 space，以 `tab.new --mod board-capture --props '{"state":"<假資料路徑>"}'` 建立單一 mod 窗格分頁。假資料 [native-state.json](native-state.json) 含四欄、長標題、長模型及多模型退回。截圖由 `herdr-app shot` 產生並逐張直接檢視。

透明說明：截圖使用 [build5-native-driver.js](build5-native-driver.js) 繼承未修改的候選 View，僅將歸檔設為全部，附加根寬文字與日誌。驅動**沒有設定或覆寫 on_size_change、rootWidth 或 layoutForWidth**；量測值來自候選原本兩參數尺寸回呼更新的 rootWidth，沒有用 PNG 物理像素換算。候選預設未歸檔及事件邊界由 runtime 測試驗證。這與前版覆寫尺寸回呼的舊驅動不同，舊圖不作本輪證據。

本輪以隔離 home 中 `shared.json`／`update-notes.json` 設定首次導覽及已呈現版本；初次被遮罩遮住的圖片已重拍。正式設定沒有修改。每張截圖 status 的 errors／overlays 都為空，`ls` 僅保存本任務 space；tab.new 回應只有一個 pane，未發送分割命令。截完以 space.close 關閉本任務 space，隨後 ls 確認已移除，再 app.quit 並等待專用程序 exit 0。

完整命令、退出碼、清理後 ls：[build5-native-commands.json](build5-native-commands.json)；候選逐檔與拷貝雜湊、假資料雜湊、實測根寬、視窗設定及程序退出：[build5-native-hashes.json](build5-native-hashes.json)。各尺寸的 `build5-*-status.json`、`build5-*-ls.json`、`build5-*-window.txt` 亦保留。重跑：`python3 docs/board-opt/build5-native.py <指定候選Git副本>`；需原生圖形服務權限。

## Q1–Q3 與邊界

- Q1：`state.js:280` 投影、`main.js:148` 詳情、`open.js:5` 開啟器。詳情保留全部既有 `_d.history` 欄位、模型別次數、重寫、results 與任務資料夾入口。逐次退回原因須查結果報告；來源未記錄的事件不能還原。
- Q2：有未歸檔／已歸檔／全部，預設未歸檔；只改本次 View，重新開案由原流程負責。
- Q3：`main.js:54` 必要時讀 appHome()/herdr-board.json，`:77` 讀選定 state；`state.js` 無 I/O；`open.js:9–11` 明確點擊有效入口後以分離參數呼叫 explorer／xdg-open／open。完整盤點見 [io-audit.txt](io-audit.txt)。實際事件測試比對 state 完整位元組及 requests／gates 哨兵的檔名、內容，拒絕清單外操作；普通互動沒有程序呼叫。唯讀撤回證明寫入嘗試會使測試失敗。

`rg -n "split|pane.new|live.?workspace" mods/herdr-board` exit 1、零命中，見 [build5-pane-check.txt](build5-pane-check.txt)。秘密掃描見 `build5-secret-scan.txt`／`build5-secret-report.json`；白名單及三點差異見 `build5-paths.txt`。原 38 案例替換對照保留於 TEST-MIGRATION.md；既有 BUILD-4 未提交證據一併納入 docs 作歷史紀錄，不當成本輪結果。

正式流程不含看板，啟用需 Pol哥 同意。未動 tui-dashboard、上游 Linear 模組或正式 herdr-ops；未啟用、push、建立遠端 PR、合併、部署或執行 hc send。PR 材料供既有流程送往同一 fork 的 herdr-local-board；獨立審查仍由不同模型執行。

交付核對：程式候選後的證據提交 `62d619a` 僅變更 docs/board-opt；提交中所有必要輸出、三張 PNG、PR.md 均存在，並以 git show 讀回核對雜湊。最終路徑清單見 build5-paths.txt。失敗 TAP 的 `.txt` 僅去除行尾空白以通過 diff check，`.txt.gz` 保留原始位元組。
