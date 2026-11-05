"""Capture isolated native windows without replacing candidate size callbacks."""
from pathlib import Path
import hashlib, json, os, shutil, signal, subprocess, sys, tempfile, time
repo = Path(__file__).resolve().parents[2]
candidate = Path(sys.argv[1]).resolve()
candidate_sha = subprocess.check_output(['git','rev-parse','HEAD'],cwd=candidate,text=True).strip()
version = subprocess.check_output(['herdr-app','--version'],text=True).strip().split()[-1]
out = repo / 'docs/board-opt'
commands, captures = [], []
def invoke(args, env, timeout=10):
    p = subprocess.Popen(['herdr-app', *args], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True)
    try:
        stdout, stderr = p.communicate(timeout=timeout)
        code = p.returncode
    except subprocess.TimeoutExpired:
        os.killpg(p.pid, signal.SIGKILL)
        stdout, stderr = p.communicate(timeout=3)
        code = 124
    record = {'home':env['HERDR_APP_HOME'], 'command':['herdr-app',*args], 'exit':code,'stdout':stdout,'stderr':stderr}
    commands.append(record)
    (out/'build5-native-commands.json').write_text(json.dumps(commands,ensure_ascii=False,indent=2)+'\n')
    return record
for name, width in [('narrow',720),('medium',1020),('wide',1550)]:
    root = Path(tempfile.mkdtemp(prefix=f'T-board-build5-{name}-'))
    env = {**os.environ, 'HERDR_APP_HOME':str(root)}
    (root/'window.json').write_text(json.dumps({'state':'windowed','bounds':[10,40,width,880]}))
    (root/'shared.json').write_text(json.dumps({'frame.welcomed':'skipped'}))
    (root/'update-notes.json').write_text(json.dumps({'last_run':version,'presented':[version]}))
    mod = root/'mods/board-capture'
    mod.mkdir(parents=True)
    shutil.copytree(candidate/'mods/herdr-board',mod/'candidate')
    # Keep spinner asset at the product's expected path too.
    shutil.copytree(candidate/'mods/herdr-board',root/'mods/herdr-board')
    shutil.copy2(out/'build5-native-driver.js',mod/'main.js')
    shutil.copy2(candidate/'mods/herdr-board/mod.json',mod/'mod.json')
    source_hashes = {str(p.relative_to(candidate/'mods/herdr-board')):hashlib.sha256(p.read_bytes()).hexdigest() for p in (candidate/'mods/herdr-board').rglob('*') if p.is_file()}
    copy_hashes = {str(p.relative_to(mod/'candidate')):hashlib.sha256(p.read_bytes()).hexdigest() for p in (mod/'candidate').rglob('*') if p.is_file()}
    assert source_hashes == copy_hashes
    log = open(root/'window.log','w')
    process = subprocess.Popen(['herdr-app'],env=env,stdout=log,stderr=log,start_new_session=True)
    space = None
    try:
        deadline = time.monotonic()+20
        while True:
            ls=invoke(['ls'],env,3)
            if ls['exit']==0:break
            if process.poll() is not None or time.monotonic()>deadline:raise RuntimeError('isolated window unavailable')
            time.sleep(.5)
        assert invoke(['status'],env)['exit']==0
        assert invoke(['do','app.zoom_reset'],env)['exit']==0
        created=invoke(['do','space.new','--name',f'T-board-1 BUILD-5 {name}','--folder',str(root)],env)
        assert created['exit']==0,created
        space=json.loads(created['stdout'])['space']
        tab=invoke(['do','tab.new','--name',f'T-board-1 BUILD-5 {name}','--space',space,'--mod','board-capture','--props',json.dumps({'state':str(out/'native-state.json')})],env)
        assert tab['exit']==0,tab
        ids=json.loads(tab['stdout'])
        time.sleep(2)
        status=invoke(['status'],env); inventory=invoke(['ls'],env)
        assert status['exit']==0 and inventory['exit']==0
        for overlay in json.loads(status['stdout'])['overlays']:
            assert invoke(['do','overlay.close'],env)['exit']==0
        time.sleep(.3)
        status=invoke(['status'],env)
        data=json.loads(status['stdout']); assert not data['errors'] and not data['overlays'] and data['zoom']==1 and data['tab']==ids['tab'],data
        assert invoke(['shot',str(out/f'build5-{name}.png')],env)['exit']==0
        lines=(root/'window.log').read_text().splitlines()
        measures=[line for line in lines if 'T_BOARD_ROOT ' in line]
        assert measures,lines
        actual=float(measures[-1].split('T_BOARD_ROOT ')[-1])
        assert {'narrow':actual<480,'medium':480<=actual<960,'wide':actual>=960}[name],actual
        (out/f'build5-{name}-window.txt').write_text('\n'.join(measures)+'\n')
        (out/f'build5-{name}-status.json').write_text(status['stdout'].rstrip()+'\n')
        spaces=[s for s in json.loads(inventory['stdout'])['spaces'] if s['id']==space]
        (out/f'build5-{name}-ls.json').write_text(json.dumps(spaces,indent=2)+'\n')
        captures.append({'name':name,'home':str(root),'window_logical_width':width,'root_logical_width':actual,'pane':ids['pane'],'tab':ids['tab'],'source_hashes':source_hashes,'copy_hashes':copy_hashes,'window_config':json.loads((root/'window.json').read_text())})
        print(name,actual,flush=True)
    finally:
        if space:
            invoke(['do','space.close','--id',space,'--confirmed','true'],env)
            remaining=invoke(['ls'],env)
            assert remaining['exit']==0 and not any(s['id']==space for s in json.loads(remaining['stdout'])['spaces'])
        invoke(['do','app.quit'],env)
        try: process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid,signal.SIGKILL);process.wait(timeout=3)
        log.close()
        captures.append({'cleanup':name,'process_exit':process.returncode,'pid':process.pid,'socket_exists':(root/'herdr-app.sock').exists()})
        (out/'build5-native-hashes.json').write_text(json.dumps({'candidate':candidate_sha,'fixture_sha256':hashlib.sha256((out/'native-state.json').read_bytes()).hexdigest(),'driver_sha256':hashlib.sha256((out/'build5-native-driver.js').read_bytes()).hexdigest(),'captures':captures},indent=2)+'\n')
