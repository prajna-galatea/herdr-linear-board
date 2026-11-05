import {POLL_MS, nextDisplayState, readStateFile} from './read-loop.mjs';

export async function runDashboard({statePath, stdin=process.stdin, stdout=process.stdout, stderr=process.stderr}) {
  if (!stdout.isTTY || !stdin.isTTY || !stdout.columns || !stdout.rows) {
    stderr.write('需要可用的 TTY 終端與尺寸才能顯示看板\n');
    return 2;
  }
  const React = await import('react');
  const ink = await import('ink');
  const {BoardView} = await import('./terminal.mjs');
  let displayState = {kind:'loading'};
  let scrollOffset = 0;
  let closed = false;
  let timer;
  let exitCode = 0;
  let instance;
  const stop = (code=0) => {
    if (closed) return;
    closed = true;
    exitCode = code;
    clearTimeout(timer);
    instance?.unmount();
  };
  const render = () => React.createElement(BoardView, {
    displayState, scrollOffset, statePath, onExit:stop,
    setScrollOffset: value => {
      if (closed) return;
      scrollOffset = typeof value === 'function' ? value(scrollOffset) : value;
      instance.rerender(render());
    },
  });
  const tick = async () => {
    try {
      const outcome = await readStateFile(statePath,Date.now());
      if (closed) return;
      displayState = nextDisplayState(displayState,outcome);
      instance.rerender(render());
      timer = setTimeout(tick,POLL_MS);
    } catch (err) {
      stderr.write(`看板錯誤：${err.message}\n`);
      stop(1);
    }
  };
  const onInt = () => stop(130);
  const onTerm = () => stop(143);
  try {
    instance = ink.render(render(),{stdin,stdout,stderr,patchConsole:false,alternateScreen:true,exitOnCtrlC:false});
    process.once('SIGINT',onInt);
    process.once('SIGTERM',onTerm);
    void tick();
    await instance.waitUntilExit();
    return exitCode;
  } finally {
    stop(exitCode);
    process.off('SIGINT',onInt);
    process.off('SIGTERM',onTerm);
  }
}
