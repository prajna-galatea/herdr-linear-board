# BUILD-3 五類實際撤回修正

執行 `python3 docs/board-opt/verify-mutations.py`，每類在各自臨時實體副本修改，原工作樹不變。完整命令、退出碼、失敗數與案例在 `mutation-results.json`；每類差異及完整 TAP 輸出分別在 `revert-<類別>.patch.gz`、`revert-<類別>-raw.txt.gz`。

- readonly：在真實 reload 入口恢復 writeTextFile，事件測試拒絕寫入並失敗。
- lanes：把等把關狀態錯放進行中，四欄契約失敗。
- card：實際卡面顯示錯誤退回總數，事件畫面斷言失敗。
- layout：忽略實際 size.width，兩參數尺寸事件測試失敗。
- archive：結案不自動歸檔，實際卡片及投影測試失敗。

這些都是行為／斷言失敗，沒有語法或匯入失敗，也沒有只寫「若恢復就會失敗」。唯讀變體另觸發靜態測試，但不是其唯一失敗證據。

原始 TAP 與 diff 以 gzip 無損保存，避免原始診斷空白導致 diff whitespace 警告；可用 `gzip -dc <檔案>` 還原完整內容。
