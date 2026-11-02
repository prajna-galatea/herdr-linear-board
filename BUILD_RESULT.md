# BUILD_RESULT

本機看板已做在 branch `herdr-local-board`。沒有 push、沒有開 PR、沒有 merge，也沒有把 mod 複製進 `~/.config/herdr-app/mods`。

## Commit

實作 commit：`eee266a6bf45cacd75213f304ed2251e9635e834`

`feat: add a local kanban for the Herdr ops flow`

這個檔是在該 commit 之後補上的，所以它不在上面那個 hash 裡。

## 改了哪些檔

- `README.md`：加上「本機模式 (herdr ops)」，並保留 MIT 與 nu0ma 出處
- `RECIPE.herdr.md`：新 mod 的做法
- `examples/state.example.json`：七欄各一張 `[範例]` 任務
- `mods/herdr-board/main.js`
- `mods/herdr-board/state.js`
- `mods/herdr-board/open.js`
- `mods/herdr-board/mod.json`
- `mods/herdr-board/spinner.svg`
- `mods/herdr-board-agent/main.js`
- `mods/herdr-board-agent/mod.json`
- `tests/herdr-board.test.mjs`

原本的 `mods/linear-board` 與 `mods/linear-board-agent` 沒有改。

## 驗證

工作目錄：`/Users/pauuul/herdr-ops/herdr-linear-board`。下面是該次指令的完整輸出。

```
=== node --test ===
✔ parseSync reads issues from the tool results (0.731625ms)
✔ a state without an answer fails the sync (0.223375ms)
✔ parseRepos expands ~ and tolerates a missing or broken file (0.388208ms)
✔ filterIssues by id or title (0.100334ms)
✔ projectsOf counts projects, biggest first and no project last (0.118ms)
✔ filterIssues narrows by project along with the text (0.062167ms)
✔ boardColumns orders states and puts urgent issues first (0.18475ms)
✔ limitCards shares the limit out so no column starves (0.11675ms)
✔ ago takes an ISO date or a timestamp (0.803333ms)
✔ safeUrl lets only https through (0.154542ms)
✔ parseSyncResult reads a finished sync and reports a failed one (0.244667ms)
✔ issueAgents finds the agent by tab, space or branch, the most urgent first (0.151209ms)
✔ parseState reads a task and rejects broken JSON without inventing a board (0.727333ms)
✔ unknown columns land in 待辦 and every column stays, in order (0.444708ms)
✔ taskLine is one line, keeps the id, title and result paths, and strips controls (0.226833ms)
✔ merge action moves the task to decide and never mentions git (0.509584ms)
✔ the example file has one example task in every column (0.208166ms)
✔ dispatch from 待辦 sets the column, and an existing pane is an idle send (0.168459ms)
✔ config expands ~ and a patch touches only the one task (0.221ms)
✔ filter matches id or title, and an agent matches the pane name then the task id (0.347375ms)
✔ branchFor uses Linear's suggested branch (0.832125ms)
✔ branchFor falls back to the identifier and title (0.193458ms)
✔ folderName turns a branch into one path segment (0.10275ms)
✔ taskFor is one line with the issue and its rules (0.181291ms)
✔ taskFor asks for subagents only when chosen (0.066ms)
✔ taskFor shortens long descriptions (0.07625ms)
✔ taskFor works without a description (0.050833ms)
✔ branchProblem refuses names git would read as options (0.062958ms)
✔ worktreeFolder never lands on the repo's worktrees folder itself (0.075167ms)
✔ taskFor strips control characters from Linear's text (0.12175ms)
✔ taskFor starts with the skill and adds the instructions (0.071709ms)
✔ taskFor leaves skill and instructions out when blank (0.045375ms)
ℹ tests 32
ℹ suites 0
ℹ pass 32
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 63.258959
NODE_EXIT:0
=== herdr-app check mods/herdr-board ===
check passed: mods/herdr-board
BOARD_EXIT:0
=== herdr-app check mods/herdr-board-agent ===
check passed: mods/herdr-board-agent
AGENT_EXIT:0
```
