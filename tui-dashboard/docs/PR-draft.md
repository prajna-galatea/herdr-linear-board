## PR 草稿（herdr/t-board-2-tui → herdr-local-board）

### Summary

- 新增 `tui-dashboard/`：Ink v8 唯讀四欄看板原型 + 框架調查 SURVEY.md
- 自動測試：`node --test` 由 38 增至 53，Asia/Taipei 與 UTC 皆通過
- 突變驗收：刻意將 column 映射改為全部待辦時 3 項失敗（見 `docs/mutation-fail-output.txt`）

### Q1–Q3

見 `tui-dashboard/README.md` 必答題一節。

### 證據

- 測試：`docs/test-asia-taipei.txt`、`docs/test-utc.txt`
- 終端：`docs/terminal-demo-plain.txt`（fixture 文字投影；實機 TTY 請手動執行 README 指令）
- gitleaks：`docs/gitleaks.txt`（no leaks found）
- 調查：`tui-dashboard/SURVEY.md`

### Test plan

- [ ] `npm --prefix tui-dashboard ci ...` 後以 fixture 路徑執行 CLI，確認四欄與 q 退出還原畫面
- [ ] 對照 `state.json` schema 與四欄映射表
- [ ] 審查 I/O 表確認唯讀
