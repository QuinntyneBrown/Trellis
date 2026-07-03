import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * VS Code-style top chrome / title bar (35px), adopted from the approved
 * design in docs/mocks: app menu on the left, a command-center pill showing
 * the open document's name in the middle, layout toggles and window
 * controls on the right.
 *
 * First pass is deliberately chrome-first (matching the mock's own note):
 * the menus, command center, panel/secondary-sidebar toggles, and window
 * controls are static, non-wired affordances. The one functional control is
 * the primary-sidebar toggle, which mirrors and toggles the side panel via
 * the `sidePanelOpen` input / `sidebarToggle` output pair -- the parent
 * EditorPageComponent owns which panel actually opens.
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

  /** Fired by the primary-sidebar layout toggle; the parent decides which panel to open/close. */
  @Output() readonly sidebarToggle = new EventEmitter<void>();

  get windowTitle(): string {
    return `${this.documentName} — Trellis`;
  }
}
