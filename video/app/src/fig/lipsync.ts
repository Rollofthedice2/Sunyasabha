// Lip sync from the hand-tapped syllable score (data/syllable_annotations_user.json, validated against
// data/performance_score). Tapped onsets and recorded ends are taken as facts; consonant transitions and how long a
// vowel is held without a recorded end are animation policy. A stale or missing score keeps the mouth closed and
// prints a diagnostic. The shape follows the syllable's vowel (a/ā -> open, o/u/ū -> round, e/i/ī -> wide), with a
// brief closed 'M' on bilabial onsets and a closed mouth in the gaps.
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { env } from '../engine/music.ts';

export type Mouth = 'closed' | 'small' | 'a' | 'o' | 'e' | 'm';
interface Line { iast?: string; en: string; start: number; end: number; confirmed?: boolean; sung?: boolean; syl?: { s: string; t: number | null }[] }
const DATA = path.resolve(import.meta.dirname, '../../../data');
const LYRIC_BYTES = readFileSync(path.join(DATA, 'lyrics_timing.json'));
const LINES: Line[] = JSON.parse(LYRIC_BYTES.toString('utf8'));
const CONFIRMED_ONLY = LINES.some((l) => l.confirmed === true);
const ACTIVE = LINES.map((line, index) => ({ line, index })).filter(({ line: l }) =>
  l.sung !== false && (!CONFIRMED_ONLY || l.confirmed === true) && Number.isFinite(l.start) && Number.isFinite(l.end) && l.end > l.start
).sort((a, b) => a.line.start - b.line.start);

export interface ManualCue {
  id: string; lineIndex: number; chunkIndex: number; label: string;
  onset: number; knownEnd: number | null; renderUntil: number;
  coveragePolicy: 'recorded_end' | 'next_manual_onset_animation_window' | 'coarse_line_tail_animation_window' | 'missing_successor_no_inference';
}
export interface ManualTiming {
  ready: boolean; reason: string; cues: ManualCue[]; sourceHash: string; draftHash: string;
}
interface TappedSyllable { s: string; t0: number | null; t1: number | null; startMethod: string | null; endMethod: string | null }
interface ScoreChunk {
  id: string; line_index: number; chunk_index: number; label: string;
  onset: number | null; known_end: number | null;
  original_start_method: string | null; original_end: number | null; original_end_method: string | null;
}
const manualMethod = (s: string | null) => ['manual_edit', 'manual_hold', 'manual_tap'].includes(s ?? '');
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// Validates the score against both current inputs and every chunk, so a newly saved draft cannot silently use an
// older score. Pure, so tests can call it.
export function validateManualTiming(sourceBytes: Uint8Array, draftBytes: Uint8Array, manifest: unknown, score: unknown): ManualTiming {
  const sourceHash = sha256(sourceBytes), draftHash = sha256(draftBytes);
  const failed = (reason: string): ManualTiming => ({ ready: false, reason, cues: [], sourceHash, draftHash });
  try {
    const m = manifest as { schema?: string; provenance_sha256?: Record<string, string> };
    const s = score as { schema?: string; source_hash?: string; chunks?: ScoreChunk[] };
    if (m?.schema !== 'performance-score/v1' || s?.schema !== 'manual-syllable-score/v1' ||
      m.provenance_sha256?.['video/data/lyrics_timing.json'] !== sourceHash ||
      m.provenance_sha256?.['video/data/syllable_annotations_user.json'] !== draftHash || s.source_hash !== draftHash)
      return failed('Manual score is stale or has mismatched source/draft hashes; rebuild performance_score.');
    const lines = JSON.parse(Buffer.from(sourceBytes).toString('utf8')) as Line[];
    const d = JSON.parse(Buffer.from(draftBytes).toString('utf8')) as {
      source_lyrics_sha256: string; source_lyrics: Line[];
      lines: { lyricIndex: number; syllables: TappedSyllable[] }[];
    };
    if (d.source_lyrics_sha256 !== sourceHash || JSON.stringify(d.source_lyrics) !== JSON.stringify(lines) || d.lines.length !== lines.length)
      return failed('Manual draft source identities do not match.');
    if (!Array.isArray(s.chunks) || s.chunks.length !== d.lines.reduce((n, l) => n + l.syllables.length, 0))
      return failed('Manual score does not contain every original chunk.');
    const byKey = new Map(s.chunks.map(c => [`${c.line_index}:${c.chunk_index}`, c]));
    if (byKey.size !== s.chunks.length) return failed('Duplicate manual score chunk.');
    const cues: ManualCue[] = [], confirmedOnly = lines.some(l => l.confirmed === true);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!, annotated = d.lines[i]!;
      if (annotated.lyricIndex !== i) return failed('Manual draft indices do not match.');
      for (let j = 0; j < annotated.syllables.length; j++) {
        const tap = annotated.syllables[j]!, c = byKey.get(`${i}:${j}`);
        const knownEnd = tap.t1 !== null && manualMethod(tap.endMethod) ? tap.t1 : null;
        if (!c || c.label !== tap.s || c.onset !== tap.t0 || c.known_end !== knownEnd ||
          c.original_start_method !== tap.startMethod || c.original_end !== tap.t1 || c.original_end_method !== tap.endMethod)
          return failed(`Manual score disagrees with tapped chunk ${i + 1}/${j + 1}.`);
        // a chunk without a tapped onset gets no mouth (no estimated fallback)
        if (tap.t0 === null) continue;
        if (!Number.isFinite(tap.t0) || !manualMethod(tap.startMethod) || tap.t0 < Math.max(0, line.start - 1) || tap.t0 > line.end + 1 ||
          (knownEnd !== null && (!Number.isFinite(knownEnd) || knownEnd <= tap.t0)))
          return failed(`Invalid manual timing at ${c.id}.`);
        if (line.sung === false || (confirmedOnly && line.confirmed !== true)) continue;
        const next = annotated.syllables[j + 1];
        const coveragePolicy: ManualCue['coveragePolicy'] = knownEnd !== null ? 'recorded_end' :
          next ? next.t0 === null ? 'missing_successor_no_inference' : 'next_manual_onset_animation_window' : 'coarse_line_tail_animation_window';
        const renderUntil = knownEnd ?? (next ? next.t0 ?? tap.t0 : Math.max(tap.t0, line.end));
        if (renderUntil < tap.t0 || (next?.t0 != null && knownEnd !== null && knownEnd > next.t0))
          return failed(`Conflicting manual boundaries at ${c.id}.`);
        cues.push({ id: c.id, lineIndex: i, chunkIndex: j, label: tap.s, onset: tap.t0, knownEnd, renderUntil, coveragePolicy });
      }
    }
    cues.sort((a, b) => a.onset - b.onset);
    for (let i = 0; i + 1 < cues.length; i++) {
      const a = cues[i]!, b = cues[i + 1]!;
      if (a.onset >= b.onset || (a.knownEnd !== null && a.knownEnd > b.onset)) return failed('Manual score has overlapping or duplicate known boundaries.');
      // an early onset of the next chunk cuts the previous animation window short (knownEnd stays unchanged)
      if (a.knownEnd === null) a.renderUntil = Math.min(a.renderUntil, b.onset);
    }
    return { ready: true, reason: 'Exact tapped onsets and recorded ends; unmeasured coverage/transitions are animation policy.', cues, sourceHash, draftHash };
  } catch (error) { return failed(`Manual score could not be validated: ${error instanceof Error ? error.message : String(error)}`); }
}

export interface WrittenArticulation {
  vowel: string; vowelShape: Mouth; onsetConsonants: string[]; onsetShapes: Mouth[];
  glideTo: Mouth | null; visarga: boolean;
}
// The mouth shapes a written IAST syllable implies. Six mouth drawings cannot show tongue position, aspiration or
// nasalisation: p/b/m close the lips, other consonants do not. Phonetic background:
// data/performance_score/articulatory_reference.json (Whitney, Sanskrit Grammar §§19-21, 28, 39, 47, 49, 67).
// The consonant and glide durations below are chosen for animation, not measured from the singer.
export function writtenArticulation(label: string): WrittenArticulation {
  const text = label.normalize('NFC').toLowerCase();
  const vowel = text.match(/ai|au|[aāiīuūṛṝḷḹeo]/)?.[0] ?? '';
  const start = vowel ? text.indexOf(vowel) : text.length;
  const consonants = text.slice(0, start).match(/kh|gh|ch|jh|ṭh|ḍh|th|dh|ph|bh|[kgcjṭḍtdpbmṅñṇnyrlvśṣsh]/g) ?? [];
  const vowelShape: Mouth = ['u', 'ū', 'o'].includes(vowel) ? 'o' : ['i', 'ī', 'e'].includes(vowel) ? 'e' :
    ['ṛ', 'ṝ', 'ḷ', 'ḹ'].includes(vowel) ? 'small' : vowel ? 'a' : 'small';
  return { vowel, vowelShape, onsetConsonants: consonants,
    onsetShapes: consonants.map(c => /^[pbm]/.test(c) ? 'm' : 'small'),
    glideTo: vowel === 'ai' ? 'e' : vowel === 'au' ? 'o' : null, visarga: text.includes('ḥ') };
}

export const MANUAL_ANIMATION_POLICY = Object.freeze({
  kind: 'inferred_animation_policy_not_measured_phonetic_timing',
  consonantMaxSeconds: .070, consonantMinSeconds: .024, consonantWindowFraction: .16,
  glideMaxSeconds: .110, glideWindowFraction: .32,
  unknownRelease: 'Hold vowel to next tap onset/coarse line tail; never store this as known_end.',
  visarga: 'Preserve preceding vowel lip posture; no invented M closure or timed breath release.',
});

export function manualMouthAt(t: number, timing: ManualTiming): Mouth {
  if (!timing.ready || !Number.isFinite(t)) return 'closed';
  // the cues are ordered in time across all lines
  for (let i = timing.cues.length - 1; i >= 0; i--) {
    const c = timing.cues[i]!;
    if (t < c.onset) continue;
    if (t >= c.renderUntil) return 'closed';
    const a = writtenArticulation(c.label), elapsed = t - c.onset, span = c.renderUntil - c.onset;
    const transition = a.onsetShapes.length ? Math.min(span * .35, MANUAL_ANIMATION_POLICY.consonantMaxSeconds,
      Math.max(MANUAL_ANIMATION_POLICY.consonantMinSeconds, span * MANUAL_ANIMATION_POLICY.consonantWindowFraction)) : 0;
    if (elapsed < transition) return a.onsetShapes[Math.min(a.onsetShapes.length - 1, Math.floor(elapsed / transition * a.onsetShapes.length))]!;
    if (a.glideTo && elapsed >= transition + Math.min(MANUAL_ANIMATION_POLICY.glideMaxSeconds, (span - transition) * MANUAL_ANIMATION_POLICY.glideWindowFraction)) return a.glideTo;
    // the vowel holds for the whole window (a sustained "te" stays spread)
    return a.vowelShape;
  }
  return 'closed';
}

const draftPath = path.join(DATA, 'syllable_annotations_user.json');
const scoreDirectory = path.join(DATA, 'performance_score');
const MANUAL: ManualTiming = (() => {
  try {
    return validateManualTiming(LYRIC_BYTES, readFileSync(draftPath),
      JSON.parse(readFileSync(path.join(scoreDirectory, 'manifest.json'), 'utf8')),
      JSON.parse(readFileSync(path.join(scoreDirectory, 'syllables.json'), 'utf8')));
  } catch { return { ready: false, reason: 'Manual draft/score missing; rebuild performance_score.', cues: [], sourceHash: sha256(LYRIC_BYTES), draftHash: '' }; }
})();
if (!MANUAL.ready) console.warn(`[lip-sync] ${MANUAL.reason} Mouths remain closed; no estimated replacement.`);
export function manualLipTimingStatus() { return { ...MANUAL, cues: MANUAL.cues.map(c => ({ ...c })) }; }

interface Syl { s: string; t0: number; t1: number; method?: string; confidence?: string }
interface MeasuredLine { lyric_index: number; start: number; end: number; syllables: Syl[]; silent_intervals: [number, number][] }
const MEASURED = new Map<number, MeasuredLine>();
const measuredPath = path.join(DATA, 'dj_viseme_timing.json');
if (existsSync(measuredPath)) {
  const data = JSON.parse(readFileSync(measuredPath, 'utf8')) as { lyrics_sha256: string; lines: MeasuredLine[] };
  // a lyric edit invalidates this timing instead of silently reusing old line indices
  if (data.lyrics_sha256 === createHash('sha256').update(LYRIC_BYTES).digest('hex')) for (const l of data.lines) {
    const original = LINES[l.lyric_index];
    if (!original || l.start !== original.start || l.end !== original.end || !l.syllables.length) continue;
    if (!l.syllables.every((s, i) => Number.isFinite(s.t0) && Number.isFinite(s.t1) && s.t0 >= l.start && s.t1 <= l.end && s.t0 < s.t1 && (i === 0 || s.t0 >= l.syllables[i - 1]!.t1))) continue;
    if (!l.silent_intervals.every(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && a >= l.start && a < b && b <= l.end)) continue;
    MEASURED.set(l.lyric_index, l);
  }
}

export function syllabify(iast: string): string[] {
  const out: string[] = [];
  for (const word of iast.split(/\s+/).filter((w) => /[a-zāīūṛṝḷḹṃḥṅñṭḍṇśṣ]/i.test(w))) {
    for (const part of word.split('-')) {
      // IAST ai/au each form one syllable; consume them before matching a single vowel.
      const m = part.match(/[^aeiouāīūṛṝḷḹ]*(?:ai|au|[aeiouāīūṛṝḷḹ])(?:[ṃḥ])?/gi);
      if (!m) { out.push(part); continue; }
      const used = m.join('');
      if (used.length < part.length) m[m.length - 1] += part.slice(used.length);
      out.push(...m);
    }
  }
  return out;
}

const cache = new Map<number, Syl[]>();
function syllables(i: number): Syl[] {
  if (cache.has(i)) return cache.get(i)!;
  const l = LINES[i]!;
  const measured = MEASURED.get(i);
  if (measured) return measured.syllables;
  let s: Syl[] = [];
  const tapped = l.syl && l.syl.length > 0 && l.syl.every((x, k) => x.t != null && Number.isFinite(x.t) && x.t >= l.start && x.t < l.end && (k === 0 || x.t > l.syl![k - 1]!.t!));
  if (tapped) {
    const ts = l.syl!.map((x) => x.t!);
    s = l.syl!.map((x, k) => ({ s: x.s, t0: ts[k]!, t1: k + 1 < ts.length ? ts[k + 1]! : l.end, method: 'manual_tap', confidence: 'manual' }));
  } else {
    const names = syllabify(l.iast ?? '');
    const n = Math.max(1, names.length), span = l.end - l.start;
    const onsets = names.map((_, k) => l.start + (span * k) / n);
    // each onset moves to the strongest rise of the lead vocal within its own window (windows never overlap, so the
    // order is kept)
    const radius = Math.min(0.12, span / n * 0.4);
    for (let k = 1; k < onsets.length; k++) {
      let best = onsets[k]!, bv = 0;
      for (let d = -radius; d <= radius; d += 0.02) {
        const t = onsets[k]! + d, rise = env('lead', t + 0.03) - env('lead', t - 0.03);
        if (rise > bv) { bv = rise; best = t; }
      }
      onsets[k] = best;
    }
    s = names.map((name, k) => ({ s: name, t0: onsets[k]!, t1: k + 1 < onsets.length ? onsets[k + 1]! : l.end, method: 'estimated_envelope_fallback', confidence: 'low' }));
  }
  cache.set(i, s);
  return s;
}

export function lipTimingLines() {
  return ACTIVE.map(({ line, index }) => ({ index, start: line.start, end: line.end,
    syllables: MANUAL.cues.filter(c => c.lineIndex === index).map(c => ({ s: c.label, t0: c.onset, t1: c.renderUntil,
      knownEnd: c.knownEnd, method: 'owner_manual_onset', confidence: 'tap', endPolicy: c.coveragePolicy, phoneticDuration: c.knownEnd !== null })),
    source: MANUAL.ready ? 'owner_manual_with_explicit_animation_windows' : 'stale_manual_score_no_estimates' }));
}

function vowelShape(syl: string): Mouth {
  const v = syl.toLowerCase().match(/[aeiouāīūṛṝḷḹ]/)?.[0] ?? 'a';
  if ('oōuū'.includes(v)) return 'o';
  if ('eēiīṛṝḷḹ'.includes(v)) return 'e';
  return 'a';
}

// The mouth at time t, with two refinements of the tapped score:
// (1) lead: the picture runs slightly ahead of the sound, as animators open the mouth a frame or two before the vowel
//     is heard. Each lyric line has its own lead (data/lip_lead.json, from the line's measured offset against the
//     lead vocal, about 1.5 frames ahead); LIP_LEAD (2 frames at 60 fps) applies where no line covers t.
// (2) gate: an open vowel relaxes to 'small' while the lead vocal is silent around t (stop closures such as the k of
//     muktiḥ, breaths) instead of holding an open mouth over silence (data/lead_voiced.json, voiced flag per frame).
const LIP_LEAD = 0.033;
const LEADS: [number, number, number][] = (() => { try { return JSON.parse(readFileSync(path.join(DATA, 'lip_lead.json'), 'utf8')).lines.map((r: number[]) => [r[0]!, r[1]!, r[2]!]); } catch { return []; } })();
function leadAt(t: number): number { let best: [number, number, number] | null = null; for (const r of LEADS) if (t >= r[0] - 0.15 && t < r[1] + 0.15 && (!best || r[0] > best[0])) best = r; return best ? best[2] : LIP_LEAD; }
const VOICED: { t0: number; fps: number; voiced: string } | null = (() => { try { return JSON.parse(readFileSync(path.join(DATA, 'lead_voiced.json'), 'utf8')); } catch { return null; } })();
function silentAround(t: number): boolean {
  if (!VOICED) return false; const i = Math.round((t - VOICED.t0) * VOICED.fps);
  for (let d = -1; d <= 1; d++) if (VOICED.voiced[i + d] === '1') return false;
  return true;
}
export function mouthAt(t: number): Mouth {
  const tl = t + leadAt(t), m = manualMouthAt(tl, MANUAL);
  return (m === 'a' || m === 'e' || m === 'o') && silentAround(tl) ? 'small' : m;
}

// A mouth estimated without the tapped score: syllables from the measured viseme timing, the line's own taps, or an
// even split nudged to the lead-vocal envelope. mouthAt does not use it.
export function legacyMouthAt(t: number): Mouth {
  for (let k = ACTIVE.length - 1; k >= 0; k--) {
    const { line: l, index: i } = ACTIVE[k]!;
    if (t < l.start || t >= l.end) continue;
    if (MEASURED.get(i)?.silent_intervals.some(([a, b]) => t >= a && t < b)) return 'closed';
    const sy = syllables(i);
    for (const s of sy) {
      if (t < s.t0 || t >= s.t1) continue;
      const u = (t - s.t0) / Math.max(0.08, s.t1 - s.t0);
      const bilabial = /^[mbp]/i.test(s.s);
      if (bilabial && u < 0.22) return 'm';
      if (u < 0) return 'small';
      // the vowel opens, holds, and relaxes before the next syllable
      // the two sung "te" endings keep strong lead-vocal energy through the boundary, so their vowel stays open
      const heldE = /^te[?.,!]*$/.test(s.s) && (l.start === 42.504 || l.start === 140.584);
      if (u > 0.85 && !heldE) return 'small';
      return vowelShape(s.s);
    }
    return 'small';
  }
  return 'closed';
}
