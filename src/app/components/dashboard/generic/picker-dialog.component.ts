import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CardsComponent } from './cards.component';
import { CardsConfig } from './class-rows-cards';

export interface PickerDialogData { title: string; popup: CardsConfig; }

/** wb-1: the modal body of `picker-button` - a title, the nested `cards` config, a Close button. Stays open after a card action. */
@Component({
  standalone: true,
  selector: 'picker-dialog',
  imports: [MatDialogModule, CardsComponent],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <cards [dataPath]="p.dataPath" [title_field]="p.title_field || ''" [subtitle_field]="p.subtitle_field || ''"
             [badge_fields]="p.badge_fields || []" [fields]="p.fields || {}" [group_by]="p.group_by || ''"
             [facets]="p.facets || []" [action]="p.action || null" [empty_text]="p.empty_text || ''"></cards>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button type="button" class="close" mat-dialog-close>Close</button></mat-dialog-actions>`,
  styles: [`
    mat-dialog-content { max-height: 70vh; }
    button.close { font: inherit; padding: 4px 16px; border-radius: var(--radius-pill); cursor: pointer;
      border: 1px solid var(--nav-background); background: var(--nav-background); color: var(--nav-text); }
  `],
})
export class PickerDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: PickerDialogData) {}
  get p(): CardsConfig { return this.data.popup; }
}
