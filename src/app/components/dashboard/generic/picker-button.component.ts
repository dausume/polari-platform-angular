import { Component, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CardsConfig } from './class-rows-cards';
import { PickerDialogComponent } from './picker-dialog.component';

/**
 * wb-1 `picker-button`: a button that opens a modal holding a configured `cards` item (the nested `popup` config). The card action runs inside
 * the modal and bumps page scope `rev`, so tables behind it reload; the modal stays open for several adds in a row. Inputs:
 * { label, title, popup: CardsConfig } - see class-rows-cards.ts. (Chosen over a `button`-item variant: the `button` item invokes a
 * DirectInvocation no-code solution, a different contract; a registered component adds no new item kind to the renderer.)
 */
@Component({
  standalone: true,
  selector: 'picker-button',
  template: `<button type="button" class="open" (click)="open()">{{ label || 'Pick' }}</button>`,
  styles: [`
    button.open { font: inherit; padding: 6px 18px; border-radius: var(--radius-pill); cursor: pointer;
      border: 1px solid var(--nav-background); background: var(--nav-background); color: var(--nav-text); }
    button.open:focus-visible { outline: 2px solid var(--nav-background); outline-offset: 2px; }
  `],
})
export class PickerButtonComponent {
  @Input() label = '';
  @Input() title = '';
  @Input() popup: CardsConfig | null = null;

  constructor(private dialog: MatDialog) {}

  open(): void {
    if (!this.popup) { return; }
    this.dialog.open(PickerDialogComponent, {
      data: { title: this.title || this.label, popup: this.popup },
      width: 'min(960px, 96vw)', maxWidth: '96vw', autoFocus: false,
    });
  }
}
