import {installIoGuard,getViolations} from './io-guard.mjs';
installIoGuard();
process.on('exit', () => {
  const violations = getViolations();
  process.stderr.write(`\n@@GUARD@@${JSON.stringify(violations)}\n`);
  if (violations.length) process.exitCode = 1;
});
