// polari-list-cell.component.ts
import { Component, Input } from '@angular/core';
import { MatGridTile } from '@angular/material/grid-list';

@Component({
  standalone: false,
  selector: 'polari-list-cell',
  templateUrl: `polari-list-cell.html`,
  styleUrls: ['./polari-list-cell.css']
})
export class DefaultCellComponent {
  @Input() object: string = '';
  @Input() name: string = '';
  @Input() type: string = '';
}