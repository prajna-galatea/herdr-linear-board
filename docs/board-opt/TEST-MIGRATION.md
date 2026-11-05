# 衝突案例替代對照

基準原 38 項。保留原版 Linear 的 board/task 測試；本機模式舊測試按唯讀 v2 契約替換，沒有 skip。

| 舊本機案例 | 替代 |
|---|---|
| parseState / unknown columns | 真實 `{at,col,note}`、四欄、未知與缺值警告 |
| taskLine / dispatch configured commands / agent matching | 卡面五項、角色前綴、搜尋與模型事件；移除派工能力 |
| gate requests / pending request association / first message delivery | 全事件唯讀測試、requests/gates 哨兵與所有外部操作清單 |
| example file per column | merged、closed、example true、T-001～T-003 的可逆歸檔 |
| config roles | 唯讀路徑優先序、無效設定、切換來源 |
| local absolute opener | 真實 open.js 透過詳情點擊，拒絕 URL 與路徑控制字元 |
| unknown column still offers dispatch | 待辦警告與同窗格詳情，不再提供派工 |
| same-mtime poll | 保留同大小同 mtime 內容更新，增加遺失、壞 JSON、恢復 |
| dispatch/gate write unique files | 搜尋、模型、歸檔、卡片、返回、Refresh、timer 均唯讀 |

另外涵蓋尺寸兩參數回呼、關閉時取消工作、讀取進行中關閉及重開案。預期映射與斷言直接來自 SPEC-v2；詳細案例與數量見雙時區 TAP 輸出。
