import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TreeActionButtonComponent } from './tree-action-button.component';
import { TREE_ACTION_ICON_PATHS } from './tree-action-icons';

describe('TreeActionButtonComponent', () => {
  let fixture: ComponentFixture<TreeActionButtonComponent>;
  let component: TreeActionButtonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeActionButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TreeActionButtonComponent);
    component = fixture.componentInstance;
    component.icon = 'delete';
    component.label = 'Delete';
    component.testId = 'row-delete';
    fixture.detectChanges();
  });

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('[data-testid="row-delete"]');
  }

  it('places testId on a real <button> element with type="button"', () => {
    expect(button().tagName).toBe('BUTTON');
    expect(button().getAttribute('type')).toBe('button');
  });

  it('renders one <path> per entry of the chosen icon', () => {
    const paths = fixture.nativeElement.querySelectorAll('svg.tree-action-button__icon path');
    expect(paths.length).toBe(TREE_ACTION_ICON_PATHS['delete'].length);
  });

  it('sets both title and aria-label from the single label input', () => {
    expect(button().getAttribute('title')).toBe('Delete');
    expect(button().getAttribute('aria-label')).toBe('Delete');
  });

  it('keeps title and aria-label in lockstep when the label changes', () => {
    component.label = 'Delete folder and contents';
    fixture.detectChanges();

    expect(button().getAttribute('title')).toBe(button().getAttribute('aria-label'));
    expect(button().getAttribute('title')).toBe('Delete folder and contents');
  });

  it('does not apply the danger modifier class by default', () => {
    component.danger = false;
    fixture.detectChanges();

    expect(button().classList).not.toContain('tree-action-button--danger');
  });

  it('applies the danger modifier class when danger is true', () => {
    component.danger = true;
    fixture.detectChanges();

    expect(button().classList).toContain('tree-action-button--danger');
  });

  it('emits clicked with the original MouseEvent so parents can stopPropagation', () => {
    const spy = jest.fn();
    component.clicked.subscribe(spy);

    button().click();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
  });
});
