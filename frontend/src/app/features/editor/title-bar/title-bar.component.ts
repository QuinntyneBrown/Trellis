import { Component, EventEmitter, Input, Output } from '@angular/core';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { QuickOpenComponent } from '../quick-open/quick-open.component';
import { QuickOpenCommand, QuickOpenDismissedEvent } from '../quick-open/quick-open.model';

/**
 * VS Code-style top chrome / title bar (35px), adopted from the approved
 * design in docs/mocks: the Quick Open command center in the middle (at rest
 * a pill naming the open document; activated, a search input -- see
 * QuickOpenComponent), layout toggles and window controls on the right.
 *
 * The app menus (File/Edit/View/Help) live behind the activity rail's
 * hamburger button (EditorToolbarComponent), exactly like vscode.dev --
 * the left region here is an empty spacer that keeps the command center
 * centered. The panel/secondary-sidebar toggles and the window controls
 * remain static chrome. The primary-sidebar toggle mirrors and toggles the
 * side panel via the `sidePanelOpen` input / `sidebarToggle` output pair.
 *
 * This component stays purely presentational: the Quick Open inputs and
 * outputs pass straight through to and from EditorPageComponent, which owns
 * the open state, the command catalog, and what a selection does -- the same
 * split every panel already uses.
 */
@Component({
  selector: 'app-title-bar',
  standalone: true,
  imports: [QuickOpenComponent],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent {
  @Input({ required: true }) documentName = '';
  /** Whether either side panel (Explorer or Documents) is currently open -- drives the sidebar toggle's filled state. */
  @Input() sidePanelOpen = false;
  /** Parent-owned transient flag: swaps the copy glyph to a checkmark while the "copied!" confirmation is showing. */
  @Input() copied = false;
  /** Page-owned Quick Open state, passed through to the command center. */
  @Input() quickOpenOpen = false;
  /** The page's '>'-mode command catalog, passed through. */
  @Input() quickOpenCommands: QuickOpenCommand[] = [];

  /** Fired by the primary-sidebar layout toggle; the parent decides which panel to open/close. */
  @Output() readonly sidebarToggle = new EventEmitter<void>();
  /** Fired by the copy-document-contents button; the parent owns the clipboard write (it holds the source text). */
  @Output() readonly copyContents = new EventEmitter<void>();
  /** Quick Open passthroughs -- the page owns every decision. */
  @Output() readonly quickOpenRequested = new EventEmitter<void>();
  @Output() readonly quickOpenDismissed = new EventEmitter<QuickOpenDismissedEvent>();
  @Output() readonly quickOpenDocumentSelected = new EventEmitter<DocumentSummary>();
  @Output() readonly quickOpenCommandSelected = new EventEmitter<string>();
}
