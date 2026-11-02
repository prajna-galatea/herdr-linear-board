# Herdr 新任務流程

本機看板。七個固定欄，任務來自一張 JSON，不連網、不叫 `claude`、不建 worktree。合併不會自己發生。

## What you see

彈出視窗，寬 94%、高 90%，圓角 10，1px `border`，字 13px。由上到下：

- **標題列**，高 46px：`Herdr 新任務流程`，旁邊是 `N 個任務`（11px `dim`）。右邊是 220px 的篩選框，提示 `編號或標題`，有字時框線為 `accent`。再右邊是 `Refresh`（讀取中變成 13px 轉圈）。
- **模型列**：`全部`，然後每個模型一顆，空模型叫 `未標模型`，數量用 `dim`。選中的是 `selected`。
- **七欄**，從左到右永遠都在，哪怕是空的：待辦、herdr cto 把關、規格師、施工手、審查手、合併手、已合併。每欄寬 280px，欄與欄 12px，欄內卡片間距 8px。欄頭 34px：欄名 13px、數量 12px `dim`。
- **卡片**：編號 11.5px `dim`；標題 13px，完整顯示、不截斷，至少 42px 高。下面是 22px 的圓角 pill：模型、分頁名、`退回 <模型>×<次數>`、`規格重寫 N`（大於 0 才有）、`範例`、`等 Pol哥`、`待處理請求`。有對上的 agent 時，同一排有 Working／Needs you／Done／Idle，顏色用該狀態的主題色，Working 帶轉圈。底列左邊是 `更新 M月D日`。待辦、規格師、施工手、審查手的右邊是 `派工`；合併手的右邊是 `送 herdr cto 把關`。`needs_pol` 為真時卡片框線用 `accent`，否則有 agent 就用狀態色。
- 檔案不在：七欄仍在，上方一行 `尚無任務：~/herdr-ops/board/state.json`（或設定裡的路徑）。JSON 不合法：錯誤用 `ansi1`，板上留著上一份讀成功的內容。未知的 `column` 進待辦，卡片上仍有 `派工`，並在欄的上方用 `dim` 寫 `未知欄位「…」的 T-001 已放進待辦`。

**派工對話框**（480×420，`popover`）：標題 `派工 T-001`，下面是任務標題。`角色分頁` 是一排 chip。`補充說明` 是 3 到 8 行的文字框。底下是錯誤、`取消`、`派工`。

## How it behaves

- 資料檔預設 `~/herdr-ops/board/state.json`。`~/.config/herdr-app/herdr-board.json` 可以改 `state`，以及每個角色的指令 `roles`。`~` 會展開。檔案壞掉或沒寫的角色，用內建指令：`build-grok` 是 `grok -m grok-4.7`，`review` 是 `codex --no-daemon`，其餘角色預設 `grok`。
- 打開時讀一次，按 `Refresh` 再讀，打開期間每 5 秒重讀檔案與請求目錄。不合法的 JSON 不覆蓋記憶體裡上一份。
- 文字篩編號與標題，不分大小寫。模型篩跟它一起作用。兩個都在這次打開裡，關掉就忘。
- 卡片對 agent：先拿任務的 `pane` 對 herdr-core 終端機的 `name`，再對 `agents()` 的 address。對不到，才看分頁或 space 名稱裡有沒有任務編號。點狀態會選到那個 space、tab、pane，並關掉看板。
- 點卡片：有結果路徑就用系統的 `open`（Windows 用 `explorer`，Linux 用 `xdg-open`）打開。規格師／施工手／審查手優先開自己那欄的路徑，否則依審查、施工、規格的順序拿第一個有的。沒有路徑就什麼都不做。只開本機絕對路徑，或 `~` 開頭的路徑。網址、相對路徑和控制字元都不開。
- `派工` 打開對話框。預設分頁：規格師 `spec`，施工手 `build-grok`，審查手 `review`，待辦也是 `spec`。確定後由看板執行：這個名字的終端機還在，就 `hc send --if idle <pane> "<一行任務>"`；不在，就 `hc run --bg --name <pane> --keep --label herdr.space=<目前 space> --label herdr.tab=<目前 tab> -- <角色指令> "<一行任務>"`。有 repo 而且是新開的分頁時，加上 `--cwd`。沒有目前的 space 或 tab 就不新開。先建立派工請求，再嘗試送出任務。未知欄位的請求帶 `column_hint: "todo"`。
- 一行任務會去掉控制字元，含編號、標題、repo、有的結果路徑、補充說明，以及 `Use only herdr-app and hc.` 與 `Do not merge, push or deploy.`
- `送 herdr cto 把關` 建立 `gate` 請求；若有 `lead` 終端機，再 `hc send --if idle -- lead "task <id> 待 herdr cto 把關"`。不跑 git，不合併，不推送。
- 看板不寫狀態檔。派工與把關請求寫到 `~/herdr-ops/board/requests/`，先建立同目錄暫存檔，再以不覆寫方式改名。每個請求包含版本、種類、任務、角色、補充、時間與來源；目錄中有該任務的請求時顯示 `待處理請求`。未來的派工腳本負責處理並移除請求。對話框只把選擇放進 shared `herdr-board.request`。
- 角色名要符合 `^[a-z0-9_][a-z0-9_-]{0,31}$`，不能以 `-` 開頭。`hc send` 在名字前面加 `--`，避免名字被當成選項。`hc run` 若回傳 `first_message.sent: false`，不算派工成功；已建立的請求仍保留。
- 再開一次這個看板會關掉它（快捷鍵當開關）。鍵沒有預先綁，避免跟 Linear 看板的 `ctrl-shift-y` 搶。

## Built from

- `mods/herdr-board/main.js`：看板 `View`。`mod.json` 是 `{ "place": "none", "title": "Herdr 新任務流程", "overlay": { "width": 0.94, "height": 0.9 } }`。
- `mods/herdr-board/state.js`：純函式。`parseState`、`parseConfig`、`boardColumns`、`filterTasks`、`taskLine`、`hcArgv`、`mergeAction`、`makeRequest`、`pendingTasks`、`taskAgent`。給 `node --test` 載入，不 import Herdr。
- `mods/herdr-board/open.js`：`openFile`。
- `mods/herdr-board/spinner.svg`。
- `mods/herdr-board-agent/main.js`：派工對話框。`openOverlay({ mod: "herdr-board-agent", kind: "dialog", width: 480, height: 420, props })`。
- `examples/state.example.json`：七張 `[範例]` 任務。
- Herdr：`agents`、`terminals`、`spaces`、`focused`、`theme`、`home`、`appHome`、`readTextFile`、`writeTextFile`、`exec`（讀取目錄及建立請求檔）、`hc`、`run`、`openOverlay`、`closeOverlay`、`shared`、`setShared`、`props`。
- 不呼叫 `claude`，不呼叫 Linear，不建立 worktree，不開伺服器。

## Watch out

- 兩個 mod 不能互相 import。任務那一行與寫檔都在看板；對話框只交選擇。
- `hc` 的名字只能是 1–32 個 `a-z`、數字、`-`、`_`。
- 遠端 space 的 id 帶 `機器/` 前綴。寫 label 時要拿掉前綴。
- `hc send --if idle` 在對方不是 idle 時會失敗，這時請求檔仍保留。
- `writeTextFile` 的第三個參數是預期的舊內容；`null` 代表新檔。請求檔使用同目錄暫存檔及不覆寫的 `mv`。
- 第一個 `render` 不能等檔案讀完。還沒讀完時顯示「讀取任務…」。
- 跟 Linear 看板一樣，重複開啟會關掉。view class 留在 `globalThis`，避免熱機後每次開啟都重新暖機。
- 繪圖路徑少做函式與排序比較。卡片數量以這個流程的手邊任務為準，沒有另做 80 張上限。
- `herdr-app check` 只畫第一次，不會真的派工。

## Done when

- `node --test` 通過。其中含狀態解析、欄位對應、任務那一行的清洗，以及合併動作的結果裡沒有 git。
- `herdr-app check mods/herdr-board` 與 `herdr-app check mods/herdr-board-agent` 通過。
- `mods/herdr-board` 與 `mods/herdr-board-agent` 裡沒有 `claude -p`，也沒有 Linear。
- 狀態檔不存在時，畫面上是「尚無任務」，而不是空白錯誤。
- 按「送 herdr cto 把關」後會建立請求，狀態檔保持不變，沒有任何 git 指令被執行。
