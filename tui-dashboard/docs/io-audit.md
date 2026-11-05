# 唯讀驗證範圍

runtime 只有 src/cli.mjs → app/read-loop/board/terminal/layout；測試 writer 不載入 runtime。業務讀取只有 read-loop.mjs:14。

support/io-guard.mjs 在 --import preload 中先安裝，攔截 fs callback／sync／promises 異動、write／writev、可寫 open flags、FileHandle prototype、write stream、child_process、net／Socket／Server、tls、dgram、http／https／http2、DNS／Resolver、fetch／WebSocket。終端 fd 1／2 可輸出；Yoga 的內嵌 base64 data URI 可載入，其他 fetch 拒絕。禁止嘗試即留 violations，退出時非空必改 exit 1，不能靠吞例外通過。

guard-controls.mjs 的 13 控制須全部被阻止；包含前次漏掉的 openSync(w)、writeSync 與 FileHandle.write。permission-controls.mjs 不安裝 guard，獨立證明 Node 26 權限模式拒絕三類 I/O。

PTY 的 HOME／XDG／TMPDIR 為空暫存目錄。非 polling 個案比較啟動前到退出後所有檔案 bytes、mtime 與目錄內容；polling 個案由外部 writer 寫入，每次結束前到退出後比對，且受測程序全程由 guard 計數。它不把 writer 的必要寫入誤算成原型寫入。所有測試子程序設 deadline，finally 回收 process group。

限制：動態證據針對本鎖檔、macOS、真實 PTY 與固定情境，不宣稱涵蓋任意 native addon、任意外部依賴或 OS syscall；Node 26 權限模式是額外交叉檢查。
