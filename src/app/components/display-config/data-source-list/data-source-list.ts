import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DisplayStateDefinition, DisplayDataSource } from '@models/dashboards/DisplayStateDefinition';

@Component({
  standalone: false,
  selector: 'display-data-source-list',
  templateUrl: 'data-source-list.html',
  styleUrls: ['./data-source-list.css']
})
export class DataSourceListComponent {

  @Input() stateDefinition!: DisplayStateDefinition;
  @Input() availableSolutions: { name: string }[] = [];
  @Output() stateChange = new EventEmitter<void>();

  addDataSource(): void {
    this.stateDefinition.addDataSource({
      id: crypto.randomUUID(),
      label: '',
      sourceType: 'class',
      classSubType: 'all-instances',
      autoLoad: true
    });
    this.emitChange();
  }

  removeDataSource(index: number): void {
    this.stateDefinition.dataSources.splice(index, 1);
    this.emitChange();
  }

  onDataSourceChange(): void {
    this.emitChange();
  }

  private emitChange(): void {
    this.stateChange.emit();
  }
}
