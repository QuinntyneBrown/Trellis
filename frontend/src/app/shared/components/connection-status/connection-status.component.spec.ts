import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectionStatusComponent } from './connection-status.component';

describe('ConnectionStatusComponent', () => {
  let fixture: ComponentFixture<ConnectionStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectionStatusComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConnectionStatusComponent);
  });

  it.each(['connected', 'disconnected', 'reconnecting'] as const)(
    'renders exactly "%s" as the text content',
    (state) => {
      fixture.componentInstance.state = state;
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement.querySelector('[data-testid="connection-status"]');
      expect(el.textContent).toBe(state);
    },
  );
});
