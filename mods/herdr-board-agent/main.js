// Dispatch dialog. Props: { taskId, title, panes, defaultPane, board }.
// It only records the choice. The board talks to hc and creates request files.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextareaState, Textarea } from "gpui-base";
import { props, closeOverlay, theme, shared, setShared } from "herdr";

const REQUEST_KEY = "herdr-board.request";

class HerdrDispatch extends View {
  init(_props, cx) {
    const given = props() ?? {};
    this.taskId = given.taskId ?? "";
    this.title = given.title || "從看板上的卡片派工";
    this.panes = given.panes?.length ? given.panes : ["spec", "build-grok", "review"];
    this.pane = given.defaultPane || this.panes[0];
    this.error = "";
    this.instructions = TextareaState.new({ placeholder: "給這個角色的補充（可空白）" });
    this.instructions.set_auto_grow(3, 8);
    cx.notify();
  }

  choose(pane, cx) {
    this.pane = pane;
    cx.notify();
  }

  send(cx) {
    if (!this.taskId || !this.pane) { this.error = "沒有任務可以派"; cx.notify(); return; }
    const previous = shared(REQUEST_KEY)?.n ?? 0;
    setShared(REQUEST_KEY, {
      n: Math.max(Date.now(), previous + 1),
      kind: "dispatch",
      taskId: this.taskId,
      pane: this.pane,
      instructions: this.instructions.value(),
    });
    closeOverlay(props().overlay);
  }

  render() {
    const t = theme();
    const chips = [];
    for (let i = 0; i < this.panes.length; i++) {
      const pane = this.panes[i];
      const selected = pane === this.pane;
      chips.push(h_flex().id(`pane-${pane}`).h(26).px(9).items_center().rounded(7).cursor_pointer().flex_none().text_size(12)
        .bg(selected ? t.selected : t.raised).text_color(selected ? t.foreground : t.muted)
        .hover((style) => style.bg(t.hover))
        .on_click((_event, cx) => this.choose(pane, cx))
        .child(pane));
    }
    const ready = Boolean(this.taskId && this.pane);
    return v_flex().id("herdr-board-agent").size_full().p(16).gap(14).bg(t.popover).text_color(t.foreground).text_size(12.5)
      .child(v_flex().flex_none().gap(2)
        .child(div().text_size(14).font_semibold().child(`派工 ${this.taskId || ""}`.trim()))
        .child(div().text_color(t.dim).child(this.title)))
      .child(v_flex().flex_1().min_h(0).gap(14).overflow_y_scrollbar()
        .child(v_flex().gap(6)
          .child(div().text_size(11).text_color(t.dim).child("角色分頁"))
          .child(h_flex().flex_wrap().gap(6).children(chips)))
        .child(v_flex().gap(6)
          .child(div().text_size(11).text_color(t.dim).child("補充說明"))
          .child(div().px(10).py(6).rounded(8).border_1().border_color(t.border).bg(t.background)
            .child(Textarea.new(this.instructions).w_full().text_size(12).text_color(t.foreground)))))
      .child(h_flex().flex_none().gap(8).items_center()
        .child(div().flex_1().min_w(0).text_size(11).text_color(t.ansi1).child(this.error))
        .child(h_flex().id("cancel").h(30).px(12).items_center().rounded(8).cursor_pointer().text_color(t.muted)
          .hover((style) => style.bg(t.hover)).on_click(() => closeOverlay(props().overlay)).child("取消"))
        .child(h_flex().id("send").h(30).px(14).items_center().rounded(8).cursor_pointer()
          .bg(ready ? t.solid : t.raised).text_color(ready ? t.solid_foreground : t.dim)
          .on_click((_event, cx) => this.send(cx)).child("派工")));
  }
}

const source = [HerdrDispatch].map(String).join();
if (globalThis.__herdrBoardAgent?.source !== source) globalThis.__herdrBoardAgent = { source, view: HerdrDispatch };
export default globalThis.__herdrBoardAgent.view;
