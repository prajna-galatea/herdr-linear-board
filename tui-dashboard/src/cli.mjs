import { fileURLToPath } from "node:url";
import path from "node:path";
import { runDashboard } from "./app.mjs";
import { resolveStatePath } from "./board.mjs";

function printHelp() {
  process.stdout.write(`用法: node tui-dashboard/src/cli.mjs [--state PATH] [--help]
  --state PATH   覆寫 state.json 路徑（優先於 HERDR_BOARD_STATE）
  HERDR_BOARD_STATE  第二優先
  預設 ~/herdr-ops/board/state.json

正式流程不含看板，啟用需 Pol哥 同意。請手動在獨立終端分頁執行。
`);
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return 0;
  }
  let argvState = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--state" && argv[i + 1] && !argv[i + 1].startsWith("--")) {
      argvState = argv[++i];
    } else {
      process.stderr.write("未知參數或 --state 缺少路徑\n");
      return 2;
    }
  }
  const homeDir = env.HOME || env.USERPROFILE || "";
  const statePath = resolveStatePath({ argvState, envState: env.HERDR_BOARD_STATE, homeDir });
  return runDashboard({ statePath });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().then((code) => {
    if (code !== 0) process.exitCode = code;
  }).catch(err => { process.stderr.write(`看板錯誤：${err.message}\n`); process.exitCode = 1; });
}
