import { Locator, Page, expect } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the Diagram Wizard side panel: toggle at
 * [data-testid="wizard-panel-toggle"] (owned by the toolbar), panel root at
 * [data-testid="wizard-panel"], and a body whose contents change per step --
 * option cards on the first two steps, then a form plus a running list of what
 * has been added, over a pinned Back/Next footer.
 *
 * The panel element itself is always mounted inside the editor page (its host
 * is display-toggled), so visibility assertions -- not existence assertions --
 * are the meaningful ones here.
 */
export class WizardPanelComponent {
  readonly root: Locator;
  readonly toggle: Locator;
  readonly caption: Locator;
  readonly backButton: Locator;
  readonly nextButton: Locator;
  readonly restartButton: Locator;
  readonly closeButton: Locator;
  readonly summary: Locator;
  readonly addedList: Locator;
  readonly addedEmpty: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.root = byTestId(page, 'wizard-panel');
    this.toggle = byTestId(page, 'wizard-panel-toggle');
    this.caption = byTestId(page, 'wizard-progress-caption');
    this.backButton = byTestId(page, 'wizard-back');
    this.nextButton = byTestId(page, 'wizard-next');
    this.restartButton = byTestId(page, 'wizard-restart');
    this.closeButton = byTestId(page, 'wizard-close');
    this.summary = byTestId(page, 'wizard-summary');
    this.addedList = byTestId(page, 'wizard-added-list');
    this.addedEmpty = byTestId(page, 'wizard-added-empty');
  }

  /** Opens the Diagram Wizard panel via its rail toggle. */
  async open(): Promise<void> {
    await this.toggle.click();
    await expect(this.root).toBeVisible();
  }

  /** Picks one of the option cards (a track, or a C4 view). */
  async choose(option: string): Promise<void> {
    await byTestId(this.page, `wizard-option-${option}`).click();
  }

  async next(): Promise<void> {
    await this.nextButton.click();
  }

  async addElement(fields: {
    kind?: string;
    name: string;
    technology?: string;
    description?: string;
    boundary?: string;
  }): Promise<void> {
    if (fields.kind) {
      await byTestId(this.page, 'wizard-element-kind').selectOption(fields.kind);
    }
    await byTestId(this.page, 'wizard-element-name').fill(fields.name);
    if (fields.technology) {
      await byTestId(this.page, 'wizard-element-technology').fill(fields.technology);
    }
    if (fields.description) {
      await byTestId(this.page, 'wizard-element-description').fill(fields.description);
    }
    if (fields.boundary) {
      await byTestId(this.page, 'wizard-element-boundary').selectOption(fields.boundary);
    }
    await byTestId(this.page, 'wizard-add-element').click();
  }

  async addRelationship(fields: { from: string; to: string; label: string; technology?: string }): Promise<void> {
    await byTestId(this.page, 'wizard-rel-from').selectOption(fields.from);
    await byTestId(this.page, 'wizard-rel-to').selectOption(fields.to);
    await byTestId(this.page, 'wizard-rel-label').fill(fields.label);
    if (fields.technology) {
      await byTestId(this.page, 'wizard-rel-technology').fill(fields.technology);
    }
    await byTestId(this.page, 'wizard-add-relationship').click();
  }

  async addParticipant(fields: { kind?: string; name: string }): Promise<void> {
    if (fields.kind) {
      await byTestId(this.page, 'wizard-participant-kind').selectOption(fields.kind);
    }
    await byTestId(this.page, 'wizard-participant-name').fill(fields.name);
    await byTestId(this.page, 'wizard-add-participant').click();
  }

  async addMessage(fields: { from: string; to: string; arrow?: string; label: string }): Promise<void> {
    await byTestId(this.page, 'wizard-message-from').selectOption(fields.from);
    await byTestId(this.page, 'wizard-message-to').selectOption(fields.to);
    if (fields.arrow) {
      await byTestId(this.page, 'wizard-message-arrow').selectOption(fields.arrow);
    }
    await byTestId(this.page, 'wizard-message-label').fill(fields.label);
    await byTestId(this.page, 'wizard-add-message').click();
  }

  /** The names listed in the running "added" list, in add order. */
  async addedNames(): Promise<string[]> {
    return this.addedList.locator('.wizard-panel__added-name').allInnerTexts();
  }
}
