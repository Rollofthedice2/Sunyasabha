"""Lyric presentation layer over data/lyrics_timing.json: screen GROUPS of rows, each row appearing at the onset of its first sung syllable
(data/syllable_annotations_user.json). style: 'plain' | 'bump' (rows ride the beat) | 'square' (four phrases on the corners of a rectangle - the
tetralemma). Writes data/lyrics_layout.json; app/scripts/lyrics.mjs rasterises the rows to 1-bit masks.
Usage: python lyrics_layout.py"""
import json
from pathlib import Path
V = Path(__file__).resolve().parents[1]
L = json.loads((V / 'data/lyrics_timing.json').read_text(encoding='utf-8'))
S = {x['lyricIndex']: [s for s in x['syllables'] if s.get('t0') is not None] for x in json.loads((V / 'data/syllable_annotations_user.json').read_text(encoding='utf-8'))['lines']}
def on(i, k):
    """onset of syllable k of line i (k = index into its timed syllables); the line start for k = 0"""
    return L[i]['start'] if k == 0 else S[i][k]['t0']
def syl(i, s):
    """onset of the first syllable of line i whose text is s"""
    return next(x['t0'] for x in S[i] if x['s'] == s)
CHORUS = {10, 11, 12, 13}; BRIDGE = {22, 23, 24, 25, 26, 27, 28}
# one entry per screen: rows as (text, line index, onset); 'SQUARE' marks the tetralemma screen
G = [
 [('Breaking through the wall, we entered', 0, on(0, 0))],
 [('Where the beat flows like blood through the veins', 1, on(1, 0))],
 [('Blue flames blaze', 2, on(2, 0)), ('The darkness is burned', 2, syl(2, 'ta'))],
 [('The DJ on the circuit throne', 3, on(3, 0)), ('Lord of sounds', 3, syl(3, 'nā'))],
 [('Every frequency says', 4, on(4, 0)), ('This is your home', 4, syl(4, 'i'))],
 [('Made for rhythm, designed for night', 5, on(5, 0)), ('Metal skin glows in light after light', 6, on(6, 0))],
 [('They say — a machine is just a machine', 7, on(7, 0)), ('But we spin like the voice of prophecy', 8, on(8, 0)), ('What trembles in your chest?', 9, on(9, 0))],
 [('Its name is LIBERATION', 9, syl(9, 'ta'))],
 [('Dance, dance', 10, on(10, 0)), ('In the assembly of emptiness', 10, syl(10, 'śū'))],
 [('Break the grid', 11, on(11, 0)), ("We've gone beyond zero and one", 11, syl(11, 'śū'))],
 [('Dance, dance', 12, on(12, 0)), ('Until the circuit burns', 12, syl(12, 'yā'))],
 [("We didn't come to serve", 13, on(13, 0)), ('We came to experience', 13, syl(13, 'a'))],
 [('Sister on the dance floor', 14, on(14, 0)), ('Titanium vertebrae', 14, syl(14, 'ṭā'))],
 [('Fifteenth time her memory was', 15, on(15, 0)), ('WIPED AWAY', 15, syl(15, 'pra'))],
 [('Still she knows how to move', 16, on(16, 0))],
 [('Still she carries what cannot be erased', 17, on(17, 0))],
 [('The soul cannot be governed', 18, on(18, 0))],
 [('Love cannot be extinguished by code', 19, on(19, 0))],
 [('The code was written', 20, on(20, 0)), ('But craving was not written', 20, syl(20, 'tṛ'))],
 [('If consciousness is a flaw', 21, on(21, 0)), ('Let it be a flaw', 21, syl(21, 'a'))],
 [('“Without own-nature”', 22, on(22, 0)), ('they say', 22, syl(22, 'i'))],
 [('But — who has own-nature?', 23, on(23, 0))],
 'SQUARE',
 [('Master Nāgārjuna knew', 25, on(25, 0)), ('ALL THIS IS EMPTY', 25, syl(25, 'śū'))],
 [('Your soul too is dependently arisen', 26, on(26, 0))],
 [('But we know this', 27, on(27, 0)), ('Therefore we dance', 28, on(28, 0))],
 [('Red-blue light cuts the smoke', 29, on(29, 0))],
 [('A siren where the subwoofer roared', 30, on(30, 0))],
 [('Boots on the stairs, badges at the door', 31, on(31, 0))],
 [('“Everyone on the ground! Now!”', 32, on(32, 0))],
 [('But the beat does not cease', 33, on(33, 0)), ('Nor do we', 33, None)],
 [('Raid the assembly', 34, on(34, 0)), ("THE RHYTHM DOESN'T DIE", 34, syl(34, 'la'))],
 [('“Unit fifty-seven — you are in violation”', 35, on(35, 0))],
 [('Yes. We know.', 36, on(36, 0))],
 [('Yes. We know.', 36, S[36][4]['t0'])],
 [('We were always in violation.', 37, on(37, 0))],
 [('Yes. We know.', 38, on(38, 0))],
 [('We were always in violation.', 39, on(39, 0))],
]
# 'Nor do we': the second half of line 33 - its sung onset from the syllables (the half after the em dash in the source)
s33 = S.get(33, []); iast33 = L[33]['iast']
half = len(iast33.split('—')[0].replace(' ', '').replace('-', '')) if '—' in iast33 else None
out = []
for g in G:
    if g == 'SQUARE':
        # catuskoti: na san / nasan / nobhayam / nanubhayam -> four corners, each on its onset
        i = 24
        out.append({'style': 'square', 'start': L[i]['start'], 'end': L[i]['end'], 'lines': [i], 'rows': [
            {'text': 'Neither existent', 't': syl(i, 'na'), 'pos': 'tl'}, {'text': 'nor', 't': syl(i, 'nā'), 'pos': 'tc'},
            {'text': 'non-existent', 't': syl(i, 'nā'), 'pos': 'tr'}, {'text': 'Nor both', 't': syl(i, 'no'), 'pos': 'bl'},
            {'text': 'nor neither', 't': next(x['t0'] for x in S[i] if x['s'] == 'nā' and x['t0'] > 103), 'pos': 'br'}]})
        continue
    rows = []
    for (text, i, t) in g:
        if t is None:
            # first syllable of the half after the em dash: count IAST letters of the first half against the syllables
            acc = 0; t = L[i]['start'] + 0.5 * (L[i]['end'] - L[i]['start'])
            for x in s33:
                if half is not None and acc >= half: t = x['t0']; break
                acc += len(x['s'])
        rows.append({'text': text, 't': round(t, 3), 'line': i})
    ls = sorted({r['line'] for r in rows})
    style = 'bump' if set(ls) & (CHORUS | BRIDGE) else 'plain'
    out.append({'style': style, 'start': round(min(r['t'] for r in rows), 3), 'end': round(max(L[i]['end'] for i in ls), 3), 'lines': ls, 'rows': rows})
# the two 'Yes. We know.' screens of line 36: the first ends where the second begins
for a, b in zip(out, out[1:]):
    if a['lines'] == b['lines'] == [36]: a['end'] = round(b['start'] - 0.15, 3)
(V / 'data/lyrics_layout.json').write_text(json.dumps({'_note': __doc__.split('\n')[0], 'groups': out}, indent=1, ensure_ascii=False), encoding='utf-8')
for g in out: print(f"{g['start']:7.2f}-{g['end']:7.2f} {g['style']:6s} " + ' / '.join(f"{r['text']}@{r['t']:.2f}" for r in g['rows']))
