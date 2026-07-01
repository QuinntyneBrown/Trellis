import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ErrorBannerComponent } from './error-banner.component';

describe('ErrorBannerComponent', () => {
  let fixture: ComponentFixture<ErrorBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorBannerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorBannerComponent);
  });

  it('renders nothing when there is no message', () => {
    fixture.componentInstance.message = null;
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('renders the message when set', () => {
    fixture.componentInstance.message = 'Something went wrong';
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Something went wrong');
  });
});
