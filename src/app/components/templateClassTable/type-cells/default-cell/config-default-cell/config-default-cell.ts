// default-cell.component.ts
import { Component, Input } from '@angular/core';
import { MatGridListModule, MatGridList, MatGridTile, MatGridTileText } from '@angular/material/grid-list';

@Component({
  selector: 'config-default-cell',
  templateUrl: `config-default-cell.html`,
  styleUrls: ['./config-default-cell.css']
})
export class ConfigDefaultCellComponent {
  @Input() object: string = '';
  @Input() name: string = '';
  @Input() type: string = '';

  constructor()
  {
    
  }
}