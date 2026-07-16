export interface TreeContextMenuItem {
  id: string;
  label: string;
  separatorBefore?: boolean;
  disabled?: boolean;
  danger?: boolean;
}

export interface TreeContextMenuRequest<TTarget> {
  target: TTarget;
  clientX: number;
  clientY: number;
  triggerElement: HTMLElement;
}

export interface TreeContextMenuClosedEvent {
  restoreFocus: boolean;
}
