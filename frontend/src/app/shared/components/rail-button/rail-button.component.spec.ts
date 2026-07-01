import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RailButtonComponent } from './rail-button.component';

describe('RailButtonComponent', () => {
  let fixture: ComponentFixture<RailButtonComponent>;
  let component: RailButtonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RailButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RailButtonComponent);
    component = fixture.componentInstance;
    component.icon = 'new';
    component.label = 'New';
    component.testId = 'rail-new';
    fixture.detectChanges();
  });

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('[data-testid="rail-new"]');
  }

  function tooltip(): HTMLElement {
    return fixture.nativeElement.querySelector('.rail-button__tooltip');
  }

  it('renders the icon svg and the tooltip span', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('svg.rail-button__icon')).toBeTruthy();
    expect(el.querySelectorAll('svg.rail-button__icon path').length).toBeGreaterThan(0);
    expect(tooltip()).toBeTruthy();
  });

  it('shows the plain label with no parenthetical when shortcut is unset', () => {
    expect(tooltip().textContent).toBe('New');
    expect(button().getAttribute('aria-label')).toBe('New');
  });

  it('shows "Save (Ctrl+S)" when label is Save and shortcut is Ctrl+S', () => {
    component.label = 'Save';
    component.shortcut = 'Ctrl+S';
    fixture.detectChanges();

    expect(tooltip().textContent).toBe('Save (Ctrl+S)');
  });

  it('keeps aria-label equal to the same computed tooltip text', () => {
    component.label = 'Save';
    component.shortcut = 'Ctrl+S';
    fixture.detectChanges();

    expect(button().getAttribute('aria-label')).toBe(tooltip().textContent);
    expect(button().getAttribute('aria-label')).toBe('Save (Ctrl+S)');
  });

  it('places testId on a real <button> element', () => {
    expect(button().tagName).toBe('BUTTON');
  });

  it('renders the button with type="button"', () => {
    expect(button().getAttribute('type')).toBe('button');
  });

  it('emits clicked exactly once when clicked', () => {
    const spy = jest.fn();
    component.clicked.subscribe(spy);

    button().click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not apply the active modifier class by default', () => {
    expect(button().classList).not.toContain('rail-button--active');
  });

  it('does not apply the active modifier class when active is explicitly false', () => {
    component.active = false;
    fixture.detectChanges();

    expect(button().classList).not.toContain('rail-button--active');
  });

  it('applies the active modifier class when active is true', () => {
    component.active = true;
    fixture.detectChanges();

    expect(button().classList).toContain('rail-button--active');
  });
});
