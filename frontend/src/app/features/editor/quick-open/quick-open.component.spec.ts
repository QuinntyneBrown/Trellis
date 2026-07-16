import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { DocumentsService } from '../../../core/services/documents.service';
import { FoldersService } from '../../../core/services/folders.service';
import { QuickOpenComponent } from './quick-open.component';

describe('QuickOpenComponent', () => {
  let fixture: ComponentFixture<QuickOpenComponent>;
  let component: QuickOpenComponent;
  let documentsServiceMock: { list: jest.Mock };
  let foldersServiceMock: { list: jest.Mock };

  function doc(overrides: Partial<DocumentSummary> & Pick<DocumentSummary, 'id' | 'name'>): DocumentSummary {
    return {
      updatedAt: '2026-07-01T00:00:00Z',
      folderId: null,
      kind: 'plantuml',
      excludedFromExport: false,
      ...overrides,
    };
  }

  beforeEach(async () => {
    documentsServiceMock = { list: jest.fn().mockReturnValue(of([])) };
    foldersServiceMock = { list: jest.fn().mockReturnValue(of([])) };

    await TestBed.configureTestingModule({
      imports: [QuickOpenComponent],
      providers: [
        { provide: DocumentsService, useValue: documentsServiceMock },
        { provide: FoldersService, useValue: foldersServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuickOpenComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('documentName', 'Untitled diagram');
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function byTestId(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function rows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[data-testid="quick-open-row"]'));
  }

  /** setInput, not property assignment: the open transition lives in ngOnChanges. */
  async function openSearch(): Promise<void> {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    // The focus call is queued as a microtask on the open transition.
    await Promise.resolve();
    fixture.detectChanges();
  }

  function type(text: string): void {
    const input = byTestId('quick-open-input') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function keydown(key: string): void {
    (byTestId('quick-open-input') as HTMLInputElement).dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
  }

  describe('at rest', () => {
    it('renders the pill with the window title and requests opening on click', () => {
      const requested = jest.fn();
      component.openRequested.subscribe(requested);

      expect(byTestId('title-bar-title')!.textContent).toBe('Untitled diagram — Trellis');
      expect(byTestId('quick-open-input')).toBeNull();

      byTestId('title-bar-command-center')!.click();
      expect(requested).toHaveBeenCalledTimes(1);
    });
  });

  describe('opening', () => {
    it('fetches both lists, resets the query, and focuses the input', async () => {
      await openSearch();

      expect(documentsServiceMock.list).toHaveBeenCalledTimes(1);
      expect(foldersServiceMock.list).toHaveBeenCalledTimes(1);
      expect((byTestId('quick-open-input') as HTMLInputElement).value).toBe('');
      expect(document.activeElement).toBe(byTestId('quick-open-input'));
    });

    it('lists documents most recently updated first before anything is typed', async () => {
      documentsServiceMock.list.mockReturnValue(
        of([
          doc({ id: '1', name: 'Older', updatedAt: '2026-07-01T00:00:00Z' }),
          doc({ id: '2', name: 'Newest', updatedAt: '2026-07-10T00:00:00Z' }),
        ]),
      );

      await openSearch();

      expect(rows().map((row) => row.getAttribute('data-option-label'))).toEqual(['Newest', 'Older']);
    });

    it('ignores a slow list response that lands after the search was reopened', async () => {
      const slow = new Subject<DocumentSummary[]>();
      documentsServiceMock.list.mockReturnValueOnce(slow.asObservable());

      await openSearch();
      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();

      documentsServiceMock.list.mockReturnValue(of([doc({ id: '2', name: 'Fresh' })]));
      await openSearch();

      // The first open's response arrives late; it must not clobber the second's.
      slow.next([doc({ id: '1', name: 'Stale' })]);
      slow.complete();
      fixture.detectChanges();

      expect(rows().map((row) => row.getAttribute('data-option-label'))).toEqual(['Fresh']);
    });

    it('shows the load-failure row when the documents fetch fails', async () => {
      documentsServiceMock.list.mockReturnValue(throwError(() => new Error('boom')));

      await openSearch();

      expect(byTestId('quick-open-empty')!.textContent).toContain('Could not load documents.');
    });

    it('still lists documents when only the folders fetch fails (breadcrumbs degrade)', async () => {
      documentsServiceMock.list.mockReturnValue(of([doc({ id: '1', name: 'Solo', folderId: 'x' })]));
      foldersServiceMock.list.mockReturnValue(throwError(() => new Error('boom')));

      await openSearch();

      expect(rows().length).toBe(1);
    });
  });

  describe('searching documents', () => {
    beforeEach(() => {
      documentsServiceMock.list.mockReturnValue(
        of([
          doc({ id: '1', name: 'Web Application', folderId: 'f2', kind: 'markdown' }),
          doc({ id: '2', name: 'Order Service' }),
        ]),
      );
      foldersServiceMock.list.mockReturnValue(
        of([
          { id: 'f1', name: 'Designs', parentFolderId: null },
          { id: 'f2', name: 'C4', parentFolderId: 'f1' },
        ]),
      );
    });

    it('fuzzy-filters as you type and highlights the matched characters', async () => {
      await openSearch();
      type('wapp');

      const list = rows();
      expect(list.length).toBe(1);
      expect(list[0].getAttribute('data-option-label')).toBe('Web Application');
      expect(list[0].querySelectorAll('.quick-open__hit').length).toBeGreaterThan(0);
    });

    it('renders the folder path breadcrumb and the MD badge', async () => {
      await openSearch();
      type('web');

      const row = rows()[0];
      expect(row.textContent).toContain('Designs / C4');
      expect(row.querySelector('[data-testid="quick-open-kind-badge"]')!.textContent).toBe('MD');
    });

    it('shows the no-matches row for a query nothing satisfies', async () => {
      await openSearch();
      type('zzz');

      expect(rows().length).toBe(0);
      expect(byTestId('quick-open-empty')!.textContent).toContain('No matching documents');
    });

    it('caps the list at 50 rows', async () => {
      documentsServiceMock.list.mockReturnValue(
        of(Array.from({ length: 60 }, (_, i) => doc({ id: `${i}`, name: `Doc ${i}` }))),
      );

      await openSearch();

      expect(rows().length).toBe(50);
    });
  });

  describe('command mode', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('commands', [
        { id: 'save', label: 'Save', shortcutHint: 'Ctrl+S' },
        { id: 'new-document', label: 'New Document', shortcutHint: 'Alt+N' },
      ]);
      fixture.detectChanges();
    });

    it('lists every command with its shortcut hint when only ">" is typed', async () => {
      await openSearch();
      type('>');

      expect(rows().map((row) => row.getAttribute('data-option-label'))).toEqual(['Save', 'New Document']);
      expect(rows()[0].textContent).toContain('Ctrl+S');
    });

    it('filters commands and emits commandSelected on Enter', async () => {
      const selected = jest.fn();
      component.commandSelected.subscribe(selected);

      await openSearch();
      type('>new');
      keydown('Enter');

      expect(selected).toHaveBeenCalledWith('new-document');
    });

    it('shows the no-matching-commands row', async () => {
      await openSearch();
      type('>zzz');

      expect(byTestId('quick-open-empty')!.textContent).toContain('No matching commands');
    });
  });

  describe('keyboard navigation and selection', () => {
    beforeEach(() => {
      documentsServiceMock.list.mockReturnValue(
        of([
          doc({ id: '1', name: 'Alpha', updatedAt: '2026-07-10T00:00:00Z' }),
          doc({ id: '2', name: 'Beta', updatedAt: '2026-07-09T00:00:00Z' }),
        ]),
      );
    });

    it('moves the active row with the arrows, wrapping at both ends', async () => {
      await openSearch();

      expect(component.activeIndex()).toBe(0);
      keydown('ArrowDown');
      expect(component.activeIndex()).toBe(1);
      keydown('ArrowDown');
      expect(component.activeIndex()).toBe(0);
      keydown('ArrowUp');
      expect(component.activeIndex()).toBe(1);
      expect(rows()[1].getAttribute('aria-selected')).toBe('true');
    });

    it('emits documentSelected for the active row on Enter, and on row click', async () => {
      const selected = jest.fn();
      component.documentSelected.subscribe(selected);

      await openSearch();
      keydown('ArrowDown');
      keydown('Enter');
      expect(selected).toHaveBeenLastCalledWith(expect.objectContaining({ id: '2', name: 'Beta' }));

      rows()[0].click();
      expect(selected).toHaveBeenLastCalledWith(expect.objectContaining({ id: '1', name: 'Alpha' }));
    });

    it('resets the active row to the top when the query changes', async () => {
      await openSearch();
      keydown('ArrowDown');
      expect(component.activeIndex()).toBe(1);

      type('a');
      expect(component.activeIndex()).toBe(0);
    });
  });

  describe('dismissal', () => {
    it('Escape emits dismissed with focus restore, and the pill is refocused on close', async () => {
      const dismissed = jest.fn();
      component.dismissed.subscribe(dismissed);

      await openSearch();
      keydown('Escape');
      expect(dismissed).toHaveBeenCalledWith({ restoreFocus: true });

      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();
      await Promise.resolve();
      fixture.detectChanges();

      expect(document.activeElement).toBe(byTestId('title-bar-command-center'));
    });

    it('an outside press dismisses without focus restore; an inside press does not dismiss', async () => {
      const dismissed = jest.fn();
      component.dismissed.subscribe(dismissed);

      await openSearch();

      byTestId('quick-open-input')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(dismissed).not.toHaveBeenCalled();

      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(dismissed).toHaveBeenCalledWith({ restoreFocus: false });
    });

    it('Tab dismisses without hijacking focus', async () => {
      const dismissed = jest.fn();
      component.dismissed.subscribe(dismissed);

      await openSearch();
      keydown('Tab');

      expect(dismissed).toHaveBeenCalledWith({ restoreFocus: false });
    });

    it('does not react to outside presses while closed', () => {
      const dismissed = jest.fn();
      component.dismissed.subscribe(dismissed);

      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(dismissed).not.toHaveBeenCalled();
    });
  });
});
