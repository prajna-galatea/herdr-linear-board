// Capture harness only: candidate files are copied verbatim. No event overrides.
import Board from "./candidate/main.js";
import { div } from "gpui-kit";
export default class Capture extends Board {
  init(p, cx) { super.init(p, cx); this.archive = "all"; }
  render() {
    console.log("T_BOARD_ROOT " + this.rootWidth);
    return super.render().child(div().flex_none().child("TEST ROOT logical px: " + this.rootWidth));
  }
}
