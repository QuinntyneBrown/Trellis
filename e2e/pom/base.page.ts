import { Locator, Page, expect } from '@playwright/test';

/**
 * Locates an element (optionally scoped within a Locator) by its exact
 * data-testid attribute, per the shared data-testid contract (e.g.
 * byTestId(page, 'editor-page') queries [data-testid="editor-page"]).
 *
 * Exported standalone so both page objects and the smaller
 * component-level objects under pom/components share one implementation.
 */
export function byTestId(root: Page | Locator, id: string): Locator {
  return root.locator(`[data-testid="${id}"]`);
}

/**
 * Shared behavior for all page-level objects.
 *
 * Trellis has essentially one primary route (the editor) with several
 * modal/overlay interaction surfaces layered on top of it, so most page
 * objects composing these helpers are component-scoped rather than
 * separate routed "pages". BasePage exists purely to give every page
 * object a consistent way to find elements by the app's data-testid
 * contract and to know when the app has finished establishing its
 * real-time connection.
 */
export abstract class BasePage {
  protected readonly page: Page;

  protected constructor(page: Page) {
    this.page = page;
  }

  /**
   * Locates an element by its exact data-testid attribute, per the
   * shared data-testid contract (e.g. byTestId('editor-page') queries
   * [data-testid="editor-page"]).
   */
  byTestId(id: string): Locator {
    return byTestId(this.page, id);
  }

  /**
   * Waits until the connection-status indicator reports 'connected'.
   * Uses a generous timeout because the SignalR negotiate/connect
   * handshake (and, on cold start, backend startup) can take a while.
   */
  async waitForAppReady(): Promise<void> {
    await expect(this.byTestId('connection-status')).toHaveText('connected', {
      timeout: 30_000,
    });
  }
}
