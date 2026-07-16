import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WizardDiagramChange } from './wizard-model';
import { WizardPanelComponent } from './wizard-panel.component';

describe('WizardPanelComponent', () => {
  let fixture: ComponentFixture<WizardPanelComponent>;
  let component: WizardPanelComponent;
  let emitted: jest.Mock;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [WizardPanelComponent] }).compileComponents();

    fixture = TestBed.createComponent(WizardPanelComponent);
    component = fixture.componentInstance;
    emitted = jest.fn();
    component.diagramChanged.subscribe(emitted);
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function byTestId(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function allByTestId(testId: string): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${testId}"]`));
  }

  function click(testId: string): void {
    byTestId(testId)!.click();
    fixture.detectChanges();
  }

  function type(testId: string, value: string): void {
    const input = byTestId(testId) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function select(testId: string, value: string): void {
    const el = byTestId(testId) as HTMLSelectElement;
    el.value = value;
    el.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function lastChange(): WizardDiagramChange {
    return emitted.mock.calls[emitted.mock.calls.length - 1][0] as WizardDiagramChange;
  }

  /** Drives the C4 track as far as the elements step, with a type chosen. */
  function startC4(type: string = 'wizard-option-container'): void {
    click('wizard-option-c4');
    click('wizard-next');
    click(type);
    click('wizard-next');
  }

  function addElement(kind: string, name: string, boundary = ''): void {
    select('wizard-element-kind', kind);
    type('wizard-element-name', name);
    if (boundary) {
      select('wizard-element-boundary', boundary);
    }
    click('wizard-add-element');
  }

  describe('step 1 -- choosing a track', () => {
    it('offers both tracks with nothing selected, and cannot go forward or back', () => {
      expect(byTestId('wizard-option-c4')).toBeTruthy();
      expect(byTestId('wizard-option-sequence')).toBeTruthy();
      expect((byTestId('wizard-back') as HTMLButtonElement).disabled).toBe(true);
      expect((byTestId('wizard-next') as HTMLButtonElement).disabled).toBe(true);
      expect(byTestId('wizard-progress-caption')!.textContent).toContain('Step 1 · Diagram type');
    });

    it('shows a generic three-pip flow until a track is chosen, then the track\'s own length', () => {
      expect(component.pips().length).toBe(3);

      click('wizard-option-c4');
      expect(component.pips().length).toBe(5);
      expect((byTestId('wizard-next') as HTMLButtonElement).disabled).toBe(false);

      click('wizard-option-sequence');
      expect(component.pips().length).toBe(4);
    });

    it('writes nothing to the editor merely for picking a track', () => {
      click('wizard-option-c4');
      expect(emitted).not.toHaveBeenCalled();
    });

    it('abandons a half-built diagram when the track is switched', () => {
      startC4();
      addElement('Person', 'Customer');
      expect(component.elements().length).toBe(1);

      click('wizard-back');
      click('wizard-back');
      click('wizard-option-sequence');

      expect(component.elements()).toEqual([]);
      expect(component.c4Type()).toBeNull();
    });
  });

  describe('C4 track', () => {
    it('writes the skeleton when a type is picked, but does not render it', () => {
      click('wizard-option-c4');
      click('wizard-next');
      click('wizard-option-container');

      expect(emitted).toHaveBeenCalledTimes(1);
      expect(lastChange().plantUml).toBe('@startuml\n!define RELATIVE_INCLUDE\n!include C4_Container.puml\n@enduml');
      expect(lastChange().previousPlantUml).toBeNull();
      // Nothing to draw yet -- rendering would only produce an error.
      expect(lastChange().renderable).toBe(false);
    });

    it('keeps Add Element disabled until a name is typed, and Next until an element exists', () => {
      startC4();

      expect((byTestId('wizard-add-element') as HTMLButtonElement).disabled).toBe(true);
      expect((byTestId('wizard-next') as HTMLButtonElement).disabled).toBe(true);
      expect(byTestId('wizard-added-empty')).toBeTruthy();

      type('wizard-element-name', 'Customer');
      expect((byTestId('wizard-add-element') as HTMLButtonElement).disabled).toBe(false);

      click('wizard-add-element');
      expect((byTestId('wizard-next') as HTMLButtonElement).disabled).toBe(false);
      expect(byTestId('wizard-added-empty')).toBeNull();
    });

    it('renders once an element exists, and threads the previous document through each change', () => {
      startC4();
      const skeleton = lastChange().plantUml;

      addElement('Person', 'Customer');

      expect(lastChange().previousPlantUml).toBe(skeleton);
      expect(lastChange().renderable).toBe(true);
      expect(lastChange().plantUml).toContain('Person(customer, "Customer")');
    });

    it('clears the form after an add so the next element starts from the default kind', () => {
      startC4();
      addElement('ContainerDb', 'Database');

      expect((byTestId('wizard-element-name') as HTMLInputElement).value).toBe('');
      expect((byTestId('wizard-element-kind') as HTMLSelectElement).value).toBe('Person');
      expect((byTestId('wizard-element-boundary') as HTMLSelectElement).value).toBe('');
    });

    it('nests an element inside the boundary picked for it', () => {
      startC4();
      addElement('System_Boundary', 'Online Shop');
      addElement('Container', 'Web Application', 'onlineShop');

      expect(lastChange().plantUml).toContain('System_Boundary(onlineShop, "Online Shop") {\n  Container(webApplication, "Web Application")\n}');
    });

    it('lists each added element with its kind, and its boundary when it has one', () => {
      startC4();
      addElement('System_Boundary', 'Online Shop');
      addElement('Container', 'Web Application', 'onlineShop');

      const rows = allByTestId('wizard-added-list')[0].querySelectorAll('li');
      expect(rows[0].textContent).toContain('Boundary');
      expect(rows[0].textContent).toContain('Online Shop');
      expect(rows[1].textContent).toContain('Container');
      expect(rows[1].textContent).toContain('in Online Shop');
    });

    it('returns an orphaned element to the root rather than losing it when its boundary is removed', () => {
      startC4();
      addElement('System_Boundary', 'Online Shop');
      addElement('Container', 'Web Application', 'onlineShop');

      component.removeElement('onlineShop');
      fixture.detectChanges();

      expect(component.elements().map((element) => element.id)).toEqual(['webApplication']);
      expect(lastChange().plantUml).toContain('Container(webApplication, "Web Application")');
      expect(lastChange().plantUml).not.toContain('System_Boundary');
    });

    it('drops relationships that pointed at a removed element', () => {
      startC4();
      addElement('Person', 'Customer');
      addElement('System', 'Shop');
      click('wizard-next');

      type('wizard-rel-label', 'Uses');
      click('wizard-add-relationship');
      expect(component.relationships().length).toBe(1);

      component.removeElement('shop');
      fixture.detectChanges();

      expect(component.relationships()).toEqual([]);
      expect(lastChange().plantUml).not.toContain('Rel(');
    });

    it('builds relationships from the element pickers, defaulting to the first two', async () => {
      startC4();
      addElement('Person', 'Customer');
      addElement('System', 'Shop');
      click('wizard-next');

      // ngModel writes the select's value on a microtask, so the DOM trails
      // the model by a tick.
      await fixture.whenStable();
      fixture.detectChanges();

      expect((byTestId('wizard-rel-from') as HTMLSelectElement).value).toBe('customer');
      expect((byTestId('wizard-rel-to') as HTMLSelectElement).value).toBe('shop');
      expect((byTestId('wizard-add-relationship') as HTMLButtonElement).disabled).toBe(true);

      type('wizard-rel-label', 'Uses');
      type('wizard-rel-technology', 'HTTPS');
      click('wizard-add-relationship');

      expect(lastChange().plantUml).toContain('Rel(customer, shop, "Uses", "HTTPS")');
      // The form clears, so the Add button falls back to disabled.
      expect((byTestId('wizard-add-relationship') as HTMLButtonElement).disabled).toBe(true);
    });

    it('excludes boundaries from the relationship pickers -- a grouping is not an endpoint', () => {
      startC4();
      addElement('Person', 'Customer');
      addElement('System_Boundary', 'Online Shop');
      click('wizard-next');

      const options = Array.from((byTestId('wizard-rel-from') as HTMLSelectElement).options).map((o) => o.value);
      expect(options).toEqual(['customer']);
    });

    it('finishes with a summary of what was built', () => {
      startC4();
      addElement('Person', 'Customer');
      addElement('System_Boundary', 'Online Shop');
      addElement('Container', 'Web Application', 'onlineShop');
      click('wizard-next');
      click('wizard-next');

      expect(byTestId('wizard-summary')!.textContent).toContain('C4 diagram complete.');
      expect(fixture.nativeElement.textContent).toContain('1 person · 1 boundary · 1 element · 0 relationships');
      expect(component.pips().every((pip) => pip.done)).toBe(true);
      expect(byTestId('wizard-progress-caption')!.textContent).toContain('Diagram complete');
    });
  });

  describe('sequence track', () => {
    function startSequence(): void {
      click('wizard-option-sequence');
      click('wizard-next');
    }

    function addParticipant(kind: string, name: string): void {
      select('wizard-participant-kind', kind);
      type('wizard-participant-name', name);
      click('wizard-add-participant');
    }

    it('writes nothing until the first participant, then renders', () => {
      startSequence();
      expect(emitted).not.toHaveBeenCalled();

      addParticipant('actor', 'Customer');

      expect(lastChange().plantUml).toBe('@startuml\nactor Customer\n@enduml');
      expect(lastChange().previousPlantUml).toBeNull();
      expect(lastChange().renderable).toBe(true);
    });

    it('gives a multi-word participant a quoted name and an alias', () => {
      startSequence();
      addParticipant('participant', 'Web App');

      expect(lastChange().plantUml).toContain('participant "Web App" as webApp');
    });

    it('keeps Add Participant disabled until a name is typed, and Next until one exists', () => {
      startSequence();

      expect((byTestId('wizard-add-participant') as HTMLButtonElement).disabled).toBe(true);
      expect((byTestId('wizard-next') as HTMLButtonElement).disabled).toBe(true);

      type('wizard-participant-name', 'Customer');
      click('wizard-add-participant');

      expect((byTestId('wizard-next') as HTMLButtonElement).disabled).toBe(false);
    });

    it('sends messages between the added participants', async () => {
      startSequence();
      addParticipant('actor', 'Customer');
      addParticipant('participant', 'Web App');
      click('wizard-next');

      await fixture.whenStable();
      fixture.detectChanges();

      expect((byTestId('wizard-message-from') as HTMLSelectElement).value).toBe('Customer');
      expect((byTestId('wizard-message-to') as HTMLSelectElement).value).toBe('webApp');

      type('wizard-message-label', 'Place order');
      click('wizard-add-message');

      expect(lastChange().plantUml).toContain('Customer -> webApp : Place order');

      select('wizard-message-arrow', '-->');
      select('wizard-message-from', 'webApp');
      select('wizard-message-to', 'Customer');
      type('wizard-message-label', 'Confirmation');
      click('wizard-add-message');

      expect(lastChange().plantUml).toContain('webApp --> Customer : Confirmation');
    });

    it('drops messages that referenced a removed participant', () => {
      startSequence();
      addParticipant('actor', 'Customer');
      addParticipant('participant', 'Web App');
      click('wizard-next');
      type('wizard-message-label', 'Place order');
      click('wizard-add-message');

      component.removeParticipant('webApp');
      fixture.detectChanges();

      expect(component.messages()).toEqual([]);
      expect(lastChange().plantUml).not.toContain('Place order');
    });

    it('finishes with a summary of what was built', () => {
      startSequence();
      addParticipant('actor', 'Customer');
      click('wizard-next');
      click('wizard-next');

      expect(byTestId('wizard-summary')!.textContent).toContain('Sequence diagram complete.');
      expect(fixture.nativeElement.textContent).toContain('1 participant · 0 messages');
    });
  });

  describe('finishing', () => {
    it('starts the next diagram fresh, appending it rather than replacing the finished one', () => {
      click('wizard-option-sequence');
      click('wizard-next');
      type('wizard-participant-name', 'Customer');
      click('wizard-add-participant');
      click('wizard-next');
      click('wizard-next');

      click('wizard-restart');

      expect(byTestId('wizard-option-c4')).toBeTruthy();
      expect(component.participants()).toEqual([]);

      click('wizard-option-sequence');
      click('wizard-next');
      type('wizard-participant-name', 'Auditor');
      click('wizard-add-participant');

      // previousPlantUml null => the page appends, leaving the finished diagram alone.
      expect(lastChange().previousPlantUml).toBeNull();
    });

    it('emits closed so the page can collapse the panel', () => {
      const closed = jest.fn();
      component.closed.subscribe(closed);

      click('wizard-option-sequence');
      click('wizard-next');
      type('wizard-participant-name', 'Customer');
      click('wizard-add-participant');
      click('wizard-next');
      click('wizard-next');
      click('wizard-close');

      expect(closed).toHaveBeenCalledTimes(1);
    });
  });
});
