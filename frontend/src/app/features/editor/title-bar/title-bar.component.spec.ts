import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TitleBarComponent } from './title-bar.component';

describe('TitleBarComponent', () => {
  let fixture: ComponentFixture<TitleBarComponent>;
  let component: TitleBarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TitleBarComponent);
    component = fixture.componentInstance;
    component.documentName = 'Untitled diagram';
    fixture.detectChanges();
  });

  function byTestId(testId: string): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  it('shows "name — Trellis" in the command center', () => {
    expect(byTestId('title-bar-title').textContent).toBe('Untitled diagram — Trellis');
  });

  it('updates the command center when the document name changes', () => {
    component.documentName = 'order-flow.puml';
    fixture.detectChanges();

    expect(byTestId('title-bar-title').textContent).toBe('order-flow.puml — Trellis');
  });

  it('renders the app menu entries', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.title-bar__menu')).map(
      (button) => (button as HTMLElement).textContent?.trim(),
    );
    expect(labels).toEqual(['File', 'Edit', 'View', 'Help']);
  });

  it('emits sidebarToggle from the primary-sidebar layout toggle', () => {
    const spy = jest.fn();
    component.sidebarToggle.subscribe(spy);

    (byTestId('title-bar-sidebar-toggle') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('fills the sidebar toggle only while a side panel is open', () => {
    expect(byTestId('title-bar-sidebar-toggle').classList).not.toContain('title-bar__layout-toggle--active');

    component.sidePanelOpen = true;
    fixture.detectChanges();

    expect(byTestId('title-bar-sidebar-toggle').classList).toContain('title-bar__layout-toggle--active');
  });

  it('gives every icon-only control an aria-label', () => {
    const iconButtons = fixture.nativeElement.querySelectorAll(
      '.title-bar__layout-toggle, .title-bar__window-control, .title-bar__command-center',
    );
    for (const button of Array.from(iconButtons)) {
      expect((button as HTMLElement).getAttribute('aria-label')).toBeTruthy();
    }
  });
});
