/**
 * Normalizes CRLF to LF.
 *
 * Monaco's model chooses its own end-of-line sequence for lines it inserts
 * itself - on Windows this defaults to CRLF - independently of whatever byte
 * sequence a test's source string uses. This matters specifically for text
 * entered through simulated keyboard input (`page.keyboard.type`, which
 * triggers Monaco's own "insert new line" command for every embedded '\n',
 * rather than literally inserting a '\n' byte): the resulting buffer (and
 * anything later saved to/reloaded from the backend) ends up CRLF-terminated
 * on a Windows test run even though the test's own expected-content string
 * is plain LF. Comparisons that mix "content that passed through a Monaco
 * keyboard-typed edit" with "a hardcoded LF string" must normalize both
 * sides with this helper first, or they will be flaky/failing on Windows
 * specifically. (Content that is only ever pushed into Monaco via
 * `setValue()` - e.g. templates fetched from the API - is not affected, since
 * `setValue()` preserves whatever EOL convention the source string already
 * used.)
 */
export function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, '\n');
}
