import { fuzzyMatch, toHighlightSegments } from './fuzzy-match';

/**
 * Pins the Quick Open matcher. The scoring constants (MATCH 1, CONSECUTIVE 5,
 * WORD_START 10, PREFIX 8) are asserted through observable ordering, not
 * repeated as literals, so the tests survive tuning as long as the ordering
 * intents hold.
 */
describe('fuzzyMatch', () => {
  it('matches any subsequence and rejects anything else', () => {
    expect(fuzzyMatch('wapp', 'Web Application')).not.toBeNull();
    expect(fuzzyMatch('xyz', 'Web Application')).toBeNull();
    // Right letters, wrong order: not a subsequence.
    expect(fuzzyMatch('ppaw', 'Web Application')).toBeNull();
  });

  it('is case-insensitive both ways', () => {
    expect(fuzzyMatch('WEB', 'web application')).not.toBeNull();
    expect(fuzzyMatch('web', 'WEB APPLICATION')).not.toBeNull();
  });

  it('matches everything with score 0 for an empty query', () => {
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, indices: [] });
  });

  it('rejects a query longer than its target', () => {
    expect(fuzzyMatch('longer', 'short')).toBeNull();
  });

  it('finds the contiguous word, not the greedy-leftmost scatter', () => {
    // Greedy would lock onto the 'c' and 'a' of "cta" and highlight garbage
    // across both words; the whole point of the DP is that it does not.
    expect(fuzzyMatch('cat', 'cta cat')!.indices).toEqual([4, 5, 6]);
  });

  it('prefers word starts: initials beat mid-word letters', () => {
    // 'wa' in "Web Application": both letters open a word.
    expect(fuzzyMatch('wa', 'Web Application')!.indices).toEqual([0, 4]);
  });

  it('treats each separator and camelCase humps as word starts', () => {
    for (const target of ['a b', 'a-b', 'a_b', 'a.b', 'a/b', 'a\\b']) {
      const separated = fuzzyMatch('b', target)!;
      const midWord = fuzzyMatch('b', 'ab')!;
      expect(separated.score).toBeGreaterThan(midWord.score);
    }
    expect(fuzzyMatch('d', 'orderDb')!.score).toBeGreaterThan(fuzzyMatch('d', 'orderd')!.score);
  });

  it('ranks a prefix match above a later word-start match', () => {
    const prefix = fuzzyMatch('doc', 'doc-x')!;
    const wordStart = fuzzyMatch('doc', 'my doc')!;
    expect(prefix.score).toBeGreaterThan(wordStart.score);
  });

  it('ranks contiguous runs above scattered matches', () => {
    const contiguous = fuzzyMatch('ord', 'order')!;
    const scattered = fuzzyMatch('ord', 'o r d')!;
    // Three word starts (10 each) still lose to prefix + contiguity.
    expect(contiguous.score).toBeGreaterThan(scattered.score);
  });

  it('returns ascending, in-bounds indices, one per query character', () => {
    const result = fuzzyMatch('odb', 'Order DB')!;
    expect(result.indices.length).toBe(3);
    for (let i = 0; i < result.indices.length; i++) {
      expect(result.indices[i]).toBeGreaterThanOrEqual(0);
      expect(result.indices[i]).toBeLessThan('Order DB'.length);
      if (i > 0) {
        expect(result.indices[i]).toBeGreaterThan(result.indices[i - 1]);
      }
    }
  });

  it('is deterministic: the same input always yields the same alignment', () => {
    const a = fuzzyMatch('aa', 'aaaa')!;
    const b = fuzzyMatch('aa', 'aaaa')!;
    expect(a).toEqual(b);
    // A contiguous pair; leftmost of the equal-scoring runs.
    expect(a.indices).toEqual([0, 1]);
  });
});

describe('toHighlightSegments', () => {
  it('round-trips the text and flags exactly the matched runs', () => {
    const segments = toHighlightSegments('Web Application', [0, 4, 5]);

    expect(segments.map((s) => s.text).join('')).toBe('Web Application');
    expect(segments).toEqual([
      { text: 'W', hit: true },
      { text: 'eb ', hit: false },
      { text: 'Ap', hit: true },
      { text: 'plication', hit: false },
    ]);
  });

  it('merges adjacent matched indices into one segment', () => {
    expect(toHighlightSegments('abc', [0, 1, 2])).toEqual([{ text: 'abc', hit: true }]);
  });

  it('handles no matches and empty text', () => {
    expect(toHighlightSegments('abc', [])).toEqual([{ text: 'abc', hit: false }]);
    expect(toHighlightSegments('', [])).toEqual([]);
  });
});
