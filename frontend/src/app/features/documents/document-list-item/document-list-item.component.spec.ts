import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { DocumentListItemComponent } from './document-list-item.component';

describe('DocumentListItemComponent', () => {
  let fixture: ComponentFixture<DocumentListItemComponent>;
  let component: DocumentListItemComponent;
  const document: DocumentSummary = { id: '1', name: 'My Diagram', updatedAt: '2026-01-01T00:00:00Z' };
  let confirmSpy: jest.SpyInstance;
  let promptSpy: jest.SpyInstance;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentListItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentListItemComponent);
    component = fixture.componentInstance;
    component.document = document;
    fixture.detectChanges();

    confirmSpy = jest.spyOn(window, 'confirm');
    promptSpy = jest.spyOn(window, 'prompt');
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    promptSpy.mockRestore();
  });

  function byTestId(testId: string): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  it('renders the item with the data-document-name attribute set', () => {
    const item = byTestId('document-item');
    expect(item.getAttribute('data-document-name')).toBe('My Diagram');
  });

  it('emits open with the document when Open is clicked', () => {
    const spy = jest.fn();
    component.open.subscribe(spy);

    byTestId('document-item-open').click();

    expect(spy).toHaveBeenCalledWith(document);
  });

  it('emits delete only after the user confirms', () => {
    const spy = jest.fn();
    component.delete.subscribe(spy);

    confirmSpy.mockReturnValue(false);
    byTestId('document-item-delete').click();
    expect(spy).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    byTestId('document-item-delete').click();
    expect(spy).toHaveBeenCalledWith(document);
  });

  it('emits rename with the trimmed new name when it differs from the current name', () => {
    const spy = jest.fn();
    component.rename.subscribe(spy);

    promptSpy.mockReturnValue('  Renamed Diagram  ');
    byTestId('document-item-rename').click();

    expect(spy).toHaveBeenCalledWith({ document, newName: 'Renamed Diagram' });
  });

  it('does not emit rename when the prompt is cancelled or unchanged', () => {
    const spy = jest.fn();
    component.rename.subscribe(spy);

    promptSpy.mockReturnValue(null);
    byTestId('document-item-rename').click();

    promptSpy.mockReturnValue('My Diagram');
    byTestId('document-item-rename').click();

    expect(spy).not.toHaveBeenCalled();
  });
});
