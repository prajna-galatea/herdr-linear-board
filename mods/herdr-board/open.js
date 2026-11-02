import { exec, window } from "herdr";

// The system's opener, for a local result file. The path is already checked by openablePath.
export function openFile(path) {
  const platform = window()?.platform;
  if (platform === "windows") exec("explorer", [path]).catch(() => {});
  else if (platform === "linux") exec("xdg-open", [path]).catch(() => {});
  else exec("open", ["--", path]).catch(() => {});
}
