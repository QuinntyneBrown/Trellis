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

  /** Sets the sequence diagram's title; Tab commits it (the title emits on change). */
  async setTitle(title: string): Promise<void> {
    const input = byTestId(this.page, 'wizard-sequence-title');
    await input.fill(title);
    await input.press('Tab');
  }

  async addParticipant(fields: { kind?: string; name: string; color?: string; box?: string }): Promise<void> {
    if (fields.kind) {
      await byTestId(this.page, 'wizard-participant-kind').selectOption(fields.kind);
    }
    await byTestId(this.page, 'wizard-participant-name').fill(fields.name);
    if (fields.color) {
      await byTestId(this.page, 'wizard-participant-color').fill(fields.color);
    }
    if (fields.box) {
      await byTestId(this.page, 'wizard-participant-box').selectOption({ label: fields.box });
    }
    await byTestId(this.page, 'wizard-add-participant').click();
  }

  /** Adds a participant box; parent is another box's name (boxes nest). */
  async addBox(fields: { name: string; color?: string; parent?: string }): Promise<void> {
    await byTestId(this.page, 'wizard-box-name').fill(fields.name);
    if (fields.color) {
      await byTestId(this.page, 'wizard-box-color').fill(fields.color);
    }
    if (fields.parent) {
      await byTestId(this.page, 'wizard-box-parent').selectOption({ label: fields.parent });
    }
    await byTestId(this.page, 'wizard-add-box').click();
  }

  async addMessage(fields: { from: string; to: string; arrow?: string; label?: string }): Promise<void> {
    await byTestId(this.page, 'wizard-message-from').selectOption(fields.from);
    await byTestId(this.page, 'wizard-message-to').selectOption(fields.to);
    if (fields.arrow) {
      await byTestId(this.page, 'wizard-message-arrow').selectOption(fields.arrow);
    }
    if (fields.label !== undefined) {
      await byTestId(this.page, 'wizard-message-label').fill(fields.label);
    }
    await byTestId(this.page, 'wizard-add-message').click();
  }

  async setAutoLifelines(on: boolean): Promise<void> {
    await byTestId(this.page, 'wizard-auto-lifelines').setChecked(on);
  }

  /**
   * Inserts a non-message step: 'divider' | 'alt' | 'opt' | 'loop' | 'group' |
   * 'else' | 'end' | 'activate' | 'deactivate'. It lands after the selected
   * row (or at the end) and becomes the selection, so inserts chain in order.
   */
  async insertBlock(fields: { kind: string; label?: string; participant?: string }): Promise<void> {
    await byTestId(this.page, 'wizard-block-kind').selectOption(fields.kind);
    if (fields.label !== undefined) {
      await byTestId(this.page, 'wizard-block-label').fill(fields.label);
    }
    if (fields.participant) {
      await byTestId(this.page, 'wizard-block-participant').selectOption(fields.participant);
    }
    await byTestId(this.page, 'wizard-insert-block').click();
  }

  /** Every row of the sequence step list, in list order. */
  get stepRows(): Locator {
    return byTestId(this.page, 'wizard-step-row');
  }

  /** Click-selects a step row; pass modifiers to grow the selection. */
  async selectStep(row: Locator, modifiers?: Array<'ControlOrMeta' | 'Shift'>): Promise<void> {
    await row.click({ modifiers });
  }

  /** Right-clicks a step row, opening the selection's context menu. */
  async openStepContextMenu(row: Locator): Promise<void> {
    await row.click({ button: 'right' });
  }

  /** Picks a command ('reverse-replies' | 'delete') from the open context menu. */
  async chooseStepCommand(command: string): Promise<void> {
    await this.page.locator(`[data-testid="tree-context-menu-item"][data-command="${command}"]`).click();
  }

  /**
   * Drags one step row into the gap above or below another. Rows split at
   * their vertical midpoint, so the drop lands near the target's edge.
   * Playwright's dragTo drives Chromium's real drag pipeline (see the
   * documents-panel POM for the manual-DataTransfer fallback if it flakes).
   */
  async dragStepTo(source: Locator, target: Locator, edge: 'above' | 'below'): Promise<void> {
    const box = await target.boundingBox();
    if (!box) {
      throw new Error('target step row is not visible');
    }
    await source.dragTo(target, {
      targetPosition: { x: Math.min(24, box.width / 2), y: edge === 'above' ? 2 : box.height - 2 },
    });
  }

  /** The names listed in the running "added" list, in add order. */
  async addedNames(): Promise<string[]> {
    return this.addedList.locator('.wizard-panel__added-name').allInnerTexts();
  }
}
