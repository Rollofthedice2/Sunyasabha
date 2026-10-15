"""Lint an image request queue before generation: any pending request that paints PEOPLE must carry cast.CAST and the cast reference;
subculture costume cliches are flagged. The queue is a JSON file {"requests": [{id, status, kind, prompt, references_with_roles}, ...]}.
Usage: python request_lint.py QUEUE.json   (exit 1 on a problem)"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import cast
if len(sys.argv) < 2: sys.exit('usage: python request_lint.py QUEUE.json')
R = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))['requests']
PEOPLE = ('background_plate', 'local_edit_plate', 'crowd', 'recast')
BAD = ('punk/goth', 'goth crowd', 'leather crowd')
bad = []
for r in R:
    if not (r.get('status') == 'pending' or str(r.get('status', '')).startswith('held')): continue
    k = (r.get('kind', '') + ' ' + r.get('group', '')).lower(); p = r.get('prompt', '')
    # kinds that only re-pose or matte an existing crowd image (crowd_response_state, people_matte) must not carry any other crowd image:
    # the model copies people from every reference, so the base crowd is the only input
    if any(x in k for x in ('crowd_response_state', 'people_matte')):
        refs = ' '.join(x['path'] for x in r.get('references_with_roles', []))
        if 'E_crowd_ring_assembled_v2_master' in refs: bad.append((r['id'], 'state/matte edit carries the E_crowd reference (leaks other people)'))
    elif any(x in k for x in PEOPLE) or 'crowd' in p.lower():
        refs = ' '.join(x['path'] for x in r.get('references_with_roles', []))
        if cast.MARK not in p: bad.append((r['id'], 'missing CAST text'))
        if 'E_crowd_ring_assembled_v2_master' not in refs: bad.append((r['id'], 'missing E_crowd cast reference'))
    for w in BAD:
        if w in p.lower(): bad.append((r['id'], f'costume cliche "{w}" in prompt'))
for b in bad: print('LINT', *b)
print('lint:', 'FAIL' if bad else 'ok'); sys.exit(1 if bad else 0)
