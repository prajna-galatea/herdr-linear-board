// Read-only kanban for the Herdr ops flow. Loads state.json only; no requests or writes.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { theme, home, appHome, props, readTextFile } from "herdr";
import { openFile } from "./open.js";
import {
  columnWidthPx, emptyMessage, expandHome, layoutForWidth, modelsOf,
  parseConfig, parseState, projectBoard, projectTaskDetail, taskById,
} from "./state.js";

const POLL_MS = 5000;
const CARD_GAP = 8;
const BOARD_PADDING = 24;
const LANE_GAP = 12;
const SPINNER = "mods/herdr-board/spinner.svg";

const emptyState = () => ({ version: 1, updated_at: "", tasks: [] });

class HerdrBoard extends View {
  init(_props, cx) {
    this.closed = false;
    this.homeDir = home();
    this.statePath = `${this.homeDir}/herdr-ops/board/state.json`;
    this.snapshot = emptyState();
    this.hasSnapshot = false;
    this.missing = false;
    this.loaded = false;
    this.reading = false;
    this.reloadQueued = false;
    this.text = "";
    this.model = null;
    this.archive = "active";
    this.error = null;
    this.stale = false;
    this.rootWidth = 960;
    this.screen = { kind: "board" };
    this.search = InputState.new({ placeholder: "編號或標題" });
    this.search.on("change", (_event, cx) => { this.text = this.search.value(); cx.notify(); });
    const supplied = props() ?? {};
    this.explicitState = Object.hasOwn(supplied, "state");
    this.explicitPath = supplied.state;
    this.poll = cx.timer.every(POLL_MS, (cx) => this.reload(false, cx));
    this.reload(true, cx);
  }

  close() { this.closed = true; this.poll?.cancel(); this.job?.cancel(); }

  async loadConfig() {
    if (this.explicitState) {
      if (typeof this.explicitPath !== "string") throw new Error("狀態路徑無效");
      this.statePath = parseConfig(JSON.stringify({ state: this.explicitPath }), this.homeDir).state;
      return;
    }
    const text = await readTextFile(`${appHome()}/herdr-board.json`);
    const config = parseConfig(text, this.homeDir);
    this.statePath = config.state;
  }

  reload(force, cx) {
    if (!cx || this.closed) return;
    if (this.reading) { this.reloadQueued = true; return; }
    this.reading = true;
    this.job = cx.spawn(async (cx) => {
      if (this.closed) return;
      const previousPath = this.lastLoadedPath;
      try {
        await this.loadConfig();
        if (this.closed) return;
        if (previousPath && previousPath !== this.statePath) {
          this.snapshot = emptyState();
          this.hasSnapshot = false;
          this.missing = false;
          this.error = null;
          this.loaded = false;
        }
        this.lastLoadedPath = this.statePath;
        const text = await readTextFile(this.statePath);
        if (this.closed) return;
        if (text == null) {
          this.missing = true;
          this.stale = this.hasSnapshot;
          this.error = this.stale ? "來源消失，保留上次快照（未更新）" : null;
          return;
        }
        const parsed = parseState(text);
        if (!parsed.ok) {
          this.error = parsed.error;
          this.missing = false;
          this.stale = true;
          return;
        }
        this.snapshot = parsed.state;
        this.hasSnapshot = true;
        this.missing = false;
        this.error = null;
        this.stale = false;
      } catch (error) {
        if (this.closed) return;
        this.error = String(error.message ?? error);
        this.stale = true;
      } finally {
        if (this.closed) return;
        this.reading = false;
        this.loaded = true;
        cx.notify();
        if (this.reloadQueued) {
          const again = this.reloadQueued;
          this.reloadQueued = false;
          this.reload(again, cx);
        }
      }
    });
    cx.notify();
  }

  boardModel() {
    return projectBoard(this.snapshot, { text: this.text, model: this.model, archive: this.archive });
  }

  showDetail(taskId, cx) {
    this.screen = { kind: "detail", taskId };
    if (cx) cx.notify();
  }

  showBoard(cx) {
    this.screen = { kind: "board" };
    if (cx) cx.notify();
  }

  openResultPath(path) {
    const local = expandHome(path, this.homeDir);
    openFile(local, this.homeDir);
  }

  card(card, t, hover, cx) {
    const rejectLine = `退回 ${card.rejectTotal}`;
    return v_flex().id(`card-${card.id}`).relative().flex_none().w_full().px(12).py(10).gap(6).rounded(8).overflow_hidden().cursor_pointer()
      .bg(t.raised).border_1().border_color(t.border).hover(hover)
      .on_click((_event, eventCx) => { eventCx.stop_propagation(); this.showDetail(card.id, eventCx); })
      .child(div().flex_none().text_size(11.5).text_color(t.dim).child(card.id))
      .child(div().flex_none().w_full().text_size(13).line_height("18px").max_h(54).overflow_hidden().child(card.title))
      .child(div().flex_none().text_size(11.5).text_color(t.muted).child(`${card.roleLabel} · ${card.modelLabel}`))
      .child(h_flex().flex_none().justify_between().text_size(11).text_color(t.dim)
        .child(div().child(card.durationLabel))
        .child(div().child(rejectLine)));
  }

  detailView(task, t, hover, cx) {
    const vm = projectTaskDetail(task, Date.now(), this.homeDir);
    const rows = [];
    rows.push(div().text_size(11).text_color(t.dim).child(`原始狀態 ${vm.rawColumn} · ${vm.roleLabel} · ${vm.model}`));
    rows.push(div().text_size(11).text_color(t.dim).child(`在此狀態 ${vm.durationLabel} · 來源 ${vm.stateEnteredAt || "未知"}`));
    if (vm.rejectLines.length) {
      for (const line of vm.rejectLines) rows.push(div().text_size(11).child(`退回 ${line.model}×${line.count}`));
    }
    if (vm.specRewrites > 0) rows.push(div().text_size(11).child(`規格重寫 ${vm.specRewrites}`));
    rows.push(div().text_size(11).text_color(t.dim).child(vm.rejectHistoryNote));
    if (vm.needsPol) rows.push(div().text_size(11).text_color(t.accent).child("等 Pol哥（詳情）"));
    if (vm.history.length) {
      rows.push(div().mt(4).text_size(12).font_medium().child("狀態歷史"));
      for (let i = 0; i < vm.history.length; i++) {
        const entry = vm.history[i];
        const label = entry && typeof entry === "object" ? JSON.stringify(entry) : String(entry);
        rows.push(div().text_size(11).text_color(t.dim).child(label));
      }
    }
    const links = [];
    for (const link of vm.resultLinks) {
      links.push(h_flex().h(26).px(8).items_center().rounded(6).cursor_pointer().text_size(11).bg(t.raised).border_1().border_color(t.border).hover(hover)
        .on_click((_event, eventCx) => { eventCx.stop_propagation(); this.openResultPath(link.path); })
        .child(`${link.kind} 結果`));
    }
    if (vm.herdrFolder) {
      links.push(h_flex().h(26).px(8).items_center().rounded(6).cursor_pointer().text_size(11).bg(t.raised).border_1().border_color(t.border).hover(hover)
        .on_click((_event, eventCx) => { eventCx.stop_propagation(); openFile(vm.herdrFolder, this.homeDir); })
        .child(".herdr 資料夾"));
    }
    return v_flex().id("herdr-board-detail").size_full().min_h(0).gap(8).px(14).py(10).overflow_y_scrollbar()
      .child(h_flex().flex_none().gap(8).items_center()
        .child(h_flex().px(8).h(26).items_center().rounded(6).cursor_pointer().text_size(11).hover(hover).on_click((_event, eventCx) => this.showBoard(eventCx)).child("← 返回"))
        .child(div().font_semibold().child(vm.id)))
      .child(div().text_size(14).child(vm.title))
      .children(rows)
      .children(links.length ? [div().mt(4).text_size(12).font_medium().child("結果入口"), v_flex().gap(6).children(links)] : []);
  }

  archiveChip(label, value, t, hover, cx) {
    const active = this.archive === value;
    return h_flex().id(`archive-${value}`).h(26).px(9).flex_none().items_center().rounded(7).cursor_pointer().text_size(11.5)
      .bg(active ? t.selected : t.raised).text_color(active ? t.foreground : t.muted).hover(hover)
      .on_click((_event, eventCx) => { this.archive = value; eventCx.notify(); })
      .child(label);
  }

  render() {
    const t = theme();
    const hover = (style) => style.bg(t.hover);
    const waiting = !this.loaded;
    const tasks = this.snapshot?.tasks ?? [];
    const placed = this.boardModel();
    const models = modelsOf(tasks, this.archive);
    const layout = layoutForWidth(this.rootWidth);
    const colWidth = columnWidthPx(this.rootWidth, layout.columnsPerRow, LANE_GAP, BOARD_PADDING);
    const sourceWarning = this.error ? [div().flex_none().px(14).py(6).text_size(11).text_color(t.ansi1).child(`未更新：${this.error}`)] : [];

    if (this.screen.kind === "detail") {
      const task = taskById(this.snapshot, this.screen.taskId);
      if (!task) {
        this.screen = { kind: "board" };
      } else {
        return v_flex().id("herdr-board").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border)
          .on_size_change((size, cx) => { this.rootWidth = size.width; cx.notify(); })
          .children(sourceWarning)
          .child(this.detailView(task, t, hover));
      }
    }

    const chips = [];
    chips.push(h_flex().id("model-all").h(26).px(9).gap(6).flex_none().items_center().rounded(7).cursor_pointer().text_size(11.5)
      .bg(this.model == null ? t.selected : t.raised).text_color(this.model == null ? t.foreground : t.muted).hover(hover)
      .on_click((_event, cx) => { this.model = null; cx.notify(); })
      .child("全部")
      .child(div().text_color(t.dim).child(String(placed.visibleCount))));
    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const active = this.model === model.name;
      const label = model.name || "未標模型";
      chips.push(h_flex().id(`model-chip-${i}`).h(26).px(9).gap(6).flex_none().max_w(Math.max(0, this.rootWidth - 32)).items_center().rounded(7).cursor_pointer().text_size(11.5)
        .bg(active ? t.selected : t.raised).text_color(active ? t.foreground : t.muted).hover(hover)
        .on_click((_event, cx) => { this.model = model.name; cx.notify(); })
        .child(div().min_w(0).truncate().child(label))
        .child(div().flex_none().text_color(t.dim).child(String(model.count))));
    }

    const laneRows = [];
    for (let row = 0; row < placed.lanes.length; row += layout.columnsPerRow) {
      const rowLanes = placed.lanes.slice(row, row + layout.columnsPerRow);
      const cells = [];
      for (const lane of rowLanes) {
        const cards = lane.cards.map((card) => this.card(card, t, hover));
        cells.push(div().w(colWidth).flex_none().min_h(0).child(v_flex().w_full().min_h(0).gap(4)
          .child(h_flex().h(34).flex_none().px(4).gap(8).items_center()
            .child(div().text_size(13).font_medium().child(lane.name))
            .child(div().text_size(12).text_color(t.dim).child(String(lane.cards.length))))
          .child(v_flex().id(`lane-${lane.id}`).flex_none().min_h(0).gap(CARD_GAP).pb(CARD_GAP).children(cards))));
      }
      laneRows.push(h_flex().flex_none().w_full().gap(LANE_GAP).items_start().children(cells));
    }

    return v_flex().id("herdr-board").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border)
      .text_color(t.foreground).text_size(13)
      .on_size_change((size, cx) => { this.rootWidth = size.width; cx.notify(); })
      .child(h_flex().flex_none().py(10).px(14).gap(10).items_center().border_b(1).border_color(t.border).flex_wrap()
        .child(div().font_semibold().child("Herdr 新任務流程"))
        .children(waiting ? [] : [div().text_size(11).text_color(t.dim).child(`${placed.visibleCount} 個任務`)])
        .child(div().flex_1().min_w(0))
        .child(div().w(Math.min(220, Math.max(0, this.rootWidth - 32))).flex_none().h(26).px(8).flex().items_center().rounded(7).border_1()
          .border_color(this.text.trim() ? t.accent : t.border).bg(t.background)
          .child(Input.new(this.search).h_full().text_size(11).text_color(t.foreground)))
        .child(this.archiveChip("未歸檔", "active", t, hover))
        .child(this.archiveChip("已歸檔", "archived", t, hover))
        .child(this.archiveChip("全部", "all", t, hover))
        .child(div().id("refresh").px(8).h(26).flex().items_center().rounded(7).cursor_pointer().text_size(11).text_color(t.muted)
          .hover(hover).on_click((_event, cx) => this.reload(true, cx))
          .child(this.reading ? svg(SPINNER).size(13).flex_none().text_color(t.muted).spin(900) : "Refresh")))
      .child(h_flex().flex_none().flex_wrap().px(14).py(8).gap(6).items_center().border_b(1).border_color(t.border).children(chips))
      .children(sourceWarning)
      .children(placed.warnings.length ? [div().flex_none().px(14).py(4).text_size(11).text_color(t.dim).child(placed.warnings.join(" · "))] : [])
      .children(!waiting && this.missing ? [div().flex_none().px(14).py(6).text_size(11).text_color(t.dim).child(emptyMessage(this.statePath, this.homeDir))] : [])
      .children(!waiting ? [v_flex().id("board").flex_1().min_h(0).px(12).pt(6).gap(LANE_GAP).overflow_y_scrollbar().children(laneRows)] : [])
      .children(waiting ? [h_flex().flex_1().min_h(0).gap(10).items_center().justify_center().text_color(t.dim)
        .child(svg(SPINNER).size(18).flex_none().text_color(t.muted).spin(900)).child("讀取任務…")] : []);
  }
}

export default HerdrBoard;
