// string-cell.component.ts
import { Component, Input } from '@angular/core';
import { MatGridTile } from '@angular/material/grid-list';

@Component({
  selector: 'string-cell',
  templateUrl: `string-cell.html`,
  styleUrls: ['./string-cell.css']
})
export class StringCellComponent {
  @Input() object: string = '';
  @Input() name: string = '';
  @Input() type: string = '';
}