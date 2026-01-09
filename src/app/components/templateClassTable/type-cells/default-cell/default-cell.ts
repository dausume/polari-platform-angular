// default-cell.component.ts
import { Component, Input } from '@angular/core';
import { MatGridListModule, MatGridList, MatGridTile, MatGridTileText } from '@angular/material/grid-list';

@Component({
  selector: 'default-cell',
  templateUrl: `default-cell.html`,
  styleUrls: ['./default-cell.css']
})
export class DefaultCellComponent {
  @Input() object: string = '';
  @Input() name: string = '';
  @Input() type: string = '';

  constructor()
  {

  }

  /**
   * Get icon for data type
   */
  getTypeIcon(type: string): string {
    const typeMap: { [key: string]: string } = {
      'str': 'T',
      'string': 'T',
      'int': '#',
      'integer': '#',
      'float': '∞',
      'bool': '✓',
      'boolean': '✓',
      'list': '[]',
      'dict': '{}',
      'object': '{}',
      'date': '📅',
      'datetime': '🕐',
      'polariList': '📋',
      'polariDict': '📚'
    };

    return typeMap[type?.toLowerCase()] || '◆';
  }
}