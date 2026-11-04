"""Real CLI driver; only this external writer changes the synthetic state."""
import os, sys, pty, fcntl, termios, struct, subprocess, signal, select, time, json, tempfile, pathlib, hashlib
root = pathlib.Path(__file__).resolve().parents[2]
node = sys.argv[1]

def run_case(name, width=120, height=40, finish='q', polling=False, permission=False):
    with tempfile.TemporaryDirectory(prefix='tui-pty-') as d:
        home = pathlib.Path(d)
        state = home / 'state.json'
        fixture = (root/'tui-dashboard/fixtures/state.anonymized.json').read_bytes()
        if not polling: state.write_bytes(fixture)
        master, slave = pty.openpty()
        def resize(w,h): fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH',h,w,0,0))
        resize(width,height)
        initial_mode = termios.tcgetattr(slave)
        env = {**os.environ, 'HOME':d, 'XDG_CONFIG_HOME':d, 'XDG_CACHE_HOME':d, 'TMPDIR':d,
               'TERM':'xterm-256color','DEV':'false','NO_COLOR':'1'}
        env.pop('CI',None); env.pop('FORCE_COLOR',None); env.pop('NODE_OPTIONS',None)
        args = [node]
        if permission: args += ['--permission','--allow-fs-read=*']
        args += ['--import',str(root/'tui-dashboard/support/preload-guard.mjs'),str(root/'tui-dashboard/src/cli.mjs'),'--state',str(state)]
        def snapshot():
            return [(str(p.relative_to(home)),p.stat().st_mtime_ns,hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(home.rglob('*')) if p.is_file()]
        initial_files=snapshot()
        proc = subprocess.Popen(args,stdin=slave,stdout=slave,stderr=slave,cwd=root,env=env,start_new_session=True)
        events=[]; raw=b''
        def collect(label, seconds=.55):
            nonlocal raw
            data=b''; deadline=time.monotonic()+seconds
            while time.monotonic()<deadline:
                if select.select([master],[],[],min(.1,max(0,deadline-time.monotonic())))[0]:
                    try: chunk=os.read(master,65536)
                    except OSError: break
                    if not chunk: break
                    data+=chunk
            raw+=data
            events.append({'label':label,'width':width,'height':height,'data':data.decode('utf8','replace')})
        try:
            collect('initial',1.2)
            if polling:
                # Successful read, same bytes/mtime change, atomic replacement, then all failure classes.
                def payload(title): return json.dumps({'version':1,'tasks':[{'id':'POLL','title':title,'column':'todo'}]}).encode()
                state.write_bytes(payload('one')); os.utime(state,ns=(1000000000,1000000000))
                collect('ready-one',5.3)
                before=state.stat(); first=state.read_bytes()
                state.write_bytes(payload('two')); os.utime(state,ns=(before.st_atime_ns,before.st_mtime_ns))
                assert state.stat().st_mtime_ns==before.st_mtime_ns and len(first)==len(state.read_bytes())
                collect('same-length-mtime-two',5.3)
                temp=home/'replace.json'; temp.write_bytes(payload('tri')); os.replace(temp,state)
                collect('atomic-tri',5.3)
                state.write_text('{'); collect('stale-json',5.3)
                state.write_text('{"tasks":{}}'); collect('stale-schema',5.3)
                state.unlink(); state.mkdir(); collect('stale-unreadable',5.3)
                state.rmdir(); collect('stale-missing',5.3)
                state.write_text('{"tasks":[]}'); collect('recovered-empty',5.3)
            elif name=='resize':
                width,height=59,24; resize(width,height); proc.send_signal(signal.SIGWINCH); collect('narrow')
                for _ in range(15): os.write(master,b'\x1b[6~'); time.sleep(.03)
                collect('last-card')
                width,height=120,40; resize(width,height); proc.send_signal(signal.SIGWINCH); collect('wide-again')
            else:
                for _ in range(15): os.write(master,b'\x1b[6~'); time.sleep(.03)
                collect('last-card')
            # Snapshot immediately before exit, including file metadata and isolated directory names.
            def snapshot():
                return [(str(p.relative_to(home)),p.stat().st_mtime_ns,hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(home.rglob('*')) if p.is_file()]
            before=snapshot() if polling else initial_files
            if finish=='term': proc.send_signal(signal.SIGTERM)
            elif finish=='int': proc.send_signal(signal.SIGINT)
            else: os.write(master,b'\x03' if finish=='ctrl-c' else b'q')
            collect('exit',.6)
            code=proc.wait(timeout=4)
            return {'name':name,'events':events,'exitCode':code,'modeRestored':termios.tcgetattr(slave)==initial_mode,
                    'sameFiles':before==snapshot(),'raw':raw.decode('utf8','replace')}
        finally:
            if proc.poll() is None: os.killpg(proc.pid,signal.SIGKILL); proc.wait(timeout=3)
            os.close(master); os.close(slave)

mode=sys.argv[2] if len(sys.argv)>2 else 'all'
if mode=='poll': cases=[run_case('poll',polling=True)]
elif mode=='permission': cases=[run_case('permission',permission=True)]
else: cases=[run_case('wide'),run_case('medium',80,24),run_case('small',59,24),run_case('resize'),run_case('ctrl-c',finish='ctrl-c'),run_case('term',finish='term'),run_case('int',finish='int')]
print(json.dumps(cases,ensure_ascii=False))
