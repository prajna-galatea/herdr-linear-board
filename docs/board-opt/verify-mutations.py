"""Run five independent behavioral regressions in disposable copies."""
from pathlib import Path
import tempfile, shutil, subprocess, os, re, json, gzip
repo=Path(__file__).resolve().parents[2]
out=repo/'docs/board-opt'
mutants={
 'readonly':('mods/herdr-board/main.js','    this.reading = true;','    this.reading = true;\n    globalThis.__runtime.herdr.writeTextFile("requests/regression", "bad").catch(() => {});'),
 'lanes':('mods/herdr-board/state.js','if (GATE_COLUMNS.has(col)) return "gate";','if (GATE_COLUMNS.has(col)) return "active";'),
 'card':('mods/herdr-board/main.js','const rejectLine = `退回 ${card.rejectTotal}`;','const rejectLine = `退回 ${card.rejectTotal + 1}`;'),
 'layout':('mods/herdr-board/main.js','this.rootWidth = size.width;','this.rootWidth = 960;'),
 'archive':('mods/herdr-board/state.js','if (CLOSED_COLUMNS.has(task.column)) return true;','if (CLOSED_COLUMNS.has(task.column)) return false;'),
}
results=[]
for name,(file,old,new) in mutants.items():
 with tempfile.TemporaryDirectory(prefix='T-board-mutant-') as temp:
  root=Path(temp)
  for folder in ['mods','tests']:shutil.copytree(repo/folder,root/folder)
  p=root/file;s=p.read_text();assert old in s
  p.write_text(s.replace(old,new))
  if name=='readonly':
   # Restore a real forbidden external operation via the module import boundary.
   p.write_text(p.read_text().replace('readTextFile }','readTextFile, writeTextFile }').replace('globalThis.__runtime.herdr.writeTextFile','writeTextFile'))
  diff=subprocess.run(['diff','-u',str(repo/file),str(p)],capture_output=True,text=True)
  (out/f'revert-{name}.patch.gz').write_bytes(gzip.compress(diff.stdout.encode(),mtime=0))
  run=subprocess.run(['node','--test','--test-reporter=tap'],cwd=root,env={**os.environ,'TZ':'Asia/Taipei'},capture_output=True,text=True,timeout=30)
  raw=run.stdout+run.stderr
  (out/f'revert-{name}-raw.txt.gz').write_bytes(gzip.compress(raw.encode(),mtime=0))
  failures=re.findall(r'^not ok \d+ - (.*)',raw,re.M)
  assert run.returncode!=0 and failures,(name,run.returncode)
  assert 'SyntaxError' not in raw and 'ERR_MODULE_NOT_FOUND' not in raw
  results.append({'name':name,'command':'TZ=Asia/Taipei node --test --test-reporter=tap','exit':run.returncode,'failed':len(failures),'cases':failures})
(out/'mutation-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False,indent=2))
