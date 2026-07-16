import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject, signal } from '@angular/core';

import { HubConnectionState } from '../../../core/models/hub-connection-state.model';
import { ConnectionStatusComponent } from '../../../shared/components/connection-status/connection-status.component';
import { RailButtonComponent } from '../../../shared/components/rail-button/rail-button.component';

/**
 * Presentational activity rail: the vscode.dev-style application (hamburger)
 * menu at the top, the Explorer, Templates and Documents panel toggles, and
 * the connection status indicator. Emits events up rather than owning
 * document/document-hub state itself.
 *
 * The hamburger opens a flyout to the rail's right listing the app menus
 * (File / Edit / View / Help), exactly like vscode.dev's compact title-bar
 * mode. Only File has real commands today -- its submenu (expanded on hover
 * or click) carries New / Save / Upload; Edit, View and Help render with
 * chevrons but are inert placeholders, as they were in the old title-bar
 * menu row. The menu dismisses on item activation, outside click, or
 * Escape, returning focus to the hamburger per the design-system rule.
 */
@Component({
  selector: 'app-editor-toolbar',
  standalone: true,
  imports: [ConnectionStatusComponent, RailButtonComponent],
  templateUrl: './editor-toolbar.component.html',
  styleUrl: './editor-toolbar.component.scss',
})
export class EditorToolbarComponent {
  @Input() connectionState: HubConnectionState = 'disconnected';
  /** Gates the Explorer rail button entirely (hidden, not disabled) in browsers without the File System Access API. */
  @Input() explorerSupported = false;
  /** Which (if any) side panel is currently active -- drives the [active] state of the four panel-toggle rail buttons. */
  @Input() activeSidePanel: 'explorer' | 'documents' | 'templates' | 'explain' | null = null;

  @Output() readonly explorerPanelToggle = new EventEmitter<void>();
  @Output() readonly documentsPanelToggle = new EventEmitter<void>();
  @Output() readonly templatesPanelToggle = new EventEmitter<void>();
  @Output() readonly explainPanelToggle = new EventEmitter<void>();
  /** Fired by File > New (Alt+N lives with the parent's keydown handler). */
  @Output() readonly newDocument = new EventEmitter<void>();
  /** Fired by File > Save. */
  @Output() readonly save = new EventEmitter<void>();
  /** Fired by File > Upload; the parent owns the hidden file input this opens. */
  @Output() readonly uploadRequested = new EventEmitter<void>();

  /** Whether the hamburger's application menu is open. */
  readonly menuOpen = signal(false);
  /** Which top-level entry's submenu is expanded -- only File has one today. */
  readonly openSubmenu = signal<'file' | null>(null);

  private readonly elementRef = inject(ElementRef) as ElementRef<HTMLElement>;

  onHamburgerClicked(): void {
    this.openSubmenu.set(null);
    this.menuOpen.update((open) => !open);
  }

  /**
   * Opens (never toggles) the File submenu: with hover-to-open also active,
   * the click that follows the hover's mouseenter must not immediately
   * collapse the submenu again.
   */
  onFileEntryClicked(): void {
    this.openSubmenu.set('file');
  }

  onFileEntryHovered(): void {
    this.openSubmenu.set('file');
  }

  /** Hovering an inert entry (Edit/View/Help) collapses the File submenu, the vscode.dev menubar idiom. */
  onInertEntryHovered(): void {
    this.openSubmenu.set(null);
  }

  onNewClicked(): void {
    this.closeMenu(true);
    this.newDocument.emit();
  }

  onSaveClicked(): void {
    this.closeMenu(true);
    this.save.emit();
  }

  onUploadClicked(): void {
    this.closeMenu(true);
    this.uploadRequested.emit();
  }

  /** Any click outside the rail's own DOM closes the open menu -- the standard menu idiom. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.menuOpen() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeMenu(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen()) {
      this.closeMenu(true);
    }
  }

  /**
   * Closes menu and submenu together. Keyboard dismissal and item
   * activation return focus to the hamburger trigger (the design-system
   * menus rule); outside clicks leave focus where the user clicked.
   */
  private closeMenu(returnFocusToTrigger: boolean): void {
    this.menuOpen.set(false);
    this.openSubmenu.set(null);
    if (returnFocusToTrigger) {
      this.elementRef.nativeElement.querySelector<HTMLButtonElement>('[data-testid="rail-hamburger"]')?.focus();
    }
  }
}
