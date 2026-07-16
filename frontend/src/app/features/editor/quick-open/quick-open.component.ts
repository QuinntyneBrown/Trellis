import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { Folder } from '../../../core/models/folder.model';
import { DocumentsService } from '../../../core/services/documents.service';
import { FoldersService } from '../../../core/services/folders.service';
import { buildFolderPath } from './folder-path';
import { fuzzyMatch, toHighlightSegments } from './fuzzy-match';
import { QuickOpenCommand, QuickOpenDismissedEvent, QuickOpenRow } from './quick-open.model';

/**
 * Results past this point are noise: the dropdown shows ~12 rows and the
 * query narrows the rest away. Capping also bounds per-keystroke DOM churn
 * without any virtual-scroll machinery.
 */
const MAX_RESULTS = 50;

/**
 * The command center's Quick Open -- vscode.dev's idiom. At rest it is the
 * familiar pill naming the open document; activated (pill click, or the
 * page's Ctrl+P) it becomes a combobox: a text input over a results dropdown
 * anchored beneath. Plain text fuzzy-searches the saved documents; a '>'
 * prefix switches to the command list the editor page provides.
 *
 * The open/closed choice is OWNED BY THE PAGE (the [open] input, like the
 * panels' [open]): the pill click only *requests* opening, and every way out
 * -- Escape, outside press, Tab, or a selection being acted on -- ends with
 * the page flipping the input back off.
 *
 * Focus stays in the input the whole time it is open (combobox pattern:
 * aria-activedescendant marks the active row; rows never take DOM focus).
 * That is both the correct ARIA and it keeps per-keystroke work down to one
 * computed() -- there is no roving-focus juggling to loop with change
 * detection. The results binding is a single computed for the same reason
 * the tree context menu demands stable refs: a getter minting a fresh array
 * every CD pass re-enters ngOnChanges forever.
 */
@Component({
  selector: 'app-quick-open',
  standalone: true,
  templateUrl: './quick-open.component.html',
  styleUrl: './quick-open.component.scss',
})
export class QuickOpenComponent implements OnChanges {
  /** Names the closed pill; the page's document name. */
  @Input({ required: true }) documentName = '';
  /** Page-owned open state; this component only requests changes to it. */
  @Input() open = false;
  /** The '>'-mode command catalog. The page owns which commands exist. */
  @Input() commands: QuickOpenCommand[] = [];

  /** The pill was clicked; the page should open the search. */
  @Output() readonly openRequested = new EventEmitter<void>();
  /** Escape / outside press / Tab; the page should close the search. */
  @Output() readonly dismissed = new EventEmitter<QuickOpenDismissedEvent>();
  @Output() readonly documentSelected = new EventEmitter<DocumentSummary>();
  @Output() readonly commandSelected = new EventEmitter<string>();

  private readonly documentsService = inject(DocumentsService);
  private readonly foldersService = inject(FoldersService);
  private readonly host = inject(ElementRef<HTMLElement>);

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('pillButton') private pillButton?: ElementRef<HTMLButtonElement>;

  readonly query = signal('');
  readonly activeIndex = signal(0);
  readonly loadFailed = signal(false);
  private readonly documents = signal<readonly DocumentSummary[]>([]);
  private readonly folders = signal<readonly Folder[]>([]);
  /**
   * ngOnChanges mirror of the `commands` input: a computed() does not track
   * decorator-@Input mutation, so reading the input directly inside
   * `results` would silently never recompute.
   */
  private readonly commandsSignal = signal<readonly QuickOpenCommand[]>([]);

  /** Ignores a slow list response that lands after the search was reopened. */
  private fetchSequence = 0;
  /** Set by Escape so the close transition knows to put focus back on the pill. */
  private restoreFocusOnClose = false;

  get windowTitle(): string {
    return `${this.documentName} — Trellis`;
  }

  readonly mode = computed<'documents' | 'commands'>(() =>
    this.query().startsWith('>') ? 'commands' : 'documents',
  );

  /**
   * The one and only list binding: render-ready rows, precomputed segments
   * and folder paths included, so the template carries no logic.
   */
  readonly results = computed<QuickOpenRow[]>(() => {
    if (this.mode() === 'commands') {
      const term = this.query().slice(1).trim();
      return this.commandsSignal()
        .map((command) => ({ command, match: fuzzyMatch(term, command.label) }))
        .filter((entry) => entry.match !== null)
        // Stable sort: score desc, authoring order breaks ties.
        .sort((a, b) => b.match!.score - a.match!.score)
        .slice(0, MAX_RESULTS)
        .map(({ command, match }) => ({
          type: 'command' as const,
          command,
          segments: toHighlightSegments(command.label, match!.indices),
        }));
    }

    const term = this.query().trim();
    const foldersById = new Map(this.folders().map((folder) => [folder.id, folder]));
    const toRow = (document: DocumentSummary, indices: readonly number[]): QuickOpenRow => ({
      type: 'document',
      document,
      segments: toHighlightSegments(document.name, indices),
      folderPath: buildFolderPath(document.folderId, foldersById),
    });

    if (term.length === 0) {
      // No query yet: most recently updated first, the "recently opened"
      // list vscode shows before you type.
      return [...this.documents()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, MAX_RESULTS)
        .map((document) => toRow(document, []));
    }

    return this.documents()
      .map((document) => ({ document, match: fuzzyMatch(term, document.name) }))
      .filter((entry) => entry.match !== null)
      .sort(
        (a, b) =>
          b.match!.score - a.match!.score ||
          b.document.updatedAt.localeCompare(a.document.updatedAt) ||
          a.document.name.localeCompare(b.document.name) ||
          a.document.id.localeCompare(b.document.id),
      )
      .slice(0, MAX_RESULTS)
      .map(({ document, match }) => toRow(document, match!.indices));
  });

  readonly emptyMessage = computed<string | null>(() => {
    if (this.results().length > 0) {
      return null;
    }
    if (this.mode() === 'commands') {
      return 'No matching commands';
    }
    return this.loadFailed() ? 'Could not load documents.' : 'No matching documents';
  });

  /**
   * Reacts ONLY to the [open] boolean flipping and to the (session-constant)
   * commands ref arriving -- never to data or results changes. That
   * discipline is what keeps this hook out of the ngOnChanges/queueMicrotask
   * feedback loop the tree context menu documents.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['commands']) {
      this.commandsSignal.set(this.commands);
    }
    if (changes['open']?.currentValue === true) {
      this.query.set('');
      this.activeIndex.set(0);
      this.fetchLists();
      // The @if (open) content renders during this change-detection pass;
      // the microtask lands just after, when the input exists.
      queueMicrotask(() => this.searchInput?.nativeElement.focus());
    } else if (changes['open'] && changes['open'].currentValue === false && this.restoreFocusOnClose) {
      this.restoreFocusOnClose = false;
      queueMicrotask(() => this.pillButton?.nativeElement.focus());
    }
  }

  onPillClicked(): void {
    this.openRequested.emit();
  }

  onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  onInputKeydown(event: KeyboardEvent): void {
    const count = this.results().length;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (count === 0) {
          return;
        }
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex.set((this.activeIndex() + step + count) % count);
        this.scrollActiveRowIntoView();
        return;
      }
      case 'Enter': {
        event.preventDefault();
        this.activateRow(this.results()[this.activeIndex()]);
        return;
      }
      case 'Escape': {
        // stopPropagation so the toolbar's document-level Escape (which
        // closes the hamburger menu) never sees a Quick Open dismissal.
        event.preventDefault();
        event.stopPropagation();
        this.restoreFocusOnClose = true;
        this.dismissed.emit({ restoreFocus: true });
        return;
      }
      case 'Tab': {
        // Focus is leaving deliberately; close without any focus juggling.
        this.dismissed.emit({ restoreFocus: false });
        return;
      }
      default:
        return;
    }
  }

  /**
   * mousedown (not click), matching the tree context menu: dismissal happens
   * on press. Rows preventDefault their own mousedown, so pressing one never
   * blurs the input or reads as "outside".
   */
  @HostListener('document:mousedown', ['$event'])
  onDocumentMousedown(event: MouseEvent): void {
    if (!this.open) {
      return;
    }
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.dismissed.emit({ restoreFocus: false });
    }
  }

  onRowMousedown(event: MouseEvent): void {
    event.preventDefault();
  }

  onRowClicked(row: QuickOpenRow): void {
    this.activateRow(row);
  }

  onRowMouseenter(index: number): void {
    this.activeIndex.set(index);
  }

  /**
   * Selection deliberately does NOT restore focus to the pill: the chosen
   * action takes focus over itself (a dialog opens, the editor loads a
   * document), and a pill refocus would race whatever it focuses.
   */
  private activateRow(row: QuickOpenRow | undefined): void {
    if (!row) {
      return;
    }
    if (row.type === 'document') {
      this.documentSelected.emit(row.document);
    } else {
      this.commandSelected.emit(row.command.id);
    }
  }

  private fetchLists(): void {
    const token = ++this.fetchSequence;
    this.loadFailed.set(false);

    forkJoin([
      this.documentsService.list(),
      // A folders failure only costs the breadcrumb column; don't let it
      // take the whole picker down with it.
      this.foldersService.list().pipe(catchError(() => of([] as Folder[]))),
    ]).subscribe({
      next: ([documents, folders]) => {
        if (token !== this.fetchSequence) {
          return;
        }
        this.documents.set(documents);
        this.folders.set(folders);
      },
      error: () => {
        if (token !== this.fetchSequence) {
          return;
        }
        this.documents.set([]);
        this.folders.set([]);
        this.loadFailed.set(true);
      },
    });
  }

  /** Called only from the arrow-key handlers -- never on data changes. */
  private scrollActiveRowIntoView(): void {
    queueMicrotask(() => {
      this.host.nativeElement
        .querySelector(`#quick-open-option-${this.activeIndex()}`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  }
}
