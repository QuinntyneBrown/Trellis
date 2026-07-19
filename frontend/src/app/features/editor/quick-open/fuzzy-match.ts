import { HighlightSegment } from './quick-open.model';

/**
 * The Quick Open fuzzy matcher: case-insensitive subsequence matching with
 * alignment scoring, so "wapp" finds "Web Application" and the picked
 * characters can be highlighted.
 *
 * This is a small dynamic program over alignments, not a greedy left-to-right
 * scan. Greedy misranks and mis-highlights whenever an early stray character
 * shadows the real match: for "cat" in "cta cat", greedy locks onto the 'c'
 * and 'a' of "cta" and highlights garbage across both words, while the DP
 * finds the contiguous word. Sizes here are tiny (a query against a few
 * hundred short names per keystroke), so the O(query x target) cost is noise.
 */

export interface FuzzyMatchResult {
  readonly score: number;
  /** Ascending target indices of the matched characters, for highlighting. */
  readonly indices: readonly number[];
}

/** Every matched character is worth this much before bonuses. */
const MATCH = 1;
/**
 * Matching directly after the previous matched character (a contiguous run).
 * Deliberately ABOVE both other bonuses: a run must outscore hopping across
 * word starts, and one extra run step must be able to overcome a stray
 * first character that happens to sit at the target's start -- otherwise
 * "cat" against "cta cat" highlights the 'c' of "cta" plus the "at" of
 * "cat" instead of the whole word.
 */
const CONSECUTIVE = 12;
/** Matching at a word start: index 0, after a separator, or a camelCase hump. */
const WORD_START = 10;
/** Extra when the first query character sits at the very start of the target. */
const PREFIX = 8;

const SEPARATORS = new Set([' ', '-', '_', '.', '/', '\\']);

function isWordStart(target: string, index: number): boolean {
  if (index === 0) {
    return true;
  }
  const previous = target[index - 1];
  if (SEPARATORS.has(previous)) {
    return true;
  }
  const current = target[index];
  return (
    current === current.toUpperCase() &&
    current !== current.toLowerCase() &&
    previous === previous.toLowerCase() &&
    previous !== previous.toUpperCase()
  );
}

/**
 * Returns the best-scoring alignment of `query` as a subsequence of `target`,
 * or null when it is not a subsequence at all. An empty query matches
 * everything with score 0 (callers treat "no query" as "list everything").
 *
 * Deterministic by construction: ties prefer a contiguous run over a gapped
 * alignment (equal totals with contiguous highlights read better), and the
 * leftmost alignment otherwise, so the same input always highlights the same
 * characters.
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatchResult | null {
  if (query.length === 0) {
    return { score: 0, indices: [] };
  }
  if (query.length > target.length) {
    return null;
  }

  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const NO = Number.NEGATIVE_INFINITY;

  // score[i][j]: best total with query char i matched at target index j.
  // parent[i][j]: the j' chosen for query char i-1 (smallest on ties).
  const score: number[][] = [];
  const parent: number[][] = [];

  for (let i = 0; i < q.length; i++) {
    score.push(new Array<number>(t.length).fill(NO));
    parent.push(new Array<number>(t.length).fill(-1));

    // Running best over score[i-1][0..j-2] -- any-gap predecessors; the
    // adjacent predecessor j-1 is handled separately to add CONSECUTIVE.
    let bestGap = NO;
    let bestGapAt = -1;

    for (let j = i; j < t.length; j++) {
      if (i > 0 && j >= 2) {
        const candidate = score[i - 1][j - 2];
        if (candidate > bestGap) {
          bestGap = candidate;
          bestGapAt = j - 2;
        }
      }
      if (q[i] !== t[j]) {
        continue;
      }

      const base = MATCH + (isWordStart(target, j) ? WORD_START : 0);
      if (i === 0) {
        score[0][j] = base + (j === 0 ? PREFIX : 0);
        continue;
      }

      const adjacent = j >= 1 ? score[i - 1][j - 1] : NO;
      const viaRun = adjacent === NO ? NO : adjacent + CONSECUTIVE;
      // Strict > keeps ties on the leftmost (gap) predecessor... except a
      // tie between a run and a gap should prefer the run: equal totals with
      // contiguous highlights read better. Compare run first.
      if (viaRun >= bestGap && viaRun !== NO) {
        score[i][j] = base + viaRun;
        parent[i][j] = j - 1;
      } else if (bestGap !== NO) {
        score[i][j] = base + bestGap;
        parent[i][j] = bestGapAt;
      }
    }
  }

  const last = score[q.length - 1];
  let bestScore = NO;
  let bestEnd = -1;
  for (let j = 0; j < t.length; j++) {
    if (last[j] > bestScore) {
      bestScore = last[j];
      bestEnd = j;
    }
  }
  if (bestEnd === -1) {
    return null;
  }

  const indices = new Array<number>(q.length);
  let at = bestEnd;
  for (let i = q.length - 1; i >= 0; i--) {
    indices[i] = at;
    at = parent[i][at];
  }
  return { score: bestScore, indices };
}

/**
 * Marks every case-insensitive occurrence of `term` within `text`, returning
 * the runs for the template. Used for content snippets, where the server has
 * already located the match and the client only needs to emphasize the literal
 * term -- a plain substring highlight, not the fuzzy subsequence one names use.
 * An empty term (or no occurrence) yields a single unmarked run.
 */
export function highlightTerm(text: string, term: string): HighlightSegment[] {
  if (term.length === 0) {
    return text.length === 0 ? [] : [{ text, hit: false }];
  }

  const haystack = text.toLowerCase();
  const needle = term.toLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
    if (at > cursor) {
      segments.push({ text: text.slice(cursor, at), hit: false });
    }
    segments.push({ text: text.slice(at, at + needle.length), hit: true });
    cursor = at + needle.length;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), hit: false });
  }

  return segments;
}

/**
 * Splits `text` into runs for the template, marking the runs the match hit --
 * precomputed here so the row rendering needs no logic and no innerHTML.
 */
export function toHighlightSegments(text: string, indices: readonly number[]): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  const hit = new Set(indices);
  let start = 0;

  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || hit.has(i) !== hit.has(start)) {
      segments.push({ text: text.slice(start, i), hit: hit.has(start) });
      start = i;
    }
  }
  return segments;
}
