# BUILD-3 提交候選驗證

- cwd：`/Users/pauuul/Documents/PJ/herdr-linear-board`
- branch：`herdr/t-board-1`
- base：`b532c4db76f17614de16cdba30e4230afe772f97`（herdr-local-board）
- 程式／測試候選 HEAD：`a3e8038337cffe3cfd165da94940336c3a4df399`
- 乾淨隔離 clone：`/var/folders/tl/j59n3_9x3gj_3t0pd7pwmcdm0000gn/T/T-board-pinned-himo03fa/repo`，clone 使用 `--no-local --no-hardlinks`，測試前 status --porcelain 為空，HEAD 完全一致。
- 此後補件提交只變更 docs/board-opt/，不變更程式與測試；最終分支 HEAD 與乾淨狀態由 BUILD-3 記錄。

## 實際驗證

`TZ=Asia/Taipei node --test`、`TZ=UTC node --test`：在上述候選 clone 執行，各 52 tests、52 pass、0 fail、0 skipped，exit 0。完整輸出為 pinned-asia-taipei.txt 與 pinned-utc.txt；可重做的 metadata 在 pinned-result.json。

`herdr-app check <乾淨 clone>/mods/herdr-board`：exit 0，完整輸出 pinned-mod-check.txt。使用專用臨時 HERDR_APP_HOME；正式設定未修改。收尾對該 home 執行 ls 已無可連線視窗（exit 2，native-cleanup.txt）。原生測試 space.close 與 app.quit 各次成功，見 native-commands.json。

五類撤回：readonly 10 項失敗（exit 1）、lanes 1 項失敗（exit 1）、card 1 項失敗（exit 1）、layout 1 項失敗（exit 1）、archive 3 項失敗（exit 1）。完整無損輸出／差異用 gzip 保存；verify-mutations.py 可在獨立副本重做。不是語法或匯入失敗。

`gitleaks dir --redact --no-banner --no-color --max-archive-depth 2 <候選變更檔隔離副本>`：exit 0、no leaks found；見 pinned-secret-scan.txt。掃描逐一由 base...HEAD 的變更路徑建立副本，包含壓縮證據；不掃描 .env、金鑰或正式資料。

## 雜湊與範圍

pinned-hashes.json 記錄候選所有 mods/herdr-board 與 tests 已追蹤檔案 SHA-256，逐檔核對工作樹一致。native-hashes.json 記錄截圖所用候選拷貝，與提交候選產品檔案一致，另含假資料、驅動與三張 PNG 的 SHA-256。驅動僅位於 docs 和隔離驗收 home，產品不引用它。

`git diff herdr-local-board...herdr/t-board-1` 非空；pinned-result.json 的 allowed_paths 已逐項斷言只屬 mods/herdr-board/、tests/、README.md、RECIPE.herdr.md、docs/board-opt/。沒有 tui-dashboard、上游 Linear 模組、main 或正式路徑的修改。

原生 stdout 的文字摘要僅移除多餘檔尾空行；完整操作 stdout 以 native-commands.json 的 JSON 字串保存。原始 TAP/diff gzip 沒有刪改空白。最終 diff --check 另行檢查。

## 尚待既有流程

本機施工與證據已交付；沒有執行 push、建立遠端 PR、合併、部署、啟用或 hc send。PR 說明已備於 PR.md，目標為同一 fork 的 herdr-local-board。獨立審查須由不同模型執行，既有額度不重置。
