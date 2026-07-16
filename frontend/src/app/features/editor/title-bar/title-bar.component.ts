import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * VS Code-style top chrome / title bar (35px), adopted from the approved
 * design in docs/mocks: a command-center pill showing the open document's
 * name in the middle, layout toggles and window controls on the right.
 *
 * The app menus (File/Edit/View/Help) live behind the activity rail's
 * hamburger button (EditorToolbarComponent), exactly like vscode.dev --
 * the left region here is an empty spacer that keeps the command center
 * centered. The command center, the panel/secondary-sidebar toggles, and
 * the window controls remain static chrome. The primary-sidebar toggle
 * mirrors and toggles the side panel via the `sidePanelOpen` input /
 * `sidebarToggle` output pair -- the parent EditorPageComponent owns which
 * panel actually opens.
 */
@Component({
  selector: 'app-title-bar',
  standalone: true,
  imports: [],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent {
  @Input({ required: true }) documentName = '';
  /** Whether either side panel (Explorer or Documents) is currently open -- drives the sidebar toggle's filled state. */
  @Input() sidePanelOpen = false;
  /** Parent-owned transient flag: swaps the copy glyph to a checkmark while the "copied!" confirmation is showing. */
  @Input() copied = false;

  /** Fired by the primary-sidebar layout toggle; the parent decides which panel to open/close. */
  @Output() readonly sidebarToggle = new EventEmitter<void>();
  /** Fired by the copy-document-contents button; the parent owns the clipboard write (it holds the source text). */
  @Output() readonly copyContents = new EventEmitter<void>();

  get windowTitle(): string {
    return `${this.documentName} — Trellis`;
  }
}
