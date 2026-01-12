import { Component, EventEmitter, Input, Output } from '@angular/core';

export type DefaultCellMode = 'base' | 'tree';

@Component({
  selector: 'default-cell',
  templateUrl: './default-cell.html',
  styleUrls: ['./default-cell.css'],
})
export class DefaultCellComponent {
  @Input() object: string = '';
  @Input() name: string = '';
  @Input() type: string = '';

  /** Chip toggle state */
  @Input() mode: DefaultCellMode = 'base';

  /** Optional: disable either chip (or the entire toggle) */
  @Input() baseDisabled = false;
  @Input() treeDisabled = false;
  @Input() toggleDisabled = false;

  /** Emit when mode changes so parent can react (recommended) */
  @Output() modeChange = new EventEmitter<DefaultCellMode>();

  setMode(next: DefaultCellMode): void {
    if (this.toggleDisabled) return;
    if (next === 'base' && this.baseDisabled) return;
    if (next === 'tree' && this.treeDisabled) return;

    if (this.mode !== next) {
      this.mode = next;
      this.modeChange.emit(this.mode);
    }
  }

  isSelected(which: DefaultCellMode): boolean {
    return this.mode === which;
  }

  isChipDisabled(which: DefaultCellMode): boolean {
    if (this.toggleDisabled) return true;
    return which === 'base' ? this.baseDisabled : this.treeDisabled;
  }

  /**
   * Get icon for data type
   */
  getTypeIcon(type: string): string {
    const typeMap: { [key: string]: string } = {
      str: 'T',
      string: 'T',
      int: '#',
      integer: '#',
      float: '∞',
      bool: '✓',
      boolean: '✓',
      list: '[]',
      dict: '{}',
      object: '{}',
      date: '📅',
      datetime: '🕐',
      polariList: '📋',
      polariDict: '📚',
    };

    return typeMap[type?.toLowerCase()] || '◆';
  }
}
