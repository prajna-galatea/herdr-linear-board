# 開源終端看板／TUI 框架調查

查詢日期：2026-11-04（GitHub REST API `repos/*` 與各專案 releases/latest，施工時重跑核對）

## 候選摘要

### 1. Ink

- 網址：https://github.com/vadimdemedes/ink
- 授權：MIT（https://github.com/vadimdemedes/ink/blob/master/license）
- 語言：TypeScript（Node 執行，JS 可直接 `createElement`）
- 星數：40,218（查詢日 2026-11-04）
- 最近正式發版：v8.0.0，2026-10-03 UTC（https://github.com/vadimdemedes/ink/releases/tag/v8.0.0）
- macOS：Node ≥22、專案內 `npm ci`；需 React ≥19.3
- 滿版：`alternateScreen: true` 進 alternate buffer，離開還原
- 唯讀輪詢 JSON：應用層 `fs.readFile` + `setInterval`／timer；框架不寫業務檔
- 依賴：直接鎖 ink 8.0.0 + react；間接含 Yoga 等排版依賴
- 維護風險：活躍發版、星數高；v8 對 React 版本要求高，需鎖版本

### 2. Textual

- 網址：https://github.com/Textualize/textual
- 授權：[MIT](https://github.com/Textualize/textual/blob/main/LICENSE)
- 語言：Python
- 星數：37,573
- 最近正式發版：v8.2.8，2026-06-30 UTC
- macOS：Python 3.9+、專案 venv；`textual run` 或 App 類別
- 滿版：內建 App 全螢幕與捲動元件
- 唯讀輪詢 JSON：`Path.read_text()` + App 計時器
- 依賴：Python 生態 + textual 相依樹
- 維護風險：Textualize 商業支持、發版穩；但本 repo 驗收以 Node 為中心，需另建 Python 測試入口

### 3. Ratatui

- 網址：https://github.com/ratatui/ratatui
- 授權：[MIT](https://github.com/ratatui/ratatui/blob/main/LICENSE)
- 語言：Rust
- 星數：23,158
- 最近正式發版：ratatui-v0.30.2，2026-06-19 UTC
- macOS：Rust toolchain、cargo build；crossterm 等 backend
- 滿版：TUI backend 全螢幕
- 唯讀輪詢 JSON：自行整合 event loop + `std::fs::read_to_string`
- 依賴：Cargo 相依；編譯產物需納入交付策略
- 維護風險：社群活躍；Rust 建置與 MSRV 需每次核對

### 4. Bubble Tea

- 網址：https://github.com/charmbracelet/bubbletea
- 授權：[MIT](https://github.com/charmbracelet/bubbletea/blob/main/LICENSE)
- 語言：Go
- 星數：45,601
- 最近正式發版：v2.1.1，2026-10-28 UTC
- macOS：Go 1.26+（依 v2.1.1 go.mod）
- 滿版：Bubble Tea 全螢幕 model + timer.Cmd
- 唯讀輪詢 JSON：`os.ReadFile` + tick message
- 依賴：Charm 生態（lipgloss 等常搭配）
- 維護風險：Charm 活躍；Go 版本門檻較新

### 5. WTF

- 網址：https://github.com/wtfutil/wtf
- 授權：[MPL-2.0](https://github.com/wtfutil/wtf/blob/master/LICENSE.md)
- 語言：Go
- 星數：17,141（2026-11-04 UTC 官方 repository API）
- 最近正式發版：[v0.51.0，2026-09-29T16:31:41Z](https://github.com/wtfutil/wtf/releases/tag/v0.51.0)
- macOS：使用官方發行 binary 或依 go.mod 安裝 Go toolchain 後局部編譯，不需全域安裝。
- 滿版：內建終端 dashboard layout。
- 唯讀輪詢 JSON：需要自訂 module 以 os.ReadFile 及更新週期投影四欄；不能直接把 herdr state 當設定檔。
- 依賴：既有多 widget／tview 應用，整合成本比單用途框架高。
- 維護風險：2026 年仍有正式 release，但通用模組與外部服務多；須禁用非必要模組並另驗唯讀。

## 推薦

推薦 **Ink 8.0.0**，第二名 **Textual**。Ink 沿用現有 Node 與 JS 測試；滿版用 alternate screen，唯讀由應用與獨立子程序攔截證明，框架本身不保證。代價是 React/Yoga 依賴、自行處理終端欄寬、捲動與 resize。Textual 的滿版元件與捲動較完整，但新增 Python runtime、venv 及第二套應用測試。Ratatui／Bubble Tea 需另設編譯流程；WTF 的多模組應用偏離最小單一 state 看板。

## 可重查來源與限制

本輪於 2026-11-04 UTC 直接查詢 GitHub 官方 REST `repos/{owner}/{repo}` 與 `releases/latest`；精確值、查詢時間、license SPDX 與 release URL 留在 [原始擷取摘要](docs/survey-api.json)。release 日期使用 published_at，非 commit 日期；星數為當時快照。

- [vadimdemedes/ink repository API](https://api.github.com/repos/vadimdemedes/ink)；[最新正式發版 API](https://api.github.com/repos/vadimdemedes/ink/releases/latest)；[正式發版](https://github.com/vadimdemedes/ink/releases/tag/v8.0.0)：v8.0.0，2026-10-03T11:25:42Z，40,218 星，查詢 2026-11-04T08:06:26.959755+00:00。
- [Textualize/textual repository API](https://api.github.com/repos/Textualize/textual)；[最新正式發版 API](https://api.github.com/repos/Textualize/textual/releases/latest)；[正式發版](https://github.com/Textualize/textual/releases/tag/v8.2.8)：v8.2.8，2026-06-30T06:53:30Z，37,573 星，查詢 2026-11-04T08:06:27.641552+00:00。
- [ratatui/ratatui repository API](https://api.github.com/repos/ratatui/ratatui)；[最新正式發版 API](https://api.github.com/repos/ratatui/ratatui/releases/latest)；[正式發版](https://github.com/ratatui/ratatui/releases/tag/ratatui-v0.30.2)：ratatui-v0.30.2，2026-06-19T08:56:52Z，23,158 星，查詢 2026-11-04T08:06:28.415132+00:00。
- [charmbracelet/bubbletea repository API](https://api.github.com/repos/charmbracelet/bubbletea)；[最新正式發版 API](https://api.github.com/repos/charmbracelet/bubbletea/releases/latest)；[正式發版](https://github.com/charmbracelet/bubbletea/releases/tag/v2.1.1)：v2.1.1，2026-10-28T10:19:27Z，45,601 星，查詢 2026-11-04T08:06:29.123689+00:00。
- [wtfutil/wtf repository API](https://api.github.com/repos/wtfutil/wtf)；[最新正式發版 API](https://api.github.com/repos/wtfutil/wtf/releases/latest)；[正式發版](https://github.com/wtfutil/wtf/releases/tag/v0.51.0)：v0.51.0，2026-09-29T16:31:41Z，17,141 星，查詢 2026-11-04T08:06:29.893790+00:00。
