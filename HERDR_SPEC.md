# HERDR_SPEC: local herdr board (branch herdr-local-board)

Goal: turn this Linear board into a LOCAL kanban for the "Herdr 新任務流程" (herdr ops). No network, no `claude` CLI, no Linear.
Read RECIPE.md and ~/.config/herdr-app/AGENTS.md + `hc --skill` first. Use only `herdr-app` and `hc` (herdr-core); never herdr TUI commands.

## Layout
- New mods: `mods/herdr-board/` (board) and `mods/herdr-board-agent/` (dispatch dialog). Mod names must be distinct from `linear-board` so both can coexist. Keep the original linear-board mods untouched (or remove from install docs, but don't break them).
- Reuse view/card/agent-status code; drop sync.js's claude/Linear logic (replace with `state.js`, pure, testable under `node --test`).

## Data: local JSON state file
- Path: `~/herdr-ops/board/state.json` (configurable via `~/.config/herdr-app/herdr-board.json` `{ "state": "<path>" }`; `~` expands).
- Schema:
```json
{ "version": 1, "updated_at": "ISO", "tasks": [ {
  "id": "T-001", "title": "…", "column": "todo|decide|spec|build|review|merge|merged",
  "pane": "build-grok", "model": "grok-4.7", "repo": "~/herdr-ops/…",
  "reject_counts": { "grok-4.7": 1 }, "spec_rewrites": 0,
  "results": { "spec": "path", "build": "path", "review": "path" },
  "needs_pol": false, "example": false, "updated_at": "ISO" } ] }
```
- The board only READS this file, except the two actions below which update one task's fields atomically (write tmp + rename). Re-read on open, on `Refresh`, and poll every 5s while open (compare mtime/updated_at). Missing file -> friendly empty state "尚無任務：~/herdr-ops/board/state.json". Invalid JSON -> error line, keep last good snapshot.
- Unknown `column` values go to 待辦 with a warning dim line.

## Columns (fixed order, always shown even if empty)
todo 待辦 · decide 等Pol哥決定 · spec 規格師 · build 施工手 · review 審查手 · merge 合併手 · merged 已合併.
Header title "Herdr 新任務流程". Keep text filter (id/title). Replace project chips with model chips or remove them.

## Card
- id, title (never truncated), pills: model, pane name, reject counts (e.g. `退回 grok-4.7×1`), `規格重寫 1` if >0, `範例` pill if `example:true`, updated date.
- `needs_pol: true` -> highlighted border + "等 Pol哥" pill.
- Agent status: match herdr agents to the card by the card's `pane` == terminal name (role panes: lead, spec, dispatch, build, build-grok/build-deepseek/build-glm, review(-suffix), merge), fallback to task id in tab/space name. Reuse existing status display (Working/Needs you/Done/Idle, colored border). Click goes to the agent.
- Click on a card with a result path opens that file (local `open`), else nothing.

## Actions
- Replace `Agent` button with `派工` (dispatch) on todo/spec/build/review cards: dialog chooses role pane (default from column: spec->spec, build->build-grok, review->review), optional instructions. Behaviour: if the pane exists (by name, via hc/herdr-app agents list) -> `hc send --if idle <pane> "<task line>"`; else `hc run --bg --name <pane> --keep --label herdr.space=<current space> --label herdr.tab=<current tab> -- <command>` with the task as the agent's first prompt. Commands per pane come from config `~/.config/herdr-app/herdr-board.json` `"roles": {"build-grok": ["grok","-m","grok-4.7"], "review": ["codex","--no-daemon"], ...}` with sane defaults. Task line: one line, control chars stripped, includes task id/title/result paths, "use only herdr-app and hc", "do not merge, push or deploy".
  Then set the task's `pane` (and `column` if dispatched from todo) in state.json.
- Merge column: button `請 Pol哥 決定` — MUST NOT run git/merge anything. It only sets `needs_pol: true` and column `decide`, and (if a `lead` pane exists) `hc send --if idle lead "task <id> 請示 Pol哥 是否合併"`.
- No worktree creation, no `claude`, no network calls.

## Example data
`examples/state.example.json` with ~7 fake tasks (one per column, `"example": true`, titles prefixed `[範例]`), plus a README note: `mkdir -p ~/herdr-ops/board && cp examples/state.example.json ~/herdr-ops/board/state.json`.

## Docs / license
- Keep LICENSE (MIT) and credit nu0ma (original repo link) in README.
- README: add a 繁體中文 section "本機模式 (herdr ops)" describing install (copy mods/herdr-board* into ~/.config/herdr-app/mods/), state file, columns, actions, and that merge is never automatic. Update RECIPE.md (or add RECIPE.herdr.md) to describe the new mod.

## Done when
- `node --test` passes (add tests for state parsing, column mapping, task-line sanitising, merge action never touching git).
- `herdr-app check mods/herdr-board` and `herdr-app check mods/herdr-board-agent` pass.
- No reference to `claude -p` / Linear MCP in the herdr-board mods.
- Commit(s) on branch herdr-local-board. Do NOT push.
