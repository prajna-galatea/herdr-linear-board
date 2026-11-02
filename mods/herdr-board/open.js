import { exec, window } from "herdr";
import { openablePath } from "./state.js";

// The system's opener. Refuses anything that is not a local absolute path.
export function openFile(path, homeDir) {
  const local = openablePath(path, homeDir);
  if (!local) return;
  const platform = window()?.platform;
  if (platform === "windows") exec("explorer", [local]).catch(() => {});
  else if (platform === "linux") exec("xdg-open", [local]).catch(() => {});
  else exec("open", ["--", local]).catch(() => {});
}
