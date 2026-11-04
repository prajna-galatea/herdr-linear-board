# 假資料來源

2026-11-04 只讀現行 `~/herdr-ops/board/state.json` 的 schema；來源 SHA-256 為 `1a0b2245a9eadcca36b2364933e73aeb386d02a9ae6583f02814411a2d8b5c58`。
頂層鍵為 version／updated_at／tasks／dispatch；任務鍵為 _d／column／id／model／needs_pol／pane／reject_counts／repo／results／spec_rewrites／title／updated_at。
fixture 使用相同 schema，所有任務號、標題、模型、時間、路徑及 dispatch 值均換成假值；額外狀態、長標題與異常欄位是 synthetic 情境，不是現場真實事件。測試不使用真實 state。
