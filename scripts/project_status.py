#!/usr/bin/env python3
"""Validate the planning registry and regenerate read-only views. No network or agents."""
from __future__ import annotations
import argparse, datetime as dt, html, json, sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
STATES = {'BACKLOG','READY','IN_PROGRESS','REVIEW','VALIDATION','DONE','BLOCKED'}
TEST_STATES = {'NOT_RUN','PASS','FAIL','BLOCKED','NOT_APPLICABLE'}

def load(root: Path, name: str):
    return json.loads((root / 'management' / name).read_text(encoding='utf-8'))

def validate(root: Path):
    tasks, reqs, tests, screens = [load(root, n) for n in ['tasks.json','requirements.json','test_catalog.json','screens.json']]
    errors=[]
    groups={'task':tasks,'requirement':reqs,'test':tests,'screen':screens}
    indexes={}
    for kind, values in groups.items():
        ids=[v['id'] for v in values]
        if len(set(ids))!=len(ids):errors.append(f'Duplicate {kind} IDs')
        indexes[kind]={v['id']:v for v in values}
    ti,ri,ai,si=[indexes[k] for k in ['task','requirement','test','screen']]
    def check(refs, index, owner):
        for ref in refs:
            if ref not in index: errors.append(f'{owner}: unknown reference {ref}')
    for t in tasks:
        check(t['dependencies'],ti,t['id']);check(t['requirement_ids'],ri,t['id']);check(t['test_ids'],ai,t['id']);check(t['screens'],si,t['id'])
        if t['status'] not in STATES:errors.append(f"{t['id']}: invalid status")
        if t['status']=='BLOCKED' and not t.get('blocker'):errors.append(f"{t['id']}: missing blocker")
        if t['status'] in ['READY','IN_PROGRESS','REVIEW','VALIDATION','DONE']:
            if any(ti.get(x,{}).get('status')!='DONE' for x in t['dependencies']):errors.append(f"{t['id']}: dependencies not DONE")
        if t['status']=='DONE':
            if not t.get('commit') or not t.get('evidence'):errors.append(f"{t['id']}: DONE requires commit and evidence")
            for test_id in t['test_ids']:
                a=ai.get(test_id,{})
                if a.get('status')!='PASS':errors.append(f"{t['id']}: {test_id} not PASS; scope exceptions need an approved requirement change")
                if a.get('commit') != t.get('commit'):errors.append(f"{t['id']}: {test_id} acceptance commit mismatch")
        if len({len(t[k]) for k in ('acceptance','requirement_ids','test_ids')}) != 1:errors.append(f"{t['id']}: acceptance/requirement/test length mismatch")
        if not t['acceptance']:errors.append(f"{t['id']}: no acceptance criteria")
    visiting=set();visited=set()
    def visit(tid):
        if tid in visiting:errors.append(f'Dependency cycle at {tid}');return
        if tid in visited or tid not in ti:return
        visiting.add(tid)
        for dep in ti[tid]['dependencies']:visit(dep)
        visiting.remove(tid);visited.add(tid)
    for tid in ti:visit(tid)
    for r in reqs:
        check(r['task_ids'],ti,r['id']);check(r['test_ids'],ai,r['id']);check(r['screens'],si,r['id'])
        if not r['test_ids'] or not r['task_ids']:errors.append(f"{r['id']}: missing traceability")
        for tid in r['task_ids']:
            if r['id'] not in ti.get(tid,{}).get('requirement_ids',[]):errors.append(f"{r['id']}: asymmetric task link")
    for a in tests:
        check(a['requirement_ids'],ri,a['id']);check(a['task_ids'],ti,a['id'])
        if a['status'] not in TEST_STATES:errors.append(f"{a['id']}: invalid status")
        if a['status']=='PASS' and any(not a.get(k) for k in ['commit','environment','evidence','executed_at']):errors.append(f"{a['id']}: PASS lacks execution evidence")
        if a['status']=='NOT_APPLICABLE' and not a.get('notes'):errors.append(f"{a['id']}: N/A needs rationale")
    for s in screens:
        check(s['task_ids'],ti,s['id'])
        if not s['task_ids']:errors.append(f"{s['id']}: no implementation task")
    for image in load_manifest(root):
        import hashlib
        p=root/image['path']
        if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=image['sha256']:errors.append(f"Design reference changed: {image['path']}")
    return errors,tasks,reqs,tests,screens

def load_manifest(root):
    return json.loads((root/'docs/design/REFERENCE_MANIFEST.json').read_text(encoding='utf-8'))

def generate(root,tasks,reqs,tests,screens):
    timestamp=dt.datetime.now(dt.timezone.utc).isoformat()
    counts=Counter(t['status'] for t in tasks);tc=Counter(t['phase'] for t in tasks)
    status=['# Project status — generated view',f'\nGenerated: {timestamp}\n',f"Tasks: {len(tasks)} | Requirements: {len(reqs)} | Tests: {len(tests)} | Screens: {len(screens)}", '\nNo VMS implementation or hardware test is implied by this planning registry.\n','## Status counts']
    status += [f'- {k}: {v}' for k,v in sorted(counts.items())]
    status += ['\n## Release scope counts']+[f'- {k}: {v}' for k,v in sorted(tc.items())]
    status += ['\n## Blockers']+[f"- {t['id']}: {t['blocker']}" for t in tasks if t['status']=='BLOCKED']
    status += ['\n## Backlog','| ID | Phase | Status | Task | Depends on |','|---|---|---|---|---|']
    status += [f"| [{t['id']}](tasks/{t['id']}.md) | {t['phase']} | {t['status']} | {t['title']} | {', '.join(t['dependencies']) or '—'} |" for t in tasks]
    (root/'management/STATUS.md').write_text('\n'.join(status)+'\n',encoding='utf-8')
    trace=['# Requirements → tasks → acceptance tests','\nGenerated from canonical registries; NOT_RUN does not mean passing.\n','| Requirement | Phase | Task | Test | Requirement statement |','|---|---|---|---|---|']
    trace += [f"| {r['id']} | {r['phase']} | {', '.join(r['task_ids'])} | {', '.join(r['test_ids'])} | {r['statement']} |" for r in reqs]
    (root/'management/TRACEABILITY.md').write_text('\n'.join(trace)+'\n',encoding='utf-8')
    # Update derived task cards so status is not duplicated by hand.
    for t in tasks:
        text=f"# {t['id']} — {t['title']}\n\n> Generated card. Edit management/tasks.json, then run this script with --write.\n\n"
        text+=f"**Phase:** {t['phase']} | **Priority:** {t['priority']} | **Status:** {t['status']}\n\n"
        text+=f"**Owner role:** {t['owner_role']} | **Hardware:** {t['requires_hardware']}\n\n**Dependencies:** {', '.join(t['dependencies']) or 'None'}\n\n**Chapters:** {', '.join(map(str,t['chapters']))}\n\n**Screens:** {', '.join(t['screens']) or 'N/A'}\n"
        text+='\n## Model policy — not a live model switch\n```json\n'+json.dumps(t['model_policy'],ensure_ascii=False,indent=2)+'\n```\n'
        text+='\n## Acceptance\n'+ '\n'.join(f"- **{r} / {a}:** {c}" for r,a,c in zip(t['requirement_ids'],t['test_ids'],t['acceptance']))+'\n'
        text+='\n## Deliverables\n'+'\n'.join('- '+x for x in t['deliverables'])+'\n'
        text+='\n## Guardrails\nRead AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.\n'
        if t.get('blocker'):text+='\n## Blocker\n'+t['blocker']+'\n'
        (root/f"management/tasks/{t['id']}.md").write_text(text,encoding='utf-8')
    data=json.dumps(tasks,ensure_ascii=False).replace('</','<\\/')
    page='''<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SMPLWISE • Development Board</title>
<style>body{margin:0;background:#f3f6fa;color:#162334;font:16px Arial,sans-serif}main{max-width:1180px;margin:auto;padding:32px}h1{margin:4px 0 10px;font-size:32px}small,.muted{color:#617185}header{border-bottom:1px solid #dce4ec;padding-bottom:24px}nav{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0}input,select{border:1px solid #cbd6e3;border-radius:8px;background:white;padding:12px;font:inherit}input{flex:1;min-width:220px}.card{background:white;border:1px solid #dde5ee;border-radius:12px;margin:12px 0;padding:18px}summary{cursor:pointer;font-weight:700;line-height:1.6}.tag{font-size:12px;color:#315b8a;background:#eef4fc;border-radius:6px;padding:4px 8px;display:inline-block;margin:0 8px}li{line-height:1.8;margin:8px 0}.stats{font-size:14px;padding:12px 0}.warning{border-right:4px solid #e4a42b;padding:12px;background:#fff8e8;line-height:1.7}a{color:#1756a8}pre{direction:ltr;text-align:left;white-space:pre-wrap}.bad{color:#99500d}@media(max-width:700px){main{padding:18px}h1{font-size:26px}input,select{width:100%}}</style>
<main><header><small>SMPLWISE VMS · PROJECT KIT __VERSION__</small><h1>לוח פיתוח ומעקב</h1><p>__COUNTS__</p><div class="warning">זהו לוח תכנון, לא מערכת VMS פעילה. הצגת הסטטוס היא Snapshot בלבד. מעדכנים את קובצי JSON ומריצים את scripts/project_status.py --write כדי לרענן את הלוח.</div></header><nav><input id="q" placeholder="חפש משימה, דרישה או מילת מפתח…"><select id="phase"><option value="">כל השלבים</option><option>G0</option><option>PILOT</option><option>BETA</option><option>V1</option><option>V2</option></select><select id="status"><option value="">כל הסטטוסים</option><option>BACKLOG</option><option>BLOCKED</option><option>READY</option><option>IN_PROGRESS</option><option>REVIEW</option><option>VALIDATION</option><option>DONE</option></select></nav><div id="count" class="stats"></div><section id="list"></section><footer class="muted">מפרט: MASTER_SPEC_HE.md · מקור אמת: management/tasks.json · ללא התחברות חיצונית</footer></main><script>
const tasks=__DATA__;
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function draw(){const query=document.getElementById('q').value.toLowerCase(),phase=document.getElementById('phase').value,status=document.getElementById('status').value;const selected=tasks.filter(t=>(!phase||t.phase===phase)&&(!status||t.status===status)&&JSON.stringify(t).toLowerCase().includes(query));const host=document.getElementById('list');host.replaceChildren();document.getElementById('count').textContent=selected.length+' משימות מוצגות';for(const t of selected){const card=el('details',undefined,'card'),head=el('summary',t.id+' · '+t.title);head.append(el('span',t.phase+' / '+t.status,'tag'));card.append(head);card.append(el('p','תלויות: '+(t.dependencies.join(', ')||'ללא')+' · תפקיד: '+t.owner_role+' · נדרשת חומרה: '+t.requires_hardware,'muted'));if(t.blocker)card.append(el('p',t.blocker,'bad'));const ul=el('ul');t.acceptance.forEach((c,i)=>ul.append(el('li',t.requirement_ids[i]+' / '+t.test_ids[i]+' — '+c)));card.append(ul);card.append(el('p','פרקי מפרט: '+t.chapters.join(', ')+' · מסכים: '+t.screens.join(', '),'muted'));const a=el('a','פתיחת כרטיס המשימה');a.href='management/tasks/'+t.id+'.md';card.append(a);host.append(card);}}
for(const id of ['q','phase','status'])document.getElementById(id).addEventListener('input',draw);draw();</script></html>'''.replace('__DATA__',data).replace('__VERSION__',html.escape(load(root, 'project.json')['version'])).replace('__COUNTS__', f'{len(tasks)} משימות • {len(reqs)} דרישות • {len(tests)} בדיקות קבלה מתוכננות • {len(screens)} מסכים')
    (root/'PROJECT_BOARD.html').write_text(page,encoding='utf-8')

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,default=ROOT);p.add_argument('--write',action='store_true');args=p.parse_args()
    try: errors,*data=validate(args.root)
    except (OSError,ValueError,KeyError) as e: print(f'Registry error: {e}',file=sys.stderr);return 2
    if errors:
        print('\n'.join('ERROR: '+e for e in errors),file=sys.stderr);return 1
    if args.write:generate(args.root,*data)
    print(f'PASS: planning registry links, dependency graph and original design hashes; {len(data[0])} tasks, {len(data[1])} requirements. No application tests were run.')
    return 0
if __name__=='__main__':raise SystemExit(main())
