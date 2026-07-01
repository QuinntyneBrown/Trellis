import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { DocumentsService } from '../../../core/services/documents.service';
import { DocumentsPanelComponent } from './documents-panel.component';

describe('DocumentsPanelComponent', () => {
  let fixture: ComponentFixture<DocumentsPanelComponent>;
  let component: DocumentsPanelComponent;
  let documentsServiceMock: { list: jest.Mock; delete: jest.Mock; getById: jest.Mock; update: jest.Mock };
  const summaries: DocumentSummary[] = [{ id: '1', name: 'Doc One', updatedAt: '2026-01-01T00:00:00Z' }];

  beforeEach(async () => {
    documentsServiceMock = {
      list: jest.fn().mockReturnValue(of(summaries)),
      delete: jest.fn().mockReturnValue(of(undefined)),
      getById: jest.fn(),
      update: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DocumentsPanelComponent],
      providers: [{ provide: DocumentsService, useValue: documentsServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentsPanelComponent);
    component = fixture.componentInstance;
  });

  it('renders nothing when closed', () => {
    component.open = false;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="documents-panel"]')).toBeNull();
    expect(documentsServiceMock.list).not.toHaveBeenCalled();
  });

  it('fetches and renders documents when opened', () => {
    component.open = true;
    component.ngOnChanges({ open: { currentValue: true } as never });
    fixture.detectChanges();

    expect(documentsServiceMock.list).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[data-testid="documents-panel"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="document-item"]').length).toBe(1);
  });

  it('emits documentOpened when a document item is opened', () => {
    component.open = true;
    component.ngOnChanges({ open: { currentValue: true } as never });
    fixture.detectChanges();

    const spy = jest.fn();
    component.documentOpened.subscribe(spy);

    (fixture.nativeElement.querySelector('[data-testid="document-item-open"]') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith(summaries[0]);
  });
});
