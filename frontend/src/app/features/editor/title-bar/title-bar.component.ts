import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject, signal } from '@angular/core';

/**
 * VS Code-style top chrome / title bar (35px), adopted from the approved
 * design in docs/mocks: app menu on the left, a command-center pill showing
 * the open document's name in the middle, layout toggles and window
 * controls on the right.
 *
 * The FILE menu is functional (D-012): a dropdown with the New / Save /
 * Upload commands (moved off the rail), closing on item click, outside
 * click, or Escape. The other menus (Edit/View/Help), the command center,
 * the panel/secondary-sidebar toggles, and the window controls remain
 * static chrome. The primary-sidebar toggle mirrors and toggles the side
 * panel via the `sidePanelOpen` input / `sidebarToggle` output pair -- the
 * parent EditorPageComponent owns which panel actually opens, and likewise
 * owns what New/Save/Upload actually do.
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
  /** Fired by File > New (and Alt+N via the parent's keydown handler). */
  @Output() readonly newDocument = new EventEmitter<void>();
  /** Fired by File > Save. */
  @Output() readonly save = new EventEmitter<void>();
  /** Fired by File > Upload; the parent owns the hidden file input this opens. */
  @Output() readonly uploadRequested = new EventEmitter<void>();
  /** Fired by the copy-document-contents button; the parent owns the clipboard write (it holds the source text). */
  @Output() readonly copyContents = new EventEmitter<void>();

  /** Which menu is currently open -- only File is functional today. */
  readonly openMenu = signal<'file' | null>(null);

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  get windowTitle(): string {
    return `${this.documentName} — Trellis`;
  }

  onFileMenuClicked(): void {
    this.openMenu.update((current) => (current === 'file' ? null : 'file'));
  }

  onNewClicked(): void {
    this.openMenu.set(null);
    this.newDocument.emit();
  }

  onSaveClicked(): void {
    this.openMenu.set(null);
    this.save.emit();
  }

  onUploadClicked(): void {
    this.openMenu.set(null);
    this.uploadRequested.emit();
  }

  /** Any click outside the title bar's own DOM closes the open menu -- the standard menu idiom. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.openMenu() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.openMenu.set(null);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.openMenu.set(null);
  }
}
