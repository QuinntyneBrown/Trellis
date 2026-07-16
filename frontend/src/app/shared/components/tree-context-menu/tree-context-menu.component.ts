import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
  signal,
} from '@angular/core';

import { TreeContextMenuClosedEvent, TreeContextMenuItem } from './tree-context-menu.model';

const VIEWPORT_GUTTER_PX = 4;

@Component({
  selector: 'app-tree-context-menu',
  standalone: true,
  imports: [],
  templateUrl: './tree-context-menu.component.html',
  styleUrl: './tree-context-menu.component.scss',
})
export class TreeContextMenuComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) items: TreeContextMenuItem[] = [];
  @Input({ required: true }) clientX = 0;
  @Input({ required: true }) clientY = 0;
  @Input() ariaLabel = 'Context menu';

  @Output() readonly commandSelected = new EventEmitter<string>();
  @Output() readonly menuClosed = new EventEmitter<TreeContextMenuClosedEvent>();

  @ViewChild('menu', { static: true }) private menu!: ElementRef<HTMLElement>;
  @ViewChildren('menuItem') private menuItemButtons!: QueryList<ElementRef<HTMLButtonElement>>;

  readonly left = signal(0);
  readonly top = signal(0);
  readonly activeIndex = signal(0);
  private viewInitialized = false;

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.positionAndFocus();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) {
      this.activeIndex.set(this.firstEnabledIndex());
    }
    // Reposition only on real coordinate changes -- deliberately NOT on
    // changes['items']. A consumer whose [items] binding produces a new
    // array reference on every change-detection pass would otherwise loop
    // forever: the microtask scheduled here drains, zone.js fires
    // onMicrotaskEmpty, another CD pass reads a new reference, ngOnChanges
    // fires again, and the tab wedges at 100% CPU.
    if (this.viewInitialized && (changes['clientX'] || changes['clientY'])) {
      queueMicrotask(() => this.positionAndFocus());
    }
  }

  onItemClicked(item: TreeContextMenuItem): void {
    if (!item.disabled) {
      this.commandSelected.emit(item.id);
    }
  }

  onItemMouseEnter(index: number): void {
    if (!this.items[index]?.disabled) {
      this.activeIndex.set(index);
      this.focusActiveItem();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveActive(-1);
        break;
      case 'Home':
        event.preventDefault();
        this.setActive(this.firstEnabledIndex());
        break;
      case 'End':
        event.preventDefault();
        this.setActive(this.lastEnabledIndex());
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.onItemClicked(this.items[this.activeIndex()]);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.menuClosed.emit({ restoreFocus: true });
        break;
      case 'Tab':
        this.menuClosed.emit({ restoreFocus: false });
        break;
    }
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent): void {
    if (!this.menu.nativeElement.contains(event.target as Node)) {
      this.menuClosed.emit({ restoreFocus: false });
    }
  }

  @HostListener('window:resize')
  onViewportChanged(): void {
    this.positionAndFocus();
  }

  private positionAndFocus(): void {
    const rect = this.menu.nativeElement.getBoundingClientRect();
    const maximumLeft = Math.max(VIEWPORT_GUTTER_PX, window.innerWidth - rect.width - VIEWPORT_GUTTER_PX);
    const maximumTop = Math.max(VIEWPORT_GUTTER_PX, window.innerHeight - rect.height - VIEWPORT_GUTTER_PX);
    this.left.set(Math.min(Math.max(VIEWPORT_GUTTER_PX, this.clientX), maximumLeft));
    this.top.set(Math.min(Math.max(VIEWPORT_GUTTER_PX, this.clientY), maximumTop));
    this.focusActiveItem();
  }

  private firstEnabledIndex(): number {
    const index = this.items.findIndex((item) => !item.disabled);
    return index < 0 ? 0 : index;
  }

  private lastEnabledIndex(): number {
    for (let index = this.items.length - 1; index >= 0; index--) {
      if (!this.items[index].disabled) {
        return index;
      }
    }
    return 0;
  }

  private moveActive(direction: 1 | -1): void {
    if (!this.items.some((item) => !item.disabled)) {
      return;
    }

    let index = this.activeIndex();
    do {
      index = (index + direction + this.items.length) % this.items.length;
    } while (this.items[index].disabled);
    this.setActive(index);
  }

  private setActive(index: number): void {
    this.activeIndex.set(index);
    this.focusActiveItem();
  }

  private focusActiveItem(): void {
    this.menuItemButtons?.get(this.activeIndex())?.nativeElement.focus();
  }
}
