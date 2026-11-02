// Local kanban for the Herdr ops flow. It reads ~/herdr-ops/board/state.json.
// Actions create request files; the state file remains read-only.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { agents, spaces, focused, run, exec, theme, home, appHome, props, readTextFile, writeTextFile, openOverlay, shared, closeOverlay, terminals, hc } from "herdr";
import { openFile } from "./open.js";
import {
  boardColumns, cardAction, commandFor, currentPlace, defaultPane,
  emptyMessage, filterTasks, hcArgv, hcDelivery, makeRequest, mergeAction, modelsOf, openablePath,
  PANE_NAME, paneChoices, parseConfig, parseState, pendingTasks, resultPath, shortDate, taskAgent, taskLine,
} from "./state.js";

const REQUEST_KEY = "herdr-board.request";
const POLL_MS = 5000;
const CARD_GAP = 8;
const COLUMN_WIDTH = 280;
const TITLE_HEIGHT = 42;
const SPINNER = "mods/herdr-board/spinner.svg";
const AGENT_LABELS = { working: "Working", blocked: "Needs you", done: "Done", idle: "Idle" };

const emptyState = () => ({ version: 1, updated_at: "", tasks: [] });

function failText(result) {
  const raw = String(result?.stderr || result?.stdout || "hc 失敗").trim();
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) return String(parsed.error.message);
  } catch { /* hc spoke plain text */ }
  return raw.replace(/[\u0000-\u001f\u007f-\u009f\s]+/g, " ").trim() || "hc 失敗";
}

function withJson(argv) {
  const copy = argv.slice();
  copy.splice(1, 0, "--json");
  return copy;
}

class HerdrBoard extends View {
  init(_props, cx) {
    this.overlay = props()?.overlay ?? null;
    if (this.overlay && globalThis.__herdrBoardOpen) {
      this.toggledOff = true;
      closeOverlay(globalThis.__herdrBoardOpen);
      closeOverlay(this.overlay);
      globalThis.__herdrBoardOpen = null;
      return;
    }
    globalThis.__herdrBoardOpen = this.overlay;
    this.homeDir = home();
    this.statePath = `${this.homeDir}/herdr-ops/board/state.json`;
    this.roles = {};
    this.snapshot = emptyState();
    this.missing = false;
    this.loaded = false;
    this.reading = false;
    this.reloadQueued = false;
    this.acting = false;
    this.text = "";
    this.model = null;
    this.error = null;
    this.pending = new Set();
    this.seenRequest = shared(REQUEST_KEY)?.n ?? null;
    this.search = InputState.new({ placeholder: "編號或標題" });
    this.search.on("change", (_event, cx) => { this.text = this.search.value(); cx.notify(); });
    cx.timer.every(POLL_MS, (cx) => this.reload(false, cx));
    cx.timer.every(400, (cx) => this.consume(cx));
    cx.timer.every(1000, (cx) => { if (this.drawing) cx.notify(); });
    this.reload(true, cx);
  }

  close() {
    if (!this.toggledOff) globalThis.__herdrBoardOpen = null;
  }

  async fileMtime() {
    let result = await exec("stat", ["-f", "%m", this.statePath]);
    if (result.code !== 0) result = await exec("stat", ["-c", "%Y", this.statePath]);
    return result.code === 0 ? result.stdout.trim() : null;
  }

  async loadConfig() {
    const text = await readTextFile(`${appHome()}/herdr-board.json`);
    const config = parseConfig(text, this.homeDir);
    this.statePath = config.state;
    this.roles = config.roles;
  }

  reload(force, cx) {
    if (!cx) return;
    if (this.reading) { this.reloadQueued = this.reloadQueued || force; return; }
    this.reading = true;
    cx.spawn(async (cx) => {
      try {
        await this.loadConfig();
        await this.loadRequests();
        const mtime = await this.fileMtime();
        if (mtime == null) {
          this.missing = true;
          this.snapshot = emptyState();
          this.error = null;
          return;
        }
        const text = await readTextFile(this.statePath);
        if (text == null) { this.error = "讀不到狀態檔"; return; }
        const parsed = parseState(text);
        if (!parsed.ok) { this.error = parsed.error; this.missing = false; return; }
        this.snapshot = parsed.state;
        this.missing = false;
        this.error = null;
      } catch (error) {
        this.error = String(error.message ?? error);
      } finally {
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

  async loadRequests() {
    const dir = `${this.homeDir}/herdr-ops/board/requests`;
    const listing = await exec("find", [dir, "-maxdepth", "1", "-type", "f", "-name", "*.json", "-print"]);
    if (listing.code !== 0) {
      const exists = await exec("test", ["-d", dir]);
      if (exists.code === 0) throw new Error("讀不到請求目錄");
      this.pending = new Set();
      return;
    }
    const texts = [];
    for (const path of listing.stdout.split("\n")) {
      if (path) {
        const text = await readTextFile(path);
        if (text != null) texts.push(text);
      }
    }
    this.pending = pendingTasks(texts);
  }

  async writeRequest(request) {
    const dir = `${this.homeDir}/herdr-ops/board/requests`;
    const made = await exec("mkdir", ["-p", dir]);
    if (made.code !== 0) throw new Error(failText(made));
    const temp = await exec("mktemp", [`${dir}/.request.XXXXXXXXXXXX`]);
    if (temp.code !== 0) throw new Error(failText(temp));
    const tmp = temp.stdout.trim();
    const suffix = tmp.slice(tmp.lastIndexOf(".") + 1);
    const id = request.task.replace(/[^a-zA-Z0-9_-]/g, "_") || "task";
    const stamp = request.created_at.replace(/[:.]/g, "-");
    const target = `${dir}/${stamp}-${id}-${suffix}.json`;
    await writeTextFile(tmp, `${JSON.stringify(request, null, 2)}\n`, "");
    const moved = await exec("mv", ["-n", tmp, target]);
    if (moved.code !== 0 || (await exec("test", ["-e", tmp])).code === 0) throw new Error("無法建立唯一請求檔");
    this.pending.add(request.task);
  }

  paneExists(name) {
    for (const term of terminals() ?? []) if (term?.name === name) return true;
    return false;
  }

  consume(cx) {
    const request = shared(REQUEST_KEY);
    if (!request || request.n === this.seenRequest || this.acting) return;
    this.seenRequest = request.n;
    if (request.kind === "dispatch") this.runDispatch(request, cx);
  }

  taskById(id) {
    for (const task of this.snapshot?.tasks ?? []) if (task.id === id) return task;
    return null;
  }

  runDispatch(request, cx) {
    const task = this.taskById(request.taskId);
    if (!task) { this.error = `找不到任務 ${request.taskId}`; cx.notify(); return; }
    if (!PANE_NAME.test(request.pane || "")) { this.error = "這個分頁名稱不能派工"; cx.notify(); return; }
    const place = currentPlace(focused(), spaces());
    const exists = this.paneExists(request.pane);
    if (!exists && (!place.space || !place.tab)) {
      this.error = "沒有目前的 space／tab，無法開新的分頁";
      cx.notify();
      return;
    }
    const argv = hcArgv({
      exists,
      pane: request.pane,
      command: commandFor(request.pane, this.roles),
      task: taskLine(task, request.instructions),
      space: place.space,
      tab: place.tab,
      cwd: exists ? "" : (openablePath(task.repo, this.homeDir) || ""),
    });
    if (!argv) { this.error = "這個分頁名稱不能派工"; cx.notify(); return; }
    this.acting = true;
    cx.spawn(async (cx) => {
      try {
        await this.writeRequest(makeRequest("dispatch", task, request.pane, request.instructions));
        const delivery = hcDelivery(await hc(withJson(argv)));
        if (!delivery.ok) throw new Error(`請求已建立，送出失敗：${delivery.error}`);
        this.error = null;
      } catch (error) {
        this.error = String(error.message ?? error);
      } finally {
        this.acting = false;
        cx.notify();
      }
    });
    cx.notify();
  }

  askPol(task, cx) {
    if (this.acting) return;
    const plan = mergeAction(task, { leadExists: this.paneExists("lead") });
    this.acting = true;
    cx.spawn(async (cx) => {
      try {
        await this.writeRequest(makeRequest("gate", task, "lead"));
        if (plan.hc) {
          const delivery = hcDelivery(await hc(withJson(plan.hc)));
          if (!delivery.ok) throw new Error(`請求已建立，送到 lead 失敗：${delivery.error}`);
        }
        this.error = null;
      } catch (error) {
        this.error = String(error.message ?? error);
      } finally {
        this.acting = false;
        cx.notify();
      }
    });
    cx.notify();
  }

  openDispatch(task) {
    openOverlay({
      mod: "herdr-board-agent",
      kind: "dialog",
      width: 480,
      height: 420,
      props: {
        taskId: task.id,
        title: task.title,
        panes: paneChoices(this.roles),
        defaultPane: defaultPane(task.column),
        board: this.overlay,
      },
    });
  }

  goToAgent(agent) {
    if (agent.space) run("space.select", { id: agent.space });
    if (agent.tab) run("tab.select", { id: agent.tab });
    if (agent.pane) run("pane.focus", { pane: agent.pane });
    closeOverlay(this.overlay);
  }

  openResult(task) {
    const path = openablePath(resultPath(task), this.homeDir);
    if (path) openFile(path, this.homeDir);
  }

  card(task, agent, t, hover) {
    const status = agent ? t[agent.status] : null;
    const border = task.needs_pol ? t.accent : (status ?? t.border);
    const pills = [];
    const addPill = (id, label, color = t.muted) => {
      pills.push(h_flex().id(id).h(22).flex_none().items_center().rounded_full().border_1().border_color(t.border).px(8)
        .text_size(11).text_color(color).child(label));
    };
    if (task.model) addPill(`model-${task.id}`, task.model);
    if (task.pane) addPill(`pane-${task.id}`, task.pane);
    for (const key of Object.keys(task.reject_counts ?? {})) {
      if (task.reject_counts[key] > 0) addPill(`reject-${task.id}-${key}`, `退回 ${key}×${task.reject_counts[key]}`);
    }
    if (task.spec_rewrites > 0) addPill(`rewrites-${task.id}`, `規格重寫 ${task.spec_rewrites}`);
    if (this.pending.has(task.id)) addPill(`pending-${task.id}`, "待處理請求");
    if (task.example) addPill(`example-${task.id}`, "範例");
    if (task.needs_pol) addPill(`pol-${task.id}`, "等 Pol哥", t.accent);
    if (agent) {
      pills.push(h_flex().id(`status-${task.id}`).h(22).flex_none().items_center().rounded_full().border_1().border_color(status).px(8).gap(5)
        .cursor_pointer().text_size(11).text_color(status)
        .on_mouse_down("left", (_event, cx) => cx.stop_propagation())
        .on_click((_event, cx) => { cx.stop_propagation(); this.goToAgent(agent); })
        .children(agent.status === "working" ? [svg(SPINNER).size(11).flex_none().text_color(status).spin(900)] : [div().size(7).flex_none().rounded_full().bg(status)])
        .child(AGENT_LABELS[agent.status] ?? agent.status));
    }

    let action = null;
    const actionKind = cardAction(task.column);
    if (actionKind === "pol") {
      action = h_flex().id(`pol-ask-${task.id}`).h(22).px(8).flex_none().items_center().rounded(6).cursor_pointer()
        .text_size(11).text_color(t.muted).bg(t.raised).border_1().border_color(t.border)
        .hover((style) => style.bg(t.background).text_color(t.foreground))
        .on_mouse_down("left", (_event, cx) => cx.stop_propagation())
        .on_click((_event, cx) => { cx.stop_propagation(); this.askPol(task, cx); })
        .child("送 herdr cto 把關");
    } else if (actionKind === "dispatch") {
      action = h_flex().id(`dispatch-${task.id}`).h(22).px(8).flex_none().items_center().rounded(6).cursor_pointer()
        .text_size(11).text_color(t.muted).bg(t.raised).border_1().border_color(t.border)
        .hover((style) => style.bg(t.background).text_color(t.foreground))
        .on_mouse_down("left", (_event, cx) => cx.stop_propagation())
        .on_click((_event, cx) => { cx.stop_propagation(); this.openDispatch(task); })
        .child("派工");
    }

    const when = task.updated_at ? `更新 ${shortDate(task.updated_at)}` : "";
    return v_flex().id(`card-${task.id}`).relative().flex_none().w_full().px(12).py(10).gap(6).rounded(8).overflow_hidden().cursor_pointer()
      .bg(t.raised).border_1().border_color(border).hover(hover)
      .on_click(() => this.openResult(task))
      .child(div().flex_none().text_size(11.5).text_color(t.dim).child(task.id))
      .child(div().flex_none().min_h(TITLE_HEIGHT).w_full().text_size(13).child(task.title))
      .child(h_flex().flex_none().gap(5).items_center().flex_wrap().children(pills))
      .child(h_flex().flex_none().h(22).items_center().justify_between()
        .child(div().text_size(11.5).text_color(t.dim).child(when))
        .children(action ? [action] : []));
  }

  render() {
    if (this.toggledOff) return div();
    this.drawing = true;
    const t = theme();
    const hover = (style) => style.bg(t.hover);
    const tasks = this.snapshot?.tasks ?? [];
    const filtered = filterTasks(tasks, this.text, this.model);
    const placed = boardColumns(filtered);
    const warnings = boardColumns(tasks).warnings;
    const models = modelsOf(tasks);
    const agentList = agents();
    const terminalList = terminals();
    const waiting = !this.loaded;

    const chips = [];
    chips.push(h_flex().id("model-all").h(26).px(9).gap(6).flex_none().items_center().rounded(7).cursor_pointer().text_size(11.5)
      .bg(this.model == null ? t.selected : t.raised).text_color(this.model == null ? t.foreground : t.muted).hover(hover)
      .on_click((_event, cx) => { this.model = null; cx.notify(); })
      .child("全部")
      .child(div().text_color(t.dim).child(String(tasks.length))));
    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const active = this.model === model.name;
      const label = model.name || "未標模型";
      chips.push(h_flex().id(`model-chip-${i}`).h(26).px(9).gap(6).flex_none().max_w(320).items_center().rounded(7).cursor_pointer().text_size(11.5)
        .bg(active ? t.selected : t.raised).text_color(active ? t.foreground : t.muted).hover(hover)
        .on_click((_event, cx) => { this.model = model.name; cx.notify(); })
        .child(div().min_w(0).truncate().child(label))
        .child(div().flex_none().text_color(t.dim).child(String(model.count))));
    }

    const lanes = [];
    for (const column of placed.columns) {
      const cards = [];
      for (const task of column.tasks) cards.push(this.card(task, taskAgent(task, agentList, terminalList), t, hover));
      lanes.push(div().h_full().w(COLUMN_WIDTH).flex_none().child(v_flex().size_full().min_h(0).gap(4)
        .child(h_flex().h(34).flex_none().px(4).gap(8).items_center()
          .child(div().text_size(13).font_medium().child(column.name))
          .child(div().text_size(12).text_color(t.dim).child(String(column.tasks.length))))
        .child(v_flex().id(`column-${column.id}`).flex_1().min_h(0).gap(CARD_GAP).pb(CARD_GAP).overflow_y_scrollbar().children(cards))));
    }

    const tree = v_flex().id("herdr-board").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border)
      .text_color(t.foreground).text_size(13)
      .child(h_flex().h(46).flex_none().px(14).gap(10).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("Herdr 新任務流程"))
        .children(waiting ? [] : [div().text_size(11).text_color(t.dim).child(`${tasks.length} 個任務`)])
        .child(div().flex_1())
        .child(div().w(220).flex_none().h(26).px(8).flex().items_center().rounded(7).border_1()
          .border_color(this.text.trim() ? t.accent : t.border).bg(t.background)
          .child(Input.new(this.search).h_full().text_size(11).text_color(t.foreground)))
        .child(div().id("refresh").px(8).h(26).flex().items_center().rounded(7).cursor_pointer().text_size(11).text_color(t.muted)
          .hover(hover).on_click((_event, cx) => this.reload(true, cx))
          .child(this.reading ? svg(SPINNER).size(13).flex_none().text_color(t.muted).spin(900) : "Refresh")))
      .child(h_flex().flex_none().flex_wrap().px(14).py(8).gap(6).items_center().border_b(1).border_color(t.border).children(chips))
      .children(this.error ? [div().flex_none().px(14).py(6).text_size(11).text_color(t.ansi1).child(this.error)] : [])
      .children(warnings.length ? [div().flex_none().px(14).py(4).text_size(11).text_color(t.dim).child(warnings.join(" · "))] : [])
      .children(!waiting && this.missing ? [div().flex_none().px(14).py(6).text_size(11).text_color(t.dim).child(emptyMessage(this.statePath, this.homeDir))] : [])
      .children(!waiting ? [h_flex().id("board").flex_1().min_h(0).px(12).pt(6).gap(12).items_start().overflow_x_scrollbar().children(lanes)] : [])
      .children(waiting ? [h_flex().flex_1().min_h(0).gap(10).items_center().justify_center().text_color(t.dim)
        .child(svg(SPINNER).size(18).flex_none().text_color(t.muted).spin(900)).child("讀取任務…")] : []);
    this.drawing = false;
    return tree;
  }
}

const source = [HerdrBoard, parseState, taskLine, mergeAction, hcArgv, boardColumns, makeRequest, pendingTasks, hcDelivery, cardAction].map(String).join();
if (globalThis.__herdrBoard?.source !== source) globalThis.__herdrBoard = { source, view: HerdrBoard };
export default globalThis.__herdrBoard.view;
