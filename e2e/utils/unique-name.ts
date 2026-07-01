import { TestInfo } from '@playwright/test';

/**
 * Builds a document name that is unique to this specific test run.
 *
 * The backend for this suite is a single shared long-lived process with
 * one shared SQLite file for the whole run, so any test that creates a
 * named document must avoid colliding with documents created by other
 * tests/workers running concurrently (and with leftovers from previous
 * local runs). Incorporating the worker index, the test title, and a
 * timestamp keeps names unique both across parallel workers within one
 * run and across repeated runs against a reused dev server.
 */
export function uniqueDocumentName(testInfo: TestInfo, label = 'doc'): string {
  const safeTitle = testInfo.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
  return `e2e-${label}-w${testInfo.workerIndex}-${safeTitle}-${Date.now()}`;
}
