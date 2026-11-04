import Board from "./candidate/main.js";
import { div } from "gpui-kit";
import { closeOverlay } from "herdr";
export default class Capture extends Board {
 init(p,cx) { super.init(p,cx); this.archive="all"; closeOverlay("frame-welcome"); }
 render() { return super.render().child(div().flex_none().child("TEST ROOT logical px: "+this.rootWidth)).on_size_change((size,cx)=>{console.log("T_BOARD_ROOT "+JSON.stringify(size));this.rootWidth=size.width;cx.notify();}); }
}
